# Portfolio Console mockup

## Current milestone

Models plus an individual-client dashboard, household member summaries and client-target approvals. Four illustrative clients belong to two households. Targets are individual; household totals aggregate member records. Joint ownership and shared household targets are not yet modelled.

Client targets store a copy of their selected published model, exact version, allocation adjustments, asset scope, approval reason, approver and timestamp. Editing a draft or publishing a model does not replace an approved client target. Blank adjustments inherit; zero is explicit. Parent and child adjustments must reconcile before approval.

Model data remains in `portfolio-model-design-v2`; client records use `portfolio-client-targets-v1`. Both stores are browser-local demonstration data. There is no backend, statement ingestion or authenticated approval. Existing model allocations, drafts and versions are retained. Model client counts now reflect the four navigable client examples instead of the previous placeholder assignments.

The sample targets exclude homes and personal jewellery and include EPF for retirement planning. These are illustrative scope choices, not universal policy or investment recommendations. The two Moderate clients illustrate independent customisation. Sample asset valuations are dated 4 October 2026.

## Agreed next milestones

1. Actual versus approved client target, with consistent scope, dates, data quality, allocation gaps and drift bands.
2. Exposure views: sector, geography, market cap, themes and fund look-through. Use sourced exposure data; do not infer joint exposures by multiplying unrelated marginal percentages.
3. Suggested buys/sells, individual and bulk review, liquidity constraints, residual cash, illustrative tax estimates, exemptions and loss harvesting.
4. Cash inflows, withdrawals and staged investment planning.

All of these capabilities remain in scope; this order is delivery sequencing. Security master UI will be discussed separately. Households remain part of the dashboard; household-level target approval is a separate product decision.

## Verification for this milestone

- Open Individuals and Households; drill into a member's target.
- Expand all allocations, edit targets and bands; invalid totals block approval.
- Blank inherits a model value; zero is an explicit adjustment.
- Reload to verify draft persistence and inspect the unchanged approved target.
- Change scope; excluded assets require reasons. Scope totals update only in the draft until approval.
- Require an approver and reason; preserve prior target and scope snapshots in history.
- Publish a new model version; both clients retain their approved version and see an update notice.
- Review model selection; cancelling retains the prior model and accepting changes only the draft, preserving matching client adjustments.
- Verify narrow screens contain wide tables in scrollable containers.

Deploy the repository root to GitHub Pages. `index.html` now loads `clients.js` and `clients.css`; publish all three together.
