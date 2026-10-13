# The agent kit written by `install`

One source in `templates/`, rendered per agent by `src/commands/install.mjs`. Formats checked in each agent's documentation on 2026-10-13 (sources at the end).

## What is written

| Template | Claude Code (`--claude`) | GitHub Copilot (`--copilot`) |
|---|---|---|
| `CLAUDE.md`, `copilot-instructions.md` | block between markers in `CLAUDE.md` | block between markers in `.github/copilot-instructions.md` |
| `skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | `.github/skills/<name>/SKILL.md`; not written when both targets are installed: Copilot reads `.claude/skills/` too, and the same names twice would collide |
| `agents/pega-explorer.md` (body only) | `.claude/agents/pega-explorer.md`, frontmatter `name`, `description`, `tools: Bash`, and a `PreToolUse` hook on `Bash` (`explorer` mode) | `.github/agents/pega-explorer.agent.md`, frontmatter `name`, `description`, `tools: ['execute/runInTerminal', 'execute/getTerminalOutput']` |
| `rules/pega-drafts.md` (body only) | `.claude/rules/pega-drafts.md`, `paths: .pega/drafts/**` | `.github/instructions/pega-drafts.instructions.md`, `description` and `applyTo: ".pega/drafts/**"` |
| `hooks/pega-ctx.mjs` | `.claude/hooks/pega-ctx.mjs`, wired in `.claude/settings.json` | not written |

The block keeps its markers: `install` replaces only it. Every other file of the kit belongs to pega-ctx (names start with `pega-`) and is rewritten by each `install`; brackets are filled as in the block.

## Claude Code hooks

`.claude/settings.json` is merged: the permission `Bash(pega-ctx *)` added once, the hooks whose command names `.claude/hooks/pega-ctx.mjs` replaced, every other entry kept. A file that is not JSON is left as it is and `install` says so (code 1).

- `PreToolUse`, matcher `^(Read|Grep|Glob|Bash)$|^mcp__.*__(get-rule|get-rule-resolve-handle|list-rules|search-rules)$` (a regex: the Pega plugin's tools are named `mcp__plugin_<plugin>_<server>__<tool>`, and another installation names its server otherwise): exit 2 with what to run instead for a Pega MCP read tool, or for a path or command that reaches `.pega/raw/` (either slash). `pega-ctx rule <id> --raw` stays allowed.
- `SessionStart`: `pega-ctx check`; its stdout joins the session's context. pega-ctx missing from the PATH gives one line, never a failure.
- The explorer agent's own hook (`explorer` mode, frontmatter of the agent): only `pega-ctx search | rule | around | model | stack | check | overrides`, without `--raw` nor shell operators. Claude Code runs a project agent's frontmatter hooks once the folder is trusted.
- Exec form everywhere (`command: node`, `args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/pega-ctx.mjs", "<mode>"]`): no shell, so the same on Windows, where a shell-form command would go through Git Bash or PowerShell.

## Left out, and why

- **Copilot prompt files** (`.github/prompts/*.prompt.md`): skills cover the same moments, and work in VS Code, Copilot CLI and the cloud agent with the same `SKILL.md` as Claude Code.
- **Copilot hooks**: not written; their format differs per harness and was not tried on a real session.
- **`--agents-md`** (Cursor, Codex read `AGENTS.md`): not done yet.
- Nothing of the kit has run in a real Claude Code or Copilot session yet: Trello card 19 measures it.

## Sources

- Claude Code: hooks (`code.claude.com/docs/en/hooks`: settings structure, exit 2, matcher regex, `mcp__` names, `SessionStart` stdout, `${CLAUDE_PROJECT_DIR}`, exec form and Windows shells), subagents (`/docs/en/sub-agents`: location, frontmatter, `hooks`), skills (`/docs/en/skills`: location, frontmatter).
- VS Code Copilot: custom instructions (`code.visualstudio.com/docs/copilot/customization/custom-instructions`: `applyTo`, `description`), custom agents (`/custom-agents`: `.github/agents/*.agent.md`, `tools`), agent skills (`/agent-skills`: `.github/skills`, `.claude/skills`, name rules), tools reference (`/docs/agents/reference/tools-reference`: `execute/runInTerminal`).
