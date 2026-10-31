# Feature list

Status: **revision 1, draft for review**, 31 October 2026.

This document did not previously exist. It was named as a dependency of the
microservices design and the API design, so it is derived here from the sources
that already describe the product: `README.md`, `ROADMAP.md`,
`docs/original-mockup-traceability.md`, `docs/ui-ux-refinement-plan.md`,
`docs/data-model.md` and the delivered prototype itself.

**It is a derivation, not a statement of intent.** Everything below was read out
of what exists; nothing was invented. The product owner should confirm it before
it is used to size or sequence work — in particular the `mvp` / `later` split,
which is the one judgement this document makes that its sources do not make
explicitly.

## How to read this

Each feature carries the data-model entities it reads or writes and the service
that will own it. Those two columns are the point of the document: they are what
make it usable as the input to `docs/erd.md`, `docs/microservices-design.md` and
the API design, and what lets a later question — *what breaks if we change
`MemberAccountTarget`?* — be answered by a search rather than a meeting.

### Status vocabulary

| Status | Meaning |
|---|---|
| `prototype` | Demonstrated in the browser prototype on `main`. The behaviour is specified by working code and can be walked through today |
| `mvp` | In scope for the first production phase per `docs/data-model.md`, but **not** in the prototype — principally onboarding, statement ingestion and anything requiring a backend |
| `later` | Deliberately out of this phase, with the decision recorded |

A feature marked `prototype` is not therefore finished: it means the behaviour
is designed and demonstrable, not that it is production-ready. Production
concerns — authenticated persistence, real prices, verified ownership — are
tracked as `mvp` against the features that need them.

### Actors

| Actor | Description |
|---|---|
| Adviser | Owns the client relationship. Creates drafts, requests approval, communicates recommendations |
| Portfolio manager | Oversees advisers. May approve where `can_approve` is set |
| Operations | Runs imports, classification changes and data quality. No client relationship |
| Admin | Firm setup, users, policy |
| System | Scheduled and event-driven work. Attributed as `system` in the audit trail |
| Client | Household member. **No login in this phase**; the portal is v2 |

### Services

`identity-and-firm`, `reference-data`, `advisory-core`, `analytics`,
`ingestion`, `audit` — as defined in `docs/architecture.md` section 1.2.

---

## 1. Firm setup and administration

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| FS-01 | Register a firm as a tenant, with SEBI registration number and principal officer | Admin | `mvp` | `Firm` | identity-and-firm |
| FS-02 | Provision a tenant: create the schema, run migrations, seed taxonomy, instrument types, transaction categories, risk scale | System | `mvp` | all seed tables | identity-and-firm |
| FS-03 | Create and deactivate users | Admin | `mvp` | `User` | identity-and-firm |
| FS-04 | Assign roles (`adviser`, `portfolio_manager`, `operations`, `admin`) | Admin | `mvp` | `UserRole` | identity-and-firm |
| FS-05 | Set the approver flag on a user | Admin | `mvp` | `User.can_approve` | identity-and-firm |
| FS-06 | Maintain the adviser-to-portfolio-manager reporting hierarchy | Admin | `mvp` | `AdviserPortfolioManager` | identity-and-firm |
| FS-07 | Assign a primary and secondary adviser to a household | Admin | `mvp` | `HouseholdAdviser` | identity-and-firm |
| FS-08 | Set the firm default review threshold in percentage points | Admin | `prototype` | `FirmPolicy` | identity-and-firm |
| FS-09 | Set model depth per asset class; changing it re-projects every model and raises an audit event | Admin | `prototype` | `FirmPolicy` | identity-and-firm |
| FS-10 | Set default tolerance bands by classification level | Admin | `prototype` | `FirmPolicy` | identity-and-firm |
| FS-11 | Set the firm equity concentration cap used by the model sector view | Admin | `prototype` | `FirmPolicy.sector_cap_pct` | identity-and-firm |
| FS-12 | Choose whether same-node instruments are implicitly equivalent | Admin | `mvp` | `FirmPolicy.same_node_is_equivalent` | identity-and-firm |
| FS-13 | Maintain the risk profile scale | Admin | `mvp` | `RiskProfileScale` | identity-and-firm |
| FS-14 | Sign in through the external identity provider | All | `mvp` | `User.auth_subject` | — |

## 2. Client onboarding

Not represented in the prototype at all; drawn entirely from
`docs/data-model.md` section 2.

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| ON-01 | Create a household, including an individual client as a household of one | Adviser | `mvp` | `Household` | advisory-core |
| ON-02 | Add members with kind, PAN, date of birth, residency and relationship | Adviser | `mvp` | `Member` | advisory-core |
| ON-03 | Record KYC status per member | Adviser | `mvp` | `Member.kyc_status` | advisory-core |
| ON-04 | Create member accounts; one per member at onboarding, more on request | Adviser | `mvp` | `MemberAccount` | advisory-core |
| ON-05 | Track onboarding stage as a guide, not a gate | Adviser | `mvp` | `OnboardingCase` | advisory-core |
| ON-06 | Publish and version the firm risk questionnaire | Admin | `mvp` | `Questionnaire`, `QuestionnaireQuestion` | advisory-core |
| ON-07 | Capture questionnaire responses per member | Adviser | `mvp` | `QuestionnaireResponse` | advisory-core |
| ON-08 | Score a response into a risk assessment, with adviser override and reason | Adviser | `mvp` | `RiskAssessment` | advisory-core |
| ON-09 | Supersede a risk assessment, keeping at most one current per member | System | `mvp` | `RiskAssessment.status` | advisory-core |
| ON-10 | Set the member account risk profile, with reference to assessments but as a separate decision | Adviser | `mvp` | `MemberAccount.risk_profile` | advisory-core |
| ON-11 | Register holding entities — demat, folio, broker, PMS, AIF, NPS, EPF, PPF, bank, card, loan | Adviser | `mvp` | `HoldingEntity` | advisory-core |
| ON-12 | Record co-holders of a joint entity without moving it between member accounts | Adviser | `mvp` | `HoldingEntityOwner` | advisory-core |
| ON-13 | Map external system identifiers to our entities | Operations | `mvp` | `ExternalAccountLink` | advisory-core |
| ON-14 | Mark a holding entity as under advice or recorded only | Adviser | `mvp` | `HoldingEntity.under_advice` | advisory-core |

## 3. Document and statement ingestion

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| IN-01 | Upload a statement or document, deduplicated by SHA-256 within the firm | Operations | `mvp` | `Document` | ingestion |
| IN-02 | Parse NSDL and CDSL CAS, including password-protected files | System | `mvp` | `Import` | ingestion |
| IN-03 | Parse broker holdings and contract notes | System | `mvp` | `Import` | ingestion |
| IN-04 | Parse mutual fund statements | System | `mvp` | `Import` | ingestion |
| IN-05 | Parse bank and credit-card statements | System | `mvp` | `Import`, `BankTransaction` | ingestion |
| IN-06 | Parse AIS for income cross-checks | System | `mvp` | `Import`, `RecurringIncome` | ingestion |
| IN-07 | Match each parsed line to a holding entity, instrument or member with a confidence score | System | `mvp` | `ImportMatch` | ingestion |
| IN-08 | Review what the parser found, and confirm, correct, create or skip each match, before it becomes data | Operations | `mvp` | `ImportMatch.resolution` | ingestion |
| IN-09 | Apply a reviewed import transactionally, superseding rather than updating | Operations | `mvp` | `ImportEffect`, `Holding` | advisory-core |
| IN-10 | Roll back an applied import, LIFO per holding entity | Operations | `mvp` | `ImportEffect` | advisory-core |
| IN-11 | Re-import a document with a newer parser, keeping every run | Operations | `mvp` | `Import.parser_version` | ingestion |
| IN-12 | Show two statements disagreeing, rather than silently overwriting | System | `mvp` | `Holding.valid_to` | advisory-core |
| IN-13 | Detect recurring patterns in bank transactions | System | `mvp` | `RecurringPattern` | ingestion |
| IN-14 | Promote a detected pattern to a liability, recurring income or recurring need, keeping the link | Adviser | `mvp` | `RecurringPattern.promoted_to_*` | advisory-core |
| IN-15 | Categorise transactions against a firm-editable category list | Operations | `mvp` | `TransactionCategory` | ingestion |
| IN-16 | Enter a holding manually where no statement exists | Adviser | `mvp` | `Holding.source_kind` | advisory-core |
| IN-17 | Surface failed and stuck imports with the parser error attached | Operations | `mvp` | `Import.status`, `errors` | ingestion |
| IN-18 | Ingest via Account Aggregator under a consent artefact | System | `later` | — | ingestion |
| IN-19 | Ingest CAS from a monitored mailbox | System | `later` | `Document.source_channel` | ingestion |

## 4. Securities reference data

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| RD-01 | Maintain the instrument type master | Operations | `prototype` | `InstrumentType` | reference-data |
| RD-02 | Hold one instrument row for everything holdable, plus non-holdable indices as benchmarks | System | `prototype` | `Instrument` | reference-data |
| RD-03 | Carry identifiers — ISIN, symbol, scheme code — as attributes, never as the key | System | `mvp` | `InstrumentIdentifier` | reference-data |
| RD-04 | Store prices as a dated series, never a latest-value column | System | `mvp` | `Price` | reference-data |
| RD-05 | Hold type-specific attributes for funds, ETFs, bonds, REITs, NPS and alternatives | System | `prototype` | typed extensions | reference-data |
| RD-06 | Record credit ratings over time | System | `prototype` | `InstrumentRating` | reference-data |
| RD-07 | Maintain tax rules by jurisdiction and tax class | System | `mvp` | `TaxRule` | reference-data |
| RD-08 | Record data source and licence tag per fact, and track feed runs | System | `mvp` | `DataSource`, `FeedRun` | reference-data |
| RD-09 | Leave ISIN and current price blank where no source supplies them | System | `prototype` | `Instrument` | reference-data |
| RD-10 | Ingest a daily price feed | System | `mvp` | `Price`, `FeedRun` | reference-data |
| RD-11 | Fund look-through exposure by geography and sector | System | `prototype` | `FundExposure` | reference-data |
| RD-12 | Add an instrument from a real firm or vendor source | Operations | `later` | `Instrument` | reference-data |

## 5. Firm classification — the security master

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| SM-01 | Maintain the firm taxonomy: asset class › super sector › sector › sub-sector | Operations | `prototype` | `TaxonomyNode` | advisory-core |
| SM-02 | Nest the levels, so each dropdown offers only what belongs under the level above | Operations | `prototype` | `TaxonomyNode.parent_id` | advisory-core |
| SM-03 | Retire a node rather than deleting it | Operations | `prototype` | `TaxonomyNode.valid_to` | advisory-core |
| SM-04 | Classify each instrument under exactly one current node per firm | Operations | `prototype` | `InstrumentClassification` | advisory-core |
| SM-05 | Set liquidity band, settlement days and physical flag | Operations | `prototype` | `InstrumentClassification` | advisory-core |
| SM-06 | Set tax class, rating bucket and duration bucket | Operations | `prototype` | `InstrumentClassification` | advisory-core |
| SM-07 | Browse the firm-wide grid, one row per instrument | Operations | `prototype` | `InstrumentClassification` | advisory-core |
| SM-08 | Filter from every column header, nested the same way as the levels | Operations | `prototype` | — | advisory-core |
| SM-09 | Filter to instruments needing classification, from the count that reports them | Operations | `prototype` | — | advisory-core |
| SM-10 | Expand a row to see that instrument type's own attributes, grouped by whether a feed, the firm or the client owns them | Operations | `prototype` | typed extensions | advisory-core |
| SM-11 | Turn those attributes into comparable columns when filtered to one instrument type | Operations | `prototype` | — | advisory-core |
| SM-12 | Stage classification edits as a change set rather than applying them directly | Operations | `prototype` | `ClassificationChangeSet` | advisory-core |
| SM-13 | Review a change set stating the instruments, value and portfolios affected | Operations | `prototype` | `ClassificationChange` | advisory-core |
| SM-14 | Apply a change set, changing analysis going forward without restating an approved snapshot | Operations | `prototype` | `ClassificationChangeSet.applied_at` | advisory-core |
| SM-15 | Tag instruments by theme for filtering and reporting | Operations | `prototype` | `Theme`, `InstrumentTheme` | advisory-core |
| SM-16 | Define equivalence groups of interchangeable instruments, with a preferred instrument for buys | Operations | `mvp` | `InstrumentEquivalenceGroup` | advisory-core |

## 6. Models

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| MD-01 | Browse a searchable model library with allocation preview and last-updated date | Adviser | `prototype` | `Model` | advisory-core |
| MD-02 | Hold models by risk profile and by strategy, each naming its intended risk profile | Adviser | `prototype` | `Model.kind` | advisory-core |
| MD-03 | Set targets and tolerance bands on the classification tree to a per-asset-class depth | Portfolio manager | `prototype` | `ModelTarget` | advisory-core |
| MD-04 | Keep children summing to their parent, and level-0 nodes summing to 100 | System | `prototype` | `ModelTarget` | advisory-core |
| MD-05 | Name instrument-level constituents under a node, with weights and roles | Portfolio manager | `mvp` | `ModelConstituent` | advisory-core |
| MD-06 | Show a Tags column listing what the securities beneath each branch are, and filter the tree by one | Adviser | `prototype` | — | advisory-core |
| MD-07 | Edit a model in a focused editor | Portfolio manager | `prototype` | `ModelVersion(draft)` | advisory-core |
| MD-08 | Compare models side by side in a scalable comparison workspace | Adviser | `prototype` | `ModelVersion` | advisory-core |
| MD-09 | View models by intended risk profile, as a view within comparison | Adviser | `prototype` | `Model.intended_risk_profile` | advisory-core |
| MD-10 | Check equity concentration against the firm cap in the sector view | Portfolio manager | `prototype` | `FirmPolicy.sector_cap_pct` | analytics |
| MD-11 | Publish a model version, immutable thereafter, with validation of every summation rule | Portfolio manager | `prototype` | `ModelVersion`, `Approval` | advisory-core |
| MD-12 | Choose on publication whether member-account overrides are preserved or reset | Portfolio manager | `mvp` | `ModelVersion.customisation_policy` | advisory-core |
| MD-13 | Roll every account on the model forward to the new version, recording per account exactly what happened to its overrides | System | `mvp` | `ModelVersionRollout` | advisory-core |
| MD-14 | Never silently change an approved client target by publishing a model | System | `prototype` | `MemberAccountTarget` | advisory-core |
| MD-15 | View publication history and historical bands | Adviser | `prototype` | `ModelVersion` | advisory-core |
| MD-16 | Retire a model | Portfolio manager | `prototype` | `Model.status` | advisory-core |

## 7. Portfolio overview

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| OV-01 | List households and accounts in separate views, searchable | Adviser | `prototype` | `Household`, `MemberAccount` | advisory-core |
| OV-02 | Filter by model | Adviser | `prototype` | `MemberAccountTarget` | advisory-core |
| OV-03 | Show original AUM per row | Adviser | `prototype` | `Holding` | advisory-core |
| OV-04 | Show an aggregated drift bar scaled relative to the threshold | Adviser | `prototype` | `DriftRun.aggregated_drift_pp` | analytics |
| OV-05 | Edit the portfolio threshold inline; blank inherits the firm default | Adviser | `prototype` | `MemberAccount.review_threshold_pp` | advisory-core |
| OV-06 | State the review reason — asset class, exposure, or both | System | `prototype` | `DriftRun.stored_reason` | analytics |
| OV-07 | Show a financial-plan column: funded, or the year a gap first appears with its liquidity runway | Adviser | `prototype` | `PlanProjection` | analytics |
| OV-08 | Expand a row into drift by asset class, contributing accounts and the worst bucket per exposure lens | Adviser | `prototype` | `DriftRow`, `ExposureFlag` | analytics |
| OV-09 | Indicate a pending cash event on the row | Adviser | `later` | `CashEvent.status` | advisory-core |
| OV-10 | Select flagged portfolios for bulk planning | Adviser | `later` | — | analytics |

## 8. Household and account detail

The household carries the same five tabs as an account, reusing the same
screens. A household has no target of its own, so nothing there is editable or
approvable.

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| PD-01 | Open a household or account into five numbered work areas | Adviser | `prototype` | — | advisory-core |
| PD-02 | Aggregate household views from stored member-account results; compute nothing at household level | System | `prototype` | `DriftRun` | analytics |
| PD-03 | Show a read-only comparison of approved account targets and the blend they produce | Adviser | `prototype` | `MemberAccountTarget` | advisory-core |

### Tab 1 — Assets and liabilities

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| AL-01 | Household balance sheet: assets by liquidity band with days to cash | Adviser | `prototype` | `Holding`, `InstrumentClassification` | analytics |
| AL-02 | Liabilities with interest still to pay | Adviser | `prototype` | `Liability` | analytics |
| AL-03 | Net worth and debt-to-assets | Adviser | `prototype` | — | analytics |
| AL-04 | Twelve-month cash-flow projection | Adviser | `prototype` | `RecurringIncome`, `RecurringNeed` | analytics |
| AL-05 | Yearly expenses by category, with a five-year inflated view | Adviser | `prototype` | `RecurringNeed` | analytics |
| AL-06 | Show the household plan on an account, because income, liabilities and needs are household facts | System | `prototype` | `FinancialPlan` | advisory-core |

### Tab 2 — Allocation and drift

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| AD-01 | Actual versus approved client target, as a distribution chart | Adviser | `prototype` | `DriftRow` | analytics |
| AD-02 | Holdings hierarchy with review state and liquidity and physical tags | Adviser | `prototype` | `Holding` | analytics |
| AD-03 | Show the band each row is judged against | Adviser | `prototype` | `DriftRow.band_pp` | analytics |
| AD-04 | Show value gaps per node | Adviser | `prototype` | `DriftRow.value_gap` | analytics |
| AD-05 | Flag only the most specific breach in a branch | System | `prototype` | `DriftRow.is_most_specific_breach` | analytics |
| AD-06 | Expand to breaches | Adviser | `prototype` | — | analytics |
| AD-07 | Exposure lenses as read-only distributions with limits | Adviser | `prototype` | `ExposureFlag` | analytics |
| AD-08 | Retune targets and bands inline, moving siblings under the same parent so the level above does not change | Adviser | `prototype` | `MemberAccountTargetOverride` | advisory-core |
| AD-09 | Land an inline retune in the target draft, never in the approved target | System | `prototype` | `MemberAccountTarget(draft)` | advisory-core |
| AD-10 | Distinguish a null target — below the model's depth — from a target of zero | System | `prototype` | `DriftRow.target_pct` | analytics |

### Tab 3 — Gap summary and trades

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| GT-01 | Gap summary per node | Adviser | `prototype` | `DriftRow` | analytics |
| GT-02 | Build a rebalance scenario with suggested trades | Adviser | `prototype` | `RebalanceScenario`, `SuggestedTrade` | analytics |
| GT-03 | Keep a rebalance cash-neutral and never sell from a class already below target | System | `prototype` | `RebalanceScenario` | analytics |
| GT-04 | Apply liquidity and short-term-gain constraints | Adviser | `prototype` | `RebalanceScenario.constraints` | analytics |
| GT-05 | Apply a do-not-sell list and a turnover cap | Adviser | `mvp` | `RebalanceScenario.constraints` | analytics |
| GT-06 | Estimate tax after loss offsets and the long-term exemption, labelled illustrative | System | `prototype` | `TaxRule` | analytics |
| GT-07 | Project before-and-after allocation | Adviser | `prototype` | `RebalanceScenario.projected_allocation` | analytics |
| GT-08 | Report why a scenario is infeasible rather than returning nothing | System | `prototype` | `infeasibility_reasons` | analytics |
| GT-09 | Count a held equivalent toward a model constituent instead of selling to buy its twin | System | `mvp` | `InstrumentEquivalenceGroup` | analytics |
| GT-10 | Name the holding entity on every suggested trade, because a trade is not actionable without one | System | `mvp` | `SuggestedTrade.holding_entity_id` | analytics |
| GT-11 | Approve a scenario as a recommendation — a record, not a trade | Adviser | `prototype` | `Recommendation`, `Approval` | advisory-core |
| GT-12 | Roll the household gap summary up per account | Adviser | `prototype` | `DriftRun` | analytics |
| GT-13 | Select across accounts and approve together | Adviser | `later` | — | analytics |

### Tab 4 — Cash and planning

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| CP-01 | Raise or invest cash, with gross proceeds versus net after estimated tax | Adviser | `prototype` | `CashEvent` | analytics |
| CP-02 | Deploy as a lump sum or in stages | Adviser | `prototype` | `CashEvent.stages` | analytics |
| CP-03 | Choose a selection strategy, including loss harvesting | Adviser | `prototype` | `RebalanceScenario` | analytics |
| CP-04 | Keep scenarios from ever changing recorded holdings or the approved target | System | `prototype` | — | analytics |
| CP-05 | Show per-portfolio event history | Adviser | `prototype` | `CashEvent` | advisory-core |
| CP-06 | Record income and assumptions for the household plan | Adviser | `prototype` | `FinancialPlan`, `RecurringIncome` | advisory-core |
| CP-07 | Raise planning flags | System | `prototype` | `PlanProjection.flags` | analytics |
| CP-08 | Project 30 years, with the year a funding gap first appears | Adviser | `prototype` | `PlanProjection` | analytics |
| CP-09 | Order a contingency cash raise cheapest-first by tax and exit penalty | System | `prototype` | `RebalanceScenario` | analytics |
| CP-10 | Plan recurring investment against a monthly target | Adviser | `prototype` | `FinancialPlan.monthly_investment_target` | advisory-core |
| CP-11 | Edit the liability register | Adviser | `prototype` | `Liability` | advisory-core |
| CP-12 | Edit the recurring-need register, where a goal is a need with a start and a duration | Adviser | `prototype` | `RecurringNeed` | advisory-core |
| CP-13 | Version the plan so a projection shown last quarter can be reproduced | System | `mvp` | `FinancialPlan.version_no` | advisory-core |

### Tab 5 — Client target

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| CT-01 | Assign a model to a member account, pinning a specific model version | Adviser | `prototype` | `MemberAccountTarget` | advisory-core |
| CT-02 | Adjust asset-class targets away from the model | Adviser | `prototype` | `MemberAccountTargetOverride` | advisory-core |
| CT-03 | Set per-bucket lens limits that replace the model-implied target or the default band | Adviser | `prototype` | `MemberAccountTargetOverride` | advisory-core |
| CT-04 | Store overrides as the resulting full set after sibling rebalancing, so a reader never re-derives them | System | `prototype` | `MemberAccountTargetOverride` | advisory-core |
| CT-05 | Exclude recorded holdings from advice, with a reason on every exclusion | Adviser | `prototype` | `ScopeExclusion` | advisory-core |
| CT-06 | Save a draft, keeping at most one draft and one approved per account | Adviser | `prototype` | `MemberAccountTarget.status` | advisory-core |
| CT-07 | Approve a target, superseding rather than altering the previous one | Adviser | `prototype` | `Approval` | advisory-core |
| CT-08 | Restrict approval to users with the approver flag | System | `mvp` | `User.can_approve` | advisory-core |
| CT-09 | Show this account's own target revisions on its tab | Adviser | `prototype` | `MemberAccountTarget` | advisory-core |
| CT-10 | Require a second, different approver under a maker-checker policy | Portfolio manager | `later` | `Approval.policy` | advisory-core |

## 9. Recommendation lifecycle

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| RC-01 | Approve a recommendation; the system never executes a trade | Adviser | `prototype` | `Recommendation` | advisory-core |
| RC-02 | Mark a recommendation communicated to the client | Adviser | `mvp` | `Recommendation.communicated_at` | advisory-core |
| RC-03 | Record the client's acceptance or decline | Adviser | `mvp` | `client_response` | advisory-core |
| RC-04 | Mark executed | Adviser | `mvp` | `executed_at` | advisory-core |
| RC-05 | Reconcile automatically when imported transactions match the suggested trades within tolerance | System | `mvp` | `reconciliation_import_id` | advisory-core |
| RC-06 | Keep a status event trail | System | `mvp` | `RecommendationStatusEvent` | advisory-core |
| RC-07 | Notify the client by email | System | `later` | — | — |

## 10. Audit

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| AU-01 | One chronological feed of model publications and client-target approvals | Adviser | `prototype` | `AuditEvent` | audit |
| AU-02 | Filter by portfolio or model, action, actor, status and date range | Adviser | `prototype` | `AuditEvent` | audit |
| AU-03 | Open an entry to before-and-after values | Adviser | `prototype` | `before`, `after` | audit |
| AU-04 | Append-only; never updated or deleted | System | `mvp` | `AuditEvent` | audit |
| AU-05 | Attribute non-human actions to `system`, `import` or `feed` | System | `mvp` | `actor_kind` | audit |
| AU-06 | Record imports applied and rolled back | System | `mvp` | `AuditEvent` | audit |
| AU-07 | Carry the request correlation identifier onto every event | System | `mvp` | `request_id` | audit |
| AU-08 | Reproduce what the adviser saw at the moment of approval | System | `mvp` | pinned versions | advisory-core |

## 11. Cross-cutting

| ID | Feature | Actor | Status | Entities | Service |
|---|---|---|---|---|---|
| XC-01 | Isolate every firm's data from every other firm's | System | `mvp` | all | all |
| XC-02 | Restrict a household to its assigned advisers and their portfolio managers | System | `mvp` | `HouseholdAdviser` | advisory-core |
| XC-03 | Encrypt PAN, date of birth and account numbers; mask by default | System | `mvp` | `Member` | advisory-core |
| XC-04 | State that the system does not place trades, has no live pricing and offers no tax advice | System | `prototype` | — | — |
| XC-05 | Label illustrative figures as illustrative | System | `prototype` | `is_illustrative` | all |
| XC-06 | Leave unsourced fields blank rather than inventing them | System | `prototype` | — | all |
| XC-07 | Recompute drift nightly for every member account | System | `mvp` | `DriftRun` | analytics |
| XC-08 | Recompute drift on demand when an adviser opens an account | System | `mvp` | `DriftRun` | analytics |
| XC-09 | Work at desktop width and at 390px | All | `prototype` | — | — |
| XC-10 | Show a retry screen on data-load failure without resetting saved work | All | `prototype` | — | — |

## Out of this phase

Recorded so the boundary is explicit, per `docs/data-model.md` and `ROADMAP.md`.

| Area | Decision |
|---|---|
| Instrument research — select, retain, offload | Removed from this phase (Q9). The appendix of the data model records what it will need so nothing built now obstructs it |
| Client-facing portal | v2. The authorization model is designed so a client is a principal scoped to one household rather than a special case |
| Bulk planning across portfolios | The engine is single-portfolio for now. The household gap summary previews per-account scenarios but cannot approve across them |
| Trade execution | The system records decisions. It will not place trades |
| Tax lots and FIFO | Deferred (Q11), pending what CAS actually supports. Cost basis is holding-level in this phase |
| Multi-currency | Not designed for. A currency column exists wherever a value is money, so it is not designed out |
| Model-level lens target overrides | Out of scope until it is settled whether exposure targets are analytical references, firm policy, or both |
| Household-level targets | A household aggregates account targets by value. There is no independent household target or approval |

## Open items

1. **Confirm the `mvp` / `later` split with the product owner.** It is the one
   judgement this document makes beyond its sources.
2. **Risk questionnaire content and scoring** remain pending the RIA's draft
   (data model, open item 1), so ON-06 to ON-08 are structural only.
3. **Which statements the first parsers handle** (data model, open item 8)
   decides how much of IN-02 to IN-06 lands in the first release.
4. **No feature here covers client reporting** — a periodic client-facing PDF or
   statement. Advisers will expect it and no entity models it yet.
5. **Nothing covers firm-level dashboards** — book-wide drift, flagged
   portfolios across all advisers, adviser workload. The data supports it; no
   screen requests it.
