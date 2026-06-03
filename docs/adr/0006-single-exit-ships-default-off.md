# 0006. Single-entry/single-exit ships default-off

Date: 2026-06-03
Status: accepted
Source: harness merge session (conflict resolution)
Enforceability: static-lint

## Context

The safety-critical lineage favors single-exit: one return per function (JSF AV-113, ISO 26262, EN 50128, AUTOSAR). It directly fights my own house style in `how-i-code.md`: "early returns and guard clauses, happy path stays flat."

The conflict is real but the lineage rule is a C-era artifact. Single-exit existed because C had no RAII and no `finally`: a mid-function return could skip manual cleanup (free, unlock, close). In TS, with GC and `finally`, that justification evaporates. Enforcing single-exit in TS is mostly cargo-cult: importing a C constraint whose reason doesn't exist in the target language.

## Decision

Ship the rule in the plugin but DEFAULT-OFF, documented as "C-heritage, conflicts with guard-clause style, enable only with a specific reason." House style, which I already reasoned through, wins over lineage authority when the lineage's justification doesn't carry to TS.

## Alternatives

- **Default-on to match the lineage** rejected. It fights guard clauses, the happy-path-flat style is deliberate, and the C-era reason (manual cleanup) doesn't exist in TS. On-by-default would generate noise against my own preferred style.
- **Don't ship it at all** rejected. Someone porting C or working under a real single-exit mandate might want it. Shipping it off costs nothing and keeps the option; deleting it removes a legitimate (if rare) use.

## Consequences

- The plugin includes a rule it recommends *against* turning on. That's fine and honest: it's documented as lineage-complete-but-off, with the reason stated. Completeness of the lineage doesn't mean everything is on by default.
- This is the one place house style explicitly overrides the safety lineage. Worth remembering as the precedent: lineage authority is an input, not a trump card. When a C-era rule's justification doesn't survive translation to TS, the rule goes off.
