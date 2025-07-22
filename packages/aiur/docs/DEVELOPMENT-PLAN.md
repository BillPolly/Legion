# Aiur MCP Server - TDD Development Plan

This document outlines the comprehensive Test-Driven Development plan for implementing the Aiur MCP server. Each phase follows Red-Green methodology: write failing tests first, then implement code to make them pass.

## Prerequisites ✅

- [x] llm-planner moved to packages root
- [x] code-agent updated to use @legion/llm-planner  
- [x] Basic MCP server structure exists
- [x] Design document completed

---

## Phase 1: Core Handle System 🏗️

### 1.1 Handle Registry Foundation
- [x] **Write tests for HandleRegistry class**
  - Test handle creation and storage
  - Test handle retrieval by name
  - Test handle existence checking
  - Test handle deletion
- [x] **Implement HandleRegistry class**
  - Basic Map-based storage
  - CRUD operations for handles
  - Thread-safe operations

### 1.2 Handle Resolution
- [x] **Write tests for handle resolution**
  - Test `@handleName` pattern recognition
  - Test recursive resolution in nested objects
  - Test resolution failure handling
  - Test circular reference detection
- [x] **Implement handle resolution**
  - Parameter parsing for `@` references
  - Recursive object traversal
  - Error handling for missing handles

### 1.3 Memory Management
- [x] **Write tests for LRU cache**
  - Test eviction when limit reached
  - Test access time updates
  - Test manual cleanup
  - Test memory usage tracking
- [x] **Implement LRU memory management**
  - Size-based eviction
  - Access tracking
  - Configurable limits
  - Memory monitoring

### 1.4 TTL Support
- [x] **Write tests for TTL functionality**
  - Test automatic expiration
  - Test TTL extension on access
  - Test cleanup of expired handles
  - Test TTL configuration per handle
- [x] **Implement TTL system**
  - Expiration timestamps
  - Background cleanup process
  - TTL refresh on access
  - Configurable TTL policies

---

## Phase 2: Basic MCP Integration 🔌

### 2.1 MCP Server Enhancement
- [x] **Write tests for enhanced MCP server**
  - Test handle creation from tool responses
  - Test handle resolution in tool calls
  - Test MCP resource listing
  - Test proper MCP response formatting
- [x] **Enhance existing MCP server**
  - Integrate HandleRegistry
  - Add handle resolution middleware
  - Update tool response formatting
  - Add handle management resources

### 2.2 Tool Response Handling
- [ ] **Write tests for saveAs functionality**
  - Test handle creation from `saveAs` parameter
  - Test handle naming validation
  - Test handle overwrite protection
  - Test response metadata inclusion
- [ ] **Implement saveAs response handling**
  - Parse `saveAs` from tool responses
  - Create handles automatically
  - Include handle metadata in responses
  - Validate handle names

### 2.3 Parameter Resolution
- [ ] **Write tests for parameter preprocessing**
  - Test `@handle` replacement in simple objects
  - Test deep object traversal
  - Test array handling
  - Test mixed parameter types
- [ ] **Implement parameter preprocessing**
  - Pre-process all tool call parameters
  - Replace handle references with objects
  - Maintain parameter structure
  - Error handling for missing handles

---

## Phase 3: Legion Tool Integration 🛠️

### 3.1 Tool Wrapper Foundation
- [ ] **Write tests for MCPToolAdapter**
  - Test Legion tool wrapping
  - Test parameter resolution
  - Test response formatting
  - Test error propagation
- [ ] **Implement MCPToolAdapter class**
  - Wrap Legion tools for MCP
  - Handle parameter resolution
  - Format responses properly
  - Propagate errors correctly

### 3.2 Dynamic Tool Loading
- [ ] **Write tests for tool loading**
  - Test tool discovery from Legion modules
  - Test tool registration in MCP
  - Test tool metadata extraction
  - Test loading error handling
- [ ] **Implement dynamic tool loading**
  - Scan Legion packages for tools
  - Register tools with MCP server
  - Extract tool metadata
  - Handle loading failures gracefully

### 3.3 Basic File Operations
- [ ] **Write tests for file tool integration**
  - Test FileReader tool via MCP
  - Test FileWriter tool via MCP
  - Test DirectoryCreator tool via MCP
  - Test handle creation for file operations
- [ ] **Integrate basic file tools**
  - FileReader, FileWriter, DirectoryCreator
  - Handle creation for file objects
  - Proper error handling
  - File metadata tracking

---

## Phase 4: Tool Management System 📚

### 4.1 Tool Registry
- [ ] **Write tests for ToolRegistry**
  - Test tool indexing by tags
  - Test tool metadata storage
  - Test tool search functionality
  - Test tool relationship tracking
- [ ] **Implement ToolRegistry class**
  - Index tools by metadata
  - Store tool descriptions and tags
  - Track tool relationships
  - Support tool querying

### 4.2 Working Set Management
- [ ] **Write tests for working set**
  - Test tool activation/deactivation
  - Test working set size limits
  - Test context-based suggestions
  - Test tool priority management
- [ ] **Implement working set management**
  - Active tool tracking
  - Size-limited working sets
  - Priority-based selection
  - Context-aware suggestions

### 4.3 Meta-Tools Implementation
- [ ] **Write tests for meta-tools**
  - Test `tool_search` functionality
  - Test `tool_activate` functionality
  - Test `tool_suggest` functionality
  - Test `tool_list_active` functionality
- [ ] **Implement meta-tools**
  - `tool_search` with basic string matching
  - `tool_activate` for working set management
  - `tool_suggest` with simple heuristics
  - `tool_list_active` for current state

---

## Phase 5: Planning System Foundation 📋

### 5.1 Plan Extensions
- [ ] **Write tests for AiurPlan**
  - Test checkpoint management
  - Test handle integration
  - Test plan validation
  - Test state capture
- [ ] **Implement AiurPlan class**
  - Extend llm-planner's Plan
  - Add checkpoint support
  - Integrate handle tracking
  - Add state capture methods

### 5.2 Plan Execution Engine
- [ ] **Write tests for PlanExecutor**
  - Test step-by-step execution
  - Test handle creation during execution
  - Test error handling
  - Test execution state tracking
- [ ] **Implement PlanExecutor class**
  - Execute plan steps sequentially
  - Create handles from step outputs
  - Track execution progress
  - Handle execution failures

### 5.3 Basic Planning Tools
- [ ] **Write tests for planning tools**
  - Test `plan_create` tool
  - Test `plan_execute` tool
  - Test `plan_status` tool
  - Test plan validation
- [ ] **Implement basic planning tools**
  - `plan_create` using llm-planner
  - `plan_execute` with handle integration
  - `plan_status` for progress tracking
  - Basic plan validation

---

## Phase 6: Checkpoint System 🚩

### 6.1 Checkpoint Definition
- [ ] **Write tests for CheckpointManager**
  - Test checkpoint creation
  - Test state capture
  - Test validation execution
  - Test checkpoint metadata
- [ ] **Implement CheckpointManager class**
  - Define checkpoint structure
  - Implement state capture
  - Add validation hooks
  - Store checkpoint metadata

### 6.2 State Capture
- [ ] **Write tests for state capture**
  - Test handle state serialization
  - Test plan state capture
  - Test validation result storage
  - Test incremental state capture
- [ ] **Implement state capture system**
  - Serialize handle states
  - Capture plan execution state
  - Store validation results
  - Support incremental capture

### 6.3 Rollback Implementation
- [ ] **Write tests for rollback**
  - Test state restoration
  - Test handle state rollback
  - Test partial rollback
  - Test rollback validation
- [ ] **Implement rollback system**
  - Restore previous states
  - Reset handle registry
  - Validate rollback success
  - Handle rollback failures

---

## Phase 7: Advanced Planning Features 🧠

### 7.1 Checkpoint Integration
- [ ] **Write tests for checkpoint tools**
  - Test `plan_checkpoint` tool
  - Test `plan_rollback` tool
  - Test checkpoint validation
  - Test rollback strategies
- [ ] **Implement checkpoint tools**
  - `plan_checkpoint` for validation
  - `plan_rollback` for state restoration
  - Automatic checkpoint creation
  - Rollback strategy selection

### 7.2 Progress Tracking
- [ ] **Write tests for progress tracking**
  - Test real-time progress updates
  - Test progress event emission
  - Test progress resource updates
  - Test progress history
- [ ] **Implement progress tracking**
  - Real-time progress updates
  - Event-based notifications
  - MCP resource updates
  - Progress history storage

### 7.3 Dependency Resolution
- [ ] **Write tests for dependency resolution**
  - Test handle dependency tracking
  - Test execution order optimization
  - Test parallel execution detection
  - Test circular dependency detection
- [ ] **Implement dependency resolution**
  - Track handle dependencies
  - Optimize execution order
  - Detect parallel opportunities
  - Prevent circular dependencies

---

## Phase 8: Enhanced Tool Management 🔍

### 8.1 Semantic Search
- [ ] **Write tests for semantic search**
  - Test vector-based tool search
  - Test similarity scoring
  - Test context-aware ranking
  - Test search result filtering
- [ ] **Implement semantic search**
  - Vector embeddings for tools
  - Similarity-based matching
  - Context-aware scoring
  - Advanced filtering options

### 8.2 Context-Aware Loading
- [ ] **Write tests for context loading**
  - Test handle-based tool suggestions
  - Test workflow-based tool sets
  - Test automatic tool activation
  - Test tool dependency loading
- [ ] **Implement context-aware loading**
  - Analyze current handles
  - Suggest relevant tools
  - Auto-activate tool chains
  - Load tool dependencies

### 8.3 Advanced Meta-Tools
- [ ] **Write tests for advanced meta-tools**
  - Test enhanced `tool_suggest`
  - Test `tool_chain` functionality
  - Test `tool_workflow` management
  - Test tool performance tracking
- [ ] **Implement advanced meta-tools**
  - Enhanced suggestion algorithms
  - Tool chain recommendations
  - Workflow template management
  - Performance analytics

---

## Phase 9: Integration & Polish 🎨

### 9.1 Error Handling
- [ ] **Write tests for comprehensive error handling**
  - Test graceful degradation
  - Test error recovery strategies
  - Test error context preservation
  - Test user-friendly error messages
- [ ] **Implement robust error handling**
  - Graceful error recovery
  - Context-aware error messages
  - Automatic retry mechanisms
  - Error state cleanup

### 9.2 Performance Optimization
- [ ] **Write tests for performance**
  - Test handle access performance
  - Test tool loading performance
  - Test plan execution performance
  - Test memory usage optimization
- [ ] **Optimize performance**
  - Handle access caching
  - Lazy tool loading
  - Parallel plan execution
  - Memory usage optimization

### 9.3 Configuration & Monitoring
- [ ] **Write tests for configuration**
  - Test configuration validation
  - Test runtime configuration updates
  - Test monitoring metrics
  - Test health checks
- [ ] **Implement configuration & monitoring**
  - Comprehensive configuration system
  - Runtime configuration updates
  - Performance monitoring
  - Health check endpoints


---

## Testing Strategy 🧪

### Test Organization
```
__tests__/
├── unit/
│   ├── handles/
│   ├── tools/
│   ├── planning/
│   └── mcp/
├── integration/
│   ├── end-to-end/
│   ├── tool-chains/
│   └── plan-execution/
└── performance/
    ├── load/
    ├── memory/
    └── concurrency/
```

### Test Requirements
- **Unit Tests**: 100% coverage for core functionality
- **Integration Tests**: Test all major workflows end-to-end
- **Performance Tests**: Validate memory usage and response times
- **Error Tests**: Test all error conditions and recovery paths

### Test Data Management
- Mock Legion tools for consistent testing
- Sample handle data for different scenarios
- Test plans for various complexity levels
- Performance benchmarks and thresholds

---

## Success Criteria ✅

### Phase Completion Criteria
Each phase is complete when:
- [ ] All tests pass
- [ ] Code coverage meets requirements (90%+)
- [ ] Performance benchmarks are met
- [ ] Documentation is updated
- [ ] Integration tests with previous phases pass

### MVP Success Criteria
- [ ] Aiur successfully coordinates basic multi-tool workflows
- [ ] Handle system eliminates parameter redundancy
- [ ] Planning system provides reliable task orchestration
- [ ] Tool management enables efficient discovery and usage
- [ ] Basic checkpoint and rollback functionality works
- [ ] Integration with Legion ecosystem is seamless

---

## Development Guidelines 📝

### TDD Approach
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass test
3. **No Refactor**: Get implementation right the first time

### Code Quality
- Follow existing Legion code conventions
- Use TypeScript for type safety where beneficial
- Comprehensive error handling
- Clear, descriptive naming
- Minimal dependencies

### Documentation
- Update design documents as needed
- Maintain API documentation
- Document testing strategies
- Provide usage examples

---

*This development plan ensures systematic, test-driven implementation of the Aiur MCP server with clear milestones and success criteria.*