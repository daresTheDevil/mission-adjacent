# The Harness — merged spec

> A determinism-maximizing lint + type + property-test standard for TypeScript/JS, with a small
> LLM judge for the irreducible residue. Distilled from safety-critical coding standards, translated
> to TS, and split by *who can decide a violation the same way every time*.
>
> Merged from two sessions: the ADR-build session (`INFO-FROM-CLAUDE-ADR.md`) and the dk-skills
> session (`INFO-FROM-CLAUDE-SKILLS.md`). Where they conflicted or were stale, this file is the
> resolved truth and says so.
>
> Status: SPEC, not yet built. Date: 2026-06-02.

---

## 0. The thesis (corrected)

The original framing was "write TS the way C is written so proof becomes possible." That framing is
**retired.** The real goal, in the user's words:

**Push every correctness check as far UP the determinism ladder as the language physically allows,
so that the LLM (Claude / `dk:harden`) decides as little as possible.**

The enemy is not *unproven code*. The enemy is *nondeterminism in who checks the code*. A lint rule
returns the same verdict every run. Claude does not. So every rule gets pushed to the highest
deterministic tier it fits, and only what genuinely cannot be mechanized in TS falls to the LLM.

### The determinism ladder (the spine of the whole project)

| Tier | Decider | Deterministic? | Cost |
|---|---|---|---|
| 🔵 **Type system / tsconfig** | `tsc` | Yes — provably | free |
| 🟢 **Lint rule** | ESLint AST | Yes | free |
| 🟦 **Property test** | `fast-check` + Vitest | Yes — same seed, same verdict | free |
| 🟠 **Static analysis** | madge / Semgrep CE | Yes | free |
| 🔴 **LLM judge** | Claude (`dk:harden`) | **No — varies per run** | the thing to minimize |

**The property-test tier (🟦) is the key insight of the merge.** It converts "does this property
hold?" from a nondeterministic LLM judgment into a deterministic, repeatable check. It is the
mechanism that shrinks the red tier. **Decision (user-confirmed): property tests are a REQUIRED part
of the gate, not a recommendation.**

### What is left for the LLM after all this

Not "checking code" — that's been pushed down the ladder. What survives is **"did you check the
*right* things, and *enough* things?"** That is a review of test/assertion *coverage and intent*,
which requires knowing requirements that live in the user's head. It is genuinely irreducible. It is
small. It never reaches zero. `dk:harden` owns exactly this and is clearly labeled as the
nondeterministic, best-effort tier — never a hard gate.

### The honest tension (do not paper over)

Determinism and *strength of guarantee* trade off. `tsc` is perfectly deterministic but proves only a
sliver (null-safety, exhaustiveness). The strongest safety properties — "this loop *really*
terminates," "this cache is *truly* bounded" — are exactly the ones no TS tool can decide soundly
(see Part 7). For those, we prefer a **deterministic proxy and call it a proxy** (e.g. a runtime
bound counter + property test that drives it), and only hand the irreducible remainder to the LLM.
We never claim a proxy is a proof.

---

## 1. LEGAL + naming — non-negotiable, flagged independently by both sessions

This is a legal line, not a style preference.

- **No MISRA anything.** MISRA's rule *text* is copyrighted and the name is trademarked. That is
  literally why JPL's public coding-standard PDF redacts its MISRA-derived levels. Do **not** name it
  MISRA-*, do **not** claim MISRA conformance, do **not** copy MISRA rule wording.
- **No conformance claim of any kind.** We are inspired by the convergence of safety standards; we
  conform to none of them and certify nothing.
- **The README carries a loud disclaimer** (first-class requirement, same tier as the naming line):

  > **This is NOT certified, validated, or fit for actual safety-critical, life-critical, or
  > mission-critical use.** It is a set of strong engineering defaults inspired by the *principles*
  > behind safety-critical coding standards. Do not use it where a failure can hurt someone. If you
  > need real safety certification, you need DO-178C / ISO 26262 / IEC 62304 tooling and an auditor,
  > not an ESLint preset.

  Rationale: the name + the "rules that fly Mars landers" lineage could lure someone into wiring this
  into something that actually matters. The disclaimer exists so that liability stops at the README.

- **Safe to cite + paraphrase (freely published):** Power of 10 (Holzmann, IEEE 2006,
  spinroot.com/gerard/pdf/P10.pdf), JSF++ AV rules (stroustrup.com/JSF-AV-rules.pdf), AUTOSAR C++14
  R22-11 (autosar.org), NUREG/CR-6463 (NRC, public). Write our OWN rule wording; cite these as lineage.
- **Name: DECIDED — `mission-adjacent`.** Published as `eslint-config-mission-adjacent` /
  `eslint-plugin-mission-adjacent` (UNSCOPED — sidesteps the pnpm 11.x `publishConfig.access` bug and
  reads better for adoption + a talk). Deadpan-honest: near mission-critical, deliberately NOT claiming
  to be it — which satisfies the disclaimer concern above (the name itself disclaims fitness-for-safety
  -use). Repo dir is `~/code/mission-adjacent` (renamed to match the package name, stays at `~/code/`
  root). Tagline: "the rules that fly Mars landers, minus the part where it has to actually work."

### Honesty correction to the "convergence" story

Both source files lean on "5–6 standards bodies, zero coordination, converged on the same rules."
**That is overstated and will get called out.** ISO 26262, IEC 62304, and DO-178C *explicitly
reference MISRA* — they cross-cite a common ancestor, they did not independently converge. Frame it
honestly: *"these rules were repeatedly re-adopted across safety domains"* — which is still
compelling and is actually true. Do not claim independent convergence.

---

## 2. The convergent core — the rule lineage

The safety-critical coding rules that recur across domains, with the published source for each. This
is the *lineage*, the input. The deliverable is Part 3 (the TS translation).

| # | Rule | Cited in (freely-published where possible) | Why it exists |
|---|---|---|---|
| 1 | No dynamic memory after init | JPL P10#3, JSF AV-206, AUTOSAR A18-5-1/2 | nondeterministic timing, fragmentation, unverifiable failure |
| 2 | No unbounded recursion | JPL P10#1, JSF AV-119, AUTOSAR A7-5-2 | unbounded stack, breaks WCET |
| 3 | Bounded loops (provable termination) | JPL P10#2, DO-178C WCET | runaway execution, breaks coverage analysis |
| 4 | Initialize before use | JSF AV-142, AUTOSAR A8-5-0 | uninitialized read = UB, concealed fault |
| 5 | No goto / unstructured jumps | JPL P10#1, JSF AV-189 | defeats static control-flow analysis |
| 6 | Bounded complexity + function size | JPL P10#4, JSF AV-1/AV-3, ISO 26262 CC<10 | high complexity → exhaustive test infeasible |
| 7 | Strong typing / no implicit conversion | JPL, JSF AV-209/AV-180, AUTOSAR A4-7-1 | silent data loss, platform-dependent behavior |
| 8 | Limited pointer indirection (≤2) | JPL P10#9, JSF AV-170 | pointer arithmetic = unanalyzable aliasing |
| 9 | Validate at boundary / defensive | JPL P10#7, JSF AV-15 | external input is the #1 runtime surprise |
| 10 | Check all non-void returns | JPL P10#7, NUREG/CR-6463 | unchecked returns = silent failure cascade |
| 11 | Static analysis mandatory + language subset | all (NUREG/CR-6463 is the nuclear equiv) | humans miss systematic errors at scale |

**The proof-spine rules** — the heart of "verification becomes possible," NOT peers of `no-eval`:
- **P10 #5 — assertion density (≥2/function).** Gives a property-tester something to attack;
  pre/postconditions as executable specs.
- **P10 #1/#2 — bounded control flow.** Loops + recursion bounded → analysis becomes decidable.

(Full paywalled-standard caveats and the complete source list live in `INFO-FROM-CLAUDE-SKILLS.md`
§10 — not reproduced here. Cite secondary sources as "per [source]," never as verbatim standard text.)

---

## 3. THE DELIVERABLE — TS translation × determinism tier × bucket

The two-axis bucketing (credit: ADR session corrected the skills session's stoplight into this 2×2):
- **Axis A — mechanical vs judgment:** can a deterministic tool decide it, or does it need intent-reading?
- **Axis B — public vs private:** generic, or leaks the user's stack/client/PRR specifics?
- **OSS plugin = mechanical ∩ public.** **`dk:harden` = judgment.** **Private-but-mechanical = the
  user's dotfiles config layered on top of the public preset.**

| Convergent rule | TS/JS form | Top tier reachable | Bucket | Already in typescript-eslint? |
|---|---|---|---|---|
| No dynamic mem after init | no unevicted caches / push-only arrays / leaked listeners | 🟢 heuristic + 🔴 truth | plugin (proxy) + harden | — |
| No unbounded recursion | self-call / call-graph cycle without a bound | 🟢 | plugin | **NET-NEW** |
| **Bounded loops** ⟵ SPINE | every loop terminates; `while(true)` needs counter+timeout; property-test the bound | 🟢 obvious cases + 🟦 bound test + 🔴 truth | plugin + tests + harden | core catches only trivial cases |
| Init before use | definite-assignment, `noUncheckedIndexedAccess` | 🔵 | config | tsconfig flag |
| No goto / labeled jump | `no-labels`, `no-unreachable` | 🟢 | config | core |
| Bounded complexity/size | `complexity`, `max-lines-per-function`, `max-params`, `max-depth` | 🟢 | config | core |
| Strong typing / no implicit conv | `no-explicit-any`, `no-unsafe-*`, branded types, `eqeqeq`, `no-implicit-coercion` | 🔵 + 🟢 | config | recommended-type-checked |
| Limited indirection | `no-unsafe-optional-chaining`; custom chain-depth | 🟢 | plugin | partial |
| Validate at boundary | Zod `.parse()` at every entry; internal trusts inferred types | 🔵 where present + 🔴 completeness | config + harden | — |
| Check all returns | `no-floating-promises`; handle `Result`/`Option` | 🟢 | config | recommended-type-checked |
| **Assertion density ≥2** ⟵ SPINE | pre/postcondition asserts per public fn | 🟢 count + 🔴 meaning | plugin + harden | **NET-NEW** |
| Exhaustiveness | `switch-exhaustiveness-check` + `never` + `assertNever()` | 🔵 PROVEN | config | exists, **but NOT in any preset — must flip on (see Part 4)** |
| Dead code removed | `no-unreachable`, knip / ts-prune | 🟢 | plugin + SA | core + tools |
| Single entry/exit | one-return-per-fn | 🟢 | plugin | **NET-NEW, DEFAULT-OFF (Part 5 conflict)** |

### The compression result

The full weight of the safety-standard lineage, translated to TS, reduces to **~3 net-new rules no
existing tool ships** — because typescript-eslint already did the hygiene 80%. Those 3 are exactly the
proof-spine rules nobody else publishes. That is the OSS value.

---

## 4. Tooling reality — VERIFIED against typescript-eslint v8.60.1 (2026-06-02)

Re-verified this session via Context7 + typescript-eslint.io. **This supersedes the v6/v7-era snapshot
in both source files.** Re-check again at build time if months have passed.

### Current flat-config shape (verified — and what we shipped)
- Helper: **ESLint core `defineConfig()` from `eslint/config`.** `tseslint.config()` is DEPRECATED in
  typescript-eslint v8 in favor of it. This is what `index.js` actually uses now — don't reach for the
  tseslint helper.
- Strict preset: `tseslint.configs.strictTypeChecked`.
- Type-checked parser wiring: **`parserOptions.projectService: true`** is the current recommended way
  (auto-discovers nearest tsconfig). The older `project: './tsconfig.json'` still works but is not the
  default the docs push.

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  { languageOptions: { parserOptions: { projectService: true } } },
);
```

### VERIFIED GOTCHA — `RuleModule` vs `RuleDefinition` type seam (eslint 10 + tseslint 8)
Registering a tseslint-authored rule in a core `defineConfig()` plugin block trips **TS2322**. ESLint 10's
core types `plugins[*]` as its own `RuleDefinition`; `ESLintUtils.RuleCreator` emits tseslint's
`RuleModule`, whose `RuleContext` still carries the surface ESLint 10 removed (`getAncestors`,
`parserPath`, `parserOptions`, ...). Structurally close, NOT assignable. The deprecated
`tseslint.config()` helper hid this; core `defineConfig()` surfaces it, so every plugin author on this
combo hits it. **It is type-only — the rule runs correctly** (17/17 tests green); the mismatch is in the
declared shapes, not the runtime values. Fix at the registration boundary by asserting the plugin to
ESLint's `Plugin` shape (the shapes don't overlap enough for a direct cast, so it goes through
`unknown`). See `packages/eslint-config-mission-adjacent/index.js` for the shipped fix and the harness
`verify-exhibits.ts` for the runnable proof the rule still fires.

### Already shipped — LAYER, do not reinvent
`recommended-type-checked` ships as errors (all 14 verified individually this session):
`no-explicit-any`, all 5 `no-unsafe-*` (argument/assignment/call/member-access/return),
`no-floating-promises`, `no-misused-promises`, `no-implied-eval`, `restrict-plus-operands`,
`restrict-template-expressions`, `require-await`, `await-thenable`, `unbound-method`.

`strict-type-checked` (must opt in) adds, among others:
- **`no-unnecessary-condition`** — flags always-truthy/falsy conditions (dead-branch / partial-totality
  signal). **CONFIRMED in `strict-type-checked`.**

### CORRECTION to the ADR file — verified this session
- **`switch-exhaustiveness-check` is NOT in `strict-type-checked`, and is in NO preset at all in v8.**
  You must enable it manually. The ADR file claimed it ships in strict-type-checked; that is wrong for
  current v8. This matters because exhaustiveness is the single most important *deterministic* (🔵)
  totality check we get — the compiler literally proving every branch is handled. **It is a
  must-flip-on in the config preset, not a freebie.**

### Does NOT exist in typescript-eslint — these are the net-new rules to author
- **Bounded loops** — no rule. Only OBVIOUS cases are lintable (`while(true)` / `for(;;)` without a
  bound). Proving a real loop bound needs data-flow analysis ESLint does not have → proxy + property
  test + harden.
- **Assertion density (≥2/fn)** — no rule. Pure-AST, no types needed: count assert-predicate
  `CallExpression`s per function body. Flagship rule, ~a weekend.
- **No-unbounded-recursion** — no rule. Detect self-call / call-graph cycle without a bound.
- **No-unbounded-collection-growth** — heuristic only: `Map.set`/`arr.push`/`addEventListener` without
  a matching evict/`delete`/`removeEventListener`. Best-effort syntactic, explicitly NOT a proof.

### Custom rule authoring (verified, unchanged in v8)
`ESLintUtils.RuleCreator(nameToDocsUrl)` + `ESLintUtils.getParserServices(context)` +
`services.getTypeAtLocation(node)` gives the TS type checker inside a rule. Typed custom rules fully
supported. (Assertion-density needs no types; throw/Result-return rules need the type checker.)

### Property-test tier (verified)
- **fast-check v4.8.0**, actively maintained. Vitest integration via **`@fast-check/vitest`** (adds
  `test.prop` / `it.prop`). The user already uses Vitest, so this drops straight in.

---

## 5. The single-entry/single-exit CONFLICT — resolved

- The lineage favors single-exit (JSF AV-113, ISO 26262, EN 50128, AUTOSAR).
- It **directly fights the user's own `how-i-code.md`:** "early returns and guard clauses, happy path
  stays flat." Single-exit is a C-era rule (no RAII, manual cleanup); in TS (GC, `finally`) it is
  mostly cargo-cult.
- **RESOLUTION:** ship the rule in the plugin but **DEFAULT-OFF**, documented as "C-heritage,
  conflicts with guard-clause style, enable only with a specific reason." House style the user already
  reasoned through wins over lineage authority. Worth an ADR note.

---

## 6. `dk:harden` — the LLM tier, scoped down

`dk:harden` is the 🔴 tier and nothing else. Its job, in priority order:

1. **Conformance audit FIRST:** verify the cheaper deterministic gates are actually ON (strict
   tsconfig posture, the lint preset, the property-test requirement, the SA layer). "A gate is off" is
   itself a mission-critical finding. (User-confirmed identity from the skills session.)
2. **Run the free static-analysis layer** (madge/skott for import cycles; `tsc --noEmit`).
3. **Judge ONLY the irreducible residue** — the things no TS tool can decide:
   - Does this loop *provably* terminate? (beyond the obvious cases lint/tests catch)
   - Is this cache *truly* bounded / this listener *actually* cleaned up? (heap-shape data-flow)
   - Are these assertions *meaningful*, and is *every* boundary guarded? (intent + completeness)
   - "Did you test the right things / enough things?" — the coverage-and-intent review.
4. **READ-ONLY, forever.** harden judges; `dk:improve`/`dk:secure` fix. The moment harden auto-fixes,
   the trio collapses into one tool. This is a permanent constraint.
5. **Judges against the user's RULE FILES** (`how-i-code.md` etc.), not `CLAUDE.md` — and carries the
   infra/frontend/security lanes the built-in `/code-review` lacks. That is harden's non-redundant
   value vs the built-in reviewer.

Every harden finding must be labeled as the nondeterministic tier: a best-effort second opinion on
what no tool could decide, never a build gate.

---

## 7. Why no deterministic tool can close the gap (the justification for the LLM tier)

There is NO open-source Polyspace for TS/JS/Python, and structurally there ~cannot easily be one.
Sound abstract interpretation (Polyspace/Astrée/Frama-C/IKOS — tools that *prove* absence of an error
class) needs **static types + a fixed call graph** before running. Dynamic languages defeat that:
runtime types, `eval`, monkey-patching, dynamic dispatch. C bans function pointers (P10#9) *precisely*
to keep the call graph static. JS `obj.method()` is a runtime dict lookup → call graph unknowable → no
sound inter-procedural analysis. TS is the middle: rich types but erased at runtime and unsound by
design (`as any`), so `tsc` proves a *sliver* (exhaustiveness, null-safety) and nothing more.

**That absence is the entire justification for the LLM tier.** In C you'd be insane to use an LLM
instead of Astrée. In TS there *is* no prover for these properties, so the LLM competes with nothing.
And pushing TS toward analyzability (branded types, no `any`, exhaustive unions, parse-at-boundary)
moves code from 🔴 back to 🔵 — that *is* the safety-grade move for TS.

| Tool | Catches | Cost (solo, PRIVATE repos) | Verdict |
|---|---|---|---|
| `tsc` strict + `never` | exhaustiveness, null-safety (PROVEN) | free | the one real prover; use hardest |
| fast-check + Vitest | behavior properties, deterministically | free | the 🟦 tier; REQUIRED spine |
| madge / skott | import cycles, fully | free | clean win, wire into CI |
| Semgrep CE | intra-function taint only | free | misses multi-hop |
| CodeQL | best taint | $49/committer/mo, license REQUIRED for private | blocked for solo private |
| SonarQube CE | no taint | Dev Ed ~$6500/yr | cross off |
| loop-termination, mem-growth-truth | NO production tool, any language | — | stuck on LLM |

---

## 8. ADR system + which decisions to promote

The ADR system already exists in `~/code/decisions/` (built, committed, not pushed). Model:
- **Central** decisions (cross-cutting "how I work") → `~/code/decisions/`.
  **Per-repo** decisions → `<repo>/docs/adr/`. **Routing = the deletion test:** "Does this stop being
  true if I delete the repo?" Yes → per-repo, No → central.
- **ADR vs memory:** ADRs are the durable record of a decision + reasoning + rejected alternatives +
  consequences (a wrong ADR is a bug). Memory is the ephemeral recall layer (a stale memory is
  expected). When a decision becomes an ADR, its memory entry shrinks to a pointer. **Do not
  over-formalize memory** — its looseness is load-bearing.
- **Format:** `.md` + YAML frontmatter (MADR-style). Recommended frontmatter:
  `id, title, status, date, supersedes, superseded_by, tags, source, enforceability`. The
  `enforceability` field uses the SAME vocabulary as the determinism ladder
  (`type-system | static-lint | property-test | static-analysis | llm-only`) so a rule and its ADR
  cross-reference.

### Decisions this work generated — candidates to promote (user decides which)
1. **Determinism-maximization is the north star** (push every check up the ladder; LLM owns least).
2. **Property tests are a REQUIRED tier**, the mechanism that shrinks the LLM's job.
3. **2×2 bucketing** (mechanical/judgment × public/private) over a stoplight.
4. **OSS preset layers on `strict-type-checked`**, flips on `switch-exhaustiveness-check` (NOT in any
   preset), ships ~3 net-new proof-spine rules — does not reinvent the hygiene 80%.
5. **No conformance claim + loud non-safety disclaimer + MISRA-clean naming/sourcing.**
6. **single-entry/exit ships default-OFF** (house style beats lineage).
7. **`dk:harden` = read-only conformance auditor of the deterministic gates + judge of the residue.**

ADRs get written at decision time, in the user's voice — NOT retroactively manufactured to look
thorough. These are candidates, not decided.

---

## 9. Out of scope for THIS spec (tracked, not merged in)

The skills session drifted into reshuffling the review-skill trio. That is a SEPARATE workstream from
the harness and is deliberately NOT folded into this spec:
- `dk:improve` → `dk:review` (delegate review to built-in `/code-review`, own only the fix-apply step).
- `dk:secure` vs harden's security lane (name the judge/fixer split explicitly).
- Built-in `/code-review` competitive analysis.

These are real and worth doing — just not part of "build the harness." Track separately.

---

## 10. Open questions still genuinely open

1. **Repo home:** does the harness stay in `~/code/mission-critical`, become its own repo, or graduate
   to `~/code/` root? (`~/code` is organized by intent — see `decisions/0005`.) Leaning: own repo when
   it's real, since it's a publishable OSS artifact, not a crown-jewel app.
2. **Adoption story for an existing live repo** (the user's first target is `~/code/dashboard`, a
   shipping Nuxt/Vue app — NOT greenfield). A hard error-level assertion-density rule on an existing
   codebase = thousands of day-one violations → `eslint-disable` spam → standard becomes theater. The
   adoption story needs a **ratchet**: new/changed code held to the bar, existing code grandfathered,
   line moves one direction only. This is design work the source files never faced. It is an
   *application* concern, not a *harness* concern — build the harness clean first, design the ratchet
   when applying it.
3. **Published npm name** (Part 1) — deferred to publish time; must NOT imply safety fitness.
4. **Migrate the 12 existing `~/code/decisions/` ADRs to frontmatter, or only frontmatter new ones?**

---

## Provenance note

- 🔵🟢🟦🟠🔴 tooling facts in Part 4 + Part 7 = **verified** against typescript-eslint v8.60.1 and
  fast-check v4.8.0 via Context7 + official docs, 2026-06-02. Re-verify if stale.
- The `switch-exhaustiveness-check` correction overrides the ADR source file — verified this session.
- The convergence-honesty correction (Part 1) and the single-exit resolution (Part 5) are reasoned
  positions, flagged as such.
- Rule lineage (Part 2) cites freely-published sources directly; paywalled standards via secondary
  sources only, per the source files' caveats.
