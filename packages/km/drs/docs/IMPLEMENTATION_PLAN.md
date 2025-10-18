# DRS Package - Implementation Plan

## Overview

This plan implements the DRS (Discourse Representation Structure) package using Test-Driven Development (TDD) without refactor steps. The implementation follows natural dependency order, with each phase delivering demonstrable value. All implementation details are in DESIGN.md - this plan provides execution structure only.

## Approach

### TDD Process (No Refactor Step)
1. Write test first (unit or integration as appropriate)
2. Implement minimum code to pass test
3. All tests must pass before proceeding
4. Get it right the first time - no refactor phase

### Dependency Order (80/20 Rule)
- Core infrastructure first (types, validators, schemas)
- Deterministic stages before LLM stages
- Build up complexity incrementally
- Each phase delivers working, testable functionality

### Testing Requirements
- **Unit Tests**: Mocks allowed for LLM responses and peripheral dependencies
- **Integration Tests**: NO MOCKS for main functionality (LLM, MongoDB, Qdrant, Semantic Inventory)
- **Integration Tests**: Mocks only for truly peripheral concerns (if any)
- **End-to-End Tests**: Real LLM, real MongoDB, real Qdrant, real Semantic Inventory
- **All resources available**: Real API keys in .env, local MongoDB, local Qdrant
- **NO FALLBACKS**: Fail fast if resources unavailable
- **NO SKIPPING**: All tests must pass

### MVP Focus
This plan implements functional correctness only. Out of scope:
- Security hardening
- Performance optimization
- Migration strategies
- Documentation (beyond code comments)
- Publishing/deployment
- NFRs (Non-Functional Requirements)

All testing will be local - no deployment or publishing steps.

---

## Phase 0: Package Setup & Core Data Structures

[] **Phase 0 Complete**

### Steps

[] **Step 0.1: Reread DESIGN.md** - Review "Data Model" and "Core Types" sections

[] **Step 0.2: Package Initialization**
- Create package.json with workspace dependencies
- Configure Jest for ES6 modules
- Add test scripts (test, test:unit, test:integration)
- Create directory structure: src/, __tests__/unit/, __tests__/integration/, prompts/, schemas/
- Reference DESIGN.md "Dependencies" section for package list

[] **Step 0.3: Core Type Definitions**
- Create src/types/Span.js
- Create src/types/Mention.js
- Create src/types/Entity.js
- Create src/types/Event.js
- Create src/types/UnaryFact.js
- Create src/types/BinaryFact.js
- Create src/types/DiscourseMemory.js
- Create src/types/ScopePlan.js
- Create src/types/ClausalDRS.js
- Create src/types/RelationInventory.js
- Reference DESIGN.md "Core Types" section for structure

[] **Step 0.4: Unit Tests for Core Types**
- Write tests: __tests__/unit/types.test.js
- Test object creation and validation for each type
- All tests must pass

[] **Step 0.5: Error Classes**
- Create src/errors/ValidationError.js
- Unit test: __tests__/unit/errors.test.js
- Reference DESIGN.md "Error Handling" section

---

## Phase 1: Validators & JSON Schemas

[] **Phase 1 Complete**

### Steps

[] **Step 1.1: Reread DESIGN.md** - Review "JSON Schemas" and "Validators" sections

[] **Step 1.2: JSON Schema Definitions**
- Create schemas/MentionSchema.json
- Create schemas/CorefSchema.json
- Create schemas/EventsSchema.json
- Create schemas/ScopeSchema.json
- Create schemas/ClausalDRSSchema.json
- Reference DESIGN.md "JSON Schemas" section for exact structure
- Use @legion/schema package for validation (NO Zod)

[] **Step 1.3: MentionValidator**
- Write test: __tests__/unit/MentionValidator.test.js
- Implement src/validators/MentionValidator.js
- Test span validation, type validation, sentence bounds
- Reference DESIGN.md "Stage 1: Mention Extraction" validation rules
- All tests must pass

[] **Step 1.4: EntityValidator**
- Write test: __tests__/unit/EntityValidator.test.js
- Implement src/validators/EntityValidator.js
- Test disjoint mentions, valid types, gender/number
- Reference DESIGN.md "Stage 2: Coreference Resolution" validation rules
- All tests must pass

[] **Step 1.5: EventValidator**
- Write test: __tests__/unit/EventValidator.test.js
- Implement src/validators/EventValidator.js
- Test role names, role targets, arity, predicates, relations
- Reference DESIGN.md "Stage 3: Event & Relation Extraction" validation rules
- All tests must pass

[] **Step 1.6: ScopeValidator**
- Write test: __tests__/unit/ScopeValidator.test.js
- Implement src/validators/ScopeValidator.js
- Test box references, variable references, structural well-formedness
- Reference DESIGN.md "Stage 4: Quantification & Scope Planning" validation rules
- All tests must pass

[] **Step 1.7: DRSValidator**
- Write test: __tests__/unit/DRSValidator.test.js
- Implement src/validators/DRSValidator.js
- Test unique referents, bound arguments, arity, scope structure
- Reference DESIGN.md "Stage 6: DRS Validation" validation rules
- All tests must pass

---

## Phase 2: Stage 0 - Discourse Memory Initialization

[] **Phase 2 Complete**

### Steps

[] **Step 2.1: Reread DESIGN.md** - Review "Stage 0: Discourse Memory Initialization" section

[] **Step 2.2: Sentence Splitter**
- Write test: __tests__/unit/SentenceSplitter.test.js
- Implement src/utils/SentenceSplitter.js
- Test simple sentences, multi-sentence text, edge cases
- May use 'natural' package or simple regex
- All tests must pass

[] **Step 2.3: Stage0_MemoryInit**
- Write test: __tests__/unit/Stage0_MemoryInit.test.js
- Implement src/stages/Stage0_MemoryInit.js
- Test DiscourseMemory creation from raw text
- Deterministic (no LLM)
- All tests must pass

[] **Step 2.4: Integration Test**
- Write test: __tests__/integration/stage0.test.js
- Test with various text inputs
- Verify sentence splitting and memory structure
- All tests must pass

**Deliverable:** Can initialize discourse memory from raw text

---

## Phase 3: Semantic Inventory Integration

[] **Phase 3 Complete**

### Steps

[] **Step 3.1: Reread DESIGN.md** - Review "Semantic Inventory Service" section

[] **Step 3.2: Semantic Inventory Wrapper**
- Write test: __tests__/integration/semantic-inventory.test.js
- Create src/services/SemanticInventoryAdapter.js (thin wrapper if needed)
- Test integration with @legion/semantic-inventory
- Use REAL semantic inventory (NO MOCKS in integration test)
- Verify semanticSearchEntityTypes returns entity type strings
- Verify semanticSearchRelationTypes returns RelationInventory
- Reference DESIGN.md "Semantic Inventory Service" for API signatures
- All tests must pass

[] **Step 3.3: Test Data Validation**
- Test that returned entity types are reasonable (PERSON, LOCATION, etc.)
- Test that returned roles are reasonable (Agent, Theme, etc.)
- Test that returned predicates and relations are reasonable
- All tests must pass

**Deliverable:** Can query semantic inventory for entity types and relation types

---

## Phase 4: Stage 1 - Mention Extraction

[] **Phase 4 Complete**

### Steps

[] **Step 4.1: Reread DESIGN.md** - Review "Stage 1: Mention Extraction" section

[] **Step 4.2: Prompt Template**
- Create prompts/mention-extraction.hbs
- Use Handlebars syntax
- Reference DESIGN.md "Prompt Templates" section for structure
- Include placeholders for text, allowedTypes, schema

[] **Step 4.3: Stage1_MentionExtraction (Unit Tests with Mocked LLM)**
- Write test: __tests__/unit/Stage1_MentionExtraction.test.js
- Mock LLM responses (valid and invalid)
- Implement src/stages/Stage1_MentionExtraction.js
- Test mention extraction with valid LLM output
- Test validation failure handling
- Test repair loop (one attempt)
- Mocks allowed in unit tests
- All tests must pass

[] **Step 4.4: LLM Integration Helper**
- Implement src/utils/LLMHelper.js (or integrate directly in stage)
- Use @legion/llm-client with TemplatedPrompt
- Reference DESIGN.md "Constrained Decoding & Repair" section
- Support structured output with JSON schema
- Support repair loop with error feedback

[] **Step 4.5: Integration Test with Real LLM**
- Write test: __tests__/integration/stage1.test.js
- Use REAL LLM (NO MOCKS)
- Use REAL semantic inventory
- Test mention extraction on simple sentences
- Test validation and repair with real LLM responses
- Example: "The cat sat on the mat."
- Verify mentions have correct spans and types
- All tests must pass

**Deliverable:** Can extract mentions from text with real LLM, validation, and repair

---

## Phase 5: Stage 2 - Coreference Resolution

[] **Phase 5 Complete**

### Steps

[] **Step 5.1: Reread DESIGN.md** - Review "Stage 2: Coreference Resolution & Canonicalization" section

[] **Step 5.2: Prompt Template**
- Create prompts/coreference.hbs
- Reference DESIGN.md "Prompt Templates" section

[] **Step 5.3: Stage2_CoreferenceResolution (Unit Tests with Mocked LLM)**
- Write test: __tests__/unit/Stage2_CoreferenceResolution.test.js
- Mock LLM responses
- Implement src/stages/Stage2_CoreferenceResolution.js
- Test entity clustering
- Test mention disjointness validation
- Test entity ID assignment
- All tests must pass

[] **Step 5.4: Integration Test with Real LLM**
- Write test: __tests__/integration/stage2.test.js
- Use REAL LLM (NO MOCKS)
- Build on Stage 1 output (real mentions)
- Test coreference on examples with pronouns
- Example: "John met Mary. She smiled." → 2 entities
- Verify entity canonical names and mention clusters
- All tests must pass

**Deliverable:** Can resolve coreferences and create canonical entities with real LLM

---

## Phase 6: Stage 3 - Event & Relation Extraction

[] **Phase 6 Complete**

### Steps

[] **Step 6.1: Reread DESIGN.md** - Review "Stage 3: Event & Relation Extraction" section

[] **Step 6.2: Prompt Template**
- Create prompts/event-extraction.hbs
- Reference DESIGN.md "Prompt Templates" section

[] **Step 6.3: Stage3_EventExtraction (Unit Tests with Mocked LLM)**
- Write test: __tests__/unit/Stage3_EventExtraction.test.js
- Mock LLM responses
- Implement src/stages/Stage3_EventExtraction.js
- Test event extraction with roles
- Test unary fact extraction
- Test binary relation extraction
- Test validation (role names, predicates, arity)
- All tests must pass

[] **Step 6.4: Integration Test with Real LLM**
- Write test: __tests__/integration/stage3.test.js
- Use REAL LLM (NO MOCKS)
- Use REAL semantic inventory for roles/predicates/relations
- Build on Stage 2 output (real entities)
- Test event extraction on action sentences
- Example: "Alice read a book."
- Verify events have correct lemma, tense, roles
- Verify unary and binary facts
- All tests must pass

**Deliverable:** Can extract events, roles, and facts with real LLM and semantic inventory

---

## Phase 7: Stage 4 - Quantification & Scope Planning

[] **Phase 7 Complete**

### Steps

[] **Step 7.1: Reread DESIGN.md** - Review "Stage 4: Quantification & Scope Planning" section

[] **Step 7.2: Prompt Template**
- Create prompts/scope-planning.hbs
- Reference DESIGN.md "Prompt Templates" section

[] **Step 7.3: Stage4_ScopePlanning (Unit Tests with Mocked LLM)**
- Write test: __tests__/unit/Stage4_ScopePlanning.test.js
- Mock LLM responses
- Implement src/stages/Stage4_ScopePlanning.js
- Test scope operator creation (Some, Every, Not, If, Or)
- Test box assignment
- Test validation
- All tests must pass

[] **Step 7.4: Integration Test with Real LLM**
- Write test: __tests__/integration/stage4.test.js
- Use REAL LLM (NO MOCKS)
- Build on Stage 3 output (real events and entities)
- Test quantifier scope on examples
- Example: "Every student read a book."
- Verify scope plan has correct boxes and operators
- All tests must pass

**Deliverable:** Can plan quantifier scope with real LLM

---

## Phase 8: Stages 5 & 6 - DRS Builder & Validation

[] **Phase 8 Complete**

### Steps

[] **Step 8.1: Reread DESIGN.md** - Review "Stage 5: Deterministic DRS Builder" and "Stage 6: DRS Validation" sections

[] **Step 8.2: Stage5_DRSBuilder (Unit Tests)**
- Write test: __tests__/unit/Stage5_DRSBuilder.test.js
- Implement src/stages/Stage5_DRSBuilder.js
- Deterministic (no LLM)
- Test referent collection
- Test type predicate addition
- Test attribute predicate addition
- Test event predicate addition
- Test role relation addition
- Test binary relation addition
- Test scope operator translation
- All tests must pass

[] **Step 8.3: Stage6_DRSValidation (Unit Tests)**
- Write test: __tests__/unit/Stage6_DRSValidation.test.js
- Implement src/stages/Stage6_DRSValidation.js
- Test unique referents
- Test bound arguments
- Test allowed formats
- Test role arity
- Test scope structure
- All tests must pass

[] **Step 8.4: Integration Test for Stages 5 & 6**
- Write test: __tests__/integration/stages5-6.test.js
- Build on Stage 4 output (real scope plan)
- Test deterministic DRS building
- Test DRS validation
- Verify ClausalDRS structure
- All tests must pass

**Deliverable:** Can build and validate ClausalDRS from discourse memory and scope plan

---

## Phase 9: DRS Orchestrator & End-to-End Integration

[] **Phase 9 Complete**

### Steps

[] **Step 9.1: Reread DESIGN.md** - Review "DRSOrchestrator" API and "Example End-to-End" sections

[] **Step 9.2: DRSOrchestrator Implementation**
- Write test: __tests__/unit/DRSOrchestrator.test.js (with mocked stages)
- Implement src/DRSOrchestrator.js
- Test stage sequencing
- Test error propagation
- Test result aggregation
- Reference DESIGN.md "API Reference" for DRSResult structure
- All tests must pass

[] **Step 9.3: Package Entry Point**
- Create src/index.js
- Export DRSOrchestrator
- Export all validators
- Export all types

[] **Step 9.4: End-to-End Integration Tests**
- Write test: __tests__/integration/end-to-end.test.js
- Use REAL LLM (NO MOCKS)
- Use REAL semantic inventory
- Test complete pipeline on examples from DESIGN.md
- Test case 1: "Alice reads." (simple sentence)
- Test case 2: "Every student read a book." (quantifiers)
- Test case 3: "John met Mary. She smiled." (coreference)
- Test case 4: "Alice did not read the book." (negation)
- Test case 5: "If it rains, Alice stays home." (conditional)
- Verify complete ClausalDRS structure for each
- All tests must pass

[] **Step 9.5: Run Full Test Suite**
- Execute npm test (all tests)
- Verify all unit tests pass
- Verify all integration tests pass
- Verify all end-to-end tests pass
- NO SKIPPING, NO FALLBACKS
- All tests must pass before marking phase complete

**Deliverable:** Complete working DRS pipeline with end-to-end validation

---

## Completion Criteria

All phases marked complete [] → [✓]
All tests passing (unit, integration, end-to-end)
Can transform natural language to ClausalDRS using real LLM and semantic inventory
Ready for use in downstream applications

---

**Plan Version:** 1.0
**Created:** 2025-10-18
**Based on:** DESIGN.md v1.1
