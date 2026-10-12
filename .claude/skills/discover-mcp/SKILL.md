---
name: discover-mcp
description: Discover the real tools of the Pega MCP (tools/list) and fill docs/mcp-tools.md and src/mcp/tools.mjs. Run at step 1, or when the Pega plugin changes version.
argument-hint: "[plugin version, otherwise the most recent]"
---

# Discover the Pega MCP

1. Read `~/.claude/plugins/cache/Pega/pega-infinity-authoring/<version>/.mcp.json`: command, arguments, environment variables. Replace `${CLAUDE_PLUGIN_ROOT}` with the plugin folder; the `${user_config.*}` come from `~/.infinity-rules-mcp/config.json` (the server reads it itself, do not copy it).
2. If `node_modules/@modelcontextprotocol/sdk` is missing: `npm install` (the dependency is already in `package.json`, otherwise add it alone).
3. Launch the server through `src/mcp/client.mjs` (`open()`, `StdioClientTransport`), call `tools()`, write the raw result to a scratchpad file, not to stdout.
4. Write `docs/mcp-tools.md`: plugin version, date, then one section per tool — name, description, required and optional parameters.
5. Fill the table of `src/mcp/tools.mjs`: `stack`, `list`, `read`, `create`, `update` → real tool + translation of the arguments. Each choice is justified in one line in `docs/mcp-tools.md`.
6. For `list` and `read`, make a real call on a known rule and note the shape of the response (paging? update date? date filter?).
7. `node scripts/types.mjs`: regenerates `src/mcp/types.mjs` (writable rule classes and their key field) from the plugin's schemas; `npm test` says when it is behind. Note in `docs/mcp-tools.md` the classes that appeared or disappeared.
8. If `list` or `read` have no tool: **stop**, write it in `docs/mcp-tools.md`, and ask (the specification's lead: RAP export as the source of `raw/`).
