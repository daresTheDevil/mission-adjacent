# 0008. Two rule tiers: lineage-backed and lineage-inspired, with complexity as the first instance

Date: 2026-06-04
Status: accepted
Source: complexity-metric session (FTA report on a real Nuxt app drove it)
Enforceability: static-lint (the rules) / llm-only (the tier boundary is a judgment line)

## Context

The proof spine so far ships rules whose threshold, where they have one, traces
to a named safety standard. `bounded-loops` and `no-unbounded-recursion` are
binary. `require-assertion-density` has a ratio, but the ratio is the kind of
defensible default the lineage supports. Nothing yet has forced the question:
does mission-adjacent ever ship a rule whose number we picked ourselves?

Cyclomatic complexity forced it. CC is the cleanest possible new rule on every
axis the project cares about: deterministic (same function, same count, every
time), per-function (fits the ESLint visitor model, unlike whole-program clone
detection), and the threshold is not invented... it is published. McCabe 1976
said 10. NIST allows 15 with written justification. NASA SWE-220 mandates 15.
MISRA Report 5 says 15 for safety-critical. JSF++ AV Rule 3 says 20. The whole
safety world sits in a 10-to-20 band. So CC clears the "threshold from lineage,
not invention" bar that the duplicate-finder and FTA's composite score both
failed.

But plain CC has a known blind spot, and it is not academic. Run any modern
TypeScript app through ESLint core's `complexity` rule and the false positives
pour in. CC counts every `||`, `??`, and `?:` as a branch. A boundary mapper
that does `field_a || fieldA || ""` across forty fields scores a CC in the
fifties while being trivially readable... a flat curtain of defaults with no
nesting, no path interaction, nothing to hold in your head. Measured on a real
app: a 45-line endpoint scored 27 (all curtain, genuinely fine), a 135-line CSV
mapper scored 60 (all curtain, genuinely fine), and a 319-line UKG merge scored
95 (half curtain, half a real 280-line function doing six jobs). The number did
not rank the badness. Only reading *what generated* the number did.

That blind spot is the fork. We can stay a faithful enforcer of exactly what the
standards wrote, or we can ship a smarter rule that discounts the curtain and
catches real nesting... which means a counting method (cognitive complexity, per
Sonar) that no safety standard defines, and a threshold that is Sonar's pick,
not MISRA's. Teeth, but the number stops being lineage-backed.

This is bigger than complexity. It is the lane question for half the project's
future ideas (curtain-aware checks, cognitive metrics, anything "smarter than
the naive standard"). It needs deciding once.

## Decision

**Two tiers, both deterministic, clearly labeled. The project ships both.**

1. **Lineage-backed.** The threshold, or the binary verdict, traces to a named
   freely-published safety standard. The rule message cites the source. This is
   the spine's existing posture and the project's credibility anchor. A
   lineage-backed rule never ships a number we invented.

2. **Lineage-inspired.** The rule is *motivated* by the safety lineage but the
   counting method or threshold is ours (or a third party's, e.g. Sonar). It
   goes past the naive standard on purpose, because the standard's method has a
   blind spot we can demonstrate. A lineage-inspired rule must say so in its own
   docs, in plain words: this is not what MISRA/JSF++ wrote, here is the method,
   here is the number, here is why we deviate.

The tier is a documented property of each rule, not a vibe. The honesty brand
(ADR 0005) makes mislabeling the worst failure: a lineage-inspired rule that
implies lineage backing is the same class of dishonesty as a fake conformance
claim.

**Complexity is the first instance, shipped as two rules in order:**

- **`cyclomatic-complexity` (lineage-backed, ships first).** Plain CC. Default
  threshold **20**, sourced from JSF++ AV Rule 3... the most permissive lineage
  number, so the lowest false-positive rate, and JSF++ is already a primary MA
  source. The message cites JSF++. This is the anchor. It is boring and
  trivially defensible to the last decimal, which is the point.

- **`cognitive-complexity` (lineage-inspired, ships second).** Curtain-aware,
  nesting-weighted (a branch three levels deep counts more than one at the top;
  flat `||`/`??` sequences collapse instead of each scoring +1). Default
  threshold from Sonar, cited *as Sonar*, never implied to be a safety number.
  This is the teeth: it catches the 95-that-was-real and stays quiet on the
  60-that-was-fine. It ships second so the faithful baseline exists first... you
  cannot credibly say "we deviate from the standard here" unless you also offer
  the standard.

**The threshold is configurable, with a sourced default and a documented
ceiling.** Configurability does not betray determinism: same threshold + same
code = same verdict, always. And the *menu* of legitimate values is itself
lineage-defined... 10 (McCabe, the original, aspirational), 15 (MISRA/NASA,
stricter), 20 (JSF++, the default). Letting a user pick is letting them choose
which safety standard they hold themselves to, not tuning a fuzzy knob. Default
**20**, document 10 as the aspirational tightening. Sub-lineage values (e.g. 3)
are documented as unsupported self-harm; start with a soft warning, not a hard
floor.

## Alternatives

- **Thin preset only (wrap ESLint core `complexity`, change the default,
  done).** Rejected as the *whole* answer. It is honest and ships in an
  afternoon, and it is exactly what `cyclomatic-complexity` is. But as the only
  complexity offering it gives the project no teeth... "we changed core's
  default number" is three lines anyone writes in their own config, not a tool
  with a point of view. Kept as tier 1, rejected as the ceiling.

- **Cognitive complexity only, skip plain CC.** Rejected. Without the
  lineage-backed baseline, the deviation has nothing to deviate *from*, and the
  project's one clean sentence ("deterministic, lineage-backed foot-gun
  catchers") loses its anchor. The faithful rule is what makes the inspired
  rule's honesty legible.

- **Stay pure: lineage-backed tier only, never ship anything inspired.**
  Rejected, but it was close. It keeps the one-sentence pitch unqualified. It
  loses the teeth, and more importantly it would force every future
  curtain-aware or cognitive idea to be rejected on principle, when the real
  objection to those ideas was only ever "don't *pretend* it's lineage-backed."
  The two-tier split keeps the discipline (label it) without the amputation
  (ban it).

- **Reimplement plain CC from scratch instead of leaning on core.** Deferred.
  Core's `complexity` already counts CC deterministically. Rule-of-three says do
  not reinvent the platform. The lineage-backed rule can wrap or re-export core
  with the sourced default and a citing message; a from-scratch reimplementation
  earns its place only if core's counting proves wrong for our purposes, which
  is a separate, later decision.

- **Non-configurable hard threshold.** Rejected. The legitimate values are
  themselves a lineage menu (10/15/20); refusing to expose them would force
  users who want MISRA's 15 or McCabe's 10 to fork, for no determinism gain.

## Consequences

- **The project gains a second, honest gear.** Lineage-inspired is now a named,
  legitimate lane. Future ideas (curtain-aware assertion checks, other cognitive
  metrics) have a home and a rule: ship them, label them, cite the real method,
  never imply safety-standard backing.

- **The honesty brand (ADR 0005) now polices tier labels too.** A
  lineage-inspired rule that reads as lineage-backed is a conformance-style lie.
  Every rule's docs must state its tier and, if inspired, its actual source and
  why it deviates. This is load-bearing, not boilerplate.

- **Two complexity rules, not one.** `cyclomatic-complexity` first (anchor),
  `cognitive-complexity` second (teeth). Shipping order is the decision, not an
  accident... the baseline has to exist for the deviation to be credible.

- **Threshold config is lineage-bounded by documentation, not by code (at
  first).** Default 20, 10 named as aspirational, sub-lineage values warned
  against. If the soft warning proves too weak in practice, a hard floor is a
  later, smaller decision.

- **`cognitive-complexity` reopens a bounded, deliberate invented-threshold.**
  This is the one place the project knowingly ships a number no safety standard
  blessed. It is acceptable *only* because it is labeled tier 2 and the
  deviation is justified by a demonstrated blind spot. It is not a precedent for
  inventing thresholds elsewhere... it is the documented exception that proves
  the lineage-backed rule.
