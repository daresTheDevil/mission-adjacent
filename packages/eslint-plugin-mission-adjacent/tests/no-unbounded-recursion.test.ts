import { RuleTester } from '@typescript-eslint/rule-tester';
import { TSESLint } from '@typescript-eslint/utils';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { describe, expect } from 'vitest';

import { noUnboundedRecursion } from '../src/rules/no-unbounded-recursion.js';

const ruleTester = new RuleTester();

ruleTester.run('no-unbounded-recursion', noUnboundedRecursion, {
  valid: [
    // Non-recursive function: nothing to flag.
    'function add(a, b) { return a + b; }',
    // Recursion WITH a leading if-guard (base case present).
    `function factorial(n) {
       if (n <= 1) return 1;
       return n * factorial(n - 1);
     }`,
    // Guard via early return before the self-call.
    `function countdown(n) {
       if (n === 0) return;
       countdown(n - 1);
     }`,
    // throw-guard before recursion counts as a base case.
    `function walk(node) {
       if (!node) throw new Error('null node');
       walk(node.next);
     }`,
    // A non-recursive call to a same-named-looking member is not self-recursion.
    `function process(items) {
       const out = items.map((x) => x);
       return out;
     }`,
    // Recursion guarded by a return that is NOT the self-call.
    `function search(tree, target) {
       if (tree == null) return null;
       const hit = search(tree.left, target);
       return hit;
     }`,
    // Option off: a return no longer counts as a guard, but the if still does.
    {
      code: `function f(n) {
         if (n <= 0) return 0;
         return f(n - 1);
       }`,
      options: [{ countReturnAsGuard: false }],
    },
  ],
  invalid: [
    // Self-call as the very first statement, no guard.
    {
      code: `function loop(n) {
         loop(n + 1);
         doWork(n);
       }`,
      errors: [{ messageId: 'unboundedRecursion', data: { name: 'loop' } }],
    },
    // Tail recursion with no preceding guard.
    {
      code: `function spin(n) {
         const next = compute(n);
         return spin(next);
       }`,
      errors: [{ messageId: 'unboundedRecursion', data: { name: 'spin' } }],
    },
    // Self-call captured in a variable initializer, no guard first.
    {
      code: `function gather(n) {
         const rest = gather(n - 1);
         return rest.concat(n);
       }`,
      errors: [{ messageId: 'unboundedRecursion', data: { name: 'gather' } }],
    },
    // Named function expression that recurses unguarded.
    {
      code: `const f = function recurse(n) {
         recurse(n + 1);
         log(n);
       };`,
      errors: [{ messageId: 'unboundedRecursion', data: { name: 'recurse' } }],
    },
    // With countReturnAsGuard off, a tail-return self-call is still the call,
    // and nothing guards it.
    {
      code: `function f(n) {
         const x = n + 1;
         return f(x);
       }`,
      options: [{ countReturnAsGuard: false }],
      errors: [{ messageId: 'unboundedRecursion', data: { name: 'f' } }],
    },
  ],
});

/**
 * Property tier (🟦). The cases above pin shapes; these pin the INVARIANTS across
 * the input space, deterministically. The load-bearing invariant for an honest
 * proxy: adding a leading guard must ALWAYS silence the rule (no false positive
 * survives a base case), and removing every guard from a self-calling function
 * must ALWAYS fire (the unbounded shape is never missed).
 */
describe('no-unbounded-recursion invariants', () => {
  const linter = new TSESLint.Linter();
  const config: TSESLint.FlatConfig.Config = {
    plugins: {
      'mission-adjacent': { rules: { 'no-unbounded-recursion': noUnboundedRecursion } },
    },
    rules: { 'mission-adjacent/no-unbounded-recursion': 'error' },
  };

  function violations(code: string): number {
    return linter.verify(code, config).length;
  }

  // A self-calling function with a leading `if` guard, parameterized by how many
  // filler statements follow. The guard is always present.
  function guarded(fillerCount: number): string {
    const filler = Array.from(
      { length: fillerCount },
      (_, i) => `const v${i} = ${i};`,
    ).join('\n  ');
    return `function f(n) {\n  if (n <= 0) return 0;\n  ${filler}\n  return f(n - 1);\n}`;
  }

  // The same function with NO guard: self-call leads, filler follows.
  function unguarded(fillerCount: number): string {
    const filler = Array.from(
      { length: fillerCount },
      (_, i) => `const v${i} = ${i};`,
    ).join('\n  ');
    return `function f(n) {\n  f(n - 1);\n  ${filler}\n}`;
  }

  // INVARIANT 1: a leading guard always silences the rule, any body size.
  test.prop([fc.integer({ min: 0, max: 20 })])(
    'never reports when a base-case guard precedes the self-call',
    (fillerCount) => {
      expect(violations(guarded(fillerCount))).toBe(0);
    },
  );

  // INVARIANT 2: an unguarded self-call always fires exactly once, any body size.
  test.prop([fc.integer({ min: 0, max: 20 })])(
    'always reports exactly once when no guard precedes the self-call',
    (fillerCount) => {
      expect(violations(unguarded(fillerCount))).toBe(1);
    },
  );
});
