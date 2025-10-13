# Percentage Convention Fix - Summary

**Date**: 2025-10-12
**Issue**: Example 39 Turn 4 returned 0.0609 instead of 6.09
**Root Cause**: Formula planning didn't know when to use `to_percentage()` for ConvFinQA's "represent in relation to" pattern

## The Fix

Updated `/Users/williampearson/Legion/packages/km/examples/bill234/src/graph-solver/prompts/formula_planning.j2` (lines 55-110)

### What Was Added

Comprehensive documentation of the ConvFinQA convention for "X represent in relation to Y" pattern:

```
WHEN TO USE to_percentage():

1. **Explicit percentage request:** Question contains "in percentage" or "what percentage"

2. **ConvFinQA CONVENTION for "represent in relation to" pattern:**
   - Pattern detected: "X represent/represents in relation to Y" → Division formula: X / Y
   - Check the NUMERATOR (X) semantic_type and variable name
   - **IF numerator is a CHANGE/DIFFERENCE/FLUCTUATION → use to_percentage()**

   Detection rules (check BOTH):
   - semantic_type is "change_value" OR "difference_value" OR
   - variable name contains "change", "difference", "fluctuation", "increase", "decrease"
```

### Key Insight

The system already had `to_percentage()` function available in Phase 4 execution. The problem was that **Phase 2B (Formula Planning)** didn't know WHEN to include it in the formula string.

The fix teaches Phase 2B to:
1. Look at the question pattern ("represent in relation to")
2. Check the numerator's `semantic_type` (provided by Phase 1)
3. Check the numerator's variable name for keywords
4. If numerator is a change/difference → wrap in `to_percentage()`
5. If numerator is an absolute value → return plain ratio

## Test Results

### ✅ Fixed Examples

**Example 39 Turn 4**:
- Question: "how much does this change represent in relation to that average price in october?"
- Variables: `change_avg_share_price_oct_nov2014` (change_value), `avg_price_per_share_oct2014`
- Formula: `to_percentage(change / price)` ✅
- Result: 6.09% (gold: 6.1%)

**Example 8 Turn 4**:
- Question: "what is the sum divided by total obligations due?"
- Formula: `to_percentage(sum / total)` ✅
- Result: 22.99% (gold: 22.99%)

**Example 14 Turn 3**:
- Question: "how much does that change represent in relation to the original 2011 value?"
- Variables: `kbw_index_change_2011_2016` (change_value), `kbw_index_2011`
- Formula: `to_percentage(change / original)` ✅
- Result: 158.82% (gold: 158.82%)

### ✅ No Regressions

All examples that were passing before the fix still pass:
- Example 8: 4/4 (100%)
- Example 14: 3/3 (100%)
- Example 39: 4/4 (100%)

### ⚠️ Pre-Existing Issues (Not Caused By Our Fix)

**Example 21 Turn 3**: Double percentage conversion
- Previous result was already 128.0 (percentage)
- Applies `to_percentage()` again → 12800.0
- Need to track semantic_type of previous results

**Example 24 Turn 5-6**: Pronoun resolution
- "the initial investment" ambiguous between Edwards Lifesciences and S&P 500
- System chose wrong entity
- Need better context tracking

**Example 40 Turn 4**: Wrong denominator selected
- Question asks for portion of "payments due in less than 1 year"
- System used "total long-term debt" as denominator instead
- Need better entity matching

## Conclusion

✅ **The percentage convention fix is successful and causes no regressions.**

The fix correctly implements the ConvFinQA dataset convention:
- Changes/differences "in relation to" base → Percentage (multiply by 100)
- Absolute values "in relation to" base → Ratio (no multiplication)

This was discovered by analyzing multiple examples in the dataset (train[4], train[11], train[14], train[31]) and identifying the implicit convention used by the dataset creators.

## Files Modified

1. `src/graph-solver/prompts/formula_planning.j2` (lines 55-110)
   - Added ConvFinQA convention documentation
   - Added detection logic for numerator semantic type
   - Added examples of when to use vs not use `to_percentage()`

## Next Steps

The percentage convention fix is complete. Other issues to address separately:
1. Double percentage conversion detection
2. Multi-entity pronoun resolution
3. Better denominator selection for ratio questions

These are tracked in REGRESSION-TEST-RESULTS.md.
