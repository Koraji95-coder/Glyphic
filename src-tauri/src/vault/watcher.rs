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

        // Spawn a background thread that coalesces and forwards events.
        std::thread::spawn(move || {
            use std::collections::HashSet;
            let coalesce_window = Duration::from_millis(300);
            let mut pending: HashSet<String> = HashSet::new();
            let mut deadline: Option<Instant> = None;

            loop {
                // Wait either until the deadline or a default poll tick.
                let recv_timeout = match deadline {
                    Some(d) => d.saturating_duration_since(Instant::now()),
                    None => Duration::from_millis(200),
                };

                match rx.recv_timeout(recv_timeout) {
                    Ok(event) => {
                        for path in &event.paths {
                            let path_str = path.to_string_lossy().to_string();

                            // Ignore Glyphic internal files (DB, WAL/SHM, config, ai.toml, etc.)
                            // and atomic-write temp files.
                            if path_str.contains("/.glyphic/")
                                || path_str.contains("\\.glyphic\\")
                                || path_str.ends_with(".tmp")
                            {
                                continue;
                            }

                            pending.insert(path_str);
                        }
                        // Reset the coalesce deadline on every received event so a
                        // sustained burst extends the window.
                        deadline = Some(Instant::now() + coalesce_window);
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if let Some(d) = deadline {
                            if Instant::now() >= d {
                                // Drain and emit one event per unique path.
                                for path_str in pending.drain() {
                                    let _ = app_handle.emit(
                                        "vault-changed",
                                        VaultChangedPayload {
                                            event_type: "changed".to_string(),
                                            path: path_str,
                                        },
                                    );
                                }
                                deadline = None;
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Ok(Self { _watcher: watcher })
    }
}
