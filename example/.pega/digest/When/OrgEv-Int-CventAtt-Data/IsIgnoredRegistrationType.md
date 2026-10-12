# When IsIgnoredRegistrationType
class: OrgEv-Int-CventAtt-Data
rulesets: Cvent:01-01-03
application: unknown (ruleset outside the stack read)
description: Is Ignored registration type
updated: 2024-12-24 by dev.trois
available: yes

true if: (1)
1. @pxEvaluateDecisionTable(@Utilities.pxGetStepPageReference(),"IgnoredRegistrationType")=="true"

## References
- DecisionTable:OrgEv-Int-CventAtt-Data:IgnoredRegistrationType (condition)

## Cited by
none
