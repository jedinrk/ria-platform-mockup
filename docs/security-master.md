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
columns. The other attributes are stored on each security in
`data/security-master.json` and in the dataset, and are **not displayed** — the
grid is the sheet's layout. Showing them needs a surface the sheet does not
define, which is a separate design decision.

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
