/**
 * eslint-plugin-mission-adjacent
 *
 * Proof-spine ESLint rules distilled from safety-critical coding standards
 * (Power of 10, JSF++, AUTOSAR, NUREG), translated to TypeScript. These are the
 * ~3 net-new rules no existing tool ships; typescript-eslint already covers the
 * hygiene 80%, so this plugin owns only the spine.
 *
 * NOT certified, validated, or fit for actual safety-critical use. See README.
 */
import { requireAssertionDensity } from './rules/require-assertion-density.js';
import { noUnboundedRecursion } from './rules/no-unbounded-recursion.js';
import { boundedLoops } from './rules/bounded-loops.js';

export const rules = {
  'require-assertion-density': requireAssertionDensity,
  'no-unbounded-recursion': noUnboundedRecursion,
  'bounded-loops': boundedLoops,
};

export default { rules };
