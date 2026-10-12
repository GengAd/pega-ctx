# Property HouseholdMembers
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
application: Test
description: Autres membres du foyer
updated: 2026-10-08 by dev.un
available: yes

Saisie temporaire des autres membres avant création de leurs fiches People.

mode: PageList of MONORG-Test-Data-People

## References
none

## Cited by
- Activity:MONORG-Test-Work-GetInfo:SaveHouseholdPeople ? (name match)
- ClassMetadata:MONORG-Test-Work-GetInfo:MONORG-Test-Work-GetInfo (primary field)
- DataTransform:MONORG-Test-Work-GetInfo:BuildHouseholdReferences (source)
- View:MONORG-Test-Work-GetInfo:EnterHouseholdMembers (list)
