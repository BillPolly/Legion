# Legion CLI - Implementation Plan

## Overview

This plan details the implementation of the Legion CLI - a Handle-centric command-line interface for interacting with any resource, tool, or artifact through the Legion framework's Handle system.

**Reference Document**: All implementation details are specified in [DESIGN.md](./DESIGN.md). This plan provides the execution sequence only.

## Implementation Approach

### Core Principles
1. **TDD Without Refactor**: Write tests first, implement correctly the first time
2. **Natural Dependency Order**: Core mechanisms first, then elaborate
3. **Demonstrable Value**: Each phase delivers working, demonstrable functionality
4. **Fail-Fast**: Every error raises an exception with clear context
5. **No Fallbacks**: Never have fallback code paths - fail immediately with clear error
6. **No Mocks in Integration Tests**: Use real ResourceManager, real Handles, real services
7. **No Mocks in Implementation Code**: Only real services and resources
8. **Comprehensive Testing**: Both unit tests and integration tests for all components
9. **MVP Focus**: Functional correctness only - no NFRs (security, performance, migration, docs)
10. **Local + UAT Only**: No publishing or deployment concerns

### Testing Rules
- **Unit Tests**: Test individual classes/functions in isolation
- **Integration Tests**: Test complete flows with real dependencies (NO MOCKS)
- **All Tests Must Pass**: No skipping, no fallbacks, tests fail if resources unavailable
- **Test Location**: All tests in `__tests__/` directory
- **Run Tests Sequentially**: Use `--runInBand` for Jest

### Workflow Rules
1. **Read Design First**: At the beginning of each phase, reread [DESIGN.md](./DESIGN.md) - relevant sections
2. **Write Tests First**: Unit tests, then integration tests, then implementation
3. **Run Tests Continuously**: After each implementation step
4. **Update Plan**: Mark completed steps with ✅
5. **No Progress Tracking Sections**: Only phases and steps updated as plan executes

## Phases and Steps

### Phase 1: Core CLI Infrastructure
**Goal**: Establish basic CLI structure, ResourceManager integration, and lifecycle management

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - CLI Gateway, System Architecture sections

#### Steps:
- [ ] 1.1: Create CLI package structure
  - Create `/packages/cli/src/` directory
  - Create `/packages/cli/__tests__/` directory
  - Create package.json with dependencies
  - Configure Jest for ES6 modules

- [ ] 1.2: Write unit tests for CLI class
  - Test CLI constructor with ResourceManager
  - Test initialize() method
  - Test start() method
  - Test shutdown() method
  - Test lifecycle state management
  - Test error handling (missing ResourceManager)

- [ ] 1.3: Implement CLI base class
  - Create `/packages/cli/src/CLI.js`
  - Implement constructor accepting ResourceManager
  - Implement initialize() - sets up components
  - Implement start() - starts interactive prompt
  - Implement shutdown() - cleans up resources
  - Fail-fast on invalid state or missing dependencies

- [ ] 1.4: Write integration test for CLI lifecycle
  - Create real ResourceManager
  - Create CLI instance
  - Test full lifecycle: initialize → start → shutdown
  - NO MOCKS - real ResourceManager

- [ ] 1.5: Run all Phase 1 tests
  - Verify 100% pass rate
  - Fix any failures

### Phase 2: ShowMe Integration
**Goal**: Integrate ShowMeController for browser-based Handle visualization

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - ShowMe Integration section

#### Steps:
- [ ] 2.1: Write unit tests for ShowMe initialization
  - Test ShowMeController creation in CLI.initialize()
  - Test ShowMeController lifecycle (start/stop)
  - Test error handling for ShowMe failures

- [ ] 2.2: Implement ShowMe integration in CLI
  - Import ShowMeController from @legion/showme
  - Create ShowMeController in initialize()
  - Start ShowMe server
  - Stop ShowMe server in shutdown()

- [ ] 2.3: Write integration test for ShowMe
  - Create CLI with real ResourceManager
  - Verify ShowMe starts on correct port
  - Verify ShowMe stops cleanly
  - NO MOCKS - real ShowMeController

- [ ] 2.4: Run all Phase 2 tests
  - Verify 100% pass rate
  - Fix any failures

### Phase 3: DisplayEngine Implementation
**Goal**: Implement DisplayEngine for Handle visualization (browser mode only for MVP)

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - DisplayEngine section

#### Steps:
- [ ] 3.1: Write unit tests for DisplayEngine
  - Test DisplayEngine constructor with ShowMeController
  - Test render() method routing
  - Test renderBrowser() method
  - Test window tracking
  - Test error handling

- [ ] 3.2: Implement DisplayEngine class
  - Create `/packages/cli/src/display/DisplayEngine.js`
  - Implement constructor accepting ShowMeController
  - Implement render() method (browser only for MVP)
  - Implement renderBrowser() - uses ShowMeController.openWindow()
  - Track open windows
  - Fail-fast on errors

- [ ] 3.3: Write integration test for DisplayEngine
  - Create real ShowMeController
  - Create DisplayEngine
  - Display real Handle (ImageHandle)
  - Verify window opens
  - Verify window tracked correctly
  - NO MOCKS - real ShowMeController, real Handle

- [ ] 3.4: Integrate DisplayEngine into CLI
  - Create DisplayEngine in CLI.initialize()
  - Pass ShowMeController to DisplayEngine
  - Store reference for command access

- [ ] 3.5: Run all Phase 3 tests
  - Verify 100% pass rate
  - Fix any failures

### Phase 4: Command Processing Infrastructure
**Goal**: Implement basic command processing and routing

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - CommandProcessor section

#### Steps:
- [ ] 4.1: Write unit tests for CommandProcessor
  - Test CommandProcessor constructor
  - Test command registration
  - Test command routing
  - Test command parsing (slash commands)
  - Test error handling (unknown commands)

- [ ] 4.2: Implement CommandProcessor class
  - Create `/packages/cli/src/commands/CommandProcessor.js`
  - Implement command registration
  - Implement command routing
  - Implement slash command parsing
  - Fail-fast on invalid commands

- [ ] 4.3: Write unit tests for BaseCommand
  - Test BaseCommand abstract class
  - Test command metadata (name, description, usage)
  - Test execute() interface

- [ ] 4.4: Implement BaseCommand class
  - Create `/packages/cli/src/commands/BaseCommand.js`
  - Define command interface
  - Provide base implementation for common functionality

- [ ] 4.5: Integrate CommandProcessor into CLI
  - Create CommandProcessor in CLI.initialize()
  - Set up command routing in main loop

- [ ] 4.6: Run all Phase 4 tests
  - Verify 100% pass rate
  - Fix any failures

### Phase 5: /show Command Implementation
**Goal**: Implement /show command for displaying Handles

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - DisplayEngine, CommandProcessor sections

#### Steps:
- [ ] 5.1: Write unit tests for ShowCommand
  - Test command parsing (/show <uri>)
  - Test option parsing (--format, --width, --height)
  - Test error handling (invalid URI)
  - Test DisplayEngine interaction

- [ ] 5.2: Implement ShowCommand class
  - Create `/packages/cli/src/commands/ShowCommand.js`
  - Extend BaseCommand
  - Parse command arguments
  - Extract Handle URI and options
  - Call DisplayEngine.render()
  - Handle and display errors

- [ ] 5.3: Register ShowCommand in CLI
  - Register /show command in CommandProcessor
  - Add command help text
  - Add command completion

- [ ] 5.4: Write integration test for /show command
  - Create CLI with real ResourceManager
  - Create real Handle (ImageHandle)
  - Execute `/show <handle-uri>`
  - Verify DisplayEngine called correctly
  - Verify window opens with Handle
  - NO MOCKS - real CLI, real Handle, real ShowMe

- [ ] 5.5: Run all Phase 5 tests
  - Verify 100% pass rate
  - Fix any failures

### Phase 6: Input/Output Handling
**Goal**: Implement interactive prompt and output formatting

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - CLI Gateway section

#### Steps:
- [ ] 6.1: Write unit tests for InputHandler
  - Test readline integration
  - Test command history
  - Test input validation
  - Test prompt display

- [ ] 6.2: Implement InputHandler class
  - Create `/packages/cli/src/handlers/InputHandler.js`
  - Integrate readline for interactive input
  - Implement command history
  - Implement prompt display
  - Fail-fast on readline errors

- [ ] 6.3: Write unit tests for OutputHandler
  - Test output formatting
  - Test success messages
  - Test error messages
  - Test colored output (chalk)

- [ ] 6.4: Implement OutputHandler class
  - Create `/packages/cli/src/handlers/OutputHandler.js`
  - Implement message formatting
  - Implement colored output
  - Implement error display

- [ ] 6.5: Integrate handlers into CLI
  - Use InputHandler for user input
  - Use OutputHandler for responses
  - Connect to CommandProcessor

- [ ] 6.6: Run all Phase 6 tests
  - Verify 100% pass rate
  - Fix any failures

### Phase 7: End-to-End Integration
**Goal**: Complete integration and end-to-end testing

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - all sections

#### Steps:
- [ ] 7.1: Write end-to-end integration test
  - Start CLI with real ResourceManager
  - Execute multiple commands
  - Create and display Handles
  - Verify all components work together
  - Test error scenarios
  - NO MOCKS - complete real flow

- [ ] 7.2: Create demo script
  - Create executable CLI entry point
  - Add package.json bin configuration
  - Test local execution

- [ ] 7.3: Manual UAT
  - Start CLI locally
  - Execute /show command with various Handles
  - Verify browser windows open correctly
  - Verify Handles display correctly
  - Test error handling
  - Document any issues found

- [ ] 7.4: Run full regression test suite
  - Run all unit tests
  - Run all integration tests
  - Verify 100% pass rate
  - Fix any failures

- [ ] 7.5: Create basic usage documentation
  - Add README.md with usage examples
  - Document available commands
  - Document Handle URI format

### Phase 8: Additional Commands (Future)
**Goal**: Implement additional CLI commands beyond /show

**Note**: These are placeholders for future work - not required for MVP

- [ ] 8.1: /help command
- [ ] 8.2: /tools command
- [ ] 8.3: /memory command
- [ ] 8.4: /session command
- [ ] 8.5: /config command

### Phase 9: Terminal Rendering (Future)
**Goal**: Add terminal rendering modes for DisplayEngine

**Note**: Browser-only rendering sufficient for MVP

- [ ] 9.1: Table rendering
- [ ] 9.2: Tree rendering
- [ ] 9.3: JSON rendering
- [ ] 9.4: Summary rendering

## Completion Criteria

### MVP Complete When:
- ✅ CLI can start and accept commands
- ✅ ShowMe integration working
- ✅ DisplayEngine can display Handles in browser
- ✅ /show command working
- ✅ Interactive prompt working
- ✅ All tests passing (100%)
- ✅ NO MOCKS in integration tests
- ✅ NO MOCKS in implementation code
- ✅ Manual UAT confirms functionality
- ✅ Basic documentation complete

### Success Metrics:
1. Can start CLI from command line
2. Can execute `/show <handle-uri>` command
3. Browser window opens in app mode (chromeless)
4. Handle displays correctly in browser
5. All tests pass without mocks
6. No silent failures (all errors raise exceptions)

## Notes

- **Design Reference**: Always refer to [DESIGN.md](./DESIGN.md) for implementation details
- **Test-First**: Write tests before implementation
- **No Shortcuts**: No mocks, no fallbacks, no silent failures
- **Phase Commits**: Commit after each completed phase
- **Update Plan**: Mark steps complete with ✅ as you proceed
- **Reread Design**: At start of each phase, reread relevant sections