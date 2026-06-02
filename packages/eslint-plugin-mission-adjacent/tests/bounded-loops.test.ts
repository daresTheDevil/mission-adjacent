import { RuleTester } from '@typescript-eslint/rule-tester';
import { TSESLint } from '@typescript-eslint/utils';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { describe, expect } from 'vitest';

import { boundedLoops } from '../src/rules/bounded-loops.js';

const ruleTester = new RuleTester();

ruleTester.run('bounded-loops', boundedLoops, {
  valid: [
    // A normal counted loop is bounded by construction — never flagged. This is
    // the SPEC's core promise: real loops whose bound we cannot prove are left
    // alone, not flagged on suspicion.
    'for (let i = 0; i < n; i++) { work(i); }',
    // for-of over a collection is bounded.
    'for (const x of items) { process(x); }',
    // for-in is bounded by the key set.
    'for (const k in obj) { read(k); }',
    // A while with a real condition: not syntactically infinite.
    'while (i < n) { i++; }',
    // while(true) WITH a break escape — the legitimate event-loop shape.
    `while (true) {
       const job = queue.pop();
       if (!job) break;
       run(job);
     }`,
    // while(true) with a return escape.
    `function pump() {
       while (true) {
         const v = next();
         if (v === null) return;
         emit(v);
       }
     }`,
    // while(true) with a throw escape.
    `while (true) {
       if (failed()) throw new Error('stop');
       step();
     }`,
    // for(;;) with a break — the C-idiom bounded loop.
    `for (;;) {
       const c = read();
       if (c === EOF) break;
       handle(c);
     }`,
    // Escape nested inside a switch still counts.
    `while (true) {
       switch (state) {
         case 'done': return;
         default: advance();
       }
     }`,
  ],
  invalid: [
    // while(true) with no escape anywhere — genuinely infinite.
    {
      code: `while (true) {
         tick();
         render();
       }`,
      errors: [{ messageId: 'unboundedLoop', data: { kind: 'while (true)' } }],
    },
    // while(1) — numeric-literal spelling of the same.
    {
      code: `while (1) { spin(); }`,
      errors: [{ messageId: 'unboundedLoop', data: { kind: 'while (true)' } }],
    },
    // for(;;) with no escape.
    {
      code: `for (;;) {
         poll();
         sleep(100);
       }`,
      errors: [{ messageId: 'unboundedLoop', data: { kind: 'for (;;)' } }],
    },
    // A break belonging to a NESTED loop does not rescue the outer infinite one.
    {
      code: `while (true) {
         for (const x of xs) { if (x) break; }
         churn();
       }`,
      errors: [{ messageId: 'unboundedLoop', data: { kind: 'while (true)' } }],
    },
    // A return belonging to a NESTED function does not count as the loop's escape.
    {
      code: `while (true) {
         const cb = () => { return 1; };
         cb();
       }`,
      errors: [{ messageId: 'unboundedLoop', data: { kind: 'while (true)' } }],
    },
  ],
});

/**
 * Property tier (🟦). Invariants for an honest proxy: a counted `for` loop is
 * NEVER flagged no matter its body (no false positive on bounded loops), and a
 * `while(true)` with no escape is ALWAYS flagged no matter its body size (the
 * infinite shape is never missed).
 */
describe('bounded-loops invariants', () => {
  const linter = new TSESLint.Linter();
  const config: TSESLint.FlatConfig.Config = {
    plugins: {
      'mission-adjacent': { rules: { 'bounded-loops': boundedLoops } },
    },
    rules: { 'mission-adjacent/bounded-loops': 'error' },
  };

  function violations(code: string): number {
    return linter.verify(code, config).length;
  }

  // A normal counted loop with `bodySize` plain statements. Always bounded.
  function countedLoop(bodySize: number): string {
    const body = Array.from({ length: bodySize }, (_, i) => `step(${i});`).join(
      '\n  ',
    );
    return `for (let i = 0; i < n; i++) {\n  ${body}\n}`;
  }

  // A while(true) with `bodySize` plain statements and NO escape. Always infinite.
  function infiniteLoop(bodySize: number): string {
    const body = Array.from({ length: bodySize }, (_, i) => `step(${i});`).join(
      '\n  ',
    );
    return `while (true) {\n  ${body}\n}`;
  }

  // INVARIANT 1: a counted for-loop is never flagged, any body size.
  test.prop([fc.integer({ min: 0, max: 20 })])(
    'never reports a counted for-loop',
    (bodySize) => {
      expect(violations(countedLoop(bodySize))).toBe(0);
    },
  );

  // INVARIANT 2: an escape-free while(true) is always flagged exactly once.
  test.prop([fc.integer({ min: 0, max: 20 })])(
    'always reports an escape-free while(true) exactly once',
    (bodySize) => {
      expect(violations(infiniteLoop(bodySize))).toBe(1);
    },
  );
});
