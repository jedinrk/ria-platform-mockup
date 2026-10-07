# RIA Portfolio Console — UI/UX refinement plan

## Purpose of this document

This is the designer-facing product and interaction specification for the continuing refinement of the RIA Portfolio Console mockup. It consolidates the decisions made during review of the original `Portfolio Console – wireframes.html`, the later Models mockup, and the refinements already implemented in the repository.

The original mockup remains the information and capability reference. It is **not** a layout that must be reproduced verbatim. The objective is to make the product clearer, safer and easier for an adviser to operate without dropping information that the original contained.

This document distinguishes four states:

- **Delivered:** implemented and approved in the current mockup.
- **Refine next:** present in some form, but the experience still needs redesign.
- **Planned:** part of the product direction and should be designed after the current workflow is stable.
- **Separate discussion:** intentionally retained in scope but not to be designed without a dedicated product discussion.

The application is currently an illustrative, browser-local prototype. It is not investment or tax advice, a production approval system, a live portfolio data source, or a trade-execution platform.

---

## 1. Product principles that every screen must preserve

### 1.1 Keep the three portfolio concepts separate

The interface must never blur these concepts:

1. **Model portfolio:** a reusable firm strategy.
2. **Client target:** the allocation approved for one account or individual, potentially adapted from a model.
3. **Actual portfolio:** the holdings recorded for that account at a stated date.

The principal review is **Actual versus approved client target**. Model versus client target explains customisation; it is not the main performance or drift comparison.

Publishing or changing a model must not silently alter an approved client target. Changing a target must not alter actual holdings. Planning a transaction must not make it appear that a holding has already changed.

### 1.2 Preserve information, improve hierarchy

No information from the original mockup should be removed solely to make a page appear simpler. Complexity should instead be managed through:

- progressive disclosure;
- clear page ownership;
- meaningful defaults;
- expandable hierarchy;
- summaries that lead to detail;
- explicit empty, inherited and unavailable states.

If information moves, the new location and route to it must be obvious.

### 1.3 Separate overall wealth from the advised portfolio

The product may record assets outside the advised portfolio. The allocation denominator must include only assets approved as being under advice.

Use these terms consistently:

- **Total recorded assets:** every recorded asset before liabilities. Do not call this net worth unless liabilities are included.
- **Portfolio under advice:** assets included in allocation and target comparison.
- **Excluded recorded assets:** visible assets outside the comparison, with a reason.

“Included in allocation comparison” and “available to sell” are different properties. EPF, PPF, property or designated cash may count in allocation while remaining restricted or illiquid.

### 1.4 Use household aggregation without inventing a household approval

Individual/account targets remain the primary approval objects. A household view is required because it was present in the original mockup and is operationally useful, but the household target is a value-weighted aggregation of its accounts. It is not a separately approved target unless that product decision changes later.

Each account must be counted exactly once. Household screens must make the aggregation rule clear and provide routes to the contributing accounts.

### 1.5 Make workflow state explicit

Every editable workflow must visibly distinguish:

- recorded/current state;
- draft proposal;
- approved state;
- historical state;
- suggested action;
- executed result, when execution is eventually supported.

Draft changes must never leak into approved comparison views. Suggestions must never look like approved instructions. Approval must not imply execution.

### 1.6 Use plain financial language

Prefer labels an adviser can interpret without reverse engineering:

- “Actual,” “Client target,” “Drift (pp),” and “Value gap”;
- “Above target,” “Below target,” “Within threshold,” and “Review required”;
- “Suggested buy” and “Suggested sell” only in the Planning workflow;
- “Not specified” for an absent target and “0%” for an explicit zero.

A positive value gap means a shortfall to target, not automatically an instruction to buy. A negative gap means excess value, not automatically an instruction to sell.

---

## 2. Proposed information architecture

### Primary navigation

1. **Portfolios**
   - Household and Account overview
   - Portfolio detail
   - Allocation
   - Target plan
   - Planning
   - History
2. **Models**
   - Model library
   - Model editor/read-only model detail
   - Model comparison
   - Profile comparison
3. **History** or **Audit log**
   - Cross-portfolio and cross-model activity
4. **Security master**
   - Separate design discussion required before refinement

### Portfolio journey

The intended journey is:

`Portfolio overview → Household or Account detail → Allocation → Target plan → Planning → History`

The overview answers “Which portfolios need attention?” Detail answers “Why?” Target plan answers “What allocation is approved?” Planning answers “What could we do about the gap?” History answers “What changed, who decided it, and when?”

### Model journey

The intended journey is:

`Model library → Model detail/editor → Review and publish → History`

Comparison pages are sibling tools, not content embedded in every model card:

`Models → Model comparison`

`Models → Profile comparison`

This gives comparison enough horizontal and vertical space and scales beyond the three sample models.

---

## 3. Global shell and shared interaction patterns

**Status: delivered in part; refine continuously.**

### Navigation

- The active primary section must be unambiguous.
- Page titles describe the user's current object, not just the feature name.
- Detail pages include a clear route back to the relevant collection.
- Browser Back and Forward should preserve meaningful navigation.
- Deep links should restore the selected portfolio/model wherever feasible in this static prototype.

### Page anatomy

Use a repeatable structure:

1. Breadcrumb or back link.
2. Object identity and status.
3. Small set of decision-relevant summary metrics.
4. Local section navigation or tabs.
5. Primary content.
6. Contextual actions.
7. Explanatory notes only where terminology or calculation needs clarification.

Avoid stacking many equal-weight cards. The most important comparison or decision should visually lead the page.

### Expand/collapse behaviour

- Use a familiar chevron adjacent to the expandable label.
- The collapsed and expanded states must differ clearly through chevron orientation and content visibility, not through large decorative treatments.
- The entire intended trigger area should be clickable and keyboard accessible.
- Use `aria-expanded` and associate the trigger with its content.
- “Expand all” and “Collapse all” belong only on deep hierarchies, not simple overview rows.
- A row expansion should provide concise supporting context; it must not become a full detail page embedded under the row.

### Tables

- Keep identity columns readable and preferably sticky on wide comparison tables.
- Align all percentages and monetary values by decimal or right edge.
- Include units in column headings: `%`, `pp`, `₹ L`, or `₹ Cr` as appropriate.
- Do not communicate state through colour alone.
- Wide tables scroll within their own container on small screens; the whole page must not overflow horizontally.
- Empty tables explain why they are empty and offer the relevant recovery action.

### Responsive behaviour

- Desktop may use tables and side-by-side comparisons.
- Tablet may collapse secondary columns behind expandable detail.
- Mobile should turn dense rows into labelled key/value groups while preserving the decision-critical values.
- Actions must remain reachable without horizontal page scrolling.
- Dialogs must fit within the viewport and keep the title and action region reachable.

### Accessibility

- Every control requires a visible or programmatic label.
- Keyboard focus must be visible.
- Dialogs support Close, Cancel and Escape without closing the browser page.
- Error messages identify both the problem and the correction.
- Charts need adjacent textual values; they cannot be the only representation.
- Status colour must be accompanied by text or an icon with an accessible label.

---

## 4. Models experience

### 4.1 Model library

**Status: delivered; retain and polish.**

The library is the scan-and-select view, not a compressed version of every model workflow.

Each model item should show:

- model name;
- short description or intended use;
- draft/published status only when operationally useful;
- last meaningful update date;
- a concise top-level allocation preview;
- primary actions such as View or Continue draft.

Do **not** show model version numbers as part of the normal model identity. “Moderate” is the visible name, not “Moderate v3.” Revisions remain internally traceable and appear in History/audit contexts.

Avoid repeating the same model through seed data, migrated data and stored data. The library must identify records stably and show each logical model once.

The library should support search and later may support status/intended-use filters. It must not be limited to three models simply because the sample data contains three.

### 4.2 Model detail and editor

**Status: delivered; no immediate structural redesign planned.**

Preserve the complete hierarchy:

- Equity
  - Mutual funds
  - Direct stocks
  - ETFs
- Debt
  - Bonds
  - Fixed deposits
  - EPF / PPF
- Alternatives
  - AIF
  - REIT / InvIT
- Real assets
  - Gold
  - Real estate

All 19 original sample investments remain available. A new model begins with the same hierarchy at 0%.

Published models are read-only. Editing creates or resumes a draft. Drafts may be incomplete, but publication requires:

- top-level targets total 100%;
- specified child totals reconcile with their parents;
- no invalid or negative values;
- a review step;
- a publication reason.

The hierarchy is inspectable in both published and edit modes. Parent editing may offer a clearly previewed proportional redistribution or manual child adjustment. It must not silently alter unrelated asset classes.

Allowed drift bands are no longer a primary Model editor concern. Existing historical band data remains preserved, but editing model-level bands is deferred until the Review rules product is deliberately designed.

### 4.3 Model history

**Status: delivered in part; refine presentation.**

History should present revisions as audit entries rather than decorate routine UI with version labels. Each entry should include:

- model name;
- date and time;
- actor;
- reason;
- changed fields/allocations;
- before and after values;
- a read-only snapshot of the complete hierarchy.

Publishing a model may flag affected portfolios as having an update available, but must not change their approved targets.

### 4.4 Model comparison

**Status: delivered.**

Keep this as a separate page under Models. It should:

- search all published models;
- select up to four models;
- compare top-level asset allocations first;
- allow aligned expansion into subcategory and investment rows;
- preserve complete hierarchy paths;
- distinguish “Not specified” from `0%`;
- exclude drafts;
- show model names and descriptions without routine version labels;
- retain selections and expanded rows during the current page session.

Optional exposure comparisons should display one dimension at a time and must never fabricate joint exposures by multiplying independent sector, geography and market-cap percentages.

### 4.5 Profile comparison

**Status: planned; approved direction.**

Profile comparison should be a dedicated sibling page under Models, not a card repeated inside the library or editor. A separate page scales to more than three models and provides room for explanation.

Its purpose is to help an adviser understand how models differ in intended profile, not to assign a model to a client or alter a client's assessed risk profile.

Recommended layout:

1. Search/select published models.
2. A comparison header with model names and intended-use summaries.
3. Rows for the profile attributes retained from the original mockup.
4. Clear treatment of missing information.
5. Links to open each model without losing comparison context.

Do not imply that a profile label alone proves suitability. Risk assessment, profile comparison and model assignment are separate actions.

### 4.6 Lens toggle and fund treatment

**Status: retained in Model comparison and advanced exposures; placement should remain contextual.**

“Lens” means the exposure dimension currently being inspected, for example:

- asset hierarchy;
- sector/sub-sector;
- geography;
- market capitalisation;
- themes;
- credit quality/duration;
- Core/Satellite or another custom grouping.

The Lens control was removed from the simplified library/editor surface because it is a comparison/analysis control, not model identity. It must remain available on pages where changing the lens changes the analysis.

For funds and ETFs:

- **Look-through:** count the vehicle by its underlying exposures. Example: ₹10 lakh in a fund that is 30% Financials contributes ₹3 lakh of Financials exposure.
- **Single tag:** count the entire fund/ETF in one assigned bucket.

This setting does not change the holding or model allocation. It changes the analytical representation. The UI must explain the method, source and effective date of underlying data. If trustworthy look-through data is unavailable, show that limitation and never imply precision.

---

## 5. Portfolio overview

**Status: delivered and approved.**

The navigation label remains **Portfolios**, not Clients. The list represents household and account portfolios; calling the whole area Clients loses the household/account distinction and narrows the workflow incorrectly.

### 5.1 View switcher

Provide two views:

- **Households:** one row per household, with value-weighted account aggregation.
- **Accounts:** one row per advised account.

The view switch must be prominent, keep the same search/filter model where possible, and update the result count accurately.

### 5.2 Overview summary

Global summary cards may include:

- total assets represented in the current dataset;
- household or account count;
- number requiring review;
- value represented by portfolios requiring review.

Filters affect the list, not these global summary cards. State this when it could be misunderstood.

### 5.3 Search, filters and sorting

Support search by portfolio identity. Useful filters include profile, review state and data freshness as the dataset grows. Sorting should support name, value, aggregated drift and freshness.

Hidden filtered rows must never remain silently selected for a future bulk action.

### 5.4 Columns

The current direction is:

- portfolio/household identity;
- ownership/account context;
- model name and source risk profile where relevant;
- portfolio value;
- approved target context;
- **Aggregated drift (pp)**;
- **Threshold (pp)**;
- attention/review state;
- data date/freshness where space permits.

“Target status” should not exist as an unexplained generic column. Draft/update states belong inside Target plan or in a clearly labelled attention indicator. The overview should focus on allocation and data issues that require review.

### 5.5 Aggregated drift

Retain the label from the initial mockup: **Aggregated drift (pp)**.

Definition: the largest absolute asset-class drift for the portfolio. It is not an average and not the sum of all drift.

Retain the bar because it allows quick visual triage. The scale is threshold-relative:

- midpoint = effective threshold;
- full width = twice the effective threshold;
- use text to show the exact drift;
- indicate within/outside threshold without relying on colour alone.

This makes the bar answer “How close is this portfolio to its review threshold?” rather than comparing raw drift against unrelated portfolios.

### 5.6 Threshold (pp)

Keep the editable **Threshold (pp)** column and inputs from the original mockup.

Rules:

- a blank value inherits the firm default;
- an explicit household override is independent of account overrides;
- an explicit account override affects only that account;
- valid values use 0.5 pp increments and have a minimum of 0.5 pp;
- invalid values show an error and are not silently clamped;
- changes alter review flags and bar scaling only;
- changes never alter models, targets or holdings.

The firm default and portfolio overrides belong to Review rules, even if the compact controls remain accessible from the overview.

### 5.7 Row expansion

Keep expansion intentionally simple. The expanded content should help the adviser understand why the row needs attention, then link to full detail.

Recommended content:

- drift by major asset class;
- concise account composition for a household;
- a short exposure-review summary;
- a clear “Open details” action.

Do not place the full Asset-class allocation, account table and Exposure review application inside the row. Those belong on the detail page. Use a chevron and straightforward disclosure interaction; avoid oversized highlight panels or badges that make expansion feel like navigation to a second embedded page.

---

## 6. Portfolio detail

**Status: delivered in part; preserve current direction.**

### 6.1 Header

Show:

- household/account name;
- object type and ownership/account label;
- portfolio value under advice;
- model name;
- approved target date/status;
- holdings/source date;
- relevant data-quality state.

Do not show model revision numbers as routine identity. Revision references may appear in History or an audit detail.

### 6.2 Local navigation

Account detail uses the original mockup's numbered workflow sequence, plus History:

1. **Drill-down allocation**
2. **Gap summary & trades** *(planned; labelled placeholder)*
3. **Cash events** *(planned; labelled placeholder)*
4. **Exposure drift**
5. **Client target limits**
6. **History**

This supersedes the earlier four-section list (Allocation / Target plan / Planning / History). See *IA decisions changed since last revision*, decisions 1 and 2.

Tabs 1 and 4 address the same underlying page through a different analysis view. The numbered tab and the inner Allocation / Exposure control must therefore stay in step: changing either one moves both.

The selected section must remain obvious. Unsaved drafts need a visible warning before navigation discards changes.

### 6.3 Household detail

The household page should add:

- contributing accounts and values;
- each account's model and approved target context;
- account-level review indicators;
- a route to each account;
- the value-weighted household allocation and combined target.

Label the main chart **Asset distribution: Actual vs combined client targets**. Explain that the combined target is calculated from approved account targets, not independently approved at household level.

### 6.4 Account detail

The account page should show the account's own recorded holdings and approved client target. Label the main chart **Asset distribution: Actual vs client target**.

---

## 7. Allocation section

**Status: delivered; refine only where testing reveals friction.**

### 7.1 Asset distribution card

This card is a primary visual and must remain present on both account and household detail pages.

Recommended representation:

- two aligned stacked bars or comparable side-by-side distribution bars;
- textual legend with Actual %, Target %, and Drift;
- consistent asset-class ordering and colours;
- full values available without relying on hover;
- household copy says “combined client targets.”

The card should lead to the detailed table rather than compete with it.

### 7.2 Allocation table

For each level where a target is defined, show:

- name/hierarchy;
- actual value;
- actual percentage;
- approved client target percentage;
- drift in percentage points;
- target value or value gap;
- review state.

All hierarchy percentages are percentages of the entire included portfolio, not of the immediate parent. Do not double-count a parent and its children in totals.

The hierarchy can expand to holdings. If the target is defined only at a higher level, show holdings as explanatory detail without pretending each has a zero target.

### 7.3 Calculation rules

For included portfolio value `V`, actual value `A`, and target percentage `T`:

- Actual percentage = `A / V × 100`
- Drift = `Actual percentage − T`, in percentage points
- Target value = `V × T / 100`
- Value gap = `Target value − A`
- Review breach = `absolute drift > effective threshold`
- Equality at the threshold remains within threshold

If `V` is zero or unavailable, show an unavailable/incomplete state. Never display `NaN`, infinity, or invented values.

### 7.4 Recorded assets and scope

The earlier “Portfolio scope · 17 included / 2 excluded” treatment appeared redundant when placed beside allocation as a full competing section. Scope is still essential; it should be presented as a compact **Recorded assets / Under advice** summary with an action to inspect or change the detailed list.

Detailed scope belongs in a supporting dialog or in Target plan because changing inclusion changes the proposed target denominator and requires approval.

The detail must show:

- included/excluded state;
- value;
- asset/account;
- exclusion reason;
- liquidity/restriction status where known;
- the impact on portfolio-under-advice value.

No asset type should be automatically excluded. Every original sample asset begins included so the prototype does not silently impose advice policy.

---

## 8. Exposure review and advanced lenses

**Status: basic review delivered; advanced experience planned.**

Exposure review belongs in the Allocation detail page, not in the overview row expansion.

### 8.1 Initial exposure summary

Show the most decision-relevant flags first, grouped by dimension. Initially show a manageable number, such as four, with “Show all” when more exist.

Each flag should state:

- dimension and bucket;
- actual exposure;
- target or reference exposure;
- threshold/band;
- amount and direction outside the reference;
- whether it comes from look-through or single-tag classification;
- data/source limitations where relevant.

Exposure flags may trigger “Review required” even when aggregated asset-class drift is within threshold. Avoid calling this automatically a rebalance recommendation.

### 8.2 Advanced lens page/section

Retain the following original capabilities:

- sector and sub-sector;
- geography;
- market capitalisation;
- themes;
- credit quality and duration for debt;
- Core/Satellite or other custom classification;
- expandable grouped asset hierarchy.

Use one lens at a time. The chosen lens controls the chart/table and explanatory text. Do not mix independent dimensions into a false joint holding breakdown.

Themes may overlap and need not total 100%. Credit/duration percentages use the debt allocation as their denominator and must say so. Unclassified exposure remains visible and should affect completeness indicators.

### 8.3 Look-through and Single tag

Expose this toggle only when funds/ETFs are present and the mode affects results. The chosen method should be visible next to the result, not hidden in distant global settings.

Look-through requires trustworthy dated underlying data. If that data is missing or stale, show the affected percentage and allow the adviser to understand which instruments are being treated as unclassified or by fallback tags.

The original classifications are illustrative. Do not present them as current verified investment data.

---

## 9. Target plan — next refinement priority

**Status: functional foundation delivered; full UX redesign is next.**

### 9.1 Purpose

Target plan defines the approved allocation for an account. It combines a selected published model with explicit client-specific adjustments and an approved asset scope. It must make inheritance and customisation easy to understand.

### 9.2 Page structure

Recommended sequence:

1. **Client/account context**
2. **Approved target summary**
3. **Base model selection**
4. **Model-to-client allocation comparison**
5. **Portfolio scope**
6. **Review changes**
7. **Approval**

This should read as one decision workflow, not a collection of unrelated cards.

### 9.3 Client/account context

Show concise, read-only context needed to judge the target:

- account owner/household;
- assessed risk profile and assessment date;
- goals and horizon where available;
- liquidity needs;
- known restrictions;
- current approved model name;
- current target approval date.

Do not build a full questionnaire into this screen. Link to the source assessment later when that workflow exists.

### 9.4 Base model selection

The adviser can inspect eligible published models before selecting a starting point. Browsing must never update the target. Selection begins or changes the draft only after an explicit action.

If a newer revision of the currently used model exists, show a neutral “Model update available” notice. Offer:

- keep current approved target;
- review the newer model in context;
- start a revised target draft.

Never auto-apply the update.

### 9.5 Model-to-client allocation editor

Use aligned columns:

- allocation name;
- base model target;
- client adjustment or override;
- proposed effective client target;
- current approved client target, when revising;
- change indicator and rationale where required.

Inheritance semantics are essential:

- blank adjustment = inherit the selected model value;
- `0%` = explicit zero;
- custom value = client-specific override.

Use clear inherited/custom labels. Do not require the adviser to infer the result from blank numeric fields alone.

The hierarchy must be expandable. Editing policy should be predictable: either proportional redistribution with a preview or manual reconciliation. The UI must not silently rebalance unrelated allocations.

### 9.6 Scope within Target plan

Scope changes belong to the same draft as target changes because they alter the comparison denominator. The adviser should be able to inspect all recorded assets, change inclusion, enter an exclusion reason, and see:

- previous and proposed portfolio-under-advice value;
- allocations before and after the scope change;
- restricted/illiquid properties that remain relevant to future planning.

No draft scope change affects Allocation until approved.

### 9.7 Validation

Draft saving may allow incomplete work. Approval requires:

- targets total 100%;
- specified hierarchy levels reconcile;
- no invalid values;
- exclusions have reasons;
- selected model is still published/available;
- required rationale is supplied;
- the proposed result differs meaningfully or is identified as a reaffirmation;
- no concurrent/newer approved target has superseded the draft in a future multiuser implementation.

Validation should appear at the affected field and in a review summary. Never discard valid draft work because another field is incomplete.

### 9.8 Review and approval

Before approval, show:

- previous approved target;
- proposed target;
- base model and relevant model change;
- client-specific adjustments;
- included/excluded asset changes;
- resulting value-under-advice change;
- reason;
- approver and effective date.

Approval creates an immutable snapshot for future Actual-versus-target comparisons. It does not change recorded holdings or create trades.

Whether client acknowledgement or second-reviewer approval is required remains a policy decision; the mockup should not imply either until confirmed.

### 9.9 Household target presentation

A household may show the combined client targets of its accounts. It should not provide an independent household target editor under the current direction. To change the combined target, the user must change and approve one or more contributing account targets.

### 9.10 Target-plan acceptance criteria

- Two accounts using the same model may have different approved targets.
- Editing one account cannot alter another account or the firm model.
- Publishing a model update cannot alter an approved target.
- Blank inheritance and explicit zero remain distinguishable after save/reload.
- Invalid totals can be saved as drafts but not approved.
- Declining or ignoring a model update preserves the current target.
- An approved target, scope and base-model reference can be reconstructed from History.
- Allocation continues to use the last approved snapshot while a draft exists.

---

## 10. Planning workspace

**Status: planned and explicitly in scope.**

The original mockup included suggested buys/sells, tax estimates and cash-event planning. These capabilities must not be lost. They were deferred until Actual-versus-target and Target plan were reliable, not removed from the product.

### 10.1 Purpose and entry state

Planning converts an identified gap into a reviewable scenario. It must begin with a clearly dated actual portfolio and approved target. If either is stale, incomplete or unavailable, warn the adviser before generating suggestions.

Planning scenarios are proposals. They do not mutate actual holdings, approved targets or account balances.

### 10.2 Scenario header

Show:

- portfolio/account;
- holdings and valuation date;
- approved target date;
- scenario type;
- requested cash event, if any;
- assumptions summary;
- draft status;
- created/last edited information.

Scenario types should include at least:

- rebalance towards approved target;
- invest new cash;
- raise cash for withdrawal;
- staged investment.

### 10.3 Suggested buys and sells

The plan should show separate, explicit suggested actions:

- investment/holding;
- account/owner;
- buy or sell;
- suggested amount;
- reason linked to the target gap or cash need;
- constraints and warnings;
- estimated tax impact for sales when data allows;
- resulting cash balance;
- projected allocation and residual drift.

The adviser must be able to adjust, exclude or lock a suggested trade and recalculate the remaining plan. A skipped sale cannot leave buys unfunded while the plan still claims feasibility.

The recommendation engine must respect:

- available cash;
- minimum trade sizes;
- restricted/locked assets;
- liquidity;
- target hierarchy;
- explicit zero/missing target distinction;
- selected tax preferences;
- residual cash policy.

A gap alone is not a recommendation. Suggestions appear only after the adviser intentionally opens or generates a Planning scenario.

### 10.4 Before/after comparison

Provide a prominent scenario impact view:

- allocation before;
- approved target;
- projected allocation after;
- aggregated drift before and after;
- exposure flags before and after;
- total buys;
- total sells;
- net cash impact;
- estimated tax and costs;
- residual unallocated cash.

The projected result must remain visually distinct from the recorded actual portfolio.

### 10.5 Individual and bulk planning

Design and calculation rules should be shared between individual and bulk workflows. Build the individual experience first. Bulk review can then aggregate scenarios while allowing each portfolio to be opened and inspected.

Bulk selection must:

- never include hidden filtered rows silently;
- show scenario feasibility per account;
- preserve individual constraints;
- allow portfolios to be excluded;
- summarize total buys, sells, tax and cash;
- require an explicit review before approval.

### 10.6 Recommendation lifecycle

The future workflow should distinguish:

1. Draft scenario
2. Suggested/reviewed
3. Approved recommendation
4. Communicated to client
5. Client accepted/declined, if applicable
6. Execution pending
7. Implemented/partially implemented/cancelled
8. Reconciled against later holdings

The current static mockup may stop at approval, but its language must not imply execution occurred.

---

## 11. Tax estimates, exemptions and loss harvesting

**Status: planned and explicitly in scope.**

### 11.1 Placement

Tax analysis is part of Planning, not Allocation and not the target editor. Show it when a scenario contains taxable disposals or when the adviser intentionally requests tax-aware optimisation.

### 11.2 Information to show

At trade and scenario level, show where data supports it:

- cost basis;
- estimated gain/loss;
- holding period/category;
- assumed tax rate;
- estimated gross tax;
- available loss offsets;
- exemption usage;
- estimated tax after offsets;
- missing-lot/data warnings.

Use “Estimate” consistently. Include an assumptions disclosure with source/effective date. The original mockup's rates and exemptions are placeholders and must never be represented as current Indian tax guidance.

### 11.3 Loss harvesting

Loss-harvesting suggestions should be a deliberate option. Show:

- which loss is proposed for realisation;
- which gain it offsets;
- estimated tax effect;
- impact on portfolio exposure;
- replacement/repurchase considerations only after legal/compliance policy is defined;
- warnings for unavailable or incomplete tax lots.

Do not optimise taxes by moving the portfolio materially away from the approved target without making the trade-off explicit.

### 11.4 Data and confidence

Allocation snapshots are insufficient for reliable tax estimation. Lot-level transaction data, ownership/account mapping and the client's relevant tax profile are required. If those are incomplete:

- show partial estimates;
- identify excluded holdings/amounts;
- use an “Incomplete estimate” state;
- never replace missing values with zero.

---

## 12. Cash inflows, withdrawals and staged investment

**Status: planned and explicitly in scope.**

### 12.1 Cash-event creation

Allow the adviser to create an event with:

- Invest or Raise cash;
- amount;
- desired date;
- reason;
- gross-versus-net requirement for withdrawals;
- funding account/source;
- one-time or staged approach;
- constraints and notes.

Examples include a fresh inflow, maturity proceeds, dividend/coupon, client withdrawal, expense/liability or tax payment.

### 12.2 Invest cash

Offer:

- lump-sum investment;
- staged investment with amount/frequency/date schedule;
- use of existing cash versus incoming cash;
- suggestions aligned to approved target;
- projected allocation after each stage or at completion;
- residual cash.

Do not make staged investment appear inherently preferable; it is a selected planning instruction.

### 12.3 Raise cash

The flow must clarify whether the requested amount is:

- gross sale proceeds; or

- net usable cash after estimated tax/cost provision.

Suggested sales should show liquidity, restrictions, allocation effect and tax estimate. If the goal cannot be met under current constraints, show the shortfall and the constraints causing it.

### 12.4 Cash-event history

Keep a portfolio-level list of events with:

- type and amount;
- reason;
- created date;
- status;
- related scenario;
- estimated tax where applicable;
- drift before/after;
- approval/decision notes.

An event remains separate from actual holdings until later data confirms implementation.

---

## 13. History and audit experience

**Status: delivered in part; expand with each workflow.**

### 13.1 Portfolio history

Within a portfolio, record:

- approved target changes;
- scope changes;
- model-update decisions;
- threshold/review-rule changes;
- planning approvals/dismissals;
- cash events;
- later recommendation/execution states;
- relevant data imports or corrections when ingestion exists.

### 13.2 Global audit log

The global view should support search/filter by:

- date range;
- actor;
- household/account;
- model;
- action type;
- status.

Each row opens a structured detail with before/after values and the reason. Do not rely on a sentence alone when important numerical changes can be shown explicitly.

### 13.3 Version information

Revision identifiers may appear in audit details for traceability. They should not replace human-readable names in routine Model or Portfolio lists.

---

## 14. Security master

**Status: separate discussion.**

Do not redesign this area as a side effect of portfolio or model work. Preserve the need for firm-wide identity and classification, but revisit its information architecture separately.

Topics that discussion must resolve:

- shared instruments versus client-specific assets;
- canonical instrument identity and aliases;
- investment vehicle versus economic exposure;
- classification ownership and approval;
- effective dates and data sources;
- fund/ETF underlying holdings;
- stale/unclassified states;
- propagation of classification changes to models and portfolios;
- whether a change is immediate analytical reclassification or an approved historical revision.

The original sample mixes shared instruments with items such as a named flat and EPF account. A production design must separate those concepts even if the current illustrative hierarchy preserves all original entries.

---

## 15. Data preservation and source-of-truth rules

**Status: delivered; mandatory for future refinements.**

The structured source file is `data/original-mockup.json`. It preserves:

- six households;
- twelve accounts;
- nineteen investments;
- 228 account-holding records;
- ₹1,968 lakh total sample assets;
- source date 3 October 2026;
- model weights and exposure classifications;
- illustrative cost/tax inputs;
- cash-planning defaults;
- deterministic generation inputs and source hash.

Future UI changes should render from structured data rather than duplicate sample facts inside markup. Earlier saved models and earlier prototype client records must remain readable. Migrations must not silently reset browser storage.

The prototype must clearly label all data illustrative. Original classification, price, tax and exposure values are not verified current facts.

### Missing, zero and inherited states

These are distinct everywhere:

- **Missing/not specified:** no target or data was supplied.
- **Zero:** an explicit value of zero.
- **Inherited:** value follows its base model/default.
- **Unavailable:** calculation cannot be made from available inputs.
- **Unclassified:** holding exists but lacks the classification needed for the selected view.

Never coerce these into one visual state.

---

## 16. Data quality and future statement ingestion

**Status: future platform capability; design should leave room for it.**

The expected future flow is:

`Client intake → Statement upload → Extraction → Verification/reconciliation → Holdings snapshot → Target comparison`

Portfolio screens should eventually surface:

- holdings date;
- valuation/price date;
- source statements;
- verification status;
- missing accounts/documents;
- duplicate/reconciliation warnings;
- unclassified holdings;
- adviser corrections.

AI may help identify documents and extract inconsistent tables. Deterministic code must perform arithmetic, reconciliation totals and drift calculations. Human review remains necessary.

Do not imply that a fresh price update proves the holdings are current; purchases and sales after the last statement may still be missing.

---

## 17. Visual language recommendations

### Colour

- Use stable asset-class colours across every chart.
- Reserve warning/error colours for state, not decoration.
- Use neutral tones for inherited/default values.
- Pair every colour-coded state with text or iconography.

### Density

- Overview is compact and scan-oriented.
- Detail pages can be denser but should lead with one primary comparison.
- Editors should favour aligned tables for numerical reconciliation.
- Explanatory prose should be short and placed next to the decision it clarifies.

### Cards

Use cards to group one coherent decision or summary. Avoid wrapping every subsection in a card when page hierarchy, headings and whitespace communicate the grouping more clearly.

### Charts

- Prefer aligned bars for Actual versus Target because lengths share a common baseline.
- Use donut/pie charts only as a supplementary distribution view, never as the sole precise comparison.
- Always include textual values.
- Preserve ordering between Actual and Target.
- Explain denominators for debt-only or overlapping exposure views.

### Status and copy

Prefer precise phrases:

- “Review required” instead of “Bad.”
- “Above target by 4.2 pp” instead of “Sell.”
- “Model update available” instead of “Outdated portfolio.”
- “Estimate incomplete: 3 holdings have no tax lots” instead of showing a confident zero.

---

## 18. Empty, loading and error states

Every planned screen must specify these states during design handoff.

### No data

Explain what is missing and what becomes possible when it is supplied. Example: “No approved client target. Create and approve a Target plan before reviewing drift.”

### Partial data

Render usable information while clearly stating the incomplete portion. Do not block an entire page because one optional classification is missing.

### Loading

Keep the page structure stable and avoid flashing misleading zeros. In the current static implementation, data-load failure should offer Retry and must not clear saved work.

### Validation error

Keep the user's draft. Place the message at the affected input and provide an error summary when several errors prevent approval.

### Storage/migration error

Explain that browser-local saved work could not be read. Do not automatically overwrite it. Provide a recovery/export route in a future production-grade iteration.

---

## 19. Recommended delivery sequence

### Phase 1 — completed foundation

- Clean Model library duplicates.
- Preserve and expand the full original hierarchy.
- Move routine versioning out of Model and Portfolio lists.
- Add dedicated Model comparison.
- Restore original structured data.
- Rework Portfolio overview for Household/Account use.
- Restore Aggregated drift label, threshold-relative bar and Threshold (pp).
- Keep overview expansion concise.
- Move full allocation/exposure/account analysis to Portfolio detail.
- Restore Asset distribution for Actual versus client target/combined targets.

### Phase 2 — Target plan refinement

- Redesign the existing functional Target plan using the workflow in section 9.
- Clarify base model, inheritance, overrides and approved state.
- Integrate scope changes into the same draft/review/approval flow.
- Improve model-update review without exposing routine revision numbers.
- Verify that household targets remain derived rather than independently editable.
- Prototype locally and obtain visual/product approval before publishing.

### Phase 3 — Profile comparison and exposure refinement

- Add dedicated Profile comparison under Models.
- Refine advanced exposure lenses on Portfolio detail.
- Make Look-through/Single tag method and data quality explicit.
- Confirm policy for independent exposure-target overrides before making them editable.

### Phase 4 — Individual Planning

- Add scenario creation.
- Generate and edit suggested buys/sells.
- Show before/target/projected allocation.
- Enforce cash, liquidity, lock and minimum-trade constraints.
- Preserve residual cash and infeasibility states.
- Add draft/review/approval lifecycle without claiming execution.

### Phase 5 — Tax-aware planning

- Add tax estimate detail with transparent assumptions.
- Add exemptions and loss-offset display.
- Add optional loss-harvesting review.
- Surface missing-lot limitations and confidence.
- Validate tax policy/data with subject-matter expertise before treating results as actionable.

### Phase 6 — Cash-event planning

- Add invest/raise-cash events.
- Support gross/net withdrawal intent.
- Add lump-sum and staged investment scenarios.
- Link each event to a Planning scenario and History.

### Phase 7 — Bulk planning and broader workflow

- Reuse the individual planning engine for selected portfolios.
- Add bulk review with per-portfolio feasibility and drill-down.
- Expand recommendation states if client communication/execution enters scope.

### Phase 8 — Security master design

- Conduct the separate product discussion.
- Redesign only after classification ownership, data sourcing and propagation rules are decided.

### Phase 9 — Production-oriented capabilities

- Statement ingestion and verification.
- Authenticated persistence and access control.
- Multiuser approval policy.
- Real pricing/classification sources.
- Recommendation communication/execution/reconciliation, if desired.

---

## 19a. IA decisions changed since last revision

Record every navigation, vocabulary or scope reversal here, with its reason, so the plan stays usable as the backlog.

| # | Date | Decision | Supersedes | Reason |
|---|---|---|---|---|
| 1 | 2026-10-07 | Account detail uses the original mockup's five numbered tabs | §6.2's four-section list | Keeps the original workflow sequence an adviser already knows |
| 2 | 2026-10-07 | History restored as a sixth, unnumbered account tab | — | §6.2 and §13.1 both require per-portfolio history; the five numbered tabs had dropped it |
| 3 | 2026-10-07 | "Target plan" is presented as **Client target limits** | §9's "Target plan" title | The screen approves asset-class *and* lens limits. "Model limits" was rejected: §1.1 forbids blurring model with client target |
| 4 | 2026-10-07 | Portfolio lens limits are editable and **drive review flags** | §21 Q6 remains open for *exposure targets as policy* | A limit that is approved but not applied makes the approval untruthful (§1.5). Household views keep firm defaults; limits apply to the account that approved them |
| 5 | 2026-10-07 | Global audit destination is named **Audit log** everywhere | mixed "History" / "Audit log" / "Audit trail" | One destination, one name |
| 6 | 2026-10-07 | Review state reads **Within threshold**, never "Within defaults" | — | A portfolio with its own threshold override is not "within defaults" |

### Closed since the last revision

- §4.1 Model library: search, last-updated date and a top-level allocation preview.
- §4.5 Profile comparison: dedicated page under Models, drafts excluded, unrecorded attributes shown as *Not supplied*.
- §8.2 Advanced lens surface: the full bucket explorer opens by default on Exposure drift.
- §9.3 Client context: assessed profile, approved revision, and a liquidity profile derived from the holdings, with goals and horizon marked *Not supplied* rather than inferred.
- §9.4 Model update: three explicit choices — keep, review in context, start a revised draft.
- §13.2 Audit log: one chronological feed filtered by portfolio/model, action, actor, status and date range, each entry opening to before/after values.
- §14 Security master: nav item and placeholder naming the capability and the unresolved questions. The area itself is still not designed.
- Traceability appendix: `docs/original-mockup-traceability.md`.

Decision 7 (2026-10-08): the original's **Reset profile to default**, **Expand to breaches** and **editable risk profile in the portfolio header** are recorded as *Dropped*, with reasons, in the traceability appendix. Model-level lens target editing stays dropped until §21 Q6 is answered.

Decision 8 (2026-10-08): **Profile comparison is a view inside Model comparison, not a second page.** This reverses §4.5. As built, its per-asset-class rows simply repeated the Asset allocation view against the same models in the same columns, so the page was half duplicate. The attributes that are genuinely distinct — intended use, portfolios using the model, their assessed labels, and the *Not supplied* rows — now appear as an **Intended profile** view alongside the exposure lenses. §4.5's requirement of enough room and no repetition inside the library still holds; a second page was not the only way to meet it.

Decision 9 (2026-10-08): **Planning, tax and cash events are implemented** (§§10–12), on tabs 2 and 3. Two rules were added that the original mockup did not have, because testing showed it produced advice an adviser would reject:

- A rebalance only sells from asset classes at or above target and only buys into classes below target. Leaf-level logic alone made aggregated drift *worse* on the first portfolio tested, because it bought more gold while Real assets sat 13 pp over on a locked flat.
- A rebalance is sized to whichever side is smaller, so it is cash-neutral. Unconstrained, it sold ₹17.3 lakh to redeploy ₹0.7 lakh, booking tax to create idle cash.

Raising cash defaults to *Keep closest to client target* rather than the original's *Lowest estimated tax*, which drove drift from 7.9 to 17.2 pp on a ₹25 lakh withdrawal. Both strategies remain available.

### Still outstanding against this plan

- §10.5 bulk planning and the original's bulk rebalance review (Phase 7). The scenario engine is shared-ready; only the multi-portfolio selection and roll-up are missing.
- §10.6 recommendation states beyond approval: communicated, accepted, executed, reconciled. The build deliberately stops at approval and says so.
- §14 Security master itself (Phase 8), after its own product discussion.
- §16 statement ingestion and data-quality surfacing (Phase 9).
- §9.3 goals and time horizon need a client record before they can be more than *Not supplied*.
- Multi-user approval policy: whether a second reviewer or client acknowledgement is required (§9.8).

---

## 20. Cross-screen verification checklist

### Models

- Each logical model appears once.
- Published hierarchy and all 19 sample investments are inspectable.
- New models contain the full hierarchy at 0%.
- Drafts can be incomplete; invalid models cannot publish.
- Publishing does not alter approved client targets.
- Routine screens show model names, not version labels.
- Comparison distinguishes absent targets from explicit zero.

### Portfolios

- Household and Account counts and totals match source data.
- Search/filter/sort do not change global totals silently.
- Aggregated drift uses maximum absolute asset-class drift.
- Threshold bars use the effective threshold as midpoint.
- Blank threshold inherits the firm default.
- Threshold edits do not change models, targets or holdings.
- Exposure issues can trigger review independently of asset-class drift.
- Row expansion is concise and clearly open/closed.

### Allocation and Target plan

- Account page shows Actual versus client target.
- Household page shows Actual versus combined client targets.
- Household aggregation counts each account once.
- Actual and target use the same approved scope.
- Draft target/scope changes do not affect Allocation.
- Blank inheritance remains different from explicit zero.
- Approval creates an immutable snapshot and history entry.

### Planning, tax and cash

- Suggestions never mutate actual holdings.
- Buys remain funded after constraints or manual exclusions.
- Projected allocation is labelled projected.
- Residual cash is visible.
- Tax values are estimates and identify missing lots.
- Gross/net withdrawal intent is explicit.
- Approval does not imply execution.

### Usability and resilience

- Dialog Close, Cancel and Escape behave correctly.
- Focus and keyboard interaction work throughout.
- Charts have text equivalents.
- Mobile page has no global horizontal overflow.
- Wide tables scroll inside their containers.
- User-entered text is rendered safely.
- Drafts and approved records survive reload and data migration.
- Data-load failures do not clear browser-local work.

---

## 21. Product decisions still to validate

These should guide discovery, not block useful mockup progress:

1. Which assets are normally under advice, especially property, EPF/PPF, jewellery, emergency cash and investment cash?
2. Can an individual have multiple goal-specific portfolios or targets?
3. How is assessed risk connected to model eligibility?
4. Does target/recommendation approval require one adviser, a second reviewer, client acknowledgement, or different rules by action?
5. Are thresholds global, asset-class-specific, account-specific, or some combination beyond the current portfolio-level pp rule?
6. Should exposure targets be analytical references, editable limits, or both?
7. What trustworthy price, classification and fund-underlying sources will be available?
8. Which statements and instrument types should ingestion support first?
9. What data freshness/completeness is required before generating trade suggestions?
10. What tax-lot and client-tax-profile information will be available?
11. How should recommendation communication and execution status work in the real RIA practice?
12. How should Security master changes affect historical views and current analytics?

Until these are answered, the mockup should use transparent illustrative assumptions and avoid implying that provisional rules are settled policy.

---

## 22. Definition of design completion for each refinement

A refinement is ready for implementation when its design specifies:

- user goal and primary decision;
- entry and exit routes;
- hierarchy and content priority;
- all fields, labels, units and explanatory copy;
- default, inherited, zero and missing states;
- read-only, draft, approved and historical states as relevant;
- validation and recovery behaviour;
- empty, partial, loading and error states;
- desktop and mobile behaviour;
- keyboard/accessibility behaviour;
- calculation and data-source assumptions;
- audit/history effect;
- acceptance checks.

Local prototypes should be reviewed before remote publication when a material layout or interaction is being proposed. Once approved, implementation should preserve browser-local data, run the complete automated suite, receive real-browser interaction checks, and only then be committed, pushed and verified on GitHub Pages.
