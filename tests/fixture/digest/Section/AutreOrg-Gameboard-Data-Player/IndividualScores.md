# Section IndividualScores
class: AutreOrg-Gameboard-Data-Player
rulesets: Gameboard:01-01-17
description: Individual scores
updated: 2026-01-15 by dev.deux
available: yes

## Layout
- layout SIMPLELAYOUT on D_GetDemoResults.pxResults (AutreOrg-Gameboard-Int-Demo-Response)
  - section InData, visible if .DemoMaxScore > 0

## References
- DataPage:AutreOrg-Gameboard-Int-Demo-Response:D_GetDemoResults (list source)
- Section:AutreOrg-Gameboard-Int-Demo-Response:InData (included section)
