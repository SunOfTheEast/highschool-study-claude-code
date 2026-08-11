use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

const PREFIX: &str = "studyforge.calendar.";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarNotificationRequest {
    pub id: String,
    pub appointment_id: String,
    pub revision: u64,
    pub fire_at_epoch_ms: u64,
    pub title: String,
    pub body: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarLaunchIntent {
    pub appointment_id: String,
    pub revision: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarNotificationStatus {
    pub permission: &'static str,
    pub scheduled: usize,
}

#[derive(Clone, Default)]
pub struct CalendarNotificationState {
    launch: Arc<Mutex<Option<CalendarLaunchIntent>>>,
}

pub fn notification_id(appointment_id: &str, revision: u64, phase: &str) -> String {
    format!("{PREFIX}{appointment_id}.{revision}.{phase}")
}

pub fn parse_notification_id(value: &str) -> Option<CalendarLaunchIntent> {
    let value = value.strip_prefix(PREFIX)?;
    let mut parts = value.rsplitn(3, '.');
    let phase = parts.next()?;
    if phase != "advance" && phase != "due" {
        return None;
    }
    let revision = parts.next()?.parse().ok()?;
    if revision == 0 {
        return None;
    }
    let appointment_id = parts.next()?.to_string();
    if appointment_id.is_empty() {
        return None;
    }
    Some(CalendarLaunchIntent {
        appointment_id,
        revision,
    })
}

pub fn install(app: &AppHandle, state: &CalendarNotificationState) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let delegate = platform::install(app.clone(), state.launch.clone());
        let _ = objc2::rc::Retained::into_raw(delegate);
    }
    Ok(())
}

#[tauri::command]
pub async fn reconcile_calendar_notifications(
    requests: Vec<CalendarNotificationRequest>,
) -> Result<CalendarNotificationStatus, String> {
    for request in &requests {
        let expected_advance = notification_id(&request.appointment_id, request.revision, "advance");
        let expected_due = notification_id(&request.appointment_id, request.revision, "due");
        if request.id != expected_advance && request.id != expected_due {
            return Err("CALENDAR_NOTIFICATION_ID_INVALID".into());
        }
        if request.title.trim().is_empty() || request.body.trim().is_empty() {
            return Err("CALENDAR_NOTIFICATION_TEXT_REQUIRED".into());
        }
    }

    #[cfg(target_os = "macos")]
    {
        return tauri::async_runtime::spawn_blocking(move || platform::reconcile(requests))
            .await
            .map_err(|error| error.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    Ok(CalendarNotificationStatus {
        permission: "unsupported",
        scheduled: 0,
    })
}

#[tauri::command]
pub fn take_calendar_launch_intent(
    state: State<'_, CalendarNotificationState>,
) -> Result<Option<CalendarLaunchIntent>, String> {
    state.inner()
        .launch
        .lock()
        .map_err(|_| "CALENDAR_NOTIFICATION_STATE_UNAVAILABLE".to_string())
        .map(|mut value| value.take())
}

#[cfg(target_os = "macos")]
mod platform {
    use std::{
        collections::HashSet,
        ptr::NonNull,
        sync::{Arc, Mutex, mpsc},
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    use block2::{DynBlock, RcBlock};
    use objc2::{DefinedClass, MainThreadMarker, MainThreadOnly, define_class, msg_send};
    use objc2::rc::Retained;
    use objc2::runtime::ProtocolObject;
    use objc2_foundation::{NSArray, NSError, NSObject, NSObjectProtocol, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNMutableNotificationContent, UNNotificationRequest,
        UNNotificationResponse, UNNotificationSound, UNTimeIntervalNotificationTrigger,
        UNUserNotificationCenter, UNUserNotificationCenterDelegate,
    };
    use tauri::{AppHandle, Manager};

    use super::{
        CalendarLaunchIntent, CalendarNotificationRequest, CalendarNotificationStatus, PREFIX,
        parse_notification_id,
    };

    pub struct DelegateIvars {
        app: AppHandle,
        launch: Arc<Mutex<Option<CalendarLaunchIntent>>>,
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[ivars = DelegateIvars]
        pub struct CalendarNotificationDelegate;

        unsafe impl NSObjectProtocol for CalendarNotificationDelegate {}

        unsafe impl UNUserNotificationCenterDelegate for CalendarNotificationDelegate {
            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion: &DynBlock<dyn Fn()>,
            ) {
                let identifier = response.notification().request().identifier().to_string();
                if let Some(intent) = parse_notification_id(&identifier) {
                    if let Ok(mut pending) = self.ivars().launch.lock() {
                        *pending = Some(intent);
                    }
                    if let Some(window) = self.ivars().app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                completion.call(());
            }
        }
    );

    impl CalendarNotificationDelegate {
        fn new(
            app: AppHandle,
            launch: Arc<Mutex<Option<CalendarLaunchIntent>>>,
        ) -> Retained<Self> {
            let marker = MainThreadMarker::new().expect("notification delegate requires main thread");
            let this = Self::alloc(marker).set_ivars(DelegateIvars { app, launch });
            unsafe { msg_send![super(this), init] }
        }
    }

    pub fn install(
        app: AppHandle,
        launch: Arc<Mutex<Option<CalendarLaunchIntent>>>,
    ) -> Retained<CalendarNotificationDelegate> {
        let delegate = CalendarNotificationDelegate::new(app, launch);
        UNUserNotificationCenter::currentNotificationCenter().setDelegate(Some(
            ProtocolObject::from_ref(&*delegate),
        ));
        delegate
    }

    fn permission(center: &UNUserNotificationCenter) -> Result<bool, String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        let completion = RcBlock::new(move |granted, _error: *mut NSError| {
            let _ = sender.send(granted);
        });
        center.requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
            &completion,
        );
        receiver
            .recv_timeout(Duration::from_secs(60))
            .map(|value| value.as_bool())
            .map_err(|_| "CALENDAR_NOTIFICATION_PERMISSION_TIMEOUT".to_string())
    }

    fn pending_ids(center: &UNUserNotificationCenter) -> Result<Vec<String>, String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        let completion = RcBlock::new(
            move |requests: NonNull<NSArray<UNNotificationRequest>>| {
                let requests = unsafe { requests.as_ref() };
                let ids = requests
                    .iter()
                    .map(|request| request.identifier().to_string())
                    .collect();
                let _ = sender.send(ids);
            },
        );
        center.getPendingNotificationRequestsWithCompletionHandler(&completion);
        receiver
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "CALENDAR_NOTIFICATION_QUERY_TIMEOUT".to_string())
    }

    pub fn reconcile(
        requests: Vec<CalendarNotificationRequest>,
    ) -> Result<CalendarNotificationStatus, String> {
        let center = UNUserNotificationCenter::currentNotificationCenter();
        if !permission(&center)? {
            return Ok(CalendarNotificationStatus {
                permission: "denied",
                scheduled: 0,
            });
        }
        let desired = requests.iter().map(|request| request.id.as_str()).collect::<HashSet<_>>();
        let stale = pending_ids(&center)?
            .into_iter()
            .filter(|id| id.starts_with(PREFIX) && !desired.contains(id.as_str()))
            .map(|id| NSString::from_str(&id))
            .collect::<Vec<_>>();
        if !stale.is_empty() {
            center.removePendingNotificationRequestsWithIdentifiers(
                &NSArray::from_retained_slice(&stale),
            );
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "CALENDAR_NOTIFICATION_CLOCK_INVALID".to_string())?
            .as_millis() as u64;
        let mut scheduled = 0;
        for request in requests {
            if request.fire_at_epoch_ms <= now {
                continue;
            }
            let content = UNMutableNotificationContent::new();
            content.setTitle(&NSString::from_str(&request.title));
            content.setBody(&NSString::from_str(&request.body));
            content.setSound(Some(&UNNotificationSound::defaultSound()));
            let trigger = UNTimeIntervalNotificationTrigger::triggerWithTimeInterval_repeats(
                (request.fire_at_epoch_ms - now) as f64 / 1000.0,
                false,
            );
            let notification = UNNotificationRequest::requestWithIdentifier_content_trigger(
                &NSString::from_str(&request.id),
                &content,
                Some(&trigger),
            );
            center.addNotificationRequest_withCompletionHandler(&notification, None);
            scheduled += 1;
        }
        Ok(CalendarNotificationStatus {
            permission: "granted",
            scheduled,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{notification_id, parse_notification_id};

    #[test]
    fn deterministic_identifiers_round_trip() {
        let id = notification_id("appointment.with-dots", 7, "advance");
        assert_eq!(id, "studyforge.calendar.appointment.with-dots.7.advance");
        let parsed = parse_notification_id(&id).unwrap();
        assert_eq!(parsed.appointment_id, "appointment.with-dots");
        assert_eq!(parsed.revision, 7);
        assert!(parse_notification_id("studyforge.calendar.bad.0.due").is_none());
        assert!(parse_notification_id("other").is_none());
    }
}
