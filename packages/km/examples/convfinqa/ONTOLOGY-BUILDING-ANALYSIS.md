# Ontology Building Analysis - How It Works and Why Phase 7 Isn't Using It

## Executive Summary

**CRITICAL ISSUE IDENTIFIED**: Phase 7 uses hardcoded type strings (`'kg:FinancialValue'`) instead of ontology-derived classes.

**ROOT CAUSE**: We completely skipped the ontology building step in `build-kgs-10-examples.js`, loading only bootstrap ontology instead of building domain-specific financial ontology from the ConvFinQA text.

**CORRECT FLOW**:
1. Build ontology from `pre_text + table + post_text` → Creates `owl:Class` definitions for financial concepts
2. Extract ontology classes → `kg:Revenue`, `kg:NetIncome`, `kg:GrossMargin`, etc.
3. Map table data to ontology classes → "revenue" row → `kg:Revenue` class
4. Create instances using ontology types → Instance typed as `rdf:type kg:Revenue`, not generic `kg:FinancialMetric`

**CURRENT BROKEN FLOW**:
1. Load bootstrap only → Only 6 top-level classes exist
2. Skip domain ontology → No financial concepts defined
3. Use hardcoded strings → `type: 'kg:FinancialValue'` (string, not ontology class)
4. Create ad-hoc instances → No semantic reasoning capability

---

## What Ontology Building Actually Does

### 4-Phase Process (Per Sentence of Text)

The `OntologyBuilder.processText()` method analyzes each sentence through 4 phases:

#### Phase 1: QUERY - Find Relevant Types
**File**: `/ontology/src/services/OntologyQueryService.js`

```javascript
const existingTypes = await this.ontologyQuery.findRelevantTypesForSentence(
  sentence,
  this.llmClient
);
```

**Purpose**: Query existing ontology to find types relevant to the sentence
**Output**: Array of existing ontology classes that might match concepts in the sentence

#### Phase 2: GAP ANALYSIS - Identify Missing Concepts
**File**: `/ontology/src/services/GapAnalysisService.js`

```javascript
const gaps = await this.gapAnalysis.analyzeGaps(sentence, existingTypes);
```

**Process**:
1. **Extract implied types from sentence using LLM** (`extractImpliedTypes()`):
   - Identifies classes mentioned (e.g., "Revenue", "Net Income")
   - Identifies properties mentioned (e.g., "amount", "currency")
   - Identifies relationships (e.g., "hasMetric", "forPeriod")

2. **Compare with existing ontology**:
   - Which classes are missing?
   - Which properties can be reused via subsumption?
   - Which relationships need to be specialized?

**Output**:
```javascript
{
  missingClasses: [
    {
      name: "Revenue",
      suggestedSupertype: "PhysicalEntity",
      definition: "Total income from business operations",
      supertypeDescription: "...",
      usageDescription: "...",
      synonyms: "income, sales, receipts"
    }
  ],
  missingProperties: [
    { name: "hasAmount", domain: "Revenue", type: "decimal" }
  ],
  missingRelationships: [
    { name: "forPeriod", domain: "Revenue", range: "TimePeriod" }
  ],
  canReuseFromHierarchy: [...]
}
```

#### Phase 3: DECISION - Specialize or Reuse?
**File**: `/ontology/src/services/SpecializationDecisionService.js`

```javascript
for (const candidate of gaps.canReuseFromHierarchy) {
  const decision = await this.specializationDecision.decide(candidate);
  candidate.decision = decision;
}
```

**Purpose**: For properties/relationships that exist in parent classes, decide whether to:
- **REUSE**: Inherit from parent (e.g., reuse `kg:relatesTo`)
- **SPECIALIZE**: Create subproperty (e.g., `kg:hasMetric rdfs:subPropertyOf kg:relatesTo`)

**Output**: Each candidate gets a `decision.action` of `'REUSE'` or `'SPECIALIZE'`

#### Phase 4: EXTENSION - Add to Ontology
**File**: `/ontology/src/services/OntologyExtensionService.js`

```javascript
const extensions = await this.ontologyExtension.extendFromGaps(gaps, domain);
```

**Process**:
1. **Add missing classes** with multi-perspective descriptions:
```javascript
// For each missing class:
additions.push(
  ['kg:Revenue', 'rdf:type', 'owl:Class'],
  ['kg:Revenue', 'rdfs:label', '"Revenue"'],
  ['kg:Revenue', 'rdfs:subClassOf', 'kg:FinancialMetric'],  // ← Parent determined by LLM
  ['kg:Revenue', 'skos:definition', '"Total income from business operations"'],
  ['kg:Revenue', 'rdfs:comment', '"A financial metric representing revenue"'],
  ['kg:Revenue', 'skos:scopeNote', '"Used for measuring company performance"'],
  ['kg:Revenue', 'skos:altLabel', '"income, sales, receipts"']
);
```

2. **Add missing properties**:
```javascript
additions.push(
  ['kg:hasAmount', 'rdf:type', 'owl:DatatypeProperty'],
  ['kg:hasAmount', 'rdfs:domain', 'kg:Revenue'],
  ['kg:hasAmount', 'rdfs:range', 'xsd:decimal'],
  ['kg:hasAmount', 'rdfs:label', '"hasAmount"']
);
```

3. **Add missing relationships** with subsumption hierarchy:
```javascript
// Bootstrap top-level relationship if not exists
await this.bootstrapTopLevelRelationship(); // Creates kg:relatesTo

// Add specific relationship
additions.push(
  ['kg:forPeriod', 'rdf:type', 'owl:ObjectProperty'],
  ['kg:forPeriod', 'rdfs:subPropertyOf', 'kg:relatesTo'],  // ← Links to hierarchy
  ['kg:forPeriod', 'rdfs:domain', 'kg:Observation'],
  ['kg:forPeriod', 'rdfs:range', 'kg:TimePeriod'],
  ['kg:forPeriod', 'rdfs:label', '"forPeriod"'],
  ['kg:forPeriod', 'skos:definition', '"Links observation to time period"']
);
```

4. **Store in triple store**:
```javascript
for (const triple of additions) {
  await this.tripleStore.add(...triple);  // ← Actually creates RDF triples
}
```

5. **Index for semantic search**:
```javascript
await this.indexNewClasses(additions);
await this.indexNewRelationships(additions);
```

**Output**:
```javascript
{
  success: true,
  addedClasses: 4,        // kg:Revenue, kg:NetIncome, etc.
  addedProperties: 2,      // kg:hasAmount, etc.
  addedRelationships: 3,   // kg:forPeriod, kg:hasMetric, etc.
  reusedFromHierarchy: 1,
  specialized: 2
}
```

---

## What the Ontology Looks Like After Building

### Bootstrap Ontology (6 Classes)
**File**: `/ontology/src/bootstrap/upper-level-ontology.ttl`

```turtle
kg:Continuant rdf:type owl:Class .
kg:Occurrent rdf:type owl:Class .
kg:PhysicalEntity rdfs:subClassOf kg:Continuant .
kg:State rdfs:subClassOf kg:Occurrent .
kg:Process rdfs:subClassOf kg:Occurrent .
kg:Task rdfs:subClassOf kg:Process .
```

### Domain Ontology (What SHOULD Be Created from ConvFinQA Text)
**After processing pre_text + table + post_text**:

```turtle
# Financial Metrics
kg:FinancialMetric rdf:type owl:Class ;
    rdfs:subClassOf kg:State ;
    rdfs:label "FinancialMetric" ;
    skos:definition "A measurable financial indicator" .

kg:Revenue rdf:type owl:Class ;
    rdfs:subClassOf kg:FinancialMetric ;
    rdfs:label "Revenue" ;
    skos:definition "Total income from business operations" ;
    skos:altLabel "income, sales, receipts" .

kg:NetIncome rdf:type owl:Class ;
    rdfs:subClassOf kg:FinancialMetric ;
    rdfs:label "NetIncome" ;
    skos:definition "Profit after all expenses" .

# Financial Values
kg:FinancialValue rdf:type owl:Class ;
    rdfs:subClassOf kg:PhysicalEntity ;
    rdfs:label "FinancialValue" ;
    skos:definition "A monetary amount with currency and scale" .

# Time Periods
kg:TimePeriod rdf:type owl:Class ;
    rdfs:subClassOf kg:State ;
    rdfs:label "TimePeriod" ;
    skos:definition "A duration or point in time" .

# Observations
kg:Observation rdf:type owl:Class ;
    rdfs:subClassOf kg:State ;
    rdfs:label "Observation" ;
    skos:definition "A fact linking metric, period, and value" .

# Properties
kg:numericValue rdf:type owl:DatatypeProperty ;
    rdfs:domain kg:FinancialValue ;
    rdfs:range xsd:decimal ;
    rdfs:label "numericValue" .

kg:currency rdf:type owl:DatatypeProperty ;
    rdfs:domain kg:FinancialValue ;
    rdfs:range xsd:string ;
    rdfs:label "currency" .

# Relationships
kg:relatesTo rdf:type owl:ObjectProperty ;
    rdfs:domain owl:Thing ;
    rdfs:range owl:Thing ;
    rdfs:label "relatesTo" .

kg:hasMetric rdf:type owl:ObjectProperty ;
    rdfs:subPropertyOf kg:relatesTo ;
    rdfs:domain kg:Observation ;
    rdfs:range kg:FinancialMetric ;
    rdfs:label "hasMetric" .

kg:forPeriod rdf:type owl:ObjectProperty ;
    rdfs:subPropertyOf kg:relatesTo ;
    rdfs:domain kg:Observation ;
    rdfs:range kg:TimePeriod ;
    rdfs:label "forPeriod" .

kg:hasFinancialValue rdf:type owl:ObjectProperty ;
    rdfs:subPropertyOf kg:relatesTo ;
    rdfs:domain kg:Observation ;
    rdfs:range kg:FinancialValue ;
    rdfs:label "hasFinancialValue" .
```

**KEY POINT**: These classes are **RDF entities in the triple store**, not just hardcoded strings!

---

## How Phase 7 SHOULD Work With Ontology

### Current Broken Implementation
**File**: `/semantic-financial-kg/src/kg/TableProvenanceBuilder.js:219`

```javascript
buildTableEntity(tableData, metadata = {}) {
  return {
    uri: tableUri,
    type: 'kg:Table',  // ❌ HARDCODED STRING, not from ontology!
    label: caption || `Table from ${metadata.sourceDocument || 'unknown'}`,
    properties: {...}
  };
}
```

**File**: `/semantic-financial-kg/src/kg/ValueExtractor.js`

```javascript
buildFinancialValue(cellValue, metadata) {
  return {
    uri: valueUri,
    type: 'kg:FinancialValue',  // ❌ HARDCODED STRING!
    label: `${numericValue} ${currency}`,
    properties: {
      numericValue,
      actualAmount,
      currency,
      scale
    }
  };
}
```

**Result**: These types are **not linked to the ontology**. They're just strings that happen to match ontology URIs, but have no formal class definitions.

### Correct Implementation - Ontology-Driven Types

**Step 1**: Build ontology from ConvFinQA text
```javascript
// In build-kgs-10-examples.js
const ontologyBuilder = new OntologyBuilder({
  tripleStore,
  semanticSearch,
  llmClient
});

await ontologyBuilder.ensureBootstrapLoaded();

// ❌ CURRENT: We skip this!
// ✅ CORRECT: Build domain ontology from text
for (const example of examples) {
  const preText = Array.isArray(example.doc.pre_text)
    ? example.doc.pre_text.join(' ')
    : example.doc.pre_text;

  const postText = Array.isArray(example.doc.post_text)
    ? example.doc.post_text.join(' ')
    : example.doc.post_text;

  // Combine all text sources
  const combinedText = `${preText} ${postText}`;

  // Build ontology from combined text
  await ontologyBuilder.processText(combinedText, { domain: 'finance' });
}

// ✅ CORRECT: Also process table structure
await ontologyBuilder.processTable(example.doc.table, {
  domain: 'finance',
  context: [preText, postText]
});
```

**Step 2**: Extract ontology classes from triple store
```javascript
// Query ontology classes
const classes = await tripleStore.query(null, 'rdf:type', 'owl:Class');
const ontologyClasses = new Set();

for (const [classUri] of classes) {
  if (classUri.startsWith('kg:')) {
    ontologyClasses.add(classUri);
  }
}

// Now we have: kg:Revenue, kg:NetIncome, kg:FinancialValue, kg:Observation, etc.
```

**Step 3**: Map table data to ontology classes
```javascript
// In TableProvenanceBuilder or InstanceBuilder
async mapRowToOntologyClass(rowLabel, ontologyClasses, tripleStore) {
  // Find class with matching label or synonym
  for (const classUri of ontologyClasses) {
    const labels = await tripleStore.query(classUri, 'rdfs:label', null);
    const altLabels = await tripleStore.query(classUri, 'skos:altLabel', null);

    const label = labels[0]?.[2]?.replace(/"/g, '').toLowerCase();
    const altLabel = altLabels[0]?.[2]?.replace(/"/g, '').toLowerCase();

    if (label === rowLabel.toLowerCase() ||
        altLabel?.includes(rowLabel.toLowerCase())) {
      return classUri;  // ✅ Return kg:Revenue, not 'kg:FinancialMetric'
    }
  }

  return 'kg:FinancialMetric';  // Fallback to generic
}
```

**Step 4**: Create instances using ontology types
```javascript
// Build observation with SPECIFIC ontology class
const metricClass = await this.mapRowToOntologyClass(
  'revenue',
  ontologyClasses,
  tripleStore
);

// Create instance typed with ontology class
return {
  uri: obsUri,
  type: metricClass,  // ✅ 'kg:Revenue' (ontology class), not 'kg:FinancialMetric' (generic)
  label: `Revenue observation for 2008`,
  properties: {...}
};

// When stored in triple store:
await tripleStore.add(obsUri, 'rdf:type', 'kg:Revenue');  // ✅ Links to ontology!
```

---

## The Critical Difference

### What We're Doing Now (WRONG)
```javascript
// Instance triple
data:Obs_revenue_2008 rdf:type "kg:FinancialMetric"  // ❌ String literal!

// No class definition exists
// QUERY: kg:FinancialMetric rdf:type owl:Class
// RESULT: []  ← NOT FOUND!
```

### What We Should Be Doing (CORRECT)
```javascript
// Ontology definition (created by OntologyBuilder)
kg:Revenue rdf:type owl:Class .
kg:Revenue rdfs:subClassOf kg:FinancialMetric .
kg:Revenue rdfs:label "Revenue" .
kg:Revenue skos:altLabel "income, sales, receipts" .

// Instance triple (uses ontology class)
data:Obs_revenue_2008 rdf:type kg:Revenue .  // ✅ Links to ontology class!

// Now queries work:
// QUERY: kg:Revenue rdf:type owl:Class
// RESULT: [['kg:Revenue', 'rdf:type', 'owl:Class']]  ← FOUND!
```

---

## Why This Matters for Question Answering

### Without Proper Ontology Linkage
**Question**: "what were revenues in 2008?"

**Query Process**:
```javascript
// Must use exact string match
const metric = await tripleStore.query(
  null,
  'rdfs:label',
  '"revenue"'  // ❌ Exact match required
);

// No reasoning about synonyms
// "revenues" ≠ "revenue" ← FAILS!
// "sales" ≠ "revenue" ← FAILS!
```

### With Proper Ontology Linkage
**Question**: "what were sales in 2008?"

**Query Process**:
```javascript
// 1. Find ontology class by synonym
const classes = await tripleStore.query(null, 'rdf:type', 'owl:Class');
for (const [classUri] of classes) {
  const altLabels = await tripleStore.query(classUri, 'skos:altLabel', null);
  const synonyms = altLabels[0]?.[2]?.replace(/"/g, '').split(',');

  if (synonyms.includes('sales')) {
    // Found: kg:Revenue has altLabel "income, sales, receipts"
    metricClass = classUri;  // kg:Revenue
  }
}

// 2. Find instances of that class
const observations = await tripleStore.query(null, 'rdf:type', metricClass);

// ✅ "sales" → kg:Revenue → data:Obs_revenue_2008 → 9362.2
```

**Benefits**:
- ✅ Synonym matching via `skos:altLabel`
- ✅ Hierarchy reasoning via `rdfs:subClassOf`
- ✅ Semantic relationships via `owl:ObjectProperty`
- ✅ Type checking via `rdfs:domain` and `rdfs:range`

---

## What Needs to Be Fixed

### Fix 1: Build Ontology from Full Text (High Priority)
**File**: `/convfinqa/scripts/build-kgs-10-examples.js`

```javascript
// ❌ CURRENT
await ontologyBuilder.ensureBootstrapLoaded();  // Only bootstrap

// ✅ FIX
await ontologyBuilder.ensureBootstrapLoaded();

// Build ontology from each example's text
for (const example of examples) {
  const preText = Array.isArray(example.doc.pre_text)
    ? example.doc.pre_text.join(' ')
    : example.doc.pre_text;

  const postText = Array.isArray(example.doc.post_text)
    ? example.doc.post_text.join(' ')
    : example.doc.post_text;

  // Process all text to build ontology
  await ontologyBuilder.processText(`${preText} ${postText}`, {
    domain: 'finance'
  });

  // Process table structure to add metrics as classes
  await ontologyBuilder.processTable(example.doc.table, {
    domain: 'finance',
    context: [preText, postText]
  });
}
```

### Fix 2: Map Table Rows to Ontology Classes (High Priority)
**File**: `/semantic-financial-kg/src/kg/InstanceBuilder.js` (new method)

```javascript
async mapTableRowsToOntologyClasses(table, tripleStore) {
  const rowToClassMap = new Map();

  // Get all ontology classes
  const classTriples = await tripleStore.query(null, 'rdf:type', 'owl:Class');
  const ontologyClasses = classTriples
    .map(([uri]) => uri)
    .filter(uri => uri.startsWith('kg:'));

  // Map each table row to ontology class
  for (const [periodKey, values] of Object.entries(table)) {
    for (const metricLabel of Object.keys(values)) {
      // Find matching ontology class
      const classUri = await this.findMatchingClass(
        metricLabel,
        ontologyClasses,
        tripleStore
      );

      rowToClassMap.set(metricLabel, classUri);
    }
  }

  return rowToClassMap;
}

async findMatchingClass(label, ontologyClasses, tripleStore) {
  for (const classUri of ontologyClasses) {
    const labels = await tripleStore.query(classUri, 'rdfs:label', null);
    const altLabels = await tripleStore.query(classUri, 'skos:altLabel', null);

    const rdfsLabel = labels[0]?.[2]?.replace(/"/g, '').toLowerCase();
    const skosAltLabel = altLabels[0]?.[2]?.replace(/"/g, '').toLowerCase();

    if (rdfsLabel === label.toLowerCase() ||
        skosAltLabel?.split(',').map(s => s.trim()).includes(label.toLowerCase())) {
      return classUri;
    }
  }

  // Fallback to generic FinancialMetric
  return 'kg:FinancialMetric';
}
```

### Fix 3: Use Ontology Classes in Phase 7 (High Priority)
**File**: `/semantic-financial-kg/src/kg/InstanceBuilder.js`

```javascript
async createInstances(data) {
  // Build ontology-to-row mapping
  const rowToClassMap = await this.mapTableRowsToOntologyClasses(
    data.table,
    this.tripleStore
  );

  // Pass mapping to TableProvenanceBuilder
  const tableBuilder = new TableProvenanceBuilder(this.tripleStore);
  const result = await tableBuilder.buildFromTable(data.table, {
    ...data.metadata,
    rowToClassMap  // ✅ Pass ontology mapping
  });

  return result;
}
```

**File**: `/semantic-financial-kg/src/kg/TableProvenanceBuilder.js`

```javascript
buildObservation(metricLabel, periodLabel, cellValue, metadata) {
  // ❌ CURRENT
  const type = 'kg:Observation';  // Generic

  // ✅ FIX: Use ontology class from mapping
  const metricClass = metadata.rowToClassMap?.get(metricLabel) || 'kg:FinancialMetric';

  return {
    uri: obsUri,
    type: metricClass,  // ✅ kg:Revenue, not kg:FinancialMetric!
    label: `${metricLabel} for ${periodLabel}`,
    properties: {...}
  };
}
```

---

## Timeline and Priority

### Immediate (Critical)
1. ✅ **Understand ontology building process** - DONE (this document)
2. ⬜ **Fix ontology building in build-kgs-10-examples.js** - Add processText() calls
3. ⬜ **Verify ontology classes are created** - Run inspect-triples.js after fix
4. ⬜ **Add row-to-class mapping logic** - Implement findMatchingClass()

### Short Term (High)
1. ⬜ **Integrate mapping with Phase 7** - Pass rowToClassMap through pipeline
2. ⬜ **Test on 1 example first** - Verify correct ontology linkage
3. ⬜ **Run on all 10 examples** - Ensure robustness

### Long Term (Medium)
1. ⬜ **Fix LLM JSON parsing errors** - Make ontology building robust
2. ⬜ **Add automatic concept extraction** - NLP layer for question → concepts
3. ⬜ **Build semantic query layer** - Use ontology for reasoning

---

## Files to Modify

### 1. `/convfinqa/scripts/build-kgs-10-examples.js`
**Change**: Add ontology building from text before KG creation

### 2. `/semantic-financial-kg/src/kg/InstanceBuilder.js`
**Add**: `mapTableRowsToOntologyClasses()` method
**Add**: `findMatchingClass()` method
**Change**: Pass `rowToClassMap` to TableProvenanceBuilder

### 3. `/semantic-financial-kg/src/kg/TableProvenanceBuilder.js`
**Change**: Use `metadata.rowToClassMap` to get ontology classes instead of hardcoded types

---

## Expected Output After Fix

### Before Fix (Current State)
```bash
$ node scripts/inspect-triples.js

ONTOLOGY CLASSES
Total ontology classes: 6

kg:Continuant
  Label: Continuant
  Instances: 0

kg:PhysicalEntity
  Label: PhysicalEntity
  Instances: 0

# ... only bootstrap classes

Ontology Linkage Check:
  kg:hasMetric used 8 times
  kg:hasMetric defined in ontology: NO  ❌
  kg:numericValue used 8 times
  kg:numericValue defined in ontology: NO  ❌
```

### After Fix (Expected)
```bash
$ node scripts/inspect-triples.js

ONTOLOGY CLASSES
Total ontology classes: 35

kg:FinancialMetric
  Label: FinancialMetric
  Superclass: kg:State
  Instances: 0

kg:Revenue
  Label: Revenue
  Superclass: kg:FinancialMetric
  Instances: 8  ✅

kg:NetIncome
  Label: Net Income
  Superclass: kg:FinancialMetric
  Instances: 8  ✅

kg:FinancialValue
  Label: FinancialValue
  Superclass: kg:PhysicalEntity
  Instances: 8  ✅

kg:Observation
  Label: Observation
  Superclass: kg:State
  Instances: 8  ✅

# ... more domain classes

ONTOLOGY PROPERTIES
Object Properties: 5

kg:hasMetric
  Label: hasMetric
  Domain: kg:Observation
  Range: kg:FinancialMetric

Datatype Properties: 6

kg:numericValue
  Label: numericValue
  Domain: kg:FinancialValue
  Range: xsd:decimal

Ontology Linkage Check:
  kg:hasMetric used 8 times
  kg:hasMetric defined in ontology: YES  ✅
  kg:numericValue used 8 times
  kg:numericValue defined in ontology: YES  ✅
```

---

## Conclusion

**The ontology building process is sophisticated and working correctly**:
- 4-phase LLM-driven analysis (Query → Gap → Decision → Extension)
- Creates proper `owl:Class` definitions with `rdfs:subClassOf` hierarchy
- Adds properties with `rdfs:domain` and `rdfs:range` constraints
- Indexes classes in semantic search for synonym matching

**The problem is NOT the ontology builder - it's that we're not using it**:
- We load only bootstrap (6 classes) instead of building domain ontology
- Phase 7 uses hardcoded type strings instead of querying ontology
- No mapping from table rows to ontology classes
- Instances have no semantic linkage to formal ontology

**The fix is straightforward**:
1. Build ontology from `pre_text + table + post_text` (1 line change)
2. Map table rows to ontology classes (new method, ~50 lines)
3. Use ontology classes in Phase 7 (change 3 hardcoded strings)

**This will enable true semantic question answering** with reasoning about synonyms, hierarchies, and relationships.

---

*Generated: 2025-10-07*
*Based on analysis of OntologyBuilder.js, GapAnalysisService.js, OntologyExtensionService.js*
*Next step: Implement Fix 1 in build-kgs-10-examples.js*
