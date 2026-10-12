# Activity SaveHouseholdPeople
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
description: Enregistrer les personnes du foyer
updated: 2026-10-08 by dev.un
available: yes

Persiste le répondant et les autres membres dans People, construit leurs références par pyGUID, puis sauvegarde les liens.

type: UTILITY

## Steps
1. Save-DataPage on Requester — Persister la fiche People du répondant
  DataPage D_People, pyGUID .pyGUID, WriteNow true
2. Save-DataPage on Primary.HouseholdMembers, for each page — Persister chaque fiche People membre du foyer
  DataPage D_People, pyGUID .pyGUID, WriteNow true
3. Apply-DataTransform on pyWorkPage — Construire les références croisées des People
  DataTransform BuildHouseholdReferences
4. Property-Remove on Primary.PeopleForLinks, for each page — Retirer l’identifiant propre à chaque personne de sa liste de membres liés
  Property .HouseholdMembers(param.pyForEachCount)
5. Save-DataPage on Primary.PeopleForLinks, for each page — Persister les identifiants et références de chaque personne
  DataPage D_People, pyGUID .pyGUID, WriteNow true

## References
- DataPage:MONORG-Test-Data-People:D_People (data page)
- DataTransform:MONORG-Test-Work-GetInfo:BuildHouseholdReferences (apply)
- Property:MONORG-Test-Data-People:HouseholdMembers (step)
- Property:MONORG-Test-Work-GetInfo:HouseholdMembers ? (name match)

## Cited by
- Flow:MONORG-Test-Work-GetInfo:CollectHousehold (utility)
