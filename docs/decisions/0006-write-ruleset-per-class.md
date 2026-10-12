# 6. The write ruleset depends on the class

## Context

The first version had one write ruleset per project, and the installed instructions said "never a rule in another ruleset". A real project is a layercake: several applications, five to ten rulesets each, a logical structure (framework, implementation, integration). One value is wrong as soon as a user story touches two layers. The server does not help: `get-application` only reads the first level of the stack and does not say which ruleset is unlocked. Without a `ruleSet` parameter, `create-rule` takes the ruleset associated with the class, but that association is not readable through the MCP. On the other hand, after a `sync` from the top application, the index holds the real class → ruleset map: each line carries its `ruleset:version`, built-on rules included.

## Decision

The write ruleset is resolved per class, in this order: `--ruleset`; the `write` table of `.pega/config.json` (ordered class prefixes, first match wins, plus an optional default); the rulesets of the class's own rules in the mirror. No candidate, or several rulesets for the same class: `create` refuses with code 1 and lists the candidates. pega-ctx has no model in the loop, so refusing is how it asks; the installed instructions tell the model to ask the user before writing.

`sync` writes a draft of the table from the index (`.pega/write.draft.json`). It is never applied by itself: a human, or the model with them, reviews and copies it.

## Consequences

- A new class (a new case type) has no sibling rule: without a table entry, `create` refuses. The table, or `--ruleset`, is then mandatory, which is the point: a new class is exactly where a wrong guess costs most.
- `stack --for <Class>` answers "where do I write for this class", with the source of the answer; `stack.md` lists the rulesets seen in the mirror, current application and built-on ones.
- The draft's heuristic (most general pure prefix, two name segments at least) is a starting point, not a rule: the mirror only sees the classes that already have rules.
- The `[Name:Version]` bracket of the templates disappears; `install` no longer fills a ruleset.
