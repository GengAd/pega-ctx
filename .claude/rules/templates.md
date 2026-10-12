---
paths:
  - "templates/**"
---

# Instruction templates

- Square brackets are placeholders: `install` fills `[Pega application name]` and `[version]`, and reports any other `[…]` left in a template as "to complete by hand". A syntax hint goes without brackets: `<Name>` (or `<Type:Name>`), never `<[Type:]Name>`.
- A line about a pega-ctx command goes in both `templates/CLAUDE.md` and `templates/copilot-instructions.md`.
