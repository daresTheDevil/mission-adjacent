---
'eslint-plugin-mission-adjacent': minor
'eslint-config-mission-adjacent': minor
---

Complete the proof spine: add `no-unbounded-recursion` (P10 #1) and `bounded-loops` (P10 #2) rules, both pure-AST honest proxies that never claim to prove what they cannot decide soundly.

The config now wires both new rules into the spine, and flips on `@typescript-eslint/prefer-nullish-coalescing` in the full standard. That rule lives in `stylistic-type-checked`, not `strict-type-checked`, so layering strict alone left it off; enabling it turns the `x || 0` vs `x ?? 0` null-vs-falsy coercion from a judgment call into a deterministic, type-aware lint error.
