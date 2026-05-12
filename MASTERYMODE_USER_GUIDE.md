# MasteryMode User Guide

**Purpose**: Walkthrough of MasteryMode features and user interactions  
**Audience**: Students and educators  
**Scope**: Feature overview, navigation, data interpretation

---

## Getting Started

### Accessing MasteryMode

1. **Launch Glyphic**
2. **Click "Mastery" in the sidebar** (or use keyboard shortcut: `Cmd+Shift+M`)
3. **Loading**: Dashboard initializes with your mastery data (< 500ms)

### First Time Setup

If you have no mastery data yet:
- You'll see an empty dashboard with friendly onboarding message
- "Complete your first practice problem to see your learning progress"
- Start by clicking **[Start Learning]** in the Forge or Scout panels

---

## Dashboard Layout

```
┌─ LEARNING DASHBOARD ──────────────────────────────────────┐
│ Track your mastery progress across topics                  │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ OVERALL PROGRESS ─────────────────────────────────┐   │
│  │ Avg Mastery: 62%  |  Mastered: 18/28 (64%)        │   │
│  │ [██████░░░░░░]    |  Review: 5 (18%)              │   │
│  │                   |  Struggle: 5 (18%)            │   │
│  │ On Track: 12  Ahead: 5  At Risk: 3                │   │
│  └───────────────────────────────────────────────────┘   │
│                                                             │
├─ FILTERS ─ SORT ─ VIEW ──────────────────────────────────┤
│  [All Topics ▾] [Sort by Mastery ▾] [📊 Grid]             │
│  Showing 28 of 28 topics                                   │
│                                                             │
├─ MAIN CONTENT (2 COLUMNS) ────────────────────────────────┤
│                                                             │
│  LEFT: Topic Cards                RIGHT: Sidebar          │
│  ┌──────────────┐               ┌──────────────┐         │
│  │ Card 1       │               │ Learning     │         │
│  │ Card 2       │               │ Path Viz     │         │
│  │ Card 3       │               │ (D3 Graph)   │         │
│  │ Card 4       │               └──────────────┘         │
│  │ Card 5       │               ┌──────────────┐         │
│  │ Card 6       │               │ Recent       │         │
│  │ (Grid scroll) │               │ Attempts     │         │
│  └──────────────┘               │ (List)       │         │
│                                  └──────────────┘         │
└───────────────────────────────────────────────────────────┘
```

---

## Understanding Your Dashboard

### Overall Progress (Top Panel)

**What it shows**:
- **Average Mastery**: Your overall competence across all topics (0-100%)
- **Mastered**: Topics where you've reached the 70% competence threshold
- **Review**: Topics you understand but need reinforcement (50-69%)
- **Struggle**: Topics that need more practice (<50%)
- **Pacing**: On Track (on schedule), Ahead (fast progress), At Risk (behind pace)

**How to read it**:
- Green bar = more progress
- Higher percentage = better prepared
- Red flag on "At Risk" = prioritize these topics

**Example**: 
```
Avg Mastery: 62%
└─ You understand about 2/3 of your coursework
   Need to focus on the remaining 5 "Struggle" topics
```

---

## Topic Cards

Each card shows one topic's complete status:

```
┌─────────────────────────────────────────┐
│ Calculus: Integration        Today 2:34 PM
│                                          │
│ Mastery: 68%  [██████░░░░░░] (45-82)    │ ← Credible interval
│ At risk (need 70%)                      │ ← Status
│                                          │
│ Recent: ✓✓✗✓ (3/4 correct)             │ ← Recent attempts
│                                          │
│ Prerequisites: 2  Blocks: 1              │ ← Context
│                                          │
│ [Study Now]  [View Path]                 │ ← Actions
└─────────────────────────────────────────┘
```

### Reading a Topic Card

**Top section**:
- **Topic name** + last time studied
- Shows when you last practiced this topic

**Mastery bar**:
- **Filled bar** (blue) = your estimated competence (posterior mean)
- **Shaded region** = your confidence range (95% credible interval)
- **Tick marks** at interval bounds
- **Status badge**: Mastered (green) | Review (amber) | Struggle (red)

**Recent attempts**:
- **✓** = Correct attempt
- **✗** = Incorrect attempt
- **Percentage**: How many of your last 4 attempts succeeded
- Hover to see which problems

**Prerequisites**:
- **"Prerequisites: 2"** = 2 topics you should know before this one
- **"Blocks: 1"** = 1 topic this blocks (this is a bottleneck)

**Actions**:
- **Study Now**: Open a new practice problem for this topic
- **View Path**: Show how this fits into your learning map

---

## Filtering & Sorting

### Filter Options

| Filter | Shows | Use Case |
| --- | --- | --- |
| All Topics | Every topic | Overview |
| Mastered Only | Topics ≥70% | See your wins |
| Review Only | Topics 50-69% | Maintenance |
| Struggle Only | Topics <50% | Priority focus |

### Sort Options

| Sort | Order | Use Case |
| --- | --- | --- |
| Mastery | High → Low | See what you know best |
| Recent | Most recent first | Continue what you worked on |
| Name | A → Z | Find a specific topic |

### View Modes

- **Grid** (📊): Card layout, great for overview
- **List** (📝): Compact rows, good for scrolling many topics

---

## Recent Attempts (Right Sidebar)

Shows your last 5-10 practice problems:

```
┌─ Recent Attempts (37 total) ─────────────────┐
│                                               │
│ [✓] Calculus: Integration by parts          │
│     2m 34s | 95% | 30m ago                   │
│                                               │
│ [✗] Linear Algebra: Eigenvalues             │
│     4m 15s | 60% | 45m ago                   │
│     ⚠️ Misconception: Sign error             │
│                                               │
│ [✓] Calculus: U-substitution                │
│     1m 22s | 100% | Today 2:34 PM            │
│                                               │
│ [View all attempts →]                        │
└─────────────────────────────────────────────┘
```

### Reading an Attempt

- **✓/✗**: Did you get it right?
- **Time**: How long it took to solve
- **Score**: Your correctness percentage
- **Timestamp**: When you attempted it
- **Misconception** (if present): What went wrong (e.g., "Sign error", "Misplaced limits")

### What the misconception means

These are common mistakes that the AI detected:
- **Sign error**: You got the magnitude right but wrong sign
- **Misplaced limits**: You used wrong bounds in integration
- **Distribution confusion**: You forgot to distribute multiplication
- **Unit mismatch**: Your answer has wrong units

---

## Learning Path (Right Sidebar)

**Coming Soon** (Phase 2.6)

When implemented, you'll see:
- **Network graph** showing all your topics
- **Node size**: How important this topic is (bigger = blocks more topics)
- **Node color**: Your mastery (red < 50%, amber 50-69%, green ≥ 70%)
- **Arrows**: "A requires B" prerequisite relationships
- **Click a node**: Focus on that topic, see its prerequisites

Example:
```
                Calculus III
                    ↑
        Integration ← Derivatives
            ↑              ↑
    Basic Algebra    Pre-Calculus
```

---

## Navigation & Interactions

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+Shift+M` | Toggle MasteryMode |
| `Tab` | Navigate between cards/buttons |
| `Enter` | Activate focused button |
| `Escape` | Go back to main editor |
| `?` | Show help |

### Mouse Interactions

| Action | Result |
| --- | --- |
| **Hover** a card | Highlight + shadow lift |
| **Click** a card | Select (highlight border) |
| **Click** [Study Now] | Start practicing this topic |
| **Click** [View Path] | Show prerequisites |
| **Scroll** attempts list | See older attempts |
| **Click** attempt row | View attempt details (TODO) |

---

## Interpreting Credible Intervals

The shaded region on each mastery bar is your **95% confidence interval**.

### What it means

**Example: 68% mastery with interval [45-82]**

This means:
- Your **best estimate** is 68% (you understand 68% of the topic)
- You're **95% confident** the true value is between 45% and 82%
- The wider the interval → the less certain we are
- The narrower the interval → the more attempts you've done

### Why it matters

**Narrow interval (e.g., 75 ± 3)**
```
[████████████████░] = High confidence
└─ You've done many attempts
   The estimate is stable and reliable
```

**Wide interval (e.g., 50 ± 25)**
```
[██░░░░░░░░░░░░░░░░░░░░░░] = Low confidence
└─ You've done few attempts
   Need more practice to narrow this down
```

---

## Mastery Thresholds

The system uses these benchmarks:

| Threshold | Meaning | Color |
| --- | --- | --- |
| **≥ 70%** | Mastered | Green ✓ |
| **50-69%** | Review | Amber ⚠️ |
| **< 50%** | Struggle | Red ✗ |

### What each means

**Mastered (70%+)**
- You've demonstrated consistent understanding
- You can solve most problems correctly
- Focus: Occasional refresher practice

**Review (50-69%)**
- You mostly understand, but not fully confident
- You solve some problems correctly, some not
- Focus: Structured practice, learn from mistakes

**Struggle (<50%)**
- This topic is challenging
- You get many problems wrong
- Focus: Review fundamentals, ask for help

---

## Common Questions

### Q: Why is my mastery 68% but I got 100% on a problem?

**A**: Mastery is a **long-term estimate**, not your last score.

- **One problem**: 100% (one data point)
- **Last 10 problems**: 70% average
- **All-time**: 68% (balancing your whole history)

The Bayesian model weighs all your attempts, so one win doesn't spike your mastery. But many correct attempts will gradually raise it.

### Q: The interval is so wide! Why don't I do a few more problems?

**A**: Yes! Each additional attempt narrows the interval.

```
After 5 attempts: [30-70]  ← Very uncertain
After 15 attempts: [55-75] ← More certain
After 30 attempts: [65-72] ← High confidence
```

More attempts = more data = better estimate.

### Q: Should I focus on Struggle topics or Review?

**A**: **Strategy depends on your goal**:

- **Goal: Pass the exam soon?** → Focus on Review (70-80% confidence per topic)
- **Goal: Deep mastery?** → Focus on Struggle (build foundation)
- **Goal: Balanced progress?** → Split time (80% on Review, 20% on Struggle)

### Q: I mastered a topic but my mastery dropped. Why?

**A**: **Possible reasons**:

1. **Took a hard problem**: Latest attempt was tougher, you got it wrong
2. **Time decay**: Old attempts might be weighted less as time passes
3. **Concept connection**: Understanding changed when you learned a related topic
4. **Recalibration**: The system re-evaluated after new data

This is actually **healthy** — shows the system is responsive to your current state.

---

## Tips for Best Results

### Study Smarter

1. **Focus on prerequisites first**
   - Topics with "Blocks" are bottlenecks
   - Mastering them unblocks harder topics

2. **Space out your attempts**
   - Best: 1-2 attempts per topic per day
   - Avoid: 10 attempts all at once (diminishing returns)

3. **Learn from misconceptions**
   - Read the feedback, understand why you were wrong
   - Don't just retry immediately (space effect)

4. **Track progress over weeks, not days**
   - Mastery is long-term
   - Day-to-day fluctuations are normal

### Optimize Your Path

1. **Start in "Struggle"** if you have time
   - Fill in foundation gaps first
   - Prerequisites matter!

2. **Move to "Review"** when ready for refinement
   - Narrow those intervals
   - Build confidence

3. **Spot-check "Mastered"** once per week
   - Keep knowledge fresh
   - Prevent forgetting

---

## Connecting to Other Modes

### From MasteryMode → Forge (Study)

1. Click **[Study Now]** on any card
2. Forge generates a problem tailored to your mastery level
3. Your response auto-updates your mastery

### From MasteryMode → Sage (Explain)

1. Click **[Study Now]** on a card
2. Before attempting: Click **[Explain this topic]** (or use Sage panel)
3. Get detailed walkthrough, then try a problem

### From MasteryMode → Scout (Search)

1. Looking for resources on a topic?
2. Switch to Vault or Editor
3. Scout will prioritize results by your mastery

---

## Accessibility

### Keyboard Users

- All interactive elements accessible via Tab
- Focus styles clearly visible (blue outline)
- Buttons work with Enter or Space

### Screen Reader Users

- Semantic HTML: Cards are `<article>` elements
- Status badges have text labels (not color alone)
- Mastery level always stated as percentage
- "At risk" indicators labeled explicitly

### Low Vision

- All text has 4.5:1 contrast ratio (WCAG AA)
- Zoom to 200% works smoothly
- Colors not the only signal (text labels included)

### Motion Sensitivity

- Animations respect `prefers-reduced-motion` setting
- Hover effects work without motion
- Still fully functional with animations disabled

---

## What's Coming

### Phase 2.6: Learning Path Visualization

- D3.js interactive graph
- See all your topics and their prerequisites
- Drag to rearrange, click to focus
- Visual bottleneck identification

### Phase 3: Advanced Analytics

- **Mastery forecast**: When will you master this topic?
- **Time allocation**: How to optimize study time
- **Misconception patterns**: Your common mistakes
- **Peer comparison** (if enabled): How you compare to classmates

### Phase 3+: Collaborative Features

- **Study groups**: Compare mastery with classmates
- **Shared learning paths**: Class-level dashboards
- **Progress sharing**: Show your progress to instructors

---

## Support

**Having trouble?**

- Check this guide for common questions
- Hover over any metric for tooltips (coming soon)
- Use **Help** panel (Cmd+Shift+?) for shortcuts
- Report issues in **Settings** → **Feedback**

**Want more detail?**

- See [MASTERYMODE_DESIGN_SYSTEM.md](MASTERYMODE_DESIGN_SYSTEM.md) for technical specs
- See [PHASE_2_BACKEND_SUMMARY.md](PHASE_2_BACKEND_SUMMARY.md) for how mastery is calculated

---

**Version 1.0** — May 2026  
Built with React 19, Tauri 2, Rust backend  
Bayesian mastery modeling with PyMC
