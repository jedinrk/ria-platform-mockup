# Portfolio Console roadmap

## Delivered

The original mockup is the current data/information baseline, not a layout to reproduce verbatim. Portfolios has Household and Account views using all six original households and twelve accounts, with ownership types labelled rather than recast as individual people.

The journey is overview → household/account → five numbered review tabs: Assets & liabilities, Allocation & drift, Gap summary & trades, Cash & planning and Client target. The overview filters by model, carries a financial-plan column beside the drift bar, and retains the original Aggregated drift label, threshold-relative bar and editable Threshold (pp) controls; blank thresholds inherit the firm default. Its row expansion gives a concise three-column review of asset-class drift, contributing accounts and exposure flags. Allocation contains an actual-versus-approved-client-target distribution chart, expandable holdings, value gaps and exposure analysis. The Client target limits screen separates model assignment and client adjustments from recorded holdings. Asset inclusion is managed in a supporting dialog; original examples include every asset.

Financial planning is delivered on tabs 1 and 4: a household balance sheet with liquidity bands and days to cash, a twelve-month cash-flow projection, yearly expenses by category, a 30-year funding projection, planning flags, a contingency cash raise ordered cheapest-first by tax and exit penalty, a recurring investment plan, and editable liability and recurring-need registers. Income, liabilities and needs are household facts, so an account shows its household's plan. See `docs/financial-planning.md`.

Individual Planning is delivered on tabs 3 and 4: gap summary, constrained rebalance scenarios, projected impact, illustrative tax estimates, cash raising/investment, staged deployment and event history. Approval records a recommendation; it does not execute a trade or change recorded holdings.

Models has seven published models: three by risk profile and four by strategy, each naming the profile it is intended for. Targets and tolerance bands sit on the classification tree — Asset class › Super sector › Sector › Sub-sector › Security — down to a depth set per asset class, with the children of a node always adding up to it. A Tags column lists the attributes of the securities beneath each branch and filters the tree. Review flags now come from breaches of those bands rather than from six independent exposure lenses. It also has a searchable library, focused editor, publication history and a scalable comparison workspace. Intended profile is a view within Model comparison rather than a duplicate page. Routine views use model names; revisions and historical bands remain in History. Publishing a model never silently changes an approved client target.

Audit log is a single chronological feed of model publications and client-target approvals, with object, action, actor, status and date filters and before/after detail.

Security master is a working firm-wide configuration grid built to the supplied `RIA-AssetConfig-Type1` sheet, carrying its 31 instruments with an explicit instrument type and a four-level classification: asset class, super sector, sector and sub-sector. The levels nest, so each dropdown offers only what belongs under the level above. Changes are staged and reviewed before being applied, and the review states the instruments, value and portfolios affected. ISIN and current price have no source and stay blank; symbols are filled only where one real listed symbol is unambiguous. Attributes beyond the sheet's nine columns are shown read-only on row expansion, grouped by whether a feed, the firm or the client owns them, and as comparable columns when the list is filtered to one instrument type. See `docs/security-master.md`.

All original source data is preserved in JSON, including defaults for pending workflows. Existing model storage and earlier client records remain preserved. This is a browser-local illustrative prototype.

## Remaining implementation

1. **Bulk planning:** restore flagged-portfolio selection and add multi-portfolio scenario roll-up, per-portfolio feasibility drill-down and bulk approval. The single-portfolio engine is already the basis for this work.
2. **Overview cash-event state:** restore the original pending cash-event indicator now that cash events themselves are implemented.
3. **Security master extensions:** making the firm-owned attributes editable through the existing staging and review, deciding where client-specific assets live, and a real instrument source behind ISIN, symbol and price. The Add instrument surface also needs a real firm/vendor source before it can add anything beyond the closed sample universe.
4. **Recommendation lifecycle:** communicated, client accepted, executed and reconciled states remain beyond the current approval-only prototype.
5. **Production data and controls:** statement ingestion, verified ownership/source evidence, current prices and classifications, tax lots and client tax profiles, authenticated persistence, access control and multi-user approval policy.

Lens limits are editable per portfolio and drive review flags once approved. Whether exposure targets are analytical references, firm policy or both remains an open product question; model-level lens target overrides stay out of scope until that is resolved. Household targets aggregate account targets by value; there is no independent household target approval.

## Next planned phase

### 1. Incorporate the revised source mockup

A newer version of the initial mockup is expected from the product owner. Once supplied:

- preserve the current source file as the baseline rather than overwriting its history;
- compare new data, screens, controls, terminology, calculations and workflow states against both this implementation and `docs/original-mockup-traceability.md`;
- classify every change as new, changed, unchanged, intentionally superseded or no longer required;
- update the normalized source data and extraction process where the revised file changes the sample or its rules;
- implement accepted deltas without regressing the separation between model, approved client target and actual holdings; and
- rerun automated and real-browser verification before publishing.

No requirement from the revised mockup is considered accepted or implemented until that comparison is complete.

### 2. Customer-presentation readiness review

After the revised mockup has been incorporated, re-evaluate the complete feature set and UI/UX as one product rather than as a sequence of patches. The final review will cover:

- end-to-end adviser journeys and navigation;
- terminology, hierarchy, visual consistency and information density;
- default, empty, loading, invalid, constrained and approval states;
- desktop, tablet, mobile, keyboard and short-viewport behaviour;
- a clean and deterministic demonstration state;
- prototype, data-freshness, tax and non-execution disclosures; and
- a customer-facing walkthrough that clearly distinguishes delivered prototype behaviour from future production capability.

The exit condition is a final traceability register, resolved presentation-blocking issues, a verified deployed build and an agreed list of post-presentation backlog items.

## Verification and deployment

Run `node --test tests/*.test.cjs` and real-browser checks for filters/sorting, navigation, hierarchy, lenses, scope isolation, draft reload, approval validation/history, planning constraints, publication isolation, Model comparison, Audit log and Security master staging. Verify mobile containment, short-viewport dialogs and browser errors. Publish the complete root, then confirm GitHub Pages itself and compare its release assets with the intended main-branch version.
