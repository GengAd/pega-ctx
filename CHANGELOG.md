# Changelog

One line per delivered step. Versions follow [semver](https://semver.org); `0.1.0` will be the first complete kit (instructions, skills and hooks installed by `pega-ctx install`, measured with Claude and Copilot).

## Unreleased

- License: AGPL-3.0-only, copyright GengAd (`LICENSE`, `package.json`, README § License).
- `create View --fields`: `Prop:required` (both surfaces of the view) and `Prop:TextArea` (multi-line Text; automatic for a `pxTextArea` control).
- `pega-ctx changes`: what the last sync changed, dated rule by rule with the digest lines that changed, or the rules updated since a date; `check` flags an update draft whose rule changed since. (step 28)
- `pega-ctx model <Class>`: the data model of a class in one page, inherited properties, embedded classes, data pages and views; the explorer agent may run it. (step 26)
- `.pega/conventions.md`, written by `sync`: how the application names its rules, per class prefix; `create` adds a `convention:` line when a name or a label departs from it, or a class has no `--label`. (step 25)
- `.pega/functions.md`, written by `sync`: the functions the application's rules call, with real calls; `check` warns about a draft calling another one. (step 24)
- The agent kit: `install` writes the skills `pega-story`, `pega-write`, `pega-morning`, the read-only `pega-explorer` agent, a rule for drafts and, for Claude Code, hooks that refuse the Pega MCP read tools and `.pega/raw/`. (step 18)
- `pega-ctx doctor`: what pega-ctx needs, checked point by point, each problem with what to do; `init` lists the same problems when it cannot reach Pega. Paths shown with `/` on every system. (step 30)
- `sync` at scale: `--jobs` (4 calls at a time by default), resume after an interruption, `--type`, `--application`, progress on stderr. (step 29)
- `pega-ctx run-case` and `pega-ctx units`: create a case and show its first assignment, fill and submit it; run a branch's PegaUnit tests. (step 27)
- Follow applications rather than rulesets; each other application listed and read through its alias. (step 22)
- The application in the index, the digests, `search --app`, `rule --on` and `overrides`. (step 21)
- The stack beyond the first level: every application rule climbed, resolution order in `stack.md`. (step 20)
- Projections of the remaining writable types, each with a real fixture rule. (step 17)
- Drafts for Dev Studio: the types the Pega MCP cannot write. (step 16)
- Real trial of every writable type in a test branch. (step 15)
- `pega-ctx examples` and `--from example:<name>`: create a type the application has no rule of yet. (step 14)
- Lint of what is sent to Pega against the server's JSON Schemas; `$schema` in each draft for the editor. (step 13)
- JSON drafts reviewed before sending: `--draft`, then `send`. (step 12)
- Every rule type the Pega MCP can write, from the server's schemas. (step 11)
- Write ruleset per class (`write` in `.pega/config.json`). (step 9)
- Instruction templates, README, decisions, `install`. (step 7)
- Projections of the other types. (step 6)
- `live`, then `create` and `update`, dry-run first. (step 5)
- The `.pega/` mirror and the read commands: `init`, `sync`, `search`, `rule`, `around`, `stack`, `check`. (step 4)
- Main projections and the generic fallback; `measure`. (step 3)
- Fixture of real anonymized rules. (step 2)
- MCP client and the table of real Pega MCP tools. (step 1)
