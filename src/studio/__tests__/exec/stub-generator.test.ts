import { describe, expect, it } from "vitest";
import { generateMemiToolsStub } from "../../exec/stub-generator.js";

describe("exec/stub-generator", () => {
  it("emits an exported async function for each tool", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "MEMI_TOOLS_SOCKET",
      tools: [
        { name: "Read", argsType: "{ path: string }", resultType: "string" },
        { name: "Write", argsType: "{ path: string; content: string }", resultType: "void" },
      ],
    });
    expect(stub).toContain("export async function Read(args: { path: string }): Promise<string>");
    expect(stub).toContain("export async function Write(args: { path: string; content: string }): Promise<void>");
  });

  it("includes the log + exit helpers always", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "MEMI_TOOLS_SOCKET",
      tools: [],
    });
    expect(stub).toContain("export async function log(");
    expect(stub).toContain("export async function exit(");
  });

  it("references the configured env var for the socket path", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "X_CUSTOM_SOCK",
      tools: [],
    });
    expect(stub).toContain('process.env["X_CUSTOM_SOCK"]');
  });

  it("renders tsdoc when description is provided", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "MEMI_TOOLS_SOCKET",
      tools: [
        {
          name: "Bash",
          argsType: "{ command: string }",
          resultType: "{ stdout: string }",
          description: "Run a shell command on the agent host.",
        },
      ],
    });
    expect(stub).toContain("/** Run a shell command on the agent host. */");
  });

  it("rejects invalid TS identifiers", () => {
    expect(() =>
      generateMemiToolsStub({
        socketEnvVar: "MEMI_TOOLS_SOCKET",
        tools: [{ name: "tool with spaces", argsType: "unknown", resultType: "unknown" }],
      }),
    ).toThrow(/not a valid TS identifier/);
  });

  it("escapes */ in description so the comment can't be closed by user input", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "MEMI_TOOLS_SOCKET",
      tools: [
        {
          name: "Tricky",
          argsType: "unknown",
          resultType: "unknown",
          description: "ends with */ then continues",
        },
      ],
    });
    expect(stub).not.toMatch(/\*\/.*then continues/);
    expect(stub).toContain("* /");
  });

  it("uses a custom header when provided", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "MEMI_TOOLS_SOCKET",
      tools: [],
      header: "// my custom header\n",
    });
    expect(stub.startsWith("// my custom header\n")).toBe(true);
  });

  it("emits valid TS that compiles (smoke check on shape)", () => {
    const stub = generateMemiToolsStub({
      socketEnvVar: "MEMI_TOOLS_SOCKET",
      tools: [
        { name: "Read", argsType: "{ path: string }", resultType: "string" },
        { name: "Bash", argsType: "{ command: string }", resultType: "{ stdout: string; stderr: string; code: number }" },
      ],
    });
    // Spot-check structural correctness without running tsc inline:
    expect(stub).toContain("import { connect, type Socket } from \"node:net\"");
    expect(stub).toContain("async function rpc");
    expect(stub).toContain("ensureConnection");
    expect(stub).toContain("pending.set");
    expect(stub.match(/export async function/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
