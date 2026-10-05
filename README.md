# Portfolio Console mockup

Static, browser-local RIA workflow prototype. Entry point: `index.html`. Deploy the complete repository root to GitHub Pages; no build step is needed.

- **Portfolios:** searchable Household / Account overview, original AUM, concise expandable explanations, threshold-relative Aggregated drift bars and editable portfolio thresholds.
- **Allocation:** actual versus approved client target, distribution chart, holdings hierarchy, value gaps and exposure lenses.
- **Target plan:** model assignment, client adjustments, included-assets dialog, draft saving and approval.
- **Models:** focused editor and separate Model comparison. Revisions belong in History; stored drift bands are no longer edited in the main UI.
- **History:** model snapshots, portfolio approvals and retained earlier prototype records.
- **Planning:** explicitly labelled roadmap screen, not an implemented trade/tax/cash workflow. Security master design remains pending.

## Data and persistence

`data/original-mockup.json` contains six original households, twelve accounts, nineteen investments, 228 account holdings, model weights, classifications, illustrative cost/tax inputs and cash-planning defaults. Total sample assets: ₹1,968 lakh (₹19.68 crore), dated 3 October 2026. Every original asset starts included. Account types are inferred from names, not verified ownership records.

`scripts/extract-original.cjs` regenerates JSON from the original HTML without running its DOM application. It accepts the HTML path and a Babel parser module path and emits JSON to stdout. The source hash and unrounded deterministic holding data are retained; the current extraction matches byte-for-byte.

Saved models retain `portfolio-model-design-v2`. Original-account targets use `portfolio-original-targets-v1`. Earlier four-client examples under `portfolio-client-targets-v1` are not overwritten and remain readable in History. Initial approvals are illustrative workflow entries, not original real approvals. No backend, live pricing, current tax guidance or trade execution is provided. Storage is specific to the browser/origin. Legacy `clients.js` remains in the repository but is no longer loaded.

Review-rule settings use `portfolio-review-rules-v1`. Blank portfolio thresholds inherit the firm default; explicit household and account overrides remain independent. Changing these rules only changes review flags and bar scales—it never changes models, targets or holdings.

## Verification

Run `node --test tests/*.test.cjs`. Serve the root with a local HTTP server; the JSON-backed app does not support direct file URLs.

`bootstrap.js` loads data and scripts in order. Increment the release token in `bootstrap.js` and `index.html` when changing assets to prevent mixed cached releases. Data-load failure shows a retry screen without resetting saved work.

See `ROADMAP.md` and `docs/portfolio-workspace.md` for design scope.
