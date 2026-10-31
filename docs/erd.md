# Entity-relationship diagrams

Status: **revision 1, draft for review**, 31 October 2026.

Derived from `docs/data-model.md` revision 2, which remains the authority. Where
the two disagree, the data model is right and this document is stale.

## Why this exists separately

`docs/data-model.md` already carries a single overview ERD. It shows
relationships only, across every entity at once, which is the most a single
diagram can usefully do and still less than the DDL needs.

This document adds three things that overview cannot:

1. **Subject-area diagrams with attributes and cardinalities**, small enough to
   read, at the grain a developer needs when writing a table.
2. **A service-ownership overlay**, mapping each subject area to the service
   that owns it, which is the bridge from the data model to
   `docs/microservices-design.md`.
3. **A cross-boundary reference register** — every relationship that crosses a
   service or schema boundary, which is where distributed-system problems come
   from and where foreign keys may not be available.

Attributes are shown selectively: keys, discriminators, status columns and the
fields that carry meaning in a diagram. Full attribute lists are in the data
model, not repeated here.

## Conventions in these diagrams

- `PK` primary key, `FK` foreign key, `UK` a uniqueness constraint.
- UUID primary keys throughout. Natural keys — ISIN, PAN, folio — are attributes
  with uniqueness constraints, never the primary key.
- `firm_id` is present on every tenant-owned entity but shown only where it
  participates in a constraint, to keep the diagrams readable. Section 13
  explains how it interacts with schema-per-tenant.
- Crow's-foot cardinality. `||--o{` is one-to-many with an optional many side;
  `||--|{` means at least one is required.
- Temporal pairs (`valid_from` / `valid_to`) mark entities where current state is
  the row with a null `valid_to`.

## Context: subject areas

```mermaid
flowchart TB
    A1[1 Firm and users]
    A2[2 Clients and households]
    A3[3 Onboarding and imports]
    A4[4 Onboarding working data]
    A5[5 Instruments - shared]
    A6[6 Classification and equivalence]
    A7[7 Models]
    A8[8 Holdings and transactions]
    A9[9 Target and drift]
    A10[10 Planning and recommendations]
    A11[11 Audit]

    A1 --> A2
    A2 --> A3
    A3 --> A4
    A3 --> A8
    A5 --> A6
    A6 --> A7
    A5 --> A8
    A6 --> A8
    A7 --> A9
    A8 --> A9
    A2 --> A9
    A9 --> A10
    A2 --> A10
    A1 --> A11
```

Reading it: instruments and classification feed models; models and holdings meet
at the target, which is where drift is measured; drift feeds planning and
recommendations. Audit observes everything and is referenced by nothing.

---

## 1. Firm and users

```mermaid
erDiagram
    FIRM {
        uuid id PK
        text legal_name
        text sebi_registration_no UK
        uuid principal_officer_user_id FK
        text status
    }
    FIRM_POLICY {
        uuid firm_id PK,FK
        jsonb model_depth_by_asset_class
        jsonb default_band_by_level
        numeric default_review_threshold_pp
        numeric sector_cap_pct
        boolean same_node_is_equivalent
    }
    USER {
        uuid id PK
        uuid firm_id FK
        text email UK
        text auth_subject UK
        boolean can_approve
        text status
    }
    USER_ROLE {
        uuid user_id PK,FK
        text role PK
    }
    ADVISER_PORTFOLIO_MANAGER {
        uuid adviser_user_id PK,FK
        uuid pm_user_id PK,FK
        date from_date PK
        date to_date
    }
    HOUSEHOLD_ADVISER {
        uuid household_id PK,FK
        uuid user_id PK,FK
        text role
        date from_date PK
        date to_date
    }
    RISK_PROFILE_SCALE {
        uuid id PK
        uuid firm_id FK
        text profile UK
        int rank
    }

    FIRM ||--|| FIRM_POLICY : "governed by"
    FIRM ||--o{ USER : employs
    FIRM ||--o{ RISK_PROFILE_SCALE : defines
    USER ||--o{ USER_ROLE : holds
    USER ||--o{ ADVISER_PORTFOLIO_MANAGER : "reports as adviser"
    USER ||--o{ HOUSEHOLD_ADVISER : advises
```

`can_approve` is a flag on the user, not a role — an approver may hold any role.
Exactly one `primary` `HOUSEHOLD_ADVISER` is current per household.

## 2. Clients and households

```mermaid
erDiagram
    HOUSEHOLD {
        uuid id PK
        uuid firm_id FK
        text name
        text status
    }
    MEMBER {
        uuid id PK
        uuid household_id FK
        text kind
        text full_name
        bytea pan_encrypted
        bytea pan_hmac UK
        text pan_last4
        bytea dob_encrypted
        text kyc_status
        text relationship_to_primary
    }
    MEMBER_ACCOUNT {
        uuid id PK
        uuid member_id FK
        text name
        text status
        text risk_profile
        numeric review_threshold_pp
        date opened_on
    }
    HOLDING_ENTITY {
        uuid id PK
        uuid member_account_id FK
        text category
        text kind
        text institution
        text account_ref_masked
        text currency
        boolean under_advice
    }
    HOLDING_ENTITY_OWNER {
        uuid holding_entity_id PK,FK
        uuid member_id PK,FK
        text role
        numeric share_pct
    }
    EXTERNAL_ACCOUNT_LINK {
        uuid id PK
        text subject_type
        uuid subject_id
        text system
        text external_id
        date valid_from
        date valid_to
    }
    QUESTIONNAIRE {
        uuid id PK
        uuid firm_id FK
        text name
        int version_no
        text status
        timestamptz published_at
    }
    QUESTIONNAIRE_QUESTION {
        uuid id PK
        uuid questionnaire_id FK
        int sequence
        text prompt
        text kind
        jsonb options
        numeric weight
    }
    QUESTIONNAIRE_RESPONSE {
        uuid id PK
        uuid questionnaire_id FK
        uuid member_id FK
        timestamptz answered_at
        jsonb answers
    }
    RISK_ASSESSMENT {
        uuid id PK
        uuid member_id FK
        uuid response_id FK
        int score
        text profile
        text status
        text override_reason
    }

    HOUSEHOLD ||--|{ MEMBER : "is made of"
    MEMBER ||--o{ MEMBER_ACCOUNT : "advised through"
    MEMBER_ACCOUNT ||--o{ HOLDING_ENTITY : contains
    HOLDING_ENTITY ||--|{ HOLDING_ENTITY_OWNER : "owned via"
    MEMBER ||--o{ HOLDING_ENTITY_OWNER : owns
    MEMBER ||--o{ RISK_ASSESSMENT : "assessed by"
    QUESTIONNAIRE ||--|{ QUESTIONNAIRE_QUESTION : asks
    QUESTIONNAIRE ||--o{ QUESTIONNAIRE_RESPONSE : "answered as"
    MEMBER ||--o{ QUESTIONNAIRE_RESPONSE : answers
    QUESTIONNAIRE_RESPONSE ||--o| RISK_ASSESSMENT : scores
    MEMBER_ACCOUNT ||--o{ EXTERNAL_ACCOUNT_LINK : "identified by"
    HOLDING_ENTITY ||--o{ EXTERNAL_ACCOUNT_LINK : "identified by"
```

The spine of the whole model. A household has at least one member; a holding
entity has at least one owner; a joint entity belongs to the first holder's
member account, with co-holders recorded in `HOLDING_ENTITY_OWNER` — so drift is
never split or double-counted.

`EXTERNAL_ACCOUNT_LINK` is polymorphic on `subject_type`, which is why it has no
single foreign key and is unique on `(system, external_id)` within validity.

## 3. Onboarding, documents and imports

```mermaid
erDiagram
    ONBOARDING_CASE {
        uuid id PK
        uuid household_id FK
        text stage
        uuid assigned_to FK
        jsonb checklist
    }
    DOCUMENT {
        uuid id PK
        uuid household_id FK
        uuid member_id FK
        text kind
        text file_ref
        text sha256 UK
        text source_channel
        text status
    }
    IMPORT {
        uuid id PK
        uuid document_id FK
        text kind
        text parser
        text parser_version
        text status
        int records_found
        int records_applied
        uuid rolled_back_by FK
    }
    IMPORT_MATCH {
        uuid id PK
        uuid import_id FK
        text record_kind
        text source_line_ref
        text matched_entity_type
        uuid matched_entity_id
        numeric confidence
        text resolution
    }
    IMPORT_EFFECT {
        uuid id PK
        uuid import_id FK
        text entity_type
        uuid entity_id
        text action
        uuid superseded_entity_id
        jsonb before
    }

    ONBOARDING_CASE }o--|| HOUSEHOLD : guides
    DOCUMENT ||--o{ IMPORT : "parsed by"
    IMPORT ||--o{ IMPORT_MATCH : resolves
    IMPORT ||--o{ IMPORT_EFFECT : writes
```

`IMPORT_EFFECT` is the ledger that makes an import reversible. Rollback deletes
the inserts and reopens the rows the import superseded, in reverse order, LIFO
per holding entity.

`IMPORT.document_id` is shown nullable deliberately: Account Aggregator delivers
structured data under a consent artefact rather than a document, and this is
discussion point 7 of `docs/architecture.md`. If that lands the other way, the
column becomes mandatory.

## 4. Onboarding working data

Retained for a period and then discarded; not part of the long-lived portfolio
record.

```mermaid
erDiagram
    BANK_TRANSACTION {
        uuid id PK
        uuid holding_entity_id FK
        date posted_date
        text description
        numeric amount
        numeric balance_after
        uuid category_id FK
        uuid recurring_pattern_id FK
        text dedupe_hash UK
        uuid import_id FK
    }
    TRANSACTION_CATEGORY {
        uuid id PK
        uuid firm_id FK
        text name
        text kind
        uuid parent_id FK
    }
    RECURRING_PATTERN {
        uuid id PK
        uuid holding_entity_id FK
        uuid category_id FK
        numeric amount_typical
        text frequency
        numeric confidence
        text status
        text promoted_to_type
        uuid promoted_to_id
    }

    HOLDING_ENTITY ||--o{ BANK_TRANSACTION : records
    TRANSACTION_CATEGORY ||--o{ BANK_TRANSACTION : categorises
    TRANSACTION_CATEGORY ||--o{ TRANSACTION_CATEGORY : "nests under"
    RECURRING_PATTERN ||--o{ BANK_TRANSACTION : "detected from"
```

`promoted_to_type` and `promoted_to_id` are a deliberate polymorphic pointer: a
pattern becomes a `LIABILITY`, a `RECURRING_INCOME` or a `RECURRING_NEED`, and
the link is kept so the adviser can see where a figure came from.

## 5. Instruments — mostly shared reference data

**Mostly, not entirely — and the exception matters.** `INSTRUMENT` carries a
`scope` column with nullable `firm_id` and `household_id`, because the data
model took the decision to hold client-specific assets (a particular flat, an
unlisted holding) in the same table as public instruments rather than in a
separate client-asset table.

That decision and schema-per-tenant are in direct tension: a table in the shared
`reference` schema cannot also be partitioned per tenant. Everything else in
this area is genuinely shared and has no tenancy. See section 13.1 and
architecture discussion point 11.

```mermaid
erDiagram
    INSTRUMENT_TYPE {
        text code PK
        text label
        text default_asset_class
        boolean is_marketable
        boolean is_holdable
        boolean rating_applies
    }
    INSTRUMENT {
        uuid id PK
        text instrument_type_code FK
        text name
        uuid issuer_id FK
        text scope
        uuid firm_id FK
        uuid household_id FK
        text listing_status
        text data_confidence
        jsonb attributes
        text status
    }
    INSTRUMENT_TYPE_ATTRIBUTE {
        text instrument_type_code PK,FK
        text key PK
        text label
        text kind
        text unit
        jsonb options
        int sequence
        text owner
    }
    INSTRUMENT_IDENTIFIER {
        uuid id PK
        uuid instrument_id FK
        text scheme
        text value UK
        date valid_from
        date valid_to
    }
    ISSUER {
        uuid id PK
        text name
        text lei
    }
    PRICE {
        uuid instrument_id PK,FK
        date price_date PK
        text kind PK
        numeric value
        text currency
        uuid source_id FK
    }
    INSTRUMENT_RATING {
        uuid instrument_id PK,FK
        date rated_on PK
        text agency PK
        text rating
    }
    TAX_RULE {
        uuid id PK
        text jurisdiction
        text tax_class
        int long_term_months
        numeric short_term_rate_pct
        numeric long_term_rate_pct
        date valid_from
    }
    DATA_SOURCE {
        uuid id PK
        text name
        text licence_tag
    }
    FEED_RUN {
        uuid id PK
        uuid source_id FK
        timestamptz started_at
        text status
    }

    INSTRUMENT_TYPE ||--o{ INSTRUMENT : types
    INSTRUMENT_TYPE ||--o{ INSTRUMENT_TYPE_ATTRIBUTE : defines
    ISSUER ||--o{ INSTRUMENT : issues
    INSTRUMENT ||--o{ INSTRUMENT_IDENTIFIER : "known as"
    INSTRUMENT ||--o{ PRICE : "priced by"
    INSTRUMENT ||--o{ INSTRUMENT_RATING : "rated by"
    DATA_SOURCE ||--o{ FEED_RUN : runs
    DATA_SOURCE ||--o{ PRICE : supplies
```

Typed extensions — `MUTUAL_FUND_SCHEME`, `ETF_DETAIL`, `BOND_TERMS`,
`EQUITY_DETAIL`, `REIT_DETAIL`, `NPS_SCHEME`, `ALTERNATIVE_TERMS`,
`FUND_EXPOSURE` — each hang one-to-zero-or-one off `INSTRUMENT`, keyed by
`instrument_id`. They are omitted from the diagram because drawing eight
identical relationships adds nothing; see data model section 3.

`INSTRUMENT.attributes` is a `jsonb` column holding the type-specific fields —
coupon, maturity, expense ratio, purity, rental yield — validated against
`INSTRUMENT_TYPE_ATTRIBUTE`, because the same key means different things on
different types. `owner` on the attribute definition (`feed`, `firm`, `client`)
is what drives the grouped read-only display on security-master row expansion
(feature SM-10).

`PRICE` is a series keyed by date and kind, never a latest-value column on the
instrument. It is the largest table in this area and is range-partitioned by
`price_date`.

## 6. Firm classification and equivalence

Tenant-owned, and the counterpart to area 5: the same public instrument may be
classified differently by two firms.

```mermaid
erDiagram
    TAXONOMY_NODE {
        uuid id PK
        uuid firm_id FK
        uuid parent_id FK
        int level
        text label
        text key_path UK
        text asset_class
        date valid_from
        date valid_to
    }
    INSTRUMENT_CLASSIFICATION {
        uuid id PK
        uuid firm_id FK
        uuid instrument_id FK
        uuid taxonomy_node_id FK
        text liquidity_band
        int settlement_days
        boolean is_physical
        text tax_class
        text rating_bucket
        text duration_bucket
        date valid_from
        date valid_to
        uuid change_set_id FK
    }
    CLASSIFICATION_CHANGE_SET {
        uuid id PK
        uuid firm_id FK
        text status
        uuid created_by FK
        uuid reviewed_by FK
        timestamptz applied_at
        jsonb impact_summary
    }
    CLASSIFICATION_CHANGE {
        uuid id PK
        uuid change_set_id FK
        uuid instrument_id FK
        text field
        text old_value
        text new_value
    }
    INSTRUMENT_EQUIVALENCE_GROUP {
        uuid id PK
        uuid firm_id FK
        uuid taxonomy_node_id FK
        text name
        text purpose
        date valid_from
    }
    INSTRUMENT_EQUIVALENCE_MEMBER {
        uuid group_id PK,FK
        uuid instrument_id PK,FK
        boolean is_preferred
        int rank
    }
    THEME {
        uuid id PK
        uuid firm_id FK
        text name
    }
    INSTRUMENT_THEME {
        uuid instrument_id PK,FK
        uuid theme_id PK,FK
    }

    TAXONOMY_NODE ||--o{ TAXONOMY_NODE : "nests under"
    TAXONOMY_NODE ||--o{ INSTRUMENT_CLASSIFICATION : "placed under"
    TAXONOMY_NODE ||--o{ INSTRUMENT_EQUIVALENCE_GROUP : scopes
    CLASSIFICATION_CHANGE_SET ||--|{ CLASSIFICATION_CHANGE : contains
    CLASSIFICATION_CHANGE_SET ||--o{ INSTRUMENT_CLASSIFICATION : produces
    INSTRUMENT_EQUIVALENCE_GROUP ||--|{ INSTRUMENT_EQUIVALENCE_MEMBER : groups
    THEME ||--o{ INSTRUMENT_THEME : tags
```

Exactly one current `INSTRUMENT_CLASSIFICATION` per `(firm, instrument)`.
Applying a change set closes the current rows and opens new ones; it never
rewrites an approved target or a stored drift run.

## 7. Models

```mermaid
erDiagram
    MODEL {
        uuid id PK
        uuid firm_id FK
        text name UK
        text abbreviation
        text kind
        text intended_risk_profile
        text status
        uuid current_version_id FK
    }
    MODEL_VERSION {
        uuid id PK
        uuid model_id FK
        int version_no UK
        text status
        uuid published_by FK
        timestamptz published_at
        uuid approval_id FK
        uuid supersedes_version_id FK
        text customisation_policy
    }
    MODEL_TARGET {
        uuid model_version_id PK,FK
        uuid taxonomy_node_id PK,FK
        numeric target_pct
        numeric band_pp
    }
    MODEL_CONSTITUENT {
        uuid model_version_id PK,FK
        uuid taxonomy_node_id PK,FK
        uuid instrument_id PK,FK
        numeric weight_pct
        text role
    }
    MODEL_VERSION_ROLLOUT {
        uuid id PK
        uuid model_version_id FK
        uuid member_account_id FK
        uuid previous_target_id FK
        uuid new_target_id FK
        int overrides_carried
        int overrides_dropped
        jsonb dropped_reasons
        text status
    }

    MODEL ||--|{ MODEL_VERSION : "versioned as"
    MODEL_VERSION ||--|{ MODEL_TARGET : targets
    MODEL_VERSION ||--o{ MODEL_CONSTITUENT : holds
    MODEL_VERSION ||--o{ MODEL_VERSION_ROLLOUT : "rolled out via"
    MODEL_VERSION ||--o| MODEL_VERSION : supersedes
    TAXONOMY_NODE ||--o{ MODEL_TARGET : "targeted at"
```

A `MODEL_VERSION` is immutable once published. `MODEL_VERSION_ROLLOUT` carries
one row per member account on the model at publication and is the state machine
for the rollout saga — the version stays `publishing` until every row is
terminal.

## 8. Holdings and transactions

```mermaid
erDiagram
    HOLDING {
        uuid id PK
        uuid holding_entity_id FK
        uuid instrument_id FK
        date as_of
        numeric quantity
        numeric unit_price
        numeric market_value
        numeric cost_basis
        text source_kind
        uuid import_id FK
        date valid_from
        date valid_to
        uuid superseded_by_import_id FK
        boolean is_illustrative
    }
    TRANSACTION {
        uuid id PK
        uuid holding_entity_id FK
        uuid instrument_id FK
        date trade_date
        text kind
        numeric quantity
        numeric price
        numeric net_amount
        text dedupe_hash UK
        uuid import_id FK
    }
    LIABILITY {
        uuid id PK
        uuid holding_entity_id FK
        uuid financial_plan_id FK
        uuid member_id FK
        text kind
        numeric outstanding
        numeric rate_pct
        numeric emi
        uuid recurring_pattern_id FK
    }
    CASH_BALANCE {
        uuid holding_entity_id PK,FK
        date as_of PK
        numeric amount
        text source_kind
        uuid import_id FK
    }
    CAPITAL_COMMITMENT {
        uuid id PK
        uuid holding_entity_id FK
        uuid instrument_id FK
        numeric committed_amount
        date commitment_date
    }
    CAPITAL_CALL {
        uuid id PK
        uuid commitment_id FK
        date call_date
        numeric amount
        text kind
    }

    HOLDING_ENTITY ||--o{ HOLDING : holds
    HOLDING_ENTITY ||--o{ TRANSACTION : records
    HOLDING_ENTITY ||--o{ LIABILITY : owes
    HOLDING_ENTITY ||--o{ CASH_BALANCE : "has cash"
    HOLDING_ENTITY ||--o{ CAPITAL_COMMITMENT : commits
    CAPITAL_COMMITMENT ||--o{ CAPITAL_CALL : "drawn by"
```

The current position is the `HOLDING` row with a null `valid_to`. Imports
supersede rather than update, so history and rollback fall out of the same rows
rather than needing a separate audit table.

Nothing in this area is written by planning or recommendation workflows:
approving a recommendation never changes a holding.

## 9. Member-account target and drift

```mermaid
erDiagram
    MEMBER_ACCOUNT_TARGET {
        uuid id PK
        uuid member_account_id FK
        int version_no
        uuid model_version_id FK
        text status
        numeric review_threshold_pp
        uuid approval_id FK
        date effective_from
        uuid supersedes_id FK
        uuid rollout_id FK
    }
    MEMBER_ACCOUNT_TARGET_OVERRIDE {
        uuid target_id PK,FK
        uuid taxonomy_node_id PK,FK
        numeric target_pct
        numeric band_pp
        text reason
    }
    SCOPE_EXCLUSION {
        uuid target_id PK,FK
        uuid instrument_id PK,FK
        text reason
        uuid excluded_by FK
    }
    APPROVAL {
        uuid id PK
        text subject_type
        uuid subject_id
        uuid requested_by FK
        uuid decided_by FK
        timestamptz decided_at
        text decision
        text policy
    }
    COMPUTATION_RUN {
        uuid id PK
        text kind
        date as_of
        text engine_version
        text status
        jsonb inputs_summary
    }
    DRIFT_RUN {
        uuid id PK
        uuid member_account_id FK
        uuid target_id FK
        date as_of
        numeric aggregated_drift_pp
        numeric effective_threshold_pp
        text status
        uuid computation_run_id FK
        text stored_reason
    }
    DRIFT_ROW {
        uuid id PK
        uuid drift_run_id FK
        uuid taxonomy_node_id FK
        uuid instrument_id FK
        int level
        numeric actual_pct
        numeric target_pct
        numeric band_pp
        numeric drift_pp
        numeric value_gap
        boolean is_breach
        boolean is_most_specific_breach
    }
    EXPOSURE_FLAG {
        uuid id PK
        uuid drift_run_id FK
        text lens
        text bucket
        numeric actual_pct
        numeric limit_pct
        text kind
    }

    MEMBER_ACCOUNT ||--o{ MEMBER_ACCOUNT_TARGET : "targeted by"
    MODEL_VERSION ||--o{ MEMBER_ACCOUNT_TARGET : pins
    MEMBER_ACCOUNT_TARGET ||--o{ MEMBER_ACCOUNT_TARGET_OVERRIDE : adjusts
    MEMBER_ACCOUNT_TARGET ||--o{ SCOPE_EXCLUSION : excludes
    MEMBER_ACCOUNT_TARGET ||--o| APPROVAL : "approved by"
    MEMBER_ACCOUNT_TARGET ||--o| MEMBER_ACCOUNT_TARGET : supersedes
    MEMBER_ACCOUNT_TARGET ||--o{ DRIFT_RUN : "measured by"
    DRIFT_RUN ||--|{ DRIFT_ROW : contains
    DRIFT_RUN ||--o{ EXPOSURE_FLAG : flags
    COMPUTATION_RUN ||--o{ DRIFT_RUN : produces
```

Drift is stored at **member-account level only**. Household and firm views
aggregate stored runs; nothing is computed or approved at household level.

`APPROVAL` is polymorphic on `subject_type` — target, model version,
recommendation, classification change set or financial plan — which is why it
carries no single foreign key.

`DRIFT_ROW` is the fastest-growing table in the system and the subject of
discussion point 4 of `docs/architecture.md`.

## 10. Planning and recommendations

```mermaid
erDiagram
    FINANCIAL_PLAN {
        uuid id PK
        uuid household_id FK
        int version_no
        text status
        int horizon_years
        int emergency_months
        numeric monthly_investment_target
        uuid approval_id FK
    }
    RECURRING_INCOME {
        uuid id PK
        uuid financial_plan_id FK
        uuid member_id FK
        uuid holding_entity_id FK
        text kind
        numeric amount
        text frequency
        numeric growth_pct
        uuid recurring_pattern_id FK
    }
    RECURRING_NEED {
        uuid id PK
        uuid financial_plan_id FK
        text category
        numeric amount
        text frequency
        int starts_in_years
        int lasts_years
        numeric inflation_pct
        boolean is_goal
        int priority
    }
    PLAN_PROJECTION {
        uuid id PK
        uuid financial_plan_id FK
        date as_of
        jsonb assumptions
        jsonb yearly_rows
        int funding_gap_year
        jsonb flags
        uuid computation_run_id FK
    }
    REBALANCE_SCENARIO {
        uuid id PK
        uuid member_account_id FK
        uuid target_id FK
        uuid drift_run_id FK
        text kind
        jsonb constraints
        text status
        numeric projected_drift_pp
        numeric estimated_tax
        jsonb infeasibility_reasons
    }
    SUGGESTED_TRADE {
        uuid id PK
        uuid scenario_id FK
        uuid holding_entity_id FK
        uuid instrument_id FK
        text side
        numeric quantity
        numeric amount
        numeric est_tax
        text rationale
        int sequence
    }
    CASH_EVENT {
        uuid id PK
        uuid member_account_id FK
        text intent
        numeric gross_amount
        numeric net_amount
        date needed_by
        text deployment
        jsonb stages
        text status
        uuid scenario_id FK
    }
    RECOMMENDATION {
        uuid id PK
        uuid member_account_id FK
        uuid scenario_id FK
        int version_no
        text status
        uuid approval_id FK
        timestamptz communicated_at
        text client_response
        timestamptz executed_at
        uuid reconciliation_import_id FK
    }
    RECOMMENDATION_STATUS_EVENT {
        uuid id PK
        uuid recommendation_id FK
        text from_status
        text to_status
        timestamptz at
        uuid by FK
    }

    HOUSEHOLD ||--o{ FINANCIAL_PLAN : plans
    FINANCIAL_PLAN ||--o{ RECURRING_INCOME : earns
    FINANCIAL_PLAN ||--o{ RECURRING_NEED : spends
    FINANCIAL_PLAN ||--o{ LIABILITY : owes
    FINANCIAL_PLAN ||--o{ PLAN_PROJECTION : projects
    MEMBER_ACCOUNT ||--o{ REBALANCE_SCENARIO : "planned by"
    DRIFT_RUN ||--o{ REBALANCE_SCENARIO : "measured from"
    REBALANCE_SCENARIO ||--|{ SUGGESTED_TRADE : proposes
    REBALANCE_SCENARIO ||--o| CASH_EVENT : "raises or invests"
    REBALANCE_SCENARIO ||--o| RECOMMENDATION : becomes
    RECOMMENDATION ||--|{ RECOMMENDATION_STATUS_EVENT : "tracked by"
```

`LIABILITY` appears in both area 8 and area 10: it hangs off a holding entity
where a statement exists and belongs to the household plan for the roll-up. It
is one table with two parents, not two tables.

## 11. Audit

```mermaid
erDiagram
    AUDIT_EVENT {
        uuid id PK
        uuid firm_id FK
        timestamptz occurred_at
        uuid actor_user_id FK
        text actor_kind
        text object_type
        uuid object_id
        text action
        jsonb before
        jsonb after
        text request_id
        inet client_ip
    }
```

Append-only, with no inbound foreign keys. `object_type` and `object_id` are a
deliberate polymorphic pointer: constraining them would make the audit log
depend on the lifetime of the rows it describes, which defeats its purpose.

---

## 12. Service ownership overlay

The bridge from this document to `docs/microservices-design.md`.

| Area | Owning service | Tenancy |
|---|---|---|
| 1 Firm and users | identity-and-firm | `platform` schema, cross-tenant |
| 2 Clients and households | advisory-core | tenant schema |
| 3 Onboarding, documents and imports | ingestion, except `IMPORT_EFFECT` → advisory-core | tenant schema |
| 4 Onboarding working data | ingestion | tenant schema |
| 5 Instruments | reference-data | `reference` schema, no tenancy |
| 6 Classification and equivalence | advisory-core | tenant schema |
| 7 Models | advisory-core | tenant schema |
| 8 Holdings and transactions | advisory-core | tenant schema |
| 9 Target, approval and drift | advisory-core, except `DRIFT_RUN`, `DRIFT_ROW`, `EXPOSURE_FLAG`, `COMPUTATION_RUN` → analytics | tenant schema |
| 10 Planning and recommendations | advisory-core, except `PLAN_PROJECTION`, `REBALANCE_SCENARIO`, `SUGGESTED_TRADE` → analytics | tenant schema |
| 11 Audit | audit | tenant schema |

Areas 9 and 10 are the only ones that split, and they split along the same line
every time: **what a `COMPUTATION_RUN` produced belongs to analytics; what
carries an `APPROVAL` belongs to advisory-core.**

## 13. Cross-boundary references

Relationships that cross a service or schema boundary. These are where a
foreign key may not be available and where consistency has to be reasoned about
rather than declared.

| From | To | Crosses | Enforceable as FK? | Handling |
|---|---|---|---|---|
| `INSTRUMENT_CLASSIFICATION.instrument_id` | `reference.INSTRUMENT` | tenant → `reference` schema | **Yes** — same database | Declare the FK. Reference data is never deleted, only superseded |
| `HOLDING.instrument_id` | `reference.INSTRUMENT` | tenant → `reference` | **Yes** | Declare the FK |
| `MODEL_CONSTITUENT.instrument_id` | `reference.INSTRUMENT` | tenant → `reference` | **Yes** | Declare the FK |
| `DRIFT_ROW.instrument_id` | `reference.INSTRUMENT` | tenant → `reference` | **Yes** | Declare the FK |
| `USER.firm_id`, `HOUSEHOLD_ADVISER.household_id` | `platform` ↔ tenant | `platform` → tenant schema | **No** — crosses the tenant boundary in the wrong direction | `HOUSEHOLD_ADVISER` lives in `platform` and references a household id without a constraint. Orphan detection is a scheduled integrity job |
| `DRIFT_RUN.target_id` | `MEMBER_ACCOUNT_TARGET` | analytics → advisory-core | **Yes** — same schema | Declare the FK. Both are tenant-schema tables; the service split is logical, not physical |
| `RECOMMENDATION.scenario_id` | `REBALANCE_SCENARIO` | advisory-core → analytics | **Yes** | Declare the FK, and **block deletion of a scenario a recommendation pins** — this is what makes an approved recommendation reproducible |
| `IMPORT_EFFECT.import_id` | `IMPORT` | advisory-core → ingestion | **Yes** | Declare the FK |
| `IMPORT_EFFECT.entity_id` | any superseded row | polymorphic | **No** | By design. Validated by the rollback routine, not by a constraint |
| `APPROVAL.subject_id` | five subject types | polymorphic | **No** | By design |
| `AUDIT_EVENT.object_id` | anything | polymorphic | **No** | By design |
| `EXTERNAL_ACCOUNT_LINK.subject_id` | four subject types | polymorphic | **No** | By design |
| `RECURRING_PATTERN.promoted_to_id` | three target types | polymorphic | **No** | By design |

Two conclusions worth carrying into the microservices design:

- **Most cross-service references are still enforceable**, because the service
  split is logical and the tables share a database. That is a benefit of the
  decomposition in `docs/architecture.md` section 1, and it would be lost by
  splitting the database per service.
- **Six relationships are deliberately polymorphic** and can never have a
  foreign key. Each needs an integrity check in code and a scheduled orphan
  scan. They are not accidents and should not be "fixed".

### 13.1 Scoped instruments versus schema-per-tenant

Drawing area 5 surfaced a conflict between two decisions that were each taken
soundly on their own.

The data model decided: **one `Instrument` table with a scope column, not a
separate client-asset table.** `Instrument` therefore carries `scope` with
nullable `firm_id` and `household_id`, so a client's flat or an unlisted
holding sits beside HDFC Bank in the same table, classified by the same
taxonomy and held by the same `Holding` rows.

The architecture decided: **a schema per tenant, with shared `reference` and
`platform` schemas.**

These cannot both hold. A table in the shared `reference` schema cannot also be
partitioned per tenant, and a tenant's private assets sitting in a shared table
is precisely the isolation property that justified schema-per-tenant.

| Option | Consequence |
|---|---|
| **A. Split the table.** `reference.instrument` for `scope = public`; `tenant_x.instrument` for firm- and household-scoped rows | Contradicts "one table". Every query that joins a holding to an instrument must now resolve across two tables, usually by a view that unions them. `Holding.instrument_id` can no longer carry a single foreign key |
| **B. One table in `reference`**, with `firm_id` and `household_id` populated for scoped rows | Keeps the data model intact and keeps the foreign keys. But tenant-private data lives outside the tenant schema, so `reference` needs row-level security for scoped rows — reintroducing exactly the mechanism schema-per-tenant was chosen to avoid, for one table |
| **C. No client-specific instruments in phase 1.** Public instruments only; defer private assets | Cleanest structurally, but the prototype already shows real assets and liabilities on the balance sheet, so this removes delivered behaviour |

**Recommendation: option B.** It preserves the data model's decision and every
foreign key in section 13, and confines the row-level-security mechanism to a
single, small, well-understood table rather than spreading it across the schema.
The isolation argument is weaker here than it looks, because scoped instrument
rows carry a name and a type — not holdings, values or personal data.

This is new since `docs/architecture.md` revision 1 and is recorded there as
discussion point 11. `ROADMAP.md` already lists "deciding where client-specific
assets live" as unresolved under security-master extensions, so this is a known
gap now given a concrete shape.

## 14. Tenancy and `firm_id`

Under schema-per-tenant, `firm_id` is redundant on tenant-schema tables — the
schema already determines the firm. It is retained anyway:

- A row stays self-describing in a log line, an error report or a support query.
- Consolidating onto a shared schema later becomes a configuration change rather
  than a data migration.
- It costs one column.

`reference` tables have no `firm_id` and must not acquire one. `platform` tables
carry it as a real discriminator, because that schema genuinely is cross-tenant.

This is discussion point 10 of `docs/architecture.md`, and is open.

## Open items

1. **Where scoped instruments live** — section 13.1, and architecture discussion
   point 11. This is the only open item here that blocks a table: the
   `INSTRUMENT` DDL cannot be written until it is settled.
2. **Typed instrument extensions are not drawn** (area 5). Eight identical
   one-to-zero-or-one relationships; add them to the DDL, not the diagram.
   `INSTRUMENT_TYPE_ATTRIBUTE` *is* drawn, because it defines the `jsonb`
   attribute contract rather than being one more extension table.
3. **Deferred research entities are not drawn.** They are in the data model
   appendix and are not built in this phase.
4. **`IMPORT.document_id` nullability** follows architecture discussion point 7.
5. **Partitioning is not shown.** `PRICE`, `BANK_TRANSACTION`, `AUDIT_EVENT` and
   `DRIFT_ROW` are partitioned; that belongs in the DDL.
6. **`HOUSEHOLD_ADVISER` placement** — shown in `platform` with area 1, but it
   references a tenant-schema household. It may belong in the tenant schema
   instead, which would move the unenforceable reference rather than remove it.
   Decide with the DDL.
