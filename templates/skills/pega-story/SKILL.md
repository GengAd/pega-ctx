---
name: pega-story
description: Gathers the context of a user story or change on the Pega application with pega-ctx, then writes a plan to approve before any write. Use when starting a story, a bug fix or any change to Pega rules.
---

# A user story on [Pega application name]

1. `pega-ctx check`: if the last sync is more than a day old, `pega-ctx sync` first.
2. `pega-ctx search <words of the story>`: the rules it names. Add `--type <Type>` or `--app <Application>` to narrow.
3. `pega-ctx around <CaseType or Flow concerned> --stage <stage>`: the story's context, closest rules first. Delegate this exploration to the pega-explorer agent when it is available: its digests stay out of the main context.
4. A rule the class inherits: `pega-ctx rule <Name> --on <Class>`. What the application already overrides: `pega-ctx overrides`.
5. Read nothing else (no `.pega/raw/`, no Pega MCP read tool) before having a plan.
6. Before naming a new rule: `.pega/conventions.md` (language of names and labels, case, recurring words of the neighbouring rules).
7. Write the plan:
   - rules reused as they are;
   - rules updated, and what changes;
   - rules created, each with its `--from` template and its ruleset (`pega-ctx stack --for <Class>`);
   - for a new case type: the class first, then properties, views, flow actions, flows, the CaseType last.
8. Give the plan to the user and wait for their approval. A write ruleset that `stack --for` says is unknown or ambiguous is a question for the user, never a guess.

Then the pega-write skill.
