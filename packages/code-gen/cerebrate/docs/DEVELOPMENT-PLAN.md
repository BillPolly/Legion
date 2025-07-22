# Cerebrate - TDD Development Plan

This document outlines the comprehensive Test-Driven Development plan for implementing Cerebrate, the AI-powered Chrome DevTools extension. Each phase follows Red-Green methodology: write failing tests first, then implement code to make them pass.

## Prerequisites ✅

- [ ] Legion monorepo setup completed
- [ ] `@legion/agent`, `@legion/module-loader`, `@legion/llm` packages available
- [ ] Node.js >= 18.0.0 and npm >= 8.0.0 installed
- [ ] Chrome/Chromium browser >= 90 available for testing
- [ ] Basic project structure already scaffolded

---

## Phase 1: Foundation & Protocol System 🏗️

### 1.1 Message Protocol Foundation
- [x] **Write tests for message format validation**
  - Test base message structure with required fields
  - Test message ID generation and uniqueness
  - Test timestamp format validation
  - Test payload structure validation
- [x] **Implement core message protocol**
  - Create `src/shared/protocol/MessageProtocol.js`
  - Implement message validation functions
  - Add message ID generation utilities
  - Create message type constants

### 1.2 WebSocket Communication Protocol
- [x] **Write tests for WebSocket message handling**
  - Test message serialization/deserialization
  - Test command message validation
  - Test response message formatting
  - Test error message structure
- [x] **Implement WebSocket protocol handlers**
  - Create `src/shared/protocol/WebSocketProtocol.js`
  - Implement message serialization utilities
  - Add protocol validation functions
  - Create protocol constants and types

### 1.3 Session Management System
- [x] **Write tests for session lifecycle**
  - Test session creation and initialization
  - Test session expiration handling
  - Test session cleanup on disconnect
  - Test multi-session management
- [x] **Implement session management**
  - Create `src/server/SessionManager.js`
  - Implement session creation and tracking
  - Add session expiration and cleanup
  - Create session state management

---

## Phase 2: WebSocket Server Infrastructure 🔌

### 2.1 Core WebSocket Server
- [x] **Write tests for WebSocket server setup**
  - Test server initialization and startup
  - Test WebSocket connection acceptance
  - Test connection handshake validation
  - Test server shutdown and cleanup
- [x] **Implement WebSocket server foundation**
  - Create `src/server/debug-server.js`
  - Implement WebSocket server setup
  - Add connection lifecycle management
  - Create server configuration system

### 2.2 Connection Management
- [x] **Write tests for connection handling**
  - Test multiple concurrent connections
  - Test connection state tracking
  - Test graceful connection termination
  - Test connection error recovery
- [x] **Implement connection manager**
  - Create `src/server/connection-manager.js`
  - Implement connection tracking system
  - Add connection state management
  - Create connection cleanup utilities

### 2.3 Message Router System
- [x] **Write tests for message routing**
  - Test command message routing to agent
  - Test response message routing to client
  - Test event message broadcasting
  - Test message validation and filtering
- [x] **Implement message router**
  - Create `src/server/message-router.js`
  - Implement message routing logic
  - Add message validation middleware
  - Create routing error handling

---

## Phase 3: Legion Agent Integration 🤖

### 3.1 Agent Controller Interface
- [x] **Write tests for agent controller**
  - Test Legion Agent initialization
  - Test command execution through agent
  - Test agent response handling
  - Test agent error propagation
- [x] **Implement agent controller**
  - Create `src/server/agent-controller.js`
  - Integrate with `@legion/agent` package
  - Implement command execution interface
  - Add agent configuration management

### 3.2 Debug Command Processing
- [x] **Write tests for debug commands**
  - Test `inspect_element` command processing
  - Test `analyze_javascript` command handling
  - Test `debug_error` command execution
  - Test command parameter validation
- [x] **Implement debug command handlers**
  - Create `src/server/protocol/commands.js`
  - Implement DOM inspection commands
  - Add code analysis command handlers
  - Create error investigation commands

### 3.3 Response Formatting System
- [x] **Write tests for response formatting**
  - Test success response structure
  - Test error response formatting
  - Test progress event generation
  - Test metadata inclusion in responses
- [x] **Implement response formatters**
  - Create `src/server/protocol/responses.js`
  - Implement response standardization
  - Add metadata extraction utilities
  - Create error response formatters

---

## Phase 4: Chrome Extension Foundation 🔧

### 4.1 Extension Manifest and Structure
- [x] **Write tests for extension structure validation**
  - Test manifest.json format and permissions
  - Test extension file loading
  - Test permission validation
  - Test extension initialization
- [x] **Implement Chrome extension foundation**
  - Create `src/extension/manifest.json`
  - Implement extension file structure
  - Add required permissions configuration
  - Create extension build process

### 4.2 DevTools Integration
- [x] **Write tests for DevTools panel creation**
  - Test DevTools panel registration
  - Test panel loading and initialization
  - Test DevTools API integration
  - Test panel visibility and lifecycle
- [x] **Implement DevTools integration**
  - Create `src/extension/devtools.js`
  - Implement DevTools panel creation
  - Add panel lifecycle management
  - Create DevTools API wrappers

### 4.3 Background Service Worker
- [x] **Write tests for background worker**
  - Test service worker registration
  - Test extension lifecycle events
  - Test background message handling
  - Test worker persistence and cleanup
- [x] **Implement background service worker**
  - Create `src/extension/background.js`
  - Implement extension event handling
  - Add background task management
  - Create service worker utilities

---

## Phase 5: WebSocket Client Implementation 📡

### 5.1 Client WebSocket Connection
- [x] **Write tests for WebSocket client**
  - Test connection establishment to debug server
  - Test connection state management
  - Test automatic reconnection logic
  - Test connection error handling
- [x] **Implement WebSocket client**
  - Create `src/extension/WebSocketClient.js`
  - Implement connection management
  - Add reconnection logic with exponential backoff
  - Create connection state monitoring

### 5.2 Command Interface System
- [x] **Write tests for command interface**
  - Test command creation and validation
  - Test command queueing and execution
  - Test response correlation and handling
  - Test timeout and error handling
- [x] **Implement command interface**
  - Create `src/extension/CommandInterface.js`
  - Implement command queuing system
  - Add response correlation tracking
  - Create timeout and retry logic

### 5.3 Real-time Event Handling
- [x] **Write tests for event processing**
  - Test progress event handling
  - Test agent suggestion events
  - Test page state change events
  - Test event filtering and routing
- [x] **Implement event handlers**
  - Create `src/extension/EventHandler.js`
  - Implement event processing pipeline
  - Add event filtering and categorization
  - Create event state management

---

## Phase 6: DevTools Panel UI 🎨

### 6.1 Panel HTML Structure and Styling
- [x] **Write tests for UI structure**
  - Test HTML element creation and structure
  - Test CSS class application and styling
  - Test responsive design and layout
  - Test accessibility compliance
- [x] **Implement panel UI structure**
  - Create `src/extension/PanelUI.js` (comprehensive UI class)
  - Implement panel layout and styling with CSS-in-JS
  - Add responsive design with media queries
  - Create accessible interface with ARIA attributes

### 6.2 Interactive Command Interface
- [x] **Write tests for UI interactions**
  - Test command input forms and validation
  - Test button interactions and state changes
  - Test command execution feedback
  - Test error display and handling
- [x] **Implement interactive interface**
  - Create comprehensive command interface in `PanelUI.js`
  - Implement command input handling with validation
  - Add interactive form validation and feedback
  - Create status displays and error handling

### 6.3 Results Display System
- [x] **Write tests for results rendering**
  - Test response data visualization
  - Test code analysis result display
  - Test error investigation output
  - Test real-time update rendering
- [x] **Implement results display**
  - Add result rendering components with formatters
  - Implement syntax highlighting for code blocks
  - Create structured data display with JSON formatting
  - Add real-time update mechanisms with progress tracking

---

## Phase 7: Content Script Integration 📄

### 7.1 Page Context Access
- [x] **Write tests for page interaction**
  - Test DOM element access and analysis
  - Test JavaScript context interaction
  - Test page state capture
  - Test cross-frame communication
- [x] **Implement content script**
  - Create `src/extension/ContentScript.js`
  - Implement DOM interaction utilities
  - Add page context access functions
  - Create secure communication bridge

### 7.2 Element Inspection System
- [x] **Write tests for element inspection**
  - Test element selection and highlighting
  - Test computed style extraction
  - Test event listener analysis
  - Test element tree traversal
- [x] **Implement inspection utilities**
  - Create `src/extension/ElementInspector.js`
  - Add element selection mechanisms with hover support
  - Implement comprehensive style computation functions
  - Create event listener detection and analysis
  - Add element metadata extraction and tree traversal
  - Implement accessibility analysis and performance assessment

### 7.3 Page State Monitoring
- [x] **Write tests for state monitoring**
  - Test navigation event detection
  - Test DOM mutation observation
  - Test performance metric capture
  - Test error event monitoring
- [x] **Implement state monitoring**
  - Create `src/extension/PageStateMonitor.js`
  - Add comprehensive navigation event handlers with direction detection
  - Implement DOM mutation observers with throttling and filtering
  - Create performance monitoring with Core Web Vitals capture
  - Add error capturing systems with pattern detection
  - Implement scroll and viewport tracking
  - Add state change detection and snapshot comparison
  - Create robust error handling and graceful degradation

---

## Phase 8: Advanced Debug Commands 🔍

### 8.1 DOM Analysis Commands
- [x] **Write tests for DOM analysis**
  - Test `inspect_element` with various selectors
  - Test `analyze_dom_tree` with depth limits
  - Test DOM accessibility analysis
  - Test DOM performance impact assessment
- [x] **Implement DOM analysis commands**
  - Create `src/commands/DOMAnalysisCommands.js`
  - Implement comprehensive element inspection with all selector types
  - Add DOM tree analysis with depth limits and node filtering
  - Create accessibility scoring with WCAG compliance checking
  - Add performance impact calculation with rendering cost assessment
  - Implement command registration and parameter validation
  - Add comprehensive error handling and graceful degradation
  - Fixed invalid CSS selector generation issues

### 8.2 Code Analysis Commands
- [x] **Write tests for code analysis**
  - Test JavaScript syntax validation
  - Test CSS compatibility checking
  - Test performance optimization detection
  - Test security vulnerability scanning
- [x] **Implement code analysis commands**
  - Create `src/commands/CodeAnalysisCommands.js`
  - Implement JavaScript syntax validation using Function constructor
  - Add comprehensive security vulnerability detection (XSS, code injection, data leakage)
  - Create CSS syntax validation and browser compatibility checking
  - Add performance bottleneck detection for both JS and CSS
  - Implement code complexity analysis (cyclomatic and cognitive complexity)
  - Add code smell detection (long functions, global variables, duplicate code)
  - Create page-wide code analysis for both inline and external scripts/styles
  - Implement comprehensive command registration and parameter validation
  - Add robust error handling for all analysis operations

### 8.3 Performance and Accessibility Audits
- [x] **Write tests for audit commands**
  - Test performance metric analysis
  - Test Core Web Vitals calculation
  - Test WCAG compliance checking
  - Test accessibility score generation
- [x] **Implement audit commands**
  - Add performance audit algorithms
  - Implement accessibility compliance testing
  - Create comprehensive scoring systems
  - Add optimization recommendations

---

## Phase 9: Error Handling and Recovery 🛡️ ✅

### 9.1 Comprehensive Error Handling ✅
- [x] **Write tests for error scenarios** (20 tests passing)
  - Test WebSocket connection failures
  - Test agent execution errors
  - Test command timeout handling
  - Test invalid command processing
- [x] **Implement error handling system**
  - Create centralized error handling with categorization
  - Add comprehensive logging with sanitization
  - Implement graceful degradation and circuit breaker
  - Create user-friendly error messages and notifications

### 9.2 Recovery and Retry Logic ✅
- [x] **Write tests for recovery mechanisms** (21 tests passing)
  - Test automatic connection recovery
  - Test command retry with backoff
  - Test session restoration
  - Test state synchronization after recovery
- [x] **Implement recovery systems**
  - Add automatic retry mechanisms with exponential backoff
  - Implement session restoration with integrity validation
  - Create progressive recovery strategies
  - Add recovery monitoring and state notifications

### 9.3 Rate Limiting and Throttling ✅
- [x] **Write tests for rate limiting** (23 tests passing)
  - Test command rate limit enforcement
  - Test rate limit error responses
  - Test throttling mechanisms
  - Test rate limit recovery
- [x] **Implement rate limiting system**
  - Add command rate limiting with burst support
  - Implement request throttling with concurrent control
  - Create violation tracking and pattern detection
  - Add penalty system and comprehensive monitoring

**Phase 9 Complete: 64 tests passing - Robust error handling, recovery, and rate limiting system implemented**

---

## Phase 10: Testing Infrastructure 🧪

### 10.1 Test Server Implementation ✅
- [x] **Write tests for test server** (31 tests passing)
  - Test simple HTTP server setup
  - Test sample HTML page serving
  - Test test scenario generation
  - Test mock data provision
- [x] **Implement test server**
  - Create `src/testing/TestServer.js`
  - Add sample HTML pages for testing
  - Implement test scenario endpoints
  - Create mock data generators

### 10.2 Integration Test Suite
- [ ] **Write integration tests**
  - Test complete extension-to-server flow
  - Test multi-command execution sequences
  - Test concurrent connection handling
  - Test real-world debugging scenarios
- [ ] **Implement integration testing**
  - Create comprehensive E2E test suite
  - Add automated browser testing
  - Implement scenario-based testing
  - Create performance benchmarking

### 10.3 Mock and Stub Systems
- [ ] **Write tests for mocking system**
  - Test Legion Agent mocking
  - Test WebSocket connection mocking
  - Test Chrome API stubbing
  - Test external dependency mocking
- [ ] **Implement mocking infrastructure**
  - Create Legion Agent mocks
  - Add WebSocket connection stubs
  - Implement Chrome API mocks
  - Create test data generators

---

## Phase 11: Configuration and Environment 🔧

### 11.1 Environment Configuration
- [ ] **Write tests for configuration**
  - Test environment variable loading
  - Test configuration validation
  - Test default value handling
  - Test configuration override mechanisms
- [ ] **Implement configuration system**
  - Create environment configuration loader
  - Add configuration validation
  - Implement configuration merging
  - Create configuration documentation

### 11.2 Build and Deployment Scripts
- [ ] **Write tests for build process**
  - Test extension packaging
  - Test asset optimization
  - Test build artifact validation
  - Test deployment preparation
- [ ] **Implement build system**
  - Create extension build scripts
  - Add asset optimization pipeline
  - Implement artifact validation
  - Create deployment automation

### 11.3 Development Tools and Scripts
- [ ] **Write tests for development tools**
  - Test development server startup
  - Test hot reload functionality
  - Test debugging utilities
  - Test development workflow scripts
- [ ] **Implement development tooling**
  - Add development server with hot reload
  - Create debugging and logging utilities
  - Implement development workflow scripts
  - Add developer experience enhancements

---

## Phase 12: Documentation and Polish 📚

### 12.1 API Documentation Generation
- [ ] **Write tests for documentation**
  - Test API documentation completeness
  - Test code example validation
  - Test documentation build process
  - Test documentation accessibility
- [ ] **Implement documentation system**
  - Generate comprehensive API docs
  - Add interactive code examples
  - Create troubleshooting guides
  - Implement documentation automation

### 12.2 Performance Optimization
- [ ] **Write tests for performance**
  - Test WebSocket message throughput
  - Test extension memory usage
  - Test agent response times
  - Test UI responsiveness
- [ ] **Implement performance optimizations**
  - Optimize message processing pipeline
  - Add memory usage monitoring
  - Implement response time optimization
  - Create performance monitoring dashboard

### 12.3 Security Hardening
- [ ] **Write tests for security**
  - Test input validation and sanitization
  - Test permission boundary enforcement
  - Test secure communication protocols
  - Test vulnerability scanning
- [ ] **Implement security measures**
  - Add comprehensive input validation
  - Implement security boundary enforcement
  - Create secure communication channels
  - Add security monitoring and logging

---

## Testing Strategy 🧪

### Test Organization
```
__tests__/
├── unit/
│   ├── protocol/           # Protocol and message tests
│   ├── server/            # Server component tests
│   ├── extension/         # Extension component tests
│   └── shared/            # Shared utility tests
├── integration/
│   ├── e2e/              # End-to-end workflow tests
│   ├── websocket/        # WebSocket communication tests
│   ├── agent/            # Agent integration tests
│   └── extension/        # Extension integration tests
└── performance/
    ├── load/             # Load and stress tests
    ├── memory/           # Memory usage tests
    └── response-time/    # Response time benchmarks
```

### Test Requirements
- **Unit Tests**: 95%+ coverage for all core functionality
- **Integration Tests**: Test all major workflows end-to-end
- **Performance Tests**: Validate memory usage and response times
- **Security Tests**: Test all security boundaries and validations

### Test Commands
```bash
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:performance   # Run performance benchmarks
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage reports
```

---

## Success Criteria ✅

### Phase Completion Criteria
Each phase is complete when:
- [ ] All tests pass with 95%+ coverage
- [ ] Integration tests with previous phases pass
- [ ] Performance benchmarks meet requirements
- [ ] Code passes linting and security scans
- [ ] Documentation is updated and validated

### MVP Success Criteria
- [ ] Chrome extension loads without errors
- [ ] DevTools panel appears and is functional
- [ ] WebSocket connection establishes successfully
- [ ] Basic debug commands execute and return results
- [ ] Agent integration works with Legion ecosystem
- [ ] Real-time updates and events function properly
- [ ] Error handling provides graceful degradation
- [ ] Performance meets established benchmarks

---

## Development Guidelines 📝

### TDD Approach
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass test
3. **No Refactor**: Get implementation right the first time

### Code Quality
- Follow existing Legion code conventions
- Use TypeScript for type safety where beneficial
- Comprehensive error handling for all scenarios
- Clear, descriptive naming throughout
- Minimal external dependencies

### Documentation Requirements
- Update design documents as implementation progresses
- Maintain comprehensive API documentation
- Document all testing strategies and results
- Provide clear usage examples and guides
- Keep troubleshooting guides current

---

*This development plan ensures systematic, test-driven implementation of Cerebrate with clear milestones, comprehensive testing, and robust success criteria.*