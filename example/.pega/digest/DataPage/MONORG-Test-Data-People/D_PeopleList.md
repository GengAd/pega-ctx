# DataPage D_PeopleList
class: MONORG-Test-Data-People
rulesets: Test:01-01-01
description: List People
updated: 2026-10-08 by dev.un
available: yes

Data Page to read list of records from System of Record.

structure list, scope thread, refresh never

## Sources
1. ReportDefinition DataTableEditorReport

## References
- ReportDefinition:MONORG-Test-Data-People:DataTableEditorReport (source)

## Cited by
- ClassMetadata:MONORG-Test-Data-People:MONORG-Test-Data-People (list data page)
- View:MONORG-Test-Data-People:HouseholdMembersPicker (list source)
