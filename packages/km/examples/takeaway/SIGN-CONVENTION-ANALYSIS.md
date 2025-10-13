# ConvFinQA Sign Convention Analysis

## Discovery Date: 2025-10-12

## Key Finding: The Dataset Has a CONSISTENT Sign Convention

After analyzing Examples 51 and 52, the gold annotations follow a **clear, consistent pattern** for subtraction operations:

---

## The Pattern

### Type 1: Magnitude (OLD - NEW)
**Triggers**: Plain "change" WITHOUT modifiers
- **Example 51, Turn 1**: "what was the **change** in total other income and expense from 2008 to 2009?"
  - Values: 2008=620, 2009=326
  - Gold program: `subtract(620, 326)` = **620 - 326** = 294 (positive, OLD - NEW)
  - Result: **294** (magnitude of decrease)

### Type 2: Signed Change (NEW - OLD)
**Triggers**: "net change", "amount used", or other modifiers indicating sign matters
- **Example 52, Turn 1**: "what is the **net change** in the balance of other assets from 2008 to 2009?"
  - Values: 2008=216529, 2009=191265
  - Gold program: `subtract(191265, 216529)` = **191265 - 216529** = -25264 (negative, NEW - OLD)
  - Result: **-25264** (signed decrease)

- **Example 52, Turn 4**: "what amount of prepaid rent is **used during** 2009?"
  - Values: 2008=2658, 2009=1377
  - Gold program: `subtract(1377, 2658)` = **1377 - 2658** = -1281 (negative, NEW - OLD)
  - Result: **-1281** (signed decrease)

---

## Linguistic Triggers

### Magnitude (OLD - NEW)
- "change from X to Y"
- "difference between X and Y" (when not temporal)
- "fluctuation from X to Y"

### Signed Change (NEW - OLD)
- "**net** change from X to Y"
- "amount **used** during [year]"
- "amount **expensed** during [year]"
- Any phrase where the SIGN of the change is semantically meaningful

---

## Why This Makes Sense

1. **Plain "change"** asks "how much did it change?" → Answer with magnitude (positive number)
   - Like asking "how far did you walk?" → "5 miles" (not "-5 miles")

2. **"Net change"** or **"amount used"** asks "what was the net effect?" → Answer with sign
   - "Net change" signals you want to know if it increased (+) or decreased (-)
   - "Amount used" for assets signals you want to track the signed flow

---

## Implementation Strategy

### 1. Update `pattern_change` in ontology
```turtle
kg:pattern_change a kg:LinguisticPattern ;
    kg:naturalLanguagePhrase "what was the change" ;
    kg:semanticOperation kg:Subtraction ;
    rdfs:comment """CRITICAL: 'change' WITHOUT 'net' means MAGNITUDE: OLD - NEW

    - Plain 'change from X to Y' → OLD_value - NEW_value (positive for decrease)
    - 'NET change from X to Y' → NEW_value - OLD_value (negative for decrease)

    The word 'net' signals that sign matters!

    Formula: OLD - NEW""" .
```

### 2. Add `pattern_net_change` to ontology
```turtle
kg:pattern_net_change a kg:LinguisticPattern ;
    kg:naturalLanguagePhrase "net change" ;
    kg:alternatePhrase "net increase", "net decrease" ;
    kg:semanticOperation kg:Subtraction ;
    rdfs:comment """CRITICAL: 'net change' means SIGNED CHANGE: NEW - OLD

    - 'Net change from X to Y' → NEW_value - OLD_value
    - Result is NEGATIVE for decreases, POSITIVE for increases
    - Sign conveys semantic meaning (direction of change)

    Formula: NEW - OLD""" .
```

### 3. Update `pattern_amount_used_during_period` in ontology
```turtle
kg:pattern_amount_used_during_period a kg:LinguisticPattern ;
    kg:naturalLanguagePhrase "amount used during" ;
    kg:semanticOperation kg:Subtraction ;
    rdfs:comment """CRITICAL: 'amount used' means SIGNED CHANGE: NEW - OLD

    For prepaid assets (rent, expenses), usage means balance DECREASE.

    Formula: NEW_balance - OLD_balance
    - Negative result = asset decreased (used/expensed)
    - Positive result = asset increased (prepaid more than used)

    Example: Prepaid rent 2008=2658, 2009=1377
    - Amount used = 1377 - 2658 = -1281 (negative = decrease)

    This matches 'net change' pattern (signed).""" .
```

---

## System Changes Required

1. **Phase 2B (Formula Planning)**:
   - Check if question contains "net" modifier → Use NEW - OLD
   - Check for "used during" / "expensed during" → Use NEW - OLD
   - Otherwise for "change" → Use OLD - NEW

2. **Phase 1 (Value Planning)**:
   - When detecting "change" operations, flag whether it's "net" or plain
   - Pass this metadata to Phase 2B for correct formula generation

---

## Test Cases to Verify

- ✅ Example 51 Turn 1: "change" (not "net") → Should use OLD - NEW → Answer: 294
- ✅ Example 52 Turn 1: "net change" → Should use NEW - OLD → Answer: -25264
- ✅ Example 52 Turn 4: "amount used" → Should use NEW - OLD → Answer: -1281

---

## Conclusion

This is **NOT ambiguous** - it's a well-defined convention:
- "change" = magnitude (OLD - NEW)
- "net change" = signed (NEW - OLD)
- "amount used" = signed (NEW - OLD)

Our system needs to detect these linguistic triggers and apply the correct formula.
