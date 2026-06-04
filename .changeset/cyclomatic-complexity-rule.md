---
'eslint-plugin-mission-adjacent': minor
'eslint-config-mission-adjacent': minor
---

Add `cyclomatic-complexity`, the lineage-backed anchor of the complexity tier (ADR 0008).

Flags a function whose cyclomatic complexity exceeds the threshold. Default 20, sourced from JSF++ AV Rule 3... the most permissive of the safety numbers, so the lowest false-positive rate. The threshold is configurable, and the legitimate values are themselves the lineage: 10 (McCabe), 15 (MISRA/NASA), 20 (JSF++). Set your own below 10 and the rule keeps working but warns once that the number is no longer lineage-backed.

The count is the standard McCabe definition, the same one ESLint core's `complexity` rule uses. This rule does not reinvent the metric. What it adds is the sourced default and the lineage framing in the message.

It has a known false positive, on purpose. Plain CC counts every `||`, `??`, and `?:` as a branch, so a flat curtain of field defaults scores high while being trivially readable. This rule flags that curtain the same as it flags real nesting, because a faithful enforcer of the standard has to. The curtain-aware fix is the lineage-inspired `cognitive-complexity` rule, a separate follow-up.

The config wires the rule into the spine at the JSF++ default of 20.
