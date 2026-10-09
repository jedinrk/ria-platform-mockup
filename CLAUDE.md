# Working rules for this repository

## The site

`https://jedinrk.github.io/ria-platform-mockup/` is served from `main` at `/`.
**Anything merged to `main` is published immediately, to whoever is looking at
it.** There is no staging step in front of it, so a change that is not ready to
be seen does not belong on `main`.

Work happens on short-lived branches off `main` and merges back by PR.

The revised-mockup (v3) line was merged into `main` in PR #15 and is now the
live release; its branch and its `/v3/` preview directory have both been
retired. `v3/index.html` survives only as a stub pointing at the root, because
the preview URL was shared while the work was in flight.

## If a preview is needed again

`scripts/publish-preview.cjs` is kept for exactly that. It copies a branch's
runtime files into a subdirectory of the site, so work in progress can be shown
without touching what is live at the root:

```
node scripts/publish-preview.cjs origin/<branch> <directory>
```

Two things it does are not cosmetic, and anything replacing it must do them too:

- **A `PREVIEW BUILD` marker** in the prototype bar, so nobody mistakes the copy
  for the live site.
- **A namespaced `localStorage` facade.** GitHub Pages serves every directory
  from one origin and `localStorage` is scoped per origin, not per path. Without
  the facade, approving a client target on a preview would change what the live
  site shows. Verify isolation in a browser before trusting it: write on one
  copy, confirm the other cannot see it, and confirm the reverse.

**Never edit inside a generated preview directory.** Change the branch and
re-run the script; the directory is rebuilt from scratch so it cannot drift.

Do not name a preview branch the same as its directory. `main` once held a
directory called `v3`, and git then refused `git log v3` and `git diff v3` as
ambiguous between a revision and a path.

## Verification expected of any change

- `node --test tests/*.test.cjs` passes.
- The app is exercised in a real browser, not only in the test harness. Several
  defects here were invisible to the unit tests and only appeared on a click
  through: a lens key that no longer resolved, a tab that routed to an area
  which had been removed, a filter control that stretched the column next to it.
  Walk the pages a change touches at a desktop width and at 390px.
- Serve over HTTP. The app fetches its JSON, so `file://` will not work.

```
python3 -m http.server 8777 --bind 127.0.0.1
```

- After publishing, confirm GitHub Pages itself rather than the repository.
  What is merged and what is being served are different questions, and the
  answer has differed before.

## House style

- Data belongs in JSON built by a script in `scripts/`, not hand-edited. The
  scripts are re-runnable and record the source file and its hash.
- Illustrative numbers are labelled as illustrative. This prototype states that
  it does not place trades, has no live pricing and offers no tax advice; keep
  it that way.
- Say what is missing rather than inventing it. ISIN and current price are blank
  because no source supplies them, and a fabricated ISIN is worse than an empty
  one.
- When a change is deferred or deliberately not taken from a source mockup,
  record the decision and the reason in `docs/`, so the next person does not
  have to rediscover it.

## Storage keys

Changing the shape of securities, the allocation hierarchy or the model vectors
invalidates saved records. Bump the storage key rather than reinterpreting old
data, and leave the previous key in place so earlier work stays readable in the
audit log.
