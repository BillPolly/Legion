# @legion/data-store

A high-performance data storage engine that integrates the Incremental N-ary Relational Kernel with the Attribute Store model for binary relationships, path queries, and live change notifications.

## Overview

This package implements a complete attribute store system that:

- **Stores binary relationships** with set semantics
- **Compiles path+predicate queries** into LFTJ kernel operations  
- **Provides live query subscriptions** with incremental updates
- **Supports computed predicates** (enumerable and pointwise)
- **Maintains forward/backward indexes** for efficient traversal

## Architecture

```
Client ⟷ Query API ─┬─► Query Compiler (Path+Pred → GraphSpec)
                   │
                   ├─► Subscription Manager (outputs ↔ clients)
                   │
Writes ─► Store I/O ─► Dispatcher (batch Δ builder) ─► Kernel.pushBatch(Δ)
                   │                                     │
                   └─► Predicate Providers (Enumerable / Pointwise) ─────┘
```

## Status

🚧 **Under Development** - TDD implementation in progress following design.md

### Implementation Progress

- [x] Package scaffolded with proper structure
- [x] Design document complete (16 sections)
- [x] Implementation plan created (12 phases, 500+ tests target)
- [x] Dependencies configured (@legion/incremental-lftj integration)
- [ ] **Phase 1**: Core Store Model (binary relationships, attributes)
- [ ] **Phase 2**: Out/In Tries Infrastructure (indexing)
- [ ] **Phase 3**: Dispatcher Implementation (write → kernel batches)
- [ ] **Phase 4**: Query Compiler (path+predicate → GraphSpec)
- [ ] **Phase 5**: Predicate Providers (computed relations)
- [ ] **Phase 6**: Subscription Manager (live queries)
- [ ] **Phase 7**: Query API (client interface)
- [ ] **Phase 8**: Store I/O Integration (complete pipeline)
- [ ] **Phase 9**: Complex Query Patterns
- [ ] **Phase 10**: End-to-End Scenarios
- [ ] **Phase 11**: Performance Optimization
- [ ] **Phase 12**: Final Validation

## Quick Example (Target API)

```javascript
import { DataStore } from '@legion/data-store';

// Create store instance
const store = new DataStore();

// Define relationship types
store.defineRelationType('worksAt', 'workedBy');
store.defineRelationType('locatedIn', 'locationOf');

// Add edges (binary relationships)
store.addEdge('worksAt', 'alice', 'acme');
store.addEdge('locatedIn', 'acme', 'uk');

// Submit path queries with live subscriptions
const subscription = store.query()
  .from('alice')
  .follow('worksAt')      // alice → company
  .follow('locatedIn')    // company → country  
  .where(country => country === 'uk')
  .subscribe((results) => {
    console.log('Query results:', results);
  });

// Updates automatically propagate to subscribers
store.addEdge('locatedIn', 'acme', 'us');
store.removeEdge('locatedIn', 'acme', 'uk');
```

## Core Concepts

### Binary Relationships
- Store primitive: `(type, src, dst)` with set semantics
- Forward/backward attribute views: `worksAt` / `workedBy`
- Automatic index maintenance for efficient traversal

### Path Queries
- Navigate through relationships: `/worksAt/locatedIn`
- Support inverse steps: `/worksAt/^reportedBy`
- Compile to optimal LFTJ kernel operations

### Live Subscriptions
- Real-time query result updates
- Incremental delta propagation
- Set-based result semantics

### Computed Predicates
- **Enumerable**: Finite relations (type membership, tags)
- **Pointwise**: External filters (ML classifiers, approvals)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Design

- **TDD Approach**: Tests first, implementation follows
- **No Mocks**: Integration tests use real components
- **Fail Fast**: Immediate error reporting
- **Kernel Integration**: Built on @legion/incremental-lftj

## Documentation

- [`docs/design.md`](docs/design.md) - Complete system design
- [`docs/implementation-plan.md`](docs/implementation-plan.md) - TDD phases
- [`docs/README.md`](docs/README.md) - Documentation index

## Dependencies

- `@legion/incremental-lftj` - LFTJ kernel for query processing
- `@legion/tools` - ResourceManager and utilities

Ready to begin Phase 1 implementation following the TDD plan.