use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
struct VaultChangedPayload {
    event_type: String,
    path: String,
}

pub struct VaultWatcher {
    _watcher: RecommendedWatcher,
}

impl VaultWatcher {
    pub fn start(vault_path: String, app_handle: tauri::AppHandle) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel::<Event>();

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        })
        .map_err(|e| format!("Failed to create watcher: {e}"))?;

        watcher
            .watch(Path::new(&vault_path), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch vault: {e}"))?;

        // Spawn a background thread that debounces and forwards events.
        std::thread::spawn(move || {
            let debounce = Duration::from_millis(500);
            let mut last_emit = Instant::now() - debounce;

            loop {
                match rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(event) => {
                        // Debounce
                        if last_emit.elapsed() < debounce {
                            continue;
                        }

                        for path in &event.paths {
                            let path_str = path.to_string_lossy().to_string();

                            // Ignore database and temp files
                            if path_str.contains("index.db") || path_str.ends_with(".tmp") {
                                continue;
                            }

                            let event_type = format!("{:?}", event.kind);

                            let _ = app_handle.emit(
                                "vault-changed",
                                VaultChangedPayload {
                                    event_type,
                                    path: path_str,
                                },
                            );

                            last_emit = Instant::now();
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => continue,
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Ok(Self { _watcher: watcher })
    }
}
