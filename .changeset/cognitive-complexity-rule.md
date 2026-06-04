---
'eslint-plugin-mission-adjacent': minor
'eslint-config-mission-adjacent': minor
---

Add `cognitive-complexity`, the lineage-INSPIRED teeth of the complexity tier (ADR 0008).

This is the curtain-aware follow-up to `cyclomatic-complexity`. It flags a function whose cognitive complexity exceeds the threshold. Default 15... from Sonar S3776. That number is Sonar's, not a safety-lineage value, and the rule never claims otherwise. The method is G. Ann Campbell's Cognitive Complexity, reimplemented from the SonarSource white paper, not wrapped from a plugin. Adding a dependency for one rule would break the plugin's minimal-dep posture.

The point is the 2x2. Cyclomatic counts every `||`/`??`/`?:` as a branch, so a flat curtain of field defaults scores high while being trivially readable. On the shared fixtures the flat CURTAIN scores cyclomatic 21 and the genuinely-nested NESTED scores 18... the curtain scores higher than real nesting. That inversion is the wolf-cry. Cognitive complexity fixes it: a run of the same logical operator collapses to one point, and a branch three levels deep costs more than one at the top. On the same fixtures the ordering inverts. CURTAIN collapses to 10 and stays under the limit. NESTED stacks to 50 and flags. Real complexity wins, the curtain goes quiet.

The tier is loud in the header and in the message. This is a deliberate deviation from the safety lineage, surfaced so nobody mistakes Sonar's 15 for a backed number. The violation message cites Sonar S3776 and says plainly it is not a safety standard and mission-adjacent makes no safety claim about the score. There is no sub-lineage machinery here... unlike cyclomatic there is no lineage claim to protect at any threshold, so there is no floor to fall below.

The config wires the rule into the spine at Sonar's default of 15.
