# Goal: Remove Retired Branch Code

## Goal Mode Objective

Follow this saved goal file; complete the retired-code removal only when the verification section passes, and stop to ask if any listed stop condition occurs.

## Full Prompt

### Objective

Aggressively remove the retired implementation, retired runtime/deployment files, retired historical docs, retired compatibility paths, and retired verification assets from the current `perf/tauri-rust-rewrite` branch so the repo presents only the active Tauri/Rust/Solid/SQLite application line.

Completion means:

1. The active app under `src/` and `src-tauri/` keeps its current user-visible behavior.
2. Former implementation directories, retired runtime entrypoints, retired static web serving files, retired historical goal prompts, retired milestone docs, and retired milestone artifacts are removed or replaced by current Tauri/Rust documentation.
3. Current code no longer keeps compatibility paths for former local data/config shapes.
4. Full verification passes.
5. A strict generated keyword scan reports zero content hits for the retired-stack terms listed in Verification.

### Context

This branch is the Tauri/Rust/Solid/SQLite prerelease rewrite. Active implementation is under `src/`, `src-tauri/`, current scripts, current Tauri config, and current performance verification assets.

The working tree already has user changes. For this goal, related files may be rewritten as needed, but the final result must still preserve the active Tauri app behavior.

### Brainstorming Direction

Use the approved aggressive cleanup direction: remove retired code, retired docs, retired artifacts, retired compatibility logic, and retired dependency/lockfile traces instead of preserving migration reference material.

The key trade-off is that historical audit material and former data/config compatibility are intentionally discarded to keep this branch clean and current.

### Discovery Summary

Answered decisions:

1. Delete former architecture docs and former goal/prompt files instead of keeping them as migration reference.
2. Delete compatibility logic for former settings/config/session/data shapes.
3. Run complete local verification: frontend typecheck, lint, tests, build, Rust format, Rust clippy, and Rust tests.
4. Allow rewriting related files that already have local changes.
5. Keep or update current README/docs so current development, testing, and release flow remains understandable.
6. Delete former milestone artifacts while preserving current performance/release artifacts.
7. Enforce strict zero content hits for retired-stack terms.
8. Remove or rename former verification scripts and package scripts.
9. Use the approved saved goal file path chosen by the user.
10. Remove former rollback/release guidance and describe only the current Tauri/Rust release path.
11. If third-party or generated files block keyword clearing, prefer dependency/lockfile/tooling changes before relaxing the standard.
12. Preserve current active app behavior while removing former compatibility.
13. Allow destructive prerelease data/schema changes if needed.
14. Keep necessary current verification artifacts produced by current Tauri/Rust checks.
15. Allow necessary network access for dependencies or validation.
16. Allow package and Rust lockfile updates.
17. Avoid writing complete retired-stack terms in this goal file; generate them inside verification commands.

Assumptions:

1. Current users are developers, reviewers, and users of the current desktop prerelease.
2. No new accounts, keys, private exchange APIs, cloud sync, or remote configuration storage are introduced.
3. Current performance assets under `artifacts/performance/` may remain when they are still relevant.
4. Ignored build output directories may be removed or regenerated as needed.

### Scope

Codex may inspect, delete, rewrite, or update:

1. The retired source directory whose name is `['leg','acy-src'].join('')`.
2. Retired desktop runtime files and configs whose names are generated from `['ele','ctron'].join('')`.
3. Retired static web serving files generated from `['Doc','ker'].join('')` and `['ngi','nx'].join('')`.
4. Retired generated output directories such as former desktop release/build output when present.
5. Root historical goal/prompt markdown files that describe former branch work.
6. Former milestone and post-MVP docs that describe the superseded branch line.
7. README and current docs, replacing former-history sections with current Tauri/Rust/Solid/SQLite instructions.
8. Former milestone verification scripts and package scripts.
9. Current source/tests where former compatibility logic exists.
10. `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` when dependency or lockfile changes are needed.
11. `.gitignore`, eslint/vitest/tsconfig/vite/Tauri config, and CI workflow files when references to removed paths remain.
12. Current tests and verification scripts needed to prove active behavior is preserved.

### Out Of Scope

Do not add unrelated product features.

Do not add trading, accounts, API keys, private exchange data, cloud sync, non-Binance exchange scope, or remote user configuration storage.

Do not preserve former branch compatibility solely for migration reference.

Do not expand into visual redesign, chart-engine replacement, or new public API design unless required to keep current behavior passing after cleanup.

### Verification

Run all required checks from the repo root:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run rust:fmt
npm run rust:clippy
npm run rust:test
```

Run the strict retired-term content scan from the repo root. This command intentionally builds terms at runtime so this goal file does not itself contain complete retired terms:

```bash
node --input-type=module <<'NODE'
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

const join = (...parts) => parts.join('');
const terms = [
  join('leg', 'acy-src'),
  join('leg', 'acy'),
  join('Leg', 'acy'),
  join('E', 'lectron'),
  join('e', 'lectron'),
  join('Re', 'act'),
  join('re', 'act'),
  join('De', 'xie'),
  join('de', 'xie'),
  join('Indexed', 'DB'),
  join('indexed', 'DB'),
  join('indexed', 'db'),
  join('KLine', 'Charts'),
  join('kline', 'charts'),
  join('Doc', 'ker'),
  join('doc', 'ker'),
  join('ngi', 'nx'),
];

const skippedExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.icns',
  '.AppImage',
]);

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.startsWith('node_modules/'))
  .filter((file) => !file.startsWith('src-tauri/target/'));

const hits = [];

for (const file of trackedFiles) {
  if (!existsSync(file)) {
    continue;
  }

  const stat = statSync(file);
  if (!stat.isFile()) {
    continue;
  }

  if ([...skippedExtensions].some((extension) => file.endsWith(extension))) {
    continue;
  }

  const text = readFileSync(file, 'utf8');
  for (const term of terms) {
    if (text.includes(term)) {
      hits.push(`${file}: ${term}`);
    }
  }
}

if (hits.length > 0) {
  console.error(hits.join('\n'));
  process.exit(1);
}
NODE
```

Also manually review the final diff for:

1. Removed retired implementation/runtime/deployment/docs/artifacts.
2. Updated current README/docs that explain current Tauri/Rust/Solid/SQLite development, verification, and release flow.
3. No active Tauri user-visible behavior intentionally removed.
4. No accidental scope expansion.

### Stop Conditions

Stop and ask the user before continuing if:

1. Clearing a third-party or lockfile retired-term hit requires replacing core build/test/runtime tooling in a way that breaks or materially risks current Tauri app behavior.
2. Removing former compatibility logic would remove an active current feature rather than only former data/config support.
3. Required verification cannot run after reasonable repair attempts, and the completion standard would need to change.
4. Network or dependency registry behavior blocks required dependency changes for repeated attempts.
5. The cleanup requires adding unrelated product scope or a new architecture decision not covered here.
6. The repo contains a retired-term hit that cannot be removed without deleting the saved goal file or otherwise contradicting this approved plan.

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
