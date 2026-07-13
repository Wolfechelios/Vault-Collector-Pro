# Vault Platform Milestone 3

This release migrates Vault into an npm-workspaces monorepo and adds shared domain, storage, import, backup, and UI packages. The desktop application gains dashboard health metrics, card/table/gallery views, multi-select archive, a digital storage map, checksum-verified backups, and a robust CSV/JSON import center.

## Run

```bash
npm install
npm test
npm run build
npm run tauri
```

The existing SQLite database remains in the macOS app-data directory and is upgraded in place by idempotent migrations.
