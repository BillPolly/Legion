# Node Runner - TDD Development Plan

## Overview

This development plan follows a Test-Driven Development approach (without refactoring phase) to implement the Node Runner MVP. Each step includes writing tests first, then implementing functionality to make tests pass.

## Progress Tracking

- ☐ Not Started
- ✅ Completed

---

## Phase 1: Project Foundation & Core Infrastructure

### 1.1 Project Setup
- ☐ Initialize package structure with proper directories (`src/`, `__tests__/`, `docs/`)
- ☐ Configure Jest for ES modules with Legion testing patterns
- ☐ Set up ESLint configuration matching Legion standards
- ☐ Create package.json with all required dependencies
- ☐ Verify npm workspace integration with root package.json

### 1.2 Basic Module Structure
- ☐ Write tests for NodeRunnerModule creation and initialization
- ☐ Implement NodeRunnerModule class extending Legion Module
- ☐ Write tests for ResourceManager integration
- ☐ Implement async create() factory method
- ☐ Write tests for dependency injection setup
- ☐ Implement constructor with all manager dependencies

### 1.3 Core Utilities
- ☐ Write tests for ID generation utilities
- ☐ Implement generateId() function
- ☐ Write tests for port availability checking
- ☐ Implement isPortAvailable() and findAvailablePort() utilities
- ☐ Write tests for basic event emitter patterns
- ☐ Set up EventEmitter base functionality

---

## Phase 2: Session Management

### 2.1 Session Manager Foundation
- ☐ Write tests for SessionManager class creation
- ☐ Implement SessionManager constructor with StorageProvider
- ☐ Write tests for session creation with metadata
- ☐ Implement createSession() method
- ☐ Write tests for session status updates
- ☐ Implement updateSession() and endSession() methods

### 2.2 Session Storage Integration
- ☐ Write tests for session persistence to database
- ☐ Implement database insertion for sessions
- ☐ Write tests for session retrieval by ID
- ☐ Implement findSession() method
- ☐ Write tests for listing sessions with filters
- ☐ Implement listSessions() method with status filtering

### 2.3 Session Lifecycle
- ☐ Write tests for session statistics tracking
- ☐ Implement session stats updates (log counts, errors)
- ☐ Write tests for session cleanup on completion
- ☐ Implement proper session finalization
- ☐ Write integration tests for full session lifecycle
- ☐ Verify session data integrity throughout lifecycle

---

## Phase 3: Log Storage System

### 3.1 Log Storage Foundation
- ☐ Write tests for LogStorage class creation
- ☐ Implement LogStorage constructor with StorageProvider
- ☐ Write tests for structured log record creation
- ☐ Implement log record formatting and validation
- ☐ Write tests for database schema compliance
- ☐ Verify log record structure matches design schema

### 3.2 Log Persistence
- ☐ Write tests for single log entry storage
- ☐ Implement storeLog() method with database insertion
- ☐ Write tests for batch log storage operations
- ☐ Implement batch processing capabilities
- ☐ Write tests for log metadata handling
- ☐ Implement metadata extraction and storage

### 3.3 Embedding Generation
- ☐ Write tests for semantic embedding generation
- ☐ Integrate SemanticSearchProvider for embeddings
- ☐ Write tests for embedding storage in separate collection
- ☐ Implement embedding persistence with log correlation
- ☐ Write tests for embedding error handling
- ☐ Implement fallback behavior for embedding failures

### 3.4 Log Cleanup Operations
- ☐ Write tests for log clearing functionality
- ☐ Implement clearLogs() method
- ☐ Write tests for selective log deletion
- ☐ Implement filtered log cleanup
- ☐ Write tests for embedding cleanup coordination
- ☐ Ensure consistent cleanup across all collections

---

## Phase 4: Process Management

### 4.1 ProcessManager Foundation
- ☐ Write tests for ProcessManager class extending EventEmitter
- ☐ Implement ProcessManager constructor with LogStorage
- ☐ Write tests for process metadata tracking
- ☐ Implement process registry with Map storage
- ☐ Write tests for process status management
- ☐ Implement status tracking and updates

### 4.2 Process Spawning
- ☐ Write tests for basic process spawning
- ☐ Implement startProcess() with cross-spawn
- ☐ Write tests for process options handling (env, cwd, args)
- ☐ Implement option parsing and process configuration
- ☐ Write tests for process failure scenarios
- ☐ Implement error handling for spawn failures

### 4.3 Log Capture Integration
- ☐ Write tests for stdout capture
- ☐ Implement stdout stream handling with LogStorage
- ☐ Write tests for stderr capture
- ☐ Implement stderr stream handling with LogStorage
- ☐ Write tests for log formatting from process streams
- ☐ Implement structured log creation from process output

### 4.4 Process Lifecycle Events
- ☐ Write tests for process start events
- ☐ Implement event emission for process lifecycle
- ☐ Write tests for process exit handling
- ☐ Implement exit code and signal capturing
- ☐ Write tests for process cleanup on exit
- ☐ Implement process registry cleanup

### 4.5 Process Termination
- ☐ Write tests for graceful process stopping
- ☐ Implement stopProcess() with SIGTERM
- ☐ Write tests for forced process killing
- ☐ Implement timeout-based SIGKILL fallback
- ☐ Write tests for process termination edge cases
- ☐ Implement comprehensive termination error handling

---

## Phase 5: Server Management

### 5.1 ServerManager Foundation
- ☐ Write tests for ServerManager creation with ProcessManager
- ☐ Implement ServerManager constructor
- ☐ Write tests for server metadata tracking
- ☐ Implement server registry and status management
- ☐ Write tests for port allocation logic
- ☐ Implement port finding and conflict resolution

### 5.2 Web Server Startup
- ☐ Write tests for web server process spawning
- ☐ Implement startWebServer() wrapping ProcessManager
- ☐ Write tests for port environment variable injection
- ☐ Implement PORT environment variable management
- ☐ Write tests for server startup timeout handling
- ☐ Implement waitForServerReady() with port monitoring

### 5.3 Health Monitoring
- ☐ Write tests for basic health check requests
- ☐ Implement checkServerHealth() with HTTP requests
- ☐ Write tests for health endpoint configuration
- ☐ Implement configurable health check endpoints
- ☐ Write tests for health check failure handling
- ☐ Implement health check error recovery and reporting

### 5.4 Server Lifecycle Integration
- ☐ Write tests for server status updates
- ☐ Implement server status tracking (starting, running, unhealthy)
- ☐ Write tests for server-to-process correlation
- ☐ Implement server metadata linking to processes
- ☐ Write tests for server cleanup on process exit
- ☐ Implement server registry cleanup coordination

---

## Phase 6: Frontend Log Injection

### 6.1 WebSocket Server Management
- ☐ Write tests for WebSocket server creation
- ☐ Implement WebSocket server startup with port allocation
- ☐ Write tests for WebSocket connection handling
- ☐ Implement WebSocket connection lifecycle management
- ☐ Write tests for WebSocket server cleanup
- ☐ Implement proper WebSocket server termination

### 6.2 Frontend Log Processing
- ☐ Write tests for frontend log message parsing
- ☐ Implement JSON message parsing with error handling
- ☐ Write tests for frontend log structure validation
- ☐ Implement log structure transformation for storage
- ☐ Write tests for frontend log storage integration
- ☐ Implement LogStorage integration for frontend logs

### 6.3 Injection Script Generation
- ☐ Write tests for JavaScript injection script generation
- ☐ Implement generateInjectionScript() with dynamic values
- ☐ Write tests for console method interception
- ☐ Implement console logging capture functionality
- ☐ Write tests for error event capturing
- ☐ Implement global error and unhandled rejection capture

### 6.4 Network Request Monitoring
- ☐ Write tests for fetch API interception logic
- ☐ Implement fetch wrapper with timing and logging
- ☐ Write tests for network request metadata capture
- ☐ Implement request/response timing and status logging
- ☐ Write tests for network error handling
- ☐ Implement network error capture and reporting

### 6.5 HTTP Response Interception (Main Challenge)
- ☐ Research and choose HTTP interception approach
- ☐ Write tests for HTTP response detection
- ☐ Implement basic HTTP response monitoring
- ☐ Write tests for HTML content detection
- ☐ Implement HTML content type filtering
- ☐ Write tests for script injection into HTML responses
- ☐ Implement script injection mechanism
- ☐ Write integration tests for end-to-end injection
- ☐ Verify script injection works with real web servers

---

## Phase 7: Search Engine

### 7.1 Search Foundation
- ☐ Write tests for LogSearch class creation
- ☐ Implement LogSearch constructor with SemanticSearchProvider
- ☐ Write tests for search option parsing
- ☐ Implement search parameter validation and processing
- ☐ Write tests for result formatting
- ☐ Implement search result standardization

### 7.2 Semantic Search Implementation
- ☐ Write tests for semantic search queries
- ☐ Implement semantic search via SemanticSearchProvider
- ☐ Write tests for embedding-based result retrieval
- ☐ Implement embedding query processing
- ☐ Write tests for semantic search result scoring
- ☐ Implement relevance scoring for semantic matches

### 7.3 Keyword Search Implementation
- ☐ Write tests for text-based keyword searches
- ☐ Implement keyword search using database text indexing
- ☐ Write tests for keyword search filtering
- ☐ Implement database query construction for keywords
- ☐ Write tests for keyword search result ranking
- ☐ Implement keyword relevance scoring

### 7.4 Database Query Search
- ☐ Write tests for structured database queries
- ☐ Implement database filter construction
- ☐ Write tests for time range filtering
- ☐ Implement timestamp-based query filtering
- ☐ Write tests for metadata field filtering
- ☐ Implement complex filter combinations

### 7.5 Hybrid Search and Deduplication
- ☐ Write tests for multi-modal search combination
- ☐ Implement hybrid search result merging
- ☐ Write tests for result deduplication logic
- ☐ Implement duplicate detection and removal
- ☐ Write tests for result sorting and ranking
- ☐ Implement combined relevance scoring and sorting

---

## Phase 8: Legion Tools Implementation

### 8.1 RunNodeTool Implementation
- ☐ Write tests for RunNodeTool creation and schema validation
- ☐ Implement RunNodeTool class extending Tool
- ☐ Write tests for session creation integration
- ☐ Implement session management within tool execution
- ☐ Write tests for server vs. process detection logic
- ☐ Implement conditional routing to ServerManager or ProcessManager

### 8.2 RunNodeTool Advanced Features
- ☐ Write tests for frontend injection setup
- ☐ Implement frontend injection coordination
- ☐ Write tests for progress event emission
- ☐ Implement progress reporting throughout execution
- ☐ Write tests for error handling and response formatting
- ☐ Implement comprehensive error handling with proper responses

### 8.3 SearchLogsTool Implementation
- ☐ Write tests for SearchLogsTool creation and schema
- ☐ Implement SearchLogsTool class with input validation
- ☐ Write tests for filter construction from parameters
- ☐ Implement dynamic filter building from tool inputs
- ☐ Write tests for search execution and result formatting
- ☐ Implement search integration and response structuring

### 8.4 Additional Tools Implementation
- ☐ Write tests for StopNodeTool functionality
- ☐ Implement StopNodeTool with process termination
- ☐ Write tests for ListSessionsTool functionality
- ☐ Implement ListSessionsTool with session querying
- ☐ Write tests for ServerHealthTool functionality
- ☐ Implement ServerHealthTool with health check reporting

---

## Phase 9: Integration Testing

### 9.1 End-to-End Process Testing
- ☐ Write integration tests for complete process lifecycle
- ☐ Test process start, logging, and termination flow
- ☐ Write integration tests for server startup with health checks
- ☐ Test web server management with port allocation
- ☐ Write integration tests for log capture from real processes
- ☐ Verify log storage and retrieval with actual process output

### 9.2 Frontend Injection Integration
- ☐ Write integration tests for WebSocket server coordination
- ☐ Test WebSocket server lifecycle with process management
- ☐ Write integration tests for script injection with real servers
- ☐ Test HTML response interception and script injection
- ☐ Write integration tests for frontend log capture
- ☐ Verify frontend logs are captured and stored correctly

### 9.3 Search Integration Testing
- ☐ Write integration tests for multi-modal search
- ☐ Test semantic, keyword, and database search coordination
- ☐ Write integration tests for search result accuracy
- ☐ Verify search results match expected relevance and content
- ☐ Write integration tests for large dataset search performance
- ☐ Test search functionality with realistic log volumes

### 9.4 Legion Framework Integration
- ☐ Write integration tests for ResourceManager initialization
- ☐ Test StorageProvider and SemanticSearchProvider integration
- ☐ Write integration tests for tool execution via Legion
- ☐ Test MCP tool functionality through Legion framework
- ☐ Write integration tests for module lifecycle management
- ☐ Verify module cleanup and resource management

---

## Phase 10: MVP Validation & Documentation

### 10.1 Comprehensive Testing
- ☐ Run complete test suite and achieve >90% coverage
- ☐ Execute all integration tests successfully
- ☐ Write performance validation tests for MVP requirements
- ☐ Test memory usage and resource cleanup
- ☐ Write edge case tests for error conditions
- ☐ Test error recovery and graceful degradation

### 10.2 Real-World Validation
- ☐ Test with actual Express.js application
- ☐ Validate frontend log capture with real web pages
- ☐ Test with actual Next.js/React application
- ☐ Validate log search accuracy with real application logs
- ☐ Test with multiple concurrent processes
- ☐ Validate session management with overlapping runs

### 10.3 Documentation Completion
- ☐ Update API documentation with implemented functionality
- ☐ Create usage examples with real code samples
- ☐ Document configuration options and environment variables
- ☐ Create troubleshooting guide for common issues
- ☐ Write deployment and setup instructions
- ☐ Document MVP limitations and known issues

### 10.4 MVP Release Preparation
- ☐ Verify all MVP features are functional
- ☐ Complete final integration testing
- ☐ Prepare MVP release notes
- ☐ Create MVP demo and usage examples
- ☐ Validate Legion framework compatibility
- ☐ Mark MVP as ready for use

---

## Testing Strategy Notes

### Test-Driven Development Approach
- **Write tests first** for each functionality
- **Implement minimal code** to make tests pass
- **No refactoring phase** - aim to get implementation right initially
- **Focus on MVP scope** - avoid over-engineering

### Test Categories
- **Unit Tests**: Individual class and method functionality
- **Integration Tests**: Component interaction and Legion framework integration
- **End-to-End Tests**: Complete workflows from tool execution to log retrieval
- **Real-World Tests**: Testing with actual applications and realistic scenarios

### Success Criteria
- All tests pass consistently
- MVP functionality works with real Node.js applications
- Frontend log injection captures browser activity
- Search functionality provides accurate results
- Legion framework integration is seamless
- Resource cleanup prevents memory leaks

---

## Dependencies for Implementation

### Required Legion Packages
- `@legion/storage` - Database operations
- `@legion/semantic-search` - Embedding and vector search
- `@legion/tools` - Module and Tool base classes
- `@legion/shared` - Common utilities and types

### External Dependencies
- `cross-spawn` - Safe process spawning
- `ws` - WebSocket server implementation
- `detect-port` - Port availability detection
- `zod` - Schema validation for tool inputs
- `jest` - Testing framework

### Development Dependencies
- `eslint` - Code linting
- `@jest/globals` - Jest testing utilities
- Node.js >= 18.0.0 with ES modules support