# Ontology Creation Service - Design Document

## Overview

The Ontology Creation Service builds domain-specific OWL ontologies **incrementally** by processing text sentence-by-sentence. It creates the **type-level (T-Box)** definitions through natural language analysis, growing the ontology organically as new concepts are discovered.

### Core Principle

**Process text incrementally, one sentence at a time, building the ontology from the ground up.**

The system works whether the ontology is:
- **Empty** (bootstrapping from zero)
- **Partially populated** (extending existing ontology)
- **Well-established** (refining and specializing)

### Problem Statement

Traditional ontology creation requires upfront domain modeling by experts. This approach:
- Requires complete domain knowledge before starting
- Cannot adapt to new concepts discovered in documents
- Creates static schemas that don't evolve with the data

### Solution

**Sentence-level incremental ontology building with subsumption reasoning:**

1. **Start with any text** - no prior ontology required
2. **Process sentence-by-sentence** - extract type-level information
3. **Query existing types** - check what's already in the ontology
4. **Check subsumption** - can we reuse inherited concepts?
5. **Extend ontology** - add only what's truly missing
6. **Build hierarchy** - establish IS-A relationships
7. **Avoid duplication** - through semantic similarity and inheritance checking

---

## Architecture

### System Context

```
┌────────────────────────────────────────────────────────────────────┐
│                  Incremental Ontology Builder                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Text Input → Sentences → For each sentence:                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. QUERY Phase                                              │  │
│  │     - Extract type mentions (LLM)                            │  │
│  │     - Query existing ontology (with hierarchy)               │  │
│  │     - Return: matched types + full inheritance context       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  2. GAP ANALYSIS Phase                                       │  │
│  │     - Extract implied types from sentence (LLM)              │  │
│  │     - Identify: missing classes, properties, relationships   │  │
│  │     - Subsumption check: exists in hierarchy?                │  │
│  │     - Result: [truly missing] + [can reuse from hierarchy]   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  3. DECISION Phase                                           │  │
│  │     - For each "can reuse" item:                             │  │
│  │       LLM decides: REUSE inherited or SPECIALIZE?            │  │
│  │     - Only specialize if domain-specific semantics needed    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  4. EXTENSION Phase                                          │  │
│  │     - Add missing classes (determine parent via LLM)         │  │
│  │     - Add specialized properties (rdfs:subPropertyOf)        │  │
│  │     - Add truly missing properties/relationships            │  │
│  │     - Store RDF triples in triplestore                       │  │
│  │     - Index in semantic search                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  5. ANNOTATION Phase                                         │  │
│  │     - Re-query to get updated ontology                       │  │
│  │     - Attach type metadata to sentence                       │  │
│  │     - Return: sentence + relevant types + hierarchy context  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Next sentence → Repeat                                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Storage & Services (Used Throughout)                        │  │
│  │                                                               │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │  │
│  │  │ SimpleTriple   │  │ Hierarchy      │  │ Semantic     │  │  │
│  │  │ Store (RDF)    │  │ Traversal      │  │ Search       │  │  │
│  │  └────────────────┘  └────────────────┘  └──────────────┘  │  │
│  │                                                               │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │  │
│  │  │ Subsumption    │  │ LLM Client     │  │ RDF Builder  │  │  │
│  │  │ Checker        │  │ (via RM)       │  │              │  │  │
│  │  └────────────────┘  └────────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/km/ontology/
├── src/
│   ├── OntologyBuilder.js              # Main entry point - orchestrates sentence processing
│   ├── services/
│   │   ├── OntologyQueryService.js     # Query ontology with hierarchy
│   │   ├── GapAnalysisService.js       # Identify missing types
│   │   ├── HierarchyTraversalService.js # Navigate rdfs:subClassOf
│   │   ├── SubsumptionChecker.js       # Check inheritance
│   │   ├── SpecializationDecisionService.js # Reuse vs specialize
│   │   ├── OntologyExtensionService.js # Extend ontology
│   │   ├── SentenceAnnotator.js        # Attach type metadata
│   │   ├── SimilarityCheckService.js   # Semantic deduplication
│   │   └── RDFBuilder.js               # Generate RDF triples
│   ├── prompts/
│   │   ├── extract-type-mentions.hbs
│   │   ├── extract-implied-types.hbs
│   │   ├── determine-parent-class.hbs
│   │   └── specialization-decision.hbs
│   └── index.js
├── docs/
│   └── DESIGN.md
└── __tests__/
```

---

## Core Workflow

### Processing a Single Sentence

**Input:** "The centrifugal compressor connects to the heat exchanger in Building 3"

**Assumption:** Ontology may be empty or partially populated

#### Phase 1: QUERY

```javascript
// Extract potential type mentions
const mentions = await extractTypeMentions(sentence);
// → ["centrifugal compressor", "heat exchanger", "Building"]

// Query ontology for each mention (with semantic search)
const queryResults = [];
for (const mention of mentions) {
  // Search in semantic index
  const similar = await semanticSearch.search('ontology-classes', mention);

  if (similar.length > 0 && similar[0].similarity > 0.75) {
    // Found match - get full hierarchy
    const classURI = similar[0].id;
    const hierarchy = await hierarchyTraversal.getHierarchyContext(classURI);
    const properties = await getInheritedProperties(classURI);
    const relationships = await getInheritedRelationships(classURI);

    queryResults.push({
      mention,
      matchedClass: classURI,
      hierarchy,
      properties,  // Includes inherited from ancestors
      relationships
    });
  } else {
    // No match - this is a gap
    queryResults.push({
      mention,
      matchedClass: null,
      isGap: true
    });
  }
}
```

**Result:**
```javascript
[
  { mention: "centrifugal compressor", matchedClass: null, isGap: true },
  { mention: "heat exchanger", matchedClass: null, isGap: true },
  {
    mention: "Building",
    matchedClass: "kg:Building",
    hierarchy: { ancestors: ["kg:Structure", "kg:PhysicalObject"], depth: 2 },
    properties: [
      { label: "locatedIn", definedIn: "kg:PhysicalObject", inherited: true },
      { label: "address", definedIn: "kg:Building", inherited: false }
    ]
  }
]
```

#### Phase 2: GAP ANALYSIS

```javascript
// Use LLM to extract what the sentence implies about types
const implied = await extractImpliedTypes(sentence);
```

**LLM extracts:**
```javascript
{
  classes: [
    { name: "CentrifugalCompressor", description: "Compressor using centrifugal force" },
    { name: "HeatExchanger", description: "Device for heat transfer" }
  ],
  properties: [],
  relationships: [
    { name: "connectsTo", domain: "Equipment", range: "Equipment" }
  ]
}
```

**Gap Analysis:**
```javascript
const gaps = {
  missingClasses: [
    { name: "CentrifugalCompressor", ... },
    { name: "HeatExchanger", ... }
  ],
  missingProperties: [],
  missingRelationships: [],
  canReuseFromHierarchy: []
};

// Check if "connectsTo" exists in hierarchy
// If we already have kg:Equipment with ancestors, check if connectsTo exists
const equipmentClass = await findClass("Equipment"); // May return null if bootstrapping

if (equipmentClass) {
  const subsumption = await subsumptionChecker.checkRelationshipSubsumption(
    "kg:Equipment",
    "kg:Equipment",
    "connectsTo"
  );

  if (subsumption.exists) {
    gaps.canReuseFromHierarchy.push({
      type: 'relationship',
      implied: { name: "connectsTo", domain: "Equipment", range: "Equipment" },
      existing: subsumption
    });
  } else {
    gaps.missingRelationships.push({ name: "connectsTo", ... });
  }
} else {
  // No Equipment class yet - need to create it
  gaps.missingClasses.push({ name: "Equipment", description: "Industrial equipment" });
  gaps.missingRelationships.push({ name: "connectsTo", ... });
}
```

#### Phase 3: DECISION

For each item in `canReuseFromHierarchy`:

```javascript
const decision = await specializationDecisionService.decide({
  sentence: "The centrifugal compressor connects to the heat exchanger",
  implied: { name: "connectsTo", domain: "Equipment", range: "Equipment" },
  existing: {
    relationship: "kg:connectedTo",
    definedIn: "kg:PhysicalObject",
    inheritanceDistance: 2
  }
});

// LLM returns:
{
  action: "REUSE",
  reasoning: "General connection relationship is sufficient for this use case"
}
```

#### Phase 4: EXTENSION

```javascript
const additions = [];

// 1. Add missing classes with parent determination
for (const missingClass of gaps.missingClasses) {
  // Use LLM to find parent
  const parent = await determineParentClass(missingClass, existingClasses);
  // → "CentrifugalCompressor should be subclass of Compressor"
  //   "Compressor should be subclass of Equipment"

  // If parent doesn't exist, add it recursively
  const classURI = `kg:${missingClass.name}`;
  additions.push(
    [classURI, 'rdf:type', 'owl:Class'],
    [classURI, 'rdfs:label', `"${missingClass.name}"`],
    [classURI, 'rdfs:comment', `"${missingClass.description}"`],
    [classURI, 'rdfs:subClassOf', parent]
  );
}

// 2. Handle specialization decisions
for (const candidate of gaps.canReuseFromHierarchy) {
  if (candidate.decision.action === 'SPECIALIZE') {
    const newURI = `kg:${candidate.implied.name}`;
    additions.push(
      [newURI, 'rdf:type', 'owl:ObjectProperty'],
      [newURI, 'rdfs:subPropertyOf', candidate.existing.property],
      [newURI, 'rdfs:domain', candidate.implied.domain],
      [newURI, 'rdfs:range', candidate.implied.range]
    );
  }
  // If REUSE, no action needed
}

// 3. Add truly missing properties/relationships
for (const missing of gaps.missingRelationships) {
  const relURI = `kg:${missing.name}`;
  additions.push(
    [relURI, 'rdf:type', 'owl:ObjectProperty'],
    [relURI, 'rdfs:domain', `kg:${missing.domain}`],
    [relURI, 'rdfs:range', `kg:${missing.range}`],
    [relURI, 'rdfs:label', `"${missing.name}"`]
  );
}

// 4. Store all additions in triplestore
for (const triple of additions) {
  await tripleStore.add(...triple);
}

// 5. Index new classes in semantic search
await indexNewClasses(additions);
```

**Resulting Ontology:**
```turtle
# New classes added
kg:Equipment rdf:type owl:Class ;
    rdfs:label "Equipment" ;
    rdfs:subClassOf kg:PhysicalObject .

kg:Compressor rdf:type owl:Class ;
    rdfs:label "Compressor" ;
    rdfs:subClassOf kg:Equipment .

kg:CentrifugalCompressor rdf:type owl:Class ;
    rdfs:label "Centrifugal Compressor" ;
    rdfs:subClassOf kg:Compressor .

kg:HeatExchanger rdf:type owl:Class ;
    rdfs:label "Heat Exchanger" ;
    rdfs:subClassOf kg:Equipment .

# Relationship added
kg:connectsTo rdf:type owl:ObjectProperty ;
    rdfs:domain kg:Equipment ;
    rdfs:range kg:Equipment .
```

#### Phase 5: ANNOTATION

```javascript
// Re-query to get updated ontology
const updatedTypes = await ontologyQueryService.findRelevantTypesForSentence(sentence);

// Annotate sentence with type context
const annotated = {
  text: sentence,
  types: updatedTypes, // Now includes CentrifugalCompressor, HeatExchanger with full hierarchy
  domain: detectDomain(sentence)
};

return annotated;
```

---

## Subsumption Rules

### Core Principles

**Subsumption is fundamental to avoiding duplication and building clean ontologies.**

### Rule 1: Entity Type Inheritance

**An entity type inherits ALL properties and relationships from its ancestors.**

```turtle
# Hierarchy
kg:PhysicalObject rdf:type owl:Class .
kg:Equipment rdfs:subClassOf kg:PhysicalObject .
kg:Pump rdfs:subClassOf kg:Equipment .

# Properties
kg:locatedIn rdfs:domain kg:PhysicalObject .
kg:installedLocation rdfs:domain kg:Equipment ;
                     rdfs:subPropertyOf kg:locatedIn .
```

**What kg:Pump inherits:**
- `kg:locatedIn` from `kg:PhysicalObject` (2 levels up)
- `kg:installedLocation` from `kg:Equipment` (1 level up)
- Both properties are available to `kg:Pump` instances!

**Key Point:** Specialization ADDS to the ontology, it doesn't REPLACE. A `Pump` instance can use both `locatedIn` (general) and `installedLocation` (specialized).

### Rule 2: Relationship Specialization Constraint

**A relationship can only specialize another relationship if its domain and range are subclasses (or equal) to the base relationship's domain and range.**

#### Valid Specialization Examples

```turtle
# Base relationship
kg:connectsTo rdf:type owl:ObjectProperty ;
              rdfs:domain kg:Equipment ;
              rdfs:range kg:Equipment .

# Valid specialization #1: Both domain and range specialize
kg:pumpConnectsToTank rdf:type owl:ObjectProperty ;
                      rdfs:subPropertyOf kg:connectsTo ;
                      rdfs:domain kg:Pump ;        # Pump ⊆ Equipment ✓
                      rdfs:range kg:Tank .         # Tank ⊆ Equipment ✓
```

**Why valid?**
- `kg:Pump rdfs:subClassOf kg:Equipment` ✓
- `kg:Tank rdfs:subClassOf kg:Equipment` ✓
- Domain and range are both subclasses → valid specialization

```turtle
# Valid specialization #2: Same domain/range
kg:equipmentLinksTo rdf:type owl:ObjectProperty ;
                    rdfs:subPropertyOf kg:connectsTo ;
                    rdfs:domain kg:Equipment ;    # Equipment = Equipment ✓
                    rdfs:range kg:Equipment .     # Equipment = Equipment ✓
```

**Why valid?** Same domain/range as parent → always valid.

```turtle
# Valid specialization #3: More specific domain only
kg:pumpConnectsTo rdf:type owl:ObjectProperty ;
                  rdfs:subPropertyOf kg:connectsTo ;
                  rdfs:domain kg:Pump ;           # Pump ⊆ Equipment ✓
                  rdfs:range kg:Equipment .       # Equipment = Equipment ✓
```

**Why valid?** Domain is more specific, range is same → valid.

#### Invalid Specialization Examples

```turtle
# Base relationship
kg:connectsTo rdfs:domain kg:Equipment ;
              rdfs:range kg:Equipment .

# Invalid specialization #1: Range not subclass
kg:pumpConnectsToBuilding rdf:type owl:ObjectProperty ;
                          rdfs:subPropertyOf kg:connectsTo ;  # ✗ INVALID
                          rdfs:domain kg:Pump ;               # Pump ⊆ Equipment ✓
                          rdfs:range kg:Building .            # Building ⊄ Equipment ✗
```

**Why invalid?**
- `kg:Building` is NOT a subclass of `kg:Equipment`
- `kg:Building rdfs:subClassOf kg:Structure` (different hierarchy)
- Cannot specialize `connectsTo` because range constraint is violated

```turtle
# Invalid specialization #2: Domain broadens
kg:physicalObjectConnectsTo rdf:type owl:ObjectProperty ;
                            rdfs:subPropertyOf kg:connectsTo ;  # ✗ INVALID
                            rdfs:domain kg:PhysicalObject ;     # Equipment ⊆ PhysicalObject ✗ (wrong direction!)
                            rdfs:range kg:Equipment .
```

**Why invalid?**
- Domain is BROADER than parent (PhysicalObject is parent of Equipment)
- Specialization must NARROW or maintain, never BROADEN

### Rule 3: Subsumption Check Algorithm

When checking if relationship R2 can specialize R1:

```javascript
function canSpecialize(R2, R1) {
  // R2 can specialize R1 if:
  // 1. R2.domain is subclass of (or equal to) R1.domain
  // 2. R2.range is subclass of (or equal to) R1.range

  const domainValid = isSubClassOf(R2.domain, R1.domain) || R2.domain === R1.domain;
  const rangeValid = isSubClassOf(R2.range, R1.range) || R2.range === R1.range;

  return domainValid && rangeValid;
}
```

### Rule 4: Property Specialization

Properties follow the same domain constraint:

```turtle
# Valid property specialization
kg:locatedIn rdfs:domain kg:PhysicalObject .

kg:installedLocation rdfs:domain kg:Equipment ;           # Equipment ⊆ PhysicalObject ✓
                     rdfs:subPropertyOf kg:locatedIn .    # Valid!
```

**Why valid?** Domain is more specific (Equipment ⊆ PhysicalObject).

```turtle
# Invalid property specialization
kg:installedLocation rdfs:domain kg:Building ;            # Building ⊄ Equipment ✗
                     rdfs:subPropertyOf kg:locatedIn .    # Invalid!
```

**Why invalid?** Domain jumps to unrelated branch of hierarchy.

### Practical Example: Processing "Pump P101 is in Building 3"

**Sentence:** "Pump P101 is in Building 3"

**Existing Ontology:**
```turtle
kg:PhysicalObject rdf:type owl:Class .
kg:Equipment rdfs:subClassOf kg:PhysicalObject .
kg:Pump rdfs:subClassOf kg:Equipment .
kg:Building rdfs:subClassOf kg:Structure .

kg:locatedIn rdfs:domain kg:PhysicalObject ;
             rdfs:range kg:PhysicalObject .
```

**Gap Analysis extracts:**
```javascript
{
  implied: {
    relationship: "isIn",
    domain: "Pump",
    range: "Building"
  }
}
```

**Subsumption Check:**
```javascript
// Check if "isIn" can specialize existing "locatedIn"
// locatedIn: PhysicalObject → PhysicalObject

// Check domain: Is Pump ⊆ PhysicalObject?
// Pump → Equipment → PhysicalObject ✓ YES

// Check range: Is Building ⊆ PhysicalObject?
// Building → Structure → PhysicalObject ✓ YES (assuming Structure ⊆ PhysicalObject)

// Result: CAN SPECIALIZE
subsumption = {
  exists: true,
  relationship: "kg:locatedIn",
  canSpecialize: true  // Both domain and range are subclasses
}
```

**Decision:**
```
LLM: "REUSE kg:locatedIn - general location relationship is sufficient"
```

**Result:** Use inherited `kg:locatedIn`, no new relationship needed.

### Practical Example: Processing "Pump connects to Tank"

**Sentence:** "Pump P101 connects to Tank T200"

**Existing Ontology:**
```turtle
kg:Equipment rdfs:subClassOf kg:PhysicalObject .
kg:Pump rdfs:subClassOf kg:Equipment .
kg:Tank rdfs:subClassOf kg:Equipment .

kg:connectsTo rdfs:domain kg:Equipment ;
              rdfs:range kg:Equipment .
```

**Gap Analysis extracts:**
```javascript
{
  implied: {
    relationship: "connectsTo",
    domain: "Pump",
    range: "Tank"
  }
}
```

**Subsumption Check:**
```javascript
// Check if implied "connectsTo" matches existing "connectsTo"

// Exact name match found!
// Check domain: Is Pump ⊆ Equipment? ✓ YES
// Check range: Is Tank ⊆ Equipment? ✓ YES

// Result: CAN SPECIALIZE (but same name, so REUSE)
subsumption = {
  exists: true,
  relationship: "kg:connectsTo",
  canSpecialize: true
}
```

**Decision:**
```
LLM: "REUSE kg:connectsTo - already defined at correct level"
```

**Result:** Use existing `kg:connectsTo`, no specialization needed.

### Practical Example: Invalid Specialization

**Sentence:** "Pump connects to Building"

**Existing Ontology:**
```turtle
kg:Equipment rdfs:subClassOf kg:PhysicalObject .
kg:Pump rdfs:subClassOf kg:Equipment .
kg:Building rdfs:subClassOf kg:Structure .
kg:Structure rdfs:subClassOf kg:PhysicalObject .

kg:connectsTo rdfs:domain kg:Equipment ;
              rdfs:range kg:Equipment .
```

**Gap Analysis extracts:**
```javascript
{
  implied: {
    relationship: "connectsTo",
    domain: "Pump",
    range: "Building"
  }
}
```

**Subsumption Check:**
```javascript
// Check if "connectsTo(Pump, Building)" can specialize "connectsTo(Equipment, Equipment)"

// Check domain: Is Pump ⊆ Equipment? ✓ YES
// Check range: Is Building ⊆ Equipment? ✗ NO
// (Building → Structure → PhysicalObject, NOT → Equipment)

// Result: CANNOT SPECIALIZE connectsTo
subsumption = {
  exists: true,  // connectsTo exists
  relationship: "kg:connectsTo",
  canSpecialize: false  // Range constraint violated
}
```

**What happens?**
- Cannot specialize `kg:connectsTo` because Building is not subclass of Equipment
- Options:
  1. Create NEW relationship `kg:pumpsToBuilding` (NOT a specialization of connectsTo)
  2. OR use more general `kg:adjacentTo` at PhysicalObject level
  3. OR use `kg:locatedIn` (Pump is located in Building)

**Decision:**
```
LLM analyzes context and suggests:
"Use kg:locatedIn instead - a pump being 'in' a building is about location, not connection"
```

**Result:** Use `kg:locatedIn` from PhysicalObject level.

---

## Key Services

### 1. OntologyBuilder (Main Entry Point)

The orchestrator that processes text incrementally.

```javascript
export class OntologyBuilder {
  constructor(config = {}) {
    this.tripleStore = config.tripleStore; // @legion/rdf SimpleTripleStore
    this.semanticSearch = config.semanticSearch; // @legion/semantic-search
    this.llmClient = config.llmClient; // From ResourceManager

    // Initialize services
    this.hierarchyTraversal = new HierarchyTraversalService(this.tripleStore);
    this.subsumptionChecker = new SubsumptionChecker(this.tripleStore, this.hierarchyTraversal);
    this.ontologyQuery = new OntologyQueryService(this.tripleStore, this.hierarchyTraversal, this.semanticSearch);
    this.gapAnalysis = new GapAnalysisService(this.subsumptionChecker, this.llmClient);
    this.specializationDecision = new SpecializationDecisionService(this.llmClient);
    this.ontologyExtension = new OntologyExtensionService(this.tripleStore, this.semanticSearch, this.llmClient);
    this.sentenceAnnotator = new SentenceAnnotator();
  }

  /**
   * Process text incrementally, building ontology sentence-by-sentence
   * Works whether ontology is empty or populated
   */
  async processText(text, options = {}) {
    const domain = options.domain || 'general';

    // Break into sentences
    const sentences = this.segmentSentences(text);
    const annotatedSentences = [];

    console.log(`\n🔨 Building ontology from ${sentences.length} sentences\n`);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      console.log(`[${i + 1}/${sentences.length}] Processing: "${sentence}"`);

      // Phase 1: QUERY
      const existingTypes = await this.ontologyQuery.findRelevantTypesForSentence(
        sentence,
        this.llmClient
      );

      const foundCount = existingTypes.filter(t => !t.isGap).length;
      const gapCount = existingTypes.filter(t => t.isGap).length;
      console.log(`  → Found ${foundCount} existing types, ${gapCount} gaps`);

      // Phase 2: GAP ANALYSIS
      const gaps = await this.gapAnalysis.analyzeGaps(sentence, existingTypes);

      console.log(`  → Gaps: ${gaps.missingClasses.length} classes, ${gaps.missingProperties.length} properties`);
      console.log(`  → Can reuse: ${gaps.canReuseFromHierarchy.length} from hierarchy`);

      // Phase 3: DECISION
      for (const candidate of gaps.canReuseFromHierarchy) {
        const decision = await this.specializationDecision.decide(candidate);
        candidate.decision = decision;
      }

      // Phase 4: EXTENSION
      if (gaps.missingClasses.length > 0 ||
          gaps.missingProperties.length > 0 ||
          gaps.missingRelationships.length > 0 ||
          gaps.canReuseFromHierarchy.some(c => c.decision?.action === 'SPECIALIZE')) {

        const extensions = await this.ontologyExtension.extendFromGaps(gaps, domain);
        console.log(`  ✅ Extended: +${extensions.addedClasses} classes, +${extensions.addedProperties} properties`);
        console.log(`  ♻️  Reused: ${extensions.reusedFromHierarchy} inherited concepts`);
      }

      // Phase 5: ANNOTATION
      const updatedTypes = await this.ontologyQuery.findRelevantTypesForSentence(
        sentence,
        this.llmClient
      );

      const annotated = this.sentenceAnnotator.annotate(sentence, updatedTypes, domain);
      annotatedSentences.push(annotated);
    }

    console.log(`\n✅ Ontology building complete`);
    console.log(`   Total classes: ${await this.countClasses()}`);
    console.log(`   Total properties: ${await this.countProperties()}`);
    console.log(`   Total relationships: ${await this.countRelationships()}`);

    return {
      success: true,
      sentences: annotatedSentences,
      ontologyStats: {
        classes: await this.countClasses(),
        properties: await this.countProperties(),
        relationships: await this.countRelationships()
      }
    };
  }

  async countClasses() {
    const classes = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');
    return classes.length;
  }

  async countProperties() {
    const datatypeProps = await this.tripleStore.query(null, 'rdf:type', 'owl:DatatypeProperty');
    return datatypeProps.length;
  }

  async countRelationships() {
    const objectProps = await this.tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
    return objectProps.length;
  }

  segmentSentences(text) {
    // Simple sentence splitting - could use TextPreprocessor from @legion/nlp
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
```

### 2. HierarchyTraversalService

Navigates rdfs:subClassOf chains.

```javascript
export class HierarchyTraversalService {
  constructor(tripleStore) {
    this.tripleStore = tripleStore;
  }

  /**
   * Get all ancestor classes (parent → grandparent → ...)
   */
  async getAncestors(classURI) {
    const ancestors = [];
    let current = classURI;

    while (current) {
      const parents = await this.tripleStore.query(current, 'rdfs:subClassOf', null);
      if (parents.length > 0) {
        const parent = parents[0][2]; // First parent (assuming single inheritance)
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendant classes (children of this class)
   */
  async getDescendants(classURI) {
    const descendants = await this.tripleStore.query(null, 'rdfs:subClassOf', classURI);
    return descendants.map(t => t[0]);
  }

  /**
   * Get full hierarchy context
   */
  async getHierarchyContext(classURI) {
    return {
      class: classURI,
      ancestors: await this.getAncestors(classURI),
      descendants: await this.getDescendants(classURI),
      depth: (await this.getAncestors(classURI)).length
    };
  }
}
```

### 3. SubsumptionChecker

Checks if concepts exist in inheritance hierarchy.

```javascript
export class SubsumptionChecker {
  constructor(tripleStore, hierarchyTraversal) {
    this.tripleStore = tripleStore;
    this.hierarchyTraversal = hierarchyTraversal;
  }

  /**
   * Check if property exists anywhere in class hierarchy
   */
  async checkPropertySubsumption(classURI, propertyName) {
    const hierarchy = [classURI, ...(await this.hierarchyTraversal.getAncestors(classURI))];

    for (let i = 0; i < hierarchy.length; i++) {
      const cls = hierarchy[i];
      const properties = await this.tripleStore.query(null, 'rdfs:domain', cls);

      for (const [propURI] of properties) {
        const labels = await this.tripleStore.query(propURI, 'rdfs:label', null);
        const label = labels[0]?.[2]?.replace(/"/g, '');

        if (this.isSimilar(propertyName, label)) {
          return {
            exists: true,
            property: propURI,
            label,
            definedIn: cls,
            inheritanceDistance: i,
            inherited: i > 0
          };
        }
      }
    }

    return { exists: false };
  }

  /**
   * Check if relationship exists in hierarchy
   * AND if proposed specialization is valid
   */
  async checkRelationshipSubsumption(domainClass, rangeClass, relationshipName) {
    const domainHierarchy = [domainClass, ...(await this.hierarchyTraversal.getAncestors(domainClass))];
    const rangeHierarchy = [rangeClass, ...(await this.hierarchyTraversal.getAncestors(rangeClass))];

    for (let i = 0; i < domainHierarchy.length; i++) {
      const dClass = domainHierarchy[i];
      const relationships = await this.tripleStore.query(null, 'rdfs:domain', dClass);

      for (const [relURI] of relationships) {
        const types = await this.tripleStore.query(relURI, 'rdf:type', null);
        if (!types.some(t => t[2] === 'owl:ObjectProperty')) continue;

        const ranges = await this.tripleStore.query(relURI, 'rdfs:range', null);
        const labels = await this.tripleStore.query(relURI, 'rdfs:label', null);
        const label = labels[0]?.[2]?.replace(/"/g, '');

        const baseRangeURI = ranges[0]?.[2];

        if (this.isSimilar(relationshipName, label)) {
          // Found matching relationship name!
          // Now check if specialization is VALID according to subsumption rules

          // Check domain constraint: Is domainClass ⊆ dClass (or equal)?
          const domainValid = (domainClass === dClass) || domainHierarchy.includes(dClass);

          // Check range constraint: Is rangeClass ⊆ baseRangeURI (or equal)?
          const rangeValid = this.isSubClassOfOrEqual(rangeClass, baseRangeURI, rangeHierarchy);

          const canSpecialize = domainValid && rangeValid;

          return {
            exists: true,
            relationship: relURI,
            label,
            definedIn: { domain: dClass, range: baseRangeURI },
            inheritanceDistance: i,
            inherited: i > 0,
            canSpecialize,  // NEW: Can the proposed relationship specialize this one?
            specializationReason: canSpecialize ? null : this.getSpecializationFailureReason(
              domainClass, rangeClass, dClass, baseRangeURI, domainValid, rangeValid
            )
          };
        }
      }
    }

    return { exists: false };
  }

  /**
   * Check if testClass is subclass of (or equal to) baseClass
   */
  isSubClassOfOrEqual(testClass, baseClass, testClassHierarchy) {
    if (testClass === baseClass) return true;
    return testClassHierarchy.includes(baseClass);
  }

  /**
   * Generate explanation for why specialization failed
   */
  getSpecializationFailureReason(proposedDomain, proposedRange, baseDomain, baseRange, domainValid, rangeValid) {
    if (!domainValid && !rangeValid) {
      return `Domain ${proposedDomain} is not subclass of ${baseDomain} AND range ${proposedRange} is not subclass of ${baseRange}`;
    } else if (!domainValid) {
      return `Domain ${proposedDomain} is not subclass of ${baseDomain} (domain broadens instead of narrows)`;
    } else if (!rangeValid) {
      return `Range ${proposedRange} is not subclass of ${baseRange} (range constraint violated)`;
    }
    return null;
  }

  isSimilar(name1, name2) {
    if (!name1 || !name2) return false;
    const normalize = (s) => s.toLowerCase().replace(/[_-\s]/g, '');
    return normalize(name1) === normalize(name2);
  }

  isCompatibleRange(rangeURI, targetClass, targetHierarchy) {
    return rangeURI === targetClass || targetHierarchy.includes(rangeURI);
  }
}
```

### 4. OntologyQueryService

Queries ontology with full hierarchical context.

```javascript
export class OntologyQueryService {
  constructor(tripleStore, hierarchyTraversal, semanticSearch) {
    this.tripleStore = tripleStore;
    this.hierarchyTraversal = hierarchyTraversal;
    this.semanticSearch = semanticSearch;
  }

  /**
   * Find relevant types for a sentence
   * Returns types WITH full inheritance context
   */
  async findRelevantTypesForSentence(sentence, llmClient) {
    // Extract type mentions using LLM
    const mentions = await this.extractTypeMentions(sentence, llmClient);

    const results = [];

    for (const mention of mentions) {
      // Search semantic index
      const similar = await this.semanticSearch.semanticSearch(
        'ontology-classes',
        mention,
        { limit: 3 }
      );

      if (similar.length > 0 && similar[0]._similarity > 0.75) {
        const classURI = similar[0].id;

        // Get full hierarchical context
        const hierarchy = await this.hierarchyTraversal.getHierarchyContext(classURI);
        const properties = await this.getInheritedProperties(classURI);
        const relationships = await this.getInheritedRelationships(classURI);

        results.push({
          mention,
          matchedClass: classURI,
          similarity: similar[0]._similarity,
          hierarchy,
          properties,
          relationships
        });
      } else {
        // Gap identified
        results.push({
          mention,
          matchedClass: null,
          isGap: true
        });
      }
    }

    return results;
  }

  async extractTypeMentions(sentence, llmClient) {
    const prompt = `
    Extract entity type mentions from this sentence (not instances):

    Sentence: "${sentence}"

    Example:
    - "The centrifugal compressor" → ["compressor", "centrifugal compressor"]
    - "connects to the heat exchanger" → ["heat exchanger"]

    Return array of type mentions as strings.
    `;

    const result = await llmClient.query(prompt, {
      responseSchema: {
        type: 'object',
        properties: {
          mentions: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    return result.data.mentions || [];
  }

  async getInheritedProperties(classURI) {
    const properties = [];
    const hierarchy = [classURI, ...(await this.hierarchyTraversal.getAncestors(classURI))];

    for (let i = 0; i < hierarchy.length; i++) {
      const cls = hierarchy[i];
      const props = await this.tripleStore.query(null, 'rdfs:domain', cls);

      for (const [propURI] of props) {
        const types = await this.tripleStore.query(propURI, 'rdf:type', null);
        if (!types.some(t => t[2] === 'owl:DatatypeProperty')) continue;

        const labels = await this.tripleStore.query(propURI, 'rdfs:label', null);
        const ranges = await this.tripleStore.query(propURI, 'rdfs:range', null);

        properties.push({
          uri: propURI,
          label: labels[0]?.[2]?.replace(/"/g, ''),
          range: ranges[0]?.[2],
          definedIn: cls,
          inherited: i > 0,
          inheritanceDistance: i
        });
      }
    }

    return properties;
  }

  async getInheritedRelationships(classURI) {
    const relationships = [];
    const hierarchy = [classURI, ...(await this.hierarchyTraversal.getAncestors(classURI))];

    for (let i = 0; i < hierarchy.length; i++) {
      const cls = hierarchy[i];
      const rels = await this.tripleStore.query(null, 'rdfs:domain', cls);

      for (const [relURI] of rels) {
        const types = await this.tripleStore.query(relURI, 'rdf:type', null);
        if (!types.some(t => t[2] === 'owl:ObjectProperty')) continue;

        const labels = await this.tripleStore.query(relURI, 'rdfs:label', null);
        const ranges = await this.tripleStore.query(relURI, 'rdfs:range', null);

        relationships.push({
          uri: relURI,
          label: labels[0]?.[2]?.replace(/"/g, ''),
          range: ranges[0]?.[2],
          definedIn: cls,
          inherited: i > 0,
          inheritanceDistance: i
        });
      }
    }

    return relationships;
  }
}
```

### 5. GapAnalysisService

Identifies truly missing concepts after subsumption checking.

```javascript
export class GapAnalysisService {
  constructor(subsumptionChecker, llmClient) {
    this.subsumptionChecker = subsumptionChecker;
    this.llmClient = llmClient;
  }

  /**
   * Analyze what's missing after checking subsumption
   * Returns: { missingClasses, missingProperties, missingRelationships, canReuseFromHierarchy }
   */
  async analyzeGaps(sentence, existingTypes) {
    // Extract what the sentence implies about types
    const implied = await this.extractImpliedTypes(sentence);

    const gaps = {
      missingClasses: [],
      missingProperties: [],
      missingRelationships: [],
      canReuseFromHierarchy: []
    };

    // Check each implied class
    for (const impliedClass of implied.classes) {
      const exists = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedClass.name.toLowerCase()
      );

      if (!exists || exists.isGap) {
        gaps.missingClasses.push(impliedClass);
      }
    }

    // Check properties with subsumption
    for (const impliedProp of implied.properties) {
      const domainType = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedProp.domain?.toLowerCase()
      );

      if (domainType && domainType.matchedClass) {
        const subsumption = await this.subsumptionChecker.checkPropertySubsumption(
          domainType.matchedClass,
          impliedProp.name
        );

        if (subsumption.exists) {
          gaps.canReuseFromHierarchy.push({
            type: 'property',
            implied: impliedProp,
            existing: subsumption,
            sentence
          });
        } else {
          gaps.missingProperties.push(impliedProp);
        }
      } else {
        // Domain class doesn't exist yet
        gaps.missingProperties.push(impliedProp);
      }
    }

    // Check relationships with subsumption
    for (const impliedRel of implied.relationships) {
      const domainType = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedRel.domain?.toLowerCase()
      );
      const rangeType = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedRel.range?.toLowerCase()
      );

      if (domainType?.matchedClass && rangeType?.matchedClass) {
        const subsumption = await this.subsumptionChecker.checkRelationshipSubsumption(
          domainType.matchedClass,
          rangeType.matchedClass,
          impliedRel.name
        );

        if (subsumption.exists) {
          gaps.canReuseFromHierarchy.push({
            type: 'relationship',
            implied: impliedRel,
            existing: subsumption,
            sentence
          });
        } else {
          gaps.missingRelationships.push(impliedRel);
        }
      } else {
        // Domain or range class doesn't exist yet
        gaps.missingRelationships.push(impliedRel);
      }
    }

    return gaps;
  }

  async extractImpliedTypes(sentence) {
    const prompt = `
    Analyze this sentence and extract TYPE-LEVEL information (not instances):

    Sentence: "${sentence}"

    Extract:
    1. Entity types (e.g., "compressor", "heat exchanger")
    2. Properties implied (e.g., "operates at pressure" → operatingPressure property)
    3. Relationships (e.g., "connects to" → connectsTo relationship)

    Return JSON: { classes: [{name, description}], properties: [{name, domain, type}], relationships: [{name, domain, range}] }
    `;

    const result = await this.llmClient.query(prompt, {
      responseSchema: {
        type: 'object',
        properties: {
          classes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' }
              }
            }
          },
          properties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                domain: { type: 'string' },
                type: { type: 'string' }
              }
            }
          },
          relationships: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                domain: { type: 'string' },
                range: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return result.data;
  }
}
```

### 6. SpecializationDecisionService

LLM decides: reuse inherited concept or specialize it.

```javascript
export class SpecializationDecisionService {
  constructor(llmClient) {
    this.llmClient = llmClient;
  }

  async decide(candidate) {
    const prompt = `
    Sentence: "${candidate.sentence}"

    Implied: ${candidate.implied.name}
    Existing in hierarchy: ${candidate.existing.label} (defined in ${candidate.existing.definedIn}, ${candidate.existing.inheritanceDistance} levels up)

    Should we:
    A) REUSE the inherited concept (sufficient for this use case)
    B) SPECIALIZE by creating a subproperty/subrelationship (if domain-specific semantics needed)

    Only specialize if the domain requires specific semantics not captured by the parent.
    `;

    const result = await this.llmClient.query(prompt, {
      responseSchema: {
        type: 'object',
        properties: {
          action: { enum: ['REUSE', 'SPECIALIZE'] },
          reasoning: { type: 'string' }
        }
      }
    });

    return result.data;
  }
}
```

### 7. OntologyExtensionService

Extends ontology respecting subsumption.

```javascript
export class OntologyExtensionService {
  constructor(tripleStore, semanticSearch, llmClient) {
    this.tripleStore = tripleStore;
    this.semanticSearch = semanticSearch;
    this.llmClient = llmClient;
  }

  async extendFromGaps(gaps, domain) {
    const additions = [];

    // 1. Add missing classes
    for (const missingClass of gaps.missingClasses) {
      const parent = await this.determineParentClass(missingClass, domain);
      const classURI = `kg:${missingClass.name}`;

      additions.push(
        [classURI, 'rdf:type', 'owl:Class'],
        [classURI, 'rdfs:label', `"${missingClass.name}"`],
        [classURI, 'rdfs:comment', `"${missingClass.description}"`],
        [classURI, 'rdfs:subClassOf', parent]
      );

      console.log(`    ✅ Add class: ${classURI} subClassOf ${parent}`);
    }

    // 2. Handle specialization decisions
    for (const candidate of gaps.canReuseFromHierarchy) {
      if (candidate.decision?.action === 'SPECIALIZE') {
        const newURI = `kg:${candidate.implied.name}`;
        additions.push(
          [newURI, 'rdf:type', candidate.type === 'property' ? 'owl:DatatypeProperty' : 'owl:ObjectProperty'],
          [newURI, 'rdfs:subPropertyOf', candidate.existing.property || candidate.existing.relationship],
          [newURI, 'rdfs:domain', `kg:${candidate.implied.domain}`],
          [newURI, 'rdfs:label', `"${candidate.implied.name}"`]
        );

        console.log(`    🔧 Specialize: ${newURI} subPropertyOf ${candidate.existing.property || candidate.existing.relationship}`);
      } else {
        console.log(`    ♻️  Reuse: ${candidate.existing.label} from ${candidate.existing.definedIn}`);
      }
    }

    // 3. Add missing properties
    for (const missingProp of gaps.missingProperties) {
      const propURI = `kg:${missingProp.name}`;
      additions.push(
        [propURI, 'rdf:type', 'owl:DatatypeProperty'],
        [propURI, 'rdfs:domain', `kg:${missingProp.domain}`],
        [propURI, 'rdfs:range', this.mapToXSDType(missingProp.type)],
        [propURI, 'rdfs:label', `"${missingProp.name}"`]
      );
    }

    // 4. Add missing relationships
    for (const missingRel of gaps.missingRelationships) {
      const relURI = `kg:${missingRel.name}`;
      additions.push(
        [relURI, 'rdf:type', 'owl:ObjectProperty'],
        [relURI, 'rdfs:domain', `kg:${missingRel.domain}`],
        [relURI, 'rdfs:range', `kg:${missingRel.range}`],
        [relURI, 'rdfs:label', `"${missingRel.name}"`]
      );
    }

    // 5. Store in triplestore
    for (const triple of additions) {
      await this.tripleStore.add(...triple);
    }

    // 6. Index new classes
    await this.indexNewClasses(additions);

    return {
      addedClasses: gaps.missingClasses.length,
      addedProperties: gaps.missingProperties.length,
      addedRelationships: gaps.missingRelationships.length,
      reusedFromHierarchy: gaps.canReuseFromHierarchy.filter(c => c.decision?.action === 'REUSE').length,
      specialized: gaps.canReuseFromHierarchy.filter(c => c.decision?.action === 'SPECIALIZE').length
    };
  }

  async determineParentClass(newClass, domain) {
    // Query existing classes
    const existingClasses = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');

    if (existingClasses.length === 0) {
      // Bootstrap: create root class
      return 'owl:Thing';
    }

    const prompt = `
    New class: ${newClass.name} - ${newClass.description}

    Existing classes:
    ${existingClasses.map(([uri]) => `- ${uri}`).join('\n')}

    Which class should be the parent (rdfs:subClassOf)?
    Choose the most specific appropriate parent based on IS-A relationship.
    If none fit, return "owl:Thing".
    `;

    const result = await this.llmClient.query(prompt, {
      responseSchema: {
        type: 'object',
        properties: {
          parentClass: { type: 'string' },
          reasoning: { type: 'string' }
        }
      }
    });

    return result.data.parentClass;
  }

  async indexNewClasses(additions) {
    // Index classes in semantic search
    for (const triple of additions) {
      if (triple[1] === 'rdf:type' && triple[2] === 'owl:Class') {
        const classURI = triple[0];

        // Get label and description
        const labelTriples = additions.filter(t => t[0] === classURI && t[1] === 'rdfs:label');
        const commentTriples = additions.filter(t => t[0] === classURI && t[1] === 'rdfs:comment');

        const label = labelTriples[0]?.[2]?.replace(/"/g, '');
        const description = commentTriples[0]?.[2]?.replace(/"/g, '');

        await this.semanticSearch.insert('ontology-classes', {
          id: classURI,
          label,
          description
        });
      }
    }
  }

  mapToXSDType(type) {
    const typeMap = {
      'string': 'xsd:string',
      'number': 'xsd:decimal',
      'integer': 'xsd:integer',
      'boolean': 'xsd:boolean',
      'date': 'xsd:date'
    };
    return typeMap[type] || 'xsd:string';
  }
}
```

---

## Bootstrapping from Empty Ontology

The system works even with no prior ontology:

### First Sentence: "A pump is equipment that moves fluids"

**Phase 1 - QUERY:**
```
Ontology is empty → all mentions are gaps
```

**Phase 2 - GAP ANALYSIS:**
```
implied.classes: [
  { name: "Pump", description: "Equipment that moves fluids" },
  { name: "Equipment", description: "Industrial equipment" }
]
```

**Phase 3 - DECISION:**
```
No hierarchy exists yet → nothing to reuse
```

**Phase 4 - EXTENSION:**
```
determineParentClass("Pump") → "Equipment"
determineParentClass("Equipment") → "owl:Thing"

Add:
  kg:Equipment rdfs:subClassOf owl:Thing
  kg:Pump rdfs:subClassOf kg:Equipment
```

**Result:** Ontology now has 2 classes!

### Second Sentence: "The centrifugal pump operates at high pressure"

**Phase 1 - QUERY:**
```
"pump" → matches kg:Pump (0.95 similarity)
"centrifugal pump" → no match (gap)
```

**Phase 2 - GAP ANALYSIS:**
```
implied.classes: [{ name: "CentrifugalPump", description: "Pump using centrifugal force" }]
implied.properties: [{ name: "operatingPressure", domain: "Pump", type: "number" }]

Subsumption check:
- Does kg:Pump or ancestors have "operatingPressure"? → NO
```

**Phase 3 - DECISION:**
```
Nothing to reuse (no inherited properties)
```

**Phase 4 - EXTENSION:**
```
Add:
  kg:CentrifugalPump rdfs:subClassOf kg:Pump
  kg:operatingPressure rdfs:domain kg:Pump ; rdfs:range xsd:decimal
```

**Result:** Ontology now has 3 classes + 1 property!

---

## Integration with NLP System

The NLP system's `OntologyExtractor` is updated to query the incrementally-built ontology:

```javascript
// In @legion/nlp OntologyExtractor
async extractRelevantSchema(text) {
  // Query real ontology from triplestore (not hardcoded!)
  const ontologyBuilder = await this.getOntologyBuilder();

  // Process text to ensure ontology is up to date
  await ontologyBuilder.processText(text);

  // Query all classes
  const classes = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');

  // Load schema from RDF
  const schema = await this.loadSchemaFromRDF(classes);

  return schema;
}
```

---

## Technology Stack

- **LLM Integration:** TemplatedPrompt from @legion/prompting-manager
- **Storage:** @legion/rdf (SimpleTripleStore) - synchronous RDF operations
- **Semantic Search:** @legion/semantic-search (Qdrant + local embeddings)
- **Prompt Templates:** Handlebars (.hbs files)
- **RDF Format:** Turtle (.ttl) for human readability
- **Testing:** Jest with real LLM integration tests

---

## Success Criteria

1. **Bootstrapping**
   - ✅ Works with empty ontology (no prior knowledge required)
   - ✅ Creates root classes automatically (owl:Thing as fallback parent)
   - ✅ Builds hierarchy incrementally from first sentence

2. **Incremental Building**
   - ✅ Process text sentence-by-sentence
   - ✅ Query existing ontology with full hierarchy
   - ✅ Identify gaps (missing classes/properties/relationships)
   - ✅ Extend ontology only where needed
   - ✅ Annotate sentences with type metadata

3. **Subsumption Reasoning**
   - ✅ Traverse rdfs:subClassOf chains (ancestors and descendants)
   - ✅ Check property inheritance across hierarchy
   - ✅ Check relationship inheritance across hierarchy
   - ✅ Return inherited properties/relationships with distance
   - ✅ Avoid duplication by reusing inherited concepts

4. **LLM-Guided Decisions**
   - ✅ Determine parent class for new types
   - ✅ Decide when to reuse vs specialize
   - ✅ Extract type mentions from sentences
   - ✅ Extract implied types from sentences

5. **Quality**
   - ✅ 100% test pass rate
   - ✅ All tests use real LLM (no mocks)
   - ✅ Generated ontologies are valid OWL
   - ✅ Class hierarchies are cycle-free
   - ✅ No duplicate properties when inheritance exists
   - ✅ Specialization only when semantically justified

6. **Integration**
   - ✅ Uses @legion/rdf (SimpleTripleStore)
   - ✅ Uses @legion/semantic-search with hierarchical indexing
   - ✅ NLP system queries real ontology (not hardcoded)
   - ✅ Works as drop-in replacement for hardcoded schemas
