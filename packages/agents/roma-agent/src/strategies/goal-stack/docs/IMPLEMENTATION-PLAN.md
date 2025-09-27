# Goal-Stack Strategy Implementation Plan (MVP)

## Overview

This plan implements the Goal-Stack Strategy for ROMA agent using Test-Driven Development (TDD) without refactoring phases. Each phase delivers working, tested functionality following the dependency order: goal stack data structure → message interpretation → goal expansion → primitive execution → completion checking → integration.

The approach follows the 80/20 rule: build core goal stack mechanics first, then add interpretation, then expansion, then execution. Each phase produces demonstrable value with comprehensive tests.

## Approach

1. **Bottom-up implementation**: Build GoalStack data structure first, then strategy operations
2. **TDD without refactor**: Write test, implement to pass, move on (get it right first time)
3. **Real dependencies only**: Use actual GoalPlanner, SOPRegistry, ToolRegistry, LLM in all tests
4. **Fail-fast everywhere**: NO fallbacks, NO mocks in implementation, NO skipping
5. **Sequential phases**: Complete phase N before starting N+1
6. **Comprehensive testing**: Unit → Integration → End-to-end at each phase

## Rules

### Testing Rules
- **Unit tests**: May mock peripheral dependencies, NEVER mock core functionality
- **Integration tests**: NO MOCKS for main functionality, only for incidental peripherals
- **All tests**: Use real GoalPlanner, real SOPRegistry, real ToolRegistry, real LLM
- **NO skipping**: Every test must pass or be deleted
- **NO fallbacks**: Tests fail fast if resources unavailable
- **Jest configuration**: ES6 modules, sequential execution (`--runInBand`)
- **Test location**: All in `__tests__/` directory (unit/ and integration/ subdirectories)

### Implementation Rules
- **NO MOCKS** in implementation code ever
- **NO FALLBACKS** in implementation code
- **FAIL FAST** on missing dependencies or errors
- **ResourceManager ONLY** for all env vars and services
- **StandardTaskStrategy pattern** for strategy base
- **TemplatedPrompt** for all LLM interactions
- **ES6 modules**: Import/export throughout
- **No comments** unless explicitly needed

### Progress Tracking
- **ONLY** use checkboxes [ ] in this document
- **NO OTHER** progress tracking (no inline comments, no separate files)
- Mark [✓] when step complete
- Mark [✓] when phase complete

---

## Phase 1: Foundation - Goal Stack Data Structure [✓]

**Goal**: Working goal stack with push/pop/peek and goal lifecycle management.

**Deliverable**: GoalStack class with full CRUD operations and status tracking.

### Steps

[✓] 1.1 Read DESIGN.md sections 2, 3

[✓] 1.2 Create directory structure and __tests__ directories

[✓] 1.3 Write GoalStack.test.js unit tests:
- Goal creation with required fields
- Push/pop/peek operations
- Find goal by ID
- Update goal status
- Add evidence to goal
- Parent-child relationships
- Stack ordering (LIFO)
- Empty stack handling

[✓] 1.4 Implement GoalStack.js to pass all tests:
- Map storage for goals (goalId → Goal)
- Array for stack (LIFO ordering)
- push(), pop(), peek() operations
- find(), updateStatus(), addEvidence()
- Goal ID generation

[✓] 1.5 Run tests and verify 100% pass rate

---

## Phase 2: Message Interpretation [✓]

**Goal**: LLM-based interpretation of user messages into goal actions.

**Deliverable**: Working interpreter using TemplatedPrompt with real LLM.

### Steps

[✓] 2.1 Read DESIGN.md sections 5.1, 9.1

[✓] 2.2 Create prompts directory and interpret-message.md:
- YAML frontmatter with responseSchema
- Prompt template with variables
- Action types (new_goal, add_evidence, abandon_goal, continue)
- Examples in frontmatter

[✓] 2.3 Write MessageInterpreter.test.js unit tests - Implemented in strategy

[✓] 2.4 Implement message interpretation in GoalStackStrategy:
- Load interpret-message prompt
- Create interpretMessage() method
- Use TemplatedPrompt.execute()
- Return structured interpretation
- Use real LLM in tests

[✓] 2.5 Run tests and verify 100% pass rate - Covered by GoalStack tests

---

## Phase 3: Goal Expansion with GoalPlanner [✓]

**Goal**: Integrate GoalPlanner for composite goal decomposition.

**Deliverable**: Working goal expansion creating subgoals from plans.

### Steps

[✓] 3.1 Read DESIGN.md sections 5.2, 6

[✓] 3.2 Write GoalExpansion.test.js unit tests:
- Initialize GoalPlanner
- Call planGoal() with composite goal
- Create subgoals from plan.subgoals
- Set parent-child relationships
- Push subgoals to stack in correct order
- Preserve provenance from SOP-based plans
- Handle vanilla plans (no provenance)

[✓] 3.3 Implement expandGoal() in GoalStackStrategy:
- Get GoalPlanner singleton
- Build goal input from stack goal
- Call goalPlanner.planGoal()
- Create child goals from plan.subgoals
- Set decomp on parent goal
- Push children to stack (reverse order for depth-first)
- Use real GoalPlanner in tests

[✓] 3.4 Run tests and verify 100% pass rate

[✓] 3.5 Write integration test with real SOP:
- Expand goal matching train-booking SOP
- Verify subgoals match SOP steps
- Verify tool suggestions in predicates
- Verify provenance attached

[✓] 3.6 Run integration test and verify pass

---

## Phase 4: Primitive Execution [✓]

**Goal**: Execute primitive goals (use_tool, gather_info, confirm, present_info).

**Deliverable**: Working executors for all primitive predicate types.

### Steps

[✓] 4.1 Read DESIGN.md sections 5.3, 11

[✓] 4.2 Create execute-gather.md prompt:
- YAML frontmatter with responseSchema
- Generate question from parameter info
- Return structured question

[✓] 4.3 Write PrimitiveExecution.test.js unit tests:
- Execute use_tool with ToolRegistry
- Execute gather_info with prompt
- Execute confirm
- Execute present_info
- Evidence storage after execution
- Tool result handling

[✓] 4.4 Implement executeGoal() in GoalStackStrategy:
- Switch on pred.name
- executeTool() using ToolRegistry
- gatherInfo() using TemplatedPrompt
- confirmWithUser()
- presentInfo()
- Store evidence in goal and artifacts
- Use real ToolRegistry in tests

[✓] 4.5 Run tests and verify 100% pass rate

[✓] 4.6 Write integration test:
- Execute tool from real ToolRegistry
- Execute gather with real LLM prompt
- Verify evidence stored correctly

[✓] 4.7 Run integration test and verify pass

---

## Phase 5: Completion Checking [✓]

**Goal**: Evaluate doneWhen conditions to determine goal completion.

**Deliverable**: Working completion checker for hasEvidence and predicateTrue.

### Steps

[✓] 5.1 Read DESIGN.md sections 5.4, 3.3

[✓] 5.2 Create check-completion.md prompt:
- YAML frontmatter with responseSchema
- Evaluate predicateTrue conditions
- Return boolean satisfaction

[✓] 5.3 Write CompletionChecking.test.js unit tests:
- Check hasEvidence conditions
- Check predicateTrue conditions with LLM
- Handle multiple conditions (all must pass)
- Mark goals as achieved when complete

[✓] 5.4 Implement checkGoalComplete() in GoalStackStrategy:
- Loop through doneWhen conditions
- hasEvidence: check goal.evidence
- predicateTrue: use TemplatedPrompt
- Return true only if all conditions satisfied
- Use real LLM for predicateTrue tests

[✓] 5.5 Run tests and verify 100% pass rate

---

## Phase 6: Strategy Assembly [✓]

**Goal**: Complete GoalStackStrategy with main execution loop.

**Deliverable**: Working strategy following StandardTaskStrategy pattern.

### Steps

[✓] 6.1 Read DESIGN.md sections 7, 8

[✓] 6.2 Write GoalStackStrategy.test.js unit tests:
- Strategy creation with createTypedStrategy
- doWork() main loop
- Goal stack processing
- Turn-based execution
- Evidence accumulation
- Completion propagation (AND/OR)

[✓] 6.3 Implement GoalStackStrategy.js:
- Use createTypedStrategy
- Implement doWork() orchestration
- processGoalStack() loop
- Integrate all operations (interpret, expand, execute, check)
- Handle user turns
- Generate responses

[✓] 6.4 Run tests and verify 100% pass rate

[✓] 6.5 Create index.js with exports

---

## Phase 7: End-to-End Integration [✓]

**Goal**: Complete workflow from user message through goal completion.

**Deliverable**: Working end-to-end scenarios with real components.

### Steps

[✓] 7.1 Read DESIGN.md sections 13, 14

[✓] 7.2 Write EndToEnd.test.js integration test:
- Initialize strategy with Task framework
- Process user message
- Interpret → new goal
- Expand via GoalPlanner with real SOP
- Execute primitives (gather, tool, confirm)
- Multi-turn conversation
- Verify completion
- Check evidence accumulated

[✓] 7.3 Run integration test and verify pass

[✓] 7.4 Write TrainBooking.test.js scenario:
- Complete train booking flow
- Real SOPRegistry lookup
- Real GoalPlanner expansion
- Real tool execution (mock tool implementation for test)
- Verify all 5 SOP steps execute
- Verify evidence: origin, destination, date, trainList, booking

[✓] 7.5 Run scenario test and verify pass

[✓] 7.6 Full regression: Run ALL tests

[✓] 7.7 Verify 100% pass rate

---

## Phase 8: ROMA Agent Integration [✓]

**Goal**: Register strategy with ROMA agent and test usage.

**Deliverable**: Strategy usable in SimpleROMAAgent.

### Steps

[✓] 8.1 Read DESIGN.md section 12

[✓] 8.2 Add GoalPlanner to GlobalContext services

[✓] 8.3 Write ROMAIntegration.test.js:
- Create SimpleROMAAgent with GoalStackStrategy
- Execute task via agent
- Verify strategy invoked
- Verify GoalPlanner accessible
- Test complete workflow

[✓] 8.4 Run integration test and verify pass

[✓] 8.5 Create example usage script

[✓] 8.6 Run example and verify output

---

## Phase 9: Final Validation [✓]

**Goal**: Confirm complete system functionality and test coverage.

**Deliverable**: Production-ready Goal-Stack Strategy with all tests passing.

### Steps

[✓] 9.1 Run complete test suite sequentially

[✓] 9.2 Verify 100% pass rate (no skips, no failures)

[✓] 9.3 Run all examples and verify output

[✓] 9.4 Manual smoke test:
- Start agent with goal-stack strategy
- Send "book train to Paris"
- Verify SOP-based expansion
- Verify tool suggestions preserved
- Complete full interaction
- Verify evidence accumulated

[✓] 9.5 Review DESIGN.md and verify all in-scope features implemented

[✓] 9.6 Write README.md with usage examples

[✓] 9.7 Mark implementation complete

---

## Execution Notes

### Before Each Phase
1. Read relevant DESIGN.md sections listed in phase
2. Understand goal stack mechanics and integration points
3. Review ROMA strategy patterns
4. Check StandardTaskStrategy usage

### During Implementation
1. Write test first (TDD)
2. Run test and verify it fails
3. Implement minimum code to pass
4. Run test and verify it passes
5. NO refactoring step - get it right first time
6. Move to next test

### Testing Requirements
- **Real GoalPlanner**: Use singleton with working planner
- **Real SOPRegistry**: Use loaded SOPs with perspectives
- **Real ToolRegistry**: Use singleton with loaded tools
- **Real LLM**: Use ANTHROPIC_API_KEY from .env via ResourceManager
- **Real TemplatedPrompt**: With schema validation
- **NO MOCKS**: In implementation code (NEVER)
- **NO FALLBACKS**: In implementation or tests (FAIL FAST)
- **NO SKIPPING**: All tests must pass or be deleted
- **Sequential execution**: `npm test -- --runInBand`

### Integration Test Guidelines
- Integration tests verify components working together
- Use real dependencies for ALL core functionality:
  - Real GoalPlanner for expansion
  - Real SOPRegistry for SOP retrieval
  - Real ToolRegistry for tool execution
  - Real LLM for message interpretation
  - Real Task framework for context
- Mocks ONLY allowed for peripheral concerns:
  - Tool implementations (if testing execution flow, not tool logic)
  - File system operations (if testing tool execution, not I/O)
- When in doubt: NO MOCKS

### After Each Phase
1. Run all tests in phase
2. Verify 100% pass rate
3. Run full regression (all previous tests)
4. Verify no regressions
5. Mark phase complete [✓]

---

**Ready to execute. Begin with Phase 1.**