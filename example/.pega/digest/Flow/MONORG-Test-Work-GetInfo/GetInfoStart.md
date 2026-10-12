# Flow GetInfoStart
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
description: Créer GetInfo et saisir le répondant
updated: 2026-10-08 by dev.un
available: yes

## Shapes
1. Start1: start
   → Assignment1
2. Assignment1: assignment CollectRequester, routed to Current operator
   → End1 (action CollectRequester)
3. End1: end

local actions: CollectRequester

## References
- FlowAction:MONORG-Test-Work-GetInfo:CollectRequester (assignment)

## Cited by
- CaseType:MONORG-Test-Work-GetInfo:pyDefault (process)
