# Financial planning

New in the revised mockup. Two surfaces on the portfolio workspace:
**1 Assets & liabilities** and the planning half of **4 Cash & planning**.

## Why it sits at household level

Income, liabilities and recurring needs belong to a family, not to an account.
Every account in a household draws on the same salary and the same school fees,
so the plan is held once per household. An account shows its household's plan
and says so, and an edit made from one account applies to the whole household.

`data/financial-plans.json` holds the six plans, built by
`scripts/build-financial-plans.cjs` from the revised wireframe. Edits are kept in
the browser under `portfolio-financial-plans-v1`.

## What each surface answers

**Assets & liabilities** — what the household owns and owes today. Assets by
liquidity band with an expected settlement time per instrument type; liabilities
with the interest still to pay and the month each ends; net worth and debt to
assets; a twelve-month cash-flow projection; and yearly expenses by category
with a five-year inflated view.

The cash-flow chart runs from the start of the financial year and keeps periodic
bills in the month they fall. A monthly average would hide that one month
carries insurance, school fees and property tax together — which is exactly the
month a client finds themselves short.

**Cash & planning** — the plan behind the cash events. Income and assumptions,
planning flags, the long projection, a contingency cash raise, a recurring
investment plan, and the registers for liabilities and recurring needs.

## The calculations

`financial-plan.js` holds them, as pure functions. Nothing there touches the
DOM, localStorage, an approved client target or a recorded holding — a test
asserts that.

- **Projection.** An annual roll-up over 30 years: the investable portfolio
  grows, income arrives while it lasts, debt service and needs are drawn against
  it. The first year the balance turns negative is the funding gap. Locked
  assets — EPF, AIF, real estate — are excluded, so the real position is
  stronger than the line suggests.
- **Return.** Blended from what is actually investable, weighted by asset class.
  A household may state one assumption instead.
- **Emergency buffer.** Six months of commitments, measured against deposits and
  bonds only. Counting equity would assume it can be sold at a good price in the
  month it is needed, which is when it usually cannot.
- **Contingency raise.** Cheapest first by the estimated tax and exit penalty on
  each holding's gain, then fastest to settle. Locked assets are never used. The
  estimate ignores the long-term exemption and loss set-off, so the real cost is
  usually lower, and a shortfall is reported rather than papered over.
- **Recurring investment.** The monthly surplus is directed at the asset classes
  furthest below the approved client target. A plan, not an instruction: nothing
  is bought until it goes through Gap summary and trades.

## Planning flags

Funding gap · six-month emergency buffer · EMI to income above 40% · a liability
costing more than debt holdings earn, where prepaying may beat holding · no
insurance premium recorded · a shortfall in the next twelve months, with a
one-click hand-off into the cash-raise form.

## Goals

A recurring need carries a start year, a duration and its own inflation rate, so
a goal is recorded the same way as a running cost: school fees beginning in
three years and lasting four have the same shape as household expenses that run
throughout. That retires the "Goals: not supplied" placeholder — a goal now has
somewhere real to live.

## Limits

Every figure is illustrative. The projection is an annual roll-up, not a
cash-flow engine; it assumes a constant return and takes no view on sequence
risk, tax on the growth itself, or anything stochastic. Tax and penalty costs
reuse the prototype's placeholder rates. None of it is advice, and nothing here
places a trade.

## Tabs

The workspace now opens on Assets & liabilities, and Cash events is renamed Cash
& planning for what it also holds. That makes seven tabs for the moment; the
next phase folds Exposure drift into Allocation, which brings it back to six.

## On the Portfolios overview

The list carries a financial-plan column beside the drift bar. Drift answers
whether a portfolio is still shaped the way the client agreed; it says nothing
about whether the family can afford what they are committed to, and a portfolio
can sit perfectly on model while running out of money in year five. The two
belong side by side so neither is read alone.

A household row states its own position. An account row reports its household's
and names it, because the plan is not the account's to own.

The filter beside it now selects a model rather than a risk label. With three
models named after risk profiles the two are nearly the same; with the seven
models coming, the model is the sharper filter, and the risk profile each model
is intended for stays visible in the row.

The Core / Satellite lens is gone. Every security lost its custom tag when the
revised classification landed, so the lens could only report one meaningless
bucket covering the whole portfolio.
