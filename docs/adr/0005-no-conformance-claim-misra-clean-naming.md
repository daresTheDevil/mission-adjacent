# 0005. No conformance claim, loud non-safety disclaimer, MISRA-clean naming

Date: 2026-06-03
Status: accepted
Source: harness merge session (flagged independently by both source sessions)
Enforceability: llm-only (a legal/honesty line, not a mechanical check)

## Context

This is a legal line, not a style preference. Two risks converge:

1. **MISRA is copyrighted and trademarked.** Its rule *text* is copyright; the name is a trademark. That is literally why JPL's public coding-standard PDF redacts its MISRA-derived levels. Naming this MISRA-anything, claiming MISRA conformance, or copying MISRA wording is a legal problem.
2. **The "rules that fly Mars landers" lineage could lure someone into wiring this into something that actually matters.** A name with safety-critical pedigree plus an ESLint preset that looks authoritative is exactly how a stranger talks themselves into using it where a failure can hurt someone.

## Decision

- **No MISRA anything.** Don't name it MISRA-*, don't claim MISRA conformance, don't copy MISRA rule wording. Write our own rule text; cite only freely-published sources (Power of 10, JSF++ AV, AUTOSAR C++14 R22-11, NUREG/CR-6463) as lineage.
- **No conformance claim of any kind.** Inspired by the convergence of safety standards; conform to none, certify nothing.
- **The README carries a loud non-safety disclaimer** as a first-class requirement, same tier as the naming line: NOT certified, validated, or fit for safety-critical / life-critical / mission-critical use. The disclaimer exists so liability stops at the README.
- **Name: `mission-adjacent`.** Published unscoped as `eslint-config-mission-adjacent` / `eslint-plugin-mission-adjacent`. The name is deadpan-honest: *near* mission-critical, deliberately NOT claiming to be it. The name itself disclaims fitness-for-safety-use. Tagline: "the rules that fly Mars landers, minus the part where it has to land."
- **Honesty correction to the convergence story.** Both source files leaned on "5-6 standards bodies, zero coordination, converged on the same rules." That's overstated and will get called out: ISO 26262, IEC 62304, and DO-178C explicitly reference MISRA. They cross-cite a common ancestor, they did not independently converge. Frame it as *"repeatedly re-adopted across safety domains,"* which is true and still compelling.

## Alternatives

- **Claim "inspired by MISRA" for marketing pull** rejected. Trademark risk, and it invites the conformance confusion the disclaimer exists to prevent.
- **Claim independent convergence** rejected. It's false (the standards cross-reference a common ancestor) and a knowledgeable reader will call it out, costing more credibility than the stronger-sounding claim buys.
- **Scoped package name (`@dk/...`)** rejected. Unscoped sidesteps the pnpm 11.x `publishConfig.access` bug and reads better for adoption and a talk.

## Consequences

- The brand is honesty. Every downstream decision inherits it: proxies are called proxies (ADR 0002), the README can't ship a fake install line, the convergence story stays accurate. Break honesty once in public and the whole positioning collapses.
- Liability stops at the README. The disclaimer is load-bearing, not boilerplate. It's the thing standing between "strong defaults" and someone hurting a person with a misused ESLint preset.
- Rule wording is ours, sourced from freely-published standards only. Paywalled standards are cited via secondary sources as "per [source]," never as verbatim text.
