# @legion/query-understanding

Natural language question understanding and query generation for Legion knowledge management.

## Overview

This package transforms natural language questions into executable queries against knowledge bases using a 4-phase deterministic pipeline:

1. **Phase 1 (LLM)**: Rewrite & Resolve - Normalize questions, resolve references
2. **Phase 2 (Deterministic)**: NP/VP AST - Parse into minimal tree structure
3. **Phase 3 (Semantic Search)**: Semantic Mapping - Map to ontology concepts
4. **Phase 4 (DataSource)**: Query Generation - Convert to DataScript queries

## Status

**MVP COMPLETE** ✅
- ✅ All 4 phases implemented and tested
- ✅ 292 passing tests (100% pass rate)
  - Phase 1: Rewrite & Resolve (20 tests)
  - Phase 2: NP/VP Parsing (45 tests)
  - Phase 3: Semantic Mapping (68 tests)
  - Phase 4: Query Generation (30 tests)
  - Pipeline Integration (30 tests)
  - Multi-Turn Support (28 tests)
  - Graph Context Integration (45 tests) **NEW!**
- ✅ Real LLM integration (Anthropic Claude)
- ✅ Real vector search (Qdrant + Nomic embeddings)
- ✅ Multi-turn conversation with graph-based reference resolution
- ✅ Complete demos with actual query execution
- ✅ NO MOCKS in integration tests

## Installation

```bash
npm install @legion/query-understanding
```

## Quick Start

### Single-Turn Questions

```javascript
import { QueryUnderstandingPipeline } from '@legion/query-understanding';
import { ResourceManager } from '@legion/resource-manager';

// Initialize ResourceManager with required services
const resourceManager = await ResourceManager.getInstance();

// Create and initialize pipeline
const pipeline = new QueryUnderstandingPipeline(resourceManager);
await pipeline.initialize();

// Process a question through all 4 phases
const result = await pipeline.process("Which countries border Germany?");

console.log(result.canonicalQuestion);  // Phase 1 output
console.log(result.ast);                // Phase 2 output
console.log(result.skeleton);           // Phase 3 output
console.log(result.query);              // Phase 4 output - DataScript query
```

### Multi-Turn Conversations (NEW!)

```javascript
import { MultiTurnPipeline } from '@legion/query-understanding';
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();

// Create multi-turn pipeline with conversation tracking
const pipeline = new MultiTurnPipeline(resourceManager, {
  maxTurns: 10,
  domain: 'geography'
});

await pipeline.initialize();

// Turn 1: Initial question
const result1 = await pipeline.ask("Which countries border Germany?");
// Answer: France, Poland, Austria, Switzerland, Belgium

// Turn 2: Follow-up with ellipsis (automatically resolved!)
const result2 = await pipeline.ask("What about France?");
// LLM resolves to: "Which countries border France?"
// Answer: Germany, Spain, Italy, Switzerland, Belgium

// Turn 3: Pronoun resolution
const result3 = await pipeline.ask("How many are there?");
// Uses context from previous turn
// Answer: 5 countries

// Access conversation context
const entities = pipeline.getRecentEntities();
const history = pipeline.getContext().getConversationHistory();
```

## Architecture

### Dependencies

The pipeline requires these services from ResourceManager:

- **llmClient**: For Phase 1 (question normalization)
- **semanticSearch**: For Phase 3 (ontology mapping)
- **ontology**: For Phase 3 (concept mapping)
- **dataSource**: For Phase 4 (query execution)

### Data Flow

```
Natural Language Question
    ↓
Phase 1: Rewrite & Resolve (LLM)
    → CanonicalQuestion.json
    ↓
Phase 2: NP/VP AST (Deterministic Parser)
    → NPVP_AST.json
    ↓
Phase 3: Semantic Mapping (Semantic Search)
    → LogicalSkeleton.json + AmbiguityReport.json
    ↓
Phase 4: Query Generation (DataScript Conversion)
    → DataScript Query
    ↓
DataSource Adapters
    → SPARQL / Cypher / MongoDB / Datalog
    ↓
Query Results
```

## JSON Schemas

All phase outputs are validated against JSON schemas:

- **CanonicalQuestion** (`schemas/CanonicalQuestion.schema.json`)
  - Normalized question text
  - Resolved entities, dates, units
  - WH-role identification

- **NPVP_AST** (`schemas/NPVP_AST.schema.json`)
  - Minimal tree structure (NP/VP/Complements/Modifiers)
  - WH-focus tracking
  - Nested structures (relative clauses, coordination)

- **LogicalSkeleton** (`schemas/LogicalSkeleton.schema.json`)
  - Variables, atoms (isa/rel/has/filter/op)
  - Projection (variables or aggregations)
  - Order, limit, query type

- **AmbiguityReport** (`schemas/AmbiguityReport.schema.json`)
  - Unmapped tokens
  - Multi-sense candidates
  - Role conflicts
  - Disambiguation choices

## API Reference

### QueryUnderstandingPipeline

#### Constructor

```javascript
new QueryUnderstandingPipeline(resourceManager)
```

**Parameters:**
- `resourceManager` (Object, required): ResourceManager instance

**Throws:**
- `Error` if ResourceManager not provided

#### initialize(options)

Initialize pipeline with required dependencies.

**Parameters:**
- `options.dataSource` (string): DataSource name (default: 'dataStoreDataSource')
- `options.domain` (string): Optional domain hint for disambiguation

**Returns:** `Promise<void>`

**Throws:**
- `Error` if required resources not available
- `Error` if DataSource doesn't implement query() method

#### process(question, context)

Process a natural language question through all 4 phases.

**Parameters:**
- `question` (string, required): Natural language question
- `context` (Object): Optional context (conversation history, domain hints)

**Returns:** `Promise<Object>` with queries and intermediate artifacts

**Throws:**
- `Error` if pipeline not initialized
- `Error` if question is not a non-empty string
- `Error` if processing fails (FAIL FAST)

#### isReady()

Check if pipeline is ready to process questions.

**Returns:** `boolean` - True if initialized and all dependencies available

#### getStatus()

Get pipeline status and configuration.

**Returns:** `Object` with initialization state, config, and dependency status

## Integration Patterns

The query-understanding pipeline is **domain-agnostic** and produces a generic LogicalSkeleton representation. There are two main patterns for integrating with backend systems:

### Pattern 1: Direct DataSource Integration (Standard Queries)

**Use when:** Querying standard knowledge graphs, triple stores, or document databases

**Flow:**
```
Pipeline → LogicalSkeleton → DataScriptConverter → DataSource.query() → Results
```

**Backend Support:**
- SPARQL (RDF triple stores)
- Cypher (graph databases)
- MongoDB (document databases)
- Datalog engines

**Example:**
```javascript
const pipeline = new QueryUnderstandingPipeline(resourceManager);
await pipeline.initialize({
  dataSource: 'tripleStoreDataSource'  // or 'graphDataSource', 'dataStoreDataSource'
});

const result = await pipeline.process("Which countries border Germany?");
// result.query contains DataScript format
// result.results contains executed query results
```

### Pattern 2: Custom Interpreter Bridge (Task-Specific Execution)

**Use when:** Domain requires custom execution logic beyond standard queries

**Flow:**
```
Pipeline → LogicalSkeleton → CustomInterpreter → CustomExecutor → Results
```

**Architecture:**
```
┌──────────────────────────────────────────────────────────────┐
│ Generic Pipeline (query-understanding core)                  │
│ - Phase 1-4: Question → LogicalSkeleton                      │
└──────────────────────────────┬───────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ Custom Interpreter (domain-specific bridge)                  │
│ - Translates LogicalSkeleton to domain-specific params       │
│ - Handles domain-specific context (conversation history)     │
│ - Resolves domain-specific references                        │
└──────────────────────────────┬───────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│ Custom Executor (pure data operations)                       │
│ - Lookup values in domain-specific data structures           │
│ - Execute domain-specific operations                         │
│ - Return results in expected format                          │
└──────────────────────────────────────────────────────────────┘
```

**Example: ConvFinQA Benchmark**

See `examples/convfinqa-benchmark/` for a complete implementation:

```javascript
// ConvFinQAOrchestrator orchestrates the pipeline
import { ConvFinQAOrchestrator } from './examples/convfinqa-benchmark/ConvFinQAOrchestrator.js';

const orchestrator = new ConvFinQAOrchestrator(resourceManager);

// Initialize with financial document (table + text)
await orchestrator.initialize(document, exampleId);

// Process multi-turn conversation
const result = await orchestrator.processQuestion(
  "what was the change in the performance of UPS from 2004 to 2009?"
);
// Result: { answer: -24.05, type: 'computed', program: 'subtract(75.95, 100)' }
```

**Key Components:**

1. **QueryInterpreter** (`examples/convfinqa-benchmark/QueryInterpreter.js`)
   - Bridges LogicalSkeleton → Execution Parameters
   - Extracts entity names, years, operation types
   - Resolves references from conversation history
   - Maps coordination operations ("difference between X and Y")

2. **FactQueryExecutor** (`examples/convfinqa-benchmark/FactQueryExecutor.js`)
   - Pure data lookup and arithmetic execution
   - Performs table value lookups
   - Executes arithmetic operations (subtract, divide, percentage)
   - Uses ArithmeticExecutor for program evaluation

3. **FinancialKGBuilder** (`examples/convfinqa-benchmark/FinancialKGBuilder.js`)
   - Creates per-example lightweight ontology
   - Indexes entities and attributes in Qdrant
   - Builds facts structure: `{ entityId: { attribute: { year: value } } }`
   - Enables semantic mapping in Phase 3

**Architecture Benefits:**
- ✅ Generic pipeline remains domain-agnostic
- ✅ Custom logic isolated in interpreter/executor
- ✅ Easy to add new domains (create new interpreter/executor pair)
- ✅ Clean separation: language understanding vs. execution
- ✅ Testable at each layer

**When to Use This Pattern:**
- Complex arithmetic or symbolic reasoning required
- Domain-specific data structures (tables, time series, etc.)
- Custom operation semantics (percentage calculations, aggregations)
- Multi-turn conversations with domain-specific reference resolution
- Benchmark evaluation requiring specific execution semantics

**See Also:**
- ConvFinQA benchmark: `examples/convfinqa-benchmark/README.md`
- Integration tests: `examples/convfinqa-benchmark/__tests__/ConvFinQA.integration.test.js`

## Design Principles

1. **FAIL FAST**: No fallbacks, no defaults - explicit errors
2. **Deterministic Core**: Phases 2-4 produce same output for same input
3. **Schema Validation**: All outputs validated with `@legion/schema`
4. **Separation of Concerns**: Language understanding vs data access
5. **Pluggable DataSources**: Works with any DataSource implementation
6. **Domain Agnostic Pipeline**: LogicalSkeleton is universal, interpreters are domain-specific

## Testing

Run all tests:

```bash
npm test
```

Run specific phase tests:

```bash
npm test -- __tests__/phase1/
npm test -- __tests__/phase2/
npm test -- __tests__/phase3/
npm test -- __tests__/phase4/
npm test -- __tests__/context/
npm test -- __tests__/multi-turn/
```

Current test coverage (292 tests, 100% pass rate):
- **Phase 1: Rewrite & Resolve**: 20 tests
- **Phase 2: NP/VP Parsing**: 45 tests
- **Phase 3: Semantic Mapping**: 68 tests
- **Phase 4: Query Generation**: 30 tests
- **Pipeline Integration**: 30 tests
- **ConversationContext**: 16 tests
- **MultiTurnPipeline**: 12 tests
- **Graph Context Integration**: 45 tests (17 GraphContextRetriever + 14 MultiTurnPipeline + 14 E2E)

## Examples

### Complete Demo with Query Execution

See `examples/complete-demo-with-answers/` for a full working demo:

```bash
node examples/complete-demo-with-answers/demo.js
```

**Demonstrates**:
- Question → Query → Execution → Real Answers
- All 4 phases in action
- SimpleJSONExecutor with geography data
- 3 sample questions with results

### Multi-Turn Conversation Demo (NEW!)

See `examples/multi-turn-conversation-demo.js` for graph-based reference resolution:

```bash
node examples/multi-turn-conversation-demo.js
```

**Demonstrates**:
- Graph context retrieval for entities
- Possessive reference resolution ("its capital")
- Ellipsis expansion ("What about France?")
- Multi-turn context persistence (5+ turns)
- Entity salience tracking for reference resolution

**Features**:
- Three complete conversation scenarios
- Realistic geography data with relationships
- No external dependencies (runs standalone)
- Shows context entities at each turn

### ConvFinQA Benchmark (NEW!)

See `examples/convfinqa-benchmark/` for financial reasoning over tables:

```bash
node examples/convfinqa-benchmark/run-benchmark.js [startIndex] [count]
```

**Demonstrates:**
- Financial table processing (performance indices over time)
- Multi-turn arithmetic reasoning (change, percentage, difference)
- Conversation history for reference resolution
- Custom interpreter pattern for domain-specific execution
- Complete 6-turn conversations with 100% accuracy

**Features:**
- 3-layer architecture: Pipeline → Interpreter → Executor
- Lightweight per-example ontology creation
- Arithmetic program generation and execution
- Full ConvFinQA dataset support

### More Examples

See `/docs/DESIGN.md` for comprehensive examples of:
- Simple entity queries
- Temporal queries with comparatives
- Ambiguity handling
- Cross-domain queries

## Creating Custom Interpreters

Want to build a custom interpreter for your domain? Follow this pattern:

### Step 1: Define Your Data Model

Decide how your domain data is structured:

```javascript
// Example: Financial data
const facts = {
  ':ups': {
    ':performance': {
      2004: 100,
      2009: 75.95
    }
  }
};

// Example: Graph data
const graphData = {
  nodes: [...],
  edges: [...]
};

// Example: Time series data
const timeSeries = {
  temperature: [
    { timestamp: '2024-01-01', value: 72 },
    { timestamp: '2024-01-02', value: 75 }
  ]
};
```

### Step 2: Create Your Interpreter

Extend the pattern from `QueryInterpreter`:

```javascript
export class MyCustomInterpreter {
  constructor(dataModel) {
    this.dataModel = dataModel;
  }

  /**
   * Translate LogicalSkeleton to execution parameters
   */
  interpret(skeleton, context = {}) {
    // 1. Extract entities from skeleton.atoms
    const entities = this._extractEntities(skeleton.atoms);

    // 2. Extract temporal information
    const temporal = this._extractTemporal(skeleton);

    // 3. Handle operations
    const operations = this._extractOperations(skeleton.operations);

    // 4. Resolve references from context
    const resolved = this._resolveReferences(entities, context);

    // 5. Return execution parameters
    return {
      type: this._determineQueryType(skeleton),
      entities: resolved,
      temporal,
      operations,
      // ... domain-specific fields
    };
  }

  _extractEntities(atoms) {
    // Find atoms like: ['rel', propertyIRI, entityIRI, varName]
    // Extract and normalize entity names
  }

  _extractTemporal(skeleton) {
    // Extract temporal information from skeleton.atoms or skeleton.notes
  }

  _extractOperations(operations) {
    // Parse operation types (aggregate, arithmetic, etc.)
  }

  _resolveReferences(entities, context) {
    // Use context.conversationHistory to resolve "it", "that", etc.
  }
}
```

### Step 3: Create Your Executor

Pure data operations, no semantic understanding:

```javascript
export class MyCustomExecutor {
  constructor(dataModel) {
    this.dataModel = dataModel;
  }

  /**
   * Execute query with concrete parameters
   */
  execute(params) {
    if (params.type === 'lookup') {
      return this._executeLookup(params);
    }

    if (params.type === 'operation') {
      return this._executeOperation(params);
    }

    return { answer: null, error: 'Unknown query type' };
  }

  _executeLookup(params) {
    // Look up values in dataModel
    const value = this.dataModel[params.entity][params.attribute];
    return { answer: value, type: 'lookup' };
  }

  _executeOperation(params) {
    // Perform domain-specific operations
    // Return results with any program traces
  }
}
```

### Step 4: Create Your Orchestrator

Wire everything together:

```javascript
import { QueryUnderstandingPipeline } from '@legion/query-understanding';

export class MyCustomOrchestrator {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.pipeline = null;
    this.interpreter = null;
    this.executor = null;
    this.conversationHistory = [];
  }

  async initialize(data) {
    // 1. Build your domain-specific ontology
    const ontology = this._buildOntology(data);
    await this._indexOntology(ontology);

    // 2. Initialize pipeline
    this.pipeline = new QueryUnderstandingPipeline(this.resourceManager);
    await this.pipeline.initialize({
      ontologyCollectionName: 'my-domain-ontology',
      skipDataSource: true  // Using custom executor
    });

    // 3. Create interpreter and executor
    this.interpreter = new MyCustomInterpreter(data);
    this.executor = new MyCustomExecutor(data);
  }

  async processQuestion(question) {
    // 1. Pipeline: Question → LogicalSkeleton
    const pipelineResult = await this.pipeline.process(question, {
      conversationHistory: this.conversationHistory
    });

    // 2. Interpreter: LogicalSkeleton → Execution Parameters
    const execParams = this.interpreter.interpret(
      pipelineResult.skeleton,
      { conversationHistory: this.conversationHistory, question }
    );

    // 3. Executor: Execute with parameters
    const result = this.executor.execute(execParams);

    // 4. Store in history
    this.conversationHistory.push({
      question,
      answer: result.answer,
      execParams
    });

    return result;
  }
}
```

### Step 5: Test Your Implementation

```javascript
describe('My Custom Domain', () => {
  let orchestrator;

  beforeEach(async () => {
    const resourceManager = await ResourceManager.getInstance();
    orchestrator = new MyCustomOrchestrator(resourceManager);
    await orchestrator.initialize(myTestData);
  });

  test('should handle domain-specific query', async () => {
    const result = await orchestrator.processQuestion(
      "What is the X of Y?"
    );

    expect(result.success).toBe(true);
    expect(result.answer).toBe(expectedValue);
  });
});
```

### Complete Example

See `examples/convfinqa-benchmark/` for a full implementation including:
- FinancialKGBuilder (ontology creation)
- QueryInterpreter (LogicalSkeleton → ExecParams)
- FactQueryExecutor (data lookup + arithmetic)
- ConvFinQAOrchestrator (complete orchestration)
- Integration tests with 100% pass rate

**Key Takeaways:**
1. Keep pipeline generic (don't modify Phase 1-4)
2. Interpreter translates semantics to domain-specific parameters
3. Executor is pure data operations (no semantic understanding)
4. Orchestrator manages lifecycle and conversation state
5. Test each layer independently

## Documentation

- [Multi-Turn Demo Walkthrough](docs/MULTI_TURN_DEMO.md) - Detailed 3-turn conversation with referring expressions and answer computation
- [Multi-Turn API Guide](examples/multi-turn-demo/README.md) - Conversation support API reference
- [ConvFinQA Benchmark Architecture](examples/convfinqa-benchmark/README.md) - Complete custom interpreter implementation
- [Design Document](docs/DESIGN.md) - Full architecture and specifications
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) - Phase-by-phase development guide

## Contributing

This package follows Legion's TDD methodology:
- Write tests first
- No mocks in integration tests
- 100% test pass rate required
- FAIL FAST error handling

## License

MIT
