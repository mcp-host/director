import { t } from "@director.run/utilities/trpc";
import { z } from "zod";

import { HTTPClient } from "@director.run/mcp/client/http-client";
import { AppError, ErrorCode } from "@director.run/utilities/error";
import { proxyTargetAttributesSchema } from "@director.run/utilities/schema";
import {
  getStreamablePathForProxy,
  restartConnectedClients,
} from "../../helpers";
import { ProxyServerStore } from "../../proxy-server-store";

const ProxyCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  servers: z.array(proxyTargetAttributesSchema).optional(),
});

const ProxyUpdateSchema = ProxyCreateSchema.omit({
  servers: true,
}).partial();

export function createProxyStoreRouter({
  proxyStore,
}: { proxyStore: ProxyServerStore }) {
  return t.router({
    getAll: t.procedure.query(async () => {
      return (await proxyStore.getAll()).map((proxy) => ({
        ...proxy.toPlainObject(),
        path: getStreamablePathForProxy(proxy.id),
      }));
    }),

    get: t.procedure
      .input(z.object({ proxyId: z.string() }))
      .query(({ input }) => {
        return {
          ...proxyStore.get(input.proxyId).toPlainObject(),
          path: getStreamablePathForProxy(input.proxyId),
        };
      }),

    create: t.procedure.input(ProxyCreateSchema).mutation(async ({ input }) => {
      return (
        await proxyStore.create({
          name: input.name,
          description: input.description ?? undefined,
          servers: input.servers,
        })
      ).toPlainObject();
    }),

    update: t.procedure
      .input(
        z.object({
          proxyId: z.string(),
          attributes: ProxyUpdateSchema,
        }),
      )
      .mutation(async ({ input }) => {
        return (
          await proxyStore.update(input.proxyId, {
            name: input.attributes.name,
            description: input.attributes.description ?? undefined,
          })
        ).toPlainObject();
      }),
    delete: t.procedure
      .input(z.object({ proxyId: z.string() }))
      .mutation(async ({ input }) => {
        await proxyStore.delete(input.proxyId);
        return { success: true };
      }),
    addServer: t.procedure
      .input(
        z.object({
          proxyId: z.string(),
          server: proxyTargetAttributesSchema,
        }),
      )
      .mutation(async ({ input }) => {
        const proxy = await proxyStore.addServer(input.proxyId, input.server);
        await restartConnectedClients(proxy);
        return proxy.toPlainObject();
      }),

    authenticate: t.procedure
      .input(z.object({ proxyId: z.string(), serverName: z.string() }))
      .query(async ({ input }) => {
        const proxy = await proxyStore.get(input.proxyId);
        const target = await proxy.getTarget(input.serverName);

        if (target instanceof HTTPClient) {
          if (target.status === "connected") {
            throw new AppError(
              ErrorCode.BAD_REQUEST,
              "target is already connected",
            );
          } else {
            return await target.startAuthFlow();
          }
        } else {
          throw new AppError(
            ErrorCode.BAD_REQUEST,
            "can only authenticate http clients",
          );
        }
      }),

    purge: t.procedure.mutation(() => proxyStore.purge()),

    removeServer: t.procedure
      .input(
        z.object({
          proxyId: z.string(),
          serverName: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        const proxy = await proxyStore.removeServer(
          input.proxyId,
          input.serverName,
        );
        await restartConnectedClients(proxy);
        return proxy.toPlainObject();
      }),
  });
}
