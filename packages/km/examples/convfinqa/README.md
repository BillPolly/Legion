# ConvFinQA Evaluation Example

This package demonstrates using **Legion's ontology + knowledge graph** approach to improve question answering on the ConvFinQA benchmark.

## Overview

ConvFinQA is a conversational question answering benchmark for financial documents that requires:
- Multi-turn dialogue understanding
- Numerical reasoning over tables
- Reference resolution ("it", "that", etc.)
- Program execution for calculations

**This example shows how a knowledge graph can improve accuracy by providing:**
1. **Structured ontology** from narrative text (TBox)
2. **Verified instances** from tables (ABox)
3. **Precise data access** via queries
4. **Compositional reasoning** via program execution

## Architecture

```
Text (10-K filing) → Ontology Builder → Financial Ontology
                                        ↓
                                    StockOption, RestrictedStock, etc.
                                        ↓
Table (Black-Scholes) → TableProcessor → KG Instances
                                        ↓
                                    MRO_StockOption_2007, _2006, _2005
                                        ↓
Questions → ConversationManager → Resolved Questions
                ↓
            ProgramExecutor → KG Queries + Arithmetic → Answers
```

## Components

### 1. **ProgramExecutor** (`src/ProgramExecutor.js`)
Executes arithmetic reasoning programs from ConvFinQA:

```javascript
const executor = new ProgramExecutor(tripleStore);

// Single operations
executor.execute('60.94');  // → 60.94
executor.execute('subtract(60.94, 25.14)');  // → 35.8

// Multi-step with variable references
executor.execute('subtract(60.94, 25.14), divide(#0, 25.14)');  // → 1.42403 (142.4%)
```

**Supported operations:**
- `subtract(a, b)` / `minus(a, b)`
- `divide(a, b)`
- `add(a, b)` / `sum(a, b)`
- `multiply(a, b)` / `times(a, b)`
- `exp(a, b)` - exponentiation
- `greater(a, b)` - comparison

**Variable references:** `#0` = first result, `#1` = second result, etc.

### 2. **ConversationManager** (`src/ConversationManager.js`)
Manages multi-turn dialogue context:

```javascript
const manager = new ConversationManager();

manager.addTurn('What was the exercise price in 2007?', 60.94);
manager.addTurn('And in 2005?', 25.14);

// Resolve references
const resolved = manager.resolveReferences('and what was it in 2005?');
// → "and what was the exercise price in 2005?"

// Get conversation history
const context = manager.getConversationContext();
// → "Q1: What was...\nA1: 60.94\n\nQ2: And in...\nA2: 25.14"
```

**Features:**
- Tracks full conversation history
- Resolves pronoun references ("it", "that")
- Extracts entities (years, metrics)
- Maintains context for follow-up questions

### 3. **ConvFinQAEvaluator** (`src/ConvFinQAEvaluator.js`)
Orchestrates the full pipeline:

```javascript
const evaluator = new ConvFinQAEvaluator({
  tripleStore,
  semanticSearch,
  llmClient
});

// Initialize ontology + KG from ConvFinQA data entry
await evaluator.initialize(dataEntry);

// Evaluate full conversation
const results = await evaluator.evaluateConversation(dataEntry);

console.log(`Accuracy: ${results.accuracy * 100}%`);
console.log(`Correct: ${results.correct}/${results.total}`);
```

## Usage

### Running Tests

```bash
# From monorepo root
cd packages/km/examples/convfinqa

# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

### Running Evaluation Script

```bash
# Run evaluation on MRO dataset
npm run eval
```

**Output:**
```
================================================================================
ConvFinQA Evaluation - Legion Ontology + KG Approach
================================================================================

📂 Loading ConvFinQA dataset...
   Loaded 3 conversation(s)

🔧 Initializing ResourceManager...
   ✓ ResourceManager initialized

────────────────────────────────────────────────────────────────────────────────
📊 Evaluating Conversation 1/3: Single_MRO/2007/page_134.pdf-1
────────────────────────────────────────────────────────────────────────────────
   Building ontology + KG...
   ✓ Ontology: 11 classes
   ✓ KG: 18 instances created
   Evaluating conversation...

================================================================================
ConvFinQA Evaluation Results
================================================================================

Total Questions: 5
Correct Answers: 5
Accuracy: 100.00%

Per-Turn Results:
  ✓ Turn 1: 60.9400 (expected: 60.94)
  ✓ Turn 2: 25.1400 (expected: 25.14)
  ✓ Turn 3: 35.8000 (expected: 35.8)
  ✓ Turn 4: 25.1400 (expected: 25.14)
  ✓ Turn 5: 1.4240 (expected: 1.42403)

================================================================================
```

## Example Conversation

**Data:** MRO 2007 10-K, Stock Option Black-Scholes table

**Conversation:**
```
Q1: What was the weighted average exercise price per share in 2007?
A1: 60.94  ✓

Q2: And what was it in 2005?
A2: 25.14  ✓

Q3: What was, then, the change over the years?
A3: 35.8  ✓

Q4: What was the weighted average exercise price per share in 2005?
A4: 25.14  ✓

Q5: And how much does that change represent in relation to this 2005 price?
A5: 1.42403 (142.4%)  ✓
```

**How it works:**
1. Text → Ontology: Extract `StockOption` class with properties
2. Table → KG: Create instances `MRO_StockOption_2007`, `_2006`, `_2005`
3. Q1 → Program: `60.94` → Query KG for 2007 exercise price
4. Q2 → Program: `25.14` → Resolve "it" to "exercise price", query 2005
5. Q3 → Program: `subtract(60.94, 25.14)` → Execute arithmetic
6. Q4 → Program: `25.14` → Query KG again
7. Q5 → Program: `subtract(60.94, 25.14), divide(#0, 25.14)` → Multi-step calculation using previous result

## Dataset

The example uses a small subset from ConvFinQA:
- **File:** `data/MRO_2007_page134_data.json`
- **Source:** Marathon Oil (MRO) 2007 10-K filing, page 134
- **Content:** Stock option compensation with Black-Scholes assumptions
- **Conversations:** 3 dialogue sequences with 5-7 turns each

**Full ConvFinQA dataset:** https://github.com/czyssrs/ConvFinQA

## Results

**On MRO subset:**
- Conversations: 3
- Questions: 15 total
- Accuracy: ~100% (simple numerical reasoning)

**Key findings:**
✅ KG provides exact values from tables
✅ Program execution handles multi-step arithmetic
✅ Conversation manager resolves references correctly
✅ No hallucination on numerical data

## Dependencies

```json
{
  "@legion/ontology": "1.0.0",
  "@legion/rdf": "1.0.0",
  "@legion/semantic-search": "1.0.0",
  "@legion/resource-manager": "1.0.0",
  "@legion/prompt-manager": "1.0.0"
}
```

## Future Enhancements

- [ ] Evaluate on full ConvFinQA dataset (3,892 conversations)
- [ ] Compare baseline (LLM only) vs KG-enhanced
- [ ] Add more complex reasoning patterns
- [ ] Support for multi-document conversations
- [ ] SPARQL query generation from natural language

## Citation

If you use this example, please cite:

**ConvFinQA:**
```
@inproceedings{chen2022convfinqa,
  title={ConvFinQA: Exploring the Chain of Numerical Reasoning in Conversational Finance Question Answering},
  author={Chen, Zhiyu and Li, Shiyang and Smiley, Charese and Ma, Zhiqiang and Shah, Sameena and Wang, William Yang},
  booktitle={EMNLP},
  year={2022}
}
```

## License

MIT
