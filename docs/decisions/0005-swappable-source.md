# 5. Swappable source

## Context

Today the source is the local Pega MCP (a Java jar launched over stdio). Tomorrow, it may be a Pega service that returns index and digests already projected, or a product export.

## Decision

`src/mcp/` is the only layer that talks to Pega. The rest goes through an interface of five operations, `stack`, `list`, `read`, `create`, `update` (`pegaInterface` in `src/mcp/client.mjs`), and each command receives its connection through `connect()`.

## Consequences

- The tests inject a fake client that serves the fixture (`tests/fake-pega.mjs`): no test launches Java, and `example/.pega/` is built the same way (`scripts/example.mjs`).
- The raw rule stays in the source's format (TOON, `docs/mcp-tools.md`): changing the source changes the decoder, not the projection.
- The detail of each real tool (parameters, pitfalls such as the alias required for another application) is recorded in `docs/mcp-tools.md`, not in the commands' code.
