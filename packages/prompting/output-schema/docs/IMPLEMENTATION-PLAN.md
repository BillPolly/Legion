# Output-Schema Implementation Plan

## Overview

This implementation plan follows a Test-Driven Development (TDD) approach without the refactor step - we aim to get it right the first time. The implementation will be guided by the comprehensive [Design Document](./DESIGN.md) and focuses solely on functional correctness for MVP delivery.

## Implementation Approach

### Core Principles
- **TDD Methodology**: Write tests first, then implement to pass tests
- **No Refactor Step**: Design carefully upfront, implement correctly first time
- **Comprehensive Testing**: Both unit tests and integration tests for full coverage
- **Real Dependencies**: Use actual `@legion/schema` package, real JSON parsing, etc.
- **Fail Fast**: No fallbacks, raise errors immediately when something goes wrong
- **No Mocks in Implementation**: Implementation code never contains mock implementations

### Testing Rules
- **Unit Tests**: Test individual classes and methods in isolation (mocks allowed)
- **Integration Tests**: Test complete workflows with real dependencies (NO MOCKS)
- **Real Data**: Use actual schema validation, real JSON parsing, real format detection
- **Error Scenarios**: Comprehensive testing of error cases and edge conditions

### Scope for MVP
- **Functional Correctness**: Core functionality working as specified
- **Local Development**: Running in development environment only
- **UAT Ready**: Suitable for user acceptance testing
- **No NFRs**: No security, performance, scalability, or deployment concerns

## Implementation Phases

### Phase 1: Foundation & Schema Extensions
**Goal**: Establish core infrastructure and extended schema support

- [x] **Step 1.1**: Set up project structure and dependencies
  - Configure Jest testing framework
  - Add dependencies (`@legion/schema`, `json5`)
  - Create basic package exports

- [x] **Step 1.2**: Implement SchemaExtensions utility class (TDD)
  - Write tests for schema validation
  - Write tests for format specification extraction
  - Implement schema extension parsing and validation

- [x] **Step 1.3**: Create base schema validation (TDD)
  - Write tests for extended schema structure validation
  - Write tests for `x-format` and `x-parsing` property validation
  - Implement extended schema validation logic

### Phase 2: Format Detection System
**Goal**: Implement automatic format detection for LLM responses

- [x] **Step 2.1**: Implement FormatDetector class (TDD)
  - Write tests for JSON format detection
  - Write tests for XML format detection  
  - Write tests for delimited sections detection
  - Write tests for tagged content detection
  - Write tests for markdown detection
  - Implement format detection algorithms

- [x] **Step 2.2**: Format confidence scoring (TDD)
  - Write tests for detection confidence calculation
  - Write tests for format disambiguation
  - Implement confidence scoring system

- [x] **Step 2.3**: Integration tests for format detection
  - Test with real LLM response samples (various formats)
  - Test edge cases and malformed responses
  - Test format fallback ordering

### Phase 3: Format-Specific Parsers
**Goal**: Implement parsers for each supported format

- [x] **Step 3.1**: JSON ResponseParser (TDD)
  - Write tests for standard JSON parsing
  - Write tests for JSON5 lenient parsing
  - Write tests for JSON extraction from markdown blocks
  - Write tests for malformed JSON handling
  - Implement JSON parser with error reporting

- [x] **Step 3.2**: XML ResponseParser (TDD)
  - Write tests for basic XML element extraction
  - Write tests for nested XML structures
  - Write tests for XML attributes and CDATA
  - Write tests for malformed XML handling
  - Implement regex-based XML parser

- [x] **Step 3.3**: Delimited ResponseParser (TDD)
  - Write tests for section boundary detection
  - Write tests for flexible delimiter matching
  - Write tests for array parsing (numbered, bullet, plain)
  - Write tests for malformed delimiter handling
  - Implement delimited section parser

- [x] **Step 3.4**: Tagged ResponseParser (TDD)
  - Write tests for tag-based content extraction
  - Write tests for nested and repeated tags
  - Write tests for flexible tag casing
  - Write tests for malformed tag handling
  - Implement tagged content parser

- [x] **Step 3.5**: Markdown ResponseParser (TDD)
  - Write tests for header-based section extraction
  - Write tests for list structure parsing
  - Write tests for code block handling
  - Write tests for malformed markdown handling
  - Implement markdown structure parser

### Phase 4: Intelligent Prompt Generation
**Goal**: Implement intelligent prompt instruction generation from schema + example

- [x] **Step 4.1**: Schema analysis engine (TDD)
  - Write tests for field type extraction
  - Write tests for constraint identification (min/max, required, etc.)
  - Write tests for description parsing
  - Write tests for format specification extraction
  - Implement schema analysis logic

- [x] **Step 4.2**: Example data analysis (TDD)
  - Write tests for value pattern inference
  - Write tests for array structure identification
  - Write tests for formatting style detection
  - Write tests for field relationship understanding
  - Implement example analysis logic

- [x] **Step 4.3**: Format-specific instruction generators (TDD)
  - Write tests for JSON instruction generation
  - Write tests for XML instruction generation
  - Write tests for delimited instruction generation
  - Write tests for tagged instruction generation
  - Write tests for markdown instruction generation
  - Implement instruction generation for each format

- [x] **Step 4.4**: Integration tests for prompt generation
  - Test complete schema + example → instruction workflows
  - Test instruction quality with various schema types
  - Test cross-format instruction consistency
  - Test edge cases and complex schemas

### Phase 5: Core ResponseValidator
**Goal**: Implement main ResponseValidator class with dual functionality

- [x] **Step 5.1**: ResponseValidator constructor and validation (TDD)
  - Write tests for schema validation on construction
  - Write tests for configuration options handling
  - Write tests for format support detection
  - Implement constructor and basic validation

- [x] **Step 5.2**: generateInstructions() method (TDD)
  - Write tests for instruction generation with various options
  - Write tests for format selection logic
  - Write tests for example data validation
  - Write tests for instruction customization options
  - Implement complete instruction generation method

- [x] **Step 5.3**: process() method (TDD)
  - Write tests for response processing workflow
  - Write tests for format detection integration
  - Write tests for parser selection and execution
  - Write tests for validation integration
  - Write tests for result standardization
  - Implement complete response processing method

- [x] **Step 5.4**: Error handling and reporting (TDD)
  - Write tests for parse error classification
  - Write tests for validation error formatting
  - Write tests for structured error generation
  - Write tests for actionable error suggestions
  - Implement comprehensive error handling

### Phase 6: Integration with Legion Framework
**Goal**: Ensure seamless integration with existing Legion infrastructure

- [x] **Step 6.1**: ResourceManager integration (TDD)
  - Write tests for ResourceManager compatibility
  - Write tests for singleton behavior
  - Implement ResourceManager integration

- [x] **Step 6.2**: Schema package integration (TDD)
  - Write tests for `@legion/schema` validation integration
  - Write tests for validator reuse and performance
  - Write tests for error compatibility
  - Implement seamless schema package usage

- [x] **Step 6.3**: Legion framework compatibility tests
  - Test Actor framework message passing (if applicable)
  - Test package loading and initialization
  - Test error handling consistency with Legion patterns

### Phase 7: Comprehensive Integration Testing
**Goal**: End-to-end testing with real scenarios and no mocks

- [x] **Step 7.1**: Complete workflow integration tests
  - Test full schema → instruction → response → validation cycles
  - Test with various schema complexities
  - Test with multiple response formats per schema
  - Test error recovery scenarios
  - **NO MOCKS USED** - all real dependencies

- [x] **Step 7.2**: Real-world scenario testing
  - Test with realistic LLM response samples
  - Test with edge cases and malformed responses
  - Test with complex nested data structures
  - Test with various data types and constraints

- [x] **Step 7.3**: Error scenario comprehensive testing
  - Test all parse error conditions
  - Test all validation error conditions
  - Test error message quality and actionability
  - Test partial result handling

- [x] **Step 7.4**: Performance baseline testing
  - Test response processing speed with large responses
  - Test memory usage with complex schemas
  - Test instruction generation performance
  - (Note: No optimization required for MVP, just baseline measurement)

### Phase 8: Package Finalization
**Goal**: Finalize package for local development and UAT

- [x] **Step 8.1**: Package exports and API surface
  - Verify all public APIs are properly exported
  - Test package importing in various contexts
  - Validate API consistency with design document

- [x] **Step 8.2**: Final integration testing
  - Test package installation and usage
  - Test with Legion monorepo workspace dependencies
  - Test error handling at package boundaries

- [x] **Step 8.3**: UAT preparation
  - Prepare comprehensive test scenarios for UAT
  - Document any known limitations or edge cases
  - Verify all design document requirements are met

## Success Criteria

### Functional Requirements Met
- [x] ResponseValidator can generate intelligent prompt instructions from any valid schema + example
- [x] ResponseValidator can parse responses in JSON, XML, delimited, tagged, and markdown formats
- [x] All parsing returns standardized `{success, data}` or `{success, errors}` format
- [x] Error messages are actionable and suitable for reprompting systems
- [x] Format detection works automatically with high confidence
- [x] Integration with `@legion/schema` validation is seamless

### Testing Requirements Met
- [x] Unit test coverage > 90% for all classes and methods (190 tests passing)
- [x] Integration tests cover all major workflows without mocks
- [x] All error scenarios are tested and handled correctly
- [x] Performance baselines are established (no optimization required)

### Quality Requirements Met
- [x] No fallback logic - all errors are raised immediately
- [x] No mock implementations in production code
- [x] Code follows Legion framework patterns and conventions
- [x] Package works correctly in Legion monorepo environment

## Notes

- **TDD Approach**: Each implementation step must be preceded by comprehensive test writing
- **No Mocks in Integration**: Integration tests use real `@legion/schema`, real JSON parsing, real format detection
- **Fail Fast Philosophy**: Implementation raises errors immediately rather than providing fallbacks
- **MVP Focus**: Functional correctness only - no performance optimization, security, or deployment concerns
- **Local Development**: Package optimized for local development and UAT testing only