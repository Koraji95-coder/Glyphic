use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use chrono::Utc;

/// Simple instrumentation for tracking event emissions and memory usage
pub struct EventDiagnostics {
    event_counts: Arc<Mutex<HashMap<String, usize>>>,
    last_logged: Arc<Mutex<std::time::Instant>>,
}

impl EventDiagnostics {
    pub fn new() -> Self {
        Self {
            event_counts: Arc::new(Mutex::new(HashMap::new())),
            last_logged: Arc::new(Mutex::new(std::time::Instant::now())),
        }
    }

    pub fn log_event(&self, event_name: &str) {
        if let Ok(mut counts) = self.event_counts.lock() {
            *counts.entry(event_name.to_string()).or_insert(0) += 1;
            let count = counts[event_name];

            // Log every event for the first 100, then every 10th
            if count <= 100 || count % 10 == 0 {
                eprintln!("[EVENT] {} emitted (total: {})", event_name, count);
            }
        }

        // Periodically dump summary
        if let Ok(mut last) = self.last_logged.lock() {
            let now = std::time::Instant::now();
            if now.duration_since(*last).as_secs() >= 5 {
                *last = now;
                if let Ok(counts) = self.event_counts.lock() {
                    eprintln!("[DIAGNOSTICS] Event counts at {}:", Utc::now());
                    for (name, count) in counts.iter() {
                        eprintln!("  {}: {}", name, count);
                    }
                }
            }
        }
    }
}

impl Default for EventDiagnostics {
    fn default() -> Self {
        Self::new()
    }
}
