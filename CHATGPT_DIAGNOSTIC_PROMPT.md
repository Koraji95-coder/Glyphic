# ChatGPT Memory Leak Investigation Prompt

## Context
The Glyphic desktop app (Tauri 2 + React 19 + Rust) has a **confirmed memory leak** where the process grows from ~100 MB to 500+ MB within 60 seconds of idle startup, with no user interaction.

**Key Facts:**
- OS: Windows 11 22H2
- App: Tauri desktop build (not browser)
- RAM: 16 GB (plenty available)
- CPU: Stays low (~1-5%) during leak — rules out heavy computation
- Network: No packet loss, latency normal — not a network issue
- Lag pattern: Persistent throughout session, all features affected, impossible to interact with after 30 seconds
- Antivirus/extensions/VPN: None active
- Comparison: chat.openai.com on same machine is smooth; Glyphic-specific issue

## Diagnostics Performed
1. ✅ Task Manager monitoring: **Memory climbs steadily, only Glyphic process grows, CPU minimal**
2. ✅ Network baseline: **No packet loss, normal latency**
3. ✅ No background processes: Antivirus, indexing, sync all inactive
4. ✅ Code fix attempted: Converted vault `reindex_vault` from staged Vec accumulation to streaming/chunked processing — **still no improvement**

## Code Details

**Architecture:**
- Frontend: React 19 + TypeScript + Zustand state
- Backend: Tauri + Rust + tokio async + rusqlite FTS5
- Sidecar: Python LLM engines (vault_engine, diagram_engine, study_engine)
- IPC: Tauri invoke commands + event listeners (onVaultChanged, onChatStream*)

**Git Branch:** `chore/feat--fix-PostMessage-queue-pressure,-eliminate-redundant-Ollama-calls,-add-FE-Prep-validators`
(The branch name "fix-PostMessage-queue-pressure" is a strong hint that Tauri's IPC message queue is the issue)

**Recent Changes:**
- Removed duplicate vault reindex from backend (kept frontend-triggered reindex only)
- Disabled React.StrictMode in Tauri runtime only
- Added global shortcut fallback logic with runtime store
- Implemented incremental folder rendering for large trees
- Fixed ReferenceModal mount-time effects

**File Candidates for Memory Leak:**
- `src-tauri/src/vault/watcher.rs` — background thread emitting vault-changed events; uses MPSC channel + coalescing
- `src-tauri/src/commands/ai_commands.rs` — stream event emission (ChatStreamChunk, ChatStreamDone)
- `src/App.tsx` — event listeners registered via events.onVaultChanged, events.onChatStreamChunk, etc.
- `src/stores/chatStore.ts` — stream listener registration (multiple event handlers per message)
- `src-tauri/src/db/index.rs` — vault indexing (FIXED: changed from staged Vec to streaming, but leak persists)

## Question for ChatGPT
Given this Tauri + React architecture with confirmed memory leak (100MB → 500MB idle, low CPU, no external load):

1. **Tauri IPC/PostMessage Analysis:**
   - Could the Tauri event broadcast queue (`app.emit()`) be accumulating unprocessed messages if listeners are slow or not draining fast enough?
   - Is there a known issue with `app_handle.emit()` in Tauri 2.10.1 where events buffer in memory?
   - Should there be a maximum queue size or backpressure mechanism to prevent queue unbounded growth?

2. **Background Thread + Channel Analysis:**
   - The vault watcher spawns a background thread with an MPSC channel that emits "vault-changed" events every 200-300ms
   - Could this channel itself accumulate messages if the frontend listener (onVaultChanged) isn't consuming fast enough?
   - Is there a risk that the event loop is sending faster than React can process, causing a queue buildup?

3. **Stream Event Listener Accumulation:**
   - For each AI chat stream, the backend emits multiple ChatStreamChunk events
   - Each frontend listener is registered with `events.onChatStreamChunk(...).then(unlisten => cleanup = unlisten)`
   - Could there be a scenario where listeners aren't being unregistered properly on stream end/cancel?
   - Is there a known issue with Tauri event listener cleanup in React useEffect?

4. **Rust Memory Profiling:**
   - Can you suggest Rust memory profiling tools (valgrind, heaptrack, perf) that work on Windows for Tauri apps?
   - How would I enable verbose logging in the Tauri app to see what's being emitted and when?

5. **Hypothesis Validation:**
   - If the PostMessage queue is the culprit, what would be the right fix? (backpressure? async queue drain? rate limiting on emit?)
   - Should we add metrics/logging to track how many events are queued vs. consumed?

## Additional Context
- Vault size: ~10 notes (TEST.md only visible), small enough that indexing should complete in <1 second
- The lag appears instantly on startup, suggesting it's not vault-dependent but a fundamental loop or listener accumulation
- When you try to interact with the UI, it's unresponsive (frozen), not slow — suggests event loop blocked

## Request
Please investigate the three most likely causes based on the code structure:
1. Tauri IPC queue accumulation (PostMessage backlog)
2. Vault watcher MPSC channel not draining fast enough
3. Event listener registration/cleanup bugs in React useEffect or Tauri API

If you have other hypotheses or see issues in the code provided, please point them out.
