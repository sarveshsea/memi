export type StudioLocalIndexTable =
  | "sessions"
  | "events"
  | "references"
  | "outputs"
  | "tool_runs"
  | "citations"
  | "research_sources"
  | "research_highlights"
  | "research_tags"
  | "marketplace_installs";

export const STUDIO_LOCAL_INDEX_TABLES: StudioLocalIndexTable[] = [
  "sessions",
  "events",
  "references",
  "outputs",
  "tool_runs",
  "citations",
  "research_sources",
  "research_highlights",
  "research_tags",
  "marketplace_installs",
];

export const STUDIO_LOCAL_INDEX_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  harness TEXT NOT NULL,
  action TEXT NOT NULL,
  chat_mode TEXT NOT NULL,
  permission_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  cwd TEXT NOT NULL,
  prompt TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS references (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_path TEXT,
  package_name TEXT,
  package_version TEXT,
  url TEXT,
  event_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_path TEXT,
  artifact_path TEXT,
  url TEXT,
  event_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  event_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT,
  source_path TEXT,
  event_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  source_path TEXT,
  captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_highlights (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  text TEXT NOT NULL,
  sentiment TEXT,
  tags_json TEXT NOT NULL,
  event_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_tags (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  highlight_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS marketplace_installs (
  id TEXT PRIMARY KEY,
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  manifest_url TEXT,
  checksum TEXT,
  installed_at TEXT NOT NULL,
  logo_path TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS studio_fts USING fts5(
  title,
  body,
  kind,
  source_path,
  content='',
  tokenize='porter unicode61'
);
`;
