# pega-ctx — build specification

This document is for a coding agent (Copilot, Claude Code) in charge of building the whole `pega-ctx` repository. Read it entirely before writing a line. When a piece of information is missing, it is marked **TO CHECK**: discover it on the real Pega MCP, write what you found in `docs/mcp-tools.md`, and only then go on. Never guess the name of an MCP tool or the shape of a rule's JSON.

## The problem

The Pega MCP returns an application's rules as raw JSON. A rule's JSON is 80% persistence metadata: instance keys, dates, operator, locking, history, the form's binary stream. The model reads all of that for each rule it looks at, and it looks at many of them to understand an application where applications are stacked. On a real application, the context blows up before the first useful line.

## What pega-ctx does

A Node CLI, `pega-ctx`, which:

1. is a **client** of the Pega MCP: it launches the server over stdio, calls its read tools, with no model in the loop;
2. keeps a **local mirror** of the rules in three layers: raw, digest, index + graph;
3. answers in a few lines the questions a developer asks before coding a user story: what exists around this case type, what does this rule do, which ruleset do I write to;
4. **creates** a rule by copying a sibling rule as a template and going through the MCP's creation tools.

The model never reads the raw rule. It reads Markdown digests, it greps an index, it calls the CLI.

## What pega-ctx does not do

- It does not replace the Pega MCP: live reading and writing go through it. pega-ctx sits in front, not in its place.
- It does not resolve rules. Inheritance, circumstancing, the ruleset stack: the Pega engine decides. The mirror says what exists and where; `live` asks Pega when the truth is needed.
- It does not expose an MCP server. A CLI costs nothing until it is called; an MCP server costs its tool definitions in every session.
- It carries no generic Pega know-how. The Pega skills stay there for that.

## Constraints

- **Node 20+, a single dependency**: `@modelcontextprotocol/sdk` for the stdio client. Nothing else. No CLI framework, no database, no graph library.
- **Everything in English**: command names, messages, docs, commits. Pega rule identifiers stay as they are.
- **Tests with `node --test`**, on a fixture of real anonymized rules in `tests/fixture/raw/`. A projection without a fixture rule is not delivered.
- **Each error message says what to do** in one line. A tool that throws is abandoned by the model; a tool that says what to do is followed.
- **The output is for a model**: short, Markdown, no decoration, no color, never raw JSON on stdout except with `--json`.

## Repository map to produce

```
pega-ctx/
  package.json                 bin: pega-ctx ; scripts: test
  bin/pega-ctx.mjs             parses the arguments, calls src/commands/*
  src/mcp/client.mjs           launches the Pega MCP over stdio, exposes list/read/create
  src/mcp/tools.mjs            the abstract → real tool table (see "Discovery")
  src/projection/index.mjs     digest(raw) → { type, id, markdown, references }
  src/projection/<type>.mjs    one projection per rule type
  src/mirror/                  reading/writing .pega/, index, graph, diff
  src/commands/                one command per file
  tests/                       node --test
  tests/fixture/raw/           real anonymized rules, at least one per type
  docs/mcp-tools.md            what tools/list returned and how it is mapped
  docs/projection.md           per type: kept / dropped, and why
  docs/decisions/              one architecture decision per file
  templates/copilot-instructions.md   the file to copy into a Pega project (see the end)
  templates/CLAUDE.md                 same for Claude Code
```

## The mirror: `.pega/` in the user's project

```
.pega/
  config.json              MCP command, followed rulesets, write table by class, date of last sync
  stack.md                 built-on applications and rulesets, in resolution order; rulesets seen in the mirror
  write.draft.json         draft of the write table, deduced from the index by sync
  index.jsonl              one line per rule
  graph.json               edges between rules
  digest/<Type>/<Class>/<Name>.md
  raw/<Type>/<Class>/<Name>.toon
```

The mirror is made to live in git. The morning's `git diff .pega/digest` shows what colleagues changed in Pega, readably. `raw/` can be ignored by git if the project prefers; `digest/`, `index.jsonl` and `stack.md` are always versioned.

### Identifier of a rule

`Type:Class:Name`, for example `Section:MyOrg-Claims-Work-Claim:Entry`. `Type` is the Pega type in one word: `Section`, `Flow`, `FlowAction`, `DataTransform`, `When`, `Activity`, `DecisionTable`, `Property`, `CaseType`, `DataPage`, `Validate`, `ReportDefinition`. Every other rule class has one too, built from the class (`Rule-Obj-ServiceLevel` → `ServiceLevel`): `docs/mcp-tools.md` § Pega types and classes. When a rule has several versions in several rulesets, the identifier stays the same; the index line carries each `ruleset:version` and the digest shows the highest version of the stack, with the others listed at the top.

### An index line

```json
{"id":"Section:MyOrg-Claims-Work-Claim:Entry","type":"Section","class":"MyOrg-Claims-Work-Claim","name":"Entry","rulesets":["Claims:02-03-01"],"description":"Initial entry form","updated":"2026-10-08T14:02:11Z","refs":["Section:MyOrg-Claims-Work:InsuredAddress","DataTransform:MyOrg-Claims-Work-Claim:InitEntry"]}
```

Greppable by `type`, `class`, `name`, `description`. That is the reason for JSONL rather than a single JSON.

### A digest

Markdown, a hundred lines at most. At the top, always the same seven lines:

```
# Section Entry
class: MyOrg-Claims-Work-Claim
rulesets: Claims:02-03-01 (also: Claims:02-02-05)
application: Claims
description: Initial entry form
updated: 2026-10-08 by jdoe
available: yes
```

Then the body, specific to the type. Then `## References`, the list of cited identifiers, and `## Cited by`, computed from the graph.

### The graph

```json
{"edges":[{"from":"Flow:…:Instruction","to":"FlowAction:…:ValidateEntry","via":"assignment","confidence":"probable|sure"}]}
```

`via` names the mechanism (assignment, subflow, included section, pre or post data transform, activity call, data page source…). `confidence` is `sure` when the reference comes from a structured field, `probable` when it comes from generic detection by name (see Projection).

## Discovering the Pega MCP — TO CHECK first

Before everything else:

1. Read the installed Pega plugin's `.mcp.json` for the launch command (Java 17, a jar, a config in `~/.infinity-rules-mcp/config.json`).
2. Launch the server through the SDK over stdio, call `tools/list`, write the full list with their schemas in `docs/mcp-tools.md`.
3. Fill `src/mcp/tools.mjs`, the table that links pega-ctx's five abstract operations to the real tools:

| Abstract operation | What is needed | If no tool does it |
|---|---|---|
| `stack()` | applications, built-on, rulesets in order | ask the user to fill `stack.md` by hand, say so in `sync` |
| `list(ruleset or class, since?)` | all identifiers + update date | **blocking**: document it in `docs/mcp-tools.md` and propose the product export (RAP) as the source of `raw/` |
| `read(id)` | the raw JSON of a rule | blocking, pega-ctx makes no sense without it |
| `create(type, payload)` | creating a rule | `create` is not delivered, the rest is |
| `update(id, payload)` | updating | same |

4. Fetch **ten real rules** of different types into `tests/fixture/raw/`, anonymize them (organization names, operators), and only then write the projections. Projections derive from the samples, not from Pega's documentation.

If `list` accepts no date filter, incremental sync works by comparing each listed rule's update date with the index's: only those that changed are read again.

## Projection: what is kept per type

General rule: keep what a developer would look at in Dev Studio to understand the rule, drop everything used for storage, locking, history and rendering. The families to drop on principle: instance keys, creation and commit dates, creation operators, locking and check-out, history, the form's binary stream, any field whose value is a GUID or base64. `docs/projection.md` holds the exact list, kept / dropped, per type, with the reason. The real field names are **TO CHECK** on the fixture.

| Type | The digest's body | Extracted references |
|---|---|---|
| CaseType | stages in order, for each stage its processes and the flow of each; declared data model | flows, properties |
| Flow | the shapes in graph order: assignments with their flow actions, decisions with their when, subflows, utilities, end; the connectors with their condition | flow actions, subflows, when, data transforms, activities |
| FlowAction | displayed section, pre and post data transforms, validate, visibility when | section, data transforms, validate, when |
| Section | the fields in order, each: property, control type, read-only, required, visibility condition; included sections; data pages as list sources | sections, properties, data pages, when |
| DataTransform | the actions in order: set, apply, for each, when, append, with target and source; the data transforms called | data transforms, properties, data pages |
| When | the condition as written, as one expression | properties, functions |
| Activity | the steps in order: method, page, key parameters, step's when condition, label; input and output parameters | activities, data transforms, data pages, sections |
| DecisionTable | condition columns, result columns, the rows | properties |
| Property | type, mode, table or source of values, page class if page or list | target class |
| DataPage | scope, structure, source (activity, report definition, connector, data transform), parameters | the source rule |
| Validate | the checks in order: property, condition, message | properties, when |
| ReportDefinition | class, columns, filters, joins | properties, classes |

**Generic detection by name.** On top of the structured fields, any string of the raw rule equal to the `Name` of an index rule, on the same class or a parent class, yields a `probable` edge. It catches what a type's projection does not know yet. `probable` edges are shown with a `?` in the digests.

A type without projection is not an error: the digest is then the seven header lines, the description, and `## References` from generic detection only, with the line `body: type without projection, see docs/projection.md`.

## The commands

All from the root of the user's project, where `.pega/` lives. `--json` everywhere returns the same thing for a script. A failure returns a non-zero code and one line that says what to do.

### `pega-ctx init`

Creates `.pega/config.json`: MCP command read from `.mcp.json`, applications to follow read from `stack()`, those Pega ships aside (`--all` keeps them, `--ruleset A,B` follows rulesets instead). Writes `stack.md`. Adds `.pega/raw/` to `.gitignore` on request.

### `pega-ctx sync [--since <date>] [--full] [--ruleset <name>] [--application A] [--type T,U] [--jobs N]`

1. `stack()` and rewrites `stack.md`.
2. `list()` for each followed ruleset; without `--since`, takes the last sync date from `config.json`; `--full` ignores the dates.
3. `read()` each new or changed rule, writes `raw/`, projects, writes `digest/`.
4. Removes from the mirror the rules `list()` no longer returns, reports them.
5. Recomputes `index.jsonl` and `graph.json` entirely (it is fast, and avoids a partial state).
6. Returns a summary: `N added, N changed, N removed, N types without projection`, then the list of touched rules as identifiers.

A sync on an empty mirror is a full sync. A `list()` that fails on one ruleset does not stop the others: the error is listed at the end.

At scale: `--jobs N` calls at a time (4 by default), `--type` and `--application` to sync a part, and an interrupted sync does not read again what it had read (`docs/mirror.md` § `sync`). Progress goes to stderr on a terminal only; stdout holds the summary alone.

### `pega-ctx stack`

Shows `stack.md`. With `--for <Class>`, adds the class's inheritance chain as the index knows it, and which ruleset a new rule of this class is written to. `stack()` does not say which ruleset is unlocked (checked, `docs/mcp-tools.md`), and a layercake has several rulesets: the answer depends on the class, resolved as for `create` (below), with its source, or "unknown" / "ambiguous" with the candidates.

### `pega-ctx search <words> [--type T] [--class C]`

Grep on `index.jsonl`: name and description, case-insensitive, every word must match. Returns one line per rule: `id — description — rulesets`. A hundred results at most, then `… and N more, narrow with --type or --class`.

### `pega-ctx rule <id>`

Shows the digest. `--raw` shows the TOON from `raw/` (the raw rule as the MCP returns it), for a script, never recommended to the model. `--cited-by` adds the reverse tree on two levels.

### `pega-ctx around <id> [--depth 2] [--types Flow,Section]`

The subgraph: starts from the identifier, follows outgoing edges up to the given depth, and returns the concatenated digests, separated by `---`, from the closest to the farthest. For a `CaseType`, depth 2 gives the flows and their flow actions; depth 3 adds sections and data transforms. With `--stage <name>`, starts from the named stage only.

Safeguard: beyond forty rules, stops and says `N rules: reduce the depth, filter with --types, or target a --stage`. The model must never receive a hundred digests.

### `pega-ctx live <id>`

`read(id)` on the MCP right now, projects with the same function as `sync`, shows the digest, and updates `raw/` and `digest/` on the way without recomputing the index. If the digest differs from the mirror's, says so on the first line: `different from the mirror (synced on 2026-10-08)`.

It is the command to use before any write on a rule.

### `pega-ctx create <Type> <Class> <Name> --from <id> --patch <file.json> [--ruleset R:V] [--dry-run]`

1. Takes the raw rule of `--from` as the template; `--from example[:name]` takes an example of the server's skill for the type instead (`pega-ctx examples <Type>`), for a type the application has no rule of yet.
2. Drops the persistence fields (the same list as the projection), replaces class, name, ruleset, description. The ruleset is resolved in order: `--ruleset`; the `write` table of `config.json` (ordered class prefixes, first match wins, then an optional default); the rulesets of the class's own rules in the mirror. No candidate, or several rulesets for the class: code 1 and the candidates. The command refuses rather than guesses; the instructions tell the model to ask the user. `sync` writes a draft of the table in `write.draft.json`, which a human reviews and copies.
3. Applies `--patch`: a JSON deep-merged onto the template. For an array (steps, fields, actions), the patch replaces the whole array; the model builds the full list from the template's digest.
4. `--dry-run` shows the digest of what would be created, and the payload with `--json`.
5. Without `--dry-run`: `create()` on the MCP, then `live` on the created rule to bring it into the mirror.

The model never writes a full rule JSON. It picks a template, describes the difference, reads the dry-run, confirms.

`pega-ctx update <id> --patch <file.json> [--dry-run]`: the same, on the rule itself, after an implicit `live`.

`--draft` (create, update) writes the content that would be sent to `.pega/drafts/<Type>/<Class>/<Name>.json`, made to be read and corrected by hand; `pega-ctx send <draft | id> --branch B` sends that file as it is, then deletes it. For a type the Pega MCP cannot write (no schema, Section first), `--draft` is the only way: the draft says what a developer does in Dev Studio, and `send` refuses it. Format: `docs/mirror.md` § `live`, `create`, `update`. Before any write, the content is checked against the server's JSON Schema, read from the Pega plugin (`pega-ctx lint <draft | id>`, run by `create`, `update` and `send`): one line per problem with its line in the draft, and an error stops the write unless `--no-lint`.

### `pega-ctx measure`

For each type: number of rules, average size of the raw rule, average size of the digest, ratio. One line per type, a total. It is the proof that the tool helps; it is run again after each projection change.

### `pega-ctx doctor [--offline]`

What pega-ctx needs, one line per point, `ok`, `problem` or `note`; each problem says what to do, and the code is non-zero if there is one. In order: Node 20+, Java 17+ (`java -version`, old `1.8` format included), the Pega plugin's folder, `~/.infinity-rules-mcp/config.json` (valid JSON, its three keys, a root URL without `/prweb`), the plugin's schemas for that Infinity version, the server's session folder (`.infinity-rules-mcp/` where pega-ctx is launched), `.pega/` and its last sync, then the connection: the server started and `list-available-applications` asked, 90 s at most. The Pega MCP has no session status tool: an expired session shows as a refused call, a sign-in waiting in the browser as no answer. The connection is not tried while a local problem stands; `--offline` skips it. `init` adds the local problems to its message when it cannot reach Pega.

### `pega-ctx model <Class> [--depth 1]`

The data model of a class in one page. The inheritance chain the mirror sees: parents by name, then the Class rule's `pyDerivesFrom`, followed even outside the mirror. The properties, own first then inherited class by class, a property masking a farther one of the same name; each with mode, page class, type, values, label, rulesets and application. Properties that rules of the mirror cite on these classes but the mirror lacks, with who cites them. `--depth` (1 by default) goes into the classes of Page and PageList properties; beyond 100 properties it stops and says how to narrow. Then the data pages of these classes and the views that show their properties (from the graph).

### `pega-ctx check`

The mirror's inconsistencies, one line each with its fix: reference to a rule missing from the index, rule cited by no one in a type that should be (an orphan section or data transform), digest without projection, sync older than seven days. Returns a non-zero code if there is anything.

### `pega-ctx run-case <CaseType | Class> [--fields A=1,Page.B=2] [--action ID]`

Creates a case (`create-case`) and shows the case, its stage, its first assignment, the flow actions and the fields the assignment shows. With `--fields`, sets those values on the first assignment and submits its flow action (`perform-action`, `--action` to choose another), then shows the next assignment. A bare field name the assignment shows inside an embedded page (`.FirstName` in `.Requester`) goes into that page; numbers and booleans are typed from the assignment's fields. Pega's refusal is shown as Pega words it, non-zero code. It closes the loop after a `send` on a case type, a flow, a flow action or a view: the case is created in the operator's application, so a rule still in a branch is only tried once the branch is in the application. Real answers: `docs/mcp-tools.md` § Cases.

### `pega-ctx units [--branch B]`

Runs the branch's PegaUnit tests (`run-pegaunits`): a summary line, then one line per test, failures first, with the type of the rule under test and the time. Non-zero code when a test fails. The server does not return why a test failed: the user opens it in Dev Studio.

## The user project's instruction file

Beside this block, `install` writes an agent kit from the same `templates/`: three skills (`pega-story`, `pega-write`, `pega-morning`), a read-only `pega-explorer` agent, a rule for `.pega/drafts/**`, and for Claude Code hooks that refuse the Pega MCP read tools and `.pega/raw/`. What goes where per agent: `docs/kit.md`.

`templates/copilot-instructions.md` and `templates/CLAUDE.md` have the same content. Here it is, to adapt per project in the brackets:

```markdown
# [Pega application name]

Pega application [version]. The rules live in Pega, not here; this repository holds a readable mirror in `.pega/`.
Stack: see `.pega/stack.md`. The write ruleset depends on the class: `pega-ctx stack --for <Class>` says it.

## Before coding a user story

1. `pega-ctx sync` if the last sync is more than a day old (`pega-ctx check` says so).
2. `pega-ctx search <words of the story>` then `pega-ctx around <CaseType or Flow concerned> --stage <stage>`: that is the story's context. Read nothing else before having a plan.
3. Write the plan: rules reused as is, rules updated, rules created with their `--from` template. Get it approved.

## To write

- `pega-ctx live <id>` before updating a rule. Never write from a digest more than a day old.
- `pega-ctx create … --dry-run`, read the digest it returns, then without `--dry-run`.
- Never the Pega MCP read tools directly: they return the raw rule, `live` returns the same thing ten times smaller.
- If `create` or `stack --for` answers that the write ruleset is unknown or ambiguous, ask the user which one before writing, then pass `--ruleset R:V`. Never pick one yourself.

## Project conventions

[What the mirror does not say: naming, what we do not do, the pitfalls. One line each.]
```

This instruction is short on purpose. Everything else is in the digests, loaded on demand.

## Tests

- `tests/projection.test.mjs`: for each file of `tests/fixture/raw/`, the expected digest in `tests/fixture/digest/`; the extracted references; no field of the "dropped" family survives.
- `tests/graph.test.mjs`: on the fixture, the expected edges, `sure` and `probable`.
- `tests/commands.test.mjs`: `search`, `rule`, `around` with its safeguard, `check`, on a fixture `.pega/` built from the raw fixture.
- `tests/create.test.mjs`: `--dry-run` on a fixture template produces the expected payload, without any persistence field.
- The MCP client is behind an interface; the tests inject a fake that serves the fixture. No test launches Java.

## Decisions to write in `docs/decisions/`

1. **A client, not a server**: why a CLI client of the Pega MCP and not an MCP in front of the Pega MCP.
2. **The mirror as files, in git**: why not a database, and what the morning diff brings.
3. **The projection comes from the samples**: why no projection is written without a real rule in the fixture.
4. **Pega resolves, pega-ctx looks**: the mirror does no rule resolution.
5. **Swappable source**: the `src/mcp/` layer is the only one that talks to Pega, so that one day the local mirror can be replaced by a Pega service returning index and digests already projected.
6. **The write ruleset depends on the class**: a layercake has several rulesets; resolution by `--ruleset`, the `write` table, the class's sibling rules, and a refusal rather than a guess.

## Build order

Even in the final version, build in this order, and run the tests at each step:

1. MCP client, `tools/list`, `docs/mcp-tools.md`, `tools.mjs` table. **Stop and ask** if `list` or `read` have no tool.
2. Ten real rules in the fixture, anonymized.
3. Projections Section, DataTransform, Flow, FlowAction, CaseType, and generic detection. `measure`.
4. Mirror, index, graph, `sync`, `search`, `rule`, `around`, `stack`, `check`.
5. `live`, then `create` and `update` with `--dry-run` first.
6. The other projections: When, Activity, DecisionTable, Property, DataPage, Validate, ReportDefinition.
7. The instruction templates, the README, the decisions.

Deliverable: `npm test` green, `pega-ctx measure` on the fixture in the README with the ratio obtained, and an example `.pega/` built from the fixture.
