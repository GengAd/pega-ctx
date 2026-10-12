# [Pega application name]

Pega application [version]. The rules live in Pega, not here; this repository holds a readable mirror in `.pega/`.
Stack: see `.pega/stack.md`. The write ruleset depends on the class: `pega-ctx stack --for <Class>` says it.

## Before coding a user story

1. `pega-ctx sync` if the last sync is more than a day old (`pega-ctx check` says so).
2. `pega-ctx search <words of the story>` then `pega-ctx around <CaseType or Flow concerned> --stage <stage>`: that is the story's context. Read nothing else before having a plan.
3. Write the plan: rules reused as is, rules updated, rules created with their `--from` template and their ruleset (`pega-ctx stack --for <Class>`). Get it approved.

## To write

- `pega-ctx live <id>` before updating a rule. Never write from a digest more than a day old.
- `pega-ctx create <Type> <Class> <Name> --from <id> --patch <file.json> --draft` writes what will be sent to `.pega/drafts/<Type>/<Class>/<Name>.json` and returns its digest. Read the digest, give the user the draft's path so they can review it, correct the file if needed, then `pega-ctx send <id> --branch <branch>`: it sends the file as it is and deletes it. `pega-ctx update <id> --patch <file.json> --draft` likewise. `--dry-run` shows the digest without writing anything.
- Each of these commands ends with `lint:`, the content checked against the server's schema. An `error` line names the line of the draft and the field: fix it in the draft (or in the patch) and run `pega-ctx lint <id>` again; never `--no-lint` without the user's agreement. A `warning` is reported to the user.
- The patch holds only the difference; an array in the patch replaces the whole array, built from the template's digest. Do not read `.pega/raw/`: `pega-ctx rule <id> --raw` only for a field the digest does not show.
- A type the application has no rule of yet (first Notification, first REST connector…): `pega-ctx examples <Type>`, then `--from example:<name>`; read the example's notes it prints.
- New case type: its class first (`pega-ctx create Class <Class> <Class> --from <sibling class>`), Pega refuses any rule on a missing class. Then properties, views, flow actions, flows, and the CaseType last.
- A form view: `--fields Prop1,Prop2` builds its fields from the properties (created before). A name cited everywhere in the template (flow action in a flow, flow in a case type): `--rename Old=New`, not a patch.
- Report each `Pega warning` line returned by `create` or `update` to the user as is, even when the write succeeded.
- Never the Pega MCP read tools directly: they return the raw rule, `live` returns the same thing ten times smaller.
- If `create` or `stack --for` answers that the write ruleset is unknown or ambiguous, ask the user which one before writing, then pass `--ruleset R:V`. Never pick one yourself.

## Project conventions

[What the mirror does not say: naming, what we do not do, the pitfalls. One line each.]
