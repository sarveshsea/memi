/**
 * Mémoire MCP Server — Exposes the design intelligence engine as an
 * MCP server over stdio transport.
 *
 * Any MCP-compatible AI tool (Claude Code, Cursor, Windsurf, etc.)
 * can connect and use Mémoire's tools and resources.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { MemoireEngine } from "../engine/core.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { createLogger } from "../engine/logger.js";
import { getMemoirePackageVersion } from "../utils/package-version.js";

const log = createLogger("mcp-server");

export interface McpServerOptions {
  engine: MemoireEngine;
  connectFigma?: boolean;
}

export function createMemoireMcpServer(engine: MemoireEngine): McpServer {
  const server = new McpServer(
    {
      name: "memoire",
      version: getMemoirePackageVersion(),
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  registerResources(server, engine);
  registerTools(server, engine);

  return server;
}

export async function startStdioMcpServer(engine: MemoireEngine, connectFigma = true): Promise<void> {
  // Initialize the engine (project detection, registry load, notes)
  await engine.init();

  // Attempt Figma connection (non-fatal — tools that need it will error clearly)
  if (connectFigma) {
    try {
      await engine.connectFigma();
      log.info("Figma bridge started");
    } catch {
      log.info("Figma bridge not available — Figma tools will report connection errors");
    }
  }

  const server = createMemoireMcpServer(engine);
  const transport = new StdioServerTransport();

  log.info("Starting MCP server on stdio");
  await server.connect(transport);
}
