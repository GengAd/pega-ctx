# AsyncJobScheduler PegaCtxFxJobSched2
class: MONORG-Test-Work-GetInfo
rulesets: Test:01-01-01
description: PegaCtxFxJobSched2
updated: 2026-10-12 by dev.un
available: unknown

activity: MONORG-Test-Work-GetInfo:SaveHouseholdPeople
schedule: Daily at 00:00:00.000Z GMT
runs on: Cluster, node types BackgroundProcessing
access group: Test:Authors

## References
- Activity:MONORG-Test-Work-GetInfo:SaveHouseholdPeople (scheduled activity)
