# eslint-plugin-mission-adjacent

Proof-spine ESLint rules distilled from the principles behind safety-critical
coding standards (Power of 10, JSF++, AUTOSAR, NUREG), translated to TypeScript.
These are the net-new rules no existing tool ships; `typescript-eslint` already
covers the hygiene rules, so this plugin owns only the spine.

> **NOT certified, validated, or fit for actual safety-critical, life-critical,
> or mission-critical use.** Strong engineering defaults inspired by the
> *principles* behind safety-critical standards — not the standards themselves.
> Do not use it where a failure can hurt someone. It conforms to no standard,
> certifies nothing, and is provided as-is with no warranty. If you need real
> safety certification you need DO-178C / ISO 26262 / IEC 62304 tooling and an
> auditor, not an ESLint plugin. See the
> [project README](https://github.com/daresTheDevil/mission-adjacent#readme).

## Rules

### `require-assertion-density`

Assertions are executable pre/postconditions (Power of 10 #5): a function body
should carry at least a minimum density of assert-predicate calls, so a
property-tester has something to attack and the contract is checkable. Pure-AST,
no type information required.

## Install

```sh
pnpm add -D eslint-plugin-mission-adjacent
```

Most users want the config, which wires this plugin in for you:
[`eslint-config-mission-adjacent`](https://www.npmjs.com/package/eslint-config-mission-adjacent).

## License

MIT. The warranty disclaimer in the license and the notice above both apply.
