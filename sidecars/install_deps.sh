#!/usr/bin/env bash
# Glyphic — Python sidecar dependency installer
# Usage: bash sidecars/install_deps.sh
#
# Creates a virtual environment at sidecars/venv/, installs all Python
# dependencies for vault_engine, diagram_engine, and study_engine, and writes launcher
# shims that activate the venv before running each sidecar.
#
# The launcher shims are used by the Rust command modules so that the
# sidecars run inside the correct venv regardless of the system Python.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"

echo "==> Creating virtual environment at ${VENV_DIR}"
python3 -m venv "${VENV_DIR}"

PYTHON="${VENV_DIR}/bin/python"
PIP="${VENV_DIR}/bin/pip"

echo "==> Upgrading pip"
"${PIP}" install --upgrade pip --quiet

echo "==> Installing vault_engine dependencies"
"${PIP}" install -r "${SCRIPT_DIR}/vault_engine/Requirements.txt" --quiet

echo "==> Installing diagram_engine dependencies"
"${PIP}" install -r "${SCRIPT_DIR}/diagram_engine/Requirements.txt" --quiet

echo "==> Installing study_engine dependencies"
"${PIP}" install -r "${SCRIPT_DIR}/study_engine/Requirements.txt" --quiet

# ── Write launcher shims ───────────────────────────────────────────────────────

VAULT_SHIM="${SCRIPT_DIR}/vault_engine_launcher"
cat > "${VAULT_SHIM}" <<'EOF'
#!/usr/bin/env bash
# Auto-generated launcher for Glyphic vault_engine sidecar.
# Activates the venv and runs the sidecar.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/venv/bin/activate"
exec python3 "${SCRIPT_DIR}/vault_engine/main.py" "$@"
EOF
chmod +x "${VAULT_SHIM}"

DIAGRAM_SHIM="${SCRIPT_DIR}/diagram_engine_launcher"
cat > "${DIAGRAM_SHIM}" <<'EOF'
#!/usr/bin/env bash
# Auto-generated launcher for Glyphic diagram_engine sidecar.
# Activates the venv and runs the sidecar.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/venv/bin/activate"
exec python3 "${SCRIPT_DIR}/diagram_engine/main.py" "$@"
EOF
chmod +x "${DIAGRAM_SHIM}"

STUDY_SHIM="${SCRIPT_DIR}/study_engine_launcher"
cat > "${STUDY_SHIM}" <<'EOF'
#!/usr/bin/env bash
# Auto-generated launcher for Glyphic study_engine sidecar.
# Activates the venv and runs the sidecar.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/venv/bin/activate"
exec python3 "${SCRIPT_DIR}/study_engine/main.py" "$@"
EOF
chmod +x "${STUDY_SHIM}"

echo ""
echo "✅ Done."
echo "   Vault launcher:   ${VAULT_SHIM}"
echo "   Diagram launcher: ${DIAGRAM_SHIM}"
echo "   Study launcher:   ${STUDY_SHIM}"
echo ""
echo "NOTE: The Tauri bundle (tauri.conf.json bundle.resources) includes"
echo "      the sidecars/ directory.  For distribution you should pre-package"
echo "      the venv or use a bundler such as PyInstaller to create"
echo "      self-contained executables."
