# NLP-to-KG Processing System Implementation Plan

## What We're Building
Transform natural language text into structured knowledge graph representations using the existing KG sibling package. Use LLMs guided by existing KG ontologies to extract entities and relationships, then validate with Gellish paraphrases.

**Core Innovation**: Use existing KG ontology as "schema guide" for LLMs to ensure ontological consistency.

## Architecture (from Design.md)
```
Text Input Layer → Ontology-Guided Pipeline → Knowledge Graph Constructor → Validation & Comparison
```

## Progress Tracking

**Overall Progress: 7/15 components completed (46.7%)**

### Phase 1: Core Infrastructure ✅ COMPLETED (4/4)
- [x] **TextPreprocessor** - UTF-8 normalization, structure detection
- [x] **LLMClient** - Standard LLM interface 
- [x] **OntologyExtractor** - Schema extraction from KG
- [x] **TripleGenerator** - Basic triple generation

### Phase 2: Text Input Layer ✅ COMPLETED (3/3)
- [x] **DocumentSegmenter** - Intelligent text segmentation
- [x] **Contextualizer** - Rich context building for segments ✅ NEW!
- [x] **Integration** - Text processing pipeline

### Phase 3: Entity Processing 📋 NEXT (0/3)
- [ ] **EntityRecognizer** - LLM-based entity extraction with schema guidance
- [ ] **AttributeMapper** - Property mapping and normalization  
- [ ] **EntityLinker** - Link entities to existing KG

### Phase 4: Relationship Processing 📋 PENDING (0/3)
- [ ] **RelationshipExtractor** - LLM-based relationship extraction
- [ ] **ContextualValidator** - Multi-dimensional validation
- [ ] **ConflictResolver** - Handle extraction conflicts

### Phase 5: Knowledge Graph Constructor 📋 PENDING (0/1)
- [ ] **QualityAssessment** - Quality and confidence assessment

### Phase 6: Validation & Comparison 📋 PENDING (0/4)
- [ ] **GellishParaphraser** - Integration with existing Gellish system
- [ ] **SemanticComparator** - Text-paraphrase comparison  
- [ ] **QualityMetrics** - Comprehensive quality measurement
- [ ] **FeedbackLoop** - Continuous improvement

## Next Priority: EntityRecognizer (Phase 3.1)

**Goal**: Implement LLM-based entity extraction with schema guidance from existing KG ontology.

**What it does**:
- Schema-guided entity extraction using LLM prompts
- Ontological consistency through existing KG schema
- Confidence scoring for extracted entities
- Integration with Contextualizer output for rich context

**Key Features**:
- Use existing KG ontology as "schema guide" for LLM prompts
- Extract entities conforming to predefined classes
- Provide confidence scores and validation
- Handle domain-specific entity types (industrial, medical, technical)

**Implementation Steps**:
1. Write Jest tests for EntityRecognizer
2. Implement LLM prompt engineering with schema injection
3. Add entity extraction with confidence scoring
4. Integrate with Contextualizer for rich context input
5. Add ontological validation against existing KG schema

## Key Integration with KG Package

```javascript
// Import from sibling KG package
import { KGEngine, GellishSystem } from '../KG/src/index.js'

// Triple Storage
kgEngine.addTriple(subject, predicate, object)

// Query for ontology
kgEngine.query(subject, predicate, object) // null for wildcards

// Gellish Integration  
gellishSystem.generateParaphrase(triples)
```

## Success Criteria

**Round-trip Validation**: Text → KG → Gellish → Comparison
- Extract entities conforming to existing KG ontology
- Identify relationships using ontological schemas  
- Generate Gellish paraphrases using existing system
- Compare original text with paraphrases for quality assessment

## Implementation Approach

- **TDD**: Write failing tests first, implement to pass
- **Incremental**: Complete one component at a time
- **Integration-First**: Seamless integration with existing KG package
- **Schema-Driven**: Use KG ontology to guide LLM extraction
