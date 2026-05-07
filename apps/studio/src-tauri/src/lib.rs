mod studio;

use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;

const STUDIO_RUNTIME_PORT: u16 = 8765;
const STUDIO_RUNTIME_BIN: &str = "memi-studio-runtime";
const STUDIO_RUNTIME_RESOURCE_DIR: &str = "resources/memoire-runtime";

#[derive(Default)]
struct AppState {
    processes: Mutex<HashMap<String, Arc<Mutex<std::process::Child>>>>,
    runtime: Mutex<RuntimeProcessState>,
}

#[derive(Default)]
struct RuntimeProcessState {
    child: Option<Arc<Mutex<std::process::Child>>>,
    status: Option<studio::StudioRuntimeStatus>,
}

#[derive(Debug, Clone, Serialize)]
struct DesktopStudioEvent {
    id: String,
    #[serde(rename = "sessionId")]
    session_id: String,
    #[serde(rename = "type")]
    event_type: String,
    timestamp: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

#[tauri::command]
fn studio_status(app: AppHandle, state: State<AppState>) -> Result<studio::StudioStatus, String> {
    let workspace_root = workspace_root(&app)?;
    let mut status = studio::studio_status(&workspace_root);
    status.runtime = Some(current_runtime_status(&state, &workspace_root));
    Ok(status)
}

#[tauri::command]
fn studio_runtime_status(
    app: AppHandle,
    state: State<AppState>,
) -> Result<studio::StudioRuntimeStatus, String> {
    let workspace_root = workspace_root(&app)?;
    Ok(current_runtime_status(&state, &workspace_root))
}

#[tauri::command]
fn load_app_config(app: AppHandle) -> Result<studio::DesktopAppConfig, String> {
    load_or_create_desktop_app_config(&app)
}

#[tauri::command]
fn save_app_config(
    app: AppHandle,
    state: State<AppState>,
    config: studio::DesktopAppConfig,
) -> Result<studio::DesktopAppConfig, String> {
    let previous = load_or_create_desktop_app_config(&app)?;
    let next = normalized_app_config(config)?;
    studio::save_desktop_app_config(&app_config_dir(&app)?, &next)?;
    if previous.workspace_root != next.workspace_root {
        restart_studio_runtime(&app, &state, Path::new(&next.workspace_root));
    }
    Ok(next)
}

#[tauri::command]
fn select_workspace(
    app: AppHandle,
    state: State<AppState>,
) -> Result<studio::DesktopAppConfig, String> {
    let current = load_or_create_desktop_app_config(&app)?;
    let picked = app
        .dialog()
        .file()
        .set_directory(&current.workspace_root)
        .blocking_pick_folder();
    let Some(picked) = picked else {
        return Ok(current);
    };
    let workspace_root = picked
        .into_path()
        .map_err(|_| "Selected workspace is not a filesystem path".to_string())?;
    if !workspace_root.is_dir() {
        return Err(format!(
            "Selected workspace is not a directory: {}",
            workspace_root.display()
        ));
    }
    let next = studio::DesktopAppConfig {
        schema_version: 1,
        workspace_root: workspace_root.to_string_lossy().to_string(),
    };
    studio::save_desktop_app_config(&app_config_dir(&app)?, &next)?;
    restart_studio_runtime(&app, &state, &workspace_root);
    Ok(next)
}

#[tauri::command]
fn studio_config(app: AppHandle) -> Result<studio::StudioConfigSummary, String> {
    Ok(studio::studio_config(&workspace_root(&app)?))
}

#[tauri::command]
fn studio_compatibility(app: AppHandle) -> Result<Value, String> {
    Ok(studio::studio_compatibility(&workspace_root(&app)?))
}

#[tauri::command]
fn computer_status(app: AppHandle) -> Result<Value, String> {
    let config = studio::studio_config(&workspace_root(&app)?);
    Ok(studio::computer_status(&config))
}

#[tauri::command]
fn computer_open(app: AppHandle, request: Value) -> Result<Value, String> {
    let config = studio::studio_config(&workspace_root(&app)?);
    Ok(studio::computer_open(request, &config))
}

#[tauri::command]
fn computer_action(app: AppHandle, request: Value) -> Result<Value, String> {
    let config = studio::studio_config(&workspace_root(&app)?);
    Ok(studio::computer_action(request, &config, false))
}

#[tauri::command]
fn list_harnesses() -> Result<Vec<studio::HarnessStatus>, String> {
    Ok(studio::list_harnesses())
}

#[tauri::command]
fn agent_install(
    target: String,
    project: String,
    dry_run: Option<bool>,
    force: Option<bool>,
) -> Result<Value, String> {
    let command = studio::build_agent_install_command(
        &target,
        &project,
        dry_run.unwrap_or(false),
        force.unwrap_or(false),
    )?;
    let output = Command::new(&command.command)
        .args(&command.args)
        .current_dir(PathBuf::from(&project))
        .output()
        .map_err(|err| format!("Failed to start {}: {err}", command.command))?;

    if !output.status.success() {
        let stderr = studio::redact_secrets(&String::from_utf8_lossy(&output.stderr));
        let stdout = studio::redact_secrets(&String::from_utf8_lossy(&output.stdout));
        let message = if !stderr.trim().is_empty() {
            stderr
        } else {
            stdout
        };
        return Err(message.trim().to_string());
    }

    serde_json::from_slice::<Value>(&output.stdout)
        .map_err(|err| format!("Failed to parse memi agent install JSON: {err}"))
}

#[tauri::command]
fn start_session(
    app: AppHandle,
    state: State<AppState>,
    harness: String,
    cwd: String,
    prompt: String,
    action: Option<String>,
    mode: Option<String>,
    chat_mode: Option<String>,
    permission_mode: Option<String>,
) -> Result<studio::SessionSummary, String> {
    let action_id = action.unwrap_or_else(|| {
        if harness == "memoire" {
            "compose"
        } else {
            "raw"
        }
        .to_string()
    });
    let mode_id = mode.unwrap_or_else(|| "delegate".to_string());
    let chat_mode_id =
        chat_mode.unwrap_or_else(|| default_chat_mode(&harness, &action_id, &prompt));
    let permission_mode_id = permission_mode.unwrap_or_else(|| "guarded".to_string());
    let command = studio::build_command_for_action_with_context(
        &harness,
        &prompt,
        Some(&action_id),
        Some(&chat_mode_id),
        Some(&permission_mode_id),
    )?;
    let session_id = format!("desktop-{}", studio::unix_millis());
    let started_at = studio::unix_millis().to_string();
    let cwd_path = PathBuf::from(&cwd);
    let mut child = Command::new(&command.command)
        .args(&command.args)
        .current_dir(&cwd_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Failed to start {}: {err}", command.command))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let child = Arc::new(Mutex::new(child));
    state
        .processes
        .lock()
        .map_err(|_| "Process registry lock failed".to_string())?
        .insert(session_id.clone(), child.clone());

    emit_event_with_data(
        &app,
        &session_id,
        "chat_message",
        prompt.trim(),
        json!({
            "role": "user",
            "chatMode": chat_mode_id.clone(),
            "permissionMode": permission_mode_id.clone(),
            "harness": harness.clone(),
            "action": action_id.clone()
        }),
    );
    emit_event_with_data(
        &app,
        &session_id,
        "session_started",
        &format!("Started {harness}"),
        json!({
            "harness": harness.clone(),
            "action": action_id.clone(),
            "mode": mode_id.clone(),
            "chatMode": chat_mode_id.clone(),
            "permissionMode": permission_mode_id.clone()
        }),
    );
    emit_event_with_data(
        &app,
        &session_id,
        "reference_trace",
        "Mémoire package and source references loaded",
        json!({
            "references": [
                {
                    "id": "package:@sarveshsea/memoire",
                    "kind": "package",
                    "label": format!("@sarveshsea/memoire@{}", env!("CARGO_PKG_VERSION")),
                    "summary": "The npm package that supplied this Studio harness, prompt envelope, and local runtime.",
                    "packageName": "@sarveshsea/memoire",
                    "packageVersion": env!("CARGO_PKG_VERSION"),
                    "url": "https://www.npmjs.com/package/@sarveshsea/memoire",
                    "eventIds": []
                },
                {
                    "id": "figma:bridge",
                    "kind": "figma",
                    "label": "Figma bridge",
                    "summary": "Use Details or the web runtime for live Figma bridge status.",
                    "eventIds": []
                }
            ],
            "harness": harness.clone(),
            "action": action_id.clone(),
            "chatMode": chat_mode_id.clone(),
            "permissionMode": permission_mode_id.clone()
        }),
    );
    if let Some(stdout) = stdout {
        spawn_reader(app.clone(), session_id.clone(), "stdout", stdout);
    }
    if let Some(stderr) = stderr {
        spawn_reader(app.clone(), session_id.clone(), "stderr", stderr);
    }
    spawn_waiter(app.clone(), session_id.clone(), child);

    Ok(studio::SessionSummary {
        id: session_id,
        harness,
        action: action_id,
        mode: mode_id,
        chat_mode: chat_mode_id,
        permission_mode: permission_mode_id,
        cwd,
        prompt,
        status: "running".to_string(),
        started_at,
        completed_at: None,
        exit_code: None,
        event_count: 3,
    })
}

#[tauri::command]
fn cancel_session(app: AppHandle, state: State<AppState>, id: String) -> Result<bool, String> {
    let child = state
        .processes
        .lock()
        .map_err(|_| "Process registry lock failed".to_string())?
        .remove(&id);
    let Some(child) = child else {
        return Ok(false);
    };
    let mut child = child
        .lock()
        .map_err(|_| "Child process lock failed".to_string())?;
    let _ = child.kill();
    emit_event(&app, &id, "session_done", "Cancellation requested");
    Ok(true)
}

fn default_chat_mode(harness: &str, action: &str, prompt: &str) -> String {
    let normalized = format!("{harness} {action} {prompt}").to_lowercase();
    if [
        "research",
        "netnograph",
        "interview",
        "survey",
        "dovetail",
        "theme",
        "insight",
    ]
    .iter()
    .any(|token| normalized.contains(token))
    {
        "research".to_string()
    } else if ["audit", "review", "check", "qa", "test"]
        .iter()
        .any(|token| normalized.contains(token))
    {
        "review".to_string()
    } else if ["terminal", "shell", "command", "log"]
        .iter()
        .any(|token| normalized.contains(token))
        || harness == "shell"
    {
        "terminal".to_string()
    } else if ["build", "fix", "implement", "patch", "generate code"]
        .iter()
        .any(|token| normalized.contains(token))
    {
        "build".to_string()
    } else {
        "ideate".to_string()
    }
}

#[tauri::command]
fn read_workspace(path: String) -> Result<Vec<studio::WorkspaceEntry>, String> {
    studio::read_workspace(&PathBuf::from(path))
}

#[tauri::command]
fn open_artifact(path: String) -> Result<String, String> {
    Ok(path)
}

#[tauri::command]
fn save_config(config: Value) -> Result<bool, String> {
    let pretty = serde_json::to_string_pretty(&config).map_err(|err| err.to_string())?;
    let path = studio::current_dir()
        .join(".memoire")
        .join("studio")
        .join("config.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(path, format!("{pretty}\n")).map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
fn capture_attachment(app: AppHandle, payload: Value) -> Result<Value, String> {
    let root = workspace_root(&app)?;
    let session_id = payload.get("sessionId").and_then(Value::as_str).unwrap_or("draft");
    let id = format!("attachment-{}", studio::unix_millis());
    let name = slug(payload.get("name").and_then(Value::as_str).unwrap_or("attachment"));
    let mime_type = payload.get("mimeType").and_then(Value::as_str).unwrap_or("application/octet-stream");
    let kind = payload.get("kind").and_then(Value::as_str).unwrap_or("file");
    let source = payload.get("source").and_then(Value::as_str).unwrap_or("file");
    let dir = root.join(".memoire").join("studio").join("attachments").join(slug(session_id));
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let path = dir.join(format!("{id}-{name}"));
    let bytes = payload
        .get("text")
        .and_then(Value::as_str)
        .or_else(|| payload.get("dataUrl").and_then(Value::as_str))
        .unwrap_or("")
        .as_bytes()
        .to_vec();
    fs::write(&path, &bytes).map_err(|err| err.to_string())?;
    let attachment = json!({
        "id": id,
        "kind": kind,
        "name": name,
        "mimeType": mime_type,
        "size": bytes.len(),
        "source": source,
        "path": path.to_string_lossy().to_string(),
        "text": if kind == "text" { payload.get("text").cloned().unwrap_or(Value::Null) } else { Value::Null },
        "previewUrl": Value::Null,
        "sessionId": if session_id == "draft" { Value::Null } else { Value::String(session_id.to_string()) },
        "createdAt": studio::unix_millis().to_string()
    });
    fs::write(dir.join(format!("{id}.json")), serde_json::to_string_pretty(&attachment).map_err(|err| err.to_string())?).map_err(|err| err.to_string())?;
    Ok(attachment)
}

#[tauri::command]
fn get_attachment(app: AppHandle, id: String) -> Result<Value, String> {
    let root = workspace_root(&app)?.join(".memoire").join("studio").join("attachments");
    for entry in fs::read_dir(root).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path().join(format!("{id}.json"));
        if path.is_file() {
            return serde_json::from_str(&fs::read_to_string(path).map_err(|err| err.to_string())?).map_err(|err| err.to_string());
        }
    }
    Err(format!("Unknown attachment: {id}"))
}

#[tauri::command]
fn list_design_system_artifacts() -> Result<Vec<Value>, String> {
    let dir = design_system_artifacts_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut artifacts = Vec::new();
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        if entry.path().extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let content = fs::read_to_string(entry.path()).map_err(|err| err.to_string())?;
        artifacts.push(serde_json::from_str::<Value>(&content).map_err(|err| err.to_string())?);
    }
    artifacts.sort_by(|a, b| {
        b.get("updatedAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(a.get("updatedAt").and_then(Value::as_str).unwrap_or(""))
    });
    Ok(artifacts)
}

#[tauri::command]
fn get_design_system_artifact(id: String) -> Result<Value, String> {
    let path = design_system_artifact_path(&id);
    let content = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str::<Value>(&content).map_err(|err| err.to_string())
}

#[tauri::command]
fn capture_design_system_artifact(payload: Value) -> Result<Value, String> {
    let artifact = payload
        .get("artifact")
        .cloned()
        .unwrap_or_else(|| minimal_design_system_artifact(payload));
    write_design_system_artifact(&artifact)?;
    Ok(artifact)
}

#[tauri::command]
fn review_design_system_artifact_section(
    id: String,
    section_id: String,
    review_state: String,
    comment: Option<String>,
) -> Result<Value, String> {
    let mut artifact = get_design_system_artifact(id.clone())?;
    let sections = artifact
        .get_mut("sections")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "Artifact sections are missing".to_string())?;
    let mut matched = false;
    for section in sections {
        if section.get("id").and_then(Value::as_str) != Some(section_id.as_str()) {
            continue;
        }
        matched = true;
        section["reviewState"] = json!(review_state);
        if let Some(comment) = comment.as_ref().filter(|value| !value.trim().is_empty()) {
            if let Some(comments) = section.get_mut("comments").and_then(Value::as_array_mut) {
                comments.push(json!(comment));
            }
        }
    }
    if !matched {
        return Err(format!("Unknown artifact section: {section_id}"));
    }
    artifact["updatedAt"] = json!(studio::unix_millis().to_string());
    write_design_system_artifact(&artifact)?;
    Ok(artifact)
}

fn design_system_artifacts_dir() -> PathBuf {
    studio::current_dir()
        .join(".memoire")
        .join("studio")
        .join("artifacts")
}

fn design_system_artifact_path(id: &str) -> PathBuf {
    design_system_artifacts_dir().join(format!("{}.json", slug(id)))
}

fn write_design_system_artifact(artifact: &Value) -> Result<(), String> {
    let id = artifact
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Artifact id is required".to_string())?;
    let dir = design_system_artifacts_dir();
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let pretty = serde_json::to_string_pretty(artifact).map_err(|err| err.to_string())?;
    fs::write(design_system_artifact_path(id), format!("{pretty}\n")).map_err(|err| err.to_string())
}

fn minimal_design_system_artifact(payload: Value) -> Value {
    let event = payload
        .get("event")
        .cloned()
        .or_else(|| {
            payload
                .get("events")
                .and_then(Value::as_array)
                .and_then(|events| events.first())
                .cloned()
        })
        .unwrap_or_else(|| json!({}));
    let message = event
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Design System Review");
    let title = message
        .lines()
        .next()
        .unwrap_or("Design System Review")
        .trim()
        .trim_end_matches(':');
    let session_id = payload
        .get("session")
        .and_then(|session| session.get("id"))
        .and_then(Value::as_str)
        .or_else(|| event.get("sessionId").and_then(Value::as_str))
        .unwrap_or("desktop");
    let id = format!("design-system-{}-{}", slug(session_id), slug(title));
    json!({
        "schemaVersion": 1,
        "id": id,
        "title": title,
        "status": "review",
        "sourceWorkspace": payload.get("session").and_then(|session| session.get("cwd")).and_then(Value::as_str),
        "createdByHarness": payload.get("session").and_then(|session| session.get("harness")).and_then(Value::as_str).unwrap_or("desktop"),
        "sourceSessionId": session_id,
        "sourceEventIds": [event.get("id").and_then(Value::as_str).unwrap_or("desktop-event")],
        "sourceRefs": [],
        "sections": [
            {
                "id": "section:handoff",
                "kind": "handoff",
                "title": "Handoff",
                "summary": message,
                "content": message,
                "reviewState": "unreviewed",
                "comments": [],
                "sourceRefs": [],
                "preview": { "kind": "summary", "items": [{ "label": "Result", "value": message }] },
                "eventIds": [event.get("id").and_then(Value::as_str).unwrap_or("desktop-event")]
            }
        ],
        "rawContent": message,
        "createdAt": studio::unix_millis().to_string(),
        "updatedAt": studio::unix_millis().to_string()
    })
}

fn slug(value: &str) -> String {
    let slug: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(96)
        .collect();
    if slug.is_empty() {
        "artifact".to_string()
    } else {
        slug
    }
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|err| format!("Failed to resolve Studio app config directory: {err}"))
}

fn load_or_create_desktop_app_config(app: &AppHandle) -> Result<studio::DesktopAppConfig, String> {
    let dir = app_config_dir(app)?;
    let config = studio::load_desktop_app_config(&dir)?;
    let path = studio::desktop_app_config_path(&dir);
    if !path.exists() {
        studio::save_desktop_app_config(&dir, &config)?;
    }
    Ok(config)
}

fn normalized_app_config(
    config: studio::DesktopAppConfig,
) -> Result<studio::DesktopAppConfig, String> {
    let workspace_root = PathBuf::from(config.workspace_root.trim());
    if !workspace_root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory: {}",
            workspace_root.display()
        ));
    }
    Ok(studio::DesktopAppConfig {
        schema_version: 1,
        workspace_root: workspace_root.to_string_lossy().to_string(),
    })
}

fn workspace_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(PathBuf::from(
        load_or_create_desktop_app_config(app)?.workspace_root,
    ))
}

fn current_runtime_status(state: &AppState, workspace_root: &Path) -> studio::StudioRuntimeStatus {
    let runtime = state.runtime.lock().expect("runtime state lock");
    runtime.status.clone().unwrap_or_else(|| {
        runtime_status(
            "stopped",
            None,
            workspace_root,
            None,
            Some("Studio runtime has not started yet".to_string()),
        )
    })
}

fn restart_studio_runtime(
    app: &AppHandle,
    state: &AppState,
    workspace_root: &Path,
) -> studio::StudioRuntimeStatus {
    {
        let mut runtime = state.runtime.lock().expect("runtime state lock");
        stop_runtime_locked(&mut runtime);
    }

    for _ in 0..20 {
        if !local_port_open(STUDIO_RUNTIME_PORT) {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }

    if local_port_open(STUDIO_RUNTIME_PORT) {
        let status = runtime_status(
            "error",
            None,
            workspace_root,
            None,
            Some(format!(
                "Port {STUDIO_RUNTIME_PORT} is already in use. Quit the other Studio runtime or free 127.0.0.1:{STUDIO_RUNTIME_PORT}."
            )),
        );
        set_runtime_status(state, status.clone(), None);
        return status;
    }

    let package_root = match resolve_runtime_package_root(app) {
        Ok(path) => path,
        Err(error) => {
            let status = runtime_status("error", None, workspace_root, None, Some(error));
            set_runtime_status(state, status.clone(), None);
            return status;
        }
    };
    let binary = match resolve_runtime_binary(app) {
        Ok(path) => path,
        Err(error) => {
            let status = runtime_status(
                "error",
                None,
                workspace_root,
                Some(package_root.to_string_lossy().to_string()),
                Some(error),
            );
            set_runtime_status(state, status.clone(), None);
            return status;
        }
    };

    let mut child = match Command::new(&binary)
        .args([
            "studio",
            "serve",
            "--port",
            &STUDIO_RUNTIME_PORT.to_string(),
            "--json",
        ])
        .current_dir(workspace_root)
        .env("MEMOIRE_PACKAGE_ROOT", &package_root)
        .env("MEMOIRE_STUDIO_MANAGED_BY", "tauri")
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let status = runtime_status(
                "error",
                None,
                workspace_root,
                Some(package_root.to_string_lossy().to_string()),
                Some(format!(
                    "Failed to start bundled Studio runtime {}: {error}",
                    binary.display()
                )),
            );
            set_runtime_status(state, status.clone(), None);
            return status;
        }
    };

    let pid = child.id();
    if let Some(stdout) = child.stdout.take() {
        spawn_runtime_reader(app.clone(), "stdout", stdout);
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_runtime_reader(app.clone(), "stderr", stderr);
    }

    let child = Arc::new(Mutex::new(child));
    let status = runtime_status(
        "running",
        Some(pid),
        workspace_root,
        Some(package_root.to_string_lossy().to_string()),
        None,
    );
    set_runtime_status(state, status.clone(), Some(child.clone()));
    spawn_runtime_waiter(
        app.clone(),
        child,
        workspace_root.to_path_buf(),
        package_root,
    );
    status
}

fn stop_studio_runtime(state: &AppState) {
    let mut runtime = state.runtime.lock().expect("runtime state lock");
    stop_runtime_locked(&mut runtime);
}

fn stop_runtime_locked(runtime: &mut RuntimeProcessState) {
    if let Some(child) = runtime.child.take() {
        if let Ok(mut child) = child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn set_runtime_status(
    state: &AppState,
    status: studio::StudioRuntimeStatus,
    child: Option<Arc<Mutex<std::process::Child>>>,
) {
    let mut runtime = state.runtime.lock().expect("runtime state lock");
    runtime.status = Some(status);
    runtime.child = child;
}

fn runtime_status(
    status: &str,
    pid: Option<u32>,
    workspace_root: &Path,
    package_root: Option<String>,
    error: Option<String>,
) -> studio::StudioRuntimeStatus {
    studio::StudioRuntimeStatus {
        status: status.to_string(),
        port: STUDIO_RUNTIME_PORT,
        url: format!("http://127.0.0.1:{STUDIO_RUNTIME_PORT}"),
        pid,
        workspace_root: workspace_root.to_string_lossy().to_string(),
        package_root,
        error,
    }
}

fn resolve_runtime_binary(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("MEMOIRE_STUDIO_RUNTIME_BIN") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
    }

    let executable = format!("{STUDIO_RUNTIME_BIN}{}", std::env::consts::EXE_SUFFIX);
    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(dir) = current_exe.parent() {
            candidates.push(dir.join(&executable));
            candidates.push(dir.join("binaries").join(&executable));
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(&executable));
        candidates.push(resource_dir.join("binaries").join(&executable));
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let profile = if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    };
    candidates.push(manifest_dir.join("target").join(profile).join(&executable));
    if let Some(target_triple) = option_env!("TAURI_ENV_TARGET_TRIPLE") {
        candidates.push(manifest_dir.join("binaries").join(format!(
            "{STUDIO_RUNTIME_BIN}-{target_triple}{}",
            std::env::consts::EXE_SUFFIX
        )));
    }

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| {
            format!(
                "Bundled Studio runtime is missing. Run `node scripts/build-studio-runtime.mjs --target=darwin-arm64` before building the app."
            )
        })
}

fn resolve_runtime_package_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("MEMOIRE_STUDIO_RUNTIME_PACKAGE_ROOT") {
        let path = PathBuf::from(path);
        if path.is_dir() {
            return Ok(path);
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let packaged = resource_dir.join(STUDIO_RUNTIME_RESOURCE_DIR);
        if packaged.join("package.json").is_file() {
            return Ok(packaged);
        }
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..");
    if repo_root.join("package.json").is_file() {
        return Ok(repo_root);
    }

    Err("Bundled Studio runtime resources are missing. Run `node scripts/build-studio-runtime.mjs --target=darwin-arm64` before building the app.".to_string())
}

fn local_port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            match load_or_create_desktop_app_config(app.handle()) {
                Ok(config) => {
                    let state = app.state::<AppState>();
                    let status = restart_studio_runtime(
                        app.handle(),
                        &state,
                        Path::new(&config.workspace_root),
                    );
                    if status.error.is_some() {
                        let _ = app.emit(
                            "studio-runtime-log",
                            json!({ "stream": "system", "message": status.error }),
                        );
                    }
                }
                Err(error) => {
                    let _ = app.emit(
                        "studio-runtime-log",
                        json!({ "stream": "system", "message": error }),
                    );
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            studio_status,
            studio_runtime_status,
            load_app_config,
            save_app_config,
            select_workspace,
            agent_install,
            capture_attachment,
            get_attachment
        ])
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                if let Some(state) = window.try_state::<AppState>() {
                    stop_studio_runtime(&state);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Mémoire Studio")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                if let Some(state) = app.try_state::<AppState>() {
                    stop_studio_runtime(&state);
                }
            }
        });
}

fn spawn_reader<R: std::io::Read + Send + 'static>(
    app: AppHandle,
    session_id: String,
    event_type: &'static str,
    stream: R,
) {
    thread::spawn(move || {
        let reader = BufReader::new(stream);
        for line in reader.lines().map_while(Result::ok) {
            emit_event(
                &app,
                &session_id,
                event_type,
                &studio::redact_secrets(&line),
            );
        }
    });
}

fn spawn_waiter(app: AppHandle, session_id: String, child: Arc<Mutex<std::process::Child>>) {
    thread::spawn(move || loop {
        let status = {
            let mut child = match child.lock() {
                Ok(child) => child,
                Err(_) => {
                    emit_event(
                        &app,
                        &session_id,
                        "session_error",
                        "Child process lock failed",
                    );
                    return;
                }
            };
            child.try_wait()
        };

        match status {
            Ok(Some(exit_status)) => {
                if exit_status.success() {
                    emit_event(&app, &session_id, "session_done", "Session completed");
                } else {
                    emit_event(
                        &app,
                        &session_id,
                        "session_error",
                        &format!("Session exited with code {:?}", exit_status.code()),
                    );
                }
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(mut processes) = state.processes.lock() {
                        processes.remove(&session_id);
                    }
                }
                return;
            }
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(err) => {
                emit_event(&app, &session_id, "session_error", &err.to_string());
                return;
            }
        }
    });
}

fn spawn_runtime_reader<R: std::io::Read + Send + 'static>(
    app: AppHandle,
    stream: &'static str,
    output: R,
) {
    thread::spawn(move || {
        let reader = BufReader::new(output);
        for line in reader.lines().map_while(Result::ok) {
            let _ = app.emit(
                "studio-runtime-log",
                json!({
                    "stream": stream,
                    "message": studio::redact_secrets(&line),
                    "timestamp": studio::unix_millis().to_string()
                }),
            );
        }
    });
}

fn spawn_runtime_waiter(
    app: AppHandle,
    child: Arc<Mutex<std::process::Child>>,
    workspace_root: PathBuf,
    package_root: PathBuf,
) {
    let pid = child.lock().map(|child| child.id()).unwrap_or_default();
    thread::spawn(move || loop {
        let exit = {
            let mut child = match child.lock() {
                Ok(child) => child,
                Err(_) => return,
            };
            child.try_wait()
        };

        match exit {
            Ok(Some(status)) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let runtime_status = runtime_status(
                        if status.success() { "stopped" } else { "error" },
                        None,
                        &workspace_root,
                        Some(package_root.to_string_lossy().to_string()),
                        if status.success() {
                            None
                        } else {
                            Some(format!(
                                "Studio runtime exited with code {:?}",
                                status.code()
                            ))
                        },
                    );
                    let mut runtime = state.runtime.lock().expect("runtime state lock");
                    let current_pid = runtime
                        .child
                        .as_ref()
                        .and_then(|current| current.lock().ok().map(|child| child.id()));
                    if current_pid == Some(pid) {
                        runtime.child = None;
                        runtime.status = Some(runtime_status.clone());
                    }
                    let _ = app.emit(
                        "studio-runtime-log",
                        json!({ "stream": "system", "message": runtime_status.error }),
                    );
                }
                return;
            }
            Ok(None) => thread::sleep(Duration::from_millis(250)),
            Err(error) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let status = runtime_status(
                        "error",
                        None,
                        &workspace_root,
                        Some(package_root.to_string_lossy().to_string()),
                        Some(format!("Studio runtime status check failed: {error}")),
                    );
                    set_runtime_status(&state, status, None);
                }
                return;
            }
        }
    });
}

fn emit_event(app: &AppHandle, session_id: &str, event_type: &str, message: &str) {
    let event = DesktopStudioEvent {
        id: format!("event-{}", studio::unix_millis()),
        session_id: session_id.to_string(),
        event_type: event_type.to_string(),
        timestamp: studio::unix_millis().to_string(),
        message: message.to_string(),
        data: None,
    };
    let _ = app.emit("studio-event", event);
}

fn emit_event_with_data(
    app: &AppHandle,
    session_id: &str,
    event_type: &str,
    message: &str,
    data: Value,
) {
    let event = DesktopStudioEvent {
        id: format!("event-{}", studio::unix_millis()),
        session_id: session_id.to_string(),
        event_type: event_type.to_string(),
        timestamp: studio::unix_millis().to_string(),
        message: message.to_string(),
        data: Some(data),
    };
    let _ = app.emit("studio-event", event);
}
