# Incremental LFTJ Engine

A high-performance incremental query engine implementing the Leapfrog Triejoin (LFTJ) algorithm with worst-case optimal join guarantees and efficient delta propagation.

## Overview

This package provides a complete implementation of an incremental N-ary relational kernel based on the LFTJ algorithm. It efficiently processes complex multi-way joins with incremental updates, making it ideal for:

- **Graph databases** - Efficient pattern matching and traversal
- **Streaming analytics** - Real-time query processing with incremental updates
- **Knowledge graphs** - Complex relationship queries
- **Social networks** - Friend-of-friend queries, recommendation systems
- **Rules engines** - Forward-chaining inference with incremental facts

## Features

- ✅ **Worst-case optimal joins** - LFTJ algorithm guarantees optimal performance
- ✅ **Incremental processing** - Efficient delta propagation through operator DAGs
- ✅ **Batch optimization** - Automatic delta cancellation and coalescing
- ✅ **Transaction support** - Atomic batch processing with rollback
- ✅ **Subscription model** - Real-time notifications on query result changes
- ✅ **Compute providers** - Extensible architecture for external data sources
- ✅ **Type-safe schemas** - Runtime validation with rich atom types
- ✅ **Fluent query API** - Intuitive query construction

## Installation

```bash
npm install @legion/incremental-lftj
```

## Quick Start

```javascript
import { IncrementalLFTJ } from '@legion/incremental-lftj';

// Create engine instance
const engine = new IncrementalLFTJ({
  batchSize: 1000,
  autoFlush: true
});

// Define relations
engine.defineRelation('users', {
  userId: 'ID',
  name: 'String',
  age: 'Integer'
});

engine.defineRelation('follows', {
  follower: 'ID',
  followee: 'ID'
});

// Build and register a query
const query = engine.query('followers-over-25')
  .from('follows')
  .joinRelation('users', [{ left: 0, right: 0 }]) // Join on follower
  .filter(tuple => tuple.get(2) > 25) // Age > 25
  .select([0, 1, 2]) // follower, followee, age
  .build();

const handle = engine.register(query);

// Subscribe to results
handle.subscribe((notification) => {
  console.log('Query results updated:', notification.results);
}, { includeDeltas: true });

// Insert data
engine.insert('users', [
  ['u1', 'Alice', 30],
  ['u2', 'Bob', 20],
  ['u3', 'Carol', 28]
]);

engine.insert('follows', [
  ['u1', 'u2'], // Alice (30) follows Bob
  ['u3', 'u1']  // Carol (28) follows Alice
]);

// Results automatically propagate to subscribers
```

## Core Concepts

### Relations and Schemas

Relations are typed collections of tuples. Each relation has a schema defining its structure:

```javascript
engine.defineRelation('products', {
  productId: 'ID',
  name: 'String', 
  price: 'Integer',
  inStock: 'Boolean'
});
```

Supported atom types:
- `ID` - Unique identifiers
- `String` - Text values
- `Integer` - Whole numbers
- `Float` - Decimal numbers
- `Boolean` - True/false values
- `Symbol` - Symbolic constants

### Queries

Queries are built using a fluent API and compiled into operator DAGs:

```javascript
const query = engine.query('my-query')
  .from('relation1')
  .joinRelation('relation2', [{ left: 0, right: 1 }])
  .where(tuple => tuple.get(2) > 100)
  .select([0, 2, 3])
  .distinct()
  .build();
```

### Incremental Updates

The engine efficiently processes incremental updates through delta propagation:

```javascript
// Insert tuples
engine.insert('users', ['u4', 'David', 35]);

// Delete tuples  
engine.delete('users', ['u1', 'Alice', 30]);

// Update tuples (delete + insert)
engine.update('users',
  ['u2', 'Bob', 20],      // old
  ['u2', 'Robert', 21]     // new
);
```

### Transactions

Group multiple updates into atomic transactions:

```javascript
await engine.transaction(async () => {
  engine.insert('accounts', ['acc1', 1000]);
  engine.insert('accounts', ['acc2', 500]);
  
  engine.insert('transfers', ['t1', 'acc1', 'acc2', 200]);
  
  engine.update('accounts', ['acc1', 1000], ['acc1', 800]);
  engine.update('accounts', ['acc2', 500], ['acc2', 700]);
});
```

### Compute Providers

Integrate external data sources and computed values:

```javascript
class PriceCalculator extends EnumerableProvider {
  enumerate() {
    // Return computed tuples
    return new Set([
      new Tuple([new ID('item1'), new Integer(100)])
    ]);
  }
}

engine.registerProvider('prices', new PriceCalculator());

const query = engine.query()
  .compute(engine._providers.get('prices'))
  .build();
```

## API Reference

### `IncrementalLFTJ`

Main engine class.

#### Constructor Options

```javascript
new IncrementalLFTJ({
  batchSize: 1000,           // Batch size for delta accumulation
  autoFlush: true,           // Auto-flush when batch size reached
  flushInterval: 100,        // Auto-flush interval in ms
  batchMode: true,           // Enable batching mode
  enableStatistics: true,    // Track detailed statistics
  validateSchemas: true,     // Runtime schema validation
  autoRegisterRelations: true // Auto-register undefined relations
})
```

#### Methods

- `defineRelation(name, schema)` - Define a relation with schema
- `registerProvider(name, provider)` - Register compute provider
- `query(id?)` - Start building a new query
- `register(query, options?)` - Register and activate a query
- `insert(relation, tuples)` - Insert tuples into relation
- `delete(relation, tuples)` - Delete tuples from relation
- `update(relation, oldTuples, newTuples)` - Update tuples
- `flush()` - Manually flush pending batches
- `transaction(fn)` - Execute function in transaction
- `onUpdate(callback)` - Subscribe to global updates
- `getStatistics()` - Get engine statistics
- `reset()` - Reset engine state

### `QueryBuilder`

Fluent API for building queries.

#### Methods

- `from(relation, schema?)` - Set source relation
- `joinRelation(relation, joinKeys)` - Add equi-join
- `union(otherQuery)` - Union with another query
- `diff(otherQuery)` - Set difference
- `select(indices)` - Project columns
- `rename(mapping)` - Rename columns
- `where(predicate)` - Filter tuples
- `distinct()` - Remove duplicates
- `compute(provider)` - Add compute node
- `build()` - Compile to query graph

### `QueryHandle`

Handle for registered queries.

#### Properties

- `id` - Query identifier
- `isActive` - Query active status

#### Methods

- `subscribe(callback, options?)` - Subscribe to results
- `getResults()` - Get current results
- `getStatistics()` - Get query statistics
- `reset()` - Reset query state
- `deactivate()` - Deactivate query

## Performance

The LFTJ algorithm provides worst-case optimal join guarantees:

- **Time Complexity**: O(N^(ρ*)) where ρ* is the fractional edge cover
- **Space Complexity**: O(N) for intermediate results
- **Incremental Updates**: O(δ * N^(ρ*-1)) for delta size δ

Key optimizations:
- Trie-based indexing for fast prefix lookups
- Delta cancellation to eliminate redundant work
- Batch accumulation to amortize overhead
- Lazy evaluation with iterator-based processing

## Testing

Comprehensive test coverage with 580+ tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="IncrementalLFTJ"

# Run with coverage
npm test -- --coverage
```

## Implementation Status

✅ **All 14 phases complete**:

1. Core Value Model - Atoms, tuples, ordering
2. Relations and Deltas - Schemas, normalization
3. Basic Operators - Scan, Project, Union, Rename
4. Trie Indexing - Multi-level tries with iterators
5. Iterator Implementation - LFTJ iterator protocol
6. Join Operator - Core LFTJ algorithm
7. Delta Probes - LFTJ+ incremental optimization
8. Diff Operator - Set difference with support counts
9. Computed Predicates - External compute providers
10. Graph Engine - DAG construction and validation
11. Batch Propagation - Topological delta propagation
12. Engine API - High-level user interface
13. Integration Testing - End-to-end scenarios
14. Final Validation - Complete system verification

## Examples

See the `examples/` directory for complete examples:

- Social network queries
- E-commerce order processing
- Graph pattern matching
- Real-time analytics

## References

- [Leapfrog Triejoin: A Simple, Worst-Case Optimal Join Algorithm](https://arxiv.org/abs/1210.0481)
- [LFTJ+: Incremental Leapfrog Triejoin](https://arxiv.org/abs/1303.5313)
- [Worst-Case Optimal Join Algorithms](https://arxiv.org/abs/1203.1952)

## License

MIT