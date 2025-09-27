# Goal Planner Implementation Plan (MVP)

## Overview

This plan implements the Goal Planner using Test-Driven Development (TDD) without refactoring phases. Each phase delivers working, tested functionality following the dependency order: verb mapping → SOP adaptation → applicability judgment → vanilla fallback → orchestration.

The approach follows the 80/20 rule: build core mechanisms first (SOP adaptation), then add fallback (vanilla planning). Each phase produces demonstrable value with comprehensive tests.

## Approach

1. **Bottom-up implementation**: Build utilities (VerbMapper) first, then adapters, then orchestrator
2. **TDD without refactor**: Write test, implement to pass, move on (get it right first time)
3. **Real dependencies only**: Use actual SOPRegistry, DecentPlanner, LLM in all tests
4. **Fail-fast everywhere**: NO fallbacks, NO mocks in implementation, NO skipping
5. **Sequential phases**: Complete phase N before starting N+1
6. **Comprehensive testing**: Unit → Integration → End-to-end at each phase

## Rules

### Testing Rules
- **Unit tests**: May mock peripheral dependencies, NEVER mock core functionality
- **Integration tests**: NO MOCKS for main functionality, only for incidental peripherals
- **All tests**: Use real SOPRegistry, real DecentPlanner, real LLM client
- **NO skipping**: Every test must pass or be deleted
- **NO fallbacks**: Tests fail fast if resources unavailable
- **Jest configuration**: ES6 modules, sequential execution (`--runInBand`)
- **Test location**: All in `__tests__/` directory (unit/ and integration/ subdirectories)

### Implementation Rules
- **NO MOCKS** in implementation code ever
- **NO FALLBACKS** in implementation code
- **FAIL FAST** on missing dependencies or errors
- **ResourceManager ONLY** for all env vars and services
- **Singleton pattern** for GoalPlanner
- **Clean Architecture**: Single responsibility per class
- **ES6 modules**: Import/export throughout
- **No comments** unless explicitly needed

### Progress Tracking
- **ONLY** use checkboxes [ ] in this document
- **NO OTHER** progress tracking (no inline comments, no separate files)
- Mark [✓] when step complete
- Mark [✓] when phase complete

---

## Phase 1: Foundation - Verb Mapping [✓]

**Goal**: Deterministic verb → predicate mapping with doneWhen generation.

**Deliverable**: Working VerbMapper utility that converts action verbs to predicates and conditions.

### Steps

[✓] 1.1 Read DESIGN.md sections 6, 8.3

[✓] 1.2 Create package structure and package.json with dependencies

[✓] 1.3 Create error classes (GoalPlannerError, SOPAdaptationError, ApplicabilityJudgmentError, VanillaPlanningError)

[✓] 1.4 Write VerbMapper.test.js unit tests:
- Verb extraction from step glosses
- Predicate creation for each verb type (gather, search, confirm, etc.)
- DoneWhen condition generation
- Tool argument inclusion for use_tool predicates
- Edge cases (unknown verbs, empty strings, multi-word verbs)

[✓] 1.5 Implement VerbMapper.js to pass all tests:
- VERB_MAPPINGS table (DESIGN.md section 6.1)
- extractVerb() with first/second word heuristic
- createPredicate() with tool argument handling
- createDoneWhen() based on verb semantics

[✓] 1.6 Run tests and verify 100% pass rate

---

## Phase 2: SOP Adaptation - Steps to Subgoals [✓]

**Goal**: Convert SOP documents into executable subgoal decompositions.

**Deliverable**: Working SOPAdapter that maps SOP steps to subgoals with provenance.

### Steps

[✓] 2.1 Read DESIGN.md sections 8, 11.2

[✓] 2.2 Write SOPAdapter.test.js unit tests:
- Parameter extraction from SOP
- Gather subgoal generation for missing parameters
- Step to subgoal mapping with VerbMapper
- Tool predicate creation from suggestedTools
- DoneWhen condition creation
- Provenance attachment
- Complete SOP adaptation flow

[✓] 2.3 Implement SOPAdapter.js to pass all tests:
- extractParameters() identifies required vs available
- createGatherSubgoals() for missing inputs
- mapStepToSubgoal() using VerbMapper
- adaptSOPToSubgoals() orchestrates full adaptation
- Uses real SOPRegistry for SOP retrieval in tests

[✓] 2.4 Run tests and verify 100% pass rate

[✓] 2.5 Write SOPAdapter integration test:
- Load real SOP from SOPRegistry
- Adapt complete train-booking SOP
- Verify all subgoals created
- Verify provenance metadata
- Verify gather subgoals prepended

[✓] 2.6 Run integration test and verify pass

---

## Phase 3: Applicability Judgment - SOP Suitability [✓]

**Goal**: LLM-based assessment of SOP applicability to goals.

**Deliverable**: Working ApplicabilityJudge with real LLM evaluation.

### Steps

[✓] 3.1 Read DESIGN.md sections 5.3, 5.5, 11.3

[✓] 3.2 Write ApplicabilityJudge.test.js unit tests:
- Initialize with ResourceManager
- Create judgment prompt
- Parse LLM response
- Intent matching evaluation
- Prerequisite checking
- Parameter availability assessment
- Confidence scoring
- Missing prerequisites identification

[✓] 3.3 Implement ApplicabilityJudge.js to pass all tests:
- Get LLMClient from ResourceManager
- Create structured prompt (DESIGN.md section 5.2)
- Parse JSON response
- Return judgment with confidence, reasoning, missing items
- Use real LLM in tests

[✓] 3.4 Run tests and verify 100% pass rate (real LLM)

[✓] 3.5 Write ApplicabilityJudge integration test:
- Judge multiple real SOPs against different goals
- Verify high confidence for good matches
- Verify low confidence for poor matches
- Verify missing prerequisites detected
- Test with varying context availability

[✓] 3.6 Run integration test and verify pass

---

## Phase 4: Vanilla Planning - Simple LLM Decomposition [✓]

**Goal**: Simple LLM-based fallback decomposition when no SOP fits.

**Deliverable**: Working VanillaAdapter with TemplatedPrompt (no DecentPlanner).

### Steps

[✓] 4.1 Read DESIGN.md section 9

[✓] 4.2 Write VanillaAdapter.test.js unit tests:
- Initialize with ResourceManager
- TemplatedPrompt schema validation
- Generate evidence keys from step text
- Complete decomposition with real LLM
- Verify all subgoals have required fields
- Test various goal types

[✓] 4.3 Implement VanillaAdapter.js to pass all tests:
- Get LLMClient from ResourceManager
- Create TemplatedPrompt with steps array schema
- Prompt template requesting 3-5 steps
- Execute templatedPrompt.execute() with goal variables
- Convert result.data.steps to subgoals
- generateEvidenceKey() - camelCase from step text
- Use real LLM in tests

[✓] 4.4 Run tests and verify 100% pass rate - 9/9 passing

[✓] 4.5 Write VanillaAdapter integration test:
- Decompose various goals with real LLM
- Verify 3-5 steps generated
- Verify subgoal structure
- Verify evidence keys unique
- Test different goal types

[✓] 4.6 Run integration test and verify pass

---

## Phase 5: Orchestration - GoalPlanner Assembly [✓]

**Goal**: Complete GoalPlanner singleton that orchestrates SOP vs vanilla decision.

**Deliverable**: Production-ready planner with full decision logic.

### Steps

[✓] 5.1 Read DESIGN.md sections 3.1, 4, 11.1

[✓] 5.2 Write GoalPlanner.test.js unit tests:
- Singleton pattern enforcement
- getInstance() returns same instance
- Component initialization
- SOP candidate retrieval via SOPRegistry
- Applicability judgment integration
- SOP vs vanilla decision logic (0.7 threshold)
- Plan structure creation
- Statistics tracking
- Health check

[✓] 5.3 Implement GoalPlanner.js to pass all tests:
- Singleton pattern (NO direct instantiation)
- Initialize all components (SOPRegistry, DecentPlanner, adapters, judge)
- retrieveSOPCandidates() using SOPRegistry.searchSOPs()
- judgeApplicability() for each candidate
- Decision logic: confidence ≥ 0.7 → SOP, else vanilla
- Delegate to SOPAdapter or VanillaAdapter
- Return structured Plan
- Track statistics

[✓] 5.4 Run tests and verify 100% pass rate

[✓] 5.5 Create src/index.js with default export

---

## Phase 6: End-to-End Integration [✓]

**Goal**: Complete pipeline working with both SOP and vanilla paths.

**Deliverable**: Proven working system for both planning modes.

### Steps

[✓] 6.1 Read DESIGN.md sections 10, 20

[✓] 6.2 Write FullPipeline.test.js integration test:
- Get GoalPlanner singleton
- Test SOP-based planning (train booking example)
- Verify SOP retrieval works
- Verify applicability judgment returns high confidence
- Verify subgoals contain provenance
- Verify gather subgoals created for missing params
- Test edge cases (empty evidence, partial matches)

[✓] 6.3 Run integration test and verify pass

[✓] 6.4 Create examples/sop-based-example.js demonstrating:
- Initialize GoalPlanner
- Plan goal that matches SOP
- Show resulting subgoals with provenance
- Display statistics

[✓] 6.5 Create examples/vanilla-example.js demonstrating:
- Plan goal with no SOP match
- Show vanilla decomposition
- Display subgoals from DecentPlanner

[✓] 6.6 Run both examples and verify output

[✓] 6.7 Full regression: Run ALL tests sequentially

[✓] 6.8 Verify 100% pass rate across all tests - 63/63 passing

---

## Phase 7: SOP-Based Planning Scenarios [✓]

**Goal**: Test comprehensive SOP-based planning scenarios.

**Deliverable**: Validated SOP planning with various real SOPs.

### Steps

[✓] 7.1 Write SOPBasedPlanning.test.js integration test:
- Plan with train-booking SOP
- Plan with file-operations SOP
- Plan with api-authentication SOP
- Verify each produces correct subgoals
- Verify tool suggestions preserved
- Verify doneWhen conditions appropriate
- Verify parameter gathering works
- Test with partial evidence (some params available)

[✓] 7.2 Run integration test and verify pass

[✓] 7.3 Add SOP scenario examples to examples/

[✓] 7.4 Run examples and verify correctness

[✓] 7.5 Full regression: Run ALL tests

---

## Phase 8: Vanilla Planning Scenarios [✓]

**Goal**: Test comprehensive vanilla planning fallback with simple LLM decomposition.

**Deliverable**: Validated vanilla planning for non-SOP goals.

### Steps

[✓] 8.1 Write VanillaPlanning.test.js integration test:
- Plan goals with no SOP match
- Verify LLM decomposition called
- Verify 3-5 steps generated
- Verify subgoal quality
- Test various goal types (technical, creative, analytical)

[✓] 8.2 Run integration test and verify pass

[✓] 8.3 Test end-to-end vanilla path in GoalPlanner:
- Goal with no matching SOP
- Falls back to vanilla
- Returns valid plan with source='vanilla'

[✓] 8.4 Add vanilla scenario examples to examples/

[✓] 8.5 Full regression: Run ALL tests

---

## Phase 9: Final Validation [✓]

**Goal**: Confirm complete system functionality and test coverage.

**Deliverable**: Production-ready Goal Planner with all SOP-based tests passing.

### Steps

[✓] 9.1 Run complete test suite sequentially: `npm test`

[✓] 9.2 Verify 100% pass rate (no skips, no failures) - 74/74 tests passing

[✓] 9.3 Run all examples and verify output

[✓] 9.4 Run health check and verify all dependencies available

[✓] 9.5 Get statistics and verify accuracy

[✓] 9.6 Manual smoke test:
- Plan "book train to Paris" → verify SOP-based ✅
- Check provenance metadata present in SOP plans ✅
- Check gather subgoals generated when params missing ✅
- Verify confidence scores reasonable ✅

[✓] 9.7 Review DESIGN.md and verify all in-scope features implemented

[✓] 9.8 Write README.md with usage examples

[✓] 9.9 Mark implementation complete

---

## Execution Notes

### Before Each Phase
1. Read relevant DESIGN.md sections listed in phase
2. Understand data models and interfaces
3. Review integration points with existing packages
4. Check ResourceManager dependencies

### During Implementation
1. Write test first (TDD)
2. Run test and verify it fails
3. Implement minimum code to pass
4. Run test and verify it passes
5. NO refactoring step - get it right first time
6. Move to next test

### Testing Requirements
- **Real SOPRegistry**: Use singleton with loaded SOPs
- **Real DecentPlanner**: Use actual task decomposition
- **Real LLM**: Use ANTHROPIC_API_KEY from .env via ResourceManager
- **Real ToolRegistry**: For tool verification
- **NO MOCKS**: In implementation code (NEVER)
- **NO FALLBACKS**: In implementation or tests (FAIL FAST)
- **NO SKIPPING**: All tests must pass or be deleted
- **Sequential execution**: `npm test -- --runInBand`

### Integration Test Guidelines
- Integration tests verify components working together
- Use real dependencies for ALL core functionality:
  - Real SOPRegistry with loaded SOPs
  - Real DecentPlanner for decomposition
  - Real LLM client for applicability judgment
  - Real ToolRegistry for tool lookup
- Mocks ONLY allowed for peripheral concerns:
  - None expected for this package
- When in doubt: NO MOCKS

### After Each Phase
1. Run all tests in phase
2. Verify 100% pass rate
3. Run full regression (all previous tests)
4. Verify no regressions
5. Mark phase complete [✓]

---

**Ready to execute. Begin with Phase 1.**