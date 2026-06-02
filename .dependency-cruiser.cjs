/**
 * Dependency boundary enforcement for the mission-adjacent monorepo.
 *
 * The one rule that matters: the PUBLIC packages (eslint-plugin / eslint-config)
 * must never import from the PRIVATE `harness` package. If they did, consumers
 * who `npm i eslint-config-mission-adjacent` would get a dangling dependency on
 * a package that was never published. pnpm's resolution won't catch this — it's
 * a package.json authoring footgun — so we gate it here.
 *
 * Dogfoods the project's own thesis: push the check up the determinism ladder
 * (this is the 🟠 static-analysis tier), don't leave it to a human to remember.
 */
module.exports = {
  forbidden: [
    {
      name: 'public-no-import-private',
      severity: 'error',
      comment:
        'A published package imported from the private harness package. ' +
        'Consumers would get a broken dependency. Move the shared code into a public package.',
      from: {
        path: 'packages/eslint-(plugin|config)-mission-adjacent/src',
      },
      to: {
        path: 'packages/harness',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
