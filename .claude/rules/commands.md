---
paths:
  - "bin/**"
  - "src/commands/**"
---

# Commands

- The output is for a model: short Markdown, no color or decoration. Never raw JSON on stdout except with `--json`, which exists on every command.
- A failure: non-zero code and **one line that says what to do** (`…: run again with --full`), never a stack trace.
- Commands run from the root of the user's project, where `.pega/` lives.
- `around` stops beyond 40 rules and suggests `--depth`, `--types` or `--stage`. `search` returns 100 lines at most.
- `create` and `update`: `--dry-run` first, or `--draft` then `send` (the draft file is sent as it is, never recomputed; a lint error stops the write unless `--no-lint`); the template loses its persistence fields (same list as the projection); an array in the patch replaces the whole array. A type the Pega MCP cannot write: only `--draft`, a draft for Dev Studio that `send` refuses (`src/commands/manual.mjs`).
