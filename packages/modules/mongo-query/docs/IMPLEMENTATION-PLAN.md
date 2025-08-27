# MongoDB Query Tool Implementation Plan

## Overview

This plan follows Test-Driven Development (TDD) principles without the refactor step - we aim to get the implementation right the first time. All implementation details follow the design document (DESIGN.md).

## Core Principles

1. **NO MOCKS IN TESTS**: Integration tests use real MongoDB connections and real ResourceManager
2. **NO MOCKS IN IMPLEMENTATION**: Production code never uses mocks or stubs
3. **NO FALLBACKS**: Errors are raised immediately - no silent failures or fallback behaviors
4. **TEST FIRST**: Write tests before implementation for each component
5. **REAL DEPENDENCIES**: All tests use actual Legion modules and tools from the codebase
6. **COMPREHENSIVE COVERAGE**: Both unit and integration tests for all functionality

## Phase 1: Project Setup and Structure

### 1.1 Package Configuration
- [✓] Create package.json with Legion module dependencies
- [✓] Configure Jest for ES modules support
- [✓] Add required dependencies (@legion/tools-registry, @legion/storage, zod, mongodb)
- [✓] Set up test configuration for real MongoDB connection

### 1.2 Module Exports Setup
- [✓] Create src/index.js with proper module exports
- [✓] Export MongoQueryModule as default
- [✓] Export MongoQueryTool as named export

## Phase 2: Tool Implementation (TDD)

### 2.1 MongoQueryTool Core Structure
- [✓] Write unit test for Tool constructor with valid dependencies
- [✓] Write unit test for Tool constructor missing dependencies (should throw)
- [✓] Implement MongoQueryTool class extending Tool
- [✓] Implement constructor with Zod schema validation

### 2.2 Input Schema Validation
- [✓] Write unit tests for all valid command inputs
- [✓] Write unit tests for invalid inputs (missing required fields)
- [✓] Write unit tests for invalid command names
- [✓] Write unit tests for parameter type validation
- [✓] Implement complete Zod schema as per design

### 2.3 Command Execution Mapping
- [✓] Write unit test for executeCommand method structure
- [✓] Write unit tests for each command type parameter mapping
- [✓] Implement executeCommand switch statement
- [✓] Implement parameter mapping for all commands

### 2.4 Database Switching Logic
- [✓] Write unit test for database switching behavior
- [✓] Write unit test for database restoration after execution
- [✓] Implement database switching in _execute method
- [✓] Implement try/finally for database restoration

### 2.5 Event Emission
- [✓] Write unit tests for progress event emission
- [✓] Write unit tests for info event emission
- [✓] Write unit tests for error event emission
- [✓] Implement event emissions in _execute method

## Phase 3: Module Implementation (TDD)

### 3.1 MongoQueryModule Structure
- [✓] Write unit test for Module constructor
- [✓] Write unit test for module properties (name, description)
- [✓] Implement MongoQueryModule extending Module
- [✓] Implement constructor

### 3.2 Async Factory Pattern
- [✓] Write integration test for create() with valid ResourceManager
- [✓] Write integration test for create() without MONGODB_URL (should throw)
- [✓] Write integration test for MongoDBProvider retrieval from ResourceManager
- [✓] Write integration test for MongoDBProvider creation when not exists
- [✓] Implement static async create() method

### 3.3 Module Initialization
- [✓] Write integration test for initialize() method
- [✓] Write integration test for tool registration
- [✓] Implement initialize() method
- [✓] Implement tool registration with MongoQueryTool

## Phase 4: Integration Tests - Query Operations

### 4.1 Find Operations
- [✓] Write integration test for find with empty query
- [✓] Write integration test for find with query conditions
- [✓] Write integration test for find with sort option
- [✓] Write integration test for find with limit option
- [✓] Write integration test for find with skip option
- [✓] Write integration test for find with projection
- [✓] Verify all find tests pass with real MongoDB

### 4.2 FindOne Operations
- [✓] Write integration test for findOne with query
- [✓] Write integration test for findOne with projection
- [✓] Write integration test for findOne no match (returns null)
- [✓] Verify all findOne tests pass

### 4.3 Count Operations
- [✓] Write integration test for countDocuments with empty query
- [✓] Write integration test for countDocuments with conditions
- [✓] Verify count tests pass

### 4.4 Distinct Operations
- [✓] Write integration test for distinct field values
- [✓] Write integration test for distinct with query filter
- [✓] Verify distinct tests pass

### 4.5 Aggregation Pipeline
- [✓] Write integration test for simple aggregation
- [✓] Write integration test for complex multi-stage pipeline
- [✓] Write integration test for aggregation with $group
- [✓] Write integration test for aggregation with $sort
- [✓] Verify aggregation tests pass

## Phase 5: Integration Tests - Write Operations

### 5.1 Insert Operations
- [✓] Write integration test for insertOne
- [✓] Write integration test for insertMany
- [✓] Write integration test for insert validation errors
- [✓] Verify insert tests pass with real MongoDB

### 5.2 Update Operations
- [✓] Write integration test for updateOne
- [✓] Write integration test for updateMany
- [✓] Write integration test for update with upsert
- [✓] Write integration test for update with $set operator
- [✓] Write integration test for update with $inc operator
- [✓] Verify update tests pass

### 5.3 Delete Operations
- [✓] Write integration test for deleteOne
- [✓] Write integration test for deleteMany
- [✓] Write integration test for delete with no matches
- [✓] Verify delete tests pass

## Phase 6: Integration Tests - Admin Operations

### 6.1 Collection Management
- [✓] Write integration test for listCollections
- [✓] Write integration test for dropCollection
- [✓] Write integration test for dropCollection non-existent
- [✓] Verify collection management tests pass

### 6.2 Index Management
- [✓] Write integration test for createIndex single field
- [✓] Write integration test for createIndex compound
- [✓] Write integration test for createIndex with options
- [✓] Verify index tests pass

## Phase 7: Integration Tests - Database Operations

### 7.1 Database Switching
- [✓] Write integration test for operation with different database
- [✓] Write integration test for database restoration after switch
- [✓] Write integration test for multiple operations with database switches
- [✓] Verify database switching works correctly

### 7.2 Default Database Operations
- [✓] Write integration test using default database from .env
- [✓] Write integration test confirming database not changed when not specified
- [✓] Verify default database behavior

## Phase 8: Error Handling Tests

### 8.1 Connection Errors
- [✓] Write integration test for MongoDBProvider not connected
- [✓] Write integration test for invalid connection string
- [✓] Verify proper error messages and formats

### 8.2 Operation Errors
- [✓] Write integration test for invalid collection name
- [✓] Write integration test for malformed query syntax
- [✓] Write integration test for invalid update operators
- [✓] Verify Legion error format compliance

### 8.3 Input Validation Errors
- [✓] Write integration test for missing required fields
- [✓] Write integration test for invalid command names
- [✓] Write integration test for wrong parameter types
- [✓] Verify Zod validation error reporting

## Phase 9: End-to-End Testing

### 9.1 Complete Workflow Tests
- [✓] Write E2E test: Module creation → Tool execution → Result verification
- [✓] Write E2E test: Multiple operations in sequence
- [✓] Write E2E test: Mixed read/write operations
- [✓] Write E2E test: Database switching workflow

### 9.2 ResourceManager Integration
- [✓] Write E2E test with real ResourceManager initialization
- [✓] Write E2E test confirming .env variables are used
- [✓] Write E2E test for MongoDBProvider singleton behavior
- [✓] Verify full ResourceManager integration

## Phase 10: Final Verification

### 10.1 Test Coverage
- [✓] Run test coverage report
- [✓] Verify all methods have test coverage
- [✓] Verify all error paths are tested
- [✓] Confirm no untested code paths

### 10.2 Legion Compliance
- [✓] Verify module follows Legion patterns
- [✓] Verify tool follows Legion Tool interface
- [✓] Verify event emission compliance
- [✓] Verify error format compliance

### 10.3 Functional Verification
- [✓] Run all unit tests - 100% pass
- [✓] Run all integration tests - 100% pass
- [✓] Test with real Legion application
- [✓] Verify all MongoDB operations work as designed

## Success Criteria

1. All tests pass with real MongoDB connection
2. No mocks used anywhere in code or tests
3. All errors are raised (no silent failures)
4. 100% of designed functionality is implemented
5. Tool integrates seamlessly with Legion's ResourceManager
6. All MongoDB operations work with native JSON syntax

## Notes

- Each test must use real MongoDB connections via ResourceManager
- Each test must use real Legion modules and dependencies
- No test doubles, stubs, or mocks permitted
- Errors must propagate - no fallback behaviors
- Focus solely on functional correctness for MVP