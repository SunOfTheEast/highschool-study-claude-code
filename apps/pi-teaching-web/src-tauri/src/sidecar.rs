use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct ReadyReceipt {
    pub r#type: String,
    pub protocol: u8,
    pub port: u16,
    pub workspace: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum RuntimeState {
    Starting,
    Ready { port: u16, workspace: String },
    Stopped,
    Crashed { code: Option<i32> },
}

#[derive(Clone, Debug)]
pub enum LaunchEvent {
    Ready(ReadyReceipt),
    Exited(i32),
}

#[derive(Clone, Debug)]
pub struct DesktopPaths {
    pub app_home: PathBuf,
    pub documents_home: PathBuf,
    pub resource_root: PathBuf,
    pub pi_binary: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SidecarLaunch {
    pub arguments: Vec<String>,
    pub environment: BTreeMap<String, String>,
}

pub fn parse_ready_line(line: &str) -> Result<ReadyReceipt, String> {
    let receipt: ReadyReceipt =
        serde_json::from_str(line).map_err(|_| "STUDYFORGE_READY_RECEIPT_INVALID".to_string())?;
    if receipt.r#type != "studyforge-ready"
        || receipt.protocol != 1
        || !matches!(receipt.workspace.as_str(), "setup" | "selected")
    {
        return Err("STUDYFORGE_READY_RECEIPT_INVALID".into());
    }
    Ok(receipt)
}

pub fn apply_event(_state: RuntimeState, event: LaunchEvent) -> RuntimeState {
    match event {
        LaunchEvent::Ready(receipt) => RuntimeState::Ready {
            port: receipt.port,
            workspace: receipt.workspace,
        },
        LaunchEvent::Exited(0) => RuntimeState::Stopped,
        LaunchEvent::Exited(code) => RuntimeState::Crashed { code: Some(code) },
    }
}

fn display(path: &std::path::Path) -> String {
    path.to_string_lossy().into_owned()
}

pub fn platform_tool_environment(resource_root: &Path, windows: bool) -> BTreeMap<String, String> {
    if !windows {
        return BTreeMap::new();
    }
    let root = resource_root.join("platform/windows");
    BTreeMap::from([
        (
            "STUDYFORGE_PACKAGED_BASH".into(),
            display(&root.join("portable-git/bin/bash.exe")),
        ),
        (
            "STUDYFORGE_PACKAGED_RG".into(),
            display(&root.join("tools/rg.exe")),
        ),
        (
            "STUDYFORGE_PACKAGED_FD".into(),
            display(&root.join("tools/fd.exe")),
        ),
        (
            "NAPI_RS_NATIVE_LIBRARY_PATH".into(),
            display(&root.join("canvas/skia.win32-x64-msvc.node")),
        ),
    ])
}

pub fn build_launch(paths: DesktopPaths, token: String) -> SidecarLaunch {
    let agent_dir = paths.app_home.join("agent");
    let sessions_dir = agent_dir.join("sessions");
    let arguments = vec![
        "--port".into(),
        "0".into(),
        "--app-home".into(),
        display(&paths.app_home),
        "--documents-home".into(),
        display(&paths.documents_home),
        "--resource-root".into(),
        display(&paths.resource_root),
        "--token".into(),
        token,
    ];
    let mut environment = BTreeMap::from([
        ("PI_CODING_AGENT_DIR".into(), display(&agent_dir)),
        ("PI_CODING_AGENT_SESSION_DIR".into(), display(&sessions_dir)),
        ("PI_SUBAGENT_PI_BINARY".into(), display(&paths.pi_binary)),
        (
            "PI_SUBAGENT_PROMPT_RUNTIME_EXTENSION_PATH".into(),
            display(
                &paths
                    .resource_root
                    .join("pi-subagents/subagent-prompt-runtime.js"),
            ),
        ),
        (
            "PI_PACKAGE_DIR".into(),
            display(&paths.resource_root.join("pi-runtime")),
        ),
        (
            "STUDYFORGE_RESOURCE_ROOT".into(),
            display(&paths.resource_root),
        ),
    ]);
    environment.extend(platform_tool_environment(
        &paths.resource_root,
        cfg!(target_os = "windows"),
    ));
    SidecarLaunch {
        arguments,
        environment,
    }
}
