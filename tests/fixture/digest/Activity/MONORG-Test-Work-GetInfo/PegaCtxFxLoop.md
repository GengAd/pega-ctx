# Activity PegaCtxFxLoop
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
application: unknown (ruleset outside the stack read)
description: PegaCtx loop fixture
updated: 2026-11-03 by dev.un
available: yes

Loop over household members with sub-steps, then a step left empty

## Steps
1. Property-Set on Primary.HouseholdMembers, for each page — Count each member
  PropertiesName local.count, PropertiesValue local.count + 1
  1.1. Property-Set — Default title
    PropertiesName .Title, PropertiesValue "Member"
  1.2. Property-Set — Set a note
    PropertiesName local.count, PropertiesValue 0
2. Page-Clear-Messages — Empty step

## References
- Property:MONORG-Test-Data-People:Title (step)
- Property:MONORG-Test-Work-GetInfo:HouseholdMembers ? (name match)
