import { RuleTester } from '@typescript-eslint/rule-tester';
import { TSESLint } from '@typescript-eslint/utils';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { describe, expect } from 'vitest';

import { requireAssertionDensity } from '../src/rules/require-assertion-density.js';

const ruleTester = new RuleTester();

ruleTester.run('require-assertion-density', requireAssertionDensity, {
  valid: [
    // Trivial function below minStatements (3) is exempt regardless of asserts.
    'function getName(u) { return u.name; }',
    'const inc = (x) => x + 1;',
    // Expression-bodied arrow has no contract surface.
    'const double = (x) => x * 2;',
    // Meets the default of 2 assert-calls.
    `function transfer(from, to, amount) {
       assert(amount > 0);
       assert(from.balance >= amount);
       from.balance -= amount;
       to.balance += amount;
     }`,
    // Member-call assertions count on full dotted path.
    `function save(record, db) {
       assert.ok(record.id);
       assert.ok(db.connected);
       db.write(record);
     }`,
    // Two throw-guards satisfy the bar (house guard-clause style).
    `function withdraw(account, amount) {
       if (amount <= 0) throw new Error('amount must be positive');
       if (account.balance < amount) throw new Error('insufficient funds');
       account.balance -= amount;
     }`,
    // Mixed: one assert + one throw-guard = 2.
    `function open(path, mode) {
       assert(typeof path === 'string');
       if (!mode) throw new Error('mode required');
       return doOpen(path, mode);
     }`,
    // Block-form throw-guard counts.
    `function parse(input, schema) {
       if (input == null) { throw new Error('null input'); }
       assert(schema);
       return schema.parse(input);
     }`,
    // Options override: minAssertions 0 disables the rule.
    {
      code: `function loose(a, b) { const x = a + b; const y = x * 2; return y; }`,
      options: [{ minAssertions: 0 }],
    },
    // Nested function owns its own budget; the outer one is satisfied here.
    `function outer(a, b) {
       assert(a);
       assert(b);
       function helper(c) { return c + 1; }
       return helper(a) + helper(b);
     }`,
  ],
  invalid: [
    // Non-trivial function with zero assertions.
    {
      code: `function transfer(from, to, amount) {
         from.balance -= amount;
         to.balance += amount;
         log('done');
       }`,
      errors: [{ messageId: 'tooFewAssertions', data: { found: 0, required: 2 } }],
    },
    // One assertion, needs two.
    {
      code: `function withdraw(account, amount) {
         assert(amount > 0);
         account.balance -= amount;
         return account.balance;
       }`,
      errors: [{ messageId: 'tooFewAssertions', data: { found: 1, required: 2 } }],
    },
    // throw-guards disabled by option, so the guard does not count.
    {
      code: `function withdraw(account, amount) {
         if (amount <= 0) throw new Error('bad');
         if (account.balance < amount) throw new Error('bad');
         account.balance -= amount;
       }`,
      options: [{ countThrowGuards: false }],
      errors: [{ messageId: 'tooFewAssertions', data: { found: 0, required: 2 } }],
    },
    // Computed member call is NOT a recognized assertion name.
    {
      code: `function run(obj, amount) {
         obj['assert'](amount);
         const x = amount + 1;
         return x;
       }`,
      errors: [{ messageId: 'tooFewAssertions', data: { found: 0, required: 2 } }],
    },
    // Custom higher bar.
    {
      code: `function critical(a, b, c) {
         assert(a);
         assert(b);
         return c;
       }`,
      options: [{ minAssertions: 3 }],
      errors: [{ messageId: 'tooFewAssertions', data: { found: 2, required: 3 } }],
    },
  ],
});

/**
 * Property tier (🟦). The RuleTester cases above pin specific shapes; these pin
 * the INVARIANTS across the whole input space, deterministically (same seed →
 * same verdict). This is the mechanism the spec calls out: converting "does this
 * property hold?" from an LLM guess into a repeatable check — dogfooded on the
 * plugin's own flagship rule.
 *
 * RuleTester can't run inside a fast-check body (it generates a test suite, must
 * be top-level). So we drive the rule through ESLint's `Linter` directly, which
 * lints a string and returns messages as plain data we can assert on.
 */
describe('require-assertion-density invariants', () => {
  const linter = new TSESLint.Linter();
  const config: TSESLint.FlatConfig.Config = {
    plugins: {
      'mission-adjacent': { rules: { 'require-assertion-density': requireAssertionDensity } },
    },
    rules: { 'mission-adjacent/require-assertion-density': 'error' },
  };

  /** Count rule violations in a code string. */
  function violations(code: string): number {
    return linter.verify(code, config).length;
  }

  // Build a function body with `assertCount` assert-calls plus enough filler
  // statements to clear minStatements, so the only variable is assertion count.
  function fnWith(assertCount: number): string {
    const asserts = Array.from({ length: assertCount }, (_, i) => `assert(x${i});`);
    const filler = ['const a = 1;', 'const b = 2;', 'return a + b;'];
    return `function f() {\n  ${[...asserts, ...filler].join('\n  ')}\n}`;
  }

  // INVARIANT 1: at or above the default threshold (2), the rule never fires.
  test.prop([fc.integer({ min: 2, max: 30 })])(
    'never reports when assertions >= 2',
    (assertCount) => {
      expect(violations(fnWith(assertCount))).toBe(0);
    },
  );

  // INVARIANT 2: below the default threshold, the rule fires exactly once.
  test.prop([fc.integer({ min: 0, max: 1 })])(
    'reports exactly once when assertions < 2',
    (assertCount) => {
      expect(violations(fnWith(assertCount))).toBe(1);
    },
  );
});
