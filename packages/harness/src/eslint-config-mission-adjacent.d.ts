/**
 * Ambient declaration for the config package.
 *
 * `eslint-config-mission-adjacent` is a `@ts-check`'d JS file that ships no
 * `.d.ts` (it's a flat config, consumed as data, not as a typed API). The
 * harness imports its `spine` export, so give TS just enough shape to resolve
 * the module. The runtime value is a flat-config array; the verify-exhibits
 * runner re-types it as `Linter.Config[]` at the use site.
 */
declare module 'eslint-config-mission-adjacent' {
  import type { Linter } from 'eslint';
  /** Full standard: strict-type-checked + totality checks + the proof spine. */
  const config: Linter.Config[];
  /** The net-new proof-spine layer. Pure-AST, no type info required. */
  export const spine: Linter.Config[];
  export default config;
}
