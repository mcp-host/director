import { getLogger } from "@director.run/utilities/logger";
import type {
  ProxyTargetAttributes,
  ProxyTransport,
} from "@director.run/utilities/schema";
import { SimpleClient } from "./simple-client";

export type ProxyTargetStatus = "connected" | "disconnected" | "error";

const logger = getLogger(`mcp/proxy-target`);

export type ProxyTargetTransport = ProxyTransport;

export class ProxyTarget extends SimpleClient {
  public readonly attributes: ProxyTargetAttributes;
  // TODO: this should be a computed property
  public readonly status: ProxyTargetStatus = "disconnected";

  constructor(attributes: ProxyTargetAttributes) {
    super(attributes.name.toLocaleLowerCase());
    this.attributes = attributes;
  }

  public async smartConnect({ throwOnError } = { throwOnError: false }) {
    const { name, transport } = this.attributes;

    try {
      logger.info({
        message: `connecting to target ${name}`,
        transport,
      });

      if (transport.type === "http") {
        await this.connectToHTTP(transport.url, transport.headers);
      } else {
        await this.connectToStdio(transport.command, transport.args ?? [], {
          ...(process.env as Record<string, string>),
          ...(transport?.env || {}),
        });
      }
    } catch (error) {
      logger.error({
        message: `failed to connect to target ${name}`,
        error,
      });
      if (throwOnError) {
        throw error;
      }
    }
  }
}
