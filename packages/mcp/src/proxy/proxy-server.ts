import {
  AppError,
  ErrorCode,
  isAppErrorWithCode,
} from "@director.run/utilities/error";
import { getLogger } from "@director.run/utilities/logger";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as eventsource from "eventsource";
import _ from "lodash";
import packageJson from "../../package.json";
import type { AbstractClientParams } from "../client/abstract-client";
import type { HTTPClient } from "../client/http-client";
import type { InMemoryClient } from "../client/in-memory-client";
import type { StdioClient } from "../client/stdio-client";
import { setupPromptHandlers } from "./handlers/prompts-handler";
import { setupResourceTemplateHandlers } from "./handlers/resource-templates-handler";
import { setupResourceHandlers } from "./handlers/resources-handler";
import { setupToolHandlers } from "./handlers/tools-handler";

global.EventSource = eventsource.EventSource;

const logger = getLogger(`ProxyServer`);

export type ProxyTarget = InMemoryClient | StdioClient | HTTPClient;

export type ProxyServerAttributes = {
  id: string;
  servers: ProxyTarget[];
};

export class ProxyServer extends Server {
  private _targets: ProxyTarget[];
  protected _id: string;

  constructor(attributes: ProxyServerAttributes) {
    super(
      {
        name: attributes.id, // MCP server name is now a logical name, so we use the id
        version: packageJson.version,
      },
      {
        capabilities: {
          prompts: {},
          resources: { subscribe: true },
          tools: { listChanged: true },
        },
      },
    );
    this._targets = [];
    this._id = attributes.id;

    for (const server of attributes.servers) {
      this._targets.push(server);
    }

    setupToolHandlers(this);
    setupPromptHandlers(this, this._targets);
    setupResourceHandlers(this, this._targets);
    setupResourceTemplateHandlers(this, this._targets);
  }

  public async connectTargets(
    { throwOnError } = { throwOnError: false },
  ): Promise<void> {
    for (const target of this.targets) {
      await target.connectToTarget({ throwOnError });
    }
  }

  public async getTarget(targetName: string): Promise<ProxyTarget> {
    const target = this.targets.find(
      (t) => t.name.toLocaleLowerCase() === targetName.toLocaleLowerCase(),
    );
    if (!target) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `Target ${targetName} does not exists`,
      );
    }
    return target;
  }

  public get targets(): ProxyTarget[] {
    return this._targets;
  }

  public get name() {
    return this._id;
  }

  public async addTarget(
    target: ProxyTarget,
    attribs: { throwOnError: boolean } = { throwOnError: false },
  ): Promise<ProxyTarget> {
    const existingTarget = this.targets.find(
      (t) => t.name.toLocaleLowerCase() === target.name.toLocaleLowerCase(),
    );

    if (existingTarget) {
      throw new AppError(
        ErrorCode.DUPLICATE,
        `Target ${target.name} already exists`,
      );
    }

    try {
      await target.connectToTarget({ throwOnError: attribs.throwOnError });
    } catch (error) {
      if (isAppErrorWithCode(error, ErrorCode.UNAUTHORIZED)) {
        // Oauth error, so we supress the exception
      } else {
        throw error;
      }
    }

    this.targets.push(target);

    return target;
    // TODO: send list changed events. need client to support this first
    // this.sendToolListChanged();
    // this.sendPromptListChanged();
    // this.sendResourceListChanged();
  }

  public async updateTarget(
    targetName: string,

    attributes: Partial<
      Pick<AbstractClientParams, "toolPrefix" | "disabledTools" | "disabled">
    >,
  ) {
    const target = await this.getTarget(targetName);

    if (attributes.toolPrefix !== undefined) {
      target.toolPrefix = attributes.toolPrefix;
    }
    if (attributes.disabledTools !== undefined) {
      target.disabledTools = attributes.disabledTools;
    }
    if (attributes.disabled !== undefined) {
      await target.setDisabled(attributes.disabled);
    }

    return target;
  }

  public get id() {
    return this._id;
  }

  public async removeTarget(targetName: string) {
    const existingTarget = this.targets.find(
      (t) => t.name.toLocaleLowerCase() === targetName.toLocaleLowerCase(),
    );
    if (!existingTarget) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        `Target ${targetName} does not exists`,
      );
    }
    await existingTarget.close();

    _.remove(
      this.targets,
      (t) => t.name.toLocaleLowerCase() === targetName.toLocaleLowerCase(),
    );

    return existingTarget;
    // TODO: send list changed events. need client to support this first
    // this.sendToolListChanged();
    // this.sendPromptListChanged();
    // this.sendResourceListChanged();
  }

  async close(): Promise<void> {
    logger.info({ message: `shutting down`, proxyId: this._id });
    await Promise.all(this.targets.map((target) => target.close()));
    await super.close();
  }
}
