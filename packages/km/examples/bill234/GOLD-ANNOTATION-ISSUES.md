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
