# SOP Registry Design Document (MVP)

## 1. Overview

The **SOP Registry** is a MongoDB-backed semantic knowledge base for Standard Operating Procedures (SOPs). It enables agents to discover, retrieve, and apply procedural knowledge through multi-perspective semantic search.

An SOP represents a reusable procedure for accomplishing a specific goal. The registry stores SOPs as JSON files in the package, loads them into MongoDB, generates multiple semantic perspectives for enhanced discoverability, and provides search capabilities at both whole-SOP and individual-step granularity.

**Key Capabilities:**
- Load SOPs from JSON files in the package data directory
- Store SOPs in MongoDB with full-text indexing
- Generate semantic perspectives from multiple angles (intent, tools, preconditions, outcomes)
- Embed and index perspectives using Nomic (768-dim vectors)
- Search SOPs by intent, tools used, prerequisites, or expected outcomes
- Retrieve whole SOPs or individual relevant steps
- Provide ranked results using hybrid semantic + text search

## 2. SOP Data Model

### 2.1 SOP Document Schema

```javascript
{
  _id: ObjectId,
  title: string,                    // "Book a train ticket"
  intent: string,                   // What user goal this addresses
  description: string,              // Overview of the procedure
  
  prerequisites: string[],          // Natural language bullets
  inputs: {                         // Required inputs
    [paramName]: {
      description: string,
      type: string,                 // "string", "date", "location", etc.
      required: boolean
    }
  },
  outputs: {                        // Expected outputs
    [outputName]: {
      description: string,
      type: string
    }
  },
  
  steps: [                          // Sequential procedure steps
    {
      gloss: string,                // NL description: "Search for available trains"
      suggestedTools?: string[],    // ["train-search-api", "booking-service"]
      doneWhen?: string,            // NL completion condition
      index: number                 // Step order (auto-assigned)
    }
  ],
  
  variants?: string[],              // Alternative approaches
  toolsMentioned: string[],         // All tools referenced across steps
  tags: string[],                   // Categorization tags
  
  quality: {
    source: string,                 // "curated", "generated", "user-contributed"
    rating?: number,                // 0-100 quality score
    updated: string                 // ISO date string
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

### 2.2 SOP Perspective Types

Five default perspective types for comprehensive semantic coverage:

```javascript
DEFAULT_SOP_PERSPECTIVE_TYPES = [
  {
    name: "intent_perspective",
    description: "What user goal or intent does this SOP address?",
    prompt_template: "Describe the user's goal or intent that this SOP addresses. Focus on what the user is trying to accomplish. SOP: {title} - {intent}. One sentence maximum.",
    category: "discovery",
    scope: "sop",
    order: 1,
    enabled: true
  },
  {
    name: "preconditions_perspective",
    description: "What must be true before using this SOP?",
    prompt_template: "List the key prerequisites and preconditions for this SOP. What must exist or be true before starting? SOP: {title}. Prerequisites: {prerequisites}. One sentence maximum.",
    category: "applicability",
    scope: "sop",
    order: 2,
    enabled: true
  },
  {
    name: "tools_perspective",
    description: "What tools and resources does this SOP use?",
    prompt_template: "List the primary tools, APIs, and resources used in this SOP. Focus on what the SOP relies on. SOP: {title}. Tools: {toolsMentioned}. One sentence maximum.",
    category: "technical",
    scope: "sop",
    order: 3,
    enabled: true
  },
  {
    name: "outcomes_perspective",
    description: "What results or outputs does this SOP produce?",
    prompt_template: "Describe the key outputs and results produced by this SOP. What does the user get when it's complete? SOP: {title}. Outputs: {outputs}. One sentence maximum.",
    category: "results",
    scope: "sop",
    order: 4,
    enabled: true
  },
  {
    name: "step_perspective",
    description: "What does this individual step accomplish?",
    prompt_template: "Describe what this step accomplishes in the context of the SOP. Step: {stepGloss}. SOP context: {title}. One sentence maximum.",
    category: "execution",
    scope: "step",
    order: 5,
    enabled: true
  }
]
```

**Scope Types:**
- `scope: "sop"` - Generated once per SOP (4 perspectives)
- `scope: "step"` - Generated once per step (N perspectives for N steps)

### 2.3 SOP Perspective Document Schema

```javascript
{
  _id: ObjectId,
  
  sop_id: ObjectId,                     // Reference to sops collection
  sop_title: string,                    // Denormalized for performance
  
  perspective_type_name: string,        // "intent_perspective", etc.
  perspective_type_id: ObjectId,        // Reference to sop_perspective_types
  
  scope: "sop" | "step",                // Whole SOP or individual step
  step_index?: number,                  // If scope=step, which step (0-indexed)
  
  content: string,                      // Generated perspective text (1 sentence)
  keywords: string[],                   // Extracted keywords from content
  
  embedding: number[],                  // 768-dim vector (Nomic)
  embedding_model: string,              // "nomic-embed-text-v1.5"
  embedding_dimensions: number,         // 768
  
  generated_at: Date,
  llm_model: string,                    // Model used for generation
  batch_id: string                      // Links perspectives generated together
}
```

## 3. Architecture Components

### 3.1 SOPRegistry (Singleton)

Main entry point following ToolRegistry pattern:

```javascript
class SOPRegistry {
  static _instance = null;
  static async getInstance()          // Get singleton
  static reset()                      // Test only
  
  constructor({ resourceManager })
  async initialize()
  
  // Loading SOPs
  async loadAllSOPs(options)          // Load all from data/sops/
  async reloadSOPs(options)           // Reload with option to regenerate
  
  // Retrieval
  async getSOP(sopId)
  async getSOPByTitle(title)
  async listSOPs(filter)
  
  // Search
  async searchSOPs(query, options)    // Hybrid search
  async searchSOPsByIntent(intent)    // Specialized searches
  async searchSOPsByTools(tools)
  async searchSOPsByPreconditions(conditions)
  async searchSteps(query, options)   // Step-level search
  
  // Perspectives
  async generatePerspectives(sopId, options)
  async generateAllPerspectives(options)
  
  // Management
  async getStatistics()
  async healthCheck()
  async cleanup()
}
```

**Key Design:**
- Singleton pattern (like ToolRegistry)
- Auto-loads SOPs from `data/sops/` on first `getInstance()`
- All dependencies via ResourceManager
- NO direct instantiation allowed

### 3.2 SOPStorage

MongoDB operations for SOPs (simplified from DatabaseStorage):

```javascript
class SOPStorage {
  constructor({ resourceManager })
  
  async initialize()                  // Connect to MongoDB, setup collections
  async close()
  
  // SOP CRUD
  async saveSOP(sopDoc)
  async findSOP(sopId)
  async findSOPByTitle(title)
  async findSOPs(filter)
  async deleteSOP(sopId)
  async countSOPs(filter)
  
  // Perspective type operations
  async savePerspectiveType(typeDoc)
  async findPerspectiveTypes(filter)
  async getPerspectiveType(name)
  
  // Perspective operations
  async saveSOPPerspectives(perspectiveDocs)
  async findSOPPerspectives(filter)
  async findPerspectivesBySOP(sopId)
  async findPerspectivesByStep(sopId, stepIndex)
  async countSOPPerspectives(filter)
  
  // Cleanup
  async clearAll()
  async clearSOPPerspectives(sopId)
  
  // Stats
  async getStatistics()
  async healthCheck()
}
```

**Key Design:**
- ResourceManager provides MONGODB_URL
- Database name from env or default: `legion_sops`
- Auto-initializes collections and indexes
- Seeds default perspective types
- Fail-fast on connection errors

### 3.3 SOPLoader

Loads SOPs from JSON files in package data directory:

```javascript
class SOPLoader {
  constructor({ sopStorage, packageRoot })
  
  // Discovery
  async discoverSOPFiles()            // Scan data/sops/ recursively
  
  // Loading
  async loadFromFile(filePath)        // Parse and validate single JSON
  async loadAllFromDataDir()          // Load all from data/sops/
  
  // Validation
  validateSOPStructure(sopDoc)        // Check required fields
  validateSteps(steps)                // Validate step array
  extractToolsMentioned(sop)          // Auto-extract from steps
  normalizeInputsOutputs(sop)         // Ensure objects not undefined
}
```

**Key Design:**
- Scans `packages/planning/sop-registry/data/sops/` directory
- Only handles `.json` files
- Uses `JSON.parse()` (no YAML dependency)
- Validates against required schema
- Auto-populates `toolsMentioned` from steps
- Assigns step indices automatically
- Fail-fast on parse errors or validation failures

### 3.4 SOPPerspectives

Generates semantic perspectives for SOPs (mirrors Perspectives.js):

```javascript
class SOPPerspectives {
  constructor({ resourceManager, sopStorage })
  
  async initialize()
  
  // Generation
  async generateForSOP(sopId, options)
  async generateForAllSOPs(options)
  
  // Internal methods
  async _generateSOPLevelPerspectives(sop)    // 4 perspectives in 1 LLM call
  async _generateStepPerspectives(sop)        // 1 per step, batch LLM call
  async _embedPerspectives(perspectives)      // Batch Nomic embedding
  async _createMultiPerspectivePrompt(sop, types)
  async _parseMultiPerspectiveResponse(response, types)
}
```

**Key Design:**
- Single LLM call generates all 4 SOP-level perspectives
- Separate batch call generates all step perspectives
- Nomic embedding in batches (efficient)
- Follows exact pattern from tools-registry/Perspectives.js
- Stores with embeddings in sop_perspectives collection

### 3.5 SOPSearch

Semantic and hybrid search (mirrors SemanticSearch.js):

```javascript
class SOPSearch {
  constructor({ resourceManager, sopStorage })
  
  async initialize()
  
  // Core search
  async searchSemantic(query, options)        // Vector similarity
  async searchText(query, options)            // MongoDB text search
  async searchHybrid(query, options)          // Weighted combination
  
  // Step-level search
  async searchSteps(query, options)           // Find relevant steps
  
  // Specialized searches
  async searchByIntent(intent)
  async searchByTools(toolNames)
  async searchByPreconditions(conditions)
  
  // Internal
  async _getQueryEmbedding(query)             // Cached embeddings
  async _combineHybridResults(semantic, text, weight)
}
```

**Key Design:**
- Vector search via Nomic embeddings (768-dim)
- Text search via MongoDB text indexes
- Hybrid scoring: `(semantic * 0.6) + (text * 0.4)`
- Query embedding caching (LRU cache)
- Returns ranked results with matched perspectives

## 4. JSON File Format Specification

### 4.1 Minimal Valid SOP

```json
{
  "title": "Example SOP",
  "intent": "Accomplish something",
  "description": "How to do it",
  "steps": [
    { "gloss": "Do the thing" }
  ]
}
```

### 4.2 Complete SOP Example

```json
{
  "title": "Book a train ticket",
  "intent": "User wants to find and purchase a train ticket for travel",
  "description": "Complete workflow for searching, selecting, and booking train tickets",
  
  "prerequisites": [
    "User has payment method configured",
    "Train booking API access is available",
    "User knows origin and destination"
  ],
  
  "inputs": {
    "origin": {
      "description": "Starting location",
      "type": "location",
      "required": true
    },
    "destination": {
      "description": "Ending location",
      "type": "location",
      "required": true
    },
    "travelDate": {
      "description": "Date of travel",
      "type": "date",
      "required": true
    }
  },
  
  "outputs": {
    "booking": {
      "description": "Confirmed train booking",
      "type": "object"
    },
    "confirmation": {
      "description": "Booking confirmation code",
      "type": "string"
    }
  },
  
  "steps": [
    {
      "gloss": "Gather travel date from user",
      "doneWhen": "User has provided valid date"
    },
    {
      "gloss": "Search for available trains",
      "suggestedTools": ["train-search-api"],
      "doneWhen": "Train options retrieved and presented"
    },
    {
      "gloss": "Present train options to user",
      "doneWhen": "User has reviewed options"
    },
    {
      "gloss": "Confirm user selection",
      "doneWhen": "User has selected a train"
    },
    {
      "gloss": "Execute booking",
      "suggestedTools": ["train-booking-api", "payment-service"],
      "doneWhen": "Booking confirmed and confirmation code received"
    }
  ],
  
  "toolsMentioned": [
    "train-search-api",
    "train-booking-api",
    "payment-service"
  ],
  
  "tags": ["travel", "booking", "commerce"],
  
  "quality": {
    "source": "curated",
    "rating": 95,
    "updated": "2025-09-27"
  }
}
```

### 4.3 Required Fields

**Minimal requirements:**
- `title` (string, non-empty)
- `intent` (string, non-empty)
- `description` (string, non-empty)
- `steps` (array, at least one step)
- Each step must have `gloss` (string, non-empty)

**Optional fields:**
- `prerequisites` (defaults to `[]`)
- `inputs` (defaults to `{}`)
- `outputs` (defaults to `{}`)
- `variants` (defaults to `[]`)
- `toolsMentioned` (auto-extracted from steps if not provided)
- `tags` (defaults to `[]`)
- `quality` (defaults to `{ source: "unknown" }`)

### 4.4 Automatic Processing

When loading, SOPLoader automatically:
1. Assigns `index` to each step (0-based)
2. Extracts `toolsMentioned` from all `suggestedTools` in steps
3. Adds `createdAt` and `updatedAt` timestamps
4. Generates `_id` on MongoDB insert

## 5. Perspective Generation

### 5.1 SOP-Level Perspectives (4 Types)

Generated in **single LLM call** for efficiency:

**Prompt Structure:**
```
Generate 4 perspectives for this SOP. Each must be ONE sentence maximum.

SOP Information:
- Title: {title}
- Intent: {intent}
- Prerequisites: {prerequisites}
- Tools: {toolsMentioned}
- Outputs: {outputs}

Generate perspectives:
1. Intent: What user goal does this address?
2. Preconditions: What must be true beforehand?
3. Tools: What tools/resources are used?
4. Outcomes: What results are produced?

Return JSON array: [{ "content": "..." }, ...]
```

**Expected Response:**
```json
[
  { "content": "Helps user find and purchase train tickets for travel" },
  { "content": "Requires payment method and known destination" },
  { "content": "Uses train-search-api and booking-api services" },
  { "content": "Produces confirmed booking with confirmation code" }
]
```

### 5.2 Step-Level Perspectives (N Types)

Generated in **batch LLM call** for all steps:

**Prompt Structure:**
```
Generate perspectives for these steps from SOP: {title}

Steps:
1. {step1.gloss}
2. {step2.gloss}
...

For each step, describe what it accomplishes. One sentence per step.

Return JSON array: [{ "content": "..." }, ...]
```

### 5.3 Embedding Generation

After perspective generation:
1. Collect all perspective content strings
2. Batch embed via Nomic (768-dim vectors)
3. Attach embeddings to perspective documents
4. Save to `sop_perspectives` collection

**Total Embeddings per SOP:**
- 4 SOP-level perspectives → 4 embeddings
- N step perspectives → N embeddings
- Total: **4 + N** embeddings

## 6. MongoDB Collections

### Collection 1: `sops`

Stores SOP documents as specified in section 2.1.

**Indexes:**
- `{ title: 1 }` unique
- `{ tags: 1 }` multikey
- `{ toolsMentioned: 1 }` multikey
- `{ "quality.source": 1 }`
- `{ title: "text", intent: "text", description: "text" }` text index

### Collection 2: `sop_perspective_types`

Stores perspective type definitions (5 default types seeded on init).

**Schema:**
```javascript
{
  _id: ObjectId,
  name: string,                       // "intent_perspective"
  description: string,
  prompt_template: string,
  category: string,                   // "discovery", "applicability", etc.
  scope: "sop" | "step",
  order: number,
  enabled: boolean,
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
- `{ name: 1 }` unique
- `{ scope: 1 }`
- `{ enabled: 1 }`
- `{ order: 1 }`

### Collection 3: `sop_perspectives`

Stores generated perspectives with embeddings.

**Schema:** See section 2.3

**Indexes:**
- `{ sop_id: 1 }`
- `{ perspective_type_name: 1 }`
- `{ sop_id: 1, perspective_type_name: 1, step_index: 1 }` unique
- `{ scope: 1 }`
- `{ batch_id: 1 }`
- `{ content: "text", keywords: "text" }` text index

## 7. Component Details

### 7.1 SOPRegistry

**Initialization Flow:**
```javascript
const sopRegistry = await SOPRegistry.getInstance();
// 1. Gets ResourceManager singleton
// 2. Creates SOPRegistry instance
// 3. Initializes SOPStorage (MongoDB connection)
// 4. Initializes SOPLoader
// 5. Initializes SOPPerspectives
// 6. Initializes SOPSearch
// 7. Auto-loads all SOPs from data/sops/
// 8. Returns ready-to-use registry
```

**Public API:**
```javascript
// Search (most common use case)
const results = await sopRegistry.searchSOPs("book train to Paris", {
  topK: 10,
  hybridWeight: 0.6
});

// Retrieval
const sop = await sopRegistry.getSOP(sopId);
const allSOPs = await sopRegistry.listSOPs();

// Management (admin)
await sopRegistry.reloadSOPs({ regeneratePerspectives: true });
const stats = await sopRegistry.getStatistics();
```

### 7.2 SOPStorage

**Database Configuration:**
```javascript
// From ResourceManager
const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
const dbName = resourceManager.get('env.SOP_DB_NAME') || 'legion_sops';
```

**Collection Initialization:**
```javascript
async initialize() {
  // 1. Connect to MongoDB
  // 2. Get/create database
  // 3. Ensure collections exist
  // 4. Seed sop_perspective_types (5 defaults)
  // 5. Create indexes
  // 6. Validate setup
}
```

**CRUD Pattern:**
```javascript
// Save with upsert (prevent duplicates)
await collection.replaceOne(
  { title: sop.title },
  sopDoc,
  { upsert: true }
);

// Find by title (common lookup)
await collection.findOne({ title });

// Find by filter
await collection.find(filter).toArray();
```

### 7.3 SOPLoader

**File Discovery:**
```javascript
async discoverSOPFiles() {
  const sopDir = path.join(this.packageRoot, 'data', 'sops');
  const files = [];
  
  await this._scanDirectory(sopDir, files);
  
  return files.filter(f => f.endsWith('.json'));
}

async _scanDirectory(dir, files) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await this._scanDirectory(path.join(dir, entry.name), files);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.join(dir, entry.name));
    }
  }
}
```

**Loading and Validation:**
```javascript
async loadFromFile(filePath) {
  // 1. Read file
  const content = await fs.readFile(filePath, 'utf-8');
  
  // 2. Parse JSON (fail-fast on syntax errors)
  const sopDoc = JSON.parse(content);
  
  // 3. Validate structure
  this.validateSOPStructure(sopDoc);
  
  // 4. Process
  this._assignStepIndices(sopDoc.steps);
  this._extractToolsMentioned(sopDoc);
  this._addTimestamps(sopDoc);
  
  // 5. Save to database
  const savedSOP = await this.sopStorage.saveSOP(sopDoc);
  
  return savedSOP;
}
```

**Validation Rules:**
```javascript
validateSOPStructure(sopDoc) {
  const errors = [];
  
  // Required fields
  if (!sopDoc.title) errors.push('title is required');
  if (!sopDoc.intent) errors.push('intent is required');
  if (!sopDoc.description) errors.push('description is required');
  if (!Array.isArray(sopDoc.steps) || sopDoc.steps.length === 0) {
    errors.push('steps must be non-empty array');
  }
  
  // Validate each step
  sopDoc.steps.forEach((step, i) => {
    if (!step.gloss) errors.push(`step ${i}: gloss is required`);
  });
  
  if (errors.length > 0) {
    throw new SOPValidationError('Invalid SOP structure', errors);
  }
}
```

### 7.4 SOPPerspectives

**Generation Flow:**
```javascript
async generateForSOP(sopId, options) {
  // 1. Fetch SOP from database
  const sop = await this.sopStorage.findSOP(sopId);
  
  // 2. Get perspective types
  const sopTypes = await this._getSOPLevelTypes();      // scope="sop"
  const stepType = await this._getStepLevelType();      // scope="step"
  
  // 3. Generate SOP-level perspectives (1 LLM call)
  const sopPerspectives = await this._generateSOPLevelPerspectives(sop, sopTypes);
  
  // 4. Generate step perspectives (1 batch LLM call)
  const stepPerspectives = await this._generateStepPerspectives(sop, stepType);
  
  // 5. Combine all perspectives
  const allPerspectives = [...sopPerspectives, ...stepPerspectives];
  
  // 6. Batch embed all perspectives
  await this._embedPerspectives(allPerspectives);
  
  // 7. Save to database
  await this.sopStorage.saveSOPPerspectives(allPerspectives);
  
  return allPerspectives;
}
```

**LLM Prompt for SOP-Level:**
```javascript
_createSOPLevelPrompt(sop, types) {
  return `Generate 4 perspectives for this SOP. Each MUST be ONE sentence maximum.

SOP: ${sop.title}
Intent: ${sop.intent}
Prerequisites: ${sop.prerequisites?.join(', ') || 'None'}
Tools: ${sop.toolsMentioned?.join(', ') || 'None'}
Outputs: ${Object.keys(sop.outputs || {}).join(', ') || 'None'}

Generate perspectives:
1. Intent: What user goal does this address?
2. Preconditions: What must be true beforehand?
3. Tools: What tools/resources are used?
4. Outcomes: What results are produced?

Return JSON array: [{"content": "..."}, {"content": "..."}, {"content": "..."}, {"content": "..."}]`;
}
```

**LLM Prompt for Steps:**
```javascript
_createStepPerspectivesPrompt(sop) {
  const stepsList = sop.steps.map((s, i) => `${i+1}. ${s.gloss}`).join('\n');
  
  return `Generate perspectives for these steps from SOP: ${sop.title}

Steps:
${stepsList}

For each step, describe what it accomplishes in ONE sentence.

Return JSON array with ${sop.steps.length} entries: [{"content": "..."}, ...]`;
}
```

### 7.5 SOPSearch

**Search Result Format:**
```javascript
{
  sop: {                        // Full SOP document
    _id, title, intent, steps, ...
  },
  score: 0.87,                  // Combined relevance score (0-1)
  matchedPerspectives: [        // Which perspectives matched query
    {
      type: "intent_perspective",
      content: "Helps user book train tickets",
      score: 0.92,
      scope: "sop"
    },
    {
      type: "step_perspective",
      content: "Searches available trains via API",
      score: 0.83,
      scope: "step",
      stepIndex: 1
    }
  ]
}
```

**Hybrid Search Algorithm:**
```javascript
async searchHybrid(query, options = {}) {
  const weight = options.hybridWeight || 0.6;
  
  // 1. Semantic search via embeddings
  const semanticResults = await this.searchSemantic(query, options);
  
  // 2. Text search via MongoDB
  const textResults = await this.searchText(query, options);
  
  // 3. Combine and score
  const combined = new Map();
  
  // Add semantic results
  semanticResults.forEach(r => {
    combined.set(r.sop._id, {
      sop: r.sop,
      score: r.score * weight,
      matchedPerspectives: r.matchedPerspectives
    });
  });
  
  // Add/merge text results
  textResults.forEach(r => {
    const existing = combined.get(r._id);
    if (existing) {
      existing.score += r.score * (1 - weight);
    } else {
      combined.set(r._id, {
        sop: r,
        score: r.score * (1 - weight),
        matchedPerspectives: []
      });
    }
  });
  
  // 4. Sort by combined score
  const results = Array.from(combined.values());
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, options.topK || 10);
}
```

**Step-Level Search:**
```javascript
async searchSteps(query, options = {}) {
  // 1. Search perspectives with scope="step"
  const queryEmbedding = await this._getQueryEmbedding(query);
  
  const stepPerspectives = await this.sopStorage.findSOPPerspectives({
    scope: "step"
  });
  
  // 2. Compute similarity for each
  const scored = stepPerspectives.map(p => ({
    perspective: p,
    score: this._cosineSimilarity(queryEmbedding, p.embedding)
  }));
  
  // 3. Filter by threshold and sort
  const filtered = scored.filter(s => s.score >= (options.threshold || 0.7));
  filtered.sort((a, b) => b.score - a.score);
  
  // 4. Fetch corresponding SOPs and steps
  const results = [];
  for (const item of filtered.slice(0, options.topK || 10)) {
    const sop = await this.sopStorage.findSOP(item.perspective.sop_id);
    const step = sop.steps[item.perspective.step_index];
    
    results.push({
      sop,
      stepIndex: item.perspective.step_index,
      step,
      score: item.score,
      perspective: item.perspective.content
    });
  }
  
  return results;
}
```

## 8. Integration with ResourceManager

All dependencies obtained through ResourceManager singleton:

```javascript
class SOPRegistry {
  async initialize() {
    // Get ResourceManager
    const resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize storage
    this.sopStorage = new SOPStorage({ resourceManager });
    await this.sopStorage.initialize();
    
    // Initialize components
    this.sopLoader = new SOPLoader({ 
      resourceManager, 
      sopStorage: this.sopStorage 
    });
    
    this.sopPerspectives = new SOPPerspectives({ 
      resourceManager, 
      sopStorage: this.sopStorage 
    });
    
    this.sopSearch = new SOPSearch({ 
      resourceManager, 
      sopStorage: this.sopStorage 
    });
    
    // Load all SOPs from data directory
    await this.sopLoader.loadAllFromDataDir();
  }
}
```

**ResourceManager Dependencies:**
- `env.MONGODB_URL` - MongoDB connection string
- `env.SOP_DB_NAME` - Database name (default: "legion_sops")
- `env.ANTHROPIC_API_KEY` - For perspective generation
- `nomicService` - Cached Nomic embeddings instance
- `llmClient` - Cached LLM client instance

## 9. Usage Examples

### 9.1 Basic Usage

```javascript
import { SOPRegistry } from '@legion/sop-registry';

// Get singleton (auto-loads SOPs)
const sopRegistry = await SOPRegistry.getInstance();

// Search for relevant SOPs
const results = await sopRegistry.searchSOPs("book train to Paris");

console.log(`Found ${results.length} SOPs`);
results.forEach(r => {
  console.log(`- ${r.sop.title} (score: ${r.score})`);
  console.log(`  Matched: ${r.matchedPerspectives.map(p => p.type).join(', ')}`);
});

// Get specific SOP
const sop = results[0].sop;
console.log(`Steps: ${sop.steps.length}`);
sop.steps.forEach((step, i) => {
  console.log(`${i+1}. ${step.gloss}`);
  if (step.suggestedTools) {
    console.log(`   Tools: ${step.suggestedTools.join(', ')}`);
  }
});
```

### 9.2 Step-Level Search

```javascript
// Find specific steps across all SOPs
const stepResults = await sopRegistry.searchSteps("call payment API");

stepResults.forEach(r => {
  console.log(`SOP: ${r.sop.title}`);
  console.log(`Step ${r.stepIndex + 1}: ${r.step.gloss}`);
  console.log(`Score: ${r.score}`);
});
```

### 9.3 Specialized Search

```javascript
// Find SOPs by intent
const intentResults = await sopRegistry.searchSOPsByIntent(
  "purchase tickets"
);

// Find SOPs that use specific tools
const toolResults = await sopRegistry.searchSOPsByTools([
  "payment-service",
  "booking-api"
]);

// Find SOPs with specific prerequisites
const preResults = await sopRegistry.searchSOPsByPreconditions(
  "payment method configured"
);
```

### 9.4 Regenerating Perspectives

```javascript
// Regenerate for specific SOP
await sopRegistry.generatePerspectives(sopId, {
  forceRegenerate: true
});

// Regenerate for all SOPs
await sopRegistry.generateAllPerspectives({
  forceRegenerate: true
});
```

## 10. File Organization

```
packages/planning/sop-registry/
├── package.json
├── jest.config.js
├── README.md
│
├── docs/
│   └── DESIGN.md                    (this document)
│
├── data/
│   └── sops/
│       ├── train-booking.json
│       ├── file-operations.json
│       ├── api-integration.json
│       └── ... (curated SOPs)
│
├── src/
│   ├── index.js                     // Export SOPRegistry singleton
│   ├── SOPRegistry.js               // Main singleton class
│   ├── SOPStorage.js                // MongoDB operations
│   ├── SOPLoader.js                 // File loading and validation
│   ├── SOPPerspectives.js           // Perspective generation
│   ├── SOPSearch.js                 // Semantic search
│   └── errors/
│       └── index.js                 // SOPRegistryError, SOPLoadError, etc.
│
├── __tests__/
│   ├── setup.js
│   ├── unit/
│   │   ├── SOPStorage.test.js
│   │   ├── SOPLoader.test.js
│   │   ├── SOPPerspectives.test.js
│   │   └── SOPSearch.test.js
│   └── integration/
│       └── FullPipeline.test.js
│
└── examples/
    ├── basic-usage.js
    ├── search-examples.js
    └── step-search.js
```

## 11. Error Handling

Following Legion patterns with custom error classes:

```javascript
// Base error
class SOPRegistryError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'SOPRegistryError';
    this.code = code;
    this.details = details;
  }
}

// Specific errors
class SOPLoadError extends SOPRegistryError { ... }
class SOPValidationError extends SOPRegistryError { ... }
class SOPSearchError extends SOPRegistryError { ... }
class PerspectiveGenerationError extends SOPRegistryError { ... }
```

**Fail-Fast Policy:**
- JSON parse errors → throw SOPLoadError immediately
- Missing required fields → throw SOPValidationError immediately
- MongoDB connection fails → throw DatabaseError immediately
- LLM call fails → throw PerspectiveGenerationError immediately
- NO fallbacks, NO mocks in implementation, NO skipping errors

## 12. Testing Strategy

### 12.1 Unit Tests

**SOPStorage.test.js:**
- MongoDB connection and initialization
- CRUD operations for SOPs
- Perspective type seeding
- Perspective CRUD operations
- Statistics aggregation

**SOPLoader.test.js:**
- JSON parsing
- Validation (valid and invalid SOPs)
- Step index assignment
- Tool extraction
- File discovery

**SOPPerspectives.test.js:**
- SOP-level perspective generation (with real LLM)
- Step-level perspective generation
- Embedding generation (with real Nomic)
- Batch processing

**SOPSearch.test.js:**
- Semantic search
- Text search
- Hybrid search scoring
- Step-level search
- Result ranking

### 12.2 Integration Tests

**FullPipeline.test.js:**
```javascript
test('complete workflow: load → generate → search', async () => {
  const sopRegistry = await SOPRegistry.getInstance();
  
  // 1. Load SOPs
  const loadResult = await sopRegistry.loadAllSOPs();
  expect(loadResult.loaded).toBeGreaterThan(0);
  
  // 2. Generate perspectives
  const genResult = await sopRegistry.generateAllPerspectives();
  expect(genResult.generated).toBeGreaterThan(0);
  
  // 3. Search
  const searchResults = await sopRegistry.searchSOPs("book train");
  expect(searchResults.length).toBeGreaterThan(0);
  expect(searchResults[0].score).toBeGreaterThan(0.5);
  
  // 4. Step search
  const stepResults = await sopRegistry.searchSteps("search API");
  expect(stepResults.length).toBeGreaterThan(0);
});
```

### 12.3 Test Requirements (per CLAUDE.md)

- Use real MongoDB (no mocks)
- Use real LLM client (no mocks)
- Use real Nomic embeddings (no mocks)
- All tests in `__tests__/` directory
- Use Jest with ES6 modules
- Sequential execution only (`--runInBand`)
- NO skipped tests - all must pass
- Clean up test data before each run (not after, for inspection)

## 13. Statistics and Monitoring

### 13.1 Registry Statistics

```javascript
await sopRegistry.getStatistics();

// Returns:
{
  sops: {
    total: 47,
    bySource: {
      curated: 45,
      generated: 2
    },
    byTags: {
      travel: 12,
      files: 15,
      api: 8
    },
    avgStepsPerSOP: 5.2,
    avgToolsPerSOP: 2.8
  },
  
  perspectives: {
    total: 282,               // 47 SOPs × (4 + avg 2 steps)
    bySOP: 188,              // scope="sop"
    byStep: 94,              // scope="step"
    withEmbeddings: 282,     // All should have embeddings
    perspectiveTypes: 5
  },
  
  search: {
    embeddingCoverage: 1.0,  // 100% have embeddings
    avgPerspectivesPerSOP: 6.0
  }
}
```

### 13.2 Health Check

```javascript
await sopRegistry.healthCheck();

// Returns:
{
  healthy: true,
  database: {
    connected: true,
    collections: ['sops', 'sop_perspective_types', 'sop_perspectives']
  },
  perspectives: {
    typesSeeded: 5,
    generationReady: true
  },
  search: {
    embeddingsReady: true,
    nomicAvailable: true
  }
}
```

## 14. Initialization Sequence

```
1. SOPRegistry.getInstance() called
   ↓
2. Get ResourceManager singleton
   ↓
3. Create SOPRegistry instance
   ↓
4. Initialize SOPStorage
   - Connect to MongoDB
   - Create collections
   - Seed sop_perspective_types
   - Create indexes
   ↓
5. Initialize SOPLoader
   - Discover data/sops/*.json files
   ↓
6. Load all SOPs
   - Parse JSON files
   - Validate structure
   - Save to sops collection
   ↓
7. Initialize SOPPerspectives
   - Get LLM client from ResourceManager
   - Get Nomic service from ResourceManager
   ↓
8. Initialize SOPSearch
   - Get Nomic service for query embeddings
   ↓
9. Return ready-to-use SOPRegistry
```

## 15. Package Dependencies

```json
{
  "dependencies": {
    "@legion/resource-manager": "workspace:*",
    "@legion/nomic": "workspace:*",
    "@legion/llm-client": "workspace:*",
    "mongodb": "^6.x"
  },
  "devDependencies": {
    "jest": "^29.x"
  }
}
```

**NO additional dependencies:**
- No YAML parser (JSON only)
- No vector database client (embedded in Nomic via Qdrant)
- No schema validation library (manual validation)

## 16. Scope Boundaries

### In Scope (MVP)

**Core Functionality:**
- Load SOPs from package data/sops/ directory (JSON only)
- 3-collection MongoDB architecture (sops, sop_perspective_types, sop_perspectives)
- Multi-perspective generation (5 types: 4 SOP-level + 1 step-level)
- Single LLM call for SOP-level perspectives
- Batch LLM call for step perspectives
- Embedding generation via Nomic (768-dim)
- Semantic search via vector similarity
- Text search via MongoDB text indexes
- Hybrid search with weighted scoring
- Whole-SOP retrieval
- Step-level search and retrieval
- Statistics and health monitoring
- Singleton pattern with ResourceManager integration

**Testing:**
- Unit tests for all components
- Integration test for full pipeline
- Real dependencies (no mocks)

### Out of Scope (Not MVP)

**Features:**
- SOP authoring UI
- SOP editing/updating via API
- External SOP sources (URLs, databases, user upload)
- YAML file support
- SOP versioning
- SOP execution/orchestration
- Conflict resolution for duplicate titles
- SOP templates
- Dynamic perspective type creation

**Non-Functional:**
- Performance optimization
- Caching strategies
- Security hardening
- Access control
- Rate limiting
- Monitoring and observability
- Deployment strategy
- Migration tools
- Backup/restore
- Scaling considerations

**Development:**
- Development plan
- Implementation timeline
- Testing checklist
- Documentation site
- Example SOP library

## 17. Design Principles

Following Legion architectural patterns:

1. **Singleton Pattern**: Like ToolRegistry, SOPRegistry is singleton
2. **ResourceManager Integration**: All dependencies via ResourceManager
3. **Fail-Fast**: NO fallbacks, NO mocks in implementation
4. **Clean Architecture**: Single responsibility per component
5. **Database-First**: MongoDB as source of truth
6. **Batch Operations**: Single LLM call for SOP perspectives, batch for steps
7. **Semantic-First**: Perspectives and embeddings for powerful search
8. **ES6 Modules**: Modern JavaScript throughout
9. **TDD**: Tests drive implementation, all tests must pass
10. **No Backwards Compatibility**: One way of doing things, fix everything

---

**End of Design Document**