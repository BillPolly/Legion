# CLAUDE.md - Tomoro FinQA Challenge

This file provides guidance for working on the ConvFinQA ontology-based graph solver.

## 📖 System Architecture

**READ** `ARCHITECTURE.md` for complete system design:
- Two-phase architecture (Planning → Calculation)
- **Result metadata structure** - WHY results need rich context
- Reference resolution with entity tracking
- How "this", "that", "it" are resolved

**Critical Issue Fixed**: Previous results now store descriptive metadata (entity, metric type, description) so Phase 1 can correctly resolve "this change" when multiple entities (UPS vs S&P 500) are discussed.

---

# ⚠️ CRITICAL: READ THIS FIRST! ⚠️

## Ontology Extension is MANUAL - You Build It Incrementally

**CRITICAL UNDERSTANDING**: The `OntologyExtractor` READS the ontology to guide KG extraction, but does NOT modify it. **YOU must manually review questions and add missing patterns to the ontology.**

### How Ontology Extension Works

1. **Ontology File**: `ontology/convfinqa-ontology.ttl` (version tracked: currently 1.0.2)
2. **KG Building**: `OntologyExtractor` reads ontology → LLM extracts entities based on patterns
3. **Question Answering**: Phase 1/2 read ontology → LLM generates SPARQL/formulas based on patterns
4. **Ontology Extension**: **MANUAL** - You review questions, identify new patterns, add to `.ttl` file
5. **Version Tracking**: Increment `owl:versionInfo` after changes; KGs track which version they used

### The Fundamental Process (ONE EXAMPLE AT A TIME)

For **EACH** example (8 → 9 → 10 → ... → 50), you MUST:

1. **Build Knowledge Graph**
   ```bash
   uv run python scripts/build-kg-for-example.py <N>
   ```
   This creates `data/knowledge-graphs/<N>_kg.ttl` with current ontology version metadata.

2. **REVIEW THE QUESTIONS** - Read the dialogue questions and identify patterns
   ```bash
   python3 -c "import json; ex=json.load(open('data/convfinqa_dataset.json'))['train'][<N>]; [print(f'{i+1}. {q}') for i,q in enumerate(ex['dialogue']['conv_questions'])]"
   ```

3. **CHECK THE ONTOLOGY** - For each pattern, does it exist in the ontology?
   ```bash
   grep -i "<pattern_keyword>" ontology/convfinqa-ontology.ttl
   ```

4. **ADD MISSING PATTERNS MANUALLY** - If pattern is NEW, add it to the ontology NOW (before testing!)

   **Example of adding a pattern:**
   ```turtle
   kg:pattern_between_time_range a kg:LinguisticPattern ;
       kg:alternatePhrase "due between", "amount between" ;
       kg:exampleQuestion "what is the amount due between 1-3 years?" ;
       kg:naturalLanguagePhrase "between [X]-[Y]" ;
       kg:requiresPreviousResult false ;
       kg:semanticOperation kg:DirectTableLookup ;
       rdfs:comment """CRITICAL: 'between X-Y [time period]' (e.g., '1-3 years') is a DIRECT TABLE COLUMN REFERENCE, NOT a range calculation!
       DO NOT interpret as: value_at_Y - value_at_X
       DO interpret as: Look for table column matching 'X-Y [unit]'""" .
   ```

   **Don't forget to increment ontology version:**
   ```turtle
   kg:ConvFinQAOntology a owl:Ontology ;
       owl:versionInfo "1.0.3" .  # Increment after changes
   ```

5. **Rebuild KG if Ontology Changed**
   ```bash
   # If you added patterns that affect extraction:
   uv run python scripts/build-kg-for-example.py <N>
   ```

6. **Test the Example**
   ```bash
   # Run test in background and monitor via MongoDB
   uv run python src/graph-solver/__tests__/test_example.py <N> &
   sleep 30  # Wait for test to complete
   uv run python scripts/query-test-results.py <N>
   ```

7. **Debug Failures** - Categorize failure type:
   - **Missing Ontology Pattern** → Add pattern to ontology, rebuild KG, re-test
   - **Missing KG Data** → Improve extraction prompt/logic, rebuild KG
   - **SPARQL Too Broad/Narrow** → Improve Phase 1/2 prompts or add specificity guidance
   - **Wrong Calculation** → Check ontology calculation rules

8. **INSPECT FAILURES FIRST** (CRITICAL!) - Before fixing, determine if it's a real bug or dataset issue!
   - See "Gold Annotation and Question Ambiguity Review" section below
   - Read source data, verify math, check gold answer
   - Document decision in `GOLD-ANNOTATION-ISSUES.md`
   - Only fix if gold answer is verified correct

9. **VERIFY 100%** - All turns must pass before moving to next example

### Failure Type Classification

When debugging, identify which category the failure falls into:

**1. NONE_ANSWER (80% of failures)** - SPARQL query returns no results:
   - Check if data exists in KG: `grep -i "metric_name" data/knowledge-graphs/<N>_kg.ttl`
   - If missing from KG → KG extraction issue
   - If present in KG → SPARQL query specificity issue

**2. WRONG_VALUE (20% of failures)** - Returns incorrect value:
   - Check if wrong metric matched (SPARQL too broad)
   - Check if calculation formula is wrong
   - Check if sign handling is wrong (abs vs preserve sign)

**3. Missing Linguistic Pattern** - Phase 1 misinterprets question:
   - Add pattern to ontology
   - Examples: "between 1-3 years", "cumulative return", "annual expense"

## The Ontology is Your Single Source of Truth

**BOTH knowledge graph extraction AND question answering depend on the ontology.**

### What Lives in the Ontology
✅ Type definitions (MonetaryValue, PercentageValue classes)
✅ Extraction patterns (how to recognize entities in text)
✅ Linguistic patterns ("percentage change" → PercentageChange)
✅ Reasoning rules (how to calculate)
✅ Scale conversions (Billions ↔ Millions)
✅ Metric transformations (Net Interest Margin → abs())
✅ Reference resolution ("it", "that value" → previous result)

### What Does NOT Go in Prompts
❌ Do NOT hardcode: "If question asks for percentage, multiply by 100"
❌ Do NOT hardcode: "Net Interest Margin is always positive"
❌ Do NOT hardcode: "When you see 'in relation to', divide"
❌ Do NOT hardcode: Scale conversion factors

**If you find yourself hardcoding knowledge in a prompt → STOP and add it to the ontology instead.**

---

## Project Goal

Build a ConvFinQA solver **incrementally, example by example**, achieving 100% accuracy by:
1. Extracting knowledge graphs from source documents
2. Creating test cases from conversation dialogues
3. **EXTENDING the ontology with new linguistic patterns discovered in each example**
4. Debugging and fixing extraction/reasoning issues
5. Testing and verifying each example achieves 100% before moving to the next

## Incremental Development Workflow

**CRITICAL**: Process ONE example at a time. Review questions, check ontology, add missing patterns, then test.

### Dataset Structure

**File**: `data/convfinqa_dataset.json`
- **Train split**: 3,037 examples
- **Dev split**: 421 examples

Each example contains:
- `id`: Document-based identifier (e.g., "Single_JKHY/2009/page_28.pdf-3")
- `doc`: Source document with `table`, `pre_text`, `post_text`
- `dialogue`: Multi-turn conversation
  - `conv_questions`: List of questions
  - `conv_answers`: Gold answers
  - `turn_program`: Formula for each turn
- `features`: Additional metadata

### Example-by-Example Process

For each example (starting from `data['train'][0]`):

#### 1. **Extract Knowledge Graph**
```bash
uv run scripts/build-kg-for-example.py <example_id>
```
- Input: `ex['doc']['table']`, `ex['doc']['pre_text']`, `ex['doc']['post_text']`
- Output: `data/knowledge-graphs/<id>_kg.ttl`
- Debug: Check scale metadata (`kg:hasScale`), metric labels, value extraction

#### 2. **Create Test Cases**
```bash
uv run scripts/create-test-case.py <example_id>
```
- Input: `ex['dialogue']['conv_questions']`, `ex['dialogue']['conv_answers']`
- Output: Add to `data/test-cases/test_cases.json`
- Format: Match existing test case structure

#### 3. **Test The Example**

**CRITICAL**: ALWAYS run tests in the background to monitor progress!

```bash
# Run in background
uv run python src/graph-solver/__tests__/test_example.py <example_id> &

# Monitor progress (wait 10-30 seconds, then check)
sleep 10
uv run python scripts/query-test-results.py <example_id>

# If test is stuck, check progress with ps/kill
ps aux | grep test_example
```

**Why background?**
- Long-running tests can timeout
- You can monitor progress via MongoDB queries
- You can kill stuck tests without losing context
- Progress is visible in real-time through query scripts

**After test completes:**
```bash
# View results from MongoDB (NOT log files!)
uv run python scripts/query-test-results.py <example_id>
```

#### 4. **Debug Failures**
When a turn fails, check in order:
1. **KG Extraction**: Does the KG have the required data?
   ```bash
   grep "<metric_name>" data/knowledge-graphs/<id>_kg.ttl
   ```
2. **SPARQL Generation**: Are queries finding the data?
   - Check Phase 1 output in test results JSON
   - Run SPARQL manually against KG
3. **Calculation**: Is the formula correct?
   - Check Phase 2 output in test results JSON
   - Verify math manually
4. **Ontology Patterns**: Are new patterns needed?
   - Identify linguistic pattern in question
   - Add to `ontology/convfinqa-ontology.ttl`

#### 5. **Extend Ontology**
When encountering new question patterns:
```turtle
kg:pattern_<pattern_name> rdf:type kg:LinguisticPattern ;
    kg:naturalLanguagePhrase "<phrase>" ;
    kg:semanticOperation kg:<Operation> ;
    rdfs:comment """Description and examples""" .
```

#### 6. **Verify and Continue**
- All turns must pass before moving to next example
- Document gold answer issues if found
- Commit successful example

### Current Status

- **Examples 109-125**: Pre-built KGs and test cases (16 examples, 61 turns)
- **Examples 1-108**: Need to be built incrementally
- **Target**: Examples 1-10 from train split

## Gold Annotation and Question Ambiguity Review

**CRITICAL**: Before spending time debugging a failure, determine if it's a real bug or a dataset issue!

### Inspection Process (MUST DO for every failure)

1. **Read the source data**:
   ```bash
   python3 -c "
   import json
   ex = json.load(open('data/convfinqa_dataset.json'))['train'][N]
   print('Source text:')
   print(ex['doc']['pre_text'][:1000])
   print('\nGold answers:')
   for i, (q, a) in enumerate(zip(ex['dialogue']['conv_questions'], ex['dialogue']['conv_answers'])):
       print(f'{i+1}. Q: {q}')
       print(f'   A: {a}')
   "
   ```

2. **Manually verify the math**:
   - Extract the relevant numbers from source text
   - Calculate what the answer SHOULD be
   - Compare to gold answer
   - Check: Does the gold answer make sense?

3. **Make a judgment call**:
   - ✅ **Gold answer is correct** → This is a bug, fix it
   - ❌ **Gold answer is wrong** → Document it, move on
   - ⚠️ **Question is ambiguous** → Document it, move on

4. **Document the decision**:
   Create/update `GOLD-ANNOTATION-ISSUES.md`:
   ```markdown
   ## Example N, Turn M: [Issue Type]

   **Question**: "..."
   **Gold Answer**: X
   **Source Data**: "... relevant excerpt ..."

   **Issue**: [Describe what's wrong]
   **Our Answer**: Y
   **Verdict**: [Gold error / Ambiguous / Legitimate bug]
   **Action**: [Fixed / Deferred / Skipped]
   ```

### When to Skip vs Fix

**SKIP** if:
- Gold answer contradicts source data
- Question is genuinely ambiguous (multiple valid interpretations)
- Would require understanding context not in the document

**FIX** if:
- Gold answer is verifiable from source data
- Our logic/query/formula is wrong
- Missing ontology pattern

### Example: Example 6 Turn 1 Inspection

**Source text**: "the current year included expense of $3.7 billion for additional litigation reserves... the prior year included expense of $3.2 billion for additional litigation reserves"

**Question**: "what was the net change in value of litigation reserves during 2012?"
**Gold Answer**: 0.5
**Our Answer**: 3.2

**Manual verification**: 3.7 - 3.2 = 0.5 ✓

**Verdict**: Gold answer is CORRECT. This is a legitimate bug.
**Root cause**: Missing ontology pattern for "net change during [year]" → should compute end - start

**Action**: Add `kg:pattern_net_change_during_period` to ontology

## Core Architectural Principle: Ontology as Single Source of Truth

**CRITICAL**: The ontology (`convfinqa-ontology.ttl`) is the ONLY source of type-level knowledge for the entire system.

### What This Means

The ontology must provide ALL knowledge about:
1. **Type Definitions**: What IS a MonetaryValue, PercentageValue, FinancialMetric
2. **Scale Relationships**: How Billions, Millions, Thousands, Units relate to each other
3. **Extraction Patterns**: Text patterns that indicate entity types (for KG building)
4. **Reasoning Rules**: Semantic operations like addition, division, percentage calculation
5. **Unit Conversion**: How to convert between scales when questions specify units

### Why This Matters

Currently we have TWO separate knowledge sources:
- **Extraction phase** has hardcoded rules in `ontology_extraction.j2` prompt
- **Query phase** has semantic rules in `convfinqa-ontology.ttl`

But these describe the SAME DOMAIN! This causes problems:
- **Duplication**: Same knowledge in two places
- **Inconsistency**: Scale conversion rules missing from calculation stage
- **Brittleness**: Changes require updating multiple files

### The Solution Pattern

**BOTH extraction and querying must use the same pattern:**

```
1. Identify what ontology knowledge is needed
2. Query the ontology for relevant portion
3. Format that portion for the LLM prompt
4. LLM uses ontology-derived rules (not hardcoded prompt rules)
```

**Extraction Example**:
```python
# Query ontology for extraction patterns
scale_rules = query_ontology("SELECT ?scale ?conversionFactor WHERE { ?scale kg:conversionToUnits ?factor }")

# Include in extraction prompt
prompt = template.render(
    ontology_rules=scale_rules,  # From ontology, not hardcoded
    document_data=data
)
```

**Query Example**:
```python
# Query ontology for semantic rules (already doing this)
semantic_rules = load_core_ontology()

# Include in query prompt
prompt = template.render(
    core_ontology=semantic_rules,  # From ontology
    question=question
)
```

### Implementation Checklist

When adding new capabilities:
- ✅ Add type definition to ontology
- ✅ Add extraction patterns to ontology
- ✅ Add reasoning rules to ontology
- ✅ Extraction prompt queries ontology for patterns
- ✅ Query prompt queries ontology for reasoning rules
- ✅ Calculation stage queries ontology for unit conversions
- ❌ NEVER hardcode domain knowledge in prompts

## System Architecture

### Three-Stage Pipeline

1. **Semantic Understanding Stage** (`src/graph-solver/semantic_stage.py`)
   - Input: Question, schema, conversation history
   - Output: Calculation type, entity constraints, previous answer references
   - Uses LLM to parse natural language into structured query specification

2. **Query Generation Stage** (`src/graph-solver/query_stage_llm.py`)
   - Input: Semantic output, schema, conversation history
   - Output: SPARQL queries, raw results from graph
   - **CRITICAL**: Generates ONE SPARQL query per entity constraint
   - Uses LLM to convert constraints into SPARQL queries
   - Executes queries against RDF graph using RDFLib

3. **Calculation Stage** (`src/graph-solver/calculation_stage.py`)
   - Input: Semantic output, raw results from queries
   - Output: Final numeric answer
   - Performs arithmetic: add, subtract, multiply, divide, percentage

### Knowledge Graph Structure

**Ontology** (in RDF/Turtle format):
```turtle
entity:Company_IPG a kg:Company
entity:Metric_TotalDebt_2015 a kg:FinancialMetric
  kg:tableRow "total debt"
  kg:tableColumn "december 31 , 2015"
  kg:hasValue value:TotalDebt_2015

value:TotalDebt_2015 a kg:MonetaryValue
  kg:numericValue 1762.3
  kg:hasScale kg:Millions
```

**Key Classes**:
- `kg:Company` - Business organizations
- `kg:FinancialMetric` - Financial line items (table or extracted)
- `kg:FinancialValue` - Numeric values (MonetaryValue, PercentageValue, CountValue, RatioValue)
- `kg:Year` - Time periods
- `kg:Category` - Categorical dimensions

**Two Metric Patterns**:
1. **Table metrics**: Use `kg:tableRow` and `kg:tableColumn` properties
2. **Extracted metrics**: Use `kg:label` and `kg:forTimePeriod` relationships

## MongoDB Storage

**CRITICAL**: All test results and LLM interactions are stored in MongoDB database `legion_tools`.

### Collections
- `test_results` - Test outcomes for each example (replaces old JSON files)
- `llm_interactions` - All prompts and responses with timestamps for debugging

## Query Scripts (USE THESE!)

**CRITICAL**: For ALL repetitive debugging questions, ALWAYS use these scripts instead of writing inline Python code!

### View Test Results
```bash
# Show results for a specific example (includes failure analysis if present)
uv run python scripts/query-test-results.py 8

# Show all examples summary
uv run python scripts/query-test-results.py all

# Get raw JSON for an example
uv run python scripts/query-test-results.py 8 --json
```

### View LLM Logs
```bash
# List available phases for a turn
uv run python scripts/query-llm-logs.py 8 2

# View specific phase
uv run python scripts/query-llm-logs.py 8 2 phase1_value_planning
uv run python scripts/query-llm-logs.py 8 2 phase2a_query_generation
uv run python scripts/query-llm-logs.py 8 2 phase2b_formula

# View full turn flow (all phases)
uv run python scripts/query-llm-logs.py 8 2 flow
```

### Add Failure Analysis
```bash
# Interactive mode - prompts for all fields
uv run python scripts/add-failure-analysis.py 8

# From JSON file
uv run python scripts/add-failure-analysis.py 8 analysis.json
```

**Failure Analysis Structure**:
```json
{
  "root_cause": "Description of root cause",
  "issue_type": "linguistic_pattern_matching | kg_extraction | formula_generation",
  "affected_turns": [2, 3, 4],
  "primary_turn": 2,
  "expected_behavior": "What should happen",
  "actual_behavior": "What actually happens",
  "kg_evidence": {
    "correct_column": "1-3 years",
    "correct_value": 45161.0
  },
  "cascading_effect": "How failure propagates",
  "status": "identified | in_progress | fixed"
}
```

### Phase Names
- `phase1_value_planning` - Identifies what values are needed
- `phase2a_query_generation` - Generates SPARQL queries
- `phase2b_formula` - Plans the calculation formula

### Query LLM Logs Directly (if scripts don't work)

```javascript
// Get logs for Example 112
mongosh legion_tools --eval "
  db.llm_interactions.find({
    'metadata.example_id': '112'
  }).sort({timestamp: -1}).limit(10).pretty()
"

// Get SPARQL generation logs for Turn 4
mongosh legion_tools --eval "
  db.llm_interactions.find({
    'metadata.example_id': '112',
    'metadata.turn': 4,
    'metadata.stage': 'query_generation'
  }).sort({timestamp: -1}).pretty()
"

// Get semantic stage logs
mongosh legion_tools --eval "
  db.llm_interactions.find({
    'metadata.stage': 'semantic_understanding'
  }).sort({timestamp: -1}).limit(5).pretty()
"
```

### Log Structure
```javascript
{
  _id: ObjectId("..."),
  timestamp: ISODate("2025-10-08T..."),
  stage: "query_generation",  // or "semantic_understanding"
  prompt: "Full LLM prompt text",
  response: "Full LLM response JSON",
  metadata: {
    example_id: "112",
    turn: 4,
    question: "and what was the total debt in that same period?",
    constraint_index: 0
  }
}
```

## Debugging Workflow

### Step 1: Identify Failing Examples
```bash
uv run scripts/run-ontology-solver-llm-batch.py
# Check: batch_results_after_kg_rebuild.txt
# Look for: Match: ✗
```

### Step 2: Read Results JSON
```bash
cat data/ontology_solver_results.json | jq '.examples[] | select(.example_id == "112")'
```

Check:
- `values_used` - Are there duplicates? Wrong values?
- `calculation_type` - Is it correct?
- `types_used` - Are value types correct?

### Step 3: Query MongoDB for LLM Logs

**For duplicate value issues**:
```bash
mongosh legion_tools --eval "
  db.llm_interactions.find({
    'metadata.example_id': '112',
    'metadata.turn': 4,
    'metadata.stage': 'semantic_understanding'
  }).pretty()
"
```

Check semantic output:
- How many `entity_constraints` were created?
- Are the filters correct (rowLabel, columnLabel, year)?

Then check SPARQL generation:
```bash
mongosh legion_tools --eval "
  db.llm_interactions.find({
    'metadata.example_id': '112',
    'metadata.turn': 4,
    'metadata.stage': 'query_generation'
  }).pretty()
"
```

Check each constraint's SPARQL:
- Is the FILTER clause too broad?
- Is it matching multiple entities when it should match one?
- Is it using the correct pattern (tableRow/tableColumn vs label/year)?

### Step 4: Verify KG Has Correct Data
```bash
# Query the RDF graph directly
uv run python -c "
from rdflib import Graph
g = Graph()
g.parse('data/preprocessed/112_kg.ttl', format='turtle')

# Find all total debt metrics
query = '''
PREFIX kg: <http://example.org/convfinqa/>
SELECT ?metric ?value ?row ?col
WHERE {
  ?metric a kg:FinancialMetric .
  ?metric kg:tableRow ?row .
  FILTER(CONTAINS(LCASE(?row), 'total debt'))
  ?metric kg:tableColumn ?col .
  ?metric kg:hasValue ?valueEntity .
  ?valueEntity kg:numericValue ?value .
}
'''
for row in g.query(query):
    print(row)
"
```

### Step 5: Create Debug Script

Create `scripts/debug-{example}-turn{N}.py`:
```python
import json
import sys
from pathlib import Path

src_dir = Path(__file__).parent.parent / "src" / "graph-solver"
sys.path.insert(0, str(src_dir))

from semantic_stage import SemanticUnderstandingStage
from query_stage_llm import QueryStageLLM
from calculation_stage import CalculationStage

# Load KG and schema
# Run through pipeline with debug=True
# Print detailed output at each stage
```

## Common Issues and Fixes

### Issue 1: Duplicate Values in Query Results
**Symptom**: Getting [1722.2, 1722.2, 1762.3] instead of [1722.2, 1762.3]

**Root causes**:
1. Semantic stage creating duplicate constraints
2. SPARQL filter too broad (e.g., CONTAINS matching multiple rows)
3. Not using DISTINCT in SPARQL SELECT

**Debug**:
- Check MongoDB: How many entity_constraints?
- Check SPARQL queries: Are filters specific enough?
- Check prompt template: `src/graph-solver/prompts/sparql_generation.j2`

### Issue 2: Sign Errors (0.6 instead of -0.6)
**Symptom**: Subtraction result is positive when it should be negative

**Root cause**: Calculation stage not preserving sign of subtract result

**Fix**: Update `src/graph-solver/calculation_stage.py` to handle negative results

### Issue 3: PercentageValue Double Multiplication
**Symptom**: Getting 637.0 instead of 6.37 for percentage sums

**Root cause**: PercentageValue stores as percentage number (3.0 = 3%), but code multiplies by 100 again

**Fix**: Check if all values are PercentageValue type and skip *100 multiplication

### Issue 4: Missing Previous Answer References
**Symptom**: Getting None when should use previous turn's answer

**Root cause**: Semantic stage not detecting need for previous_answer_references

**Fix**: Update `src/graph-solver/prompts/semantic_understanding.j2` to better detect phrases like "average", "convert to percentage", "multiply by", etc.

## Key Files

### Prompt Templates (Jinja2)
- `src/graph-solver/prompts/semantic_understanding.j2` - Parses question into query spec
- `src/graph-solver/prompts/sparql_generation.j2` - Generates SPARQL queries
- `src/graph-solver/prompts/ontology_extraction.j2` - Extracts entities from documents

### Python Modules
- `src/graph-solver/semantic_stage.py` - Stage 1 implementation
- `src/graph-solver/query_stage_llm.py` - Stage 2 implementation
- `src/graph-solver/calculation_stage.py` - Stage 3 implementation
- `src/graph-solver/ontology_extractor.py` - Builds KG from raw data

### Data Files
- `data/preprocessed/{example_id}_kg.ttl` - RDF knowledge graphs
- `data/preprocessed/{example_id}_kg.json` - KG in JSON format
- `data/ontology_solver_results.json` - Detailed evaluation results

### Scripts
- `scripts/run-ontology-solver-llm-batch.py` - Run full evaluation
- `scripts/build-kgs-with-ontology.py` - Rebuild all knowledge graphs

## Gold Answer Issues and Ambiguous Questions

**CRITICAL**: Not all test failures indicate bugs in our system!

### Recognizing Gold Answer Problems

Sometimes the gold answer is incorrect or the question is genuinely ambiguous. Signs to watch for:

1. **Ambiguous Questions**:
   - "what is the value in 2015?" when multiple metrics are shown
   - "what was the change?" without specifying which metric
   - Pronouns without clear antecedents

2. **Incorrect Gold Answers**:
   - Math doesn't check out (e.g., 10 + 20 ≠ 25)
   - Unit mismatches (gold answer in wrong scale)
   - Sign errors (gold answer has wrong sign)
   - Rounding inconsistencies

3. **Data Mismatches**:
   - Gold answer references data not in the document
   - Question asks about wrong year/period than what's available

### What To Do

When you detect a gold answer issue:
1. **Verify your logic is correct** - double-check the calculation
2. **Document the issue** - note the example, turn, and reason
3. **Move on** - don't waste time trying to match bad gold answers
4. **Track separately** - maintain a list of gold answer issues

Example documentation format:
```
Example 122, Turn 3: Gold answer issue - scale mismatch
  Question: "how much does net income represent in relation to net sales?"
  Our answer: 0.03297 (10500 Millions / 318477 Millions)
  Gold answer: 0.03297
  Issue: KG incorrectly labeled net_sales as "Units" instead of "Millions"
  Verdict: Our logic is correct, KG building issue
```

## Development Workflow

### Debugging Workflow (ALWAYS FOLLOW THIS!)

When investigating ANY failure:

1. **Query MongoDB for actual LLM prompts/responses**:
   ```bash
   mongosh legion_tools --eval "db.llm_interactions.find({'metadata.example_id': 'XXX', 'metadata.turn': Y}).pretty()"
   ```

2. **Check source data** - Does it contain the answer?
   ```python
   # Load convfinqa_dataset.json
   # Find the example
   # Check doc.table AND doc.pre_text/post_text
   ```

3. **Verify KG has the data** - Direct SPARQL query:
   ```python
   from rdflib import Graph
   g = Graph()
   g.parse('data/knowledge-graphs/XXX_kg.ttl', format='turtle')
   # Query for the metric mentioned in the question
   ```

4. **If data missing from KG** → Extraction problem:
   - Rebuild KG: `uv run python scripts/build-kg-for-example.py XXX`
   - Check extraction prompt in MongoDB
   - Verify ontology_extractor passes text content

5. **If data in KG but query fails** → SPARQL generation problem:
   - Check Phase 1 LLM prompt
   - Verify ontology rules guide query generation

**NEVER guess - always check actual data flow!**

### When Fixing an Issue:

1. **Read MongoDB logs** to see actual LLM prompts/responses (use query scripts!)
2. **Check the prompt template** that generated bad output
3. **Verify KG data** is correct with direct SPARQL queries
4. **Create debug script** to isolate the specific turn/example
5. **Document the failure** - Add failure analysis to MongoDB:
   ```bash
   uv run python scripts/add-failure-analysis.py <example_id> analysis.json
   ```
6. **Fix ONE issue at a time** - no batch fixes
7. **Update failure analysis status** when fixed (`status: "fixed"`)
8. **Rebuild KGs if needed** with updated ontology extractor
9. **Re-run batch evaluation** to check for regressions
10. **Target: 100% accuracy** - 21/21 correct answers

### Never Do:
- ❌ **Look at log files** - Query MongoDB with scripts instead!
- ❌ **Run tests with timeout** - Run in background and monitor via MongoDB
- ❌ Guess what's wrong without reading MongoDB logs
- ❌ Change multiple things at once
- ❌ Skip verifying the actual LLM prompts and responses
- ❌ Assume SPARQL is correct without testing directly on the graph
- ❌ Accept partial fixes - must get to 100%

### Always Do:
- ✅ **Run tests in background** - Monitor via MongoDB queries, not timeouts
- ✅ **Use query scripts** - `query-test-results.py`, `query-llm-logs.py`, `add-failure-analysis.py`
- ✅ **Query MongoDB for ALL debugging** - Never look at log files directly
- ✅ Read MongoDB logs for the failing example/turn (with scripts!)
- ✅ Check what the LLM actually received and returned
- ✅ Verify KG has correct data before blaming queries
- ✅ Test SPARQL queries directly on the graph
- ✅ **Document failures** - Add structured failure analysis to MongoDB
- ✅ Create debug scripts for complex issues
- ✅ Fix issues one by one systematically
- ✅ Update failure analysis status when fixed
- ✅ Re-run full batch to check for regressions

## Current Status

**Accuracy**: 10/21 (47.6%)

**Failing Examples**:
- Example 111: Turns 3, 5 (sign handling)
- Example 112: Turns 4, 5, 6 (duplicate values)
- Example 114: Turns 2, 3, 4 (duplicate values)
- Example 115: Turn 2 (previous answer reference)
- Example 116: Turn 2 (previous answer reference)
- Example 117: Turn 1 (SPARQL not finding values)

**Next Steps**:
1. Query MongoDB for Example 112 Turn 4 logs
2. Identify why SPARQL is returning duplicate values
3. Fix the prompt template or query generation logic
4. Test on Example 112, then Example 114 (same issue)
5. Move to next failing example

## MongoDB Query Cheatsheet

```bash
# List all collections
mongosh legion_tools --eval "db.getCollectionNames()"

# Count total LLM interactions
mongosh legion_tools --eval "db.llm_interactions.countDocuments({})"

# Get latest 10 interactions
mongosh legion_tools --eval "db.llm_interactions.find().sort({timestamp: -1}).limit(10).pretty()"

# Filter by stage
mongosh legion_tools --eval "db.llm_interactions.find({'metadata.stage': 'query_generation'}).pretty()"

# Get specific example and turn
mongosh legion_tools --eval "db.llm_interactions.find({'metadata.example_id': '112', 'metadata.turn': 4}).pretty()"

# Export to JSON file
mongosh legion_tools --eval "db.llm_interactions.find({'metadata.example_id': '112'}).forEach(doc => print(JSON.stringify(doc, null, 2)))" > logs_112.json
```

## Important Principles

1. **MongoDB is the source of truth** for debugging - it shows what the LLM actually saw and returned
2. **One query per constraint** - The system generates separate SPARQL for each entity constraint
3. **Value metadata matters** - Don't just pass around numbers, pass the full value object with type and scale
4. **Test the KG directly** - Always verify the graph has correct data before debugging queries
5. **Fix systematically** - One example at a time, one issue at a time, verify no regressions
6. **100% is achievable** - All information exists in the KGs, this is about fixing query generation bugs
