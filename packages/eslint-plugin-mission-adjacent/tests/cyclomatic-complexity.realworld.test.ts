import { RuleTester } from '@typescript-eslint/rule-tester';
import { cyclomaticComplexity } from '../src/rules/cyclomatic-complexity.js';

/**
 * Real-shaped validation. The flat fixtures in complexity.ts are top-level
 * functions; this file proves the rule works on the shape real code actually
 * takes — a class method with genuinely nested control flow and full TS types.
 * (The rule was also run by hand against a live app's CC-90+ merge function and
 * flagged it; this synthetic stands in as the portable, committed regression so
 * the suite does not depend on any external repo.)
 *
 * The method below measures CC 18: genuinely nested, but UNDER the JSF++
 * default of 20. That is the point of 20 being permissive — real nesting at
 * this depth clears it. It trips the stricter lineage thresholds (McCabe 10,
 * MISRA 15) and stays clean at JSF++ 20. That spread, on real-shaped TS, is the
 * lineage menu doing its job, and RuleTester parses the types so this is a true
 * end-to-end check, not a de-typed approximation.
 */
const NESTED_METHOD = `
class Service {
  private cache = new Map<string, number>();
  merge(records: Array<{ a?: number; b?: string; tags?: string[] }>, mode: string): number {
    let total = 0;
    for (const r of records) {
      if (r.a && r.a > 0) {
        if (mode === 'strict') {
          for (const t of r.tags ?? []) {
            if (t === 'x') {
              total += r.a > 10 ? 2 : 1;
            } else if (t === 'y') {
              let d = r.a;
              while (d > 0) { total += d % 2 === 0 ? 1 : 3; d -= 1; }
            } else {
              switch (t) {
                case 'p': total += 1; break;
                case 'q': total += 2; break;
                default: total += 0;
              }
            }
          }
        } else if (mode === 'loose' || mode === 'lenient') {
          total += r.a > 5 && r.b ? 5 : 1;
        }
      }
    }
    return total;
  }
}
`;

const FLAT_CLASS = `
class Dto {
  constructor(private raw: Record<string, unknown>) {}
  get id(): string { return String(this.raw.id ?? ''); }
  get name(): string { return String(this.raw.name ?? ''); }
  toJSON() { return { id: this.id, name: this.name }; }
}
`;

const ruleTester = new RuleTester();
ruleTester.run('cyclomatic-complexity realworld shapes', cyclomaticComplexity, {
  valid: [
    // A flat class with trivial methods stays clean — no false positive on
    // ordinary real-shaped code.
    { code: FLAT_CLASS, options: [{ max: 20 }] },
    // The nested method (CC 18) is UNDER the JSF++ default. Permissive by
    // design: real nesting at this depth is allowed at 20.
    { code: NESTED_METHOD, options: [{ max: 20 }] },
  ],
  invalid: [
    // Same method trips the stricter MISRA/NASA line of 15.
    {
      code: NESTED_METHOD,
      options: [{ max: 15 }],
      errors: [{ messageId: 'tooComplex' }],
    },
    // And McCabe's original 10.
    {
      code: NESTED_METHOD,
      options: [{ max: 10 }],
      errors: [{ messageId: 'tooComplex' }],
    },
  ],
});
