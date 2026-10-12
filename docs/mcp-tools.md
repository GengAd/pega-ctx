# Pega MCP tools

Plugin `pega-infinity-authoring` 0.1.7, server `infinity-rules-mcp.jar` (profile `stdio`), Infinity 26.1. Discovery of 2026-10-10 on a test Constellation application.

## Launch

Read from the plugin's `.mcp.json` (`src/mcp/client.mjs`, `commandFromPlugin`): `java -jar ${CLAUDE_PLUGIN_ROOT}/resources/infinity-rules-mcp.jar --spring.profiles.active=stdio`, env `PEGA_SKILLS_PATH`, `PEGA_CLIENT_MODE`. The `${user_config.*}` variables (`PEGA_BASE_URL`, `PEGA_OAUTH_CLIENT_ID`) are not passed: the server reads `~/.infinity-rules-mcp/config.json` itself. It writes its OAuth tokens in `.infinity-rules-mcp/` of the launch folder: launched from the project root, it reuses the existing session.

## Server code

What the MCP server checks itself, before calling Pega, is read in its jar, without writing anything: unzip `<plugin>/resources/infinity-rules-mcp.jar` into a scratch folder, then `javap -v` on `BOOT-INF/classes/com/pega/mcp/tools/<Class>.class` lists its messages and `javap -c -p` its logic. `RuleWriteService` holds `create-rule`, `update-rule` and `copy-rule`. What Pega does with a call that passes those checks still needs the real server.

## Response format: TOON, not JSON

No tool returns `structuredContent`: everything arrives as text in **TOON** format (indented objects, `key[N]: a,b`, tabular arrays `key[N]{c1,c2}:` followed by N rows, `- ` lists, quoted strings with JSON escapes), ending with a line `[api: … ms | processing: … ms]`. `src/mcp/toon.mjs` decodes it; it passes on every rule of the test application (32 rules, 9 classes). Exception: `list-rules` returns free text ("Found N rules…"), not used.

**The raw rule stays in TOON.** `read()` returns the text as is, without the `[api: …]` line that changes on every call. `raw/` and the fixture store it as `.toon`, and the projection decodes it in memory. Reasons: no conversion on write; a decoder bug is fixed without reading Pega again; the format is already compact. Only `create` and `update` send JSON, because `create-rule` and `update-rule` require it.

Values that Pega stores as strings arrive quoted (`"false"`, `"01-01-01"`, `"0"`) and stay strings after decoding.

## Abstract → real table (`src/mcp/tools.mjs`)

| Operation | Tool | Why |
|---|---|---|
| `stack()` | `get-application` without argument, then `get-rule` on each application rule | `get-application` gives application, version, one `RuleSet`, `DependsOn` (built-on), `IsConstellationApp`; it only reads the operator's applications (`Constellation 01.01` refused). The climb reads `get-rule RULE-APPLICATION <NAME> <VERSION>` instead, which works beyond the operator's applications: `pyRuleSetList` (every ruleset with its major-minor version, in resolution order, branch rulesets first, then the application's, then the organization's), `pyDependsOnList` (`pyAppName`, `pyAppVersion`), depth first. Still unknown: which ruleset is unlocked. |
| `list({type, class?, name?, application?})` | `run-data-page` on `D_pxListRules` (`dataPageType: list`) | Only path that returns `pxUpdateDateTime` and `pxUpdateOperator` per rule, as a tabular array. `list-rules` queries the same data page but returns text without a date; `search-rules` has no date either. |
| `read(key)` | `get-rule` `detail: full`, returned as cleaned TOON | The full raw rule. `summary` is a server-side projection (flow shapes, connectors) without the references, unusable as raw rule. |
| `create({type, content, branch, description, ruleset?})` | `create-rule` | The only creation tool. **Requires a branch** (`branchID`) and a `changeDescription`. Not called during discovery (write). |
| `update({key, patch, branch, description})` | `update-rule`, `listUpdateMode: replace` | The patch replaces whole arrays, as the specification wants for `create --patch`. Requires a branch. Not called during discovery. |

### `list`: what `D_pxListRules` returns

- Parameters in `dataViewParameters`: `ruleTypeClass` (required), `appliesToClass`, `ruleName`, `applicationNames`, `pageNumber`, `pageSize`. The body's `paging` block is ignored; paging goes through `dataViewParameters`.
- **One rule class per call**: `Rule-Obj-Flow,Rule-UI-View` and the prefix `Rule-` are refused (error 500). `sync` makes one call per type.
- Without `applicationNames`, only the current application.
- **No filter by date or ruleset.** Incremental sync by comparing `pxUpdateDateTime` with the index; ruleset filter on the pega-ctx side (`pyRuleSet`).
- Columns (the order varies from one call to the next, the decoder reads the header): `pxObjClass`, `pyRuleAvailable`, `pxInsName`, `pyRuleName`, `pyClassName`, `pxUpdateDateTime`, `pzInsKey`, `pyLabel`, `pxUpdateOperator`, `pyRuleSet`, `pyRuleSetVersion`, `pxInsId`.
- `Rule-Obj-CaseType`: no `pyRuleName`, only `pxInsName` in upper case (`CLASS!PYDEFAULT`). The provisional identifier is `CaseType:<Class>:PYDEFAULT`; the real name (`pyDefault`) is in the raw rule, `sync` must take it from there.
- `Rule-Obj-CaseType`: the row has no `pyRuleSet`, `pyRuleSetVersion`, `pxUpdateDateTime` nor `pxUpdateOperator` either. The ruleset is in the raw rule; **a case type's update date is unknown** (only the instance creation timestamp, suffix `#…` of the `pzInsKey`, gives it): `sync` must read it every time or date it by this suffix.
- A rule present in several ruleset versions returns one row per version, each with its `pzInsKey` (Validate `ValidateGameStart` in 01-01-06 and 01-01-08): for a single identifier, `read` takes the highest version.
- An application's listing includes the rules of its built-on applications (Gameboard returns rules of the `Cvent` ruleset).
- **The stack, read on 2026-10-12 (Trello card 20).** `get-application` with `appName` + `appVersion` reads an application of `list-available-applications` (PegaRULES 8) and refuses any other (`Application 'Constellation' version '01.01' not found in available applications`), with or without an alias. `get-rule` on the application rule reads them all: Test → Constellation 01.01 (`Constellation:01-01`) → PegaRULES 8 (61 rulesets, no built-on). The key takes the version exactly as written in `pyDependsOnList` (`RULE-APPLICATION CONSTELLATION 01.01`); a wrong one answers `pzErrorRuleNotFound`. `get-application` names one ruleset while the application rule lists them all (Gameboard: 10, among them `Cvent`). Through an alias, `get-application` answers for the aliased application.
- `list-available-applications` gives, per application of the operator, its access group (`<App>:Authors`), alias and whether it is switchable: the access groups of the operator only, not every access group of the application.
- **Other application**: `applicationNames` towards an application other than the current one returns an error 500. `set-application-alias` must come first, with the alias from `list-available-applications` (`gameboard`); the alias holds for the server process, `clear-application-alias` removes it. Only the operator's applications with an alias are reachable.
- Classes outside the application (`Rule-Ruleset-Version`, `Rule-Application`) ignore paging and return the whole system.

### `read`: what a full `get-rule` returns

- The key is the `pzInsKey` returned by `list` (`RULE-OBJ-FLOW <CLASS> <NAME> #<timestamp> GMT`). The pega-ctx identifier `Type:Class:Name` resolves to a key through `list({type, class, name})`.
- **No date** in the raw rule (neither `pxUpdateDateTime` nor `pxCreateDateTime`): the mirror's update date comes from `list`. `pxUpdateOperator` is present.
- Persistence families spotted on the Flow: `pzInsKey`, `pzOriginalInstanceKey`, `pzChecksum`, `pzIndexCount`, `pyJavaClassName`, `pyJavaStream`, `pyVisioJpeg`, `pyVisioRFB`, `pzRuleSetVersion*`. Confirmed on the thirteen types of the fixture: `docs/projection.md`.
- Real names besides `pxUpdateOperator`: `pxCreateOperator`, `pxCreateOpName` and `pxCreateSystemID` (server host name) in nested arrays (warnings, conditions), `pxWarningCreateOperator`, `pxWarningJustifiedOperator`, and `pySPRuleSetName` (private ruleset named after the operator, sometimes their email address).

### `create` and `update`: what we know, what remains to check

- **Key field per type**: the field the rule's name comes from, read in its schema (`x-pega-deriveFrom` on `pyRuleName`, or on `pyRuleSet` for rulesets), otherwise the first required name field (`pyActivityName`, `pyStreamName`, `pyPurpose`, `pyRuleName`). Generated in `src/mcp/types.mjs` (`key`) by `node scripts/types.mjs`; a test checks it against the installed plugin. Two key fields (FieldValue `pyFieldName pyFieldValue`, AdminSystemSettings `pyOwner pyPurpose`): the pega-ctx name holds them separated by its first space. CaseType: constant identity `pyDefault`; Class and ClassMetadata: the name is the class. A FlowAction's `pyRuleName` and `pyStreamName` derive from the key.
- **Schema-backed types only.** The server validates each write against a JSON Schema (draft 2020-12, extensions `x-pega-autoFill`, `x-pega-autoDerived`, `x-pega-deriveFrom`) read from disk: `${PEGA_SKILLS_PATH}/<pega_infinity_version>/skills/rules-<class>/schema/<class>.json`, where `PEGA_SKILLS_PATH` is `<plugin>/resources` (plugin `.mcp.json`) and the version comes from `~/.infinity-rules-mcp/config.json`. 37 classes in 26-1. `create-rule` accepts exactly those and refuses the others before Pega (`rule type 'Rule-HTML-Section' is not supported by create-rule … Add schema and builder support for this rule type`, seen on 2026-10-11). `update-rule` and `copy-rule` refuse the same classes, before Pega, with the same sentence (`… is not supported by update-rule`, `… by copy-rule`): read in the server's code (`RuleWriteService`, jar of plugin 0.1.7, 2026-10-12), where `update-rule` takes the class from the key's first word. A type outside the list is therefore never written by pega-ctx: `create --draft` and `update --draft` write a draft for Dev Studio (`docs/mirror.md`).
- **What the schemas use** (counted on the 37 of 26-1): `type` (string, object, array, boolean, integer, once `["string","object"]`), `enum`, `const`, `required`, `properties`, `additionalProperties`, `items`, `$ref` (only `#/$defs/…`), `allOf`, `anyOf`, `oneOf`, `not`, `if`/`then`/`else`, `pattern`, `minLength`/`maxLength`, `minItems`/`maxItems`, `contains`, `minProperties`, `dependentRequired`. Extensions: `x-pega-autoFill` (684, value the server fills in), `x-pega-autoDerived` + `x-pega-deriveFrom` (field recomputed from another one, dropped if sent), `x-pega-condition` (57, the sentence of a rule between fields), `x-pega-hints`. `src/lint/jsonschema.mjs` implements exactly that.
- **Real rules the schemas refuse** (fixture templates checked by `tests/lint.test.mjs`, 2026-10-11): 17 of 20 pass once `"10"`/`"true"` are typed. The other three hold what Pega stores and the MCP's schema rejects: a DataPage whose report definition source lacks `pyLoadReportDefinition`, `pyReportDefinitionClass`, `pyPassCurrentParamPageForActivity`; a ReportDefinition with `pyReportDBType` `AlternateNonReplica` (enum: Standard, Alternate, "") and a base64 `pyContent.ValidationMap` (schema: `""`). Copying them through `create-rule` would be refused.
- **pz\* fields that are content**: some types keep real content in `pz*` fields (Notification `pzRecipients`, AI agent `pzActionTools`, report columns `pzIndexCount`, flow `pzRuleParameters`). A `pz*` property the schema declares **with a type** is content and is kept; DataTransform's schema lists its persistence fields untyped (`{}`) to allow them, and the instance keys (`pzInsKey`, `pzOriginalInstanceKey`) stay persistence (`declaredPz`, `src/projection/persistence.mjs`).
- **Examples** (`rules-<class>/examples/*.md`, read from the plugin by `src/mcp/examples.mjs`): front matter `name` / `description`, one ```json block (a rule without `pxObjClass` nor `pyRuleName`), then notes. Top-level files are complete templates, sub-folders are parts. All 37 skills have top-level examples except `rules-rule-ruleset-version`; all have a `stub` except `rules-rule-ruleset-name` and `rules-rule-ruleset-version`. `create --from example[:name]` starts from one.
- **Stubs refused by their own schema** (2026-10-11, `tests/lint.test.mjs`): prepared by `create --from example`, 32 stubs pass, four do not. AITool: the stub breaks one of its `x-pega-condition` (category `Rule-Obj-Activity` needs `pyAskConfirmation` and `pyIntentActionPage.pyClassName`). ConnectGenerativeAI: `pyGenAIDef`, `pyGenAIConfig`, `pyDescription` required, absent from the stub. TestUnitCase: `pyRuleUnderTest.pyDetails` empty, the stub says to fill it from the sub-examples. UITheme: the schema requires `pyRuleName` to be the constant `Rule-UI-Theme` (most likely a copy of `pxObjClass`) while the stub names its theme `MyAppTheme`, and requires `pyClassName` without declaring it. Seen on the real server on 2026-10-12 (§ Real trial): it refuses three of the four (ConnectGenerativeAI, TestUnitCase, UITheme) and accepts AITool.
- `withTypesFixed` stays as a fallback: the lint types what the schema names before sending, the retry catches what it could not reach (a field under `anyOf` or `if`).
- The skill `rules-rule-declare-decision-table` exists (with a hyphen): DecisionTable is writable, key `pyPurpose`. There is no skill and no schema for `Rule-HTML-Section`.
- `pyRuleSet` / `pyRuleSetVersion` are removed from the content: the branch sets them, the ruleset name goes in the `ruleSet` parameter.
- `create-rule`, seen on 2026-10-11 (measurement runs): on success, TOON `branchID`, `rule.responseData.pyID` and `pyRuleInsKey`, `status: created`, and a `warning` ("the completed branch summary was not updated") returned even when the write succeeds. Invalid content is refused before Pega, with `ERRORS` and `AUTO-FILLED` (e.g. `pyInitialCaseUrgency` expected as an integer).
- **The class must exist before its rules.** Without `ruleSet`, the server takes the ruleset associated with the rule's class. On a missing class, `create-rule` fails with `Branch ruleset not candidate`, with `ruleSet` `Test` as `Test_Branch_<B>`. A new case type therefore starts with a `Rule-Obj-Class` (server skill `rules-rule-obj-class`): `pega-ctx create Class <Class> <Class> --from <sibling class>`.
- The branch ruleset is named `<ruleset>_Branch_<branchID>` (`Test_Branch_MESB1`); `branchID` is the short identifier (`MESB1`).
- **Invisible branch, cause on the Pega side still to find** (2026-10-11, MESA1 deleted then recreated): `create-rule` writes to it, `get-rule` reads it back by key, but nothing appears in `D_pxListRules`, `list-rules` nor `search-rules`, and a rule citing another one of the branch fails (`Unable to open an instance`). The branch is nevertheless in `pyBranchList` of the application rule (`get-rule RULE-APPLICATION <APP> <VERSION>`): that is where to check, not by deduction. No MCP tool adds a branch to the application.
- `D_pxListRules` returns branch rules as soon as they are created, with `pyRuleSet` `<ruleset>_Branch_<branchID>`: `create` and `update` read them back through `list()`. `sync` does not follow them as long as `rulesets` only names the base ruleset.
- `update-rule` seen on 2026-10-11: same response shape as `create-rule`.
- **Server schema**: it refuses before Pega a field that the raw TOON keeps as a string while it expects a number or a boolean (`/pyInitialCaseUrgency: string trouvé, integer attendu`; the server answers in the operator's locale). `create` and `update` convert the paths named in the message and send again once (`withTypesFixed`, `src/mcp/tools.mjs`). The client keeps the full error text in `error.text`.
- **View**: the server recomputes `pxViewMetadata` from `pyContent`; a view is described on its three surfaces (`pyContent`, `pxViewMetadata`, `pxContextMetadata`, skill `rules-rule-ui-view`). `create View --fields` builds them from the mirror's properties.
- End-to-end trial on 2026-10-11: class, three properties, view, flow action, flow and case type created by `pega-ctx create` in a branch, `update` on a property, then `create-case`: the assignment shows the three fields.

### Real trial, type by type (2026-10-12, Trello card 15)

For each writable type: `create --from example --draft`, lint, `create-rule` in a test branch, `update-rule` of `pyDescription`, `get-rule` by the returned `pyRuleInsKey`. Class `<work class>` of the test application, names `PegaCtxTrial<Type>`, one fresh branch. Drafts come from `pega-ctx create --draft` (`launch()` on a scratch root); the sends go through the client directly, to keep the raw responses (and so skip the lint: it does not stop them).

**Passes create and update (20)**: Property, AdminSystemSettings, AIAgent, AITool, ClassMetadata, ConnectREST, CorrespondenceType, EditValidate, Notification, Activity, AttachmentCategory, Correspondence, FieldValue, Flow, DataTransform, ReportDefinition, ServiceLevel, Validate, When, View. Class passes `create` from a sibling class (update not tried). AITool passes although its stub breaks its own `x-pega-condition` in the lint: the lint is stricter than the server there.

**Refused by the server's schema, before Pega** (the four stubs the lint already refused, so the server does refuse them too):

| Type | Message |
|---|---|
| ConnectGenerativeAI | `pyGenAIDef`, `pyGenAIConfig`, `pyDescription` required |
| TestUnitCase | `/pyRuleUnderTest/pyDetails`: `pyRuleUnderTestType`, `…InsName`, `…Name`, `…ObjClass` required |
| UITheme | `/pyRuleName` must be the constant `Rule-UI-Theme` |
| RuleSetBranch | `/pyBranchID` at most 16 characters (the trial name was longer: an artefact of the trial, not of the stub) |

**Refused by Pega** (the stub holds placeholders that no real application has; fix the content, not the tool):

| Type | Message (shortened) |
|---|---|
| AsyncJobScheduler | `pyAccessGroup` `MyOrg-MyApp:Administrators` not valid; `pyActivityName` `RunScheduledJob` does not exist |
| AsyncQueueProcessor | `pyActivityName` / `pyBaseClass` placeholders (`<CLASS-OF-PYACTIVITYNAME>`) |
| DecisionDataSet | keys `.CustomerID`, `.RegionCode`… are not properties of the class |
| DataPage | `pyPageName` must start with `D_` or `Declare_` (the lint does not know) |
| FlowAction | `pyViewReference` `MyRuleNameHere` does not exist |
| Class | `pyClassGroupIndicator` required: the stub lacks it. Created from a sibling class (`--from Class:…`), it passes |
| CaseType | `pyStages(1).pyProcesses(1)`: the flow `CreateForm_Default` of the new class does not exist yet |
| TestApplicationBusinessAction, TestApplicationCase | `Branch ruleset not candidate` (same message as a missing class; cause not found) |

**Create passes, update refused**: DecisionTable (the server validates the whole merged rule: `/pyColumns/0` requires `pyProperty`, which the stub's column lacks, so the stub creates a rule that cannot be patched), ServiceMCP (500 `Implementation resulted in an exception`, no detail).

**Not tried**: RuleSetName and RuleSetVersion (system-wide, no way to take them back from the MCP; RuleSetVersion has no example at all).

Other findings:

- **Name refused by `pega-ctx` before the server**: a type whose key has several fields is named by them joined with a space (`AdminSystemSettings` `pyOwner pyPurpose`, `FieldValue` `pyFieldName pyFieldValue`); `CaseType` is always `pyDefault`; `Class` and `ClassMetadata` carry their class as name.
- **A new branch is not visible to `list()`/`search-rules`** (same as the "invisible branch" note above), but `get-rule` by the returned key reads it and `update-rule` accepts it: `create` should keep `rule.responseData.pyRuleInsKey` for `update`/`live` until the listing sees it.
- Every write returns the warning "the completed branch summary was not updated".
- A class-less rule (`EditValidate`) broke `sync` (folder layout and comparison key), fixed in `src/mirror/files.mjs` and `src/commands/sync.mjs`.
- Not checked: whether `update-rule` and `copy-rule` accept the same type list as `create-rule`.
- Richer examples (2026-10-12, card 17): `ClassMetadata` `with-primary-fields` and `data-class`, `AttachmentCategory` `work-privilege`, `ServiceMCP` `with-custom-tools` pass `create`. `ServiceMCP` `with-casetype-tools` is refused by Pega: its `pzCaseTypeTools[].pyPurpose` (`pxCreateServiceRequest`) must name an existing `Rule-AI-Tool`. The rows of `pzMCPTools` come back with `pxObjClass` `Rule-AI-Tool`. A `ClassMetadata` created on a class that already has one in the base ruleset passes in the branch.
- Stubs refused by Pega, filled with the application's names (2026-10-12, card 17): `AsyncQueueProcessor` passes with `pyBaseClass` and `pyActivityName` naming an activity of the application. `DecisionDataSet` passes once its keys are mapped to a column of the class's table (`.pyGUID`; `.Title` is refused: `Selectable keys should be mapped to a Database table column`). `ConnectGenerativeAI` passes with `pyGenAIDef` (`pyUserPrompt` `pyGenerativeAIPromptTemplate`, `pySystemPrompt` `pzDefaultSystemPrompt`, the schema's defaults), `pyGenAIConfig` (model `pega-default-smart`) and `pyDescription`. `AsyncJobScheduler` passes once `pyBaseClass` is set (the stub has none: `pyActivityName` is looked up in it) and `pyAccessGroup` names a real access group (the operator's, from `list-available-applications`). `TestUnitCase` on an activity of the application: `Branch ruleset not candidate`, like the two `TestApplication*` types (cause not found; a ruleset flagged for test cases is the likely need).
- The trial rules stay in the test branch: no MCP tool deletes a rule or a branch.

### Pega types and classes (`TYPES`)

`TYPES` (`src/mcp/tools.mjs`) maps a short type name to a Pega rule class, in three groups:

- **Writable**: the 37 classes that have a schema, so the ones `create-rule` accepts (`src/mcp/types.mjs`, generated, never edited by hand). The specification's names are kept (`Rule-Obj-Model` → `DataTransform`, `Rule-Declare-Pages` → `DataPage`, `Rule-Obj-Corr` → `Correspondence`); any other class gets a name built from it (`Rule-Obj-ServiceLevel` → `ServiceLevel`, `src/mcp/names.mjs`).
- **Read-only** (`READ_ONLY`): accepted by `D_pxListRules`, refused by `create-rule`. Checked on the server: `Rule-HTML-Section`. `sync` follows them; `create` and `update` write them only as a draft for Dev Studio, which `send` refuses. Other classes are added here once a listing has been seen on the server, never before.
- **Added by the project**: `types` in `.pega/config.json`, a list of rule classes (`["Rule-Declare-Expressions"]`). Their short name is built from the class (`Expressions`).

A raw rule whose class is in none of them still gets a type built from its class and a generic digest: nothing is left out of the mirror for lack of a type.

`sync` lists every type except `NOT_MIRRORED`: `Rule-RuleSet-Name`, `Rule-RuleSet-Version` and `Rule-RuleSet-Branch` sit outside the application, so `D_pxListRules` returns the whole system for them. They stay writable. When the server ignores paging and sends the same page back, `list()` stops (first `pzInsKey` repeated).

Classes checked through `D_pxListRules` on the test application on 2026-10-10 (number of rules): `Rule-UI-View` 9, `Rule-Obj-Flow` 2, `Rule-Obj-FlowAction` 4, `Rule-Obj-Model` 1, `Rule-Obj-Activity` 1, `Rule-Obj-Property` 11, `Rule-Declare-Pages` 2, `Rule-Obj-Report-Definition` 1, `Rule-Obj-CaseType` 1, `Rule-Obj-Class` 12 (including the organization classes, outside the followed ruleset: filtered after reading, like case types). Accepted but empty: `Rule-HTML-Section`, `Rule-Obj-When`, `Rule-Declare-DecisionTable`, `Rule-Obj-Validate`. The other writable classes have not been listed on the server yet (Trello card 15). A class that refuses the listing appears as an error at the end of `sync` and does not stop the others.

**Type `View` added** to the specification: the application is Constellation, its interface is made of views (`Rule-UI-View`), not sections. The fixture therefore holds four Views; When, DecisionTable, Validate and Section come from Gameboard (through the `gameboard` alias).

## The 27 tools

Required parameters in bold. All parameters are strings unless stated.

### Application and context

- `get-application` — current application (or `appName` + `appVersion`): rulesets, built-on, case types. Parameters: `appName`, `appVersion`.
- `list-available-applications` — the operator's applications, aliases, access groups. No parameter.
- `switch-application-context` — switches context by alias, label or name. **`target`**.
- `set-application-alias` — routes the next calls to an alias. **`alias`**.
- `clear-application-alias` — back to the default context. No parameter.
- `list-application-objects` — case and data objects, with `defaultListDataView`. `type` (`case` | `data`).

### Rules

- `list-rules` — rules of a type, free text without date. **`ruleType`**, `ruleName`, `className`, `applicationNames`, `pageNumber` (integer), `pageSize` (integer, default 50).
- `search-rules` — text search, tabular TOON (`item, insName, category, categoryActionKeys, insKey, section, ranking`). **`searchText`**, `fullText`, `allApps`, `matchMode` (`any` | `all` | `contains` | `starts with` | `exact match`), `pageSize` (max 50), `pageNumber`, `ruleType`, `className`.
- `get-rule` — one rule by `pzInsKey`. **`key`**, `detail` (`summary` | `full`).
- `get-rule-resolve-handle` — resolves a key from `search-rules` to the effective version, then `get-rule`. **`pzInsKey`**, `detail`.
- `create-rule` — creates a rule in a branch. **`ruleType`** (pxObjClass), **`content`** (JSON with `pxObjClass`), **`branchID`** (3-16 chars), **`changeDescription`** (≤ 200 chars), `ruleSet`.
- `update-rule` — updates by `pzInsKey`, without renaming. **`key`**, **`updates`** (JSON), **`branchID`**, **`changeDescription`**, `listUpdateMode` (`patch` by default | `replace`), `listUpdateModeOverrides` (JSON path → mode). Removing a page group entry: `{"__delete":true}`.
- `copy-rule` — Save As in a branch, same name. **`sourceKey`**, **`branchID`**, `ruleSet`.

### Data pages

- `get-data-view-metadata` — parameters and fields of a data page. **`dataPage`**.
- `run-data-page` — runs a data page (`page` as GET, `list` as POST), TOON. **`dataPage`**, **`dataPageType`**, `payload` (JSON: `dataViewParameters`, `query`, `paging`, `includeTotalCount`…).

### Cases and assignments (outside pega-ctx)

- `list-casetypes` — the application's case types. No parameter.
- `list-cases` — **`objClass`**, `pageNumber`, `pageSize`.
- `get-case-details` — **`pzInsKey`**.
- `get-case-assignments` — **`pzInsKey`**.
- `create-case` — **`caseTypeID`** (the case type's class), `content`. Returns as TOON `caseID` (case key on the pool class: `MONORG-TEST-WORK G-69001`), `nextAssignmentID` and `nextAssignment` (including `agentView.fields[]`: `name` `.FirstName`, `label`, `type`), then `content` (the case data). Seen on 2026-10-11 on GetInfo.
- `get-assignment` — **`assignmentID`**. Returns the same shape as `nextAssignment`, `agentView.fields[]` included.
- `perform-action` — **`assignmentID`**, **`actionID`**, `content`, `pageInstructions`.
- `trigger-optional-process` — **`caseID`**, **`processID`**.
- `run-pegaunits` — **`branchID`**.

### Embedded Pega skills (outside pega-ctx)

- `list-skills` — `verbose` (boolean), `parent`, `childCategory` (`Examples` | `References` | `Schema`), `groupByParent` (boolean).
- `get-skill` — **`name`**. It does not serve the per-rule-class schemas (`get-skill rules-rule-obj-when/schema/rule-obj-when`: not found, 2026-10-11): pega-ctx reads them from the plugin's files (`src/mcp/schemas.mjs`). A class's guide (`rules-rule-obj-flowaction`, `rules-rule-obj-flow`) gives the role of the fields (pre / post processing, shape types): it is the source when the fixture shows a name without saying what it is for (`docs/projection.md` § Cross-cutting rules).
- `search-skills` — **`query`**.
