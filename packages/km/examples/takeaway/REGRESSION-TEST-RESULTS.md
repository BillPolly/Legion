# Regression Test Results After Percentage Fix

**Date**: 2025-10-12
**Fix Applied**: Updated `formula_planning.j2` to detect ConvFinQA "represent in relation to" pattern with change/difference numerators → use `to_percentage()`

## Summary

- **Examples Fixed**: 39 (4/4 turns now passing)
- **No Regressions**: Examples 8, 14, 39 still pass 100%
- **Pre-Existing Issues**: Examples 21, 24 have different bugs (not related to our fix)

## Detailed Results

### ✅ Example 8: 100% (4/4 PASS)
All turns passing, including Turn 4 which uses "represent in relation to" pattern correctly:
- Turn 4: `to_percentage(sum / total)` → 22.99% ✅

### ✅ Example 14: 100% (3/3 PASS)
All turns passing, including Turn 3 which uses "change represent in relation to" pattern:
- Turn 3: `to_percentage(change / original)` → 158.82% ✅

### ⚠️ Example 21: 66.7% (2/3 PASS, 1 FAIL)
**Pre-existing bug - NOT caused by our fix**

**Turn 3 Failure**: Double percentage conversion
- Question: "what percentage change does this represent?"
- Previous result: `sp500_fraction_change_2008_2013 = 128.0` (already a percentage)
- Formula: `to_percentage(sp500_fraction_change_2008_2013)`
- Result: 12800.0 (128.0 * 100)
- Gold: 1.28

**Root Cause**: The question asks to convert a "fraction change" (which was already returned as percentage 128.0) into "percentage change". The system doesn't recognize that the input is already a percentage value and applies `to_percentage()` again.

**Fix Needed**: Phase 1 value planning should track `semantic_type` of values from previous turns. If the value is already `percentage_value`, don't wrap in `to_percentage()` again.

### ⚠️ Example 24: 71.4% (5/7 PASS, 2 FAIL)
**Pre-existing bug - NOT caused by our fix**

**Turn 5 Failure**: Pronoun resolution issue
- Question: "what is the net change from the initial investment?"
- Context: Previous turns discussed BOTH Edwards Lifesciences AND S&P 500
- Formula: `edwards_lifesciences_value_2016 - edwards_lifesciences_initial_investment`
- Result: 165.06
- Gold: 98.18 (S&P 500: 198.18 - 100)

**Turn 6 Failure**: Cascading from Turn 5
- Uses wrong value from Turn 5

**Root Cause**: Pronoun "the initial investment" is ambiguous when multiple entities have been discussed. The system incorrectly resolved it to Edwards Lifesciences context instead of S&P 500.

**Fix Needed**: Improve pronoun resolution in Phase 1 to track conversation context and disambiguate between multiple entities of the same type.

### ✅ Example 39: 100% (4/4 PASS)
**This was the target fix - now working correctly!**

**Turn 4 Success**: "represent in relation to" with change numerator
- Question: "how much does this change represent in relation to that average price in october?"
- Values: `change_avg_share_price_oct_nov2014` (semantic_type: change_value), `avg_price_per_share_oct2014`
- Formula: `to_percentage(change / price)` ✅
- Result: 6.09%
- Gold: 6.1%

## Conclusion

**✅ Our fix is successful and does not cause regressions.**

The failures in Examples 21 and 24 are separate bugs:
1. **Double percentage conversion** (Ex 21)
2. **Pronoun resolution** (Ex 24)

These should be tracked and fixed separately. The main fix for the "represent in relation to" percentage convention is working correctly across Examples 8, 14, and 39.

## Next Steps

1. Continue testing more examples to verify the percentage fix works broadly
2. Add separate issues for:
   - Double percentage conversion detection
   - Multi-entity pronoun resolution
3. Move on to test more examples (40+) to ensure the system is improving overall
