# 3. The projection comes from the samples

## Context

The field names of a Pega rule cannot be guessed: a FlowAction's key is `pyActionName`, a When's `pyBlockName`; a DecisionTable stores its values by column (`pyColumns[].pyCondition[i]`), not by row; a Validate carries a generated activity (`pySteps`) that hides the two checks entered. Pega's documentation describes the form, not the JSON returned by `get-rule`.

## Decision

No projection without a real rule in the fixture (`tests/fixture/raw/`, anonymized by `/fixture`). Fields are read on the fixture; when their role is not obvious (pre or post processing, field naming a source), it comes from the server's embedded skill (`get-skill rules-<class>`). A shape or component absent from the fixture is rendered as is, without a sure reference; generic detection by name catches it as a `probable` edge.

## Consequences

- `tests/projection.test.mjs` checks that each type of `TYPES` has its projection and at least one fixture rule, and compares each digest to its expected one.
- `docs/projection.md` holds, per type, the raw list of fields and what is kept.
- Adding a type starts with fetching a rule; unseen cases (flow sub-processes, report filters) stay generic until a sample shows them.
