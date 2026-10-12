# Stack

application: Test 01.01.01 (Constellation)
rulesets: Test
write ruleset: depends on the class, pega-ctx stack --for <Class> says it ("write" table empty: draft in .pega/write.draft.json)

## Built on
- Constellation 01.01

## Resolution order
Pega searches the rulesets in this order, application by application (each application rule's ruleset list, branches first).
1. Test 01.01.01: Test:01-01, MONORG:01-01
2. Constellation 01.01: Constellation:01-01
3. PegaRULES 8: Pega-ProcessCommander:08-26, Pega-RULES:08-26

## Built on (manual)
none. For each built-on application pega-ctx cannot read, a line `- Application Version: Ruleset:Version, …`; sync keeps this section as it is.

## Rulesets seen in the mirror
- Test:01-01-01, Test: 34 rules, classes MONORG-Test-Data-People, MONORG-Test-Work, MONORG-Test-Work-GetInfo
- Cvent:01-01-05, not in the application's stack: 2 rules, classes OrgEv-Int-CventAtt-Data
- Gameboard:01-01-17, not in the application's stack: 2 rules, classes AutreOrg-Gameboard-Data-Player, AutreOrg-Gameboard-Work-Game
