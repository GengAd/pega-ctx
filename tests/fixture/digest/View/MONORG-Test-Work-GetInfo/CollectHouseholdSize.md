# View CollectHouseholdSize
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
application: unknown (ruleset outside the stack read)
description: Composition du foyer
updated: 2026-10-08 by dev.un
available: yes

template: DefaultForm

## Content
- region Fields
  - .HouseholdMemberCount: Integer, required

## References
- Property:MONORG-Test-Work-GetInfo:HouseholdMemberCount (field)
