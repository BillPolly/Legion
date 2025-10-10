# Knowledge Graph Instance Creation - Design Document

## 1. Overview

The Instance Builder is a general-purpose system for creating knowledge graph instances (ABox) from arbitrary data using an ontology schema (TBox). The system must work with any ontology and any data format, with zero domain-specific knowledge hardcoded.

## 2. Core Principles

### 2.1 Domain Agnostic
- No hardcoded domain knowledge (financial, medical, etc.)
- Works with any ontology structure
- Handles arbitrary data formats

### 2.2 Scalable
- Never loads entire ontology (could be millions of triples)
- Uses semantic search to retrieve relevant ontology subsets
- Processes data incrementally

### 2.3 Validated
- Bidirectional validation: Data → KG → Text
- Coverage checking to ensure completeness
- Iterative refinement when gaps detected

## 3. System Architecture

```
Input Data (Document)
    ↓
┌─────────────────────────────────────────────┐
│ Phase 1: Concept Extraction & Ontology     │
│          Retrieval                          │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Phase 2: Incremental Instance Creation     │
│   2a. Pre-text (narrative before table)    │
│   2b. Post-text (narrative after table)    │
│   2c. Table (structured data)              │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Phase 3: Validation & Coverage             │
│   - KG → English generation                 │
│   - Semantic comparison with source         │
│   - Coverage gap detection                  │
│   - Iterative refinement loop              │
└─────────────────────────────────────────────┘
    ↓
Knowledge Graph (ABox)
```

## 4. Phase 1: Concept Extraction & Ontology Retrieval

### 4.1 Concept Extraction

**Input**: Raw data (any format: document, JSON, table, text)

**Process**:
1. Use LLM to extract key concepts, entities, and relationships from data
2. Generate semantic embeddings for extracted concepts
3. Create search queries for ontology retrieval

**Output**: List of concepts with embeddings

```javascript
class ConceptExtractor {
  async extractConcepts(data) {
    // LLM analyzes data structure and content
    const analysis = await this.llm.analyze(data);

    return {
      entities: ['organization', 'person', 'location', ...],
      relationships: ['employed_by', 'located_in', ...],
      attributes: ['name', 'revenue', 'date', ...]
    };
  }
}
```

### 4.2 Ontology Retrieval

**Input**: Extracted concepts

**Process**:
1. Semantic search over ontology classes using SemanticSearchProvider
2. Retrieve classes that match extracted entity concepts
3. Semantic search over ontology properties (datatype + object)
4. Build relevant ontology subset

**Output**: Filtered ontology containing only relevant classes/properties

**Note on Embeddings**:
- OntologyBuilder generates embeddings for classes (via `ontology-classes` collection)
- OntologyBuilder generates embeddings for relationships (via `ontology-relationships` collection)
- Datatype properties are NOT currently embedded but can be retrieved via domain/range queries
- **Critical requirement**: We must test that semantic search returns the RIGHT ontology elements for given data

```javascript
class OntologyRetriever {
  async retrieveRelevantOntology(concepts) {
    // Search for relevant classes
    const relevantClasses = await this.semanticSearch.search(
      'ontology-classes',
      concepts.entities,
      topK: 10
    );

    // Search for relevant properties
    const relevantProperties = await this.semanticSearch.search(
      'ontology-properties',
      [...concepts.relationships, ...concepts.attributes],
      topK: 20
    );

    // Build ontology subset
    return this.buildOntologySubset(relevantClasses, relevantProperties);
  }
}
```

### 4.3 Ontology Context Assembly

**Format**: Text representation for LLM

```
CLASSES:
- kg:Organization (Organization)
  Definition: An entity that conducts business...

- kg:Person (Person)
  Definition: An individual human being...

DATATYPE PROPERTIES:
- kg:hasName (has name)
  Domain: kg:Person
  Range: xsd:string

OBJECT PROPERTIES:
- kg:employedBy (employed by)
  Domain: kg:Person
  Range: kg:Organization
```

## 5. Phase 2: Incremental Instance Creation

### 5.1 Multi-Stage Processing

Data is processed in stages based on structure:

1. **Pre-text**: Narrative/unstructured text before tables
2. **Post-text**: Narrative/unstructured text after tables
3. **Tables**: Structured tabular data (special handling)

**Rationale**:
- Different data types need different processing strategies
- Tables require careful structural analysis
- Processing order matters (context from text helps table interpretation)

### 5.2 Text Processing (Pre/Post)

```javascript
class TextInstanceCreator {
  async createInstancesFromText(text, ontology) {
    const prompt = `
Given this ontology:
${ontology}

And this text:
${text}

Create RDF instances for all entities and relationships mentioned.
Return JSON: { "instances": [...] }
`;

    const instances = await this.llm.generate(prompt);
    return this.addToTripleStore(instances);
  }
}
```

### 5.3 Table Processing

**Special Considerations**:
- Tables have structure (rows, columns, headers)
- Values have types (numeric, categorical, dates)
- Relationships are implicit in table structure
- May need multiple passes:
  - Pass 1: Create entity instances (rows as entities)
  - Pass 2: Create observations (cells as observations)
  - Pass 3: Link everything together

```javascript
class TableInstanceCreator {
  async createInstancesFromTable(table, ontology) {
    // Analyze table structure
    const structure = this.analyzeTable(table);

    // Pass 1: Create row entities
    const rowEntities = await this.createRowEntities(table, ontology);

    // Pass 2: Create column metric definitions
    const columnMetrics = await this.createColumnMetrics(table, ontology);

    // Pass 3: Create observations for cells
    const observations = await this.createObservations(
      table,
      rowEntities,
      columnMetrics,
      ontology
    );

    return {
      entities: rowEntities.length,
      metrics: columnMetrics.length,
      observations: observations.length
    };
  }
}
```

## 6. Phase 3: Validation & Coverage

### 6.1 KG to English Generation

**Purpose**: Verify completeness by regenerating source text from KG

```javascript
class KGToTextGenerator {
  async generateText(instances) {
    // Query all instances and their relationships
    const graph = await this.buildGraphView(instances);

    // LLM generates natural language from graph
    const generatedText = await this.llm.generate(`
Given this knowledge graph:
${graph}

Generate natural language text that describes all entities and relationships.
`);

    return generatedText;
  }
}
```

### 6.2 Semantic Comparison

**Process**:
1. Generate text from KG
2. Use embedding similarity to compare with source
3. Identify missing information

```javascript
class SemanticValidator {
  async validateCoverage(sourceText, kgText) {
    const sourceEmbedding = await this.embed(sourceText);
    const kgEmbedding = await this.embed(kgText);

    const similarity = this.cosineSimilarity(sourceEmbedding, kgEmbedding);

    if (similarity < 0.9) {
      // Find missing information
      const gaps = await this.identifyGaps(sourceText, kgText);
      return { complete: false, gaps };
    }

    return { complete: true };
  }
}
```

### 6.3 Iterative Refinement

If coverage is incomplete:
1. Identify what's missing
2. Re-run instance creation focusing on gaps
3. Validate again
4. Repeat until threshold met or max iterations reached

## 7. InstanceBuilder API

### 7.1 Main Interface

```javascript
class InstanceBuilder {
  constructor({ tripleStore, ontologyBuilder, llmClient, semanticSearch }) {
    this.tripleStore = tripleStore;
    this.ontologyBuilder = ontologyBuilder;
    this.llmClient = llmClient;
    this.semanticSearch = semanticSearch;

    this.conceptExtractor = new ConceptExtractor(llmClient);
    this.ontologyRetriever = new OntologyRetriever(semanticSearch, tripleStore);
    this.textCreator = new TextInstanceCreator(llmClient, tripleStore);
    this.tableCreator = new TableInstanceCreator(llmClient, tripleStore);
    this.validator = new SemanticValidator(llmClient, semanticSearch);
  }

  async createInstances(data, options = {}) {
    // Phase 1: Ontology retrieval
    const concepts = await this.conceptExtractor.extractConcepts(data);
    const ontology = await this.ontologyRetriever.retrieveRelevantOntology(concepts);

    // Phase 2: Instance creation
    const results = {
      preText: null,
      postText: null,
      table: null
    };

    if (data.preText) {
      results.preText = await this.textCreator.createInstancesFromText(
        data.preText,
        ontology
      );
    }

    if (data.postText) {
      results.postText = await this.textCreator.createInstancesFromText(
        data.postText,
        ontology
      );
    }

    if (data.table) {
      results.table = await this.tableCreator.createInstancesFromTable(
        data.table,
        ontology
      );
    }

    // Phase 3: Validation
    const validation = await this.validator.validateCoverage(data, results);

    if (!validation.complete && options.iterative) {
      // Refinement loop
      await this.refine(data, validation.gaps, ontology);
    }

    return results;
  }
}
```

### 7.2 Return Format

```javascript
{
  preText: {
    instanceCount: 5,
    instanceTypes: { 'kg:Organization': 1, 'kg:Person': 4 }
  },
  postText: {
    instanceCount: 3,
    instanceTypes: { 'kg:Event': 3 }
  },
  table: {
    entities: 1,
    metrics: 6,
    observations: 18
  },
  validation: {
    complete: true,
    coverage: 0.95
  }
}
```

## 8. Testing Strategy

### 8.1 Unit Tests
- Test each phase independently
- Mock ontology retrieval
- Verify LLM prompts are correctly formatted

### 8.2 Integration Tests
- Test with real ontologies (small, controlled)
- Test with known data structures
- Verify instance counts and types

### 8.3 Validation Tests
- Test KG → Text generation
- Test coverage detection
- Test refinement loop

### 8.4 Example Test Structure

```javascript
test('should create instances from document with table', async () => {
  const data = {
    preText: "JKHY is a financial services company...",
    table: parsedDoc.content.table,
    postText: "The company showed strong growth..."
  };

  const result = await instanceBuilder.createInstances(data);

  // Verify instances were created
  expect(result.preText.instanceCount).toBeGreaterThan(0);
  expect(result.table.observations).toBe(18);

  // Verify coverage
  expect(result.validation.complete).toBe(true);
  expect(result.validation.coverage).toBeGreaterThan(0.9);

  // Query specific instances
  const orgs = await tripleStore.query(null, 'rdf:type', '?orgType');
  const orgInstances = orgs.filter(([s, p, o]) =>
    o.toLowerCase().includes('organization')
  );
  expect(orgInstances.length).toBe(1);
});
```

## 9. Open Questions

1. **Ontology Retrieval Quality**: Does semantic search return the RIGHT ontology elements for given data? (MUST test this in Phase 0)
2. **Ontology Retrieval Threshold**: What's the right topK for semantic search? (Depends on Phase 0 benchmarking)
3. **Table Structure Detection**: How to automatically detect table orientation and structure?
4. **Validation Threshold**: What similarity score indicates "complete"?
5. **Max Iterations**: How many refinement loops before giving up?
6. **Error Handling**: How to handle cases where LLM returns invalid RDF?
7. **Performance**: What are acceptable latency targets for each phase?

## 10. Dependencies

- **@legion/prompt-manager**: TemplatedPrompt for LLM interactions
- **@legion/semantic-search**: SemanticSearchProvider for ontology retrieval
- **@legion/ontology**: OntologyBuilder for schema management
- **TripleStore**: RDF storage and querying
- **LLMClient**: Language model API

## 11. Future Enhancements

- **Streaming**: Support streaming large documents in chunks
- **Caching**: Cache ontology retrievals for similar data
- **Parallel Processing**: Process text sections and tables in parallel
- **Multi-modal**: Support images, PDFs, etc.
- **Interactive**: Allow user feedback during instance creation
