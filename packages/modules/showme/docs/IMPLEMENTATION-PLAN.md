# ShowMe Handle Integration - Implementation Plan

## Overview

This plan details the implementation of Handle integration for ShowMe module, enabling display of Legion Handles in chromeless browser windows with rich introspection and interaction capabilities.

**Reference Document**: All implementation details are specified in [DESIGN.md](./DESIGN.md). This plan provides the execution sequence only.

## Implementation Approach

### Core Principles
1. **TDD Without Refactor**: Write tests first, implement correctly the first time
2. **No Mocks in Integration Tests**: Use real ResourceManager, real Handles, real services
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
1. **Read Design**: At the beginning of each phase, reread [DESIGN.md](./DESIGN.md)
2. **Write Tests First**: Unit tests, then integration tests, then implementation
3. **Run Tests Continuously**: After each implementation step
4. **Update Plan**: Mark completed steps with ✅
5. **Commit Per Phase**: Commit and push after each completed phase

## Phases and Steps

### Phase 1: Handle Detection and Resolution
**Goal**: Enable ShowMe to detect and resolve Legion Handles via ResourceManager

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Handle Integration section

#### Steps:
- [✅] 1.1: Write unit tests for Handle detection in AssetTypeDetector
  - Test Legion URI string detection (`legion://...`)
  - Test Handle instance detection (has `toURI()` and `resourceType`)
  - Test backward compatibility with traditional assets
  - Test error cases (invalid URIs, malformed Handles)

- [✅] 1.2: Implement Handle detection in AssetTypeDetector
  - Added `detect()` method returning rich result objects
  - Added `detectHandle()` helper method
  - Added `isHandleInstance(resource)` helper method
  - Returns handle type with subtype (e.g., type: 'handle', subtype: 'strategy')
  - Fail-fast on invalid inputs with clear error messages

- [✅] 1.3: Write unit tests for ResourceManager integration in ShowMeModule
  - Test ResourceManager singleton retrieval
  - Test ResourceManager stored and available
  - Test ResourceManager passed to ShowAssetTool
  - Test error handling for missing ResourceManager
  - All 19 tests passing

- [✅] 1.4: Add ResourceManager to ShowMeModule
  - Added async initialization with `_initialize()` method
  - Import ResourceManager singleton in ShowMeModule constructor
  - Store ResourceManager instance after async initialization
  - Pass ResourceManager to ShowAssetTool in options
  - Fail-fast if ResourceManager unavailable
  - Added `ensureInitialized()` method for tests

- [✅] 1.5: Write integration tests for Handle resolution flow
  - Created HandleResolution.integration.test.js with 12 tests
  - Tests complete flow: URI → detection → resolution → metadata
  - Uses real ResourceManager and strategy files (NO MOCKS)
  - Tests Handle instance detection
  - Tests error handling and backward compatibility
  - All 12 tests passing

- [✅] 1.6: Run all Phase 1 tests
  - AssetTypeDetector Handle tests: 31 passing
  - ShowMeModule ResourceManager tests: 19 passing
  - Handle resolution integration tests: 12 passing
  - **Total: 62 tests, 100% pass rate**
  - Fixed StrategyHandle.toURI() path formatting bug
  - Fixed StrategyHandle Proxy prop.startsWith() type check
  - Ready to commit

### Phase 2: HandleRenderer Implementation
**Goal**: Create generic renderer for any Handle type with introspection view

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Handle Renderer Architecture section

#### Steps:
- [ ] 2.1: Write unit tests for HandleRenderer class structure
  - Test renderer instantiation
  - Test `render(handle, container)` method signature
  - Test error handling for missing handle
  - Test error handling for invalid container

- [ ] 2.2: Create HandleRenderer base structure
  - Create `/src/renderers/HandleRenderer.js`
  - Implement constructor
  - Implement `render(handle, container)` method stub
  - Add error validation for inputs

- [ ] 2.3: Write unit tests for Handle introspection methods
  - Test `renderHeader(handle)` - extracts URI, type, server
  - Test `renderProperties(handle, schema)` - extracts properties from schema
  - Test `renderMethods(handle)` - finds callable methods
  - Test `renderCapabilities(metadata)` - formats capabilities list
  - Test `renderActions(handle)` - generates action buttons

- [ ] 2.4: Implement Handle introspection methods
  - Implement `renderHeader(handle)` helper
  - Implement `renderProperties(handle, schema)` helper
  - Implement `renderMethods(handle)` helper
  - Implement `renderCapabilities(metadata)` helper
  - Implement `renderActions(handle)` helper
  - Fail-fast on missing Handle methods (toURI, getMetadata, getSchema)

- [ ] 2.5: Write unit tests for view structure generation
  - Test complete view object structure
  - Test property formatting (name, value, type, description)
  - Test method list generation
  - Test action button structure

- [ ] 2.6: Implement view generation and display
  - Create view structure from introspection data
  - Implement `displayInWindow(view, container)` method
  - Create HTML template for Handle view
  - Add CSS styling for Handle display
  - Integrate with existing Window component

- [ ] 2.7: Write integration tests for HandleRenderer
  - Create real strategy Handle from strategy file
  - Instantiate HandleRenderer
  - Render Handle in test container
  - Verify all sections present (header, properties, methods, actions)
  - Verify Handle URI displayed correctly
  - Verify metadata extracted correctly
  - NO MOCKS - use real Handle instance

- [ ] 2.8: Run all Phase 2 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Implement HandleRenderer for generic Handle display"

### Phase 3: StrategyRenderer Implementation
**Goal**: Create specialized renderer for strategy Handles with strategy-specific features

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Strategy Renderer section

#### Steps:
- [ ] 3.1: Write unit tests for StrategyRenderer class structure
  - Test StrategyRenderer extends HandleRenderer
  - Test strategy metadata extraction
  - Test error handling for non-strategy Handles

- [ ] 3.2: Create StrategyRenderer class
  - Create `/src/renderers/StrategyRenderer.js`
  - Extend HandleRenderer base class
  - Implement constructor
  - Override `render(strategyHandle, container)` method

- [ ] 3.3: Write unit tests for strategy-specific view sections
  - Test requirements section (tools, prompts)
  - Test capabilities display
  - Test file information display
  - Test strategy actions generation

- [ ] 3.4: Implement strategy view building
  - Implement strategy metadata extraction
  - Build requirements section (requiredTools, promptSchemas)
  - Build capabilities section from metadata
  - Build file information section (path, size, modified)
  - Generate strategy-specific actions

- [ ] 3.5: Write unit tests for strategy actions
  - Test "Instantiate Strategy" action handler
  - Test "View Source" action handler
  - Test "Search Similar" action handler
  - Test error handling for each action
  - Test action button rendering

- [ ] 3.6: Implement strategy actions
  - Implement instantiation flow with context injection
  - Implement source code loading and display
  - Implement semantic search integration
  - Add success/error notifications for actions
  - Fail-fast on action errors

- [ ] 3.7: Write integration tests for StrategyRenderer
  - Create real strategy Handle (SimpleNodeTestStrategy)
  - Instantiate StrategyRenderer
  - Render strategy in test container
  - Verify strategy metadata displayed correctly
  - Verify tools and prompts listed
  - Verify file information shown
  - Verify action buttons present
  - NO MOCKS - use real strategy Handle

- [ ] 3.8: Run all Phase 3 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Implement StrategyRenderer for strategy Handle display"

### Phase 4: ShowAssetTool Handle Integration
**Goal**: Update ShowAssetTool to accept and process Handle URIs and Handle instances

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Handle Detection and Resolution section

#### Steps:
- [ ] 4.1: Write unit tests for Handle input processing in ShowAssetTool
  - Test Legion URI string input
  - Test Handle instance input
  - Test traditional asset input (backward compatibility)
  - Test error cases (invalid Handle URI, missing Handle)

- [ ] 4.2: Update ShowAssetTool.execute() for Handle detection
  - Add Handle detection using updated AssetTypeDetector
  - Branch on detected type (handle-* vs traditional asset)
  - Preserve backward compatibility for non-Handle assets

- [ ] 4.3: Write unit tests for Handle resolution
  - Test Handle resolution from URI via ResourceManager
  - Test Handle metadata extraction
  - Test Handle caching
  - Test error handling for resolution failures

- [ ] 4.4: Implement Handle resolution in ShowAssetTool
  - Add Handle resolution via ResourceManager.createHandleFromURI()
  - Extract Handle metadata
  - Cache resolved Handle
  - Fail-fast on resolution errors

- [ ] 4.5: Write unit tests for Handle storage
  - Test Handle URI storage (not full Handle instance)
  - Test Handle metadata caching
  - Test Handle retrieval and re-resolution
  - Test storage efficiency (URIs vs instances)

- [ ] 4.6: Update asset storage for Handles
  - Store Handle URIs instead of full instances
  - Store Handle metadata separately
  - Implement Handle re-resolution on retrieval
  - Update asset counter and ID generation

- [ ] 4.7: Write integration tests for Handle display flow
  - Create strategy Handle from real strategy file
  - Call ShowAssetTool.execute() with Handle instance
  - Verify Handle detected correctly
  - Verify Handle stored as URI
  - Verify metadata cached
  - Call execute() with Handle URI string
  - Verify Handle resolved correctly
  - NO MOCKS - use real ResourceManager and Handles

- [ ] 4.8: Run all Phase 4 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Add Handle support to ShowAssetTool"

### Phase 5: Actor Protocol Updates for Handles
**Goal**: Update Actor protocol to support Handle display messages

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Protocol-Based Actors section

#### Steps:
- [ ] 5.1: Write unit tests for protocol schema updates
  - Test 'display-resource' message schema
  - Test Handle URI field in schema
  - Test handle type field in schema
  - Test schema validation for Handle messages
  - Test backward compatibility with asset messages

- [ ] 5.2: Update ShowMeServerActor protocol definition
  - Add 'display-resource' to receives messages
  - Add handleURI field to schema
  - Add handleType field to schema
  - Update protocol version to 2.0.0
  - Document protocol changes

- [ ] 5.3: Write unit tests for ShowMeServerActor Handle handling
  - Test Handle URI reception
  - Test Handle resolution via ResourceManager
  - Test renderer type selection based on Handle type
  - Test message forwarding to clients
  - Test error handling for invalid Handles

- [ ] 5.4: Implement Handle handling in ShowMeServerActor
  - Add `handleDisplayResource(message)` method
  - Resolve Handle from URI using ResourceManager
  - Detect Handle type (strategy, filesystem, etc.)
  - Select appropriate renderer type
  - Send to connected clients with renderer info
  - Fail-fast on resolution or renderer selection errors

- [ ] 5.5: Write unit tests for ShowMeClientActor Handle rendering
  - Test renderer type routing
  - Test HandleRenderer usage for generic Handles
  - Test StrategyRenderer usage for strategy Handles
  - Test error handling for unknown renderer types

- [ ] 5.6: Update ShowMeClientActor for Handle rendering
  - Add renderer type detection from message
  - Route to HandleRenderer for generic Handles
  - Route to StrategyRenderer for strategy Handles
  - Implement renderer instantiation and rendering
  - Handle rendering errors gracefully

- [ ] 5.7: Write integration tests for Actor Handle messaging
  - Start real ShowMe server
  - Send 'display-resource' message with strategy Handle URI
  - Verify server resolves Handle correctly
  - Verify server selects StrategyRenderer
  - Verify client receives message with renderer type
  - Verify client renders Handle correctly
  - NO MOCKS - real Actor communication, real Handles

- [ ] 5.8: Run all Phase 5 tests
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Update Actor protocol for Handle display"

### Phase 6: App Mode Browser Launch
**Goal**: Launch browser in chromeless app mode automatically

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - Browser Launch in App Mode section

#### Steps:
- [ ] 6.1: Write unit tests for browser launch options
  - Test chrome app mode arguments generation
  - Test window size options
  - Test window position options
  - Test chrome disable flags
  - Test error handling for missing browser

- [ ] 6.2: Implement browser launch method in ShowMeServer
  - Add `launchBrowser(url, options)` method to ShowMeServer
  - Import `open` package
  - Build chrome app mode argument array
  - Include window size, position, and disable flags
  - Fail-fast if browser launch fails

- [ ] 6.3: Write unit tests for launch integration
  - Test launch triggered on first display
  - Test browser reuse for subsequent displays
  - Test launch option defaults
  - Test launch option overrides

- [ ] 6.4: Integrate browser launch with ShowMeServer start
  - Track whether browser has been launched
  - Detect first asset/Handle display
  - Call launchBrowser() automatically
  - Log launch success/failure
  - Handle multiple windows if needed

- [ ] 6.5: Write integration tests for browser launch
  - Start ShowMe server
  - Send display request (Handle or asset)
  - Verify browser process launched
  - Verify app mode flags present in process args
  - Verify window size/position correct
  - Manual verification: Check browser has no chrome (no tabs, URL bar, etc.)
  - NO MOCKS - real browser launch

- [ ] 6.6: Run all Phase 6 tests
  - Verify 100% pass rate (excluding manual verification)
  - Fix any failures
  - Commit: "feat: Add chromeless browser launch in app mode"

### Phase 7: End-to-End Integration Testing
**Goal**: Test complete flow from tool call to Handle display in chromeless browser

**Prerequisites**: Read [DESIGN.md](./DESIGN.md) - All sections

#### Steps:
- [ ] 7.1: Write end-to-end integration test for strategy Handle display
  - Create real strategy Handle from SimpleNodeTestStrategy file
  - Start ShowMe server
  - Call ShowAssetTool.execute() with Handle URI
  - Verify Actor message sent correctly
  - Verify server resolves Handle
  - Verify server selects StrategyRenderer
  - Verify client receives and renders Handle
  - Verify browser launches in app mode
  - NO MOCKS - complete real flow

- [ ] 7.2: Test strategy Handle introspection display
  - Display SimpleNodeTestStrategy Handle
  - Verify strategy metadata shown (name, type)
  - Verify tools listed (file_write, file_read, command_executor)
  - Verify prompts listed (analyzeCode, generateTest, generateTestConfig)
  - Verify file information shown (path, size, modified)
  - Verify action buttons present

- [ ] 7.3: Test Handle action functionality
  - Click "Copy URI" action - verify clipboard
  - Click "View JSON" action - verify JSON display
  - Test strategy-specific actions if accessible
  - Verify all actions complete successfully
  - Verify error handling for failed actions

- [ ] 7.4: Test different Handle types
  - Display strategy Handle → verify StrategyRenderer used
  - Display file Handle → verify HandleRenderer used (generic)
  - Verify renderer selection logic works correctly

- [ ] 7.5: Test error scenarios end-to-end
  - Invalid Handle URI
  - Non-existent strategy file
  - ResourceManager unavailable
  - Browser launch failure
  - Renderer instantiation failure
  - Verify all fail fast with clear error messages

- [ ] 7.6: Test backward compatibility
  - Display traditional assets (image, JSON, table)
  - Verify existing renderers still work
  - Verify no regressions in asset display
  - Verify Handle and asset displays can coexist

- [ ] 7.7: Manual UAT
  - Start ShowMe server
  - Display strategy Handle via ShowAssetTool
  - Verify browser window is chromeless (no tabs, URL bar)
  - Verify all UI sections present and formatted correctly
  - Verify all actions work
  - Verify window size and position correct
  - Test multiple Handle displays
  - Document any issues found

- [ ] 7.8: Run all tests (full regression)
  - Run all unit tests across all phases
  - Run all integration tests across all phases
  - Verify 100% pass rate
  - Fix any failures
  - Commit: "feat: Complete ShowMe Handle integration with app mode launch"
  - Push all commits

## Completion Criteria

### All Phases Complete When:
- ✅ All unit tests passing (100%)
- ✅ All integration tests passing (100%)
- ✅ NO MOCKS in any integration tests
- ✅ NO MOCKS in any implementation code
- ✅ Strategy Handles display correctly in chromeless browser
- ✅ All Handle metadata and actions visible and functional
- ✅ Browser launches in app mode (no chrome)
- ✅ Actor messages flow correctly Tool → Server → Browser
- ✅ Backward compatibility maintained for traditional assets
- ✅ All code committed and pushed
- ✅ Manual UAT confirms full functionality

### Success Metrics:
1. Can display any Handle via ShowAssetTool with Handle URI
2. StrategyRenderer shows all strategy metadata correctly
3. Browser launches automatically in chromeless mode
4. Actor protocol supports Handle display messages
5. Generic HandleRenderer works for non-strategy Handles
6. All tests pass without mocks
7. No silent failures (all errors raise exceptions)
8. Traditional asset display still works (backward compatible)

## Notes

- **Design Reference**: Always refer to [DESIGN.md](./DESIGN.md) for implementation details
- **Test-First**: Write tests before implementation in every step
- **No Shortcuts**: No mocks in integration tests, no fallbacks, no silent failures
- **Phase Commits**: Commit after each completed phase
- **Update Plan**: Mark steps complete with ✅ as you proceed
- **Reread Design**: At start of each phase, reread relevant design sections
- **Real Strategy File**: Use SimpleNodeTestStrategy.js for all integration tests