# Priority Fixes for ConvFinQA Solver

## Executive Summary

**Current Status**: 31/154 turns passing (20.1%), 7 examples at 100%

**Key Finding**: Failures fall into 3 clear priority tiers with different root causes.

## Priority Tier 1: BUILD MISSING KGs (BLOCKS 78 EXAMPLES!)

### Impact: HIGHEST - Unblock 31-108 range
- **Examples affected**: 31-108 (78 examples)
- **Current state**: Cannot test - no KGs exist
- **Root cause**: KGs never built for this range
- **Fix**: Run KG building script for examples 31-108
- **Estimated impact**: Enable testing of 78 examples (51% of test set)

### Action Required:
```bash
# Build KGs for examples 31-50 first (20 examples)
for i in {31..50}; do
    echo "Building KG for example $i..."
    uv run python scripts/build-kg-for-example.py $i
done
```

**Why Priority 1**: Without KGs, these examples cannot be tested at all. This is a hard blocker.

---

## Priority Tier 2: FIX COMPLETE NONE FAILURES (HIGH IMPACT)

### Impact: HIGH - 26 examples, all turns fail
- **Examples affected**: 12, 13, 15, 19, 26, 28-30, 35-50 (subset with KGs)
- **Current state**: All turns return None (SPARQL finds no data)
- **Root cause**: SPARQL queries don't match KG structure
- **Fix**: Improve SPARQL generation (Phase 2A prompt)
- **Estimated impact**: Fix 1 issue → entire example passes (high leverage)

### Specific Issues Found:

**Example 12**: "class b shares issued"
- SPARQL searches for: "shares of class b common stock outstanding"
- KG has: "class b common stock - issue of shares on business combination"
- **Problem**: Query searches "outstanding" but question asks "issued"
- **Fix**: Phase 2A should use exact question keywords, not synonyms

**Example 15**: "weighted average useful life"
- Error: "Formula uses undefined variables"
- **Problem**: Phase 1 created variable name but Phase 2A didn't generate SPARQL
- **Fix**: Ensure Phase 2A generates query for all Phase 1 variables

### Action Required:
1. Pick ONE example (recommend 12 or 15)
2. Manually trace through phases
3. Identify exact SPARQL generation issue
4. Fix Phase 2A prompt with guidance
5. Re-test affected examples

**Why Priority 2**: High leverage - fixing SPARQL generation likely fixes many examples at once.

---

## Priority Tier 3: FIX CASCADING FAILURES (MEDIUM IMPACT)

### Impact: MEDIUM - 7 examples, first error cascades
- **Examples affected**: 10, 16, 17, 18, 23, 24, 27
- **Current state**: First turn fails → subsequent turns use wrong value
- **Root cause**: Mixed - wrong value, sign errors, SPARQL specificity
- **Fix**: Fix first-turn issues (varies by example)
- **Estimated impact**: Fix 1 turn → potentially fix all subsequent turns

### Specific Issues Found:

**Example 10**: Wrong metric matched (SPARQL too broad)
- Turn 1: Gets "derivative contracts" instead of "transaction gains"
- **Fix**: Add entity filtering to SPARQL (match "AES Corporation")

**Example 16**: Sign handling error
- Turn 1: Returns -531 instead of 531 (wrong sign)
- **Fix**: Add guidance about "impact" metrics (should be positive)

**Example 24**: Large cascade (1 error → 5 subsequent fails)
- Turn 2 fails → Turns 3-7 all fail
- **Fix**: Diagnose Turn 2 specifically

### Action Required:
1. Fix cascading examples in order of cascade size:
   - Example 24 (Turn 2 → 5 subsequent)
   - Example 18 (Turn 1 → 3 subsequent)
   - Example 23 (Turn 2 → 3 subsequent)
   - Example 27 (Turn 2 → 3 subsequent)
   - Example 10, 16 (Turn 1 → 2 subsequent each)
   - Example 17 (Turn 2 → 1 subsequent)

**Why Priority 3**: Medium leverage - each fix helps one example, but often fixes multiple turns.

---

## Priority Tier 4: FIX ISOLATED FAILURES (LOWER IMPACT)

### Impact: LOW - Individual turn failures, don't cascade
- **Examples affected**: Partial failures in otherwise passing examples
- **Current state**: Some turns pass, some fail independently
- **Root cause**: Varies by turn (each unique)
- **Fix**: Case-by-case diagnosis
- **Estimated impact**: Fix 1 turn → only that turn passes

### Action Required:
Address after Tiers 1-3 are complete.

---

## Recommended Execution Plan

### Phase 1: Build Missing KGs (1-2 hours)
```bash
# Build KGs for examples 31-50
for i in {31..50}; do
    uv run python scripts/build-kg-for-example.py $i &
    sleep 5  # Stagger to avoid rate limits
done
wait
```

### Phase 2: Test With New KGs (30 mins)
```bash
# Run tests for examples 31-50
for i in {31..50}; do
    uv run python src/graph-solver/__tests__/test_example.py $i &
done
wait

# Check results
uv run python scripts/query-test-results.py all | grep "31\|32\|33"
```

### Phase 3: Fix SPARQL Generation (2-3 hours)
1. Deep-dive Example 12:
   - Check what's in KG: `grep -i "class b" data/knowledge-graphs/12_kg.ttl`
   - Check SPARQL generated: `uv run python scripts/query-llm-logs.py 12 1 phase2a_query_generation`
   - Identify mismatch pattern
2. Fix Phase 2A prompt:
   - Add guidance: "Use exact keywords from question, not synonyms"
   - Add examples of ambiguous terms (issued vs outstanding)
3. Rebuild affected KGs and re-test

### Phase 4: Fix Cascading Failures (3-4 hours)
1. Example 24 (highest impact)
2. Examples 18, 23, 27
3. Examples 10, 16, 17

---

## Expected Outcomes

### After Phase 1 (Build KGs):
- **Estimated**: 31-50 testable (20 examples)
- **Expected pass rate**: 5-10% initially (SPARQL issues likely)
- **Key metric**: How many complete NONE failures vs partial

### After Phase 2 (Fix SPARQL):
- **Estimated**: 50-70% of complete NONE failures → passing
- **Examples**: 12, 13, 15, 19, 26, 28-30 likely fixed
- **Key metric**: Reduction in SPARQL "no results" errors

### After Phase 3 (Fix Cascading):
- **Estimated**: 7 examples → 50-100% pass rate (from partial)
- **Examples**: 10, 16, 17, 18, 23, 24, 27
- **Key metric**: First-turn accuracy improvement

### Target End State:
- **Examples at 100%**: 20-25 (from current 7)
- **Overall accuracy**: 50-60% (from current 20%)
- **Understanding**: Full diagnosis of remaining issues

---

## Risk Mitigation

**Risk**: API rate limits during batch KG building
- **Mitigation**: Stagger builds with `sleep` between calls
- **Mitigation**: Build in smaller batches (10 at a time)

**Risk**: SPARQL fixes break currently passing examples
- **Mitigation**: Run full regression after each fix
- **Mitigation**: Make changes incrementally, test each

**Risk**: New KGs reveal new failure patterns
- **Mitigation**: Re-run failure analysis after Phase 1
- **Mitigation**: Adjust Phase 2 priorities based on new data

---

## Success Metrics

| Phase | Metric | Current | Target |
|-------|--------|---------|--------|
| 1 | Testable examples | 43 | 63 |
| 2 | Complete NONE failures | 26 | 5-10 |
| 3 | Cascading failures | 7 | 0-2 |
| Overall | Examples at 100% | 7 | 20-25 |
| Overall | Accuracy | 20% | 50-60% |

---

## Next Immediate Action

**START HERE**: Build KGs for examples 31-50 (Phase 1)

```bash
cd /Users/williampearson/Legion/packages/km/examples/bill234
for i in {31..40}; do
    echo "=== Building KG for Example $i ==="
    uv run python scripts/build-kg-for-example.py $i
    echo ""
done
```

This unblocks 10 more examples for testing and will reveal if the failure patterns hold or if new issues emerge.
