# Data-Store DSL Implementation Plan

## Overview

This implementation plan follows a **Test-Driven Development (TDD)** approach without the refactor step - we aim to get the implementation right on the first attempt based on the comprehensive design document. The implementation will be built in phases with each step thoroughly tested before moving to the next.

## Approach and Rules

### Testing Strategy
- **Unit Tests**: Test individual DSL components in isolation using mocks where appropriate for external dependencies
- **Integration Tests**: Test complete DSL workflows with **NO MOCKS** - use real data-store instances and actual template literal parsing
- **End-to-End Tests**: Test complete user workflows from DSL syntax to database operations
- All tests must pass before proceeding to the next step

### Implementation Rules
- **No Mocks in Implementation**: Production code must not contain any mock objects or fallback mechanisms
- **No Fallbacks**: All errors must be raised explicitly - no silent failures or default behaviors
- **No Mocks in Integration Tests**: Integration tests must use real data-store instances, actual template literal processing, and real DataScript operations
- **Functional Correctness Only**: Focus on MVP functionality - no performance optimization, security, or migration concerns
- **Local Testing Only**: No deployment, publishing, or production concerns

### Development Workflow
1. **Write Test First**: Define expected DSL behavior through tests
2. **Implement to Pass**: Write minimal code to make tests pass
3. **Verify Completeness**: Ensure all edge cases are covered
4. **Move to Next Step**: Only proceed when all tests pass

## Implementation Phases

### Phase 1: Core Template Literal Infrastructure
**Goal**: Establish template literal parsing foundation and basic DSL framework

#### Step 1.1: Template Literal Parser Foundation
- [x] **Unit Tests**: Tagged template literal function structure, string/expression separation
- [x] **Integration Tests**: Template literal parsing with real JavaScript template literal calls
- [x] **Implementation**: DSLParser class with core template literal processing

#### Step 1.2: Token Processing System
- [x] **Unit Tests**: String tokenization, keyword recognition, expression handling
- [x] **Integration Tests**: Token processing with complete template literal inputs
- [x] **Implementation**: Tokenizer with comprehensive token classification

#### Step 1.3: Error Handling Framework
- [x] **Unit Tests**: Error reporting with line/column information, error recovery
- [x] **Integration Tests**: Error handling with malformed template literal inputs
- [x] **Implementation**: Error reporting system with contextual information

### Phase 2: Schema DSL Implementation
**Goal**: Implement complete schema definition language with template literals

#### Step 2.1: Schema Parser Core
- [x] **Unit Tests**: Basic schema line parsing, attribute/type recognition
- [x] **Integration Tests**: Schema parsing with real data-store schema validation
- [x] **Implementation**: Schema parser converting DSL syntax to DataScript schema objects

#### Step 2.2: Constraint Processing
- [x] **Unit Tests**: Unique constraints, cardinality, component relationships
- [x] **Integration Tests**: Constraint validation with real DataScript schema enforcement
- [x] **Implementation**: Constraint parser with DataScript schema property generation

#### Step 2.3: Reference Type Handling
- [x] **Unit Tests**: Reference syntax parsing, target entity validation
- [x] **Integration Tests**: Reference type creation with actual entity relationships
- [x] **Implementation**: Reference parser with entity target resolution

#### Step 2.4: defineSchema Template Literal Function
- [x] **Unit Tests**: defineSchema function parameter handling, return value validation
- [x] **Integration Tests**: Complete schema creation with real data-store integration
- [x] **Implementation**: defineSchema tagged template literal function

### Phase 3: Query DSL Implementation  
**Goal**: Implement readable Datalog query syntax with template literals

#### Step 3.1: Query Structure Parser
- [x] **Unit Tests**: Find/where clause parsing, variable extraction
- [x] **Integration Tests**: Query parsing with real DataScript query execution
- [x] **Implementation**: Query structure parser generating DataScript query objects

#### Step 3.2: Where Clause Processing
- [x] **Unit Tests**: Datom pattern parsing, variable binding, literal value handling
- [x] **Integration Tests**: Where clause execution with real database queries
- [x] **Implementation**: Where clause parser with DataScript pattern generation

#### Step 3.3: Predicate and Operator Support
- [x] **Unit Tests**: Operator parsing, predicate function generation, comparison operations
- [x] **Integration Tests**: Predicate execution with real data filtering
- [x] **Implementation**: Predicate processor with DataScript predicate integration

#### Step 3.4: ?this Variable Injection
- [x] **Unit Tests**: ?this variable detection, entity ID binding, variable substitution
- [x] **Integration Tests**: Entity-rooted query execution with real EntityProxy instances
- [x] **Implementation**: ?this processor for entity-rooted query support

#### Step 3.5: query Template Literal Function
- [x] **Unit Tests**: query function parameter handling, return value validation
- [x] **Integration Tests**: Complete query execution with EntityProxy integration
- [x] **Implementation**: query tagged template literal function

### Phase 4: Update DSL Implementation
**Goal**: Implement intuitive update syntax with relationship operations

#### Step 4.1: Assignment Statement Parser
- [x] **Unit Tests**: Assignment parsing, value extraction, type recognition
- [x] **Integration Tests**: Assignment processing with real entity updates
- [x] **Implementation**: Assignment parser generating transaction data

#### Step 4.2: Relationship Operation Support
- [x] **Unit Tests**: +/- operator parsing, collection operation handling
- [x] **Integration Tests**: Relationship operations with real entity relationship updates
- [x] **Implementation**: Relationship operator processor

#### Step 4.3: Expression Evaluation
- [x] **Unit Tests**: ${} expression parsing, JavaScript evaluation, type conversion
- [x] **Integration Tests**: Expression evaluation with real data-store operations
- [x] **Implementation**: Expression evaluator with runtime JavaScript execution

#### Step 4.4: update Template Literal Function
- [x] **Unit Tests**: update function parameter handling, transaction generation
- [x] **Integration Tests**: Complete update execution with EntityProxy integration
- [x] **Implementation**: update tagged template literal function

### Phase 5: EntityProxy DSL Integration
**Goal**: Integrate DSL functions with EntityProxy methods

#### Step 5.1: EntityProxy Query Integration
- [x] **Unit Tests**: EntityProxy.query method overloading, template literal detection
- [x] **Integration Tests**: EntityProxy query method with DSL and object syntax support
- [x] **Implementation**: EntityProxy query method enhancement with DSL support

#### Step 5.2: EntityProxy Update Integration  
- [x] **Unit Tests**: EntityProxy.update method overloading, DSL syntax detection
- [x] **Integration Tests**: EntityProxy update method with DSL and object syntax support
- [x] **Implementation**: EntityProxy update method enhancement with DSL support

#### Step 5.3: EntityProxy Subscription Integration
- [x] **Unit Tests**: EntityProxy.subscribe method overloading, callback integration
- [x] **Integration Tests**: EntityProxy subscription with DSL syntax and real reactive triggers
- [x] **Implementation**: EntityProxy subscribe method enhancement with DSL support

#### Step 5.4: EntityProxy Computed Property Integration
- [x] **Unit Tests**: EntityProxy.computed method DSL support, query integration
- [x] **Integration Tests**: Computed properties with DSL queries and real cache invalidation
- [x] **Implementation**: EntityProxy computed method enhancement with DSL support

### Phase 6: Advanced DSL Features
**Goal**: Implement advanced DSL patterns and syntax sugar

#### Step 6.1: Subscription DSL with Pipeline Syntax
- [x] **Unit Tests**: Pipeline operator parsing, callback chaining
- [x] **Integration Tests**: Subscription pipeline with real reactive notifications
- [x] **Implementation**: Pipeline syntax processor for subscription callbacks

#### Step 6.2: Namespace Automatic Conversion
- [x] **Unit Tests**: Namespace detection, colon prefix addition/removal
- [x] **Integration Tests**: Namespace conversion with real DataScript attribute matching
- [x] **Implementation**: Namespace converter with automatic prefix handling

#### Step 6.3: Aggregation Function Support
- [x] **Unit Tests**: Aggregation function parsing, parameter extraction
- [x] **Integration Tests**: Aggregation execution with real DataScript aggregation queries
- [x] **Implementation**: Aggregation processor with DataScript function integration

#### Step 6.4: Complex Expression Processing
- [x] **Unit Tests**: Nested expression parsing, conditional logic, complex predicates
- [x] **Integration Tests**: Complex expression evaluation with real query execution
- [x] **Implementation**: Advanced expression processor

### Phase 7: Error Handling and Validation
**Goal**: Implement comprehensive error handling with detailed feedback

#### Step 7.1: Parse-Time Validation
- [x] **Unit Tests**: Syntax validation, token error detection, malformed input handling
- [x] **Integration Tests**: Parse error handling with real malformed DSL inputs
- [x] **Implementation**: Parse-time validator with detailed error reporting

#### Step 7.2: Runtime Validation
- [x] **Unit Tests**: Type validation, constraint checking, entity reference validation
- [x] **Integration Tests**: Runtime validation with real schema enforcement
- [x] **Implementation**: Runtime validator with data-store constraint integration

#### Step 7.3: Error Recovery and Reporting
- [x] **Unit Tests**: Error message generation, line/column tracking, helpful suggestions
- [x] **Integration Tests**: Error recovery with partial DSL processing
- [x] **Implementation**: Error recovery system with graceful degradation

### Phase 8: Integration and End-to-End Testing  
**Goal**: Comprehensive system validation with real-world DSL usage

#### Step 8.1: Complete DSL Workflow Testing
- [x] **Integration Tests**: End-to-end DSL usage with schema → entities → queries → updates
- [x] **Validation**: Complete DSL workflow with real data-store operations

#### Step 8.2: Mixed Syntax Compatibility
- [x] **Integration Tests**: DSL and object syntax interoperability in same application
- [x] **Validation**: Backward compatibility with existing data-store code

#### Step 8.3: Complex Application Scenarios
- [x] **Integration Tests**: Social media, e-commerce, and organizational hierarchy examples from design doc
- [x] **Validation**: Real-world usage patterns work correctly with DSL

#### Step 8.4: DSL API Completeness
- [x] **Integration Tests**: All documented DSL methods and syntax work as specified
- [x] **Validation**: Complete DSL API coverage as defined in design document

## Test Coverage Requirements

### Unit Test Coverage
- All DSL parsing functions and edge cases
- Template literal processing with various input formats
- Error conditions and malformed syntax handling  
- Expression evaluation and type conversion
- Schema/query/update object generation

### Integration Test Coverage  
- Complete DSL workflows without mocks
- Real data-store integration and database operations
- Template literal parsing with actual JavaScript template literal calls
- EntityProxy method integration with DSL syntax
- Error handling with real malformed inputs

### End-to-End Test Scenarios
- Complete application workflows using only DSL syntax
- Mixed DSL and object syntax usage
- Complex multi-entity scenarios from design document
- Performance characteristics under normal DSL usage

## Completion Criteria

Each step is complete when:
- [x] All unit tests pass
- [x] All integration tests pass  
- [x] Code coverage meets requirements
- [x] No error cases are unhandled
- [x] Implementation matches design document specification
- [x] DSL syntax works as documented

## Success Metrics

The MVP is complete when:
- [x] All checkboxes above are marked ✅
- [x] Complete DSL functionality as specified in design document
- [x] Functional correctness validated through integration testing
- [x] DSL seamlessly integrates with existing data-store
- [x] Ready for local usage and User Acceptance Testing (UAT)

## Implementation Notes

### Template Literal Processing
- Use JavaScript's tagged template literal feature
- Parse template strings and interpolated expressions separately
- Convert natural syntax to DataScript object format
- Maintain expression evaluation context

### Data-Store Integration
- Import and extend existing data-store classes
- Maintain full backward compatibility
- Add DSL support to EntityProxy methods without breaking existing functionality
- Integrate with reactive engine and subscription system

### Error Handling Strategy
- Parse-time validation prevents runtime errors
- Detailed error messages with line/column information
- No fallback behavior - all errors must be explicit
- Graceful error reporting without breaking application flow

---

**Note**: This plan prioritizes functional correctness and seamless integration with the existing data-store system. The goal is a fully working DSL that dramatically improves developer experience while maintaining all the power of the underlying reactive data management system.