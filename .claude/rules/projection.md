---
paths:
  - "src/projection/**"
  - "tests/fixture/**"
  - "docs/projection.md"
---

# Projection

- Field names are read on `tests/fixture/raw/`, never in Pega's docs. Each kept or dropped field is listed per type in `docs/projection.md`, with the reason.
- When the fixture shows a field without saying what it is for (pre or post, shape type), its role comes from the server's embedded skill (`get-skill rules-rule-obj-<class>`), never from a guess. A shape or component absent from the fixture is rendered as is, without a sure reference: generic detection catches it.
- `## Cited by` is not produced by the projection (it depends on the graph): the mirror adds it when writing `digest/`.
- Dropped on principle: instance keys, creation and commit dates, operators, locking, history, the form's binary stream, any GUID or base64 value.
- Digest: the six header lines (`# Type Name`, class, rulesets, description, updated, available), the type's body, `## References`, `## Cited by`. A hundred lines at most.
- Reference from a structured field → `sure`; generic detection by name (same class or parent) → `probable`, shown with `?`.
- The raw rule (full `get-rule`) holds no date: `updated` comes from the index line, filled by `list()` (`pxUpdateDateTime`).
- Type without projection: not an error; header + `body: type without projection, see docs/projection.md` + generic references.
- Fixture anonymized (organization, operators) before being written. Each file of `raw/` has its expected digest in `tests/fixture/digest/` (`UPDATE_DIGESTS=1 npm test` rewrites them).
