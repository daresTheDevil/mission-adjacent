# mission-adjacent

Strong engineering defaults for TypeScript, distilled from the *principles*
behind safety-critical coding standards and pushed as far up the determinism
ladder as the language allows.

The name is the honest part. This is near mission-critical, deliberately NOT
claiming to be it. The rules that fly Mars landers, minus the part where it has
to actually work.

---

> ## NOT FOR SAFETY-CRITICAL USE
>
> **This is NOT certified, validated, or fit for actual safety-critical,
> life-critical, or mission-critical use.** It is a set of strong engineering
> defaults inspired by the *principles* behind safety-critical coding standards.
> Do not use it where a failure can hurt someone. If you need real safety
> certification, you need DO-178C / ISO 26262 / IEC 62304 tooling and an auditor,
> not an ESLint preset.
>
> It conforms to no standard and certifies nothing. It is provided as-is, with no
> warranty of any kind. Liability stops here.

---

## The idea

The enemy is not *unproven code*. The enemy is *nondeterminism in who checks the
code*. A lint rule returns the same verdict every run. An LLM does not. So every
correctness check gets pushed to the highest deterministic tier it fits, and only
what genuinely cannot be mechanized in TypeScript is left for a human or an LLM
to judge.

That ladder, highest tier first:

| Tier | Decider | Deterministic? |
|---|---|---|
| Type system / tsconfig | `tsc` | yes, provably |
| Lint rule | ESLint AST | yes |
| Property test | fast-check + Vitest | yes, same seed same verdict |
| Static analysis | madge / Semgrep | yes |
| LLM judge | the thing to minimize | no, varies per run |

`typescript-eslint` already owns most of the hygiene tiers. This project adds
only the **proof-spine** rules no existing tool ships, and a config that layers
the strict preset, flips on the totality checks no preset enables, and adds the
spine on top.

## Lineage, not conformance

The rules are re-adoptions of patterns that recur across safety-critical coding
standards. Lineage, freely-published sources only:

- Power of 10 (Holzmann, IEEE 2006)
- JSF++ AV rules (Stroustrup)
- AUTOSAR C++14 R22-11
- NUREG/CR-6463 (US NRC)

The rule wording here is our own. No standard's text is reproduced, no
conformance is claimed. These standards were *repeatedly re-adopted* across
safety domains; they did not independently converge (ISO 26262, IEC 62304, and
DO-178C all cross-reference a common ancestor). The honest framing is
re-adoption, not convergence.

## Packages

| Package | Visibility | What |
|---|---|---|
| [`eslint-plugin-mission-adjacent`](packages/eslint-plugin-mission-adjacent) | public | the net-new proof-spine rules |
| [`eslint-config-mission-adjacent`](packages/eslint-config-mission-adjacent) | public | the flat config that layers it all together |
| `packages/harness` | private | whole-stack determinism runner for the author's own repos; never published |

## Status

Early. One of the planned proof-spine rules ships today:

- `require-assertion-density` — assertions are executable pre/postconditions
  (Power of 10 #5). Counts assert-predicate calls per function body. Pure-AST,
  no type information required.

Planned, tracked, not yet built: `no-unbounded-recursion`,
`no-unbounded-collection-growth`, bounded-loops. Where a property can't be
decided soundly in TypeScript, the plan is a deterministic *proxy* (a runtime
bound + a property test that drives it) called a proxy, never a proof.

## License

MIT. See [LICENSE](LICENSE). The warranty disclaimer in the license and the
NOT-FOR-SAFETY-USE notice above both apply.
