# Studio `execute_code` — programmatic tool calling

## Why this exists

The agent's most common pattern today is **call tool → wait for response → reason → call next tool → wait → repeat**. Every tool call costs one model turn. A pipeline like "find every `*.ts` file, read each, look for an obsolete API, replace it" is N model turns where N is the file count, even though the *logic* is a 4-line for-loop.

`execute_code` collapses this. The agent emits one tool call (`execute_code`) with a TypeScript script. The script runs in a child process, calls tools through a typed local API, and returns the final result. **N tool round-trips become 1 model turn.**

This is the single biggest token-economy and latency lever available to a coding agent. Pattern adapted from [NousResearch's hermes-agent](https://github.com/NousResearch/hermes-agent) — their flagship `execute_code` feature.

## How it works

```
Agent emits one tool call: execute_code({ script: "...", profile: "read-only" })
                              │
                              ▼
                  ┌──────────────────────────┐
                  │  parent (engine sidecar)  │
                  │  - generate memi_tools.ts │
                  │  - open Unix socket       │
                  │  - spawn Bun/Node child   │
                  └──────────────────────────┘
                              │
                              ▼ (child process)
                  ┌──────────────────────────┐
                  │  user script runs:        │
                  │    import { Read, Bash }  │
                  │      from "./memi_tools"  │
                  │    for (file of files) {  │
                  │      await Read({...})    │
                  │    }                      │
                  │    await exit(true, ...)  │
                  └──────────────────────────┘
                              │
                              │ each tool call → JSON over Unix socket
                              ▼
                  ┌──────────────────────────┐
                  │  parent dispatches each   │
                  │  call to the broker,      │
                  │  responds with result     │
                  └──────────────────────────┘
                              │
                              ▼
                Agent receives one ExecuteCodeResult.
```

The socket file lives in a per-call temp dir (`/tmp/memi-execcode-XXX/tools.sock`); the temp dir is cleaned up on every exit path including timeout.

## Quick start

From the host side:

```ts
import { dispatchExecuteCode, makeFunctionRunner } from "@sarveshsea/memoire/studio/exec/builtin-tool.js";

const result = await dispatchExecuteCode(
  {
    script: `
      import { Read, exit } from "./memi_tools.ts";
      const r = await Read({ path: "package.json" });
      const pkg = JSON.parse(r.content);
      await exit(true, { name: pkg.name, version: pkg.version });
    `,
    profile: "read-only",
  },
  {
    buildRunner: () => makeFunctionRunner({
      Read: async ({ path }) => ({ content: fs.readFileSync(path, "utf-8"), encoding: "utf-8" }),
      // ... handlers for the rest of the read-only surface
    }),
  },
);

console.log(result);
// { ok: true, result: { name: "memoire", version: "0.17.0" }, ... }
```

From inside a script (the `memi_tools` module is generated for you per-call):

```ts
import { Read, Edit, Bash, log, exit } from "./memi_tools.ts";

await log("info", "starting refactor sweep");

const files = await Bash({ command: "git ls-files '*.ts'" });
let touched = 0;

for (const path of files.stdout.split("\n").filter(Boolean)) {
  const f = await Read({ path });
  if (!f.content.includes("oldApiName")) continue;
  await Edit({ path, oldString: "oldApiName", newString: "newApiName" });
  touched += 1;
  await log("info", `updated ${path}`);
}

await exit(true, { touched });
```

Above is **one** agent turn. The script runs hundreds of tool calls without ever returning to the model.

## Security profiles

The script runs in a sandboxed child:
- Empty env by default — only `PATH/TZ/LANG/LC_ALL/HOME` forward
- API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `FIGMA_TOKEN`, etc.) **never** reach the child
- Per-call wall-clock cap; SIGKILL on overrun
- Memory cap (Node `--max-old-space-size`)
- Tool allowlist enforced at the RPC server — a script that tries to RPC a disallowed tool gets `ok: false, error: "tool 'X' not in allowlist"` back

| Profile | Tools | Timeout | Memory | Approval |
|---|---|---|---|---|
| `tight` | none | 5s | 128 MB | no |
| `read-only` (default) | Read, Grep, Glob, WebSearch | 5s | 256 MB | no |
| `standard` | + Edit, Write, Bash | 30s | 512 MB | no |
| `broad` | + Browser, Computer | 60s | 1024 MB | **yes** |

Pick a profile or build a custom one with `customPolicy("standard", { timeoutMs: 60_000 })`.

## Cookbook

### Refactor across many files in one turn

See the Quick Start example above. Replaces N model turns (one per file) with 1.

### Filter + paginate API responses without context bloat

```ts
import { WebSearch, exit } from "./memi_tools.ts";

const all: Array<{ title: string; url: string }> = [];
for (const query of ["claude code", "claude api", "anthropic sdk"]) {
  const { results } = await WebSearch({ query, maxResults: 20 });
  for (const r of results) {
    if (!r.url.includes("anthropic")) continue;
    all.push({ title: r.title, url: r.url });
  }
}

await exit(true, { matches: all.slice(0, 10) });
```

The agent gets back 10 deduplicated results instead of 60 raw ones. Saves tokens on the next turn.

### Run a small data analysis without sending raw rows to the model

```ts
import { Read, exit } from "./memi_tools.ts";

const csv = (await Read({ path: "metrics.csv" })).content;
const rows = csv.split("\n").slice(1).map((r) => r.split(","));
const total = rows.reduce((acc, r) => acc + Number(r[2] ?? 0), 0);
const max = Math.max(...rows.map((r) => Number(r[2] ?? 0)));

await exit(true, { rowCount: rows.length, total, max });
```

The model sees `{ rowCount: 12_034, total: 458_213, max: 99 }` instead of 12k rows.

## Limitations

- **No interactive stdin** — scripts can't prompt the user. Use the parent's approval flow via `requestApproval`.
- **No persistent state between calls** — each `execute_code` is a fresh process. Persist via tool calls (Write to disk, push to a journal).
- **Broad profile is approval-gated** — caller must wire `requestApproval` into the agent's permission UI.
- **Network access from the script** is allowed today (Node/Bun isn't sandboxed at the syscall level). Future commit: launch with a network-namespace mark on Linux + macOS Network Extension filter.

## See also

- [pingdotgg/t3code](https://github.com/pingdotgg/t3code) — the architectural inspiration for the typed RPC envelope
- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — the original `execute_code` pattern this implementation adapts
- `src/studio/exec/` — the implementation
- `src/studio/__tests__/exec/` — 51 tests covering protocol, server, stub generator, spawn lifecycle, security, and the builtin dispatcher
