# Architecture Decision Records: mission-adjacent

Per-repo ADRs for `mission-adjacent`. These record decisions that stop being true
if this repo goes away: the design of the harness, the proof-spine, the OSS
posture. Cross-cutting "how I work" decisions live in the central set at
`~/code/decisions/` instead (the routing test: "does this stop being true if I
delete the repo?" Yes here, no there).

Numbered independently from the central set, starting at 0001.

Format is MADR-style: Context, Decision, Alternatives, Consequences. Each carries
an `Enforceability` field using the determinism-ladder vocabulary
(`type-system | static-lint | property-test | static-analysis | llm-only`, see
0001) so a decision and the tier that enforces it cross-reference.

| # | Decision | Enforceability |
|---|---|---|
| [0001](0001-determinism-maximization-north-star.md) | Determinism maximization is the north star | llm-only (principle) |
| [0002](0002-property-tests-required-tier.md) | Property tests are a required tier | property-test |
| [0003](0003-two-axis-bucketing.md) | Two-axis bucketing (mechanical/judgment x public/private) | llm-only (principle) |
| [0004](0004-oss-preset-layers-strict-type-checked.md) | OSS preset layers strict-type-checked, ships only the spine | static-lint |
| [0005](0005-no-conformance-claim-misra-clean-naming.md) | No conformance claim, non-safety disclaimer, MISRA-clean naming | llm-only |
| [0006](0006-single-exit-ships-default-off.md) | Single-entry/single-exit ships default-off | static-lint |
| [0007](0007-harden-owns-the-llm-tier.md) | dk:harden owns the LLM tier and only the LLM tier | llm-only |

## Related central ADRs

- `~/code/decisions/0013-harden-find-fix-verify-pipeline.md` turns `dk:harden`
  from a read-only judge into a find-fix-verify pipeline. Supersedes the
  read-only line in the old SPEC; see 0007 for how the two relate.
