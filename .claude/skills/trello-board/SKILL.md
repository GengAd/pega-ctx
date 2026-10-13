---
name: trello-board
description: Keep the pega-ctx Trello board up to date. Use it when a build step starts, ends, or when asked where the project stands.
user-invocable: false
---

# pega-ctx Trello board

Board: https://trello.com/b/1sxvcU2k/pega-ctx — `ari:cloud:trello::board/workspace/667c0634da1d339b9d3fc54a/6aca46f0f348dc0d824e797c`

Lists, in order (their names on the board are in French): Backlog → À faire (to do) → En cours (in progress) → Review → Terminé (done). One card per specification step ("1 · Client MCP…" to "7 · Modèles…"), plus the "Mesure" card, then the later numbered cards.

- Step started → card in **En cours**.
- Code written, `npm test` green → commit (see AGENTS.md § Rules), then straight to **Terminé**, with a comment: what is done, what remains, the test results. No stop in Review: the user does not approve card by card.
- The cards to do are all in **À faire**, in the specification's order.
- A blocking point (missing MCP tool, open question) → comment on the card, it stays where it is, and the work goes on with the next card that does not depend on it. Only stop when no card is left that can be done without the user. A possible merge conflict with work that lives elsewhere is not a blocker.

Finding a card: `trelloReadList` `list_by_board` then `get` on the list, never by the short URL.
