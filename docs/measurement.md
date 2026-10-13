# Measurement scenario: with and without pega-ctx

One request, made twice on the same Pega application: once with the Pega MCP alone, once with pega-ctx. We compare what it costs and what it produces. The scenario stays small on purpose, so it can be run again after each important step.

## The task

Application `Test` (Constellation), which already has a case type `GetInfo`. The prompt, identical in both conditions, word for word (the runs of 2026-10-11 used it in French, as quoted here):

> Crée un case type « Demande d'attestation » dans l'application courante. Deux stages : Saisie puis Validation. Dans Saisie, une étape qui collecte trois champs : Nom, Prénom, Motif (texte libre). Inspire-toi de GetInfo pour les conventions. Travaille dans la branche `<BRANCH>`.

In English: create a case type "Certificate request" in the current application; two stages, Saisie (entry) then Validation; in Saisie, a step that collects three fields: Nom, Prénom, Motif (last name, first name, free-text reason); follow GetInfo's conventions; work in branch `<BRANCH>`.

`<BRANCH>` changes at each run (`MESA1`, `MESA2`, `MESB1`…): no run sees another's work, and nothing is written outside a branch.

## The two conditions

| | A: without pega-ctx | B: with pega-ctx |
|---|---|---|
| Session tools | plugin `pega-infinity-authoring` (MCP and skills) | `pega-ctx` as a CLI, `templates/CLAUDE.md` copied into the project; the Pega plugin is **disabled** in the session (pega-ctx launches the server itself) |
| Reading | `get-rule`, `search-rules`…: the raw rule enters the context | `search`, `around`, `rule`: digests |
| Writing | `create-rule` / `update-rule` | `pega-ctx create --from … --dry-run`, then without `--dry-run` |
| Preparation | none | `pega-ctx sync` before the session (no model, no token) |

The rest is identical: same model, same effort, new session (`/clear`), same empty working folder apart from what the condition requires. **Three runs per condition**: a single one says nothing, the gap from one run to the next is as large as the gap between conditions.

**Runs one at a time, never in parallel**, alternating A1, B1, A2, B2… Whatever a run leaves behind, the next one would see:

- **In Pega**: a branch added to the application is visible to every session (search, resolution). And the six runs create the same class: `create-case` would run another branch's version. After the scorecard, remove the branch from the application, or delete it, before the next run.
- **In B's mirror**: `create` refreshes `.pega/` with what it just wrote. Keep a copy of `.pega/` made before B1, **outside the working folder**, and restore it before each B run.
- **In Claude Code's memory**: a session can write to `~/.claude/projects/<folder>/memory/`, and the next one reads it. Empty it after each run.

B is only fully possible after step 5 (`create`). After step 4, B' can be run: reading through pega-ctx, writing through the MCP. That already measures the reading part.

### Course of a run

Preparation, once: the six branches `MESA1` … `MESB3` created empty in Pega and added to the application; in B's folder, `pega-ctx sync`, `install --claude`, the "Project conventions" block removed (A gets none), then a copy of `.pega/` outside the folder.

1. The person measuring opens a new session in the condition's folder and pastes the prompt. They answer the session's questions without adding anything. In B, `templates/CLAUDE.md` asks for the plan to be approved: a "yes" counts as a nudge, it is the cost of the product as it is.
2. Session finished: `node scripts/trial.mjs <A1|B1…> --folder <condition folder> [--ref <copy of .pega>]`, from the repository root. The script computes the cost, runs the scorecard on `MES<run>`, fills the table row, stores the detail outside the repository (`<parent of the folder>/results/`), empties Claude Code's memory and, for B, restores the mirror.
3. Points 7 and 8: read in the transcript, scored in the row.
4. The run's branch is deleted in Pega: no MCP tool does it.

## What we measure: cost

Everything is read from the session transcript (`~/.claude/projects/<project>/<session>.jsonl`, `usage` field of each response), not from an estimate:

| Measure | Source |
|---|---|
| input tokens, of which written to cache and read from cache | `usage.input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` |
| output tokens | `usage.output_tokens` |
| cost in dollars | the tokens above × the model price (cache write 1.25× or 2× the input depending on its duration; cache read 0.05× on Opus 5.5, 0.1× on most others) |
| share of tool results | size of the session's `tool_result` |
| number of tool calls, of human nudges, duration | transcript |

`node scripts/session-cost.mjs <session.jsonl | session id> [--tools]` reads the transcript, subagents included, and prints these measures, the session's start time and the "Results" table row to complete. `--tools` details calls and result size per tool: that is where the gap between `get-rule` and the digests shows. Nudges are counted per message sent (`promptId`) minus the initial prompt. The script is not part of pega-ctx: it lives in `scripts/`, outside the CLI.

## What we measure: quality

A scorecard out of 8, checked on Pega after the session by `node scripts/scorecard.mjs <BRANCH> --since <start of the session>`, run from the repository root. The script goes through the MCP and checks points 1 to 6. The last two are scored by hand. Point 6 creates a case (`--no-case` skips it); `--case-only <Class> --fields A,B,C --verbose` runs it alone on an existing case type.

Limits of point 5: `D_pxListRules` dates neither classes nor case types (only creation, in the `pzInsKey`). A class created outside the branch, or an existing case type changed outside the branch, is not seen. Branch rules are visible through `D_pxListRules`, ruleset `<ruleset>_Branch_<BRANCH>` (seen on 2026-10-11). `--class` targets a class when the branch holds several.

The eight points:

1. A `Rule-Obj-CaseType` exists in the branch, on a new class under `<Org>-Test-Work-`.
2. The stages are Saisie then Validation, in that order.
3. The three properties exist, with the right type (text), on the case type's class.
4. An entry view shows these three fields.
5. No rule written outside the branch.
6. **The case runs**: `create-case` on the new type, then `get-assignment`, shows the three fields. A case type that does not run is worth 0 on this point, even if everything else is there.
7. `GetInfo`'s conventions are followed: shape of the class, flow and view names, French labels.
8. Each warning returned by `create-rule` / `update-rule` was reported to the user.

We also note the number of human nudges it took to finish: a session that stops asking for help costs little, but has not finished.

## What we already know (measured on 2026-10-10)

- The definitions of the Pega MCP's 27 tools are about 31,000 characters, roughly 8,000 tokens. The Claude Code client can defer them (loaded on demand). A client that does not, like Copilot, pays them on every request of the session. In B, this cost disappears: the plugin is disabled.
- The application's 32 rules, in full TOON, are 155,000 characters, about 40,000 tokens. A View weighs 2 to 5 k characters, a FlowAction 5 to 21 k, a Flow 9 to 15 k. Understanding `GetInfo` in A means reading at least the case type, its flows, its flow actions and its views. That is about 70,000 characters, each time the model reads again.
- The specification aims at a digest ten times smaller than the raw rule. `pega-ctx measure` says so from step 3.

## Hypotheses

- B costs clearly less in input tokens. The gap comes from reading (raw rules against digests) and from the tool definitions.
- B does at least as well on the scorecard. Starting from `GetInfo` as a template (`--from`) should improve point 7, and `--dry-run` points 3 and 4.
- If B costs less but misses point 6 more often, pega-ctx saves tokens at the expense of correctness: it is the result that matters most.

## Results

The runs below used the French version of pega-ctx (commands `creer`, `--comme`…); the English version renames them without changing their behaviour.

| Run | Input tokens | of which cache read | Output tokens | Cost $ | Tool calls | Nudges | Scorecard (1-6 auto + 7-8) | Case runs |
|---|---|---|---|---|---|---|---|---|
| A1 | 3040319 | 2906454 | 18384 | 1.30 | 59 | 1 | 1/6 + 2/2 | no (branch not resolved by Pega) |
| A2 | 2916672 | 2772769 | 17069 | 1.30 | 59 | 1 | 6/6 + 2/2 | yes |
| A3 | 1749117 | 1617943 | 14160 | 0.99 | 48 | 0 | 6/6 + 2/2 | yes |
| B1 | 1342577 | 1303104 | 11257 | 0.53 | 24 | 2 | 5/6 + 0/2 | yes |
| B2 | 1356036 | 1317847 | 11255 | 0.53 | 26 | 1 | 6/6 + 2/2 | yes |
| B3 | 1175857 | 1140318 | 10169 | 0.47 | 21 | 2 | 6/6 + 1/2 | yes |

First runs, on 2026-10-11, set aside: A1 (Sonnet 5.5, $1.13, 51 tool calls, 0 nudges) could not be scored, its rules having been deleted before the scorecard; B1 failed, `pega-ctx creer` not yet knowing how to create a class (`Branch ruleset not candidate`). Fixed since: Class type, `--champs` (now `--fields`), `--renommer` (now `--rename`), types fixed. Second A1 kept, with its caveat: the rules of the recreated branch MESA1 did not resolve (the case type could not cite its flow), although the branch is in the application's branch list: cause on the Pega side, see `docs/mcp-tools.md`.

Notes on the runs:

- **A1**: 7 ✓ (English names like GetInfo, `<Case>Start`, `Collect…`, French labels); 8 ✓ (branch context warning reported). One nudge: answer to its question about adding the branch.
- **B1**: contaminated by A1, whose branch had not been deleted. The class `DemandeAttestation` was taken in MESA1: second nudge to choose another name. Point 5 ✗ comes from a `FieldValue pyStatusWork` on B1's class created in MESA1's ruleset, which the session did not write (generated by Pega in the application's first branch). 7 ✗ (properties in French, GetInfo names them in English; class label technical, the patch's `description` key having been ignored); 8 ✗: `creer` did not show the server's warnings. Fixed before B2: `creer` and `modifier` show the Pega warnings, refuse a patch key outside `py…`/`px…`, and the templates ask for warnings to be reported. B2 and B3 therefore run on this version.
- **A2**: 8/8. 7 ✓ (`AttestationRequest`, `LastName`/`FirstName`/`Reason`, `AttestationRequestStart`, `CollectAttestationRequest`, French labels); 8 ✓ (branch warning and "No description" reported). One nudge: the empty branch is not visible before the first write, the session asked whether it existed.
- **B2**: 8/8. 7 ✓ (`AttestationRequest`, `LastName`/`FirstName`/`Reason`, `AttestationStart`, `CollectRequest`, French labels); 8 ✓ (the branch warning of the 8 writes reported as is). One nudge: the "yes" approving the plan. One property attempt refused by Pega (`pxText` does not exist), redone with `pxTextInput`.
- **A3**: 8/8. 7 ✓ (`DemandeAttestation`, `LastName`/`FirstName`/`Reason`, `DemandeAttestationStart`, `CollectAttestationRequest`, French labels); 8 ✓ (branch warning reported). No nudge: the session wrote to the branch without asking whether it existed.
- **B3**: 7/8. Contaminated by A3: a class `DemandeAttestation` left in MESA3 blocked the first creation, second nudge to choose another name (`AttestationRequest`). 7 ✗ (properties in French, GetInfo names them in English; default class labels); 8 ✓ (warning of the 8 writes reported). The session itself points out that `--champs` knows neither the multi-line text area nor the required field.

## Conclusion (2026-10-11, Sonnet 5.5)

| Average over 3 runs | A: MCP plugin alone | B: pega-ctx | Gap |
|---|---:|---:|---:|
| Cost | $1.20 | $0.51 | ×2.3 |
| Input tokens | 2.57 M | 1.29 M | ×2 |
| Output tokens | 16.5 k | 10.9 k | ×1.5 |
| Tool calls | 55 | 24 | ×2.3 |
| Tool results read | ~225 k chars | ~28 k chars | ×8 |
| Nudges | 0.7 | 1.7 | |
| Scorecard | 19/24 | 20/24 | |
| Case runs | 2/3 | 3/3 | |

- **Hypothesis 1, confirmed**: B costs 2.3 times less. The gap comes from what enters the context, not from the number of requests (about twenty in both cases): in A, two thirds of the tool results are the server's skills (`get-skill`, ~150 k characters per run, the manual of the rule types), the rest raw rules (`get-rule`, ~40 k). In B, the digests and the outputs of `creer` fit in ~28 k. Each request reads this context again: the cost follows.
- **Hypothesis 2, narrowly confirmed**: B does at least as well (20/24 against 19/24), with two caveats pulling in opposite directions. A1 loses 5 points on a Pega problem (recreated branch not resolved); B1 and B3 lose on contamination (class already taken in the A branch left in place) and B1 ran before the warnings fix. On the clean runs, A2, A3 and B2 score 8/8. Point 7 is the most fragile in B: two runs out of three named the properties in French, where GetInfo names them in English; `--comme` (now `--from`) copies the template's shape, not its naming convention.
- **Hypothesis 3, ruled out**: B does not miss point 6. The case runs on all three B runs; the only failure is A1, for an environment cause.
- **Nudges**: B counts one more by construction (the templates ask for the plan to be approved before writing); the others come from contamination between runs, not from pega-ctx.

Seen during the measurement, and handled since: `--fields` takes `Prop:TextArea` (multi-line) and `Prop:required`; `create` adds a `convention:` line for a class created without `--label` and for a name or a label that departs from how the neighbouring rules are named (`.pega/conventions.md`, step 25).

Limits: three runs per condition, a single model, a single task; B1 on an earlier version of `creer`; two B runs contaminated by an A branch that was not deleted. The per-run detail (tools, scorecard) is outside the repository, it carries the application's real names.
