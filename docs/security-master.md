# Security master

## Where the data comes from

Two sources, doing different jobs.

**`RIA-AssetConfig-Type1`** (the supplied workbook) defines the **shape**: nine
columns and, for each, whether it is the firm's decision or arrives from
somewhere else. The sheet holds no instrument rows at all.

| Column | Sheet marker | Meaning |
|---|---|---|
| Name | `<<Autocomplete>>` | looked up from an instrument source |
| ISIN | `<<Autocomplete>>` | looked up from an instrument source |
| Symbol | `<<Fixed>>` | arrives with the instrument |
| Crisil Rating | `<<Fixed>>` | arrives with the instrument |
| Current Price | `<<Fixed>>` | arrives from a price feed |
| AssetType | `<<Fixed>>` | the instrument's form |
| Asset Class | `<<DropDown>>` | **the firm decides** |
| Sector | `<<DropDown>>` | **the firm decides** |
| Sub-sector | `<<DropDown>>` | **the firm decides** |

**`Portfolio Console – wireframes v3.html`** supplies the **values**: 31
instruments with an explicit instrument type, a four-level classification and a
set of attributes per type.

`scripts/build-security-master.cjs` reads the wireframe and writes
`data/security-master.json` in the sheet's column order.
`scripts/apply-security-master.cjs` then rewrites the app dataset's securities,
allocation hierarchy and model target vectors to agree with it. Both are
re-runnable; neither touches recorded holdings.

## Super sector

The revised mockup adds a level between Asset Class and Sector, so the firm's
classification is four levels deep:

```
Asset class  ›  Super sector  ›  Sector  ›  Sub-sector
Equity       ›  Cyclical      ›  Financials  ›  Private banks
Fixed income ›  Credit        ›  Corporate bonds  ›  AAA rated
```

The levels nest. Each dropdown offers only what belongs under the level above,
and choosing a level clears any level beneath it that no longer belongs — shown
as an explicit staged change, not a silent edit.

## What is not supplied, and why it stays blank

**ISIN** and **Current Price** have no source. The workbook is a blank template
and the revised wireframe carries neither — searching it returns no occurrence
of either. They render as `—`.

They are not invented. An ISIN is a checksummed real-world identifier, so a
fabricated one can collide with a live security; a current price is market data
we have no feed for, and the prototype already discloses that.

**Symbol** is filled only where one real listed symbol is unambiguous — ten
instruments, verified against public listings:

`HDFCBANK` · `INFY` · `RELIANCE` · `BAJFINANCE` · `HINDUNILVR` · `SUNPHARMA` ·
`LT` · `NIFTYBEES` · `EMBASSY` · `IRBINVIT`

Mutual funds have no exchange symbol at all. "Motilal Midcap 150 ETF", "Silver
ETF" and "Sovereign Gold Bond 2028" are generic sample names that do not map to
one real listed product, so they stay blank rather than guess.

**Crisil Rating** is populated from the wireframe's credit rating, which exists
only for instrument types whose attribute set defines one. The grid distinguishes
the two absences: `n/a` where a rating cannot apply to the type at all, and
**Not rated** where the type carries one but the sample does not record it.

## How the attribute model changed

This is the substantive difference between the first mockup and the revised one.

**The first mockup gave every instrument the same flat attribute sheet** —
sector, sub-sector, market cap, geography, themes, Core/Satellite, credit
quality, duration, isDebt. Every instrument carried every field, so a fixed
deposit had a market cap of "Non-equity" and a geography. Filler, to keep the
shape rectangular.

**The revised mockup makes the instrument type decide which attributes exist**,
which is what the sheet's `AssetType <<Fixed>>` column already implied.

Removed:

- **Core / Satellite** — the renameable custom lens, dropped outright
- **isDebt** — a boolean, replaced by asset class = Fixed income
- **universal market cap and geography** — now carried only where they describe
  the instrument itself. Seven of 31 have them, all direct equity

Added:

- **AssetType**, explicit, 17 values. It used to be inferred from a grouping
  name, which produced invented labels like "Equity share" and "AIF unit", and
  could not tell a government bond from a corporate one
- **Super sector**
- **~40 type-specific fields**: coupon, maturity, yield and duration for bonds;
  expense ratio, benchmark and fund size for funds; lock-in, commitment, vintage
  and target return for AIFs; occupancy and distribution yield for REITs; purity
  and form for gold; rental yield and location for property

Kept: themes, fund look-through, credit rating (on a six-point scale), duration,
cost basis, illustrative tax rate, liquidity and the physical flag.

Of all this, only **AssetType** and **Crisil Rating** land in the sheet's nine
columns. The rest are shown on two surfaces the sheet does not define, described
next.

## Showing the attributes

A flat table cannot hold them: 17 types, 4.7 attributes each on average, and
**seven keys change meaning depending on the type** — `rating` is a credit
rating on a bond but an *issuer* rating on a deposit and *credit quality* on a
debt fund; `risk` is a risk rating on equity but the SEBI *risk-o-meter* on a
fund. A shared column would misstate them, so attributes always render through
their own type's schema.

**Row expansion** is the primary surface. Opening an instrument shows its
attributes, its fund look-through and its liquidity note. It works for any
instrument at any time and costs no horizontal space.

**Type-scoped columns** are the secondary one. Filtering to a single instrument
type appends that type's attributes as real columns, because comparison only
means anything within a type — a bond's yield against a fund's expense ratio is
noise. Seven of the 17 types hold two or more instruments, so the comparison is
worth having. Filtering also drops the now-constant Asset type column, and the
instrument name is pinned while the grid scrolls.

### Three tiers of ownership

Attributes are grouped by who can actually supply the value, because three
different parties own this data:

| Tier | Who owns it | Examples |
|---|---|---|
| **Source** | a market or provider feed | P/E, expense ratio, occupancy, tracking error |
| **Firm** | no feed supplies it, and one value is shared by every client who holds the instrument | AIF category and lock-in, PMS fee and minimum, deposit penalty, issuer rating |
| **Client** | the fact belongs to one client's holding, not to a shared instrument | this deposit's rate and maturity, this investor's AIF commitment and vintage, this flat's valuation, custody of a crypto holding |

Seventeen instruments are feed-backed; fourteen are not. The split matters
because the sample makes the problem visible: six households each "hold" one
flat in Pune and one EPF account. Those are client-specific objects sitting in a
firm-wide master.

**Everything is read-only for now, deliberately.** The client tier in particular
must not get a firm-wide edit box: editing it would change a value for every
client at once. Where those assets should live is an open question on the page.
The firm tier is the one that could reasonably become editable next, through the
staging and impact review that classification already uses.

### Valuation age

An attribute that records when something was last valued shows how old it is —
"valued 4 months ago", flagged past twelve. A valuation nobody has refreshed is
the quiet risk on an illiquid asset: a flat valued four years ago and one valued
last month look identical in a table, and an adviser quoting net worth off the
stale one has a real problem.

## Consequences outside this page

Adopting the revised classification is not confined to the configuration grid.

- Asset class **Debt** is renamed **Fixed income**.
- **Embassy REIT** and **IRB InvIT** move from Alternatives to **Real assets**.
  A REIT is a real asset; the first mockup had them under Alternatives. Every
  portfolio's asset-class mix shifts about 5–7 percentage points as a result,
  and so do drift and review flags.
- The allocation hierarchy's middle level is the instrument type, so "Bonds"
  splits into Government bond and Corporate bond.
- The **sector view** now reports at sector level for every holding. The revised
  look-through states a fund's sector weights without a sub-sector split, so
  reporting tagged holdings two levels deep and funds one would mix
  granularities in the same column. Sub-sector remains on this page and in the
  hierarchy view.
- In **Single tag** mode, a fund with no market cap or geography of its own falls
  back to its largest underlying bucket rather than reporting as unclassified.

## Instruments held and not held

The master carries 31 instruments; the sample portfolios hold the original 19.
The other twelve show **Not held**. That is a normal state for a firm master —
an instrument is classified before anyone buys it — and it keeps recorded
holdings, account values and total AUM (₹1,968 lakh) exactly as released.

Newly added instruments carry a 0% weight in every model, so each profile still
totals 100%.

## Storage

Securities, the hierarchy and the model vectors all changed shape, so records
seeded from the previous ones are reseeded rather than reinterpreted:
`portfolio-model-design-v3`, `portfolio-original-targets-v2` and
`portfolio-security-master-v2`. The earlier keys are left in place and stay
readable in the Audit log.
