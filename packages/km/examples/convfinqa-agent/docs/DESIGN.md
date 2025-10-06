# ConvFinQA Agent Design Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [MongoDB Schema](#mongodb-schema)
5. [Knowledge Graph Construction](#knowledge-graph-construction)
6. [Agent Tools](#agent-tools)
7. [Turn-by-Turn Execution](#turn-by-turn-execution)
8. [Logging and Inspection](#logging-and-inspection)
9. [Proper vs Cheating Comparison](#proper-vs-cheating-comparison)

---

## Overview

The ConvFinQA Agent is a proper evaluation system for the ConvFinQA benchmark that uses a knowledge graph approach to answer financial questions from conversational data. Unlike previous approaches that "cheat" by using gold programs with literal values, this system:

1. **Builds a financial domain ontology** (ONE-TIME) from all training data
2. **Creates instance-level knowledge graphs** from table data per example
3. **Uses an AI agent** with KG query tools to understand and answer questions
4. **Logs everything** to MongoDB for inspection and debugging

### Key Principles

- **No Cheating**: Agent queries KG for values, doesn't use gold programs
- **Separation of Concerns**: Ontology building is separate from evaluation runs
- **Complete Audit Trail**: Every question, understanding, answer, and KG query is logged
- **Repeatable**: Runs are independent and can be repeated to improve the agent

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE-TIME SETUP                           │
│                                                             │
│  ConvFinQA Dataset (421 conversations)                      │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │ OntologyBuilder  │ ──────► MongoDB (ontology collection)│
│  └──────────────────┘                                      │
│                                                             │
│  Output: Financial domain TBox (types, properties, ranges) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PER-RUN EVALUATION                       │
│                                                             │
│  For each example:                                          │
│                                                             │
│  1. Create log record (evaluation_runs, examples)           │
│     │                                                       │
│  2. Load ontology from MongoDB                              │
│     │                                                       │
│  3. Build instance KG from table                            │
│     │                                                       │
│     ▼                                                       │
│  ┌──────────────────┐                                      │
│  │    KGBuilder     │ ──────► MongoDB (instances)          │
│  └──────────────────┘                                      │
│     │                                                       │
│  4. For each turn:                                          │
│     │                                                       │
│     ▼                                                       │
│  ┌──────────────────┐                                      │
│  │  TurnProcessor   │                                      │
│  │                  │                                      │
│  │  - Understand    │ ◄────┐                              │
│  │  - Answer        │      │                              │
│  └──────────────────┘      │                              │
│     │                      │                              │
│     │                  ┌───────────┐                      │
│     │                  │   Agent   │                      │
│     │                  │           │                      │
│     │                  │ Tools:    │                      │
│     │                  │ - query_kg│                      │
│     │                  │ - list_entities                  │
│     │                  │ - calculate                      │
│     │                  └───────────┘                      │
│     │                                                       │
│     ▼                                                       │
│  MongoDB (turns collection) - logs understanding/answer     │
│     │                                                       │
│  5. Score results                                           │
│     │                                                       │
│     ▼                                                       │
│  MongoDB (examples collection) - update with scores         │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### ONE-TIME Components

**OntologyBuilder** (`@legion/ontology`)
- Processes ALL ConvFinQA examples
- Extracts TYPE-LEVEL schema (TBox)
- Example: "A StockOption has exercisePrice, expectedDividends"
- NOT: "StockOption_2007 has exercisePrice 60.94"
- Stores ontology in MongoDB

#### PER-RUN Components

**ExampleRunner**
- Orchestrates evaluation of a single conversation
- Creates log records
- Loads ontology
- Builds instance KG
- Runs turn processor for each question
- Scores results

**KGBuilder**
- Converts ConvFinQA table to instance-level RDF triples (ABox)
- Detects entity type from text using ontology
- Detects instance columns (usually years: 2006, 2007, 2008)
- Maps table row labels to ontology properties
- Creates instances: `kg:StockOption_2007 rdf:type kg:StockOption`
- Adds property triples: `kg:StockOption_2007 kg:exercisePrice "60.94"^^xsd:decimal`

**TurnProcessor**
- Processes a single question in the conversation
- **Understand phase**: Uses agent to comprehend the question
- **Answer phase**: Uses agent with KG tools to answer
- Logs both phases to MongoDB

**Agent** (`@legion/claude-agent`)
- ClaudeAgentStrategy with three tools
- Understands questions in context
- Queries KG for values
- Performs calculations
- Returns answers

#### Storage Components

**MongoDBProvider**
- Implements ITripleStore interface
- Stores triples as `{s, p, o}` documents
- Supports pattern matching queries
- Metadata tagging (type, runId, conversationId)

**LogStorage**
- Manages hierarchical logging
- Collections: evaluation_runs, examples, turns
- Methods for creating/updating/querying logs

---

## Data Flow

### Phase 1: ONE-TIME Ontology Building

```
Input: convfinqa_train.json (421 conversations)
       │
       ▼
┌──────────────────────────────────────┐
│ For each conversation:               │
│   - Process all text fields          │
│   - Process all table headers/rows   │
│   - Extract entity types             │
│   - Extract properties               │
│   - Extract property ranges          │
│   - Incrementally build ontology     │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ OntologyBuilder.build()              │
│   - Creates owl:Class for entities   │
│   - Creates owl:DatatypeProperty     │
│   - Sets rdfs:domain, rdfs:range     │
│   - Adds rdfs:label annotations      │
└──────────────────────────────────────┘
       │
       ▼
MongoDB: ontology collection
  {s: 'kg:StockOption', p: 'rdf:type', o: 'owl:Class'}
  {s: 'kg:exercisePrice', p: 'rdf:type', o: 'owl:DatatypeProperty'}
  {s: 'kg:exercisePrice', p: 'rdfs:domain', o: 'kg:StockOption'}
  {s: 'kg:exercisePrice', p: 'rdfs:range', o: 'xsd:decimal'}
  {s: 'kg:exercisePrice', p: 'rdfs:label', o: '"exercise price"'}
```

**Critical**: This is background knowledge, NOT cheating. We're learning "what a StockOption is" from all training data, not memorizing specific values.

### Phase 2: PER-RUN Evaluation

#### 2.1: Example Initialization

```
Input: Single ConvFinQA example
  {
    id: "GOOG_2008_page_60",
    table: [
      ["", "2006", "2007", "2008"],
      ["exercise price", "$25.14", "$60.94", "$..."],
      ["expected dividends", "0", "0", "0"],
      ...
    ],
    text: ["The fair value of each option grant is estimated...", ...],
    qa: [
      {question: "what was the exercise price in 2007?", answer: "60.94"},
      {question: "and in 2006?", answer: "25.14"},
      {question: "what is the difference?", answer: "35.8"},
      ...
    ]
  }
       │
       ▼
LogStorage.createRun() ──► MongoDB: evaluation_runs
  {
    _id: ObjectId(...),
    runId: "run_20250105_143022",
    startedAt: ISODate(...),
    config: {...}
  }
       │
       ▼
LogStorage.createExample() ──► MongoDB: examples
  {
    _id: ObjectId(...),
    runId: "run_20250105_143022",
    exampleId: "GOOG_2008_page_60",
    conversationId: "GOOG_2008_page_60",
    numTurns: 10,
    status: "in_progress"
  }
```

#### 2.2: Knowledge Graph Construction

```
Load ontology from MongoDB
       │
       ▼
KGBuilder.buildFromTable(table, text)
       │
       ├──► _detectEntityType(text)
       │      - Query ontology for all classes
       │      - Match class names to text
       │      - Return: 'kg:StockOption'
       │
       ├──► _detectInstanceColumns(table)
       │      - Find year columns: [1, 2, 3] → ["2006", "2007", "2008"]
       │
       ├──► _buildPropertyMap(table, entityType)
       │      - Query ontology for properties with domain kg:StockOption
       │      - Map "exercise price" → 'kg:exercisePrice'
       │      - Map "expected dividends" → 'kg:expectedDividends'
       │
       ▼
Create instances and property triples
       │
       ▼
MongoDB: instances collection
  {s: 'kg:StockOption_2006', p: 'rdf:type', o: 'kg:StockOption', ...metadata}
  {s: 'kg:StockOption_2006', p: 'kg:exercisePrice', o: 25.14, ...metadata}
  {s: 'kg:StockOption_2006', p: 'kg:expectedDividends', o: 0, ...metadata}

  {s: 'kg:StockOption_2007', p: 'rdf:type', o: 'kg:StockOption', ...metadata}
  {s: 'kg:StockOption_2007', p: 'kg:exercisePrice', o: 60.94, ...metadata}
  {s: 'kg:StockOption_2007', p: 'kg:expectedDividends', o: 0, ...metadata}

  {s: 'kg:StockOption_2008', p: 'rdf:type', o: 'kg:StockOption', ...metadata}
  ...
```

#### 2.3: Turn Processing

```
For each Q&A pair:
  question: "what was the exercise price in 2007?"
  goldAnswer: "60.94"
       │
       ▼
┌──────────────────────────────────────┐
│ UNDERSTAND PHASE                     │
│                                      │
│ Agent prompt:                        │
│ "You are a financial analyst.        │
│  Understand this question:           │
│  'what was the exercise price in     │
│  2007?'                              │
│                                      │
│  Context:                            │
│  - Conversation history: []          │
│  - Available entities: [...]         │
│                                      │
│  Describe what is being asked."      │
└──────────────────────────────────────┘
       │
       ▼
Agent understanding:
  {
    understanding: "Looking for the exercisePrice property of the StockOption entity for year 2007",
    entityType: "StockOption",
    property: "exercisePrice",
    filters: {year: "2007"}
  }
       │
       ▼
LogStorage.logTurn() ──► MongoDB: turns
  {
    runId: "...",
    conversationId: "...",
    turnIndex: 0,
    question: "what was the exercise price in 2007?",
    understanding: {...},
    status: "understanding_complete"
  }
       │
       ▼
┌──────────────────────────────────────┐
│ ANSWER PHASE                         │
│                                      │
│ Agent prompt:                        │
│ "Answer this question using the      │
│  available tools:                    │
│  'what was the exercise price in     │
│  2007?'                              │
│                                      │
│  Tools:                              │
│  - query_kg                          │
│  - list_entities                     │
│  - calculate                         │
│                                      │
│  Your understanding:                 │
│  {...}"                              │
└──────────────────────────────────────┘
       │
       ▼
Agent executes tools:
  1. query_kg({
       entityType: "StockOption",
       filters: {year: "2007"},
       property: "exercisePrice"
     })

     QueryKGTool:
       - Queries MongoDB for instances
       - Finds: kg:StockOption_2007
       - Queries property: kg:exercisePrice
       - Returns: 60.94

  2. Returns answer: "60.94"
       │
       ▼
LogStorage.updateTurn() ──► MongoDB: turns
  {
    ...
    toolCalls: [
      {
        tool: "query_kg",
        input: {...},
        output: {value: 60.94}
      }
    ],
    answer: "60.94",
    goldAnswer: "60.94",
    correct: true,
    status: "complete"
  }
```

#### 2.4: Scoring and Completion

```
After all turns processed:
       │
       ▼
Score results:
  - Count correct answers
  - Calculate accuracy
  - Identify failure modes
       │
       ▼
LogStorage.updateExample() ──► MongoDB: examples
  {
    ...
    status: "complete",
    completedAt: ISODate(...),
    results: {
      totalTurns: 10,
      correctAnswers: 10,
      accuracy: 1.0
    }
  }
       │
       ▼
LogStorage.updateRun() ──► MongoDB: evaluation_runs
  {
    ...
    status: "complete",
    completedAt: ISODate(...),
    results: {
      totalExamples: 10,
      totalTurns: 100,
      correctAnswers: 98,
      accuracy: 0.98
    }
  }
```

---

## MongoDB Schema

### Collections

#### `ontology`

Stores type-level schema (TBox) built from all training data.

```javascript
{
  _id: ObjectId("..."),
  s: "kg:StockOption",              // Subject
  p: "rdf:type",                    // Predicate
  o: "owl:Class",                   // Object
  type: "ontology",                 // Metadata
  createdAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  s: "kg:exercisePrice",
  p: "rdf:type",
  o: "owl:DatatypeProperty",
  type: "ontology",
  createdAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  s: "kg:exercisePrice",
  p: "rdfs:domain",
  o: "kg:StockOption",
  type: "ontology",
  createdAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  s: "kg:exercisePrice",
  p: "rdfs:range",
  o: "xsd:decimal",
  type: "ontology",
  createdAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  s: "kg:exercisePrice",
  p: "rdfs:label",
  o: "\"exercise price\"",
  type: "ontology",
  createdAt: ISODate("...")
}
```

**Indexes:**
- `{s: 1, p: 1, o: 1, type: 1}` - Triple pattern queries
- `{type: 1}` - Filter by ontology vs instance data

#### `instances`

Stores instance-level data (ABox) built per evaluation run.

```javascript
{
  _id: ObjectId("..."),
  s: "kg:StockOption_2007",
  p: "rdf:type",
  o: "kg:StockOption",
  type: "instance",
  runId: "run_20250105_143022",
  conversationId: "GOOG_2008_page_60",
  createdAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  s: "kg:StockOption_2007",
  p: "kg:exercisePrice",
  o: 60.94,
  type: "instance",
  runId: "run_20250105_143022",
  conversationId: "GOOG_2008_page_60",
  createdAt: ISODate("...")
}

{
  _id: ObjectId("..."),
  s: "kg:StockOption_2007",
  p: "kg:expectedDividends",
  o: 0,
  type: "instance",
  runId: "run_20250105_143022",
  conversationId: "GOOG_2008_page_60",
  createdAt: ISODate("...")
}
```

**Indexes:**
- `{s: 1, p: 1, o: 1, type: 1, runId: 1, conversationId: 1}` - Full pattern matching
- `{type: 1, runId: 1, conversationId: 1}` - Per-run/conversation queries

#### `evaluation_runs`

Stores metadata for each evaluation run.

```javascript
{
  _id: ObjectId("..."),
  runId: "run_20250105_143022",
  startedAt: ISODate("2025-01-05T14:30:22Z"),
  completedAt: ISODate("2025-01-05T15:45:10Z"),
  status: "complete",              // "in_progress" | "complete" | "failed"
  config: {
    maxExamples: 10,
    agentModel: "claude-3-5-sonnet-20241022",
    temperature: 0,
    ontologyVersion: "v1"
  },
  results: {
    totalExamples: 10,
    totalTurns: 95,
    correctAnswers: 88,
    accuracy: 0.926,
    avgTurnsPerExample: 9.5
  }
}
```

**Indexes:**
- `{runId: 1}` - Unique run ID
- `{startedAt: -1}` - Most recent runs first

#### `examples`

Stores per-conversation evaluation results.

```javascript
{
  _id: ObjectId("..."),
  runId: "run_20250105_143022",
  exampleId: "GOOG_2008_page_60",
  conversationId: "GOOG_2008_page_60",
  startedAt: ISODate("2025-01-05T14:30:25Z"),
  completedAt: ISODate("2025-01-05T14:35:40Z"),
  status: "complete",
  numTurns: 10,
  results: {
    correctAnswers: 9,
    accuracy: 0.9,
    failedTurns: [3],           // Turn indices that failed
    avgToolCallsPerTurn: 2.1
  },
  kgStats: {
    instances: 3,               // Created: StockOption_2006, _2007, _2008
    triples: 21,                // Total triples in instance KG
    entityType: "kg:StockOption"
  }
}
```

**Indexes:**
- `{runId: 1, exampleId: 1}` - Unique per run
- `{runId: 1, status: 1}` - Find incomplete examples

#### `turns`

Stores detailed logs for each question-answer turn.

```javascript
{
  _id: ObjectId("..."),
  runId: "run_20250105_143022",
  conversationId: "GOOG_2008_page_60",
  turnIndex: 0,
  question: "what was the exercise price in 2007?",
  conversationHistory: [],        // Previous Q&A pairs

  // UNDERSTAND PHASE
  understanding: {
    description: "Looking for exercisePrice property of StockOption entity for year 2007",
    entityType: "StockOption",
    property: "exercisePrice",
    filters: {year: "2007"},
    reasoning: "The question asks for a specific year (2007) and a specific metric (exercise price)"
  },

  // ANSWER PHASE
  toolCalls: [
    {
      tool: "query_kg",
      input: {
        entityType: "StockOption",
        filters: {year: "2007"},
        property: "exercisePrice"
      },
      output: {
        success: true,
        instance: "kg:StockOption_2007",
        property: "kg:exercisePrice",
        value: 60.94,
        rawValue: 60.94
      },
      timestamp: ISODate("...")
    }
  ],

  answer: "60.94",
  goldAnswer: "60.94",
  correct: true,

  status: "complete",
  startedAt: ISODate("2025-01-05T14:30:25Z"),
  completedAt: ISODate("2025-01-05T14:30:28Z"),
  durationMs: 3200
}
```

**Example with calculation:**
```javascript
{
  _id: ObjectId("..."),
  runId: "run_20250105_143022",
  conversationId: "GOOG_2008_page_60",
  turnIndex: 2,
  question: "what is the difference?",
  conversationHistory: [
    {question: "what was the exercise price in 2007?", answer: "60.94"},
    {question: "and in 2006?", answer: "25.14"}
  ],

  understanding: {
    description: "Calculate difference between 2007 and 2006 exercise prices",
    requiresCalculation: true,
    operation: "subtract",
    values: ["2007_exercisePrice", "2006_exercisePrice"]
  },

  toolCalls: [
    {
      tool: "query_kg",
      input: {
        entityType: "StockOption",
        filters: {year: "2007"},
        property: "exercisePrice"
      },
      output: {value: 60.94}
    },
    {
      tool: "query_kg",
      input: {
        entityType: "StockOption",
        filters: {year: "2006"},
        property: "exercisePrice"
      },
      output: {value: 25.14}
    },
    {
      tool: "calculate",
      input: {
        operation: "subtract",
        values: [60.94, 25.14]
      },
      output: {
        success: true,
        operation: "subtract",
        values: [60.94, 25.14],
        result: 35.8
      }
    }
  ],

  answer: "35.8",
  goldAnswer: "35.8",
  correct: true,

  status: "complete"
}
```

**Indexes:**
- `{runId: 1, conversationId: 1, turnIndex: 1}` - Unique per conversation
- `{runId: 1, correct: 1}` - Find failed turns
- `{runId: 1, conversationId: 1}` - All turns in a conversation

---

## Knowledge Graph Construction

### Entity Type Detection

The KGBuilder detects entity types by matching ontology classes to the text context.

**Algorithm:**
```javascript
async _detectEntityType(text) {
  // 1. Get all classes from ontology
  const classes = await this.ontologyStore.query(null, 'rdf:type', 'owl:Class');

  // 2. Filter to domain classes (kg:*)
  const domainClasses = classes
    .map(([uri]) => uri)
    .filter(uri => uri.startsWith('kg:'));

  // 3. Match class names to text
  const textLower = Array.isArray(text) ? text.join(' ').toLowerCase() : String(text).toLowerCase();

  const candidates = domainClasses.filter(uri => {
    const name = uri.split(':')[1]?.toLowerCase() || '';

    // Check if class name appears in text OR matches common financial terms
    return textLower.includes(name.toLowerCase()) ||
           name.includes('stock') ||
           name.includes('option') ||
           name.includes('pension') ||
           // ...
  });

  // 4. Return first candidate or first domain class as fallback
  return candidates[0] || domainClasses[0] || null;
}
```

**Example:**
```javascript
text = [
  "The fair value of each option grant is estimated on the date of grant using the Black-Scholes option pricing model.",
  "The following table presents the weighted-average assumptions used in the valuation..."
]

// Detection finds: kg:StockOption
// Because "option" appears in text multiple times
```

### Instance Column Detection

Identifies which table columns represent entity instances (typically years).

**Algorithm:**
```javascript
_detectInstanceColumns(table) {
  const headerRow = table[0];
  const instanceColumns = [];

  // Look for year patterns: 2006, 2007, 2008
  for (let i = 1; i < headerRow.length; i++) {
    const header = String(headerRow[i]).trim();

    if (/^\d{4}$/.test(header) || /\d{4}/.test(header)) {
      instanceColumns.push(i);
    }
  }

  // Fallback: If no years found, assume all non-first columns
  if (instanceColumns.length === 0) {
    for (let i = 1; i < headerRow.length; i++) {
      instanceColumns.push(i);
    }
  }

  return instanceColumns;
}
```

**Example:**
```javascript
table = [
  ["", "2006", "2007", "2008"],
  ["exercise price", "$25.14", "$60.94", "$..."],
  ...
]

// Returns: [1, 2, 3]
// Columns: "2006", "2007", "2008"
```

### Property Mapping

Maps table row labels to ontology properties.

**Algorithm:**
```javascript
async _buildPropertyMap(table, entityType) {
  const propertyMap = {};

  // 1. Get all properties with this entity as domain
  const properties = await this.ontologyStore.query(null, 'rdfs:domain', entityType);

  // 2. Build lookup of property labels
  const propertyLabels = {};
  for (const [propUri] of properties) {
    // Get rdfs:label
    const labels = await this.ontologyStore.query(propUri, 'rdfs:label', null);
    if (labels.length > 0) {
      const label = labels[0][2].replace(/"/g, '').toLowerCase();
      propertyLabels[label] = propUri;
    }

    // Also use property name as fallback
    const propName = propUri.split(':')[1]?.toLowerCase();
    if (propName) {
      propertyLabels[propName] = propUri;
    }
  }

  // 3. Map table row labels to properties
  for (let i = 1; i < table.length; i++) {
    const rowLabel = String(table[i][0]).trim().toLowerCase();

    // Try exact match
    if (propertyLabels[rowLabel]) {
      propertyMap[rowLabel] = propertyLabels[rowLabel];
      continue;
    }

    // Try partial match
    for (const [label, uri] of Object.entries(propertyLabels)) {
      if (rowLabel.includes(label) || label.includes(rowLabel)) {
        propertyMap[rowLabel] = uri;
        break;
      }
    }

    // Fallback: Create generic property URI
    if (!propertyMap[rowLabel]) {
      const propName = rowLabel
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
      propertyMap[rowLabel] = `kg:${propName}`;
    }
  }

  return propertyMap;
}
```

**Example:**
```javascript
// Ontology has:
// kg:exercisePrice rdfs:label "exercise price"
// kg:expectedDividends rdfs:label "expected dividends"

table = [
  ["", "2006", "2007"],
  ["exercise price", "$25.14", "$60.94"],
  ["expected dividends", "0", "0"]
]

// Returns:
{
  "exercise price": "kg:exercisePrice",
  "expected dividends": "kg:expectedDividends"
}
```

### Triple Generation

Creates RDF triples for each instance and property value.

```javascript
async buildFromTable(table, text) {
  const entityType = await this._detectEntityType(text);
  const instanceColumns = this._detectInstanceColumns(table);
  const propertyMap = await this._buildPropertyMap(table, entityType);

  const stats = {instances: 0, triples: 0, entityType};
  const headers = table[0];

  // For each instance column (year)
  for (const colIdx of instanceColumns) {
    const columnHeader = headers[colIdx];
    const instanceUri = `kg:${entityType.split(':')[1]}_${columnHeader}`;

    // Create type triple
    await this.kgStore.addTriple(instanceUri, 'rdf:type', entityType);
    stats.instances++;
    stats.triples++;

    // Create property triples for each row
    for (let rowIdx = 1; rowIdx < table.length; rowIdx++) {
      const rowLabel = table[rowIdx][0];
      const cellValue = table[rowIdx][colIdx];

      if (!cellValue || cellValue.trim() === '') continue;

      const propertyUri = propertyMap[rowLabel.toLowerCase()];
      if (!propertyUri) {
        console.warn(`No property mapping for: ${rowLabel}`);
        continue;
      }

      // Parse value (remove currency symbols, percentages, etc.)
      const parsedValue = this._parseValue(cellValue);

      await this.kgStore.addTriple(instanceUri, propertyUri, parsedValue);
      stats.triples++;
    }
  }

  return stats;
}
```

**Example output:**
```
Input table:
  ["", "2006", "2007", "2008"]
  ["exercise price", "$25.14", "$60.94", "$75.12"]
  ["expected dividends", "0", "0", "0"]

Generated triples:
  kg:StockOption_2006 rdf:type kg:StockOption
  kg:StockOption_2006 kg:exercisePrice 25.14
  kg:StockOption_2006 kg:expectedDividends 0

  kg:StockOption_2007 rdf:type kg:StockOption
  kg:StockOption_2007 kg:exercisePrice 60.94
  kg:StockOption_2007 kg:expectedDividends 0

  kg:StockOption_2008 rdf:type kg:StockOption
  kg:StockOption_2008 kg:exercisePrice 75.12
  kg:StockOption_2008 kg:expectedDividends 0

Stats: {instances: 3, triples: 9, entityType: 'kg:StockOption'}
```

---

## Agent Tools

The agent has three tools for interacting with the knowledge graph.

### 1. query_kg

Queries specific property values from entities matching filters.

**Tool Schema:**
```javascript
{
  name: 'query_kg',
  description: 'Query the knowledge graph to retrieve property values from entities',
  input_schema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'The type of entity to query (e.g., StockOption, PensionPlan)'
      },
      filters: {
        type: 'object',
        description: 'Filters to find the specific entity instance (e.g., { year: "2007" })'
      },
      property: {
        type: 'string',
        description: 'The property name to retrieve (e.g., exercisePrice, expectedDividends)'
      }
    },
    required: ['entityType', 'property']
  }
}
```

**Execution Flow:**
```javascript
async execute(params, context) {
  const { entityType, filters, property } = params;
  const { kgStore, logger } = context;

  // Step 1: Find instances of the entity type
  const instances = await kgStore.query(null, 'rdf:type', `kg:${entityType}`);

  if (instances.length === 0) {
    return {
      error: `No instances of type '${entityType}' found in knowledge graph`,
      suggestion: 'Use list_entities to see available entity types'
    };
  }

  // Step 2: Apply filters to find target instance
  let targetInstance = null;

  if (!filters || Object.keys(filters).length === 0) {
    targetInstance = instances[0][0];
  } else {
    for (const [instanceUri] of instances) {
      let matches = true;

      for (const [key, value] of Object.entries(filters)) {
        // Check if instance URI contains filter value
        // e.g., kg:StockOption_2007 contains "2007"
        if (!instanceUri.includes(String(value))) {
          matches = false;
          break;
        }
      }

      if (matches) {
        targetInstance = instanceUri;
        break;
      }
    }
  }

  if (!targetInstance) {
    return {
      error: `No instance found matching filters: ${JSON.stringify(filters)}`,
      availableInstances: instances.map(([uri]) => uri),
      suggestion: 'Try different filter values or use list_entities'
    };
  }

  // Step 3: Query the property on target instance
  const propertyUri = `kg:${property}`;
  const results = await kgStore.query(targetInstance, propertyUri, null);

  if (results.length === 0) {
    return {
      error: `Property '${property}' not found on instance '${targetInstance}'`,
      instance: targetInstance,
      suggestion: 'Property may not exist or have a different name'
    };
  }

  // Step 4: Parse and return value
  const rawValue = results[0][2];
  let value = rawValue;

  // Parse numeric values, remove formatting
  if (typeof rawValue === 'string') {
    const cleanValue = rawValue
      .replace(/["^]|xsd:\w+/g, '')
      .replace(/\$/g, '')
      .replace(/%/g, '')
      .replace(/,/g, '')
      .trim();

    const numValue = parseFloat(cleanValue);
    if (!isNaN(numValue)) {
      value = numValue;
    } else {
      value = cleanValue;
    }
  }

  return {
    success: true,
    instance: targetInstance,
    property: propertyUri,
    value,
    rawValue
  };
}
```

**Examples:**
```javascript
// Simple query
query_kg({
  entityType: "StockOption",
  filters: { year: "2007" },
  property: "exercisePrice"
})
// Returns: {success: true, value: 60.94, instance: "kg:StockOption_2007"}

// Query without filters (returns first instance)
query_kg({
  entityType: "StockOption",
  property: "expectedDividends"
})
// Returns: {success: true, value: 0, instance: "kg:StockOption_2006"}

// Error: entity type not found
query_kg({
  entityType: "NonExistent",
  property: "someProperty"
})
// Returns: {error: "No instances of type 'NonExistent' found...", suggestion: "..."}
```

### 2. list_entities

Lists all entity instances of a given type.

**Tool Schema:**
```javascript
{
  name: 'list_entities',
  description: 'List all entities of a given type in the knowledge graph',
  input_schema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'The entity type to list instances of (e.g., StockOption, PensionPlan)'
      }
    },
    required: ['entityType']
  }
}
```

**Execution:**
```javascript
async execute(params, context) {
  const { entityType } = params;
  const { kgStore, logger } = context;

  const instances = await kgStore.query(null, 'rdf:type', `kg:${entityType}`);
  const instanceUris = instances.map(([uri]) => uri);

  return {
    success: true,
    entityType: `kg:${entityType}`,
    instances: instanceUris,
    count: instanceUris.length
  };
}
```

**Examples:**
```javascript
list_entities({ entityType: "StockOption" })
// Returns:
{
  success: true,
  entityType: "kg:StockOption",
  instances: [
    "kg:StockOption_2006",
    "kg:StockOption_2007",
    "kg:StockOption_2008"
  ],
  count: 3
}
```

**Use Case:**
Before querying, agent can discover what years/periods are available:
```
Agent: "I need to find data for 2007. Let me first check what's available."
Agent calls: list_entities({ entityType: "StockOption" })
Agent receives: ["kg:StockOption_2006", "kg:StockOption_2007", "kg:StockOption_2008"]
Agent: "Good, 2007 exists. Now I can query it."
```

### 3. calculate

Performs arithmetic calculations on numerical values.

**Tool Schema:**
```javascript
{
  name: 'calculate',
  description: 'Perform arithmetic calculations on numerical values',
  input_schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The arithmetic operation to perform'
      },
      values: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        description: 'The numerical values to operate on'
      }
    },
    required: ['operation', 'values']
  }
}
```

**Execution:**
```javascript
async execute(params, context) {
  const { operation, values } = params;

  let result;

  switch (operation) {
    case 'add':
      result = values.reduce((sum, val) => sum + val, 0);
      break;

    case 'subtract':
      if (values.length !== 2) {
        return { error: 'subtract requires exactly 2 values' };
      }
      result = values[0] - values[1];
      break;

    case 'multiply':
      result = values.reduce((product, val) => product * val, 1);
      break;

    case 'divide':
      if (values.length !== 2) {
        return { error: 'divide requires exactly 2 values' };
      }
      if (values[1] === 0) {
        return { error: 'Division by zero' };
      }
      result = values[0] / values[1];
      break;

    default:
      return { error: `Unknown operation: ${operation}` };
  }

  return {
    success: true,
    operation,
    values,
    result
  };
}
```

**Examples:**
```javascript
calculate({ operation: "subtract", values: [60.94, 25.14] })
// Returns: {success: true, result: 35.8}

calculate({ operation: "divide", values: [35.8, 25.14] })
// Returns: {success: true, result: 1.424}

calculate({ operation: "add", values: [10, 20, 30] })
// Returns: {success: true, result: 60}
```

**Use Case:**
```
Question: "what is the difference between the exercise price in 2007 and 2006?"

Agent reasoning:
1. Query 2007 exercise price → 60.94
2. Query 2006 exercise price → 25.14
3. Calculate difference: calculate({operation: "subtract", values: [60.94, 25.14]})
4. Answer: 35.8
```

---

## Turn-by-Turn Execution

Each question in a conversation is processed in two phases: **Understand** and **Answer**.

### Phase 1: Understand

The agent analyzes the question in context to determine what is being asked.

**Input:**
- Question text
- Conversation history (previous Q&A pairs)
- Available entity types from KG
- Ontology schema

**Prompt Template:**
```
You are a financial analyst assistant helping to understand questions about financial data.

Question: "{question}"

Conversation History:
{history}

Available Entities:
{entities}

Analyze this question and describe:
1. What information is being requested?
2. What entity type is relevant?
3. What property or properties are needed?
4. What filters or conditions apply (e.g., specific years)?
5. Does this require calculation? If so, what operation?

Provide your understanding as structured data.
```

**Example:**
```
Question: "what was the exercise price in 2007?"
History: []
Entities: ["StockOption"]

Understanding:
{
  "description": "The question asks for the exercisePrice property of StockOption entity for the year 2007",
  "entityType": "StockOption",
  "property": "exercisePrice",
  "filters": {"year": "2007"},
  "requiresCalculation": false,
  "reasoning": "Direct property lookup - no calculation needed"
}
```

**Example with context:**
```
Question: "and in 2006?"
History: [
  {question: "what was the exercise price in 2007?", answer: "60.94"}
]
Entities: ["StockOption"]

Understanding:
{
  "description": "Following from previous question, asking for exercisePrice of StockOption for year 2006",
  "entityType": "StockOption",
  "property": "exercisePrice",
  "filters": {"year": "2006"},
  "requiresCalculation": false,
  "reasoning": "Continuation of previous question but for different year"
}
```

**Example with calculation:**
```
Question: "what is the difference?"
History: [
  {question: "what was the exercise price in 2007?", answer: "60.94"},
  {question: "and in 2006?", answer: "25.14"}
]
Entities: ["StockOption"]

Understanding:
{
  "description": "Calculate the difference between the two previously mentioned exercise prices (2007 and 2006)",
  "entityType": "StockOption",
  "property": "exercisePrice",
  "filters": {"year": ["2007", "2006"]},
  "requiresCalculation": true,
  "operation": "subtract",
  "operands": ["2007_exercisePrice", "2006_exercisePrice"],
  "reasoning": "Requires retrieving two values and computing their difference"
}
```

**Logging:**
```javascript
await logStorage.logTurn({
  runId,
  conversationId,
  turnIndex,
  question,
  conversationHistory,
  understanding,
  status: 'understanding_complete'
});
```

### Phase 2: Answer

The agent uses tools to retrieve data and answer the question.

**Input:**
- Question text
- Understanding from Phase 1
- Available tools (query_kg, list_entities, calculate)
- KG store

**Prompt Template:**
```
You are a financial analyst assistant.

Question: "{question}"

Your Understanding:
{understanding}

Use the available tools to answer this question. You have:
- query_kg: Retrieve property values from the knowledge graph
- list_entities: Discover available entities
- calculate: Perform arithmetic calculations

Think step-by-step and use tools as needed.
```

**Example 1: Simple query**
```
Question: "what was the exercise price in 2007?"
Understanding: {entityType: "StockOption", property: "exercisePrice", filters: {year: "2007"}}

Agent reasoning:
"I need to query the KG for StockOption with year 2007 and get exercisePrice."

Tool call:
query_kg({
  entityType: "StockOption",
  filters: { year: "2007" },
  property: "exercisePrice"
})

Tool response:
{
  success: true,
  instance: "kg:StockOption_2007",
  value: 60.94
}

Agent answer: "60.94"
```

**Example 2: Calculation**
```
Question: "what is the difference?"
Understanding: {
  operation: "subtract",
  operands: ["2007_exercisePrice", "2006_exercisePrice"]
}

Agent reasoning:
"I need to get both values then calculate the difference."

Tool call 1:
query_kg({
  entityType: "StockOption",
  filters: { year: "2007" },
  property: "exercisePrice"
})
Response: { value: 60.94 }

Tool call 2:
query_kg({
  entityType: "StockOption",
  filters: { year: "2006" },
  property: "exercisePrice"
})
Response: { value: 25.14 }

Tool call 3:
calculate({
  operation: "subtract",
  values: [60.94, 25.14]
})
Response: { result: 35.8 }

Agent answer: "35.8"
```

**Logging:**
```javascript
await logStorage.updateTurn({
  runId,
  conversationId,
  turnIndex,
  toolCalls: [
    {
      tool: 'query_kg',
      input: {...},
      output: {...},
      timestamp: new Date()
    },
    ...
  ],
  answer,
  goldAnswer,
  correct: answer === goldAnswer,
  status: 'complete',
  completedAt: new Date(),
  durationMs: Date.now() - startTime
});
```

### Conversation State Management

Each turn has access to conversation history:

```javascript
class TurnProcessor {
  constructor() {
    this.conversationHistory = [];
  }

  async processTurn(question, goldAnswer) {
    // Phase 1: Understand
    const understanding = await this.understand(
      question,
      this.conversationHistory
    );

    // Phase 2: Answer
    const { answer, toolCalls } = await this.answer(
      question,
      understanding
    );

    // Update conversation history
    this.conversationHistory.push({
      question,
      answer
    });

    // Score
    const correct = this.scoreAnswer(answer, goldAnswer);

    return { understanding, answer, toolCalls, correct };
  }

  scoreAnswer(answer, goldAnswer) {
    // Normalize both answers
    const normalize = (val) => {
      return String(val).trim().toLowerCase().replace(/[^0-9.]/g, '');
    };

    return normalize(answer) === normalize(goldAnswer);
  }
}
```

---

## Logging and Inspection

All evaluation data is logged to MongoDB for inspection.

### Inspection Queries

#### Find failed examples
```javascript
const failedExamples = await db.collection('examples').find({
  runId: 'run_20250105_143022',
  'results.accuracy': { $lt: 1.0 }
}).toArray();
```

#### Find failed turns
```javascript
const failedTurns = await db.collection('turns').find({
  runId: 'run_20250105_143022',
  correct: false
}).toArray();
```

#### Analyze tool usage
```javascript
const toolStats = await db.collection('turns').aggregate([
  { $match: { runId: 'run_20250105_143022' } },
  { $unwind: '$toolCalls' },
  { $group: {
    _id: '$toolCalls.tool',
    count: { $sum: 1 },
    avgDuration: { $avg: '$durationMs' }
  }}
]).toArray();

// Result:
[
  { _id: 'query_kg', count: 180, avgDuration: 120 },
  { _id: 'calculate', count: 45, avgDuration: 50 },
  { _id: 'list_entities', count: 12, avgDuration: 80 }
]
```

#### View KG for a specific example
```javascript
const kg = await db.collection('instances').find({
  runId: 'run_20250105_143022',
  conversationId: 'GOOG_2008_page_60'
}).toArray();

// Returns all triples for this example's KG
```

#### Inspect turn reasoning
```javascript
const turn = await db.collection('turns').findOne({
  runId: 'run_20250105_143022',
  conversationId: 'GOOG_2008_page_60',
  turnIndex: 2
});

console.log(turn.question);
console.log(turn.understanding);
console.log(turn.toolCalls);
console.log(turn.answer);
console.log(turn.goldAnswer);
console.log(turn.correct);
```

### Inspection Script

**`scripts/inspect-results.js`**
```javascript
import { MongoClient } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

const resourceManager = await ResourceManager.getInstance();
const mongoUri = resourceManager.get('env.MONGO_URI');
const client = new MongoClient(mongoUri);

await client.connect();
const db = client.db('convfinqa_eval');

// Get latest run
const latestRun = await db.collection('evaluation_runs')
  .findOne({}, { sort: { startedAt: -1 } });

console.log(`\n=== Run: ${latestRun.runId} ===`);
console.log(`Accuracy: ${latestRun.results.accuracy}`);
console.log(`Total turns: ${latestRun.results.totalTurns}`);
console.log(`Correct: ${latestRun.results.correctAnswers}`);

// Get failed turns
const failedTurns = await db.collection('turns').find({
  runId: latestRun.runId,
  correct: false
}).toArray();

console.log(`\n=== Failed Turns (${failedTurns.length}) ===`);
for (const turn of failedTurns) {
  console.log(`\nConversation: ${turn.conversationId}, Turn: ${turn.turnIndex}`);
  console.log(`Question: ${turn.question}`);
  console.log(`Answer: ${turn.answer}`);
  console.log(`Gold: ${turn.goldAnswer}`);
  console.log(`Understanding:`);
  console.log(JSON.stringify(turn.understanding, null, 2));
  console.log(`Tool calls:`);
  turn.toolCalls.forEach(tc => {
    console.log(`  - ${tc.tool}: ${JSON.stringify(tc.input)} → ${JSON.stringify(tc.output)}`);
  });
}

await client.close();
```

---

## Proper vs Cheating Comparison

### The Cheating Approach (Previous)

**Problem**: Used gold programs with literal values from the dataset.

```javascript
// Gold program from dataset
const program = "60.94";  // ← Literal value!

// "Execution"
const answer = execute(program);  // Just returns "60.94"

// This is cheating because:
// 1. The program contains the answer directly
// 2. No knowledge graph is queried
// 3. No reasoning is performed
// 4. The agent isn't doing anything meaningful
```

**Why it looked like it worked:**
- High accuracy (100%!) because answers were in the programs
- But the agent wasn't actually answering questions
- It was just extracting pre-computed answers

**What was missing:**
- No understanding of the question
- No querying of structured data
- No actual reasoning or calculation
- No way to inspect what the agent was doing

### The Proper Approach (This System)

**Solution**: Build knowledge graph and query it with tools.

```javascript
// Question
const question = "what was the exercise price in 2007?";

// Step 1: UNDERSTAND
const understanding = await agent.understandQuestion(question, history);
// {
//   entityType: "StockOption",
//   property: "exercisePrice",
//   filters: {year: "2007"}
// }

// Step 2: ANSWER using tools
const result = await agent.answerQuestion(question, understanding);

// Agent internally calls:
query_kg({
  entityType: "StockOption",
  filters: { year: "2007" },
  property: "exercisePrice"
})

// Tool queries MongoDB knowledge graph:
// Find: kg:StockOption_2007
// Get property: kg:exercisePrice
// Return: 60.94

// Agent returns: "60.94"
```

**Why this is proper:**
1. ✅ Knowledge graph is built from table data
2. ✅ Agent understands what is being asked
3. ✅ Agent queries structured data using tools
4. ✅ Agent performs calculations when needed
5. ✅ Complete audit trail of reasoning
6. ✅ Can inspect every step in MongoDB

### Side-by-Side Comparison

| Aspect | Cheating Approach | Proper Approach |
|--------|-------------------|-----------------|
| **Data Source** | Gold programs with literal values | Knowledge graph built from tables |
| **Understanding** | None - just execute program | Agent comprehends question using LLM |
| **Retrieval** | N/A - values in program | Agent queries KG with filters |
| **Calculation** | Programs have pre-computed results | Agent uses calculate tool |
| **Audit Trail** | Just program text | Full logs: understanding, tool calls, reasoning |
| **Inspection** | Can't see reasoning | Can inspect every query and calculation |
| **Generalization** | Only works for exact dataset | Works for any financial table data |
| **Learning** | Can't improve agent | Can refine understanding/answering prompts |

### Example Conversation Flow

**Question 1**: "what was the exercise price in 2007?"

**Cheating:**
```javascript
program = "60.94";
answer = execute(program);  // "60.94"
// No reasoning, no queries, just literal value
```

**Proper:**
```javascript
// Understand: {entityType: "StockOption", property: "exercisePrice", filters: {year: "2007"}}
// Tool: query_kg({entityType: "StockOption", filters: {year: "2007"}, property: "exercisePrice"})
// Result: 60.94
// Answer: "60.94"
```

**Question 2**: "and in 2006?"

**Cheating:**
```javascript
program = "25.14";
answer = execute(program);  // "25.14"
// Ignores conversation context completely
```

**Proper:**
```javascript
// Understand: "Continuation of previous question but for 2006"
// Tool: query_kg({entityType: "StockOption", filters: {year: "2006"}, property: "exercisePrice"})
// Result: 25.14
// Answer: "25.14"
```

**Question 3**: "what is the difference?"

**Cheating:**
```javascript
program = "subtract(60.94, 25.14)";
answer = execute(program);  // "35.8"
// Program has the calculation but also the exact values!
```

**Proper:**
```javascript
// Understand: "Calculate difference between 2007 and 2006 exercise prices from history"
// Tool 1: query_kg({entityType: "StockOption", filters: {year: "2007"}, property: "exercisePrice"}) → 60.94
// Tool 2: query_kg({entityType: "StockOption", filters: {year: "2006"}, property: "exercisePrice"}) → 25.14
// Tool 3: calculate({operation: "subtract", values: [60.94, 25.14]}) → 35.8
// Answer: "35.8"
```

### What About the Ontology?

**Question**: "Isn't building the ontology from training data also cheating?"

**Answer**: No, because:

1. **Ontology is TYPE-LEVEL schema** (TBox), not instance data (ABox)
   - Ontology: "A StockOption has properties exercisePrice, expectedDividends"
   - NOT: "StockOption_2007 has exercisePrice 60.94"

2. **Analogous to domain knowledge**
   - Like teaching someone "financial statements have revenue, expenses, profit"
   - Not giving them "Company X had revenue $100M in 2007"

3. **Built ONCE, used across ALL runs**
   - Not rebuilt per example
   - Evaluation runs are independent of ontology construction

4. **Schema engineering vs. evaluation**
   - Ontology building = setting up the domain
   - Evaluation = testing if agent can reason in that domain

**The key distinction:**
- ❌ Cheating: Using gold answers or pre-computed values
- ✅ Proper: Using domain schema to structure data, then querying it

---

## Conclusion

This design provides a **proper evaluation framework** for ConvFinQA that:

1. **Separates ontology building from evaluation** - ONE-TIME setup vs PER-RUN testing
2. **Uses real knowledge graph queries** - No cheating with gold programs
3. **Enables agent improvement** - Can refine understanding/answering without rebuilding ontology
4. **Provides complete audit trail** - Every question, understanding, tool call, and answer is logged
5. **Supports inspection and debugging** - MongoDB queries reveal agent reasoning

The system is production-ready for evaluating AI agents on financial question answering tasks.
