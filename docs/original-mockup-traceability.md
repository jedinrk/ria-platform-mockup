# Original wireframe traceability

Every component of `Portfolio Console – wireframes.html` is listed here with
its current state. This is the register the refinement plan was missing: it is
what stops a component disappearing without a decision.

States: **Delivered** · **Refined** (present, deliberately reshaped) ·
**Deferred** (in scope, named on a placeholder screen) ·
**Dropped** (deliberately not carried forward, with a reason).

## Global shell

| Original | State | Where it is now |
|---|---|---|
| Nav: Portfolios | Delivered | Portfolios |
| Nav: Security master | Deferred | Nav item present; placeholder names the capability and the open questions |
| Nav: Models | Delivered | Models, with Library / Comparison / Profile comparison |
| Nav: Audit log (with count) | Refined | Audit log; the count is replaced by a filterable entry count |
| "As of 03 Oct 2026" | Delivered | Source stamp on every portfolio screen |

## Portfolios overview

| Original | State | Where it is now |
|---|---|---|
| KPI: Total AUM / count / past threshold / AUM past threshold | Delivered | Four summary cards |
| Households / Accounts switch | Delivered | View switcher |
| Search portfolio | Delivered | Search portfolios |
| Filter by risk profile | Delivered | Risk profile filter |
| Flagged only | Refined | "Needs review only" |
| Select flagged · bulk selection · Review rebalance | Deferred | Single-portfolio planning is delivered on tab 2; bulk selection remains |
| Rebalance rules: firm default threshold | Delivered | Review rules |
| Rebalance rules: exposure breaches also trigger | Delivered | "Exposure flags also require review" |
| Sortable name / AUM / aggregated drift | Delivered | Sortable columns |
| Column: Model (+ override count) | Refined | Model / risk profile; override count lives on Client target limits |
| Column: AUM | Refined | "Under advice (₹ L)" — the allocation denominator, not all recorded assets |
| Column: Aggregated drift + threshold bar | Delivered | Unchanged definition and scale |
| Column: Threshold (pp), editable | Delivered | Editable, inherits firm default when blank |
| Column: Exposure breaches | Refined | "N exposure flags" in Attention, linking to the flag list |
| Column: Rebalance + reason | Refined | "Needs review" / "Within threshold" + reason (asset class / exposure / both) |
| Pending cash-event tag | Deferred | Cash events are delivered on tab 3; the overview tag is not back yet |
| Row expansion: drift by class, accounts, buckets by lens, Open details | Delivered | Three-column quick review |
| Empty state | Delivered | Empty state with recovery |

## Portfolio detail

| Original | State | Where it is now |
|---|---|---|
| Summary bar: AUM / risk / model / drift / breaches / status | Refined | Header plus the Review snapshot card |
| Risk profile editable in the summary bar | Dropped | Assessed risk belongs to the client record; a model is chosen on Client target limits instead. Changing an assessment from a portfolio header would misrepresent where the decision is made |
| Tab 1 Drill-down allocation | Delivered | Tab 1, with review state and liquidity tags added |
| Asset distribution: current vs model | Refined | "Actual vs client target" — the approved client target, not the model |
| Expand all / Collapse all | Delivered | Tab 1 |
| Legend: current / model / over / under / within band | Refined | Review state column plus the distribution legend |
| "Physical" tag | Delivered | Inline tag |
| Liquidity tags (Liquid / Semi-liquid / Locked) | Delivered | Inline tags |
| Holding drawer: position vs model | Delivered | "Position vs client target" |
| Holding drawer: cost basis, gain, rate, est. tax | Delivered | Cost and tax on the holding; per-trade estimates in Planning |
| Holding drawer: liquidity and constraints | Delivered | In the dialog and in Account context |
| Tab 2 Gap summary & trades | Delivered | Gap summary, then a rebalance scenario with suggested trades, constraints and projected impact |
| Tab 3 Cash events | Delivered | Raise or invest, gross versus net, staged deployment, tax options and an event history |
| Tab 4 Exposure drift | Delivered | Tab 4, with the full bucket explorer opened by default |
| Lens summary cards with worst bucket | Delivered | In the overview row expansion and the flag list |
| Expand to breaches | Dropped | The flag list is already sorted by severity and capped at four, which serves the same need without a third expand control |
| Status and Target source columns | Refined | Per-flag band plus a "Portfolio limit" badge when an approved limit applies |
| "Review rebalance for this portfolio" | Delivered | Tab 2 generates the scenario |
| Tab 5 Model limits: asset-class limits | Delivered | Tab 5 Client target limits |
| Tab 5: lens limits with bands and source | Delivered | Editable, and they drive review once approved |
| Tab 5: reset all overrides | Refined | Per-lens reset |

## Models

| Original | State | Where it is now |
|---|---|---|
| Profile segmented control | Refined | Model library rows |
| Total % validation | Delivered | Allocation checks |
| "N accounts on this model" | Delivered | Portfolios column and "N portfolios using this model" |
| Reset profile to default | Dropped | Publishing is versioned and reversible through History; a silent reset to seed values would destroy an approved lineage |
| Lens segmented control | Delivered | View selector on model detail |
| Funds and ETFs: look-through / single tag | Delivered | On model detail and exposure views |
| Profile comparison card | Delivered | Intended profile view inside Model comparison |
| Editable asset / model target table | Delivered | With a proportional redistribution preview |
| Lens target and band editing on the model | Dropped for now | Portfolio-level limits are delivered; firm-level lens policy needs the Review rules decision first (plan §21 Q6) |
| "Implied by holdings %" column | Refined | Model target % on the portfolio limits table |
| Largest equity sector vs cap | Delivered | Concentration strip on the model Sector view |

## Security master

Built from the `RIA-AssetConfig-Type1` sheet supplied on 2026-10-08.

| Original | State | Where it is now |
|---|---|---|
| Grouped instrument list by lens, with firm-wide value and share | Refined | One configuration grid per the RIA-AssetConfig-Type1 sheet, with firm-wide value and portfolio count on each row |
| Search, unclassified-only filter, custom lens rename | Delivered in part | Search and needs-classification filter plus an asset-class filter; the custom lens name is shown, not yet renameable |
| Edit panel for sector, sub-sector, market cap, geography, themes, credit, duration, custom | Delivered in part | Asset class, sector and sub-sector are editable, matching the sheet. Market cap, geography, themes and custom are not on the sheet and stay read-only for now |
| Read-only fund look-through | Delivered | Flagged on the row and visible on each holding |
| "Edits apply to every portfolio straight away" | Refined | Edits are staged, then applied after a review that states the value and portfolio count affected |

All classification data is preserved and drives every exposure view.

## Bulk rebalance and audit

| Original | State | Where it is now |
|---|---|---|
| Bulk rebalance options, KPIs, per-portfolio table, approval | Deferred | The single-portfolio engine is delivered on tab 2; multi-portfolio selection and roll-up remain |
| Audit entry: action, timestamp, user | Delivered | Audit log |
| Audit entry: per-portfolio before/after table | Refined | Before/after allocation table per entry |
| Audit entry: options summary and comment | Delivered | Reason per entry; scenario options are recorded on the scenario |
| Audit empty state | Delivered | Empty state with filter recovery |

## Not in the original, added since

Household view and aggregation; the approved-client-target concept and its
draft/review/approve lifecycle; asset scope (under advice versus recorded);
model comparison; profile comparison; review-state reasons; liquidity profile
per account.
