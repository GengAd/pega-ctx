# Validate ValidateToScene2
class: AutreOrg-Gameboard-Work-Game
rulesets: Gameboard:01-01-06
application: unknown (ruleset outside the stack read)
description: ValidateToScene2
updated: 2025-01-28 by dev.cinq
available: yes

## Checks
### Default Validation
1. .pyStatusWork: valid if @inString(D_GetTable[TableID:.TableID].UnlockedStages,"Scene 2")=-1, message "StageLocked"
2. CallValidateSingle

## References
- DataPage:AutreOrg-Gameboard-Work-Game:D_GetTable (condition)
- Property:AutreOrg-Gameboard-Work-Game:TableID (condition)

## Cited by
none
