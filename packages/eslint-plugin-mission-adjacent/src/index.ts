/**
 * eslint-plugin-mission-adjacent
 *
 * ESLint rules distilled from safety-critical coding standards (Power of 10,
 * JSF++, AUTOSAR, NUREG), translated to TypeScript. The core is the ~3 net-new
 * proof-spine rules no existing tool ships (require-assertion-density,
 * bounded-loops, no-unbounded-recursion); typescript-eslint already covers the
 * hygiene 80%. On top of the spine sits the complexity tier (ADR 0008):
 * cyclomatic-complexity (lineage-backed) and cognitive-complexity
 * (lineage-inspired).
 *
 * NOT certified, validated, or fit for actual safety-critical use. See README.
 */
import { requireAssertionDensity } from './rules/require-assertion-density.js';
import { noUnboundedRecursion } from './rules/no-unbounded-recursion.js';
import { boundedLoops } from './rules/bounded-loops.js';
import { cyclomaticComplexity } from './rules/cyclomatic-complexity.js';
import { cognitiveComplexity } from './rules/cognitive-complexity.js';

export const rules = {
  'require-assertion-density': requireAssertionDensity,
  'no-unbounded-recursion': noUnboundedRecursion,
  'bounded-loops': boundedLoops,
  'cyclomatic-complexity': cyclomaticComplexity,
  'cognitive-complexity': cognitiveComplexity,
};

export default { rules };
