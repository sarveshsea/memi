import { describe, expect, it } from "vitest";
import {
  createDecoderState,
  decodeChunk,
  encodeMessage,
  parseRequest,
  safeParseRequest,
} from "../../exec/tools-rpc-protocol.js";

describe("exec/tools-rpc-protocol", () => {
  it("parseRequest accepts a tool request", () => {
    const req = parseRequest({ id: 1, op: "tool", tool: "Read", args: { path: "x" } });
    expect(req.op).toBe("tool");
  });

  it("parseRequest accepts a log request", () => {
    const req = parseRequest({ id: 2, op: "log", level: "info", message: "hi" });
    expect(req.op).toBe("log");
  });

  it("parseRequest accepts an exit request", () => {
    const req = parseRequest({ id: 3, op: "exit", ok: true, result: { foo: 1 } });
    expect(req.op).toBe("exit");
  });

  it("safeParseRequest rejects unknown ops", () => {
    const result = safeParseRequest({ id: 1, op: "bogus" });
    expect(result.ok).toBe(false);
  });

  it("safeParseRequest rejects missing id", () => {
    const result = safeParseRequest({ op: "log", level: "info", message: "x" });
    expect(result.ok).toBe(false);
  });

  it("encodeMessage round-trips through decodeChunk", () => {
    const state = createDecoderState();
    const wire = encodeMessage({ id: 1, op: "tool", tool: "Read", args: {} });
    const out = decodeChunk(state, wire);
    expect(out).toHaveLength(1);
    expect((out[0] as { op: string }).op).toBe("tool");
  });

  it("decodeChunk handles partial lines across chunks", () => {
    const state = createDecoderState();
    const wire = encodeMessage({ id: 1, op: "tool", tool: "Read", args: {} });
    const half = wire.slice(0, 10);
    const rest = wire.slice(10);
    expect(decodeChunk(state, half)).toEqual([]);
    const out = decodeChunk(state, rest);
    expect(out).toHaveLength(1);
  });

  it("decodeChunk yields multiple messages from a single chunk", () => {
    const state = createDecoderState();
    const a = encodeMessage({ id: 1, op: "tool", tool: "Read", args: {} });
    const b = encodeMessage({ id: 2, op: "log", level: "info", message: "hi" });
    const out = decodeChunk(state, a + b);
    expect(out).toHaveLength(2);
  });

  it("decodeChunk silently skips malformed lines", () => {
    const state = createDecoderState();
    const out = decodeChunk(state, "garbage\n{\"id\":1,\"op\":\"log\",\"level\":\"info\",\"message\":\"x\"}\n");
    expect(out).toHaveLength(1);
    expect((out[0] as { op: string }).op).toBe("log");
  });
});
