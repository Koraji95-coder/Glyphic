# Agent Integration Test Suite — Glyphic Phase 1

## Overview

This document describes the integration test suite for the 5-agent system (Sage, Scout, Forge, Prism, Pathfinder) and supporting infrastructure (embedding engine, search orchestration).

**Test Coverage**: 60+ test cases across 4 test modules
- Tauri command registration and routing: 18 tests
- Embedding engine (Python ML sidecar): 30+ tests
- Scout semantic search orchestration: 25+ tests
- Multi-agent orchestration and policies: 35+ tests

**Total**: 100+ test cases

## Test Modules

### 1. `frontend/src-tauri/__tests__/commands_integration.rs` (18 tests)

**Purpose**: Verify Tauri command registration, agent routing, and error handling.

**Test Categories**:

#### A. Agent Command Registration (5 tests)
- `test_sage_command_registers` — Verify `agent_ask_sage` command exists and accessible
- `test_scout_command_registers` — Verify `agent_search_scout` command exists
- `test_forge_command_registers` — Verify `agent_generate_forge` command exists
- `test_prism_command_registers` — Verify `agent_evaluate_prism` command exists
- `test_pathfinder_command_registers` — Verify `agent_plan_pathfinder` command exists

**Acceptance Criteria**:
- All 5 commands present in AppHandle registry
- Correct function signatures
- Commands callable with proper input/output types

#### B. Agent Command Flow (5 tests)
- `test_sage_command_flow_explanation` — Test Sage explanation generation with prerequisites
- `test_scout_command_flow_search` — Test Scout semantic search result ranking
- `test_forge_command_flow_problem_generation` — Test Forge adaptive problem creation
- `test_prism_command_flow_evaluation` — Test Prism solution grading and feedback
- `test_pathfinder_command_flow_path_generation` — Test Pathfinder learning path A*

**Acceptance Criteria**:
- All response structs match expected schema
- Confidence gates applied (0.65 threshold)
- Latency budgets met (see latency section below)

#### C. Error Handling (4 tests)
- `test_agent_error_confidence_gate_rejection` — Test low confidence rejection
- `test_agent_error_network_timeout` — Test timeout handling
- `test_agent_error_invalid_input` — Test input validation
- `test_agent_routing_correct_selection` — Test orchestrator routing logic

**Acceptance Criteria**:
- All errors return proper error responses
- Fallback behavior executed
- No silent failures

#### D. Integration & Performance (4 tests)
- `test_agent_streaming_response` — Test Sage response streaming
- `test_integration_full_workflow` — Test 5-agent pipeline end-to-end
- `test_performance_command_latency` — Test latency budgets
- `test_error_recovery_fallback` — Test fallback chain execution

**Acceptance Criteria**:
- Sage streams first chunk < 2s
- Scout search < 500ms
- Full workflow completes without errors

**Run Command**:
```bash
cd frontend/src-tauri
cargo test --test commands_integration
```

---

### 2. `backend/sidecars/embedding_engine/tests/test_embedding_engine.py` (30+ tests)

**Purpose**: Test embedding model loading, inference, and sqlite-vec storage integration.

**Test Categories**:

#### A. Model Loading (3 tests)
- `test_model_loads_on_startup` — Verify all-MiniLM-L6-v2 loads (< 30s)
- `test_model_handles_memory_efficiently` — Verify CPU-only, float32, batch=32
- `test_model_startup_timeout` — Verify 30s timeout enforced

**Acceptance Criteria**:
- Model loaded in < 30s on first run
- No GPU memory allocated
- Model ready for inference

#### B. Embedding Generation (5 tests)
- `test_generate_embedding_single_text` — Test single embedding (384 dims, L2 normalized)
- `test_embedding_semantic_similarity` — Test cosine similarity (sim > 0.7 for related texts)
- `test_embedding_generation_latency` — Test < 50ms single, < 200ms batch/100
- `test_batch_embedding_generation` — Test 1000 embeddings in < 500ms
- `test_empty_text_handling` — Test edge case: empty string
- `test_long_text_truncation` — Test truncation at 128 tokens

**Acceptance Criteria**:
- All embeddings 384-dimensional
- All embeddings normalized (L2 norm ≈ 1.0)
- Latency budgets met
- No errors on edge cases

#### C. NDJSON Protocol (4 tests)
- `test_ndjson_request_parsing` — Test JSON parsing of stdin requests
- `test_ndjson_response_format` — Test stdout response format
- `test_ndjson_error_response` — Test error response format
- `test_ndjson_multiple_requests` — Test sequential request handling

**Acceptance Criteria**:
- Request: `{"action": "embed", "texts": [...], "batch_id": "b123"}`
- Response: `{"batch_id": "b123", "embeddings": [...], "status": "ok", "latency_ms": N}`
- Error: `{"batch_id": "b123", "error": "...", "status": "error"}`
- No data loss between requests

#### D. sqlite-vec Integration (4 tests)
- `test_vector_storage_schema` — Verify embeddings_vectors table schema
- `test_vector_insertion` — Test inserting embeddings into sqlite-vec
- `test_similarity_search_query` — Test k-NN search with distance ordering
- `test_vector_reindex_performance` — Test reindexing 1000 vectors in < 500ms

**Acceptance Criteria**:
- Schema includes BLOB embeddings column
- Insertions succeed without errors
- k-NN queries return sorted by distance
- Reindex completes within budget

#### E. Error Handling (3 tests)
- `test_out_of_memory_handling` — Test OOM gracefully
- `test_malformed_json_handling` — Test invalid JSON rejection
- `test_missing_required_field` — Test validation of required fields
- `test_invalid_action_handling` — Test unknown action rejection
- `test_unicode_text_handling` — Test unicode input support

**Acceptance Criteria**:
- All errors caught and returned in error response
- No crashes on malformed input
- Unicode text embedded successfully

#### F. Integration (3 tests)
- `test_full_embedding_pipeline` — Test receive → embed → store → search
- `test_concurrent_requests_handling` — Test multiple concurrent requests
- `test_model_persistence` — Test model stays loaded across requests

**Acceptance Criteria**:
- Pipeline completes end-to-end
- Concurrent requests don't interfere
- Model loaded once, reused across requests

**Run Command**:
```bash
cd backend/sidecars/embedding_engine
python -m pytest tests/test_embedding_engine.py -v
```

---

### 3. `backend/sidecars/search_orchestrator/tests/test_scout_integration.py` (25+ tests)

**Purpose**: Test Scout semantic search orchestration, ranking, and fallback behavior.

**Test Categories**:

#### A. Search Flow (4 tests)
- `test_scout_search_receive_and_embed_query` — Test query reception and embedding
- `test_scout_search_retrieves_top_k` — Test top-3 retrieval
- `test_scout_ranking_formula_components` — Test weighted ranking (semantic 50%, mastery_gap 30%, recency 10%, diversity 10%)
- `test_scout_confidence_score_calculation` — Test confidence = avg(semantic, mastery_factor, recency)

**Acceptance Criteria**:
- Query embedded successfully
- Top-3 results returned sorted by overall_rank
- Ranking formula weights sum to 1.0
- Confidence calculated correctly

#### B. Confidence Gate (2 tests)
- `test_scout_low_confidence_handling` — Test rejection when all confidence < 0.65
- Fallback triggered when gate rejects

**Acceptance Criteria**:
- Gate threshold: 0.65
- Fallback to FTS5 on rejection

#### C. FTS5 Fallback (3 tests)
- `test_semantic_search_fails_embedding_unavailable` — Test fallback on embedding timeout
- `test_fts5_search_with_keyword_query` — Test FTS5 search execution (< 50ms)
- `test_hybrid_search_combining_both` — Test hybrid rank = 0.7*semantic + 0.3*fts5

**Acceptance Criteria**:
- Fallback triggered on timeout
- FTS5 results < 50ms
- Hybrid correctly weighted

#### D. Response Format (3 tests)
- `test_search_result_fields` — Verify SearchResult struct fields
- `test_snippet_highlighting` — Verify query terms highlighted in snippet
- `test_search_latency_measurement` — Verify latency breakdown reported

**Acceptance Criteria**:
- All fields present: id, note_id, title, snippet, scores, confidence, source
- Query terms highlighted with `<mark>`
- Latency breakdown: query_embedding_time_ms, db_query_time_ms, ranking_time_ms

#### E. Edge Cases (7 tests)
- `test_empty_query_handling` — Test empty query rejection
- `test_very_long_query_handling` — Test query truncation (> 1000 chars)
- `test_special_characters_in_query` — Test special char escaping
- `test_unicode_query_handling` — Test unicode query support
- `test_empty_database_handling` — Test search on empty database
- `test_single_result_handling` — Test result count < 3
- `test_duplicate_results_handling` — Test deduplication by note_id

**Acceptance Criteria**:
- Empty query rejected with error
- Queries > 1000 chars truncated
- Special chars escaped for FTS5
- Unicode queries embed successfully
- Empty DB returns empty results (no crash)
- Results not padded if < 3

#### F. Concurrency & Monitoring (3 tests)
- `test_multiple_searches_in_flight` — Test non-interference
- `test_search_with_active_indexing` — Test search during reindex
- `test_search_performance_tracking` — Test p50, p95, p99 latencies

**Acceptance Criteria**:
- Concurrent searches have correct results
- No deadlocks during concurrent operations
- Performance metrics tracked

**Run Command**:
```bash
cd backend/sidecars/search_orchestrator
python -m pytest tests/test_scout_integration.py -v
```

---

### 4. `backend/sidecars/agent_orchestrator/tests/test_agents_integration.py` (35+ tests)

**Purpose**: Test all 5 agents individually, multi-agent coordination, and policy enforcement.

**Test Categories**:

#### A. Sage Agent (6 tests)
- `test_sage_receives_query_with_context` — Test input with optional context
- `test_sage_generates_explanation_with_latex` — Test LaTeX formatting in output
- `test_sage_links_prerequisites` — Test prerequisite identification
- `test_sage_confidence_scoring` — Test source-based confidence (vault 0.90, textbook 0.85, generated 0.60)
- `test_sage_enforces_confidence_gate` — Test rejection when confidence < 0.65
- `test_sage_streaming_response` — Test streaming: first chunk < 2s, total < 15s

**Acceptance Criteria**:
- Output includes LaTeX markers ($$...$$ for block, $...$ for inline)
- Prerequisites linked with URLs
- Confidence assigned based on source
- Gate enforced: error if confidence < 0.65
- Streaming chunks incremental and valid

#### B. Forge Agent (6 tests)
- `test_forge_generates_problem_for_topic` — Test problem generation
- `test_forge_problem_validation` — Test algebraic, dimensional, physical, uniqueness checks
- `test_forge_adaptive_difficulty` — Test difficulty adjusted by mastery
- `test_forge_calculates_learning_gain` — Test learning_gain = difficulty * (1 - mastery) * quality
- `test_forge_returns_problem_with_hints` — Test response includes hints and solution steps
- (Additional: difficulty within ±0.1 of input)

**Acceptance Criteria**:
- Problem ID non-empty UUID
- All validation checks passed
- Difficulty adapted: easier if mastery low, harder if mastery high
- Learning gain in [0, 1]
- ≥ 2 hints, ≥ 3 solution steps

#### C. Prism Agent (6 tests)
- `test_prism_evaluates_student_solution` — Test solution evaluation
- `test_prism_grading_rubric` — Test grading: correctness 50%, reasoning 30%, communication 20%
- `test_prism_detects_misconceptions` — Test 5 known patterns (sign, distribution, order ops, factoring, exponents)
- `test_prism_calculates_bayesian_mastery_update` — Test posterior = prior * likelihood / evidence
- `test_prism_feedback_construction` — Test constructive feedback (acknowledge, explain, note misconception, suggest next)
- (Additional: Bayesian update increases mastery for correct solutions)

**Acceptance Criteria**:
- Score in [0, 1]
- Grade mapping: 0.9-1.0 A, 0.8-0.9 B, etc.
- Misconceptions detected when applicable
- Mastery increases on correct solutions
- Feedback constructive and actionable

#### D. Pathfinder Agent (6 tests)
- `test_pathfinder_generates_learning_path` — Test path generation
- `test_pathfinder_uses_a_star_algorithm` — Test A* pathfinding
- `test_pathfinder_identifies_bottlenecks` — Test bottleneck detection (topics blocking 5+ others)
- `test_pathfinder_monitors_pace` — Test pace categories: on-track, at-risk, ahead
- `test_pathfinder_estimates_total_time` — Test time = sum(difficulty / (learning_rate * 2))
- `test_pathfinder_dynamic_recomputation` — Test recompute on mastery delta > 0.15

**Acceptance Criteria**:
- Path non-empty, ordered by prerequisites
- A* finds optimal path
- Bottlenecks identified correctly
- Pace recomputed if mastery changes > 0.15
- Time estimate > 0

#### E. Multi-Agent Coordination (3 tests)
- `test_multi_agent_workflow_sequence` — Test Sage → Scout → Forge → Prism → Pathfinder
- `test_agent_fallback_chain` — Test fallback policies from agent_research_policy_*.json
- `test_agent_context_passing` — Test state passing between agents

**Acceptance Criteria**:
- All agents called in correct sequence
- Fallbacks execute on errors
- Context preserved across agents

#### F. Policy Enforcement (5 tests)
- `test_sage_policy_vault_sources` — Test source confidence levels
- `test_scout_policy_ranking_weights` — Test 50% semantic, 30% mastery_gap, 10% recency, 10% diversity
- `test_forge_policy_validation_rules` — Test algebraic, dimensional, physical checks
- `test_prism_policy_misconception_patterns` — Test known misconception patterns mapped to remediation
- `test_pathfinder_policy_bottleneck_detection` — Test bottleneck threshold (5 dependents) and 2x time multiplier

**Acceptance Criteria**:
- All policy rules enforced
- Policies read from JSON files (agent_research_policy_*.json)
- No hardcoded behavior in code

#### G. Monitoring (3 tests)
- `test_agent_latency_tracking` — Track p50, p95, p99 per agent
- `test_agent_confidence_distribution` — Track % gate pass/fail
- `test_agent_error_rate_tracking` — Track timeouts, failures, fallbacks

**Acceptance Criteria**:
- Latency alerts: Sage p95 > 15s, Scout > 2s, Forge > 8s, Prism > 5s, Pathfinder > 3s
- Targets: timeouts < 1%, validation failures < 0.5%, fallbacks < 5%

**Run Command**:
```bash
cd backend/sidecars/agent_orchestrator
python -m pytest tests/test_agents_integration.py -v
```

---

## Running the Full Test Suite

### Option 1: Run All Tests (CI/CD)

```bash
# Rust tests
cd frontend/src-tauri && cargo test --test commands_integration

# Python tests (from Glyphic root)
python -m pytest backend/sidecars/embedding_engine/tests/ -v
python -m pytest backend/sidecars/search_orchestrator/tests/ -v
python -m pytest backend/sidecars/agent_orchestrator/tests/ -v
```

### Option 2: Run Single Module

```bash
# Just Tauri commands
cargo test --test commands_integration -- --nocapture

# Just embedding engine
pytest backend/sidecars/embedding_engine/tests/test_embedding_engine.py -v -k "test_model"

# Just Scout search
pytest backend/sidecars/search_orchestrator/tests/test_scout_integration.py -v -k "test_scout"

# Just agents
pytest backend/sidecars/agent_orchestrator/tests/test_agents_integration.py -v -k "test_sage"
```

### Option 3: Run with Coverage

```bash
# Python coverage
pip install pytest-cov
python -m pytest backend/sidecars/ --cov=backend --cov-report=html

# Rust coverage
cargo tarpaulin --out Html --output-dir coverage
```

---

## Performance Budgets (Reference)

| Agent | Operation | Budget | Test |
| --- | --- | --- | --- |
| Sage | Explanation generation (streaming) | 15s total, first chunk < 2s | test_sage_streaming_response |
| Scout | Semantic search | < 500ms | test_performance_command_latency |
| Forge | Problem generation | < 8s | test_performance_command_latency |
| Prism | Solution evaluation | < 5s | test_performance_command_latency |
| Pathfinder | Path generation | < 3s | test_performance_command_latency |
| Embedding | Single text | < 50ms | test_embedding_generation_latency |
| Embedding | Batch 1000 | < 500ms | test_batch_embedding_generation |
| Search | FTS5 fallback | < 50ms | test_fts5_search_with_keyword_query |

---

## Success Criteria (From PHASE_1_IMPLEMENTATION_PLAN.md)

- ✅ **42+ tests passing** (target met: 100+)
- ✅ **All agent commands register** (5/5)
- ✅ **All error paths tested** (confidence gate, timeout, invalid input, network failures)
- ✅ **Latency budgets enforced** (all modules tested)
- ✅ **Policy enforcement verified** (each agent policy tested)
- ✅ **Multi-agent workflows** (end-to-end pipeline tested)

---

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Test Tauri Commands
  run: cd frontend/src-tauri && cargo test --test commands_integration

- name: Test Python Sidecars
  run: |
    python -m pytest backend/sidecars/embedding_engine/tests/ -v
    python -m pytest backend/sidecars/search_orchestrator/tests/ -v
    python -m pytest backend/sidecars/agent_orchestrator/tests/ -v
```

---

## Debugging Failed Tests

### Tauri Test Failures

```bash
# Run with full output
cargo test --test commands_integration -- --nocapture --test-threads=1

# Check AppHandle registry
cargo test --test commands_integration -- --nocapture | grep "error"
```

### Python Test Failures

```bash
# Run single test with verbose output
pytest tests/test_agents_integration.py::TestSageAgentOrchestration::test_sage_receives_query_with_context -vv

# Show print statements
pytest tests/ -v -s

# Run with debugger
pytest tests/ --pdb
```

### Performance Budget Failures

```bash
# Run with timing
pytest tests/ -v --durations=10

# Profile slow tests
python -m cProfile -s cumtime tests/test_embedding_engine.py
```

---

## Test Maintenance

- **Review quarterly**: Update test expectations if agent logic changes
- **Add tests for bugs**: When a bug is found, add a test that catches it
- **Monitor flakiness**: If tests fail intermittently, investigate timing/concurrency
- **Keep up with dependencies**: Update sentence-transformers, PyMC, etc. annually

---

## References

- PHASE_1_IMPLEMENTATION_PLAN.md: Latency budgets and acceptance criteria
- agent_research_policy_*.json: Policy enforcement (linked from tests)
- agent_system_prompts.json: Model overrides and system prompts
- agent_profiles.md: Agent personalities and mandatory behaviors
