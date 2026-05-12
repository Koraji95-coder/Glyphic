# Glyphic Deployment & Release Guide

**Version**: 1.0  
**Date**: May 11, 2026  
**Audience**: DevOps, Release Engineering, Team Leads

---

## Overview

This guide covers end-to-end deployment of Glyphic (Tauri + React frontend, Rust backend, Python ML sidecars) from CI/CD through production release via GitHub Releases.

**Deployment Targets**:
- Development: Local environment (dev mode only)
- Staging: Internal testing (builds + E2E tests)
- Production: GitHub Releases + automatic updates via Tauri Updater

**Build Strategy**:
- Frontend: Tauri desktop app (native Rust shell + React WebView)
- Backend: Compiled Rust binary (cross-platform: Windows x64, macOS Intel/Apple, Linux x64)
- Python Sidecars: Bundled within Tauri app + auto-extracted at runtime

---

## CI/CD Pipeline (GitHub Actions)

### Workflow: `.github/workflows/test-build-release.yml`

```yaml
name: Test, Build, Release

on:
  push:
    branches: [main, develop]
    tags: ['v*.*.*']
  pull_request:
    branches: [main, develop]

env:
  CARGO_TERM_COLOR: always
  RUST_VERSION: 1.75.0

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-gnu,aarch64-apple-darwin
      
      - name: Install Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
      
      - name: Run Rust tests
        run: |
          cd frontend/src-tauri
          cargo test --lib --test commands_integration
          cargo test --release
      
      - name: Run Python tests
        run: |
          pip install -r backend/requirements.txt
          pip install pytest pytest-cov
          python -m pytest backend/sidecars/ -v --cov=backend
      
      - name: Lint checks
        run: |
          cargo clippy --all-targets --all-features -- -D warnings
          npm run lint (frontend)
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    if: startsWith(github.ref, 'refs/tags/')
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact_name: Glyphic-windows-x64.exe
          
          - os: macos-latest
            target: x86_64-apple-darwin
            artifact_name: Glyphic-macos-intel.dmg
          
          - os: macos-latest
            target: aarch64-apple-darwin
            artifact_name: Glyphic-macos-arm64.dmg
          
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            artifact_name: Glyphic-linux-x64.AppImage
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install dependencies (Windows)
        if: matrix.os == 'windows-latest'
        run: |
          choco install nodejs
          choco install llvm
      
      - name: Install dependencies (macOS)
        if: matrix.os == 'macos-latest'
        run: |
          brew install node
          brew install llvm
      
      - name: Install dependencies (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y nodejs libssl-dev libgtk-3-dev libwebkit2gtk-4.0-dev
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      
      - name: Build Tauri app
        run: |
          cd frontend
          npm ci
          npm run desktop:build -- --target ${{ matrix.target }}
      
      - name: Sign & notarize (macOS only)
        if: matrix.os == 'macos-latest'
        env:
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          # Codesign & notarize
          codesign -s "$APPLE_SIGNING_IDENTITY" Glyphic.app
          xcrun notarytool submit Glyphic.dmg --apple-id "$APPLE_ID" ...
      
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.artifact_name }}
          path: target/${{ matrix.target }}/release/${{ matrix.artifact_name }}

  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download artifacts
        uses: actions/download-artifact@v3
      
      - name: Generate changelog
        run: |
          git log $(git describe --tags --abbrev=0)..HEAD --oneline > CHANGELOG_${{ github.ref_name }}.txt
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            Glyphic-windows-x64.exe
            Glyphic-macos-intel.dmg
            Glyphic-macos-arm64.dmg
            Glyphic-linux-x64.AppImage
          body_path: CHANGELOG_${{ github.ref_name }}.txt
          draft: false
          prerelease: ${{ contains(github.ref, 'beta') || contains(github.ref, 'alpha') }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Trigger updater refresh
        run: |
          curl -X POST https://releases.glyphic.app/api/refresh \
            -H "Authorization: Bearer ${{ secrets.UPDATER_TOKEN }}"
```

**Workflow Stages**:
1. **Test**: Run all unit + integration tests (Rust, Python)
2. **Build**: Cross-compile for Windows, macOS, Linux (only on tag push)
3. **Release**: Create GitHub Release with artifacts + changelog

---

## Manual Build Instructions (Local Dev)

### Prerequisites

```bash
# Install Rust 1.75+
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
rustup target add x86_64-pc-windows-gnu  # if cross-compiling

# Install Node.js 18+
# macOS: brew install node
# Windows: choco install nodejs
# Linux: sudo apt-get install nodejs

# Install Python 3.11+
# macOS: brew install python@3.11
# Windows: https://www.python.org/downloads/
# Linux: sudo apt-get install python3.11

# OS-specific deps
# macOS: xcode-select --install
# Windows: Visual Studio Build Tools (MSVC)
# Linux: sudo apt-get install libssl-dev libgtk-3-dev libwebkit2gtk-4.0-dev
```

### Development Build

```bash
# Frontend (React + Tauri dev mode)
cd frontend
npm ci
npm run dev  # Start Vite dev server on localhost:5173

# In another terminal, start Tauri in dev mode
npm run desktop  # Launches desktop app pointing to localhost:5173

# Python sidecars start automatically when app launches
# Logs appear in: ~/.glyphic/logs/

# Tests
npm run test  # Unit + integration tests
cargo test --test commands_integration  # Tauri command tests
```

### Production Build

```bash
# Frontend build
cd frontend
npm ci
npm run desktop:build  # Produces .exe/.dmg/.AppImage

# Output locations:
# Windows: frontend/src-tauri/target/release/Glyphic.exe
# macOS:   frontend/src-tauri/target/release/Glyphic.app
# Linux:   frontend/src-tauri/target/release/glyphic.AppImage

# Build for specific target
npm run desktop:build -- --target aarch64-apple-darwin
```

---

## Python Sidecar Bundling

### Directory Structure

```
frontend/src-tauri/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── commands/
│   │   ├── agent_commands.rs
│   │   ├── search_commands.rs
│   │   └── ...
│   └── ...
└── sidecars/  # <-- Python binaries bundled here
    ├── embedding_engine/
    │   ├── dist/  # PyInstaller output (one .exe per OS)
    │   └── embedding_engine.exe (Windows)
    │   └── embedding_engine (macOS/Linux)
    ├── search_orchestrator/
    ├── agent_orchestrator/
    └── mastery_engine/
```

### Bundling Python Binaries

**Step 1: Build Python Executables with PyInstaller**

```bash
# For each sidecar
cd backend/sidecars/embedding_engine

# Create spec file (one-time)
pyi-makespec main.py --onefile --name embedding_engine

# Build for Windows
pyinstaller embedding_engine.spec --distpath ../../frontend/src-tauri/sidecars/embedding_engine/dist-windows/

# Build for macOS (Intel)
pyinstaller embedding_engine.spec --distpath ../../frontend/src-tauri/sidecars/embedding_engine/dist-macos-intel/

# Build for macOS (Apple Silicon)
pyinstaller embedding_engine.spec --distpath ../../frontend/src-tauri/sidecars/embedding_engine/dist-macos-arm64/

# Build for Linux
pyinstaller embedding_engine.spec --distpath ../../frontend/src-tauri/sidecars/embedding_engine/dist-linux/
```

**Step 2: Configure Tauri to Bundle Sidecars**

`frontend/src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "frontendDist": "../dist",
    "bundleCommand": "build",
    "bundleArgs": []
  },
  "bundle": {
    "targets": ["exe", "dmg", "AppImage"],
    "externalBin": [
      {
        "name": "embedding_engine",
        "src": "sidecars/embedding_engine/dist-{os}/embedding_engine{.exe}",
        "strip": false
      },
      {
        "name": "search_orchestrator",
        "src": "sidecars/search_orchestrator/dist-{os}/search_orchestrator{.exe}",
        "strip": false
      },
      # ... other sidecars
    ]
  }
}
```

**Step 3: Auto-Extract on Launch**

`frontend/src-tauri/src/main.rs`:

```rust
fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path_resolver().app_data_dir()
                .expect("Failed to get app data dir");
            
            // Extract Python binaries from bundle
            extract_sidecars(&app_dir)?;
            
            // Spawn embedding engine sidecar
            std::process::Command::new(
                app_dir.join("sidecars").join("embedding_engine")
            )
            .spawn()
            .expect("Failed to start embedding engine");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // agent commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn extract_sidecars(app_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    // Copy bundled sidecars to app data dir for persistence
    // (avoids re-extracting on every launch)
    Ok(())
}
```

---

## Release Process

### Step 1: Prepare Release

```bash
# Update version in all Cargo.toml + package.json
# Update CHANGELOG.md with new features

# Commit & tag
git add .
git commit -m "chore: prepare v1.0.0 release"
git tag -a v1.0.0 -m "Release v1.0.0"

# GitHub Actions will automatically:
# 1. Run full test suite
# 2. Build for all platforms
# 3. Create GitHub Release with artifacts
# 4. Trigger updater refresh
```

### Step 2: Verify Release

```bash
# Download and test each artifact
# Windows: Glyphic-windows-x64.exe
# macOS Intel: Glyphic-macos-intel.dmg
# macOS Apple Silicon: Glyphic-macos-arm64.dmg
# Linux: Glyphic-linux-x64.AppImage

# Test basic flows:
# - App launches without errors
# - Mode switching works (Editor → FE Prep → Vault → Diagram)
# - Search responds (< 500ms)
# - Agent commands callable (all 5 agents)
# - Settings persist across restart
```

### Step 3: Announce Release

```bash
# GitHub Releases page: Add announcement + known issues
# (Changelog auto-generated from commit log)

# Notify team/users
# - Slack notification
# - Email to registered users
# - Discord announcement (if applicable)
```

---

## Automatic Updates (Tauri Updater)

### Configuration: `frontend/src-tauri/tauri.conf.json`

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://releases.glyphic.app/updates/{{target}}/{{current_version}}"
    ],
    "dialog": true,
    "pubkey": "YOUR_PUBLIC_KEY_HERE"
  }
}
```

### Update Flow

1. **User launches Glyphic v1.0.0**
2. **App checks updater endpoint**: GET `/updates/x86_64-pc-windows-msvc/1.0.0`
3. **Server responds** (if update available):
   ```json
   {
     "version": "1.0.1",
     "date": "2026-05-15T10:00:00Z",
     "url": "https://releases.glyphic.app/Glyphic-windows-x64-v1.0.1.exe.zip",
     "body": "Bug fixes and performance improvements",
     "signature": "dW50cnVz..."
   }
   ```
4. **User prompted**: "New version available. Update now?"
5. **Download & verify signature** (Tauri handles)
6. **Install & restart** app with new version

### Hosting Updates Server

Option A: Use GitHub Releases directly
```bash
# Tauri fetches from GitHub API
# https://api.github.com/repos/your-org/glyphic/releases/latest
```

Option B: Self-hosted updates server
```rust
// Rust Actix-web server
use actix_web::{web, App, HttpServer, HttpResponse};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/updates/{target}/{version}", web::get().to(check_update))
    })
    .bind("0.0.0.0:8000")?
    .run()
    .await
}

async fn check_update(
    path: web::Path<(String, String)>,
) -> HttpResponse {
    let (target, current_version) = path.into_inner();
    
    // Query database or GitHub Releases
    // Return update info if newer version available
    
    HttpResponse::Ok().json(json!({
        "version": "1.0.1",
        "url": "...",
        "signature": "..."
    }))
}
```

---

## Rollback Procedure

If a release is broken:

```bash
# Tag previous working release as hotfix target
git tag -a v1.0.0-rollback -m "Rollback to v1.0.0"

# Build & release v1.0.0-rollback
# Users with v1.0.1 will see downgrade prompt

# Or: Patch current release → v1.0.1-patch
git revert <bad-commit>
git tag -a v1.0.1-patch -m "Hotfix for v1.0.1"
```

---

## Troubleshooting Deployment

### Issue: Tauri build fails on Windows
```bash
# Solution: Ensure MSVC toolchain installed
rustup toolchain install stable-msvc
# Run build from Visual Studio Developer PowerShell
```

### Issue: Python sidecar fails to start
```bash
# Check logs
tail ~/.glyphic/logs/sidecars.log

# Verify binary exists & is executable
ls -la ~/.glyphic/sidecars/embedding_engine

# Manually test sidecar
~/.glyphic/sidecars/embedding_engine --help
```

### Issue: Updater not working
```bash
# Check internet connectivity
# Verify updater endpoint URL is correct
# Check for firewall blocking (port 443)

# Force update check (dev mode)
cargo run --bin glyphic-dev -- --check-updates
```

---

## Performance Optimization

### App Startup Time (Target: < 5s from launch to ready)

**Breakdown**:
- Tauri bootstrap: 0.5s
- React hydration: 1.5s
- Python sidecars launch: 2s (parallel)
- Database open: 0.5s
- **Total**: ~4.5s

**Profiling**:
```bash
# Measure startup
time ./Glyphic.exe  # or ./Glyphic (macOS/Linux)

# Profile Rust initialization
cargo flamegraph --example startup

# Profile Python sidecar startup
python -m cProfile -s cumtime backend/sidecars/embedding_engine/main.py
```

### Bundle Size (Target: < 250MB)

**Breakdown**:
- Tauri + React: 50MB
- Rust dependencies: 80MB
- Python + sentence-transformers: 100MB
- Assets + data: 20MB
- **Total**: ~250MB

**Reduction strategies**:
```bash
# Strip symbols from release binary
strip target/release/glyphic

# Compress PyInstaller bundle
upx --best backend/sidecars/embedding_engine/dist/embedding_engine

# Use cargo-strip
cargo install cargo-strip
cargo strip --release
```

---

## Monitoring & Analytics

### Telemetry (Privacy-Respecting)

Collect (opt-in):
- App launch count
- Feature usage (which agents used most)
- Error rate + types
- Latency percentiles
- Python sidecar crashes

Don't collect:
- User data
- Student information
- Conversation content

**Implementation**:
```rust
// In Tauri main.rs
tauri::Builder::default()
    .setup(|app| {
        telemetry::init(app)?;
        Ok(())
    })
```

### Error Reporting

```rust
// Sentry integration
let _guard = sentry::init((
    "https://key@o0.ingest.sentry.io/0",
    sentry::ClientOptions {
        traces_sample_rate: 0.1,
        ..Default::default()
    },
));

// Automatically captures panics + exceptions
```

---

## Release Checklist

- [ ] All tests passing (CI/CD green)
- [ ] Changelog updated
- [ ] Version bumped (semantic versioning)
- [ ] Tag pushed to GitHub
- [ ] Build artifacts generated (Windows, macOS, Linux)
- [ ] Code signed & notarized (macOS)
- [ ] Manual QA pass (basic flows tested)
- [ ] GitHub Release created with artifacts
- [ ] Announcement sent to team/users
- [ ] Updater endpoint updated (if self-hosted)
- [ ] Post-release monitoring active (Sentry, telemetry)

---

## Version Scheme

**Format**: `MAJOR.MINOR.PATCH[-PRERELEASE]`

- **MAJOR**: Breaking changes (rare)
- **MINOR**: New features (Phase 2 = 1.1.0)
- **PATCH**: Bug fixes
- **PRERELEASE**: `-alpha.N`, `-beta.N` (skip in updater until finalized)

**Example releases**:
- v1.0.0: Phase 1 complete (initial release)
- v1.0.1: Bug fix patch
- v1.1.0: Phase 2 (Bayesian mastery, adaptive difficulty)
- v1.1.1: Phase 2 patch
- v2.0.0: Major redesign or breaking API change

---

## Success Criteria (Post-Release)

- ✅ Build completes in < 15 minutes
- ✅ Artifacts produced for all 3 platforms
- ✅ Code signed (macOS) without errors
- ✅ App launches on fresh install
- ✅ All 5 agents callable
- ✅ Search latency < 500ms
- ✅ Update check works (next release)
- ✅ Crash rate < 0.1%
- ✅ Telemetry data collected (if enabled)

---

## References

- GitHub Actions: https://docs.github.com/en/actions
- Tauri Guide: https://tauri.app/v1/guides/
- PyInstaller: https://pyinstaller.org/
- Code Signing (macOS): https://developer.apple.com/
- Semantic Versioning: https://semver.org/
