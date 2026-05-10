/**
 * SecurityPolicy — declarative per-call gate for executeCode.
 *
 * Today executeCode accepts allowlist + timeout + memory + env directly
 * as fields on the request. That's fine for a single caller but as soon
 * as multiple callers exist (broker, RPC, CLI, hooks) it becomes
 * tempting to forget one knob and ship a permissive default.
 *
 * SecurityPolicy is the named bundle: pick a profile by name (tight,
 * standard, broad), or build one from the policy primitives. The
 * broker integration (commit 4 follow-up) maps each agent's permission
 * mode to a profile; the user can override with explicit overrides.
 *
 * Profiles in increasing capability:
 *
 *   tight     — no tool calls; only log + exit. Useful for "let the
 *               model write a calculation that runs locally and reports
 *               back" — pure compute, no side effects.
 *   read-only — Read, Grep, Glob, Web search. No file writes, no Bash.
 *               5s timeout, 256MB mem, no network env.
 *   standard  — read-only + Edit + Write + Bash (allowlisted commands).
 *               30s timeout, 512MB mem, scrubbed env.
 *   broad     — standard + arbitrary Bash + browser + computer-use.
 *               60s timeout, 1024MB mem. Should require explicit user
 *               approval before each invocation.
 */

import type { StubToolSpec } from "./stub-generator.js";

export type SecurityProfileName = "tight" | "read-only" | "standard" | "broad";

export interface SecurityPolicy {
  readonly profile: SecurityProfileName;
  readonly allowedTools: ReadonlyArray<StubToolSpec>;
  readonly timeoutMs: number;
  readonly memoryMb: number;
  readonly envAllowlist: ReadonlyArray<string>;
  readonly requiresApproval: boolean;
}

const READ_TOOLS: StubToolSpec[] = [
  {
    name: "Read",
    argsType: "{ path: string }",
    resultType: "{ content: string; encoding: string }",
    description: "Read a file from the project root.",
  },
  {
    name: "Grep",
    argsType: "{ pattern: string; path?: string; recursive?: boolean }",
    resultType: "{ matches: Array<{ path: string; line: number; text: string }> }",
    description: "Regex search across files.",
  },
  {
    name: "Glob",
    argsType: "{ pattern: string }",
    resultType: "{ paths: string[] }",
    description: "List files matching a glob.",
  },
  {
    name: "WebSearch",
    argsType: "{ query: string; maxResults?: number }",
    resultType: "{ results: Array<{ title: string; url: string; snippet: string }> }",
    description: "Search the web for a query.",
  },
];

const WRITE_TOOLS: StubToolSpec[] = [
  {
    name: "Edit",
    argsType: "{ path: string; oldString: string; newString: string }",
    resultType: "{ replacedCount: number }",
    description: "Replace text in a file.",
  },
  {
    name: "Write",
    argsType: "{ path: string; content: string }",
    resultType: "{ bytesWritten: number }",
    description: "Write a file (creates if missing, overwrites if exists).",
  },
];

const BASH_TOOL: StubToolSpec = {
  name: "Bash",
  argsType: "{ command: string; cwd?: string; timeoutMs?: number }",
  resultType: "{ stdout: string; stderr: string; code: number }",
  description: "Run a shell command on the agent host.",
};

const BROWSER_TOOL: StubToolSpec = {
  name: "Browser",
  argsType: "{ action: 'navigate' | 'click' | 'screenshot' | 'evaluate'; payload: unknown }",
  resultType: "unknown",
  description: "Drive a Playwright browser session.",
};

const COMPUTER_TOOL: StubToolSpec = {
  name: "Computer",
  argsType: "{ action: 'openUrl' | 'captureScreen' | 'type' | 'click'; payload: unknown }",
  resultType: "{ status: 'completed' | 'unavailable'; result?: unknown }",
  description: "Drive macOS computer-use APIs (Accessibility, Screen Recording).",
};

const SAFE_ENV_ALLOWLIST = ["PATH", "TZ", "LANG", "LC_ALL", "HOME"] as const;

const PROFILES: Readonly<Record<SecurityProfileName, SecurityPolicy>> = {
  tight: {
    profile: "tight",
    allowedTools: [],
    timeoutMs: 5_000,
    memoryMb: 128,
    envAllowlist: SAFE_ENV_ALLOWLIST,
    requiresApproval: false,
  },
  "read-only": {
    profile: "read-only",
    allowedTools: READ_TOOLS,
    timeoutMs: 5_000,
    memoryMb: 256,
    envAllowlist: SAFE_ENV_ALLOWLIST,
    requiresApproval: false,
  },
  standard: {
    profile: "standard",
    allowedTools: [...READ_TOOLS, ...WRITE_TOOLS, BASH_TOOL],
    timeoutMs: 30_000,
    memoryMb: 512,
    envAllowlist: SAFE_ENV_ALLOWLIST,
    requiresApproval: false,
  },
  broad: {
    profile: "broad",
    allowedTools: [...READ_TOOLS, ...WRITE_TOOLS, BASH_TOOL, BROWSER_TOOL, COMPUTER_TOOL],
    timeoutMs: 60_000,
    memoryMb: 1_024,
    envAllowlist: SAFE_ENV_ALLOWLIST,
    requiresApproval: true,
  },
};

export function getSecurityPolicy(profile: SecurityProfileName): SecurityPolicy {
  return PROFILES[profile];
}

export function listProfiles(): readonly SecurityProfileName[] {
  return ["tight", "read-only", "standard", "broad"];
}

/** Build a custom policy. The base profile sets defaults; overrides win. */
export function customPolicy(
  base: SecurityProfileName,
  overrides: Partial<Omit<SecurityPolicy, "profile">>,
): SecurityPolicy {
  return {
    ...PROFILES[base],
    ...overrides,
    profile: base,
  };
}
