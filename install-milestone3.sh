#!/bin/bash
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${HOME}/Documents/GitHub/vault-catalogue"
mkdir -p "$TARGET"
echo "Installing Vault Platform Milestone 3 into: $TARGET"
rsync -av --delete --exclude='.git' --exclude='node_modules' --exclude='**/target' "$SOURCE_DIR/" "$TARGET/"
cd "$TARGET"
npm config set registry https://registry.npmjs.org/
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund
npm test
npm run build
source "$HOME/.cargo/env" 2>/dev/null || true
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
printf '\nMilestone 3 installed. Launch with:\ncd %s && npm run tauri\n' "$TARGET"
