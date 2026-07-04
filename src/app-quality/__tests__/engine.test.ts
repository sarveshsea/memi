import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnoseAppQuality } from "../engine.js";

describe("diagnoseAppQuality", () => {
  it("detects code-native design debt and writes reports", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-app-quality-"));
    try {
      await mkdir(join(root, "src", "components", "ui"), { recursive: true });
      await mkdir(join(root, "src", "app", "dashboard"), { recursive: true });
      await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0", tailwindcss: "4.0.0" } }), "utf-8");
      await writeFile(join(root, "src", "components", "ui", "button.tsx"), "export function Button(){ return null }\n", "utf-8");
      await writeFile(join(root, "src", "app", "dashboard", "page.tsx"), `
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <main className="p-1 p-2 p-3 p-4 p-5 p-6 p-7 p-8 p-9 text-xs text-sm text-base text-lg text-xl text-2xl text-[19px] bg-[#111111] text-[#fafafa] rounded-sm rounded-md rounded-lg rounded-xl rounded-[18px] shadow-sm shadow-md shadow-lg">
      <img src="/hero.png" />
      <Button className="bg-blue-500 hover:bg-blue-600">Ship</Button>
      <button onClick={() => null} className="px-[13px] py-[7px] bg-[#0055ff]">Raw</button>
    </main>
  );
}
`, "utf-8");

      const diagnosis = await diagnoseAppQuality({ projectRoot: root, write: true });

      expect(diagnosis.summary.scannedFiles).toBeGreaterThan(0);
      expect(diagnosis.summary.scannedBytes).toBeGreaterThan(0);
      expect(diagnosis.summary.scanMs).toBeGreaterThanOrEqual(0);
      expect(diagnosis.summary.analysisMs).toBeGreaterThanOrEqual(diagnosis.summary.scanMs ?? 0);
      expect(diagnosis.summary.score).toBeLessThan(100);
      expect(diagnosis.issues.map((issue) => issue.id)).toContain("color.raw-hex");
      expect(diagnosis.issues.map((issue) => issue.id)).toContain("a11y.image-alt");
      expect(diagnosis.ux.score).toBeLessThan(100);
      expect(diagnosis.ux.trapRisks.map((risk) => risk.trapId)).toContain("token-drift");
      expect(diagnosis.ux.findings.map((finding) => finding.id)).toContain("ux.color.raw-hex");
      expect(diagnosis.directions.map((direction) => direction.id)).toContain("premium-saas");
      await expect(readFile(join(root, ".memoire", "app-quality", "diagnosis.json"), "utf-8")).resolves.toContain("\"version\": 1");
      await expect(readFile(join(root, ".memoire", "app-quality", "diagnosis.md"), "utf-8")).resolves.toContain("# Memoire App Diagnosis");
      await expect(readFile(join(root, ".memoire", "app-quality", "diagnosis.md"), "utf-8")).resolves.toContain("## UX Tenets and Traps");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("scopes default scans away from generated bundles and agent scratch artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-app-quality-scope-"));
    try {
      await mkdir(join(root, "src", "app"), { recursive: true });
      await mkdir(join(root, ".astro"), { recursive: true });
      await mkdir(join(root, ".superpowers", "brainstorm", "session"), { recursive: true });
      await mkdir(join(root, "docs", "audits", "artifacts", "visual-parity"), { recursive: true });
      await mkdir(join(root, "dist-runtime-resources", "examples"), { recursive: true });
      await mkdir(join(root, "generated", "components", "Card"), { recursive: true });
      await mkdir(join(root, "notes", "figma-library-builder", "scripts"), { recursive: true });
      await mkdir(join(root, "agent-kits", "codex", "memoire-design-tooling"), { recursive: true });
      await mkdir(join(root, "plugins", "memoire", "skills"), { recursive: true });
      await mkdir(join(root, "plugin", "main"), { recursive: true });
      await mkdir(join(root, "examples", "site-bundle", "codex-plugin"), { recursive: true });
      await mkdir(join(root, "apps", "studio", "src-tauri", "resources", "memoire-runtime", "examples", "site-bundle"), { recursive: true });
      await mkdir(join(root, "apps", "studio", "src-tauri", "target", "debug", "resources", "memoire-runtime", "examples"), { recursive: true });
      await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0", tailwindcss: "4.0.0" } }), "utf-8");
      await writeFile(join(root, "src", "app", "page.tsx"), `
export default function Page() {
  return <main className="p-4 text-base">Clean scoped app</main>;
}
`, "utf-8");
      await writeFile(join(root, ".astro", "types.d.ts"), `declare const color = "#123456";`, "utf-8");
      await writeFile(join(root, ".superpowers", "brainstorm", "session", "scratch.html"), `<div style="color:#ff0000" class="text-[72px]">scratch</div>`, "utf-8");
      await writeFile(join(root, "docs", "audits", "artifacts", "visual-parity", "dashboard-preview.html"), `<main style="color:#1188ff" class="text-[80px]">audit artifact</main>`, "utf-8");
      await writeFile(join(root, "dist-runtime-resources", "examples", "index.html"), `<div style="color:#abcdef" class="text-[52px]">runtime cache</div>`, "utf-8");
      await writeFile(join(root, "generated", "components", "Card", "Card.tsx"), `export function Card(){ return <div className="text-[50px] text-[#fafafa]" /> }`, "utf-8");
      await writeFile(join(root, "notes", "figma-library-builder", "scripts", "createComponent.js"), `export const color = "#eeeeee";`, "utf-8");
      await writeFile(join(root, "agent-kits", "codex", "memoire-design-tooling", "SKILL.md"), `<div class="text-[48px] text-[#dddddd]">kit</div>`, "utf-8");
      await writeFile(join(root, "plugins", "memoire", "skills", "SKILL.md"), `<div class="text-[46px] text-[#cccccc]">plugin</div>`, "utf-8");
      await writeFile(join(root, "plugin", "main", "index.ts"), `export const color = "#bbbbbb";`, "utf-8");
      await writeFile(join(root, "examples", "site-bundle", "codex-plugin", "index.html"), `<div style="color:#00ff00" class="text-[64px]">bundle</div>`, "utf-8");
      await writeFile(join(root, "apps", "studio", "src-tauri", "resources", "memoire-runtime", "examples", "site-bundle", "index.html"), `<div style="color:#0000ff" class="text-[56px]">runtime bundle</div>`, "utf-8");
      await writeFile(join(root, "apps", "studio", "src-tauri", "target", "debug", "resources", "memoire-runtime", "examples", "index.html"), `<div style="color:#ff00ff" class="text-[54px]">target bundle</div>`, "utf-8");

      const diagnosis = await diagnoseAppQuality({ projectRoot: root, write: false });

      expect(diagnosis.files.map((file) => file.path)).toEqual(["src/app/page.tsx"]);
      expect(diagnosis.summary.hexColors).toBe(0);
      expect(diagnosis.issues.map((issue) => issue.id)).not.toContain("color.raw-hex");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("scores rendered UI surfaces instead of prompt and test fixture strings", async () => {
    const root = await mkdtemp(join(tmpdir(), "memoire-app-quality-ui-scope-"));
    try {
      await mkdir(join(root, "src", "app"), { recursive: true });
      await mkdir(join(root, "src", "styles"), { recursive: true });
      await mkdir(join(root, "src", "agents"), { recursive: true });
      await mkdir(join(root, "src", "app", "__tests__"), { recursive: true });
      await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0", tailwindcss: "4.0.0" } }), "utf-8");
      await writeFile(join(root, "src", "styles", "app.css"), `
:root {
  --background: white;
  --foreground: black;
  --surface: white;
  --muted: gray;
  --primary: blue;
  --primary-foreground: white;
  --border: gray;
  --ring: blue;
}
:focus-visible {
  outline: 2px solid var(--ring);
}
`, "utf-8");
      await writeFile(join(root, "src", "app", "page.tsx"), `
export default function Page() {
  return <main className="p-4 text-base"><button type="button">Save</button></main>;
}
`, "utf-8");
      await writeFile(join(root, "src", "agents", "prompts.ts"), `
export const prompt = '<img src="/demo.png" class="text-[96px] text-[#ff00ff]" /><button onClick={() => null}>Bad fixture</button>';
`, "utf-8");
      await writeFile(join(root, "src", "app", "__tests__", "page.test.tsx"), `
export const fixture = '<Image src="/test.png" className="p-[99px] bg-[#00ff00]" />';
`, "utf-8");

      const diagnosis = await diagnoseAppQuality({ projectRoot: root, write: false });
      const issueIds = diagnosis.issues.map((issue) => issue.id);

      expect(issueIds).not.toContain("a11y.image-alt");
      expect(issueIds).not.toContain("a11y.focus-missing");
      expect(issueIds).not.toContain("maintainability.arbitrary-tailwind");
      expect(diagnosis.summary.hexColors).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
