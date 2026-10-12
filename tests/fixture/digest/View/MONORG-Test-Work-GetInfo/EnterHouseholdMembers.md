# View EnterHouseholdMembers
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
application: unknown (ruleset outside the stack read)
description: Saisie des autres membres
updated: 2026-10-08 by dev.un
available: yes

template: DefaultForm

## Content
- region Fields
  - EmbeddedDataMulti: addEditAction pyEdit, displayAs table, editMode modal, editType action, pagelistValue .HouseholdMembers, targetClassLabel Membre du foyer, targetObjectClass MONORG-Test-Data-People
    - view pyPrimaryFields

## References
- Property:MONORG-Test-Work-GetInfo:HouseholdMembers (list)
- View:MONORG-Test-Data-People:pyPrimaryFields (included view)
- View:MONORG-Test-Work-GetInfo:pyEdit ? (name match)
