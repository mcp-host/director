import { ProxyServer } from "@director.run/mcp/proxy-server";
import { AppError, ErrorCode } from "@director.run/utilities/error";
import { getLogger } from "@director.run/utilities/logger";
import type { ProxyTargetAttributes } from "@director.run/utilities/schema";
import { Telemetry } from "@director.run/utilities/telemetry";
import type { Database } from "./db";

const logger = getLogger("ProxyServerStore");

export class ProxyServerStore {
  private proxyServers: Map<string, ProxyServer> = new Map();
  private db: Database;
  private telemetry: Telemetry;

  private constructor(params: { db: Database; telemetry: Telemetry }) {
    this.db = params.db;
    this.telemetry = params.telemetry;
  }

  public static async create(
    db: Database,
    telemetry?: Telemetry,
  ): Promise<ProxyServerStore> {
    logger.debug("initializing ProxyServerStore");
    const store = new ProxyServerStore({
      db,
      telemetry: telemetry || Telemetry.noTelemetry(),
    });
    await store.initialize();
    logger.debug("initialization complete");
    return store;
  }

  private async initialize(): Promise<void> {
    let proxies = await this.db.getAll();

    for (const proxyConfig of proxies) {
      const proxyId = proxyConfig.id;
      logger.debug({ message: `initializing ${proxyId}`, proxyId });

      const proxyServer = new ProxyServer({
        id: proxyId,
        name: proxyConfig.name,
        description: proxyConfig.description ?? undefined,
        servers: proxyConfig.servers,
      });
      await proxyServer.connectTargets();
      this.proxyServers.set(proxyId, proxyServer);
    }
  }

  public get(proxyId: string) {
    const server = this.proxyServers.get(proxyId);
    if (!server) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `proxy server '${proxyId}' not found or failed to initialize.`,
      );
    }
    return server;
  }

  async delete(proxyId: string) {
    const proxy = this.get(proxyId);
    await proxy.close();
    await this.db.deleteProxy(proxyId);
    this.proxyServers.delete(proxyId);
    logger.info(`successfully deleted proxy server configuration: ${proxyId}`);
  }

  async purge() {
    await this.closeAll();
    await this.db.purge();
    this.proxyServers.clear();
  }

  async closeAll() {
    logger.info("cleaning up all proxy servers...");
    await Promise.all(
      Array.from(this.proxyServers.values()).map((proxy) => proxy.close()),
    );
    logger.info("finished cleaning up all proxy servers.");
  }

  public getAll(): ProxyServer[] {
    return Array.from(this.proxyServers.values());
  }

  public async create({
    name,
    description,
    servers,
    source,
  }: {
    name: string;
    description?: string;
    servers?: ProxyTargetAttributes[];
    source?: {
      type: "registry";
      entry: {
        id: string;
        name: string;
        title: string;
      };
    };
  }): Promise<ProxyServer> {
    const newProxy = await this.db.addProxy({
      name,
      description,
      servers: servers ?? [],
    });
    const proxyServer = new ProxyServer({
      name: name,
      id: newProxy.id,
      servers: newProxy.servers,
      description: newProxy.description ?? undefined,
    });
    await proxyServer.connectTargets();
    this.proxyServers.set(newProxy.id, proxyServer);
    logger.info({ message: `Created new proxy`, proxyId: newProxy.id });
    return proxyServer;
  }

  public async addServer(
    proxyId: string,
    server: ProxyTargetAttributes,
  ): Promise<ProxyServer> {
    const proxy = this.get(proxyId);

    await proxy.addTarget(server, { throwOnError: true });
    await this.db.updateProxy(proxyId, { servers: proxy.attributes.servers });

    return proxy;
  }

  public async removeServer(
    proxyId: string,
    serverName: string,
  ): Promise<ProxyServer> {
    const proxy = this.get(proxyId);

    await proxy.removeTarget(serverName);
    await this.db.updateProxy(proxyId, { servers: proxy.attributes.servers });

    return proxy;
  }

  public async update(
    proxyId: string,
    attributes: Partial<{
      name: string;
      description: string;
    }>,
  ) {
    const proxy = this.get(proxyId);

    await proxy.update(attributes);
    await this.db.updateProxy(proxyId, attributes);

    return proxy;
  }
}
