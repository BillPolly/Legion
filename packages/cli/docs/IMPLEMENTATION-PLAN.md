# CLI DisplayEngine - Implementation Plan

## Overview

This plan details the implementation of the CLI DisplayEngine with ShowMe integration, enabling hybrid terminal + browser visualization of Legion Handles. Terminal for simple displays, chromeless browser for complex interactive displays.

**Reference Document**: All implementation details are specified in [DESIGN.md](./DESIGN.md). This plan provides the execution sequence only.

## Implementation Approach

### Core Principles
1. **TDD Without Refactor**: Write tests first, implement correctly the first time
2. **No Mocks in Integration Tests**: Use real ResourceManager, real ShowMe, real Handles
3. **No Mocks in Implementation Code**: Only real services and resources, fail fast on errors
4. **Fail-Fast**: Every error raises an exception with clear context
5. **Phase-Based**: Each phase delivers working, demonstrable functionality
6. **Comprehensive Testing**: Unit tests for components, integration tests for flows

### Testing Rules
- **Unit Tests**: Test individual classes/functions in isolation
- **Integration Tests**: Test complete flows with real dependencies (NO MOCKS)
- **All Tests Must Pass**: No skipping, no fallbacks, tests fail if resources unavailable
- **Test Location**: All tests in `__tests__/` directory
- **Run Tests Sequentially**: Use `--runInBand` for Jest

### Workflow Rules
1. **Read Design**: At the beginning of each phase, reread [DESIGN.md](./DESIGN.md) - DisplayEngine section
2. **Write Tests First**: Unit tests, then integration tests, then implementation
3. **Run Tests Continuously**: After each implementation step
4. **Update Plan**: Mark completed steps with ✅
5. **Commit Per Phase**: Commit and push after each completed phase

## Phases and Steps

### Phase 1: Terminal Rendering Foundation
**Goal**: Implement basic terminal rendering for Handles (table, tree, JSON formats)

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - DisplayEngine Terminal Rendering section

#### Steps:
- [ ] 1.1: Write unit tests for DisplayEngine class structure
  - Test DisplayEngine constructor with ResourceManager
  - Test mode selection (terminal, browser, auto)
  - Test format detection logic
  - Test error cases (missing ResourceManager)

- [ ] 1.2: Implement DisplayEngine base class
  - Create `/packages/cli/src/display/DisplayEngine.js`
  - Implement constructor with ResourceManager injection
  - Implement `render(handle, format)` routing method
  - Implement `shouldUseTerminal(handle, format)` logic
  - Fail-fast on invalid inputs

- [ ] 1.3: Write unit tests for table rendering
  - Test Handle metadata extraction
  - Test table structure generation
  - Test property formatting
  - Test column width calculation
  - Test error handling for missing metadata

- [ ] 1.4: Implement table rendering
  - Install `cli-table3` dependency
  - Implement `renderTable(handle)` method
  - Extract Handle properties and metadata
  - Format values for display
  - Generate ASCII table with borders

- [ ] 1.5: Write unit tests for JSON rendering
  - Test Handle to JSON conversion
  - Test JSON formatting and indentation
  - Test syntax highlighting
  - Test error handling for non-serializable Handles

- [ ] 1.6: Implement JSON rendering
  - Install `chalk` for colors
  - Implement `renderJSON(handle)` method
  - Use `handle.toJSON()` for serialization
  - Add syntax highlighting with chalk
  - Pretty-print with proper indentation

- [ ] 1.7: Write unit tests for summary rendering
  - Test concise Handle summary generation
  - Test URI, type, key properties display
  - Test formatting and layout

- [ ] 1.8: Implement summary rendering
  - Implement `renderSummary(handle)` method
  - Show URI, resourceType, server
  - Show 3-5 key properties
  - Use chalk for colored output

- [ ] 1.9: Write integration tests for terminal rendering
  - Create real strategy Handle from URI
  - Test table rendering with real Handle
  - Test JSON rendering with real Handle
  - Test summary rendering with real Handle
  - NO MOCKS - use real ResourceManager and Handles

- [ ] 1.10: Run all Phase 1 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Implement DisplayEngine terminal rendering"

### Phase 2: ShowMe Service Integration
**Goal**: Integrate DisplayEngine with ShowMe service for browser rendering

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - ShowMe Actor Integration section

#### Steps:
- [ ] 2.1: Write unit tests for ShowMe service initialization
  - Test ShowMe service retrieval from ResourceManager
  - Test ShowMe actor access
  - Test error handling for missing ShowMe service
  - Test lazy initialization pattern

- [ ] 2.2: Implement ShowMe service integration
  - Add `initializeShowMe()` method
  - Get ShowMe service from ResourceManager
  - Cache ShowMe service and actor references
  - Fail-fast if ShowMe not available

- [ ] 2.3: Write unit tests for browser rendering
  - Test window options construction
  - Test Actor message structure
  - Test Handle URI transmission
  - Test error handling for Actor send failures

- [ ] 2.4: Implement browser rendering
  - Implement `renderBrowser(handle, options)` method
  - Build window configuration from options
  - Construct Actor message with Handle URI
  - Send message to ShowMe actor
  - Log success/failure

- [ ] 2.5: Write unit tests for mode selection
  - Test `shouldUseTerminal()` logic
  - Test format-based selection (table → terminal)
  - Test Handle-type-based selection (strategy → browser)
  - Test explicit mode override

- [ ] 2.6: Refine mode selection logic
  - Implement Handle type detection
  - Implement format preferences
  - Add mode override support
  - Document selection rules

- [ ] 2.7: Write integration tests for ShowMe integration
  - Start real ShowMe server
  - Create real strategy Handle
  - Call DisplayEngine.renderBrowser() with Handle
  - Verify Actor message sent correctly
  - Verify ShowMe server receives message
  - NO MOCKS - real ShowMe service and Actor

- [ ] 2.8: Run all Phase 2 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Integrate DisplayEngine with ShowMe service"

### Phase 3: Interactive Exploration
**Goal**: Implement `exploreInteractive()` for rich Handle exploration in browser

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Browser Rendering Examples section

#### Steps:
- [ ] 3.1: Write unit tests for exploreInteractive
  - Test window sizing for exploration mode
  - Test title generation
  - Test option defaults
  - Test error handling

- [ ] 3.2: Implement exploreInteractive method
  - Implement `exploreInteractive(handle)` method
  - Set exploration-specific window options (1200x800)
  - Generate descriptive title
  - Call renderBrowser() with options
  - Log exploration start

- [ ] 3.3: Write unit tests for Handle type detection
  - Test detection of strategy handles
  - Test detection of file handles
  - Test detection of memory handles
  - Test fallback for unknown types

- [ ] 3.4: Implement Handle type-specific defaults
  - Add type-specific window sizing
  - Add type-specific title templates
  - Add type-specific option presets

- [ ] 3.5: Write integration tests for interactive exploration
  - Create real strategy Handle
  - Call exploreInteractive() with Handle
  - Verify browser launches with correct options
  - Verify ShowMe displays Handle correctly
  - Manual verification: Check browser is chromeless
  - NO MOCKS - real end-to-end flow

- [ ] 3.6: Run all Phase 3 tests
  - Verify 100% pass rate (excluding manual verification)
  - Fix any failures
  - Commit: "feat: Add interactive Handle exploration"

### Phase 4: CLI Command Integration
**Goal**: Add `/show` command to CLI for displaying Handles

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - CommandProcessor section

#### Steps:
- [ ] 4.1: Write unit tests for ShowCommand
  - Test command parsing (`/show <uri>`)
  - Test format option parsing (`/show <uri> --format=table`)
  - Test mode option parsing (`/show <uri> --mode=browser`)
  - Test error handling for invalid URIs

- [ ] 4.2: Implement ShowCommand class
  - Create `/packages/cli/src/commands/ShowCommand.js`
  - Extend BaseCommand
  - Parse command arguments
  - Extract Handle URI and options
  - Call DisplayEngine.render()
  - Handle and display errors

- [ ] 4.3: Write unit tests for command registration
  - Test ShowCommand registration in CommandRouter
  - Test command discovery
  - Test help text generation

- [ ] 4.4: Register ShowCommand in CLI
  - Add ShowCommand to CommandRouter
  - Register `/show` command alias
  - Update help text with /show documentation
  - Add command completion for /show

- [ ] 4.5: Write integration tests for /show command
  - Start CLI instance
  - Execute `/show legion://local/strategy/...`
  - Verify DisplayEngine called correctly
  - Test with different formats (`/show <uri> --format=json`)
  - Test with different modes (`/show <uri> --mode=browser`)
  - NO MOCKS - real CLI, real DisplayEngine, real Handles

- [ ] 4.6: Run all Phase 4 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Add /show command for Handle display"

### Phase 5: End-to-End Integration Testing
**Goal**: Test complete CLI → DisplayEngine → ShowMe flow

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - All DisplayEngine sections

#### Steps:
- [ ] 5.1: Write end-to-end terminal rendering test
  - Start CLI
  - Create strategy Handle from real strategy file
  - Execute `/show <strategy-uri> --format=table`
  - Verify table output in terminal
  - Execute `/show <strategy-uri> --format=json`
  - Verify JSON output
  - NO MOCKS - complete real flow

- [ ] 5.2: Write end-to-end browser rendering test
  - Start CLI
  - Start ShowMe server
  - Create strategy Handle
  - Execute `/show <strategy-uri> --mode=browser`
  - Verify ShowMe receives Handle URI
  - Verify browser launches (check process)
  - Verify Handle displayed correctly
  - NO MOCKS - complete real flow

- [ ] 5.3: Write end-to-end interactive exploration test
  - Start CLI
  - Start ShowMe server
  - Execute `/show <strategy-uri>`  (auto-selects browser for strategy)
  - Verify interactive display in chromeless browser
  - Verify all Handle sections visible (metadata, actions, etc.)
  - Manual verification: Interact with browser display
  - NO MOCKS - complete real flow

- [ ] 5.4: Test error scenarios end-to-end
  - Invalid Handle URI
  - ShowMe server not running
  - ResourceManager unavailable
  - Handle resolution failure
  - Verify all fail fast with clear errors

- [ ] 5.5: Test Handle type routing
  - Display strategy Handle → browser
  - Display config Handle → terminal
  - Display file Handle → terminal
  - Verify correct renderer selection

- [ ] 5.6: Manual UAT
  - Start CLI
  - Display various Handle types
  - Verify terminal rendering is clean and readable
  - Verify browser rendering is chromeless and interactive
  - Verify all actions work (copy URI, view JSON, etc.)
  - Document any issues found

- [ ] 5.7: Run all tests (full regression)
  - Run all unit tests
  - Run all integration tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Complete DisplayEngine integration with ShowMe"
  - Push all commits

## Completion Criteria

### All Phases Complete When:
- ✅ All unit tests passing (100%)
- ✅ All integration tests passing (100%)
- ✅ NO MOCKS in any integration tests
- ✅ NO MOCKS in any implementation code
- ✅ Terminal rendering works for table, JSON, summary formats
- ✅ Browser rendering launches ShowMe in chromeless mode
- ✅ Strategy Handles display correctly in both terminal and browser
- ✅ `/show` command works from CLI
- ✅ Actor messaging flows correctly CLI → ShowMe
- ✅ All code committed and pushed
- ✅ Manual UAT confirms functionality

### Success Metrics:
1. Can display any Handle via `/show <uri>` command
2. Simple formats render cleanly in terminal
3. Complex Handles open in chromeless browser
4. ShowMe displays Handle metadata and actions correctly
5. All tests pass without mocks
6. No silent failures (all errors raise exceptions)

## Notes

- **Design Reference**: Always refer to [DESIGN.md](./DESIGN.md) for implementation details
- **Test-First**: Write tests before implementation
- **No Shortcuts**: No mocks, no fallbacks, no silent failures
- **Phase Commits**: Commit after each completed phase
- **Update Plan**: Mark steps complete with ✅ as you proceed
- **Reread Design**: At start of each phase, reread relevant sections
- **ShowMe Dependency**: Phases 2-5 require ShowMe Handle integration to be complete