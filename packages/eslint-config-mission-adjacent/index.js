// @ts-check
/**
 * eslint-config-mission-adjacent
 *
 * Determinism-maximizing flat config. Layers typescript-eslint's strictest
 * preset, flips on the totality checks no preset enables, and adds the
 * mission-adjacent proof-spine rules. The design goal (see SPEC.md): push every
 * correctness check as far UP the determinism ladder as TS allows, so the
 * decisions left for a human/LLM are as few as possible.
 *
 * NOT certified, validated, or fit for actual safety-critical use. See README.
 *
 * Two entry points:
 *   - default export: the full standard (type-aware — needs a tsconfig). Use in
 *     a real project via `projectService`.
 *   - `spine`: just the net-new proof-spine rules (pure-AST, no type info). Use
 *     to demo / adopt the spine without wiring type-aware linting first.
 */
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import missionAdjacent from 'eslint-plugin-mission-adjacent';

/**
 * Type seam (verified 2026-06-02, eslint 10 + typescript-eslint 8):
 * ESLint 10's core `defineConfig()` types `plugins[*]` as its own
 * `RuleDefinition` (its `RuleContext` dropped the legacy `getAncestors` /
 * `parserPath` / `parserOptions` surface). But `ESLintUtils.RuleCreator` —
 * which every tseslint-authored rule uses — still emits tseslint's `RuleModule`,
 * whose `RuleContext` carries that removed surface. The two are structurally
 * close but NOT assignable, so the plugin object trips TS2322 here. This is
 * type-only: the rule runs correctly (17/17 tests green); the mismatch is in
 * the declared shapes, not the runtime values. The deprecated `tseslint.config()`
 * helper hid this; core `defineConfig()` surfaces it. Every plugin author on
 * eslint 10 + tseslint 8 hits it. Fix at the registration boundary by asserting
 * the plugin to ESLint's expected `Plugin` shape. The shapes don't overlap
 * enough for a direct assertion (the `RuleContext` surfaces differ), so it goes
 * through `unknown` — the standard escape hatch for a known-safe boundary cast.
 */
const missionAdjacentPlugin = /** @type {import('eslint').ESLint.Plugin} */ (
  /** @type {unknown} */ (missionAdjacent)
);

/** The net-new proof-spine layer. Pure-AST, runs without type information. */
export const spine = defineConfig({
  plugins: {
    'mission-adjacent': missionAdjacentPlugin,
  },
  rules: {
    // P10 #5 — assertions are executable pre/postconditions. The flagship rule.
    'mission-adjacent/require-assertion-density': 'error',
    // P10 #2 — a syntactically infinite loop (while(true)/for(;;)) with no
    // break/return/throw escape. Obvious-cases proxy; proving a real loop's
    // bound is the LLM tier's residue, not this rule's job.
    'mission-adjacent/bounded-loops': 'error',
    // P10 #1 — a named function that re-enters itself with no base-case guard
    // before the recursive call. Honest syntactic proxy for unbounded stack.
    'mission-adjacent/no-unbounded-recursion': 'error',
  },
});

/**
 * The full standard. strict-type-checked (the strongest deterministic tier) +
 * the totality checks it leaves off + the proof spine.
 *
 * Uses ESLint core's `defineConfig()` — typescript-eslint deprecated its own
 * `tseslint.config()` helper in v8 in favor of this.
 */
export default defineConfig(
  tseslint.configs.strictTypeChecked,
  {
    rules: {
      // NOT in any preset (verified, typescript-eslint v8) — the single
      // strongest *deterministic* totality check: the compiler proving every
      // union branch is handled. Must be flipped on manually.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // Lineage rule #7 (strong typing / no implicit conversion). Lives in
      // stylistic-type-checked, NOT strict-type-checked (verified against
      // typescript-eslint v8, 2026-06-02), so layering strict alone leaves it
      // off. We flip it on explicitly rather than pull all of stylistic, whose
      // cosmetic rules fight house style. Type-aware: it fires only on `a || b`
      // where the checker proves `a` is nullable — turning the `x || 0` vs
      // `x ?? 0` null-vs-falsy coercion from an LLM judgment call into a
      // deterministic lint error with an autofix. Default options: `0`/`''`
      // stay meaningful, so it flags `number | null || 0` (the slot-occupancy
      // case) where `?? 0` is the behavior-preserving, safer form.
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
    },
  },
  spine,
);
