# Design

How `mission-adjacent` is built and why. Decisions with their full reasoning and
rejected alternatives live in [`docs/adr/`](adr/); this doc is the overview that
ties them together.

> Not certified, validated, or fit for safety-critical use. See the README.

## Thesis

The enemy is not unproven code. It's nondeterminism in *who checks the code*. A
lint rule returns the same verdict every run; an LLM does not. So every
correctness check is pushed as far up the determinism ladder as TypeScript
allows, and only what genuinely cannot be mechanized is left for the LLM to
judge. ([ADR 0001](adr/0001-determinism-maximization-north-star.md).)

| Tier | Decider | Deterministic? | Cost |
|---|---|---|---|
| Type system / tsconfig | `tsc` | yes, provably | free |
| Lint rule | ESLint AST | yes | free |
| Property test | fast-check + Vitest | yes, same seed same verdict | free |
| Static analysis | madge / Semgrep CE | yes | free |
| LLM judge | Claude (`dk:harden`) | no, varies per run | the thing to minimize |

The property-test tier is the lever. It converts "does this property hold?" from
a nondeterministic LLM judgment into a deterministic, repeatable check, and it's
a required part of the gate, not a recommendation
([ADR 0002](adr/0002-property-tests-required-tier.md)).

## What's left for the LLM

Not "checking code." That's been pushed down the ladder. What survives is "did
you check the *right* things, and *enough* things?" That's a review of test and
assertion coverage and intent, which needs requirements that live in the author's
head. It's genuinely irreducible, it's small, and it never reaches zero.
`dk:harden` owns exactly this and is labeled as the nondeterministic, best-effort
tier, never a hard gate ([ADR 0007](adr/0007-harden-owns-the-llm-tier.md)).

### The honest tension

Determinism and strength-of-guarantee trade off. `tsc` is perfectly
deterministic but proves only a sliver (null-safety, exhaustiveness). The
strongest properties, "this loop *really* terminates," "this cache is *truly*
bounded," are exactly the ones no TS tool decides soundly. For those, the design
uses a deterministic *proxy* (a runtime bound counter plus a property test that
drives it) and calls it a proxy. It never claims a proxy is a proof.

## The lineage

These rules recur across safety-critical coding standards. This is the input, the
lineage, not a conformance claim. Sources are freely-published only; the
rule wording here is original ([ADR 0005](adr/0005-no-conformance-claim-misra-clean-naming.md)).

| Rule | Cited in | Why it exists |
|---|---|---|
| No dynamic memory after init | Power of 10 #3, JSF AV-206, AUTOSAR A18-5 | nondeterministic timing, fragmentation |
| No unbounded recursion | Power of 10 #1, JSF AV-119, AUTOSAR A7-5-2 | unbounded stack, breaks WCET |
| Bounded loops (provable termination) | Power of 10 #2, DO-178C WCET | runaway execution, breaks coverage analysis |
| Initialize before use | JSF AV-142, AUTOSAR A8-5-0 | uninitialized read is UB, concealed fault |
| No goto / unstructured jumps | Power of 10 #1, JSF AV-189 | defeats static control-flow analysis |
| Bounded complexity + function size | Power of 10 #4, JSF AV-1/3, ISO 26262 | high complexity makes exhaustive test infeasible |
| Strong typing / no implicit conversion | JSF AV-209/180, AUTOSAR A4-7-1 | silent data loss, platform-dependent behavior |
| Limited pointer indirection | Power of 10 #9, JSF AV-170 | unanalyzable aliasing |
| Validate at boundary | Power of 10 #7, JSF AV-15 | external input is the #1 runtime surprise |
| Check all non-void returns | Power of 10 #7, NUREG/CR-6463 | unchecked returns = silent failure cascade |
| Static analysis + language subset | all (NUREG/CR-6463 is the nuclear equivalent) | humans miss systematic errors at scale |

These standards were repeatedly re-adopted across safety domains. They did not
independently converge. ISO 26262, IEC 62304, and DO-178C all cross-reference a
common ancestor. The honest framing is re-adoption, not convergence.

### The proof-spine

The heart of "verification becomes possible," not peers of `no-eval`:

- **Assertion density (Power of 10 #5, >=2/function).** Assertions are executable
  pre/postconditions, and they give a property-tester something to attack.
- **Bounded control flow (Power of 10 #1/#2).** Loops and recursion bounded means
  analysis becomes decidable.

## The deliverable

Translated to TS and intersected with what `typescript-eslint` already ships, the
whole lineage reduces to ~3 net-new rules no existing tool publishes, exactly
the proof-spine rules. typescript-eslint already does the hygiene 80%
([ADR 0004](adr/0004-oss-preset-layers-strict-type-checked.md)).

| Convergent rule | TS form | Top tier reachable | Where it ships |
|---|---|---|---|
| No unbounded recursion | self-call / call-graph cycle without a bound | lint | plugin (net-new) |
| Bounded loops | `while(true)`/`for(;;)` without a bound; property-test the bound | lint (obvious cases) + property test + LLM | plugin + tests + harden |
| Assertion density >=2 | count assert-predicate calls per function | lint (count) + LLM (meaning) | plugin (net-new) + harden |
| Init before use | definite-assignment, `noUncheckedIndexedAccess` | type system | tsconfig |
| No goto / labeled jump | `no-labels`, `no-unreachable` | lint | config (core) |
| Bounded complexity/size | `complexity`, `max-lines-per-function`, `max-depth` | lint | config (core) |
| Strong typing / no implicit conv | `no-explicit-any`, `no-unsafe-*`, `eqeqeq` | type system + lint | config (recommended-type-checked) |
| Validate at boundary | Zod `.parse()` at entry; internal trusts inferred types | type system + LLM | config + harden |
| Check all returns | `no-floating-promises`; handle `Result`/`Option` | lint | config (recommended-type-checked) |
| Exhaustiveness | `switch-exhaustiveness-check` + `never` + `assertNever()` | type system (proven) | config (must flip on; in no preset) |
| Single entry/exit | one-return-per-fn | lint | plugin, default-OFF ([ADR 0006](adr/0006-single-exit-ships-default-off.md)) |

## Tooling reality

Verified against typescript-eslint v8.60.1 and fast-check v4.8.0 (2026-06-02).
Version-sensitive; re-verify if stale.

- **Flat config** uses ESLint core's `defineConfig()` from `eslint/config`.
  `tseslint.config()` is deprecated in v8. Type-checked parser wiring via
  `parserOptions.projectService: true`.
- **`switch-exhaustiveness-check` is in no preset in v8.** Not even
  strict-type-checked. It's the single strongest deterministic totality check
  (the compiler proving every union branch is handled), so the config flips it on
  manually.
- **`prefer-nullish-coalescing`** lives in stylistic-type-checked, not strict.
  The config flips on just that one rule rather than pull all of stylistic.
- **The net-new rules** (bounded loops, assertion density, no-unbounded-recursion)
  don't exist in typescript-eslint. They're what the plugin adds.
- **Type-only registration seam (TS2322):** registering a tseslint-authored rule
  in a core `defineConfig()` plugin block trips a `RuleModule` vs `RuleDefinition`
  mismatch. It's type-only (the rules run correctly) and is fixed at the
  registration boundary in the config's `index.js`, documented there in full.

## Why there's an LLM tier at all

There is no open-source Polyspace for TS/JS, and structurally there ~cannot
easily be one. Sound abstract interpretation (Polyspace, Astrée, Frama-C, IKOS,
the tools that *prove* the absence of an error class) needs static types and a fixed
call graph before running. Dynamic languages defeat that: runtime types, `eval`,
monkey-patching, dynamic dispatch. C bans function pointers (Power of 10 #9)
precisely to keep the call graph static. JS `obj.method()` is a runtime dict
lookup, so the call graph is unknowable and no sound inter-procedural analysis is
possible. TS is the middle: rich types, but erased at runtime and unsound by
design (`as any`), so `tsc` proves a sliver (exhaustiveness, null-safety) and
nothing more.

That absence is the entire justification for the LLM tier. In C you'd be insane
to use an LLM instead of Astrée. In TS there is no prover for these properties, so
the LLM competes with nothing. And pushing TS toward analyzability (branded types,
no `any`, exhaustive unions, parse-at-boundary) moves code from the LLM tier back
to the type-system tier, which is the safety-grade move for TS.

### Why JS is built this way, and what a fixed version would cost

Follow-up question: why isn't there a version of JavaScript that's soundly
analyzable? Because the three things that block analysis aren't oversights.
They're what JavaScript is for. Strip them out and you've removed the language.

- **Dynamic dispatch.** `obj.method()` is a runtime lookup, and that's what makes
  duck typing, monkey-patching, polyfills, proxies, and runtime mocking work. A
  polyfill *is* prototype mutation at runtime. `Array.prototype.includes` got
  retrofitted into old browsers by patching the prototype live. Pin the call graph
  static and that whole class of pattern is gone.
- **`eval` and runtime code generation.** Maligned, sure. It's also why the web
  ships code as a live document. REPLs, devtools running against a live page, hot
  module reload, template engines, the old View-Source-and-edit ethos... all of it
  rests on "a string can become code." Nothing can analyze code that doesn't exist
  yet.
- **Mutable runtime shape.** Hand a function half an object, fill the rest in
  later. Let a value be a string here and a number there. Sloppy, yes. Also the
  reason a JS prototype takes ten minutes where a sound-typed language takes an
  hour.

Underneath all three is one thing. A prover needs a closed world: the whole
program known before it runs, every path countable up front. JavaScript was built
for the open world. Code arrives over the network, from strangers, a piece at a
time, into a document that's already running and changing under you. You can't
know the whole program ahead of time, because half of it hasn't loaded and the
other half is some third party's script you've never seen. Closed-world soundness
and open-world dynamism don't reconcile. JS picked the side the web needed.

So "provable JavaScript" isn't a missing feature. It's a different language, one
for programs you compile whole and ship sealed. Rust, OCaml, Elm, PureScript all
do this and all stay niche on the web. The best evidence is what the industry
actually did when it had the choice: it didn't pick. It kept dynamic JS for the
glue work, built WebAssembly as the closed-world analyzable target, and runs both
side by side. Nobody merged them. The merge can't exist. You'd have to surrender
either "provable" or "open-world," and each one is somebody's entire reason for
being on the platform.

TypeScript refuses the choice. Keep most of the open-world flexibility, add enough
type structure to pull specific properties back into "provable" when you want to.
Deleting an `as any` is closing one small piece of the world so `tsc` can prove
something about what's left. That's the determinism ladder seen from the
language-design side instead of the tooling side, and it's why "make the code more
analyzable" (no `any`, branded types, exhaustive unions, parse-at-boundary) is the
safety-grade move. Each one drags a property down from "the LLM has to guess" to
"`tsc` proves it."

| Tool | Catches | Cost (solo, private repos) | Verdict |
|---|---|---|---|
| `tsc` strict + `never` | exhaustiveness, null-safety (proven) | free | the one real prover; use hardest |
| fast-check + Vitest | behavior properties, deterministically | free | the property tier; required spine |
| madge / skott | import cycles, fully | free | clean win, wire into CI |
| Semgrep CE | intra-function taint only | free | misses multi-hop |
| CodeQL | best taint | $49/committer/mo, license required for private | blocked for solo private |
| loop-termination, mem-growth-truth | no production tool, any language | — | stuck on the LLM |

## Open questions

1. **Adoption story for an existing live repo.** A hard error-level
   assertion-density rule on an existing codebase means thousands of day-one
   violations, then `eslint-disable` spam, and the standard becomes theater. The
   adoption story needs a ratchet: new and changed code held to the bar, existing
   code grandfathered, the line moving one direction only. This is an application
   concern, not a harness concern. Build the harness clean first, design the
   ratchet when applying it.
2. **Published npm name.** Deferred to publish time; must not imply safety
   fitness.
3. **Migrate the existing central ADRs to frontmatter, or only new ones?**

## Out of scope

The review-skill trio (`dk:improve`, `dk:secure` vs `dk:harden`'s security lane,
built-in `/code-review` competitive analysis) is a separate workstream, not part
of "build the harness." Tracked separately. The harden reshape itself is recorded
in central ADR `~/code/decisions/0013`.
