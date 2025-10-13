# ConvFinQA Incremental Development Methodology

## System Architecture

**📖 READ FIRST**: See `ARCHITECTURE.md` for complete system design, including:
- Two-phase LLM architecture (Planning → Calculation)
- **Rich result metadata** for reference resolution
- How "this", "that", "it" are resolved across entity boundaries
- Why previous results need descriptive metadata, not just values

**Key Insight**: Previous results must be stored with rich context (entity, metric type, description) so Phase 1 can correctly resolve references like "this change" when multiple entities are discussed.

## CRITICAL: Understanding the True Process

**You are BUILDING the ontology incrementally, one example at a time.**

The ontology is **NOT complete** when you start. As you process each example, you will:
1. Review the questions and identify linguistic patterns
2. Check if the ontology already has those patterns
3. **ADD missing patterns to the ontology BEFORE testing**
4. Test and debug until the example passes 100%
5. Move to the next example

**BOTH knowledge graph extraction AND question answering depend on the ontology.**

## The Ontology is Your Single Source of Truth

The ontology (`ontology/convfinqa-ontology.ttl`) contains ALL semantic knowledge:

### What Lives in the Ontology
- **Type Definitions**: MonetaryValue, PercentageValue, FinancialMetric classes
- **Extraction Patterns**: How to recognize entities in text (for KG building)
- **Linguistic Patterns**: How phrases map to operations ("percentage change" → PercentageChange)
- **Reasoning Rules**: How to calculate (RatioCalculation, Subtraction, etc.)
- **Scale Conversions**: Billions ↔ Millions ↔ Thousands ↔ Units
- **Metric Transformations**: Which metrics need abs(), which need special handling
- **Reference Resolution**: What "it", "that value", "the difference" refer to

### What Does NOT Go in Prompts
❌ Do NOT hardcode domain knowledge in prompts:
- ❌ "If question asks for percentage, multiply by 100"
- ❌ "Net Interest Margin is always positive"
- ❌ "When you see 'in relation to', divide"
- ❌ Scale conversion factors (1 Billion = 1,000 Million)

✅ Prompts should be GENERIC:
- ✅ "Consult the ontology for linguistic patterns"
- ✅ "Check MetricTransformationRules in the ontology"
- ✅ "Apply scale conversions from the ontology"

**If you find yourself hardcoding knowledge in a prompt → STOP and add it to the ontology instead.**

## The Incremental Process (ONE EXAMPLE AT A TIME!)

**Start from Example 1.** Process examples sequentially: 1 → 2 → 3 → ... → 10

For EACH example, follow this complete cycle:

---

### Step 1: Build Knowledge Graph

```bash
uv run python scripts/build-kg-for-example.py <example_number>
```

**What it does:**
- Extracts entities from `table`, `pre_text`, `post_text`
- Uses ontology extraction patterns (reads from ontology!)
- Creates RDF graph: `data/knowledge-graphs/<N>_kg.ttl`

**EXAMINE the output:**
```bash
# Check if KG was created
ls -lh data/knowledge-graphs/<N>_kg.ttl

# Look at the metrics extracted
grep "FinancialMetric" data/knowledge-graphs/<N>_kg.ttl | head -20

# Check if scales are present
grep "hasScale" data/knowledge-graphs/<N>_kg.ttl
```

**Questions to ask:**
- Are all table rows extracted as metrics?
- Do values have scale metadata (Millions, Billions, etc.)?
- Are text-based metrics also extracted?

---

### Step 2: REVIEW THE QUESTIONS

```bash
# See the questions for this example
python3 -c "
import json
data = json.load(open('data/convfinqa_dataset.json'))
ex = data['train'][<N>]
print(f'Example {ex[\"id\"]} - {len(ex[\"dialogue\"][\"conv_questions\"])} questions:')
for i, q in enumerate(ex['dialogue']['conv_questions'], 1):
    print(f'  Turn {i}: {q}')
"
```

**Identify linguistic patterns in the questions:**
- "what about in 2008?" → Same metric, different time period
- "what is the difference?" → Subtraction
- "what percentage change?" → PercentageChange operation
- "in relation to" → RatioCalculation
- "the total" → Addition/Sum
- "the average" → Division by count

**Write down the patterns you see.**

---

### Step 3: CHECK THE ONTOLOGY

For each pattern identified, check if it exists in the ontology:

```bash
# Search for pattern by phrase
grep -i "difference" ontology/convfinqa-ontology.ttl

# Search for pattern by operation
grep -i "percentage" ontology/convfinqa-ontology.ttl

# Search for specific linguistic pattern
grep -i "in relation to" ontology/convfinqa-ontology.ttl
```

**For each pattern:**
- ✅ Pattern exists in ontology → Good, move on
- ❌ Pattern is NEW → **ADD IT NOW before testing!**

---

### Step 4: ADD MISSING PATTERNS TO ONTOLOGY

**If you found NEW patterns that aren't in the ontology, add them NOW.**

**Example: Adding a new linguistic pattern**

```turtle
# Add to ontology/convfinqa-ontology.ttl

kg:pattern_net_change rdf:type kg:LinguisticPattern ;
    rdfs:label "Net Change Pattern" ;
    kg:naturalLanguagePhrase "net change" ;
    kg:alternatePhrase "change" ;
    kg:alternatePhrase "difference" ;
    kg:semanticOperation kg:Subtraction ;
    rdfs:comment """
    When question asks for 'net change' or 'change' or 'difference':
    - Retrieve values for the two time periods
    - Calculate: new_value - old_value
    - Result can be positive (increase) or negative (decrease)

    Example:
      Q: "what was the net change from 2007 to 2008?"
      A: revenue_2008 - revenue_2007
    """ .
```

**Example: Adding a reference resolution pattern**

```turtle
kg:ref_same_metric_different_period rdf:type kg:ReferencePattern ;
    rdfs:label "Same Metric, Different Period" ;
    kg:naturalLanguagePhrase "what about in [year]" ;
    kg:alternatePhrase "what was it in [year]" ;
    rdfs:comment """
    When question uses 'what about in...' or 'what was it in...':
    - 'it' refers to the same metric as the previous turn
    - But for a different time period
    - Query for same metric with new time period

    Example:
      Turn 1: "what was revenue in 2008?" → 9362.2
      Turn 2: "what about in 2007?" → Query revenue in 2007
    """ .
```

**Example: Adding a metric transformation rule**

```turtle
kg:rule_net_interest_margin rdf:type kg:MetricTransformationRule ;
    kg:appliesWhenLabelContains "net interest margin" ;
    kg:requiresTransformation kg:AbsoluteValue ;
    rdfs:comment """
    Net Interest Margin is always positive by accounting convention.
    If KG stores negative value, apply abs() transformation.
    """ .
```

**IMPORTANT**: After adding patterns, the extraction AND testing will use them automatically.

---

### Step 5: Create Test Cases

```bash
# Create test cases from dialogue
uv run python scripts/create-test-case.py <example_number>

# Copy KG to knowledge-graphs directory (if not already there)
cp data/preprocessed/<N>_kg.ttl data/knowledge-graphs/<N>_kg.ttl

# Add ontology metadata to test cases
uv run python scripts/add-ontology-to-test-cases.py <example_number>
```

---

### Step 6: Test the Example

```bash
uv run python scripts/test_example.py <example_number>
```

**Expected output:**
```
[1/4] Turn 1: what were revenues in 2008?
  ✓ PASS - Answer: 9362.2 (gold: 9362.2)

[2/4] Turn 2: what were they in 2007?
  ✓ PASS - Answer: 9244.9 (gold: 9244.9)

[3/4] Turn 3: what was the net change?
  ✓ PASS - Answer: 117.3 (gold: 117.3)

[4/4] Turn 4: what is the percent change?
  ✓ PASS - Answer: 1.26881 (gold: 1.3)

Example 1 Results: 4/4 passed (100.0%)
```

---

### Step 6a: Inspect Failures First (CRITICAL!)

**Before debugging ANY failure, determine if it's a real bug or a dataset issue!**

See `CLAUDE.md` section "Gold Annotation and Question Ambiguity Review" for complete process.

**Quick inspection steps:**
1. Read source data (table + pre_text + post_text)
2. Manually verify the math
3. Make judgment: Gold correct? Gold wrong? Question ambiguous?
4. Document in `GOLD-ANNOTATION-ISSUES.md` if dataset issue
5. Only proceed to debugging if gold answer is verified correct

**Example command:**
```bash
python3 -c "
import json
ex = json.load(open('data/convfinqa_dataset.json'))['train'][<N>]
print('Source text:', ex['doc']['pre_text'][:1000])
print('\nTable:', ex['doc']['table'])
for i, (q, a) in enumerate(zip(ex['dialogue']['conv_questions'], ex['dialogue']['conv_answers'])):
    print(f'{i}. Q: {q}')
    print(f'   A: {a}')
"
```

**Only if gold answer is verified correct → proceed to Step 7.**

---

### Step 7: Debug Failures (If Any)

**If any turn fails AND gold answer is verified correct, follow this diagnostic process:**

#### 7a. Check What Failed

Read the detailed results:
```bash
cat data/test-results/current/by-example/<N>.json
```

Look at the failing turn:
- What was our answer?
- What was the gold answer?
- What was Phase 1 output (SPARQL queries)?
- What was Phase 2 output (formula)?
- What values were retrieved?

#### 7b. Identify the Root Cause

**Is it a KG extraction issue?**
- Metric not in the KG → Re-run KG extraction
- Wrong scale → Fix extraction logic
- Missing text-based metric → Extraction didn't capture narrative text

**Is it a query generation issue?**
- SPARQL query wrong → Check Phase 1 prompt
- Wrong values retrieved → Check ontology patterns
- Pattern not recognized → Add pattern to ontology

**Is it a calculation issue?**
- Wrong formula → Check Phase 2 prompt
- Missing transformation → Add MetricTransformationRule to ontology
- Wrong reference resolution → Add ReferencePattern to ontology

#### 7c. Fix and Re-test

**If KG issue:**
```bash
# Fix extraction logic if needed
# Re-run KG extraction
uv run python scripts/build-kg-for-example.py <N>

# Re-add ontology to test cases
uv run python scripts/add-ontology-to-test-cases.py <N>

# Re-test
uv run python scripts/test_example.py <N>
```

**If ontology issue:**
```bash
# Add pattern to ontology/convfinqa-ontology.ttl
# No need to rebuild KG!

# Re-test (will use new ontology automatically)
uv run python scripts/test_example.py <N>
```

**If prompt issue (rare!):**
```bash
# Fix prompt template
# Re-test
uv run python scripts/test_example.py <N>
```

---

### Step 8: VERIFY 100% BEFORE MOVING ON

**Requirements to proceed:**
- ✅ All turns pass (100% accuracy)
- ✅ Results saved to JSON
- ✅ Any new patterns added to ontology
- ✅ Ontology changes committed

**Verification:**
```bash
# Should show 100%
uv run python scripts/test_example.py <N>
```

**Only when 100% → Move to next example.**

---

## Example Walkthrough: Processing Example 1

Let's walk through Example 1 step-by-step to illustrate the process:

### Questions for Example 1:
1. "what were revenues in 2008?"
2. "what were they in 2007?"
3. "what was the net change?"
4. "what is the percent change?"

### Step 1: Build KG
```bash
uv run python scripts/build-kg-for-example.py 1
# ✓ Successfully built KG for Example 1
# Check: ls data/knowledge-graphs/1_kg.ttl
```

### Step 2: Review Questions

**Patterns identified:**
- Turn 1: Direct metric query for specific year
- Turn 2: "what were they" → Same metric, different year (reference resolution)
- Turn 3: "net change" → Subtraction
- Turn 4: "percent change" → PercentageChange operation

### Step 3: Check Ontology

```bash
# Check for "net change" pattern
grep -i "net change" ontology/convfinqa-ontology.ttl
# Found: kg:pattern_net_change exists ✓

# Check for "they" reference pattern
grep -i "ref_it_same_metric" ontology/convfinqa-ontology.ttl
# Found: kg:ref_it_same_metric exists ✓

# Check for "percent change" pattern
grep -i "percentage_change" ontology/convfinqa-ontology.ttl
# Found: kg:pattern_percentage_change exists ✓
```

**Result**: All patterns exist! No need to add new ones.

### Step 4-6: Create Test Cases and Test

```bash
uv run python scripts/create-test-case.py 1
cp data/preprocessed/1_kg.ttl data/knowledge-graphs/1_kg.ttl
uv run python scripts/add-ontology-to-test-cases.py 1
uv run python scripts/test_example.py 1
```

**Result**: 4/4 passed (100%)

### Step 7: Debug Failures

No failures! All turns passed.

### Step 8: Verify and Move On

✓ 100% accuracy achieved
✓ Move to Example 2

---

## Common Patterns You Will Encounter

As you process examples, you'll see these patterns repeatedly:

### 1. Same Metric, Different Period
**Phrases**: "what about in 2007?", "what was it in 2008?", "and in 2009?"
**Operation**: Reference to previous turn's metric with new time filter
**Ontology**: `kg:ref_it_same_metric`

### 2. Difference/Change
**Phrases**: "what was the change?", "what is the difference?", "net change"
**Operation**: Subtraction (new - old)
**Ontology**: `kg:pattern_net_change`

### 3. Percentage Change
**Phrases**: "what percentage change?", "what is the percent change?"
**Operation**: (new - old) / old * 100
**Ontology**: `kg:pattern_percentage_change`

### 4. Percentage Change After Difference
**Phrases**: "what percentage change does this represent?" (after calculating difference)
**Operation**: difference / base_value * 100
**Ontology**: `kg:ref_percentage_change_after_difference`

### 5. In Relation To
**Phrases**: "in relation to", "as a percentage of", "how much does X represent in relation to Y"
**Operation**: X / Y
**Ontology**: `kg:pattern_ratio_calculation`

### 6. Total/Sum
**Phrases**: "what is the total?", "total for both years"
**Operation**: Addition
**Ontology**: `kg:pattern_sum`

### 7. Average
**Phrases**: "what is the average?", "average per year"
**Operation**: Sum / count
**Ontology**: `kg:pattern_average`

### 8. Multiple References
**Phrases**: "the total sum", "that stock in 2015", "this change"
**Operation**: Reference to specific previous result
**Ontology**: `kg:ref_that_value`, `kg:ref_this_value`

---

## Ontology Structure Reference

### Classes

```turtle
kg:LinguisticPattern       # Phrase → Operation mapping
kg:ReferencePattern        # Pronoun/reference resolution
kg:MetricTransformationRule # Metric-specific transformations
kg:SemanticOperation       # Operations (Subtraction, Division, etc.)
```

### Properties for LinguisticPattern

```turtle
kg:naturalLanguagePhrase   # Primary phrase pattern
kg:alternatePhrase         # Alternate ways to express
kg:semanticOperation       # Which operation to apply
kg:formula                 # Formula template (optional)
```

### Properties for ReferencePattern

```turtle
kg:pronounPattern          # "it", "they", "the value"
kg:resolvesToPreviousResult # true if refers to previous turn
kg:contextWindow           # How many turns back to look
```

### Properties for MetricTransformationRule

```turtle
kg:appliesWhenLabelContains # Metric label pattern
kg:requiresTransformation   # Which transformation (AbsoluteValue, etc.)
```

---

## How the System Uses the Ontology

### During KG Extraction

```python
# Extraction reads ontology for:
# - Type definitions (what is a MonetaryValue?)
# - Extraction patterns (how to find scales: "in millions")
# - Structure (what properties should values have?)

# Example:
ontology_rules = load_ontology_extraction_rules()
prompt = render_extraction_prompt(
    document=document,
    ontology_rules=ontology_rules  # From ontology!
)
```

### During Query Planning (Phase 1)

```python
# Phase 1 reads ontology for:
# - Linguistic patterns (phrase → operation)
# - Reference resolution (what "it" means)
# - Metric patterns (how to query specific metrics)

prompt = render_query_prompt(
    question=question,
    conversation_history=history,
    core_ontology=load_core_ontology()  # Full ontology!
)
```

### During Calculation (Phase 2)

```python
# Phase 2 reads ontology for:
# - Semantic operations (how to calculate)
# - Metric transformations (abs() for Net Interest Margin)
# - Scale conversions (Billions → Millions)

prompt = render_calculation_prompt(
    question=question,
    retrieved_values=values,
    core_ontology=load_core_ontology()  # Full ontology!
)
```

---

## Success Criteria

### Per Example
- ✅ All turns passing (100% accuracy)
- ✅ Detailed results saved to JSON
- ✅ Any new patterns added to ontology

### Overall (Examples 0-9)
- 🎯 All examples at 100% accuracy
- 🎯 Ontology comprehensively covers financial QA patterns
- 🎯 System can handle new examples without prompt changes
- 🎯 Clear documentation of all patterns discovered

---

## Quick Reference Commands

```bash
# Check status of examples (ALWAYS USE THIS FIRST!)
python3 scripts/report-status.py              # All examples
python3 scripts/report-status.py 0 1 2 3      # Specific examples
python3 scripts/report-status.py 0-9          # Range

# Build KG for example N
uv run python scripts/build-kg-for-example.py <N>

# Check what patterns exist in ontology
grep -i "<pattern_keyword>" ontology/convfinqa-ontology.ttl

# Create test cases
uv run python scripts/create-test-case.py <N>
cp data/preprocessed/<N>_kg.ttl data/knowledge-graphs/<N>_kg.ttl
uv run python scripts/add-ontology-to-test-cases.py <N>

# Test example
uv run python scripts/test_example.py <N>

# View detailed results
cat data/test-results/current/by-example/<N>.json | python3 -m json.tool

# Check KG metrics
grep "FinancialMetric" data/knowledge-graphs/<N>_kg.ttl

# View example questions
python3 -c "import json; data=json.load(open('data/convfinqa_dataset.json')); ex=data['train'][<N>]; [print(f'{i+1}. {q}') for i, q in enumerate(ex['dialogue']['conv_questions'])]"
```

---

## Remember

1. **Process ONE example at a time** (never batch!)
2. **Review questions and check ontology BEFORE testing**
3. **Add missing patterns to ontology first**
4. **100% accuracy required before moving on**
5. **Knowledge goes in ontology, NOT in prompts**
6. **Both extraction and testing depend on ontology**
7. **The ontology is incomplete - you're building it!**
