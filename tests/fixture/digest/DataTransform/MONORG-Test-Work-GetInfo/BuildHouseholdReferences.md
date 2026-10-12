# DataTransform BuildHouseholdReferences
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
application: unknown (ruleset outside the stack read)
description: Construire les références du foyer
updated: 2026-10-08 by dev.un
available: yes

## Actions
- 1 .HouseholdGroupID = .pyID
- 2 append to .PeopleForLinks: .Requester
- 3 append to .PeopleForLinks: .HouseholdMembers
- 4 for each page in .PeopleForLinks
  - 4.1 .HouseholdID = Primary.HouseholdGroupID
  - 4.2 append and map to .HouseholdMembers: Primary.PeopleForLinks
    - 4.2.1 .pyGUID = .pyGUID

pages: Requester (MONORG-Test-Data-People), HouseholdMembers (MONORG-Test-Data-People), PeopleForLinks (MONORG-Test-Data-People)

## References
- Property:MONORG-Test-Work-GetInfo:HouseholdGroupID (target)
- Property:MONORG-Test-Work-GetInfo:PeopleForLinks (target)
- Property:MONORG-Test-Work-GetInfo:Requester (source)
- Property:MONORG-Test-Work-GetInfo:HouseholdMembers (source)
- Property:MONORG-Test-Data-People:HouseholdID (target)
- Property:MONORG-Test-Data-People:HouseholdMembers (target)
