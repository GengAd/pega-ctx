# Functions the application calls

5 functions called in 2 rules of the mirror, most used first. Reuse these first; for a function not listed here, ask the user.

## @inString

2 usages in 1 rule
- `@inString(D_GetTable[TableID:.TableID].UnlockedStages,"Scene 2")` (Validate:AutreOrg-Gameboard-Work-Game:ValidateToScene2)
- `@inString(D_GetTable[TableID:.TableID].UnlockedStages,.pyStatusWork)` (Validate:AutreOrg-Gameboard-Work-Game:ValidateToScene2)

## @IsInPageList

1 usage in 1 rule
- `@IsInPageList(".pyStatusWork",".pxPropertyName",pyValidateToScene2_AutreOrg_Gameboard_Work_Game_Conditions .pzConditionProps)` (Validate:AutreOrg-Gameboard-Work-Game:ValidateToScene2)

## @PageExists

1 usage in 1 rule
- `@PageExists("pyValidateToScene2_AutreOrg_Gameboard_Work_Game_Conditions")` (Validate:AutreOrg-Gameboard-Work-Game:ValidateToScene2)

## @pxEvaluateDecisionTable

1 usage in 1 rule
- `@pxEvaluateDecisionTable(@Utilities.pxGetStepPageReference(),"IgnoredRegistrationType")` (When:OrgEv-Int-CventAtt-Data:IsIgnoredRegistrationType)

## @Utilities.pxGetStepPageReference

1 usage in 1 rule
- `@Utilities.pxGetStepPageReference()` (When:OrgEv-Int-CventAtt-Data:IsIgnoredRegistrationType)
