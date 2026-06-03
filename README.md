# mission-adjacent

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-not%20yet%20published-lightgrey.svg)](#install)
[![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

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

Full reasoning is in [`docs/design.md`](docs/design.md); the decisions behind it,
with rejected alternatives, are in [`docs/adr/`](docs/adr/).

## Install

> **Not on npm yet.** The packages are built and tested but unpublished. Until
> they ship, install from git or pin the workspace. The usage below is the real,
> intended config. Only the install line changes when it publishes.

```sh
# once published:
pnpm add -D eslint-config-mission-adjacent eslint typescript-eslint typescript
```

Peer requirements: `eslint` 9 or 10, `typescript` >=4.8.4 <6.1.0, Node >=22.

## Usage

Flat config (`eslint.config.js`). Two entry points.

**The full standard.** Layers `typescript-eslint`'s `strict-type-checked`, flips
on the totality checks no preset enables (`switch-exhaustiveness-check`,
`prefer-nullish-coalescing`), and adds the proof-spine. Type-aware, so it needs a
tsconfig:

```js
import missionAdjacent from 'eslint-config-mission-adjacent';

export default [
  ...missionAdjacent,
  {
    languageOptions: { parserOptions: { projectService: true } },
  },
];
```

**Just the proof-spine.** The net-new rules only. Pure-AST, no type information,
no tsconfig wiring. The fast way to try the spine on an existing repo before
committing to type-aware linting:

```js
import { spine } from 'eslint-config-mission-adjacent';

export default [spine];
```

## What works today

Three proof-spine rules ship in `eslint-plugin-mission-adjacent`, plus the config
that wires them with the strict preset:

| Rule | Lineage | What it does |
|---|---|---|
| `require-assertion-density` | Power of 10 #5 | Counts assert-predicate calls per function body. Assertions are executable pre/postconditions. Pure-AST, no types. |
| `bounded-loops` | Power of 10 #2 | Flags a syntactically infinite loop (`while(true)` / `for(;;)`) with no `break`/`return`/`throw` escape. The obvious-cases proxy; proving a real loop's bound is the LLM tier's job. |
| `no-unbounded-recursion` | Power of 10 #1 | Flags a named function that re-enters itself with no base-case guard before the recursive call. A syntactic proxy for unbounded stack. |

These three are the OSS value: the ~3 net-new rules no existing tool ships, the
ones nobody else publishes. `typescript-eslint` already did the hygiene 80%.

Where a property can't be decided soundly in TypeScript (a real loop's
termination, a cache's true boundedness), the design ships a deterministic
*proxy* (a runtime bound plus a property test that drives it) and calls it a
proxy. Never a proof.

## Lineage, not conformance

The rules are re-adoptions of patterns that recur across safety-critical coding
standards. Lineage, freely-published sources only. If you haven't met these
before, here's what each one is:

- **[Power of 10](https://spinroot.com/gerard/pdf/P10.pdf)** (Holzmann, IEEE
  Computer, 2006). Ten rules for safety-critical code, written by a NASA/JPL
  researcher. The famous one: the rules behind code that flies on spacecraft.
  Six pages, free PDF, the most readable thing on this list.
- **[JSF++ AV rules](https://stroustrup.com/JSF-AV-rules.pdf)** (Stroustrup). The
  C++ coding standard for the F-35 Joint Strike Fighter's avionics software.
  Hosted free by the creator of C++.
- **[AUTOSAR C++14 guidelines](https://www.autosar.org/fileadmin/standards/R22-11/AP/AUTOSAR_RS_CPP14Guidelines.pdf)**,
  release R22-11. The automotive industry's rules for C++ in cars. AUTOSAR is the
  consortium most car makers and their suppliers build to.
- **[NUREG/CR-6463](https://www.nrc.gov/reading-rm/doc-collections/nuregs/contract/cr6463/index.html)**
  (US Nuclear Regulatory Commission). The NRC's review guidelines for the
  software languages used in nuclear power plant safety systems. The nuclear
  industry's version of the same idea.

Different domains. Spacecraft, fighter jets, cars, nuclear plants. They keep
arriving at the same handful of rules.

### Further reading

Not lineage for these rules. These didn't feed the plugin. They're just the best
free companions if the idea above grabs you:

- **[SEI CERT C Coding Standard](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/)**
  (Carnegie Mellon SEI). Free, rule-by-rule, security-first. Covers the
  secure-coding ground the older safety standards skip.
- **[C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)**
  (Stroustrup and Sutter). Free, living document, the modern-idiom backbone the
  others cross-reference.

One note for the curious. AUTOSAR's C++14 guidelines are explicitly an *add-on to
MISRA C++*. The document says so in its own introduction. That's the receipt for
the "re-adoption, not independent convergence" framing above: the safety
standards cite a common ancestor, they did not arrive at it separately. MISRA
itself is copyrighted and sold, not freely published, so it's cited as lineage by
others but not reproduced or linked here.

The rule wording here is our own. No standard's text is reproduced, no
conformance is claimed. These standards were *repeatedly re-adopted* across
safety domains; they did not independently converge (ISO 26262, IEC 62304, and
DO-178C all cross-reference a common ancestor). The honest framing is
re-adoption, not convergence.

## Why an LLM tier at all

There is no open-source Polyspace for TypeScript, and structurally there
~cannot easily be one. Tools that *prove* the absence of an error class need
static types and a fixed call graph before they run. JS defeats that: runtime
types, `eval`, dynamic dispatch, a call graph that's a runtime dict lookup. TS is
the middle: rich types, but erased at runtime and unsound by design, so `tsc`
proves a sliver (exhaustiveness, null-safety) and nothing more.

### Why JS can't just be the analyzable kind

So why not a version of JS that is provable? Because the stuff that blocks
analysis is the stuff that makes JS useful. Dynamic dispatch (`obj.method()` as a
runtime lookup) is how polyfills and monkey-patching and duck typing work. `eval`
is how the web ships code as a live document you can rewrite. Mutable shape is why
you can throw a prototype together in ten minutes. Take those away and you don't
have a safer JavaScript, you have a different language.

A prover needs a closed world. The whole program known before it runs, every path
countable up front. JS was built for the opposite. Code shows up over the network,
from strangers, into a page that's already running. You can't know the whole
program ahead of time... half of it hasn't loaded and the rest is some ad
network's script you've never seen. Closed-world provability and open-world glue
don't reconcile. JS picked open.

The industry already had this argument and didn't pick a winner. It kept JS for
the glue work and built WebAssembly for the analyzable work, and ships both. Nobody
merged them because the merge can't exist. You'd have to give up either "provable"
or "open-world," and each one is somebody's whole reason for being on the web.

TS splits the difference. Keep most of the flexibility, add enough type structure
to pull specific properties back into "provable" when you want to. Every `as any`
you delete closes off a little piece of the world so `tsc` can prove something
about what's left. That's the whole reason there's an LLM tier at all: in TS
there's no prover for the deep properties, so the LLM isn't losing to a better
tool, it's filling a hole nothing deterministic can fill. The longer version is in
[`docs/design.md`](docs/design.md).

## Packages

| Package | Visibility | What |
|---|---|---|
| [`eslint-plugin-mission-adjacent`](packages/eslint-plugin-mission-adjacent) | public | the net-new proof-spine rules |
| [`eslint-config-mission-adjacent`](packages/eslint-config-mission-adjacent) | public | the flat config that layers it all together |
| `packages/harness` | private | whole-stack determinism runner for the author's own repos; never published |

## Roadmap

Tracked, not yet built: `no-unbounded-collection-growth` (a best-effort syntactic
heuristic: `Map.set`/`arr.push`/`addEventListener` without a matching evict,
explicitly not a proof), and a property-test-driven bound proxy for the cases the
obvious-case lint rules can't reach. The adoption story for an existing live repo
needs a ratchet (new code held to the bar, existing code grandfathered) before
the rules go to error level on a shipping codebase. See
[`docs/design.md`](docs/design.md) open questions.

## License

MIT. See [LICENSE](LICENSE). The warranty disclaimer in the license and the
NOT-FOR-SAFETY-USE notice above both apply.
