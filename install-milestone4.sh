#!/bin/bash
set -euo pipefail
TARGET="$HOME/Documents/GitHub/vault-catalogue"
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -d "$TARGET" ] || { echo "Missing $TARGET"; exit 1; }
rsync -av --delete --exclude='.git' --exclude='node_modules' --exclude='target' --exclude='apps/desktop/src-tauri/target' "$HERE/" "$TARGET/"
cd "$TARGET"
rm -f package-lock.json
npm config set registry https://registry.npmjs.org/
npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
npm test
npm run build
source "$HOME/.cargo/env"
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
echo "Milestone 4 installed. Launch: npm run tauri -- dev"
