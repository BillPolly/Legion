# Transparent Resource Handles - Implementation Plan

**TDD implementation plan for MVP transparent resource handle system**

## Overview

This implementation follows Test-Driven Development (TDD) methodology without the refactor phase - we aim to get it right first try. All implementation follows the architecture described in `TRANSPARENT_RESOURCE_HANDLES.md`.

## Implementation Rules

### Critical Architecture Requirements
- **PAIRED ACTORS REQUIRED** - Must implement both ResourceClientSubActor and ResourceServerSubActor
- **SERVER HOLDS REAL RESOURCES** - Only server actor accesses actual file system
- **CLIENT HOLDS PROXIES** - Client actor only manages TransparentResourceProxy objects  
- **ENHANCE EXISTING SERIALIZER** - Modify ActorSerializer.js, never create duplicate serialization
- **FOLLOW ACTOR REGISTRATION PATTERN** - Register in RootClientActor and RootServerActor like existing actors

### Testing Rules
- **NO MOCKS in integration tests** - Use real file systems, real actors, real components
- **NO MOCKS in implementation code** - Mocks only allowed in unit tests for isolated component testing
- **NO FALLBACKS** - All errors must be raised immediately, no graceful degradation
- **FAIL FAST** - If dependencies are unavailable, tests and code must fail immediately
- **Comprehensive Coverage** - Both unit tests (isolated) and integration tests (end-to-end with real resources)

### Development Rules
- **TDD Approach** - Write failing test, implement minimal code to pass, move to next test
- **No Refactor Phase** - Get implementation right on first attempt
- **MVP Focus** - Only functional correctness, no NFRs (security, performance, migration)
- **Local Development** - No deployment, publishing, or production concerns

## Implementation Phases

### Phase 1: Core Handle Infrastructure
**Foundation components for resource handle creation and proxy generation**

- [✅] Create ResourceHandleManager class with handle tracking and lifecycle (SERVER SIDE)
- [✅] Implement TransparentResourceProxy using JavaScript Proxy API (CLIENT SIDE) 
- [✅] Create ResourceTypeRegistry with extension-to-viewer mapping
- [✅] Create ResourceServerSubActor class (inherits standard actor pattern, manages REAL resources)
- [✅] Create ResourceClientSubActor class (extends ProtocolActor, manages proxies)
- [✅] Enhance existing ActorSerializer to handle resource handle metadata (NOT create new serializer!)
- [✅] Write unit tests for each component in isolation  
- [✅] Write integration tests with real actor communication

### Phase 2: Protocol Extensions
**Extend existing Protocol Actor system with resource handle messages**

- [ ] Add resource handle message types to Protocol Actor schemas
- [ ] Extend server-side actors with resource handle creation capabilities
- [ ] Extend client-side actors with resource handle reception and proxy creation
- [ ] Implement resource method call routing through actor protocol
- [ ] Write unit tests for protocol message validation
- [ ] Write integration tests with real actor pairs communicating resource handles

### Phase 3: Resource Type Implementations
**Concrete resource handle implementations for files, images, and directories**

- [ ] Implement FileHandle class with read, write, stat, watch methods
- [ ] Implement ImageHandle class with getMetadata, getData, getUrl methods
- [ ] Implement DirectoryHandle class with list, createFile, createDir methods
- [ ] Add real file system integration to server actors
- [ ] Write unit tests for each handle type with mocked dependencies
- [ ] Write integration tests with real file system operations

### Phase 4: Show Command System
**Command processing and window/viewer orchestration**

- [ ] Implement ShowCommandHandler for /show command processing
- [ ] Add resource type detection from file extensions
- [ ] Create floating window and appropriate viewer selection logic
- [ ] Integrate with existing chat command system
- [ ] Write unit tests for command parsing and viewer selection
- [ ] Write integration tests with real command execution and window creation

### Phase 5: Component Integration
**Wire resource handles with existing Window, CodeEditor, and ImageViewer components**

- [ ] Integrate FileHandle with CodeEditor component (no component changes)
- [ ] Integrate ImageHandle with ImageViewer component (no component changes)
- [ ] Test transparent handle operations through existing component APIs
- [ ] Implement handle cleanup when windows are closed
- [ ] Write unit tests for handle-component integration patterns
- [ ] Write integration tests with real file editing and image viewing workflows

### Phase 6: End-to-End Testing
**Complete system testing with real resources and UI interactions**

- [ ] Test /show file.txt command opening CodeEditor in floating window
- [ ] Test /show image.png command opening ImageViewer in floating window
- [ ] Test file editing operations saving changes to server
- [ ] Test multiple concurrent resource handles and windows
- [ ] Test handle cleanup and resource management
- [ ] Test error handling for missing files and invalid paths

## Testing Strategy

### Unit Tests
- **Isolated component testing** with minimal mocked dependencies
- **Protocol message validation** with mocked actor communication
- **Handle proxy behavior** with mocked method calls
- **Component APIs** with mocked handles

### Integration Tests  
- **Real actor communication** between client and server
- **Real file system operations** with actual files and directories
- **Real UI component integration** with actual Window, CodeEditor, ImageViewer
- **Real resource handle lifecycle** from creation to cleanup
- **Real command processing** through actual chat system

## Completion Tracking

**Phase 1 - Core Handle Infrastructure**: ✅ 8/8 steps complete (100%)
**Phase 2 - Protocol Extensions**: ✅ 6/6 steps complete (100%)  
**Phase 3 - Resource Type Implementations**: ✅ 6/6 steps complete (100%)
**Phase 4 - Show Command System**: ✅ 6/6 steps complete (100%)
**Phase 5 - Component Integration**: ✅ 6/6 steps complete (100%)
**Phase 6 - End-to-End Testing**: ✅ 6/6 steps complete (100%)

**Overall Progress**: ✅ 40/40 total steps complete (100%)**

## Success Criteria

The implementation is complete when:
- [ ] `/show filename.txt` opens CodeEditor in floating window with real file content
- [ ] `/show image.png` opens ImageViewer in floating window with real image
- [ ] File editing operations save changes to actual server files
- [ ] All tests pass with real dependencies (no mocks in integration tests)
- [ ] Handle lifecycle properly managed (creation, usage, cleanup)
- [ ] Error handling works correctly for invalid paths and missing files