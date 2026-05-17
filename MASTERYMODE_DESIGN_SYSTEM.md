# MasteryMode UI System Design

**Status**: Phase 2 Frontend Design  
**Design System**: Midnight Eclipse + Phase 3 Mastery Tokens  
**Component Library**: React 19 + TypeScript + Tailwind CSS  
**Data Source**: SQLite mastery_history + study_attempts tables  

---

## 1. Requirements & Constraints

### Functional Requirements

- **Display mastery state** for each topic (posterior mean, credible intervals)
- **Show recent attempts** (correctness, time, misconceptions)
- **Visualize learning paths** (prerequisites, mastery bottlenecks)
- **Track progress** (on-track, ahead, at-risk status)
- **Navigate topics** (click to focus, drill-down capability)
- **Responsive across** desktop (1440px), tablet (768px), mobile (375px)

### Non-Functional Requirements

| Metric | Target | Reasoning |
| --- | --- | --- |
| Initial load | < 500ms | Mastery data is small (~1MB for 100 topics) |
| Render | < 200ms | React Suspense for D3 visualization |
| Interactivity | 60 FPS | Smooth hover/transitions via CSS |
| Accessibility | WCAG AA | `prefers-reduced-motion`, focus states, semantic HTML |
| Theme support | 2 modes | Dark (default), Light (user preference) |
| No GPU required | Browser canvas | Avoid WebGL for broad device support |

### Constraints

- **No external charting libraries** beyond D3.js (keep bundle lean)
- **Offline-first** — all data from local SQLite, no network calls
- **No polling** — React state management only
- **TypeScript strict** — full type coverage
- **Design tokens locked** — CSS custom properties only, no hardcoded colors

---

## 2. Information Architecture

### MasteryMode Layout (Full-Screen)

```
┌──────────────────────────────────────────────────┐
│  Title: "Learning Dashboard"                      │ (44px)
├──────────────────────────────────────────────────┤
│                                                    │
│  [Filter] [Sort] [View]  ←  Toolbar             │ (56px)
│                                                    │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─ PROGRESS CARD ──────────────┐                │
│  │ Overall: 62% mastery         │ ← KPI Panel   │ (120px)
│  │ On track: 12 topics          │                │
│  │ At risk: 3 topics            │                │
│  └──────────────────────────────┘                │
│                                                    │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─ MAIN GRID (2 columns on desktop) ────────┐   │
│  │                                             │   │
│  │  [Topic Card] [Topic Card]                 │   │
│  │  [Topic Card] [Topic Card]                 │   │
│  │  [Topic Card] [Topic Card]                 │   │
│  │                                             │   │ (flex-1)
│  │  [Learning Path Viz] [Recent Attempts]    │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Component Hierarchy

```
MasteryMode.tsx (full-screen container)
├── MasteryHeader.tsx (title bar)
├── MasteryToolbar.tsx (filter, sort, view toggle)
├── KpiPanel.tsx (overall metrics)
├── MainContent.tsx (2-col grid)
│   ├── TopicGrid.tsx (mastery cards, responsive)
│   │   └── TopicCard.tsx × N (individual topic)
│   │       └── MasteryBar.tsx (visual progress)
│   │       └── ConfidenceInterval.tsx (credible interval viz)
│   └── DetailPanel.tsx (sidebar or bottom, context-dependent)
│       ├── LearningPathViz.tsx (D3 dependency graph)
│       ├── RecentAttempts.tsx (attempt list)
│       └── MasteryMetadata.tsx (source attribution)
```

---

## 3. Component Specifications

### 3.1 MasteryMode Container

**Props**: None (connects to stores)

**Behavior**:
- Load mastery_history + study_attempts from SQLite
- Debounce on mastery updates (batch updates from backend)
- Render error boundary if data fetch fails

**CSS Classes**:
```css
.mastery-mode {
  @apply flex-1 flex flex-col min-w-0 overflow-hidden;
  @apply bg-gradient-to-b from-bg-app to-bg-editor;
}

.mastery-mode__loading {
  @apply flex items-center justify-center h-full;
}

.mastery-mode__error {
  @apply text-center text-red p-8;
}
```

---

### 3.2 MasteryBar Component

**Purpose**: Visual representation of mastery with credible interval

**Props**:
```typescript
interface MasteryBarProps {
  topic: string;
  masteryLevel: number;        // 0.0-1.0 (posterior mean)
  lower95: number;             // Credible interval lower
  upper95: number;             // Credible interval upper
  thresholdMastery?: number;   // Default 0.7
  compact?: boolean;           // Reduced height for list
}
```

**Visual**:
```
┌─ Calculus Integration ─────────────────────────┐
│                                                 │
│  Mastery: 65%  [██████░░░░░░] (0.35–0.82)     │  ← Label + bar + interval
│  Status: At risk (need 70%)                    │  ← Status badge
│                                                 │
└─────────────────────────────────────────────────┘
```

**Design Tokens**:
- **Color** (by status):
  - Mastered (≥0.7): `--accent-mastery` (#34d399)
  - Review (0.5–0.7): `--accent-review` (#fbbf24)
  - Struggle (<0.5): `--accent-struggle` (#f87171)
- **Height**: 24px (normal), 16px (compact)
- **Radius**: `--radius-sm` (8px)
- **Motion**: Smooth fill animation on load, `--duration-normal` (300ms)

**Credible Interval Visualization**:
- Light background bar (full range 0–1)
- Colored fill bar (posterior mean)
- Vertical tick markers at 0.95 CI bounds
- Hover tooltip shows exact values + explanation

---

### 3.3 TopicCard Component

**Purpose**: Card showing single topic mastery, recent attempts, actions

**Props**:
```typescript
interface TopicCardProps {
  topicId: string;
  topicName: string;
  masteryLevel: number;
  lower95: number;
  upper95: number;
  recentAttempts: StudyAttempt[];
  prerequisiteTopics: string[];
  dependentTopics: string[];
  lastStudied?: string;
  onNavigate?: (topicId: string) => void;
}
```

**Layout**:
```
┌─────────────────────────────────────┐
│                                      │
│  [Topic: Calculus Integration]      │ ← Header
│                                      │
│  Mastery: 65%  [██████░░░░]        │ ← MasteryBar
│                                      │
│  Recent: ✓✓✗✓ (3/4 correct)       │ ← Quick look at attempts
│                                      │
│  Prerequisites: 2  Blocks: 1        │ ← Context
│                                      │
│  [Study Now]  [View Path]           │ ← CTAs
│                                      │
└─────────────────────────────────────┘
```

**Responsive**:
- Desktop (1440px): 4-column grid
- Tablet (768px): 2-column grid
- Mobile (375px): 1-column, stacked

**Interactive**:
- Hover: Subtle background lift + shadow
- Click: Navigate to topic detail (drill-down)
- Long-press (mobile): Show context menu

---

### 3.4 LearningPathViz Component

**Purpose**: D3.js dependency graph showing topics and prerequisites

**Props**:
```typescript
interface LearningPathVizProps {
  topics: TopicMastery[];
  selectedTopic?: string;
  onTopicSelect?: (topicId: string) => void;
  height?: number;  // Default 400px
}
```

**Visualization**:
- **Nodes**: Topic circles
  - Size: Bottleneck score (prerequisites blocking others)
  - Color: Mastery level (red < 0.5, yellow 0.5-0.7, green ≥ 0.7)
  - Border: Bold if selected, thin otherwise
- **Edges**: Prerequisite relationships
  - Solid: Prerequisite met (topic mastered)
  - Dashed: Prerequisite not met (blocked)
  - Arrow: Direction of dependency
- **Layout**: Force-directed graph (D3 force simulation)
- **Zoom**: Scroll to zoom, drag to pan

**Performance**:
- Render time: < 200ms for 50 topics
- Debounce selections: 50ms to prevent re-renders
- Use React.memo for node/edge sub-components
- Virtualization if > 100 nodes (use d3-zoom)

**Accessibility**:
- Alt text: "Learning path graph with N topics"
- Keyboard nav: Tab through nodes, Enter to select
- Focus style: Bold border + outline
- `prefers-reduced-motion`: Static layout (no simulation)

---

### 3.5 RecentAttempts Component

**Purpose**: List of recent study attempts with details

**Props**:
```typescript
interface RecentAttemptsProps {
  attempts: StudyAttempt[];
  maxItems?: number;  // Default 10
  onAttemptSelect?: (attemptId: string) => void;
}

interface StudyAttempt {
  id: string;
  topic: string;
  createdAt: string;
  question: string;
  studentResponse: string;
  score: number;
  isCorrect: boolean;
  timeToSolutionMs: number;
  misconceptionsDetected?: string[];
}
```

**Layout**:
```
Recent Attempts (showing 10 most recent)
─────────────────────────────────────────

1. [✓] Calculus: Integration by parts
   2 min 34 sec | 100% | Today 2:34 PM
   
2. [✗] Calculus: U-substitution  
   4 min 15 sec | 60% | Today 1:10 PM
   Misconception: Misplaced limits
   
3. [✓] Linear Algebra: Eigenvalues
   1 min 22 sec | 95% | Today 12:45 PM
```

**Interactive**:
- Click row: Expand for full context
- Hover: Show mastery delta (impact on topic mastery)
- Filter: By topic, by date range, by score
- Sort: By date (default), by score, by time

---

### 3.6 KpiPanel Component

**Purpose**: High-level metrics dashboard

**Props**:
```typescript
interface KpiPanelProps {
  totalTopics: number;
  averageMastery: number;
  masteredCount: number;
  reviewCount: number;
  struggleCount: number;
  onTrackCount: number;
  aheadCount: number;
  atRiskCount: number;
}
```

**Layout**:
```
┌─ Overall Progress ─────────────────────────────────┐
│                                                     │
│  Avg Mastery: 62%      |  Mastered: 18/28 (64%)   │
│  [██████░░░░░░░░]      |  Review: 5 (18%)         │
│                        |  Struggle: 5 (18%)       │
├─────────────────────────────────────────────────────┤
│  On Track: 12    Ahead: 5    At Risk: 3  (low)   │
│  ────────────────────────────────────────────────   │
│  [████████░░░░░░] Pacing tracker                   │
└─────────────────────────────────────────────────────┘
```

**Design**:
- **Background**: `--bg-mastery-panel` (semi-transparent green)
- **Text**: `--text-primary` for headers, `--text-secondary` for values
- **Accents**:
  - Mastered: `--accent-mastery` (#34d399)
  - Review: `--accent-review` (#fbbf24)
  - Struggle: `--accent-struggle` (#f87171)
- **Motion**: Count-up animation on first render (2s)

---

## 4. Data Flow

### Initialization

```
MasteryMode mounts
    ↓
Load mastery_history (all topics)
    ↓
Load study_attempts (recent 100)
    ↓
Compute aggregates (KPIs, pacing)
    ↓
Render components with Suspense
```

### Real-Time Updates

```
Prism agent grades a problem
    ↓
Backend stores in study_attempts
    ↓
Backend calls mastery_engine → gets posterior
    ↓
Backend stores in mastery_history
    ↓
Tauri emits `mastery_updated` event
    ↓
MasteryMode subscribes, re-fetches mastery_history
    ↓
React re-renders affected components
```

### State Management (Zustand)

```typescript
// New store: masteryStore.ts
export const useMasteryStore = create<MasteryState>((set) => ({
  masteryHistory: [],
  recentAttempts: [],
  selectedTopicId: null,
  isLoading: false,
  
  setMasteryHistory: (data) => set({ masteryHistory: data }),
  setRecentAttempts: (data) => set({ recentAttempts: data }),
  selectTopic: (id) => set({ selectedTopicId: id }),
  
  loadMasteryData: async () => { /* fetch from SQLite */ },
}));
```

---

## 5. Database Queries

### SQL: Get All Topics with Latest Mastery

```sql
SELECT 
  mh.topic,
  mh.mastery_level,
  mh.confidence_lower_95,
  mh.confidence_upper_95,
  COUNT(sa.id) as attempt_count,
  MAX(sa.created_at) as last_studied
FROM mastery_history mh
LEFT JOIN study_attempts sa ON mh.note_id = sa.note_id
WHERE mh.batch_id IN (SELECT MAX(batch_id) FROM mastery_history GROUP BY topic)
GROUP BY mh.topic
ORDER BY mh.mastery_level DESC;
```

### SQL: Get Recent Attempts with Context

```sql
SELECT 
  sa.id,
  sa.topic,
  sa.question,
  sa.student_response,
  sa.score,
  sa.is_correct,
  sa.time_to_solution_ms,
  sa.misconceptions_detected,
  sa.created_at,
  mh.mastery_level
FROM study_attempts sa
LEFT JOIN mastery_history mh ON sa.note_id = mh.note_id AND sa.topic = mh.topic
ORDER BY sa.created_at DESC
LIMIT 100;
```

---

## 6. Performance & Optimization

### Bundle Size

- **MasteryMode components**: ~15KB (gzipped)
- **D3.js**: ~40KB (already in project)
- **Total delta**: ~55KB

### Render Performance

- **Mastery data**: ~1MB for 1000 topics (fits in memory)
- **Component memoization**: `React.memo()` for cards, bars
- **Virtualization**: Grid virtualization if > 100 topics (consider `react-window`)
- **D3 debouncing**: Resize observer debounces graph recomputation
- **Lazy loading**: Recent attempts loaded on-demand

### Accessibility Checklist

- [ ] Semantic HTML (`<article>`, `<section>`, `<button>`)
- [ ] ARIA labels on interactive elements
- [ ] `prefers-reduced-motion` support
- [ ] Focus styles (`:focus-visible`)
- [ ] Color contrast 4.5:1 minimum
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader tested (NVDA, JAWS)

---

## 7. Responsive Design Breakpoints

| Breakpoint | Width | Layout | Notes |
| --- | --- | --- | --- |
| Mobile | 375px | 1-column, stacked | Touch targets ≥ 44px |
| Tablet | 768px | 2-column grid | Side-by-side panels |
| Desktop | 1024px | 3-column + sidebar | Full-width viz |
| Ultra-wide | 1440px+ | 4-column grid | Single page fit |

---

## 8. Color Palette (Midnight Eclipse Theme)

| Use | Token | Hex | RGB |
| --- | --- | --- | --- |
| Mastered topics | `--accent-mastery` | #34d399 | 52, 211, 153 |
| Review topics | `--accent-review` | #fbbf24 | 251, 191, 36 |
| Struggle topics | `--accent-struggle` | #f87171 | 248, 113, 113 |
| Background panels | `--bg-mastery-panel` | rgba(52, 211, 153, 0.06) | Transparent |
| Text primary | `--text-primary` | #f0eef8 | 240, 238, 248 |
| Text secondary | `--text-secondary` | #a09ab8 | 160, 154, 184 |

---

## 9. Typography

| Element | Font | Size | Weight | Line-Height |
| --- | --- | --- | --- | --- |
| Page title | DM Serif Display | 32px | 400 | 1.2 |
| Card title | DM Sans | 16px | 600 | 1.4 |
| Card body | DM Sans | 14px | 400 | 1.6 |
| Metric value | DM Sans | 28px | 700 | 1.0 |
| Label | DM Sans | 12px | 500 | 1.4 |

---

## 10. Motion & Transitions

| Element | Duration | Easing | Trigger |
| --- | --- | --- | --- |
| Hover states | `--duration-fast` (150ms) | `ease-out` | Mouse over |
| Route transitions | `--duration-normal` (300ms) | `ease-in-out` | Navigation |
| D3 graph force | `--duration-slow` (500ms) | `ease-in` | Mount |
| Count-up animation | 2000ms | `ease-in-out` | KPI load |
| Attention animation | Pulse, 2s | `ease-in-out` | On at-risk flag |

---

## 11. Error Boundaries & Fallbacks

**Component Error Boundary**:
```
┌─────────────────────────────────────┐
│  ⚠️  Failed to load mastery data     │
│                                      │
│  [Retry] [Report Issue]             │
└─────────────────────────────────────┘
```

**Network Error**:
```
┌─────────────────────────────────────┐
│  ⚠️  Mastery engine unavailable     │
│  Using cached data from 2 hours ago │
└─────────────────────────────────────┘
```

**Empty State**:
```
┌─────────────────────────────────────┐
│  No mastery data yet                 │
│  Complete your first practice problem│
│  to see your learning progress.      │
│                                      │
│  [Start Learning]                   │
└─────────────────────────────────────┘
```

---

## 12. Acceptance Criteria

- [ ] All 6 components render without errors
- [ ] MasteryMode renders in < 200ms
- [ ] D3 graph renders in < 200ms (< 50 topics)
- [ ] Responsive at all breakpoints (375px, 768px, 1024px, 1440px)
- [ ] `prefers-reduced-motion` respected globally
- [ ] All text has 4.5:1 contrast ratio (WCAG AA)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus styles visible on all interactive elements
- [ ] Color palette used exclusively (no hardcoded hex values)
- [ ] All animations respect design token durations
- [ ] No console errors or warnings
- [ ] TypeScript strict mode (all types defined)
