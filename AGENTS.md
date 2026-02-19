# AGENTS.md

## Naming convention memo

- Across the codebase, use **kebab-case** for file and directory names (especially in `apps/**/src` and `packages/**/src`).

## Collaboration memory

- Never bypass commit signing with `--no-gpg-sign`. If signing is blocked in sandbox, always rerun git commit with elevation.

## Mandatory after any code change

1. Verify build propagation all the way to app entrypoints:
   - `pnpm --filter @edhit/notebook build`
   - `pnpm --filter @edhit/infinitely-lengthy-tape build`

2. If outputs look stale/cached, purge caches and rebuild:
   - `rm -rf .turbo`
   - `find apps -type d -name .vite -prune -exec rm -rf {} +`
   - `find . -name '*.tsbuildinfo' -delete`
   - Then re-run the two build commands above.

3. Do not report "fixed" until app-level builds pass after cache purge when needed.
