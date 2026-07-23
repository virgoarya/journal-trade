import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn } from "node:child_process";
import { silentLogger } from "../utils/silent-logger";

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: any;
}

class MCPService {
  private clients: Map<string, Client> = new Map();
  private processes: Map<string, any> = new Map();
  private isConnected = false;
  private toolsCache: Map<string, { tool: MCPToolInfo; serverName: string }> = new Map();

  constructor() {}

  async registerServer(
    serverName: string,
    command: string,
    args: string[],
    env?: Record<string, string>,
    retries = 2,
  ) {
    if (this.clients.has(serverName)) {
      silentLogger.info(`[MCP] Server ${serverName} already registered.`);
      return;
    }

    for (let attempt = 1; attempt <= 1 + retries; attempt++) {
      try {
        const client = new Client(
          {
            name: "HunterTradesTerminal",
            version: "1.0.0",
          },
          {
            capabilities: {},
          }
        );

        const transport = new StdioClientTransport({
          command,
          args,
          env: {
            ...process.env,
            ...(env || {}),
          } as Record<string, string>,
        });

        await client.connect(transport, { timeout: 300000 });
        this.clients.set(serverName, client);
        this.isConnected = true;
        silentLogger.info(
          `[MCP] Connected to MCP Server '${serverName}' via stdio: ${command} ${args.join(
            " "
          )}`
        );

        // Refresh tools
        await this.refreshTools();
        return;
      } catch (error: any) {
        if (attempt <= retries) {
          const delay = 5000 * Math.pow(2, attempt - 1);
          silentLogger.warn(
            `[MCP] Connection to '${serverName}' attempt ${attempt}/${1 + retries} failed: ${error.message}. Retrying in ${delay}ms...`
          );
          await new Promise(r => setTimeout(r, delay));
        } else {
          silentLogger.error(`[MCP] Failed to connect to '${serverName}': ${error.message}`);
        }
      }
    }
  }

  async registerAitrados(
    port: number = 11999,
    host: string = "127.0.0.1",
    retries = 2,
  ) {
    const serverName = "Aitrados";
    if (this.clients.has(serverName)) {
      silentLogger.info(`[MCP] Server ${serverName} already registered.`);
      return;
    }

    for (let attempt = 1; attempt <= 1 + retries; attempt++) {
      let child: any = null;
      try {
        child = spawn(
          "/usr/local/bin/finance-trading-ai-agents-mcp",
          ["serve", "--port", String(port), "--host", host],
          {
            env: {
              ...process.env,
              AITRADOS_SECRET_KEY: process.env.AITRADOS_SECRET_KEY || "",
              PYTHONIOENCODING: "utf-8",
              PYTHONUNBUFFERED: "1",
            } as Record<string, string>,
            stdio: ["pipe", "inherit", "inherit"],
          },
        );
        child.on("error", (e: Error) => { throw e; });
        this.processes.set(serverName, child);

        await new Promise(r => setTimeout(r, 3000));

        // Known Aitrados MCP sub-app paths (not all discovered depts have mounted apps)
        const knownPaths = [
          "economic_calendar",
          "traditional_indicator",
          "price_action",
          "news",
        ];
        const baseUrl = `http://${host}:${port}`;
        let connectedCount = 0;

        for (const dept of knownPaths) {
          try {
            const client = new Client(
              { name: "HunterTradesTerminal", version: "1.0.0" },
              { capabilities: {} },
            );
            const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/${dept}/`));
            await client.connect(transport, { timeout: 10000 });
            this.clients.set(`${serverName}/${dept}`, client);
            silentLogger.info(`[MCP] Connected to Aitrados/${dept}`);
            connectedCount++;
          } catch (e: any) {
            silentLogger.warn(`[MCP] Aitrados/${dept} skipped: ${e.message}`);
          }
        }

        if (connectedCount === 0) throw new Error("No Aitrados sub-servers connected");

        this.isConnected = true;
        await this.refreshTools();
        return;
      } catch (error: any) {
        if (child) {
          try { child.kill(); } catch {}
          this.processes.delete(serverName);
        }
        if (attempt <= retries) {
          const delay = 5000 * Math.pow(2, attempt - 1);
          silentLogger.warn(`[MCP] Aitrados connection attempt ${attempt}/${1 + retries} failed: ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          silentLogger.error(`[MCP] Failed to connect to Aitrados: ${error.message}`);
        }
      }
    }
  }

  async refreshTools() {
    this.toolsCache.clear();
    
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const response = await client.listTools();
        for (const t of response.tools) {
          // Avoid name collisions by prefixing or just trusting names are unique
          this.toolsCache.set(t.name, {
            serverName,
            tool: {
              name: t.name,
              description: t.description || "",
              inputSchema: t.inputSchema || { type: "object", properties: {} },
            },
          });
        }
        silentLogger.info(`[MCP] Refreshed tools for '${serverName}', found ${response.tools.length} tools`);
      } catch (error: any) {
        silentLogger.error(`[MCP] Failed to fetch tools from '${serverName}': ${error.message}`);
      }
    }
  }

  getTools(): MCPToolInfo[] {
    return Array.from(this.toolsCache.values()).map((entry) => entry.tool);
  }

  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const entry = this.toolsCache.get(name);
    if (!entry) {
      throw new Error(`MCP Tool '${name}' not found in any registered server.`);
    }

    const client = this.clients.get(entry.serverName);
    if (!client) {
      throw new Error(`MCP Server '${entry.serverName}' is not connected.`);
    }

    try {
      const result = await client.callTool({
        name,
        arguments: args,
      });
      return result;
    } catch (error: any) {
      silentLogger.error(`[MCP] Tool execution error for ${name} on server ${entry.serverName}: ${error.message}`);
      throw error;
    }
  }
}

export const mcpService = new MCPService();
