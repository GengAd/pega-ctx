# The mirror as built

What `src/mirror/` and the commands add to, or specify beyond, the specification (`pega-ctx.md` § The mirror, § The commands).

## `.pega/config.json`

```json
{ "mcp": { "source": "plugin" }, "application": "Test", "rulesets": ["Test"], "write": { "byClass": [{ "prefix": "MONORG-Test-", "ruleset": "Test:01-01-01" }], "default": null }, "branch": null, "lastSync": "2026-10-10T15:30:00.000Z" }
```

- `mcp.source: plugin`: the MCP command is read again from the Pega plugin's `.mcp.json` at each launch. A path fixed in the config would break when the plugin is updated. The plugin folder is the environment variable `PEGA_CTX_PLUGIN` (machine-specific, so not in the shared config), otherwise Claude Code's plugin cache.
- `rulesets`: followed by `sync`. `init --ruleset A,B`, otherwise the rulesets of the current application (`stack()`). Empty: everything `list()` returns.
- `branch`: optional, the default branch of `create` and `update`.
- `types`: optional, rule classes followed on top of the known types (`["Rule-Declare-Expressions"]`); their short name is built from the class (`Expressions`). `docs/mcp-tools.md` § Pega types and classes.
- `write`: where new rules go, by class. `byClass` is an ordered list of `{ prefix, ruleset }`, the first matching prefix wins; `default` (may stay `null`) applies to a class that nothing else covers. A prefix ending with `-` covers every class that starts with it (`MyOrg-App-`); otherwise it covers the class itself and its children by name. Extra keys in an entry (`rules`, `classes`) are ignored. Decision: `docs/decisions/0006-write-ruleset-per-class.md`.

## Where a new rule is written

`stack()` does not say which ruleset is unlocked, and a layercake has several applications with several rulesets each: the write ruleset depends on the class (`src/mirror/write.mjs`).

- **Resolution**, by `create` and `stack --for`: `--ruleset`, then the first prefix of `write.byClass` that matches the class, then the rulesets of the class's own rules in the mirror (a branch ruleset `Test_Branch_US42` counts as `Test`; the highest version seen), then `write.default`. No candidate, or a class whose rules sit in several rulesets: `create` returns code 1 with the candidates, `stack --for` says "unknown" or "ambiguous". There is no model in the loop: refusing is how pega-ctx asks, and the installed instructions tell the model to ask the user.
- **Draft**: each `sync` rewrites `.pega/write.draft.json` from the index, in the shape of `write` plus `rules`, `classes` and an `ambiguous` list. Each class with a single ruleset gets the most general prefix, two name segments at least (`MyOrg-App-`), that only covers classes of that same ruleset in the mirror; classes with several rulesets are listed under `ambiguous`, without an entry. The draft is never used as is: a human, or the model with them, keeps, corrects and completes it, then copies it as `write`. It is the part of the context written together.
- **`stack.md`** ends with the rulesets seen in the mirror: highest version, number of rules, classes, and whether the ruleset belongs to the current application or to a built-on one (the server does not say which built-on).

## Index line

The specification's one, plus `by` (operator of the last update, for the digest header). `updated` is absent for a CaseType: `list()` does not give it.

```json
{"id":"Flow:MONORG-Test-Work-GetInfo:GetInfoStart","type":"Flow","class":"MONORG-Test-Work-GetInfo","name":"GetInfoStart","rulesets":["Test:01-01-01"],"description":"Créer GetInfo et saisir le répondant","updated":"2026-10-08T14:49:31.244Z","by":"dev.un","refs":["FlowAction:MONORG-Test-Work-GetInfo:CollectRequester"]}
```

`refs`: the targets of all the rule's edges, sure and probable, after resolution. Descriptions are the application's own labels, here in French.

## Graph

- An edge carries `stage` when it goes from a CaseType to the flow of a process: `around --stage` uses it.
- **Resolution**: a reference carries the class of its context. It becomes the identifier of an index rule of the same type and name, in the same class or the closest parent class by name (`@baseclass` last). A DataPage resolves by its name alone. Without a match, the reference keeps its context identifier and `check` reports it missing.
- Edges sorted by source rule, in the projection's order (stages, shapes).

## `sync`

- One `list()` per type of `TYPES` except rulesets and branches, plus `types` of the config (no ruleset filter on the server side), filtered by `rulesets` on the pega-ctx side. A type in error does not stop the others; its rules stay in the mirror.
- A rule is read again if: `--full`, absent from the index, raw rule absent from `raw/`, `updated` different from the index, `updated` absent (CaseType: read every time), or `updated >= --since`. Read again but identical: not counted as changed.
- Several versions of the same rule: the highest is read; `rulesets` lists them all, the digest shows them as `(also: …)`.
- Removed: absent from `list()` while its type was listed (and, with `--ruleset`, it belongs to that ruleset).
- Index, graph and digests are recomputed entirely each time (`src/mirror/rebuild.mjs`). `## Cited by` is added to the digest then; if the digest then exceeds a hundred lines, it is projected again with room reserved.
- Measured on the test application (32 rules): 23 s from empty, 16 s without change, almost all of it in `list()`.

## `live`, `create`, `update`

- `live` reads the rule again (`list({type, class})` then the name ignoring case, the highest version), rewrites its raw rule, its digest, its index line and its outgoing edges. The `## Cited by` of other digests wait for the next `sync`. A rule outside the mirror is given by its full identifier: `live` adds it.
- `create --from example[:name]` (default `stub`) starts from an example of the server's skill for the type instead (`pega-ctx examples <Type>` lists them): for a type the application has no rule of yet. The example's class (`MyOrg-MyApp-Work-MyCase`, `Work-`) is replaced by the new class at any depth, like a sibling's; `pxObjClass` is added; the example's notes are shown after the digest.
- `create` starts from the raw rule of `--from` in `raw/` (same type required), removes persistence (`src/projection/persistence.mjs`; the `pz*` fields the type's schema declares as content stay), renames the key and the fields that held the old name (not `pyViewReference`), sets the class and `pyLabel` (`--label`, otherwise the name), then merges `--patch`: objects merged, arrays replaced, `null` removes. A patch touching a persistence field is refused.
- `update` first runs a `live` (the patch applies to Pega, not to the mirror), then `update-rule` with `listUpdateMode: replace` and the patch as is.
- `--draft` (create, update) writes `.pega/drafts/<Type>/<Class>/<Name>.json` instead of sending: `{ "pega-ctx": header, "content": … }`. The header holds `operation`, `id`, `type`, `ruleClass`, `reason`, `branch` if given, and for `create` `ruleset`, `write` (resolution and its source), `from`; for `update` `key` and `basedOn`, a fingerprint (sha256, 16 characters) of the raw rule the patch was written against. `content` is the create-rule content, or the update-rule patch. A string holding a JSON object or array (`pxViewMetadata`, `pxContextMetadata`, at any depth) is unfolded as an object and its JSON pointer listed in `unfolded`; `send` folds it back. Fields ordered: `pxObjClass`, the type's key fields, `pyClassName`, `pyRuleName`, `pyLabel`, `pyDescription`, then the rest as in the template (`src/mirror/draft.mjs`).
- `send` reads the draft as it is (corrected by hand or not), checks its top-level fields (prefix `py`/`px`, since real rules hold lower-case fields like `pyconfirmchoice`; none managed by Pega), sends it, runs `live`, deletes the draft. A create draft of a rule already in the mirror is refused. An update draft whose `basedOn` no longer matches the rule read in Pega is refused unless `--force`. `--dry-run` shows the digest, from the mirror's raw rule for an update.
- **Draft for Dev Studio** (`src/commands/manual.mjs`): for a type the Pega MCP cannot write (no schema: `Section`, any class added through `types`), `create` and `update` refuse to send but still write the draft with `--draft`, in the same format. Its header adds `manual` (why it will not be sent), `steps` (Save As from `from` with name, class, ruleset and branch, or open the rule; give the fields their values; `live`, delete the file) and, for a creation, `changed`: the JSON pointers where `content` differs from the template without persistence, apart from `pxObjClass`, `pyClassName`, `pyRuleName`, `pyStreamName`, which Save As sets. A creation renames through `pyRuleName` and `pyStreamName` only, since there is no key from a schema. `send` refuses such a draft (`--dry-run` still shows its digest) and `check` lists it as waiting for a developer.
- **Lint** (`src/lint/`), run by `create`, `update`, `send` and `lint`: the content is checked against the server's schema for its type (`src/mcp/schemas.mjs`, `pluginSchemas`), after `fitTypes` turned `"10"` / `"true"` into numbers / booleans where the schema expects them. For an update, the rule after the patch is checked; an error outside the patch is a warning (`already so in Pega`). Plus: fields managed by Pega (persistence list at the top level, `pz*` at any depth), and `x-pega-autoDerived` fields whose value differs from their source (warning: the server replaces it). A required field with `x-pega-autoFill` may be absent: the server fills it. A sub-schema with `x-pega-condition` fails with that sentence. Without the plugin, a warning and pega-ctx's checks only. An error stops the write unless `--no-lint`; the drafts show the line of each finding.
- **`$schema`**: each draft starts with a path to `.pega/schemas/draft-<schema>.json`, a wrapper whose `content` refers to a copy of the server's schema (`src/lint/editor.mjs`). The copy has no `$id`; a field described as JSON-stringified also accepts an object or an array (the draft shows it unfolded); the copy for an update draft (`update-<schema>.json`) requires no top-level field.
- Without `--dry-run`, `--branch` is required (or `branch` in the config): the server only writes to a branch. `--reason` gives the `changeDescription` (200 characters at most).

## `check`

Orphans are looked for among Section, View and DataTransform. A `pyEdit` or `pyReview` View is called by convention by Pega, not by a rule: it shows as an orphan, rightly from the mirror's point of view.
