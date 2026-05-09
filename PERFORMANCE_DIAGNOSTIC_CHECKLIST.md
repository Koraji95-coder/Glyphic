# Glyphic Performance Diagnostic Checklist

Use this checklist to systematically gather environment and performance data. Provide results back to the agent for analysis.

---

## 1. Environment Baseline

### Quick Facts (5 min)

- [x] Windows version: Windows 11 22H2
- [?] Glyphic version: **NEED THIS** — Open Settings → About; note the build date and version number
- [x] App type: ☑ Tauri desktop (installed .exe)
- [?] CPU model: **NEED SCREENSHOT** — Task Manager → Performance tab, or open cmd: `wmic CPU get Name`
- [x] RAM installed: 16 GB
- [x] Disk space available in C:\ drive: 842 GB
- [x] GPU: ☑ Dedicated (7700XT Radeon)
- [x] Fresh install or upgrade: OS upgraded earlier in 2026; Glyphic updated today/ongoing
- [x] Recent changes: None reported

### Startup Time Measurement (2 min)

- [x] Time from clicking Glyphic icon to "app ready to interact": 30 seconds, but app never becomes fully ready
- [x] UI appears immediately but unresponsive: **YES**

---

## 2. Reproduce and Characterize the Lag

### Exact Lag Pattern (describe in detail)

- [x] When does lag occur?
  - [ ] Cold start only (first 10 seconds after launch)
  - [ ] Only when opening/expanding vault or large folder
  - [ ] Only when typing in editor
  - [ ] Only when waiting for ChatGPT response
  - [x] **Throughout the entire session consistently** ← KEY FINDING
  - [ ] Intermittent (sometimes responsive, sometimes frozen)

- [x] How long does lag typically last? **Never stops — persistent lag throughout session**
- [x] Does it worsen over time in a long session? **Never stops — consistent**
- [x] Does it happen with all features or specific ones? **All features affected**

### Quick Comparison Test (5 min)

- [x] Open chat.openai.com on the same machine in a browser: Yes
- [x] Try typing and waiting for a response: Yes
- [x] Everything else on computer is smooth — **Glyphic-specific issue confirmed**

---

## 3. Resource Monitoring (during lag occurrence)

### Launch Task Manager or Resource Monitor

- [ ] Open Task Manager (Ctrl+Shift+Esc)
- [ ] Go to **Performance** tab
- [ ] Note the current CPU, RAM, and Disk values
- [ ] Go to **Processes** tab, right-click Glyphic process (likely "glyphic.exe" or "Tauri Runtime"), select **Properties** → **Details**
- [ ] Note the PID for reference

### Cold Start Monitoring (restart Glyphic and watch for 15 seconds)

- [ ] CPU usage at startup: \_\_\_% (peak)
- [ ] Memory used by Glyphic process: \_\_\_ MB
- [ ] Disk I/O active? ☐ Yes (reading which files?) ☐ No
- [ ] Network traffic during startup? ☐ Yes ☐ No

### Lag Occurrence Monitoring (reproduce lag, watch Task Manager)

- [ ] CPU spike during lag? ☐ Yes (which process?) ☐ No
- [ ] Memory usage during lag: \_\_\_ MB
- [ ] Disk I/O spike? ☐ Yes ☐ No
- [ ] Network spike? ☐ Yes ☐ No
- [ ] Does lag resolve when you wait, or does it stay frozen until you force-quit?

### Memory Leak Check (leave Glyphic open for 5–10 minutes, use normally)

- [ ] Memory at start: \_\_\_ MB
- [ ] Memory after 10 min: \_\_\_ MB
- [ ] Growing continuously or stable? (steady = OK, growing = leak)

### Network Baseline Test (5 min)

- [ ] Open PowerShell and run: `ping -n 4 api.openai.com`
  - [ ] Average latency: \_\_\_ ms
  - [ ] Packet loss: \_\_\_%
- [ ] Run: `ping -n 4 chat.openai.com`
  - [ ] Average latency: \_\_\_ ms
  - [ ] Packet loss: \_\_\_%
- [ ] Using VPN? ☐ Yes ☐ No
- [ ] Using corporate proxy? ☐ Yes ☐ No

**⚠️ CRITICAL FINDING — Memory Leak Detected:**

- [x] Network baseline: **No packet loss, latency normal — network is NOT the issue**
- [x] Memory at idle startup: ~100 MB
- [x] Memory after light use (no interaction): **Grows to 500+ MB**
- [x] **Growing without user action — strong indicator of memory leak in background process**

### Additional Memory Leak Questions (To Narrow Down Leak Type)

- [ ] Does memory ever stabilize at 500 MB, or does it keep growing indefinitely?
- [ ] If you force-kill Glyphic and relaunch, does memory growth start again from 100 MB?
- [ ] Does this happen on a *fresh* new vault, or only when opening the existing Glyphic vault with ~10 notes?
- [ ] Can you open Glyphic, wait 30 seconds (until unresponsive), then take a Task Manager screenshot showing:
  - [ ] Glyphic memory value (MB) at that point
  - [ ] Virtual memory / page file usage
  - [ ] Any other processes showing memory spikes?

---

## 4. Logs and Error Messages

### Find Glyphic Logs

- [ ] On Windows, log files are typically in `%AppData%\Glyphic\logs`
- [ ] Open File Explorer and paste: `%AppData%\Glyphic\logs` in the address bar
- [ ] Or navigate: `C:\Users\<YourUsername>\AppData\Roaming\Glyphic\logs`

### Examine Recent Logs

- [ ] Open the most recent `.log` file (highest date/time)
- [ ] Look for any of these keywords and note occurrences:
  - [ ] `ERROR` or `error` — copy the first 3 errors and their timestamps
  - [ ] `timeout` or `Timeout` — copy line(s)
  - [ ] `reconnect` or `retry` — how many times? (indicates auth loop)
  - [ ] `vault` and `index` together — is reindexing running?
  - [ ] `panic` or `thread` — crash-like entries?
- [ ] Note the time of app startup and any lag period — are there corresponding log entries?

### Browser Console (if using browser version)

- [ ] Open DevTools (F12)
- [ ] Go to **Console** tab
- [ ] Look for red `[error]` messages or yellow `[warn]` messages
- [ ] Go to **Network** tab, filter by XHR/Fetch
- [ ] Look for failed requests (red status codes like 500, 403, timeout)

---

## 5. Common Culprits to Rule Out

### Background Processes

- [ ] Task Manager → Processes tab
- [ ] Sort by CPU or Memory usage (highest first)
- [ ] Note any high-usage processes (not Glyphic):
  - [ ] Windows Defender/Antivirus: \_\_\_\_\_\_\_% CPU
  - [ ] OneDrive/Sync: \_\_\_\_\_\_\_% CPU
  - [ ] Browser: \_\_\_\_\_\_\_% CPU
  - [ ] IDE/Editor (VSCode): \_\_\_\_\_\_\_% CPU
  - [ ] Indexing Service (Windows Search): \_\_\_\_\_\_\_% CPU

### Antivirus/Security Software

- [ ] Does your system have real-time scanning enabled? ☐ Yes ☐ No
- [ ] Try temporarily disabling it (or whitelist Glyphic.exe) and retest startup
- [ ] Did performance improve? ☐ Yes ☐ No ☐ Unsure

### Browser Extensions (if browser-based)

- [ ] Disable all extensions and reload Glyphic page
- [ ] Is lag reduced? ☐ Yes ☐ No
- [ ] Re-enable extensions one by one to identify culprit

### Hardware Acceleration

- [ ] Windows: Open Settings → System → Display → Advanced Display Settings
- [ ] Check "Use hardware acceleration when available"
  - [ ] Currently: ☐ On ☐ Off
  - [ ] Try toggling and retest

### Vault Size and Indexing

- [ ] Vault location: \_\_\_\_\_\_\_
- [ ] Approximate number of notes: \_\_\_\_\_\_\_ (rough guess)
- [ ] Approximate total vault size: \_\_\_\_\_\_\_ MB
- [ ] When you restart Glyphic, watch logs for reindexing — how long does it take?

### ChatGPT Integration

- [ ] Open Settings → Chat/AI
- [ ] Is ChatGPT integration enabled? ☐ Yes ☐ No
- [ ] If enabled, are you logged in? ☐ Yes ☐ No
- [ ] Try disabling ChatGPT integration, restart, and retest startup
- [ ] Did lag improve? ☐ Yes ☐ No

---

## 6. Summary for Agent Analysis

Paste your findings below (use copy-paste from checklist above):

```md
ENVIRONMENT:
- OS: Windows 11 22H2
- Glyphic version: [NEED THIS]
- CPU: [NEED CPU MODEL from screenshot]
- RAM: 16 GB
- Disk available: 842 GB
- Fresh install / Upgrade date: OS upgraded earlier 2026, Glyphic updated today

LAG PATTERN:
- Lag occurs during: ALL features, throughout entire session consistently
- Frequency: Always (never stops)
- Duration: Never stops — persistent
- Comparison with chat.openai.com: chat.openai.com is smooth; Glyphic-specific issue

RESOURCE DATA (CRITICAL):
- Cold start CPU peak: [NEED Task Manager snapshot]
- Cold start memory: ~100 MB → grows to 500+ MB (idle, no user action)
- Lag CPU spike: [NEED Task Manager snapshot]
- Memory growth: YES — MEMORY LEAK CONFIRMED (grows without interaction)
- Network latency to api.openai.com: Normal (no packet loss)

LOG FINDINGS:
- [NEED log file from %AppData%\Glyphic\logs]
- Look for errors, timeouts, auth retries, vault indexing
- Note timestamps around startup and lag periods

CULPRITS RULED OUT:
- Network issues: ✅ No packet loss, normal latency
- Browser extensions: N/A (Tauri desktop app)
- VPN/Proxy: ✅ None in use
- Antivirus: [NEED to check Task Manager]
- Hardware acceleration: [NEED to check]
- ChatGPT integration: [NEED to test with disabled]
- Vault indexing: [NEED to check logs]
```

---

## 7. Quick-Start (Start Here)

If you want to start immediately, prioritize these steps (20 minutes total):

1. **Note environment baseline** (Section 1, "Quick Facts" only) — 5 min
2. **Characterize lag** (Section 2, "Exact Lag Pattern") — 5 min
3. **Check Task Manager during startup** (Section 3, "Cold Start Monitoring") — 5 min
4. **Look at recent logs** (Section 4, "Find Glyphic Logs") — 5 min
5. **Share findings** with agent using the summary template

Once you provide this data, the agent can analyze it and suggest targeted fixes rather than making more guesses in the code.

---

## 8. Advanced Diagnostic Tools (Optional)

If you want more granular data, use:

- **Windows Performance Analyzer** — Record a trace during startup (advanced, ~1 hour learning curve)
- **Wireshark** — Capture network traffic to see what's being fetched (advanced, ~2 hour learning curve)
- **Glyphic debug logs** — Enable verbose logging in `src-tauri/src/main.rs` and rebuild (requires dev build)

Start with Sections 1–6 above; escalate to advanced tools only if findings are inconclusive.
