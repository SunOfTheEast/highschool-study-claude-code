use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

pub const PRESENTATION_EVENT: &str = "studyforge:companion-presentation";
pub const PLAYBACK_EVENT: &str = "studyforge:companion-playback";
pub const CONTROL_EVENT: &str = "studyforge:companion-control";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionPresentation {
    pub message_id: String,
    pub actor_id: String,
    pub text: String,
    pub expression: String,
    pub phase: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionPlayback {
    pub message_id: Option<String>,
    pub phase: String,
    pub muted: bool,
}

impl Default for CompanionPlayback {
    fn default() -> Self {
        Self {
            message_id: None,
            phase: "idle".into(),
            muted: false,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionControl {
    pub action: String,
    pub tex: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionSnapshot {
    pub presentation: Option<CompanionPresentation>,
    pub playback: CompanionPlayback,
}

#[derive(Debug, Default)]
pub struct CompanionState {
    pub presentation: Option<CompanionPresentation>,
    pub playback: CompanionPlayback,
}

impl CompanionState {
    fn present(&mut self, presentation: Option<CompanionPresentation>) {
        self.presentation = presentation;
    }

    fn finish(&mut self, message_id: &str) {
        if self
            .presentation
            .as_ref()
            .map(|value| value.message_id.as_str())
            == Some(message_id)
        {
            self.presentation = None;
        }
    }

    fn set_playback(&mut self, playback: CompanionPlayback) {
        if playback.phase == "idle"
            && let Some(message_id) = playback.message_id.as_deref()
        {
            self.finish(message_id);
        }
        self.playback = playback;
    }

    fn snapshot(&self) -> CompanionSnapshot {
        CompanionSnapshot {
            presentation: self.presentation.clone(),
            playback: self.playback.clone(),
        }
    }
}

#[derive(Clone, Default)]
pub struct CompanionManager {
    inner: Arc<Mutex<CompanionState>>,
}

fn lock_companion(
    manager: &CompanionManager,
) -> Result<std::sync::MutexGuard<'_, CompanionState>, String> {
    manager
        .inner
        .lock()
        .map_err(|_| "STUDYFORGE_COMPANION_STATE_UNAVAILABLE".to_string())
}

#[tauri::command]
pub fn companion_snapshot(
    manager: State<'_, CompanionManager>,
) -> Result<CompanionSnapshot, String> {
    Ok(lock_companion(manager.inner())?.snapshot())
}

#[tauri::command]
pub fn companion_present(
    app: AppHandle,
    manager: State<'_, CompanionManager>,
    presentation: Option<CompanionPresentation>,
) -> Result<bool, String> {
    if app.get_webview_window("companion").is_none() {
        return Ok(false);
    }
    lock_companion(manager.inner())?.present(presentation.clone());
    app.emit_to("companion", PRESENTATION_EVENT, presentation)
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn companion_set_playback(
    app: AppHandle,
    manager: State<'_, CompanionManager>,
    playback: CompanionPlayback,
) -> Result<(), String> {
    lock_companion(manager.inner())?.set_playback(playback.clone());
    if app.get_webview_window("main").is_some() {
        app.emit_to("main", PLAYBACK_EVENT, playback)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn companion_control(app: AppHandle, control: CompanionControl) -> Result<bool, String> {
    if app.get_webview_window("companion").is_none() {
        return Ok(false);
    }
    app.emit_to("companion", CONTROL_EVENT, control)
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "STUDYFORGE_MAIN_WINDOW_MISSING".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    let _ = window.unminimize();
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn show_companion_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("companion")
        .ok_or_else(|| "STUDYFORGE_COMPANION_WINDOW_MISSING".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_companion_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("companion")
        .ok_or_else(|| "STUDYFORGE_COMPANION_WINDOW_MISSING".to_string())?
        .hide()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn quit_studyforge(app: AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::{CompanionPlayback, CompanionPresentation, CompanionState};

    fn presentation(message_id: &str) -> CompanionPresentation {
        CompanionPresentation {
            message_id: message_id.into(),
            actor_id: "peer-axia".into(),
            text: "也许先比较一个反例。".into(),
            expression: "skeptical".into(),
            phase: "speaking".into(),
        }
    }

    #[test]
    fn finished_playback_clears_only_the_matching_live_presentation() {
        let mut state = CompanionState::default();
        state.present(Some(presentation("peer-1")));
        state.set_playback(CompanionPlayback {
            message_id: Some("older".into()),
            phase: "idle".into(),
            muted: false,
        });
        assert_eq!(state.presentation.as_ref().unwrap().message_id, "peer-1");
        state.set_playback(CompanionPlayback {
            message_id: Some("peer-1".into()),
            phase: "idle".into(),
            muted: false,
        });
        assert!(state.presentation.is_none());
    }
}
