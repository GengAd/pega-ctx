@AGENTS.md

## Guardrails hook

`.claude/hooks/guardrails.mjs` reads the raw text of every Bash command: `npm install` / `npm i` followed by anything but `@modelcontextprotocol/sdk` is refused, even inside a heredoc, a Python script or a commit message. Write such text with Edit/Write, and phrase commit messages without it.

## Pega environment

- Target: `https://cap-cs-crm-261.pegademo.com` (root, without `/prweb`), Infinity 26.1 (plugin version `26-1`), standard OAuth client.
- The target application (`Test`) is Constellation: its interface is made of `Rule-UI-View` views (type `View`), no `Section`. No When, DecisionTable or Validate in the application.
- The connection is configured in `~/.infinity-rules-mcp/config.json`, outside the repository — never in the project. That file takes precedence over the `/plugin` values.
- The MCP server does not reload that file live: after a change, reload the plugin (`/reload-plugins`) or restart the session.
- The server writes `.infinity-rules-mcp/` (OAuth tokens) and `logs/` in its launch folder: ignored by git, never read.
- The trial rules of card 15 sit in branch `TYPES1` (`PegaCtxTrial*`, class `…-Work-PegaCtxTrial`): no MCP tool deletes a rule or a branch, and creating the same name again fails with "This instance already exists". A new branch is not seen by `list()`, but `get-rule` / `update-rule` work with the `pyRuleInsKey` that `create-rule` returns.
- Fixture rules for a type the application lacks (card 17): create a server example (`pluginExamples` + `prepareCreation` + `create` of the client) in a fresh test branch, then read it back with the returned `pyRuleInsKey`. A richer example (`pega-ctx examples <Type>`) beats the stub, which often comes back empty; a stub Pega refuses usually passes once its placeholders name the application's rules (activity `SaveHouseholdPeople`, class `…-Data-People`, table key `.pyGUID`). `TYPES2` and `TYPES3` hold the `PegaCtxFx*` ones: next branch `TYPES4`. The branch is invisible to `list()`: the `list.jsonl` row is built from the raw rule (base ruleset, `available` only if the raw has `pyRuleAvailable`). A rule with no class (`EditValidate`) goes in `tests/fixture/raw/<Type>/_/`, id `Type::Name`. A new fixture rule changes the counts asserted in `tests/commands.test.mjs` and `tests/write.test.mjs`; run `node scripts/example.mjs`.
- Trying pega-ctx on the real server: run `node` from the repository root (the OAuth session is there) and pass a scratchpad folder as `root` to `launch()` (`src/commands/index.mjs`). The real `.pega/` carries non-anonymized names: never in the repository.
