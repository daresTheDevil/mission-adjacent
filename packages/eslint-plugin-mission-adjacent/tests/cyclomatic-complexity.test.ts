import { RuleTester } from '@typescript-eslint/rule-tester';
import { TSESLint } from '@typescript-eslint/utils';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { cyclomaticComplexity } from '../src/rules/cyclomatic-complexity.js';
import { CURTAIN, NESTED } from './fixtures/complexity.js';

const ruleTester = new RuleTester();

ruleTester.run('cyclomatic-complexity', cyclomaticComplexity, {
  valid: [
    // A trivial function: base complexity 1, well under any threshold.
    'function noop() { return 1; }',
    // A single branch: CC 2, under the default 20.
    'function abs(n) { if (n < 0) return -n; return n; }',
    // At the default threshold (20) but not over — boundary holds, no flag.
    // 19 ternaries + base 1 = 20, which is not > 20.
    {
      code: `function f(x) { return ${Array.from({ length: 19 }, (_, i) => `x === ${i} ? ${i} :`).join(' ')} -1; }`,
    },
    // A genuine dispatch switch under a custom lower limit stays valid if under it.
    {
      code: 'function g(n) { if (n) return 1; return 0; }',
      options: [{ max: 10 }],
    },
  ],
  invalid: [
    // Over the default 20: 20 ternaries + base 1 = 21 > 20.
    {
      code: `function f(x) { return ${Array.from({ length: 20 }, (_, i) => `x === ${i} ? ${i} :`).join(' ')} -1; }`,
      errors: [{ messageId: 'tooComplex' }],
    },
    // A stricter custom threshold (McCabe 10) flags what the default would allow.
    {
      code: `function f(x) { return ${Array.from({ length: 11 }, (_, i) => `x === ${i} ? ${i} :`).join(' ')} -1; }`,
      options: [{ max: 10 }],
      errors: [{ messageId: 'tooComplex' }],
    },
    // Sub-lineage threshold (below McCabe's 10) emits the file-scope warning AND
    // the sub-lineage complexity error — NOT the lineage-backed `tooComplex`.
    // The violation message itself must not claim JSF++/McCabe cover for a
    // number no standard blessed (ADR 0005). Two reports on the over function.
    {
      code: 'function f(n) { return n > 0 ? 1 : 2; }',
      options: [{ max: 1 }],
      errors: [
        { messageId: 'subLineageThreshold' },
        { messageId: 'tooComplexSubLineage' },
      ],
    },
  ],
});

/**
 * Honesty guard (ADR 0005). The lineage citation must travel with the verdict
 * only when the verdict is actually lineage-backed. A lineage-backed threshold
 * (>= McCabe 10) gets the JSF++ citation; a sub-lineage one (< 10) must NOT —
 * its violation message has to say the limit is the user's own, not a standard.
 * This is the exact seam a reviewer flagged: a soft warning is suppressible, so
 * the honesty has to ride the per-violation message, which fires every time.
 */
describe('cyclomatic-complexity lineage honesty in the message', () => {
  const linter = new TSESLint.Linter();
  function messages(code: string, max: number): string[] {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cyclomatic-complexity': cyclomaticComplexity },
        },
      },
      rules: { 'mission-adjacent/cyclomatic-complexity': ['error', { max }] },
    };
    return linter.verify(code, config).map((m) => m.message);
  }

  // A function comfortably over both a lineage (10) and a sub-lineage (2) limit:
  // base 1 + 12 ternaries = CC 13.
  const over = `function f(x) { return ${Array.from({ length: 12 }, (_, i) => `x === ${i} ? ${i} :`).join(' ')} -1; }`;

  it('cites JSF++ when the limit is lineage-backed (max >= 10)', () => {
    const violation = messages(over, 10).find((m) =>
      m.includes('cyclomatic complexity of'),
    );
    expect(violation).toContain('JSF++');
  });

  it('does NOT cite JSF++ when the limit is sub-lineage (max < 10)', () => {
    const violation = messages(over, 2).find((m) =>
      m.includes('cyclomatic complexity of'),
    );
    expect(violation).toBeDefined();
    // The honesty property: no false lineage cover on an invented number.
    expect(violation).not.toContain('JSF++');
    expect(violation).toContain('NOT lineage-backed');
  });
});

/**
 * The 2x2 (ADR 0008). cyclomatic-complexity flags BOTH fixtures — it cannot
 * tell the flat curtain apart from real nesting. That is its documented
 * limitation and the reason cognitive-complexity exists. These assertions lock
 * the actual measured counts so a regression in the counter is caught.
 */
describe('cyclomatic-complexity on the shared fixtures', () => {
  const linter = new TSESLint.Linter();

  function report(code: string, max: number): TSESLint.Linter.LintMessage[] {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cyclomatic-complexity': cyclomaticComplexity },
        },
      },
      rules: {
        'mission-adjacent/cyclomatic-complexity': ['error', { max }],
      },
    };
    return linter.verify(code, config);
  }

  // Pull the reported complexity out of the message for an exact-count assertion.
  function complexityOf(code: string): number {
    // max:1 is the lowest legal threshold; it forces a report on any function
    // with a single decision point so we can read its measured complexity.
    const msgs = report(code, 1).filter((m) =>
      m.message.includes('cyclomatic complexity of'),
    );
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const match = /complexity of (\d+)/.exec(msgs[0]!.message);
    expect(match).not.toBeNull();
    return Number(match![1]);
  }

  it('curtain scores a high CC despite being trivially readable', () => {
    const cc = complexityOf(CURTAIN);
    // Flat || curtain: base 1 + 20 OR operators (two per field, 10 fields) = 21.
    // Note it scores HIGHER than the genuinely-nested fixture below — the false
    // positive in its purest form.
    expect(cc).toBe(21);
  });

  it('nested scores a high CC from real interacting paths', () => {
    const cc = complexityOf(NESTED);
    // Real interacting paths: base 1 + the if/for/while/case/&&/ternary points.
    expect(cc).toBe(18);
  });

  it('flags BOTH fixtures at a strict lineage threshold (its limitation)', () => {
    // At McCabe's 10 both are well over — the false positive (curtain, CC 21)
    // and the true positive (nested, CC 18) are indistinguishable to plain CC.
    // The curtain even scores higher, which is exactly the wolf-cry.
    expect(report(CURTAIN, 10).some((m) => m.message.includes('over the limit'))).toBe(true);
    expect(report(NESTED, 10).some((m) => m.message.includes('over the limit'))).toBe(true);
  });
});

/**
 * Property tier (🟦). Invariants for the counter: complexity rises monotonically
 * with added decision points, and a function with zero decision points always
 * scores exactly 1 (never flagged under any lineage threshold).
 */
describe('cyclomatic-complexity invariants', () => {
  const linter = new TSESLint.Linter();

  function violations(code: string, max: number): number {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cyclomatic-complexity': cyclomaticComplexity },
        },
      },
      rules: {
        'mission-adjacent/cyclomatic-complexity': ['error', { max }],
      },
    };
    return linter
      .verify(code, config)
      .filter((m) => m.message.includes('over the limit')).length;
  }

  // A function with `n` independent `if` statements has CC = n + 1.
  function nIfs(n: number): string {
    const body = Array.from(
      { length: n },
      (_, i) => `if (x === ${i}) y += ${i};`,
    ).join('\n  ');
    return `function f(x) {\n  let y = 0;\n  ${body}\n  return y;\n}`;
  }

  // INVARIANT 1: a branchless function (CC 1) is never flagged, any lineage max.
  test.prop([fc.integer({ min: 10, max: 20 })])(
    'never flags a branchless function',
    (max) => {
      expect(violations('function f() { return 42; }', max)).toBe(0);
    },
  );

  // INVARIANT 2: n ifs gives CC n+1 — flagged exactly when n+1 > max.
  test.prop([fc.integer({ min: 0, max: 30 }), fc.integer({ min: 10, max: 20 })])(
    'flags n-ifs exactly when n+1 exceeds the threshold',
    (n, max) => {
      const expected = n + 1 > max ? 1 : 0;
      expect(violations(nIfs(n), max)).toBe(expected);
    },
  );
});
