/**
 * bounded-loops
 *
 * Lineage: Power of 10 rule #2 ("all loops must have a fixed upper bound"),
 * DO-178C WCET analysis. The safety argument: a loop with no provable upper
 * bound has unbounded worst-case execution time and defeats coverage analysis —
 * a runaway loop is a hang, and a hang in a control system is a failure.
 *
 * This is one of the two proof-spine rules (with no-unbounded-recursion). It is
 * NOT a peer of no-eval.
 *
 * Determinism tier: 🟢 lint, but ONLY for the obvious cases — and the SPEC is
 * explicit about why (Part 4): "Proving a real loop bound needs data-flow
 * analysis ESLint does not have." So this rule does NOT, and CANNOT soundly,
 * verify that an arbitrary `for`/`while` terminates. It flags exactly the shape
 * that is syntactically, unarguably unbounded:
 *
 *   - `while (true) { ... }` with no `break` / `return` / `throw` anywhere in
 *     the loop body — an infinite loop with no escape.
 *   - `for (;;) { ... }` (empty test) with no `break` / `return` / `throw`.
 *
 * That is the entire deterministic surface. A normal `for (const x of xs)` or
 * `for (let i = 0; i < n; i++)` is bounded by construction and is NEVER flagged
 * — proving its bound is the LLM tier's residue (dk:harden), not this rule's
 * job. This rule is an honest PROXY (SPEC Part 0): it catches the loops that are
 * provably unbounded by their own syntax, and stays silent on everything whose
 * bound it cannot decide. It never claims to prove termination.
 *
 * The escape can be conditional — `while (true) { if (done) break; }` is a
 * legitimate, bounded event loop and is allowed. The rule only fires when NO
 * escape statement exists in the body at all, which is the genuinely-infinite
 * shape.
 *
 * NOT certified for safety-critical use. See README.
 */
import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/types';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/daresTheDevil/mission-adjacent/blob/main/packages/eslint-plugin-mission-adjacent/docs/${name}.md`,
);

export type Options = [Record<string, never>];

export type MessageIds = 'unboundedLoop';

/**
 * Is this `while` test the literal `true`? `while (true)` / `while (1)` are the
 * canonical infinite-loop spellings. We match the boolean literal and the
 * numeric-1 literal; a variable that happens to be true is out of scope (its
 * value is a data-flow fact, not a syntactic one).
 */
function isAlwaysTrueTest(test: TSESTree.Expression): boolean {
  if (test.type === 'Literal') {
    return test.value === true || test.value === 1;
  }
  return false;
}

/**
 * Does this statement subtree contain a loop-exiting statement — `break`,
 * `return`, or `throw`? A single bounded walk of the body; it descends through
 * nested blocks/ifs (an escape can be guarded) but stops at nested loops and
 * nested functions, whose `break`/`return` belong to THEM, not to this loop.
 *
 * Bounded: the AST is finite and acyclic, each node visited at most once, no
 * loop bodies or function bodies re-entered. Iterative worklist, no recursion.
 */
function hasEscape(body: TSESTree.Statement): boolean {
  const stack: TSESTree.Node[] = [body];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      break;
    }
    switch (node.type) {
      // A labeled break could target an outer loop, but an unlabeled break (the
      // overwhelmingly common case) exits THIS loop. Either way, an escape from
      // the infinite loop exists, so treat any break as an escape.
      case 'BreakStatement':
      case 'ReturnStatement':
      case 'ThrowStatement':
        return true;
      // Do not descend into a nested loop: its break/return is its own escape,
      // not ours. The nested loop is independently checked by this same rule.
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'ForStatement':
      case 'ForOfStatement':
      case 'ForInStatement':
        continue;
      // Do not descend into a nested function: its return is its own.
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        continue;
      default:
        break;
    }
    // Push child statements/expressions that can contain an escape. We only need
    // the control-flow-bearing containers; expressions cannot hold break/return.
    if (node.type === 'BlockStatement') {
      stack.push(...node.body);
    } else if (node.type === 'IfStatement') {
      stack.push(node.consequent);
      if (node.alternate !== null) {
        stack.push(node.alternate);
      }
    } else if (node.type === 'SwitchStatement') {
      for (const switchCase of node.cases) {
        stack.push(...switchCase.consequent);
      }
    } else if (node.type === 'TryStatement') {
      stack.push(node.block);
      if (node.handler !== null) {
        stack.push(node.handler.body);
      }
      if (node.finalizer !== null) {
        stack.push(node.finalizer);
      }
    } else if (node.type === 'LabeledStatement') {
      stack.push(node.body);
    }
  }
  return false;
}

export const boundedLoops = createRule<Options, MessageIds>({
  name: 'bounded-loops',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Flag a syntactically infinite loop (while(true) / for(;;)) that has no break, return, or throw escape (Power of 10 rule #2, obvious-cases proxy).',
    },
    messages: {
      unboundedLoop:
        'This loop is syntactically infinite ({{kind}}) and has no break/return/throw escape in its body. An unbounded loop has unprovable worst-case execution time. Add an escape, or if the non-termination is intentional document it and disable this rule on the line.',
    },
    schema: [],
  },
  defaultOptions: [{}],
  create(context) {
    /** Report `node` as an unbounded loop of the given syntactic kind. */
    function report(node: TSESTree.Node, kind: string): void {
      context.report({ node, messageId: 'unboundedLoop', data: { kind } });
    }

    return {
      // `while (true) { ... }` with no escape.
      WhileStatement(node): void {
        if (isAlwaysTrueTest(node.test) && !hasEscape(node.body)) {
          report(node, 'while (true)');
        }
      },
      // `for (;;) { ... }` — an absent test means always-true — with no escape.
      ForStatement(node): void {
        if (node.test === null && !hasEscape(node.body)) {
          report(node, 'for (;;)');
        }
      },
    };
  },
});
