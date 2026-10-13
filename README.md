# pega-ctx

A local, readable mirror of the rules of a Pega application, so that a coding agent (Claude Code, Copilot) understands the application without reading the raw JSON of its rules.

pega-ctx is a CLI client of the Pega MCP server (plugin `pega-infinity-authoring`). It keeps a `.pega/` folder in the project, in three layers: the raw content of each rule, one Markdown digest per rule, and an index plus a graph of the references. The model greps the index, reads digests, and goes through pega-ctx to write.

## What it changes

`pega-ctx measure` on the fixture (20 real anonymized rules, `example/.pega/raw`):

| type | rules | raw average (B) | digest average (B) | ratio |
|---|---:|---:|---:|---:|
| Activity | 1 | 7188 | 1393 | ×5.2 |
| CaseType | 1 | 5057 | 713 | ×7.1 |
| Class | 1 | 1207 | 357 | ×3.4 |
| DataPage | 1 | 4276 | 398 | ×10.7 |
| DataTransform | 1 | 4531 | 1012 | ×4.5 |
| DecisionTable | 1 | 7170 | 383 | ×18.7 |
| Flow | 2 | 11950 | 727 | ×16.4 |
| FlowAction | 1 | 5554 | 309 | ×18 |
| Property | 3 | 1566 | 284 | ×5.5 |
| ReportDefinition | 1 | 19026 | 710 | ×26.8 |
| Section | 1 | 62513 | 493 | ×126.8 |
| Validate | 1 | 19893 | 485 | ×41 |
| View | 4 | 3038 | 582 | ×5.2 |
| When | 1 | 6368 | 386 | ×16.5 |
| **total** | **20** | **9177** | **564** | **×16.3** |

On a Constellation application of 32 rules, the ratio was ×9.2 (measured before the switch to English, whose digests are slightly shorter). Small rules (views, properties, data transforms) keep almost all their useful content; large ones (sections, validations, reports) mostly lose persistence data and generated code. The gain goes beyond the ratio: `around <CaseType> --stage <stage>` returns a user story's context in one command (flows, flow actions, views), without the model opening one rule too many.

Measured on a real task (create a case type with two stages and three fields, modelled on an existing case type, three runs per condition, Sonnet 5.5): with pega-ctx, **2.3 times cheaper** ($0.51 against $1.20), half the tool calls, eight times less text read, for at least equal quality (20/24 against 19/24 on the scorecard, the case runs 3 times out of 3). Details: `docs/measurement.md`.

## Install

### 1. Requirements

- **Node 20 or later**: `node -v`.
- **Java 17 or later**: `java -version` (the Pega MCP server is a Java program).
- **The Pega plugin `pega-infinity-authoring`** ([pegasystems/infinity-ai-plugins](https://github.com/pegasystems/infinity-ai-plugins)), connected to your Pega server. pega-ctx does not need the agent itself, only the plugin's folder: the server jar and its schemas. It launches that server on its own and keeps no secret.

Then follow the part for your agent.

**GitHub Copilot.** Get the plugin's folder one of two ways:

- With Copilot CLI: `copilot plugin marketplace add https://github.com/pegasystems/infinity-ai-plugins.git`, then `copilot plugin install pega-infinity-authoring@Pega`. Run the `pega-setup` skill once in Copilot CLI to connect to Pega.
- Without Copilot CLI (Copilot in VS Code only): `git clone https://github.com/pegasystems/infinity-ai-plugins.git` anywhere. The plugin's folder is `infinity-ai-plugins/plugins/pega/infinity-ai-plugins/copilot`. Write the connection yourself in `~/.infinity-rules-mcp/config.json` (`%USERPROFILE%\.infinity-rules-mcp\config.json` on Windows):

  ```json
  {
    "pega_base_url": "https://your-pega-server.example.com",
    "pega_oauth_client_id": "34233104330833666523",
    "pega_infinity_version": "26-1"
  }
  ```

  The root URL, without `/prweb`; Pega's standard OAuth client unless your server uses another one; the version folder that matches your server (`24-2`, `25-1`, `26-1`). The file is in plain text: never commit it.

Then tell pega-ctx where that folder is: it is the one that holds `.mcp.json` and `resources/infinity-rules-mcp.jar`.

```bash
export PEGA_CTX_PLUGIN=/path/to/infinity-ai-plugins/plugins/pega/infinity-ai-plugins/copilot   # macOS / Linux, in ~/.zshrc or ~/.bashrc
setx PEGA_CTX_PLUGIN "C:\path\to\infinity-ai-plugins\plugins\pega\infinity-ai-plugins\copilot"   # Windows, then open a new terminal
```

**Claude Code.** `claude plugin marketplace add https://github.com/pegasystems/infinity-ai-plugins.git`, `claude plugin install pega-infinity-authoring@Pega`, then `/pega-infinity-authoring:pega-setup` in Claude Code. Nothing to set: pega-ctx finds the plugin in `~/.claude/plugins/cache/Pega/pega-infinity-authoring/` by itself.

Then check the machine: `pega-ctx doctor` (once pega-ctx is installed, step 2) checks Node, Java, the plugin's folder, `~/.infinity-rules-mcp/config.json`, the schemas for your Infinity version, then starts the server and connects; each problem comes with what to do. With no Pega session in the folder yet, the server opens the browser to sign in. If `pega-ctx init` cannot reach Pega, it lists the same problems.

**Windows.** The same commands, in PowerShell or cmd. What differs: the server's config is `%USERPROFILE%\.infinity-rules-mcp\config.json`; `setx` (above) sets `PEGA_CTX_PLUGIN` for the terminals opened afterwards (`$env:PEGA_CTX_PLUGIN = "…"` for the current PowerShell); `java` must be on the `PATH` (`java -version` in a new terminal). pega-ctx prints paths with `/`, which Windows accepts in every command; `.pega/` and the drafts are written with LF line endings, which VS Code keeps.

### 2. Install pega-ctx

```bash
npm install -g github:GengAd/pega-ctx
pega-ctx             # lists the commands
```

A single dependency, `@modelcontextprotocol/sdk`. To update later, run the same `npm install -g` again. To work on pega-ctx itself instead: `git clone https://github.com/GengAd/pega-ctx.git`, `npm install`, then `npm link` in the clone.

### 3. Set it up in your Pega project

From the root of the project's repository (the folder VS Code or Claude Code is opened in):

```bash
pega-ctx init                # creates .pega/config.json and .pega/stack.md; follows the stack's applications except those Pega ships (--all: every one, --ruleset A,B: only those rulesets)
pega-ctx sync                # first mirror: lists, reads and projects every rule (a few minutes)
pega-ctx install --copilot   # writes the instructions into .github/copilot-instructions.md, and the agent kit
```

`install --claude` writes them into `CLAUDE.md` instead; with no option, both. Beside the instructions, `install` writes the agent kit, one source rendered per agent:

| | Claude Code | GitHub Copilot |
|---|---|---|
| Skills `pega-story` (context, then a plan), `pega-write` (draft, lint, send, run-case), `pega-morning` (sync, check) | `.claude/skills/` | `.github/skills/` (or `.claude/skills/`, which Copilot reads too, when both are installed) |
| Agent `pega-explorer`: explores the mirror with read commands only, returns a plan | `.claude/agents/pega-explorer.md`, held to those commands by a hook | `.github/agents/pega-explorer.agent.md` |
| How to correct a draft, loaded for `.pega/drafts/**` | `.claude/rules/pega-drafts.md` | `.github/instructions/pega-drafts.instructions.md` |
| Hooks: the Pega MCP read tools and `.pega/raw/` refused, `pega-ctx check` at session start | `.claude/hooks/pega-ctx.mjs`, wired in `.claude/settings.json` (merged, with the permission `Bash(pega-ctx *)`) | none |

These files belong to pega-ctx: each `install` rewrites them. Details and sources: `docs/kit.md`.

Then, once:

1. **Say where new rules go.** `sync` wrote `.pega/write.draft.json`, guessed from the rulesets seen. Review it, and copy it into `.pega/config.json` as `write` (the server does not say which ruleset is unlocked). Set `branch` there too if you always work on the same branch.
2. **Complete the instructions.** In `.github/copilot-instructions.md` (or `CLAUDE.md`), fill the brackets left by `install` (application name, project conventions). `install` can be run again safely: it only replaces its own block, between `<!-- pega-ctx:start -->` and `<!-- pega-ctx:end -->`.
3. **Ignore the server's files in git.** The Pega MCP server writes its OAuth tokens and logs in the folder it is launched from: add `.infinity-rules-mcp/` and `logs/` to `.gitignore`. `.pega/` itself can be committed (`init --ignore-raw` keeps `.pega/raw/` out of git).

`sync` follows every rule type the Pega MCP knows (the 37 it can write, and sections); add any other rule class to `types` in `.pega/config.json` (`["Rule-Declare-Expressions"]`).

## Use

Always from the project root, where `.pega/` lives. Most of the time you do not type the commands yourself: the instructions written by `install` tell the agent when to call them. Ask it for a user story as usual.

The day-to-day loop:

```bash
pega-ctx sync                                      # each morning, or after changes in Dev Studio
pega-ctx search household                          # find rules by words
pega-ctx around CaseType:MyOrg-App-Work-Claim:pyDefault --stage Review
                                                   # a story's context: case type, flows, flow actions, views
pega-ctx rule View:MyOrg-App-Work-Claim:pyEdit     # the digest of one rule (or just its name, if unique)
pega-ctx create View MyOrg-App-Work-Claim Summary --from pyEdit --fields Amount,Reason --draft
pega-ctx send Summary --branch MyBranch            # sends the reviewed draft to Pega
pega-ctx check                                     # broken references, old sync, drafts waiting
```

Writes go through drafts: `--draft` writes the JSON that will be sent to `.pega/drafts/`, checked against the server's schema; you (or the agent) review it, then `send` sends it to a branch. Details of every command below.

## Commands

All from the project root, where `.pega/` lives. `--json` everywhere; a failure returns a non-zero code and one line that says what to do.

| Command | What it does |
|---|---|
| `doctor [--offline]` | checks Node, Java, the Pega plugin, the server's config and schemas, the mirror, then the connection; each problem says what to do |
| `init [--all] [--ruleset A,B] [--ignore-raw]` | creates `.pega/config.json` and `stack.md`; `applications`: the stack except what Pega ships |
| `sync [--full] [--since <date>] [--ruleset R] [--application A] [--type T,U] [--jobs N]` | reads again what changed in Pega, recomputes index, graph and digests; 4 calls at a time by default, an interrupted sync resumes where it stopped |
| `search <words> [--type T] [--class C] [--app A]` | grep on the index, name and description; each line tagged `[App]` |
| `rule <id> [--cited-by] [--raw]` | the digest of a rule (`Type:Class:Name`, or its name if unique) |
| `rule <[Type:]Name> --on <Class>` | the rules of that name the class reaches, in the order Pega looks: closest class, then the stack |
| `model <Class> [--depth 1]` | the data model of a class in one page: own then inherited properties (mode, page class, values, label, origin), those cited but not in the mirror, data pages, views that show them |
| `overrides` | the rules of the current application that mask a rule of a lower layer |
| `around <id> [--depth 2] [--types Flow,View] [--stage S]` | the subgraph, digests from the closest to the farthest; 40 rules at most |
| `stack [--for <Class>]` | applications and rulesets seen; known inheritance of a class and where its new rules are written |
| `live <id>` | the rule read in Pega right now, and how it differs from the mirror |
| `create <Type> <Class> <Name> --from <id> [--patch <f.json>] [--rename A=B] [--fields P1,P2] [--dry-run \| --draft] [--branch B]` | creates a rule from a sibling rule, describing only the difference; `--fields` for the fields of a view. Any of the 37 types `create-rule` accepts; the others are refused with the server's reason |
| `examples [Type]` | the server's examples for a type, templates when the application has no rule of that type yet (`create … --from example:stub`) |
| `update <id> --patch <f.json> [--dry-run \| --draft] [--branch B]` | updates a rule, after an implicit `live` |
| `send <draft \| id> [--branch B] [--dry-run] [--force] [--no-lint]` | sends a draft as it is in the file, then deletes it |
| `lint <draft \| id>` | checks a draft against the server's schema, one line per problem with its line in the file |
| `changes [--since <date>] [--type T] [--class C]` | what the last sync changed, one dated line per rule with its operator, and the digest lines that changed; `--since`: the rules updated in Pega since a date |
| `check` | missing references, orphan rules, old sync |
| `run-case <CaseType \| Class> [--fields A=1,Page.B=2] [--action ID]` | creates a case in Pega and shows its first assignment and fields; `--fields` fills that assignment and submits it, then shows the next one |
| `units [--branch B]` | runs the branch's PegaUnit tests, one line per test, failures first |
| `measure [--raw <folder>]` | size of the raw rule and of the digest, per type |
| `install [--claude] [--copilot]` | writes the instructions and the agent kit (skills, explorer agent, drafts rule, Claude Code hooks) from `templates/` into the project |

`create` and `update` only write to a branch, as the server requires. `--dry-run` returns the digest of what would be written; `--json` adds the content sent. `--draft` writes that content to `.pega/drafts/<Type>/<Class>/<Name>.json`, with a `<Name>.md` next to it: the digest of what the rule will contain, without the template's fields, to read instead of the JSON (`send` deletes both), readable (two-space indentation, identity fields first, `pxViewMetadata` and other JSON strings unfolded as objects), to be reviewed and corrected by hand; `send` then sends the file without recomputing anything. An update draft remembers the rule it was written against: if the rule changed in Pega meanwhile, `send` refuses (`--force` to apply it anyway). `check` lists the drafts waiting.

Before anything is written, the content is checked against the JSON Schema the Pega MCP itself validates with (read from the Pega plugin's files, no call to Pega): `lint: N errors`, then one line per problem, `error line 71  /content/pyDataSourceList/0: …`. An error stops `create`, `update` and `send` (`--no-lint` leaves the decision to the server). Numbers and booleans that the raw rule keeps as strings (`"10"`, `"true"`) are typed first where the schema says so. Each draft starts with a `"$schema"` pointing to a copy of that schema in `.pega/schemas/`: opened in VS Code, the draft is highlighted, what the server would refuse is underlined, and field names are completed. `.pega/schemas/` is rewritten with each draft and can be ignored by git. `create` picks the write ruleset from `--ruleset`, then the `write` table, then the rulesets of the class's existing rules; when none applies or the class spans several rulesets, it refuses and lists the candidates, so the model asks instead of guessing.

## Example

`example/.pega/` is a mirror built from the fixture: `example/.pega/digest/CaseType/MONORG-Test-Work-GetInfo/pyDefault.md` for a case type, `example/.pega/index.jsonl` for the index. It is rebuilt by `node scripts/example.mjs`.

## Development

- `npm test`: `node --test`, on the fixture `tests/fixture/raw/`. No test launches Java: a fake client serves the fixture (`tests/fake-pega.mjs`).
- `node scripts/types.mjs` regenerates `src/mcp/types.mjs` from the Pega plugin's schemas, after a plugin update; `npm test` says when it is behind.
- `UPDATE_DIGESTS=1 npm test` rewrites the expected digests in `tests/fixture/digest/`; read them before committing.
- `pega-ctx.md`: the build specification. `docs/mcp-tools.md`: the real tools of the Pega MCP. `docs/projection.md`: what each type keeps. `docs/mirror.md`: the actual mirror format. `docs/mcp-gaps.md`: what the Pega MCP lacks, found while building pega-ctx. `docs/decisions/`: the architecture decisions.
- `templates/`: the instructions to copy into a Pega project (`CLAUDE.md`, `copilot-instructions.md`, same content).
