# ConvFinQA Progress Summary

## Current Status (2025-10-11)

### Test Results Overview
- **43 examples tested** (Examples 8-50)
- **7 examples at 100%**: 8, 9, 11, 14, 20, 21, 22
- **Overall accuracy**: 31/154 turns passing (20.1%)

### Ontology Status
- **Current version**: 1.0.2
- **Patterns added**:
  - `kg:pattern_between_time_range` - For "between X-Y years" table column references
  - `kg:DirectTableLookup` - Semantic operation for direct value retrieval

## Key Finding: Ontology Extension Process

**CRITICAL DISCOVERY**: The `OntologyExtractor` **READS** the ontology but does **NOT** modify it.

###How It Works:
1. **KG Building**: `OntologyExtractor` reads `convfinqa-ontology.ttl` → LLM extracts entities based on patterns
2. **Question Answering**: Phase 1/2 read ontology → LLM generates SPARQL/formulas based on patterns
3. **Ontology Extension**: **MANUAL** - Developer reviews questions, identifies new patterns, adds to `.ttl` file
4. **Version Tracking**: Ontology version is tracked; KGs store which version they were built with

## Failure Analysis

### Failure Type Distribution
- **102/127 failures (80%)**: NONE_ANSWER (SPARQL returns no results)
- **25/127 failures (20%)**: WRONG_VALUE (incorrect calculation/metric)

### Root Causes (NOT Missing Ontology Patterns!)

**1. SPARQL Query Specificity Issues (Most Common)**
- Query too broad → matches wrong metric
- Example: "shares issued" matched as "shares outstanding"
- Example: "foreign currency transaction gains" matched as "derivative contract gains"
- **Fix**: Improve Phase 2A SPARQL generation prompt/logic

**2. Missing KG Data**
- Metrics mentioned in questions not extracted into KG
- Often table metrics with complex row/column structures
- **Fix**: Improve KG extraction prompt/logic

**3. Sign Handling Issues**
- Values stored as negative when should be positive (or vice versa)
- Example: "impact of net charge-offs" = -531 (stored) but should be 531 (expected)
- **Fix**: Add guidance about sign preservation vs abs()

**4. Missing Linguistic Patterns (RARE!)**
- Only found ONE so far: "between X-Y years"
- Ontology patterns are actually quite comprehensive
- **Fix**: Add pattern to ontology when found

## Successfully Fixed: Example 8

### Problem
Turn 2: "what is the amount due between 1-3 years?"
- System interpreted as: `obligations_due_3_years - obligations_due_1_year` (WRONG)
- Should be: Direct lookup of table column "1-3 years"

### Solution
Added `kg:pattern_between_time_range` to ontology:
```turtle
kg:pattern_between_time_range a kg:LinguisticPattern ;
    kg:naturalLanguagePhrase "between [X]-[Y]" ;
    kg:semanticOperation kg:DirectTableLookup ;
    rdfs:comment """CRITICAL: 'between X-Y [time period]' is a DIRECT TABLE COLUMN REFERENCE,
    NOT a range calculation!"""
```

### Result
Example 8: **0% → 100%** (all 4 turns now pass)

## Next Steps

### Immediate Actions
1. **Focus on SPARQL generation** - Not ontology patterns
   - Add guidance about phrase matching ("issued" != "outstanding")
   - Add examples of ambiguous terms
   - Add entity specificity rules

2. **Improve KG extraction**
   - Review extraction prompt for table metrics
   - Add examples of complex table structures
   - Verify all table rows/columns are extracted

3. **Add sign handling rules**
   - Document which metrics should use abs()
   - Add rules about "impact" vs "balance" semantics
   - Create MetricTransformationRules for known cases

### Systematic Process (ONE EXAMPLE AT A TIME)
For each failing example:
1. Review questions
2. Check if data exists in KG
3. If missing → Improve extraction
4. If present → Check SPARQL query
5. If query wrong → Improve Phase 1/2 prompts
6. **ONLY if new linguistic pattern** → Add to ontology
7. Re-test to verify 100%

## Methodology Learned

**The ontology is comprehensive for linguistic patterns!**

The real issues are:
- **Query generation logic** (Phase 2A)
- **Entity extraction quality** (KG building)
- **Semantic understanding** (Phase 1 interpretation)

NOT:
- ~~Missing ontology patterns~~ (rare)
- ~~Incomplete ontology~~ (actually quite good)

This shifts the focus from "add more patterns" to "improve the LLM prompts and logic".

## Examples Requiring Attention

### SPARQL Specificity Issues
- Example 10: Foreign currency transaction gains vs derivative contract gains
- Example 12: Shares issued vs shares outstanding
- Example 16: Wrong metric matched for allowance balance

### Sign Handling Issues
- Example 16 Turn 1: -531 vs 531 (impact of charge-offs)

### Missing KG Data (SPARQL returns None)
- Example 12, 13, 15, 19, 23-50 (many turns)

## Success Metrics

| Metric | Before | After Fix |
|--------|--------|-----------|
| Examples at 100% | 6 | 7 |
| Overall accuracy | 17.5% | 20.1% |
| Ontology patterns added | 0 | 1 |
| Understanding of process | ❌ | ✅ |

The **process understanding** is the most valuable outcome - we now know how to systematically improve the system.
