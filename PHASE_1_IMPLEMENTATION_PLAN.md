# Glyphic Phase 1 Implementation Plan — Days 1–30

## Executive Summary

**Objective**: Unify four isolated application modes (Editor, FE Prep, Vault, Diagram) into a single tabbed workspace with integrated AI agent system. Establish design token system and accessibility baseline.

**Deliverables**:

- Unified workspace shell (React 19 UI)
- Design token system (CSS custom properties)
- Accessibility compliance (WCAG AA baseline)
- Semantic search foundation (sentence-transformers integration)
- 5-agent system routing and tool specs
- 42 passing tests; zero regressions

**Duration**: 30 days
**Team**: Frontend (React/Tauri) | Backend (Rust, Python ML)
**Definition of Done**:

- All design tokens locked (no hardcoded colors/spacing)
- All 4 modes unified in single workspace with preserved functionality
- Semantic embeddings generated for vault notes (< 500ms on 1000 notes)
- 5 agents callable via Tauri commands with policy-as-data enforcement
- Accessibility audit passes WCAG AA on critical paths

---

## Architecture — Unified Workspace Model

### Current State (4 Isolated Modes)

```text
App.tsx
├── mode === 'editor' → EditorView
├── mode === 'fe_prep' → FEPrepView
├── mode === 'vault' → VaultView
└── mode === 'diagram' → DiagramView
```

**Problem**: Each mode reloads entire state; no cross-mode context; user must switch tabs to access different workflows.

### Target State (Unified Workspace)

```text
App.tsx (layout store active)
└── WorkspaceLayout
    ├── Sidebar (mode selector + global nav)
    ├── Editor Pane (editor/diagram hybrid — mode-aware)
    ├── Assistant Panel (5-agent system output)
    └── Inspector Panel (vault search, properties, AI help)
```

**Benefits**:

- Single app instance persists state across mode switches
- Cross-mode queries (e.g., "Find vault notes related to current diagram")
- 5-agent system always accessible for context
- Reduced reloads, faster tab switching

---

## Phase 1 — File-by-File Implementation

### 1. Design Token System (Days 1–3)

**Goal**: Extract all hardcoded colors, spacing, typography, motion into CSS custom properties. Enable theme switching without code changes.

#### 1.1 Create Token Definition File

**File**: `frontend/src/styles/_tokens.css`

```css
:root {
  /* ======= COLOR TOKENS ======= */
  /* Primary Palette (Midnight Eclipse + Accent) */
  --color-background-primary: #1C1B19;
  --color-background-secondary: #2A2926;
  --color-background-tertiary: #3A3935;
  --color-accent-primary: #C4884D;
  --color-accent-hover: #D9A062;
  --color-accent-active: #AF7742;
  --color-text-primary: #F5F3F0;
  --color-text-secondary: #A89E97;
  --color-text-muted: #7A7069;

  /* Semantic Colors */
  --color-success: #6B9E6B;
  --color-success-light: #8DB38D;
  --color-warning: #C4A24D;
  --color-warning-light: #D9B866;
  --color-error: #B85C5C;
  --color-error-light: #D47C7C;
  --color-info: #5C8EB8;
  --color-info-light: #7DA8D4;

  /* Glassmorphism (from globals.css) */
  --color-glass-background: rgba(196, 136, 77, 0.05);
  --color-glass-border: rgba(196, 136, 77, 0.2);

  /* ======= SPACING TOKENS ======= */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */

  /* ======= TYPOGRAPHY TOKENS ======= */
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-display: 'Instrument Serif', serif;
  --font-mono: 'JetBrains Mono', monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.5rem;    /* 24px */
  --font-size-2xl: 2rem;     /* 32px */

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  --line-height-tight: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* ======= MOTION TOKENS ======= */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --easing-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --easing-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --easing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* ======= FOCUS TOKENS ======= */
  --focus-ring-width: 2px;
  --focus-ring-color: var(--color-accent-primary);
  --focus-ring: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);

  /* ======= BORDER TOKENS ======= */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;

  /* ======= SHADOW TOKENS ======= */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}
```

**Status**: CREATE
**Owner**: Frontend
**Acceptance Criteria**:

- All 40+ tokens defined
- Passes CSS lint (no syntax errors)
- Covers color, spacing, typography, motion, focus, shadows

#### 1.2 Audit and Lock Hardcoded Styles

**File**: `frontend/src/styles/globals.css`

**Action**: Grep for hardcoded values and replace with token references.

```bash
# Find all hex colors
grep -r "#[0-9A-Fa-f]\{6\}\|#[0-9A-Fa-f]\{3\}" frontend/src --include="*.tsx" --include="*.css"

# Replace with tokens, e.g.:
# #1C1B19 → var(--color-background-primary)
# #C4884D → var(--color-accent-primary)
```

**Changes**:

- Replace all `#1C1B19` with `var(--color-background-primary)`
- Replace all `#C4884D` with `var(--color-accent-primary)`
- Replace all `16px` padding with `var(--spacing-md)`
- Replace all `300ms` transitions with `var(--duration-normal)`
- Remove all hardcoded focus styles; use `--focus-ring`

**Status**: EDIT
**Owner**: Frontend
**Acceptance Criteria**:

- No hardcoded colors in CSS (only token refs + rgba for glass)
- All spacing uses tokens
- All motion uses token durations
- Lint passes (0 hardcoded-value warnings)

#### 1.3 Create Theme System

**File**: `frontend/src/styles/themes.css`

```css
/* Light Theme Variant (optional future) */
@media (prefers-color-scheme: light) {
  :root[data-theme="light"] {
    --color-background-primary: #F5F3F0;
    --color-background-secondary: #E8E5E1;
    --color-text-primary: #1C1B19;
    --color-text-secondary: #5A524A;
    /* ...other token overrides... */
  }
}

/* High Contrast Variant */
:root[data-theme="high-contrast"] {
  --color-background-primary: #000000;
  --color-accent-primary: #FFFF00;
  --color-text-primary: #FFFFFF;
  --focus-ring-color: #FFFF00;
  --focus-ring-width: 3px;
}
```

**Status**: CREATE
**Owner**: Frontend
**Acceptance Criteria**:

- Midnight Eclipse theme (default)
- Light theme defined (not active in Phase 1)
- High-contrast theme defined (for accessibility)

---

### 2. Unified Workspace Layout (Days 3–10)

**Goal**: Replace isolated mode routing with unified workspace panes.

#### 2.1 Create Workspace Layout Component

**File**: `frontend/src/components/WorkspaceLayout.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import Sidebar from './Sidebar';
import EditorPane from './EditorPane';
import DiagramPane from './DiagramPane';
import AssistantPanel from './AssistantPanel';
import InspectorPanel from './InspectorPanel';
import styles from './WorkspaceLayout.module.css';

export const WorkspaceLayout: React.FC = () => {
  const {
    mode,
    leftPaneWidth,
    rightPaneWidth,
    assistantExpanded,
    setMode,
    setLeftPaneWidth,
    setRightPaneWidth,
    toggleAssistant,
  } = useLayoutStore();

  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={styles.workspace}>
      {/* Sidebar */}
      <nav className={styles.sidebar} role="navigation">
        <Sidebar currentMode={mode} onModeChange={setMode} />
      </nav>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Left Editor/Diagram Pane (resizable) */}
        <div 
          className={styles.leftPane}
          style={{ width: `${leftPaneWidth}%` }}
          role="region"
          aria-label="Editor area"
        >
          {mode === 'editor' && <EditorPane />}
          {mode === 'diagram' && <DiagramPane />}
          {mode === 'vault' && <VaultPane />}
          {mode === 'fe_prep' && <FEPrepPane />}
        </div>

        {/* Resizer */}
        <div 
          className={styles.resizer}
          draggable
          onDrag={(e) => {
            const newWidth = (e.clientX / viewportWidth) * 100;
            setLeftPaneWidth(Math.max(20, Math.min(80, newWidth)));
          }}
          role="separator"
          aria-label="Resize editor pane"
        />

        {/* Right Assistant Panel (collapsible) */}
        <div 
          className={`${styles.rightPane} ${assistantExpanded ? styles.expanded : styles.collapsed}`}
          role="region"
          aria-label="AI Assistant"
        >
          <AssistantPanel onToggle={toggleAssistant} />
        </div>
      </main>
    </div>
  );
};

export default WorkspaceLayout;
```

**Status**: CREATE
**Owner**: Frontend
**Acceptance Criteria**:

- Sidebar, editor pane, resizer, assistant panel render without errors
- Mode switching preserves scroll position and undo/redo stack
- Resizer dragging updates layout store
- All panes respect token spacing/colors

#### 2.2 Update App.tsx to Use WorkspaceLayout

**File**: `frontend/src/App.tsx`

**Before**:

```typescript
export const App: React.FC = () => {
  const { mode } = useLayoutStore();

  return (
    <div className="app">
      {mode === 'editor' && <EditorView />}
      {mode === 'fe_prep' && <FEPrepView />}
      {mode === 'vault' && <VaultView />}
      {mode === 'diagram' && <DiagramView />}
    </div>
  );
};
```

**After**:

```typescript
import WorkspaceLayout from './components/WorkspaceLayout';

export const App: React.FC = () => {
  return (
    <ActivationGate>
      <WorkspaceLayout />
    </ActivationGate>
  );
};
```

**Status**: EDIT  
**Owner**: Frontend  
**Acceptance Criteria**:

- App boots to unified workspace (not isolated modes)
- Sidebar visible on left
- Mode button clicks switch panes
- All four modes fully functional within workspace

#### 2.3 Create Sidebar Component

**File**: `frontend/src/components/Sidebar.tsx`

```typescript
import React from 'react';
import { 
  FileText, 
  BookOpen, 
  Grid3x3, 
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  currentMode: 'editor' | 'fe_prep' | 'vault' | 'diagram';
  onModeChange: (mode: 'editor' | 'fe_prep' | 'vault' | 'diagram') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentMode, onModeChange }) => {
  const modeButtons = [
    { id: 'editor', label: 'Editor', icon: FileText },
    { id: 'vault', label: 'Vault', icon: BookOpen },
    { id: 'diagram', label: 'Diagram', icon: Grid3x3 },
    { id: 'fe_prep', label: 'FE Prep', icon: BarChart3 },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h1 className={styles.title}>Glyphic</h1>
      </div>

      <nav className={styles.modeNav} role="tablist">
        {modeButtons.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.modeButton} ${currentMode === id ? styles.active : ''}`}
            onClick={() => onModeChange(id as any)}
            role="tab"
            aria-selected={currentMode === id}
            aria-controls={`${id}-pane`}
            title={label}
          >
            <Icon size={20} />
            <span className={styles.label}>{label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <button className={styles.iconButton} title="Settings">
          <Settings size={20} />
        </button>
        <button className={styles.iconButton} title="Sign Out">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
```

**File**: `frontend/src/components/Sidebar.module.css`

```css
.sidebar {
  display: flex;
  flex-direction: column;
  width: 80px;
  background-color: var(--color-background-secondary);
  border-right: 1px solid var(--color-glass-border);
  padding: var(--spacing-md);
  gap: var(--spacing-lg);
}

.header {
  text-align: center;
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-glass-border);
}

.title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-primary);
  margin: 0;
}

.modeNav {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  list-style: none;
  padding: 0;
  margin: 0;
}

.modeButton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--border-radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal) var(--easing-ease-in-out);
  font-size: var(--font-size-xs);
}

.modeButton:hover {
  background-color: var(--color-glass-background);
  border-color: var(--color-glass-border);
  color: var(--color-text-primary);
}

.modeButton.active {
  background-color: var(--color-glass-background);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.modeButton:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}

.label {
  display: none;
}

.spacer {
  flex: 1;
}

.footer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  border-top: 1px solid var(--color-glass-border);
  padding-top: var(--spacing-md);
}

.iconButton {
  padding: var(--spacing-sm);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--border-radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.iconButton:hover {
  background-color: var(--color-glass-background);
  color: var(--color-text-primary);
}

.iconButton:focus-visible {
  outline: var(--focus-ring);
}

/* Responsive: Show labels on larger screens */
@media (min-width: 768px) {
  .sidebar {
    width: 200px;
  }

  .label {
    display: inline;
  }

  .modeButton {
    flex-direction: row;
    justify-content: flex-start;
    gap: var(--spacing-md);
  }
}
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- Sidebar renders with 4 mode buttons
- Active mode highlighted
- Hover states work
- Focus visible on keyboard navigation
- Responsive (icons on mobile, labels on desktop)

---

### 3. Accessibility Baseline (Days 8–12)

**Goal**: WCAG AA compliance on critical paths (editor, vault search, AI chat).

#### 3.1 Add Reduced Motion Handling

**File**: `frontend/src/hooks/useReducedMotion.ts`

```typescript
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
};
```

**Usage**:

```typescript
const prefersReducedMotion = useReducedMotion();
const duration = prefersReducedMotion ? '0ms' : 'var(--duration-normal)';
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- Hook detects system preference
- Respects runtime media query changes
- Used in all animated components

#### 3.2 Add Semantic HTML + ARIA

**File**: `frontend/src/components/EditorPane.tsx` (example refactor)

**Before**:

```typescript
<div className="editor">
  <div onClick={handleSave}>Save</div>
  <div className="content">{content}</div>
</div>
```

**After**:

```typescript
<section className="editor" aria-label="Code Editor">
  <button 
    onClick={handleSave}
    aria-label="Save changes"
    className="saveButton"
  >
    Save
  </button>
  <textarea 
    className="content"
    value={content}
    onChange={(e) => setContent(e.target.value)}
    aria-label="Editor content"
  />
</section>
```

**Changes Across All Components**:

- Replace `<div>` with `<button>`, `<nav>`, `<main>`, `<section>` where semantically appropriate
- Add `role="*"` to custom components (e.g., `role="tab"` for mode buttons)
- Add `aria-label`, `aria-labelledby`, `aria-describedby` to interactive elements
- Add `aria-expanded`, `aria-controls` for panels/modals
- Add `aria-live="polite"` for AI responses

**Status**: EDIT  
**Owner**: Frontend (all components)  
**Acceptance Criteria**:

- Axe accessibility scan: < 5 violations (non-critical)
- Keyboard navigation works on all interactive elements
- Screen reader announces critical state changes

#### 3.3 Contrast and Focus Styles Audit

**File**: `frontend/src/styles/_accessibility.css`

```css
/* Ensure 4.5:1 contrast ratio on all text */
body {
  color: var(--color-text-primary);  /* #F5F3F0 on #1C1B19 = 15:1 ✓ */
  background-color: var(--color-background-primary);
}

/* Focus visible indicator (required) */
:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}

/* Keyboard-only focus (hide for mouse) */
button:focus-visible,
a:focus-visible,
input:focus-visible,
[role="button"]:focus-visible {
  outline: var(--focus-ring);
}

/* Ensure skip link works */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-accent-primary);
  color: var(--color-background-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

**HTML Update** (`frontend/index.html`):

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <div id="app"></div>
</body>
```

**Status**: CREATE/EDIT  
**Owner**: Frontend  
**Acceptance Criteria**:

- All text meets 4.5:1 (WCAG AAA) or 3:1 (WCAG AA) contrast
- Focus indicator visible on all interactive elements
- Skip link functional
- No `outline: none` without replacement

---

### 4. Semantic Search Foundation (Days 10–20)

**Goal**: Integrate sentence-transformers for vault note embeddings.

#### 4.1 Create Python Sidecar — Embedding Engine

**File**: `backend/sidecars/embedding_engine/main.py`

```python
#!/usr/bin/env python3
"""
Embedding Engine Sidecar for Glyphic
Generates and stores semantic embeddings for vault notes using sentence-transformers.
"""

import json
import sys
import logging
from pathlib import Path
from typing import List, Dict, Any
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    from typing import Optional
except ImportError:
    print(json.dumps({
        "status": "error",
        "message": "Required packages not installed. Run: pip install -r requirements.txt"
    }), file=sys.stdout)
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EmbeddingEngine:
    """Manages semantic embeddings for study notes."""
    
    MODEL_NAME = "all-MiniLM-L6-v2"  # 22MB, CPU-friendly
    EMBEDDING_DIM = 384
    
    def __init__(self):
        """Initialize the embedding model."""
        logger.info(f"Loading model: {self.MODEL_NAME}")
        self.model = SentenceTransformer(self.MODEL_NAME)
        logger.info("Model loaded successfully")
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        try:
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error encoding text: {e}")
            return None
    
    def embed_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts."""
        try:
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            return [e.tolist() for e in embeddings]
        except Exception as e:
            logger.error(f"Error encoding batch: {e}")
            return [None] * len(texts)
    
    def compute_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        """Compute cosine similarity between two embeddings."""
        try:
            a = np.array(emb1)
            b = np.array(emb2)
            return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        except Exception as e:
            logger.error(f"Error computing similarity: {e}")
            return 0.0

def main():
    """Main loop: read NDJSON from stdin, write results to stdout."""
    engine = EmbeddingEngine()
    
    try:
        for line in sys.stdin:
            if not line.strip():
                continue
            
            try:
                request = json.loads(line)
                command = request.get("command")
                
                if command == "embed":
                    text = request.get("text", "")
                    embedding = engine.embed_text(text)
                    response = {
                        "command": "embed",
                        "status": "success" if embedding else "error",
                        "embedding": embedding,
                        "dimension": len(embedding) if embedding else 0
                    }
                
                elif command == "embed_batch":
                    texts = request.get("texts", [])
                    embeddings = engine.embed_batch(texts)
                    response = {
                        "command": "embed_batch",
                        "status": "success",
                        "count": len(embeddings),
                        "embeddings": embeddings
                    }
                
                elif command == "health":
                    response = {
                        "status": "healthy",
                        "model": engine.MODEL_NAME,
                        "embedding_dim": engine.EMBEDDING_DIM
                    }
                
                else:
                    response = {
                        "status": "error",
                        "message": f"Unknown command: {command}"
                    }
                
                print(json.dumps(response), flush=True)
            
            except json.JSONDecodeError as e:
                response = {"status": "error", "message": f"Invalid JSON: {e}"}
                print(json.dumps(response), flush=True)
            
            except Exception as e:
                response = {"status": "error", "message": str(e)}
                print(json.dumps(response), flush=True)
    
    except KeyboardInterrupt:
        logger.info("Embedding engine shutting down")
        sys.exit(0)

if __name__ == "__main__":
    main()
```

**File**: `backend/sidecars/embedding_engine/requirements.txt`

```text
sentence-transformers==3.0.0
numpy==1.24.3
torch==2.0.1
transformers==4.30.2
```

**Status**: CREATE  
**Owner**: Backend (Python ML)  
**Acceptance Criteria**:

- Model downloads and loads in < 30 seconds on first run
- Embedding generation: < 50ms per 100 tokens
- Batch embedding: < 500ms for 1000 notes (384-dim vectors)
- NDJSON protocol: stdin → stdout with proper error handling

#### 4.2 Create Rust Backend Command — Semantic Search

**File**: `frontend/src-tauri/src/commands/search_semantic.rs`

```rust
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use crate::db::Database;
use crate::embedding_engine::EmbeddingEngine;

#[derive(Deserialize)]
pub struct SemanticSearchRequest {
    pub query: String,
    pub top_k: usize,
    pub min_confidence: f32,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub confidence: f32,
    pub source: String,
}

#[tauri::command]
pub async fn search_semantic(
    req: SemanticSearchRequest,
    db: State<'_, Arc<Database>>,
    embedding_engine: State<'_, Arc<EmbeddingEngine>>,
) -> Result<Vec<SearchResult>, String> {
    // 1. Generate query embedding
    let query_embedding = embedding_engine
        .embed(&req.query)
        .await
        .map_err(|e| format!("Embedding failed: {}", e))?;

    // 2. Search vault in SQLite + sqlite-vec
    let results = db
        .semantic_search(&query_embedding, req.top_k, req.min_confidence)
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    // 3. Format and return
    Ok(results)
}

#[tauri::command]
pub async fn reindex_vault(
    db: State<'_, Arc<Database>>,
    embedding_engine: State<'_, Arc<EmbeddingEngine>>,
) -> Result<String, String> {
    // Regenerate all embeddings for vault notes
    let notes = db
        .get_all_notes()
        .await
        .map_err(|e| format!("Failed to fetch notes: {}", e))?;

    for note in notes {
        let embedding = embedding_engine
            .embed(&note.content)
            .await
            .map_err(|e| format!("Embedding failed for note {}: {}", note.id, e))?;

        db
            .update_note_embedding(&note.id, embedding)
            .await
            .map_err(|e| format!("Update failed for note {}: {}", note.id, e))?;
    }

    Ok(format!("Reindexed {} notes", notes.len()))
}
```

**Status**: CREATE  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- Command receives query, returns top-3 results with confidence
- Reindex completes in < 500ms for 1000 notes (single-threaded; parallelizable in Phase 2)
- Integration test passes

#### 4.3 Update Database Schema

**File**: `frontend/src-tauri/src/db/mod.rs` (expand schema)

```sql
-- Add embeddings table (sqlite-vec)
CREATE TABLE IF NOT EXISTS note_embeddings (
    note_id TEXT PRIMARY KEY,
    embedding F32(384),  -- 384-dimensional embedding
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- Create vector index for fast search
CREATE INDEX IF NOT EXISTS idx_note_embeddings_vector
  ON note_embeddings (embedding);
```

**Migration**: `frontend/src-tauri/migrations/add_embeddings.sql`

```sql
-- Glyphic Phase 1: Add semantic search support

CREATE TABLE IF NOT EXISTS note_embeddings (
    note_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,  -- 384-dimensional f32 vector
    model_name TEXT DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS update_note_embeddings_timestamp
AFTER UPDATE ON note_embeddings
BEGIN
    UPDATE note_embeddings SET updated_at = CURRENT_TIMESTAMP 
    WHERE rowid = NEW.rowid;
END;
```

**Status**: CREATE  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- Migration runs without errors
- Embeddings table created with proper schema
- Index created for vector search performance

#### 4.4 Create Scout Retrieval UI Component

**File**: `frontend/src/components/AssistantPanel/ScoutResults.tsx`

```typescript
import React, { useState } from 'react';
import { Search, ChevronRight, AlertCircle } from 'lucide-react';
import styles from './ScoutResults.module.css';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  confidence: number;
  masteryGap?: number;
  source: 'vault' | 'external';
}

interface ScoutResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  confidence: number;
  onSelectResult: (resultId: string) => void;
}

export const ScoutResults: React.FC<ScoutResultsProps> = ({
  results,
  isLoading,
  confidence,
  onSelectResult,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner} />
        <p>Searching vault...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={styles.empty}>
        <AlertCircle size={24} />
        <p>No results found. Try a different search.</p>
      </div>
    );
  }

  return (
    <div className={styles.results}>
      <div className={styles.header}>
        <h3>Scout Results</h3>
        <span className={styles.confidence}>
          Confidence: {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className={styles.resultsList} role="list">
        {results.map((result, index) => (
          <div
            key={result.id}
            className={`${styles.result} ${expandedId === result.id ? styles.expanded : ''}`}
            role="listitem"
            onClick={() => onSelectResult(result.id)}
          >
            <div className={styles.resultHeader}>
              <span className={styles.rank}>{index + 1}</span>
              <div className={styles.titleArea}>
                <h4 className={styles.title}>{result.title}</h4>
                <div className={styles.meta}>
                  <span className={styles.confidenceTag}>
                    {(result.confidence * 100).toFixed(0)}% match
                  </span>
                  {result.masteryGap && (
                    <span className={styles.masteryTag}>
                      ⚠️ Weak ({(result.masteryGap * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight
                size={18}
                className={styles.chevron}
                aria-hidden="true"
              />
            </div>

            {expandedId === result.id && (
              <div className={styles.snippet}>
                <p>{result.snippet}</p>
                <button className={styles.actionButton}>
                  View Full Note →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoutResults;
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- Results display with confidence scores
- Expandable snippets work
- Accessibility: role="list", aria-live updates
- Click handlers properly bound

---

### 5. 5-Agent System Integration (Days 15–25)

**Goal**: Wire up Tauri commands for each agent's core tools.

#### 5.1 Register Tauri Commands

**File**: `frontend/src-tauri/src/main.rs`

```rust
mod commands {
    pub mod search_semantic;
    pub mod ai_chat;
    pub mod generate_problems;
    pub mod grade_attempt;
    pub mod get_learning_path;
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Scout Commands
            commands::search_semantic::search_semantic,
            commands::search_semantic::reindex_vault,
            
            // Sage Commands
            commands::ai_chat::explain_concept,
            commands::ai_chat::fetch_prerequisites,
            
            // Forge Commands
            commands::generate_problems::generate_problem_set,
            commands::generate_problems::validate_problem,
            
            // Prism Commands
            commands::grade_attempt::grade_response,
            commands::grade_attempt::detect_misconception,
            
            // Pathfinder Commands
            commands::get_learning_path::compute_learning_path,
            commands::get_learning_path::get_weekly_schedule,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Status**: EDIT  
**Owner**: Backend (Rust)  
**Acceptance Criteria**:

- All 10+ agent commands register without errors
- Each command has proper error handling
- Integration tests pass for happy path

#### 5.2 Create AssistantPanel Component

**File**: `frontend/src/components/AssistantPanel.tsx`

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import ScoutResults from './AssistantPanel/ScoutResults';
import SageExplanation from './AssistantPanel/SageExplanation';
import ForgeProblems from './AssistantPanel/ForgeProblems';
import PrismGrading from './AssistantPanel/PrismGrading';
import PathfinderPlan from './AssistantPanel/PathfinderPlan';
import styles from './AssistantPanel.module.css';

export type AgentType = 'scout' | 'sage' | 'forge' | 'prism' | 'pathfinder';

interface AssistantMessage {
  id: string;
  agent: AgentType;
  content: any;
  timestamp: number;
  confidence: number;
}

export const AssistantPanel: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState<AgentType>('scout');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleQuery = async (query: string, agent: AgentType) => {
    setIsLoading(true);
    setActiveAgent(agent);

    try {
      const response = await invoke(`${agent}_query`, { query });
      const message: AssistantMessage = {
        id: `${agent}-${Date.now()}`,
        agent,
        content: response,
        timestamp: Date.now(),
        confidence: (response as any).confidence || 0.5,
      };
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      console.error(`Error querying ${agent}:`, error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          agent: 'scout',
          content: { error: String(error) },
          timestamp: Date.now(),
          confidence: 0,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="AI Assistant Panel">
      <div className={styles.header}>
        <h2>Assistant</h2>
        <div className={styles.agentButtons}>
          {(['scout', 'sage', 'forge', 'prism', 'pathfinder'] as AgentType[]).map((agent) => (
            <button
              key={agent}
              className={`${styles.agentButton} ${activeAgent === agent ? styles.active : ''}`}
              onClick={() => setActiveAgent(agent)}
              aria-pressed={activeAgent === agent}
            >
              {agent.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.conversationArea} ref={scrollRef} role="log" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.message} ${styles[msg.agent]}`}>
            {msg.agent === 'scout' && <ScoutResults {...msg.content} />}
            {msg.agent === 'sage' && <SageExplanation {...msg.content} />}
            {msg.agent === 'forge' && <ForgeProblems {...msg.content} />}
            {msg.agent === 'prism' && <PrismGrading {...msg.content} />}
            {msg.agent === 'pathfinder' && <PathfinderPlan {...msg.content} />}
          </div>
        ))}
      </div>

      <div className={styles.inputArea}>
        <input
          type="text"
          placeholder={`Ask ${activeAgent} something...`}
          className={styles.input}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleQuery((e.target as HTMLInputElement).value, activeAgent);
              (e.target as HTMLInputElement).value = '';
            }
          }}
          disabled={isLoading}
        />
      </div>
    </section>
  );
};

export default AssistantPanel;
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- All 5 agent buttons render
- Query routing works (agent selection → command dispatch)
- Messages display in conversation thread
- Auto-scroll works
- Error handling for failed queries

---

### 6. Testing & Validation (Days 20–30)

**Goal**: 42 passing tests; zero visual regressions; accessibility baseline.

#### 6.1 Unit Tests — Layout

**File**: `frontend/src/components/__tests__/WorkspaceLayout.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceLayout from '../WorkspaceLayout';

describe('WorkspaceLayout', () => {
  it('renders sidebar with 4 mode buttons', () => {
    render(<WorkspaceLayout />);
    expect(screen.getByRole('button', { name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vault/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diagram/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fe prep/i })).toBeInTheDocument();
  });

  it('switches modes on button click', async () => {
    const user = userEvent.setup();
    render(<WorkspaceLayout />);
    
    const vaultButton = screen.getByRole('button', { name: /vault/i });
    await user.click(vaultButton);
    
    expect(screen.getByText(/vault content/i)).toBeInTheDocument();
  });

  it('preserves scroll position when switching modes', async () => {
    // Test implementation
  });
});
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- 12+ tests for layout (rendering, mode switching, resizing)
- All pass without warnings

#### 6.2 Integration Tests — Agent Commands

**File**: `frontend/src-tauri/__tests__/commands_integration.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_semantic_search_returns_results() {
        let db = Arc::new(Database::new_in_memory());
        let embedding_engine = Arc::new(EmbeddingEngine::new().await.unwrap());
        
        // Add test note
        db.insert_note("note-1", "transfer functions", "The transfer function is...", None)
            .await
            .unwrap();
        
        // Generate embedding
        embedding_engine.embed("transfer functions").await.unwrap();
        
        // Search
        let req = SemanticSearchRequest {
            query: "how do transfer functions work".to_string(),
            top_k: 3,
            min_confidence: 0.5,
        };
        
        let results = search_semantic(req, State::from(&db), State::from(&embedding_engine))
            .await
            .unwrap();
        
        assert!(!results.is_empty());
        assert!(results[0].confidence > 0.5);
    }
}
```

**Status**: CREATE  
**Owner**: Backend  
**Acceptance Criteria**:

- 15+ integration tests for agent commands
- All pass without panics
- Coverage: search, grade, generate, plan

#### 6.3 E2E Tests — Critical User Paths

**File**: `frontend/e2e/workspace.spec.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Unified Workspace', () => {
  test('User can switch between modes and perform actions', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Start in editor mode
    expect(page.locator('[role="tab"][aria-selected="true"]')).toContainText('Editor');
    
    // Switch to vault
    await page.click('button:has-text("Vault")');
    expect(page.locator('[role="tab"][aria-selected="true"]')).toContainText('Vault');
    
    // Perform semantic search
    await page.fill('input[placeholder*="Search"]', 'transfer functions');
    await page.click('button:has-text("Search")');
    
    // Results should appear
    await expect(page.locator('[role="list"] [role="listitem"]')).toHaveCount(3);
  });

  test('Assistant panel shows Scout results with confidence scores', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Click Scout button
    await page.click('button:has-text("SCOUT")');
    
    // Verify panel shows results with confidence badges
    const confidenceBadges = page.locator('[class*="confidence"]');
    await expect(confidenceBadges.first()).toContainText('%');
  });
});
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- 8+ E2E tests covering critical paths
- All pass on headless browser
- No flaky tests

#### 6.4 Accessibility Audit

**File**: `frontend/e2e/accessibility.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('Homepage meets WCAG AA standards', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await injectAxe(page);
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'aria-required-attr': { enabled: true },
      },
    });
  });

  test('Keyboard navigation works on all interactive elements', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Tab through sidebar buttons
    await page.keyboard.press('Tab');
    let focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('BUTTON');
    
    // Continue tabbing — should visit all buttons
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
    }
  });
});
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- Axe scan: 0 critical violations, < 5 warnings
- Keyboard navigation works on all interactive elements
- Focus indicators visible

#### 6.5 Performance Audit

**File**: `frontend/e2e/performance.spec.ts`

```typescript
test('Semantic search completes in < 500ms for 1000 notes', async ({ page }) => {
  const startTime = performance.now();
  
  // Trigger search
  await page.fill('input[placeholder*="Search"]', 'test query');
  await page.click('button:has-text("Search")');
  
  // Wait for results
  await expect(page.locator('[role="list"] [role="listitem"]')).toHaveCount(3);
  
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(500);
});

test('Mode switching has < 150ms perceived delay', async ({ page }) => {
  // Measure time from button click to content visible
  const startTime = performance.now();
  
  await page.click('button:has-text("Vault")');
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toContainText('Vault');
  
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(150);
});
```

**Status**: CREATE  
**Owner**: Frontend  
**Acceptance Criteria**:

- Search latency: < 500ms
- Mode switching: < 150ms perceived delay
- First contentful paint: < 2s

---

## Acceptance Criteria Summary

### Phase 1 Definition of Done

**Code Quality**:

- ✅ 42 tests passing (unit + integration + E2E)
- ✅ 0 design token hardcodes
- ✅ TypeScript strict mode: 0 errors
- ✅ ESLint: 0 errors (warnings OK)
- ✅ Markdown lint: 0 errors on all docs

**UI/UX**:

- ✅ Unified workspace shell fully functional
- ✅ All 4 modes accessible via sidebar tabs
- ✅ Mode switching preserves state (scroll, undo, selections)
- ✅ 5-agent buttons visible and clickable in Assistant Panel
- ✅ Visual regression tests pass

**Accessibility**:

- ✅ WCAG AA on critical paths (editor, search, assistant)
- ✅ Keyboard navigation works on all interactive elements
- ✅ Focus indicators visible
- ✅ Semantic HTML + ARIA labels on 90%+ of components
- ✅ Reduced-motion respected

**Semantic Search**:

- ✅ Embedding engine loads in < 30s
- ✅ Single text embedding: < 50ms per 100 tokens
- ✅ Batch embedding: < 500ms for 1000 notes
- ✅ Semantic search command callable via Tauri
- ✅ Scout UI displays results with confidence scores

**Agent System**:

- ✅ All 5 agent commands registered in Tauri
- ✅ Agent routing in AssistantPanel works
- ✅ Policy-as-data files present (5 research policies + prompts)
- ✅ Confidence gates fire on low-confidence responses
- ✅ Fallback behaviors documented and implemented

**Performance**:

- ✅ First contentful paint: < 2s
- ✅ Time to interactive: < 3s
- ✅ Mode switching latency: < 150ms
- ✅ Semantic search latency: < 500ms
- ✅ Bundle size: no increase from current

---

## Risk Mitigation

### Risk 1: Semantic Search Latency

**Probability**: Medium | **Impact**: High

- **Mitigation**: CPU-efficient model (all-MiniLM-L6-v2, 22MB), batch processing, async Python sidecar
- **Contingency**: Fall back to FTS5 if embeddings unavailable

### Risk 2: Mode Switching State Loss

**Probability**: Low | **Impact**: High

- **Mitigation**: Persist layout store to LocalStorage on every change, unit tests for state preservation
- **Contingency**: Force full page reload (acceptable but worse UX)

### Risk 3: Accessibility Testing

**Probability**: Medium | **Impact**: Medium

- **Mitigation**: Axe automated scans in CI, manual keyboard nav testing, WCAG AA target (not AAA)
- **Contingency**: Defer non-critical accessibility fixes to Phase 2

### Risk 4: Agent Response Latency

**Probability**: Medium | **Impact**: Medium

- **Mitigation**: Confidence gates allow async AI responses (show "thinking..." indicator), timeouts
- **Contingency**: Show cached results or "Ask Sage" fallback

---

## Success Metrics

| Metric | Target | Achieved? |
| --- | --- | --- |
| Tests Passing | 42+ | 🔵 TBD |
| Design Tokens Used | 100% | 🔵 TBD |
| WCAG AA Compliance | 95%+ | 🔵 TBD |
| FCP | < 2s | 🔵 TBD |
| Search Latency | < 500ms | 🔵 TBD |
| Agent Commands Callable | 5/5 | 🔵 TBD |
| Zero Regressions | ✅ | 🔵 TBD |

---

## Next Phase (Phase 2 — Days 31–60)

**Focus**: Bayesian Mastery Modeling + Adaptive Problem Generation

- Implement PyMC for Bayesian inference on mastery
- Create problem generator (Forge) with adaptive difficulty
- Integrate Prism's misconception detection
- Add mastery visualization (confidence intervals)
- Performance optimization (parallel embeddings, query caching)

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-11  
**Status**: Ready for implementation kickoff
