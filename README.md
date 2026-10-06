# Portfolio Console mockup

Static, browser-local RIA workflow prototype. Entry point: `index.html`. Deploy the complete repository root to GitHub Pages; no build step is needed.

- **Portfolios:** searchable Household / Account overview, original AUM, threshold-relative Aggregated drift bars, editable portfolio thresholds, a stated review reason (asset class / exposure / both) and a concise row expansion showing drift by asset class, contributing accounts and the worst bucket per exposure lens.
- **Allocation:** actual versus approved client target, distribution chart, holdings hierarchy with review state and liquidity/physical tags, value gaps and exposure lenses. Households get the same table against combined client targets.
- **Client target limits:** model assignment, asset-class adjustments, per-bucket lens limits, included-assets dialog, draft saving and approval. An approved lens limit replaces the model-implied target and/or the default band and is what Exposure drift and the portfolio list compare against.
- **Models:** searchable library with an allocation preview and last-updated date, a focused editor, Model comparison and Profile comparison. The model Sector view carries the original's equity concentration check against the firm cap. Revisions belong in the Audit log.
- **Audit log:** one chronological feed of model publications and client target approvals, filtered by portfolio/model, action, actor, status and date range. Each entry opens to before/after values. Each account also has its own History tab.
- **Planning:** tabs 2 and 3 are explicitly labelled roadmap screens, not implemented trade/tax/cash workflows.
- **Security master:** nav item and placeholder naming the capability and the product questions it needs answered first. The classification data already drives every exposure view and is readable on any holding.

## Data and persistence

`data/original-mockup.json` contains six original households, twelve accounts, nineteen investments, 228 account holdings, model weights, classifications, illustrative cost/tax inputs and cash-planning defaults. Total sample assets: ₹1,968 lakh (₹19.68 crore), dated 3 October 2026. Every original asset starts included. Account types are inferred from names, not verified ownership records.

`scripts/extract-original.cjs` regenerates JSON from the original HTML without running its DOM application. It accepts the HTML path and a Babel parser module path and emits JSON to stdout. The source hash and unrounded deterministic holding data are retained; the current extraction matches byte-for-byte.

Saved models retain `portfolio-model-design-v2`. Original-account targets use `portfolio-original-targets-v1`. Earlier four-client examples under `portfolio-client-targets-v1` are not overwritten and remain readable in History. Initial approvals are illustrative workflow entries, not original real approvals. No backend, live pricing, current tax guidance or trade execution is provided. Storage is specific to the browser/origin. Legacy `clients.js` remains in the repository but is no longer loaded.

Review-rule settings use `portfolio-review-rules-v1`. Blank portfolio thresholds inherit the firm default; explicit household and account overrides remain independent. Changing these rules only changes review flags and bar scales—it never changes models, targets or holdings.

## Verification

Run `node --test tests/*.test.cjs`. Serve the root with a local HTTP server; the JSON-backed app does not support direct file URLs.

`bootstrap.js` loads data and scripts in order. Increment the release token in `bootstrap.js` and `index.html` when changing assets to prevent mixed cached releases. Data-load failure shows a retry screen without resetting saved work.

`docs/original-mockup-traceability.md` maps every component of the original wireframe to delivered / refined / deferred / dropped, with reasons. See `ROADMAP.md` and `docs/portfolio-workspace.md` for the current design scope. The complete designer-facing specification and phased refinement plan is in `docs/ui-ux-refinement-plan.md`.
