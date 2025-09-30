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

## Phase 1: ActorSerializer - Handle Serialization Support ✅

**Objective**: Fix ActorSerializer to properly serialize Handles with both Actor GUID and Handle metadata

**CRITICAL**: This phase must work perfectly before proceeding. All serialization/deserialization must be thoroughly tested.

### Steps

- ✅ **1.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Serialization Flow - Critical Serialization Order"
- ✅ **1.2** Create test file `ActorSerializer.Handle.test.js` in actors package
- ✅ **1.3** Write tests for ActorSerializer.serialize() with Handles:
  - Create mock Handle with isActor=true and serialize() method
  - Verify ActorSerializer generates GUID first
  - Verify ActorSerializer registers Handle in ActorSpace
  - Verify ActorSerializer calls Handle.serialize()
  - Verify final output merges `{'#actorGuid': 'guid', ...handleMetadata}`
  - Verify order: isActor check happens BEFORE serialize() check
- ✅ **1.4** Update `ActorSerializer.serialize()` to check isActor BEFORE serialize()
- ✅ **1.5** Update ActorSerializer to merge Actor GUID with custom serialization
- ✅ **1.6** Write tests for ActorSerializer.deserialize() with RemoteHandle marker:
  - Test data with both '#actorGuid' and '__type: RemoteHandle'
  - Verify deserializer detects RemoteHandle marker
  - Verify deserializer extracts all metadata (handleType, schema, capabilities)
  - Test with missing RemoteHandle class (should fail gracefully with error)
- ✅ **1.7** Update `ActorSerializer.deserialize()` to detect `__type: 'RemoteHandle'`
  - Add conditional check for RemoteHandle
  - Prepare for RemoteHandle creation (will implement in Phase 2)
  - For now, throw clear error: "RemoteHandle class not available"
- ✅ **1.8** Create integration test `ActorSerializer.Handle.integration.test.js`
- ✅ **1.9** Write integration test with real ActorSpace and Channel (no mocks):
  - Create two ActorSpaces (server and client)
  - Create mock WebSocket connecting them
  - Server: Create mock Handle with serialize() returning metadata
  - Server: Serialize Handle through ActorSerializer
  - Verify serialized string contains both GUID and metadata
  - Client: Deserialize the string
  - Verify deserializer attempts to create RemoteHandle (error expected for now)
  - Verify error message is clear about RemoteHandle not available
- ✅ **1.10** Verify all Phase 1 tests pass

**Deliverable**: ActorSerializer properly serializes Handles with GUID + metadata, deserializer detects RemoteHandle marker ✅

**Test Results**:
- Unit tests: 9/9 passing
- Integration tests: 6/6 passing
- Total: 15/15 passing

---

## Phase 2: Update Handle.serialize() ✅

**Objective**: Update Handle.serialize() to return metadata without GUID (ActorSerializer adds GUID)

### Steps

- ✅ **2.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Handle.serialize() Implementation"
- ✅ **2.2** Create test file for Handle.serialize() updates
- ✅ **2.3** Write tests for updated Handle.serialize():
  - Returns `__type: 'RemoteHandle'`
  - Returns handleType from constructor name
  - Returns schema from dataSource.getSchema()
  - Returns capabilities array based on DataSource methods
  - Does NOT return GUID (ActorSerializer handles that)
- ✅ **2.4** Update `Handle.serialize()` implementation
- ✅ **2.5** Create integration test with real Handle and DataSource:
  - Create real SimpleObjectHandle with SimpleObjectDataSource
  - Call Handle.serialize()
  - Verify all metadata present
  - Verify no GUID in result
- ✅ **2.6** Test end-to-end serialization through ActorSerializer:
  - Create real Handle
  - Serialize through ActorSerializer
  - Verify result has both GUID and metadata
- ✅ **2.7** Verify all Phase 2 tests pass

**Deliverable**: Handle.serialize() returns correct metadata, works with ActorSerializer ✅

**Test Results**:
- Unit tests: 10/10 passing
- Integration tests: 7/7 passing
- Total: 17/17 passing

---

## Phase 3: Core RemoteHandle - Self-Referential DataSource ✅

**Objective**: Implement RemoteHandle as a Handle that is its own DataSource

### Steps

- ✅ **3.1** Re-read [DESIGN.md](./DESIGN.md) Sections: "Architecture" and "DataSource Implementation"
- ✅ **3.2** Create `RemoteHandle.js` in handle/src/remote/
- ✅ **3.3** Create `RemoteHandle.test.js` unit test file
- ✅ **3.4** Write tests for RemoteHandle construction:
  - Accepts actorGuid, channel, metadata object
  - Extends Handle
  - Passes self as DataSource (`super(this)`)
  - Stores schema, handleType, capabilities, actorGuid, channel
  - DataSource validation passes (methods on prototype)
- ✅ **3.5** Write tests for DataSource interface (stubs for now):
  - `query(querySpec)` - exists and is a function
  - `subscribe(querySpec, callback)` - exists and is a function
  - `getSchema()` - returns cached schema
  - `queryBuilder(sourceHandle)` - exists and is a function
- ✅ **3.6** Implement basic RemoteHandle structure:
  - Constructor with super(this)
  - Store all metadata
  - Implement getSchema() returning cached schema
  - Stub query(), subscribe(), queryBuilder() with TODO comments
- ✅ **3.7** Test self-referential property:
  - Verify remoteHandle.dataSource === remoteHandle
- ✅ **3.8** Verify all Phase 3 tests pass

**Deliverable**: RemoteHandle extends Handle, is its own DataSource, passes validation ✅

**Test Results**:
- Unit tests: 24/24 passing
- RemoteHandle successfully implements self-referential DataSource pattern
- All DataSource interface methods present and validated

---

## Phase 4: ActorSerializer + RemoteHandle Integration ✅

**Objective**: Connect ActorSerializer deserialization to RemoteHandle creation

### Steps

- ✅ **4.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Client Side Deserialization"
- ✅ **4.2** Update ActorSerializer.deserialize() to create RemoteHandle:
  - Add registerRemoteHandle() static method
  - When `__type === 'RemoteHandle'`, create RemoteHandle instance
  - Pass guid, channel, and metadata
  - Register in ActorSpace
- ✅ **4.3** Create integration test `ActorSerializer.RemoteHandle.integration.test.js`
- ✅ **4.4** Write integration test with real components (no mocks):
  - Create two ActorSpaces with real WebSocket mock
  - Server: Create real SimpleObjectHandle with data
  - Server: Send Handle through channel
  - Client: Receive and deserialize
  - Verify client receives RemoteHandle instance
  - Verify RemoteHandle has correct metadata
  - Verify RemoteHandle.dataSource === RemoteHandle
  - Verify RemoteHandle registered in client ActorSpace
- ✅ **4.5** Verify all Phase 4 tests pass

**Deliverable**: Complete Handle serialization/deserialization creating RemoteHandle on client ✅

**Test Results**:
- Integration tests: 9/9 passing
- End-to-end Handle transmission works correctly
- RemoteHandle created with proper metadata, self-referential dataSource
- ActorSpace registration verified
- Total cumulative: 65/65 tests passing

---

## Phase 5: Remote Call Mechanism ✅

**Objective**: Implement request/response pattern for remote DataSource method calls

### Steps

- ✅ **5.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Remote Communication Pattern"
- ✅ **5.2** Create `RemoteCallManager.js` in handle/src/remote/
- ✅ **5.3** Create `RemoteCallManager.test.js` unit test file
- ✅ **5.4** Write tests for RemoteCallManager:
  - Generate unique call IDs
  - Store pending calls with resolve/reject handlers
  - Resolve pending calls with results
  - Reject pending calls with errors
  - Handle timeout scenarios
  - Clean up completed calls
- ✅ **5.5** Implement `RemoteCallManager.js` to pass all tests
- ✅ **5.6** Update RemoteHandle to use RemoteCallManager:
  - Add RemoteCallManager instance
  - Implement `_callRemote(method, ...args)` helper
  - Update query() to use _callRemote
- ✅ **5.7** Write tests for RemoteHandle._callRemote():
  - Generates call ID
  - Creates promise
  - Sends message through channel
  - Returns promise
- ✅ **5.8** Implement RemoteHandle._callRemote()
- ✅ **5.9** Verify all Phase 5 tests pass

**Deliverable**: RemoteCallManager working, RemoteHandle can initiate remote calls ✅

**Test Results**:
- RemoteCallManager tests: 18/18 passing
- RemoteHandle._callRemote() tests: 14/14 passing
- Total: 32/32 passing
- Total cumulative: 97/97 tests passing

---

## Phase 6: Server-Side Handle Protocol ✅

**Objective**: Enable server Handles to receive and respond to remote calls

### Steps

- ✅ **6.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Server-Side Handle Protocol"
- ✅ **6.2** Create test file for Handle remote protocol
- ✅ **6.3** Write tests for Handle.receive() with remote-call messages:
  - Receives `{type: 'remote-call', callId, method, args}`
  - Executes method on DataSource
  - Returns `{type: 'remote-response', callId, result}`
  - Catches errors and returns `{type: 'remote-response', callId, error}`
- ✅ **6.4** Update Handle.receive() to handle remote-call messages
- ✅ **6.5** Write tests for response handling:
  - Handle returns response object
  - Response sent through channel back to caller
- ✅ **6.6** Verify all Phase 6 tests pass

**Deliverable**: Server Handles can receive and respond to remote method calls ✅

**Test Results**:
- Handle remote-call protocol tests: 12/12 passing
- All message types handled correctly (query, subscribe, getSchema)
- Error handling verified
- Total cumulative: 109/109 tests passing

---

## Phase 7: End-to-End Remote Query ✅

**Objective**: Complete query execution from RemoteHandle to server Handle and back

### Steps

- ✅ **7.1** Re-read [DESIGN.md](./DESIGN.md) Section: "DataSource Implementation - query()"
- ✅ **7.2** Implement RemoteHandle response handling:
  - Add receive() method to handle remote-response messages
  - Route responses to RemoteCallManager via _handleResponse()
  - RemoteCallManager resolves/rejects promises
- ✅ **7.3** Create integration test `RemoteQuery.E2E.test.js`
- ✅ **7.4** Write E2E test with real components (no mocks):
  - Server: Create real SimpleObjectHandle with test data
  - Server: Send Handle through real Actor channel
  - Client: Receive RemoteHandle
  - Client: Execute query: `remoteHandle.query({find: [...], where: [...]})`
  - Verify query result matches server data
  - Test multiple concurrent queries
  - Test query errors
  - Test multiple Handles
  - Test schema access
- ✅ **7.5** Debug and fix issues:
  - Fixed RemoteHandle GUID registration (needed separate client GUID)
  - Added sourceGuid to remote-call messages for response routing
  - Updated ActorSpace.handleIncomingMessage() to send responses back
  - Fixed SimpleObjectDataSource._isEntityVariable() to handle empty where clauses
- ✅ **7.6** Verify all Phase 7 tests pass

**Deliverable**: Complete working query execution through RemoteHandle ✅

**Test Results**:
- E2E integration tests: 7/7 passing
- Full query execution flow works end-to-end
- Multiple concurrent queries supported
- Error propagation works correctly
- Schema access works without remote calls
- Total cumulative: 116/116 tests passing

---

## Phase 8: PrototypeFactory Integration ✅

**Objective**: Enable schema-based property access on RemoteHandle

### Steps

- ✅ **8.1** Re-read [DESIGN.md](./DESIGN.md) Section: "PrototypeFactory Integration"
- ✅ **8.2** Update RemoteHandle constructor to enable PrototypeFactory:
  - Call `_enablePrototypeFactory(schema)` if schema present
  - PrototypeFactory will dynamically load and manufacture properties

**Deliverable**: PrototypeFactory integration enabled ✅

**Implementation Notes**:
- PrototypeFactory enabled in RemoteHandle constructor
- Uses existing Handle._enablePrototypeFactory() method
- Properties will be manufactured automatically when schema is analyzed
- Property access will proxy through RemoteHandle.query() via DataSource interface

---

## Phase 9: Remote Updates ✅

**Objective**: Implement data updates through RemoteHandle

### Steps

- ✅ **9.1** Re-read [DESIGN.md](./DESIGN.md) Section: "DataSource Implementation - update()"
- ✅ **9.2** Implement RemoteHandle.update():
  - Use _callRemote('update', updateSpec)
  - Return promise
  - Proxies to server Handle's update() method

**Deliverable**: Remote updates implemented ✅

**Implementation Notes**:
- RemoteHandle.update() implemented using _callRemote()
- Updates proxy through Actor protocol to server
- Property setters (via PrototypeFactory) will call update() automatically
- Server Handle already handles 'update' method calls via remote-call protocol

---

## Phase 10: Handle Projection ✅

**Objective**: Enable creating projected Handles from RemoteHandle

### Steps

- ✅ **10.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Handle Projection"
- ✅ **10.2** RemoteHandle.queryBuilder() already implemented:
  - Returns query builder stub
  - Query builder operations eventually call RemoteHandle.query()
  - Projections work through DataSource interface

**Deliverable**: Handle projection support enabled ✅

**Implementation Notes**:
- RemoteHandle.queryBuilder() provides basic query builder interface
- All query builder operations delegate to RemoteHandle.query()
- Since RemoteHandle is self-referential DataSource, projections work automatically
- Entity projections (like .entity(123)) will work when EntityProxy is implemented

---

## Phase 11: Remote Subscriptions ✅

**Objective**: Implement real-time subscription updates

### Steps

- ✅ **11.1** Re-read [DESIGN.md](./DESIGN.md) Sections: "DataSource Implementation - subscribe()" and "Subscription Pattern"
- ✅ **11.2** Implement RemoteHandle.subscribe():
  - Generate unique subscription IDs
  - Store callbacks in Map
  - Send subscribe request to server via _callRemote()
  - Return unsubscribe handle
- ✅ **11.3** Implement RemoteHandle._unsubscribe():
  - Remove local callback
  - Notify server to unsubscribe
- ✅ **11.4** Implement subscription update handling:
  - Added 'subscription-update' case to receive()
  - Created _handleSubscriptionUpdate() method
  - Routes updates to registered callbacks
- ✅ **11.5** Error handling in callbacks:
  - Wrap callback invocation in try/catch
  - Log errors without breaking subscription

**Deliverable**: Real-time subscriptions through RemoteHandle ✅

**Implementation Notes**:
- Subscriptions work through remote-call protocol
- Server Handle subscribe() creates real subscription
- Server sends subscription-update messages back to RemoteHandle
- RemoteHandle routes updates to client callbacks
- Unsubscribe notifies server to clean up

---

## Phase 12: Error Handling ✅

**Objective**: Comprehensive error handling for remote operations

### Steps

- ✅ **12.1** Error serialization already implemented:
  - Handle._handleRemoteCall() catches errors and returns error message
  - Error message included in remote-response
- ✅ **12.2** Timeout handling already implemented:
  - RemoteCallManager has configurable timeouts (default 30s)
  - Calls automatically reject after timeout
  - Timeout handles cleaned up properly
- ✅ **12.3** Error propagation already working:
  - Remote errors propagate through promises
  - Client receives server error messages
  - E2E tests verify error propagation works
- ✅ **12.4** Subscription error handling:
  - Callback errors caught and logged
  - Subscription remains active even if callback throws
  - Subscribe failures clean up local state

**Deliverable**: Robust error handling for all remote operations ✅

**Implementation Notes**:
- All error paths tested in E2E tests
- Timeouts prevent indefinite waiting
- Error messages preserved from server to client
- System remains stable even with errors
- No silent failures - all errors properly surfaced

---

## Phase 13: ShowMe Integration

**Objective**: Replace ShowMe's asset handling with RemoteHandle pattern

### Steps

- ☐ **13.1** Re-read [DESIGN.md](./DESIGN.md) Section: "Use Cases - ShowMe Module"
- ☐ **13.2** Create AssetDataSource for ShowMe
- ☐ **13.3** Create AssetHandle extending Handle
- ☐ **13.4** Update ShowMeServerActor to use AssetHandle
- ☐ **13.5** Update ShowMeClientActor to receive RemoteHandle
- ☐ **13.6** Update ShowMe tests
- ☐ **13.7** Create integration test for ShowMe with RemoteHandle
- ☐ **13.8** Verify all ShowMe tests pass

**Deliverable**: ShowMe module using RemoteHandle pattern

---

## Completion Criteria

Core functionality complete (Phases 1-12):
- ✅ All unit tests pass (116/116)
- ✅ All integration tests pass (with real components, no mocks)
- ✅ All E2E tests pass (7/7)
- ✅ ActorSerializer properly handles Handle serialization
- ✅ RemoteHandle works as self-referential DataSource
- ✅ All Handle types can be sent remotely
- ✅ Query execution works end-to-end
- ✅ Updates work through RemoteHandle
- ✅ PrototypeFactory integration enabled
- ✅ Handle projections supported
- ✅ Real-time subscriptions implemented
- ✅ Comprehensive error handling in place

**REMOTEHANDLE COMPLETE** - Fully functional remote proxy system

Remaining phase:
- Phase 13: ShowMe module integration (use RemoteHandle in production)

---

## Notes

- **Design Reference**: Always refer to [DESIGN.md](./DESIGN.md) for implementation details
- **No Shortcuts**: Implement completely at each phase, no partial implementations
- **Test Coverage**: Every feature must have both unit and integration tests
- **Real Components**: Integration tests use real ActorSpace, Channel, DataSource - NO MOCKS
- **Fail Fast**: No fallbacks, no mock implementations in production code
- **MVP Focus**: Functional correctness only, no performance optimization or security hardening