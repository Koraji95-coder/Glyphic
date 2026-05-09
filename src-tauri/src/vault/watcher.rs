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
            // Backpressure: don't emit more than 1 event per second to prevent
            // Tauri's unbounded PostMessage queue from accumulating.
            let min_emit_interval = Duration::from_millis(1000);
            let mut pending: HashSet<String> = HashSet::new();
            let mut deadline: Option<Instant> = None;
            let mut last_emit: Option<Instant> = None;
            let mut emit_count = 0usize;

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
                                if !pending.is_empty() {
                                    // Backpressure check: only emit if min interval has elapsed since
                                    // last emit. This prevents Tauri's unbounded PostMessage queue
                                    // from accumulating if the WebView event loop is slow.
                                    let now = Instant::now();
                                    let can_emit = last_emit
                                        .map(|last| now.duration_since(last) >= min_emit_interval)
                                        .unwrap_or(true);

                                    if can_emit {
                                        // The frontend treats this event purely as a generic
                                        // "refresh tree" signal, so emitting once per burst avoids
                                        // flooding the webview message queue during large file changes.
                                        let sample_path = pending.iter().next().cloned().unwrap_or_default();
                                        pending.clear();
                                        emit_count += 1;
                                        eprintln!("[Vault Watcher] Emitting vault-changed (count: {}, backlog: {})", emit_count, 0);
                                        let _ = app_handle.emit(
                                            "vault-changed",
                                            VaultChangedPayload {
                                                event_type: "changed".to_string(),
                                                path: sample_path,
                                            },
                                        );
                                        last_emit = Some(now);
                                    } else {
                                        // Backlog: don't emit yet, keep pending items for next interval.
                                        eprintln!("[Vault Watcher] Backpressure: delaying emit (pending changes: {})", pending.len());
                                    }
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
