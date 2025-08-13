import { DirectorCommand } from "@director.run/utilities/cli/director-command";
import { actionWithErrorHandler } from "@director.run/utilities/cli/index";
import { confirm, editor, input } from "@inquirer/prompts";
import { gatewayClient } from "../client";
import { listPrompts } from "../views/prompts-list";

export function registerPromptsCommands(program: DirectorCommand): void {
  const command = new DirectorCommand("prompts").description(
    "Manage prompts for a proxy",
  );
  program.addCommand(command);

  command
    .command("ls <proxyId>")
    .alias("list")
    .description("List all prompts for a proxy")
    .action(
      actionWithErrorHandler(async (proxyId: string) => {
        const prompts = await gatewayClient.store.listPrompts.query({
          proxyId,
        });

        listPrompts(prompts);
      }),
    );

  command
    .command("add <proxyId>")
    .description("Add a new prompt to a proxy")
    .action(
      actionWithErrorHandler(async (proxyId: string) => {
        const name = await input({
          message: "Enter prompt name:",
          validate: (value) => {
            if (!value.trim()) {
              return "Prompt name is required";
            }
            return true;
          },
        });

        const title = await input({
          message: "Enter prompt title:",
          validate: (value) => {
            if (!value.trim()) {
              return "Prompt title is required";
            }
            return true;
          },
        });

        const description = await input({
          message: "Enter prompt description (optional):",
        });

        const body = await editor({
          message: "Enter prompt body:",
          validate: (value) => {
            if (!value.trim()) {
              return "Prompt body is required";
            }
            return true;
          },
        });

        const prompt = await gatewayClient.store.addPrompt.mutate({
          proxyId,
          prompt: {
            name: name.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            body: body.trim(),
          },
        });

        console.log(`Prompt "${prompt.name}" added successfully.`);
      }),
    );

  command
    .command("edit <proxyId> <promptName>")
    .description("Edit an existing prompt")
    .action(
      actionWithErrorHandler(async (proxyId: string, promptName: string) => {
        // First, get the current prompt to show existing values
        const prompts = await gatewayClient.store.listPrompts.query({
          proxyId,
        });

        const existingPrompt = prompts.find((p) => p.name === promptName);
        if (!existingPrompt) {
          throw new Error(`Prompt "${promptName}" not found`);
        }

        const title = await input({
          message: "Enter prompt title:",
          default: existingPrompt.title,
          validate: (value) => {
            if (!value.trim()) {
              return "Prompt title is required";
            }
            return true;
          },
        });

        const description = await input({
          message: "Enter prompt description (optional):",
          default: existingPrompt.description || "",
        });

        const body = await editor({
          message: "Enter prompt body:",
          default: existingPrompt.body,
          validate: (value) => {
            if (!value.trim()) {
              return "Prompt body is required";
            }
            return true;
          },
        });

        const updatedPrompt = await gatewayClient.store.updatePrompt.mutate({
          proxyId,
          promptName,
          prompt: {
            title: title.trim(),
            description: description.trim() || undefined,
            body: body.trim(),
          },
        });

        console.log(`Prompt "${updatedPrompt.name}" updated successfully.`);
      }),
    );

  command
    .command("remove <proxyId> <promptName>")
    .description("Remove a prompt from a proxy")
    .action(
      actionWithErrorHandler(async (proxyId: string, promptName: string) => {
        // First, verify the prompt exists
        const prompts = await gatewayClient.store.listPrompts.query({
          proxyId,
        });

        const existingPrompt = prompts.find((p) => p.name === promptName);
        if (!existingPrompt) {
          throw new Error(`Prompt "${promptName}" not found`);
        }

        const confirmed = await confirm({
          message: `Are you sure you want to remove prompt "${promptName}"?`,
          default: false,
        });

        if (!confirmed) {
          console.log("Operation cancelled.");
          return;
        }

        await gatewayClient.store.removePrompt.mutate({
          proxyId,
          promptName,
        });

        console.log(`Prompt "${promptName}" removed successfully.`);
      }),
    );

  command
    .command("get <proxyId> <promptName>")
    .description("Show the details of a specific prompt")
    .action(
      actionWithErrorHandler(async (proxyId: string, promptName: string) => {
        const prompts = await gatewayClient.store.listPrompts.query({
          proxyId,
        });

        const prompt = prompts.find((p) => p.name === promptName);
        if (!prompt) {
          throw new Error(`Prompt "${promptName}" not found`);
        }

        console.log(`Name: ${prompt.name}`);
        console.log(`Title: ${prompt.title}`);
        if (prompt.description) {
          console.log(`Description: ${prompt.description}`);
        }
        console.log(`Body:`);
        console.log(prompt.body);
      }),
    );
}
