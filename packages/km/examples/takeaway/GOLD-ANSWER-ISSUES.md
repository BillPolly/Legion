# Gold Answer Issues and Known Problems

This document tracks cases where test failures are NOT due to system bugs but rather:
- Gold answer errors in the dataset
- Ambiguous questions with multiple valid interpretations
- Known infrastructure issues (e.g., KG building)

---

## Example 122, Turn 3: KG Scale Labeling Issue

**Question**: "how much, then, does the net income represent in relation to this net sales total?"

**Our Answer**: 32969.4138
**Gold Answer**: 0.03297

**Analysis**:
- Retrieved values:
  - net_income: 10500.0 (scale: Millions) - from Turn 1, converted from 10.5 Billions
  - net_sales: 318477.0 (scale: Units) ← INCORRECT LABEL
- Formula: net_income / net_sales
- System normalized: 10500 Millions → 10,500,000,000 Units
- Division: 10,500,000,000 / 318,477 = 32,969.41 ❌

**Manual Calculation**:
If both values are correctly in Millions:
- 10500 Millions / 318477 Millions = 0.03297 ✓

**Root Cause**:
The KG extractor incorrectly labeled net_sales as "Units" when it should be "Millions".

Looking at the source document context:
- Net Income: $10.5 billion (correctly converted to 10500 millions)
- Net Sales: $318,477 million (stored as 318477.0 but labeled "Units")

The table likely shows "$ in millions" as a header, but the KG builder didn't propagate this scale metadata to the net_sales metric.

**Issue Type**: KG Building Issue

**Verdict**:
- Gold answer (0.03297) is mathematically CORRECT
- Our calculation logic is CORRECT
- Problem is in KG extraction phase not detecting table scale headers
- This is an infrastructure issue, not a prompt engineering issue

**Impact**: 1 turn failure (Example 122, Turn 3)

**Fix Required**:
Enhance KG builder to detect and propagate scale information from table headers like:
- "All amounts in millions"
- "$ in millions"
- "Values in thousands"

---

## Summary

**Total Test Turns**: 61 (Examples 109-125, excluding 113 which has no tests)
**Passed**: 60/61 (98.4%)
**Known Issues**: 1 (KG building - scale detection)
**Gold Answer Issues**: 0

**System is functionally correct** - The one remaining failure is due to missing metadata in the KG, not incorrect reasoning logic.
