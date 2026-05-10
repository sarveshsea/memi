import { describe, expect, it } from "vitest";
import {
  dispatchExecuteCode,
  makeFunctionRunner,
  EXECUTE_CODE_TOOL_NAME,
  type ExecuteCodeBuiltinDeps,
} from "../../exec/builtin-tool.js";

describe("exec/builtin-tool", () => {
  it("EXECUTE_CODE_TOOL_NAME is the canonical 'execute_code' string", () => {
    expect(EXECUTE_CODE_TOOL_NAME).toBe("execute_code");
  });

  it("rejects calls with a missing script", async () => {
    const result = await dispatchExecuteCode(
      { script: "" },
      { buildRunner: () => ({ allowedTools: () => [], run: async () => undefined }) },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/'script'.*required/);
  });

  it("rejects calls with an unknown profile", async () => {
    const result = await dispatchExecuteCode(
      { script: "await import('./memi_tools.ts').then(m => m.exit(true));", profile: "nope" as never },
      { buildRunner: () => ({ allowedTools: () => [], run: async () => undefined }) },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown profile/);
  });

  it("read-only profile auto-builds a runner with Read available", async () => {
    let receivedTools: readonly string[] = [];
    const deps: ExecuteCodeBuiltinDeps = {
      buildRunner: (allowed) => {
        receivedTools = allowed;
        return {
          allowedTools: () => allowed,
          run: async (ctx) => `read:${(ctx.args as { path: string }).path}`,
        };
      },
    };
    const result = await dispatchExecuteCode(
      {
        script: `
          import { Read, exit } from "./memi_tools.mts";
          const r = await Read({ path: "x.ts" });
          await exit(true, { value: r });
        `,
        profile: "read-only",
      },
      deps,
    );
    expect(receivedTools).toContain("Read");
    expect(result.ok).toBe(true);
    expect((result.result as { value: { content: string } }).value).toEqual("read:x.ts");
  });

  it("broad profile blocks when approval callback denies", async () => {
    const deps: ExecuteCodeBuiltinDeps = {
      buildRunner: () => ({ allowedTools: () => [], run: async () => undefined }),
      requestApproval: async () => false,
    };
    const result = await dispatchExecuteCode(
      { script: "await import('./memi_tools.ts').then(m => m.exit(true));", profile: "broad" },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/user denied/);
  });

  it("broad profile proceeds when approval callback approves", async () => {
    let approvalAsked = false;
    const deps: ExecuteCodeBuiltinDeps = {
      buildRunner: () => ({
        allowedTools: () => ["Echo"],
        run: async () => "ok",
      }),
      requestApproval: async () => {
        approvalAsked = true;
        return true;
      },
    };
    const result = await dispatchExecuteCode(
      {
        script: `
          import { exit } from "./memi_tools.mts";
          await exit(true, { ran: true });
        `,
        profile: "broad",
      },
      deps,
    );
    expect(approvalAsked).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("makeFunctionRunner exposes its handlers as the allowlist", async () => {
    const runner = makeFunctionRunner({
      Add: async (args) => {
        const a = args as { x: number; y: number };
        return a.x + a.y;
      },
      Sub: async (args) => {
        const a = args as { x: number; y: number };
        return a.x - a.y;
      },
    });
    expect(runner.allowedTools()).toEqual(["Add", "Sub"]);
    expect(await runner.run({ tool: "Add", args: { x: 3, y: 4 } })).toBe(7);
  });

  it("makeFunctionRunner throws on unhandled tool", async () => {
    const runner = makeFunctionRunner({ Add: () => 1 });
    await expect(runner.run({ tool: "Sub", args: {} })).rejects.toThrow(/no handler/);
  });

  it("integration: dispatchExecuteCode end-to-end with the read-only profile", async () => {
    // Real read-only profile script: read a fake file via the runner.
    let readCount = 0;
    const result = await dispatchExecuteCode(
      {
        script: `
          import { Read, exit } from "./memi_tools.mts";
          const r1 = await Read({ path: "a.ts" });
          const r2 = await Read({ path: "b.ts" });
          await exit(true, { count: 2, contents: [r1, r2] });
        `,
        profile: "read-only",
        overrides: { timeoutMs: 5_000 },
      },
      {
        buildRunner: () =>
          makeFunctionRunner({
            Read: async (args) => {
              readCount += 1;
              const a = args as { path: string };
              return { content: `<file:${a.path}>`, encoding: "utf-8" };
            },
            Grep: () => {
              throw new Error("not used in this test");
            },
            Glob: () => {
              throw new Error("not used in this test");
            },
            WebSearch: () => {
              throw new Error("not used in this test");
            },
          }),
      },
    );
    expect(result.ok).toBe(true);
    expect((result.result as { count: number }).count).toBe(2);
    expect(readCount).toBe(2);
  });
});
