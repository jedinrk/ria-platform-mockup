# Portfolio Console roadmap

## Delivered

The original mockup is the data/information reference, not a layout to reproduce verbatim. Portfolios now has Household and Account views using all six original households and twelve accounts, with ownership types labelled rather than recast as individual people.

The journey is overview → household/account → Allocation → Target plan → History. Allocation contains an actual-versus-approved-target distribution chart, expandable holdings, value gaps and exposure analysis. Target plan separates model assignment and adjustments from recorded holdings. Asset inclusion is managed in a supporting dialog; original examples include every asset.

Models retains its dedicated scalable comparison page. Routine views use model names; revisions and historical bands remain in History. Drift-band editing is deferred to a possible Review rules feature. Overview attention indicators concern allocations/exposures; draft and model-update notices live inside portfolios.

All original source data is preserved in JSON, including defaults for pending workflows. Existing model storage and earlier client records remain preserved. This is a browser-local illustrative prototype.

## Next iterations

1. Review the revised Portfolios / Allocation journey and refine Target plan. Independent exposure-target overrides need an explicit policy; lens targets currently derive from approved allocation weights.
2. Implement Planning scenarios: suggested buys/sells, liquidity constraints, individual/bulk review, cash funding and residuals. A gap is not itself a trade recommendation.
3. Add illustrative tax estimates, exemptions and loss harvesting with transparent assumptions. Original placeholder rates must not be represented as current tax guidance.
4. Add cash inflows/withdrawals, event history and lump-sum/staged investment planning. Scenarios must not mutate recorded holdings.
5. Discuss Security master UI separately as requested. Original classification data is already retained.

Household targets aggregate account targets by value; there is no independent household target approval. Beneficial-owner mapping, verified source evidence, statement ingestion, production persistence and authenticated approvals remain outside this milestone.

## Verification and deployment

Run `node --test tests/*.test.cjs` and real-browser checks for filters/sorting, navigation, hierarchy, lenses, scope isolation, draft reload, approval validation/history, publication isolation and Model comparison. Verify mobile containment and browser errors. Publish the complete root, then confirm GitHub Pages itself.
