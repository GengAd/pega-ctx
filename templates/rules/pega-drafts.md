# pega-ctx drafts

A file of `.pega/drafts/` is exactly what `pega-ctx send` will write to Pega: correct it here, never in Pega.

- `<Name>.json` is what is sent; `<Name>.md` next to it is its digest as it was written, to read instead of the JSON.
- Keep the `"pega-ctx"` header: it names the rule, the operation and, for an update, the version of the rule the draft was written against (`send` refuses if the rule changed in Pega meanwhile).
- After a correction: `pega-ctx lint <id>` (one line per problem, with its line in the file; `ref:` lines for what the draft cites and the mirror lacks), then `pega-ctx send <id> --dry-run` to read the digest again.
- `"$schema"` points to `.pega/schemas/`: the editor underlines what the server would refuse.
- A draft with `steps` is for Dev Studio: a developer applies it by hand; `send` refuses it.
