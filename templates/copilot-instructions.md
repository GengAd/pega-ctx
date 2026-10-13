# [Pega application name]

Pega application [version]. The rules live in Pega, not here; this repository holds a readable mirror in `.pega/`.
Stack: see `.pega/stack.md`. The write ruleset depends on the class: `pega-ctx stack --for <Class>` says it.
The pega-story, pega-write and pega-morning skills walk through the steps below; the pega-explorer agent explores the mirror and returns a plan, keeping the digests out of this conversation.

## Before coding a user story

1. `pega-ctx sync` if the last sync is more than a day old (`pega-ctx check` says so); `pega-ctx changes` then says what changed in Pega, rule by rule.
2. `pega-ctx search <words of the story>` then `pega-ctx around <CaseType or Flow concerned> --stage <stage>`: that is the story's context; `pega-ctx model <Class>` gives the data model of the classes concerned (properties, inherited ones, data pages, views). Read nothing else before having a plan.
3. Before naming anything: `.pega/conventions.md`, how the neighbouring rules are named (language of names and labels, case, recurring words). `create` adds a `convention:` line when a name or a label departs from it: follow it, or tell the user why not.
4. Write the plan: rules reused as is, rules updated, rules created with their `--from` template and their ruleset (`pega-ctx stack --for <Class>`). Get it approved.

## To write

- `pega-ctx live <id>` before updating a rule. Never write from a digest more than a day old.
- A rule the application inherits (same name on a parent class or a lower layer): `pega-ctx rule <Name> --on <Class>` (or `<Type:Name>`) lists the versions the class reaches, closest first, each tagged with its application; `pega-ctx overrides` lists what the application already masks. Pega decides among them, not pega-ctx.
- `pega-ctx create <Type> <Class> <Name> --from <id> --patch <file.json> --draft` writes what will be sent to `.pega/drafts/<Type>/<Class>/<Name>.json` and returns its digest. Read the digest, give the user the draft's path so they can review it (the `.md` next to it is the readable digest, the `.json` is what to correct), correct the file if needed, then `pega-ctx send <id> --branch <branch>`: it sends the file as it is and deletes it. `pega-ctx update <id> --patch <file.json> --draft` likewise. `--dry-run` shows the digest without writing anything.
- Each of these commands ends with `lint:`, the content checked against the server's schema. An `error` line names the line of the draft and the field: fix it in the draft (or in the patch) and run `pega-ctx lint <id>` again; never `--no-lint` without the user's agreement. A `warning` is reported to the user.
- A function in an expression (`@Lib.Func(…)`): reuse first those of `.pega/functions.md`, the ones the application already calls, with their real calls; for a function not listed there, ask the user. `pega-ctx check` warns about a draft that calls another one.
- The patch holds only the difference; an array in the patch replaces the whole array, built from the template's digest. Do not read `.pega/raw/`: `pega-ctx rule <id> --raw` only for a field the digest does not show.
- A type the application has no rule of yet (first Notification, first REST connector…): `pega-ctx examples <Type>`, then `--from example:<name>`; read the example's notes it prints.
- New case type: its class first (`pega-ctx create Class <Class> <Class> --from <sibling class>`), Pega refuses any rule on a missing class. Then properties, views, flow actions, flows, and the CaseType last.
- A form view: `--fields Prop1,Prop2` builds its fields from the properties (created before); `Prop:required` makes a field required, `Prop:TextArea` a Text field multi-line. A name cited everywhere in the template (flow action in a flow, flow in a case type): `--rename Old=New`, not a patch.
- Report each `Pega warning` line returned by `create` or `update` to the user as is, even when the write succeeded.
- After a `send` on a case type, a flow, a flow action or a view: `pega-ctx run-case <CaseType>` (`--fields A=1,B=2` to fill and submit the first assignment), and `pega-ctx units --branch <branch>` if the branch has PegaUnit tests. Report Pega's refusal to the user as is; do not work around it.
- Never the Pega MCP read tools directly: they return the raw rule, `live` returns the same thing ten times smaller.
- A pega-ctx command that cannot reach Pega: `pega-ctx doctor`, and give the user the `problem` lines as they are.
- If `create` or `stack --for` answers that the write ruleset is unknown or ambiguous, ask the user which one before writing, then pass `--ruleset R:V`. Never pick one yourself.

## Project conventions

[What the mirror does not say: naming, what we do not do, the pitfalls. One line each.]
