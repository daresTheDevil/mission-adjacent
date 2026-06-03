# 0004. OSS preset layers strict-type-checked, ships only the proof-spine

Date: 2026-06-03
Status: accepted
Source: harness merge session (tooling re-verified against typescript-eslint v8.60.1, 2026-06-02)
Enforceability: static-lint

## Context

The full weight of the safety-critical lineage, translated to TS, looks like a lot of rules. It isn't. typescript-eslint already ships the hygiene 80%: `no-explicit-any`, the five `no-unsafe-*`, `no-floating-promises`, `eqeqeq`, complexity/size caps, all of it. Re-implementing any of that would be reinventing a maintained, battle-tested wheel.

What's left after subtracting what typescript-eslint already does is small and specific: the proof-spine rules nobody else publishes, plus two totality checks that exist in typescript-eslint but ship in no preset.

## Decision

The OSS config layers `tseslint.configs.strictTypeChecked` (the strongest deterministic tier) and adds only:

- **The proof-spine rules** (the net-new plugin): `require-assertion-density`, `bounded-loops`, `no-unbounded-recursion`. These are the ~3 rules no existing tool ships.
- **`@typescript-eslint/switch-exhaustiveness-check`**, flipped on manually. Verified against v8: it is in NO preset, not even strict-type-checked. This is the single strongest *deterministic* totality check available: the compiler proving every union branch is handled. Leaving it off would forfeit the best free proof TS gives.
- **`@typescript-eslint/prefer-nullish-coalescing`**, flipped on. Lives in `stylistic-type-checked`, not strict, so layering strict alone misses it. We flip just this one rather than pull all of stylistic (whose cosmetic rules fight house style). Turns the `x || 0` vs `x ?? 0` null-vs-falsy call from an LLM judgment into a deterministic lint error with an autofix.

Config ships two entry points: the `default` full standard (type-aware, needs a tsconfig) and a `spine` export (pure-AST, no type info) so the spine can be adopted without wiring type-aware linting first.

## Alternatives

- **Re-implement the hygiene rules ourselves** rejected. typescript-eslint did it better and maintains it. Reinventing it is pure liability.
- **Pull all of stylistic-type-checked to get `prefer-nullish-coalescing`** rejected. Its cosmetic rules fight house style. Flip on the one rule that earns its place.
- **Assume `switch-exhaustiveness-check` ships in strict.** This is what the original ADR source claimed, and it's wrong for v8. Verified false this session. The correction is the whole reason it's a must-flip-on and not a freebie.

## Consequences

- The OSS value is exactly the ~3 net-new proof-spine rules. Everything else is "we configured typescript-eslint correctly," which is real value but not novel.
- Tooling facts here were verified against typescript-eslint v8.60.1 + fast-check v4.8.0 (2026-06-02). They are version-sensitive. Re-verify if the presets shift; what's in strict vs stylistic has already moved once.
- The two entry points lower the adoption bar: `spine` runs with zero tsconfig wiring, so someone can try the proof-spine on a file in seconds before committing to type-aware linting.
- There is a known type-only seam registering the tseslint-authored plugin in core `defineConfig()` (TS2322, the `RuleModule` vs `RuleDefinition` mismatch). It is type-only (the rules run correctly) and is fixed at the registration boundary in `index.js`. Documented there in full.
