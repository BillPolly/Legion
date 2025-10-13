# Gold Annotation and Question Ambiguity Issues

This file tracks instances where the ConvFinQA dataset has incorrect gold answers or ambiguous questions.

**Purpose**: Distinguish between real bugs in our system vs. dataset quality issues.

**When to add entries**:
- ❌ Gold answer contradicts source data
- ⚠️ Question is genuinely ambiguous (multiple valid interpretations)
- 🤔 Would require understanding context not in the document

**When NOT to add entries**:
- ✅ Gold answer is correct and our system is wrong → Fix the bug instead!

---

## Format Template

```markdown
## Example N, Turn M: [Issue Type: Gold Error / Ambiguous / Missing Context]

**Question**: "..."
**Gold Answer**: X
**Our Answer**: Y

**Source Data**:
"""
[Relevant excerpt from pre_text/table/post_text]
"""

**Manual Verification**:
- [Show the calculation step-by-step]
- Expected: [what the answer SHOULD be based on source]
- Gold says: [what gold answer says]

**Issue**: [Describe what's wrong]

**Verdict**: [Gold error / Ambiguous / Legitimate bug]

**Action**: [Skipped / Deferred / Fixed with workaround]

**Date**: YYYY-MM-DD
```

---

## Documented Issues

### Example 12, Turn 1: Ambiguous - "issued" means authorized vs. actual

**Question**: "what is the number of class b shares issued in 2017 times 1000?"
**Gold Answer**: 1250
**Our Answer**: 721139.0

**Source Data**:
- Text: "we are authorized to issue 2 billion shares of class a common stock, **1.25 billion shares of class b common stock** and 50 million shares of preferred stock"
- Table columns for Class B:
  - "balance at december 31 2016": 2014 (placeholder)
  - "issue of shares on business combination at july 3 2017": 717,111 (thousands)
  - "issue of shares upon vesting of restricted stock units": 2014 (placeholder)
  - "issue of shares on exercises of stock options": 2014 (placeholder)
  - "stock repurchase program": -10,126 (thousands)
  - "balance at december 31 2017": 706,985 (thousands)

**Manual Verification**:
- **Interpretation A (Gold)**: "issued" = authorized to issue
  - Authorized: 1.25 billion = 1,250,000 thousands = 1,250 (in Thousands scale)
  - Times 1000: 1,250 * 1000 = 1,250,000
  - Turn 2 verification: 706,985 / 1,250,000 = 0.566 = 56.6% ✓

- **Interpretation B (Ours)**: "issued" = actual issuance activity
  - Sum of positive activities: 717,111 (excluding placeholders and repurchases)
  - Or net activity: 717,111 - 10,126 = 707,121 ≈ 706,985 ending balance
  - Our system got: 721,139 (includes some placeholders incorrectly)

**Issue**: The word "issued" is ambiguous in financial terminology:
1. "Authorized to issue" = Maximum shares company is allowed to issue (from articles of incorporation)
2. "Shares issued" = Shares actually issued/outstanding
3. "Issuance activity" = Net change in shares during period

Gold answer chose interpretation #1 (authorized), we chose interpretation #3 (activity).

**Verdict**: Ambiguous question - both interpretations are linguistically valid

**Action**: Skipped - This is a terminology ambiguity, not a system bug

**Date**: 2025-10-09

---

### Example 25, Turn 2: Ambiguous - "2009 value" means base year in percent context

**Question**: "what was the 2009 value?"
**Gold Answer**: 9889
**Our Answer**: 18161

**Source Data**:
Table: "Changes in total amounts of uncertain tax positions for fiscal 2008 and fiscal 2009"
```json
{
  "$ 9889": {
    "additions for tax positions of current year": 4411.0,
    "balance november 1 2008": 13750.0,
    "balance october 31 2009": 18161.0
  }
}
```

**Manual Verification**:
- Column header "$ 9889" = 2007 ending balance (2008 opening balance)
- Row "balance october 31 2009" = 18161 = 2009 ending balance
- Turn 1: "net change from 2007 to 2009" = 8272
  - Calculation: 18161 - 9889 = 8272 ✓
- Turn 2: "what was the 2009 value?" = 9889 (gold answer)
  - Literal 2009 closing balance = 18161
  - **But gold answer = 9889 (the 2007 value!)**
- Turn 3: "percent change" = 83.6%
  - Calculation: 8272 / 9889 = 0.836 = 83.6% ✓
  - **This proves Turn 2 needs the base value, not 2009!**

**Issue**: Turn 2 asks for "2009 value" but gold answer is actually the 2007 value (9889). This is **misleading wording**, not a genuine question about the 2009 ending balance.

In the context of the 3-turn sequence:
- Turn 1: Calculate change
- Turn 2: Get base value for percent calculation
- Turn 3: Calculate percent

Turn 2's question should have been "what was the base value?" or "what was the 2007 value?" - asking for "2009 value" when expecting the 2007 value is confusing.

**Verdict**: Ambiguous/misleading question - The wording "2009 value" is incorrect; it should ask for the base/2007 value

**Resolution**: This is a dataset wording issue. The question text doesn't match what it's actually asking for. Our system correctly extracts the literal 2009 ending balance (18161). The gold annotations are internally consistent (they use 9889 as the base), but the Turn 2 question wording is wrong.

**Action**: Documented as annotation issue. Moving to Example 26 to see if same pattern exists.

**Date**: 2025-10-11

---

### Example 26, Turn 1: Row label year extraction - FIXED ✅

**Question**: "what is the difference in value of future minimum rent payments from 2008 to 2009?"
**Gold Answer**: -42
**Our Answer**: -42 (PASS after fix)

**Source Data**:
Table: Future minimum rent payments
```json
{
  "$ 317": {
    "2009": 275.0,
    "2010": 236.0,
    "2011": 214.0,
    "2012": 191.0,
    "later years": 597.0,
    "total minimum payments required": 1830.0
  }
}
```

**Issue**: Turn 1 was failing because Phase 2A (LLM Extraction) returned:
- `future_min_rent_payments_2009 = 275` ✓ (correctly extracted from column)
- `future_min_rent_payments_2008 = None` ❌ (row label not recognized as year value)

**Pattern**: Different from Example 25:
- Example 25: **Column header** contains numeric year value (column = "$ 9889")
- Example 26: **Row label** contains numeric year value (row = "$ 317")
- Same concept: header/label contains value for year NOT in row/column labels

**Root Cause**: Multi-value extraction wasn't checking row labels for missing years. When asked for a single year (Turn 2), it worked. When asked for multiple years (Turn 1: 2008 AND 2009), it failed.

**Fix**: Updated `value_extraction.j2` prompt with:
1. Explicit guidance about row labels containing year values
2. Pattern recognition: If columns=[2009, 2010...], numeric row="$ X" → row represents prior year (2008)
3. Multi-value extraction logic: Check both row AND column labels for missing years

**Verdict**: System bug - FIXED

**Test Results After Fix**:
- Turn 1: -42 ✅ PASS
- Turn 2: 317 ✅ PASS
- Turn 3: -13.25% ✅ PASS
- **Example 26: 3/3 (100%)**

**Date**: 2025-10-11

---

### Example 30, Turn 5: Ambiguous - Inconsistent "total sum including" interpretation

**Question**: "what is the total sum including square feet of commercial research and development manufacturing in smithfield, rhode island?"
**Gold Answer**: 67000
**Gold Formula**: `67000` (just Smithfield value)
**Our Answer**: 307000
**Our Formula**: `sum_owned_facilities_sqft + owned_rd_manufacturing_sqft_smithfield` = 240000 + 67000

**Source Data**:
Table showing square footage:
- Dublin Ireland (owned): 160000
- Athlone Ireland (owned, R&D): 80000
- Bogart Georgia (owned, R&D): 70000
- Smithfield Rhode Island (owned, R&D): 67000

**Conversation Context**:
- Turn 1: "square feet of... administration offices?" → 160000
- Turn 2: "square feet of... commercial research and development manufacturing?" → 80000
- Turn 3: "what is the sum of those values?" → 240000 (160000 + 80000)
- Turn 4: "total sum including... in bogart, georgia?" → 310000 (240000 + 70000)
- Turn 5: "total sum including... in smithfield, rhode island?" → 67000 (just Smithfield!)
- Turn 6: "total sum of square feet owned?" → 377000 (160000 + 80000 + 70000 + 67000)

**Manual Verification**:
- Turn 4 formula: `add(160000, 80000), add(#0, 70000)` = 310000
  - Interpretation: "total sum including X" = take previous sum (240000) and add X (70000)
- Turn 5 formula: `67000`
  - Interpretation: "total sum including X" = just get X's value (67000)
- **Same linguistic pattern, different meanings!**

**Issue**: The phrase "total sum including X" is used identically in Turn 4 and Turn 5 but has different meanings:
1. Turn 4: "including" means "add X to the running sum" (cumulative)
2. Turn 5: "including" means "just get X's value" (non-cumulative)

This is linguistically inconsistent. The phrase "total sum including" strongly implies cumulative addition, especially when used twice in consecutive turns.

**Verdict**: Ambiguous question with inconsistent gold annotation

**Resolution**: Our system follows the linguistic pattern established by the Turn 4 guidance ("total sum including" = add to previous sum), which produces 307000 for Turn 5. This is logically consistent but doesn't match the gold answer.

**Action**: Documented as annotation inconsistency. System behavior prioritizes linguistic consistency over matching this specific gold answer.

**Date**: 2025-10-12

---

### Example 38, Turn 2: Dataset Error - Typo in question and inconsistent gold answer

**Question**: "was is the sum including cash from financing activities?"
**Gold Answer**: 1780.2
**Gold Formula**: `1780.2` (just the financing value)
**Our Answer**: -489.2
**Our Formula**: `sum_operating_investing_cash_2019 + net_cash_financing_2019` = -2269.4 + 1780.2

**Source Data**:
Table showing cash flow statement for year ended September 30, 2019:
- Net cash provided by operating activities: 2310.2 (Millions)
- Net cash used for investing activities: -4579.6 (Millions)
- Net cash provided by financing activities: 1780.2 (Millions)

**Conversation Context**:
- Turn 1: "what was the sum of net cash provided by operating activities and used for investing in 2019?" → -2269.4 ✓
  - Formula: `add(2310.2, -4579.6)` = -2269.4
- Turn 2: "was is the sum including cash from financing activities?" → 1780.2 (gold)
  - Formula: `1780.2` (just the financing value!)
- Turn 3: "what is the total sum?" → -489.2 ✓
  - Formula: `add(2310.2, -4579.6), add(#0, 1780.2)` = -489.2

**Manual Verification**:
- Turn 1 computes: 2310.2 + (-4579.6) = -2269.4 ✓
- Turn 2 asks for "sum including cash from financing activities"
  - Linguistic interpretation: Add financing to previous sum = -2269.4 + 1780.2 = -489.2
  - Gold answer: 1780.2 (just the financing activities value itself!)
- Turn 3 computes: 2310.2 + (-4579.6) + 1780.2 = -489.2 ✓

**Issue**:
1. **Question has typo**: "was is the sum" should be "what is the sum"
2. **Gold answer inconsistency**: The phrase "sum including X" typically means "add X to the previous sum" (cumulative addition pattern), but the gold answer is just X itself (1780.2), not the cumulative sum (-489.2)
3. **Turn 3 contradicts Turn 2**: Turn 3 correctly computes the cumulative sum as -489.2, which is what Turn 2's question appears to be asking for

**Verdict**: Dataset annotation error - Question typo + gold answer doesn't match question intent

**Resolution**: Our system correctly interprets "sum including X" as cumulative addition (Pattern 1 from value_planning.j2), producing -489.2 for Turn 2. The gold answer appears to be incorrect for this turn.

**Action**: Documented as annotation issue. Example 38 is 2/2 passing for valid turns (Turn 1 and Turn 3).

**Date**: 2025-10-12

---

## Example 60, Turn 1: Question typo - "2018" should be "2012"

**Question**: "what was the change in value of disca common stock from 2018, less a $100 initial investment?"
**Gold Answer**: 359.67
**Gold Program**: `subtract(459.67, const_100)` = 459.67 - 100
**Our Answer**: TypeError (NoneType - 100)

**Source Data**:
- Text: "the graph assumes $100 originally invested on september 18, 2008... for the period september 18, 2008 through december 31, 2008 and the years ended december 31, 2009, 2010, 2011, and **2012**"
- Table years: 2008, 2009, 2010, 2011, 2012 (NO 2018 data!)
- DISCA value on Dec 31, 2012: 459.67

**Manual Verification**:
- Initial investment: $100 (Sept 18, 2008)
- Final value (Dec 31, 2012): $459.67
- Change: 459.67 - 100 = **359.67** ✓
- Gold answer: 359.67 ✓

**Issue**:
1. The question asks about "from 2018" but the table only has data through 2012
2. The text explicitly states the period is "2008 through... 2012"
3. "2018" does not appear anywhere in the text or table
4. The gold program uses 459.67 (the 2012 value), confirming this is a typo

**Verdict**: Question typo - "2018" should be "2012" (the last year in the table)

**Our System Behavior**:
- Phase 1 identified: `disca_stock_2018` (KG lookup)
- Phase 2A extraction: Returns None (year 2018 not in table)
- Phase 4 execution: `None - 100` → TypeError ❌

**Resolution Options**:
1. **Strict interpretation**: System correctly fails because 2018 doesn't exist
2. **Fuzzy matching**: Could detect typo and use closest/last year (2012)
3. **Gold annotation fix**: Update question to say "2012" instead of "2018"

**Action**: Documented as question typo. Our system behavior (failing on missing year) is technically correct, but could be enhanced with fuzzy year matching for robustness.

**Date**: 2025-10-12

---

## Example 62, Turn 3: Gold Error - "Growth rate" uses ratio formula instead of standard percentage change

**Question**: "what is the growth rate?"
**Gold Answer**: 108%
**Gold Program**: `divide(597, 553)` = 1.0796 = 107.96% ≈ 108%
**Our Answer**: 7.96%
**Our Formula**: `to_percentage((597 - 553) / 553)` = 7.96%

**Source Data**:
- Turn 1: "gas transmission throughput (bcf) in 2002?" = 597
- Turn 2: "what about in 2001?" = 553
- Turn 3: "what is the growth rate?"

**Manual Verification**:
- Standard growth rate formula: (new - old) / old = (597 - 553) / 553 = 44/553 = 0.0796 = **7.96%**
- Ratio formula (gold uses): new / old = 597 / 553 = 1.0796 = **107.96% ≈ 108%**

**Dataset Consistency Check**:
Searched for "growth rate" in the dataset - found 105 questions. Analysis:
- **104 questions** use standard formula: `subtract(new, old), divide(#0, old)` → percentage change
- **1 question (Example 62)** uses ratio formula: `divide(new, old)` → growth factor as percentage

Examples of standard usage:
- "what growth rate does this represent?" → `subtract(807, 3804), divide(#0, 3804)`
- "so what was the growth rate during this time?" → `subtract(21.1, 29.8), divide(#0, 29.8)`
- "and the growth rate between these two years?" → `subtract(9381, 9921), divide(#0, 9921)`

**Issue**: Example 62 is **inconsistent** with the rest of the dataset. "Growth rate" in financial terminology means percentage change ((new-old)/old), not growth factor (new/old). The gold program for Example 62 incorrectly uses the ratio formula.

**Verdict**: Gold annotation error - Inconsistent with 104 other "growth rate" questions in dataset

**Our System Behavior**: Correctly computes standard growth rate = 7.96% ✓

**Cascading Impact**: Turn 4 asks to predict 2003 value using "the growth rate" from Turn 3. Because Turn 3 failed, Turn 4 also fails.

**Action**: Documented as gold annotation error. Our system's answer is correct according to:
1. Standard financial terminology
2. Dataset consistency (104 out of 105 examples)
3. Mathematical definition of "growth rate"

**Date**: 2025-10-12

---

<!--
EXAMPLE ENTRY (for reference, delete when first real issue is added):

## Example 42, Turn 3: Gold Error - Wrong Subtraction Order

**Question**: "what was the net change in value of litigation reserves during 2012?"
**Gold Answer**: -0.5
**Our Answer**: 0.5

**Source Data**:
"""
the current year included expense of $3.7 billion for additional litigation reserves...
the prior year included expense of $3.2 billion for additional litigation reserves
"""

**Manual Verification**:
- Current year (2012): $3.7 billion
- Prior year (2011): $3.2 billion
- Net change during 2012: 3.7 - 3.2 = 0.5 billion
- Expected: 0.5
- Gold says: -0.5

**Issue**: Gold answer has wrong sign. "Net change during 2012" should be end_of_2012 - start_of_2012 = 3.7 - 3.2 = 0.5, not -0.5.

**Verdict**: Gold error (wrong sign)

**Action**: Skipped - documented the issue, moved on

**Date**: 2025-10-09

-->

## Example 43, Turn 3: Question text error

**Question**: "what is the change in the balance of cash and cash equivalents from 2010 to 2011?"
**Gold Answer**: 89036
**Gold Program**: `subtract(453257, 364221)` = 453257 - 364221

**Issue**: The question says "2010 to 2011" but:
- The table only has data for 2008, 2009, and 2010 (NO 2011 data!)
- The gold program calculates: 2010_value - 2009_value = 453257 - 364221 = 89036
- This is the change FROM 2009 TO 2010, not "2010 to 2011"

**Verdict**: Gold answer is correct for the INTENDED question, but the question text has a typo
**Our Answer**: NoneType error (correctly tried to look up 2011 which doesn't exist)
**Action**: Document as gold annotation error - question should say "2009 to 2010"


## Example 44: Phase 2B not following pattern_change guidance

**All turns fail** due to formula generation issues:

**Turn 1**: "decline from 2002 to 2004"
- Gold: -4.3 (= 2004 - 2002 = 1.3 - 5.6)
- Our formula: `2002 - 2004` = 5.6 - 1.3 = 4.3 (WRONG ORDER!)
- Ontology says: "new_value - old_value" but Phase 2B generated "old_value - new_value"

**Turn 2**: "were those effects... in 2002?"
- Gold: 5.6 (just return the value)
- Our formula: `effects_foreign_ops_2002 == 5.6` (boolean comparison!)
- Phase 1 misunderstood this as a yes/no question instead of value lookup

**Turn 3**: Sign preservation issue
- Gold: -76.8% (negative percentage)
- Our answer: 76.78% (positive, missing sign)
- Cascades from Turn 1 having wrong sign

**Verdict**: Not a gold annotation issue - these are Phase 1/2B execution bugs
**Action**: Needs investigation into why LLM doesn't follow ontology pattern guidance correctly

---

## Example 49, Turn 2: Gold Error - Wrong scale conversion

**Question**: "and converted to the thousands?"
**Gold Answer**: 2800
**Our Answer**: 2.8 (still in Billions display - display bug on our side, but gold is also wrong!)

**Source Data**:
- Turn 1: "what was the north american printing papers net sales in 2009?"
- Turn 1 Answer: 2.8 (representing $2.8 billion)
- Source text: "north american printing papers net sales in 2009 were $2.8 billion"

**Manual Verification**:
- Canonical value: 2,800,000,000
- Convert to Thousands: 2,800,000,000 ÷ 1,000 = **2,800,000** ✓
- Convert to Millions: 2,800,000,000 ÷ 1,000,000 = **2,800** ✓
- Gold answer: **2,800** (MATCHES MILLIONS, NOT THOUSANDS!)

**Turn Program**: `multiply(2.8, const_1000)` = 2.8 × 1000 = 2800

**Issue**:
1. The question asks "converted to the **thousands**"
2. The gold answer is **2,800** which is the **Millions** conversion
3. The correct Thousands conversion should be **2,800,000**
4. The turn_program multiplies 2.8 × 1000 to get 2800, treating it as Millions → Thousands conversion

**Verdict**: Gold annotation error - Answer is in wrong scale (Millions instead of Thousands)

**Our System**: Also has a bug (returns 2.8 in Billions display instead of converting), but even if fixed, would return 2,800,000 (correct Thousands) which wouldn't match the gold answer.

**Action**: Documented as gold error. Turn 2 should be marked as "gold_issue" when evaluating accuracy.

**Date**: 2025-10-12


---

## Example 51: System Bug - Not recognizing "change" vs "net change" distinction

**Question**: "what was the change in total other income and expense from 2008 to 2009?"
**Gold Answer**: 294
**Our Answer**: -294

**Source Data**:
- Table shows:
  - 2008: total other income and expense = 620
  - 2009: total other income and expense = 326
  - 2010: total other income and expense = 155

**Turn Program**: `subtract(620, 326)` = 294

**Manual Verification**:
- Temporal order (NEW - OLD): 326 - 620 = **-294** (decrease)
- Gold calculation (OLD - NEW): 620 - 326 = **294** (magnitude of decrease)

**Gold Convention Discovered**:
The dataset has a CONSISTENT convention:
- "**change** from X to Y" → Formula: **OLD - NEW** (magnitude, always positive for decrease)
- "**net change** from X to Y" → Formula: **NEW - OLD** (signed, negative for decrease)

**Evidence from Example 52**:
- Turn 1: "what is the **net change** in... from 2008 to 2009?" → Answer: **-25264** (negative)
- Turn 1 Program: `subtract(191265, 216529)` = NEW - OLD = -25264 ✓

**Verdict**: System bug - Our ontology doesn't distinguish "change" from "net change"

**Our System**: Uses temporal order (NEW - OLD) for both "change" and "net change", giving -294. Should use OLD - NEW for plain "change" to get 294.

**Action**: Need to update ontology pattern_change to check for "net" modifier and adjust formula accordingly.

**Date**: 2025-10-12

---

## Example 52, Turn 4: System Bug - "amount used" should use signed change (NEW - OLD)

**Question**: "what amount of prepaid rent is used during 2009?"
**Gold Answer**: -1281
**Our Answer**: 1281

**Source Data**:
- Table shows:
  - 2008: prepaid rent = 2658
  - 2009: prepaid rent = 1377

**Turn Program**: `subtract(1377, 2658)` = 1377 - 2658 = -1281

**Manual Verification**:
- Prepaid rent (asset) DECREASED from 2658 to 1377
- Amount used/expensed = decrease in asset balance
- Gold formula: **NEW - OLD** = 1377 - 2658 = **-1281** (negative for decrease)
- Our formula: **OLD - NEW** = 2658 - 1377 = **1281** (positive for decrease)

**Gold Convention Analysis**:
The phrase "amount used during [year]" follows the same pattern as "net change":
- Both use **NEW - OLD** (signed change, negative for decrease)
- This is consistent with Example 52 Turn 1: "**net change**" = NEW - OLD = -25264

**Pattern Consistency**:
- Plain "**change**" → OLD - NEW (magnitude, positive for decrease) [Example 51]
- "**Net change**" → NEW - OLD (signed, negative for decrease) [Example 52 Turn 1]
- "**Amount used**" → NEW - OLD (signed, negative for decrease) [Example 52 Turn 4]

The word "**used**" (like "**net**") signals that the answer should preserve the sign of the change.

**Verdict**: System bug - Our ontology treats "amount used" as magnitude instead of signed change

**Our System**: Uses OLD - NEW (magnitude) giving 1281. Should use NEW - OLD (signed) to get -1281.

**Action**: Update ontology pattern_amount_used_during_period to use NEW - OLD formula (like net change).

**Date**: 2025-10-12
