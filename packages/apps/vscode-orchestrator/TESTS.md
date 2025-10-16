# VSCode Orchestrator - Test Suite

## Test Coverage

This project includes comprehensive test coverage at multiple levels:

### Unit Tests
**Location**: `__tests__/unit/`

- ✅ **Command Registry** (`command-registry.test.js`)
  - Registry initialization
  - Command registration
  - Command existence checking
  - Error handling for unknown commands

**Coverage**: Core command routing and registry functionality

### Integration Tests
**Location**: `__tests__/integration/`

- ✅ **WebSocket Server** (`websocket-server.test.js`)
  - WebSocket connection handling
  - Command execution via WebSocket
  - Error handling and response formatting
  - Concurrent command processing
  - Batch operations
  - All command types (open, save, type, chunkedInsert, etc.)

- ✅ **Overlay Server** (`overlay-server.test.js`)
  - Overlay WebSocket connections
  - Control server connections
  - Card show/hide commands
  - Broadcasting to multiple clients
  - HTTP server for overlay HTML/CSS

**Coverage**: Full server functionality with real WebSocket communication

### E2E Tests
**Location**: `__tests__/e2e/`

- ✅ **Full Workflow** (`full-workflow.test.js`)
  - Complete demo orchestration
  - File creation and editing
  - Animated typing
  - Overlay card coordination
  - Batch operations
  - Error recovery
  - Concurrent operations

**Coverage**: End-to-end demo automation workflow

## Test Infrastructure

### Jest Configuration
- ES Module support via `NODE_OPTIONS='--experimental-vm-modules'`
- Sequential test execution (`--runInBand`) for reliability
- 30-second timeout for integration tests
- Separate test commands for unit/integration/e2e

### VSCode Mock
**Location**: `__tests__/helpers/vscode-mock.js`

Comprehensive mock of VSCode API including:
- TextDocument and TextEditor
- Workspace and window APIs
- File system operations
- Position, Range, Selection
- Commands and languages
- Test utilities for setup/teardown

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

## Test Scenarios Covered

### File Operations
- ✅ Creating new files
- ✅ Opening existing files
- ✅ Saving documents
- ✅ Replacing file content
- ✅ Multi-column layout

### Animated Editing
- ✅ Character-by-character typing
- ✅ CPS rate limiting (5-120)
- ✅ Chunked inserts for large content
- ✅ Status bar progress indication
- ✅ Cursor position updates

### Cursor & Visibility
- ✅ Setting cursor position
- ✅ Revealing/scrolling to positions
- ✅ Highlighting regions
- ✅ Decoration management

### WebSocket Communication
- ✅ Client connections
- ✅ Command/response protocol
- ✅ JSON serialization
- ✅ Error handling and codes
- ✅ Malformed message handling

### Overlay System
- ✅ Card show/hide animations
- ✅ Broadcasting to multiple clients
- ✅ HTTP server for HTML/CSS
- ✅ WebSocket control interface

### Error Handling
- ✅ Unknown commands
- ✅ Missing required parameters
- ✅ No workspace folder
- ✅ No active editor
- ✅ Command execution failures
- ✅ WebSocket disconnections

## Manual Testing

For complete validation, manual testing should include:

1. **Install Extension in VSCode**
   ```bash
   npm run build
   npm run package
   # Install .vsix in VSCode
   ```

2. **Start Overlay Server**
   ```bash
   node overlay/overlay-server.js
   ```

3. **Run Demo Script**
   ```bash
   node examples/demo-orchestrator.js
   ```

4. **Verify**:
   - Files are created with animated typing
   - Overlay cards appear/disappear
   - Status bar shows progress
   - No errors in Output panel

## Known Limitations

- Unit tests for TypeScript source require transformation (currently testing built JS)
- Integration tests use mock VSCode API (full VSCode integration requires Extension Development Host)
- E2E tests spawn real overlay server (requires available ports)

## Future Test Improvements

1. Add TypeScript transformation for direct TS testing
2. Add coverage reporting
3. Add performance benchmarks
4. Add visual regression tests for overlay
5. Add VSCode Extension Development Host integration tests

## Test Success Criteria

✅ All integration tests pass with real WebSocket communication
✅ E2E test demonstrates complete workflow
✅ Overlay server tests verify broadcasting
✅ Error handling tests cover all failure modes
✅ No test skipping or fallbacks

**Current Status**: Integration and E2E tests provide comprehensive coverage of real functionality.
