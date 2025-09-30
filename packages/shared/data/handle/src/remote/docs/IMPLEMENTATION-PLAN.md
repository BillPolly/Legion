# RemoteHandle Implementation Plan

## Overview

This plan implements RemoteHandle using Test-Driven Development (TDD) without the refactor phase - we aim to get the implementation right on the first try. Each phase builds upon the previous, ensuring we have working, demonstrable functionality at every step.

All implementation details are in [DESIGN.md](./DESIGN.md) - this plan references that document rather than duplicating information.

## Approach

1. **Test-First**: Write tests before implementation for each step
2. **No Refactor Phase**: Design carefully upfront, implement correctly first time
3. **Dependency Order**: Implement in natural dependency order - foundation first, elaboration later
4. **Demonstrable Value**: Each phase produces working, testable functionality
5. **No Mocks in Integration Tests**: Integration tests use real components (ActorSpace, Channel, DataSource)
6. **Fail Fast**: Raise errors immediately, no fallbacks or mock implementations in production code
7. **Comprehensive Testing**: Both unit and integration tests for all components

## Rules

- **ALWAYS** re-read [DESIGN.md](./DESIGN.md) at the start of each phase
- **NO MOCKS** in integration tests - use real ActorSpace, real Channel, real DataSource
- **NO FALLBACKS** in implementation code - fail fast with clear errors
- **NO MOCK IMPLEMENTATIONS** in production code - only real implementations
- **MVP FOCUS**: Functional correctness only - no NFRs (security, performance, migration, documentation)
- **LOCAL TESTING**: No deployment, publishing, or production concerns
- **UPDATE THIS PLAN**: Mark steps complete with ✅ as work progresses

---

## Phase 1: Foundation - Remote Call Mechanism

**Objective**: Implement the basic request/response pattern for remote method calls

### Steps

- ☐ **1.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Remote Communication Pattern"
- ☐ **1.2** Create `RemoteCallManager.js` unit test file
- ☐ **1.3** Write tests for RemoteCallManager:
  - Generate unique call IDs
  - Store pending calls with resolve/reject handlers
  - Resolve pending calls with results
  - Reject pending calls with errors
  - Handle timeout scenarios
- ☐ **1.4** Implement `RemoteCallManager.js` to pass all tests
- ☐ **1.5** Create integration test `RemoteCallManager.integration.test.js`
- ☐ **1.6** Write integration tests with real Actor channel (no mocks):
  - Send call through real WebSocket
  - Receive response through real WebSocket
  - Verify promise resolution
- ☐ **1.7** Verify all Phase 1 tests pass

**Deliverable**: Working request/response mechanism for remote calls

---

## Phase 2: Core RemoteHandle - DataSource Interface

**Objective**: Implement RemoteHandle as a Handle that is its own DataSource

### Steps

- ☐ **2.1** Re-read [DESIGN.md](./DESIGN.md) Sections: "Architecture" and "DataSource Implementation"
- ☐ **2.2** Create `RemoteHandle.test.js` unit test file
- ☐ **2.3** Write tests for RemoteHandle construction:
  - Accepts actorGuid, channel, serialization data
  - Extends Handle
  - Passes self as DataSource (`super(this)`)
  - Stores schema, handleType, capabilities
- ☐ **2.4** Write tests for DataSource interface implementation:
  - `query(querySpec)` - delegates to RemoteCallManager
  - `getSchema()` - returns cached schema
  - `queryBuilder(sourceHandle)` - returns DefaultQueryBuilder
- ☐ **2.5** Implement `RemoteHandle.js` to pass all tests
- ☐ **2.6** Create integration test `RemoteHandle.integration.test.js`
- ☐ **2.7** Write integration tests with real Handle on server (no mocks):
  - Create real DataSource on server
  - Create real Handle wrapping DataSource
  - Send Handle through real Actor channel
  - Receive RemoteHandle on client
  - Verify RemoteHandle is instance of Handle
  - Verify RemoteHandle.dataSource === RemoteHandle (self-referential)
- ☐ **2.8** Verify all Phase 2 tests pass

**Deliverable**: RemoteHandle that implements DataSource interface

---

## Phase 3: ActorSerializer Integration

**Objective**: Integrate RemoteHandle serialization/deserialization into ActorSerializer

### Steps

- ☐ **3.1** Re-read [DESIGN.md](./DESIGN.md) Section: "ActorSerializer Integration"
- ☐ **3.2** Create test file for ActorSerializer RemoteHandle support
- ☐ **3.3** Write tests for Handle serialization:
  - Handle.serialize() returns `{__type: 'RemoteHandle', actorGuid, handleType, schema, capabilities}`
  - ActorSerializer detects Actor and generates GUID
  - Serialized object includes all required fields
- ☐ **3.4** Write tests for RemoteHandle deserialization:
  - ActorSerializer detects `__type: 'RemoteHandle'`
  - Creates RemoteHandle instance with correct data
  - Registers RemoteHandle in ActorSpace
  - Returns RemoteHandle ready for use
- ☐ **3.5** Update `Handle.serialize()` to include schema and capabilities
- ☐ **3.6** Update `ActorSerializer.deserialize()` to handle `__type: 'RemoteHandle'`
- ☐ **3.7** Create integration test `ActorSerializer.RemoteHandle.integration.test.js`
- ☐ **3.8** Write integration test with real Actor channel (no mocks):
  - Create real Handle with schema on server
  - Serialize through ActorSerializer
  - Send through real WebSocket
  - Deserialize on client
  - Verify RemoteHandle has correct schema, handleType, actorGuid
- ☐ **3.9** Verify all Phase 3 tests pass

**Deliverable**: Full serialization/deserialization of Handles through Actor channels

---

## Phase 4: Remote Query Execution

**Objective**: Implement end-to-end query execution from RemoteHandle to server Handle

### Steps

- ☐ **4.1** Re-read [DESIGN.md](./DESIGN.md) Sections: "DataSource Implementation" and "Server-Side Handle Protocol"
- ☐ **4.2** Create test file for remote query execution
- ☐ **4.3** Write tests for Handle.receive() protocol:
  - Handle receives `{type: 'remote-call', callId, method: 'query', args}`
  - Handle executes query on its DataSource
  - Handle returns `{type: 'remote-response', callId, result}`
  - Handle catches errors and returns `{type: 'remote-response', callId, error}`
- ☐ **4.4** Write tests for RemoteHandle query flow:
  - RemoteHandle.query() generates call ID
  - Sends remote-call message through channel
  - Creates promise and stores in pending calls
  - Receives remote-response message
  - Resolves promise with result
- ☐ **4.5** Update `Handle.receive()` to handle remote-call messages
- ☐ **4.6** Implement RemoteHandle.query() using RemoteCallManager
- ☐ **4.7** Implement RemoteHandle._handleResponse() to resolve promises
- ☐ **4.8** Create integration test `RemoteQuery.integration.test.js`
- ☐ **4.9** Write integration test with real components (no mocks):
  - Server: Real DataStore with data
  - Server: Real DataStoreProxy wrapping DataStore
  - Send Handle through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Execute query on RemoteHandle
  - Verify query results match server data
- ☐ **4.10** Verify all Phase 4 tests pass

**Deliverable**: Working query execution through RemoteHandle

---

## Phase 5: PrototypeFactory Integration

**Objective**: Enable schema-based property access on RemoteHandle

### Steps

- ☐ **5.1** Re-read [DESIGN.md](./DESIGN.md) Section: "PrototypeFactory Integration"
- ☐ **5.2** Create test file for RemoteHandle with PrototypeFactory
- ☐ **5.3** Write tests for prototype manufacturing:
  - RemoteHandle calls `_enablePrototypeFactory(schema)`
  - PrototypeFactory manufactures properties from schema
  - Properties have getters that call `dataSource.query()`
  - Properties have setters that call `dataSource.update()`
- ☐ **5.4** Write tests for property access:
  - Access property on RemoteHandle
  - Verify query sent to server
  - Verify result returned correctly
- ☐ **5.5** Update RemoteHandle constructor to call `_enablePrototypeFactory()`
- ☐ **5.6** Create integration test `RemoteHandle.Properties.integration.test.js`
- ☐ **5.7** Write integration test with real components (no mocks):
  - Server: Real DataStore with entity data
  - Server: Real EntityProxy with schema
  - Send EntityProxy through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Access properties (e.g., `remoteEntity.name`)
  - Verify property values match server data
- ☐ **5.8** Verify all Phase 5 tests pass

**Deliverable**: Native property access on RemoteHandle through PrototypeFactory

---

## Phase 6: Handle Projection

**Objective**: Enable creating projected Handles from RemoteHandle

### Steps

- ☐ **6.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Handle Projection"
- ☐ **6.2** Create test file for RemoteHandle projections
- ☐ **6.3** Write tests for query combinator delegation:
  - RemoteHandle.where() returns new Handle
  - RemoteHandle.select() returns new Handle
  - RemoteHandle.orderBy() returns new Handle
  - Projected Handles use RemoteHandle as DataSource
- ☐ **6.4** Verify RemoteHandle inherits query combinators from Handle
- ☐ **6.5** Implement RemoteHandle.queryBuilder() to return DefaultQueryBuilder
- ☐ **6.6** Create integration test `RemoteHandle.Projection.integration.test.js`
- ☐ **6.7** Write integration test with real components (no mocks):
  - Server: Real DataStoreProxy with collection data
  - Send DataStoreProxy through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Create projection with `.where(predicate).orderBy('field')`
  - Client: Execute `.toArray()` on projection
  - Verify filtered and ordered results match server
- ☐ **6.8** Write test for entity projection:
  - Client: Call `remoteDataStore.entity(123)`
  - Verify EntityProxy created with RemoteHandle as DataSource
  - Access entity properties
  - Verify property access queries server correctly
- ☐ **6.9** Verify all Phase 6 tests pass

**Deliverable**: Full Handle projection support with RemoteHandle as DataSource

---

## Phase 7: Remote Subscriptions

**Objective**: Implement real-time subscription updates through Actor channels

### Steps

- ☐ **7.1** Re-read [DESIGN.md](./DESIGN.md) Sections: "DataSource Implementation - subscribe()" and "Subscription Pattern"
- ☐ **7.2** Create `RemoteSubscriptionManager.js` unit test file
- ☐ **7.3** Write tests for RemoteSubscriptionManager:
  - Generate unique subscription IDs
  - Store subscriptions with callbacks
  - Route incoming updates to correct callback
  - Handle unsubscribe requests
  - Clean up subscriptions
- ☐ **7.4** Implement `RemoteSubscriptionManager.js` to pass all tests
- ☐ **7.5** Create test file for RemoteHandle subscriptions
- ☐ **7.6** Write tests for RemoteHandle.subscribe():
  - Generates subscription ID
  - Stores callback in RemoteSubscriptionManager
  - Sends subscribe message to server
  - Returns unsubscribe handle
- ☐ **7.7** Write tests for subscription updates:
  - RemoteHandle receives subscription-update message
  - Routes to RemoteSubscriptionManager
  - Callback invoked with changes
- ☐ **7.8** Implement RemoteHandle.subscribe() using RemoteSubscriptionManager
- ☐ **7.9** Implement RemoteHandle._handleSubscriptionUpdate()
- ☐ **7.10** Update Handle.receive() to handle subscribe messages from RemoteHandle
- ☐ **7.11** Update Handle to send subscription-update messages to remote
- ☐ **7.12** Create integration test `RemoteSubscription.integration.test.js`
- ☐ **7.13** Write integration test with real components (no mocks):
  - Server: Real DataStore with mutable data
  - Server: Real Handle wrapping DataStore
  - Send Handle through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Subscribe to query
  - Server: Modify data to trigger subscription
  - Client: Verify callback invoked with changes
  - Client: Unsubscribe
  - Server: Modify data again
  - Client: Verify callback NOT invoked after unsubscribe
- ☐ **7.14** Verify all Phase 7 tests pass

**Deliverable**: Working real-time subscriptions through RemoteHandle

---

## Phase 8: Remote Updates

**Objective**: Implement data updates through RemoteHandle

### Steps

- ☐ **8.1** Re-read [DESIGN.md](./DESIGN.md) Sections: "DataSource Implementation - update()" and "Server-Side Handle Protocol"
- ☐ **8.2** Create test file for RemoteHandle updates
- ☐ **8.3** Write tests for RemoteHandle.update():
  - Accepts updateSpec
  - Sends remote-call message with method='update'
  - Returns promise that resolves with result
- ☐ **8.4** Write tests for Handle update protocol:
  - Handle receives update remote-call
  - Handle executes update on DataSource
  - Handle returns update result
- ☐ **8.5** Implement RemoteHandle.update() using RemoteCallManager
- ☐ **8.6** Verify Handle.receive() correctly routes update calls
- ☐ **8.7** Create integration test `RemoteUpdate.integration.test.js`
- ☐ **8.8** Write integration test with real components (no mocks):
  - Server: Real DataStore with entity data
  - Server: Real EntityProxy with update support
  - Send EntityProxy through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Call update method or set property
  - Verify data updated on server
  - Verify update result returned to client
- ☐ **8.9** Verify all Phase 8 tests pass

**Deliverable**: Working data updates through RemoteHandle

---

## Phase 9: Error Handling

**Objective**: Implement comprehensive error handling for remote operations

### Steps

- ☐ **9.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Error Handling"
- ☐ **9.2** Create test file for error handling
- ☐ **9.3** Write tests for server-side errors:
  - Server Handle throws error during query
  - Error serialized in remote-response
  - Client RemoteHandle rejects promise with error
- ☐ **9.4** Write tests for network errors:
  - Remote call times out (no response received)
  - Promise rejected with timeout error
- ☐ **9.5** Write tests for validation errors:
  - Invalid querySpec passed to RemoteHandle.query()
  - Error raised immediately, no remote call made
- ☐ **9.6** Implement error serialization in Handle.receive()
- ☐ **9.7** Implement timeout handling in RemoteCallManager
- ☐ **9.8** Implement validation in RemoteHandle methods
- ☐ **9.9** Create integration test `RemoteError.integration.test.js`
- ☐ **9.10** Write integration test with real components (no mocks):
  - Server: Real Handle that throws errors
  - Send Handle through real Actor channel
  - Client: Execute query that triggers error
  - Verify error propagated to client correctly
  - Verify error message preserved
- ☐ **9.11** Verify all Phase 9 tests pass

**Deliverable**: Robust error handling for all remote operations

---

## Phase 10: End-to-End Integration

**Objective**: Verify complete RemoteHandle functionality in realistic scenarios

### Steps

- ☐ **10.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Use Cases"
- ☐ **10.2** Create E2E test `RemoteHandle.E2E.test.js`
- ☐ **10.3** Write E2E test for DataStore scenario:
  - Server: Create real DataStore with users and projects
  - Server: Create DataStoreProxy
  - Send DataStoreProxy through Actor channel
  - Client: Query users with filters
  - Client: Access entity properties
  - Client: Create projections
  - Client: Subscribe to changes
  - Server: Modify data
  - Client: Verify subscription callbacks fired
  - Client: Update entity properties
  - Server: Verify updates applied
- ☐ **10.4** Write E2E test for complex projection scenario:
  - Server: DataStore with relational data
  - Client: Multi-level projections (dataStore → collection → entity)
  - Client: Query combinators (where, orderBy, limit)
  - Verify all operations work end-to-end
- ☐ **10.5** Write E2E test for PrototypeFactory scenario:
  - Server: Handle with rich schema
  - Client: Access all property types (string, number, array, relations)
  - Client: Update properties through setters
  - Verify schema-based validation
- ☐ **10.6** Verify all Phase 10 tests pass

**Deliverable**: Complete, verified RemoteHandle implementation

---

## Phase 11: ShowMe Integration

**Objective**: Replace ShowMe's asset handling with RemoteHandle pattern

### Steps

- ☐ **11.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Use Cases - ShowMe Module"
- ☐ **11.2** Create AssetDataSource for ShowMe
- ☐ **11.3** Create AssetHandle extending Handle with AssetDataSource
- ☐ **11.4** Update ShowMeServerActor.handleDisplayAsset():
  - Create AssetHandle wrapping asset data
  - Send AssetHandle through Actor channel
  - Remove AssetHandle class from showme/handles
- ☐ **11.5** Update ShowMeClientActor.handleDisplayAsset():
  - Receive RemoteHandle (automatic via ActorSerializer)
  - Access asset properties (metadata, data, type)
  - Display asset using RemoteHandle
- ☐ **11.6** Update existing ShowMe tests to use RemoteHandle pattern
- ☐ **11.7** Create integration test `ShowMe.RemoteHandle.integration.test.js`
- ☐ **11.8** Write integration test with real components:
  - Server: Create AssetHandle with image data
  - Send through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Access asset properties
  - Client: Display asset
  - Verify complete flow works
- ☐ **11.9** Verify all ShowMe tests pass with RemoteHandle

**Deliverable**: ShowMe module using RemoteHandle pattern

---

## Completion Criteria

All phases complete (✅) and all tests passing:
- ☐ All unit tests pass
- ☐ All integration tests pass (with real components, no mocks)
- ☐ All E2E tests pass
- ☐ ShowMe integration complete and working
- ☐ Zero test failures
- ☐ All error scenarios handled correctly
- ☐ RemoteHandle works with all Handle types

---

## Notes

- **Design Reference**: Always refer to [DESIGN.md](./DESIGN.md) for implementation details
- **No Shortcuts**: Implement completely at each phase, no partial implementations
- **Test Coverage**: Every feature must have both unit and integration tests
- **Real Components**: Integration tests use real ActorSpace, Channel, DataSource - NO MOCKS
- **Fail Fast**: No fallbacks, no mock implementations in production code
- **MVP Focus**: Functional correctness only, no performance optimization or security hardening at this stage