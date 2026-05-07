#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const notesRoot = resolve(root, args.notesRoot ?? "notes");
const outRoot = resolve(root, args.outRoot ?? "examples/site-bundle/notes");
const baseUrl = args.baseUrl ?? process.env.MEMOIRE_NOTES_BASE_URL ?? "https://www.memoire.cv/notes";
const sourceKind = args.sourceKind ?? "official";
const sourceRepo = args.sourceRepo ?? "https://github.com/sarveshsea/m-moire";
const contributionBaseUrl = args.contributionBaseUrl ?? "https://github.com/sarveshsea/memoire-community-notes/tree/main/notes";
const reviewStatus = args.reviewStatus ?? "approved";
const pageBasePath = (args.pageBasePath ?? "/notes").replace(/\/+$/, "");

await mkdir(outRoot, { recursive: true });
await rm(join(outRoot, "catalog.v1.json"), { force: true });

const notes = [];
const sourceEntries = existsSync(notesRoot) ? await readdir(notesRoot, { withFileTypes: true }) : [];
for (const entry of sourceEntries) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const noteDir = join(notesRoot, entry.name);
  const manifestPath = join(noteDir, "note.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const noteOutDir = join(outRoot, manifest.name);
  await mkdir(noteOutDir, { recursive: true });
  const archiveName = `${manifest.name}-${manifest.version}.tgz`;
  const archivePath = join(noteOutDir, archiveName);
  await rm(archivePath, { force: true });
  await tar(["-czf", archivePath, "-C", notesRoot, manifest.name]);
  const archiveBytes = await readFile(archivePath);
  const archiveStat = await stat(archivePath);
  const catalogEntry = {
    id: manifest.name,
    name: manifest.name,
    title: manifest.skills?.[0]?.name || titleize(manifest.name),
    version: manifest.version,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags ?? [],
    sourceUrls: manifest.sourceUrls ?? [],
    freshnessDays: manifest.freshnessDays ?? 90,
    sourceKind,
    sourceRepo,
    sourcePath: `notes/${manifest.name}`,
    reviewStatus,
    contributionUrl: `${contributionBaseUrl.replace(/\/+$/, "")}/${manifest.name}`,
    archive: {
      url: `${baseUrl}/${manifest.name}/${archiveName}`,
      sha256: createHash("sha256").update(archiveBytes).digest("hex"),
      size: archiveStat.size,
    },
    manifest,
  };
  const researchedAt = manifest.lastResearchedAt ?? manifest.updatedAt;
  if (researchedAt) catalogEntry.lastResearchedAt = researchedAt;
  notes.push(catalogEntry);
}

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  baseUrl,
  notes: notes.sort((left, right) => left.name.localeCompare(right.name)),
};

await writeFile(join(outRoot, "catalog.v1.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
await writeFile(join(outRoot, "index.html"), renderNotesIndex(catalog), "utf8");
for (const note of catalog.notes) {
  await writeFile(join(outRoot, note.name, "index.html"), renderNoteDetail(catalog, note), "utf8");
}
console.log(`wrote ${join(outRoot, "catalog.v1.json")} (${notes.length} notes)`);

function tar(args) {
  return new Promise((resolveTar, rejectTar) => {
    execFile("tar", args, { encoding: "utf8" }, (error, _stdout, stderr) => {
      if (error) {
        rejectTar(new Error(stderr || error.message));
        return;
      }
      resolveTar();
    });
  });
}

function titleize(value) {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function renderNotesIndex(catalog) {
  const categories = Array.from(new Set(catalog.notes.map((note) => note.category))).sort();
  const cards = catalog.notes.map((note) => `
          <article class="note-row" data-note-row data-category="${escapeHtml(note.category)}" data-source="${escapeHtml(note.sourceKind ?? "official")}" data-search="${escapeHtml(`${note.name} ${note.title} ${note.description} ${note.tags.join(" ")}`.toLowerCase())}">
            <a href="${escapeHtml(pageBasePath)}/${encodeURIComponent(note.name)}/">
              <strong>${escapeHtml(note.title)}</strong>
              <span>${escapeHtml(note.name)} &middot; ${escapeHtml(note.version)} &middot; ${escapeHtml(note.category)}</span>
              <p>${escapeHtml(note.description)}</p>
            </a>
            <code>memi notes install ${escapeHtml(note.name)}</code>
          </article>`).join("\n");
  const filterButtons = categories.map((category) => `<button type="button" data-category-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("\n            ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Memoire Notes Marketplace</title>
    <style>${marketplaceCss()}</style>
  </head>
  <body>
    <main data-notes-marketplace="vscode-style">
      <aside class="filter-rail">
        <a class="brand" href="/">Memoire</a>
        <label>
          <span>Search Marketplace</span>
          <input data-marketplace-search type="search" placeholder="Search Notes">
        </label>
        <nav aria-label="Note categories">
          <button type="button" data-category-filter="all">All</button>
          ${filterButtons}
        </nav>
        <nav aria-label="Note sources" data-marketplace-source-filter="official-community">
          <button type="button" data-source-filter="all">All sources</button>
          <button type="button" data-source-filter="official">Official</button>
          <button type="button" data-source-filter="community">Community</button>
        </nav>
      </aside>
      <section class="results">
        <header>
          <p>Memoire Notes Marketplace</p>
          <h1>Install agent capabilities in one command.</h1>
          <span>${catalog.notes.length} Notes &middot; generated ${escapeHtml(formatDate(catalog.generatedAt))}</span>
        </header>
        <div class="note-list">
${cards}
        </div>
      </section>
    </main>
    <script>
      const input = document.querySelector("[data-marketplace-search]");
      const rows = Array.from(document.querySelectorAll("[data-note-row]"));
      let category = "all";
      let source = "all";
      function sync() {
        const query = (input.value || "").trim().toLowerCase();
        for (const row of rows) {
          const categoryMatch = category === "all" || row.dataset.category === category;
          const sourceMatch = source === "all" || row.dataset.source === source;
          const queryMatch = !query || row.dataset.search.includes(query);
          row.hidden = !(categoryMatch && sourceMatch && queryMatch);
        }
      }
      input.addEventListener("input", sync);
      for (const button of document.querySelectorAll("[data-category-filter]")) {
        button.addEventListener("click", () => {
          category = button.dataset.categoryFilter;
          sync();
        });
      }
      for (const button of document.querySelectorAll("[data-source-filter]")) {
        button.addEventListener("click", () => {
          source = button.dataset.sourceFilter;
          sync();
        });
      }
    </script>
  </body>
</html>
`;
}

function renderNoteDetail(catalog, note) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(note.title)} &middot; Memoire Notes</title>
    <style>${marketplaceCss()}</style>
  </head>
  <body>
    <main class="detail-page" data-note-marketplace-detail="${escapeHtml(note.name)}">
      <a class="back-link" href="${escapeHtml(pageBasePath)}/">Back to marketplace</a>
      <section class="detail-card">
        <p>${escapeHtml(note.category)} &middot; ${escapeHtml(note.version)}</p>
        <h1>${escapeHtml(note.title)}</h1>
        <span>${escapeHtml(note.name)}</span>
        <p>${escapeHtml(note.description)}</p>
        <div class="tag-row">${note.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="command-row">
          <code>memi notes install ${escapeHtml(note.name)}</code>
          <a href="${escapeHtml(note.archive.url)}">Download archive</a>
          <a href="${escapeHtml(note.contributionUrl ?? "")}">Improve this Note</a>
        </div>
        <dl>
          <div><dt>Freshness</dt><dd>${escapeHtml(formatDate(note.lastResearchedAt ?? catalog.generatedAt))} &middot; ${escapeHtml(String(note.freshnessDays))} days</dd></div>
          <div><dt>Archive</dt><dd>${escapeHtml(note.archive.sha256.slice(0, 16))} &middot; ${escapeHtml(String(note.archive.size))} bytes</dd></div>
        </dl>
        <h2>Sources</h2>
        <ul>${note.sourceUrls.map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join("")}</ul>
      </section>
    </main>
  </body>
</html>
`;
}

function marketplaceCss() {
  return `
    :root { color-scheme: light dark; --bg: #181717; --panel: #222020; --line: #3a3434; --ink: #ffffff; --muted: #b8adad; --accent: #f08cab; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color: inherit; text-decoration: none; }
    main[data-notes-marketplace] { min-height: 100vh; display: grid; grid-template-columns: 260px minmax(0, 1fr); }
    .filter-rail { border-right: 1px solid var(--line); padding: 20px; background: #171616; display: grid; align-content: start; gap: 16px; position: sticky; top: 0; height: 100vh; }
    .brand { font-weight: 650; color: var(--accent); }
    label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; }
    input { width: 100%; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); padding: 10px; }
    nav { display: grid; gap: 6px; }
    button { border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); padding: 8px 10px; text-align: left; cursor: pointer; }
    .results { padding: 28px; display: grid; gap: 18px; align-content: start; }
    header p, header span, .note-row span, .note-row p, .detail-card > p, .detail-card > span, dd, dt { color: var(--muted); }
    h1, h2, p { margin: 0; }
    h1 { font-size: 28px; letter-spacing: 0; }
    .note-list { display: grid; gap: 8px; }
    .note-row { border: 1px solid var(--line); border-radius: 7px; background: var(--panel); padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }
    .note-row a { display: grid; gap: 5px; min-width: 0; }
    code { border: 1px solid var(--line); border-radius: 5px; background: #111111; color: var(--accent); padding: 6px 8px; white-space: nowrap; }
    .detail-page { min-height: 100vh; padding: 28px; display: grid; align-content: start; gap: 16px; }
    .back-link { color: var(--accent); }
    .detail-card { max-width: 860px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 24px; display: grid; gap: 14px; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag-row span { border: 1px solid var(--line); border-radius: 999px; padding: 5px 8px; color: var(--muted); }
    .command-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .command-row a { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; color: var(--accent); }
    dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
    dl div { border: 1px solid var(--line); border-radius: 6px; padding: 10px; }
    @media (max-width: 760px) { main[data-notes-marketplace] { grid-template-columns: 1fr; } .filter-rail { position: static; height: auto; } .note-row, dl { grid-template-columns: 1fr; } }
  `;
}

function formatDate(value) {
  return String(value ?? "").slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith("--notes-root=")) parsed.notesRoot = value.slice("--notes-root=".length);
    else if (value === "--notes-root") parsed.notesRoot = values[index += 1];
    else if (value.startsWith("--out-root=")) parsed.outRoot = value.slice("--out-root=".length);
    else if (value === "--out-root") parsed.outRoot = values[index += 1];
    else if (value.startsWith("--base-url=")) parsed.baseUrl = value.slice("--base-url=".length);
    else if (value === "--base-url") parsed.baseUrl = values[index += 1];
    else if (value.startsWith("--source-kind=")) parsed.sourceKind = value.slice("--source-kind=".length);
    else if (value === "--source-kind") parsed.sourceKind = values[index += 1];
    else if (value.startsWith("--source-repo=")) parsed.sourceRepo = value.slice("--source-repo=".length);
    else if (value === "--source-repo") parsed.sourceRepo = values[index += 1];
    else if (value.startsWith("--contribution-base-url=")) parsed.contributionBaseUrl = value.slice("--contribution-base-url=".length);
    else if (value === "--contribution-base-url") parsed.contributionBaseUrl = values[index += 1];
    else if (value.startsWith("--review-status=")) parsed.reviewStatus = value.slice("--review-status=".length);
    else if (value === "--review-status") parsed.reviewStatus = values[index += 1];
    else if (value.startsWith("--page-base-path=")) parsed.pageBasePath = value.slice("--page-base-path=".length);
    else if (value === "--page-base-path") parsed.pageBasePath = values[index += 1];
  }
  return parsed;
}
