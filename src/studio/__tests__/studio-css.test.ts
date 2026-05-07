import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("studio visual cleanup", () => {
  it("does not use decorative grid texture backgrounds", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).not.toMatch(/linear-gradient\([^;\n]*(?:1px|32px)[^;\n]*transparent/i);
    expect(css).not.toMatch(/background-size:\s*32px\s+32px/i);
  });

  it("uses one font family and only three font-size tokens", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const fontFamilies = Array.from(css.matchAll(/font-family:\s*([^;]+);/g)).map((match) => match[1].trim());
    const rawFontSizes = Array.from(css.matchAll(/font-size:\s*([^;]+);/g)).map((match) => match[1].trim());

    expect(css).toContain('--font-studio: "Geist Sans", ui-sans-serif, system-ui');
    expect(css).toContain("--font-size-xs:");
    expect(css).toContain("--font-size-sm:");
    expect(css).toContain("--font-size-md:");
    expect(css).not.toContain("--font-mono");
    expect(css).not.toContain("--font-serif");
    expect(css).not.toContain("Inter, ui-sans-serif");
    expect(css).not.toContain("JetBrains Mono");
    expect(css).not.toContain("Cormorant Garamond");
    expect(new Set(fontFamilies)).toEqual(new Set(["var(--font-studio)"]));
    expect(new Set(rawFontSizes)).toEqual(new Set([
      "var(--font-size-xs)",
      "var(--font-size-sm)",
      "var(--font-size-md)",
    ]));
  });

  it("uses tokenized spacing for padding, margin, and gaps", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const server = await readFile(join(process.cwd(), "src", "studio", "server.ts"), "utf-8");
    const hardCodedSpacing = `${css}\n${server}`
      .split(/\r?\n/)
      .flatMap((line) => Array.from(line.matchAll(/(?:^|[;{])\s*((?:padding|margin)(?:-[a-z]+)?|gap):\s*([^;}\n]+)/g))
        .map((match) => `${match[1]}: ${match[2].trim()}`))
      .filter((declaration) => !declaration.includes("var(--space-"));

    expect(css).toContain("--space-1:");
    expect(css).toContain("--space-2:");
    expect(css).toContain("--space-3:");
    expect(css).toContain("--space-4:");
    expect(hardCodedSpacing).toEqual([]);
  });

  it("uses the web rose, cream, black, and white brand palette", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain("--studio-color-surface-bg-light: #fbf4f2");
    expect(css).toContain("--studio-color-surface-light: #fffaf8");
    expect(css).toContain("--studio-color-feed-bg-light: #fffdfb");
    expect(css).toContain("--studio-color-logo-light: #111111");
    expect(css).toContain("--studio-color-accent-light: #cf5f7f");
    expect(css).toContain("--studio-color-surface-bg-dark: #181717");
    expect(css).toContain("--studio-color-surface-dark: #222020");
    expect(css).toContain("--studio-color-feed-bg-dark: #171616");
    expect(css).toContain("--studio-color-logo-dark: #ffffff");
    expect(css).toContain("--studio-color-accent-dark: #f08cab");
    expect(css).not.toContain("--studio-color-accent-light: #df6a2e");
    expect(css).not.toContain("--studio-color-agentic-accent-light: #df6a2e");
    expect(css).not.toContain("--studio-color-accent-dark: #f28b54");
    expect(css).not.toContain("--studio-color-agentic-accent-dark: #f28b54");
    expect(css).not.toContain("--studio-color-surface-bg-light: #fff7ed");
    expect(css).not.toContain("--studio-color-surface-bg-dark: #11112b");
    expect(css).not.toContain("--studio-color-accent-dark: #a78bfa");
    expect(css).toContain("--accent: var(--studio-color-accent-light)");
    expect(css).toContain("--accent: var(--studio-color-accent-dark)");
    expect(css).toContain("--brand-logo: var(--studio-color-logo-light)");
    expect(css).toContain("--brand-logo: var(--studio-color-logo-dark)");
    expect(css).toContain(".memoire-logo-mark");
    expect(css).toContain("color: var(--brand-logo)");
  });

  it("stays below the lean Studio CSS budget", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css.split(/\r?\n/).length).toBeLessThanOrEqual(1450);
  });

  it("locks Studio to a one-viewport IDE shell with internal pane scrolling", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");

    expect(css).toContain("height: 100dvh");
    expect(css).toContain(".studio-shell");
    expect(css).toContain("overflow: hidden");
    expect(css).not.toContain("min-width: 1080px");
    expect(css).toContain(".console-layout");
    expect(css).toContain("grid-template-columns: var(--project-sidebar-width) minmax(0, 1fr)");
    expect(css).toContain('data-sidebar-collapsed="true"');
    expect(css).toContain(".artifact-canvas");
    expect(css).toContain(".artifact-pane-tabs");
    expect(css).toContain(".artifact-pane-body");
    expect(css).toContain(".agent-cockpit-pane");
    expect(css).toContain(".agent-pane-intent");
    expect(css).toContain(".mermaid-board-surface");
    expect(css).toContain(".mermaid-board-canvas");
    expect(css).toContain(".mermaid-board-inspector");
    expect(css).toContain(".agentic-design-system");
    expect(css).toContain(".agentic-role-card");
    expect(css).toContain(".agent-cockpit-pane {");
    expect(css).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(css).toContain(".console-panel {");
    expect(css).toContain("grid-template-rows: auto auto auto auto minmax(0, 1fr) auto");
    expect(css).toContain(".conversation-scroll-region");
    expect(css).toContain(".agent-live-status");
    expect(css).toContain(".scroll-latest-button");
    expect(css).toContain("[data-latest-anchor]");
    expect(css).toContain('.agent-live-status[data-agent-thinking-state="thinking"] .status-dot');
    expect(css).toContain("padding: var(--space-0)");
    expect(css).toContain(".settings-setup-surface");
    expect(css).toContain("position: sticky");
    expect(css).toContain(".block-feed");
    expect(css).toContain(".console-panel");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(128px, 1fr))");
    expect(css).not.toContain("min-width: 520px");
    expect(css).not.toContain(".inline-session-stack");
    expect(css).not.toContain(".inline-session-list");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).not.toContain("calc(100vh");
    expect(css).not.toContain(".agent-tools-rail");
    expect(css).not.toContain(".secondary-surface-nav");
    expect(css).not.toContain(".artifact-tabs");
    expect(css).not.toContain(".phase-tracker");
    expect(css).not.toContain(".run-details-drawer");
    expect(css).not.toContain(".details-drawer-tabs");
    expect(app).not.toContain('value="Design Ops"');
    expect(app).not.toContain("const MODEL_LABEL");
  });

  it("compresses the Studio topbar into a 30 percent icon-first strip", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const topbarBlock = css.match(/\.console-topbar \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(css).toContain("--topbar-compact-height: 20px");
    expect(css).toContain(".console-topbar[data-topbar-density=\"thirty-percent\"]");
    expect(topbarBlock).toContain("display: flex");
    expect(topbarBlock).toContain("height: var(--topbar-compact-height)");
    expect(topbarBlock).toContain("min-height: var(--topbar-compact-height)");
    expect(topbarBlock).toContain("overflow: hidden");
    expect(topbarBlock).not.toContain("grid-template-columns");
    expect(css).toContain(".console-topbar .memoire-logo-mark");
    expect(css).toContain("width: 12px");
    expect(css).toContain("height: 12px");
    expect(css).toContain(".harness-readiness-row[data-topbar-tags=\"left-compact\"]");
    expect(css).toContain("flex-wrap: nowrap");
    expect(css).toContain(".topbar-icon-button");
    expect(css).toContain(".topbar-actions {");
    expect(css).toContain("justify-content: flex-start");
    expect(css).not.toContain(".memoire-wordmark");
  });

  it("keeps project sidebar folder and session rows compactly aligned", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".project-folder-row {");
    expect(css).toContain("min-height: var(--control-height)");
    expect(css).toContain("padding: var(--space-1) var(--space-2)");
    expect(css).toContain(".project-session-list::before");
    expect(css).toContain("margin: var(--space-1) var(--space-0) var(--space-1) var(--space-6)");
    expect(css).toContain(".project-session-list button {");
    expect(css).toContain("min-height: calc(var(--control-height) + var(--space-3))");
    expect(css).toContain("grid-template-columns: auto minmax(0, 1fr)");
    expect(css).toContain(".project-session-copy");
    expect(css).toContain(".project-session-copy span");
    expect(css).toContain(".project-session-copy small");
    expect(css).toContain(".project-sidebar[data-sidebar-collapsed=\"true\"] .project-session-list");
  });

  it("keeps composer controls readable and wraps them inside the composer", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const composerControls = css.match(/\.composer-controls \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(css).toContain(".composer-controls {");
    expect(css).toContain("flex-wrap: wrap");
    expect(composerControls).not.toContain("overflow-x: auto");
    expect(css).toContain(".composer-select");
    expect(css).toContain(".composer-control-label");
    expect(css).toContain(".composer-control-text");
    expect(css).toContain(".composer-icon-toggle");
    expect(css).toContain(".control-icon");
    expect(css).toContain("grid-template-columns: auto minmax(0, 1fr)");
    expect(css).toContain(".command-dock[data-command-editor=\"bottom-pinned\"]");
    expect(css).toContain("position: sticky");
    expect(css).toContain("bottom: var(--space-0)");
    expect(css).toContain("--run-button-width: 96px");
    expect(css).toContain("flex: 1 1 150px");
    expect(css).toContain("min-width: 148px");
    expect(css).not.toContain("flex: 0 1 96px");
  });

  it("styles compact chat quality-of-life surfaces without stealing composer space", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".chat-quality-layer");
    expect(css).toContain("data-chat-qol=\"codex-antigravity\"");
    expect(css).toContain(".chat-live-plan");
    expect(css).toContain(".chat-qol-grid");
    expect(css).toContain(".chat-search-row");
    expect(css).toContain(".chat-follow-up-row");
    expect(css).toContain(".chat-memory-pins");
    expect(css).toContain(".chat-artifact-shelf");
    expect(css).toContain(".chat-verification-receipt");
    expect(css).toContain(".chat-agent-lanes");
    expect(css).toContain(".tool-trace-summary");
    expect(css).toContain("grid-template-rows: auto auto auto auto minmax(0, 1fr) auto");
    expect(css).toContain("max-height: 132px");
    expect(css).toContain("overflow-y: auto");
  });

  it("styles the creation-stage output modes as the center of the chat rail", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".run-goal-banner");
    expect(css).toContain('data-run-goal-banner="agent-objective"');
    expect(css).toContain(".center-stage-tabs");
    expect(css).toContain('data-output-mode-tabs="creation-chat-trace-files-inspector"');
    expect(css).toContain(".creation-stage-panel");
    expect(css).toContain(".creation-output-grid");
    expect(css).toContain(".stage-mode-panel");
    expect(css).toContain(".conversation-scroll-region[data-output-mode=\"creation\"]");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))");
    expect(css).toContain("position: sticky");
  });

  it("styles the latest artifact snapshot and inline evidence shelf", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".artifact-snapshot-card");
    expect(css).toContain('[data-artifact-snapshot="latest-agent-output"]');
    expect(css).toContain(".inline-evidence-shelf");
    expect(css).toContain('[data-evidence-shelf="creation-context"]');
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))");
  });

  it("styles the Agent Cockpit and Mermaid Board as the right-pane work surface", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".agent-pane-intent");
    expect(css).toContain(".agent-cockpit-pane");
    expect(css).toContain(".cockpit-card");
    expect(css).toContain(".mermaid-board-layout");
    expect(css).toContain(".mermaid-board-canvas");
    expect(css).toContain(".mermaid-board-node");
    expect(css).toContain(".mermaid-board-inspector");
    expect(css).toContain('data-agent-cockpit-shell="right-pane"');
    expect(css).toContain("grid-template-columns: minmax(420px, 1fr) minmax(260px, 0.32fr)");
    expect(css).toContain("position: sticky");
  });

  it("supports a persisted resizable conversation and artifact grid", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain("--chat-rail-width:");
    expect(css).toContain("grid-template-columns: minmax(420px, var(--chat-rail-width)) 8px minmax(360px, 1fr)");
    expect(css).toContain(".chat-resize-handle");
    expect(css).toContain("cursor: col-resize");
    expect(css).toContain(".chat-resize-handle:focus-visible");
    expect(css).toContain(".agent-workbench[data-agent-workbench=\"resizable-conversation-artifacts\"]");
    expect(css).toContain(".agent-workbench[data-agent-workbench=\"resizable-conversation-artifacts\"] .artifact-canvas");
    expect(css).toContain(".agent-workbench { grid-template-columns: minmax(0, 1fr); overflow: hidden; }");
    expect(css).toContain(".chat-resize-handle { display: none; }");
  });

  it("styles the tabbed artifact canvas states for design review, research, and changelog", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".artifact-canvas { min-width: 0; min-height: 0; display: grid");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(css).toContain(".artifact-pane-tabs");
    expect(css).toContain(".artifact-pane-body { min-width: 0; min-height: 0; overflow-y: auto");
    expect(css).toContain(".design-system-review { min-height: 100%; display: grid");
    expect(css).toContain(".scenario-lab { min-height: 100%; display: grid");
    expect(css).toContain(".artifact-canvas[data-artifact-canvas=\"design-system\"]");
    expect(css).toContain(".artifact-canvas[data-artifact-canvas=\"mirofish-research\"]");
    expect(css).toContain(".artifact-canvas[data-artifact-canvas=\"design-changelog\"]");
  });

  it("styles the design changelog pane with timeline filters and editor", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".design-changelog-page");
    expect(css).toContain(".artifact-canvas[data-artifact-canvas=\"design-changelog\"] .design-changelog-page");
    expect(css).toContain(".design-changelog-header");
    expect(css).toContain(".design-changelog-filters");
    expect(css).toContain(".design-changelog-layout");
    expect(css).toContain(".design-changelog-list");
    expect(css).toContain(".design-changelog-card");
    expect(css).toContain(".design-changelog-card[data-status=\"archived\"]");
    expect(css).toContain(".design-changelog-editor");
    expect(css).toContain(".design-changelog-editor textarea");
    expect(css).toContain(".design-changelog-warning");
    expect(css).toContain(".design-changelog-file-refs");
  });

  it("defines explicit dark-mode contrast for chat and memory text", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");

    expect(css).toContain(".studio-shell.theme-dark .terminal-block pre");
    expect(css).toContain(".studio-shell.theme-dark .block-run_context pre");
    expect(css).toContain(".studio-shell.theme-dark .memory-title strong");
    expect(css).toContain(".studio-shell.theme-dark .empty-state h2");
    expect(css).toContain(".marketplace-note");
    expect(css).toContain(".marketplace-note-actions");
  });

  it("keeps colors tokenized outside token declarations", async () => {
    const css = await readFile(join(process.cwd(), "apps", "studio", "src", "styles.css"), "utf-8");
    const app = await readFile(join(process.cwd(), "apps", "studio", "src", "App.tsx"), "utf-8");
    const components = await readFile(join(process.cwd(), "apps", "studio", "src", "workbench-components.tsx"), "utf-8");
    const server = await readFile(join(process.cwd(), "src", "studio", "server.ts"), "utf-8");
    const ui = `${app}\n${components}`;
    const rawColorLines = `${css}\n${server}`
      .split(/\r?\n/)
      .filter((line) => /#[0-9a-fA-F]{3,8}|rgba?\(/.test(line))
      .filter((line) => !line.includes("--studio-color-"));

    expect(rawColorLines).toEqual([]);
    expect(ui).not.toMatch(/fill="(?:#[0-9a-fA-F]{3,8}|black|white)"/);
    expect(ui).toContain("fill=\"var(--svg-mask-on)\"");
    expect(ui).toContain("figma-logo-red");
    expect(server).toContain("background: var(--studio-color-surface-bg-dark)");
    expect(server).toContain('font-family: var(--font-studio)');
    expect(server).toContain('--font-studio: "Geist Sans"');
    expect(server).toContain("code { color: var(--studio-color-agentic-accent); }");
  });
});
