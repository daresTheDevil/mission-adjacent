/**
 * cyclomatic-complexity
 *
 * Lineage: JSF++ (Joint Strike Fighter Air Vehicle C++) AV Rule 3 — "All
 * functions shall have a cyclomatic complexity number of 20 or less." McCabe's
 * 1976 measure is the origin; the safety world clusters in a 10-to-20 band:
 * McCabe recommended 10 ("reasonable, but not magical"), NIST allows 15 with
 * written justification, NASA SWE-220 mandates 15, MISRA Report 5 says 15 for
 * safety-critical, JSF++ AV Rule 3 says 20. We default to 20 — the most
 * permissive lineage number, so the lowest false-positive rate — and JSF++ is
 * already a primary mission-adjacent source.
 *
 * Tier: LINEAGE-BACKED (ADR 0008). The threshold traces to a named safety
 * standard and the message cites it. The configurable values are themselves a
 * lineage menu — 10 (McCabe), 15 (MISRA/NASA), 20 (JSF++) — so configuring the
 * threshold is choosing which standard you hold yourself to, not tuning a fuzzy
 * knob. Determinism is preserved at any value: same threshold + same code =
 * same verdict.
 *
 * Determinism tier: 🟢 lint. Cyclomatic complexity is a purely syntactic count
 * of decision points, so the measurement is exact and reproducible. This rule
 * does NOT reinvent the metric — it counts CC the standard McCabe way that
 * ESLint core's `complexity` rule also implements (base 1, +1 per decision
 * point). The novelty is the lineage framing and the sourced default, not the
 * counting.
 *
 * KNOWN LIMITATION — the false positive this rule openly has. McCabe CC counts
 * every `&&`, `||`, `??`, and `?:` as a decision point. A flat curtain of field
 * defaults — `a || b || ""` across forty fields — scores a high CC while being
 * trivially readable, no nesting, nothing to hold in your head. Plain CC cannot
 * tell that curtain apart from genuinely-nested control flow of the same count.
 * This rule flags BOTH. That is the documented cost of staying a faithful
 * enforcer of the standard, and it is the reason the lineage-inspired
 * `cognitive-complexity` rule (ADR 0008, curtain-aware) exists as the follow-up.
 *
 * SWITCH CARVE-OUT. JSF++ AV Rule 3 notes that a function containing a `switch`
 * with many `case` labels may legitimately exceed the limit. We count each
 * `case` (classic McCabe), so a large dispatch switch will score high; that is
 * the one documented exception — disable the rule on the line for a genuine
 * dispatch table rather than splitting it.
 *
 * NOT certified for safety-critical use. See README.
 */
import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/types';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/daresTheDevil/mission-adjacent/blob/main/packages/eslint-plugin-mission-adjacent/docs/${name}.md`,
);

/**
 * The lineage menu of legitimate thresholds. Surfaced as documentation, not a
 * hard floor: a value below the menu (e.g. 3) is not lineage-backed and gets a
 * soft warning, never a hard failure (ADR 0008).
 */
export const LINEAGE_THRESHOLDS = {
  /** McCabe 1976, the original target. Aspirational. */
  mccabe: 10,
  /** MISRA Report 5 / NASA SWE-220. Stricter. */
  misra: 15,
  /** JSF++ AV Rule 3. The default — most permissive, lowest false-positive. */
  jsf: 20,
} as const;

/** Default threshold: JSF++ AV Rule 3. */
export const DEFAULT_THRESHOLD = LINEAGE_THRESHOLDS.jsf;

/** Below this, a threshold is not lineage-backed and earns a soft warning. */
const LINEAGE_FLOOR = LINEAGE_THRESHOLDS.mccabe;

export type Options = [{ max?: number }];

export type MessageIds = 'tooComplex' | 'subLineageThreshold';

/**
 * Count the cyclomatic complexity of a single function body the standard McCabe
 * way: base 1, +1 for each decision point. Decision points are `if`, each
 * `case` (classic mode; `default` and the `switch` itself add nothing), the
 * three loop forms, `catch`, the ternary, and each `&&`/`||`/`??` operator.
 * `else` adds nothing — it is the already-counted fall-through path.
 *
 * Bounded: an iterative worklist over the function's own subtree. Each node is
 * visited at most once; nested functions are NOT descended into (their
 * complexity is counted when the walk reaches them as their own function node).
 * The AST is finite and acyclic, so the loop terminates. No recursion — this
 * rule obeys no-unbounded-recursion itself.
 */
function complexityOf(fnNode: TSESTree.Node): number {
  let complexity = 1;
  const stack: TSESTree.Node[] = [fnNode];
  // Track which node started the walk so we don't bail out of it immediately.
  let first = true;

  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      break;
    }

    // Do not descend into a NESTED function — its complexity is its own, scored
    // when the rule visits it directly. The walk's own root function is exempt
    // from this guard (first iteration).
    if (!first && isFunctionNode(node)) {
      continue;
    }
    first = false;

    switch (node.type) {
      case 'IfStatement':
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'CatchClause':
      case 'ConditionalExpression':
        complexity += 1;
        break;
      case 'SwitchCase':
        // Each non-default case is a decision point; `default` is the
        // fall-through and adds nothing.
        if (node.test !== null) {
          complexity += 1;
        }
        break;
      case 'LogicalExpression':
        // `&&`, `||`, `??` each introduce a branch. `a && b && c` is two
        // operators, two added paths.
        if (
          node.operator === '&&' ||
          node.operator === '||' ||
          node.operator === '??'
        ) {
          complexity += 1;
        }
        break;
      default:
        break;
    }

    // Push every child node. The visitor-key-free walk: enumerate own
    // properties that hold child nodes or node arrays. Bounded by the finite
    // AST; each node enqueued at most once because the tree is acyclic.
    for (const key of Object.keys(node)) {
      if (key === 'parent') {
        continue;
      }
      const value = (node as unknown as Record<string, unknown>)[key];
      if (isNode(value)) {
        stack.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) {
            stack.push(item);
          }
        }
      }
    }
  }

  return complexity;
}

/** Is `value` an AST node (has a string `type`)? */
function isNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/** Is this node one of the three function forms? */
function isFunctionNode(node: TSESTree.Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

export const cyclomaticComplexity = createRule<Options, MessageIds>({
  name: 'cyclomatic-complexity',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Flag a function whose cyclomatic complexity exceeds the threshold (default 20, JSF++ AV Rule 3). Lineage-backed; counts CC the standard McCabe way.',
    },
    messages: {
      tooComplex:
        'Function has a cyclomatic complexity of {{complexity}}, over the limit of {{max}}. The default limit of 20 is JSF++ AV Rule 3; the safety lineage spans 10 (McCabe) to 20 (JSF++). Split the function, or if it is a genuine dispatch switch (the documented JSF++ carve-out) disable this rule on the line.',
      subLineageThreshold:
        'Configured max of {{max}} is below the lineage floor of {{floor}} (McCabe 1976). No safety standard sets a cyclomatic-complexity limit this strict, so this threshold is your own, not lineage-backed.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 1,
            description:
              'Maximum allowed cyclomatic complexity. Lineage values: 10 (McCabe), 15 (MISRA/NASA), 20 (JSF++, default).',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ max: DEFAULT_THRESHOLD }],
  create(context, [options]) {
    const max = options.max ?? DEFAULT_THRESHOLD;

    // Soft warning, once per file, when the configured threshold is below the
    // lineage floor. Not a hard failure (ADR 0008) — you can set your own
    // number, you just do not get to call it lineage-backed.
    let warnedSubLineage = false;
    function warnSubLineageOnce(node: TSESTree.Node): void {
      if (max < LINEAGE_FLOOR && !warnedSubLineage) {
        warnedSubLineage = true;
        context.report({
          node,
          messageId: 'subLineageThreshold',
          data: { max, floor: LINEAGE_FLOOR },
        });
      }
    }

    /** Score one function node and report if it exceeds the threshold. */
    function check(node: TSESTree.Node): void {
      warnSubLineageOnce(node);
      const complexity = complexityOf(node);
      if (complexity > max) {
        context.report({
          node,
          messageId: 'tooComplex',
          data: { complexity, max },
        });
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
