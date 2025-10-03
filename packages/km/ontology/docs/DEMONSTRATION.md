# Incremental Ontology Building: Complete Demonstration

> **A step-by-step walkthrough showing how the system builds a rich ontology from scratch using natural language**

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [The 5-Phase Pipeline](#the-5-phase-pipeline)
4. [Demonstration Walkthrough](#demonstration-walkthrough)
5. [Key Innovations](#key-innovations)
6. [Running the Demo](#running-the-demo)

---

## Executive Summary

This document demonstrates a novel approach to ontology creation that:

- **Starts from zero** - No upfront domain modeling required
- **Learns incrementally** - Processes text sentence-by-sentence
- **Makes intelligent decisions** - LLM creates abstractions automatically
- **Builds proper hierarchies** - Dynamic parent creation for related concepts
- **Prevents duplication** - Semantic search + subsumption reasoning

### What You'll See

This demonstration processes 3 carefully chosen sentences:

1. **"The centrifugal pump circulates coolant through the system."**
   → Bootstrap from empty ontology

2. **"The reciprocating pump moves hydraulic fluid."**
   → **Dynamic abstraction**: LLM creates "Pump" parent class automatically!

3. **"The pump connects to the storage tank."**
   → Semantic search finds existing types, property reuse via subsumption

### Final Result

From 3 simple sentences, the system builds:
- **7 classes** in proper hierarchies (Pump, IndustrialFluid, Container abstractions)
- **2 properties** (circulationStatus, movesFluid)
- **5 relationships** (all inheriting from universal kg:relatesTo)
- **Valid RDF/OWL** ontology with subsumption relationships

### Related Demonstrations

**Want to see a more comprehensive example?** Check out the **[Plumbing Domain Demonstration](./DEMONSTRATION-PLUMBING.md)** which showcases:
- **6 sentences** organized in 2 thematic rounds
- **20 final classes** (vs. 7 in this demo)
- **Multi-domain coverage**: Materials, tools, tasks, fixtures, locations
- **More abstraction layers**: Pipe → MetalPipe → SteelPipe hierarchies
- **Extensive explanations**: Deep dive into WHY decisions are made

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   OntologyBuilder                        │
│                  (Main Orchestrator)                     │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► SimpleTripleStore (RDF storage)
             ├─► SemanticSearchProvider (Qdrant + embeddings)
             ├─► LLMClient (Claude/GPT)
             │
             └─► 7 Core Services:
                 ├─ HierarchyTraversalService
                 ├─ SubsumptionChecker
                 ├─ OntologyQueryService
                 ├─ GapAnalysisService
                 ├─ SpecializationDecisionService
                 ├─ OntologyExtensionService
                 └─ SentenceAnnotator
```

### Key Technologies

- **RDF/OWL**: W3C standards for ontologies
- **Qdrant**: Vector database for semantic search
- **Nomic Embeddings**: Local embedding model
- **Claude/GPT**: LLM for intelligent reasoning
- **TemplatedPrompt**: Structured LLM interactions

---

## The 5-Phase Pipeline

Every sentence is processed through 5 phases:

### Phase 1: QUERY

**Purpose**: Find what already exists in the ontology

**Steps**:
1. LLM extracts type mentions from sentence
2. Semantic search finds similar existing types (>0.75 similarity)
3. For each match, retrieve full hierarchy context

**Example**:
```
Sentence: "The reciprocating pump moves hydraulic fluid."
Mentions: ["pump", "reciprocating pump", "fluid", "hydraulic fluid"]

Semantic Search Results:
  • "pump" → kg:CentrifugalPump (similarity: 0.82) ✅ Found!
  • "reciprocating pump" → No match (gap)
```

### Phase 2: GAP ANALYSIS

**Purpose**: Identify what's missing vs. what can be reused

**Steps**:
1. LLM extracts implied types (classes, properties, relationships)
2. Compare against existing ontology
3. Apply subsumption rules to check if types can be reused from hierarchy

**Subsumption Rules**:
- **Rule 1**: Entities inherit ALL properties from ancestors
- **Rule 2**: Relationships can only specialize if domain AND range are subclasses

**Example**:
```
Implied Types:
  • Class: ReciprocatingPump
  • Property: movesFluid
  • Relationship: pumpsFluid

Gap Analysis:
  ❌ ReciprocatingPump not found → MISSING
  ❌ movesFluid not found → MISSING
  ❌ pumpsFluid not found → MISSING
  ✅ Can reuse: 0 from hierarchy
```

### Phase 3: DECISION

**Purpose**: For reusable types, decide: REUSE inherited concept or SPECIALIZE?

**LLM Reasoning**:
- **REUSE**: If generic property is sufficient
- **SPECIALIZE**: If domain-specific semantics needed

**Example**:
```
Candidate: locatedIn property exists in Equipment
Sentence: "The pump is located in Building A"

LLM Decision: REUSE
Reasoning: "Generic location property is sufficient,
            no pump-specific location semantics needed"
```

### Phase 4: EXTENSION

**Purpose**: Add new types to ontology with proper structure

**Key Innovation - Dynamic Abstraction**:

When adding a new class, the LLM can either:
- **USE_EXISTING**: Choose existing parent
- **CREATE_PARENT**: Create intermediate abstraction first!

**Example - Creating "Pump" Parent**:
```
Context:
  • Existing: kg:CentrifugalPump → owl:Thing
  • Adding: ReciprocatingPump

LLM Decision: CREATE_PARENT
  • parentName: "Pump"
  • reasoning: "CentrifugalPump and ReciprocatingPump are both pump types,
               need common Pump abstraction"

Actions:
  1. Create kg:Pump → owl:Thing
  2. Create kg:ReciprocatingPump → kg:Pump
```

**Relationship Hierarchy**:

All relationships inherit from **kg:relatesTo** (domain: owl:Thing, range: owl:Thing):
```
kg:relatesTo
  ├─ connectsTo
  ├─ circulates
  ├─ pumpsFluid
  └─ flowsThrough
```

### Phase 5: ANNOTATION

**Purpose**: Attach type metadata to sentence for downstream use

**Output**:
```json
{
  "text": "The reciprocating pump moves hydraulic fluid.",
  "domain": "industrial",
  "types": [
    {
      "mention": "pump",
      "matchedClass": "kg:Pump",
      "hierarchy": ["kg:Pump", "owl:Thing"],
      "properties": [...],
      "relationships": [...]
    }
  ]
}
```

---

## Demonstration Walkthrough

### Initial State: Empty Ontology

```
Classes: 0
Properties: 0
Relationships: 0
```

The ontology starts completely empty - no predefined domain model required!

---

### Sentence 1: "The centrifugal pump circulates coolant through the system."

**Purpose**: Bootstrap from empty ontology

#### Phase 1: QUERY

```
LLM extracts mentions: ["pump", "centrifugal pump", "coolant", "system"]

Semantic Search:
  • All searches return 0 results (ontology is empty)

Result: 4 gaps identified
```

#### Phase 2: GAP ANALYSIS

```
LLM extracts implied types:

Classes:
  • CentrifugalPump: "Pump using centrifugal force"

Properties:
  • circulationStatus: "Boolean indicating circulation state"

Relationships:
  • circulates: CentrifugalPump → Coolant
  • flowsThrough: Coolant → System

Gap Analysis:
  ❌ Missing: 1 class, 1 property, 2 relationships
  ✅ Can reuse: 0 (ontology is empty)
```

#### Phase 3: DECISION

```
(No reuse candidates - ontology is empty)
```

#### Phase 4: EXTENSION

**Creating First Class**:
```
LLM determines parent for CentrifugalPump:
  • Existing classes: [] (empty)
  • Decision: USE_EXISTING
  • Parent: owl:Thing

RDF added:
  kg:CentrifugalPump rdf:type owl:Class .
  kg:CentrifugalPump rdfs:label "CentrifugalPump" .
  kg:CentrifugalPump rdfs:subClassOf owl:Thing .
```

**Bootstrapping kg:relatesTo**:
```
🔧 First relationship being added → Bootstrap universal relationship!

RDF added:
  kg:relatesTo rdf:type owl:ObjectProperty .
  kg:relatesTo rdfs:label "relatesTo" .
  kg:relatesTo rdfs:domain owl:Thing .
  kg:relatesTo rdfs:range owl:Thing .
  kg:relatesTo rdfs:comment "Universal relationship connecting any entity to any entity" .
```

**Creating Relationships**:
```
RDF added:
  kg:circulates rdf:type owl:ObjectProperty .
  kg:circulates rdfs:subPropertyOf kg:relatesTo .  ⭐ Inherits from universal!
  kg:circulates rdfs:domain kg:CentrifugalPump .
  kg:circulates rdfs:range kg:Coolant .

  kg:flowsThrough rdf:type owl:ObjectProperty .
  kg:flowsThrough rdfs:subPropertyOf kg:relatesTo .  ⭐ Inherits from universal!
  kg:flowsThrough rdfs:domain kg:Coolant .
  kg:flowsThrough rdfs:range kg:System .
```

#### Phase 5: ANNOTATION

```
Sentence annotated with:
  • CentrifugalPump (with full hierarchy context)
  • circulationStatus property
  • circulates, flowsThrough relationships
```

#### Ontology After Sentence 1

```
📦 Classes (1):
owl:Thing
  └─ CentrifugalPump

🔗 Object Properties (3):
kg:relatesTo (domain: owl:Thing, range: owl:Thing)
  ├─ circulates (CentrifugalPump → Coolant)
  └─ flowsThrough (Coolant → System)

📝 Datatype Properties (1):
circulationStatus (CentrifugalPump → boolean)
```

**Key Achievement**: ✅ Bootstrapped from zero!

---

### Sentence 2: "The reciprocating pump moves hydraulic fluid."

**Purpose**: Trigger dynamic abstraction - LLM creates parent classes

#### Phase 1: QUERY

```
LLM extracts mentions: ["pump", "reciprocating pump", "fluid", "hydraulic fluid"]

Semantic Search:
  • "pump" → kg:CentrifugalPump (similarity: 0.82) ✅ FOUND!
  • "reciprocating pump" → No match
  • "fluid" → No match
  • "hydraulic fluid" → No match

Result: 1 existing type found, 3 gaps
```

**Significance**: Semantic search successfully finds similar type!

#### Phase 2: GAP ANALYSIS

```
LLM extracts implied types:

Classes:
  • ReciprocatingPump: "Pump that uses reciprocating motion"
  • HydraulicFluid: "Fluid used in hydraulic systems"

Properties:
  • movesFluid: "Boolean indicating fluid movement capability"

Relationships:
  • pumpsFluid: ReciprocatingPump → HydraulicFluid

Gap Analysis:
  ❌ Missing: 2 classes, 1 property, 1 relationship
  ✅ Can reuse: 0 from hierarchy
```

#### Phase 3: DECISION

```
(No reuse candidates this time)
```

#### Phase 4: EXTENSION

**🔨 Dynamic Abstraction #1 - Creating "Pump" Parent**:

```
LLM determines parent for ReciprocatingPump:

  Context:
    • Existing classes: [CentrifugalPump → owl:Thing]
    • New class: ReciprocatingPump

  LLM Analysis:
    "CentrifugalPump and ReciprocatingPump are both pump types.
     They share the common pattern '*Pump' and both move fluids.
     Need to create Pump abstraction as their common parent."

  Decision: CREATE_PARENT ⭐
    • parentName: "Pump"
    • parentDescription: "Device for moving fluids"
    • grandparent: "owl:Thing"
    • reasoning: "Need Pump abstraction for pump types"

Actions:
  🔨 Creating intermediate parent: Pump

  RDF added:
    kg:Pump rdf:type owl:Class .
    kg:Pump rdfs:label "Pump" .
    kg:Pump rdfs:comment "Device for moving fluids" .
    kg:Pump rdfs:subClassOf owl:Thing .

  ✅ Created parent: kg:Pump → owl:Thing

  Then:
    kg:ReciprocatingPump rdf:type owl:Class .
    kg:ReciprocatingPump rdfs:label "ReciprocatingPump" .
    kg:ReciprocatingPump rdfs:subClassOf kg:Pump .  ⭐ Child of Pump!
```

**🔨 Dynamic Abstraction #2 - Creating "IndustrialFluid" Parent**:

```
LLM determines parent for HydraulicFluid:

  Context:
    • Existing: [Coolant, ...]
    • New: HydraulicFluid

  Decision: CREATE_PARENT ⭐
    • parentName: "IndustrialFluid"
    • reasoning: "Industrial fluids (coolant, hydraulic) need common parent"

Actions:
  🔨 Creating intermediate parent: IndustrialFluid
  ✅ Created parent: kg:IndustrialFluid → owl:Thing
  ✅ Created: kg:HydraulicFluid → kg:IndustrialFluid
```

**Key Insight**: The LLM is **autonomously discovering abstractions** by recognizing patterns!

#### Phase 5: ANNOTATION

```
Sentence annotated with full type metadata
```

#### Ontology After Sentence 2

```
📦 Classes (5):
owl:Thing
  ├─ CentrifugalPump
  ├─ Pump ⭐ (created dynamically!)
  │   └─ ReciprocatingPump
  └─ IndustrialFluid ⭐ (created dynamically!)
      └─ HydraulicFluid

🔗 Object Properties (4):
kg:relatesTo (domain: owl:Thing, range: owl:Thing)
  ├─ circulates (CentrifugalPump → Coolant)
  ├─ flowsThrough (Coolant → System)
  └─ pumpsFluid (ReciprocatingPump → HydraulicFluid)

📝 Datatype Properties (2):
circulationStatus (CentrifugalPump → boolean)
movesFluid (ReciprocatingPump → boolean)
```

**Key Achievements**:
- ✅ Dynamic abstraction: "Pump" parent created
- ✅ Another abstraction: "IndustrialFluid" parent created
- ✅ Semantic search found existing types
- ✅ Proper hierarchy established

**Note**: CentrifugalPump remains under owl:Thing (not restructured to Pump). This is a known limitation - the system creates abstractions for new types but doesn't retroactively restructure existing ones.

---

### Sentence 3: "The pump connects to the storage tank."

**Purpose**: Demonstrate semantic search, subsumption, property reuse

#### Phase 1: QUERY

```
LLM extracts mentions: ["pump", "storage tank", "tank"]

Semantic Search:
  • "pump" → kg:Pump (similarity: 0.85) ✅ FOUND!
  • "pump" → kg:CentrifugalPump (similarity: 0.82) ✅ FOUND!
  • "storage tank" → No match
  • "tank" → No match

Result: 2 existing types found (Pump hierarchy!), 1 gap
```

**Significance**: Found the abstract "Pump" class AND its specialized child!

#### Phase 2: GAP ANALYSIS

```
LLM extracts implied types:

Classes:
  • StorageTank: "Container for storing fluids or materials"

Relationships:
  • connectsTo: Pump → StorageTank

Gap Analysis:
  ❌ Missing: 1 class, 0 properties, 1 relationship
  ✅ Can reuse: 0 from hierarchy (no matching properties)
```

#### Phase 3: DECISION

```
(No reuse candidates)
```

#### Phase 4: EXTENSION

**🔨 Dynamic Abstraction #3 - Creating "Container" Parent**:

```
LLM determines parent for StorageTank:

  Decision: CREATE_PARENT ⭐
    • parentName: "Container"
    • reasoning: "Storage tanks are types of containers"

Actions:
  🔨 Creating intermediate parent: Container
  ✅ Created: kg:Container → owl:Thing
  ✅ Created: kg:StorageTank → kg:Container
```

**Creating Relationship**:
```
RDF added:
  kg:connectsTo rdf:type owl:ObjectProperty .
  kg:connectsTo rdfs:subPropertyOf kg:relatesTo .  ⭐ Inherits from universal!
  kg:connectsTo rdfs:domain kg:Pump .
  kg:connectsTo rdfs:range kg:StorageTank .
```

#### Phase 5: ANNOTATION

```
Sentence annotated with:
  • Pump (abstract class - benefits from hierarchy!)
  • StorageTank
  • connectsTo relationship
```

#### Final Ontology State

```
📦 Classes (7):
owl:Thing
  ├─ CentrifugalPump
  ├─ Pump ⭐
  │   └─ ReciprocatingPump
  ├─ IndustrialFluid ⭐
  │   └─ HydraulicFluid
  └─ Container ⭐
      └─ StorageTank

🔗 Object Properties (5):
kg:relatesTo (domain: owl:Thing, range: owl:Thing) ⭐
  ├─ circulates (CentrifugalPump → Coolant)
  ├─ flowsThrough (Coolant → System)
  ├─ pumpsFluid (ReciprocatingPump → HydraulicFluid)
  └─ connectsTo (Pump → StorageTank)

📝 Datatype Properties (2):
circulationStatus (CentrifugalPump → boolean)
movesFluid (ReciprocatingPump → boolean)
```

**Final Statistics**:
- **7 classes** (4 abstractions created dynamically!)
- **2 properties**
- **5 relationships** (all inheriting from kg:relatesTo)

---

## Key Innovations

### 1. Dynamic Abstraction Creation

**Problem**: Traditional ontologies require upfront domain modeling. How do we know to create a "Pump" parent class before seeing pump types?

**Solution**: The LLM analyzes existing classes when adding new ones and autonomously decides to create intermediate parents.

**Example from Demo**:
```
Seeing: CentrifugalPump + ReciprocatingPump
LLM realizes: "These are both pump types"
LLM creates: Pump parent class automatically
```

**Why It Matters**:
- No upfront domain modeling required
- Hierarchy emerges naturally from text
- Scales to any domain

### 2. Universal Relationship Hierarchy

**Problem**: Relationships in OWL don't have a common parent by default, making it hard to reason about them generically.

**Solution**: Bootstrap **kg:relatesTo** (domain: owl:Thing, range: owl:Thing) and make all relationships inherit from it.

**Benefits**:
- Can query all relationships via rdfs:subPropertyOf
- Consistent structure
- Enables relationship reasoning

### 3. Semantic Search for Deduplication

**Problem**: How do we avoid creating "Pump" when "pump" already exists?

**Solution**: Embed all class labels+descriptions in vector space. Search for similarity >0.75 before creating new types.

**Example**:
```
Query: "pump"
Results:
  • kg:CentrifugalPump (0.82 similarity) ← Found!
  • kg:ReciprocatingPump (0.81 similarity) ← Found!
```

### 4. Subsumption Reasoning

**Problem**: Do we need a new "pumpLocation" property or can we reuse "location" from Equipment parent?

**Solution**: Apply subsumption rules:
- **Rule 1**: Entities inherit ALL properties from ancestors
- **Rule 2**: Relationships can only specialize if domain AND range are subclasses

**LLM Decision**:
- **REUSE**: Generic property sufficient
- **SPECIALIZE**: Domain-specific semantics needed

### 5. Incremental Building

**Problem**: Traditional: Build complete ontology upfront. Incremental: Build as you read.

**Advantage**:
- Works with partial information
- Adapts to new concepts
- No predefined schema needed

---

## Complete RDF/OWL Output

```turtle
# Classes
kg:CentrifugalPump rdf:type owl:Class ;
                   rdfs:label "CentrifugalPump" ;
                   rdfs:subClassOf owl:Thing .

kg:Pump rdf:type owl:Class ;
        rdfs:label "Pump" ;
        rdfs:comment "Device for moving fluids" ;
        rdfs:subClassOf owl:Thing .

kg:ReciprocatingPump rdf:type owl:Class ;
                     rdfs:label "ReciprocatingPump" ;
                     rdfs:subClassOf kg:Pump .

kg:IndustrialFluid rdf:type owl:Class ;
                   rdfs:label "IndustrialFluid" ;
                   rdfs:subClassOf owl:Thing .

kg:HydraulicFluid rdf:type owl:Class ;
                  rdfs:label "HydraulicFluid" ;
                  rdfs:subClassOf kg:IndustrialFluid .

kg:Container rdf:type owl:Class ;
             rdfs:label "Container" ;
             rdfs:subClassOf owl:Thing .

kg:StorageTank rdf:type owl:Class ;
               rdfs:label "StorageTank" ;
               rdfs:subClassOf kg:Container .

# Universal relationship
kg:relatesTo rdf:type owl:ObjectProperty ;
             rdfs:label "relatesTo" ;
             rdfs:domain owl:Thing ;
             rdfs:range owl:Thing ;
             rdfs:comment "Universal relationship connecting any entity to any entity" .

# Specialized relationships (all inherit from kg:relatesTo)
kg:circulates rdf:type owl:ObjectProperty ;
              rdfs:subPropertyOf kg:relatesTo ;
              rdfs:domain kg:CentrifugalPump ;
              rdfs:range kg:Coolant .

kg:flowsThrough rdf:type owl:ObjectProperty ;
                rdfs:subPropertyOf kg:relatesTo ;
                rdfs:domain kg:Coolant ;
                rdfs:range kg:System .

kg:pumpsFluid rdf:type owl:ObjectProperty ;
              rdfs:subPropertyOf kg:relatesTo ;
              rdfs:domain kg:ReciprocatingPump ;
              rdfs:range kg:HydraulicFluid .

kg:connectsTo rdf:type owl:ObjectProperty ;
              rdfs:subPropertyOf kg:relatesTo ;
              rdfs:domain kg:Pump ;
              rdfs:range kg:StorageTank .

# Properties
kg:circulationStatus rdf:type owl:DatatypeProperty ;
                     rdfs:label "circulationStatus" ;
                     rdfs:domain kg:CentrifugalPump ;
                     rdfs:range xsd:boolean .

kg:movesFluid rdf:type owl:DatatypeProperty ;
              rdfs:label "movesFluid" ;
              rdfs:domain kg:ReciprocatingPump ;
              rdfs:range xsd:boolean .
```

---

## Running the Demo

### Prerequisites

```bash
# Ensure dependencies are installed
npm install

# Ensure Qdrant is running
docker run -p 6333:6333 qdrant/qdrant

# Ensure .env has LLM API key
ANTHROPIC_API_KEY=your_key_here
```

### Run the Demonstration

```bash
# From package root
node --experimental-vm-modules __tests__/tmp/demo-walkthrough.js
```

### Expected Output

The demo will:
1. Show initial empty ontology
2. Process each sentence with detailed phase-by-phase output
3. Show ontology state after each sentence
4. Display final statistics and achievements

**Runtime**: ~30 seconds (includes LLM calls)

---

## Conclusion

This demonstration proves that intelligent ontology creation is possible without upfront domain modeling. The key innovations are:

1. **Dynamic Abstraction**: LLM creates intermediate parents automatically
2. **Incremental Building**: Works sentence-by-sentence from zero
3. **Semantic Search**: Prevents duplication via similarity
4. **Subsumption Reasoning**: Enables property reuse through hierarchy
5. **Universal Relationships**: kg:relatesTo provides common base

### What This Enables

- **Document Analysis**: Build domain ontologies from technical documents
- **Knowledge Extraction**: Convert unstructured text to structured knowledge
- **Domain Discovery**: Automatically discover domain concepts and relationships
- **Ontology Evolution**: Adapt ontologies as new concepts are encountered

### Next Steps

- Process longer documents (10-100 sentences)
- Test on different domains (medical, financial, legal)
- Add instance creation (A-Box) on top of T-Box
- Implement reasoning engines for inference

### See Also

- **[Plumbing Domain Demonstration](./DEMONSTRATION-PLUMBING.md)** - Extended 6-sentence demo with comprehensive explanations
- **[Implementation Plan](./implementation-plan.md)** - Complete technical roadmap (10 phases, 215 tests)
- **[README](../README.md)** - Package overview and usage guide

---

**Generated by**: Legion Knowledge Management - Ontology Package
**Version**: 1.0.0
**Date**: October 2025
