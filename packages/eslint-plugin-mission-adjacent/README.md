# eslint-plugin-mission-adjacent

Proof-spine ESLint rules distilled from the principles behind safety-critical
coding standards (Power of 10, JSF++, AUTOSAR, NUREG), translated to TypeScript.
These are the net-new rules no existing tool ships; `typescript-eslint` already
covers the hygiene rules, so this plugin owns only the spine.

> **NOT certified, validated, or fit for actual safety-critical, life-critical,
> or mission-critical use.** Strong engineering defaults inspired by the
> *principles* behind safety-critical standards, not the standards themselves.
> Do not use it where a failure can hurt someone. It conforms to no standard,
> certifies nothing, and is provided as-is with no warranty. If you need real
> safety certification you need DO-178C / ISO 26262 / IEC 62304 tooling and an
> auditor, not an ESLint plugin. See the
> [project README](https://github.com/daresTheDevil/mission-adjacent#readme).

## Rules

### The proof spine

The net-new rules no existing tool ships. Pure-AST, no type information required.

#### `require-assertion-density`

Assertions are executable pre/postconditions (Power of 10 #5): a function body
should carry at least a minimum density of assert-predicate calls, so a
property-tester has something to attack and the contract is checkable.

#### `bounded-loops`

Flags a syntactically infinite loop (`while(true)` / `for(;;)`) with no
`break`/`return`/`throw` escape (Power of 10 #2). The obvious-cases proxy;
proving a real loop's bound is the LLM tier's job, not this rule's.

#### `no-unbounded-recursion`

Flags a named function that re-enters itself with no base-case guard before the
recursive call (Power of 10 #1). A syntactic proxy for unbounded stack.

### The complexity tier

Two rules governed by
[ADR 0008](https://github.com/daresTheDevil/mission-adjacent/blob/main/docs/adr/0008-lineage-backed-vs-lineage-inspired-tiers.md),
which splits rules into two honesty tiers. **Lineage-backed**: the threshold
traces to a named safety standard and the message cites it. **Lineage-inspired**:
the method or number is invented, labeled as a deviation, with no safety claim
borrowed.

#### `cyclomatic-complexity` (lineage-backed)

Plain McCabe cyclomatic complexity, counted the standard way. Default 20 (JSF++
AV Rule 3). The configurable values are themselves the lineage: 10 (McCabe), 15
(MISRA/NASA), 20 (JSF++). Set your own below 10 and the message stops claiming
lineage cover, because no standard blessed that number.

#### `cognitive-complexity` (lineage-inspired)

Campbell's curtain-aware complexity, reimplemented from the SonarSource white
paper. Default 15 (Sonar S3776). The number is Sonar's, not a safety value, and
the message says so at every threshold. It exists because plain CC counts every
`||`/`??`/`?:` as a branch and so cries wolf on a flat curtain of field defaults;
cognitive collapses same-operator runs and weights nesting, so the curtain goes
quiet and real nesting still flags.

## Install

```sh
pnpm add -D eslint-plugin-mission-adjacent
```

Most users want the config, which wires this plugin in for you:
[`eslint-config-mission-adjacent`](https://www.npmjs.com/package/eslint-config-mission-adjacent).

## License

MIT. The warranty disclaimer in the license and the notice above both apply.
