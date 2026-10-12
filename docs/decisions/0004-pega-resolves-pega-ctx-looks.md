# 4. Pega resolves, pega-ctx looks

## Context

A reference in a rule (a FlowAction's view, a field's property) is resolved in Pega through directed and pattern inheritance, circumstancing, the ruleset stack and branches. Redoing that engine in the mirror would be wrong at the margins and expensive to maintain.

## Decision

The mirror does not resolve rules. A reference carries the class of its context; the graph matches it to an index rule of the same type and name, in the same class or the closest parent class **by name** (`@baseclass` last), a data page by its name alone. Without a match, it stays as is and `check` reports it. When the truth is needed, `live` reads the rule again in Pega.

## Consequences

- `stack --for <Class>` shows inheritance by name among the mirror's classes, and says that the engine decides.
- `stack()` only reads the first level of the stack and does not say which ruleset is unlocked: the `write` table is set by hand, from a draft (`docs/decisions/0006-write-ruleset-per-class.md`).
- `live` is mandatory before any write (instruction in `templates/CLAUDE.md`), and `update` does it by itself.
