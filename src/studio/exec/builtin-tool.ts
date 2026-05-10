/**
 * Builtin "execute_code" tool — registers as a tool the agent can call,
 * dispatches the script through executeCode(), returns the script's
 * result back to the agent loop.
 *
 * The tool's args:
 *   { script: string, profile?: "tight"|"read-only"|"standard"|"broad" }
 *
 * The tool's result:
 *   { ok: boolean, result?: unknown, error?: string, durationMs: number,
 *     logs: ScriptLogEntry[], stdout?: string, stderr?: string }
 *
 * The tool runner is constructed per-call so it has access to the live
 * driver registry. Subagent tool calls (from inside the script) get
 * dispatched through the driver's tool broker via a thin adapter.
 *
 * This module does NOT auto-register on import — the caller chooses
 * when (and which subset of profiles) to expose. Registration goes
 * through the driver's allowedTools list so the model can only invoke
 * execute_code when the harness explicitly enables it.
 */

import { executeCode, type ExecuteCodeRequest, type ExecuteCodeResult } from "./execute-code.js";
import {
  customPolicy,
  getSecurityPolicy,
  listProfiles,
  type SecurityPolicy,
  type SecurityProfileName,
} from "./security-policy.js";
import type { ToolRunner } from "./tools-rpc-server.js";

export interface ExecuteCodeBuiltinArgs {
  script: string;
  profile?: SecurityProfileName;
  /** Optional per-call overrides to the chosen profile. */
  overrides?: {
    timeoutMs?: number;
    memoryMb?: number;
  };
}

export interface ExecuteCodeBuiltinDeps {
  /**
   * Returns a ToolRunner for the resolved tool surface. The runner's
   * .run(ctx) translates a script-side tool call into whatever the
   * host wants (typically: dispatch through the driver's broker).
   */
  buildRunner(allowedToolNames: readonly string[]): ToolRunner;
  /** Optional default profile when the caller doesn't pass one. */
  defaultProfile?: SecurityProfileName;
  /** Optional callback when the script wants approval (broad profile). */
  requestApproval?: (preview: { script: string; profile: SecurityProfileName }) => Promise<boolean>;
}

export const EXECUTE_CODE_TOOL_NAME = "execute_code";

export async function dispatchExecuteCode(
  args: ExecuteCodeBuiltinArgs,
  deps: ExecuteCodeBuiltinDeps,
): Promise<ExecuteCodeResult> {
  if (!args.script || typeof args.script !== "string") {
    return failResult("execute_code: 'script' (string) is required");
  }

  const profile = args.profile ?? deps.defaultProfile ?? "read-only";
  if (!listProfiles().includes(profile)) {
    return failResult(`execute_code: unknown profile "${profile}". Choose one of: ${listProfiles().join(", ")}`);
  }

  let policy: SecurityPolicy = getSecurityPolicy(profile);
  if (args.overrides) {
    policy = customPolicy(profile, args.overrides);
  }

  if (policy.requiresApproval && deps.requestApproval) {
    const approved = await deps.requestApproval({ script: args.script, profile: policy.profile });
    if (!approved) {
      return failResult(`execute_code: ${policy.profile} profile requires approval; user denied`);
    }
  }

  const runner = deps.buildRunner(policy.allowedTools.map((t) => t.name));

  const req: ExecuteCodeRequest = {
    script: args.script,
    tools: policy.allowedTools,
    timeoutMs: policy.timeoutMs,
    memoryMb: policy.memoryMb,
    envAllowlist: policy.envAllowlist,
  };
  return executeCode(req, runner);
}

function failResult(error: string): ExecuteCodeResult {
  return {
    ok: false,
    error,
    logs: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    signal: null,
    durationMs: 0,
  };
}

/**
 * Convenience: a ToolRunner factory that simply maps tool name to a
 * caller-supplied async function. Useful for tests and for very
 * targeted hosts that don't want to plug in the full broker.
 */
export function makeFunctionRunner(
  handlers: Record<string, (args: unknown) => unknown | Promise<unknown>>,
): ToolRunner {
  const allowed = Object.keys(handlers);
  return {
    allowedTools: () => allowed,
    run: async (ctx) => {
      const handler = handlers[ctx.tool];
      if (!handler) throw new Error(`no handler registered for tool "${ctx.tool}"`);
      return handler(ctx.args);
    },
  };
}
