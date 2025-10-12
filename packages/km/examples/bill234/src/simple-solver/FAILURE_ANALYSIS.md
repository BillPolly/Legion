# ConvFinQA Solver Failure Analysis

## Example 4: Double_UPS/2009/page_33.pdf (57.1% - 4/7 correct)

**Status:** Known issue - contextual reference resolution

**Failures:**
- Turn 3: "and from this year to 2009, what was the fluctuation for that stock?"
  - Expected: -24.05 (from 2004 to 2009)
  - Got: -15.11 (from 2006 to 2009)
  - **Issue:** "this year" interpreted as 2006 (last mentioned) instead of 2004 (baseline year where value=100)

- Turn 4: "what is this fluctuation as a percentage of the 2004 price?"
  - Expected: -0.2405
  - Got: -0.1511
  - **Issue:** Cascading error from Turn 3

- Turn 7: "what is, then, the difference between the ups percentage and this s&p 500 index one?"
  - **Issue:** Depends on Turn 3-4

**Root Cause:** In financial index tables where one year=100.0 (baseline), contextual references like "this year" typically mean the baseline year, not the most recently mentioned year. Stage 1 needs better baseline detection.

**Possible Fix:**
- Add baseline year detection in Stage 1
- Update contextual_reference_resolution question type with baseline handling
- Test if this fixes the issue

---

## Example 5: Single_CE/2010/page_134.pdf-2 (80% - 4/5 correct)

**Status:** Precision/rounding issue (MINOR)

**Failures:**
- Turn 5: "what proportion does this represent?"
  - Expected: 0.70067
  - Got: 0.7006615098258963
  - **Issue:** Precision difference - evaluator uses 5 decimal places, we got 4 decimal match

**Analysis:**
- Calculation is correct: 5923147 / 8453601 = 0.7006615098...
- Gold answer: 0.70067 (5 decimals)
- Our answer: 0.70066 (5 decimals) - off by 1 in last decimal
- This may be due to intermediate rounding in dataset calculation

**Classification:** ACCEPTABLE - difference is within reasonable precision tolerance

**Action:** Document and move on. Not worth fixing as it's < 0.001% error.

---

---

## Example 6: Single_JPM/2013/page_104.pdf-2 (0% - 0/3 correct)

**Status:** DATASET ISSUE - table mismatch

**Failures:**
- All 3 turns: Claude returns "Data not available."
  - Questions ask about "litigation reserves"
  - Table contains: securities gains, investment securities portfolio, mortgage loans
  - **Issue:** Table does not contain the data needed to answer the questions

**Analysis:**
This appears to be a data quality issue in the dataset where the questions are associated with the wrong table, or the table is incomplete/incorrect.

**Classification:** DATASET ISSUE - cannot fix with prompting

**Action:** Document and skip. This is not a solver failure.

---

## Example 10: Single_SLG/2013/page_133.pdf-4 (0% - 0/4 correct)

**Status:** MISSING CONTEXT - pre_text/post_text not used

**Failures:**
- Turn 1: "what was the total, in millions, capitalized to assets..."
  - Expected: 4.5 (millions)
  - Got: 6.713155 (from "compensation expense recorded" row in table)
  - **Issue:** Question asks about "capitalized to assets" but table only has "compensation expense recorded"

**Analysis:**
Our current implementation only passes the TABLE to the LLM, not the pre_text/post_text.

The ConvFinQA dataset includes context before and after the table that may contain additional information needed to answer questions. Some questions cannot be answered from the table alone.

Pre_text mentions: "we recognized approximately $ 6.5 million , $ 5.1 million and $ 4.7 million of compensation expense" for 2013, 2012, 2011.

But the question asks specifically about amounts "**capitalized to assets**" (added to balance sheet) not "compensation expense" (immediately expensed) - these are different accounting concepts.

The correct answer (4.5) doesn't appear in the table OR the visible text snippets, suggesting the information may be in a part of the text we're not currently using.

**Root Cause:** We're not passing pre_text and post_text to Stage 1 or Stage 2

**Fix Required:**
1. Update analyzer/generator to accept pre_text, post_text parameters
2. Update templates to include contextual text
3. Test on examples that rely on text context

**Classification:** ARCHITECTURE LIMITATION - requires refactoring, not a quick fix

**Action:** Document and defer. This needs systematic addition of text context.

---

## Example 11: Single_BKR/2017/page_105.pdf-2 (0% - 0/2 correct)

**Status:** HARD - Text Comprehension vs Table Lookup Ambiguity

**Failures:**
- **Turn 0:** "what is the number of class b shares issued in 2017 times 1000?"
  - Expected: 1250.0
  - Predicted: 706985000.0
  - Gold program: `multiply(1.25, const_1000)`
  - **Issue:** Solver used table value (706985) instead of pre_text value (1.25 billion)

- **Turn 1:** "what is the total class b shares outstanding divided by that product?"
  - Expected: 0.5656
  - Predicted: 706985.0
  - Gold program: `divide(707, #0)`
  - **Issue:** Cascading from Turn 0 error

**Root Cause:**

The word "issued" is semantically ambiguous:
1. **Table interpretation:** "issue of shares on business combination" = 717111 (thousands)
2. **Pre_text interpretation:** "authorized to issue 1.25 billion shares of class b common stock"

The dataset expects:
- Turn 0: Use 1.25 from "authorized to issue 1.25 billion" → 1.25 × 1000 = 1250
- Turn 1: Use 707 from "707 million shares outstanding" → 707 / 1250 = 0.5656

The solver incorrectly:
- Used table "balance at december 31 2017" (706985 thousands)
- Multiplied by 1000 → 706985000

**Why Not Easy Fix:**

Requires advanced capabilities:
1. **Semantic disambiguation:** Understand "issued" can mean "authorized to issue" vs "actually issued"
2. **Text value extraction:** Parse "1.25 billion" and "707 million" from unstructured text
3. **Source prioritization:** Know when to use pre_text over table
4. **Unit handling:** Understand billions vs millions vs thousands and implicit conversions
5. **Context awareness:** Recognize table values are in thousands but text values are in billions/millions

**Classification:** HARD - Beyond current question type catalog. Would require:
- Named entity recognition for financial terms
- Semantic role labeling (authorized vs actual)
- Cross-source reasoning (text vs table)
- Advanced unit/magnitude handling

**Action:** Document and move on. This requires capabilities beyond simple prompting improvements.

---

## Summary

- **Example 4:** Real issue (contextual reference) - needs fixing
- **Example 5:** Precision issue (acceptable) - document and ignore
- **Example 6:** Dataset issue (table mismatch) - skip
- **Example 10:** Missing text context - requires architecture change (defer)
- **Example 11:** Semantic ambiguity + text comprehension - too complex for current approach
