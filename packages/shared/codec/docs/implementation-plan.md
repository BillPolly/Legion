# @legion/codec Implementation Plan

## Overview

This implementation plan follows a Test-Driven Development (TDD) approach without the traditional refactor step. The goal is to implement the codec system correctly on the first attempt by following the design document specifications precisely.

## Implementation Approach

### TDD Rules
1. **Test First**: Write comprehensive tests before any implementation code
2. **Red-Green**: Tests must fail initially, then implementation makes them pass
3. **No Refactor**: Get the implementation right on first try following design specifications
4. **Comprehensive Coverage**: Every public method and error case must be tested

### MVP Focus
- **Functional Correctness**: All features work according to design specification
- **Complete API**: All documented methods implemented and tested
- **Error Handling**: All error cases handled gracefully with proper messages
- **Schema Validation**: Complete JSON Schema validation using AJV
- **Protocol Support**: Full schema negotiation protocol implementation

### Testing Strategy
- **Unit Tests**: Test individual classes and methods in isolation
- **Integration Tests**: Test complete workflows and component interactions
- **Schema Tests**: Validate schema definitions and validation logic
- **Protocol Tests**: Test schema negotiation and message exchange flows
- **Error Tests**: Verify all error conditions and edge cases

## Implementation Phases

### Phase 1: Foundation Infrastructure
**Objective**: Establish core testing infrastructure and utility components

- ✅ **Step 1.1**: Set up Jest testing environment with ES modules support
- ✅ **Step 1.2**: Create test utilities for schema validation and message generation
- ✅ **Step 1.3**: Set up test coverage reporting and ensure comprehensive coverage requirements
- ✅ **Step 1.4**: Create mock data generators for testing various message types
- ✅ **Step 1.5**: Establish testing patterns and conventions for consistent test structure

### Phase 2: Schema Validator Component
**Objective**: Implement JSON Schema validation using AJV with comprehensive error reporting

- ✅ **Step 2.1**: Write tests for SchemaValidator constructor and initialization
- ✅ **Step 2.2**: Write tests for addSchema() method with valid and invalid schemas
- ✅ **Step 2.3**: Write tests for validate() method with various data types and validation scenarios
- ✅ **Step 2.4**: Write tests for error reporting with detailed validation failure messages
- ✅ **Step 2.5**: Write tests for schema management (getSchemaIds, getSchema, removeSchema, clear)
- ✅ **Step 2.6**: Implement SchemaValidator class to pass all tests
- ✅ **Step 2.7**: Write integration tests for AJV format validation (date-time, email, uri, etc.)

### Phase 3: Schema Registry Component
**Objective**: Implement schema storage and management system with versioning support

- ✅ **Step 3.1**: Write tests for SchemaRegistry constructor and base schema loading
- ✅ **Step 3.2**: Write tests for register() method with schema validation and ID requirements
- ✅ **Step 3.3**: Write tests for get(), getAll(), and has() methods with various scenarios
- ✅ **Step 3.4**: Write tests for version management (getVersion, setVersion) with semver validation
- ✅ **Step 3.5**: Write tests for loadSchemas() method with replace and merge functionality
- ✅ **Step 3.6**: Write tests for createSchemaDefinitionMessage() with complete schema export
- ✅ **Step 3.7**: Implement SchemaRegistry class to pass all tests
- ✅ **Step 3.8**: Write integration tests for registry and validator working together

### Phase 4: Built-in Schema Definitions
**Objective**: Implement all system message schemas as specified in design document

- ✅ **Step 4.1**: Write tests validating schema_definition message structure and constraints
- ✅ **Step 4.2**: Write tests validating error_message schema with all error codes
- ✅ **Step 4.3**: Write tests validating ack_message schema with status validation
- ✅ **Step 4.4**: Write tests validating ping/pong message schemas
- ✅ **Step 4.5**: Write tests for automatic base schema registration in SchemaRegistry
- ✅ **Step 4.6**: Implement all base schemas in schemas/base.js to pass tests
- ✅ **Step 4.7**: Write integration tests validating all base schemas work with validator

### Phase 5: Core Codec Implementation
**Objective**: Implement main Codec class with encoding/decoding functionality

- ✅ **Step 5.1**: Write tests for Codec constructor with all configuration options
- ✅ **Step 5.2**: Write tests for registerSchema() method and integration with registry/validator
- ✅ **Step 5.3**: Write tests for encode() method with valid messages and metadata injection
- ✅ **Step 5.4**: Write tests for encode() error cases (unknown schema, validation failures)
- ✅ **Step 5.5**: Write tests for decode() method with valid JSON and type extraction
- ✅ **Step 5.6**: Write tests for decode() error cases (invalid JSON, unknown types, validation failures)
- ✅ **Step 5.7**: Write tests for utility methods (getMessageTypes, hasMessageType, getSchema)
- ✅ **Step 5.8**: Implement Codec class to pass all tests
- ✅ **Step 5.9**: Write integration tests for complete encode/decode round trips

### Phase 6: Protocol Message Creation
**Objective**: Implement protocol message creation methods for system communication

- ✅ **Step 6.1**: Write tests for createSchemaDefinitionMessage() with complete schema export
- ✅ **Step 6.2**: Write tests for createErrorMessage() with all error codes and details
- ✅ **Step 6.3**: Write tests for createAckMessage() with message ID and status validation
- ✅ **Step 6.4**: Write tests for generateMessageId() uniqueness and format
- ✅ **Step 6.5**: Write tests for loadSchemaDefinition() with schema import and validation
- ✅ **Step 6.6**: Implement all protocol message methods to pass tests
- ✅ **Step 6.7**: Write integration tests for schema negotiation protocol workflow

### Phase 7: Comprehensive Error Handling
**Objective**: Ensure all error cases are handled gracefully with proper error messages

- ✅ **Step 7.1**: Write tests for all encoding error scenarios and error message formats
- ✅ **Step 7.2**: Write tests for all decoding error scenarios and error message formats
- ✅ **Step 7.3**: Write tests for schema registration errors and validation failures
- ✅ **Step 7.4**: Write tests for protocol errors (version mismatches, invalid schema definitions)
- ✅ **Step 7.5**: Write tests ensuring no exceptions are thrown, only error objects returned
- ✅ **Step 7.6**: Implement comprehensive error handling to pass all tests
- ✅ **Step 7.7**: Write integration tests for error recovery and graceful degradation

### Phase 8: Integration Testing
**Objective**: Test complete workflows and real-world usage scenarios

- ✅ **Step 8.1**: Write integration tests for client-server schema negotiation workflow
- ✅ **Step 8.2**: Write integration tests for custom message type registration and usage
- ✅ **Step 8.3**: Write integration tests for complex nested message schemas
- ✅ **Step 8.4**: Write integration tests for multiple codec instances with shared schemas
- ✅ **Step 8.5**: Write integration tests for protocol error handling and recovery
- ✅ **Step 8.6**: Write integration tests for message metadata (IDs, timestamps) functionality
- ✅ **Step 8.7**: Write end-to-end tests simulating WebSocket communication patterns
- ✅ **Step 8.8**: Validate all integration tests pass with 100% coverage

### Phase 9: Package Finalization
**Objective**: Complete package setup and ensure production readiness

- ✅ **Step 9.1**: Verify all exports work correctly from main index.js
- ✅ **Step 9.2**: Ensure package.json dependencies are complete and correct
- ✅ **Step 9.3**: Validate all tests pass with comprehensive coverage (>95%)
- ✅ **Step 9.4**: Create simple usage examples demonstrating core functionality
- ✅ **Step 9.5**: Update README.md with quick start examples and installation instructions
- ✅ **Step 9.6**: Verify package can be imported and used in external projects
- ✅ **Step 9.7**: Run final comprehensive test suite to ensure all functionality works

## Completion Criteria

### Functional Requirements
- ✅ All public methods implemented according to design specification
- ✅ Complete schema validation using JSON Schema and AJV
- ✅ Full schema negotiation protocol implementation
- ✅ All built-in message types working correctly
- ✅ Comprehensive error handling with structured error responses
- ✅ Message metadata injection (IDs, timestamps) working correctly

### Testing Requirements
- ✅ Unit test coverage >95% for all public methods
- ✅ Integration tests covering all major workflows
- ✅ All error cases tested and handled gracefully
- ✅ Schema validation tested with various valid/invalid inputs
- ✅ Protocol negotiation tested end-to-end
- ✅ All tests pass consistently without flaky behavior

### Package Requirements  
- ✅ Package exports work correctly from index.js
- ✅ All dependencies properly declared in package.json
- ✅ README documentation complete with examples
- ✅ Design document accurately reflects implementation
- ✅ Package ready for integration into Legion framework

## Success Metrics

- **Test Coverage**: >95% line coverage across all source files
- **Test Count**: >100 individual test cases covering all functionality
- **Error Handling**: 100% of error cases return proper error objects (no exceptions)
- **Schema Compliance**: 100% of built-in schemas validate correctly
- **Protocol Compliance**: Complete schema negotiation workflow functional
- **API Completeness**: All documented methods implemented and tested