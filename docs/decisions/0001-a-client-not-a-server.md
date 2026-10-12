# 1. A client, not a server

## Context

The Pega MCP (plugin `pega-infinity-authoring`) exposes 27 tools and returns raw rules: a Flow of the fixture weighs 12 KB of TOON, most of it persistence data. Two ways to put pega-ctx in front: a second MCP server that filters the first one, or a CLI that is its client.

## Decision

pega-ctx is a Node CLI, stdio client of the Pega MCP, with no model in the loop. The model calls it through the shell (`pega-ctx search`, `rule`, `around`, `live`, `create`) and reads Markdown digests.

## Consequences

- A CLI costs nothing until it is called; an MCP server costs its tool definitions in every session, on top of the 27 of the Pega server.
- The mirror is read without Java or network: `search`, `rule`, `around`, `check`, `measure` read `.pega/`. Only `init`, `sync`, `live`, `create`, `update` launch the Pega server (3 to 5 s to start).
- The same command serves the model, a script (`--json`) and a human.
- Generic Pega know-how stays in the server's skills; pega-ctx uses them as a source (key fields, role of fields), it does not copy them.
