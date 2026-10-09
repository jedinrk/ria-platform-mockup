# Models and the classification hierarchy

## The switch

The allocation tree used to be

```
Asset class > Instrument type > Security
Equity      > Mutual fund     > Parag Parikh Flexi Cap
```

which groups by the vehicle an instrument happens to be. It is now

```
Asset class > Super sector > Sector     > Sub-sector    > Security
Equity      > Cyclical     > Financials > Private banks > HDFC Bank
```

which groups by what it is exposed to. A firm sets policy on large-cap equity or
corporate credit, not on "ETFs", so the second is what a model should target.
The vehicle view has not been lost: instrument type is still a column on the
Security master and a tag you can filter a model by.

## Depth

A model stops at a depth chosen per asset class:

| Asset class | Modelled to |
|---|---|
| Equity | Sub-sector |
| Fixed income | Sector |
| Alternatives | Security |
| Real assets | Sector |

Below that depth a portfolio still lists what it holds, but there is no target.
That is **not** the same as a target of zero, and the allocation table says so:
a sub-sector the model deliberately sets to nothing reads `0`, while a holding
below the model's level reads *Not specified*.

Changing a depth re-projects every model and every portfolio adjustment, so it
is a firm decision rather than an edit. The page shows the current depth and
explains it; changing it is not offered yet.

## Seven models

Three by risk profile — Conservative, Moderate, Aggressive — and four by
strategy: Growth, Dividend reinvestment, Inflation hedge, Alternatives-led.

Each names the risk profile it is intended for, so choosing a model and
assessing a client's risk stay separate decisions. A strategy model does not
imply a risk assessment of its own: Growth is intended for an Aggressive
profile, Dividend reinvestment for a Moderate one.

Two households moved to a strategy model, as the revised mockup has them:
Shah & Sons to Dividend reinvestment, Rao Family to Growth.

## Targets and bands

Every node carries a target and a tolerance band. The children of a node always
add up to it, so editing one rescales what is under it and moves its siblings,
leaving the level above untouched. A model is therefore 100% by construction
rather than by arithmetic the adviser has to do.

That replaced the old "distribute proportionally or adjust manually" dialog.
With siblings absorbing the change there is one correct answer, so it is simply
applied.

The asset-class band is the portfolio's own review threshold, set per portfolio,
so it is not a model setting. Below that, the defaults are ±6 at super sector,
±4 at sector, ±3 at sub-sector and ±2 at security.

## Breaches replace lens flags

Review flags used to come from six independent exposure lenses, each comparing a
bucket against an implied target. They now come from the tree: a node outside
its band is a breach, and only the most specific one is reported, because a
sector outside its band *because* one sub-sector is outside its band is one
problem, not two.

The effect is substantial. On the sample, flags per household fell from 17–29 to
3–10. The lenses survive as read-only distributions on the review tab, which is
all they were ever reliable for.

## Tags

Each branch lists the attributes of the securities beneath it — instrument type,
theme, market cap, risk rating, credit rating, duration, liquidity, geography —
and selecting one filters the tree to the branches holding it. On a tree this
deep that is how you answer "where is the locked, sub-investment-grade money",
which reading 115 rows will not tell you.

A tag group is offered only where the securities actually differ. A filter that
cannot narrow anything is noise.

## The sample holdings

Holdings are generated from the model each account follows, as the revised
wireframe generates them:

```
raw[i]  = max(0.05, impliedTarget[i]) * max(0.05, 1 + spread * (noise * 2 - 1))
holding = raw[i] * accountAum / sum(raw)
```

so an account holds a deterministic spread around its own model, scaled to its
AUM. `scripts/apply-holdings.cjs` rebuilds them; the noise is seeded from the
account id, so the sample is reproducible rather than random.

The floor of 0.05 means every instrument is held at least slightly, including
ones the model allocates nothing to. Nothing in the master is orphaned.

**The joint account is exempt.** It carries the raw base vector rather than a
model spread, exactly as the wireframe has it, so there is always one portfolio
visibly off its model to review.

This was not always so. The holdings were materialized once against the first
mockup's models and carried through every migration since, while the models
moved on twice. A portfolio held one generation's weights and was measured
against another's, so all six households read *needs review* for a reason that
said more about our data than about the portfolio. Now:

| Household | Model | Drift | State |
|---|---|---|---|
| Mehta Family | Moderate | 6.7 pp | Needs review — asset class and sub-class |
| Kapoor Family | Aggressive | 3.8 pp | Needs review — sub-class only |
| Nair Household | Conservative | 3.5 pp | Within threshold |
| Shah & Sons | Dividend reinvestment | 2.0 pp | Within threshold |
| Iyer Household | Conservative | 1.1 pp | Within threshold |
| Rao Family | Growth | 0.6 pp | Within threshold |

Total AUM is ₹2,033 lakh, up from ₹1,968, because the joint account now carries
its full base vector.

## Storage

Securities, the hierarchy and the model vectors all changed shape, so records
seeded against the old ones are reseeded rather than reinterpreted:
`portfolio-model-design-v4` and `portfolio-original-targets-v3`. The previous
keys are left in place and stay readable in the Audit log.
