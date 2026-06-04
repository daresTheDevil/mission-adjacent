/**
 * Shared complexity fixtures — the 2x2 that justifies two rules (ADR 0008).
 *
 * Both `cyclomatic-complexity` (lineage-backed) and `cognitive-complexity`
 * (lineage-inspired, the follow-up) consume these so the contrast is a single
 * source of truth. Both are synthetic, distilled from the curtain-vs-nesting
 * pattern seen on a real app — zero borrowed code.
 *
 * The point of the pair:
 *
 *   | fixture | plain CC | cognitive |
 *   |---------|----------|-----------|
 *   | curtain | HIGH     | low       |  <- plain CC cries wolf
 *   | nested  | HIGH     | HIGH      |  <- both agree, real complexity
 *
 * cyclomatic-complexity flags BOTH (it cannot tell them apart — its documented
 * limitation). cognitive-complexity should flag ONLY nested. That gap is the
 * reason the second rule exists.
 */

/**
 * CURTAIN: a flat field-mapper. Every `a || b || ""` is a logical-OR that
 * McCabe CC counts as +1, so this scores high on plain CC. But there is no
 * nesting, no path interaction — you read one line, you understand all of them.
 * The metric is crying wolf. A faithful CC rule flags it anyway; that is the
 * false positive cognitive-complexity is built to suppress.
 *
 * Counted CC: base 1 + 20 logical-OR operators (two per field, ten fields) = 21.
 * It scores HIGHER than the genuinely-nested fixture below — the false positive
 * in its purest form. The test asserts the exact measured count.
 */
export const CURTAIN = `
function mapRecord(r) {
  return {
    id: r.id || r.recordId || "",
    first: r.first || r.firstName || "",
    middle: r.middle || r.middleName || "",
    last: r.last || r.lastName || "",
    email: r.email || r.emailAddress || "",
    phone: r.phone || r.phoneNumber || "",
    street: r.street || r.addressLine1 || "",
    city: r.city || r.addressCity || "",
    state: r.state || r.addressState || "",
    zip: r.zip || r.addressZip || "",
  };
}
`;

/**
 * NESTED: genuinely nested control flow. Conditionals inside loops inside
 * conditionals, where later branches depend on earlier ones. This is the shape
 * CC is actually trying to catch — hard to test, many interacting paths, you
 * cannot hold it in your head. Both plain CC and cognitive complexity should
 * flag it.
 *
 * Counted CC: base 1 + the if/for/while/case/&&/ternary decision points = 18,
 * well past the 10/15 lineage thresholds. The test asserts the exact count.
 */
export const NESTED = `
function classify(items, mode) {
  let score = 0;
  for (const item of items) {
    if (item.active && item.weight > 0) {
      if (mode === 'strict') {
        for (const tag of item.tags) {
          if (tag.kind === 'a') {
            score += tag.value > 10 ? 2 : 1;
          } else if (tag.kind === 'b') {
            while (tag.depth > 0) {
              score += tag.depth % 2 === 0 ? 1 : 3;
              tag.depth -= 1;
            }
          } else {
            switch (tag.code) {
              case 'x': score += 1; break;
              case 'y': score += 2; break;
              case 'z': score += 3; break;
              default: score += 0;
            }
          }
        }
      } else if (mode === 'loose' || mode === 'lenient') {
        score += item.weight > 5 && item.active ? 5 : 1;
      }
    }
  }
  return score;
}
`;
