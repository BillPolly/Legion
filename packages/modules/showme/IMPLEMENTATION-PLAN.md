# ShowMe Module - TDD Implementation Plan

## Overview
Implementation of ShowMe module for Legion framework - a generic asset display system that intelligently detects and displays any asset type in appropriate floating windows.

## Implementation Methodology
- **Test-Driven Development (TDD)** without refactor phase
- **NO MOCKS** in integration tests or implementation code  
- **Fail-fast** approach with no fallbacks
- **MVP Focus** - functional correctness over NFRs
- **100% Test Pass Rate** requirement

## Phase Status

### ✅ Phase 1: Foundation & Core Detection (COMPLETED)
**Status: 100% Complete - 95/95 tests passing**

**Completed Components:**
1. **Jest Configuration** - ES6 modules support for Legion framework
2. **AssetTypeDetector** - Multi-stage intelligent detection:
   - Detection order: Web → Image → Tabular → JSON → Code → Text  
   - Hint validation and override support
   - Edge case handling (circular refs, large datasets, Unicode)
3. **ShowAssetTool** - Core tool with comprehensive functionality
4. **ShowMeModule** - Legion framework integration
5. **Comprehensive Testing** - Unit, integration, end-to-end coverage

**Key Features Delivered:**
- Multi-format support (PNG, JPEG, JSON, CSV, JS, Python, HTML, text)
- Magic number detection for images
- Pattern-based content analysis
- Robust error handling
- Performance tested (10k+ items, rapid execution)
- Unicode and special character support

**Test Coverage:**
- 41 unit tests - AssetTypeDetector
- 20 integration tests - Real file operations
- 14 unit tests - ShowMeModule  
- 20 unit tests - ShowAssetTool
- 15 integration tests - End-to-end scenarios

### 🔄 Phase 2: UI Components & Display System (IN PROGRESS)
**Status: 85% Complete - Major refactoring to MVVM completed**

**Components Completed:**
1. ✅ **WindowManager** - Floating window lifecycle management (44 tests passing)
2. **DisplayRenderers** - Asset-specific rendering components:
   - ✅ ImageRenderer (PNG, JPEG display) - 15 tests passing
   - ✅ JSONRenderer (formatted JSON with syntax highlighting) - 20 tests passing
   - ✅ CodeRenderer (syntax-highlighted code display) - 25 tests passing
   - ✅ TableRenderer (MVVM refactored with sorting/filtering) - Testing pending
   - ❌ WebRenderer (HTML/URL display) - Not started
   - ❌ TextRenderer (plain text display) - Not started

3. **Shared Components (MVVM Pattern):**
   - ✅ BaseUmbilicalComponent - Legion base component integration
   - ✅ ShowMeBaseComponent - ShowMe-specific base component
   - ✅ SearchInput - Real-time search with debouncing (30 tests passing)
   - ✅ PaginationControls - Page navigation (31 tests passing)
   - ✅ Button - Reusable button component (24 tests passing)
   - ✅ TableViewModel - MVVM state management (43 tests passing)

4. **WindowComponents** - UI building blocks:
   - ❌ WindowFrame (title bar, controls, resizing) - Not started
   - ❌ WindowContent (scrollable content area) - Not started
   - ❌ WindowToolbar (zoom, search, export controls) - Not started

**Major Refactoring Completed:**
- Migrated from monolithic renderers to MVVM pattern
- Implemented umbilical protocol for all components
- Created reusable shared components following Legion patterns
- Separated business logic (ViewModels) from presentation (Components)

**Test Status:**
- ✅ Unit tests for WindowManager (44 passing)
- ✅ Unit tests for ImageRenderer (15 passing)
- ✅ Unit tests for JSONRenderer (20 passing)
- ✅ Unit tests for CodeRenderer (25 passing)
- ✅ Unit tests for SearchInput (30 passing)
- ✅ Unit tests for PaginationControls (31 passing)
- ✅ Unit tests for Button (24 passing)
- ✅ Unit tests for TableViewModel (43 passing)
- 🔄 Unit tests for TableRenderer (44 tests - verification pending)
- ❌ Integration tests for complete UI system - Not started

### 📋 Phase 3: Window Management & Interaction (PLANNED)
**Status: Not Started - 0% Complete**

**Components to Plan:**
1. **WindowState** - Position, size, z-order management
2. **WindowEvents** - User interaction handling
3. **WindowPersistence** - State saving/restoration
4. **MultiWindow** - Managing multiple concurrent windows

### 📋 Phase 4: Advanced Display Features (PLANNED)
**Status: Not Started - 0% Complete**

**Components to Plan:**
1. **Search & Filter** - Content searching within displays
2. **Export Functionality** - Save/print displayed content
3. **Theming System** - Light/dark modes, custom themes
4. **Accessibility** - Screen reader, keyboard navigation

### 📋 Phase 5: Performance & Optimization (PLANNED)
**Status: Not Started - 0% Complete**

**Components to Plan:**
1. **Virtual Scrolling** - Large dataset handling
2. **Lazy Loading** - Progressive content loading
3. **Memory Management** - Window cleanup and GC
4. **Caching System** - Rendered content caching

### 📋 Phase 6: Legion Integration (PLANNED)
**Status: Not Started - 0% Complete**

**Components to Plan:**
1. **Actor Integration** - Legion actor system compatibility
2. **Event System** - Legion event bus integration
3. **Resource Management** - ResourceManager integration
4. **Configuration** - Legion config system integration

### 📋 Phase 7: Production Readiness (PLANNED)
**Status: Not Started - 0% Complete**

**Components to Plan:**
1. **Error Recovery** - Graceful failure handling
2. **Logging & Telemetry** - Operational monitoring
3. **Documentation** - API docs, usage examples
4. **Performance Metrics** - Benchmarking and profiling

## Current Implementation Status

**Files Implemented:**
```
src/
├── index.js                           ✅ Module entry point
├── ShowMeModule.js                    ✅ Main module class  
├── detection/
│   └── AssetTypeDetector.js          ✅ Multi-stage detection
├── tools/
│   └── ShowAssetTool.js              ✅ Core display tool
├── display/
│   └── WindowManager.js              ✅ Window lifecycle management
├── renderers/
│   ├── ImageRenderer.js              ✅ Image display renderer
│   ├── JSONRenderer.js               ✅ JSON formatter/highlighter
│   ├── CodeRenderer.js               ✅ Code syntax highlighter
│   └── TableRenderer.js              ✅ MVVM table with sorting/filtering
├── components/
│   ├── base/
│   │   └── ShowMeBaseComponent.js    ✅ Base component with umbilical protocol
│   ├── button/
│   │   └── Button.js                 ✅ Reusable button component
│   ├── search-input/
│   │   └── SearchInput.js            ✅ Search with debouncing
│   └── pagination-controls/
│       └── PaginationControls.js     ✅ Pagination navigation
└── viewmodels/
    └── TableViewModel.js              ✅ MVVM state for tables

__tests__/
├── setup.js                          ✅ Test environment
├── unit/
│   ├── ShowMeModule.test.js          ✅ Module tests (14 tests)
│   ├── detection/
│   │   └── AssetTypeDetector.test.js ✅ Detection tests (41 tests)
│   ├── tools/
│   │   └── ShowAssetTool.test.js     ✅ Tool tests (20 tests)
│   ├── display/
│   │   └── WindowManager.test.js     ✅ Window tests (44 tests)
│   ├── renderers/
│   │   ├── ImageRenderer.test.js     ✅ Image tests (15 tests)
│   │   ├── JSONRenderer.test.js      ✅ JSON tests (20 tests)
│   │   ├── CodeRenderer.test.js      ✅ Code tests (25 tests)
│   │   └── TableRenderer.test.js     🔄 Table tests (44 tests - pending)
│   ├── components/
│   │   ├── button/
│   │   │   └── Button.test.js        ✅ Button tests (24 tests)
│   │   ├── search-input/
│   │   │   └── SearchInput.test.js   ✅ Search tests (30 tests)
│   │   └── pagination-controls/
│   │       └── PaginationControls.test.js ✅ Pagination tests (31 tests)
│   └── viewmodels/
│       └── TableViewModel.test.js    ✅ ViewModel tests (43 tests)
└── integration/
    ├── AssetDetection.test.js        ✅ Real file tests (20 tests)
    └── ShowMeModule.test.js          ✅ E2E tests (15 tests)
```

**Test Summary:**
- Phase 1: 95 tests passing (100% complete)
- Phase 2: 232 tests passing + 44 pending verification
- Total: 327 tests passing + 44 pending = 371 tests total

**Next Immediate Steps:**
1. Run TableRenderer tests to verify MVVM refactoring (44 tests pending)
2. Create WebRenderer for HTML/URL display with tests
3. Create TextRenderer for plain text display with tests
4. Implement WindowComponents (WindowFrame, WindowContent, WindowToolbar)
5. Complete Phase 2 integration tests
6. Begin Phase 3: Window Management & Interaction

## Implementation Notes

- **ResourceManager Integration**: All environment access via singleton
- **Legion Patterns**: Follow established module/tool interfaces  
- **Actor Compatibility**: Future integration with Legion actor system
- **WebSocket Communication**: Frontend communication (no REST APIs)
- **MVVM Pattern**: UI components with 2-way state binding
- **No Backwards Compatibility**: Single implementation approach
- **TDD Methodology**: Tests first, implementation second
- **Clean Architecture**: Uncle Bob's principles throughout