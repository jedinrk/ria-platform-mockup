# Model comparison

Models has two sibling views: Model library and Model comparison. Comparison remains separate as the Portfolios workspace evolves; the former paused blanket restoration was not published.

- Search all published models by name or intended use; select up to four. Library size is not restricted.
- Initially select up to three published models. Model choices and expanded rows survive navigation during the current page session. Reloading returns to the initial choices.
- Compare asset-class targets first, then expand the aligned subcategory and investment rows. Allocation identity uses the complete hierarchy path, including names containing slashes.
- A missing allocation displays “Not specified”; an explicit zero displays “0%”. There is no automatic normalization or redistribution.
- Columns show model names and descriptions. Drafts are excluded. The existing model editor retains publication/history behavior.
- Optional exposure views use the original mockup's illustrative classifications in `data/model-exposures.json`. Look-through versus Single tag is one shared comparison setting, not a change to model data.
- Compare exposure dimensions separately. Themes overlap; credit/duration uses each model's debt allocation; unknown instruments remain Unclassified. No debt is “Not applicable”.
- Wide tables scroll within their container on small screens; row labels remain visible.

The current workspace uses the shared `originalData` dataset loaded from `data/original-mockup.json`. The focused `data/model-exposures.json` subset remains a fallback for standalone comparison loading. Both contain the same original illustrative classifications, not current or verified financial data. See `portfolio-workspace.md` for the new portfolio journey.

Run `node --test tests/comparison.test.cjs` for alignment, exposure and selection-limit checks. Browser verification covers search/selection, hierarchy expansion, mode switching, empty state, editor navigation and responsive layout.
