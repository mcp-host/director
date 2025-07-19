import {
  type EntryParameter,
  type ProxyTransport,
  type RegistryEntry,
  optionalStringSchema,
  requiredStringSchema,
  toolSchema,
} from "@director.run/utilities/schema";
import { t } from "@director.run/utilities/trpc";
import { z } from "zod";
import { protectedProcedure } from ".";
import type { Store } from "../../db/store";
import { enrichEntries } from "../../enrichment/enrich";
import { entries } from "../../seed/entries";

const parameterToZodSchema = (parameter: EntryParameter) => {
  if (parameter.type === "string") {
    return parameter.required ? requiredStringSchema : optionalStringSchema;
  } else {
    throw new Error(`Unsupported parameter type: ${parameter.type}`);
  }
};

export function substituteParameters(
  entry: Pick<RegistryEntry, "transport" | "parameters">,
  parameters: Record<string, string>,
): ProxyTransport {
  if (entry.transport.type === "stdio") {
    const env: Record<string, string> = {
      ...entry.transport.env,
    };
    let args: string[] = [...entry.transport.args];
    // only stdio transports have parameters
    entry.parameters?.forEach((parameter) => {
      const paramValue = parameters[parameter.name];
      const schema = parameterToZodSchema(parameter);

      schema.parse(paramValue);

      if (!paramValue) {
        // Not a required parameter, so we can skip it
        // Missing required parameters are handled by the zod schema
        return;
      }

      // Substitute the parameter into the transport command
      // Replace the parameter in the env object
      Object.entries(env).forEach(([key, value]) => {
        env[key] = value.replace(`<${parameter.name}>`, paramValue);
      });

      // Replace the parameter in the args array
      args = args.map((arg) => arg.replace(`<${parameter.name}>`, paramValue));
    });

    return {
      env,
      args,
      type: "stdio",
      command: entry.transport.command,
    };
  } else {
    const headers = entry.transport.headers ?? {};
    entry.parameters?.forEach((parameter) => {
      const paramValue = parameters[parameter.name];
      const schema = parameterToZodSchema(parameter);

      schema.parse(paramValue);

      if (!paramValue) {
        // Not a required parameter, so we can skip it
        // Missing required parameters are handled by the zod schema
        return;
      }
      Object.entries(headers).forEach(([key, value]) => {
        headers[key] = value.replace(`<${parameter.name}>`, paramValue);
      });
    });

    return {
      type: "http",
      url: entry.transport.url,
      headers,
    };
  }
}

export function createEntriesRouter({ store }: { store: Store }) {
  return t.router({
    getEntries: t.procedure
      .input(
        z.object({
          pageIndex: z.number().min(0),
          pageSize: z.number().min(1),
        }),
      )
      .query(({ input }) => store.entries.paginateEntries(input)),

    getEntryByName: t.procedure
      .input(z.object({ name: z.string() }))
      .query(({ input }) => store.entries.getEntryByName(input.name)),

    getTransportForEntry: t.procedure
      .input(
        z.object({
          entryName: z.string(),
          parameters: z.record(z.string(), z.string()).optional(),
        }),
      )
      .query(async ({ input }) => {
        const entry = await store.entries.getEntryByName(input.entryName);
        return substituteParameters(entry, input.parameters ?? {});
      }),

    purge: protectedProcedure.input(z.object({})).mutation(async () => {
      await store.entries.deleteAllEntries();
    }),

    updateEntry: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          isConnectable: z.boolean().optional(),
          lastConnectionAttemptedAt: z.date().optional(),
          lastConnectionError: z.string().optional(),
          tools: z.array(toolSchema).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await store.entries.updateEntry(input.id, {
          isConnectable: input.isConnectable,
          lastConnectionAttemptedAt: input.lastConnectionAttemptedAt,
          lastConnectionError: input.lastConnectionError,
          tools: input.tools,
        });
      }),

    populate: protectedProcedure
      .input(z.object({}))
      .mutation(() => store.entries.addEntries(entries)),

    enrich: protectedProcedure.input(z.object({})).mutation(async () => {
      await enrichEntries(store);
    }),

    stats: protectedProcedure.input(z.object({})).query(async () => {
      return await store.entries.getStatistics();
    }),
  });
}
