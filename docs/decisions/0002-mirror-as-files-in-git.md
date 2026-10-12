# 2. The mirror as files, in git

## Context

The mirror must answer fast (grep, reading a digest), survive between sessions, and show what changed in Pega. A database (SQLite, graph) would add a dependency and an opaque format; the specification only allows one, the MCP SDK.

## Decision

`.pega/` is a folder of text files, made to live in git: `index.jsonl` (one line per rule, greppable), `graph.json`, `stack.md`, `digest/<Type>/<Class>/<Name>.md`, `raw/<Type>/<Class>/<Name>.toon`. Index, graph and digests are recomputed entirely at each `sync`.

## Consequences

- The morning's `git diff .pega/digest` shows in Markdown what colleagues changed in Pega, rule by rule.
- `raw/` can leave git (`pega-ctx init --ignore-raw`); `sync` then reads again what is missing.
- Recomputing everything costs little (the projection is local) and avoids any partial state; the time of a `sync` is in the `list()` calls (16 s on 32 rules, including 3 to 5 s of server start).
- No complex query: `search` is a filter on the index, `around` a breadth-first walk. Beyond 40 rules, `around` refuses and says how to narrow.
