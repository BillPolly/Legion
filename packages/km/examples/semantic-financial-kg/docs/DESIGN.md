# Semantic Financial Knowledge Graph - Design Document

## 1. Problem Statement

### Current Approach Issues

The `convfinqa-agent` package has a fundamental architectural flaw: **it does not create a proper semantic knowledge graph**. Instead, it creates a flat key-value store with RDF syntax.

**What we're doing wrong:**

```turtle
# Table-derived facts - flat properties on instances
kg:Asset_2013 rdf:type kg:Asset .
kg:Asset_2013 kg:securities_gains 659 .
kg:Asset_2013 kg:mortgage_loans_average 5145 .

# Text-derived facts - metadata, not semantics
kg:text_litigation_reserves_2012_0 rdf:type kg:Asset .
kg:text_litigation_reserves_2012_0 kg:value 3.7 .
kg:text_litigation_reserves_2012_0 kg:label "litigation reserves" .
kg:text_litigation_reserves_2012_0 kg:unit "billion" .
```

**Problems:**

1. **No entity modeling**: `kg:value` is metadata, not a semantic relationship
2. **Ignoring ontology**: Have `kg:LitigationReserve` class but not using it
3. **No relationships**: Facts are isolated, not connected
4. **No reification**: Cannot add properties to relationships (provenance, confidence, etc.)
5. **Objects are literals**: `659` is just a number, not an entity with properties

### The Fundamental Issue

**In RDF, we should be able to query A, R, and B as entities:**

```sparql
# Query subjects
SELECT ?company WHERE { ?company rdf:type kg:Company }

# Query predicates
SELECT ?relationship WHERE { ?s ?relationship ?o }

# Query objects
SELECT ?reserve WHERE { ?s kg:hasFinancialObligation ?reserve .
                        ?reserve kg:amount ?amount }
```

**Currently impossible because:**
- Predicates like `kg:securities_gains` are just strings, not queryable entities
- Objects like `659` are literals, not entities with their own properties
- No way to add metadata to relationships (when was this extracted? how confident?)

## 2. RDF and Semantic Web Fundamentals

### What is a Semantic Knowledge Graph?

A **semantic knowledge graph** uses RDF (Resource Description Framework) to model information where:

1. **Everything is a resource** (entity) with a URI
2. **Relationships are typed** using ontology properties
3. **Entities have types** (classes) in a hierarchy
4. **Reasoning is possible** via rdfs:subClassOf, rdfs:subPropertyOf

### The Triple Pattern: Subject-Predicate-Object

```turtle
<subject> <predicate> <object> .
```

Where:
- **Subject**: The entity being described (URI)
- **Predicate**: The relationship type (URI)
- **Object**: Either another entity (URI) or a literal value

### Making A, R, B All Entities

**In proper RDF, all three parts can be entities:**

```turtle
# A is an entity
kg:JPMorgan_2012 rdf:type kg:Company .
kg:JPMorgan_2012 kg:fiscalYear 2012 .

# B is an entity
kg:LitReserve_2012_1 rdf:type kg:LitigationReserve .
kg:LitReserve_2012_1 kg:amount 3.7 .
kg:LitReserve_2012_1 kg:unit kg:Billion .

# R connects them (using ontology property)
kg:JPMorgan_2012 kg:hasFinancialObligation kg:LitReserve_2012_1 .
```

**Now we can query:**
```sparql
# Find all companies
SELECT ?company WHERE { ?company rdf:type kg:Company }

# Find all obligations
SELECT ?obligation WHERE { ?s kg:hasFinancialObligation ?obligation }

# Find litigation reserves over $3B
SELECT ?reserve WHERE {
  ?reserve rdf:type kg:LitigationReserve .
  ?reserve kg:amount ?amount .
  FILTER (?amount > 3)
}
```

### RDF Reification: Adding Properties to Relationships

**Problem**: How do we add metadata to the relationship itself?

```turtle
kg:JPMorgan_2012 kg:hasFinancialObligation kg:LitReserve_2012_1 .
```

**Q**: When was this extracted? How confident are we? What's the source?

**Solution**: **RDF Reification** - treat the statement itself as an entity:

```turtle
# The original triple
kg:JPMorgan_2012 kg:hasFinancialObligation kg:LitReserve_2012_1 .

# Reified statement (the triple as an entity)
_:stmt1 rdf:type rdf:Statement .
_:stmt1 rdf:subject kg:JPMorgan_2012 .
_:stmt1 rdf:predicate kg:hasFinancialObligation .
_:stmt1 rdf:object kg:LitReserve_2012_1 .

# Now add properties to the relationship!
_:stmt1 kg:confidence 0.95 .
_:stmt1 kg:extractedAt "2025-01-06T10:30:00Z" .
_:stmt1 kg:sourceDocument "JPMorgan 2013 Annual Report" .
_:stmt1 kg:sourcePage 104 .
_:stmt1 kg:extractedBy "TextExtractor v1.0" .
```

**Now the relationship has properties!**

## 3. Solution Architecture

### Core Principles

1. **Semantic Retrieval First**: Use embeddings to find relevant ontology entities before LLM processing
2. **LLM-Powered Generation**: Let LLM generate complete entity models given ontology candidates
3. **Ontology-Driven Validation**: Validate generated entities against ontology constraints
4. **Entity-Centric Modeling**: Create proper entity instances, not flat key-values
5. **Semantic Relationships**: Use ontology properties to connect entities
6. **Reification by Default**: All extracted relationships are reified for provenance
7. **Reasoning Support**: Leverage rdfs:subClassOf and rdfs:subPropertyOf

### High-Level Pipeline

```
Input (Raw Text/Table with references)
  ↓
  → LLM Step 1: Entity & Relationship Extraction
    • Identify ALL entities mentioned in text
    • Identify ALL relationships between entities
    • Output: Explicit list of entities and relationships
  ↓
  → LLM Step 2: Simple Sentence Generation
    • Rewrite as simple subject-verb-object sentences
    • Use identified entities explicitly (no pronouns, no references)
    • One fact per sentence, no ambiguity
    • Output: Array of unambiguous simple sentences
  ↓
  → Semantic Retrieval (find relevant ontology entities for each sentence)
  ↓
  → LLM Step 3: Entity Generation (create RDF entity model from sentence + ontology candidates)
  ↓
  → Validation (against ontology)
  ↓
  → Triple Creation + Reification
  ↓
  → MongoDB Triple Store
  ↓
  → LLM Step 4: Text Reconstruction (VERIFICATION)
    • Generate paraphrase of original text from RDF triples
  ↓
  → LLM Step 5: Comparison (VALIDATION)
    • Compare reconstructed text to original
    • Verify correctness, identify missing facts or errors
    • If incorrect: flag for review or retry
  ↓
  → Semantic Querying + Reasoning
```

**Key Insight**: Multi-step LLM processing with verification:
1. **Extract** entities/relationships explicitly
2. **Normalize** to unambiguous simple sentences
3. **Generate** RDF from sentences + ontology
4. **Reconstruct** text from RDF to verify
5. **Compare** to catch errors before storage

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│              1. ONTOLOGY INDEXING (One-Time)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Load ConvFinQA Ontology                             │  │
│  │  • Classes: kg:LitigationReserve, kg:Company, etc.   │  │
│  │  • Properties: kg:hasFinancialObligation, kg:amount  │  │
│  │  • Descriptions: Natural language descriptions       │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Index in SemanticSearchProvider (@legion/semantic-  │  │
│  │  search)                                             │  │
│  │  • Embed class/property descriptions using ONNX      │  │
│  │  • Store in Qdrant vector database                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              2. ENTITY & RELATIONSHIP EXTRACTION (LLM)       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EntityRelationshipExtractor                         │  │
│  │  • Identify ALL entities in raw text                 │  │
│  │  • Identify ALL relationships between entities       │  │
│  │  • Input: "The current year included expense of     │  │
│  │    $3.7 billion for additional litigation reserves"  │  │
│  │  • Output:                                           │  │
│  │    Entities:                                         │  │
│  │      - "JPMorgan Chase" (company, from context)      │  │
│  │      - "litigation reserves" (financial reserve)     │  │
│  │      - "$3.7 billion" (amount)                       │  │
│  │      - "2012" (year, from context)                   │  │
│  │    Relationships:                                    │  │
│  │      - "JPMorgan Chase" HAS "litigation reserves"    │  │
│  │      - "litigation reserves" HAS_AMOUNT "$3.7B"      │  │
│  │      - "litigation reserves" IN_YEAR "2012"          │  │
│  └────────────────────┬─────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              3. SIMPLE SENTENCE GENERATION (LLM)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SimpleSentenceGenerator                             │  │
│  │  • Rewrite using identified entities                 │  │
│  │  • Subject-Verb-Object structure                     │  │
│  │  • No pronouns, no references, no ambiguity          │  │
│  │  • Input: Entities + Relationships (from step 2)     │  │
│  │  • Output:                                           │  │
│  │    [                                                 │  │
│  │      "JPMorgan Chase has litigation reserves.",      │  │
│  │      "The litigation reserves are $3.7 billion.",    │  │
│  │      "The litigation reserves are for 2012."         │  │
│  │    ]                                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              4. SEMANTIC RETRIEVAL                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  For Each Simple Sentence:                           │  │
│  │  1. Embed sentence using SemanticSearchProvider      │  │
│  │  2. semanticSearch() → top-K ontology candidates     │  │
│  │     Example: "JPMorgan Chase has litigation          │  │
│  │     reserves" →                                      │  │
│  │     - kg:LitigationReserve (0.92 similarity)         │  │
│  │     - kg:hasFinancialObligation (0.87 similarity)    │  │
│  │     - kg:Company (0.85 similarity)                   │  │
│  │  3. Retrieve full ontology definitions for candidates│  │
│  │     - Class hierarchy (rdfs:subClassOf)              │  │
│  │     - Properties (rdfs:domain, rdfs:range)           │  │
│  │     - Constraints                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              5. LLM ENTITY GENERATION                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Prompt Construction:                                │  │
│  │  • Input: Original fact text                         │  │
│  │  • Context: Top-K ontology candidates with full defs │  │
│  │  • Task: Generate complete RDF entity model          │  │
│  │                                                       │  │
│  │  LLM Output (Structured):                            │  │
│  │  {                                                    │  │
│  │    entities: [                                       │  │
│  │      {                                               │  │
│  │        uri: "kg:LitReserve_2012_JPM",                │  │
│  │        type: "kg:LitigationReserve",                 │  │
│  │        properties: {                                 │  │
│  │          "kg:amount": 3.7,                           │  │
│  │          "kg:unit": "kg:Billion",                    │  │
│  │          "kg:fiscalYear": 2012                       │  │
│  │        }                                             │  │
│  │      },                                              │  │
│  │      { ... }                                         │  │
│  │    ],                                                │  │
│  │    relationships: [                                  │  │
│  │      {                                               │  │
│  │        subject: "kg:JPMorgan",                       │  │
│  │        predicate: "kg:hasFinancialObligation",       │  │
│  │        object: "kg:LitReserve_2012_JPM"              │  │
│  │      }                                               │  │
│  │    ]                                                 │  │
│  │  }                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              6. VALIDATION & TRIPLE CREATION                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OntologyValidator                                   │  │
│  │  • Verify entity types exist in ontology             │  │
│  │  • Validate property domains/ranges                  │  │
│  │  • Check required properties                         │  │
│  │  • Validate relationship constraints                 │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EntityFactory                                       │  │
│  │  • Create proper entity URIs                         │  │
│  │  • Generate rdf:type triples                         │  │
│  │  • Generate property triples                         │  │
│  │  • Generate relationship triples                     │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ReificationManager                                  │  │
│  │  • Create rdf:Statement instances                    │  │
│  │  • Add provenance metadata:                          │  │
│  │    - kg:sourceText (original fact)                   │  │
│  │    - kg:confidence (LLM confidence)                  │  │
│  │    - kg:extractedAt (timestamp)                      │  │
│  │    - kg:extractedBy (component name)                 │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TripleStore                                         │  │
│  │  • Store subject-predicate-object triples            │  │
│  │  • Store reified statements separately               │  │
│  │  • Index for efficient querying                      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                MongoDB Triple Store                          │
│         Subject-Predicate-Object + Reification               │
└─────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              7. TEXT RECONSTRUCTION (VERIFICATION - LLM)     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TextReconstructor                                   │  │
│  │  • Input: RDF triples from storage                   │  │
│  │  • Task: Generate paraphrase of original text        │  │
│  │  • LLM reads triples and produces natural language   │  │
│  │  • Output: Reconstructed text                        │  │
│  │  • Example:                                          │  │
│  │    Triples:                                          │  │
│  │      kg:JPMorgan kg:hasFinancialObligation           │  │
│  │        kg:LitReserve_2012                            │  │
│  │      kg:LitReserve_2012 kg:amount 3.7                │  │
│  │    Reconstructed:                                    │  │
│  │      "JPMorgan Chase has litigation reserves of      │  │
│  │       $3.7 billion in 2012."                         │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              8. TEXT COMPARISON (VALIDATION - LLM)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TextComparator                                      │  │
│  │  • Input: Original text + Reconstructed text         │  │
│  │  • Task: Compare for semantic equivalence            │  │
│  │  • Check: Are all facts preserved?                   │  │
│  │  • Check: Are there hallucinations?                  │  │
│  │  • Output:                                           │  │
│  │    {                                                 │  │
│  │      correct: true/false,                            │  │
│  │      missingFacts: [...],                            │  │
│  │      extraFacts: [...],                              │  │
│  │      confidence: 0.95                                │  │
│  │    }                                                 │  │
│  │  • If correct=false: Flag for review or retry        │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              9. QUERY & REASONING LAYER                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Semantic    │  │   Reasoning  │  │   Question      │  │
│  │Query Engine  │  │    Engine    │  │   Answering     │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. OntologyIndexer
- **Purpose**: One-time indexing of ConvFinQA ontology for semantic retrieval
- **Input**: ConvFinQA ontology files (classes, properties, descriptions)
- **Process**:
  - Parse ontology to extract all classes and properties
  - Generate natural language descriptions for each entity
  - Embed descriptions using SemanticSearchProvider (ONNX embeddings)
  - Store in Qdrant vector database for fast retrieval
- **Output**: Searchable ontology index
- **Technology**: @legion/semantic-search package with local ONNX embeddings

#### 2. EntityRelationshipExtractor
- **Purpose**: Identify ALL entities and relationships in raw text using LLM
- **Input**: Raw text with references (e.g., "The current year included expense of $3.7 billion for additional litigation reserves")
- **Context**: Document metadata (company name, fiscal year, etc.)
- **Process**:
  - LLM prompt: "Identify all entities and relationships in this text"
  - Extract explicit and implicit entities
  - Resolve references using context
  - Identify relationships between entities
  - Output structured list
- **Output**:
  ```javascript
  {
    entities: [
      { name: "JPMorgan Chase", type: "company", source: "context" },
      { name: "litigation reserves", type: "financial_reserve", source: "text" },
      { name: "$3.7 billion", type: "amount", source: "text" },
      { name: "2012", type: "year", source: "context" }
    ],
    relationships: [
      { subject: "JPMorgan Chase", relation: "HAS", object: "litigation reserves" },
      { subject: "litigation reserves", relation: "HAS_AMOUNT", object: "$3.7 billion" },
      { subject: "litigation reserves", relation: "IN_YEAR", object: "2012" }
    ]
  }
  ```
- **Technology**: @legion/llm-client with TemplatedPrompt

#### 3. SimpleSentenceGenerator
- **Purpose**: Rewrite as simple subject-verb-object sentences using identified entities
- **Input**: Entities and relationships from EntityRelationshipExtractor
- **Process**:
  - LLM prompt: "Rewrite as simple sentences using these entities"
  - Create one sentence per relationship
  - Use explicit entity names (no pronouns, no references)
  - Subject-Verb-Object structure
  - No ambiguity
- **Output**: Array of simple sentences
- **Technology**: @legion/llm-client with TemplatedPrompt
- **Example**:
  - Input: Entities + Relationships (from component 2)
  - Output:
    ```javascript
    [
      "JPMorgan Chase has litigation reserves.",
      "The litigation reserves are $3.7 billion.",
      "The litigation reserves are for 2012."
    ]
    ```

#### 4. SemanticRetriever
- **Purpose**: Find relevant ontology entities for each normalized sentence using semantic search
- **Input**: Normalized sentence (e.g., "JPMorgan Chase had litigation reserves of $3.7 billion in 2012")
- **Process**:
  - Embed normalized sentence using same ONNX model as ontology
  - Query SemanticSearchProvider.semanticSearch() with sentence embedding
  - Retrieve top-K (e.g., K=20) most similar ontology entities
  - Fetch full ontology definitions for candidates (classes, properties, constraints)
- **Output**: Ranked list of ontology candidates with similarity scores
- **Technology**: @legion/semantic-search package
- **Key Advantage**: Working with normalized, explicit sentences makes semantic matching much more accurate

#### 4. LLMEntityGenerator
- **Purpose**: Generate complete RDF entity models using LLM
- **Input**:
  - Original fact text
  - Top-K ontology candidates with full definitions
  - Existing entities (for entity resolution)
- **Process**:
  - Construct prompt with fact + ontology candidates
  - Use TemplatedPrompt from @legion/prompt-manager
  - Request structured output (JSON schema for entity model)
  - LLM decides:
    - Which ontology classes to instantiate
    - What properties to use
    - How to structure relationships
    - Entity URIs and property values
- **Output**: Complete entity model with entities, properties, relationships
- **Technology**: @legion/llm-client with structured output/tool calling

#### 5. OntologyValidator
- **Purpose**: Validate LLM-generated entity model against ontology constraints
- **Input**: Entity model from LLM
- **Process**:
  - Verify all entity types exist in ontology
  - Validate property domains and ranges
  - Check required vs optional properties
  - Validate relationship constraints
  - Raise errors for violations (FAIL FAST!)
- **Output**: Validated entity model or error

#### 6. EntityFactory
- **Purpose**: Create RDF triples from validated entity model
- **Input**: Validated entity model
- **Process**:
  - Generate proper entity URIs (if not provided by LLM)
  - Create rdf:type triples for all entities
  - Create property triples (entity → property → value)
  - Create relationship triples (entity → predicate → entity)
  - Handle entity deduplication
- **Output**: Array of RDF triples

#### 7. ReificationManager
- **Purpose**: Create reified statements for all relationships with provenance
- **Input**: Relationship triples + metadata
- **Process**:
  - For each relationship triple, create rdf:Statement entity
  - Add rdf:subject, rdf:predicate, rdf:object triples
  - Add provenance metadata:
    - kg:sourceText: Original fact text
    - kg:confidence: LLM confidence score
    - kg:extractedAt: Timestamp
    - kg:extractedBy: Component name
    - kg:sourceDocument: Source document ID
- **Output**: Reified statement triples
- **Storage**: Separate MongoDB collection for fast provenance queries

#### 8. TripleStore
- **Purpose**: Store and query RDF triples with MongoDB backend
- **Input**: RDF triples and reified statements
- **Process**:
  - Store triples in subject-predicate-object format
  - Create indices for fast querying (by subject, predicate, object)
  - Support both URI objects and literal objects
  - Track datatype and language tags for literals
- **Output**: Persistent triple storage
- **Technology**: MongoDB with dedicated collections

#### 9. SemanticQueryEngine
- **Purpose**: Execute semantic queries against the knowledge graph
- **Input**: SPARQL-like queries or natural language questions
- **Process**:
  - Parse query to identify constraints
  - Translate to MongoDB queries
  - Apply reasoning (see ReasoningEngine)
  - Execute against triple store
  - Format results
- **Output**: Query results
- **Technology**: Custom SPARQL-like DSL with MongoDB backend

#### 10. ReasoningEngine
- **Purpose**: Apply ontology reasoning (subclass, subproperty inference)
- **Input**: Query with entity types and properties
- **Process**:
  - Load ontology class hierarchy (rdfs:subClassOf)
  - Load ontology property hierarchy (rdfs:subPropertyOf)
  - Expand queries to include subclasses/subproperties
  - Example: Query for kg:FinancialObligation also returns kg:LitigationReserve instances
- **Output**: Expanded query results with inferred triples
- **Technology**: In-memory hierarchy cache with query expansion

#### 11. TextReconstructor
- **Purpose**: Generate paraphrase of original text from RDF triples for verification
- **Input**: RDF triples from triple store
- **Process**:
  - LLM prompt: "Generate natural language from these RDF triples"
  - Read entity triples, relationship triples, property values
  - Produce fluent natural language paraphrase
  - Should capture ALL facts from triples
- **Output**: Reconstructed text
- **Technology**: @legion/llm-client with TemplatedPrompt
- **Example**:
  - Input triples:
    ```turtle
    kg:JPMorgan rdf:type kg:Company .
    kg:LitReserve_2012 rdf:type kg:LitigationReserve .
    kg:LitReserve_2012 kg:amount 3.7 .
    kg:LitReserve_2012 kg:year 2012 .
    kg:JPMorgan kg:hasFinancialObligation kg:LitReserve_2012 .
    ```
  - Output: "JPMorgan Chase has litigation reserves of $3.7 billion in 2012."

#### 12. TextComparator
- **Purpose**: Compare reconstructed text to original to verify correctness
- **Input**: Original text + Reconstructed text from TextReconstructor
- **Process**:
  - LLM prompt: "Compare these texts for semantic equivalence"
  - Check: Are all facts from original preserved in reconstruction?
  - Check: Are there hallucinated facts in reconstruction?
  - Check: Are there missing facts?
  - Provide detailed comparison report
- **Output**:
  ```javascript
  {
    correct: true/false,
    missingFacts: ["fact X was not captured"],
    extraFacts: ["fact Y was hallucinated"],
    confidence: 0.95,
    explanation: "..."
  }
  ```
- **Technology**: @legion/llm-client with TemplatedPrompt
- **Action**: If correct=false, flag for human review or retry extraction

## 4. Data Model

### Ontology Classes (from existing ConvFinQA ontology)

```turtle
# Top-level categories
kg:Continuant rdfs:subClassOf owl:Thing .
kg:Occurrent rdfs:subClassOf owl:Thing .

# Physical entities
kg:PhysicalEntity rdfs:subClassOf kg:Continuant .
kg:Document rdfs:subClassOf kg:PhysicalEntity .
kg:Company rdfs:subClassOf kg:PhysicalEntity .

# Financial entities
kg:FinancialAsset rdfs:subClassOf kg:PhysicalEntity .
kg:Asset rdfs:subClassOf kg:FinancialAsset .

# States
kg:State rdfs:subClassOf kg:Continuant .
kg:FinancialState rdfs:subClassOf kg:State .
kg:FinancialObligation rdfs:subClassOf kg:State .
kg:LitigationReserve rdfs:subClassOf kg:FinancialObligation .
```

### Ontology Properties (from existing ConvFinQA ontology)

```turtle
# Relationships
kg:hasFinancialObligation rdfs:domain kg:Company ;
                         rdfs:range kg:FinancialObligation .

kg:stateOf rdfs:domain kg:State ;
          rdfs:range kg:PhysicalEntity .

# Data properties
kg:amount rdfs:domain kg:FinancialObligation ;
         rdfs:range xsd:decimal .

kg:fiscalYear rdfs:domain kg:State ;
             rdfs:range xsd:integer .

kg:unit rdfs:domain kg:FinancialObligation ;
       rdfs:range kg:Unit .
```

### Example Instance Model

#### Scenario: "The current year included expense of $3.7 billion for additional litigation reserves"

**Traditional (Wrong) Approach:**
```turtle
kg:text_litigation_reserves_2012_0 rdf:type kg:Asset .
kg:text_litigation_reserves_2012_0 kg:value 3.7 .
kg:text_litigation_reserves_2012_0 kg:label "litigation reserves" .
kg:text_litigation_reserves_2012_0 kg:unit "billion" .
kg:text_litigation_reserves_2012_0 kg:year "2012" .
```

**Semantic (Correct) Approach:**

```turtle
# Company entity
kg:JPMorgan rdf:type kg:Company .
kg:JPMorgan rdfs:label "JPMorgan Chase & Co." .

# Fiscal year context (reusable)
kg:FY2012_JPM rdf:type kg:FiscalYear .
kg:FY2012_JPM kg:year 2012 .
kg:FY2012_JPM kg:belongsTo kg:JPMorgan .

# Litigation reserve entity
kg:LitReserve_2012_JPM rdf:type kg:LitigationReserve .
kg:LitReserve_2012_JPM kg:amount 3.7 .
kg:LitReserve_2012_JPM kg:unit kg:Billion .
kg:LitReserve_2012_JPM kg:fiscalYear 2012 .
kg:LitReserve_2012_JPM kg:category "mortgage-related" .

# Relationship
kg:JPMorgan kg:hasFinancialObligation kg:LitReserve_2012_JPM .

# Reified statement (relationship has properties!)
_:stmt_litig_2012 rdf:type rdf:Statement .
_:stmt_litig_2012 rdf:subject kg:JPMorgan .
_:stmt_litig_2012 rdf:predicate kg:hasFinancialObligation .
_:stmt_litig_2012 rdf:object kg:LitReserve_2012_JPM .
_:stmt_litig_2012 kg:confidence 0.95 .
_:stmt_litig_2012 kg:sourceText "the current year included expense of $3.7 billion for additional litigation reserves" .
_:stmt_litig_2012 kg:sourceDocument "JPMorgan 2013 Annual Report" .
_:stmt_litig_2012 kg:sourcePage 104 .
_:stmt_litig_2012 kg:extractedAt "2025-01-06T10:30:00Z"^^xsd:dateTime .
```

**Now we can query:**

```sparql
# Find all litigation reserves
SELECT ?reserve ?amount WHERE {
  ?reserve rdf:type kg:LitigationReserve .
  ?reserve kg:amount ?amount .
}

# Find companies with litigation reserves
SELECT ?company WHERE {
  ?company kg:hasFinancialObligation ?reserve .
  ?reserve rdf:type kg:LitigationReserve .
}

# Find high-confidence extractions
SELECT ?s ?p ?o WHERE {
  ?stmt rdf:subject ?s .
  ?stmt rdf:predicate ?p .
  ?stmt rdf:object ?o .
  ?stmt kg:confidence ?conf .
  FILTER (?conf > 0.9)
}

# Compare litigation reserves across years
SELECT ?year ?amount WHERE {
  ?reserve rdf:type kg:LitigationReserve .
  ?reserve kg:fiscalYear ?year .
  ?reserve kg:amount ?amount .
} ORDER BY ?year
```

### Multi-Entity Example

#### Scenario: Securities gains comparison across years

**Semantic Model:**

```turtle
# Company
kg:JPMorgan rdf:type kg:Company .

# Securities portfolio
kg:SecuritiesPortfolio_JPM rdf:type kg:InvestmentSecuritiesPortfolio .
kg:SecuritiesPortfolio_JPM kg:belongsTo kg:JPMorgan .

# Gains for each year (separate entities!)
kg:SecuritiesGains_2013 rdf:type kg:SecuritiesGain .
kg:SecuritiesGains_2013 kg:amount 659 .
kg:SecuritiesGains_2013 kg:unit kg:Million .
kg:SecuritiesGains_2013 kg:fiscalYear 2013 .

kg:SecuritiesGains_2012 rdf:type kg:SecuritiesGain .
kg:SecuritiesGains_2012 kg:amount 2028 .
kg:SecuritiesGains_2012 kg:unit kg:Million .
kg:SecuritiesGains_2012 kg:fiscalYear 2012 .

kg:SecuritiesGains_2011 rdf:type kg:SecuritiesGain .
kg:SecuritiesGains_2011 kg:amount 1385 .
kg:SecuritiesGains_2011 kg:unit kg:Million .
kg:SecuritiesGains_2011 kg:fiscalYear 2011 .

# Relationships
kg:SecuritiesPortfolio_JPM kg:generatedGain kg:SecuritiesGains_2013 .
kg:SecuritiesPortfolio_JPM kg:generatedGain kg:SecuritiesGains_2012 .
kg:SecuritiesPortfolio_JPM kg:generatedGain kg:SecuritiesGains_2011 .

# Each relationship is reified with provenance
_:stmt_gain_2013 rdf:type rdf:Statement .
_:stmt_gain_2013 rdf:subject kg:SecuritiesPortfolio_JPM .
_:stmt_gain_2013 rdf:predicate kg:generatedGain .
_:stmt_gain_2013 rdf:object kg:SecuritiesGains_2013 .
_:stmt_gain_2013 kg:sourceTable "JPMorgan 2013 Annual Report Table 1" .
_:stmt_gain_2013 kg:extractedFrom "row: securities gains, column: 2013" .
```

## 5. Concrete Examples

### Example 0: Semantic Retrieval + LLM Generation Pipeline

**This example shows how the new architecture processes a single fact from input to RDF triples.**

#### Input Text (Raw)
```
"The current year included expense of $3.7 billion for additional litigation reserves"
```

**Context**: From JPMorgan 2013 Annual Report, page 104. The document discusses fiscal year 2012 results.

#### Step 1: Entity & Relationship Extraction (LLM)

**Purpose**: Identify ALL entities and relationships in raw text.

```javascript
// EntityRelationshipExtractor prompt to LLM:
{
  task: "Identify all entities and relationships in this text",
  input: "The current year included expense of $3.7 billion for additional litigation reserves",
  context: {
    company: "JPMorgan Chase & Co.",
    fiscalYear: 2012,
    documentYear: 2013,
    source: "JPMorgan 2013 Annual Report"
  }
}

// LLM output:
{
  entities: [
    { name: "JPMorgan Chase", type: "company", source: "context" },
    { name: "litigation reserves", type: "financial_reserve", source: "text" },
    { name: "$3.7 billion", type: "amount", source: "text" },
    { name: "2012", type: "year", source: "context (current year = 2012)" }
  ],
  relationships: [
    { subject: "JPMorgan Chase", relation: "HAS", object: "litigation reserves" },
    { subject: "litigation reserves", relation: "HAS_AMOUNT", object: "$3.7 billion" },
    { subject: "litigation reserves", relation: "IN_YEAR", object: "2012" }
  ]
}
```

**Key Insight**: LLM extracts both explicit entities (from text) and implicit entities (from context), making all references explicit.

#### Step 2: Simple Sentence Generation (LLM)

**Purpose**: Rewrite as unambiguous simple sentences using identified entities.

```javascript
// SimpleSentenceGenerator prompt to LLM:
{
  task: "Rewrite as simple subject-verb-object sentences using these entities. No pronouns, no references, no ambiguity.",
  entities: [...],  // From step 1
  relationships: [...]  // From step 1
}

// LLM output:
{
  sentences: [
    "JPMorgan Chase has litigation reserves.",
    "The litigation reserves are $3.7 billion.",
    "The litigation reserves are for 2012."
  ]
}
```

**Key Insight**: Each sentence is self-contained, explicit, and unambiguous. This dramatically improves semantic retrieval accuracy.

#### Step 3: Semantic Retrieval

**Purpose**: Find relevant ontology entities for each simple sentence.

```javascript
// Query SemanticSearchProvider with each SIMPLE sentence
// Let's process: "JPMorgan Chase has litigation reserves."
const candidates = await semanticRetriever.findRelevantOntologyEntities(
  "JPMorgan Chase had litigation reserves of $3.7 billion in 2012."
);

// Results (top-5 shown):
[
  {
    uri: "kg:LitigationReserve",
    type: "class",
    similarity: 0.92,
    description: "Legal reserves set aside for potential litigation expenses",
    subClassOf: ["kg:FinancialObligation", "kg:State"],
    properties: ["kg:amount", "kg:unit", "kg:fiscalYear", "kg:category"]
  },
  {
    uri: "kg:FinancialObligation",
    type: "class",
    similarity: 0.87,
    description: "Financial obligation or liability of a company",
    subClassOf: ["kg:State"],
    properties: ["kg:amount", "kg:unit"]
  },
  {
    uri: "kg:hasFinancialObligation",
    type: "property",
    similarity: 0.85,
    description: "Relationship between a company and its financial obligations",
    domain: "kg:Company",
    range: "kg:FinancialObligation"
  },
  {
    uri: "kg:Company",
    type: "class",
    similarity: 0.82,
    description: "A business organization or corporation",
    subClassOf: ["kg:PhysicalEntity"],
    properties: ["rdfs:label", "kg:fiscalYear"]
  },
  {
    uri: "kg:amount",
    type: "property",
    similarity: 0.80,
    description: "Numerical value associated with a financial entity",
    domain: "kg:FinancialObligation",
    range: "xsd:decimal"
  }
]
```

#### Step 4: LLM Entity Generation

**Prompt to LLM:**
```
You are an RDF knowledge graph construction assistant. Given a normalized fact sentence and relevant ontology entities, generate a complete RDF entity model.

INPUT FACT (NORMALIZED):
"JPMorgan Chase had litigation reserves of $3.7 billion in 2012."

RELEVANT ONTOLOGY ENTITIES:
1. kg:LitigationReserve (class)
   - Description: Legal reserves set aside for potential litigation expenses
   - SubClassOf: kg:FinancialObligation, kg:State
   - Properties: kg:amount, kg:unit, kg:fiscalYear, kg:category

2. kg:hasFinancialObligation (property)
   - Description: Relationship between a company and its financial obligations
   - Domain: kg:Company
   - Range: kg:FinancialObligation

3. kg:Company (class)
   - Description: A business organization or corporation
   - Properties: rdfs:label

[... additional candidates ...]

TASK:
Generate a complete RDF entity model including:
1. All entities that should be created
2. Their types (using ontology classes)
3. Their properties (using ontology properties)
4. Relationships between entities

OUTPUT FORMAT (JSON):
{
  "entities": [...],
  "relationships": [...],
  "confidence": 0.0-1.0
}
```

**LLM Response:**
```json
{
  "entities": [
    {
      "uri": "kg:JPMorgan",
      "type": "kg:Company",
      "properties": {
        "rdfs:label": "JPMorgan Chase & Co."
      }
    },
    {
      "uri": "kg:LitReserve_2012_JPM",
      "type": "kg:LitigationReserve",
      "properties": {
        "kg:amount": 3.7,
        "kg:unit": "kg:Billion",
        "kg:fiscalYear": 2012,
        "kg:category": "additional"
      }
    }
  ],
  "relationships": [
    {
      "subject": "kg:JPMorgan",
      "predicate": "kg:hasFinancialObligation",
      "object": "kg:LitReserve_2012_JPM"
    }
  ],
  "confidence": 0.95
}
```

#### Step 5: Validation

```javascript
// OntologyValidator checks:
✓ kg:Company exists in ontology
✓ kg:LitigationReserve exists in ontology
✓ kg:hasFinancialObligation domain is kg:Company (valid)
✓ kg:hasFinancialObligation range is kg:FinancialObligation (valid - LitigationReserve is subclass)
✓ All required properties present
✓ Property types match expected ranges

// Validation passes
```

#### Step 6: Triple Creation

```javascript
// EntityFactory generates RDF triples:
[
  // Company entity
  { s: "kg:JPMorgan", p: "rdf:type", o: "kg:Company", isLiteral: false },
  { s: "kg:JPMorgan", p: "rdfs:label", o: "JPMorgan Chase & Co.", isLiteral: true, datatype: "xsd:string" },

  // LitigationReserve entity
  { s: "kg:LitReserve_2012_JPM", p: "rdf:type", o: "kg:LitigationReserve", isLiteral: false },
  { s: "kg:LitReserve_2012_JPM", p: "kg:amount", o: "3.7", isLiteral: true, datatype: "xsd:decimal" },
  { s: "kg:LitReserve_2012_JPM", p: "kg:unit", o: "kg:Billion", isLiteral: false },
  { s: "kg:LitReserve_2012_JPM", p: "kg:fiscalYear", o: "2012", isLiteral: true, datatype: "xsd:integer" },
  { s: "kg:LitReserve_2012_JPM", p: "kg:category", o: "additional", isLiteral: true, datatype: "xsd:string" },

  // Relationship
  { s: "kg:JPMorgan", p: "kg:hasFinancialObligation", o: "kg:LitReserve_2012_JPM", isLiteral: false }
]
```

#### Step 7: Reification

```javascript
// ReificationManager creates reified statement:
[
  // Statement entity
  { s: "_:stmt_litig_2012", p: "rdf:type", o: "rdf:Statement", isLiteral: false },
  { s: "_:stmt_litig_2012", p: "rdf:subject", o: "kg:JPMorgan", isLiteral: false },
  { s: "_:stmt_litig_2012", p: "rdf:predicate", o: "kg:hasFinancialObligation", isLiteral: false },
  { s: "_:stmt_litig_2012", p: "rdf:object", o: "kg:LitReserve_2012_JPM", isLiteral: false },

  // Provenance metadata
  { s: "_:stmt_litig_2012", p: "kg:confidence", o: "0.95", isLiteral: true, datatype: "xsd:decimal" },
  { s: "_:stmt_litig_2012", p: "kg:sourceText", o: "The current year included...", isLiteral: true },
  { s: "_:stmt_litig_2012", p: "kg:sourceDocument", o: "JPMorgan 2013 Annual Report", isLiteral: true },
  { s: "_:stmt_litig_2012", p: "kg:sourcePage", o: "104", isLiteral: true, datatype: "xsd:integer" },
  { s: "_:stmt_litig_2012", p: "kg:extractedAt", o: "2025-01-06T10:30:00Z", isLiteral: true, datatype: "xsd:dateTime" },
  { s: "_:stmt_litig_2012", p: "kg:extractedBy", o: "LLMEntityGenerator v1.0", isLiteral: true }
]
```

#### Step 8: Storage

```javascript
// All triples stored in MongoDB collections:
// - semantic_kg: Entity triples and relationships
// - reified_statements: Reified statements with provenance

// Now queryable!
```

#### Step 9: Text Reconstruction (VERIFICATION)

**Purpose**: Generate paraphrase from RDF triples to verify correctness.

```javascript
// TextReconstructor prompt to LLM:
{
  task: "Generate natural language from these RDF triples",
  triples: [
    "kg:JPMorgan rdf:type kg:Company",
    "kg:JPMorgan rdfs:label 'JPMorgan Chase & Co.'",
    "kg:LitReserve_2012_JPM rdf:type kg:LitigationReserve",
    "kg:LitReserve_2012_JPM kg:amount 3.7",
    "kg:LitReserve_2012_JPM kg:unit kg:Billion",
    "kg:LitReserve_2012_JPM kg:fiscalYear 2012",
    "kg:JPMorgan kg:hasFinancialObligation kg:LitReserve_2012_JPM"
  ]
}

// LLM output:
{
  reconstructedText: "JPMorgan Chase had litigation reserves of $3.7 billion in fiscal year 2012."
}
```

#### Step 10: Comparison & Validation

**Purpose**: Verify reconstructed text matches original intent.

```javascript
// TextComparator prompt to LLM:
{
  task: "Compare these texts for semantic equivalence",
  original: "The current year included expense of $3.7 billion for additional litigation reserves",
  reconstructed: "JPMorgan Chase had litigation reserves of $3.7 billion in fiscal year 2012.",
  context: {
    company: "JPMorgan Chase & Co.",
    fiscalYear: 2012,
    documentYear: 2013
  }
}

// LLM output:
{
  correct: true,
  missingFacts: [],
  extraFacts: [],
  confidence: 0.95,
  explanation: "Both texts convey the same core fact: JPMorgan Chase had litigation reserves of $3.7 billion in 2012. The reconstruction makes implicit context explicit."
}
```

**Action**: If correct=true, triples are committed to storage. If correct=false, flag for review or retry.

#### Key Insights

1. **Entity Extraction First**: LLM explicitly identifies ALL entities and relationships, resolving references using context. This makes everything explicit before processing.

2. **Simple Sentence Generation**: Create unambiguous subject-verb-object sentences using identified entities. No pronouns, no references - just clear, explicit facts.

3. **Five-Phase LLM Usage**:
   - **Phase 1 (Entity/Relationship Extraction)**: Identify what's in the text
   - **Phase 2 (Simple Sentence Generation)**: Rewrite as unambiguous sentences
   - **Phase 3 (Entity Generation)**: Create RDF model from sentences + ontology
   - **Phase 4 (Text Reconstruction)**: Generate paraphrase from RDF triples
   - **Phase 5 (Comparison)**: Verify correctness by comparing texts

4. **Semantic Retrieval Bridges the Gap**: Without embedding search, we'd need extensive prompt engineering or have the LLM "guess" which ontology entities to use. Semantic search gives the LLM exactly the right candidates for each simple sentence.

5. **LLM Does Structured Generation**: Instead of manual entity extraction and matching rules, the LLM:
   - Decides which ontology classes fit the simple sentence
   - Generates appropriate entity URIs
   - Determines property values
   - Identifies relationships
   - Provides confidence scores

6. **Verification Loop Catches Errors**: By reconstructing text from RDF and comparing to original, we can:
   - Detect missing facts
   - Detect hallucinated facts
   - Flag errors before storage
   - Retry extraction if needed

7. **Validation Ensures Correctness**: The LLM might make mistakes in entity generation, but ontology validation catches them before storage.

8. **Reification Preserves Provenance**: We can always trace back to the original text and assess confidence.

### Example 1: Litigation Reserve Percentage Change

**Question:** "what was the percentage increase in litigation reserves in 2012?"

**Current Approach (Broken):**
```javascript
// Text extraction creates:
{
  s: 'kg:text_litigation_reserves_2012_0',
  p: 'kg:value',
  o: 3.7
}

// Query fails because:
// 1. "litigation reserves" doesn't match "kg:text_litigation_reserves_2012_0"
// 2. No way to query by entity type
// 3. Can't compare across years (each is isolated)
```

**Semantic Approach (Working):**

```sparql
# Find all litigation reserves by year
SELECT ?year ?amount WHERE {
  ?reserve rdf:type kg:LitigationReserve .
  ?reserve kg:fiscalYear ?year .
  ?reserve kg:amount ?amount .
} ORDER BY ?year

# Results:
# 2011: 3.2
# 2012: 3.7

# Calculate: (3.7 - 3.2) / 3.2 = 15.6%
```

**Query code:**
```javascript
const reserves = await semanticQuery(`
  SELECT ?year ?amount ?unit WHERE {
    ?reserve rdf:type kg:LitigationReserve .
    ?reserve kg:fiscalYear ?year .
    ?reserve kg:amount ?amount .
    ?reserve kg:unit ?unit .
    FILTER (?year >= 2011 && ?year <= 2012)
  } ORDER BY ?year
`);

const [reserve2011, reserve2012] = reserves;
const percentChange = ((reserve2012.amount - reserve2011.amount) / reserve2011.amount) * 100;
// Result: 15.6%
```

### Example 2: Categorical Table with Entity Filtering

**Question:** "what portion of the total shares subject to outstanding awards is under the 2009 global incentive plan?"

**Table:**
```
                                          | shares available | shares outstanding
2009 global incentive plan                | 2322450         | 2530454
2004 stock incentive plan                 | -               | 5923147
```

**Semantic Model:**

```turtle
# Incentive plans (entities!)
kg:GIP_2009 rdf:type kg:IncentivePlan .
kg:GIP_2009 rdfs:label "2009 global incentive plan" .
kg:GIP_2009 kg:establishedYear 2009 .

kg:SIP_2004 rdf:type kg:IncentivePlan .
kg:SIP_2004 rdfs:label "2004 stock incentive plan" .
kg:SIP_2004 kg:establishedYear 2004 .

# Outstanding shares (separate entities with properties!)
kg:OutstandingShares_GIP2009 rdf:type kg:ShareAllocation .
kg:OutstandingShares_GIP2009 kg:numberOfShares 2530454 .
kg:OutstandingShares_GIP2009 kg:allocationType "outstanding" .

kg:OutstandingShares_SIP2004 rdf:type kg:ShareAllocation .
kg:OutstandingShares_SIP2004 kg:numberOfShares 5923147 .
kg:OutstandingShares_SIP2004 kg:allocationType "outstanding" .

# Relationships
kg:GIP_2009 kg:hasShareAllocation kg:OutstandingShares_GIP2009 .
kg:SIP_2004 kg:hasShareAllocation kg:OutstandingShares_SIP2004 .
```

**Query:**

```sparql
SELECT ?plan ?shares WHERE {
  ?plan rdf:type kg:IncentivePlan .
  ?plan kg:hasShareAllocation ?allocation .
  ?allocation kg:allocationType "outstanding" .
  ?allocation kg:numberOfShares ?shares .
}

# Results:
# GIP_2009: 2530454
# SIP_2004: 5923147
# Total: 8453601
# Portion: 2530454 / 8453601 = 29.9%
```

## 6. MVP Scope

### What We Will Build

1. **Entity Extraction**
   - Parse text sentences to identify entity mentions
   - Extract entity properties (amount, year, unit, etc.)
   - Match entities to ontology classes
   - Create proper entity URIs

2. **Relationship Extraction**
   - Identify relationships between entities
   - Match relationships to ontology properties
   - Validate domain/range constraints

3. **Entity Modeling**
   - Create RDF triples with proper subject-predicate-object structure
   - Instantiate entities with rdf:type
   - Use ontology properties (not metadata like kg:value)

4. **Reification**
   - Create rdf:Statement instances for all extracted relationships
   - Add provenance metadata (source text, confidence, timestamp)
   - Store in MongoDB triple store

5. **Semantic Query Engine**
   - SPARQL-like query interface
   - Support for filtering by entity type, properties
   - Basic reasoning (subclass, subproperty)

6. **Question Answering**
   - Parse natural language questions
   - Translate to semantic queries
   - Execute against proper RDF knowledge graph
   - Return structured answers

### What We Will NOT Build (Out of Scope for MVP)

- Full SPARQL 1.1 compliance
- Complex reasoning (OWL inference, transitive closure)
- Entity resolution across documents
- Temporal reasoning
- Probabilistic reasoning
- Query optimization
- Distributed storage
- Web interface/visualization

### Success Criteria

The MVP is successful if:

1. **Proper RDF Structure**: All entities, relationships, and objects are queryable
2. **Reification Working**: Relationships have provenance metadata
3. **Semantic Queries**: Can query "all LitigationReserves" regardless of how they were extracted
4. **Cross-Year Comparison**: Can compare values across fiscal years
5. **Entity-Specific Queries**: Can filter by entity properties (company, year, category)
6. **ConvFinQA Examples**: Correctly answers litigation reserves question (Example 7)

### Test Cases

1. ✅ Extract litigation reserve from text → create kg:LitigationReserve instance
2. ✅ Query all litigation reserves → returns both 2011 and 2012
3. ✅ Calculate percentage change → 15.6%
4. ✅ Reification → can query statements by confidence, source
5. ✅ Reasoning → querying kg:FinancialObligation returns kg:LitigationReserve instances
6. ✅ Categorical tables → entities per row with relationships

## 7. MongoDB Schema

### Triple Store Collection

```javascript
// Collection: semantic_kg
{
  _id: ObjectId("..."),
  s: "kg:JPMorgan",                    // Subject URI
  p: "kg:hasFinancialObligation",      // Predicate URI
  o: "kg:LitReserve_2012_JPM",         // Object URI or literal
  isLiteral: false,                     // Is object a literal?
  datatype: null,                       // If literal, datatype
  conversationId: "example_7",          // Source conversation
  extractedAt: ISODate("2025-01-06"),
  indexed: true                         // For query optimization
}
```

### Reification Collection

```javascript
// Collection: reified_statements
{
  _id: ObjectId("..."),
  statementUri: "_:stmt1",
  subject: "kg:JPMorgan",
  predicate: "kg:hasFinancialObligation",
  object: "kg:LitReserve_2012_JPM",
  metadata: {
    confidence: 0.95,
    sourceText: "the current year included...",
    sourceDocument: "JPMorgan 2013 Annual Report",
    sourcePage: 104,
    extractedBy: "TextExtractor",
    extractedAt: ISODate("2025-01-06")
  },
  conversationId: "example_7"
}
```

### Entity Collection (Denormalized for Performance)

```javascript
// Collection: entities
{
  _id: ObjectId("..."),
  uri: "kg:LitReserve_2012_JPM",
  type: "kg:LitigationReserve",
  properties: {
    "kg:amount": 3.7,
    "kg:unit": "kg:Billion",
    "kg:fiscalYear": 2012,
    "kg:category": "mortgage-related"
  },
  relationships: [
    { predicate: "kg:stateOf", object: "kg:JPMorgan", direction: "out" }
  ],
  conversationId: "example_7"
}
```
