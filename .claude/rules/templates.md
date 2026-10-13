---
paths:
  - "templates/**"
---

# Instruction templates

- Square brackets are placeholders: `install` fills `[Pega application name]` and `[version]`, and reports any other `[…]` left in a template as "to complete by hand". A syntax hint goes without brackets: `<Name>` (or `<Type:Name>`), never `<[Type:]Name>`.
- A line about a pega-ctx command goes in both `templates/CLAUDE.md` and `templates/copilot-instructions.md`, and in the skill of its moment (`templates/skills/`).
- `templates/agents/` and `templates/rules/` hold bodies only: `install` writes each agent's frontmatter (`docs/kit.md`). A pega-explorer command added there goes in the hook's `EXPLORER` pattern too (`templates/hooks/pega-ctx.mjs`).
