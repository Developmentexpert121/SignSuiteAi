---
name: api-server static/upload path resolution
description: Why api-server filesystem paths must use __dirname, not process.cwd() (prod-only 404 bug)
---

# api-server static/upload path resolution

Any filesystem path in the api-server (serving static assets, writing uploads, locating the
frontend dist) MUST resolve relative to `__dirname` (via `fileURLToPath(import.meta.url)`),
NOT `process.cwd()`.

**Why:** In production the api-server is launched from the **monorepo root** (root
`package.json` start: `node ./artifacts/api-server/dist/index.mjs`), so `process.cwd()` is the
repo root. In dev it launches from `artifacts/api-server`, so cwd happens to be correct. A
`process.cwd()/public/uploads` path therefore works in dev but points at a non-existent
`<repo-root>/public/uploads` in prod → every `/api/uploads/*` 404s (classic "works in dev,
broken in prod" image/asset bug). `__dirname` is the bundled `dist/` dir in both, so
`../public/uploads` is stable. `FRONTEND_DIST` already followed this pattern, which is why the
SPA loaded in prod while upload images broke.

**How to apply:** Shared constant `UPLOADS_DIR` lives in `artifacts/api-server/src/lib/paths.ts`;
reuse it for both static mounts and upload writes so serve/write paths never diverge. esbuild
bundles to a single ESM file, so `import.meta.url` resolves to `dist/index.mjs` consistently.
