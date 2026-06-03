# 0003. Two-axis bucketing (mechanical/judgment x public/private)

Date: 2026-06-03
Status: accepted
Source: harness merge session (ADR session corrected the skills session here)
Enforceability: llm-only (organizing principle for where each rule ships)

## Context

The skills session organized rules by a stoplight: red/yellow/green by severity. That ranks how bad a violation is, which isn't the question that decides where a rule should *live*. Two real questions decide that:

1. Can a deterministic tool decide this, or does it need someone to read intent?
2. Is this rule generic, or does it leak my stack / clients / PRR specifics?

A stoplight answers neither. It took the ADR session to see the seam is a 2x2, not a gradient.

## Decision

Bucket every rule on two axes:

- **Axis A, mechanical vs judgment:** can a deterministic tool decide it (ADR 0001's ladder), or does it need intent-reading?
- **Axis B, public vs private:** generic, or leaks my specifics?

The quadrants map cleanly to where code ships:

| | Public | Private |
|---|---|---|
| **Mechanical** | the OSS plugin + config | my dotfiles config, layered on the public preset |
| **Judgment** | `dk:harden` (the LLM tier) | `dk:harden` against my rule files |

OSS plugin = mechanical ∩ public. `dk:harden` = judgment. Private-but-mechanical = my own config layered on top of the public preset.

## Alternatives

- **Stoplight by severity** rejected. Severity is orthogonal to "who decides it" and "is it shippable as OSS." It can't route a rule to the right home.
- **One axis (mechanical vs judgment only)** insufficient. It correctly separates the plugin from harden but doesn't separate what I can publish from what leaks my stack. Both axes are load-bearing.

## Consequences

- The OSS surface is exactly mechanical ∩ public, which is why the plugin is small and clean (ADR 0004). The judgment and the private bits are deliberately not in it.
- `dk:harden` owns both judgment quadrants: public-judgment (generic intent review) and private-judgment (judging against my own rule files). That's its non-redundant value vs a generic reviewer (ADR 0007).
- New rules get triaged against the 2x2 before they're written. A rule that turns out to be judgment doesn't go in the plugin; a rule that leaks specifics doesn't go in the public config.
