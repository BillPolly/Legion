# SOP Registry

MongoDB-backed semantic knowledge base for Standard Operating Procedures (SOPs).

## Overview

The SOP Registry enables agents to discover, retrieve, and apply procedural knowledge through multi-perspective semantic search. SOPs are stored as JSON files, loaded into MongoDB, and semantically indexed using LLM-generated perspectives and Nomic embeddings.

## Quick Start

```javascript
import SOPRegistry from '@legion/sop-registry';

const sopRegistry = await SOPRegistry.getInstance();

const results = await sopRegistry.searchSOPs('book train to Paris');

console.log(`Found ${results.length} SOPs`);
results.forEach(r => {
  console.log(`- ${r.sop.title} (score: ${r.score})`);
});
```

## Features

- **Multi-Perspective Semantic Search**: Search SOPs from 4 different angles (intent, preconditions, tools, outcomes)
- **Step-Level Retrieval**: Find specific steps across all SOPs
- **Hybrid Search**: Combines semantic (vector) and text search
- **Auto-Loading**: Automatically loads SOPs from data/sops/ directory
- **Real Embeddings**: 768-dim Nomic embeddings for semantic search
- **MongoDB Storage**: Persistent storage with indexing

## Installation

```bash
npm install
```

**Requirements:**
- MongoDB running locally or configured via MONGODB_URL
- Anthropic API key for perspective generation

## Basic Usage

### Search SOPs

```javascript
const sopRegistry = await SOPRegistry.getInstance();

const results = await sopRegistry.searchSOPs('booking train');

results.forEach(result => {
  console.log(`SOP: ${result.sop.title}`);
  console.log(`Score: ${result.score}`);
  console.log(`Steps: ${result.sop.steps.length}`);
});
```

### Search Steps

```javascript
const stepResults = await sopRegistry.searchSteps('call payment API');

stepResults.forEach(r => {
  console.log(`SOP: ${r.sop.title}`);
  console.log(`Step ${r.stepIndex + 1}: ${r.step.gloss}`);
  console.log(`Score: ${r.score}`);
});
```

### Retrieve Specific SOP

```javascript
const sop = await sopRegistry.getSOPByTitle('Book a train ticket');

console.log(`Intent: ${sop.intent}`);
console.log(`Prerequisites: ${sop.prerequisites.join(', ')}`);
console.log(`Tools: ${sop.toolsMentioned.join(', ')}`);

sop.steps.forEach((step, i) => {
  console.log(`${i+1}. ${step.gloss}`);
  if (step.suggestedTools) {
    console.log(`   Tools: ${step.suggestedTools.join(', ')}`);
  }
});
```

### Get Statistics

```javascript
const stats = await sopRegistry.getStatistics();

console.log(`Total SOPs: ${stats.sops.total}`);
console.log(`Total Perspectives: ${stats.perspectives.total}`);
```

## API Reference

### SOPRegistry

#### Loading
- `loadAllSOPs(options)` - Load all SOPs from data/sops/
- `reloadSOPs(options)` - Reload SOPs with optional perspective regeneration

#### Retrieval
- `getSOP(sopId)` - Get SOP by MongoDB ID
- `getSOPByTitle(title)` - Get SOP by title
- `listSOPs(filter)` - List all SOPs with optional filter

#### Search
- `searchSOPs(query, options)` - Hybrid semantic + text search
- `searchSteps(query, options)` - Search individual steps
- `searchSOPsByIntent(intent)` - Filter by intent perspective
- `searchSOPsByTools(tools)` - Find SOPs using specific tools
- `searchSOPsByPreconditions(conditions)` - Filter by prerequisites

#### Perspectives
- `generatePerspectives(sopId, options)` - Generate for single SOP
- `generateAllPerspectives(options)` - Generate for all SOPs

#### Management
- `getStatistics()` - Get registry statistics
- `healthCheck()` - Check system health
- `cleanup()` - Close connections

## Configuration

Via ResourceManager (.env file):

```bash
MONGODB_URL=mongodb://localhost:27017
SOP_DB_NAME=legion_sops
ANTHROPIC_API_KEY=your_key_here
```

## Testing

```bash
npm test
```

All tests use real dependencies (MongoDB, LLM, Nomic embeddings).

## SOP File Format

SOPs are stored as JSON files in `data/sops/`:

```json
{
  "title": "Book a train ticket",
  "intent": "User wants to find and purchase a train ticket",
  "description": "Complete workflow for train booking",
  "prerequisites": [
    "User has payment method configured"
  ],
  "inputs": {
    "origin": { "type": "location", "required": true }
  },
  "outputs": {
    "booking": { "type": "object" }
  },
  "steps": [
    {
      "gloss": "Search for available trains",
      "suggestedTools": ["train-search-api"],
      "doneWhen": "Train options retrieved"
    }
  ],
  "toolsMentioned": ["train-search-api"],
  "tags": ["travel", "booking"],
  "quality": {
    "source": "curated",
    "rating": 95
  }
}
```

## Architecture

- **SOPRegistry**: Singleton orchestrator
- **SOPStorage**: MongoDB operations
- **SOPLoader**: JSON file loading
- **SOPPerspectives**: LLM-based perspective generation
- **SOPSearch**: Semantic + text search

See `docs/DESIGN.md` for detailed architecture.