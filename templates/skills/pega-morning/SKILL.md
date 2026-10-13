---
name: pega-morning
description: Brings the .pega/ mirror of the Pega application up to date and says what changed and what is inconsistent. Use at the start of a working session, or when asked what changed in Pega.
---

# Start of session

1. `pega-ctx sync`: reads again what changed in Pega. Its summary lists the rules added (`+`), changed (`~`) and removed (`-`).
2. `pega-ctx check`: missing references, orphan rules, drafts waiting in `.pega/drafts/`.
3. Tell the user, in a few lines: what changed since the last sync, the drafts waiting, and each `check` line with its fix.
4. A sync that cannot reach Pega: `pega-ctx doctor`, and give the user its `problem` lines.
