pub mod sidecar;

use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use serde::Serialize;
use sidecar::{DesktopPaths, RuntimeState, build_launch, parse_ready_line};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};
use uuid::Uuid;

#[derive(Default)]
struct RuntimeInner {
    generation: u64,
    token: String,
    state: Option<RuntimeState>,
    child: Option<CommandChild>,
    error: Option<String>,
}

#[derive(Clone, Default)]
struct RuntimeManager {
    inner: Arc<Mutex<RuntimeInner>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConnection {
    state: RuntimeState,
    api_base: Option<String>,
    token: Option<String>,
    error: Option<String>,
}

fn lock_runtime(
    manager: &RuntimeManager,
) -> Result<std::sync::MutexGuard<'_, RuntimeInner>, String> {
    manager
        .inner
        .lock()
        .map_err(|_| "STUDYFORGE_RUNTIME_STATE_UNAVAILABLE".to_string())
}

fn resource_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(value) = std::env::var_os("STUDYFORGE_DEV_RESOURCE_ROOT") {
        return Ok(PathBuf::from(value));
    }
    let bundled = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?
        .join("studyforge");
    if bundled.exists() {
        return Ok(bundled);
    }
    Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../resources"))
}

fn pi_binary() -> Result<PathBuf, String> {
    if let Some(value) = std::env::var_os("STUDYFORGE_DEV_PI_BINARY") {
        return Ok(PathBuf::from(value));
    }
    let adjacent = std::env::current_exe()
        .map_err(|error| error.to_string())?
        .parent()
        .ok_or_else(|| "STUDYFORGE_EXECUTABLE_DIRECTORY_MISSING".to_string())?
        .join("studyforge-pi");
    if adjacent.exists() {
        return Ok(adjacent);
    }
    Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries/studyforge-pi-aarch64-apple-darwin"))
}

fn desktop_paths(app: &AppHandle) -> Result<DesktopPaths, String> {
    let app_home = app
        .path()
        .data_dir()
        .map_err(|error| error.to_string())?
        .join("StudyForge");
    let documents_home = app
        .path()
        .document_dir()
        .map_err(|error| error.to_string())?
        .join("StudyForge");
    Ok(DesktopPaths {
        app_home,
        documents_home,
        resource_root: resource_root(app)?,
        pi_binary: pi_binary()?,
    })
}

fn mark_spawn_failure(manager: &RuntimeManager, message: String) {
    if let Ok(mut inner) = manager.inner.lock() {
        inner.state = Some(RuntimeState::Crashed { code: None });
        inner.error = Some(message);
        inner.child = None;
    }
}

fn start_runtime(app: &AppHandle, manager: &RuntimeManager) -> Result<(), String> {
    let token = Uuid::new_v4().simple().to_string();
    let launch = build_launch(desktop_paths(app)?, token.clone());
    let (mut receiver, child) = app
        .shell()
        .sidecar("studyforge-runtime")
        .map_err(|error| error.to_string())?
        .args(launch.arguments)
        .envs(launch.environment)
        .spawn()
        .map_err(|error| error.to_string())?;

    let generation = {
        let mut inner = lock_runtime(manager)?;
        inner.generation += 1;
        inner.token = token;
        inner.state = Some(RuntimeState::Starting);
        inner.error = None;
        inner.child = Some(child);
        inner.generation
    };
    let shared = manager.inner.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            let Ok(mut inner) = shared.lock() else {
                return;
            };
            if inner.generation != generation {
                continue;
            }
            match event {
                CommandEvent::Stdout(bytes) => {
                    if let Ok(line) = std::str::from_utf8(&bytes)
                        && let Ok(receipt) = parse_ready_line(line.trim())
                    {
                        inner.state = Some(RuntimeState::Ready {
                            port: receipt.port,
                            workspace: receipt.workspace,
                        });
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let message = String::from_utf8_lossy(&bytes);
                    let trimmed = message.trim();
                    if !trimmed.is_empty() {
                        inner.error = Some(trimmed.chars().take(500).collect());
                    }
                }
                CommandEvent::Error(error) => {
                    inner.error = Some(error);
                    inner.state = Some(RuntimeState::Crashed { code: None });
                    inner.child = None;
                }
                CommandEvent::Terminated(payload) => {
                    inner.state = match payload.code {
                        Some(0) => RuntimeState::Stopped,
                        code => RuntimeState::Crashed { code },
                    }
                    .into();
                    inner.child = None;
                }
                _ => {}
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn runtime_connection(manager: State<'_, RuntimeManager>) -> Result<RuntimeConnection, String> {
    let inner = lock_runtime(manager.inner())?;
    let state = inner.state.clone().unwrap_or(RuntimeState::Starting);
    let (api_base, token) = match &state {
        RuntimeState::Ready { port, .. } => (
            Some(format!("http://127.0.0.1:{port}")),
            Some(inner.token.clone()),
        ),
        _ => (None, None),
    };
    Ok(RuntimeConnection {
        state,
        api_base,
        token,
        error: inner.error.clone(),
    })
}

#[tauri::command]
fn restart_runtime(app: AppHandle, manager: State<'_, RuntimeManager>) -> Result<(), String> {
    let child = {
        let mut inner = lock_runtime(manager.inner())?;
        inner.generation += 1;
        inner.state = Some(RuntimeState::Starting);
        inner.error = None;
        inner.child.take()
    };
    if let Some(child) = child {
        let _ = child.kill();
    }
    if let Err(error) = start_runtime(&app, manager.inner()) {
        mark_spawn_failure(manager.inner(), error.clone());
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
fn choose_learning_set_folder(app: AppHandle) -> Result<Option<String>, String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| {
            path.into_path()
                .map(|value| value.to_string_lossy().into_owned())
                .map_err(|error| error.to_string())
        })
        .transpose()
}

#[tauri::command]
fn reveal_in_finder(app: AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("STUDYFORGE_EXTERNAL_URL_INVALID".into());
    }
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|error| error.to_string())
}

pub fn run() {
    let manager = RuntimeManager::default();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(manager.clone())
        .invoke_handler(tauri::generate_handler![
            runtime_connection,
            restart_runtime,
            choose_learning_set_folder,
            reveal_in_finder,
            open_external_url,
        ])
        .setup(move |app| {
            if let Err(error) = start_runtime(app.handle(), &manager) {
                mark_spawn_failure(&manager, error);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running StudyForge");
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::sidecar::{
        DesktopPaths, LaunchEvent, RuntimeState, apply_event, build_launch, parse_ready_line,
    };

    #[test]
    fn parses_the_one_ready_line_without_accepting_extra_output() {
        let receipt = parse_ready_line(
            r#"{"type":"studyforge-ready","protocol":1,"port":43121,"workspace":"setup"}"#,
        )
        .expect("ready receipt");
        assert_eq!(receipt.port, 43121);
        assert_eq!(receipt.workspace, "setup");
        assert!(parse_ready_line("StudyForge M1: http://127.0.0.1:43121").is_err());
    }

    #[test]
    fn transitions_from_starting_to_ready_and_then_stopped_or_crashed() {
        let starting = RuntimeState::Starting;
        let ready = apply_event(
            starting,
            LaunchEvent::Ready(parse_ready_line(
                r#"{"type":"studyforge-ready","protocol":1,"port":43121,"workspace":"selected"}"#,
            )
            .unwrap()),
        );
        assert!(matches!(ready, RuntimeState::Ready { port: 43121, .. }));
        assert_eq!(
            apply_event(ready.clone(), LaunchEvent::Exited(0)),
            RuntimeState::Stopped
        );
        assert!(matches!(
            apply_event(ready, LaunchEvent::Exited(7)),
            RuntimeState::Crashed { code: Some(7) }
        ));
    }

    #[test]
    fn builds_an_explicit_isolated_sidecar_launch() {
        let launch = build_launch(
            DesktopPaths {
                app_home: PathBuf::from("/private/StudyForge"),
                documents_home: PathBuf::from("/Users/student/Documents/StudyForge"),
                resource_root: PathBuf::from(
                    "/Applications/StudyForge.app/Contents/Resources/studyforge",
                ),
                pi_binary: PathBuf::from(
                    "/Applications/StudyForge.app/Contents/MacOS/studyforge-pi",
                ),
            },
            "launch-token".into(),
        );
        assert_eq!(
            launch.arguments,
            vec![
                "--port",
                "0",
                "--app-home",
                "/private/StudyForge",
                "--documents-home",
                "/Users/student/Documents/StudyForge",
                "--resource-root",
                "/Applications/StudyForge.app/Contents/Resources/studyforge",
                "--token",
                "launch-token",
            ]
        );
        assert_eq!(
            launch.environment.get("PI_CODING_AGENT_DIR").unwrap(),
            "/private/StudyForge/agent"
        );
        assert_eq!(
            launch.environment.get("PI_SUBAGENT_PI_BINARY").unwrap(),
            "/Applications/StudyForge.app/Contents/MacOS/studyforge-pi"
        );
        assert_eq!(
            launch.environment.get("PI_PACKAGE_DIR").unwrap(),
            "/Applications/StudyForge.app/Contents/Resources/studyforge/pi-runtime"
        );
        assert!(
            !launch
                .environment
                .values()
                .any(|value| value.contains("/.pi"))
        );
    }
}
