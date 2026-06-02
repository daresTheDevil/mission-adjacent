# eslint-config-mission-adjacent

Determinism-maximizing ESLint flat config. Layers `typescript-eslint`'s strictest
preset, flips on the totality checks no preset enables
(`switch-exhaustiveness-check`), and adds the
[`mission-adjacent`](https://www.npmjs.com/package/eslint-plugin-mission-adjacent)
proof-spine rules. The design goal: push every correctness check as far up the
determinism ladder as TypeScript allows, so the decisions left for a human or LLM
are as few as possible.

> **NOT certified, validated, or fit for actual safety-critical, life-critical,
> or mission-critical use.** Strong engineering defaults inspired by the
> *principles* behind safety-critical standards — not the standards themselves.
> Do not use it where a failure can hurt someone. It conforms to no standard,
> certifies nothing, and is provided as-is with no warranty. If you need real
> safety certification you need DO-178C / ISO 26262 / IEC 62304 tooling and an
> auditor, not an ESLint preset. See the
> [project README](https://github.com/daresTheDevil/mission-adjacent#readme).

## Install

```sh
pnpm add -D eslint-config-mission-adjacent eslint-plugin-mission-adjacent typescript-eslint
```

## Use

Two entry points:

```js
// eslint.config.js
import config, { spine } from 'eslint-config-mission-adjacent';

// the full standard: strict-type-checked + totality checks + the proof spine.
// type-aware — needs a tsconfig (resolved via projectService).
export default config;
```

```js
// or just the proof-spine layer: pure-AST, no type information required.
// adopt the spine without wiring type-aware linting first.
import { spine } from 'eslint-config-mission-adjacent';
export default [spine];
```

## License

MIT. The warranty disclaimer in the license and the notice above both apply.
