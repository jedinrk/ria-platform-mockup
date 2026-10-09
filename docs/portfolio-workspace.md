# Portfolios / Allocation redesign

## Layout decisions

- **Overview:** compact summary cards and a searchable Household / Account list. Model and source risk profile share a cell; attention indicators concern allocations, not target-approval workflow. “Aggregated drift” retains the original definition: the largest absolute asset-class drift. Its bar is threshold-relative—the midpoint is the effective portfolio threshold and full width is twice that threshold. Filters affect the list, not global cards; the result count states this.
- **Review thresholds:** the Threshold (pp) column remains editable. Blank values inherit the editable firm default; explicit household and account overrides remain independent. Review-rule changes are saved separately and never alter targets or holdings. Exposure flags can still require attention when Aggregated drift is within its threshold.
- **Portfolio detail:** identity, ownership type, model name and source date above five numbered workflow tabs: Assets & liabilities, Allocation & drift, Gap summary & trades, Cash & planning and Client target. That is the revised mockup's four, plus the client-target surface it does not have because it approves nothing.

  Exposure drift is no longer a tab. It was never a view of its own: it set the allocation area and flipped a lens, which the Asset allocation / Exposure analysis toggle inside Allocation already does. Choosing a distribution there opens the bucket explorer, exactly as the tab did. Target history moved beside the approval it records, since a revision list belongs with the thing being revised. Households aggregate accounts; they are not separate individual clients or extra approved targets. The listing expansion stays concise; detailed allocation, exposure and account analysis belongs on the detail page.
- **Allocation:** two aligned stacked bars plus per-class numbers. Detailed rows show actual value/percentage, approved target, the band the row is judged against, drift and value gap. Expand to breaches opens only the branches holding a row outside its band, which matters once the tree runs five levels deep.

  Targets and bands are also editable here, because this is where the adviser is already looking when they decide something is wrong. Adjust targets opens a draft; editing a node moves its siblings under the same parent, so the level above never changes and the portfolio stays at 100% without arithmetic by hand. Changed rows are marked and carry a reset; clearing a box returns the whole sibling group to the model, and Reset to model clears every override. The approved client target, the holdings and the review summary are unchanged until the draft is approved on Client target, which therefore becomes the review surface rather than the place editing starts. Changing the model itself is still Models' job.
- **Exposure analysis:** a secondary view within Allocation. Sector, geography, market cap, themes, credit/duration and grouped hierarchy remain available. Fund controls appear only where they affect results. Separate marginal exposure dimensions are never multiplied to fabricate joint holdings.
- **Scope:** compact Recorded assets / Under advice summary and supporting detail dialog. Changes are made in a Client target limits draft and require approval and exclusion reasons. No asset type is automatically excluded.
- **Models:** dedicated Model comparison remains separate, without repeating profile cards in the library/editor. Intended profile is one of its comparison views. Routine names replace revision labels; history retains underlying snapshots and bands.
- **Planning:** single-portfolio Planning is implemented. Rebalance scenarios show suggested trades, constraints, estimated tax, projected allocation, residual cash and infeasibility. Cash events support raise/invest intent, gross versus net proceeds, lump-sum or staged deployment, loss harvesting and event history. Suggestions and approvals never mutate recorded holdings or imply execution. Bulk selection and roll-up remain outstanding.
- **Security master:** a firm-wide configuration grid owns asset class, sector and sub-sector for the sample instruments. Edits are staged, impact-reviewed and applied deliberately; they feed current analysis without restating an approved historical snapshot.

## Calculation and preservation

Actual and target use the same included-asset total. Drift is actual minus target percentage. Value gap is target value minus actual value; positive means a shortfall, not a buy instruction. Actual-only holdings remain visible; “Not specified” differs from 0%.

Household targets are weighted by each account's value under advice, counting each account once. Review flags use original illustrative thresholds and a stable Look-through method, independent of the currently browsed lens mode. Exposure flags may overlap. Credit/duration uses debt-only denominators; themes need not sum to 100%.

The band a row is judged against comes off the classification tree, so the drift table and the review flags cannot disagree: the asset-class row uses the portfolio threshold, and every level below it uses the band on that node — the model's default unless this portfolio has overridden it.

Drafts do not affect the overview, the review summary or the approved comparison until approved; a draft in progress is shown against the draft's own targets and says so. Model publication does not overwrite approved client targets. Planning scenarios do not mutate holdings or targets. Earlier four-client examples remain readable in the global Audit log; their storage is untouched. Historical bands are preserved while their editing is deferred.

## Source data

The JSON preserves normalized original records and raw declarations, including the cash/tax defaults used by the implemented illustrative Planning workflows. It retains the source SHA-256, exact deterministic holding-generation inputs, costs, liquidity and classifications. Account ownership shares, goals, completed risk assessments and statement evidence were not supplied.

Current baseline source: `Portfolio Console – wireframes.html`. Six households, twelve accounts, nineteen investments, 228 account-holding records, ₹1,968 lakh. Date: 3 October 2026. Every original asset initially included. These are illustrative, not current verified financial facts.

A revised source mockup is expected. When received, it will be retained as a new source revision and compared against both this baseline and the implemented workspace. Its additions and changes are not part of the accepted scope until that traceability review is complete.

## Next review

After the revised source mockup is supplied, update the source data and traceability where required, implement the accepted deltas, and then perform a whole-product UI/UX review for customer presentation. That review must validate the complete adviser journey, responsive and keyboard behaviour, presentation data/reset state, terminology, visual consistency, disclosures and the boundary between prototype approval and real execution.

Bulk planning remains the largest known workflow gap. A pending cash-event indicator on the overview, extended Security master classifications and production recommendation states remain secondary known gaps; the revised source comparison may add or reprioritize work.

## Verification

Automated checks cover source totals/formula, model hierarchy, look-through/tag calculations, scope validation, approval/model immutability, stable review flags, actual-only versus zero targets, comparison selection, audit behaviour, planning constraints and Security master staging/propagation. Browser checks cover grouping/search, expandable rows, navigation, holdings, exposure modes, draft reload, exclusion validation, unchanged approved scope, approval history, model workflows, Planning, Audit log, Security master, short dialogs and 390px mobile containment.
