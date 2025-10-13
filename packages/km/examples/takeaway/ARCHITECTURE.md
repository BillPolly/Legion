# ConvFinQA System Architecture

## Overview

The ConvFinQA solver uses a two-phase LLM-based approach to answer multi-turn financial questions over knowledge graphs.

## Core Design Principles

1. **Ontology as Single Source of Truth**: All domain knowledge lives in the ontology, not in prompts
2. **Rich Result Metadata**: Results are wrapped in descriptive objects for future reference resolution
3. **Explicit Reference Resolution**: "this", "that", "it" are resolved using rich context, not just recency
4. **Stateful Conversation**: Each turn builds on previous turns with full context preservation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Test Harness                             │
│  (test_prompt.py / test_example.py)                              │
│                                                                   │
│  Maintains conversation state:                                   │
│  - previous_results: [value1, value2, ...]                       │
│  - previous_results_metadata: [metadata1, metadata2, ...]        │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   PHASE 1: Planning  │
         │   (prompt.j2)        │
         │                      │
         │  Input:              │
         │  - Question          │
         │  - KG Schema         │
         │  - Previous Results  │
         │    WITH METADATA     │
         │  - Ontology          │
         │                      │
         │  Output:             │
         │  - Variable specs    │
         │    (SPARQL/refs)     │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Value Retrieval     │
         │  (execute_plan.py)   │
         │                      │
         │  Resolves:           │
         │  - SPARQL → KG       │
         │  - result_N → value  │
         │  - constants         │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ PHASE 2: Calculation │
         │ (calculation_prompt) │
         │                      │
         │  Input:              │
         │  - Question          │
         │  - Retrieved values  │
         │  - Ontology rules    │
         │                      │
         │  Output:             │
         │  - Formula           │
         │  - Reasoning         │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Formula Execution   │
         │  (execute_formula)   │
         │                      │
         │  Returns:            │
         │  - Numeric value     │
         │  - Scale             │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Store Result        │
         │                      │
         │  Append to:          │
         │  - previous_results  │
         │  - metadata          │
         └──────────────────────┘
```

## The Result Metadata Problem

### Current Implementation (BROKEN)

**What's stored**:
```python
previous_results = [-24.05, 7983.0, -2620.0, 102.11, 2.11]
previous_results_metadata = [
    {'scale': 'Units'},
    {'scale': 'Units'},
    ...
]
```

**Problem**: Phase 1 cannot distinguish between:
- result_0 = -24.05 (UPS change from 2004-2009)
- result_3 = 2.11 (S&P 500 change from 2004-2009)

When Turn 5 asks "how much does **this change** represent...", Phase 1 has NO CONTEXT to know which "change" is meant!

### Correct Implementation (REQUIRED)

**What should be stored**:
```python
previous_results = [-24.05, 7983.0, -2620.0, 102.11, 2.11]  # Same
previous_results_metadata = [
    {
        'value': -24.05,
        'scale': 'Units',
        'description': 'Change in United Parcel Service Inc. performance from 2004 to 2009',
        'entity': 'United Parcel Service Inc.',
        'metric_type': 'change',
        'time_period': '2004 to 2009',
        'question': 'what was the change in the performance of the united parcel service inc . from 2004 to 2009?',
        'phase1_variables': ['ups_2004', 'ups_2009'],
        'phase2_formula': 'ups_2009 - ups_2004'
    },
    {
        'value': -24.05,
        'scale': 'Units',
        'description': 'Percentage representation of UPS change relative to 2004 performance',
        'entity': 'United Parcel Service Inc.',
        'metric_type': 'percentage',
        'base_year': '2004',
        'question': 'and how much does this change represent in relation to that performance in 2004, in percentage?',
        'phase1_variables': ['change', 'performance_2004'],
        'phase2_formula': 'change / performance_2004 * 100'
    },
    # ...
    {
        'value': 2.11,
        'scale': 'Units',
        'description': 'Change in S&P 500 Index performance from 2004 to 2009',
        'entity': 'S&P 500 Index',
        'metric_type': 'change',
        'time_period': '2004 to 2009',
        'question': 'what was, then, the change in that performance from 2004 to 2009?',
        'phase1_variables': ['sp_500_index_2004', 'sp_500_index_2009'],
        'phase2_formula': 'sp_500_index_2009 - sp_500_index_2004'
    }
]
```

## Phase 1: Query Planning

### Inputs

1. **Current Question**: The user's question for this turn
2. **KG Schema**: Structure of the knowledge graph (from ontology in test case)
3. **Conversation History**: List of (question, answer) pairs from previous turns
4. **Previous Results Metadata**: Rich context for each previous result
5. **Core Ontology**: Semantic patterns and rules

### Responsibilities

1. **Entity Resolution**: What entities are being asked about? (UPS, S&P 500, etc.)
2. **Metric Identification**: What metric? (performance, change, percentage)
3. **Time Period**: What time period? (2004, 2009, etc.)
4. **Reference Resolution**: What does "this", "that", "it" refer to?
5. **Value Specification**: How to retrieve each value?
   - SPARQL query against KG
   - Reference to previous result (result_N)
   - Constant value

### Output Format

```json
{
  "values": {
    "descriptive_variable_name": {
      "sparql": "SELECT ?value WHERE {...}",
      "description": "What this value represents"
    },
    "another_variable": "result_3",
    "constant_var": 100.0
  }
}
```

**CRITICAL**: Variable names must be:
- Descriptive of what they represent
- Valid Python identifiers
- Used consistently in Phase 2

### Reference Resolution Rules

**"this [metric]"** → Most recent result of that metric type FOR THE CURRENT ENTITY CONTEXT

Example:
```
Turn 1: UPS change → result_0
Turn 4: S&P 500 change → result_3
Turn 5: "this change" → result_3 (current context is S&P 500)
```

**"that [metric] in [year]"** → Previous result that retrieved that specific metric

Example:
```
Turn 2: "nasdaq in 2015" → result_1
Turn 4: "that stock in 2015" → result_1 (reuse, don't re-query)
```

**Entity Context Tracking**:
- Track which entity is the focus of each turn
- "this" and "that" refer within the current entity context
- When entity switches, context resets

## Phase 2: Calculation

### Inputs

1. **Current Question**: The user's question
2. **Conversation History**: Previous (question, answer) pairs
3. **Retrieved Values**: Dict of {var_name: {value, scale, source}}
4. **Core Ontology**: Calculation rules and patterns

### Responsibilities

1. **Pattern Matching**: Match question to ontology patterns
2. **Formula Generation**: Create formula using retrieved variable names
3. **Transformation Application**: Apply metric-specific rules (abs(), etc.)
4. **Unit Handling**: Respect scale conversions if question specifies units

### Output Format

```json
{
  "formula": "variable1 - variable2",
  "reasoning": "Explanation referencing ontology patterns"
}
```

### Sign Preservation Rules

**DO NOT use abs() unless**:
1. A MetricTransformationRule explicitly requires it for that specific metric type, OR
2. The question explicitly asks for "magnitude" or "absolute value"

**Variable names indicate sign preservation**:
- If variable name contains "change", "difference", "delta" → PRESERVE SIGN
- Negative = decrease, Positive = increase

## Value Storage After Each Turn

After each turn completes:

```python
# Store numeric value for calculation
previous_results.append(our_answer_full)

# Store RICH metadata for reference resolution
previous_results_metadata.append({
    'value': our_answer_full,
    'scale': output_scale,
    'description': generate_description(
        question,
        phase1_output,
        phase2_output
    ),
    'entity': extract_entity(phase1_output['values']),
    'metric_type': classify_metric_type(question),
    'question': question,
    'phase1_variables': list(phase1_output['values'].keys()),
    'phase2_formula': phase2_output['formula']
})
```

## Helper Functions Needed

### 1. `generate_description(question, phase1, phase2)`

Generates human-readable description of what this result represents.

Examples:
- "Change in United Parcel Service Inc. performance from 2004 to 2009"
- "Percentage representation of UPS change relative to 2004 performance"
- "S&P 500 Index value in 2009"

### 2. `extract_entity(phase1_variables)`

Extracts entity name from variable names.

Examples:
- `ups_2004`, `ups_2009` → "United Parcel Service Inc." or "UPS"
- `sp_500_index_2009` → "S&P 500 Index"
- `net_sales_2001` → "net sales"

### 3. `classify_metric_type(question)`

Classifies what type of metric this is.

Types:
- `change` - difference between values
- `percentage` - ratio expressed as percentage
- `value` - direct value retrieval
- `ratio` - division of two values
- `sum` - addition
- `average` - mean

## Phase 1 Prompt Enhancement

**Before** (insufficient context):
```
Previous Results:
result_0: -24.05
result_1: 7983.0
result_2: -2620.0
result_3: 2.11
```

**After** (rich context):
```
Previous Results:
result_0: -24.05 (Units)
  Description: Change in United Parcel Service Inc. performance from 2004 to 2009
  Entity: United Parcel Service Inc.
  Type: change
  Question: "what was the change in the performance of the united parcel service inc . from 2004 to 2009?"

result_1: -24.05 (Units)
  Description: Percentage representation of UPS change relative to 2004 performance
  Entity: United Parcel Service Inc.
  Type: percentage
  Question: "and how much does this change represent in relation to that performance in 2004, in percentage?"

result_2: 102.11 (Units)
  Description: S&P 500 Index value in 2009
  Entity: S&P 500 Index
  Type: value
  Question: "what was the performance value of the s&p 500 index in 2009?"

result_3: 2.11 (Units)
  Description: Change in S&P 500 Index performance from 2004 to 2009
  Entity: S&P 500 Index
  Type: change
  Question: "what was, then, the change in that performance from 2004 to 2009?"
```

Now when Turn 5 asks "how much does **this change** represent...", Phase 1 can see:
- Previous turn (result_3) was about "S&P 500 Index" entity
- Current context is S&P 500 Index
- "this change" = result_3 (most recent change for current entity)

## Testing Strategy

### Unit Tests
- `generate_description()` with various question patterns
- `extract_entity()` with various variable names
- `classify_metric_type()` with question types

### Integration Tests
- Full turn execution with metadata storage
- Multi-turn conversations with entity switching
- Reference resolution across entity boundaries

### Example-Based Validation
- Process examples 0-9 incrementally
- Verify 100% accuracy on each before moving on
- Document any patterns that need ontology additions

## Success Criteria

1. ✅ Phase 1 correctly resolves "this", "that", "it" even with entity switching
2. ✅ Previous results have rich, queryable metadata
3. ✅ Metadata is shown in Phase 1 prompt for context
4. ✅ Helper functions extract entity/type/description correctly
5. ✅ Example 3 reaches 100% accuracy (all 6 turns pass)

## Migration Path

1. Add helper functions: `generate_description`, `extract_entity`, `classify_metric_type`
2. Update result storage in `test_prompt.py` to save rich metadata
3. Update Phase 1 prompt to display rich metadata
4. Test on Example 3 to verify Turn 5-6 now pass
5. Continue with Examples 4-9
