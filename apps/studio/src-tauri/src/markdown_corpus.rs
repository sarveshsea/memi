use reqwest::blocking::Client;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io,
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const ALLOWED_EXTENSIONS: &[&str] = &["md", "mdx", "markdown", "mdoc"];
const MAX_REMOTE_FILE_BYTES: u64 = 2_000_000;
const MAX_REMOTE_FILES_PER_REPO: usize = 220;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CorpusRepoPolicy {
    Download,
    MetadataOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorpusRepo {
    pub owner: String,
    pub repo: String,
    pub license: String,
    pub branch: String,
    pub policy: CorpusRepoPolicy,
    pub local_source: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorpusStatus {
    pub status: String,
    pub repos: Vec<CorpusRepoStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorpusRepoStatus {
    pub repo: String,
    pub license: String,
    pub commit: String,
    pub files: usize,
    pub bytes: u64,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub fetched_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorpusManifest {
    pub schema_version: u8,
    pub repo_url: String,
    pub repo: String,
    pub license: String,
    pub commit: String,
    pub branch: String,
    pub fetched_at: String,
    pub files: Vec<CorpusFileManifest>,
    pub skipped: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorpusFileManifest {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownAnalysisReport {
    pub status: String,
    pub candidates: Vec<MarkdownDiagramCandidate>,
    pub summary: MarkdownSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownDiagramCandidate {
    pub title: String,
    pub source_path: String,
    pub kind: String,
    pub confidence: f32,
    pub diagnostics: Vec<String>,
    pub clean_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownSummary {
    pub headings: usize,
    pub lists: usize,
    pub code_fences: usize,
    pub mermaid_blocks: usize,
    pub links: usize,
    pub tables: usize,
    pub frontmatter: bool,
}

pub fn default_corpus_catalog() -> Vec<CorpusRepo> {
    [
        ("microsoft", "markitdown", "MIT", "main"),
        ("mermaid-js", "mermaid", "MIT", "develop"),
        ("adam-p", "markdown-here", "MIT", "master"),
        ("usememos", "memos", "MIT", "main"),
        ("docling-project", "docling", "MIT", "main"),
        ("marktext", "marktext", "MIT", "develop"),
        ("prettier", "prettier", "MIT", "main"),
        ("jekyll", "jekyll", "MIT", "master"),
        ("markdown-it", "markdown-it", "MIT", "master"),
        ("mdx-js", "mdx", "MIT", "main"),
        ("commonmark", "commonmark-spec", "BSD-3-Clause", "master"),
    ]
    .into_iter()
    .map(|(owner, repo, license, branch)| CorpusRepo {
        owner: owner.to_string(),
        repo: repo.to_string(),
        license: license.to_string(),
        branch: branch.to_string(),
        policy: CorpusRepoPolicy::Download,
        local_source: None,
    })
    .collect()
}

pub fn is_allowed_markdown_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    if normalized.is_empty() || normalized.starts_with('/') || normalized.contains('\0') {
        return false;
    }
    let path = Path::new(&normalized);
    let mut saw_normal = false;
    for component in path.components() {
        match component {
            Component::Normal(part) => {
                let Some(segment) = part.to_str() else {
                    return false;
                };
                if segment.is_empty() || segment.starts_with('.') {
                    return false;
                }
                saw_normal = true;
            }
            _ => return false,
        }
    }
    if !saw_normal {
        return false;
    }
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ALLOWED_EXTENSIONS.iter().any(|allowed| ext.eq_ignore_ascii_case(allowed)))
        .unwrap_or(false)
}

pub fn setup_markdown_corpus_at(project_root: &Path, repos: &[CorpusRepo]) -> Result<CorpusStatus, String> {
    let cancel = AtomicBool::new(false);
    setup_markdown_corpus_at_with_cancel(project_root, repos, &cancel)
}

pub fn setup_markdown_corpus_at_with_cancel(
    project_root: &Path,
    repos: &[CorpusRepo],
    cancel: &AtomicBool,
) -> Result<CorpusStatus, String> {
    let root = project_root.join(".memoire").join("markdown-corpus");
    fs::create_dir_all(&root).map_err(|err| err.to_string())?;
    let mut statuses = Vec::new();
    for repo in repos {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        statuses.push(setup_repo(&root, repo, cancel)?);
    }
    Ok(CorpusStatus {
        status: aggregate_status(&statuses),
        repos: statuses,
    })
}

pub fn get_markdown_corpus_status_at(project_root: &Path) -> Result<CorpusStatus, String> {
    let root = project_root.join(".memoire").join("markdown-corpus");
    if !root.exists() {
        return Ok(CorpusStatus {
            status: "failed".to_string(),
            repos: Vec::new(),
        });
    }

    let mut statuses = Vec::new();
    for owner in fs::read_dir(&root).map_err(|err| err.to_string())? {
        let owner = owner.map_err(|err| err.to_string())?;
        if !owner.file_type().map_err(|err| err.to_string())?.is_dir() {
            continue;
        }
        for repo in fs::read_dir(owner.path()).map_err(|err| err.to_string())? {
            let repo = repo.map_err(|err| err.to_string())?;
            if !repo.file_type().map_err(|err| err.to_string())?.is_dir() {
                continue;
            }
            let manifest_path = repo.path().join("manifest.json");
            let Ok(raw) = fs::read_to_string(manifest_path) else {
                continue;
            };
            let manifest: CorpusManifest = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
            statuses.push(status_from_manifest(&manifest));
        }
    }
    statuses.sort_by(|a, b| a.repo.cmp(&b.repo));
    Ok(CorpusStatus {
        status: aggregate_status(&statuses),
        repos: statuses,
    })
}

pub fn analyze_markdown_file(path: &Path) -> Result<MarkdownAnalysisReport, String> {
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    Ok(analyze_markdown_text(&path.to_string_lossy(), &raw))
}

pub fn analyze_markdown_text(source_path: &str, text: &str) -> MarkdownAnalysisReport {
    let frontmatter = parse_frontmatter_title(text);
    let title = frontmatter
        .clone()
        .or_else(|| first_heading(text))
        .unwrap_or_else(|| fallback_title(source_path));
    let summary = summarize_markdown(text);
    let mut candidates = Vec::new();

    for (index, block) in mermaid_blocks(text).into_iter().enumerate() {
        let kind = mermaid_kind(&block);
        candidates.push(MarkdownDiagramCandidate {
            title: if index == 0 { title.clone() } else { format!("{title} {}", index + 1) },
            source_path: source_path.to_string(),
            kind,
            confidence: 0.92,
            diagnostics: Vec::new(),
            clean_source: block,
        });
    }

    let bullets = bullet_items(text);
    if bullets.len() >= 2 {
        candidates.push(MarkdownDiagramCandidate {
            title: title.clone(),
            source_path: source_path.to_string(),
            kind: "checklist-to-flow".to_string(),
            confidence: if summary.tables > 0 { 0.78 } else { 0.72 },
            diagnostics: Vec::new(),
            clean_source: bullets_to_flowchart(&bullets),
        });
    }

    if candidates.is_empty() {
        candidates.push(MarkdownDiagramCandidate {
            title,
            source_path: source_path.to_string(),
            kind: "markdown-summary".to_string(),
            confidence: 0.35,
            diagnostics: vec!["No Mermaid fence or flow-like list found; emitted a summary candidate.".to_string()],
            clean_source: text.lines().take(60).collect::<Vec<_>>().join("\n"),
        });
    }

    MarkdownAnalysisReport {
        status: "ready".to_string(),
        candidates,
        summary,
    }
}

fn setup_repo(root: &Path, repo: &CorpusRepo, cancel: &AtomicBool) -> Result<CorpusRepoStatus, String> {
    let destination = root.join(&repo.owner).join(&repo.repo);
    let previous = read_manifest(&destination.join("manifest.json"));
    fs::create_dir_all(&destination).map_err(|err| err.to_string())?;
    let mut manifest = CorpusManifest {
        schema_version: 1,
        repo_url: format!("https://github.com/{}/{}", repo.owner, repo.repo),
        repo: format!("{}/{}", repo.owner, repo.repo),
        license: repo.license.clone(),
        commit: "metadata-only".to_string(),
        branch: repo.branch.clone(),
        fetched_at: unix_timestamp_string(),
        files: Vec::new(),
        skipped: Vec::new(),
        errors: Vec::new(),
    };

    let should_download = repo.policy == CorpusRepoPolicy::Download && !is_blocked_license(&repo.license);
    if !should_download {
        manifest.skipped.push("content download disabled by corpus license policy".to_string());
        write_manifest(&destination, &manifest)?;
        return Ok(status_from_manifest(&manifest));
    }

    if let Some(local_source) = &repo.local_source {
        copy_local_source(local_source, &destination, &mut manifest, cancel)?;
    } else if let Err(error) = fetch_remote_repo(repo, &destination, &mut manifest, previous.as_ref(), cancel) {
        manifest.errors.push(error);
    }

    write_manifest(&destination, &manifest)?;
    Ok(status_from_manifest(&manifest))
}

fn copy_local_source(
    source: &Path,
    destination: &Path,
    manifest: &mut CorpusManifest,
    cancel: &AtomicBool,
) -> Result<(), String> {
    if !source.is_dir() {
        manifest.errors.push(format!("Local corpus source is not a directory: {}", source.display()));
        return Ok(());
    }
    let mut files = Vec::new();
    collect_files(source, &mut files).map_err(|err| err.to_string())?;
    files.sort();
    for path in files {
        if cancel.load(Ordering::Relaxed) {
            manifest.errors.push("cancelled".to_string());
            break;
        }
        let relative = path.strip_prefix(source).map_err(|err| err.to_string())?;
        let relative_text = slash_path(relative);
        if !is_allowed_markdown_path(&relative_text) {
            manifest.skipped.push(relative_text);
            continue;
        }
        let bytes = fs::read(&path).map_err(|err| err.to_string())?;
        write_corpus_file(destination, &relative_text, &bytes, manifest)?;
    }
    Ok(())
}

fn fetch_remote_repo(
    repo: &CorpusRepo,
    destination: &Path,
    manifest: &mut CorpusManifest,
    previous: Option<&CorpusManifest>,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(45))
        .user_agent("memoire-studio-markdown-corpus/0.15")
        .build()
        .map_err(|err| err.to_string())?;
    let commit_url = format!(
        "https://api.github.com/repos/{}/{}/commits/{}",
        repo.owner, repo.repo, repo.branch
    );
    let commit: Value = get_json_with_retry(&client, &commit_url)?;
    if let Some(sha) = commit.get("sha").and_then(Value::as_str) {
        manifest.commit = sha.to_string();
    }

    let tree_url = format!(
        "https://api.github.com/repos/{}/{}/git/trees/{}?recursive=1",
        repo.owner, repo.repo, repo.branch
    );
    let tree: Value = get_json_with_retry(&client, &tree_url)?;
    let entries = tree.get("tree").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut markdown_paths = entries
        .into_iter()
        .filter_map(|entry| {
            if entry.get("type").and_then(Value::as_str) != Some("blob") {
                return None;
            }
            let path = entry.get("path").and_then(Value::as_str)?;
            let size = entry.get("size").and_then(Value::as_u64).unwrap_or(0);
            Some((path.to_string(), size))
        })
        .collect::<Vec<_>>();
    markdown_paths.sort_by(|a, b| a.0.cmp(&b.0));

    for (path, size) in markdown_paths {
        if cancel.load(Ordering::Relaxed) {
            manifest.errors.push("cancelled".to_string());
            break;
        }
        if !is_allowed_markdown_path(&path) {
            manifest.skipped.push(path);
            continue;
        }
        if manifest.files.len() >= MAX_REMOTE_FILES_PER_REPO {
            manifest.skipped.push(format!("{path} (remote file limit reached)"));
            continue;
        }
        if size > MAX_REMOTE_FILE_BYTES {
            manifest.skipped.push(format!("{path} (larger than {MAX_REMOTE_FILE_BYTES} bytes)"));
            continue;
        }
        if reuse_existing_file(destination, &path, previous, manifest) {
            continue;
        }
        let raw_url = format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}",
            repo.owner,
            repo.repo,
            manifest.commit,
            path
        );
        match get_bytes_with_retry(&client, &raw_url) {
            Ok(bytes) => {
                write_corpus_file(destination, &path, &bytes, manifest)?;
            }
            Err(error) => manifest.skipped.push(format!("{path} ({error})")),
        }
    }

    Ok(())
}

fn get_json_with_retry<T: DeserializeOwned>(client: &Client, url: &str) -> Result<T, String> {
    let mut last_error = String::new();
    for attempt in 1..=3 {
        match client.get(url).send().and_then(|response| response.error_for_status()) {
            Ok(response) => return response.json().map_err(|err| err.to_string()),
            Err(error) => {
                last_error = error.to_string();
                if attempt < 3 {
                    std::thread::sleep(Duration::from_millis(200 * attempt));
                }
            }
        }
    }
    Err(last_error)
}

fn get_bytes_with_retry(client: &Client, url: &str) -> Result<Vec<u8>, String> {
    let mut last_error = String::new();
    for attempt in 1..=3 {
        match client.get(url).send().and_then(|response| response.error_for_status()) {
            Ok(response) => return response.bytes().map(|bytes| bytes.to_vec()).map_err(|err| err.to_string()),
            Err(error) => {
                last_error = error.to_string();
                if attempt < 3 {
                    std::thread::sleep(Duration::from_millis(200 * attempt));
                }
            }
        }
    }
    Err(last_error)
}

fn collect_files(root: &Path, files: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            collect_files(&path, files)?;
        } else if entry.file_type()?.is_file() {
            files.push(path);
        }
    }
    Ok(())
}

fn write_corpus_file(destination: &Path, relative: &str, bytes: &[u8], manifest: &mut CorpusManifest) -> Result<(), String> {
    let file_destination = destination.join(relative);
    if let Some(parent) = file_destination.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(&file_destination, bytes).map_err(|err| err.to_string())?;
    manifest.files.push(CorpusFileManifest {
        path: relative.to_string(),
        sha256: sha256_hex(bytes),
        bytes: bytes.len() as u64,
    });
    Ok(())
}

fn reuse_existing_file(
    destination: &Path,
    relative: &str,
    previous: Option<&CorpusManifest>,
    manifest: &mut CorpusManifest,
) -> bool {
    let Some(previous) = previous else {
        return false;
    };
    let Some(prior) = previous.files.iter().find(|file| file.path == relative) else {
        return false;
    };
    let file_path = destination.join(relative);
    let Ok(bytes) = fs::read(file_path) else {
        return false;
    };
    if sha256_hex(&bytes) != prior.sha256 {
        return false;
    }
    manifest.files.push(prior.clone());
    true
}

fn read_manifest(path: &Path) -> Option<CorpusManifest> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_manifest(destination: &Path, manifest: &CorpusManifest) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(manifest).map_err(|err| err.to_string())?;
    fs::write(destination.join("manifest.json"), format!("{raw}\n")).map_err(|err| err.to_string())
}

fn status_from_manifest(manifest: &CorpusManifest) -> CorpusRepoStatus {
    CorpusRepoStatus {
        repo: manifest.repo.clone(),
        license: manifest.license.clone(),
        commit: manifest.commit.clone(),
        files: manifest.files.len(),
        bytes: manifest.files.iter().map(|file| file.bytes).sum(),
        skipped: manifest.skipped.len(),
        errors: manifest.errors.clone(),
        fetched_at: manifest.fetched_at.clone(),
    }
}

fn aggregate_status(statuses: &[CorpusRepoStatus]) -> String {
    if statuses.is_empty() {
        return "failed".to_string();
    }
    let failed = statuses.iter().filter(|status| !status.errors.is_empty()).count();
    if failed == 0 {
        "ready".to_string()
    } else if failed == statuses.len() {
        "failed".to_string()
    } else {
        "partial".to_string()
    }
}

fn is_blocked_license(license: &str) -> bool {
    let normalized = license.to_ascii_lowercase();
    normalized.contains("agpl") || normalized == "unknown" || normalized == "unclear"
}

fn slash_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => part.to_str().map(ToString::to_string),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn unix_timestamp_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn parse_frontmatter_title(text: &str) -> Option<String> {
    if !text.starts_with("---\n") {
        return None;
    }
    let mut lines = text.lines();
    let _ = lines.next();
    for line in lines {
        if line.trim() == "---" {
            break;
        }
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("title:") {
            return Some(title.trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

fn first_heading(text: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') {
            Some(trimmed.trim_start_matches('#').trim().to_string()).filter(|value| !value.is_empty())
        } else {
            None
        }
    })
}

fn fallback_title(source_path: &str) -> String {
    Path::new(source_path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(|stem| stem.replace(['-', '_'], " "))
        .unwrap_or_else(|| "Markdown diagram".to_string())
}

fn summarize_markdown(text: &str) -> MarkdownSummary {
    let mut summary = MarkdownSummary {
        headings: 0,
        lists: 0,
        code_fences: 0,
        mermaid_blocks: 0,
        links: 0,
        tables: 0,
        frontmatter: text.starts_with("---\n"),
    };
    let mut in_fence = false;
    let mut table_lines = 0;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            summary.code_fences += 1;
            if trimmed.to_ascii_lowercase().starts_with("```mermaid") || trimmed.to_ascii_lowercase().starts_with("~~~mermaid") {
                summary.mermaid_blocks += 1;
            }
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if trimmed.starts_with('#') {
            summary.headings += 1;
        }
        if is_bullet(trimmed) {
            summary.lists += 1;
        }
        summary.links += trimmed.matches("](").count();
        if trimmed.starts_with('|') && trimmed.ends_with('|') {
            table_lines += 1;
        } else if table_lines >= 2 {
            summary.tables += 1;
            table_lines = 0;
        } else {
            table_lines = 0;
        }
    }
    if table_lines >= 2 {
        summary.tables += 1;
    }
    summary.code_fences /= 2;
    summary
}

fn mermaid_blocks(text: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut active: Option<Vec<String>> = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if active.is_none()
            && (trimmed.to_ascii_lowercase().starts_with("```mermaid")
                || trimmed.to_ascii_lowercase().starts_with("~~~mermaid"))
        {
            active = Some(Vec::new());
            continue;
        }
        if let Some(lines) = active.as_mut() {
            if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
                let block = lines.join("\n").trim().to_string();
                if !block.is_empty() {
                    blocks.push(block);
                }
                active = None;
            } else {
                lines.push(line.to_string());
            }
        }
    }
    blocks
}

fn mermaid_kind(block: &str) -> String {
    let first = block.lines().find(|line| !line.trim().is_empty()).unwrap_or("").trim();
    let lower = first.to_ascii_lowercase();
    if lower.starts_with("sequencediagram") {
        "sequence"
    } else if lower.starts_with("journey") {
        "journey"
    } else if lower.starts_with("statediagram") {
        "state"
    } else if lower.starts_with("mindmap") {
        "mindmap"
    } else if lower.starts_with("timeline") {
        "timeline"
    } else {
        "flowchart"
    }
    .to_string()
}

fn bullet_items(text: &str) -> Vec<String> {
    let mut items = Vec::new();
    let mut in_fence = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if let Some(item) = bullet_text(trimmed) {
            items.push(item);
        }
    }
    items
}

fn is_bullet(trimmed: &str) -> bool {
    bullet_text(trimmed).is_some()
}

fn bullet_text(trimmed: &str) -> Option<String> {
    if let Some(rest) = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")) {
        return Some(rest.trim().to_string()).filter(|value| !value.is_empty());
    }
    let Some((number, rest)) = trimmed.split_once(". ") else {
        return None;
    };
    if number.chars().all(|ch| ch.is_ascii_digit()) {
        Some(rest.trim().to_string()).filter(|value| !value.is_empty())
    } else {
        None
    }
}

fn bullets_to_flowchart(items: &[String]) -> String {
    let mut lines = vec!["flowchart TD".to_string()];
    for (index, item) in items.iter().enumerate() {
        lines.push(format!("  N{}[\"{}\"]", index + 1, escape_mermaid_label(item)));
        if index > 0 {
            lines.push(format!("  N{} --> N{}", index, index + 1));
        }
    }
    lines.join("\n")
}

fn escape_mermaid_label(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"").replace('[', "(").replace(']', ")")
}
