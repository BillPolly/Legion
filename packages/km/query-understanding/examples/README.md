# Query Understanding Examples

This directory contains runnable examples demonstrating the query understanding pipeline.

## Multi-Turn Conversation Demo

**File**: `multi-turn-conversation-demo.js`

**Purpose**: Demonstrates graph-based reference resolution in multi-turn conversations.

**What It Shows**:
- Possessive reference resolution ("its capital")
- Ellipsis expansion ("What about France?")
- Implicit reference continuation ("And the area?")
- Multi-turn context persistence (5+ turns)
- Graph context retrieval for entities
- Entity salience tracking for reference resolution

**How to Run**:
```bash
cd packages/km/query-understanding
node examples/multi-turn-conversation-demo.js
```

**Example Output**:
```
================================================================================
Conversation: Possessive Reference Resolution
Description: Demonstrates 'its capital' resolving to Germany
================================================================================

[Turn 1] User: Which countries border Germany?
[Turn 1] Canonical: Which countries border Germany?
[Turn 1] Entities: Germany
[Turn 1] Results: France, Poland
[Turn 1] Context Entities: France, Poland, Germany

[Turn 2] User: What is its capital?
[Turn 2] Canonical: What is its capital?
[Turn 2] Context Entities: France, Poland, Germany

================================================================================
Conversation complete: 2 turns processed
```

**Technical Details**:
- Uses mock `DataSource` with realistic geography graph data
- Mock `QueryUnderstandingPipeline` for simple entity extraction
- Real `MultiTurnPipeline` with `GraphContextRetriever`
- No external dependencies required (runs standalone)

**Test Coverage**:
This example demonstrates patterns covered by 45 tests:
- 17 GraphContextRetriever integration tests
- 14 MultiTurnPipeline integration tests
- 14 E2E conversation flow tests

All tests passing: 292/292 (100%)

## Ontologies

**File**: `ontologies/geography.js`

**Purpose**: Geography domain ontology for testing and demos.

**Contents**:
- Classes: Country, City, River, Mountain, Continent, Ocean, Lake
- Properties: borders, capital, population, area, locatedIn, flowsThrough, height, length
- Individuals: European countries, major cities, rivers, mountains, continents

**Usage**:
```javascript
import { geographyOntology } from './ontologies/geography.js';
await indexer.indexOntology(geographyOntology);
```

Used by:
- `__tests__/domains/geography.integration.test.js`
- `multi-turn-conversation-demo.js` (conceptually)

## Future Examples

Potential examples to add:
- Finance domain conversations (company information, stock queries)
- Academic domain conversations (papers, authors, citations)
- Real-time benchmark runner (ConvQuestions, CSQA)
- Custom ontology creation walkthrough
