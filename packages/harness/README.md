# harness

**PRIVATE. Never published.** The author's whole-stack determinism runner —
the thing that drives the mission-adjacent standard across a repo (lint +
property-test gate + import-cycle / tsc orchestration) and proves the demo
contrast. Lives in the workspace so it can depend on the local
plugin/config via `workspace:*`.

## What's here today

### `verify:exhibits`

```sh
pnpm --filter harness verify:exhibits
```

The prover. Lints each case twice and prints a PASS/FAIL contrast table:

- once with `js.configs.recommended` — the baseline everyone runs. Silent.
- once with the mission-adjacent `spine` — pure-AST, no type info. Fires.

The contrast (`recommended:0 / ours:N`) is the pitch: code that looks fine to
the linter everyone already runs, caught by ours. Exits non-zero if any case
fails to show its expected contrast, so it doubles as a regression guard — the
day a rule stops firing, this goes red.

Runs inline sample cases today (a money function with no asserts → ours fires;
a trivial accessor → both silent). When the runnable `docs/exhibits/*.ts` files
exist, the runner will glob them. Runs via `tsx`, no build step.

## Planned, not built

The "whole-stack runner" this package is named for — lint + the required
property-test gate + tsc + cycle orchestration, as a single drop-in for the
author's own repos — is not built yet. Only the exhibit prover runs today.
