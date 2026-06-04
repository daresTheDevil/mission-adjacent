/**
 * cognitive-complexity
 *
 * Tier: LINEAGE-INSPIRED (ADR 0008). Read this header before the threshold.
 *
 * This is NOT what MISRA, JSF++, NASA, or any safety standard wrote. None of
 * them define a cognitive-complexity limit. The method is G. Ann Campbell's
 * Cognitive Complexity (SonarSource white paper, rule S3776, 2017). The number
 * is Sonar's default of 15. Neither is a safety-lineage value, and this rule
 * never claims one. It is a deliberate deviation, surfaced loudly so nobody
 * mistakes it for the backed tier.
 *
 * WHY IT DEVIATES — the curtain blind spot. `cyclomatic-complexity` is the
 * lineage-backed anchor (JSF++ AV Rule 3, default 20). It has a documented false
 * positive: McCabe CC counts every `||`/`??`/`?:` as a branch, so a flat curtain
 * of field defaults scores HIGH while being trivially readable. We measured it on
 * the shared fixtures: the flat CURTAIN scores cyclomatic 21, the genuinely-
 * nested NESTED scores 18. The curtain scores HIGHER than real nesting. That
 * inversion is the wolf-cry, and cyclomatic cannot fix it without ceasing to be a
 * faithful enforcer of the standard. Cognitive complexity is the teeth that fix
 * it: a run of the same logical operator collapses to one point, and a branch
 * three levels deep costs more than one at the top. On the same fixtures the
 * ordering inverts — CURTAIN low, NESTED high — and that 2x2 is the whole reason
 * two complexity rules ship instead of one.
 *
 * Determinism tier: 🟢 lint. Cognitive complexity is a purely syntactic walk:
 * structural increments plus a nesting penalty plus operator-sequence collapse.
 * Same code + same threshold = same score, every run. No type information, no
 * heuristics, no LLM judgment.
 *
 * RECURSION POSTURE — and it is deliberate, do NOT "fix" it back to a worklist.
 * `cyclomatic-complexity.ts` walks with a flat iterative LIFO stack. This rule
 * walks with bounded recursive descent: `score(node, nesting)`. The break in
 * visual symmetry is on purpose. Cognitive complexity needs two things at every
 * node that a flat pop-stack makes awkward: (1) the current nesting depth, which
 * weights structural increments, and (2) the parent logical operator, which
 * decides whether a `&&`/`||` collapses into its neighbor or starts a new run.
 * Both fall out naturally from passing `nesting` (and, for logical chains, the
 * parent operator) down the call as parameters. On a LIFO stack you would have to
 * re-encode depth and parent-operator onto every pushed tuple and reconstruct the
 * chain by hand. The recursion is bounded by a finite acyclic AST with a natural
 * base case (a node with no child nodes), so it terminates and does NOT violate
 * `no-unbounded-recursion` (which flags an unguarded named self-re-entry, not a
 * bounded tree walk).
 *
 * THE ALGORITHM (Campbell / SonarSource S3776):
 *   - Structural increment WITH nesting (`nesting + 1`): the initial `if`, the
 *     three `for` forms, `while`, `do-while`, `switch`, `catch`, and the ternary.
 *     Each also raises nesting for its own body.
 *   - `else if`: flat +1, NO nesting bump (it is a continuation of the `if`). Its
 *     body still descends at `nesting + 1`. This is the subtlest seam — see
 *     `scoreAlternate`.
 *   - plain `else`: flat +1, body at `nesting + 1`.
 *   - `switch`: +1 for the switch (with nesting), NOT per `case`. Case bodies sit
 *     one level deeper.
 *   - logical operators: +1 (flat, no nesting) only when the operator DIFFERS
 *     from its parent in the flattened binary chain. `a && b && c` is one run, +1.
 *     `a && b || c` changes operator, +2. This is the curtain collapse.
 *   - nested function: flat +1 for being nested; its body starts at `nesting + 1`.
 *     The root function is seeded at nesting 0 and does not increment for itself.
 *
 * Worked trace (the test locks this at exactly 7): a `for...of` (nesting 0 → +1)
 * wrapping `if (i.a && i.b)` (nesting 1 → +2, plus +1 for the single `&&`)
 * wrapping `if (mode === 'strict')` (nesting 2 → +3). 1 + 2 + 1 + 3 = 7.
 *
 * NOT certified for safety-critical use. See README.
 */
import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/types';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/daresTheDevil/mission-adjacent/blob/main/packages/eslint-plugin-mission-adjacent/docs/${name}.md`,
);

/**
 * Default threshold: SonarSource S3776's default of 15. This is Sonar's invented
 * number, NOT a safety-lineage value. There is no menu and no floor here — unlike
 * cyclomatic-complexity, this rule makes no lineage claim at any threshold, so
 * there is nothing to fall below. Tune it freely; the message says the same thing
 * at every value.
 */
export const DEFAULT_THRESHOLD = 15;

export type Options = [{ max?: number }];

export type MessageIds = 'tooComplex';

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

/**
 * Score the cognitive complexity of one function body via bounded recursive
 * descent. `fnNode` is the function whose own body is measured; nested functions
 * are charged a flat +1 and descended at one level deeper, but are NOT scored as
 * their own top-level functions here (the rule visits them separately).
 *
 * Bounded: the AST under `fnNode` is finite and acyclic, and every recursive call
 * descends to a strict child, so the walk terminates at leaf nodes. See the
 * RECURSION POSTURE header for why this is recursive where cyclomatic is not.
 */
function cognitiveComplexityOf(fnNode: TSESTree.Node): number {
  let total = 0;

  /**
   * Recurse into `node` at the given `nesting` depth. The root function body is
   * entered at nesting 0. A node that raises nesting for its body passes
   * `nesting + 1` to its children.
   *
   * `isRoot` marks the function node the walk started from, so it is not charged
   * the flat +1 that a genuinely-nested function would get.
   */
  function score(node: TSESTree.Node, nesting: number, isRoot: boolean): void {
    // A nested function: flat +1 for being nested, body one level deeper. The
    // root function is exempt — it is the thing we are measuring, not a nested
    // one. Charge, then descend its children at nesting + 1 and return so the
    // generic pass below does not also walk them at the wrong depth.
    if (isFunctionNode(node) && !isRoot) {
      total += 1;
      scoreChildren(node, nesting + 1);
      return;
    }

    switch (node.type) {
      case 'IfStatement':
        scoreIf(node, nesting);
        return;
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'SwitchStatement':
      case 'CatchClause':
      case 'ConditionalExpression':
        // Structural increment with nesting; body descends one level deeper.
        total += nesting + 1;
        scoreChildren(node, nesting + 1);
        return;
      case 'LogicalExpression':
        // A logical chain collapses runs of the same operator. Score the whole
        // chain here (passing no parent operator) and do NOT fall through to the
        // generic walk, which would double-count the nested LogicalExpressions.
        scoreLogical(node, nesting, undefined);
        return;
      default:
        // Everything else adds nothing itself; walk its children at the same
        // nesting.
        scoreChildren(node, nesting);
        return;
    }
  }

  /**
   * Handle an `if`. The `if` itself is a structural increment with nesting and
   * raises nesting for its consequent. Its test (logical operators) and
   * consequent are walked at `nesting + 1`. The `alternate` is routed through
   * `scoreAlternate` so an `else if` is treated as a flat continuation, not a
   * second nesting-charged `if`.
   */
  function scoreIf(node: TSESTree.IfStatement, nesting: number): void {
    total += nesting + 1;
    score(node.test, nesting + 1, false);
    score(node.consequent, nesting + 1, false);
    if (node.alternate !== null) {
      scoreAlternate(node.alternate, nesting);
    }
  }

  /**
   * The subtlest seam in the algorithm. An `else` clause is parsed as the
   * `alternate` of the parent `IfStatement`. When that alternate is itself an
   * `IfStatement`, the source was `else if` — Campbell scores it as a flat +1
   * CONTINUATION with NO nesting increment (you read an if/else-if ladder
   * top-to-bottom, it does not pile up nesting). If we let it fall through to the
   * normal `scoreIf`, it would be charged `nesting + 1` like a fresh nested `if`
   * and double-count. So intercept here: charge the flat +1, walk the else-if's
   * own test and consequent at `nesting + 1`, and recurse into ITS alternate
   * through this same helper so a long ladder stays flat.
   *
   * A plain `else` (alternate is not an `IfStatement`) is also a flat +1, body at
   * `nesting + 1`.
   */
  function scoreAlternate(alternate: TSESTree.Node, nesting: number): void {
    total += 1;
    if (alternate.type === 'IfStatement') {
      // `else if`: flat continuation. Body and test one deeper, ladder stays flat.
      score(alternate.test, nesting + 1, false);
      score(alternate.consequent, nesting + 1, false);
      if (alternate.alternate !== null) {
        scoreAlternate(alternate.alternate, nesting);
      }
    } else {
      // plain `else`: body one level deeper.
      score(alternate, nesting + 1, false);
    }
  }

  /**
   * Score a logical-operator chain with run collapse. `&&`/`||`/`??` add +1
   * (flat, no nesting) only when the operator differs from the parent operator in
   * the flattened binary chain. So `a && b && c` is a single run (+1) but
   * `a && b || c` changes operator once (+2). This is the curtain-collapse that
   * separates cognitive from cyclomatic.
   *
   * `parentOperator` is the operator of the enclosing LogicalExpression in the
   * chain, or `undefined` at the top of a chain. Non-short-circuit operators
   * (`&&=` etc. are not LogicalExpressions; only `&&`/`||`/`??` reach here) start
   * a run. Operands that are themselves expressions (calls, members) are walked
   * for any nested logical chains they contain.
   */
  function scoreLogical(
    node: TSESTree.LogicalExpression,
    nesting: number,
    parentOperator: TSESTree.LogicalExpression['operator'] | undefined,
  ): void {
    if (node.operator !== parentOperator) {
      total += 1;
    }
    scoreOperand(node.left, nesting, node.operator);
    scoreOperand(node.right, nesting, node.operator);
  }

  /**
   * Walk one operand of a logical chain. If the operand is itself a
   * LogicalExpression, continue the chain with the current operator as parent (so
   * a same-operator run collapses). Otherwise it is a leaf of the chain — walk it
   * generically for any independent logical sub-expressions (e.g. a ternary or a
   * parenthesized different-operator group resets the run via `undefined`).
   */
  function scoreOperand(
    operand: TSESTree.Node,
    nesting: number,
    chainOperator: TSESTree.LogicalExpression['operator'],
  ): void {
    if (operand.type === 'LogicalExpression') {
      scoreLogical(operand, nesting, chainOperator);
    } else {
      score(operand, nesting, false);
    }
  }

  /**
   * Generic child walk: recurse into every child node / node-array element at the
   * given nesting, mirroring cyclomatic-complexity's visitor-key-free enumeration
   * (skip `parent`, descend nodes and arrays of nodes). Bounded by the finite AST.
   */
  function scoreChildren(node: TSESTree.Node, nesting: number): void {
    for (const key of Object.keys(node)) {
      if (key === 'parent') {
        continue;
      }
      const value = (node as unknown as Record<string, unknown>)[key];
      if (isNode(value)) {
        score(value, nesting, false);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) {
            score(item, nesting, false);
          }
        }
      }
    }
  }

  score(fnNode, 0, true);
  return total;
}

export const cognitiveComplexity = createRule<Options, MessageIds>({
  name: 'cognitive-complexity',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Flag a function whose cognitive complexity exceeds the threshold (default 15, Sonar S3776). Lineage-INSPIRED (ADR 0008): Campbell's curtain-aware method, Sonar's number, NOT a safety standard.",
    },
    messages: {
      // The only message. It reports the score and limit, then states plainly
      // that this is Campbell's method and Sonar's number — not a safety
      // standard — at EVERY threshold. There is no lineage claim to protect here,
      // so (unlike cyclomatic) there is no second sub-lineage variant: the
      // not-a-safety-standard clause is fixed and always true (ADR 0005/0008).
      tooComplex:
        'Function has a cognitive complexity of {{complexity}}, over the limit of {{max}}. Cognitive complexity is Campbell\'s method (Sonar S3776, default 15), not a safety standard. mission-adjacent makes no safety claim about this score. Reduce nesting or split the function.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 1,
            description:
              "Maximum allowed cognitive complexity. Default 15, from Sonar S3776 — an invented threshold, not a safety-lineage number.",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ max: DEFAULT_THRESHOLD }],
  create(context, [options]) {
    const max = options.max ?? DEFAULT_THRESHOLD;

    /** Score one function node and report if it exceeds the threshold. */
    function check(node: TSESTree.Node): void {
      const complexity = cognitiveComplexityOf(node);
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
