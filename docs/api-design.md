# API design

Status: **revision 1, draft for review**, 31 October 2026.

Dependencies, as specified: `docs/microservices-design.md` (revision 1) and
`docs/feature-list.md` (revision 1).

The machine-readable specifications are in `api/`, one OpenAPI 3.1 document per
service plus a shared components file. This document carries the conventions
they follow and the reasoning behind them; the specifications carry the detail.

| File | Service |
|---|---|
| `api/common.yaml` | Shared schemas, parameters and responses |
| `api/identity-and-firm.openapi.yaml` | Firm, users, roles, tenancy |
| `api/reference-data.openapi.yaml` | Instruments, prices, tax rules |
| `api/advisory-core.openapi.yaml` | Clients, holdings, taxonomy, models, targets, plans, recommendations |
| `api/analytics.openapi.yaml` | Drift, projections, scenarios |
| `api/ingestion.openapi.yaml` | Documents, imports, bank data |
| `api/audit.openapi.yaml` | The audit feed |

## 1. Conventions

### Resources and paths

Resource-oriented, versioned in the path from the first release: `/v1/...`.

Paths follow the data model's hierarchy only as far as it aids discovery. A
resource with its own identity is addressable at the top level even when it is
nested:

```
/v1/households/{householdId}/members          collection under its parent
/v1/member-accounts/{memberAccountId}         addressable directly
/v1/member-accounts/{id}/targets/draft        a singleton sub-resource
```

Deep nesting (`/households/{a}/members/{b}/member-accounts/{c}/holding-entities/{d}`)
is avoided. It encodes a hierarchy that is already in the data and makes every
client depend on it.

### Representation

- **Money is a string**, not a number: `"1234567.89"`. JavaScript's `number`
  cannot represent rupee amounts at the precision `numeric(20,2)` carries, and
  silent float drift in a financial figure is not acceptable. Every money field
  pairs with a `currency` field.
- **Percentages are strings too**, in percentage points: `"12.5000"` means
  12.5%. Same reason.
- **Lakh and crore are display units.** The API returns rupees; the client
  formats.
- **Dates** are `date` (`2026-10-31`); **instants** are `date-time` in UTC. The
  data model's two clocks are preserved in the API: `asOf` is the business date
  a fact is true for, `recordedAt` is when the system learned it. Both appear
  where both exist.
- **`null` is meaningful and is never substituted.** A null `targetPct` means
  "below the model's depth, not specified" and is distinct from `"0.0000"`. A
  null `isin` means no source supplies one. Omitting the field or sending a
  placeholder loses information the product depends on (feature XC-06).
- **Illustrative figures carry `isIllustrative: true`** (XC-05).
- `camelCase` field names.

### Errors

RFC 9457 `application/problem+json`:

```json
{
  "type": "https://api.example.com/problems/target-not-draft",
  "title": "Target is not a draft",
  "status": 409,
  "detail": "Target 0f8e... is approved and cannot be edited.",
  "instance": "/v1/member-account-targets/0f8e...",
  "requestId": "01JD2..."
}
```

`requestId` is always present and is the same identifier carried into
`AuditEvent.request_id` and the trace. One identifier from browser to audit log.

Domain failures are typed, not generic. "Children do not sum to their parent"
and "you may not approve your own request" are different `type` values, because
the client renders them differently and the support desk searches for them.

### Pagination, filtering, sorting

Cursor pagination: `?limit=50&cursor=...`, with `nextCursor` in the response.
Offset pagination over a growing audit log or price series returns inconsistent
pages.

Filters are explicit query parameters, never a generic query language. Sorting
is `?sort=field,-otherField`.

### Idempotency

Every `POST` that creates or approves accepts `Idempotency-Key`. The key and its
response are stored; a repeat returns the original response rather than creating
a second recommendation. This is not optional on approval endpoints — a
double-submitted approval is a compliance problem.

### Concurrency

Mutable resources carry an `ETag`. Updates send `If-Match`. A mismatch is `412`.
Two advisers editing the same target draft is a realistic event, and last-write-
wins loses one of them silently.

### Long-running operations

Operations that cannot complete in a request return `202` with a status
resource:

```
POST /v1/model-versions/{id}/publish   → 202, Location: /v1/rollouts/{id}
GET  /v1/rollouts/{id}                 → progress and per-account detail
```

Applies to model publication (MD-13), tenant provisioning (FS-02), import
parsing (IN-02) and drift recomputation (XC-08).

### Actions that are not CRUD

A few operations are genuinely verbs and are modelled as sub-resources rather
than contorted into `PUT`:

```
POST /v1/model-versions/{id}/publish
POST /v1/member-account-targets/{id}/approve
POST /v1/imports/{id}/apply
POST /v1/imports/{id}/rollback
POST /v1/classification-change-sets/{id}/apply
```

Each creates an `Approval` or an `Import` effect and is audited. Modelling them
as state updates would lose the request/decide distinction the data model draws.

## 2. Authentication and authorization

Bearer tokens from Entra External ID. API Management validates the JWT;
**every service validates it again** — the gateway is not a trust boundary
(architecture section 6.1).

The token proves identity only. Firm, roles, `can_approve` and household scope
resolve from the database per request (architecture section 5.2). No endpoint
accepts a `firmId` parameter to select a tenant; the tenant comes from the
principal, always.

| Failure | Status |
|---|---|
| No or invalid token | `401` |
| Valid token, insufficient role | `403` |
| Valid token, household outside the principal's scope | **`404`**, not `403` |

The last is deliberate. `403` on a household the adviser may not see confirms it
exists, which leaks the client list of a competitor's adviser within the same
firm.

## 3. Endpoint inventory

Feature identifiers refer to `docs/feature-list.md`.

### identity-and-firm

| Endpoint | Features |
|---|---|
| `GET /me`, `GET /me/authorization` | FS-14 |
| `GET /firm`, `PATCH /firm` | FS-01 |
| `GET /firm/policy`, `PUT /firm/policy` | FS-08..12 |
| `GET/POST /users`, `GET/PATCH /users/{id}` | FS-03, FS-05 |
| `PUT /users/{id}/roles` | FS-04 |
| `GET/PUT /adviser-portfolio-managers` | FS-06 |
| `GET/PUT /households/{id}/advisers` | FS-07 |
| `GET/PUT /risk-profile-scale` | FS-13 |
| `POST /tenants` → 202, `GET /tenants/{id}` | FS-02 |

### reference-data

| Endpoint | Features |
|---|---|
| `GET /instruments`, `GET /instruments/{id}` | RD-02, RD-09 |
| `POST /instruments` | RD-12 |
| `GET /instruments/{id}/identifiers` | RD-03 |
| `GET /instruments/{id}/prices` | RD-04 |
| `GET /instruments/{id}/ratings` | RD-06 |
| `GET /instrument-types`, `GET /instrument-types/{code}/attributes` | RD-01, RD-05 |
| `GET /issuers` | RD-02 |
| `GET /tax-rules` | RD-07 |
| `GET /feed-runs` | RD-08, RD-10 |

### advisory-core

| Endpoint | Features |
|---|---|
| `GET/POST /households`, `GET/PATCH /households/{id}` | ON-01, OV-01 |
| `GET/POST /households/{id}/members`, `GET/PATCH /members/{id}` | ON-02, ON-03 |
| `GET/POST /members/{id}/member-accounts` | ON-04 |
| `GET/PATCH /member-accounts/{id}` | ON-10, OV-05 |
| `GET/POST /member-accounts/{id}/holding-entities` | ON-11, ON-14 |
| `GET/PUT /holding-entities/{id}/owners` | ON-12 |
| `GET /holding-entities/{id}/holdings`, `POST` for manual entry | IN-16, AD-02 |
| `GET /holding-entities/{id}/transactions` | — |
| `GET/POST/PATCH /liabilities` | CP-11 |
| `GET/PUT /external-account-links` | ON-13 |
| `GET/PATCH /onboarding-cases/{id}` | ON-05 |
| `GET/POST /questionnaires`, `/questionnaires/{id}/questions` | ON-06 |
| `POST /members/{id}/questionnaire-responses` | ON-07 |
| `GET/POST /members/{id}/risk-assessments` | ON-08, ON-09 |
| `GET/POST/PATCH /taxonomy-nodes` | SM-01..03 |
| `GET /instrument-classifications`, `PATCH` staged | SM-04..11 |
| `GET/POST /classification-change-sets`, `POST /{id}/apply` | SM-12..14 |
| `GET/PUT /themes`, `/instruments/{id}/themes` | SM-15 |
| `GET/POST /equivalence-groups` | SM-16 |
| `GET/POST /models`, `GET/PATCH /models/{id}` | MD-01, MD-02, MD-16 |
| `GET/POST /models/{id}/versions` | MD-07 |
| `GET/PUT /model-versions/{id}/targets` | MD-03, MD-04 |
| `GET/PUT /model-versions/{id}/constituents` | MD-05 |
| `POST /model-versions/{id}/publish` → 202 | MD-11, MD-12 |
| `GET /rollouts/{id}`, `GET /rollouts/{id}/accounts` | MD-13 |
| `GET /member-accounts/{id}/targets`, `/targets/draft` | CT-01, CT-06, CT-09 |
| `PUT /member-account-targets/{id}/overrides` | CT-02..04, AD-08, AD-09 |
| `PUT /member-account-targets/{id}/exclusions` | CT-05 |
| `POST /member-account-targets/{id}/approve` | CT-07, CT-08 |
| `GET /approvals`, `GET /approvals/{id}` | — |
| `GET/POST /households/{id}/financial-plans` | CP-06, CP-13 |
| `GET/PUT /financial-plans/{id}/recurring-incomes` | CP-06 |
| `GET/PUT /financial-plans/{id}/recurring-needs` | CP-12 |
| `GET/POST /member-accounts/{id}/recommendations` | RC-01 |
| `POST /recommendations/{id}/status` | RC-02..06 |
| `GET/POST /member-accounts/{id}/cash-events` | CP-01, CP-05 |
| `POST /imports/{id}/apply`, `POST /imports/{id}/rollback` | IN-09, IN-10 |

### analytics

| Endpoint | Features |
|---|---|
| `GET /member-accounts/{id}/drift` | AD-01..07, AD-10 |
| `POST /member-accounts/{id}/drift/recompute` → 202 | XC-08 |
| `GET /drift-runs/{id}`, `/rows`, `/exposure-flags` | AD-03..07 |
| `GET /households/{id}/drift` | PD-02, OV-08 |
| `GET /member-accounts/{id}/gap-summary` | GT-01, GT-12 |
| `POST /member-accounts/{id}/scenarios` | GT-02..10, CP-01..03, CP-09 |
| `GET /scenarios/{id}`, `/scenarios/{id}/trades` | GT-07, GT-08 |
| `GET /financial-plans/{id}/projection` | CP-07, CP-08, OV-07 |
| `POST /financial-plans/{id}/projection/recompute` → 202 | — |
| `GET /portfolio-overview` | OV-01..08 |

### ingestion

| Endpoint | Features |
|---|---|
| `POST /documents` → upload URL, `GET /documents/{id}` | IN-01 |
| `POST /documents/{id}/imports` → 202 | IN-02..06, IN-11 |
| `GET /imports`, `GET /imports/{id}` | IN-17 |
| `GET /imports/{id}/matches`, `PATCH /matches/{id}` | IN-07, IN-08 |
| `GET /bank-transactions` | IN-05 |
| `GET /recurring-patterns`, `POST /{id}/promote` | IN-13, IN-14 |
| `GET/PUT /transaction-categories` | IN-15 |

### audit

| Endpoint | Features |
|---|---|
| `GET /audit-events` | AU-01, AU-02 |
| `GET /audit-events/{id}` | AU-03 |

## 4. Two endpoints that need explaining

**`GET /portfolio-overview` in analytics, not advisory-core.** The overview
(OV-01..08) joins household and account master data with stored drift runs,
exposure flags and plan projections. Four of its eight columns are computed.
Serving it from `advisory-core` would mean core calling analytics once per row.
It is served where the computed data lives, reading master data through views.

**`POST /member-accounts/{id}/scenarios` creates rather than queries.** A
scenario is an expensive computation with recorded constraints and a stored
result that a recommendation may later pin. It is a resource, not a calculator
call, which is what lets `Recommendation.scenario_id` mean something permanent.

## Decisions taken

- **Money and percentages cross the wire as strings.**
- **`null` is preserved, never substituted**, because the product distinguishes
  "not specified" from zero and "no source" from absent.
- **`404`, not `403`, for an out-of-scope household.**
- **No endpoint takes a tenant parameter.** The tenant comes from the principal.
- **`Idempotency-Key` is mandatory on approval endpoints.**
- **Optimistic concurrency with `ETag`/`If-Match`** on mutable resources.
- **Verbs modelled as sub-resources** where the operation is genuinely an action
  that creates an approval or an effect.
- **The overview is served by analytics**, because it is mostly computed.

## Open items

1. **Whether the SPA talks to six services or one aggregating surface.** Six
   means several calls to paint a screen; an aggregator means another
   deployable. API Management can stitch some of it with policy. Unresolved, and
   it affects latency on the portfolio overview most.
2. **Client-facing API shape** for the v2 portal. A separate APIM product is
   reserved (architecture section 6.1); the resources are not designed.
3. **Webhooks or subscriptions** for long-running operations. Currently the
   client polls the status resource. Adequate for an adviser tool; revisit if
   the parse queue grows.
4. **Bulk endpoints.** Bulk planning is out of this phase, so no bulk approval
   endpoint is specified. The feature list marks GT-13 as `later`.
5. **Rate limits per firm**, set in APIM once usage is known (architecture open
   item 9).
