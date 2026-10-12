# Flow CollectHousehold
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
description: Collecter les informations du foyer
updated: 2026-10-08 by dev.un
available: yes

## Shapes
1. Start1: start
   → Assignment1
2. Assignment1: assignment CollectHouseholdSize, routed to Current operator
   → Assignment2 (action CollectHouseholdSize)
3. Assignment2: assignment EnterHouseholdMembers, routed to Current operator
   → Utility1 (action EnterHouseholdMembers)
4. Utility1: utility SaveHouseholdPeople, activity SaveHouseholdPeople
   → End1
5. End1: end

local actions: CollectHouseholdSize, EnterHouseholdMembers

## References
- FlowAction:MONORG-Test-Work-GetInfo:CollectHouseholdSize (assignment)
- FlowAction:MONORG-Test-Work-GetInfo:EnterHouseholdMembers (assignment)
- Activity:MONORG-Test-Work-GetInfo:SaveHouseholdPeople (utility)
- View:MONORG-Test-Work-GetInfo:EnterHouseholdMembers ? (name match)
- View:MONORG-Test-Work-GetInfo:CollectHouseholdSize ? (name match)

## Cited by
- CaseType:MONORG-Test-Work-GetInfo:pyDefault (process)
