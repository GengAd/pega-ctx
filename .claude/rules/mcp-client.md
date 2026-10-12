---
paths:
  - "src/mcp/**"
  - "docs/mcp-tools.md"
---

# MCP layer

- `src/mcp/` is the only layer that talks to Pega. The rest goes through the `list / read / create / update / stack` interface; the tests inject a fake client that serves the fixture.
- Real launch (read from the plugin's `.mcp.json`, never hard-code the version): `java -jar ${CLAUDE_PLUGIN_ROOT}/resources/infinity-rules-mcp.jar --spring.profiles.active=stdio`, env `PEGA_SKILLS_PATH`, `PEGA_CLIENT_MODE`, `PEGA_BASE_URL`, `PEGA_OAUTH_CLIENT_ID`. Plugin under `~/.claude/plugins/cache/Pega/pega-infinity-authoring/<version>/`.
- The server loads JSON schemas per rule class (`Rule-Obj-Flow`, `Rule-UI-View`…) and validates write payloads: the rule's Pega class is what counts, not pega-ctx's short `Type`.
- The server returns everything as TOON text, never JSON nor `structuredContent`: decode with `decodeToon` (`src/mcp/toon.mjs`), never `JSON.parse`. `read()` returns the cleaned TOON: the raw rule is stored as `.toon`, only `create`/`update` send JSON. Detail of the responses and of the table: `docs/mcp-tools.md`.
- Every tool discovered, its schema and its role in the abstract table are written in `docs/mcp-tools.md` before being used in `tools.mjs`.
