# Working rules for this repository

## The one rule that matters

**The root of `main` is the live site. It stays on the current release until the
revised-mockup work is approved.**

`https://jedinrk.github.io/ria-platform-mockup/` is served from `main` at `/`.
Anything merged to the root of `main` is published immediately, to whoever is
looking at it. Until the v3 work is signed off, **do not merge it to the root**,
and do not change root-level files as a side effect of v3 work.

Only two kinds of change belong on `main` while v3 is in flight:

1. a refreshed `v3/` preview directory,
2. a fix to the current release that is wanted live now.

If a change does not clearly fall into one of those, it belongs on the v3 branch.

## Where the work lives

| | Purpose |
|---|---|
| `main` | the live site, plus the generated `v3/` preview |
| `revised-mockup-v3` | the v3 development line, and the source the preview is built from |

The branch is deliberately not called `v3`: `main` contains a directory of that
name, and git then refuses commands like `git log v3` and `git diff v3` as
ambiguous between a revision and a path.
| short-lived branches off the v3 line | individual pieces of v3 work, merged back into it |

The v3 branch is **not** redundant with the published preview. The preview is a
copy of the runtime files only — no tests, no docs, no build scripts. The branch
is where the test suite, the documentation and the data-build scripts live, and
it is what eventually merges to the root. Losing it would mean losing all of
that.

## Refreshing the preview

```
node scripts/publish-preview.cjs origin/revised-mockup-v3 v3
```

Then open a small PR to `main` containing only the `v3/` change. The directory
is rebuilt from scratch, so it cannot drift from the branch.

**Never edit inside `v3/`.** It is generated. Change the branch, re-run the
script. `v3/PREVIEW.txt` records which commit the copy came from.

The script makes two deliberate edits to the copy: a `PREVIEW BUILD` marker in
the prototype bar, and a namespaced `localStorage` facade. The second is not
cosmetic — GitHub Pages serves the preview and the live site from one origin,
`localStorage` is scoped per origin rather than per path, and both versions use
the same keys. Without the facade, approving a client target on the preview
would change what the live site shows.

## When v3 is approved

1. Merge the v3 branch into `main`. The root site becomes v3 on merge.
2. Remove the `v3/` directory in a follow-up PR; it has done its job.
3. Delete the v3 branch.

Do none of this before sign-off.

## Verification expected of any change

- `node --test tests/*.test.cjs` passes.
- The app is exercised in a real browser, not only in the test harness. Several
  defects here were invisible to the unit tests and only appeared on a click
  through: a lens key that no longer resolved, a tab that routed to an area
  which had been removed. Walk the pages a change touches at a desktop width and
  at 390px.
- Serve over HTTP. The app fetches its JSON, so `file://` will not work.

```
python3 -m http.server 8777 --bind 127.0.0.1
```

## House style

- Data belongs in JSON built by a script in `scripts/`, not hand-edited. The
  scripts are re-runnable and record the source file and its hash.
- Illustrative numbers are labelled as illustrative. This prototype states that
  it does not place trades, has no live pricing and offers no tax advice; keep
  it that way.
- Say what is missing rather than inventing it. ISIN and current price are blank
  because no source supplies them, and a fabricated ISIN is worse than an empty
  one.
- When a change is deferred or deliberately not taken from the source mockup,
  record the decision and the reason in `docs/`, so the next person does not
  have to rediscover it.

## Storage keys

Changing the shape of securities, the allocation hierarchy or the model vectors
invalidates saved records. Bump the storage key rather than reinterpreting old
data, and leave the previous key in place so earlier work stays readable in the
audit log.
