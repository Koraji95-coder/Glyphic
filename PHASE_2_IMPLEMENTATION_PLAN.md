# Phase 2 Implementation Plan — Glyphic Advanced Agent Capabilities

**Duration**: Days 31-60 (30 days)  
**Objective**: Implement advanced Bayesian mastery modeling, adaptive problem generation, misconception detection, knowledge graph, and learning path visualization.

**Team**: Backend (Rust, Python ML), Frontend (React, D3.js)

**Definition of Done**:

- All Bayesian mastery updates working with historical data
- Forge generates problems calibrated within ±0.05 difficulty
- Prism detects 5+ misconception patterns with 85%+ accuracy
- Knowledge graph renders 50+ topic nodes with prerequisites
- Learning path visualization interactive with D3.js
- 30+ integration tests passing
- 0 hardcoded mastery models (policy-driven)
- < 200ms mastery computation latency
- Learning effectiveness metrics tracked

---

## Overview: Phase 2 Capability Stack

### 1. Bayesian Mastery Modeling (PyMC)

**Problem Phase 1 Solved**: Manual mastery tracking (0.0-1.0 scale)  
**Problem Phase 2 Addresses**: Probabilistic mastery with confidence intervals

**Architecture**:

```text
Student Performance Data (Phase 1 outputs)
    ↓
PyMC Bayesian Model
├── Prior: Beta(α=2, β=5)  // pessimistic prior
├── Likelihood: Binomial(n, p)  // n problems, correctness
├── Posterior: Beta(α', β')  // updated distribution
└── Credible Interval (95%): [lower, upper]

Output: Mastery Posterior
├── point_estimate: 0.65 (mean)
├── lower_95: 0.52
├── upper_95: 0.78
└── probability_mastery_gt_0_7: 0.35 (P(θ > 0.7))
```

**Key Components**:

- **Prior Distribution**: Beta(α=2, β=5) — assumes students start behind (pessimistic)
- **Likelihood**: Binomial(n=number_of_attempts, p=correctness_rate)
- **Posterior Inference**: Variational Bayes (fast, scalable) via PyMC
- **Decision**: If P(θ > 0.7) > 0.8, mark topic as "mastered"

**Data Sources**:

- Prism evaluation results (correctness, reasoning quality)
- Attempt frequency
- Time-to-solution
- Misconception presence

---

### 2. Adaptive Problem Difficulty Calibration (Forge v2)

**Phase 1**: Fixed difficulty based on Forge input  
**Phase 2**: Difficulty adapts after each attempt based on response analysis

**Algorithm**:

```text
For each problem solved:
1. Prism grades solution (correctness, reasoning)
2. Extract features:
   - time_to_solution_seconds
   - misconceptions_detected_count
   - reasoning_quality_score
3. Estimate difficulty_experienced = f(correctness, time, misconceptions)
4. Compare to intended_difficulty
5. Adjust Forge recommendations:
   - If difficulty_experienced > intended + 0.15: next problem easier
   - If difficulty_experienced < intended - 0.15: next problem harder
   - Otherwise: keep difficulty stable
6. Update mastery (Bayesian)
7. Pathfinder recomputes path if mastery delta > 0.15
```

**Calibration Loop**:

- Problem 1 (intended 0.6): student takes 15 min, gets correct → difficulty_experienced = 0.55
- Problem 2 (adjusted 0.65): student takes 8 min, gets correct → difficulty_experienced = 0.60
- Problem 3 (adjusted 0.70): ...

**Target**: 95% of students experience difficulty within ±0.1 of intended after 5-10 problems

---

### 3. Misconception Detection & Remediation (Prism v2)

**Phase 1**: Detects 5 misconception patterns  
**Phase 2**: Enriches with remediation strategies and learning interventions

**Misconception Database**:

```python
misconceptions = {
    "sign_error": {
        "pattern": "When solving 2x + 3 = 13, student gets x = 5 but shows 2x = 13 - 3 = 10 → x = 10 (forgot to divide)",
        "likelihood_features": ["incorrect_final", "correct_intermediate", "skipped_division"],
        "remediation": {
            "immediate": "Worked example: 2x + 3 = 13. Divide both sides by 2: x = 5. Check: 2(5) + 3 = 13 ✓",
            "practice": "5 problems with division as final step (Forge generates)",
            "sage_topic": "Order of Operations with Variables"
        }
    },
    "distribution_error": {
        "pattern": "a(b + c) solved as ab + c instead of ab + ac",
        "likelihood_features": ["incorrect_distribution", "missing_second_term"],
        "remediation": {
            "immediate": "Reminder: FOIL means multiply EVERY term. a(b+c) = ab + ac",
            "practice": "10 distribution problems (Forge calibrated easy)",
            "sage_topic": "Distributive Property"
        }
    },
    # ... 3 more patterns
}
```

**Workflow**:

1. Prism evaluates solution
2. Detects misconception match (if any)
3. If detected:
   - Log misconception in student profile
   - Suggest Scout search for remediation topic
   - Schedule follow-up problems (Forge) with same type
   - Flag Pathfinder to reduce velocity (slower pace)
4. If no misconception but incorrect:
   - Deeper analysis: ask Sage for explanation of correct approach
   - Schedule review problem

**Effectiveness Metrics**:

- After misconception detected + remediation:
  - 70% of students solve similar problems correctly on next attempt
  - Time-to-solution decreases 20%

---

### 4. Knowledge Graph (Prerequisite & Dependency Graph)

**Data Structure**:

```python
class TopicNode:
    id: str  # "linear-equations"
    title: str  # "Linear Equations"
    prerequisites: List[str]  # ["algebra-basics", "variables"]
    dependents: List[str]  # ["quadratic-equations", "systems-linear"]
    student_mastery: float  # from Bayesian model
    bottleneck_rank: int  # how many topics depend on this?
    
graph = {
    "algebra-basics": TopicNode(
        id="algebra-basics",
        title="Algebra Basics",
        prerequisites=[],
        dependents=["linear-equations", "quadratic-equations", ...],
        student_mastery=0.85,
        bottleneck_rank=12  # 12 topics depend on this!
    ),
    "linear-equations": TopicNode(
        id="linear-equations",
        prerequisites=["algebra-basics", "variables"],
        dependents=["systems-linear", "matrix-algebra"],
        student_mastery=0.65,
        bottleneck_rank=4
    ),
    # ... 50+ topics
}
```

**Construction**:

- Load topic prerequisite structure from knowledge_graph.json
- Enrich with student mastery from Bayesian model
- Compute bottleneck scores (# dependents)
- Run annually or on curriculum updates

**Integration Points**:

- **Pathfinder**: Uses graph to find optimal learning paths (A*)
- **Prism**: When misconception detected, surface prerequisites (gaps in foundation)
- **Sage**: Links related topics in explanations
- **Forge**: Generates problems aligned with graph (prerequisite ordering)

---

### 5. Learning Path Visualization (D3.js)

**Component**: `frontend/src/components/LearningPathViz.tsx`

**Visualization Types**:

#### A. Dependency Graph (Network View)

- Nodes: topics (size by bottleneck score, color by mastery)
- Edges: prerequisites → dependents
- User interaction:
  - Hover node → highlight path to goal
  - Click node → show topic details + student mastery
  - Drag nodes → explore graph layout (force-directed)

#### B. Sequential Path (Timeline View)

- Horizontal timeline: current → intermediate goals → goal
- Each node shows:
  - Topic title
  - Mastery bar (0-100%)
  - Est. time to master
  - "Start Learning" button
- Active node highlighted
- Completed topics (mastery >= 0.70) marked ✓

#### C. Progress Dashboard

- KPIs:
  - Current mastery average
  - Topics mastered: X/Y
  - Est. time remaining: Z hours
  - On-track status
- Recent activity: last 5 problems (correctness, time, misconceptions)

**Performance Targets**:

- D3 render: < 200ms for 50 nodes
- Interaction latency: < 100ms (click, hover, drag)
- Bundle size: < 250KB (D3 + custom code)

---

## Implementation Roadmap (30 Days)

### Week 1: Bayesian Mastery Modeling Foundation

#### Day 1-3: PyMC Model Setup & Historical Data Integration

**File**: `backend/sidecars/mastery_engine/main.py`

```python
import pymc as pm
import arviz as az
import numpy as np
from typing import List, Tuple

class MasteryModel:
    def __init__(self):
        self.model = None
        self.trace = None
        self.posterior = None
    
    def build_model(self, 
                   successes: int, 
                   attempts: int,
                   prior_alpha: float = 2.0,
                   prior_beta: float = 5.0) -> None:
        """
        Build PyMC Bayesian model for mastery estimation.
        
        θ ~ Beta(α, β)  # prior
        X ~ Binomial(n, θ)  # likelihood (X = successes, n = attempts)
        
        Posterior: Beta(α + X, β + n - X)  # conjugate prior
        """
        with pm.Model() as model:
            # Prior: pessimistic (expects students to struggle)
            theta = pm.Beta('theta', alpha=prior_alpha, beta=prior_beta)
            
            # Likelihood: student gets `successes` out of `attempts` correct
            obs = pm.Binomial('obs', n=attempts, p=theta, observed=successes)
            
            # Infer posterior using Variational Inference (fast)
            self.posterior = pm.fit(random_seed=42)
            self.trace = self.posterior.sample(1000)
        
        self.model = model
    
    def estimate_mastery(self) -> Tuple[float, float, float]:
        """
        Estimate posterior mastery.
        
        Returns: (point_estimate, lower_95, upper_95)
        """
        if self.trace is None:
            raise ValueError("Model not trained. Call build_model() first.")
        
        posterior_samples = self.trace.posterior['theta'].values.flatten()
        point_estimate = np.mean(posterior_samples)
        lower_95 = np.percentile(posterior_samples, 2.5)
        upper_95 = np.percentile(posterior_samples, 97.5)
        
        return point_estimate, lower_95, upper_95
    
    def probability_mastery_threshold(self, threshold: float = 0.70) -> float:
        """
        Compute P(θ > threshold).
        
        Used for: "Is this topic mastered?" decision gate.
        Decision: if P(θ > 0.70) > 0.80, mark as mastered.
        """
        if self.trace is None:
            raise ValueError("Model not trained.")
        
        posterior_samples = self.trace.posterior['theta'].values.flatten()
        return np.mean(posterior_samples > threshold)
```

**Status**: CREATE  
**Owner**: Backend (Python ML)  
**Acceptance Criteria**:

- Model trains on sample data in < 1 second
- Point estimate matches analytical Beta posterior (verify with conjugate formula)
- Credible interval sensible (lower < point_estimate < upper)
- P(θ > 0.7) computed correctly

#### Day 4-5: NDJSON API for Mastery Sidecar

**File**: `backend/sidecars/mastery_engine/ndjson_api.py`

```python
import sys
import json
from mastery_model import MasteryModel

def main():
    """NDJSON stdin/stdout API for mastery computation."""
    model = MasteryModel()
    
    for line in sys.stdin:
        request = json.loads(line)
        
        try:
            action = request.get("action")
            
            if action == "estimate":
                # Input: {"action": "estimate", "successes": 7, "attempts": 10, "batch_id": "m123"}
                successes = request["successes"]
                attempts = request["attempts"]
                
                model.build_model(successes, attempts)
                point_est, lower, upper = model.estimate_mastery()
                prob_mastered = model.probability_mastery_threshold()
                
                response = {
                    "batch_id": request["batch_id"],
                    "point_estimate": float(point_est),
                    "lower_95": float(lower),
                    "upper_95": float(upper),
                    "probability_mastery_gt_0_7": float(prob_mastered),
                    "status": "ok",
                    "latency_ms": latency
                }
            
            else:
                response = {
                    "batch_id": request.get("batch_id"),
                    "error": f"Unknown action: {action}",
                    "status": "error"
                }
        
        except Exception as e:
            response = {
                "batch_id": request.get("batch_id"),
                "error": str(e),
                "status": "error"
            }
        
        print(json.dumps(response))

if __name__ == "__main__":
    main()
```

**Status**: CREATE  
**Owner**: Backend (Python ML)  
**Acceptance Criteria**:

- Reads NDJSON requests from stdin
- Writes NDJSON responses to stdout
- Latency: < 1s per estimate
- All requests logged with batch_id

#### Day 6-7: Integrate Mastery into Prism Agent

**File**: `backend/sidecars/agent_orchestrator/prism_agent.rs`

```rust
// When Prism evaluates solution:
// 1. Grade solution
// 2. Call mastery_engine sidecar:
//    {"action": "estimate", "successes": 1, "attempts": 3, "batch_id": "m123"}
// 3. Receive posterior mastery
// 4. Update student profile: mastery = posterior_point_estimate
// 5. If P(θ > 0.7) > 0.80: mark topic as "mastered"
// 6. Return mastery_update to frontend

pub struct MasteryUpdate {
    pub old_mastery: f32,
    pub new_mastery: f32,
    pub credible_interval: (f32, f32),  // (lower_95, upper_95)
    pub probability_mastered: f32,  // P(θ > 0.7)
    pub recommendation: String,  // "On track" or "Need more practice"
}
```

**Status**: EDIT  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- Calls mastery sidecar from Prism
- Updates student profile with posterior
- Returns mastery_update struct to frontend
- Latency: < 2s (1s model + 1s network)

---

### Week 2: Adaptive Forge & Misconception Detection

#### Day 8-10: Difficulty Calibration in Forge

**File**: `backend/sidecars/agent_orchestrator/forge_calibration.rs`

```rust
pub fn calibrate_difficulty(
    intended_difficulty: f32,
    prism_output: &EvaluationResult,  // from previous problem
) -> f32 {
    let experienced_difficulty = extract_difficulty_signal(prism_output);
    
    let gap = experienced_difficulty - intended_difficulty;
    
    let adjusted = if gap > 0.15 {
        // Too hard: make next problem easier
        (intended_difficulty - 0.15).max(0.0)
    } else if gap < -0.15 {
        // Too easy: make next problem harder
        (intended_difficulty + 0.15).min(1.0)
    } else {
        // Just right: keep stable
        intended_difficulty
    };
    
    adjusted
}

fn extract_difficulty_signal(eval: &EvaluationResult) -> f32 {
    // Features:
    // - correctness_score (weight 0.4)
    // - time_to_solution_seconds (weight 0.3)
    // - misconceptions_detected_count (weight 0.3)
    
    let correctness_signal = 1.0 - eval.correctness_score;  // high score = easy
    let time_signal = if eval.time_seconds < 120.0 {
        0.0  // under 2 min: easy
    } else if eval.time_seconds > 600.0 {
        1.0  // over 10 min: hard
    } else {
        (eval.time_seconds - 120.0) / 480.0  // normalize 120-600s to 0-1
    };
    let misconception_signal = eval.misconceptions_detected.len() as f32 / 5.0;  // max 5 patterns
    
    0.4 * correctness_signal + 0.3 * time_signal + 0.3 * misconception_signal
}
```

**Status**: CREATE  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- Difficulty adjusted within ±0.15 based on gap
- Calibrated difficulty stays in [0.0, 1.0]
- After 5-10 problems, experienced difficulty converges to intended
- Latency: < 100ms

#### Day 11-12: Prism Misconception Database

**File**: `backend/sidecars/agent_orchestrator/misconceptions.json`

```json
{
  "sign_error": {
    "id": "sign-error",
    "name": "Sign Error",
    "description": "Student forgets to flip sign when moving term across equals sign",
    "detection_rules": [
      "incorrect_final_answer",
      "correct_intermediate_steps",
      "skipped_operation"
    ],
    "likelihood_weight": 0.85,
    "remediation": {
      "immediate_feedback": "When moving a term across the equals sign, flip its sign: 2x + 3 = 13 → 2x = 13 - 3",
      "sage_topic": "Solving Linear Equations",
      "forge_problem_type": "algebra",
      "forge_difficulty_adjustment": -0.2,
      "num_practice_problems": 5
    }
  },
  # ... 4 more
}
```

**Status**: CREATE  
**Owner**: Backend (JSON config)  
**Acceptance Criteria**:

- 5+ misconception patterns defined
- Each pattern has detection rules and remediation
- Used by Prism to match patterns
- Used by Forge to generate targeted practice problems

---

### Week 3: Knowledge Graph & Path Finding

#### Day 13-15: Knowledge Graph Construction

**File**: `backend/data/knowledge_graph.json`

```json
{
  "topics": {
    "algebra-basics": {
      "id": "algebra-basics",
      "title": "Algebra Basics",
      "description": "Introduction to algebraic expressions and operations",
      "prerequisites": [],
      "dependents": [
        "linear-equations",
        "quadratic-equations",
        "polynomial-operations"
      ],
      "estimated_learning_time_hours": 8,
      "level": "beginner"
    },
    "linear-equations": {
      "id": "linear-equations",
      "title": "Linear Equations",
      "prerequisites": [
        "algebra-basics",
        "variables"
      ],
      "dependents": [
        "systems-linear",
        "linear-inequalities",
        "function-basics"
      ],
      "estimated_learning_time_hours": 6,
      "level": "intermediate"
    },
    # ... 50+ topics
  },
  "edges": [
    {
      "from": "algebra-basics",
      "to": "linear-equations",
      "type": "prerequisite",
      "strength": 1.0
    }
    # ... all prerequisite relationships
  ]
}
```

**Status**: CREATE  
**Owner**: Backend (data setup)  
**Acceptance Criteria**:

- 50+ topics defined
- Prerequisites correctly specified
- Dependents computed from prerequisites
- No cycles (DAG property)
- Total coverage of Phase 1 curriculum

#### Day 16-17: Bottleneck Analysis & Reachability

**File**: `backend/sidecars/pathfinder_agent/knowledge_graph.rs`

```rust
pub struct KnowledgeGraph {
    topics: HashMap<String, TopicNode>,
    adj_list: HashMap<String, Vec<String>>,  // prerequisite graph
}

impl KnowledgeGraph {
    pub fn compute_bottleneck_scores(&mut self) {
        // bottleneck_rank = # of topics that depend on this topic
        for (topic_id, topic) in &mut self.topics {
            let dependents = self.reverse_reachability(topic_id);
            topic.bottleneck_rank = dependents.len();
        }
    }
    
    pub fn reverse_reachability(&self, topic_id: &str) -> HashSet<String> {
        // BFS from topic_id following prerequisite edges backwards
        // Returns all topics that require this topic (directly or transitively)
    }
    
    pub fn find_blocking_topics(&self, current: &str, goal: &str) -> Vec<String> {
        // Returns topics on path(current → goal) with high bottleneck_rank
        let path = self.shortest_path(current, goal);
        path.into_iter()
            .filter(|t| self.topics[t].bottleneck_rank > 5)
            .collect()
    }
}
```

**Status**: CREATE  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- Bottleneck scores computed for all topics
- Blocking topics identified correctly
- Latency: < 100ms for queries

#### Day 18-20: Pathfinder v2 — Dynamic Path Recomputation

**File**: `backend/sidecars/agent_orchestrator/pathfinder_agent_v2.rs`

```rust
pub fn plan_learning_path_v2(
    student_masteries: &HashMap<String, f32>,
    goal_topic: &str,
    graph: &KnowledgeGraph,
) -> LearningPath {
    // A* with bottleneck weighting
    // Cost(edge) = edge_difficulty * (1 + bottleneck_factor)
    // bottleneck_factor high for topics with many dependents
    
    let mut path = a_star_search(
        &student_masteries,
        goal_topic,
        graph,
        heuristic_cost,
    );
    
    // Enrich with metadata
    path.blocking_topics = graph.find_blocking_topics(path.current, path.goal);
    path.total_estimated_hours = estimate_total_time(&path, student_masteries);
    path.bottleneck_alert = if path.blocking_topics.len() > 0 {
        format!("Focus on {} first (blocks {} topics)", 
            path.blocking_topics[0], 
            graph.topics[&path.blocking_topics[0]].bottleneck_rank)
    } else {
        "On track!".to_string()
    };
    
    path
}

pub fn should_recompute_path(
    old_mastery: f32,
    new_mastery: f32,
    last_computation_timestamp: i64,
) -> bool {
    let delta = (new_mastery - old_mastery).abs();
    let elapsed_hours = (current_time_ms() - last_computation_timestamp) as f32 / 3600_000.0;
    
    // Recompute if:
    // - Mastery changed > 0.15, OR
    // - > 4 hours since last computation
    delta > 0.15 || elapsed_hours > 4.0
}
```

**Status**: EDIT (Pathfinder from Phase 1)  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- Path recomputed on mastery delta > 0.15
- Blocking topics identified
- Time estimate includes time already spent
- Latency: < 3 seconds

---

### Week 4: Visualization & Integration

#### Day 21-23: Learning Path Visualization (React + D3.js)

**File**: `frontend/src/components/LearningPathViz.tsx`

```typescript
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface TopicNode {
  id: string;
  title: string;
  mastery: number;
  bottleneck_rank: number;
}

export const LearningPathViz: React.FC<{ path: LearningPath; graph: KnowledgeGraph }> = ({
  path,
  graph,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 1200;
  const height = 600;

  useEffect(() => {
    if (!svgRef.current || !graph) return;

    // Build D3 data structures
    const nodes: TopicNode[] = graph.topics.map(t => ({
      id: t.id,
      title: t.title,
      mastery: path.student_masteries[t.id] || 0.0,
      bottleneck_rank: t.bottleneck_rank,
    }));

    const links = graph.edges.map(e => ({
      source: e.from,
      target: e.to,
    }));

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Links (edges)
    const link = svg.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    // Nodes (topics)
    const node = svg.selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => 20 + (d.bottleneck_rank * 2))  // size by bottleneck
      .attr('fill', d => colorByMastery(d.mastery))
      .attr('stroke', '#333')
      .attr('stroke-width', 2)
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Labels
    const labels = svg.selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(d => d.title);

    // Tooltips
    node.on('mouseover', function(d) {
      d3.select(this).attr('r', 25);
      // Show tooltip with details
    }).on('mouseout', function(d) {
      d3.select(this).attr('r', 20);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    function dragstarted(d) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function colorByMastery(mastery: number): string {
      if (mastery >= 0.70) return '#6B9E6B';  // green (mastered)
      if (mastery >= 0.40) return '#C4A24D';  // yellow (learning)
      return '#B85C5C';  // red (needs help)
    }
  }, [graph, path]);

  return <svg ref={svgRef} />;
};
```

**Status**: CREATE  
**Owner**: Frontend (React, D3.js)  
**Acceptance Criteria**:

- Renders all topics as nodes (size by bottleneck)
- Colors by mastery (green >= 0.70, yellow >= 0.40, red < 0.40)
- Links show prerequisite relationships
- Hover shows topic details
- Drag enables exploration
- Render time: < 200ms for 50 nodes

#### Day 24-25: Progress Dashboard

**File**: `frontend/src/components/ProgressDashboard.tsx`

```typescript
interface ProgressDashboardProps {
  student_masteries: Record<string, number>;
  recent_problems: Problem[];
  learning_path: LearningPath;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  student_masteries,
  recent_problems,
  learning_path,
}) => {
  const avg_mastery = Object.values(student_masteries).reduce((a, b) => a + b) / 
                     Object.values(student_masteries).length;
  const topics_mastered = Object.values(student_masteries).filter(m => m >= 0.70).length;
  const total_topics = Object.keys(student_masteries).length;
  const est_hours_remaining = learning_path.total_estimated_hours;

  return (
    <div className="dashboard">
      <h2>Your Learning Progress</h2>

      {/* KPIs */}
      <div className="kpis">
        <KPICard label="Average Mastery" value={`${(avg_mastery * 100).toFixed(0)}%`} />
        <KPICard label="Topics Mastered" value={`${topics_mastered}/${total_topics}`} />
        <KPICard label="Est. Time Remaining" value={`${est_hours_remaining.toFixed(1)}h`} />
        <KPICard label="Status" value={on_track_status(learning_path)} />
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>Recent Problems</h3>
        <table>
          <thead>
            <tr>
              <th>Problem</th>
              <th>Result</th>
              <th>Time</th>
              <th>Misconceptions</th>
            </tr>
          </thead>
          <tbody>
            {recent_problems.slice(-5).map(p => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.is_correct ? '✓ Correct' : '✗ Incorrect'}</td>
                <td>{p.time_seconds}s</td>
                <td>{p.misconceptions.length > 0 ? '⚠' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendations */}
      {learning_path.bottleneck_alert && (
        <div className="alert-box">
          <strong>📌 Focus Area:</strong> {learning_path.bottleneck_alert}
        </div>
      )}
    </div>
  );
};
```

**Status**: CREATE  
**Owner**: Frontend (React)  
**Acceptance Criteria**:

- KPIs display correctly
- Recent activity table shows last 5 problems
- Bottleneck alert visible if blocking topics exist
- Render time: < 100ms

#### Day 26-27: Integration Tests for Phase 2

**File**: `backend/sidecars/agent_orchestrator/tests/test_phase2_integration.py`

```python
class TestBayesianMastery:
    def test_mastery_estimation_from_history(self):
        """Test Bayesian mastery estimate from problem history"""
        # Student solved 7/10 problems correctly
        model = MasteryModel()
        model.build_model(successes=7, attempts=10)
        point_est, lower, upper = model.estimate_mastery()
        
        # Analytical posterior: Beta(2+7, 5+10-7) = Beta(9, 8)
        # Mean = 9/17 ≈ 0.529
        assert 0.50 < point_est < 0.60
        assert lower < point_est < upper
    
    def test_difficulty_calibration_adaptive(self):
        """Test Forge adjusts difficulty based on attempt"""
        intended = 0.60
        eval = EvaluationResult(
            correctness_score=1.0,  # got it right
            time_seconds=90,  # fast
            misconceptions=[],  # none
        )
        
        adjusted = calibrate_difficulty(intended, eval)
        # Should be harder (student found it easy)
        assert adjusted > intended
    
    def test_misconception_detection_remediation(self):
        """Test Prism detects misconception and triggers remediation"""
        solution = "x = 7"  # correct
        work = "2x = 14, x = 14"  # division error detected
        
        eval = evaluate_solution(solution, work)
        assert eval.misconceptions[0]["id"] == "distribution_error"
        assert eval.remediation["sage_topic"] == "Order of Operations"
    
    def test_knowledge_graph_bottleneck_detection(self):
        """Test graph identifies blocking topics"""
        graph = load_knowledge_graph()
        blocking = graph.find_blocking_topics("algebra-basics", "calculus")
        
        assert "functions" in blocking
        assert "limits" in blocking
    
    def test_pathfinder_recomputes_on_mastery_change(self):
        """Test path recomputes when mastery jumps"""
        old_mastery = 0.45
        new_mastery = 0.70  # delta = 0.25 > threshold
        
        should_recompute = should_recompute_path(
            old_mastery, new_mastery, last_timestamp
        )
        assert should_recompute
    
    def test_learning_path_viz_renders_50_nodes(self):
        """Test D3 visualization handles 50 topics"""
        graph = load_knowledge_graph()  # 50+ topics
        masteries = {t.id: 0.5 for t in graph.topics}
        
        # Render should complete in < 200ms
        start = time.time()
        # Trigger D3 render
        elapsed = time.time() - start
        assert elapsed < 0.2
```

**Status**: CREATE  
**Owner**: Backend (Python tests)  
**Acceptance Criteria**:

- 30+ integration tests passing
- Bayesian mastery estimates correct
- Adaptive calibration working
- Misconception detection accurate
- Graph queries fast (< 100ms)
- Visualization performant (< 200ms)

#### Day 28-30: Polish & Documentation

**Day 28**: Fix any failing tests, performance tuning
**Day 29**: Documentation & API examples
**Day 30**: Code review, buffer for issues

---

## Phase 2 Acceptance Criteria (All Required)

✅ **Bayesian Mastery Modeling**:

- PyMC model trains in < 1 second
- Posterior estimates match analytical predictions (Beta conjugate)
- Credible intervals sensible (lower < mean < upper)
- Decision gate working: P(θ > 0.7) > 0.80 marks topic mastered

✅ **Adaptive Difficulty Calibration**:

- Forge adjusts difficulty based on Prism feedback
- After 5-10 problems, experienced difficulty converges to intended (±0.1)
- Latency < 100ms per calibration

✅ **Misconception Detection**:

- Detects 5+ misconception patterns
- Accuracy >= 85% on validation set
- Remediation triggered: Sage topic recommended, practice problems generated
- Time-to-solution improvement: 20% after remediation

✅ **Knowledge Graph**:

- 50+ topics modeled
- Prerequisites correctly specified (no cycles)
- Bottleneck analysis identifies blocking topics
- Query latency < 100ms

✅ **Learning Path Visualization**:

- Network graph renders 50+ nodes in < 200ms
- Node size scales by bottleneck rank
- Colors reflect mastery (green >= 0.70)
- Drag/hover interactions responsive (< 100ms)
- Dashboard KPIs accurate

✅ **Integration & Monitoring**:

- 30+ integration tests passing
- All Bayesian updates logged with batch_id
- Performance metrics tracked (p50, p95, p99 latencies)
- Error rates < 1% (timeouts < 1%, validation failures < 0.5%)

✅ **Code Quality**:

- 0 hardcoded mastery models (all policy-driven via JSON config)
- < 200ms mastery computation latency (includes I/O)
- All agent policies (research_policy_*.json) enforced in code
- Documentation complete (API, examples, troubleshooting)

---

## Success Metrics (End of Phase 2)

| Metric | Target | Method |
| --- | --- | --- |
| Students reach 0.70 mastery/topic | 5-10 problems on avg | Track in DB |
| Misconceptions resolved | 70% improve on retry | Log + analyze |
| Learning time estimate accuracy | ±30% of actual | Compare predicted vs. actual |
| Path visualization latency | < 200ms render | WebGL/Canvas profiling |
| Bayesian model confidence | 95% credible interval coverage | Validation set |
| Adaptive difficulty convergence | ±0.1 within 10 problems | A/B test metrics |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| PyMC inference slow (> 1s) | Medium | High | Use Variational Inference; profile and optimize |
| Misconception patterns incomplete | Low | Medium | Collect student data Phase 1; expand iteratively |
| Knowledge graph construction errors | Low | High | Automated validation; manual review of prerequisites |
| D3 visualization sluggish (> 200ms) | Low | Medium | Canvas rendering; lazy load nodes; profiling |
| Mastery computation concurrency bugs | Medium | High | Use Arc<Mutex<>>, add stress tests |

---

## References

- Phase 1 Implementation Plan: Latency budgets, agent system contracts
- agent_research_policy_*.json: Policy enforcement rules
- agent_system_prompts.json: Model configurations
- Knowledge Graph Schema: Topic prerequisites and dependencies
- [D3.js Documentation](https://d3js.org/)
- [PyMC Documentation](https://www.pymc.io/)
