# pega-ctx

Node CLI, client of the Pega MCP (stdio, no model in the loop): a local mirror of the rules in three layers (raw, Markdown digest, index + graph) so that the model never reads a rule's raw JSON. Full build specification: `pega-ctx.md`.

End goal: a tool reusable in any Pega project, installed by its own setup: `pega-ctx init`, `sync`, then `pega-ctx install`, which writes the instructions from `templates/` (contextree has no setup command; `templates/` can be copied by any other tool). Nothing specific to this repository (pegademo target, Trello board, local paths) goes into the code or into `templates/`.

## Stack and commands

- Node 20+, **a single dependency**: `@modelcontextprotocol/sdk`. No CLI framework, no database, no graph library.
- `npm test` (= `node --test`), on the fixture `tests/fixture/raw/`. No test launches Java.
- `node bin/pega-ctx.mjs <command>` to try by hand.

## Map

- `bin/pega-ctx.mjs` — arguments → `src/commands/*`
- `src/mcp/` — the only layer that talks to Pega (stdio client, tool table); `types.mjs` is generated from the server's schemas by `scripts/types.mjs`, never edited by hand
- `src/projection/` — raw → digest, one projection per type
- `src/lint/` — what create / update / send will write, checked against the server's JSON Schemas and against the mirror (what it cites exists), without Pega
- `src/mirror/` — `.pega/`: raw, digest, index.jsonl, graph.json, stack.md
- `src/commands/` — one command per file
- `tests/`, `tests/fixture/raw/` — real anonymized rules
- `docs/mcp-tools.md`, `docs/projection.md`, `docs/decisions/` — what we found and decided; `docs/mcp-gaps.md` — what the Pega MCP lacks, to hand back to Pega
- `templates/` — instruction files and agent kit (skills, explorer agent, drafts rule, Claude Code hook) to copy into a Pega project (`pega-ctx install` writes them; per agent: `docs/kit.md`)
- `example/.pega/` — mirror built from the fixture by `scripts/example.mjs`; `tests/example.test.mjs` reports when it is behind
- `.github/workflows/test.yml` — `npm test` on Linux and Windows, Node 20 and 22, then the npm package's contents (`scripts/pack-check.mjs`: only `bin/`, `src/`, `templates/`)
- `CHANGELOG.md` — one line per delivered step, under `Unreleased` until a version is tagged

## Rules

- Everything in English: commands, messages, docs, commits. Pega identifiers stay as they are.
- `main` is public (GitHub `GengAd/pega-ctx`) and starts at a single commit; the earlier history (French until 2026-10-11) lives only on the local branch `history`, never pushed. Nothing private goes into a commit: real Pega names, local paths, tokens.
- Never guess an MCP tool name or the shape of a rule's JSON: what is marked **TO CHECK** in the specification is discovered on the real server and written in `docs/` before going on. A check the MCP server makes itself, before Pega, can be read in its jar instead (`docs/mcp-tools.md` § Server code).
- Build in the specification's order (§ Build order), tests green at each step. If `list` or `read` have no tool: stop and ask.
- A projection without a fixture rule is not delivered.
- Commit as soon as a task is done and `npm test` is green (at the latest when the card moves to Terminé), without waiting to be asked. Message in English: a title (`Step N: …` for a specification step), then what changes, one line per file or topic. A delivered step also adds its line to `CHANGELOG.md`. Then push `main` to `GengAd/pega-ctx` (`git push realOrigin main` in this clone), never another remote or branch, never a force push: what is pushed is never rewritten.

## Where to go

| Task | File | When |
|---|---|---|
| Identifier format, index line, digest, graph | `pega-ctx.md` § The mirror, then `docs/mirror.md` (what the code adds) | before touching `src/mirror/` |
| What is kept per type | `pega-ctx.md` § Projection, `docs/projection.md` | before a projection |
| Specification of a command | `pega-ctx.md` § The commands | before `src/commands/` |
| Real tools of the MCP | `docs/mcp-tools.md` | before `src/mcp/` |
| A Pega MCP limit worked around | `docs/mcp-gaps.md`, one entry: seen, workaround, ask | when the workaround is written |
| Measure cost and quality, with / without pega-ctx | `docs/measurement.md` | after steps 4 and 5 |
| Progress | Trello board `pega-ctx` | start and end of a step |
