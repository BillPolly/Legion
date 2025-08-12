# Tool Registry UI - Test Documentation

## Overview

The Tool Registry UI application has comprehensive test coverage including unit tests, integration tests, and end-to-end tests using jsdom for full UI testing.

## Test Structure

```
__tests__/
├── helpers/              # Test utilities and mocks
│   ├── mockActors.js    # Mock actor implementations
│   └── domHelpers.js    # jsdom testing utilities
├── unit/                # Unit tests
│   ├── model/          # Model tests
│   ├── view/           # View tests (with jsdom)
│   └── viewmodel/      # ViewModel tests
├── integration/        # Integration tests
│   └── actors/         # Actor communication tests
└── e2e/               # End-to-end workflow tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # End-to-end tests only

# Run UI-specific tests (view tests + e2e)
npm run test:ui

# Development
npm run test:watch        # Watch mode for TDD
npm run test:verbose      # Verbose output for debugging

# Generate coverage report
npm run test:coverage
```

## Test Coverage

The test suite ensures 80% minimum coverage across:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Coverage reports are generated in:
- Terminal output (text)
- `coverage/lcov-report/index.html` (HTML report)
- `coverage/lcov.info` (LCOV format for CI)

## Unit Tests

### Model Tests
- State management and initialization
- Tool filtering and search
- Collection management
- Vector search results
- State persistence to localStorage
- Event emission and handling

### View Tests (with jsdom)
- Full DOM rendering and manipulation
- Tab switching behavior
- Tool list rendering and selection
- Tool execution UI
- Database collection views
- Semantic search interface
- Loading states and error displays
- CSS injection and cleanup

### ViewModel Tests
- Model-view synchronization
- Actor message handling
- Event flow coordination
- Error handling and recovery
- State management across tabs

## Integration Tests

### Actor Communication
- WebSocket handshake protocol
- Message routing between actors
- Tool registry actor operations
- Database actor operations
- Semantic search actor operations
- Error handling and reconnection
- Performance under load

## End-to-End Tests

### Complete Workflows
- Tool discovery → selection → execution
- Database browsing and document viewing
- Semantic search and results display
- Multi-tab state management
- Error recovery scenarios
- Loading states and performance
- Keyboard navigation

## Key Testing Principles

### No Mocking of Legion Services
Tests use real Legion components:
- Real `ToolRegistry` instances
- Real `ResourceManager` 
- Real tool modules (FileModule, CalculatorModule, etc.)

### Full DOM Testing with jsdom
- Complete DOM manipulation testing
- Real event handling
- CSS style verification
- Element visibility checks
- Form interaction testing

### Umbilical Protocol Compliance
All components are tested for:
- Introspection mode
- Validation mode
- Instance creation mode

### Actor Protocol Testing
- WebSocket communication patterns
- GUID-based message routing
- Handshake protocols
- Reconnection handling

## Test Helpers

### Mock Actors (`mockActors.js`)
Provides mock implementations of:
- `MockToolRegistryActor`
- `MockDatabaseActor`
- `MockSemanticSearchActor`
- `createMockActorSpace()`
- `createConnectedMockActors()`

### DOM Helpers (`domHelpers.js`)
Utilities for jsdom testing:
- `querySelector()` - Query with better errors
- `click()` - Simulate clicks
- `type()` - Simulate typing
- `waitForElement()` - Wait for elements
- `waitForText()` - Wait for text content
- `isVisible()` - Check visibility
- `hasClass()` - Check CSS classes
- `createTestContainer()` - Create test DOM
- `cleanupTestContainer()` - Cleanup

## Writing New Tests

### Unit Test Template
```javascript
describe('ComponentName', () => {
  let component;
  
  beforeEach(() => {
    component = new ComponentName();
  });
  
  afterEach(() => {
    component.destroy();
  });
  
  test('should do something', () => {
    // Test implementation
    expect(component.someMethod()).toBe(expected);
  });
});
```

### UI Test Template
```javascript
test('should handle user interaction', async () => {
  // Setup
  const container = createTestContainer();
  const view = new View(container);
  
  // Action
  const button = querySelector(container, '.button');
  click(button);
  await waitForUpdates();
  
  // Assert
  const result = await waitForElement(container, '.result');
  expect(getText(result)).toContain('Expected text');
  
  // Cleanup
  view.destroy();
  cleanupTestContainer();
});
```

## Continuous Integration

The test suite is designed for CI/CD pipelines:

1. **Pre-commit**: Run unit tests
2. **Pull Request**: Run full test suite with coverage
3. **Merge**: Run e2e tests
4. **Deploy**: Run smoke tests

## Debugging Tests

### Verbose Output
```bash
npm run test:verbose
```

### Debug Single Test
```bash
NODE_OPTIONS='--experimental-vm-modules' jest --verbose --testNamePattern="should handle tool execution"
```

### Debug with Node Inspector
```bash
NODE_OPTIONS='--experimental-vm-modules --inspect-brk' jest --runInBand
```

## Common Issues

### jsdom Limitations
- `getBoundingClientRect()` is mocked in `jest.setup.js`
- `scrollIntoView()` is a no-op
- Canvas/WebGL operations are not supported

### Async Testing
- Always use `await waitForUpdates()` after DOM changes
- Use `await nextTick()` for promise resolution
- Set appropriate timeouts for async operations

### WebSocket Testing
- Mock WebSocket is provided in `jest.setup.js`
- Use `_simulateMessage()` to simulate incoming messages
- Check `_lastSent` for outgoing messages

## Performance Benchmarks

Expected test execution times:
- Unit tests: < 5 seconds
- Integration tests: < 10 seconds
- E2E tests: < 15 seconds
- Full suite: < 30 seconds

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure 80% coverage minimum
3. Follow existing test patterns
4. Update this documentation

## License

Same as Legion project