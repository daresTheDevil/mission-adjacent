/**
 * no-unbounded-recursion
 *
 * Lineage: Power of 10 rule #1 (restrict to simple control flow — no recursion),
 * JSF++ AV-119, AUTOSAR A7-5-2. The safety argument: recursion consumes stack
 * the analyzer cannot bound, so worst-case stack depth — and therefore WCET — is
 * unprovable. C-family safety standards ban recursion outright. We are not C: a
 * recursion with a clear, decrementing base case is fine and idiomatic in TS. So
 * this rule does NOT ban recursion. It flags the *unbounded* shape: a function
 * that re-enters itself with no visible guard that can stop it.
 *
 * This is one of the two proof-spine rules (with bounded-loops). It is NOT a peer
 * of no-eval — it exists so the layers below the LLM can reason about termination.
 *
 * Determinism tier: 🟢 lint (pure AST, no type information). What is deterministic
 * here is "does this function re-enter itself with no guard syntactically present
 * before the recursive call?" Whether a guard *actually* bounds the recursion is
 * the irreducible residue that goes to the LLM tier (dk:harden). This rule is an
 * honest PROXY (SPEC Part 0): it never claims to prove termination, only to flag
 * the syntactic shape that most often hides non-termination.
 *
 * What it flags (deterministic):
 *   A named function whose body contains a call to its own name, where NO
 *   `if`/`return`/`throw`/conditional guard appears before that self-call in the
 *   function body. "Guard before the call" is the syntactic marker of a base
 *   case. Its absence is the unbounded shape.
 *
 * What it deliberately does NOT do:
 *   - Prove the guard actually terminates the recursion (undecidable; LLM tier).
 *   - Detect indirect / mutual recursion across files (needs a call graph the
 *     parser does not build). Same-scope mutual recursion (two locals calling
 *     each other) is also out of scope — kept honest and syntactic.
 *   - Flag anonymous recursion via arguments.callee (deprecated, rare).
 *
 * NOT certified for safety-critical use. See README.
 */
import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/types';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/daresTheDevil/mission-adjacent/blob/main/packages/eslint-plugin-mission-adjacent/docs/${name}.md`,
);

export type Options = [
  {
    /**
     * Statement kinds that count as a base-case guard when they appear before
     * the self-call. Defaults cover the house guard-clause style: an `if`, an
     * early `return`, or a `throw` short-circuits a recursion path.
     */
    countReturnAsGuard?: boolean;
  },
];

export type MessageIds = 'unboundedRecursion';

const DEFAULT_OPTIONS: Options[0] = {
  countReturnAsGuard: true,
};

/** A function node that can be named and recursive. */
type NamedFunction =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

/**
 * Resolve a call's callee to a plain identifier name, or null if it is a member
 * call / computed access. Bounded: one level, never recurses into arguments.
 * Self-recursion is `foo(...)`, not `this.foo(...)` — a method calling itself
 * through `this` is a different shape we do not claim to catch.
 */
function calleeIdentifier(callee: TSESTree.Node): string | null {
  return callee.type === 'Identifier' ? callee.name : null;
}

/**
 * Walk a function body's TOP-LEVEL statements in order. Return true the moment a
 * guard statement is seen; return false if a self-call is reached first. This is
 * deliberately shallow — it inspects the function's own statement list and the
 * shallow expression positions a self-call commonly hides in (return argument,
 * variable initializer, expression statement). It does NOT descend into nested
 * functions (they own their own recursion budget) and does NOT chase the call
 * into deeply nested branches — depth there is exactly the residue the LLM owns.
 *
 * Bounded: single forward pass over a finite statement list, constant work per
 * statement. No recursion, no unbounded loop.
 */
function selfCallIsUnguarded(
  body: TSESTree.Statement[],
  ownName: string,
  countReturnAsGuard: boolean,
): boolean {
  for (const statement of body) {
    // A guard seen before any self-call means there is a syntactic base case.
    if (statement.type === 'IfStatement') {
      return false;
    }
    if (statement.type === 'ThrowStatement') {
      return false;
    }
    if (statement.type === 'ReturnStatement') {
      // A `return foo(...)` IS the recursive call (tail recursion) — unguarded
      // here, regardless of the countReturnAsGuard option. That option only
      // governs whether a NON-self-call return counts as a base-case guard.
      const isSelfReturn =
        statement.argument !== null &&
        statement.argument.type === 'CallExpression' &&
        calleeIdentifier(statement.argument.callee) === ownName;
      if (isSelfReturn) {
        return true;
      }
      // A bare `return;` or `return <non-self-call>` is a base case only when
      // the option treats returns as guards. With the option off, a return is
      // not a guard, so keep scanning for a later self-call.
      if (countReturnAsGuard) {
        return false;
      }
    }
    // An expression-statement self-call: `foo(...)` on its own line.
    if (
      statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'CallExpression' &&
      calleeIdentifier(statement.expression.callee) === ownName
    ) {
      return true;
    }
    // A variable initialized from the self-call: `const x = foo(...)`.
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (
          declarator.init?.type === 'CallExpression' &&
          calleeIdentifier(declarator.init.callee) === ownName
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export const noUnboundedRecursion = createRule<Options, MessageIds>({
  name: 'no-unbounded-recursion',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Flag a named function that re-enters itself with no base-case guard before the recursive call (Power of 10 rule #1, as an honest syntactic proxy).',
    },
    messages: {
      unboundedRecursion:
        "Function '{{name}}' calls itself with no guard (if/return/throw) before the recursive call. A recursion with no visible base case has unprovable stack depth. Add a guard, or document the bound and disable this rule on the line.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          countReturnAsGuard: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [DEFAULT_OPTIONS],
  create(context, [options]) {
    const countReturnAsGuard =
      options.countReturnAsGuard ?? DEFAULT_OPTIONS.countReturnAsGuard!;

    function check(node: NamedFunction): void {
      // Needs a name to recurse by name, and a block body to inspect.
      const name = node.id?.name;
      if (name === undefined || node.body.type !== 'BlockStatement') {
        return;
      }
      if (selfCallIsUnguarded(node.body.body, name, countReturnAsGuard)) {
        context.report({
          node: node.id ?? node,
          messageId: 'unboundedRecursion',
          data: { name },
        });
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },
});
