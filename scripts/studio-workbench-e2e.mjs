#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? process.env.STUDIO_E2E_URL ?? "http://127.0.0.1:1420";
const realHarnesses = args["real-harnesses"] ?? process.env.STUDIO_E2E_REAL_HARNESSES ?? "none";
const root = resolve(args.root ?? process.cwd());
const runtimeTimeoutMs = Number(args["harness-timeout-ms"] ?? process.env.STUDIO_E2E_HARNESS_TIMEOUT_MS ?? 180_000);

const viewports = [
  { name: "desktop", width: 1440, height: 980 },
  { name: "narrow-desktop", width: 980, height: 920 },
  { name: "mobile-pane", width: 430, height: 920 },
];

const safeClickSequence = [
  "theme.light",
  "theme.dark",
  "command-palette.open",
  "command-palette.close",
  "details.open",
  "details.close",
  "settings.open",
  "settings.close",
  "sidebar.collapse",
  "sidebar.collapse",
];

const harnessMatrix = [
  {
    id: "codex",
    action: "audit",
    chatMode: "review",
    permissionMode: "full_access",
    workspace: "disposable-fixture",
    prompt: "Mémoire Studio E2E smoke. In this disposable fixture, inspect files, run one harmless command, create or update memoire-e2e-result.md, and finish with labeled research_note, design_decision, artifact, and session_result. Keep every action traceable.",
  },
  {
    id: "claude-code",
    action: "audit",
    chatMode: "review",
    permissionMode: "guarded",
    workspace: "configured-workspace",
    prompt: "Mémoire Studio E2E smoke. Inspect this workspace read-only, report one file read, one search, and a concise session_result. Do not edit files.",
  },
  {
    id: "hermes",
    action: "audit",
    chatMode: "review",
    permissionMode: "guarded",
    workspace: "configured-workspace",
    prompt: "Mémoire Studio E2E smoke. Summarize workspace readiness with visible activity and a session_result. Do not edit files.",
  },
  {
    id: "memoire",
    action: "compose",
    chatMode: "ideate",
    permissionMode: "guarded",
    workspace: "configured-workspace",
    prompt: "Mémoire Native E2E smoke. Compose a concise design-system workbench readiness note as JSON if available. Do not edit files.",
  },
];

const summary = {
  url,
  root,
  browser: [],
  clicks: [],
  harnesses: [],
  failures: [],
};

try {
  await runBrowserWorkbenchAudit();
  if (realHarnesses !== "none") await runRealHarnessSmoke();
} catch (error) {
  summary.failures.push(error instanceof Error ? error.message : String(error));
}

console.log(JSON.stringify(summary, null, 2));
if (summary.failures.length > 0) process.exit(1);

async function runBrowserWorkbenchAudit() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      const audit = await page.evaluate(() => {
        const clippedRectFor = (el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (rect.width <= 0 || rect.height <= 0 || style.visibility === "hidden" || style.display === "none") return null;
          let left = Math.max(rect.left, 0);
          let top = Math.max(rect.top, 0);
          let right = Math.min(rect.right, window.innerWidth);
          let bottom = Math.min(rect.bottom, window.innerHeight);
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const parentStyle = window.getComputedStyle(parent);
            const clips = `${parentStyle.overflow}${parentStyle.overflowX}${parentStyle.overflowY}`;
            if (!/(auto|scroll|hidden|clip)/u.test(clips)) continue;
            const parentRect = parent.getBoundingClientRect();
            left = Math.max(left, parentRect.left);
            top = Math.max(top, parentRect.top);
            right = Math.min(right, parentRect.right);
            bottom = Math.min(bottom, parentRect.bottom);
          }
          const width = Math.max(0, right - left);
          const height = Math.max(0, bottom - top);
          if (width <= 1 || height <= 1) return null;
          return { x: left, y: top, width, height };
        };
        const visible = (el) => clippedRectFor(el) !== null;
        const controls = [...document.querySelectorAll("button, select, input, textarea, [data-action-id], details > summary")]
          .filter((el) => visible(el));
        const controlEntries = controls.map((el, index) => {
          const rect = clippedRectFor(el) ?? el.getBoundingClientRect();
          return {
            index,
            tag: el.tagName.toLowerCase(),
            text: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 80),
            actionId: el.getAttribute("data-action-id") || "",
            disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        });
        const buttonMissingActionId = controlEntries
          .filter((entry) => entry.tag === "button" && !entry.disabled && !entry.actionId)
          .map((entry) => entry.text || `${entry.tag}:${entry.index}`);
        const textOverflow = controlEntries
          .filter((entry) => ["button", "select", "input", "textarea"].includes(entry.tag) && entry.clientWidth > 0 && entry.scrollWidth > entry.clientWidth + 2)
          .map((entry) => entry.actionId || entry.text || `${entry.tag}:${entry.index}`);
        const clickable = controlEntries.filter((entry) => ["button", "select", "input", "textarea"].includes(entry.tag));
        const overlaps = [];
        for (let left = 0; left < clickable.length; left += 1) {
          for (let right = left + 1; right < clickable.length; right += 1) {
            const a = clickable[left];
            const b = clickable[right];
            if (!a.actionId && !b.actionId) continue;
            const x = Math.max(0, Math.min(a.rect.x + a.rect.width, b.rect.x + b.rect.width) - Math.max(a.rect.x, b.rect.x));
            const y = Math.max(0, Math.min(a.rect.y + a.rect.height, b.rect.y + b.rect.height) - Math.max(a.rect.y, b.rect.y));
            if (x * y > 20) overlaps.push(`${a.actionId || a.text} overlaps ${b.actionId || b.text}`);
          }
        }
        return {
          controls: controlEntries.length,
          actions: [...new Set(controlEntries.map((entry) => entry.actionId).filter(Boolean))].sort(),
          buttonMissingActionId,
          textOverflow,
          overlaps: overlaps.slice(0, 20),
        };
      });
      const scrollAudit = await auditConversationScroll(page);
      const readabilityAudit = await auditWorkbenchReadability(page);
      summary.browser.push({ viewport: viewport.name, ...audit, scrollAudit, readabilityAudit });
      if (audit.buttonMissingActionId.length > 0) summary.failures.push(`${viewport.name}: enabled buttons without data-action-id: ${audit.buttonMissingActionId.join(", ")}`);
      if (audit.textOverflow.length > 0) summary.failures.push(`${viewport.name}: controls with clipped text: ${audit.textOverflow.join(", ")}`);
      if (audit.overlaps.length > 0) summary.failures.push(`${viewport.name}: overlapping controls: ${audit.overlaps.join("; ")}`);
      if (readabilityAudit.visibleHarnessChrome) summary.failures.push(`${viewport.name}: visible HARNESS chrome still present`);
      if (readabilityAudit.emptyChangedDisclosure) summary.failures.push(`${viewport.name}: empty changed-file disclosure is visible`);
      if (!readabilityAudit.compactStatusRail) summary.failures.push(`${viewport.name}: compact status rail missing`);
      if (!readabilityAudit.statusRailSingleLine) summary.failures.push(`${viewport.name}: status rail wraps vertically`);
      if (!readabilityAudit.blockActionsIconOnly) summary.failures.push(`${viewport.name}: block actions are not icon-only`);
      if (!readabilityAudit.searchIsCompact) summary.failures.push(`${viewport.name}: compact search row missing`);
      if (!readabilityAudit.pinsAreCompact) summary.failures.push(`${viewport.name}: empty pins copy is visible`);
      if (!scrollAudit.hasRegion) summary.failures.push(`${viewport.name}: missing conversation scroll region`);
      if (!scrollAudit.hasAnchor) summary.failures.push(`${viewport.name}: missing latest anchor`);
      if (scrollAudit.scrollable && scrollAudit.pausedState !== "paused") summary.failures.push(`${viewport.name}: manual scroll did not pause auto-scroll`);
      if (scrollAudit.scrollable && !scrollAudit.latestVisible) summary.failures.push(`${viewport.name}: Latest control missing after manual scroll`);
      if (scrollAudit.scrollable && scrollAudit.resumedState !== "pinned") summary.failures.push(`${viewport.name}: Latest control did not resume pinned scroll`);
    }

    await page.setViewportSize({ width: 1440, height: 980 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    for (const actionId of safeClickSequence) {
      const selector = `[data-action-id="${actionId}"]`;
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) {
        summary.clicks.push({ actionId, status: "missing" });
        continue;
      }
      if (!(await locator.isEnabled().catch(() => false))) {
        summary.clicks.push({ actionId, status: "disabled" });
        continue;
      }
      await locator.click();
      await page.waitForTimeout(150);
      summary.clicks.push({ actionId, status: "clicked" });
    }
  } finally {
    await browser.close();
  }
}

async function auditWorkbenchReadability(page) {
  return page.evaluate(() => {
    const panel = document.querySelector(".console-panel");
    const panelHead = document.querySelector(".panel-head");
    const runInfo = document.querySelector(".console-run-info");
    const chips = [...document.querySelectorAll(".console-run-info [data-harness-chip]")];
    const chipRects = chips.map((chip) => chip.getBoundingClientRect());
    const railText = runInfo?.textContent?.trim() ?? "";
    const changedText = document.querySelector('[data-changed-files-panel="inline-review"]')?.textContent ?? "";
    const blockButtons = [...document.querySelectorAll(".blockActions button")];
    const search = document.querySelector('[data-chat-search="conversation"] input');
    const pinsText = document.querySelector('[data-memory-pins="session"]')?.textContent ?? "";
    const railLabels = ["Harness", "Access", "Reasoning", "Action", "Status"];
    return {
      visibleHarnessChrome: /(^|\s)HARNESS(\s|$)/i.test(panelHead?.textContent ?? ""),
      compactStatusRail: chips.length === 5 && !railLabels.some((label) => railText.includes(label)),
      statusRailSingleLine: chipRects.length > 0 && Math.max(...chipRects.map((rect) => rect.top)) - Math.min(...chipRects.map((rect) => rect.top)) <= 4,
      emptyChangedDisclosure: /Show 0|No changed files/u.test(changedText),
      blockActionsIconOnly: blockButtons.every((button) => (button.textContent ?? "").trim() === "" && Boolean(button.getAttribute("aria-label"))),
      searchIsCompact: search?.getAttribute("placeholder") === "Find",
      pinsAreCompact: !pinsText.includes("No pinned decisions"),
      hasPanel: Boolean(panel),
    };
  });
}

async function auditConversationScroll(page) {
  const initial = await page.evaluate(() => {
    const region = document.querySelector('[data-conversation-scroll="activity-output"]');
    return {
      hasRegion: Boolean(region),
      hasAnchor: Boolean(document.querySelector("[data-latest-anchor]")),
      state: region?.getAttribute("data-auto-scroll-state") ?? null,
      thinkingState: region?.getAttribute("data-agent-thinking-state") ?? null,
      scrollable: region ? region.scrollHeight > region.clientHeight + 8 : false,
    };
  });
  if (!initial.hasRegion || !initial.scrollable) {
    return {
      ...initial,
      pausedState: null,
      latestVisible: false,
      resumedState: initial.state,
    };
  }
  await page.evaluate(() => {
    const region = document.querySelector('[data-conversation-scroll="activity-output"]');
    if (!(region instanceof HTMLElement)) return;
    region.scrollTop = 0;
    region.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(80);
  const paused = await page.evaluate(() => {
    const region = document.querySelector('[data-conversation-scroll="activity-output"]');
    return {
      state: region?.getAttribute("data-auto-scroll-state") ?? null,
      latestVisible: Boolean(document.querySelector('[data-action-id="conversation.scroll-latest"]')),
    };
  });
  const latest = page.locator('[data-action-id="conversation.scroll-latest"]').first();
  if (paused.latestVisible && await latest.isEnabled().catch(() => false)) {
    await latest.click();
    await page.waitForTimeout(80);
  }
  const resumedState = await page.evaluate(() => {
    const region = document.querySelector('[data-conversation-scroll="activity-output"]');
    return region?.getAttribute("data-auto-scroll-state") ?? null;
  });
  return {
    ...initial,
    pausedState: paused.state,
    latestVisible: paused.latestVisible,
    resumedState,
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const systemChromeCandidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const executablePath of systemChromeCandidates) {
      if (!existsSync(executablePath)) continue;
      return chromium.launch({ executablePath, headless: true });
    }
    try {
      return await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      throw error;
    }
  }
}

async function runRealHarnessSmoke() {
  const harnessesPayload = await fetchJSON(new URL("/api/harnesses", url));
  const harnesses = new Map((harnessesPayload.harnesses ?? []).map((harness) => [harness.id, harness]));
  const selected = realHarnesses === "available"
    ? harnessMatrix
    : harnessMatrix.filter((item) => realHarnesses.split(",").map((part) => part.trim()).includes(item.id));

  for (const testCase of selected) {
    const harness = harnesses.get(testCase.id);
    if (!harness?.installed || !harness.enabled || !["ready", "signed_in", "not_required"].includes(harness.authStatus)) {
      summary.harnesses.push({
        id: testCase.id,
        status: "skipped",
        reason: harness ? `${harness.authStatus}/${harness.enabled ? "enabled" : "disabled"}` : "missing",
      });
      continue;
    }

    const cwd = testCase.workspace === "disposable-fixture" ? await createDisposableFixture(testCase.id) : root;
    const sessionPayload = await fetchJSON(new URL("/api/sessions", url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        harness: testCase.id,
        cwd,
        prompt: testCase.prompt,
        action: testCase.action,
        chatMode: testCase.chatMode,
        permissionMode: testCase.permissionMode,
      }),
    });
    const sessionId = sessionPayload.session?.id;
    if (!sessionId) throw new Error(`${testCase.id}: session id missing`);

    const record = await pollSession(sessionId);
    const tracePayload = await fetchJSON(new URL(`/api/sessions/${encodeURIComponent(sessionId)}/trace`, url));
    const eventTypes = new Set((record.events ?? []).map((event) => event.type));
    const required = ["chat_message", "session_started", "reference_trace"];
    const missing = required.filter((eventType) => !eventTypes.has(eventType));
    if (!eventTypes.has("session_result") && !eventTypes.has("session_done")) missing.push("session_result-or-session_done");
    if (!Array.isArray(tracePayload.trace?.activities)) {
      missing.push("trace.activities");
    } else if (record.session?.status === "completed" && tracePayload.trace.activities.length === 0) {
      missing.push("trace.activities.non_empty");
    }
    if (missing.length > 0) summary.failures.push(`${testCase.id}: missing ${missing.join(", ")}`);
    if (record.session?.status === "failed") summary.failures.push(`${testCase.id}: session failed`);
    summary.harnesses.push({
      id: testCase.id,
      status: record.session?.status ?? "unknown",
      sessionId,
      events: record.events?.length ?? 0,
      activities: tracePayload.trace?.activities?.length ?? 0,
      activeProcesses: tracePayload.trace?.activeProcesses?.length ?? 0,
      cwd,
    });
  }
}

async function pollSession(sessionId) {
  const started = Date.now();
  while (Date.now() - started < runtimeTimeoutMs) {
    const record = await fetchJSON(new URL(`/api/sessions/${encodeURIComponent(sessionId)}/events?limit=600`, url));
    if (record.session?.status && record.session.status !== "running") return record;
    await sleep(1_000);
  }
  throw new Error(`${sessionId}: timed out after ${runtimeTimeoutMs}ms`);
}

async function createDisposableFixture(harnessId) {
  const dir = join(root, ".memoire", "studio", "e2e-fixtures", `${harnessId}-${Date.now().toString(36)}`);
  await mkdir(join(dir, "src"), { recursive: true });
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: `memoire-e2e-${harnessId}`, private: true, type: "module" }, null, 2));
  await writeFile(join(dir, "README.md"), "# Mémoire Studio E2E Fixture\n\nDisposable workspace for harness smoke tests.\n");
  await writeFile(join(dir, "src", "tokens.ts"), "export const tokens = { color: '#ff8a4c', space: 8 };\n");
  return dir;
}

async function fetchJSON(target, init) {
  const response = await fetch(target, init);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text}`);
  return payload;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=");
    parsed[key] = inlineValue ?? argv[index + 1] ?? "true";
    if (inlineValue === undefined && argv[index + 1] && !argv[index + 1].startsWith("--")) index += 1;
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
