# ConvFinQA Agent Architecture

## Overview

The ConvFinQA Agent is a neurosymbolic question-answering system that combines:
- **Symbolic reasoning**: Formal ontologies and knowledge graphs
- **Neural reasoning**: LLM-based understanding and planning
- **Tool-augmented execution**: Agentic loops with KG query tools

The system answers conversational financial questions about tabular data by grounding its reasoning in a pre-built ontology and knowledge graph, ensuring factual accuracy and explainability.

## Three-Level Architecture

The system operates in three distinct levels, each with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│ Level 1: ONTOLOGY (TBox)                                     │
│ - Built from training data                                   │
│ - Defines entity types (e.g., kg:CashFlow)                   │
│ - Defines properties (e.g., net_cash_from_operating_...)     │
│ - FROZEN before evaluation                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Level 2: EXAMPLE BACKGROUND KG (ABox)                        │
│ - Built per example from table + text context               │
│ - Instantiates entities (e.g., kg:CashFlow_2008)            │
│ - Stores property values (e.g., 181001)                     │
│ - Does NOT contain questions or answers                     │
│ - FROZEN before question answering                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Level 3: QUESTION ANSWERING                                  │
│ - Receives question text only                                │
│ - Uses tools to query KG                                     │
│ - Produces answer                                            │
│ - Scoring happens EXTERNALLY (agent never sees gold answer)  │
└─────────────────────────────────────────────────────────────┘
```

### Why Three Levels?

**Separation prevents cheating**:
- Ontology can't add properties during KG building (Level 1 frozen)
- KG can't contain answers (Level 2 built from table/text only, not QA)
- Agent can't see gold answers (Level 3 scored externally)

**Evaluation integrity**:
- Each level builds on frozen artifacts from previous level
- All KG queries are logged and traceable
- No data leakage between levels

## Level 1: Ontology Building

### Input
- Training dataset examples (table + text context)

### Process
```javascript
const ontologyBuilder = new OntologyBuilder(ontologyStore, llmClient);

// 1. Process text to extract concepts
await ontologyBuilder.processText(example.pre_text, example.post_text);
// → Creates classes like kg:CashFlow, kg:StockOption
// → Creates properties from text mentions

// 2. Process table structure to extract properties
await ontologyBuilder.processTable(example.table, example.table_ori);
// → Analyzes table rows to create properties
// → Links properties to entity types via rdfs:domain
```

### Output (stored in MongoDB `ontology` collection)
```turtle
kg:CashFlow rdf:type owl:Class .
kg:net_cash_from_operating_activities rdf:type owl:DatatypeProperty .
kg:net_cash_from_operating_activities rdfs:domain kg:CashFlow .
kg:net_cash_from_operating_activities rdfs:label "net cash from operating activities" .
```

### Example
**Input table**:
```
| Row                                          | 2007   | 2008   | 2009   |
|----------------------------------------------|--------|--------|--------|
| Net cash from operating activities           | 158529 | 181001 | 206588 |
| Net cash from investing activities           | -42307 | -50484 | -49699 |
```

**Ontology output**:
- Entity type: `kg:CashFlow`
- Property 1: `kg:net_cash_from_operating_activities` (domain: kg:CashFlow)
- Property 2: `kg:net_cash_from_investing_activities` (domain: kg:CashFlow)

## Level 2: Example Background KG Building

### Input
- Pre-built frozen ontology
- Example table + text (NOT including questions/answers)

### Process
```javascript
const kgBuilder = new KGBuilder(exampleKGStore, ontologyStore, llmClient);

// Build KG from ONLY table and text context
const stats = await kgBuilder.buildFromTable(
  example.table,           // Tabular data
  example.context          // Pre/post text
  // NOTE: example.qa is NEVER passed!
);
```

### Output (stored in MongoDB `example_kgs` collection)
```turtle
kg:CashFlow_2008 rdf:type kg:CashFlow .
kg:CashFlow_2008 kg:year "2008" .
kg:CashFlow_2008 kg:net_cash_from_operating_activities 181001 .

kg:CashFlow_2009 rdf:type kg:CashFlow .
kg:CashFlow_2009 kg:year "2009" .
kg:CashFlow_2009 kg:net_cash_from_operating_activities 206588 .
```

### Critical Safeguard
If the ontology lacks a property needed to represent the table, KGBuilder **fails fast**:

```javascript
// In KGBuilder._buildPropertyMap()
if (!bestMatch || bestScore < 8) {
  throw new Error(
    `No property in ontology matches table row "${rowLabel}".\n` +
    `The ontology must be built from training examples that include these concepts!`
  );
}
```

This ensures the ontology was properly built and prevents adding properties on-the-fly.

## Level 3: Question Answering

The agent operates in **two phases**:

### Phase 1: UNDERSTAND

**Purpose**: Analyze the question and create a plan for answering it.

**Input**:
- Question text
- Available entity types from KG
- Available properties from ontology

**Process**:
```javascript
const understanding = await turnProcessor.understandQuestion(question);
```

**LLM Prompt** (simplified):
```
Question: "what was the percentage change in net cash from operating
           activities from 2008 to 2009"

Available Entity Types and Properties:
- kg:CashFlow
  Properties: net_cash_from_operating_activities, net_cash_from_investing_activities

Analyze this question and provide a clear understanding and plan.

1. **Understanding**: What information is being requested?
2. **Relevant Ontology Concepts**: Entity types and properties needed
3. **Plan**: Step-by-step queries and calculations
4. **Reasoning**: Why this approach will work
```

**Output** (natural language):
```
1. Understanding:
The question asks for the percentage change in net cash from operating
activities between 2008 and 2009.

2. Relevant Ontology Concepts:
- Entity Type: kg:CashFlow
- Property: net_cash_from_operating_activities

3. Plan:
1. Query kg:CashFlow for net_cash_from_operating_activities with year=2008
2. Query kg:CashFlow for net_cash_from_operating_activities with year=2009
3. Calculate: ((2009 value - 2008 value) / 2008 value) × 100

4. Reasoning:
We're using the correct entity type and property. By getting values for
both years, we can calculate the year-over-year percentage change.
```

**Why this is NOT cheating**:
- Understanding is in natural language (not executable commands)
- Agent still has to figure out HOW to use tools to execute the plan
- Agent can adapt if the plan doesn't work (it's guidance, not instructions)
- Agent never sees the gold answer (14.1%)

### Phase 2: ANSWER

**Purpose**: Use tools to query the KG and produce the answer.

**Input**:
- Question text
- Understanding from Phase 1
- Available tools

**Process**: Agentic loop with tool calls

```javascript
const { answer, toolCalls } = await turnProcessor.answerQuestion(
  question,
  understanding
);
```

**LLM Prompt** (simplified):
```
Question: "what was the percentage change..."

Understanding and Plan:
[Natural language understanding from Phase 1]

Available Tools:
1. introspect_ontology - Discover entity types and properties
2. query_kg - Retrieve property values from the knowledge graph
3. list_entities - Discover entity instances
4. calculate - Perform arithmetic calculations

Instructions:
1. Follow the plan from the Understanding section as a guide
2. Use tools to query the knowledge graph
3. Call tools using: TOOL: tool_name({"param": "value"})
4. After getting all needed data, provide just the numerical answer
```

**Execution Flow** (agentic loop):

```
Iteration 1:
  LLM → "I'll follow the plan. First, query 2008 data:"
  LLM → TOOL: query_kg({"entityType": "CashFlow", "filters": {"year": "2008"},
                         "property": "net_cash_from_operating_activities"})
  System → Executes query_kg tool
  System → Returns: {"success": true, "value": 181001}

Iteration 2:
  LLM (sees previous result) → "Now query 2009 data:"
  LLM → TOOL: query_kg({"entityType": "CashFlow", "filters": {"year": "2009"},
                         "property": "net_cash_from_operating_activities"})
  System → Executes query_kg tool
  System → Returns: {"success": true, "value": 206588}

Iteration 3:
  LLM (sees both results) → "Now calculate percentage change:"
  LLM → TOOL: calculate({"operation": "percentage_change", "values": [181001, 206588]})
  System → Executes calculate tool
  System → Returns: {"success": true, "result": 14.14}

Iteration 4:
  LLM (sees calculation result) → "14.14"
  System → Extracts answer → DONE
```

**Output**:
- Answer: `"14.14"`
- Tool calls: Array of 3 tool executions with inputs/outputs

### Available Tools

**1. introspect_ontology**
```javascript
// List all entity types in KG
TOOL: introspect_ontology({"action": "list_types"})
// Returns: {entityTypes: ["kg:CashFlow", "kg:StockOption", ...]}

// Get properties for an entity type
TOOL: introspect_ontology({"action": "get_properties", "entityType": "CashFlow"})
// Returns: {properties: [{name: "net_cash_from_operating_activities", ...}, ...]}
```

**2. query_kg**
```javascript
TOOL: query_kg({
  "entityType": "CashFlow",
  "filters": {"year": "2008"},
  "property": "net_cash_from_operating_activities"
})
// Returns: {success: true, instance: "kg:CashFlow_2008", value: 181001}
```

**3. list_entities**
```javascript
TOOL: list_entities({"entityType": "CashFlow"})
// Returns: {instances: ["kg:CashFlow_2007", "kg:CashFlow_2008", "kg:CashFlow_2009"]}
```

**4. calculate**
```javascript
TOOL: calculate({"operation": "percentage_change", "values": [181001, 206588]})
// Returns: {success: true, result: 14.14}

// Supported operations: add, subtract, multiply, divide, percentage_change
```

## External Scoring

After the agent produces an answer, scoring happens **externally**:

```javascript
// Agent produces answer
const result = await turnProcessor.processTurn(question);
console.log('Agent Answer:', result.answer);  // "14.14"

// External scoring (agent never sees this!)
const correct = turnProcessor.scoreAnswer(result.answer, goldAnswer);
console.log('Gold Answer:', goldAnswer);      // "14.1%"
console.log('Correct:', correct ? '✅' : '❌'); // ✅
```

**Scoring logic**:
```javascript
scoreAnswer(answer, goldAnswer) {
  // Normalize both (remove non-numeric characters)
  const normalizedAnswer = normalize(answer);      // "14.14"
  const normalizedGold = normalize(goldAnswer);    // "14.1"

  // Parse as numbers
  const answerNum = parseFloat(normalizedAnswer);  // 14.14
  const goldNum = parseFloat(normalizedGold);      // 14.1

  // Check with tolerance
  const epsilon = 0.1;
  return Math.abs(answerNum - goldNum) < epsilon;  // true
}
```

## Complete Example: Full Flow

### Setup Phase (Done Once)

**1. Build Ontology**:
```bash
npm run build-ontology 1
```
→ Processes 1 training example to create ontology
→ Stores in MongoDB `ontology` collection

**2. Build Example KGs**:
```bash
npm run build-example-kgs 1
```
→ Builds KG for example 1 using frozen ontology
→ Stores in MongoDB `example_kgs` collection

### Evaluation Phase (Per Example)

**3. Run Evaluation**:
```bash
npm run eval:example1
```

**Question**: "what was the percentage change in the net cash from operating activities from 2008 to 2009"

**UNDERSTAND Phase** → Produces:
```
Understanding: Asks for percentage change between 2008 and 2009
Entity Type: kg:CashFlow
Property: net_cash_from_operating_activities
Plan:
  1. Query 2008 value
  2. Query 2009 value
  3. Calculate percentage change
```

**ANSWER Phase** → Tool calls:
```
1. query_kg({entityType: "CashFlow", filters: {year: "2008"}, property: "..."})
   → 181001
2. query_kg({entityType: "CashFlow", filters: {year: "2009"}, property: "..."})
   → 206588
3. calculate({operation: "percentage_change", values: [181001, 206588]})
   → 14.14
```

**Answer**: `14.14`

**External Scoring**:
```
Agent:  14.14
Gold:   14.1%
Result: ✅ PASS (within 0.1 tolerance)
```

## Data Flow Diagram

```
┌─────────────────┐
│  Training Data  │
│  (table + text) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OntologyBuilder │ ──────────┐
│  .processText() │           │
│  .processTable()│           │
└─────────────────┘           │
                              ▼
                    ┌──────────────────┐
                    │ MongoDB:ontology │ (FROZEN)
                    └──────────────────┘
                              │
         ┌────────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Example Data   │      │ Frozen Ontology │
│ (table + text)  │ ───> │                 │
│ (NO questions!) │      │                 │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └───────┬────────────────┘
                 ▼
         ┌───────────────┐
         │  KGBuilder    │ ──────────┐
         │ .buildFrom... │           │
         └───────────────┘           │
                                     ▼
                          ┌────────────────────┐
                          │ MongoDB:example_kgs│ (FROZEN)
                          └────────────────────┘
                                     │
         ┌───────────────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Question      │      │ Frozen KG       │
│   (text only)   │ ───> │ + Ontology      │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └───────┬────────────────┘
                 ▼
         ┌───────────────┐
         │ TurnProcessor │
         │               │
         │ UNDERSTAND    │ → Natural language plan
         │     ↓         │
         │ ANSWER        │ → Tool calls → KG queries
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │    Answer     │
         │   (number)    │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐      ┌─────────────────┐
         │  Gold Answer  │ ───> │ External Scorer │
         │ (never seen   │      │                 │
         │  by agent!)   │      └────────┬────────┘
         └───────────────┘               │
                                         ▼
                                  ✅ PASS / ❌ FAIL
```

## Logging and Transparency

All prompts and responses are logged to MongoDB for full transparency:

```javascript
// Logged in prompt_logs collection:
{
  turnId: "turn_1728167234567_abc123",
  phase: "UNDERSTAND",
  prompt: "...",           // Full prompt sent to LLM
  response: "...",         // Full response from LLM
  timestamp: ISODate(...)
}

{
  turnId: "turn_1728167234567_abc123",
  phase: "ANSWER_iteration_1",
  prompt: "...",
  response: "TOOL: query_kg(...)",
  timestamp: ISODate(...)
}
```

You can review all LLM interactions:
```bash
mongosh "$MONGO_URI"
use convfinqa_eval
db.prompt_logs.find({phase: /ANSWER/}).pretty()
```

## Key Design Principles

### 1. No Data Leakage
- **Ontology building**: Processes table structure, NOT question-answer pairs
- **KG building**: Uses table + text context, NOT questions or answers
- **Question answering**: Agent receives question text only, never gold answer
- **Scoring**: Happens externally after agent produces answer

### 2. Fail Fast
- **No fallbacks**: If ontology lacks properties, KG building fails immediately
- **No backward compatibility**: One way of doing things, properly
- **No mocks in integration tests**: Test against real MongoDB, real LLM

### 3. Transparency
- **All prompts logged**: Every LLM interaction stored in MongoDB
- **All tool calls logged**: Every KG query recorded with inputs/outputs
- **Explainable results**: Can trace from question → plan → queries → answer

### 4. Separation of Concerns
- **UNDERSTAND phase**: Natural language planning (what to do)
- **ANSWER phase**: Tool-based execution (how to do it)
- **Tools**: Atomic operations (query_kg, calculate, etc.)
- **External scoring**: Evaluation separate from agent

## Testing Strategy

**Unit Tests**: Individual components (tools, parsers, etc.)

**Integration Tests**: Full flows with real LLM and MongoDB
```javascript
// No mocks - tests real system behavior
const ontologyBuilder = new OntologyBuilder(realOntologyStore, realLLMClient);
await ontologyBuilder.processTable(example.table);
// Verify ontology triples created correctly
```

**Evaluation Tests**: End-to-end examples
```bash
npm run eval:example1  # Full pipeline from question to scored answer
```

## Future Enhancements

1. **Multi-turn conversations**: Currently single-turn, extend to conversational QA
2. **Batch evaluation**: Evaluate all examples and compute accuracy metrics
3. **Error analysis**: Categorize failure modes (query errors, calculation errors, etc.)
4. **Tool learning**: Learn which tools work best for which question types
5. **Ontology refinement**: Iteratively improve ontology based on evaluation results

## References

- **ConvFinQA Dataset**: [Paper](https://arxiv.org/abs/2210.03078)
- **Knowledge Graph Construction**: See `/packages/km/ontology/README.md`
- **Tool Design**: See `src/agent/tools/` for tool implementations
- **Evaluation Scripts**: See `scripts/eval-example1.js` for full example
