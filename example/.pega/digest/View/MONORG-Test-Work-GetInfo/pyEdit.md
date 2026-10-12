# View pyEdit
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
description: Informations du répondant
updated: 2026-10-08 by dev.un
available: yes

template: DefaultForm

## Content
- region Fields
  - view RequesterDetails (MONORG-Test-Data-People) on .Requester

## References
- View:MONORG-Test-Data-People:RequesterDetails (included view)
- Property:MONORG-Test-Work-GetInfo:Requester (context)

## Cited by
- View:MONORG-Test-Work-GetInfo:EnterHouseholdMembers ? (name match)
