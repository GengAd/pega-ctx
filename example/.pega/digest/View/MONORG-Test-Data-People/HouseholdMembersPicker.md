# View HouseholdMembersPicker
class: MONORG-Test-Data-People
rulesets: Test:01-01-01
description: Membres du foyer
updated: 2026-10-08 by dev.un
available: yes

template: DataReference

## Content
- SimpleTableSelect: contextClass MONORG-Test-Data-People, label Membres du foyer, primaryField .LastName, readonlyContextList .HouseholdMembers, referenceList D_PeopleList, referenceType Data, selectionKey .pyGUID, selectionList .HouseholdMembers, selectionMode multi
  - .Age: Integer
  - group presets
    - region Columns
      - .FirstName: TextInput
      - .LastName: TextInput
      - .Title: TextInput
  - .LastName: TextInput
- region Views

## References
- DataPage:MONORG-Test-Data-People:D_PeopleList (list source)
- Property:MONORG-Test-Data-People:Age (field)
- Property:MONORG-Test-Data-People:FirstName (field)
- Property:MONORG-Test-Data-People:LastName (field)
- Property:MONORG-Test-Data-People:Title (field)

## Cited by
none
