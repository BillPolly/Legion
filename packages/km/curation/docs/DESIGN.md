# Data-Driven Universal Data Source Curation System - Design Document

## Overview

The Universal Data Source Curation System uses a **CurationAgent** to automatically understand and curate any artifact with zero prior knowledge.

**You give it a file path. The agent figures out everything else.**

The CurationAgent:
1. **Uses its world knowledge** to understand what the artifact is
2. **Works incrementally** through the document using OntologyBuilder
3. **Maintains state** as it discovers concepts and patterns
4. **Generates ontology** progressively, not in one shot
5. **Extracts knowledge graph** using the built ontology
6. **Makes it queryable** via natural language

### Core Innovation: Agent + LLM World Knowledge + Incremental Processing

**The agent orchestrates an incremental discovery process:**

```
CurationAgent (ConfigurableAgent)
  ├─ Phase 1: Discovery Agent
  │    └─ Examines artifact, determines what it is
  │
  ├─ Phase 2: Ontology Building Agent
  │    └─ Uses OntologyBuilder incrementally on samples
  │
  ├─ Phase 3: Extraction Agent
  │    └─ Extracts instances using generated ontology
  │
  ├─ Phase 4: Storage Agent
  │    └─ Writes to Neo4j, builds semantic index
  │
  └─ Phase 5: Registration Agent
       └─ Registers with ResourceManager
```

The agent maintains state across all phases, allowing it to:
- Work through documents incrementally
- Build ontology piece by piece (not one giant prompt!)
- Track progress and handle failures
- Resume from where it left off

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Neo4j Graph Database                      │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │   ONTOLOGY LAYER     │  │   KNOWLEDGE GRAPH LAYER    │  │
│  │                      │  │                            │  │
│  │ (:Concept)           │  │ (:Entity)                  │  │
│  │ (:Pattern)           │  │  - Instances discovered     │  │
│  │ (:ComputationRule)   │  │  - Facts extracted         │  │
│  │                      │  │  - Relationships found     │  │
│  └──────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────┴─────────────────────────────┐
│                     CurationAgent                          │
│            (ConfigurableAgent with BehaviorTree)            │
│                                                             │
│  State:                                                     │
│    - currentPhase: discovery|ontology|extraction|storage   │
│    - processedSamples: [...]                                │
│    - discoveredConcepts: [...]                              │
│    - ontologyVersion: "1.0.0"                               │
│    - extractedInstances: [...]                              │
│                                                             │
│  Components:                                                │
│    - DiscoveryAgent         (understands artifact)          │
│    - OntologyBuilder        (builds ontology incrementally) │
│    - ExtractionAgent        (extracts using ontology)       │
│    - StorageAgent           (writes to Neo4j)               │
│    - RegistrationAgent      (registers source)              │
│                                                             │
│  Tools:                                                     │
│    - file_read              (read artifact)                 │
│    - ontology_analyze       (OntologyBuilder.analyzeGaps)  │
│    - ontology_extend        (OntologyBuilder.extend)        │
│    - kg_extract             (KGExtractor.extract)           │
│    - neo4j_write            (write to graph DB)             │
│    - vector_index           (build semantic index)          │
└─────────────────────────────────────────────────────────────┘
                      ▲
                      │ Just a file path
                      │
                 User Input
```

## Agent Configuration

The CurationAgent is a ConfigurableAgent with specific behavior tree and capabilities:

```json
{
  "agent": {
    "id": "curation-agent",
    "name": "Data Source Curator",
    "type": "task",
    "version": "1.0.0",

    "llm": {
      "provider": "anthropic",
      "model": "claude-sonnet-4",
      "temperature": 0.0,
      "maxTokens": 8000
    },

    "capabilities": [
      {
        "module": "file",
        "tools": ["file_read", "file_stat", "file_sample"]
      },
      {
        "module": "ontology",
        "tools": ["ontology_analyze", "ontology_extend", "ontology_query"]
      },
      {
        "module": "kg",
        "tools": ["kg_extract", "kg_validate"]
      },
      {
        "module": "neo4j",
        "tools": ["neo4j_write", "neo4j_query"]
      },
      {
        "module": "vector",
        "tools": ["vector_index", "vector_search"]
      }
    ],

    "behaviorTree": {
      "type": "sequence",
      "children": [
        {
          "type": "action",
          "id": "discovery",
          "description": "Discover what the artifact is",
          "tool": "discover_artifact"
        },
        {
          "type": "action",
          "id": "ontology_building",
          "description": "Build ontology incrementally",
          "tool": "build_ontology_incremental"
        },
        {
          "type": "action",
          "id": "extraction",
          "description": "Extract knowledge graph",
          "tool": "extract_knowledge_graph"
        },
        {
          "type": "action",
          "id": "storage",
          "description": "Store in Neo4j",
          "tool": "store_in_graph_db"
        },
        {
          "type": "action",
          "id": "registration",
          "description": "Register with ResourceManager",
          "tool": "register_data_source"
        }
      ]
    },

    "state": {
      "contextVariables": {
        "sourceUri": {"type": "string", "persistent": true},
        "currentPhase": {"type": "string", "persistent": true},
        "discoveryResult": {"type": "object", "persistent": true},
        "ontology": {"type": "object", "persistent": true},
        "processedSamples": {"type": "array", "persistent": true},
        "extractedInstances": {"type": "array", "persistent": true}
      }
    }
  }
}
```

## Incremental Curation Process

### Phase 1: Discovery - "What is this?"

**Agent Tool:** `discover_artifact`

**Input:** File path

**Agent Actions:**
1. Read first 1000 lines of file
2. LLM call: "Examine this file, what kind of data is it?"
3. Store discovery result in state

**LLM Prompt (via TemplatedPrompt):**
```
I'm giving you a file. I don't know what it contains.
Examine it and tell me:
1. What kind of data is this?
2. What structure does it have?
3. What samples should I analyze for ontology building?

File content: {{fileContent}}

Return as JSON:
{
  "dataType": "string",
  "domain": "string",
  "recommendedSamples": {
    "strategy": "string",
    "count": number,
    "indices": [...]
  }
}
```

**Output stored in agent state:**
```javascript
{
  "currentPhase": "discovery",
  "discoveryResult": {
    "dataType": "financial_qa_dataset",
    "domain": "corporate_financial_analysis",
    "recommendedSamples": {
      "strategy": "first_n",
      "count": 3,
      "indices": [0, 1, 2]
    }
  }
}
```

### Phase 2: Ontology Building - "Build ontology incrementally"

**Agent Tool:** `build_ontology_incremental`

**Uses OntologyBuilder from @legion/ontology (EXISTING!)**

**Agent Actions:**
1. Load recommended samples (3 examples)
2. **For each sample, incrementally:**
   - Call `OntologyBuilder.analyzeGaps(sample)`
   - Call `OntologyBuilder.extendFromGaps(gaps)`
   - Update state with new concepts
3. Store final ontology in state

**This is NOT one giant LLM call - it's incremental!**

```javascript
// Agent executes this incrementally:
const ontologyBuilder = new OntologyBuilder(resourceManager);
const samples = await this.loadSamples(discoveryResult.recommendedSamples);

for (let i = 0; i < samples.length; i++) {
  console.log(`Processing sample ${i+1}/${samples.length}...`);

  // OntologyBuilder works incrementally (EXISTING LOGIC!)
  const currentOntology = this.state.getVariable('ontology');
  const gaps = await ontologyBuilder.analyzeGaps(samples[i], currentOntology);

  console.log(`Found ${gaps.length} new concepts in sample ${i+1}`);

  const extendedOntology = await ontologyBuilder.extendFromGaps(gaps, domain);

  // Update agent state
  this.state.setVariable('ontology', extendedOntology);
  this.state.getVariable('processedSamples').push(i);

  console.log(`Ontology now has ${extendedOntology.classes.length} concepts`);
}
```

**OntologyBuilder already does this work!** The agent just orchestrates it.

**Example: Processing Sample 1**

OntologyBuilder analyzes table:
```
| long-term debt | 35.2 | 17.4 |
| current portion | 5.9 | 11.3 |
| total debt | 41.1 | 28.7 |
```

LLM (via OntologyBuilder):
```
Using my knowledge of finance:
- "long-term debt" is a financial metric
- Row headers are metric names
- Column headers (implicit) are years
- Values are monetary amounts
- "total debt" = sum of components (standard accounting)

New concepts needed:
- LongTermDebt (subclass of FinancialMetric)
- TotalDebt (subclass of FinancialMetric, category: Liability)
- Year (time period concept)
- MonetaryValue (with scale property)
```

OntologyBuilder extends ontology (adds 4 new classes).

**Example: Processing Sample 2**

OntologyBuilder finds question: "what was the percentage change from 2008 to 2009?"

LLM (via OntologyBuilder):
```
Using my knowledge of financial analysis:
- "percentage change" is a standard calculation
- Formula: ((end - start) / start) * 100
- This is a linguistic pattern that maps to a semantic operation

New concepts needed:
- Pattern: percentage_change
- Operation: PercentageChange
- Rule: percentage_change_formula
```

OntologyBuilder extends ontology (adds 1 pattern, 1 rule).

**Example: Processing Sample 3**

OntologyBuilder finds similar concepts to Sample 1 & 2.

LLM (via OntologyBuilder):
```
These concepts already exist in the ontology:
- TotalDebt (from Sample 1)
- percentage_change pattern (from Sample 2)

No new concepts needed for Sample 3.
```

OntologyBuilder doesn't extend (concepts already exist).

**Final state after 3 samples:**
```javascript
{
  "currentPhase": "ontology",
  "ontology": {
    "classes": [
      "Company", "FinancialMetric", "TotalDebt", "LongTermDebt",
      "Revenue", "NetIncome", "Year", "MonetaryValue", "PercentageValue",
      // ~30 total classes discovered
    ],
    "patterns": [
      "direct_lookup", "temporal_comparison", "percentage_change",
      "ratio_analysis", "aggregation"
      // ~10 patterns discovered
    ],
    "rules": [
      "total_debt_computation", "percentage_change_computation",
      "scale_conversion"
      // ~5 rules discovered
    ]
  },
  "processedSamples": [0, 1, 2]
}
```

### Phase 3: Extraction - "Extract knowledge graph"

**Agent Tool:** `extract_knowledge_graph`

**Uses KGExtractor (similar to existing takeaway/kg_extractor.py)**

**Agent Actions:**
1. Get generated ontology from state
2. **For each sample, incrementally:**
   - Call `KGExtractor.extract(sample, ontology)`
   - Validate extracted instances
   - Add to state
3. Store all instances in state

```javascript
const kgExtractor = new KGExtractor(resourceManager);
const ontology = this.state.getVariable('ontology');
const samples = this.state.getVariable('samples');

for (let i = 0; i < samples.length; i++) {
  console.log(`Extracting KG from sample ${i+1}...`);

  // KGExtractor uses ontology to guide extraction
  const instances = await kgExtractor.extract(samples[i], ontology);

  console.log(`Extracted ${instances.length} instances from sample ${i+1}`);

  // Add to state
  const allInstances = this.state.getVariable('extractedInstances');
  allInstances.push(...instances);
}
```

**KGExtractor LLM call (per sample):**
```
Using this ontology: {{ontology}}

Extract all instances from this sample: {{sample}}

For each entity:
1. Classify according to ontology concepts
2. Extract all properties
3. Identify relationships

Return as JSON array of instances.
```

**Output stored in state:**
```javascript
{
  "currentPhase": "extraction",
  "extractedInstances": [
    {
      "type": "Company",
      "id": "company_jkhy_ex0",
      "name": "Jack Henry & Associates",
      "ticker": "JKHY"
    },
    {
      "type": "FinancialMetric",
      "conceptType": "TotalDebt",
      "id": "metric_td_jkhy_2009",
      "label": "total debt",
      "value": {"numericValue": 28700000, "scale": "Millions"},
      "company": "company_jkhy_ex0",
      "year": 2009
    }
    // ~150 instances total from 3 examples
  ]
}
```

### Phase 4: Storage - "Write to Neo4j"

**Agent Tool:** `store_in_graph_db`

**Agent Actions:**
1. Get ontology and instances from state
2. Write ontology to ontology layer (batch)
3. Write instances to KG layer (batch)
4. Build semantic index
5. Update state with storage metadata

```javascript
const neo4jWriter = resourceManager.get('neo4jWriter');
const vectorIndexer = resourceManager.get('vectorIndexer');

const ontology = this.state.getVariable('ontology');
const instances = this.state.getVariable('extractedInstances');

// Write ontology layer
await neo4jWriter.writeOntology(ontology, sourceUri);

// Write KG layer
await neo4jWriter.writeInstances(instances, ontology);

// Build semantic index
await vectorIndexer.index(ontology, instances);

// Update state
this.state.setVariable('currentPhase', 'storage');
```

### Phase 5: Registration - "Register with ResourceManager"

**Agent Tool:** `register_data_source`

**Agent Actions:**
1. Collect metadata from state
2. Write to `.legion/data-sources.json`
3. ResourceManager loads on next startup

```javascript
const metadata = {
  uri: "legion://local/convfinqa_dataset",
  type: "json_file",
  path: this.state.getVariable('sourceUri'),
  graphDb: "neo4j://localhost:7687",
  discovered: new Date().toISOString(),
  status: "curated",
  statistics: {
    examplesProcessed: this.state.getVariable('processedSamples').length,
    conceptsDiscovered: this.state.getVariable('ontology').classes.length,
    patternsDiscovered: this.state.getVariable('ontology').patterns.length,
    instancesCreated: this.state.getVariable('extractedInstances').length
  }
};

await resourceManager.registerDataSource(metadata);
```

## Key Advantage: Agent State Management

**The agent maintains state, so it can:**

1. **Resume from failures:**
```javascript
if (this.state.getVariable('currentPhase') === 'ontology') {
  // Resume ontology building from last processed sample
  const processed = this.state.getVariable('processedSamples');
  const remaining = samples.filter((s, i) => !processed.includes(i));
  // Continue from where we left off
}
```

2. **Track progress:**
```javascript
// User can ask: "How's curation going?"
const progress = {
  phase: this.state.getVariable('currentPhase'),
  samplesProcessed: this.state.getVariable('processedSamples').length,
  conceptsDiscovered: this.state.getVariable('ontology').classes.length
};
```

3. **Work incrementally:**
```javascript
// Process 3 samples, not all 3037!
// Can later add more samples incrementally
```

4. **Handle complexity:**
```javascript
// Ontology building is NOT one giant prompt
// It's incremental: sample by sample, concept by concept
// OntologyBuilder handles this (already exists!)
```

## Integration with Existing Systems

### OntologyBuilder (@legion/ontology)

**REUSE existing ontology building logic:**

```javascript
import { OntologyBuilder } from '@legion/ontology';

const builder = new OntologyBuilder(resourceManager);

// Existing methods we'll use:
await builder.analyzeGaps(sample, currentOntology);
await builder.extendFromGaps(gaps, domain);
await builder.findRelevantTypes(sentence);
```

**The agent orchestrates OntologyBuilder, doesn't replace it!**

### KGExtractor (similar to takeaway example)

**Create new KGExtractor that works like financial kg_extractor.py:**

```javascript
import { KGExtractor } from '@legion/km/curation';

const extractor = new KGExtractor(resourceManager);

// Uses generated ontology to guide extraction
const instances = await extractor.extract(sample, ontology);
```

### Neo4j DataSource

**Use existing Neo4j infrastructure:**

```javascript
const graphDb = resourceManager.get('neo4j');

// Write ontology concepts
await graphDb.writeOntology(ontologySpec);

// Write KG instances
await graphDb.writeInstances(instances);
```

### QueryUnderstandingPipeline

**Natural language queries work after curation:**

```javascript
const pipeline = resourceManager.get('queryUnderstandingPipeline');

// Queries use generated ontology + KG
const answer = await pipeline.process(
  "What was Jack Henry's total debt in 2009?"
);
```

## Usage Example

```javascript
// Create CurationAgent from config
const agent = new ConfigurableAgent(curationAgentConfig);
await agent.initialize();

// Curate a data source
const result = await agent.receive({
  type: 'curate',
  sourceUri: 'file:///path/to/convfinqa_dataset.json',
  options: {
    sampleSize: 3
  }
});

// Agent works through phases incrementally
// User can monitor progress via agent state

// After completion, queries work:
const pipeline = resourceManager.get('queryUnderstandingPipeline');
const answer = await pipeline.process("What companies are in the dataset?");
```

## Key Components to Implement

### 1. CurationAgent Configuration
**File:** `/packages/km/curation/configs/curation-agent.json`
- Agent configuration with behavior tree
- Tool capabilities
- State variables

### 2. Agent Tools
**File:** `/packages/km/curation/src/tools/`
- `discover_artifact.js` - Discovery tool
- `build_ontology_incremental.js` - Ontology building orchestrator
- `extract_knowledge_graph.js` - KG extraction orchestrator
- `store_in_graph_db.js` - Neo4j writing
- `register_data_source.js` - ResourceManager registration

### 3. KGExtractor
**File:** `/packages/km/curation/src/extractors/KGExtractor.js`
- Similar to takeaway/kg_extractor.py
- Uses generated ontology
- Extracts typed instances

### 4. Neo4j Writers
**File:** `/packages/km/curation/src/writers/`
- `OntologyWriter.js` - Write ontology layer
- `KGWriter.js` - Write KG layer

### 5. Prompts (TemplatedPrompt)
**Dir:** `/packages/km/curation/prompts/`
- `discovery.j2` - Discovery phase prompt
- `extraction.j2` - KG extraction prompt

## Success Criteria (MVP)

1. ✅ CurationAgent configuration loads and initializes
2. ✅ Discovery phase: identifies data type correctly
3. ✅ Ontology phase: builds 25-35 concepts from 3 examples incrementally
4. ✅ Extraction phase: extracts 100-200 instances correctly typed
5. ✅ Storage phase: writes to Neo4j (ontology + KG layers)
6. ✅ Registration phase: registers with ResourceManager
7. ✅ Agent maintains state throughout process
8. ✅ Can answer 5+ natural language questions correctly
9. ✅ Complete in <2 minutes
10. ✅ All tests passing (100% coverage)

## Technology Stack

- **Agent Framework**: ConfigurableAgent from @legion/agents
- **Ontology Building**: OntologyBuilder from @legion/ontology (existing!)
- **LLM**: Claude Sonnet 4 via ResourceManager
- **Prompt Management**: TemplatedPrompt from @legion/prompt-manager
- **Graph Database**: Neo4j (local instance)
- **Vector Database**: Qdrant with Nomic embeddings
- **Testing**: Jest
- **Package Manager**: npm workspaces
