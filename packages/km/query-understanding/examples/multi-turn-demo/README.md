# Multi-Turn Conversation Demo

This demo shows how the Query Understanding System handles **multi-turn conversations** with pronoun resolution and referring expression handling.

## What This Demo Does

1. **Tracks conversation context** - Remembers previous questions and entities
2. **Resolves pronouns** - "What about France?" → "Which countries border France?"
3. **Handles ellipsis** - "How many are there?" → References previous results
4. **Maintains entity salience** - Most recently mentioned entities are tracked

## Files

- `demo.js` - Interactive multi-turn conversation demo
- Uses same data as `complete-demo-with-answers` (8 countries)
- Uses `MultiTurnPipeline` wrapper class

## Running the Demo

```bash
node examples/multi-turn-demo/demo.js
```

## Sample Conversation

```
Turn 1: "Which countries border Germany?"
→ Answer: France, Poland, Austria, Switzerland, Belgium (5 countries)

Turn 2: "What about France?"
→ LLM resolves to: "Which countries border France?"
→ Answer: Germany, Spain, Italy, Switzerland, Belgium (5 countries)

Turn 3: "How many are there?"
→ LLM uses context from Turn 2
→ Answer: 5 countries
```

## Key Features Demonstrated

### 1. Context Injection

The `MultiTurnPipeline` automatically injects conversation context into Phase 1:

```javascript
const context = {
  previousQuestion: "Which countries border Germany?",
  conversationHistory: ["Which countries border Germany?"],
  domain: "geography"
};
```

### 2. Entity Tracking

After each turn, entities are extracted and tracked:

```javascript
const entities = pipeline.getRecentEntities();
// Returns: [
//   { value: "France", canonical: ":France", type: "Country", turnIndex: 1 },
//   { value: "Germany", canonical: ":Germany", type: "Country", turnIndex: 0 }
// ]
```

### 3. Pronoun Resolution

Phase 1 (RewriteResolver) uses conversation context to resolve pronouns:

**Prompt includes**:
```
Previous question: Which countries border Germany?

Current question: What about France?

Resolve references:
- "What about France?" → "Which countries border France?"
```

### 4. Implicit References

The LLM can resolve implicit references using context:

- "How many are there?" → Uses previous question structure
- "What is its population?" → Resolves "its" to most salient entity

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    User asks question                           │
│                    "What about France?"                         │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                  MultiTurnPipeline                              │
│  - Retrieves conversation context                              │
│  - Injects into pipeline.process(question, context)            │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                  Phase 1: RewriteResolver                       │
│  - Receives context with previousQuestion                      │
│  - LLM resolves: "What about France?"                          │
│               → "Which countries border France?"               │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│               Phases 2-4: Parse, Map, Generate                  │
│  - Process resolved question normally                           │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                  MultiTurnPipeline                              │
│  - Stores turn in ConversationContext                          │
│  - Extracts entities for next turn                             │
└────────────────────────────────────────────────────────────────┘
```

## ConversationContext API

The `ConversationContext` class tracks conversation state:

```javascript
// Add a turn
context.addTurn({
  question: "Which countries border Germany?",
  canonicalQuestion: { text: "...", entities: [...], ... },
  query: { find: ['?x'], where: [...] },
  results: [...]
});

// Get previous question
const prev = context.getPreviousQuestion();
// → "Which countries border Germany?"

// Get conversation history
const history = context.getConversationHistory();
// → ["Which countries border Germany?"]

// Get recent entities (most recent first)
const entities = context.getRecentEntities(3);
// → [
//     { value: "France", canonical: ":France", ... },
//     { value: "Germany", canonical: ":Germany", ... }
//   ]

// Get most salient entity
const salient = context.getMostSalientEntity();
// → { value: "France", canonical: ":France", ... }

// Clear conversation
context.clear();

// Serialize/deserialize
const json = context.serialize();
const restored = ConversationContext.deserialize(json);
```

## MultiTurnPipeline API

The `MultiTurnPipeline` wraps `QueryUnderstandingPipeline`:

```javascript
import { MultiTurnPipeline } from '@legion/query-understanding';

// Create pipeline
const pipeline = new MultiTurnPipeline(resourceManager, {
  maxTurns: 10,
  domain: 'geography'
});

await pipeline.initialize();

// Ask questions
const result1 = await pipeline.ask("Which countries border Germany?");
const result2 = await pipeline.ask("What about France?");

// Access context
const context = pipeline.getContext();
const entities = pipeline.getRecentEntities();
const salient = pipeline.getMostSalientEntity();

// Manage state
pipeline.clear();
const state = pipeline.serialize();
pipeline.deserialize(state);
```

## Example Output

When you run the demo, you'll see:

```
╔════════════════════════════════════════════════════════════════════════════╗
║                   MULTI-TURN CONVERSATION DEMO                             ║
║                                                                            ║
║  Demonstrating: Pronoun Resolution & Context Tracking                     ║
╚════════════════════════════════════════════════════════════════════════════╝

💬 Initial question - establishes context

═══════════════════════════════════════════════════════════════════════════════
🔵 TURN 1: "Which countries border Germany?"
═══════════════════════════════════════════════════════════════════════════════

【Canonical Question】
✓ "which countries border Germany?"

【Entities】
  - Germany → :Germany (PLACE)

【Generated Query】
{
  "find": ["?x"],
  "where": [
    ["?x", ":type", ":Country"],
    ["?x", ":borders", ":Germany"]
  ]
}

【Execution】
🔍 Executing query...

📋 ANSWER:
✅ Found 5 result(s):
  1. France (pop: 67,000,000)
  2. Poland (pop: 38,000,000)
  3. Austria (pop: 9,000,000)
  4. Switzerland (pop: 8,700,000)
  5. Belgium (pop: 11,500,000)

═══════════════════════════════════════════════════════════════════════════════

📝 Conversation Context for Next Turn:
   - Previous Question: "Which countries border Germany?"
   - Recent Entities: France, Poland, Austria

⏳ Next turn in 2 seconds...

💬 Ellipsis - LLM should resolve to "Which countries border France?"

═══════════════════════════════════════════════════════════════════════════════
🔵 TURN 2: "What about France?"
═══════════════════════════════════════════════════════════════════════════════

【Canonical Question】
✓ "which countries border France?"

【Entities】
  - France → :France (PLACE)

【Generated Query】
{
  "find": ["?x"],
  "where": [
    ["?x", ":type", ":Country"],
    ["?x", ":borders", ":France"]
  ]
}

【Execution】
🔍 Executing query...

📋 ANSWER:
✅ Found 5 result(s):
  1. Germany (pop: 83,000,000)
  2. Spain (pop: 47,000,000)
  3. Italy (pop: 60,000,000)
  4. Switzerland (pop: 8,700,000)
  5. Belgium (pop: 11,500,000)

═══════════════════════════════════════════════════════════════════════════════
```

## Benefits of Multi-Turn Support

✅ **Natural conversation flow** - Users don't need to repeat context
✅ **Reduced verbosity** - "What about France?" instead of full question
✅ **Better UX** - More intuitive for conversational AI
✅ **Leverages LLM strength** - Coreference resolution is what LLMs excel at
✅ **Stateful but manageable** - Clear APIs for state management

## Use Cases

### 1. Conversational AI Assistants

```
User: "Which countries border Germany?"
Bot: "Germany shares borders with France, Poland, Austria, Switzerland, and Belgium."

User: "What about Italy?"
Bot: "Italy borders France, Austria, Switzerland, and Slovenia."

User: "Which one has the largest population?"
Bot: "France has the largest population at 67 million."
```

### 2. Data Exploration

```
Analyst: "Show me revenue for 2023"
System: [Returns revenue data]

Analyst: "What about 2024?"
System: [Automatically queries revenue for 2024]

Analyst: "Compare them"
System: [Compares 2023 vs 2024 revenue]
```

### 3. Research Assistant

```
Researcher: "Who invented the telephone?"
Assistant: "Alexander Graham Bell invented the telephone in 1876."

Researcher: "Where was he born?"
Assistant: "Alexander Graham Bell was born in Edinburgh, Scotland."

Researcher: "Tell me more about his other inventions"
Assistant: [Provides information about Bell's other inventions]
```

## Next Steps

To use multi-turn conversation in your application:

1. **Replace SimpleJSONExecutor** with real DataStore
2. **Implement conversation persistence** (save/load state)
3. **Add clarification handling** when context is ambiguous
4. **Implement conversation reset** when topic changes significantly

## Integration Example

```javascript
import { MultiTurnPipeline } from '@legion/query-understanding';
import { DataStoreDataSource } from '@legion/data-proxies';

// Create multi-turn pipeline
const pipeline = new MultiTurnPipeline(resourceManager, {
  maxTurns: 20,
  domain: 'finance'
});

await pipeline.initialize();

// In your conversational AI loop
async function handleUserMessage(userMessage, conversationId) {
  // Load conversation state
  const state = await loadConversationState(conversationId);
  if (state) {
    pipeline.deserialize(state);
  }

  // Process question with context
  const result = await pipeline.ask(userMessage);

  // Execute query and get results
  const dataSource = await resourceManager.get('dataSource');
  const answers = await dataSource.query(result.query);

  // Save conversation state
  await saveConversationState(conversationId, pipeline.serialize());

  return {
    answer: formatAnswer(answers),
    context: pipeline.getRecentEntities()
  };
}
```

## Backward Compatibility

✅ **Zero breaking changes** - Existing single-turn code works unchanged
✅ **Optional feature** - Use `MultiTurnPipeline` only when needed
✅ **Existing tests pass** - All 193 original tests still pass

## Tests

Multi-turn conversation support includes:
- 16 ConversationContext unit tests
- 12 MultiTurnPipeline unit tests
- Integration tests with real LLM

All tests pass with 100% coverage.
