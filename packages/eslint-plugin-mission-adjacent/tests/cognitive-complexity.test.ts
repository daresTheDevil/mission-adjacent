import { RuleTester } from '@typescript-eslint/rule-tester';
import { TSESLint } from '@typescript-eslint/utils';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { cognitiveComplexity } from '../src/rules/cognitive-complexity.js';
import { CURTAIN, NESTED } from './fixtures/complexity.js';

const ruleTester = new RuleTester();

ruleTester.run('cognitive-complexity', cognitiveComplexity, {
  valid: [
    // A trivial function: cognitive complexity 0, well under any threshold.
    'function noop() { return 1; }',
    // A single guarded return: one `if` at nesting 0 = 1, under the default 15.
    'function abs(n) { if (n < 0) return -n; return n; }',
    // The curtain collapses: a long flat run of the SAME operator scores +1 for
    // the whole run, no matter how many operands. Twelve ORs, still 1.
    {
      code: `function pick(o) { return ${Array.from({ length: 12 }, (_, i) => `o.f${i}`).join(' || ')}; }`,
    },
    // An else-if ladder stays flat: each rung is a +1 continuation, not a nested
    // if. Five rungs at nesting 0 = 5, under 15.
    {
      code: `function grade(n) { if (n > 90) return 'a'; else if (n > 80) return 'b'; else if (n > 70) return 'c'; else if (n > 60) return 'd'; else return 'f'; }`,
    },
    // The curtain fixture is the whole point: high cyclomatic, LOW cognitive.
    // Measured score 10, under the default 15 — NOT flagged.
    CURTAIN,
  ],
  invalid: [
    // Nested bodies over the default: deep control flow stacks the nesting
    // penalty. The NESTED fixture measures 50, far over 15.
    {
      code: NESTED,
      errors: [{ messageId: 'tooComplex' }],
    },
    // Boundary: a flat run of independent ifs scores +1 each (all at nesting 0).
    // Sixteen ifs = 16 > 15, flags. (Fifteen would be exactly at the limit.)
    {
      code: `function f(x) {\n${Array.from({ length: 16 }, (_, i) => `  if (x === ${i}) return ${i};`).join('\n')}\n  return -1;\n}`,
      errors: [{ messageId: 'tooComplex' }],
    },
    // A stricter custom threshold flags what the default would allow. The curtain
    // (cognitive 10) flags only when you set max below 10.
    {
      code: CURTAIN,
      options: [{ max: 9 }],
      errors: [{ messageId: 'tooComplex' }],
    },
  ],
});

/**
 * Worked-trace exact-count lock (ADR 0008). This function pins the algorithm to a
 * hand-computed score of 7: a `for...of` (nesting 0 → +1) wrapping
 * `if (i.a && i.b)` (nesting 1 → +2, plus +1 for the single `&&`) wrapping
 * `if (mode === 'strict')` (nesting 2 → +3). 1 + 2 + 1 + 3 = 7. If the nesting
 * penalty, the else-if interception, or the operator collapse regresses, this
 * count moves and the test catches it.
 */
describe('cognitive-complexity worked trace', () => {
  const linter = new TSESLint.Linter();

  function score(code: string): number {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max: 1 }] },
    };
    const msgs = linter
      .verify(code, config)
      .filter((m) => m.message.includes('cognitive complexity of'));
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const match = /complexity of (\d+)/.exec(msgs[0]!.message);
    expect(match).not.toBeNull();
    return Number(match![1]);
  }

  const TRACE = `
function trace(items, mode) {
  for (const i of items) {
    if (i.a && i.b) {
      if (mode === 'strict') {
        return 1;
      }
    }
  }
  return 0;
}
`;

  function flags(code: string, max: number): boolean {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max }] },
    };
    return linter
      .verify(code, config)
      .some((m) => m.message.includes('over the limit'));
  }

  it('measures the trace at exactly 7', () => {
    expect(score(TRACE)).toBe(7);
  });

  it('flags the trace at max 6, passes it at max 7', () => {
    expect(flags(TRACE, 6)).toBe(true);
    expect(flags(TRACE, 7)).toBe(false);
  });
});

/**
 * The 2x2 headline (ADR 0008). This is the whole justification for shipping two
 * complexity rules. cyclomatic-complexity scores CURTAIN 21 and NESTED 18 — the
 * flat curtain scores HIGHER than real nesting, the wolf-cry. cognitive-
 * complexity inverts that ordering: the curtain collapses LOW, the nesting stacks
 * HIGH. These are the real measured scores, not guesses.
 *
 * Cross-reference: cyclomatic-complexity.test.ts asserts CURTAIN=21, NESTED=18.
 */
describe('cognitive-complexity on the shared fixtures (the 2x2)', () => {
  const linter = new TSESLint.Linter();

  function score(code: string): number {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max: 1 }] },
    };
    const msgs = linter
      .verify(code, config)
      .filter((m) => m.message.includes('cognitive complexity of'));
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const match = /complexity of (\d+)/.exec(msgs[0]!.message);
    expect(match).not.toBeNull();
    return Number(match![1]);
  }

  function flagsAtDefault(code: string): boolean {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max: 15 }] },
    };
    return linter
      .verify(code, config)
      .some((m) => m.message.includes('over the limit'));
  }

  const CURTAIN_COGNITIVE = 10;
  const NESTED_COGNITIVE = 50;

  it('curtain collapses to a LOW cognitive score, under the default 15', () => {
    // The flat || curtain that scored cyclomatic 21 collapses to 10 here — each
    // field's same-operator OR run is a single +1. Under 15, so NOT flagged.
    expect(score(CURTAIN)).toBe(CURTAIN_COGNITIVE);
    expect(flagsAtDefault(CURTAIN)).toBe(false);
  });

  it('nested stacks a HIGH cognitive score, over the default 15', () => {
    // Real nesting compounds: the deep control flow that scored cyclomatic 18
    // scores 50 here, because each level adds its nesting penalty. Flagged.
    expect(score(NESTED)).toBe(NESTED_COGNITIVE);
    expect(flagsAtDefault(NESTED)).toBe(true);
  });

  it('inverts cyclomatic ordering: NESTED >> CURTAIN by a wide margin', () => {
    // The money assertion. cyclomatic: CURTAIN 21 > NESTED 18 (false positive
    // wins). cognitive: NESTED 50 >> CURTAIN 10 (real complexity wins, by 5x).
    expect(NESTED_COGNITIVE).toBeGreaterThan(CURTAIN_COGNITIVE);
    expect(NESTED_COGNITIVE - CURTAIN_COGNITIVE).toBeGreaterThan(20);
  });
});

/**
 * Property tier (🟦, ADR 0002). The invariants that separate cognitive from
 * cyclomatic: a same-operator run collapses to a constant regardless of length,
 * deeper nesting costs strictly more, and branchless code never flags.
 */
describe('cognitive-complexity invariants', () => {
  const linter = new TSESLint.Linter();

  function score(code: string): number {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max: 1 }] },
    };
    const msgs = linter
      .verify(code, config)
      .filter((m) => m.message.includes('cognitive complexity of'));
    if (msgs.length === 0) return 0;
    const match = /complexity of (\d+)/.exec(msgs[0]!.message);
    return match ? Number(match[1]) : 0;
  }

  function violations(code: string, max: number): number {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max }] },
    };
    return linter
      .verify(code, config)
      .filter((m) => m.message.includes('over the limit')).length;
  }

  // A flat chain of N same-operator ORs. Cyclomatic scores this N (linear);
  // cognitive collapses the run to a constant 1.
  function orChain(n: number): string {
    const ors = Array.from({ length: n }, (_, i) => `o.f${i}`).join(' || ');
    return `function f(o) { return ${ors}; }`;
  }

  // The same N-operand chain with ONE operator flipped to `&&`. `&&` binds
  // tighter than `||`, so `a || b && c || ...` parses as `a || (b && c) || ...`:
  // the outer `||` run still collapses to +1, and the single nested `&&` is a new
  // run worth +1 — total 2. One flip, one extra point. This is the control that
  // proves the same-operator chain genuinely collapsed to 1, not that the metric
  // is blind to logical operators entirely.
  function oneFlipChain(n: number): string {
    const ops = Array.from({ length: n }, (_, i) => `o.f${i}`);
    // Join with `||` everywhere except a single `&&` at the second seam.
    const joined = ops.reduce((acc, term, i) => {
      if (i === 0) return term;
      const op = i === 2 ? ' && ' : ' || ';
      return `${acc}${op}${term}`;
    }, '');
    return `function f(o) { return ${joined}; }`;
  }

  // N nested ifs, each one level deeper. Cognitive charges nesting+1 per level:
  // 1 + 2 + ... + N = N(N+1)/2 (the nesting penalty made visible).
  function nestedIfs(n: number): string {
    let body = 'return 1;';
    for (let i = n; i >= 1; i -= 1) {
      body = `if (x > ${i}) { ${body} }`;
    }
    return `function f(x) { ${body} }`;
  }

  // INVARIANT 1: the curtain collapse, pinned to the constant 1 from both sides.
  // max 1 is the lowest legal threshold and the message fires only on score > 1,
  // so a score of exactly 1 is unobservable directly. We pin it by a sandwich:
  //   - a same-operator chain of any length N never flags at max 1, so its score
  //     is <= 1 for all N (cyclomatic would score linear-in-N and flag a long
  //     enough chain — this is the difference);
  //   - the SAME-length chain with a single operator flipped DOES flag at max 1,
  //     so that one flip pushed the score to >= 2.
  // A run that collapses to <= 1 and gains exactly one point per operator change
  // is a run that collapsed to 1. The flip is the control that rules out "the
  // metric just ignores logical operators".
  test.prop([fc.integer({ min: 3, max: 40 })])(
    'collapses a same-operator chain to the constant 1 (a single flip adds one point)',
    (n) => {
      expect(violations(orChain(n), 1)).toBe(0);
      expect(violations(oneFlipChain(n), 1)).toBe(1);
    },
  );

  // INVARIANT 2: nesting is monotone — N nested ifs always cost strictly more
  // than N-1 nested ifs. Deeper genuinely costs more.
  test.prop([fc.integer({ min: 1, max: 10 })])(
    'charges strictly more for one more level of nesting',
    (n) => {
      expect(score(nestedIfs(n + 1))).toBeGreaterThan(score(nestedIfs(n)));
    },
  );

  // INVARIANT 3: a branchless function (score 0) is never flagged, any threshold.
  test.prop([fc.integer({ min: 1, max: 30 })])(
    'never flags a branchless function',
    (max) => {
      expect(violations('function f() { return 42; }', max)).toBe(0);
    },
  );
});

/**
 * Honesty guard (ADR 0005/0008). This rule is the project's first knowingly-
 * invented threshold (Sonar's 15, not a safety number). The message must cite
 * Sonar and must NOT borrow safety-lineage authority it does not have. No JSF++,
 * no MISRA, no NASA, no McCabe, no "safety" as a backing claim.
 */
describe('cognitive-complexity honesty in the message', () => {
  const linter = new TSESLint.Linter();

  function violationMessage(code: string, max: number): string | undefined {
    const config: TSESLint.FlatConfig.Config = {
      plugins: {
        'mission-adjacent': {
          rules: { 'cognitive-complexity': cognitiveComplexity },
        },
      },
      rules: { 'mission-adjacent/cognitive-complexity': ['error', { max }] },
    };
    return linter
      .verify(code, config)
      .map((m) => m.message)
      .find((m) => m.includes('cognitive complexity of'));
  }

  it('cites Sonar (S3776) as the method and number', () => {
    const msg = violationMessage(NESTED, 15);
    expect(msg).toBeDefined();
    expect(msg).toContain('Sonar');
    expect(msg).toContain('S3776');
  });

  it('makes no safety claim and borrows no safety lineage', () => {
    const msg = violationMessage(NESTED, 15);
    expect(msg).toBeDefined();
    // It must say it is NOT a safety standard, and never name a safety lineage.
    expect(msg).toContain('not a safety standard');
    expect(msg).not.toContain('JSF++');
    expect(msg).not.toContain('MISRA');
    expect(msg).not.toContain('NASA');
    expect(msg).not.toContain('McCabe');
  });
});
