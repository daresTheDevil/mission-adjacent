/**
 * verify-exhibits — the prover.
 *
 * The pitch (TribalCon, README): "this looks fine, ships to prod, quietly hurts
 * someone — your linter says nothing, ours catches it." This harness is what
 * turns that claim into something you can RUN on stage instead of assert on a
 * slide.
 *
 * It lints each case TWICE through ESLint's `Linter`:
 *   1. `js.configs.recommended` — the baseline everyone already runs. Silent.
 *   2. the mission-adjacent `spine` — pure-AST, no type info. Fires.
 *
 * The contrast (recommended:0 / ours:N) IS the demo. The runner prints a table
 * and exits non-zero if any case fails to show the expected contrast, so it
 * doubles as a regression guard: the day the rule stops catching the money
 * function, CI goes red.
 *
 * Today it runs INLINE sample cases (below) so `verify:exhibits` is green now,
 * before any `docs/exhibits/*.ts` files exist. When those land, the runner will
 * glob them and read an expected-rule annotation from each (see runExhibitFiles,
 * stubbed out until the files exist).
 */
import { Linter } from 'eslint';
import js from '@eslint/js';
// The config package ships no .d.ts; a local ambient declaration
// (eslint-config-mission-adjacent.d.ts) types `spine` as Linter.Config[].
import { spine } from 'eslint-config-mission-adjacent';

/** One lin/contrast result for a single snippet. */
interface VerifyResult {
  /** How many messages `js.configs.recommended` emitted. The baseline. */
  recommendedCount: number;
  /** How many messages the mission-adjacent spine emitted. */
  oursCount: number;
  /** The rule IDs the spine fired (deduped, in first-seen order). */
  oursRules: string[];
}

/**
 * Lint `code` twice — once with the recommended baseline, once with the
 * mission-adjacent spine — and report the contrast. Pure: no I/O, no exit.
 *
 * @param code the source snippet to lint
 * @returns the message counts from each config and the rule IDs the spine fired
 */
export function verifyExhibit(code: string): VerifyResult {
  const linter = new Linter();
  const recommended = linter.verify(code, [
    js.configs.recommended as Linter.Config,
  ]);
  const ours = linter.verify(code, spine);

  const oursRules: string[] = [];
  for (const message of ours) {
    if (message.ruleId !== null && !oursRules.includes(message.ruleId)) {
      oursRules.push(message.ruleId);
    }
  }

  return {
    recommendedCount: recommended.length,
    oursCount: ours.length,
    oursRules,
  };
}

/** A single inline contrast case the harness can prove without any files. */
interface ExhibitCase {
  /** Human label for the table. */
  name: string;
  /** The snippet to lint. Must pass `js.configs.recommended` clean (recommended:0). */
  code: string;
  /**
   * The rule the spine is expected to fire. `null` means "expect silence from
   * both configs" — the control case that proves the spine isn't trigger-happy.
   */
  expect: string | null;
}

/**
 * Inline samples. These ship in the harness so the contrast is provable TODAY,
 * before the runnable `docs/exhibits/*.ts` files exist. They are deliberately
 * minimal — the real, story-backed exhibits land in a later pass and plug into
 * this same runner.
 *
 * Every `code` here MUST lint clean under `js.configs.recommended` (no unused
 * vars, no undef) or the contrast is a lie.
 */
const INLINE_CASES: ExhibitCase[] = [
  {
    // Money path, zero precondition asserts. Ships fine, rounds real dollars,
    // trusts every input. The spine's flagship rule fires; recommended is mute.
    name: 'payout calc, no asserts',
    code: [
      'export function applyPayout(bet, multiplier) {',
      '  const gross = bet * multiplier;',
      '  const net = gross - gross * 0.05;',
      '  return Math.round(net);',
      '}',
      '',
    ].join('\n'),
    expect: 'mission-adjacent/require-assertion-density',
  },
  {
    // Control: a trivial pure accessor. No money, no boundary, nothing to assert.
    // Both configs stay silent — proves the spine isn't just flagging everything.
    name: 'trivial accessor (control)',
    code: ['export function identity(x) {', '  return x;', '}', ''].join('\n'),
    expect: null,
  },
  {
    // Bounded loop, real slot-occupancy shape: iterate a FIXED property list
    // (for-of over a small array), bounded by construction. The two guard
    // asserts satisfy the assertion-density rule, so this CONTROL isolates the
    // loop: the spine stays SILENT, proving the SPEC promise that we never flag
    // a loop whose bound we can't prove — only the ones provably infinite by
    // syntax. This is the grain-ladder finding made deterministic: a real
    // bounded loop is a green non-event, not a hand-written reviewer note.
    name: 'bounded for-of over fixed list (control)',
    code: [
      '/* global assert */',
      'export function sumSelected(row, props) {',
      '  assert(row !== null);',
      '  assert(Array.isArray(props));',
      '  let total = 0;',
      '  for (const prop of props) {',
      '    total += Number(row[prop]);',
      '  }',
      '  return total;',
      '}',
      '',
    ].join('\n'),
    expect: null,
  },
  {
    // Unbounded loop: a poll loop with no break/return/throw. Ships fine, hangs
    // forever the day the exit condition is forgotten. recommended is mute (its
    // no-constant-condition exempts while(true) by default); the spine fires
    // bounded-loops. The two asserts keep assertion-density out of the way so
    // the contrast isolates exactly bounded-loops.
    name: 'while(true) poll, no escape',
    code: [
      '/* global assert, handle */',
      'export function drain(queue) {',
      '  assert(queue !== null);',
      '  assert(typeof queue.pop === "function");',
      '  while (true) {',
      '    const job = queue.pop();',
      '    handle(job);',
      '  }',
      '}',
      '',
    ].join('\n'),
    expect: 'mission-adjacent/bounded-loops',
  },
  {
    // Unbounded recursion: a tree walk with no base-case guard before it calls
    // itself. Blows the stack on any real input. recommended is mute; the spine
    // fires no-unbounded-recursion. (assertion-density also fires here — a
    // recursive walker with no asserts has both problems — so this case asserts
    // on the rule list containing no-unbounded-recursion, not on exclusivity.)
    name: 'tree walk, no base case',
    code: [
      '/* global assert */',
      'export function walk(node) {',
      '  assert(node !== null);',
      '  const left = walk(node.left);',
      '  const right = walk(node.right);',
      '  return left + right;',
      '}',
      '',
    ].join('\n'),
    expect: 'mission-adjacent/no-unbounded-recursion',
  },
];

/** A row in the printed results table, post-evaluation. */
interface EvaluatedCase extends ExhibitCase {
  result: VerifyResult;
  pass: boolean;
}

/**
 * Decide whether a case showed the contrast it claimed.
 *
 * Pass conditions:
 *   - recommended MUST be silent (recommendedCount === 0). If the baseline
 *     already complains, the snippet isn't a fair "looks fine to your linter"
 *     example and the whole pitch breaks.
 *   - if `expect` names a rule: the spine fired it.
 *   - if `expect` is null: the spine stayed silent too.
 */
function evaluate(testCase: ExhibitCase): EvaluatedCase {
  const result = verifyExhibit(testCase.code);
  const recommendedSilent = result.recommendedCount === 0;
  const oursMatches =
    testCase.expect === null
      ? result.oursCount === 0
      : result.oursRules.includes(testCase.expect);
  return { ...testCase, result, pass: recommendedSilent && oursMatches };
}

/** Render the results as an aligned table and return the lines. */
function renderTable(rows: EvaluatedCase[]): string[] {
  const header = ['case', 'recommended', 'ours', 'fired', 'result'];
  const body = rows.map((row) => [
    row.name,
    String(row.result.recommendedCount),
    String(row.result.oursCount),
    row.result.oursRules.join(', ') || '-',
    row.pass ? 'PASS' : 'FAIL',
  ]);

  const widths = header.map((head, col) =>
    Math.max(head.length, ...body.map((cells) => cells[col]!.length)),
  );
  const fmt = (cells: string[]): string =>
    cells.map((cell, col) => cell.padEnd(widths[col]!)).join('  ');

  return [fmt(header), fmt(header.map((_, col) => '-'.repeat(widths[col]!))), ...body.map(fmt)];
}

/** Run the inline sample cases, print the table, exit non-zero on any failure. */
function main(): void {
  const rows = INLINE_CASES.map(evaluate);
  for (const line of renderTable(rows)) {
    console.log(line);
  }

  const failures = rows.filter((row) => !row.pass);
  if (failures.length > 0) {
    console.error(`\n${failures.length} case(s) failed the contrast.`);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} case(s) proved the contrast.`);
}

main();
