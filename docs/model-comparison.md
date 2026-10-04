# Model comparison

Models now has two sibling views: Model library and Model comparison. This change is based on the deployed mockup and does not include the paused broader restoration/redesign.

- Search all published models by name or intended use; select up to four. Library size is not restricted.
- Initially select up to three published models. Model choices and expanded rows survive navigation during the current page session. Reloading returns to the initial choices.
- Compare asset-class targets first, then expand the aligned subcategory and investment rows. Allocation identity uses the complete hierarchy path, including names containing slashes.
- A missing allocation displays “Not specified”; an explicit zero displays “0%”. There is no automatic normalization or redistribution.
- Columns show model names and descriptions. Drafts are excluded. The existing model editor retains publication/history behavior.
- Optional exposure views use the original mockup's illustrative classifications in `data/model-exposures.json`. Look-through versus Single tag is one shared comparison setting, not a change to model data.
- Compare exposure dimensions separately. Themes overlap; credit/duration uses each model's debt allocation; unknown instruments remain Unclassified. No debt is “Not applicable”.
- Wide tables scroll within their container on small screens; row labels remain visible.

Source JSON is a focused subset of the original-data extraction, with provenance. It is not current or verified financial data. The original portfolio dataset and the broader paused UI changes are not deployed by this feature.

Run `node --test tests/comparison.test.cjs` for alignment, exposure and selection-limit checks. Browser verification covers search/selection, hierarchy expansion, mode switching, empty state, editor navigation and responsive layout.
