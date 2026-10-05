# Portfolios / Allocation redesign

## Layout decisions

- **Overview:** compact summary cards and a searchable Household / Account list. Model and source risk profile share a cell; attention indicators concern allocations, not target-approval workflow. “Aggregated drift” retains the original definition: the largest absolute asset-class drift. Its bar is threshold-relative—the midpoint is the effective portfolio threshold and full width is twice that threshold. Filters affect the list, not global cards; the result count states this.
- **Review thresholds:** the Threshold (pp) column remains editable. Blank values inherit the editable firm default; explicit household and account overrides remain independent. Review-rule changes are saved separately and never alter targets or holdings. Exposure flags can still require attention when Aggregated drift is within its threshold.
- **Portfolio detail:** identity, ownership type, model name and source date above Allocation / Target plan / Planning / History. Households aggregate accounts; they are not separate individual clients or extra approved targets. The listing expansion stays concise; detailed allocation, exposure and account analysis belongs on the detail page.
- **Allocation:** two aligned stacked bars plus per-class numbers. Detailed rows show actual value/percentage, approved target, drift and value gap. Model-versus-client adjustments belong in Target plan instead.
- **Exposure analysis:** a secondary view within Allocation. Sector, geography, market cap, themes, credit/duration, Core/Satellite and grouped hierarchy remain available. Fund controls appear only where they affect results. Separate marginal exposure dimensions are never multiplied to fabricate joint holdings.
- **Scope:** compact Recorded assets / Under advice summary and supporting detail dialog. Changes are made in a Target plan draft and require approval and exclusion reasons. No asset type is automatically excluded.
- **Models:** dedicated Model comparison remains separate, without repeating profile cards in the library/editor. Routine names replace revision labels; history retains underlying snapshots and bands.
- **Planning:** explicitly not implemented yet. Trade/tax/cash capabilities remain in the roadmap and extracted source data, not fake operational controls.

## Calculation and preservation

Actual and target use the same included-asset total. Drift is actual minus target percentage. Value gap is target value minus actual value; positive means a shortfall, not a buy instruction. Actual-only holdings remain visible; “Not specified” differs from 0%.

Household targets are weighted by each account's value under advice, counting each account once. Review flags use original illustrative thresholds and a stable Look-through method, independent of the currently browsed lens mode. Exposure flags may overlap. Credit/duration uses debt-only denominators; themes need not sum to 100%.

Drafts do not affect overview or Allocation until approved. Model publication does not overwrite approved client targets. Earlier four-client examples remain readable in global History; their storage is untouched. Historical bands are preserved while their editing is deferred.

## Source data

The JSON preserves normalized original records and raw declarations, including cash/tax defaults for future work. It retains the source SHA-256, exact deterministic holding-generation inputs, costs, liquidity and classifications. Account ownership shares, goals, completed risk assessments and statement evidence were not supplied.

Source: `Portfolio Console – wireframes.html`. Six households, twelve accounts, nineteen investments, 228 account-holding records, ₹1,968 lakh. Date: 3 October 2026. Every original asset initially included. These are illustrative, not current verified financial facts.

## Verification

Automated checks cover source totals/formula, model hierarchy, look-through/tag calculations, scope validation, approval/model immutability, stable review flags, actual-only versus zero targets and comparison selection limits. Browser checks cover grouping/search, expandable rows, navigation, holdings, exposure modes, draft reload, exclusion validation, unchanged approved scope, approval history, model workflows and 390px mobile containment.
