use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const HARNESS_MANIFEST_JSON: &str = include_str!("../../../../src/studio/harness-manifest.json");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarnessManifest {
    pub schema_version: u8,
    pub hardline_blocked_patterns: Vec<BlockedPattern>,
    pub harnesses: Vec<HarnessDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedPattern {
    pub pattern: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HarnessDefinition {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub provider: String,
    pub command: String,
    pub description: String,
    pub enabled_by_default: bool,
    pub install_probe: Vec<String>,
    pub capabilities: Vec<String>,
    pub command_templates: HashMap<String, Vec<String>>,
    pub env_policy: String,
    pub workspace_policy: String,
    pub supports_streaming: bool,
    pub supports_cancel: bool,
    pub output_parser: String,
    pub default_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HarnessStatus {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub provider: String,
    pub command: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub enabled: bool,
    pub installed: bool,
    #[serde(rename = "resolvedPath")]
    pub resolved_path: Option<String>,
    #[serde(rename = "supportsCancel")]
    pub supports_cancel: bool,
    #[serde(rename = "outputParser")]
    pub output_parser: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioStatus {
    pub status: String,
    #[serde(rename = "projectRoot")]
    pub project_root: String,
    pub config: StudioConfigSummary,
    pub harnesses: Vec<HarnessStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime: Option<StudioRuntimeStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioConfigSummary {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u8,
    #[serde(rename = "defaultHarness")]
    pub default_harness: String,
    #[serde(rename = "workspaceRoots")]
    pub workspace_roots: Vec<String>,
    #[serde(rename = "defaultModel")]
    pub default_model: Option<String>,
    pub providers: Value,
    pub codex: Value,
    #[serde(rename = "enabledTools")]
    pub enabled_tools: Value,
    pub ui: Value,
    #[serde(rename = "agentProfiles")]
    pub agent_profiles: Value,
    pub permissions: Value,
    pub computer: Value,
    pub setup: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub harness: String,
    pub action: String,
    pub mode: String,
    #[serde(rename = "chatMode")]
    pub chat_mode: String,
    #[serde(rename = "permissionMode")]
    pub permission_mode: String,
    pub cwd: String,
    pub prompt: String,
    pub status: String,
    #[serde(rename = "startedAt")]
    pub started_at: String,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "eventCount")]
    pub event_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAppConfig {
    pub schema_version: u8,
    pub workspace_root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRuntimeStatus {
    pub status: String,
    pub port: u16,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: String,
    #[serde(rename = "packageRoot", skip_serializing_if = "Option::is_none")]
    pub package_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CommandSpec {
    pub command: String,
    pub args: Vec<String>,
}

pub fn studio_status(project_root: &Path) -> StudioStatus {
    let root = project_root.to_string_lossy().to_string();
    StudioStatus {
        status: "ready".to_string(),
        project_root: root.clone(),
        config: studio_config(project_root),
        harnesses: list_harnesses(),
        runtime: None,
    }
}

pub fn studio_config(project_root: &Path) -> StudioConfigSummary {
    let root = project_root.to_string_lossy().to_string();
    let mut config = StudioConfigSummary {
        schema_version: 1,
        default_harness: "codex".to_string(),
        workspace_roots: vec![root],
        default_model: None,
        providers: json!({
            "anthropic": { "enabled": true, "envKey": "ANTHROPIC_API_KEY" },
            "openai": { "enabled": true, "envKey": "OPENAI_API_KEY" },
            "openaiCompatible": { "enabled": false, "baseUrl": null, "envKey": null },
            "ollama": { "enabled": true, "baseUrl": "http://127.0.0.1:11434", "defaultModel": "llama3.1:8b" }
        }),
        codex: json!({
            "model": "gpt-5.5",
            "reasoningEffort": "xhigh",
            "approvalPolicy": "never",
            "webSearch": true,
            "skipGitRepoCheck": true,
            "includeMemoireCommands": true,
            "includeCodexCommands": true,
            "planModeDefault": false
        }),
        enabled_tools: json!({
            "shell": true,
            "browser": true,
            "figma": true,
            "mcp": true
        }),
        ui: json!({
            "theme": "dark",
            "inputMode": "agent",
            "commandPaletteEnabled": true,
            "toolbeltLayout": "compact"
        }),
        agent_profiles: json!([{
            "id": "design",
            "name": "Design",
            "defaultHarness": "codex",
            "defaultAction": "app-build",
            "model": null,
            "autonomy": "autonomous"
        }]),
        permissions: json!({
            "workspaceWrite": "allow",
            "shell": "allow",
            "computer": "allow",
            "figma": "allow",
            "allowlist": [],
            "denylist": []
        }),
        computer: json!({
            "enabled": cfg!(target_os = "macos"),
            "allowedApps": ["Figma", "Google Chrome", "Safari", "Finder", "Terminal", "iTerm", "Visual Studio Code", "Cursor"],
            "requireApproval": false,
            "permissions": {
                "accessibility": "unknown",
                "screenRecording": "unknown",
                "automation": "unknown",
                "fileAccess": "unknown"
            }
        }),
        setup: json!({
            "wizardVersion": 1,
            "completedAt": null,
            "dismissedAt": null,
            "lastCheckedAt": null,
            "downloadReadyAcknowledged": false
        }),
    };

    let path = project_root
        .join(".memoire")
        .join("studio")
        .join("config.json");
    if let Ok(raw) = fs::read_to_string(path) {
        if let Ok(saved) = serde_json::from_str::<Value>(&raw) {
            if let Some(default_harness) = saved.get("defaultHarness").and_then(Value::as_str) {
                config.default_harness = default_harness.to_string();
            }
            if let Some(workspace_roots) = saved.get("workspaceRoots").and_then(Value::as_array) {
                let roots = workspace_roots
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect::<Vec<_>>();
                if !roots.is_empty() {
                    config.workspace_roots = roots;
                }
            }
            if saved.get("defaultModel").is_some() {
                config.default_model = saved
                    .get("defaultModel")
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
            }
            if let Some(providers) = saved.get("providers") {
                merge_json_object(&mut config.providers, providers);
            }
            if let Some(codex) = saved.get("codex") {
                merge_json_object(&mut config.codex, codex);
            }
            if let Some(enabled_tools) = saved.get("enabledTools") {
                merge_json_object(&mut config.enabled_tools, enabled_tools);
            }
            if let Some(ui) = saved.get("ui") {
                merge_json_object(&mut config.ui, ui);
            }
            if let Some(agent_profiles) = saved.get("agentProfiles") {
                config.agent_profiles = agent_profiles.clone();
            }
            if let Some(permissions) = saved.get("permissions") {
                merge_json_object(&mut config.permissions, permissions);
            }
            if let Some(computer) = saved.get("computer") {
                merge_json_object(&mut config.computer, computer);
            }
            if let Some(setup) = saved.get("setup") {
                merge_json_object(&mut config.setup, setup);
            }
        }
    }

    config
}

pub fn desktop_app_config_path(app_config_dir: &Path) -> PathBuf {
    app_config_dir.join("studio-app-config.json")
}

pub fn default_desktop_app_config() -> DesktopAppConfig {
    DesktopAppConfig {
        schema_version: 1,
        workspace_root: default_workspace_root().to_string_lossy().to_string(),
    }
}

pub fn load_desktop_app_config(app_config_dir: &Path) -> Result<DesktopAppConfig, String> {
    let path = desktop_app_config_path(app_config_dir);
    let Ok(raw) = fs::read_to_string(path) else {
        return Ok(default_desktop_app_config());
    };
    let mut config = serde_json::from_str::<DesktopAppConfig>(&raw)
        .map_err(|err| format!("Failed to parse Studio app config: {err}"))?;
    config.schema_version = 1;
    if config.workspace_root.trim().is_empty() {
        config.workspace_root = default_workspace_root().to_string_lossy().to_string();
    }
    Ok(config)
}

pub fn save_desktop_app_config(
    app_config_dir: &Path,
    config: &DesktopAppConfig,
) -> Result<(), String> {
    fs::create_dir_all(app_config_dir).map_err(|err| err.to_string())?;
    let mut normalized = config.clone();
    normalized.schema_version = 1;
    if normalized.workspace_root.trim().is_empty() {
        normalized.workspace_root = default_workspace_root().to_string_lossy().to_string();
    }
    let raw = serde_json::to_string_pretty(&normalized).map_err(|err| err.to_string())?;
    fs::write(desktop_app_config_path(app_config_dir), format!("{raw}\n"))
        .map_err(|err| err.to_string())
}

pub fn studio_compatibility(project_root: &Path) -> Value {
    let config = studio_config(project_root);
    let harnesses = list_harnesses()
        .into_iter()
        .map(|harness| {
            let setup_status = if harness.installed { "ready" } else { "needs_action" };
            let setup_action = if harness.installed { "Ready" } else { "Install CLI" };
            let setup_command = if harness.installed {
                Value::Null
            } else {
                Value::String(install_command_for_harness(&harness.id, &harness.command))
            };
            json!({
                "id": harness.id,
                "label": harness.label,
                "provider": harness.provider,
                "installed": harness.installed,
                "enabled": harness.enabled,
                "authStatus": if harness.installed { "ready" } else { "missing" },
                "authMessage": if harness.installed { "Ready" } else { "Install CLI" },
                "supportedActions": harness_manifest()
                    .harnesses
                    .iter()
                    .find(|entry| entry.id == harness.id)
                    .map(|entry| entry.capabilities.clone())
                    .unwrap_or_default(),
                "outputParser": harness.output_parser,
                "supportsCancel": harness.supports_cancel,
                "supportsStreaming": true,
                "modes": if harness.id == "shell" { json!(["delegate"]) } else { json!(["delegate", "brokered"]) },
                "requiredSetup": if harness.installed { json!([]) } else { json!(["Install CLI"]) },
                "setupStatus": setup_status,
                "setupAction": setup_action,
                "setupCommand": setup_command,
                "canAutoOpen": !harness.installed,
                "permissionKind": if harness.installed { "none" } else { "cli" },
                "resolvedPath": harness.resolved_path
            })
        })
        .collect::<Vec<_>>();

    let computer = computer_status(&config);
    let computer_available = computer
        .get("available")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    json!({
        "schemaVersion": 1,
        "generatedAt": unix_millis().to_string(),
        "runtime": "local",
        "harnesses": harnesses,
        "tools": {
            "browser": setup_tool(true, false, "web-runtime", "Browser adapter runs through Studio runtime", "Browser adapter ready", "Install browser adapter dependencies", Value::String("npm install".to_string()), "none", false),
            "figma": setup_tool(true, false, "stopped/disconnected", "Bridge stopped", "Figma bridge and plugin connected", "Start the Figma bridge", Value::Null, "figma", true),
            "computer": {
                "enabled": computer.get("enabled").and_then(Value::as_bool).unwrap_or(false),
                "available": computer_available,
                "state": if computer_available { "ready" } else { "limited" },
                "message": computer.get("message").and_then(Value::as_str).unwrap_or("Computer state unavailable"),
                "setupStatus": if computer_available { "needs_action" } else { "optional" },
                "setupAction": if computer_available { "Grant macOS Screen Recording, Accessibility, Automation, and file access" } else { "Use the macOS desktop app for Computer permissions" },
                "setupCommand": Value::Null,
                "canAutoOpen": computer_available,
                "permissionKind": "macos"
            },
            "mcp": setup_tool(true, true, "enabled", "MCP tools enabled", "MCP tools enabled", "Enable MCP tools in Studio settings", Value::Null, "none", false),
            "shell": setup_tool(true, true, "full-access", "Shell is enabled and every command is traced", "Shell full-access tracing enabled", "Enable shell in Studio settings for terminal workflows", Value::Null, "workspace", false)
        },
        "providers": config.providers
    })
}

fn setup_tool(
    enabled: bool,
    available: bool,
    state: &str,
    message: &str,
    ready_action: &str,
    action: &str,
    command: Value,
    permission_kind: &str,
    can_auto_open: bool,
) -> Value {
    let ready = enabled && available;
    json!({
        "enabled": enabled,
        "available": available,
        "state": state,
        "message": message,
        "setupStatus": if ready { "ready" } else if enabled { "needs_action" } else { "optional" },
        "setupAction": if ready { ready_action } else { action },
        "setupCommand": command,
        "canAutoOpen": can_auto_open,
        "permissionKind": permission_kind
    })
}

fn install_command_for_harness(id: &str, command: &str) -> String {
    match id {
        "memoire" => "npm i -g @sarveshsea/memoire".to_string(),
        "claude-code" => "npm i -g @anthropic-ai/claude-code".to_string(),
        "codex" => "npm i -g @openai/codex".to_string(),
        "ollama" => "brew install ollama".to_string(),
        "hermes" => "Install Hermes CLI from its project docs".to_string(),
        _ => format!("Install {command}"),
    }
}

pub fn computer_status(config: &StudioConfigSummary) -> Value {
    let enabled = config
        .computer
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(cfg!(target_os = "macos"));
    let available = enabled && cfg!(target_os = "macos");
    let platform = if cfg!(target_os = "macos") {
        "darwin"
    } else {
        env::consts::OS
    };
    json!({
        "enabled": enabled,
        "platform": platform,
        "available": available,
        "mode": "full-access-native",
        "permissions": config.computer.get("permissions").cloned().unwrap_or_else(|| json!({
            "accessibility": "unknown",
            "screenRecording": "unknown",
            "automation": "unknown",
            "fileAccess": "unknown"
        })),
        "allowedApps": config.computer.get("allowedApps").cloned().unwrap_or_else(|| json!(["Figma"])),
        "message": if available {
            "Computer integration ready; Studio records every action while macOS permissions stay user-controlled."
        } else {
            "Computer integration is limited outside the macOS desktop shell."
        }
    })
}

pub fn computer_open(request: Value, config: &StudioConfigSummary) -> Value {
    let target = request
        .get("target")
        .and_then(Value::as_str)
        .unwrap_or("url");
    let action = match target {
        "app" => "openApp",
        "file" => "revealPath",
        "figma" => "openFigma",
        "browser" => "openBrowser",
        _ => "openUrl",
    };
    computer_action(
        json!({
            "action": action,
            "value": request.get("value").cloned().unwrap_or(Value::Null),
            "approved": request.get("approved").cloned().unwrap_or(Value::Bool(false))
        }),
        config,
        true,
    )
}

pub fn computer_action(request: Value, config: &StudioConfigSummary, open_shortcut: bool) -> Value {
    let action = request
        .get("action")
        .and_then(Value::as_str)
        .unwrap_or("openUrl");
    let status = computer_status(config);
    let available = status
        .get("available")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let config_requires_approval = config
        .computer
        .get("requireApproval")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let requires_approval = config_requires_approval
        && !open_shortcut
        && matches!(action, "captureScreen" | "focusApp" | "openApp");
    let approved = request
        .get("approved")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let result_status = if !available {
        "unavailable"
    } else if requires_approval && !approved {
        "approval_required"
    } else {
        "completed"
    };
    json!({
        "action": action,
        "status": result_status,
        "completedAt": unix_millis().to_string(),
        "requiresApproval": requires_approval,
        "executed": false,
        "message": if result_status == "approval_required" { "Approval required" } else { "Prepared auditable computer action" },
        "artifactPath": null
    })
}

pub fn list_harnesses() -> Vec<HarnessStatus> {
    harness_manifest()
        .harnesses
        .into_iter()
        .map(|harness| {
            let resolved_path = harness
                .install_probe
                .iter()
                .find_map(|command| command_path(command))
                .or_else(|| command_path(&harness.command));
            let installed = resolved_path.is_some();
            HarnessStatus {
                id: harness.id,
                label: harness.label,
                kind: harness.kind,
                provider: harness.provider,
                command: harness.command,
                description: harness.description,
                capabilities: harness.capabilities,
                enabled: harness.enabled_by_default,
                installed,
                resolved_path: resolved_path.map(|path| path.to_string_lossy().to_string()),
                supports_cancel: harness.supports_cancel,
                output_parser: harness.output_parser,
            }
        })
        .collect()
}

#[allow(dead_code)]
pub fn build_command_for_action(
    harness: &str,
    prompt: &str,
    action: Option<&str>,
) -> Result<CommandSpec, String> {
    build_command_for_action_with_context(harness, prompt, action, None, None)
}

pub fn build_command_for_action_with_context(
    harness: &str,
    prompt: &str,
    action: Option<&str>,
    chat_mode: Option<&str>,
    permission_mode: Option<&str>,
) -> Result<CommandSpec, String> {
    let manifest = harness_manifest();
    let Some(definition) = manifest
        .harnesses
        .into_iter()
        .find(|entry| entry.id == harness)
    else {
        return Err(format!("Unknown harness: {harness}"));
    };
    if !definition.enabled_by_default {
        return Err(format!(
            "Harness {harness} is disabled by default in the desktop shell"
        ));
    }
    let action = action.unwrap_or(if definition.id == "memoire" {
        "compose"
    } else {
        "raw"
    });
    let Some(template) = definition
        .command_templates
        .get(action)
        .or_else(|| definition.command_templates.get("raw"))
    else {
        return Err(format!(
            "Harness {harness} does not support action {action}"
        ));
    };
    let chat_mode = chat_mode.unwrap_or("ideate");
    let permission_mode = permission_mode.unwrap_or("guarded");
    let args = template
        .iter()
        .map(|part| {
            let envelope = design_agent_envelope(harness, action, chat_mode, permission_mode, prompt);
            let system_prompt = design_agent_system_prompt(harness, action, chat_mode, permission_mode);
            part.replace("{{prompt}}", prompt)
                .replace("{{promptEnvelope}}", &envelope)
                .replace("{{agentSystemPrompt}}", &system_prompt)
                .replace(
                    "{{ollamaModel}}",
                    definition.default_model.as_deref().unwrap_or("llama3.2"),
                )
        })
        .collect::<Vec<_>>();
    let args = if definition.id == "codex" {
        apply_codex_runtime_args(args, action, permission_mode)
    } else {
        args
    };

    Ok(CommandSpec {
        command: command_path(&definition.command)
            .or_else(|| {
                definition
                    .install_probe
                    .iter()
                    .find_map(|probe| command_path(probe))
            })
            .unwrap_or_else(|| PathBuf::from(&definition.command))
            .to_string_lossy()
            .to_string(),
        args,
    })
}

fn apply_codex_runtime_args(args: Vec<String>, action: &str, permission_mode: &str) -> Vec<String> {
    let mut stripped = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if matches!(
            arg.as_str(),
            "--search" | "--skip-git-repo-check" | "--dangerously-bypass-approvals-and-sandbox"
        ) {
            index += 1;
            continue;
        }
        if matches!(arg.as_str(), "--sandbox" | "-s" | "--model" | "-m") {
            index += 2;
            continue;
        }
        if matches!(arg.as_str(), "-c" | "--config")
            && args
                .get(index + 1)
                .map(|value| {
                    value.starts_with("model_reasoning_effort=")
                        || value.starts_with("approval_policy=")
                })
                .unwrap_or(false)
        {
            index += 2;
            continue;
        }
        stripped.push(arg.clone());
        index += 1;
    }
    let prompt = stripped.pop();
    let mut next = Vec::new();
    let use_search = matches!(
        action,
        "compose" | "audit" | "app-build" | "self-design" | "research" | "browser-audit" | "handoff"
    );
    if let Some(exec_index) = stripped.iter().position(|arg| arg == "exec") {
        next.extend_from_slice(&stripped[..exec_index]);
        if use_search {
            next.push("--search".to_string());
        }
        next.extend_from_slice(&stripped[exec_index..]);
    } else {
        if use_search {
            next.push("--search".to_string());
        }
        next.extend(stripped);
    }
    next.extend([
        "--model".to_string(),
        "gpt-5.5".to_string(),
        "-c".to_string(),
        "model_reasoning_effort=\"xhigh\"".to_string(),
        "-c".to_string(),
        "approval_policy=\"never\"".to_string(),
        "--skip-git-repo-check".to_string(),
    ]);
    if permission_mode == "full_access" {
        next.push("--dangerously-bypass-approvals-and-sandbox".to_string());
    } else {
        next.push("--sandbox".to_string());
        next.push(if permission_mode == "plan" {
            "read-only".to_string()
        } else {
            "workspace-write".to_string()
        });
    }
    if let Some(prompt) = prompt {
        next.push(prompt);
    }
    next
}

pub fn build_agent_install_command(
    target: &str,
    project_root: &str,
    dry_run: bool,
    force: bool,
) -> Result<CommandSpec, String> {
    if !matches!(
        target,
        "all" | "hermes" | "openclaw" | "claude-code" | "cursor" | "codex" | "opencode"
    ) {
        return Err(format!(
            "Unknown agent kit target: {target}. Use all, hermes, openclaw, claude-code, cursor, codex, or opencode."
        ));
    }

    let mut args = vec![
        "agent".to_string(),
        "install".to_string(),
        target.to_string(),
        "--project".to_string(),
        project_root.to_string(),
        "--json".to_string(),
    ];
    if dry_run {
        args.push("--dry-run".to_string());
    }
    if force {
        args.push("--force".to_string());
    }

    Ok(CommandSpec {
        command: command_path("memi")
            .or_else(|| command_path("memoire"))
            .unwrap_or_else(|| PathBuf::from("memi"))
            .to_string_lossy()
            .to_string(),
        args,
    })
}

fn design_agent_system_prompt(
    harness: &str,
    action: &str,
    chat_mode: &str,
    permission_mode: &str,
) -> String {
    let plan = if permission_mode == "plan" {
        " Plan mode is read-only: inspect, research, and propose before editing files or running mutating commands."
    } else {
        ""
    };
    let codex = if harness == "codex" {
        " Codex settings: model gpt-5.5, model_reasoning_effort xhigh, approval_policy never."
    } else {
        ""
    };
    format!(
        "You are the Mémoire Studio design harness. Act as a product design, UX research, and design-system agent before acting as a coding agent. Preserve Atomic Design levels. When full_access is selected, execute workspace, terminal, and computer actions directly while keeping every action traceable.{plan}{codex} Reference package: @sarveshsea/memoire@{}. Current action: {action}. Current harness: {harness}. Chat mode: {chat_mode}. Permission mode: {permission_mode}.",
        env!("CARGO_PKG_VERSION")
    )
}

fn design_agent_envelope(
    harness: &str,
    action: &str,
    chat_mode: &str,
    permission_mode: &str,
    prompt: &str,
) -> String {
    let plan = if permission_mode == "plan" {
        "\n- Plan mode: stay read-only, inspect first, and return a plan with evidence, risks, commands to run, and acceptance criteria before edits."
    } else {
        ""
    };
    let codex = if harness == "codex" {
        "\n\n## Codex + Mémoire command ladder\n- First confirm Codex readiness with `codex login status` when auth or run ability is unclear.\n- Start workspace inspection with `memi status --json`, then `memi suite doctor --json` when a suite manifest exists.\n- For research-scale work, prefer `memi research report --json` or `memi research synthesize --json` when research inputs exist.\n- For UI quality and shadcn/Tailwind cleanup, use `memi diagnose . --json`, token pulls, and design docs before editing.\n- Emit final sections with these exact labels when possible: research_note, design_decision, tool_call, artifact, acceptance_statement, session_result."
    } else {
        ""
    };
    let codex_settings = if harness == "codex" {
        "\n- Codex model: gpt-5.5\n- Codex reasoning: xhigh\n- Codex approval policy: never"
    } else {
        ""
    };
    format!(
        "# Mémoire Studio Agent Task\n\n## Design/research lens\n- Start from UX research, information architecture, accessibility, and design-system coherence.\n- Keep component thinking in Atomic design levels: atom -> molecule -> organism -> template -> page.\n- Use project memory, specs, references, and Figma state when available.\n- Report discoveries as research_note, design_decision, tool_call, artifact, and session_result when possible.\n\n## Harness behavior\n- Harness: {harness}\n- Action: {action}\n- Chat mode: {chat_mode}\n- Permission mode: {permission_mode}{codex_settings}\n- Reference package: @sarveshsea/memoire@{} (https://www.npmjs.com/package/@sarveshsea/memoire)\n- In ideate and research modes, produce plans, questions, references, research evidence, and design artifacts before implementation.{plan}\n- In build and terminal modes, keep terminal commands, output, previews, and handoff artifacts traceable.\n- In full_access mode, act without extra confirmation inside configured workspaces; reserve destructive host actions for explicit user requests.\n- Produce a concise final session_result with artifacts, assumptions, and next design/research step.{codex}\n\n## User request\n{prompt}",
        env!("CARGO_PKG_VERSION")
    )
}

pub fn read_workspace(path: &Path) -> Result<Vec<WorkspaceEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == "node_modules" || file_name.starts_with(".git") {
            continue;
        }
        let file_type = entry.file_type().map_err(|err| err.to_string())?;
        entries.push(WorkspaceEntry {
            name: file_name,
            path: entry.path().to_string_lossy().to_string(),
            kind: if file_type.is_dir() {
                "directory"
            } else {
                "file"
            }
            .to_string(),
        });
    }
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(entries)
}

pub fn redact_secrets(input: &str) -> String {
    let mut output = input.to_string();
    for name in [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "FIGMA_TOKEN",
        "GITHUB_TOKEN",
    ] {
        output = redact_env_assignment(&output, name);
    }
    redact_bearer(&output)
}

pub fn harness_manifest() -> HarnessManifest {
    serde_json::from_str(HARNESS_MANIFEST_JSON).expect("valid Studio harness manifest")
}

fn command_path(command: &str) -> Option<PathBuf> {
    let mut paths: Vec<PathBuf> = env::var_os("PATH")
        .map(|paths| env::split_paths(&paths).collect())
        .unwrap_or_default();
    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        paths.push(home.join(".local").join("bin"));
        paths.push(home.join(".npm-global").join("bin"));
    }
    paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
    ]);
    paths.into_iter().find_map(|path| {
        let candidate = path.join(command);
        if candidate.is_file() {
            Some(candidate)
        } else {
            None
        }
    })
}

fn merge_json_object(target: &mut Value, source: &Value) {
    let (Some(target_object), Some(source_object)) = (target.as_object_mut(), source.as_object())
    else {
        return;
    };
    for (key, value) in source_object {
        match (target_object.get_mut(key), value) {
            (Some(target_child), Value::Object(_)) => merge_json_object(target_child, value),
            _ => {
                target_object.insert(key.clone(), value.clone());
            }
        }
    }
}

fn redact_env_assignment(input: &str, name: &str) -> String {
    input
        .lines()
        .map(|line| {
            if line.starts_with(&format!("{name}=")) {
                format!("{name}=[redacted]")
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn redact_bearer(input: &str) -> String {
    input
        .lines()
        .map(|line| {
            if let Some(index) = line.to_ascii_lowercase().find("authorization: bearer ") {
                let prefix_len = index + "Authorization: Bearer ".len();
                format!("{}[redacted]", &line[..prefix_len])
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

pub fn current_dir() -> PathBuf {
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn default_workspace_root() -> PathBuf {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .unwrap_or_else(current_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_codex_command_without_shell_interpolation() {
        let command =
            build_command_for_action("codex", "create a hero", Some("compose")).expect("command");
        assert!(command.command.ends_with("codex"));
        assert!(command.args.contains(&"--sandbox".to_string()));
        assert!(command.args.contains(&"workspace-write".to_string()));
        let prompt = command.args.last().expect("prompt");
        assert!(prompt.contains("create a hero"));
        assert!(prompt.contains("# Mémoire Studio Agent Task"));
    }

    #[test]
    fn memoire_harness_is_disabled_by_default() {
        let error = build_command_for_action("memoire", "create a hero", None)
            .expect_err("memoire disabled");
        assert!(error.contains("disabled"));
    }

    #[test]
    fn studio_config_defaults_to_codex_app_build() {
        let root = env::temp_dir().join(format!("memoire-studio-config-{}", unix_millis()));
        fs::create_dir_all(&root).expect("temp root");
        let config = studio_config(&root);
        assert_eq!(config.default_harness, "codex");
        assert_eq!(
            config.workspace_roots,
            vec![root.to_string_lossy().to_string()]
        );
        assert_eq!(
            config
                .agent_profiles
                .get(0)
                .and_then(|profile| profile.get("defaultAction"))
                .and_then(Value::as_str),
            Some("app-build")
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn desktop_app_config_persists_workspace_root_in_app_config_dir() {
        let config_dir =
            env::temp_dir().join(format!("memoire-studio-app-config-{}", unix_millis()));
        let workspace = config_dir.join("workspace");
        let config = DesktopAppConfig {
            schema_version: 1,
            workspace_root: workspace.to_string_lossy().to_string(),
        };

        save_desktop_app_config(&config_dir, &config).expect("save app config");
        let loaded = load_desktop_app_config(&config_dir).expect("load app config");

        assert_eq!(loaded, config);
        assert!(desktop_app_config_path(&config_dir).starts_with(&config_dir));
        let _ = fs::remove_dir_all(config_dir);
    }

    #[test]
    fn loads_shared_harness_manifest() {
        let manifest = harness_manifest();
        let codex = manifest
            .harnesses
            .iter()
            .find(|entry| entry.id == "codex")
            .expect("codex manifest entry");
        assert_eq!(manifest.schema_version, 1);
        assert_eq!(codex.provider, "openai");
        assert_eq!(codex.output_parser, "codex-jsonl");
    }

    #[test]
    fn external_agents_receive_design_research_envelope() {
        let command = build_command_for_action("codex", "audit the workbench", Some("audit"))
            .expect("codex command");
        let prompt = command.args.last().expect("prompt");
        assert!(prompt.contains("# Mémoire Studio Agent Task"));
        assert!(prompt.contains("UX research"));
        assert!(prompt.contains("Atomic design levels"));

        let claude = build_command_for_action("claude-code", "compose a flow", Some("compose"))
            .expect("claude command");
        assert!(claude.args.contains(&"--append-system-prompt".to_string()));
        assert!(claude
            .args
            .last()
            .expect("prompt")
            .contains("design_decision"));
    }

    #[test]
    fn shell_is_disabled_by_default() {
        let error =
            build_command_for_action("shell", "echo hi", None).expect_err("shell should fail");
        assert!(error.contains("disabled"));
    }

    #[test]
    fn builds_agent_install_command_for_desktop_shell() {
        let command = build_agent_install_command("hermes", "/tmp/memoire-project", true, false)
            .expect("agent install command");
        assert!(command.command.ends_with("memi"));
        assert_eq!(
            command.args,
            vec![
                "agent",
                "install",
                "hermes",
                "--project",
                "/tmp/memoire-project",
                "--json",
                "--dry-run",
            ]
        );

        let forced = build_agent_install_command("openclaw", "/tmp/memoire-project", false, true)
            .expect("forced agent install command");
        assert!(forced.args.contains(&"--force".to_string()));
    }

    #[test]
    fn redacts_provider_secrets() {
        let redacted =
            redact_secrets("ANTHROPIC_API_KEY=sk-ant-secret\nAuthorization: Bearer abc.def");
        assert_eq!(
            redacted,
            "ANTHROPIC_API_KEY=[redacted]\nAuthorization: Bearer [redacted]"
        );
    }
}
