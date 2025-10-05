# Neurosymbolic Reasoning - Implementation Plan

## Overview

This implementation plan follows a **Test-Driven Development (TDD)** approach without the refactor step. We aim to get the implementation right the first time by writing tests first, then implementing to pass those tests.

The plan is organized into **phases** that follow natural dependency order, where each phase delivers demonstrable, testable functionality. Later phases build upon earlier ones, ensuring we always have working code.

## Approach

### TDD Process (No Refactor)

For each component:

1. **Write Tests First**: Create comprehensive unit tests that define expected behavior
2. **Implement to Pass**: Write minimal code to make tests pass
3. **Verify**: Run all tests, ensure 100% pass rate
4. **Move Forward**: No refactor step - get it right the first time

### Dependency-Ordered Phases

The implementation follows this dependency chain:

```
Phase 0: Dependency Verification (install and test z3-solver, LLM client)
    ↓
Phase 1: Foundation (utils, schemas, package setup)
    ↓
Phase 2: Z3 Integration (solver wrapper, basic operations)
    ↓
Phase 3: LLM Integration (prompts, program generation)
    ↓
Phase 4: Verification (proof extraction, verification logic)
    ↓
Phase 5: Core API (ProofOfThought main interface)
    ↓
Phase 6: Legion Integration (tools, CLI, actors)
```

Each phase delivers working, demonstrable functionality.

### Testing Rules

**Unit Tests:**
- Test each component in isolation
- Mock external dependencies (LLM, Z3) where appropriate
- Focus on logic correctness
- 100% pass rate required

**Integration Tests:**
- **NO MOCKS** - Use real LLM client from ResourceManager
- **NO MOCKS** - Use real Z3 solver
- Test full pipeline end-to-end
- Test realistic use cases
- All resources available (LLM, Z3)
- 100% pass rate required

**Implementation Rules:**
- **NO MOCKS in implementation code** - EVER
- **NO FALLBACKS** - Fail fast with clear errors
- **NO BACKWARDS COMPATIBILITY** - One way of doing things
- All configuration from ResourceManager
- All methods async (Z3 and LLM are async)
- ES6 modules everywhere
- Sequential Jest test execution (no parallel)

### Quality Gates

Every phase must satisfy:

1. ✅ All unit tests passing (100%)
2. ✅ All integration tests passing (100%)
3. ✅ Code follows Legion patterns
4. ✅ No mocks in implementation
5. ✅ No fallbacks - fail fast
6. ✅ Demonstrates working functionality

### MVP Scope

**Focus on:**
- ✅ Functional correctness
- ✅ Test coverage
- ✅ API usability

**Explicitly exclude:**
- ❌ Performance optimization
- ❌ Security hardening
- ❌ Migration strategies
- ❌ Detailed documentation (only code comments)
- ❌ Publishing/deployment
- ❌ Backward compatibility

This is for **local development and UAT only**.

---

## Implementation Phases

### Phase 0: Dependency Verification

**Goal**: Verify that critical Node.js dependencies (z3-solver, LLM client) are installable and functional

**Deliverable**: Confirmed working z3-solver and LLM client with simple test scripts

- [x] **Step 0.1**: Re-read DESIGN.md in full
- [x] **Step 0.2**: Install z3-solver npm package
  - Create minimal package directory structure
  - Run `npm install z3-solver`
  - Verify installation succeeded
  - Check package version (should be 4.15.3+)
- [x] **Step 0.3**: Test z3-solver basic functionality
  - Create test script in /tmp: `test-z3-basic.js`
  - Initialize z3-solver with `await init()`
  - Create Context and basic constraint (x > 5 AND x < 10)
  - Solve and verify result is 'sat'
  - Extract model and verify x has valid value
  - Clean up test script
- [x] **Step 0.4**: Test z3-solver with different types
  - Create test script in /tmp: `test-z3-types.js`
  - Test Int constraints
  - Test Bool constraints
  - Test Real constraints
  - Test And/Or/Not operations
  - Verify all work correctly
  - Clean up test script
- [x] **Step 0.5**: Test ResourceManager and LLM client
  - Create test script in /tmp: `test-llm-client.js`
  - Get ResourceManager instance
  - Get LLM client: `await resourceManager.get('llmClient')`
  - Send simple chat message
  - Verify response received
  - Clean up test script
- [x] **Step 0.6**: Test LLM JSON output parsing
  - Create test script in /tmp: `test-llm-json.js`
  - Send prompt requesting JSON response
  - Parse JSON from LLM output
  - Handle potential malformed JSON
  - Verify JSON structure
  - Clean up test script
- [x] **Step 0.7**: Document findings
  - Note z3-solver API quirks discovered
  - Note LLM client behavior
  - Note any limitations or issues
  - Update DESIGN.md if critical issues found

**Quality Gate**: ✅ PASSED - Both z3-solver and LLM client confirmed working
**Demo**: ✅ COMPLETE - Test scripts showed z3-solver solving constraints and LLM responding

---

### Phase 1: Foundation & Package Setup

**Goal**: Establish package structure, dependencies, and foundational utilities

**Deliverable**: Working package with basic utilities and schemas

- [x] **Step 1.1**: Re-read DESIGN.md in full
- [x] **Step 1.2**: Initialize package structure
  - Create package.json with dependencies
  - Configure Jest for ES6 modules
  - Set up workspace imports (@legion/neurosymbolic-reasoning)
  - Add to monorepo workspace configuration
- [x] **Step 1.3**: Implement evaluation metrics utility (TDD)
  - Write tests for: accuracyScore, confusionMatrix, precisionScore, recallScore, f1Score
  - Implement src/utils/evaluation-metrics.js
  - Verify all tests pass
- [x] **Step 1.4**: Define Z3 program JSON schema (TDD)
  - Write tests for schema validation
  - Implement src/schemas/z3-program-schema.js using @legion/schema
  - Test valid and invalid programs
  - Verify all tests pass
- [x] **Step 1.5**: Create base expression types (TDD)
  - Write tests for expression parsing and validation
  - Implement src/dsl/Expressions.js
  - Implement src/dsl/Sorts.js (Int, Bool, Real)
  - Verify all tests pass

**Quality Gate**: ✅ PASSED - Run `npm test` - 100% pass rate (111 tests passing)

---

### Phase 2: Z3 Solver Integration

**Goal**: Wrap z3-solver npm package with Legion-compatible interface

**Deliverable**: Working Z3Solver that can solve basic constraint problems

- [x] **Step 2.1**: Re-read DESIGN.md in full
- [x] **Step 2.2**: Implement AbstractSolver interface (TDD)
  - Write tests defining solver interface contract
  - Implement src/solvers/AbstractSolver.js
  - Verify all tests pass
- [x] **Step 2.3**: Implement Z3Solver initialization (TDD)
  - Write tests for Z3 WASM initialization
  - Implement src/solvers/Z3Solver.js constructor and initialize()
  - Test Context creation
  - Verify all tests pass
- [x] **Step 2.4**: Implement basic constraint solving (TDD)
  - Write tests for: Int constraints (x > 5, x < 10)
  - Implement solve() method
  - Test satisfiable and unsatisfiable cases
  - Verify all tests pass
- [x] **Step 2.5**: Implement model extraction (TDD)
  - Write tests for getModel()
  - Extract variable assignments from solutions
  - Verify all tests pass
- [x] **Step 2.6**: Implement proof extraction (TDD)
  - Write tests for getProof()
  - Extract proof steps from Z3
  - Verify all tests pass
- [x] **Step 2.7**: Integration test - Z3Solver end-to-end
  - Test real Z3 WASM solver (NO MOCKS)
  - Test multiple constraint types (Int, Bool, Real)
  - Test complex And/Or combinations
  - Verify all tests pass

**Quality Gate**: ✅ PASSED - Run `npm test` - 100% pass rate (179 tests passing)
**Demo**: ✅ COMPLETE - Solve "x > 5 AND x < 10" constraint problem with full proof

---

### Phase 3: LLM Integration & Program Generation

**Goal**: Generate Z3 programs from natural language using LLM

**Deliverable**: Working ProgramGenerator that creates valid Z3 programs from questions

- [x] **Step 3.1**: Re-read DESIGN.md in full
- [x] **Step 3.2**: Implement PromptTemplate (TDD)
  - Write tests for template rendering
  - Implement src/reasoning/PromptTemplate.js
  - Test few-shot example insertion
  - Test context variable substitution
  - Verify all tests pass
- [x] **Step 3.3**: Create default Z3 program generation prompt
  - Write tests for prompt structure validation
  - Create prompt with examples
  - Include JSON schema in prompt
  - Verify all tests pass
- [x] **Step 3.4**: Implement ProgramGenerator core (TDD)
  - Write tests for program generation (mock LLM responses in unit tests)
  - Implement src/reasoning/ProgramGenerator.js
  - Parse LLM JSON output
  - Validate against schema
  - Verify all tests pass
- [x] **Step 3.5**: Implement retry logic (TDD)
  - Write tests for regenerate() with error feedback
  - Handle malformed JSON
  - Handle invalid programs
  - Max retry limit
  - Verify all tests pass
- [x] **Step 3.6**: Integration test - ProgramGenerator with real LLM
  - Get LLM client from ResourceManager (NO MOCKS)
  - Test simple question: "Is there a number greater than 5 and less than 10?"
  - Verify generated program is valid Z3 JSON
  - Test program executes in Z3Solver
  - Verify all tests pass

**Quality Gate**: ✅ PASSED - Run `npm test` - 100% pass rate
**Demo**: ✅ COMPLETE - Generate and execute Z3 program from natural language question

---

### Phase 4: Verification & Proof Extraction

**Goal**: Verify solutions and extract human-readable proofs

**Deliverable**: Working Verifier that validates solutions and explains proofs

- [x] **Step 4.1**: Re-read DESIGN.md in full
- [x] **Step 4.2**: Implement solution verification (TDD)
  - Write tests for verify() method
  - Implement src/reasoning/Verifier.js
  - Check solution against constraints
  - Identify violations
  - Verify all tests pass
- [x] **Step 4.3**: Implement proof step extraction (TDD)
  - Write tests for extractProof()
  - Parse Z3 proof into structured steps
  - Number steps sequentially
  - Verify all tests pass
- [x] **Step 4.4**: Implement proof explanation (TDD)
  - Write tests for explainProof()
  - Convert proof steps to natural language
  - Format for readability
  - Verify all tests pass
- [x] **Step 4.5**: Integration test - Verifier end-to-end
  - Test with real Z3 solutions (NO MOCKS)
  - Test valid and invalid solutions
  - Test constraint violations
  - Verify proof extraction works
  - Verify all tests pass

**Quality Gate**: ✅ PASSED - Run `npm test` - 100% pass rate
**Demo**: ✅ COMPLETE - Verify a solution and show proof chain

---

### Phase 5: Core ProofOfThought API

**Goal**: Implement main ProofOfThought interface orchestrating all components

**Deliverable**: Fully working neurosymbolic reasoning system

- [x] **Step 5.1**: Re-read DESIGN.md in full
- [x] **Step 5.2**: Implement ProofOfThought constructor (TDD)
  - Write tests for initialization
  - Implement src/core/ProofOfThought.js
  - Accept LLM client from ResourceManager
  - Initialize all components
  - Verify all tests pass
- [x] **Step 5.3**: Implement query() method (TDD)
  - Write tests for basic query flow
  - Orchestrate: generate → solve → verify
  - Return structured result with proof
  - Handle errors (NO FALLBACKS)
  - Verify all tests pass
- [x] **Step 5.4**: Implement verify() method (TDD)
  - Write tests for claim verification
  - Check claim against facts and constraints
  - Return violations
  - Verify all tests pass
- [x] **Step 5.5**: Implement solve() method (TDD)
  - Write tests for constraint satisfaction
  - Find solutions to constraint problems
  - Return model and proof
  - Verify all tests pass
- [x] **Step 5.6**: Create main package exports
  - Implement src/index.js
  - Export ProofOfThought and key utilities
  - Test imports work correctly
- [x] **Step 5.7**: Integration test - Full reasoning pipeline
  - Get ResourceManager instance (NO MOCKS)
  - Get real LLM client (NO MOCKS)
  - Test query: "Would a Democrat denounce abortion?"
  - Verify answer, proof, and explanation
  - Verify all tests pass
- [x] **Step 5.8**: Integration test - Constraint verification
  - Test deployment decision example from DESIGN.md
  - Verify constraint violations detected
  - Verify proof explains why
  - Verify all tests pass
- [x] **Step 5.9**: Integration test - Constraint solving
  - Test meeting scheduling example from DESIGN.md
  - Verify solution found
  - Verify model returned
  - Verify all tests pass

**Quality Gate**: ✅ PASSED - Run `npm test` - 100% pass rate
**Demo**: ✅ COMPLETE - Run all three API methods (query, verify, solve) with real examples

---

### Phase 6: Legion Integration

**Goal**: Integrate with Legion framework (Tools, CLI, Actors)

**Deliverable**: Usable neurosymbolic reasoning in Legion ecosystem

- [x] **Step 6.1**: Re-read DESIGN.md in full
- [x] **Step 6.2**: Create ReasonCommand for CLI (TDD)
  - Create packages/cli/src/commands/ReasonCommand.js
  - Write tests for command execution
  - Implement command with argument parsing
  - Format output for CLI display
  - Verify all tests pass
- [x] **Step 6.3**: Integration test - CLI command
  - Test full CLI command execution (NO MOCKS)
  - Test with constraints and facts
  - Verify formatted output
  - Verify all tests pass
- [x] **Step 6.4**: Create actor integration example (TDD)
  - Create example DecisionMakingActor in examples/
  - Write tests for actor decision logic
  - Show how to use ProofOfThought in actors
  - Verify all tests pass
- [x] **Step 6.5**: Integration test - Actor integration
  - Test actor with neurosymbolic reasoning (NO MOCKS)
  - Verify safety constraint checking
  - Verify proof-based decisions
  - Verify all tests pass

**Quality Gate**: ✅ PASSED - Run `npm test` - 100% pass rate
**Demo**: ✅ COMPLETE - Run CLI command, demonstrate actor usage

---

## Completion Criteria

All phases complete when:

- [x] All checkboxes above marked complete
- [x] `npm test` passes 100% across all test files (331 tests passing)
- [x] All integration tests pass with real LLM and Z3 (NO MOCKS)
- [x] All three API methods (query, verify, solve) demonstrated working
- [x] Legion integration (CLI command, actor example) working
- [x] No mocks in implementation code
- [x] No fallbacks - all errors fail fast
- [x] Package exports correctly from @legion/neurosymbolic-reasoning

**✅ ALL CRITERIA MET - IMPLEMENTATION COMPLETE!**

## Running Tests

```bash
# Run all tests for this package
npm test packages/ai/neurosymbolic-reasoning

# Run specific test file
npm test packages/ai/neurosymbolic-reasoning/__tests__/unit/Z3Solver.test.js

# Run integration tests only
npm test packages/ai/neurosymbolic-reasoning/__tests__/integration
```

## Notes

- **Always re-read DESIGN.md at the start of each phase** - It contains all implementation details
- **Update checkboxes as you complete steps** - Mark with [x] when done
- **No shortcuts** - 100% test pass rate is mandatory
- **No mocks in integration tests** - Real LLM, real Z3
- **No fallbacks** - Fail fast with clear error messages
- **TDD always** - Tests first, then implementation

---

**Plan Version**: 1.1
**Created**: 2025-10-04
**Updated**: 2025-10-04 (Added Phase 0: Dependency Verification)
**Status**: Ready for Execution
