---
name: fixture
description: Fetch a real Pega rule into tests/fixture/raw/ and anonymize it. Use it to build or complete the fixture, before writing a projection.
argument-hint: "<Type:Class:Name>"
---

# Add a rule to the fixture

1. Read the rule `$ARGUMENTS` through `list()` (for its key, highest version) then `read()` of `src/mcp/client.mjs`, in a scratchpad script that writes the non-anonymized raw rule to the scratchpad: the raw rule never goes through the context nor the repository. Run the script from the project root (OAuth tokens). Rule from another application: `set-application-alias` first (`docs/mcp-tools.md` § list).
2. Anonymize with the table `tests/fixture/anonymization.json` (real → pseudonym), by text replacement on the TOON, completing it if a new organization or operator name appears. Each name in three cases: as is, UPPER CASE (the `pzInsKey` and `pxInsName` are upper case) and lower case. A real name already all upper case (`ORG`) gets an all upper case pseudonym, otherwise keys keep a mixed-case pseudonym. Names are found in `pxUpdateOperator`, `pxCreateOperator`, `pxCreateOpName`, `pxCreateSystemID` (host), `pxWarning*Operator`, `pySPRuleSetName`, and the classes (organization). Pseudonyms without `,` `:` or quotes, otherwise the TOON no longer decodes. **The same table for all rules**: otherwise references between fixture rules no longer match.
3. Write `tests/fixture/raw/<Type>/<anonymized Class>/<Name>.toon` (`Name` = the raw rule's `pyRuleName`, not the one from `list()`, which is upper case for a CaseType), and add the anonymized `list()` row to `tests/fixture/list.jsonl`: date and operator of the digest come from it. `npm test` checks decoding, storage and the row (`tests/fixture.test.mjs`).
4. Check that no real name survives: `grep -ri` of each key of the table on `tests/fixture/raw/` and `tests/fixture/list.jsonl` must be empty, as must a search for email addresses.
5. Add the type to `docs/projection.md` if it is not there, with the raw list of its top-level fields, to sort kept / dropped.

The anonymization table holds the real names: it stays outside `tests/fixture/raw/`, is ignored by git, and is never read by the tests.
