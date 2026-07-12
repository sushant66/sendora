# Contracts: Sender profile, merge fields, and outreach polish

This feature adds to the internal HTTP surface only; it introduces no new external interface and
does not change the provider-agnostic sending seam from 001 (`contracts/email-provider.md` in
001 still holds). See:

- `http-api.md` — new and changed route-handler contracts (profile, bulk delete, restore, test
  send) and the reused preview/render behavior for the missing-value gate.

Two non-HTTP contracts are defined in code, not here:

- **Merge-field vocabulary** — the closed recipient + sender token sets and their empty-value
  handling live in `lib/templates/merge.ts` and are covered by `data-model.md`. The slash menu
  reads a static, typed list of `{ token, label, group }` derived from that vocabulary; there is
  no endpoint for it.
- **Merge chip serialization** — the editor's atomic merge Node serializes to raw `{{token}}`
  text, identical to today's stored template body, so no stored-format contract changes.

All request/response bodies validated with Zod at the boundary (Constitution I). Every route is
authenticated and scoped to the current user (FR-024).
