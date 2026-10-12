# ConnectREST PegaCtxFxConnect
class: MONORG-Test-Work
rulesets: Test:01-01-01
description: PegaCtxFxConnect
updated: 2026-10-12 by dev.un
available: yes

endpoint: https://api.example.com
path: v1/items
timeout 10000 ms, on failure: flow ConnectionProblem

### GET
- request headers Accept=application/json
- response data Response Message→.pyResponseData

### POST
- request data Request Mapping
- response data Response Message

### PUT
- request data Request Message
- response data Response Message

### PATCH
- request data Request Message
- response data Response Message

### DELETE
- request data Request Message
- response data Response Message

## References
none

## Cited by
none
