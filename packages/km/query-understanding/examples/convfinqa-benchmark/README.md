# ConvFinQA Benchmark - Financial Reasoning over Tables

**A complete implementation of the Custom Interpreter Pattern for financial table question answering.**

## Overview

This benchmark demonstrates how to extend the query-understanding pipeline for domain-specific tasks requiring custom execution logic. It implements the **3-layer architecture**:

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Generic Pipeline (QueryUnderstandingPipeline)      │
│ - Phase 1-4: Question → LogicalSkeleton                      │
│ - Domain-agnostic semantic understanding                     │
└──────────────────────────────┬───────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ Layer 2: Domain Bridge (QueryInterpreter)                   │
│ - LogicalSkeleton → Execution Parameters                     │
│ - Entity name extraction and normalization                   │
│ - Year extraction from temporal expressions                  │
│ - Conversation history reference resolution                  │
└──────────────────────────────┬───────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ Layer 3: Pure Execution (FactQueryExecutor)                  │
│ - Table value lookup by entity and year                      │
│ - Arithmetic operation execution                             │
│ - Program generation (subtract, divide, percentage)          │
└──────────────────────────────────────────────────────────────┘
```

## Key Files

### 1. ConvFinQAOrchestrator.js
**Orchestrator** - Manages the complete pipeline lifecycle

**Responsibilities:**
- Initialize FinancialKGBuilder with document
- Create QueryUnderstandingPipeline with per-example ontology
- Wire pipeline → interpreter → executor
- Maintain conversation history across turns
- Coordinate multi-turn conversations

**API:**
```javascript
const orchestrator = new ConvFinQAOrchestrator(resourceManager);
await orchestrator.initialize(document, exampleId);
const result = await orchestrator.processQuestion(question);
const results = await orchestrator.processConversation(questions);
```

### 2. QueryInterpreter.js
**Bridge Layer** - Translates LogicalSkeleton to execution parameters

**Responsibilities:**
- Extract entity names from LogicalSkeleton atoms
- Normalize entity names to match facts structure
- Extract years from original question text
- Resolve references to previous results ("this change", "that performance")
- Handle coordination operations ("difference between X and Y")

**Key Methods:**
- `interpret(skeleton, context)` - Main entry point
- `_interpretLookup(skeleton, context)` - Simple table lookup
- `_interpretOperation(skeleton)` - Arithmetic operations
- `_interpretCoordinationOperation(skeleton, op)` - Two-entity operations
- `_usesPreviousResults(operation)` - Reference resolution
- `_normalizeEntityName(name)` - Entity normalization

**Example Flow:**

**Input (LogicalSkeleton):**
```json
{
  "vars": ["?x"],
  "atoms": [
    ["rel", ":performance", ":united_parcel_service_inc", "?x"]
  ],
  "operations": [
    {
      "type": "subtract",
      "attribute": "performance",
      "fromYear": 2004,
      "toYear": 2009
    }
  ]
}
```

**Output (Execution Parameters):**
```json
{
  "type": "operation",
  "entity": "ups",
  "attribute": "performance",
  "fromYear": 2004,
  "toYear": 2009,
  "operationType": "subtract",
  "format": "absolute"
}
```

### 3. FactQueryExecutor.js
**Pure Data Layer** - Executes queries against facts structure

**Responsibilities:**
- Lookup values in facts: `{ entityId: { attribute: { year: value } } }`
- Execute arithmetic operations (subtract, divide, percentage)
- Generate arithmetic programs for ArithmeticExecutor
- Return results with program traces

**Supported Operations:**
- **Lookup**: Simple value retrieval
- **Operation**: Arithmetic on two values from same entity
- **Operation on Value**: Arithmetic using previous result
- **Coordination Operation**: Arithmetic on values from different entities

**Example:**
```javascript
const executor = new FactQueryExecutor(facts);

// Lookup
const result = executor.execute({
  type: 'lookup',
  entity: 'ups',
  attribute: 'performance',
  year: 2009
});
// { answer: 75.95, type: 'lookup' }

// Operation
const result = executor.execute({
  type: 'operation',
  entity: 'ups',
  attribute: 'performance',
  fromYear: 2004,
  toYear: 2009,
  operationType: 'subtract',
  format: 'absolute'
});
// { answer: -24.05, type: 'computed', program: 'subtract(75.95, 100)' }
```

### 4. FinancialKGBuilder.js
**Ontology Builder** - Creates lightweight per-example knowledge graph

**Responsibilities:**
- Extract entities (companies, indices) from table columns
- Extract attributes (always "performance" for ConvFinQA)
- Parse years from date strings
- Build ontology schema with synonyms
- Index ontology in Qdrant for semantic search
- Store facts in simple structure

**Process:**
1. Parse table structure → extract entities, attributes, facts
2. Build ontology schema (classes + properties + individuals)
3. Index ontology in Qdrant (enables Phase 3 semantic mapping)
4. Store facts in structure: `{ entityId: { attribute: { year: value } } }`

**Proper Ontology Structure:**

The ontology follows correct RDF/OWL semantics:

```javascript
{
  classes: [
    {
      iri: ":Company",
      type: "class",
      label: "Company",
      description: "A business organization or corporation"
    },
    {
      iri: ":Index",
      type: "class",
      label: "Index",
      description: "A financial market index or average"
    }
  ],

  individuals: [
    {
      iri: ":ups",
      type: "individual",
      label: "United Parcel Service",
      instanceOf: ":Company",    // UPS is-a Company
      aliases: ["UPS", "ups", "united parcel service"]
    },
    {
      iri: ":sp500",
      type: "individual",
      label: "S&P 500 Index",
      instanceOf: ":Index",      // S&P 500 is-a Index
      aliases: ["S&P 500", "sp500", "s&p 500 index"]
    }
  ],

  properties: [
    {
      iri: ":performance",
      type: "property",
      label: "Performance",
      domain: ":Company",
      range: "xsd:decimal"
    }
  ]
}
```

**Key Principles:**
- **Classes** = Abstract types (Company, Index)
- **Individuals** = Concrete instances (UPS, S&P500)
- **Properties** = Relations between entities
- Each individual has `instanceOf` relationship to a class

**Why Per-Example Ontology?**
- Each ConvFinQA example has different entities (different companies/indices)
- Prevents cross-contamination between benchmark examples
- Enables clean evaluation (each example is isolated)
- Lightweight and fast (only entities in that example's table)

### 5. ArithmeticExecutor.js
**Arithmetic DSL** - Executes arithmetic programs

**Responsibilities:**
- Parse arithmetic programs (e.g., "subtract(75.95, 100), divide(#0, 100)")
- Execute operations (add, subtract, multiply, divide)
- Track intermediate results (#0, #1, #2, ...)
- Return final result

**Program Format:**
```javascript
"subtract(75.95, 100), divide(#0, 100), multiply(#1, 100)"
// Step 1: subtract(75.95, 100) → -24.05 (stored as #0)
// Step 2: divide(-24.05, 100) → -0.2405 (stored as #1)
// Step 3: multiply(-0.2405, 100) → -24.05 (final answer)
```

## Architecture Flow Example

**Question:** "What was the change in the performance of UPS from 2004 to 2009?"

### Layer 1: Pipeline (Generic)

**Phase 1 (LLM):** Normalize question
```json
{
  "text": "What was the change in the performance of UPS from 2004 to 2009?",
  "entities": { "UPS": ":united_parcel_service_inc" },
  "temporal": { "fromYear": 2004, "toYear": 2009 }
}
```

**Phase 2 (Parser):** Parse to NP/VP AST
```json
{
  "S": {
    "NP": { "Det": "what", "Head": "change" },
    "VP": { "Verb": "was", "Comps": [...] }
  }
}
```

**Phase 3 (Semantic):** Map to LogicalSkeleton
```json
{
  "vars": ["?x"],
  "atoms": [
    ["rel", ":performance", ":united_parcel_service_inc", "?x"]
  ],
  "operations": [
    {
      "type": "subtract",
      "fromYear": 2004,
      "toYear": 2009
    }
  ]
}
```

### Layer 2: QueryInterpreter (Bridge)

**Input:** LogicalSkeleton + Question Context

**Processing:**
1. Identify operation type: "subtract"
2. Extract entity: "united_parcel_service_inc" → normalize to "ups"
3. Extract years: fromYear=2004, toYear=2009
4. Verify entity exists in facts

**Output:** Execution Parameters
```json
{
  "type": "operation",
  "entity": "ups",
  "attribute": "performance",
  "fromYear": 2004,
  "toYear": 2009,
  "operationType": "subtract",
  "format": "absolute"
}
```

### Layer 3: FactQueryExecutor (Pure Data)

**Input:** Execution Parameters

**Processing:**
1. Lookup entity in facts: `:ups`
2. Get attribute data: `:performance`
3. Retrieve values: 2004 → 100, 2009 → 75.95
4. Generate program: `subtract(75.95, 100)`
5. Execute via ArithmeticExecutor

**Output:** Result
```json
{
  "answer": -24.05,
  "type": "computed",
  "program": "subtract(75.95, 100)",
  "operation": "subtract",
  "format": "absolute"
}
```

## Multi-Turn Conversation Example

**Document:**
```json
{
  "table": {
    "12/31/04": { "united parcel service inc .": 100, "s&p 500 index": 100 },
    "12/31/09": { "united parcel service inc .": 75.95, "s&p 500 index": 102.11 }
  }
}
```

**Conversation:**

**Turn 1:** "What was the change in the performance of UPS from 2004 to 2009?"
- **Answer:** -24.05
- **Program:** `subtract(75.95, 100)`
- **Stored in history:** entity=ups, answer=-24.05

**Turn 2:** "And how much does this change represent in relation to that performance in 2004, in percentage?"
- **Interpreter:** Detects reference to previous result ("this change")
- **Lookup:** Gets base value (performance in 2004 = 100)
- **Answer:** -24.05%
- **Program:** `divide(-24.05, 100), multiply(#0, 100)`

**Turn 3:** "What was the performance value of the S&P 500 index in 2009?"
- **Interpreter:** Simple lookup
- **Answer:** 102.11
- **Type:** lookup

**Turn 4:** "What was, then, the change in that performance from 2004 to 2009?"
- **Interpreter:** "that performance" refers to S&P 500 from Turn 3
- **Answer:** 2.11
- **Program:** `subtract(102.11, 100)`

**Turn 5:** "And how much does this change represent in relation to that performance in 2004, in percentage?"
- **Answer:** 2.11%
- **Program:** `divide(2.11, 100), multiply(#0, 100)`

**Turn 6:** "What is the difference between the percent representation of UPS and the S&P 500 index?"
- **Interpreter:** Coordination operation - retrieve both values from history
- **UPS:** -24.05% (from Turn 2)
- **S&P 500:** 2.11% (from Turn 5)
- **Answer:** -26.16
- **Program:** `subtract(-24.05, 2.11)`

## Running the Benchmark

### Single Example
```bash
node examples/convfinqa-benchmark/run-benchmark.js 0 1
```

### Multiple Examples
```bash
node examples/convfinqa-benchmark/run-benchmark.js 0 10
```

### Run Tests
```bash
npm test -- examples/convfinqa-benchmark/__tests__
```

## Test Coverage

**Integration Tests:** `__tests__/ConvFinQA.integration.test.js`
- ✅ Turn 1: Arithmetic operation on entity
- ✅ Turn 1 + Turn 2: Operation on previous result
- ✅ Full 6-turn conversation (100% accuracy)

**Unit Tests:** `__tests__/QueryInterpreter.test.js`
- ✅ Entity name extraction
- ✅ Year extraction from questions
- ✅ Reference resolution from history
- ✅ Coordination operations
- ✅ Entity normalization

## Design Decisions

### Why Three Layers?

**Layer 1 (Pipeline):** Domain-agnostic
- Reusable across all domains
- Well-tested generic NLP components
- Produces universal LogicalSkeleton

**Layer 2 (Interpreter):** Domain bridge
- Maps generic semantics to domain-specific parameters
- Handles domain-specific context (conversation history)
- Isolated from both pipeline and data layer

**Layer 3 (Executor):** Pure data operations
- No semantic understanding
- Only data lookup and arithmetic
- Deterministic and fast
- Easy to test

### Why QueryInterpreter?

The interpreter is **necessary** because:
1. LogicalSkeleton is domain-agnostic (doesn't know about table structure)
2. Entity names need normalization (UPS vs united parcel service inc.)
3. Years must be extracted from original question (not in skeleton)
4. Conversation history requires domain-specific reference resolution
5. Arithmetic operations need concrete parameters (fromYear, toYear, etc.)

Without the interpreter, you'd need to:
- Add ConvFinQA-specific logic to the pipeline (breaks domain-agnostic design)
- OR add complex logic to the executor (breaks separation of concerns)

The interpreter keeps both layers clean and focused.

## Key Insights

### 1. LogicalSkeleton is Universal
The same LogicalSkeleton can be interpreted differently by different domains:
- **SPARQL backend:** Convert to triple patterns
- **ConvFinQA:** Extract entity names for table lookup
- **Calculator:** Extract arithmetic operations

### 2. Conversation History is Domain-Specific
Reference resolution ("this change", "that performance") requires:
- Understanding what previous results mean
- Mapping entities across turns
- Resolving coordination ("difference between X and Y")

The interpreter handles this using domain knowledge.

### 3. Per-Example Ontology is Pragmatic
Instead of a massive financial ontology:
- Create lightweight ontology per example
- Only index entities in that example's table
- Fast initialization (seconds, not minutes)
- Clean isolation between examples

## Architecture Benefits

✅ **Clean Separation:** Pipeline, interpreter, executor are independent
✅ **Testable:** Each layer can be tested separately
✅ **Reusable:** Pipeline is generic, works for any domain
✅ **Extensible:** Add new domains by creating new interpreter/executor
✅ **Maintainable:** Changes to one layer don't affect others
✅ **Correct:** 100% accuracy on ConvFinQA test cases

## Future Enhancements

**Potential improvements:**
1. Cache ontologies across similar examples (reduce Qdrant indexing)
2. Support more arithmetic operations (sum, average, max, min)
3. Handle more complex temporal expressions ("between 2004 and 2009")
4. Support nested operations ("change in the percentage change")
5. Add support for categorical tables (non-numeric data)

## Comparison with Semantic-Financial-KG

**convfinqa-benchmark (this):**
- Lightweight per-example ontology
- Optimized for benchmark evaluation
- Simple facts structure (no RDF)
- Custom arithmetic executor
- Fast and pragmatic

**semantic-financial-kg:**
- Comprehensive RDF knowledge graph
- Proper entity reification
- Relationship metadata and provenance
- SPARQL query support
- Full semantic web stack

**Use convfinqa-benchmark when:** Benchmark evaluation, quick prototyping
**Use semantic-financial-kg when:** Production semantic KG, reasoning, provenance tracking

## References

- [Query Understanding Design](../../docs/DESIGN.md)
- [ConvFinQA Dataset Paper](https://arxiv.org/abs/2210.16039)
- [Integration Patterns](../../README.md#integration-patterns)
