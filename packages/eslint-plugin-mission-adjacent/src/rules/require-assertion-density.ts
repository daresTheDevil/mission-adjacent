/**
 * require-assertion-density
 *
 * Lineage: Power of 10 rule #5 — "use a minimum of two runtime assertions per
 * function." Holzmann's argument: assertions are executable pre/postconditions;
 * a function with none gives a property-tester nothing to attack and hides its
 * own contract. This is one of the two proof-spine rules (the other is bounded
 * control flow) — it is NOT a peer of no-eval. It exists so the deterministic
 * tiers below the LLM have a contract to check.
 *
 * Determinism tier: 🟢 lint (pure AST, no type information). The COUNT is
 * deterministic. Whether the assertions are *meaningful* is the irreducible
 * residue that goes to the LLM tier (dk:harden) — this rule never claims to
 * judge meaning, only presence.
 *
 * What counts as an assertion (deterministic, configurable — the decision is
 * pushed to config, not to a human/LLM per-call):
 *   1. A call to a name in `assertionNames` (e.g. `assert`, `assert.ok`,
 *      `assertNever`, `invariant`). Member calls match on the FULL dotted path.
 *   2. A guard clause that throws: `if (cond) throw ...`. This is the form the
 *      house style (guard clauses, early return) actually uses for
 *      preconditions, so the rule is fair to idiomatic TS, not just C-style
 *      assert() calls.
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
    /** Minimum assertions a subject function must contain. Default 2 (P10 #5). */
    minAssertions?: number;
    /**
     * Functions whose block body has fewer than this many statements are
     * exempt — a 2-line helper has no contract worth asserting. Default 3.
     */
    minStatements?: number;
    /**
     * Callee names that count as assertions. Member expressions are matched on
     * their full dotted path (`assert.ok` matches `assert.ok(...)`).
     */
    assertionNames?: string[];
    /** Count `if (cond) throw ...` guard clauses as assertions. Default true. */
    countThrowGuards?: boolean;
  },
];

export type MessageIds = 'tooFewAssertions';

const DEFAULT_OPTIONS: Options[0] = {
  minAssertions: 2,
  minStatements: 3,
  assertionNames: ['assert', 'assert.ok', 'assertNever', 'invariant'],
  countThrowGuards: true,
};

/** AST node kinds that have a body we count assertions within. */
type SubjectFunction =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

/**
 * Resolve a call's callee to a dotted name path, or null if it isn't a plain
 * identifier / member chain (e.g. a computed access or an IIFE). Bounded: walks
 * a static member chain, never recurses into arguments.
 */
function calleeName(callee: TSESTree.Node): string | null {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (callee.type === 'MemberExpression' && !callee.computed) {
    const object = calleeName(callee.object);
    if (object === null || callee.property.type !== 'Identifier') {
      return null;
    }
    return `${object}.${callee.property.name}`;
  }
  return null;
}

/** Is this statement a guard clause that throws — `if (cond) throw ...`? */
function isThrowGuard(statement: TSESTree.Statement): boolean {
  if (statement.type !== 'IfStatement') {
    return false;
  }
  const { consequent } = statement;
  if (consequent.type === 'ThrowStatement') {
    return true;
  }
  // `if (cond) { throw ... }` — a single-statement block that throws.
  return (
    consequent.type === 'BlockStatement' &&
    consequent.body.length === 1 &&
    consequent.body[0]?.type === 'ThrowStatement'
  );
}

export const requireAssertionDensity = createRule<Options, MessageIds>({
  name: 'require-assertion-density',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require a minimum number of runtime assertions per non-trivial function (Power of 10 rule #5).',
    },
    messages: {
      tooFewAssertions:
        'Function has {{found}} assertion(s); requires at least {{required}}. Assertions are executable pre/postconditions — without them this function has no checkable contract.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          minAssertions: { type: 'integer', minimum: 0 },
          minStatements: { type: 'integer', minimum: 0 },
          assertionNames: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
          },
          countThrowGuards: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [DEFAULT_OPTIONS],
  create(context, [options]) {
    const minAssertions = options.minAssertions ?? DEFAULT_OPTIONS.minAssertions!;
    const minStatements = options.minStatements ?? DEFAULT_OPTIONS.minStatements!;
    const countThrowGuards =
      options.countThrowGuards ?? DEFAULT_OPTIONS.countThrowGuards!;
    const assertionNames = new Set(
      options.assertionNames ?? DEFAULT_OPTIONS.assertionNames!,
    );

    /**
     * Count assertions in a function's own block body. Direct children only —
     * a nested function owns its own assertion budget and is checked separately
     * when the visitor reaches it. This keeps the count bounded and stops a
     * helper's asserts from being credited to its parent.
     */
    function countAssertions(body: TSESTree.Statement[]): number {
      let count = 0;
      for (const statement of body) {
        // assert-call: an ExpressionStatement wrapping a matching CallExpression.
        if (
          statement.type === 'ExpressionStatement' &&
          statement.expression.type === 'CallExpression'
        ) {
          const name = calleeName(statement.expression.callee);
          if (name !== null && assertionNames.has(name)) {
            count += 1;
            continue;
          }
        }
        // throw-guard: `if (cond) throw ...`.
        if (countThrowGuards && isThrowGuard(statement)) {
          count += 1;
        }
      }
      return count;
    }

    function check(node: SubjectFunction): void {
      // Only block-bodied functions have a statement list to inspect. An
      // expression-bodied arrow (`x => x + 1`) has no contract surface — exempt.
      if (node.body.type !== 'BlockStatement') {
        return;
      }
      const statements = node.body.body;
      if (statements.length < minStatements) {
        return;
      }
      const found = countAssertions(statements);
      if (found < minAssertions) {
        context.report({
          node,
          messageId: 'tooFewAssertions',
          data: { found, required: minAssertions },
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
