---
name: pega-write
description: Creates or updates Pega rules through pega-ctx drafts, checked before they are sent, then checks that the result runs. Use once a plan is approved, for each rule to create or update.
---

# Writing a Pega rule

For each rule of the approved plan, in the plan's order:

1. **Update**: `pega-ctx live <id>` first, the rule as Pega has it now. Then `pega-ctx update <id> --patch <file.json> --draft`.
   **Create**: `pega-ctx create <Type> <Class> <Name> --from <id> --draft`, with `--patch <file.json>` for what differs from the template, `--rename Old=New` for a name cited throughout it, `--fields Prop1,Prop2` for the fields of a form view. A type the application has no rule of yet: `pega-ctx examples <Type>`, then `--from example:<name>`.
2. A function in an expression: one of `.pega/functions.md` first, as the application already calls it; for another one, ask the user. The patch holds only the difference. An array in the patch replaces the whole array: build it from the template's digest.
3. A `convention:` line says the name or the label departs from how the neighbouring rules are named: rename, or tell the user why not. Read the `lint:` lines the command ends with. An `error` names the line of the draft and the field: correct the draft (`.pega/drafts/<Type>/<Class>/<Name>.json`), then `pega-ctx lint <id>`. Never `--no-lint` without the user's agreement.
4. Give the user the draft's path; the `.md` next to it is the readable digest. Wait for their go.
5. `pega-ctx send <id> --branch <branch>`: it sends the file as it is. Report every `Pega warning` line as it is, even on success.
6. A type the Pega MCP cannot write: the draft's `steps` say what a developer does in Dev Studio; give the user the path and the steps, then `pega-ctx live <id>` once they are done.
7. After the case type, flow, flow action or view of the story: `pega-ctx run-case <CaseType>` (`--fields A=1,B=2` to fill and submit the first assignment), and `pega-ctx units --branch <branch>` if the branch has PegaUnit tests. A refusal from Pega goes to the user as it is.

A command that cannot reach Pega: `pega-ctx doctor`, and give the user its `problem` lines.
