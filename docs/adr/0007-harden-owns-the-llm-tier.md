# 0007. dk:harden owns the LLM tier and only the LLM tier

Date: 2026-06-03
Status: accepted
Source: harness merge session
Enforceability: llm-only
Supersedes: SPEC.md §6 (the "harden stays read-only forever" position)

## Context

The determinism ladder (ADR 0001) exists to push checks off the LLM. Whatever survives (the checks no deterministic tool can decide) has to land somewhere. That somewhere is `dk:harden`. Its scope has to be drawn precisely or it bloats back into re-checking things the cheaper tiers already cover, which defeats the whole point.

There's also a non-redundancy question: why a custom skill instead of the built-in `/code-review`? Because the built-in is bound to PR/GitHub context (I'm on Gitea), isn't delegatable, and judges against generic criteria, not my rule files or my infra/frontend/security lanes.

## Decision

`dk:harden` is the LLM tier and nothing else. Its job, in order:

1. **Conformance audit first.** Verify the cheaper deterministic gates are actually ON: strict tsconfig posture, the lint preset, the property-test requirement (ADR 0002), the static-analysis layer. "A gate is off" is itself a mission-critical finding. Detect-and-degrade: gates absent means that's a finding, fall back to rule-file judgment, never pretend a gate ran.
2. **Run the free static-analysis layer** (madge/skott for import cycles, `tsc --noEmit`).
3. **Judge only the irreducible residue:** what no TS tool can decide: does this loop *provably* terminate (beyond the obvious cases the lint/proxy catch), is this cache *truly* bounded, are these assertions *meaningful*, is *every* boundary guarded, and "did you test the right things / enough things?"
4. **Judge against my RULE FILES** (`how-i-code.md` etc.), carrying the infra/frontend/security lanes the built-in `/code-review` lacks. That is the non-redundant value.

Every harden finding is labeled as the nondeterministic tier: a best-effort second opinion on what no tool could decide, never a hard build gate.

## Alternatives

- **harden re-checks everything, gates included** rejected. It would re-do the deterministic tiers nondeterministically, which is backwards. harden judges only what the gates can't.
- **Delegate to the built-in `/code-review`** can't. It's PR/GitHub-context-bound (I'm on Gitea) and not delegatable. That non-delegatability is the reason the custom skill exists.

## Read-only reversal: note the supersession

SPEC.md §6 said harden stays READ-ONLY forever: harden judges, separate skills fix. That was reversed by central ADR `~/code/decisions/0013-harden-find-fix-verify-pipeline.md`. harden is now a find → fix → verify pipeline: the fix phase edits. The independence that read-only used to buy is preserved by relocating it to the verify phase: verify re-runs every gate fresh and never trusts the fix phase. The fixer doesn't grade its own homework.

This ADR records harden's *scope* (it owns the LLM tier, defined by the four-step job above), which 0013 did not change. 0013 changed harden's *shape* (read-only judge → find-fix-verify pipeline). Both are true; they're about different things. The read-only line in SPEC §6 is the one that's dead.

## Consequences

- harden's value is non-redundant precisely because it judges against my rule files and carries lanes the built-in reviewer doesn't. Drop that and it becomes a worse `/code-review`.
- The conformance-audit-first ordering means harden's most important output is often "your gate is off," not a code finding. A disabled gate is a bigger deal than any single line of code, because it silently moves work back onto the LLM.
- The read-only reversal is a real trade (see 0013): whole-skill independence traded for a pipeline, independence bought back at the verify phase. If verify ever starts trusting fix, the safety net is gone. That's the thing to watch.
