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

export const rules = {
  'require-assertion-density': requireAssertionDensity,
};

export default { rules };
