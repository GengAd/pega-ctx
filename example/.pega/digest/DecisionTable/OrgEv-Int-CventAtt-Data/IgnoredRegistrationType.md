# DecisionTable IgnoredRegistrationType
class: OrgEv-Int-CventAtt-Data
rulesets: Cvent:01-01-05
application: unknown (ruleset outside the stack read)
description: Ignored registration type
updated: 2025-12-19 by dev.quatre
available: yes

| Code (.registrationType.code) | result |
|---|---|
| = Vendor | true |
| = Client Speaker | true |

otherwise: false

## References
- Property:OrgEv-Int-CventAtt-Data:registrationType (column)

## Cited by
- When:OrgEv-Int-CventAtt-Data:IsIgnoredRegistrationType (condition)
