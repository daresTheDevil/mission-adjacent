---
'eslint-plugin-mission-adjacent': patch
---

Stop the cyclomatic-complexity violation message from claiming lineage cover for a sub-lineage threshold.

A reviewer caught the seam. The one-time sub-lineage warning is suppressible, and once suppressed every violation kept citing "JSF++ AV Rule 3" even when the configured limit was below McCabe's 10. That puts a safety-standard label on a number no standard blessed, which is the exact dishonesty ADR 0005 exists to prevent, relocated to user config.

Now the citation rides the verdict. A lineage-backed limit (>= 10) reports via the JSF++ message; a sub-lineage limit (< 10) reports via a variant that drops the citation and says the limit is your own, not lineage-backed, and that mission-adjacent makes no safety claim about it. That message fires on every violation, not as a suppressible preamble.

Also documents the switch-disable carve-out as a stopgap, not the end state. A flat dispatch switch is the same false positive as the curtain; the intended fix is the cognitive-complexity follow-up, and the disable comments should be removed once it ships rather than left to accumulate.
