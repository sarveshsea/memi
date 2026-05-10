/**
 * executeCode — the top-level entry point that ties protocol + server +
 * stub generator + child-process lifecycle into one call.
 *
 * Flow:
 *   1. Generate the memi_tools stub for the per-call allowlist
 *   2. Write the stub + the user's script to a temp directory
 *   3. Open a fresh Unix-socket-backed ToolsRpcServer
 *   4. Spawn a child Bun (or Node) process with:
 *        MEMI_TOOLS_SOCKET=<path>
 *        cwd=<projectRoot>
 *        scrubbed env (no API keys leaked into the script)
 *   5. Wait for the script to send `exit` or for stdout/stderr to close
 *   6. Tear everything down (kill the child if it's still running, remove
 *      the socket file, remove the temp dir)
 *   7. Return { ok, result, error, logs, durationMs, stdout, stderr }
 *
 * Subprocess runtime is configurable so tests can use Node + a fake
 * script and production can use Bun (faster startup, native TS).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateMemiToolsStub, type StubToolSpec } from "./stub-generator.js";
import { ToolsRpcServer, type ScriptLogEntry, type ToolRunner } from "./tools-rpc-server.js";

export interface ExecuteCodeRequest {
  /** TypeScript source the user (or LLM) wants to execute. */
  readonly script: string;
  /** Tool surface the script may call. */
  readonly tools: ReadonlyArray<StubToolSpec>;
  /** Working directory for the child process. Defaults to process.cwd(). */
  readonly cwd?: string;
  /** Wall-clock cap for the script. Defaults to 60s. */
  readonly timeoutMs?: number;
  /** Memory cap (passed as --max-old-space-size for Node, ignored for Bun). */
  readonly memoryMb?: number;
  /**
   * Subprocess runner. Defaults to "bun" if available, falls back to "node"
   * with --experimental-strip-types (Node 22+). Tests inject a custom value.
   */
  readonly runtime?: "bun" | "node" | { command: string; argsBefore?: readonly string[]; argsAfter?: readonly string[] };
  /** Whitelisted env keys forwarded to the child. Default: only PATH + TZ + LANG. */
  readonly envAllowlist?: readonly string[];
  /** Extra env entries injected before the child starts. */
  readonly envExtra?: Readonly<Record<string, string>>;
}

export interface ExecuteCodeResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly logs: ReadonlyArray<ScriptLogEntry>;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly durationMs: number;
}

const SOCKET_ENV_VAR = "MEMI_TOOLS_SOCKET";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_ENV_ALLOWLIST: readonly string[] = ["PATH", "TZ", "LANG", "LC_ALL", "HOME"];

export async function executeCode(req: ExecuteCodeRequest, runner: ToolRunner): Promise<ExecuteCodeResult> {
  const start = Date.now();
  const dir = await mkdtemp(join(tmpdir(), "memi-execcode-"));
  const stubPath = join(dir, "memi_tools.ts");
  const scriptPath = join(dir, "script.ts");
  const socketPath = join(dir, "tools.sock");

  await writeFile(
    stubPath,
    generateMemiToolsStub({
      socketEnvVar: SOCKET_ENV_VAR,
      tools: req.tools,
    }),
    "utf-8",
  );
  await writeFile(scriptPath, req.script, "utf-8");

  const logs: ScriptLogEntry[] = [];
  let stdout = "";
  let stderr = "";

  const server = new ToolsRpcServer({
    socketPath,
    runner,
    onLog: (entry) => logs.push(entry),
  });
  await server.listen();

  const env = buildChildEnv(req.envAllowlist ?? DEFAULT_ENV_ALLOWLIST, {
    [SOCKET_ENV_VAR]: socketPath,
    ...(req.envExtra ?? {}),
  });

  const { command, args } = resolveCommand(req.runtime ?? "node", scriptPath, req.memoryMb);

  let child: ChildProcess;
  try {
    child = spawn(command, args, {
      cwd: req.cwd ?? process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    await server.close();
    await rm(dir, { recursive: true, force: true });
    return finalize({
      ok: false,
      error: `failed to spawn ${command}: ${error instanceof Error ? error.message : String(error)}`,
      logs,
      stdout,
      stderr,
      exitCode: null,
      signal: null,
      durationMs: Date.now() - start,
    });
  }

  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf-8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf-8");
  });

  // Race: script's exit message vs. process exit vs. timeout.
  const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const timeoutPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve({ code: null, signal: "SIGKILL" });
    }, req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  });

  const scriptResult = await server.waitForExit(req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const exitInfo = await Promise.race([exitPromise, timeoutPromise]);

  await server.close();
  await rm(dir, { recursive: true, force: true });

  return finalize({
    ok: scriptResult.ok,
    result: scriptResult.result,
    error: scriptResult.error ?? (exitInfo.code !== 0 && exitInfo.code !== null ? `script exited with code ${exitInfo.code}` : undefined),
    logs,
    stdout,
    stderr,
    exitCode: exitInfo.code,
    signal: exitInfo.signal,
    durationMs: Date.now() - start,
  });
}

function finalize(result: ExecuteCodeResult): ExecuteCodeResult {
  return result;
}

function buildChildEnv(allowlist: readonly string[], extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowlist) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  for (const [key, value] of Object.entries(extra)) {
    env[key] = value;
  }
  return env;
}

function resolveCommand(
  runtime: NonNullable<ExecuteCodeRequest["runtime"]>,
  scriptPath: string,
  memoryMb?: number,
): { command: string; args: string[] } {
  if (typeof runtime === "object") {
    return {
      command: runtime.command,
      args: [...(runtime.argsBefore ?? []), scriptPath, ...(runtime.argsAfter ?? [])],
    };
  }
  if (runtime === "bun") {
    return { command: "bun", args: ["run", scriptPath] };
  }
  // Node: needs --experimental-strip-types for TS support without a transpile.
  // memoryMb caps V8 heap.
  const args: string[] = ["--experimental-strip-types"];
  if (memoryMb !== undefined) args.push(`--max-old-space-size=${memoryMb}`);
  args.push(scriptPath);
  return { command: "node", args };
}
