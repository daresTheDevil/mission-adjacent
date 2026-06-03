# 0002. Property tests are a required tier, not a recommendation

Date: 2026-06-03
Status: accepted
Source: harness merge session
Enforceability: property-test

## Context

"Does this property hold?" (does this loop terminate, is this cache bounded, does this parser round-trip) is the kind of question that, asked of the LLM, gets a different answer every run. That's the nondeterminism ADR 0001 is trying to kill. But these properties are also exactly the ones `tsc` and ESLint can't decide: they need data-flow analysis the type system doesn't do and the AST doesn't see.

There's a tier between the static tools and the LLM that most TS projects skip: property testing. fast-check generates hundreds of inputs against a stated property and, given the same seed, returns the same verdict every time. It converts "does this property hold?" from an LLM judgment into a deterministic, repeatable check.

## Decision

Property tests are a REQUIRED part of the gate, not a recommendation. They are the mechanism that shrinks the LLM tier: the only tool on the ladder that can deterministically check behavioral properties the static tiers can't reach.

Where a property genuinely can't be decided soundly in TS (a real loop's termination, a cache's true boundedness), the pattern is a deterministic *proxy*: a runtime bound counter plus a property test that drives it. The proxy is called a proxy. It is never claimed as a proof.

Tooling: fast-check v4 + Vitest via `@fast-check/vitest` (`test.prop` / `it.prop`). Already in the stack.

## Alternatives

- **Property tests as a recommendation** rejected. A recommended tier doesn't shrink the LLM's job; it just sits there. The whole point (ADR 0001) is to move work *off* the LLM, and that only happens if the property tier is mandatory.
- **Skip the tier, let the LLM judge properties** rejected. That's the nondeterminism ADR 0001 exists to remove. The LLM should judge only what no deterministic tool can, and a property test is a deterministic tool.

## Consequences

- The proof-spine rules (assertion density, bounded loops, no-unbounded-recursion) give the property-tester something to attack. Assertions are executable pre/postconditions; a property test drives inputs at them. The spine and the property tier are designed to work together.
- "Proxy, never proof" is a permanent honesty constraint. The moment a proxy gets described as a proof, the project is lying about its guarantees, and honesty is the brand (ADR 0005).
- The residue that survives even a property test ("did you test the *right* property, *enough* properties?") is the coverage-and-intent review that lands on the LLM (ADR 0007). The property tier shrinks the residue; it doesn't eliminate it.
