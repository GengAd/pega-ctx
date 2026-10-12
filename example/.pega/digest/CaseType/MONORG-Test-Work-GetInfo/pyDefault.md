# CaseType pyDefault
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
application: Test
description: GetInfo
updated: unknown date, by dev.un
available: yes

Saisie du répondant, du nombre d'autres membres du foyer et de leurs informations, puis création et liaison des fiches People.

## Stages
1. Répondant (initial)
   - Créer GetInfo et saisir le répondant: flow GetInfoStart
2. Foyer (entry status Open-InProgress)
   - Collecter les informations du foyer: flow CollectHousehold
3. Terminé (terminal, status Resolved-Completed, transition resolution)

start: GetInfoStart (automatic)

## References
- Flow:MONORG-Test-Work-GetInfo:GetInfoStart (process)
- Flow:MONORG-Test-Work-GetInfo:CollectHousehold (process)

## Cited by
none
