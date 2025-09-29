# Neo4j DataSource Implementation Plan

## Overview

This implementation plan follows Test-Driven Development (TDD) methodology without the refactor phase - we aim to get it right first time. The plan is organized in phases that build upon each other, with each phase delivering demonstrable value.

## Implementation Rules

1. **TDD Approach**: Write tests first, then implementation to make tests pass
2. **No Mocks in Integration Tests**: All integration tests use real Neo4j instance
3. **No Mocks in Implementation**: Implementation code never contains mocks or stubs
4. **No Fallbacks**: Fail fast with clear errors - no silent failures or fallbacks
5. **Test Coverage**: Both unit and integration tests for all components
6. **Design Reference**: Always refer to design.md for specifications
7. **Dependency Order**: Build core mechanisms first, then elaborate
8. **MVP Focus**: Functional correctness only - no NFRs, security, or performance optimization

## Phase 0: ResourceManager Neo4j Integration

**Goal**: Extend ResourceManager to provide Neo4j server handles with automatic Docker management

### Steps:

- [ ] **0.1** Re-read ResourceManager implementation to understand extension pattern
- [ ] **0.2** Write tests for ResourceManager.getNeo4jServer() method
- [ ] **0.3** Implement Neo4jServerProvider in ResourceManager that manages Docker container
- [ ] **0.4** Add Docker container check - start Neo4j if not running
- [ ] **0.5** Implement connection pooling within ResourceManager for Neo4j
- [ ] **0.6** Write integration test verifying ResourceManager provides working Neo4j handle
- [ ] **0.7** Test that multiple calls return same Neo4j server instance (singleton)
- [ ] **0.8** Verify automatic cleanup when ResourceManager shuts down

**Deliverable**: ResourceManager that automatically manages Neo4j Docker container and provides server handles

## Phase 1: Core Infrastructure and Connection

**Goal**: Establish Neo4j connection and basic DataSource structure

### Steps:

- [ ] **1.1** Re-read design document completely
- [ ] **1.2** Create package.json with neo4j-driver dependency
- [ ] **1.3** Write unit tests for Neo4jConnectionPool getting server from ResourceManager
- [ ] **1.4** Implement Neo4jConnectionPool using ResourceManager.getNeo4jServer()
- [ ] **1.5** Write unit tests for TypeMapper utility
- [ ] **1.6** Implement TypeMapper for Neo4j ↔ JavaScript type conversion
- [ ] **1.7** Write integration test using real Neo4j from ResourceManager
- [ ] **1.8** Verify connection through ResourceManager-provided Neo4j works

**Deliverable**: Working connection to Neo4j database through ResourceManager with type mapping

## Phase 2: DataSource Foundation

**Goal**: Implement core DataSource interface with synchronous methods

### Steps:

- [ ] **2.1** Re-read design document sections on DataSource
- [ ] **2.2** Write unit tests for Neo4jDataSource constructor and configuration
- [ ] **2.3** Implement Neo4jDataSource constructor with ResourceManager integration
- [ ] **2.4** Write unit tests for getSchema() method
- [ ] **2.5** Implement getSchema() to return database metadata
- [ ] **2.6** Write unit tests for internal cache mechanism
- [ ] **2.7** Implement synchronous cache for query results
- [ ] **2.8** Write integration test for DataSource with real Neo4j
- [ ] **2.9** Verify DataSource can connect and retrieve schema

**Deliverable**: DataSource that can connect to Neo4j and provide schema information

## Phase 3: Query Execution

**Goal**: Implement query execution with Cypher

### Steps:

- [ ] **3.1** Re-read design document sections on query patterns
- [ ] **3.2** Write unit tests for CypherQueryBuilder basic operations
- [ ] **3.3** Implement CypherQueryBuilder with match, where, return
- [ ] **3.4** Write unit tests for query() method in DataSource
- [ ] **3.5** Implement query() method with synchronous result handling
- [ ] **3.6** Write unit tests for QueryResultHandle
- [ ] **3.7** Implement QueryResultHandle with result wrapping
- [ ] **3.8** Write integration tests for executing Cypher queries
- [ ] **3.9** Verify queries execute and return correct results

**Deliverable**: Ability to execute Cypher queries and handle results

## Phase 4: GraphDatabaseHandle

**Goal**: Implement root handle for database operations

### Steps:

- [ ] **4.1** Re-read design document sections on GraphDatabaseHandle
- [ ] **4.2** Write unit tests for GraphDatabaseHandle construction
- [ ] **4.3** Implement GraphDatabaseHandle base structure
- [ ] **4.4** Write unit tests for labels() and relationshipTypes() methods
- [ ] **4.5** Implement schema inspection methods
- [ ] **4.6** Write unit tests for query() method on handle
- [ ] **4.7** Implement query() delegation to DataSource
- [ ] **4.8** Write integration tests for GraphDatabaseHandle
- [ ] **4.9** Verify handle can execute queries against real database

**Deliverable**: Root handle that can query database and inspect schema

## Phase 5: Node Operations

**Goal**: Implement NodeHandle and node CRUD operations

### Steps:

- [ ] **5.1** Re-read design document sections on NodeHandle
- [ ] **5.2** Write unit tests for NodeHandle value() and get() methods
- [ ] **5.3** Implement NodeHandle basic property access
- [ ] **5.4** Write unit tests for createNode() in GraphDatabaseHandle
- [ ] **5.5** Implement createNode() with label and property support
- [ ] **5.6** Write unit tests for findNode() and findNodes()
- [ ] **5.7** Implement node finding operations
- [ ] **5.8** Write unit tests for node update() and delete()
- [ ] **5.9** Implement node mutation operations
- [ ] **5.10** Write unit tests for label operations (add/remove)
- [ ] **5.11** Implement label manipulation methods
- [ ] **5.12** Write integration tests for complete node lifecycle
- [ ] **5.13** Verify all node operations work with real database

**Deliverable**: Full node CRUD operations through NodeHandle

## Phase 6: Relationship Operations

**Goal**: Implement RelationshipHandle and relationship management

### Steps:

- [ ] **6.1** Re-read design document sections on RelationshipHandle
- [ ] **6.2** Write unit tests for RelationshipHandle properties
- [ ] **6.3** Implement RelationshipHandle basic structure
- [ ] **6.4** Write unit tests for createRelationship() in GraphDatabaseHandle
- [ ] **6.5** Implement relationship creation between nodes
- [ ] **6.6** Write unit tests for startNode() and endNode() methods
- [ ] **6.7** Implement relationship node access methods
- [ ] **6.8** Write unit tests for relationship update() and delete()
- [ ] **6.9** Implement relationship mutation operations
- [ ] **6.10** Write integration tests for relationship operations
- [ ] **6.11** Verify relationships work correctly with real database

**Deliverable**: Full relationship CRUD operations

## Phase 7: Graph Traversal

**Goal**: Implement navigation and path operations

### Steps:

- [ ] **7.1** Re-read design document sections on traversal and PathHandle
- [ ] **7.2** Write unit tests for NodeHandle relationships() method
- [ ] **7.3** Implement relationships() to find connected edges
- [ ] **7.4** Write unit tests for NodeHandle neighbors() method
- [ ] **7.5** Implement neighbors() for node traversal
- [ ] **7.6** Write unit tests for PathHandle structure
- [ ] **7.7** Implement PathHandle with nodes and relationships
- [ ] **7.8** Write unit tests for shortestPathTo() method
- [ ] **7.9** Implement shortest path algorithm
- [ ] **7.10** Write integration tests for graph traversal
- [ ] **7.11** Verify traversal operations with real graph data

**Deliverable**: Graph traversal capabilities

## Phase 8: Pattern Matching

**Goal**: Implement pattern-based graph queries

### Steps:

- [ ] **8.1** Re-read design document sections on pattern matching
- [ ] **8.2** Write unit tests for PatternMatcher utility
- [ ] **8.3** Implement PatternMatcher to convert patterns to Cypher
- [ ] **8.4** Write unit tests for match() method in GraphDatabaseHandle
- [ ] **8.5** Implement match() with pattern support
- [ ] **8.6** Write unit tests for complex pattern scenarios
- [ ] **8.7** Implement support for multiple nodes and relationships
- [ ] **8.8** Write integration tests for pattern matching
- [ ] **8.9** Verify pattern matching works with real database

**Deliverable**: Pattern-based graph querying

## Phase 9: Transactions

**Goal**: Implement transaction support

### Steps:

- [ ] **9.1** Re-read design document sections on TransactionHandle
- [ ] **9.2** Write unit tests for TransactionHandle structure
- [ ] **9.3** Implement TransactionHandle base functionality
- [ ] **9.4** Write unit tests for beginTransaction() method
- [ ] **9.5** Implement transaction creation in GraphDatabaseHandle
- [ ] **9.6** Write unit tests for commit() and rollback()
- [ ] **9.7** Implement transaction completion methods
- [ ] **9.8** Write unit tests for operations within transaction
- [ ] **9.9** Implement node/relationship creation in transaction context
- [ ] **9.10** Write integration tests for transaction scenarios
- [ ] **9.11** Verify transactions work correctly with real database

**Deliverable**: Full transaction support

## Phase 10: Update Operations

**Goal**: Implement DataSource update() method

### Steps:

- [ ] **10.1** Re-read design document sections on update operations
- [ ] **10.2** Write unit tests for update() method specifications
- [ ] **10.3** Implement update() in Neo4jDataSource
- [ ] **10.4** Write unit tests for batch operations
- [ ] **10.5** Implement batch node and relationship creation
- [ ] **10.6** Write integration tests for update scenarios
- [ ] **10.7** Verify updates work correctly with real database

**Deliverable**: Complete update operation support

## Phase 11: Subscription System

**Goal**: Implement change detection and subscriptions

### Steps:

- [ ] **11.1** Re-read design document sections on subscriptions
- [ ] **11.2** Write unit tests for subscribe() method
- [ ] **11.3** Implement subscribe() in Neo4jDataSource
- [ ] **11.4** Write unit tests for subscription management
- [ ] **11.5** Implement subscription tracking and cleanup
- [ ] **11.6** Write unit tests for change detection
- [ ] **11.7** Implement transaction log monitoring
- [ ] **11.8** Write integration tests for subscriptions
- [ ] **11.9** Verify subscriptions trigger on real database changes

**Deliverable**: Working subscription system

## Phase 12: Advanced Query Features

**Goal**: Complete CypherQueryBuilder with all features

### Steps:

- [ ] **12.1** Re-read design document sections on CypherQueryBuilder
- [ ] **12.2** Write unit tests for orderBy() and limit()
- [ ] **12.3** Implement sorting and pagination in query builder
- [ ] **12.4** Write unit tests for with() and aggregation
- [ ] **12.5** Implement advanced Cypher features
- [ ] **12.6** Write unit tests for parameter binding
- [ ] **12.7** Implement safe parameter handling
- [ ] **12.8** Write integration tests for complex queries
- [ ] **12.9** Verify advanced queries work with real database

**Deliverable**: Full-featured query builder

## Phase 13: TripleStore Integration

**Goal**: Enable Neo4j as TripleStore backend

### Steps:

- [ ] **13.1** Re-read design document sections on TripleStore integration
- [ ] **13.2** Write unit tests for Neo4jTripleProvider
- [ ] **13.3** Implement Neo4jTripleProvider constructor
- [ ] **13.4** Write unit tests for addTriple() method
- [ ] **13.5** Implement triple to graph conversion
- [ ] **13.6** Write unit tests for query() triple patterns
- [ ] **13.7** Implement triple pattern to Cypher conversion
- [ ] **13.8** Write integration tests with TripleStore package
- [ ] **13.9** Verify Neo4j works as TripleStore backend

**Deliverable**: Working TripleStore integration

## Phase 14: Error Handling

**Goal**: Implement comprehensive error handling

### Steps:

- [ ] **14.1** Re-read design document sections on error handling
- [ ] **14.2** Write unit tests for Neo4jConnectionError
- [ ] **14.3** Implement connection error handling
- [ ] **14.4** Write unit tests for CypherSyntaxError
- [ ] **14.5** Implement query error handling
- [ ] **14.6** Write unit tests for ConstraintViolationError
- [ ] **14.7** Implement constraint error handling
- [ ] **14.8** Write integration tests for error scenarios
- [ ] **14.9** Verify all errors are properly thrown and caught

**Deliverable**: Robust error handling

## Phase 15: Final Integration Testing

**Goal**: Comprehensive end-to-end testing

### Steps:

- [ ] **15.1** Re-read entire design document
- [ ] **15.2** Write comprehensive integration test suite
- [ ] **15.3** Test complete graph creation workflow
- [ ] **15.4** Test complex traversal scenarios
- [ ] **15.5** Test transaction rollback scenarios
- [ ] **15.6** Test subscription with multiple listeners
- [ ] **15.7** Test TripleStore integration end-to-end
- [ ] **15.8** Verify all design requirements are met
- [ ] **15.9** Run all tests and ensure 100% pass rate

**Deliverable**: Fully tested Neo4j DataSource implementation

---

## Notes

- Each phase builds on previous phases
- Integration tests use real Neo4j instance (no mocks)
- Implementation code contains no mocks or fallbacks
- All errors are thrown immediately (fail fast)
- Design document is the source of truth for all specifications
- Update this document with ✅ as steps are completed