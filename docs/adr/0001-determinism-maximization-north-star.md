# 0001. Determinism maximization is the north star

Date: 2026-06-03
Status: accepted
Source: harness merge session (ADR-build + dk-skills)
Enforceability: llm-only (this is the design principle the other ADRs implement)

## Context

The original framing for this project was "write TS the way C is written so proof becomes possible." That framing is wrong. You cannot make TS soundly provable: the language is unsound by design (`as any`), types erase at runtime, the call graph is a runtime dict lookup. Chasing proof in TS is chasing something the language structurally cannot give.

The thing I actually care about is different. When `dk:harden` (the LLM) judges my code, it returns a different verdict run to run. A lint rule does not. The enemy was never *unproven code*, it's *nondeterminism in who checks the code*. A check that lives in `tsc` or an ESLint rule is repeatable and free. A check that lives in the LLM is none of those things.

## Decision

Push every correctness check as far UP the determinism ladder as the language physically allows, so the LLM decides as little as possible. The ladder, highest tier first:

| Tier | Decider | Deterministic? | Cost |
|---|---|---|---|
| Type system / tsconfig | `tsc` | yes, provably | free |
| Lint rule | ESLint AST | yes | free |
| Property test | fast-check + Vitest | yes, same seed same verdict | free |
| Static analysis | madge / Semgrep CE | yes | free |
| LLM judge | Claude (`dk:harden`) | no, varies per run | the thing to minimize |

Every rule gets pushed to the highest deterministic tier it fits. Only what genuinely cannot be mechanized in TS falls to the LLM. The `enforceability` vocabulary across all ADRs in this repo (`type-system | static-lint | property-test | static-analysis | llm-only`) is exactly this ladder, so a decision and its tier cross-reference.

## Alternatives

- **"Make TS provable like C"** rejected. The original framing. TS cannot be made soundly provable; the language fights it. Pursuing proof is pursuing a thing that does not exist here. See ADR 0007 (the no-Polyspace justification) for why.
- **Stoplight severity (red/yellow/green) as the organizing axis** rejected in favor of the ladder + the 2x2 (ADR 0003). A stoplight ranks *how bad* a violation is; the ladder ranks *who can decide it deterministically*. The second is the one that shrinks the LLM's job.

## Consequences

- The LLM tier is something to *minimize*, not eliminate. It never reaches zero. "Did you check the right things, and enough things?" requires knowing requirements that live in my head. That residue is real, small, and owned by `dk:harden` (ADR 0007).
- Pushing TS toward analyzability (branded types, no `any`, exhaustive unions, parse-at-boundary) moves code from the LLM tier back to the type-system tier. That *is* the safety-grade move for TS, and it's why the config (ADR 0004) flips on the totality checks.
- Determinism and strength-of-guarantee trade off. `tsc` is perfectly deterministic but proves only a sliver. The strongest properties (loop termination, bounded caches) are exactly the ones no TS tool decides soundly. For those we ship a deterministic *proxy* and call it a proxy (ADR 0002), never a proof.
