# Tariff Simulator — Real-World Client Scenario Library

Human-readable companion to `regression_suite.js` (checks C21–C43). Not part of
the deployed site — this is a standalone reference for reviewing, by eye,
every real client journey the regression suite locks in: Product → HS code →
Origin → Tariff treatment → Province → Tax → Frequency → Final result.

Re-generate/update this file whenever the scenario checks in
`regression_suite.js` change. Each entry below names the regression check(s)
it corresponds to, so a failing check can be traced back to the scenario that
motivated it.

---

## Full client journeys (Section C21–C42)

### 1. US wooden office desks → Ontario, commercial
- **Check:** C21
- **Product:** Wooden office desks
- **HS code:** 9403.30.00.10
- **Origin:** United States of America
- **Province:** Ontario
- **Value:** $25,000 (commercial)
- **Why it matters:** MFN is already Free for this code. The tool must not
  invent a US/CUSMA claim when none is needed, and must clearly explain why
  the provincial tax portion isn't collected at the border for a commercial
  import.
- **Verified result:** Tariff treatment shows plainly as "MFN (no
  preferential treaty)". Total lands at $26,250 ($25,000 + 5% GST). UI text
  explicitly states the provincial portion is self-assessed.

### 2. Vietnam kitchen cabinets → British Columbia, commercial
- **Check:** C23
- **Product:** Kitchen cabinets
- **HS code:** 9403.40.00.10
- **Origin:** Vietnam
- **Province:** British Columbia
- **Value:** $40,000 (commercial)
- **Why it matters:** Contrasts with Scenario 1 — here a real treaty
  (CPTPP) does apply, and the UI must visibly distinguish "Preferential"
  from plain "MFN" rather than treating both the same.
- **Verified result:** Duty resolves to zero via CPTPT. Total is $42,000
  ($40,000 + 5% GST). Treatment is labeled "Preferential (CPTPT)".

### 3. China charcoal → Quebec, commercial
- **Check:** C24
- **Product:** Wood charcoal
- **HS code:** 4402.10.90.00
- **Origin:** China
- **Province:** Quebec
- **Value:** $5,000 (commercial)
- **Why it matters:** Contrast case with Scenarios 1–2 (Ontario/BC) —
  confirms Quebec's QST-bearing tax regime still renders the goods-tax
  section correctly for a commercial shipment.
- **Verified result:** Goods tax section renders correctly (GST, since
  commercial imports are GST-only regardless of province).

### 4. Mexico auto parts → Manitoba
- **Check:** C25
- **Product:** Auto parts
- **HS code:** 8708.99.99.99
- **Origin:** Mexico
- **Province:** Manitoba
- **Value:** $12,000
- **Why it matters:** Paired with Scenario 5 — same exact product code,
  different origin, to prove the treaty resolver picks the correct treaty
  per-origin rather than caching a result across queries.
- **Verified result:** Duty resolves to zero via MXT (CUSMA).

### 5. Japan auto parts → Saskatchewan
- **Check:** C26
- **Product:** Auto parts (same code as Scenario 4)
- **HS code:** 8708.99.99.99
- **Origin:** Japan
- **Province:** Saskatchewan
- **Value:** $12,000
- **Why it matters:** See Scenario 4 — the direct contrast case.
- **Verified result:** Duty resolves to zero via CPTPT (CPTPP), not MXT.

### 6. Germany refrigeration equipment → Nova Scotia
- **Check:** C27
- **Product:** Refrigeration/compressor equipment
- **HS code:** 8418.29.00.00
- **Origin:** Germany
- **Province:** Nova Scotia
- **Value:** $15,000
- **Why it matters:** Confirms CETA resolves correctly by name.
- **Verified result:** Duty resolves to zero via CEUT (CETA).

### 7. UK marine engines → New Brunswick
- **Check:** C28
- **Product:** Marine propulsion engines
- **HS code:** 8407.29.20.00
- **Origin:** United Kingdom
- **Province:** New Brunswick
- **Value:** $9,000
- **Why it matters:** Confirms CUFTA (the UK's post-Brexit standalone deal
  with Canada) resolves correctly and independently of CETA.
- **Verified result:** Duty resolves to zero via UKT (CUFTA).

### 8. Chile compressors → Prince Edward Island
- **Check:** C29
- **Product:** Compressors
- **HS code:** 8418.50.10.00
- **Origin:** Chile
- **Province:** Prince Edward Island
- **Value:** $7,000
- **Why it matters:** Chile holds dual membership (Canada-Chile FTA and
  CPTPP) — confirms that overlap still resolves cleanly to duty-free rather
  than confusing the resolver.
- **Verified result:** Duty resolves to zero.

### 9. South Korea refrigeration equipment → Newfoundland and Labrador
- **Check:** C30
- **Product:** Refrigeration/compressor equipment (same family as Scenario 6)
- **HS code:** 8418.29.00.00
- **Origin:** South Korea
- **Province:** Newfoundland and Labrador
- **Value:** $11,000
- **Why it matters:** Confirms CKFTA (Canada-Korea FTA) resolves correctly
  by name.
- **Verified result:** Duty resolves to zero via KRT (CKFTA).

### 10. Bangladesh t-shirts → Ontario, personal
- **Check:** C31
- **Product:** Cotton t-shirts
- **HS code:** 6109.10.00.12
- **Origin:** Bangladesh
- **Province:** Ontario (personal import)
- **Value:** $3,000
- **Why it matters:** Part of a three-origin trio (10–12) on the identical
  product/code — the clearest demonstration that treaty resolution does
  real, origin-specific work instead of a flat lookup. Bangladesh is an LDC.
- **Verified result:** Duty resolves to zero via LDCT (full LDC relief).

### 11. India t-shirts → Ontario, personal
- **Check:** C32
- **Product:** Cotton t-shirts (same code as Scenario 10)
- **HS code:** 6109.10.00.12
- **Origin:** India
- **Province:** Ontario (personal import)
- **Value:** $3,000
- **Why it matters:** India has no applicable treaty — this is the "no
  relief" leg of the trio.
- **Verified result:** Plain MFN duty at 18%, no relief claimed.

### 12. El Salvador wool sweaters → Ontario, personal
- **Check:** C33
- **Product:** Wool sweaters
- **HS code:** 6110.11.10.00
- **Origin:** El Salvador
- **Province:** Ontario (personal import)
- **Value:** $4,000
- **Why it matters:** The "partial relief" leg of the trio — GPT knocks the
  rate down but doesn't zero it out, proving the resolver isn't just
  binary free/not-free.
- **Verified result:** Duty of $640 (18% → 16% under GPT), not zero and not
  full MFN.

### 13. US steel pipe → Ontario
- **Check:** C34
- **Product:** Steel pipe
- **HS code:** 7304.19.00.14
- **Origin:** United States of America
- **Province:** Ontario
- **Value:** $20,000
- **Why it matters:** CUSMA duty relief and the steel surtax are
  independent mechanisms — this confirms both apply together correctly
  (same pattern as the aluminum case in C18, different heading).
- **Verified result:** Duty is zero via CUSMA, but the 25% surtax still
  applies in full. Total: $26,250 ($20,000 + $5,000 surtax + 5% GST on the
  surtax-inclusive value).

### 14. China cast iron soil pipe → Ontario
- **Check:** C35
- **Product:** Cast iron soil pipe
- **HS code:** 7303.00.00.10
- **Origin:** China
- **Province:** Ontario
- **Value:** $8,000
- **Why it matters:** Unlike Scenario 13 (and the earlier aluminum
  extrusions case), this SIMA finding has no surtax overlap — confirms
  SIMA renders correctly standing alone.
- **Verified result:** SIMA warning displays; no surtax card is present.

### 15. China broilers, over-access → Ontario
- **Check:** C36a
- **Product:** Broiler chickens (TRQ over-access tier)
- **HS code:** 0105.11.22.00
- **Origin:** China
- **Province:** Ontario
- **Value:** $2,000
- **Why it matters:** Paired with Scenario 16 to show both ends of a TRQ
  (tariff-rate quota) structure side by side. The over-access rate is a
  compound rate ("238% but not less than 30.8¢/each") which the tool must
  never silently guess a dollar figure for.
- **Verified result:** Duty shown as zero with an explicit "per unit"
  disclosure — never a guessed compound-rate dollar amount.

### 16. US broilers, within-access → Ontario
- **Check:** C36b
- **Product:** Broiler chickens (TRQ within-access tier)
- **HS code:** 0105.11.21.00
- **Origin:** United States of America
- **Province:** Ontario
- **Value:** $2,000
- **Why it matters:** See Scenario 15 — the duty-free contrast case.
- **Verified result:** Duty resolves to zero (within-access relief).

### 17. China t-shirts → Yukon, personal
- **Check:** C37a
- **Product:** Cotton t-shirts
- **HS code:** 6109.10.00.12
- **Origin:** China
- **Province:** Yukon (personal import)
- **Value:** $800
- **Why it matters:** Confirms a territory (GST-only, no PST/QST/HST
  equivalent) computes correctly, not just the four most-tested provinces.
- **Verified result:** Total matches hand-calculated 18% duty + 5% GST on
  the duty-paid value.

### 18. China smartphones → Northwest Territories, personal
- **Check:** C37b
- **Product:** Smartphones
- **HS code:** 8517.13.00.00
- **Origin:** China
- **Province:** Northwest Territories (personal import)
- **Value:** $1,500
- **Why it matters:** A second territory case, and a 100%-Free MFN product,
  confirming both work together correctly.
- **Verified result:** Duty is zero; total is $1,575 (value + 5% GST only).

### 19. France aircraft parts → Quebec
- **Check:** C39
- **Product:** Aircraft parts (Chapter 88 — a wholly duty-free chapter)
- **HS code:** 8807.30.00.00
- **Origin:** France
- **Province:** Quebec
- **Value:** $50,000
- **Why it matters:** Confirms the 100%-Free-chapter rule holds at a large,
  realistic commercial value, not just small test amounts.
- **Verified result:** Duty resolves to zero.

### 20. Germany charcoal → Ontario, weekly frequency
- **Check:** C40
- **Product:** Wood charcoal
- **HS code:** 4402.10.90.00
- **Origin:** Germany
- **Province:** Ontario
- **Value:** $2,000 per shipment
- **Frequency:** Weekly
- **Why it matters:** Confirms recurring-shipment frequency normalizes to a
  correct annual projection rather than showing a raw "/week" figure.
- **Verified result:** Annual projection matches the hand-calculated
  $109,200/yr ($2,000 × 1.05 × 52 weeks).

### 21. Vietnam kitchen cabinets → British Columbia, one-time vs. account setup
- **Check:** C41
- **Product:** Kitchen cabinets (same product as Scenario 2, larger value)
- **HS code:** 9403.40.00.10
- **Origin:** Vietnam
- **Province:** British Columbia
- **Value:** $15,000
- **Why it matters:** Confirms the Account Setup Fee / Bond Fee toggle is
  correct at a realistic mid-size commercial value, not just the smaller
  values used in the original fee-toggle checks.
- **Verified result:** One-time shipment: both fees are zero. Account
  setup: Account Setup Fee is $100 and Bond Fee is correctly non-zero.

### 22. Vietnam kitchen cabinets → BC / Ontario / Quebec, side by side
- **Check:** C42
- **Product:** Kitchen cabinets (same product as Scenarios 2 and 21)
- **HS code:** 9403.40.00.10
- **Origin:** Vietnam
- **Provinces:** British Columbia, Ontario, Quebec (all three, same run)
- **Value:** $20,000 (commercial)
- **Why it matters:** Proves the commercial-import tax rule (GST-only,
  provincial portion self-assessed) is genuinely province-independent, not
  accidentally varying by province.
- **Verified result:** All three provinces compute an identical 5%
  GST-only tax on the same value.

---

## Search-quality scenarios (no province/value journey — direct search checks)

### 23. Air compressor description variations
- **Checks:** C22, C38
- **Why it matters:** Real client intake often describes the same general
  product ("compressor") with varying specificity. The search must
  distinguish portable/stationary and reciprocating/rotary when the
  description supports it, and show real options (not guess) when it's
  genuinely ambiguous.
- **Verified result:**
  - "portable reciprocating air compressor" → exact code 8414.80.90.71
  - "portable rotary air compressor" → exact code 8414.80.90.72
  - "industrial air compressor" → surfaces the correct stationary-compressor
    codes (the `"industrial":["stationary"]` synonym fix, added this pass)
  - "compressor" alone → shows 2+ real suggested options rather than
    guessing one

### 24. Search leaf-ranking bug — sofas and industrial compressors
- **Check:** C43
- **Why it matters:** Found via a real user report. Two unrelated raw-
  material/hardware codes were outranking the actual product codes a
  client was searching for, because each code's long "exempted downstream
  uses" text was being scored as if it were the specific product:
  - Searching "sofa" ranked a raw polyester fibre code (5503.20.00.19)
    above the real upholstered-seat codes, because that code's leaf
    segment is a long parenthetical listing every duty-exempt use,
    including "manufacture of upholstered furniture."
  - Searching "industrial air compressor" similarly risked ranking a
    steel-hardware exemption code (7326.90-family) above the real
    compressor codes, via a plain semicolon-separated (non-parenthetical)
    exemption list mentioning "air compressor tanks" in passing.
- **Verified result:** "sofa" now correctly ranks real seat codes
  (9401.x) ahead of the raw-material code. "industrial air compressor"
  now correctly ranks a real stationary-compressor code (8414.80.90.4x)
  first. Earlier fixes (whole-word matching, aluminum windows, hat/table/
  pen boundaries) show no regression.

---

## Summary

- **22** full client journeys (Product → HS → Origin → Province → Tax →
  Frequency → Result), spanning:
  - **9 distinct trade agreements**, each resolving correctly by name:
    CUSMA (MXT/UST), CPTPP (CPTPT), CETA (CEUT), CUFTA (UKT),
    Canada-Chile FTA, CKFTA (KRT), LDCT, GPT, and plain MFN as the
    no-treaty baseline
  - All **13 provinces/territories** exercised across the full suite
    (see also Section C13 for the dedicated province sweep)
  - All **three trade-measure types** — SIMA, surtax, and safeguard —
    both independently and layered with treaty relief
  - **TRQ within-access vs. over-access** contrast on the same product
    family
  - **Fee-schedule and frequency** edge cases (entry-fee tiers, account
    setup vs. one-time, weekly→annual projection)
- **2 search-quality scenario groups** covering ambiguous free-text
  search and the leaf-ranking bug fix, including the "industrial" synonym
  addition from this pass

Every scenario above is enforced by an automated check in
`regression_suite.js` (checks C21–C43). Run `node regression_suite.js`
after any change to `data.js` or `client.html` to confirm none of these
have regressed.
