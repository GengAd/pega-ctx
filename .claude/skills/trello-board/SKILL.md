---
name: trello-board
description: Keep the pega-ctx Trello board up to date. Use it when a build step starts, ends, or when asked where the project stands.
user-invocable: false
---

# pega-ctx Trello board

Board: https://trello.com/b/1sxvcU2k/pega-ctx — `ari:cloud:trello::board/workspace/667c0634da1d339b9d3fc54a/6aca46f0f348dc0d824e797c`

Lists, in order (their names on the board are in French): Backlog → À faire IA (to do, no user needed) → À faire avec humain (to do, needs the user) → En cours (in progress) → Review → Terminé (done). One card per specification step ("1 · Client MCP…" to "7 · Modèles…"), plus the "Mesure" card, then the later numbered cards.

- "Take the next card without me" = the first card of **À faire IA**, top to bottom.
- Step started → card in **En cours**.
- Code written, `npm test` green → commit (see AGENTS.md § Rules), then straight to **Terminé**, with a comment: what is done, what remains, the test results. No stop in Review: the user does not approve card by card.
- A card goes to **À faire IA** when it can be finished without the user (a Pega check on the test server counts as without the user), to **À faire avec humain** otherwise, with a comment saying what the user must bring. A card with one small part for the user (a publish, a decision at the end) stays in À faire IA, the part named in a comment.
- A blocking point (missing MCP tool, open question, the user's decision) → comment on the card saying what is awaited, move it to **À faire avec humain**, and go on with the next card of À faire IA. Only stop when À faire IA is empty. A possible merge conflict with work that lives elsewhere is not a blocker.

Finding a card: `trelloReadList` `list_by_board` then `get` on the list, never by the short URL.
