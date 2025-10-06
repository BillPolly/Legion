# ConvFinQA Agent Evaluation

**Proper evaluation system for ConvFinQA benchmark using knowledge graphs and Claude.**

This package implements a complete agent-based evaluation system for the ConvFinQA (Conversational Financial QA) benchmark that:

1. ✅ **Builds a financial domain ontology** from training data (ONE-TIME)
2. ✅ **Creates instance-level knowledge graphs** from table data per example
3. ✅ **Uses Claude via Anthropic SDK** to understand and answer questions
4. ✅ **Logs everything to MongoDB** for complete audit trail
5. ✅ **Doesn't cheat** - queries KG for values, doesn't use gold programs

## Key Features

- **Anthropic SDK Integration**: Uses `@anthropic-ai/sdk` via `@legion/llm-client`
- **ResourceManager**: Gets ANTHROPIC_API_KEY automatically from `.env`
- **No Cheating**: Agent queries knowledge graph, not gold answers
- **Complete Logging**: MongoDB stores runs, examples, turns, KG, and tool calls
- **Repeatable**: Runs are independent - test agent improvements without rebuilding ontology

## Architecture

```
ONE-TIME:
  ConvFinQA Train Data → OntologyBuilder → MongoDB (TBox)

PER-RUN:
  Load Ontology → Build Instance KG → Process Turns → Log Results
                                       ↓
                            LLM + Tools (query_kg, calculate)
```

See [docs/DESIGN.md](./docs/DESIGN.md) for complete architectural documentation.

## Setup

### 1. Prerequisites

- **Node.js 18+**
- **MongoDB** running locally or remote
- **Anthropic API Key** ([get one here](https://console.anthropic.com/))

### 2. Install Dependencies

```bash
# From monorepo root
npm install

# Or from this package
cd packages/km/examples/convfinqa-agent
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
# REQUIRED: Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

# REQUIRED: MongoDB connection URI
MONGO_URI=mongodb://localhost:27017

# OPTIONAL: Model (defaults to claude-3-5-sonnet-20241022)
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# OPTIONAL: Dataset paths (defaults shown)
CONVFINQA_DATASET_PATH=./data/convfinqa_train.json
CONVFINQA_TEST_PATH=./data/convfinqa_test.json
```

### 4. Download ConvFinQA Dataset

Download from: https://github.com/czyssrs/ConvFinQA

Place `train.json` and `dev.json` in `./data/`:

```bash
mkdir -p data
# Download and place files
mv ~/Downloads/train.json ./data/convfinqa_train.json
mv ~/Downloads/dev.json ./data/convfinqa_test.json
```

## Usage

### Step 1: Build Ontology (ONE-TIME)

**This is a ONE-TIME operation** that processes all 421 training conversations to build a type-level ontology (TBox):

```bash
npm run build-ontology
```

**What this does:**
- Processes ALL ConvFinQA training examples
- Extracts entity types (e.g., StockOption, PensionPlan)
- Extracts properties (e.g., exercisePrice, expectedDividends)
- Stores type-level schema in MongoDB (`convfinqa_eval.ontology`)

**Output:**
```
=== Ontology Statistics ===
Total triples: 847
Classes (entities): 23
Properties: 156

Sample Classes:
  kg:StockOption - "stock option"
  kg:PensionPlan - "pension plan"
  ...
```

**Note:** This creates background knowledge, NOT cheating! We learn "what a StockOption is" from training data, not specific values like "StockOption_2007 has exercisePrice 60.94".

### Step 2: Run Evaluation

**Evaluate on test examples** using the pre-built ontology:

```bash
# Test with first example
npm run eval -- --max-examples 1

# Test with 10 examples
npm run eval -- --max-examples 10

# Full evaluation
npm run eval
```

**What this does:**
1. Loads ontology from MongoDB
2. For each example:
   - Builds instance KG from table
   - For each turn (question):
     - **Understand**: LLM analyzes question
     - **Answer**: LLM uses tools to query KG
   - Logs everything to MongoDB
3. Scores results against gold answers

**Output:**
```
=== ConvFinQA Agent Evaluation ===

[1/10] Example: GOOG_2008_page_60
  ✓ Accuracy: 90% (9/10)
  ✓ KG: 3 instances, 21 triples
  ✓ Duration: 45.2s

...

=== Evaluation Complete ===
Total time: 512.3s
Overall accuracy: 85.5%
```

### Step 3: Inspect Results

**View detailed results** from the latest run:

```bash
# Show latest run summary
npm run inspect

# Show failed turns
npm run inspect -- --show-failed

# Show specific turn details
npm run inspect -- --example-id GOOG_2008_page_60 --turn-index 2

# Show knowledge graph
npm run inspect -- --example-id GOOG_2008_page_60 --show-kg
```

**Example output:**
```
=== Run Summary ===
Run ID: run_2025-01-05T14-30-22-123Z
Accuracy: 85.5%
Total turns: 95
Correct: 81

=== Failed Turns (14) ===
GOOG_2008_page_60 - Turn 3
Question: "what is the percentage change?"
Answer: 142
Gold: 1.42
Understanding: {...}
Tool Calls:
  - query_kg: {...} → {value: 60.94}
  - query_kg: {...} → {value: 25.14}
  - calculate: {...} → {result: 35.8}
```

## How It Works

### Agent Tools

The agent has three tools to interact with the knowledge graph:

#### 1. `query_kg`

Retrieve property values from entities:

```javascript
query_kg({
  entityType: "StockOption",
  filters: { year: "2007" },
  property: "exercisePrice"
})
// Returns: {success: true, value: 60.94}
```

#### 2. `list_entities`

Discover available entities:

```javascript
list_entities({ entityType: "StockOption" })
// Returns: {instances: ["kg:StockOption_2006", "kg:StockOption_2007", "kg:StockOption_2008"]}
```

#### 3. `calculate`

Perform arithmetic:

```javascript
calculate({
  operation: "subtract",
  values: [60.94, 25.14]
})
// Returns: {success: true, result: 35.8}
```

### Example Question Flow

**Question**: "what was the exercise price in 2007?"

**1. Understand Phase:**
```json
{
  "description": "Looking for exercisePrice property of StockOption for year 2007",
  "entityType": "StockOption",
  "property": "exercisePrice",
  "filters": {"year": "2007"}
}
```

**2. Answer Phase:**
```
LLM: I need to query the KG for 2007 exercise price
TOOL: query_kg({"entityType": "StockOption", "filters": {"year": "2007"}, "property": "exercisePrice"})
Result: {value: 60.94}
LLM: 60.94
```

**Final Answer**: `60.94` ✅

## Testing

### Unit Tests

```bash
npm test
```

Tests include:
- **MongoDBProvider**: ITripleStore implementation
- **Agent Tools**: query_kg, list_entities, calculate

### Integration Tests

```bash
npm test __tests__/integration
```

Tests real Anthropic API integration:
- ResourceManager → LLMClient flow
- Real API calls (requires ANTHROPIC_API_KEY)

## MongoDB Collections

All data stored in `convfinqa_eval` database:

### `ontology`
Type-level schema (TBox) built from training data:
```javascript
{s: 'kg:StockOption', p: 'rdf:type', o: 'owl:Class', type: 'ontology'}
{s: 'kg:exercisePrice', p: 'rdfs:domain', o: 'kg:StockOption', type: 'ontology'}
```

### `instances`
Instance-level data (ABox) per evaluation run:
```javascript
{s: 'kg:StockOption_2007', p: 'rdf:type', o: 'kg:StockOption', runId: '...', conversationId: '...'}
{s: 'kg:StockOption_2007', p: 'kg:exercisePrice', o: 60.94, runId: '...', conversationId: '...'}
```

### `evaluation_runs`
Run metadata and results:
```javascript
{runId: 'run_...', status: 'complete', results: {accuracy: 0.855, totalTurns: 95, ...}}
```

### `examples`
Per-conversation results:
```javascript
{runId: '...', conversationId: 'GOOG_2008_page_60', results: {accuracy: 0.9, correctAnswers: 9, ...}}
```

### `turns`
Per-turn question-answer logs:
```javascript
{
  runId: '...',
  conversationId: 'GOOG_2008_page_60',
  turnIndex: 0,
  question: 'what was the exercise price in 2007?',
  understanding: {...},
  toolCalls: [{tool: 'query_kg', input: {...}, output: {...}}],
  answer: '60.94',
  goldAnswer: '60.94',
  correct: true
}
```

## Proper vs. Cheating

### ❌ Cheating (Previous Approach)

```javascript
// Gold program contains the answer!
const program = "60.94";
const answer = execute(program);  // Just returns 60.94
```

**Problems:**
- Values hardcoded in programs
- No actual reasoning
- Can't inspect agent's thinking
- Doesn't test question understanding

### ✅ Proper (This Approach)

```javascript
// 1. Understand question
const understanding = await agent.understandQuestion(
  "what was the exercise price in 2007?"
);

// 2. Query KG
const result = await query_kg({
  entityType: "StockOption",
  filters: {year: "2007"},
  property: "exercisePrice"
});

// 3. Return value
const answer = result.value;  // 60.94 from KG!
```

**Benefits:**
- Agent actually queries structured data
- Complete audit trail
- Tests understanding + retrieval + calculation
- Can inspect every step in MongoDB

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

**Solution:** Make sure you've:
1. Created `.env` file (copy from `.env.example`)
2. Set `ANTHROPIC_API_KEY=sk-ant-...` with your real key
3. Restarted any running processes

### "Failed to connect to MongoDB"

**Solution:**
1. Start MongoDB: `mongod` or `brew services start mongodb-community`
2. Check connection URI in `.env`: `MONGO_URI=mongodb://localhost:27017`
3. Test connection: `mongosh mongodb://localhost:27017`

### "Dataset not found"

**Solution:**
1. Download from https://github.com/czyssrs/ConvFinQA
2. Place in `./data/`:
   - `convfinqa_train.json`
   - `convfinqa_test.json`
3. Or set custom paths in `.env`

### Tests failing with "Cannot find module"

**Solution:**
```bash
# From monorepo root
npm install

# From this package
cd packages/km/examples/convfinqa-agent
npm install
```

## Architecture Documentation

See [docs/DESIGN.md](./docs/DESIGN.md) for:
- Complete architecture diagrams
- Data flow details
- MongoDB schema specifications
- Knowledge graph construction algorithms
- Tool specifications with examples
- Turn-by-turn execution flow
- Logging and inspection queries

## License

MIT
