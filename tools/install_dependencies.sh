#!/usr/bin/env bash


set -e

SCRIPT_DIR="$(pwd)"
PY_MODULES_DIR="$SCRIPT_DIR/py_modules"

echo "Installing Python dependencies to py_modules..."


find "$PY_MODULES_DIR" -mindepth 1 ! -name '.gitkeep' ! -name '.keep' -exec rm -rf {} + 2>/dev/null || true


while IFS= read -r line || [ -n "$line" ]; do

    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    echo "Installing: $line"
    pip3 install -t "$PY_MODULES_DIR" "$line"
done < "$SCRIPT_DIR/requirements.txt"


echo "Cleaning up unnecessary files..."
rm -rf "$PY_MODULES_DIR"/*.dist-info
rm -rf "$PY_MODULES_DIR"/bin
rm -rf "$PY_MODULES_DIR"/__pycache__
find "$PY_MODULES_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$PY_MODULES_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true

echo "✅ Dependencies installed successfully to $PY_MODULES_DIR"
