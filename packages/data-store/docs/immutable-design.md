# Immutable Data Store with Constraint Validation — Complete Design

> **Goal:** Transform the existing mutable data store into an immutable system with atomic state transitions, comprehensive constraint validation, and debugging capabilities. This design preserves the LFTJ-optimized data structures while adding immutability for safe constraint checking.

---

## 0) Executive Summary

### Current Problem
The existing data store directly mutates internal state (Maps, Sets, TrieNodes), making constraint validation impossible without side effects. There's no way to test changes before applying them, and no rollback mechanism exists.

### Solution Architecture
Transform to an **immutable data store** with:
- **Single immutable root** representing complete store state
- **Atomic state transitions** - operations either succeed completely or fail with no side effects
- **Copy-on-write optimizations** to minimize memory overhead
- **Constraint validation** on candidate states before committing
- **Time-travel debugging** with complete state history

### Key Benefits
- ✅ **Safe constraint validation** - test changes without side effects
- ✅ **Atomic operations** - no partial failures or inconsistent states
- ✅ **Amazing debugging** - full state history and diff capabilities
- ✅ **Minimal changes** - leverages existing LFTJ data structures
- ✅ **High performance** - copy-on-write with structural sharing

---

## 1) Architecture Overview

```
Immutable DataStore Architecture

┌─────────────────────────────────────────────────────────────────┐
│                         Client API                             │
├─────────────────────────────────────────────────────────────────┤
│                  Constraint Validation Layer                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Entity Schema  │  │   Cardinality   │  │ Custom Rules    │ │
│  │   Validator     │  │   Validator     │  │   Engine        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Immutable State Manager                     │
│              ┌─────────────────────────────────┐               │
│              │         Current Root            │               │
│              │   (ImmutableStoreRoot)          │               │
│              └─────────────────────────────────┘               │
│                              │                                 │
│    Operation    │    Create Candidate    │    Validate    │    │
│       ↓         │           ↓            │        ↓       │    │
│  ┌──────────┐  │  ┌─────────────────┐   │  ┌──────────┐  │    │
│  │ addEdge  │──┼─→│ Candidate Root  │───┼─→│Validation│  │    │
│  │removeEdge│  │  │   (new state)   │   │  │ Results  │  │    │
│  │   ...    │  │  └─────────────────┘   │  └──────────┘  │    │
│  └──────────┘  │                        │                │    │
│                │        ↓ (if valid)    │                │    │
│                │  ┌─────────────────┐   │                │    │
│                │  │   Atomic Root   │   │                │    │
│                │  │   Transition    │   │                │    │
│                │  └─────────────────┘   │                │    │
├─────────────────────────────────────────────────────────────────┤
│                    Immutable Data Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ImmutableStore  │  │ImmutableTrieMgr │  │ImmutableTrieNode│ │
│  │  (edges, indexes)│  │ (OutTrie/InTrie)│  │(children/witness)│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    LFTJ Query Engine                           │
│              (unchanged - works with immutable data)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2) Current State Analysis

### 2.1 Mutation Points in Existing Code

**Store.js (4 mutation points per addEdge):**
```javascript
// Line 103: Global edge map mutation
this._edges.set(edgeKey, edge);

// Line 109: Type index mutation
this._edgesByType.get(edge.type).add(edge);

// Line 115: Source index mutation  
this._edgesBySource.get(edge.src).add(edge);

// Line 121: Destination index mutation
this._edgesByDestination.get(edge.dst).add(edge);
```

**TrieNode.js (3 mutation points):**
```javascript
// Line 88: Children map mutation
this._children.set(value, child);

// Line 131: Witness set mutation
this._witnesses.add(witness);

// Line 48: Leaf marking mutation
this._isLeaf = true;
```

**TrieManager.js (2 coordination points):**
```javascript
// Line 109-110: Synchronized mutations
outTrie.insert(edge);
inTrie.insert(edge);
```

### 2.2 Challenges with Current Architecture

1. **No atomicity** - mutations can partially fail leaving inconsistent state
2. **No rollback** - impossible to undo operations
3. **No safe testing** - can't validate without applying changes
4. **Complex cleanup** - error recovery requires manual state restoration
5. **Race conditions** - concurrent operations can interfere

---

## 3) Immutable Data Structures

### 3.1 ImmutableStoreRoot

The root immutable state containing all store data:

```javascript
/**
 * Immutable root of all store state
 * Single source of truth with atomic transitions
 */
export class ImmutableStoreRoot {
  constructor(
    edges = new Map(),           // edgeKey -> Edge
    edgesByType = new Map(),     // type -> Set<Edge>  
    edgesBySource = new Map(),   // src -> Set<Edge>
    edgesByDestination = new Map(), // dst -> Set<Edge>
    relationshipTypes = new Map(), // type -> RelationshipType
    trieManager = null,          // ImmutableTrieManager
    metadata = {}                // Version info, stats, etc.
  ) {
    this._edges = edges;
    this._edgesByType = edgesByType;
    this._edgesBySource = edgesBySource;
    this._edgesByDestination = edgesByDestination;
    this._relationshipTypes = relationshipTypes;
    this._trieManager = trieManager;
    this._metadata = {
      version: Date.now(),
      edgeCount: edges.size,
      ...metadata
    };
    
    // Make completely immutable
    Object.freeze(this);
  }

  /**
   * Create new root with added edge (pure function)
   * Returns new ImmutableStoreRoot, never mutates this
   */
  withAddedEdge(edge) {
    const edgeKey = this._getEdgeKey(edge);
    
    // Early return if no change needed
    if (this._edges.has(edgeKey)) {
      return this; // Immutable - can return same instance
    }
    
    // Copy-on-write: only copy what changes
    const newEdges = new Map(this._edges);
    newEdges.set(edgeKey, edge);
    
    // Update type index with copy-on-write
    const newEdgesByType = new Map(this._edgesByType);
    if (!newEdgesByType.has(edge.type)) {
      newEdgesByType.set(edge.type, new Set());
    } else {
      // Copy existing set before modifying
      newEdgesByType.set(edge.type, new Set(newEdgesByType.get(edge.type)));
    }
    newEdgesByType.get(edge.type).add(edge);
    
    // Update source index
    const newEdgesBySource = new Map(this._edgesBySource);
    if (!newEdgesBySource.has(edge.src)) {
      newEdgesBySource.set(edge.src, new Set());
    } else {
      newEdgesBySource.set(edge.src, new Set(newEdgesBySource.get(edge.src)));
    }
    newEdgesBySource.get(edge.src).add(edge);
    
    // Update destination index  
    const newEdgesByDestination = new Map(this._edgesByDestination);
    if (!newEdgesByDestination.has(edge.dst)) {
      newEdgesByDestination.set(edge.dst, new Set());
    } else {
      newEdgesByDestination.set(edge.dst, new Set(newEdgesByDestination.get(edge.dst)));
    }
    newEdgesByDestination.get(edge.dst).add(edge);
    
    // Update trie manager (returns new immutable instance)
    const newTrieManager = this._trieManager 
      ? this._trieManager.withAddedEdge(edge)
      : null;
    
    // Create new root with updated state
    return new ImmutableStoreRoot(
      newEdges,
      newEdgesByType,
      newEdgesBySource,
      newEdgesByDestination,
      this._relationshipTypes, // Unchanged, can reuse
      newTrieManager,
      { operation: 'addEdge', edge: edge.toString() }
    );
  }

  /**
   * Create new root with removed edge (pure function)
   */
  withRemovedEdge(edge) {
    const edgeKey = this._getEdgeKey(edge);
    
    // Early return if edge doesn't exist
    if (!this._edges.has(edgeKey)) {
      return this; // No change needed
    }
    
    // Copy-on-write for all affected structures
    const newEdges = new Map(this._edges);
    newEdges.delete(edgeKey);
    
    // Remove from type index
    const newEdgesByType = new Map(this._edgesByType);
    const typeSet = newEdgesByType.get(edge.type);
    if (typeSet) {
      const newTypeSet = new Set(typeSet);
      newTypeSet.delete(edge);
      if (newTypeSet.size === 0) {
        newEdgesByType.delete(edge.type);
      } else {
        newEdgesByType.set(edge.type, newTypeSet);
      }
    }
    
    // Similar for source and destination indexes...
    // (Implementation follows same copy-on-write pattern)
    
    const newTrieManager = this._trieManager
      ? this._trieManager.withRemovedEdge(edge)
      : null;
    
    return new ImmutableStoreRoot(
      newEdges,
      newEdgesByType,
      newEdgesBySource,
      newEdgesByDestination,
      this._relationshipTypes,
      newTrieManager,
      { operation: 'removeEdge', edge: edge.toString() }
    );
  }

  /**
   * Create new root with added relationship type
   */
  withAddedRelationType(relationshipType) {
    const newTypes = new Map(this._relationshipTypes);
    newTypes.set(relationshipType.forwardName, relationshipType);
    
    const newTrieManager = this._trieManager
      ? this._trieManager.withAddedRelationType(relationshipType)
      : new ImmutableTrieManager().withAddedRelationType(relationshipType);
    
    return new ImmutableStoreRoot(
      this._edges,
      this._edgesByType,
      this._edgesBySource,
      this._edgesByDestination,
      newTypes,
      newTrieManager,
      { operation: 'addRelationType', type: relationshipType.forwardName }
    );
  }

  // Read-only accessors (no mutations)
  getEdges() { return this._edges; }
  getEdgesByType(type) { return this._edgesByType.get(type) || new Set(); }
  getEdgesBySource(src) { return this._edgesBySource.get(src) || new Set(); }
  getEdgesByDestination(dst) { return this._edgesByDestination.get(dst) || new Set(); }
  getRelationshipTypes() { return this._relationshipTypes; }
  getTrieManager() { return this._trieManager; }
  getMetadata() { return this._metadata; }
  
  // Helper methods
  hasEdge(edge) { 
    return this._edges.has(this._getEdgeKey(edge)); 
  }
  
  hasRelationType(typeName) {
    return this._relationshipTypes.has(typeName);
  }
  
  getEdgeCount() {
    return this._edges.size;
  }
  
  _getEdgeKey(edge) {
    return `${edge.type}:${JSON.stringify(edge.src)}:${JSON.stringify(edge.dst)}`;
  }
}
```

### 3.2 ImmutableTrieNode

Copy-on-write trie nodes:

```javascript
/**
 * Immutable trie node with copy-on-write semantics
 */
export class ImmutableTrieNode {
  constructor(
    value = null,
    children = new Map(),
    witnesses = new Set(),
    isLeaf = false,
    depth = 0
  ) {
    this._value = value;
    this._children = children;
    this._witnesses = witnesses;
    this._isLeaf = isLeaf;
    this._depth = depth;
    Object.freeze(this);
  }

  /**
   * Create new node with added child (pure function)
   */
  withAddedChild(value) {
    // Early return if child already exists
    if (this._children.has(value)) {
      return this; // No change needed
    }
    
    // Copy children map and add new child
    const newChildren = new Map(this._children);
    const newChild = new ImmutableTrieNode(
      value, 
      new Map(), 
      new Set(), 
      false, 
      this._depth + 1
    );
    newChildren.set(value, newChild);
    
    return new ImmutableTrieNode(
      this._value,
      newChildren,
      this._witnesses, // Unchanged, can reuse
      this._isLeaf,
      this._depth
    );
  }

  /**
   * Create new node with updated child (pure function)
   */
  withUpdatedChild(value, newChildNode) {
    if (!this._children.has(value)) {
      throw new Error(`Child ${value} does not exist`);
    }
    
    // Copy children and update specific child
    const newChildren = new Map(this._children);
    newChildren.set(value, newChildNode);
    
    return new ImmutableTrieNode(
      this._value,
      newChildren,
      this._witnesses,
      this._isLeaf,
      this._depth
    );
  }

  /**
   * Create new node with added witness (pure function)
   */
  withAddedWitness(witness) {
    // Check if witness already exists
    if (this._witnesses.has(witness)) {
      return this; // No change needed
    }
    
    // Copy witnesses set and add new witness
    const newWitnesses = new Set(this._witnesses);
    newWitnesses.add(witness);
    
    return new ImmutableTrieNode(
      this._value,
      this._children, // Unchanged, can reuse
      newWitnesses,
      this._isLeaf,
      this._depth
    );
  }

  /**
   * Create new node with removed witness (pure function)
   */
  withRemovedWitness(witness) {
    if (!this._witnesses.has(witness)) {
      return this; // No change needed
    }
    
    const newWitnesses = new Set(this._witnesses);
    newWitnesses.delete(witness);
    
    return new ImmutableTrieNode(
      this._value,
      this._children,
      newWitnesses,
      this._isLeaf,
      this._depth
    );
  }

  /**
   * Create new node marked as leaf (pure function)
   */
  withLeafMarking() {
    if (this._isLeaf) {
      return this; // Already a leaf
    }
    
    return new ImmutableTrieNode(
      this._value,
      this._children,
      this._witnesses,
      true, // Mark as leaf
      this._depth
    );
  }

  // Read-only accessors
  get value() { return this._value; }
  get children() { return this._children; }
  get witnesses() { return this._witnesses; }
  get isLeaf() { return this._isLeaf; }
  get depth() { return this._depth; }
  
  hasChild(value) { return this._children.has(value); }
  getChild(value) { return this._children.get(value); }
  getChildCount() { return this._children.size; }
  hasWitness(witness) { return this._witnesses.has(witness); }
  getWitnessCount() { return this._witnesses.size; }
}
```

### 3.3 ImmutableTrieManager

Coordinates immutable trie operations:

```javascript
/**
 * Immutable trie manager with copy-on-write coordination
 */
export class ImmutableTrieManager {
  constructor(
    outTries = new Map(),  // relationName -> ImmutableOutTrie
    inTries = new Map(),   // relationName -> ImmutableInTrie
    relationNames = new Set()
  ) {
    this._outTries = outTries;
    this._inTries = inTries;
    this._relationNames = relationNames;
    Object.freeze(this);
  }

  /**
   * Create new trie manager with added relation type (pure function)
   */
  withAddedRelationType(relationshipType) {
    const relationName = relationshipType.forwardName;
    
    if (this._relationNames.has(relationName)) {
      return this; // Already exists
    }
    
    // Create new immutable tries
    const newOutTrie = new ImmutableOutTrie(relationName);
    const newInTrie = new ImmutableInTrie(relationshipType.backwardName);
    
    // Copy maps and add new tries
    const newOutTries = new Map(this._outTries);
    const newInTries = new Map(this._inTries);
    const newRelationNames = new Set(this._relationNames);
    
    newOutTries.set(relationName, newOutTrie);
    newInTries.set(relationName, newInTrie);
    newRelationNames.add(relationName);
    
    return new ImmutableTrieManager(
      newOutTries,
      newInTries,
      newRelationNames
    );
  }

  /**
   * Create new trie manager with added edge (pure function)
   */
  withAddedEdge(edge) {
    const relationName = edge.type;
    
    if (!this._relationNames.has(relationName)) {
      throw new Error(`Relation type '${relationName}' not registered`);
    }
    
    // Get current tries
    const currentOutTrie = this._outTries.get(relationName);
    const currentInTrie = this._inTries.get(relationName);
    
    // Create new tries with added edge
    const newOutTrie = currentOutTrie.withAddedEdge(edge);
    const newInTrie = currentInTrie.withAddedEdge(edge);
    
    // Copy maps and update affected tries
    const newOutTries = new Map(this._outTries);
    const newInTries = new Map(this._inTries);
    
    newOutTries.set(relationName, newOutTrie);
    newInTries.set(relationName, newInTrie);
    
    return new ImmutableTrieManager(
      newOutTries,
      newInTries,
      this._relationNames // Unchanged
    );
  }

  /**
   * Create new trie manager with removed edge (pure function)
   */
  withRemovedEdge(edge) {
    const relationName = edge.type;
    
    if (!this._relationNames.has(relationName)) {
      return this; // Relation doesn't exist, no change
    }
    
    const currentOutTrie = this._outTries.get(relationName);
    const currentInTrie = this._inTries.get(relationName);
    
    const newOutTrie = currentOutTrie.withRemovedEdge(edge);
    const newInTrie = currentInTrie.withRemovedEdge(edge);
    
    const newOutTries = new Map(this._outTries);
    const newInTries = new Map(this._inTries);
    
    newOutTries.set(relationName, newOutTrie);
    newInTries.set(relationName, newInTrie);
    
    return new ImmutableTrieManager(
      newOutTries,
      newInTries,
      this._relationNames
    );
  }

  // Read-only accessors
  getOutTrie(relationName) { 
    return this._outTries.get(relationName); 
  }
  
  getInTrie(relationName) { 
    return this._inTries.get(relationName); 
  }
  
  hasRelationType(relationName) { 
    return this._relationNames.has(relationName); 
  }
  
  getRelationNames() { 
    return Array.from(this._relationNames); 
  }
}
```

---

## 4) Constraint Validation System

### 4.1 Constraint Definition Framework

```javascript
/**
 * Base constraint interface
 */
export class Constraint {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Validate constraint against an immutable store root
   * @param {ImmutableStoreRoot} root - Candidate state to validate
   * @returns {ConstraintResult} Validation result
   */
  validate(root) {
    throw new Error('Subclasses must implement validate()');
  }
}

/**
 * Constraint validation result
 */
export class ConstraintResult {
  constructor(isValid, violations = []) {
    this.isValid = isValid;
    this.violations = violations; // Array of ConstraintViolation
  }

  static success() {
    return new ConstraintResult(true, []);
  }

  static failure(violations) {
    return new ConstraintResult(false, violations);
  }
}

/**
 * Individual constraint violation
 */
export class ConstraintViolation {
  constructor(constraintName, message, affectedEntities = [], context = {}) {
    this.constraintName = constraintName;
    this.message = message;
    this.affectedEntities = affectedEntities;
    this.context = context;
    this.timestamp = Date.now();
  }
}
```

### 4.2 Built-in Constraint Types

**Cardinality Constraints:**
```javascript
/**
 * Enforces maximum cardinality for relationships
 * Example: Person can work at most 1 company
 */
export class CardinalityConstraint extends Constraint {
  constructor(relationshipType, maxCardinality, direction = 'outgoing') {
    super(
      `cardinality_${relationshipType}_${direction}_${maxCardinality}`,
      `${relationshipType} ${direction} cardinality <= ${maxCardinality}`
    );
    this.relationshipType = relationshipType;
    this.maxCardinality = maxCardinality;
    this.direction = direction; // 'outgoing' or 'incoming'
  }

  validate(root) {
    const violations = [];
    const edges = root.getEdgesByType(this.relationshipType);
    
    // Count relationships per entity
    const entityCounts = new Map();
    
    for (const edge of edges) {
      const entity = this.direction === 'outgoing' ? edge.src : edge.dst;
      entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
    }
    
    // Check for violations
    for (const [entity, count] of entityCounts) {
      if (count > this.maxCardinality) {
        violations.push(new ConstraintViolation(
          this.name,
          `Entity '${entity}' has ${count} ${this.relationshipType} relationships, exceeds maximum ${this.maxCardinality}`,
          [entity],
          { actualCount: count, maxAllowed: this.maxCardinality }
        ));
      }
    }
    
    return violations.length > 0 
      ? ConstraintResult.failure(violations)
      : ConstraintResult.success();
  }
}
```

**Entity Type Constraints:**
```javascript
/**
 * Enforces entity type compatibility for relationships
 * Example: worksAt relationship must be Person -> Company
 */
export class EntityTypeConstraint extends Constraint {
  constructor(relationshipType, sourceType, targetType) {
    super(
      `entity_type_${relationshipType}`,
      `${relationshipType} must connect ${sourceType} -> ${targetType}`
    );
    this.relationshipType = relationshipType;
    this.sourceType = sourceType;
    this.targetType = targetType;
  }

  validate(root) {
    const violations = [];
    const edges = root.getEdgesByType(this.relationshipType);
    
    for (const edge of edges) {
      // Check source type
      const sourceTypeEdges = root.getEdgesBySource(edge.src);
      const sourceType = this._getEntityType(sourceTypeEdges);
      
      if (sourceType !== this.sourceType) {
        violations.push(new ConstraintViolation(
          this.name,
          `Source entity '${edge.src}' has type '${sourceType}', expected '${this.sourceType}'`,
          [edge.src],
          { edge: edge.toString(), expectedType: this.sourceType, actualType: sourceType }
        ));
      }
      
      // Check target type  
      const targetTypeEdges = root.getEdgesBySource(edge.dst);
      const targetType = this._getEntityType(targetTypeEdges);
      
      if (targetType !== this.targetType) {
        violations.push(new ConstraintViolation(
          this.name,
          `Target entity '${edge.dst}' has type '${targetType}', expected '${this.targetType}'`,
          [edge.dst],
          { edge: edge.toString(), expectedType: this.targetType, actualType: targetType }
        ));
      }
    }
    
    return violations.length > 0 
      ? ConstraintResult.failure(violations)
      : ConstraintResult.success();
  }

  _getEntityType(typeEdges) {
    // Look for InstanceOf edges to determine entity type
    const instanceOfEdge = typeEdges.find(e => e.type === 'InstanceOf');
    return instanceOfEdge ? instanceOfEdge.dst : 'Unknown';
  }
}
```

**Custom Business Rule Constraints:**
```javascript
/**
 * Custom constraint using user-defined validation function
 */
export class CustomConstraint extends Constraint {
  constructor(name, description, validationFunction) {
    super(name, description);
    this.validationFunction = validationFunction;
  }

  validate(root) {
    try {
      const result = this.validationFunction(root);
      
      // Support different return formats
      if (typeof result === 'boolean') {
        return result 
          ? ConstraintResult.success()
          : ConstraintResult.failure([
              new ConstraintViolation(this.name, 'Custom constraint validation failed')
            ]);
      }
      
      if (result instanceof ConstraintResult) {
        return result;
      }
      
      throw new Error('Custom validation function must return boolean or ConstraintResult');
      
    } catch (error) {
      return ConstraintResult.failure([
        new ConstraintViolation(
          this.name,
          `Custom constraint evaluation error: ${error.message}`,
          [],
          { error: error.message }
        )
      ]);
    }
  }
}

// Example usage:
const noSelfEmploymentConstraint = new CustomConstraint(
  'no_self_employment',
  'Person cannot work at a company they own',
  (root) => {
    const worksAtEdges = root.getEdgesByType('worksAt');
    const ownsEdges = root.getEdgesByType('owns');
    
    for (const workEdge of worksAtEdges) {
      const person = workEdge.src;
      const company = workEdge.dst;
      
      // Check if person owns the company
      const ownsCompany = ownsEdges.some(
        ownEdge => ownEdge.src === person && ownEdge.dst === company
      );
      
      if (ownsCompany) {
        return ConstraintResult.failure([
          new ConstraintViolation(
            'no_self_employment',
            `Person '${person}' cannot work at company '${company}' that they own`,
            [person, company],
            { conflictingEdges: [workEdge.toString(), `owns(${person}, ${company})`] }
          )
        ]);
      }
    }
    
    return ConstraintResult.success();
  }
);
```

### 4.3 Constraint Registry and Validator

```javascript
/**
 * Central registry for all constraints
 */
export class ConstraintRegistry {
  constructor() {
    this._constraints = new Map(); // constraintName -> Constraint
    this._relationshipConstraints = new Map(); // relationshipType -> Set<Constraint>
    this._globalConstraints = new Set(); // Constraints that apply to entire store
  }

  /**
   * Register a constraint
   */
  register(constraint) {
    if (!(constraint instanceof Constraint)) {
      throw new Error('Must be a Constraint instance');
    }
    
    if (this._constraints.has(constraint.name)) {
      throw new Error(`Constraint '${constraint.name}' already registered`);
    }
    
    this._constraints.set(constraint.name, constraint);
    
    // Index by relationship type if applicable
    if (constraint.relationshipType) {
      if (!this._relationshipConstraints.has(constraint.relationshipType)) {
        this._relationshipConstraints.set(constraint.relationshipType, new Set());
      }
      this._relationshipConstraints.get(constraint.relationshipType).add(constraint);
    } else {
      // Global constraint
      this._globalConstraints.add(constraint);
    }
  }

  /**
   * Get constraints for a specific relationship type
   */
  getConstraintsForRelationship(relationshipType) {
    return this._relationshipConstraints.get(relationshipType) || new Set();
  }

  /**
   * Get all global constraints
   */
  getGlobalConstraints() {
    return this._globalConstraints;
  }

  /**
   * Get all constraints
   */
  getAllConstraints() {
    return Array.from(this._constraints.values());
  }
}

/**
 * Constraint validator that runs all applicable constraints
 */
export class ConstraintValidator {
  constructor(constraintRegistry) {
    this._registry = constraintRegistry;
  }

  /**
   * Validate all constraints against a candidate root
   */
  validate(candidateRoot, changedRelationships = new Set()) {
    const violations = [];
    const executedConstraints = new Set();
    
    // Run constraints for changed relationships
    for (const relationshipType of changedRelationships) {
      const constraints = this._registry.getConstraintsForRelationship(relationshipType);
      
      for (const constraint of constraints) {
        if (executedConstraints.has(constraint.name)) {
          continue; // Avoid duplicate execution
        }
        
        const result = constraint.validate(candidateRoot);
        if (!result.isValid) {
          violations.push(...result.violations);
        }
        
        executedConstraints.add(constraint.name);
      }
    }
    
    // Run global constraints
    for (const constraint of this._registry.getGlobalConstraints()) {
      if (executedConstraints.has(constraint.name)) {
        continue;
      }
      
      const result = constraint.validate(candidateRoot);
      if (!result.isValid) {
        violations.push(...result.violations);
      }
      
      executedConstraints.add(constraint.name);
    }
    
    return violations;
  }

  /**
   * Validate specific constraints only
   */
  validateConstraints(candidateRoot, constraintNames) {
    const violations = [];
    
    for (const constraintName of constraintNames) {
      const constraint = this._registry._constraints.get(constraintName);
      if (!constraint) {
        throw new Error(`Constraint '${constraintName}' not found`);
      }
      
      const result = constraint.validate(candidateRoot);
      if (!result.isValid) {
        violations.push(...result.violations);
      }
    }
    
    return violations;
  }
}
```

---

## 5) Immutable DataStore Implementation

### 5.1 Main ImmutableDataStore Class

```javascript
/**
 * Immutable data store with constraint validation
 */
export class ImmutableDataStore extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this._currentRoot = new ImmutableStoreRoot();
    this._constraintRegistry = new ConstraintRegistry();
    this._constraintValidator = new ConstraintValidator(this._constraintRegistry);
    this._history = []; // Array of { root, operation, timestamp }
    this._options = {
      maxHistorySize: 1000,
      enableHistory: true,
      enableConstraints: true,
      ...options
    };
    
    // Initialize built-in constraints
    this._setupBuiltInConstraints();
  }

  /**
   * Atomic edge addition with constraint validation
   */
  addEdge(type, src, dst) {
    const edge = new Edge(type, src, dst);
    
    // 1. Create candidate new root (pure function - no side effects)
    const candidateRoot = this._currentRoot.withAddedEdge(edge);
    
    // 2. Validate constraints on candidate root
    if (this._options.enableConstraints) {
      const violations = this._constraintValidator.validate(
        candidateRoot, 
        new Set([type]) // Only check constraints for this relationship type
      );
      
      if (violations.length > 0) {
        const error = new ConstraintViolationError(violations);
        this.emit('constraintViolation', { edge, violations, candidateRoot });
        throw error;
      }
    }
    
    // 3. All validations passed - atomic transition to new root
    const oldRoot = this._currentRoot;
    this._currentRoot = candidateRoot;
    
    // 4. Record in history
    if (this._options.enableHistory) {
      this._recordTransition(oldRoot, candidateRoot, 'addEdge', { edge });
    }
    
    // 5. Notify subscribers of successful transition
    this.emit('rootTransition', {
      oldRoot,
      newRoot: candidateRoot,
      operation: 'addEdge',
      edge,
      timestamp: Date.now()
    });
    
    this.emit('edgeAdded', { edge, root: candidateRoot });
    
    return edge;
  }

  /**
   * Atomic edge removal with constraint validation
   */
  removeEdge(type, src, dst) {
    const edge = new Edge(type, src, dst);
    
    // 1. Create candidate new root
    const candidateRoot = this._currentRoot.withRemovedEdge(edge);
    
    // 2. Validate constraints
    if (this._options.enableConstraints) {
      const violations = this._constraintValidator.validate(
        candidateRoot, 
        new Set([type])
      );
      
      if (violations.length > 0) {
        const error = new ConstraintViolationError(violations);
        this.emit('constraintViolation', { edge, violations, candidateRoot });
        throw error;
      }
    }
    
    // 3. Atomic transition
    const oldRoot = this._currentRoot;
    this._currentRoot = candidateRoot;
    
    // 4. Record and notify
    if (this._options.enableHistory) {
      this._recordTransition(oldRoot, candidateRoot, 'removeEdge', { edge });
    }
    
    this.emit('rootTransition', {
      oldRoot,
      newRoot: candidateRoot,
      operation: 'removeEdge',
      edge,
      timestamp: Date.now()
    });
    
    this.emit('edgeRemoved', { edge, root: candidateRoot });
    
    return true;
  }

  /**
   * Define relationship type with constraint validation
   */
  defineRelationType(forwardName, backwardName, constraints = []) {
    const relationshipType = new RelationshipType(forwardName, backwardName);
    
    // 1. Create candidate root with new relationship type
    const candidateRoot = this._currentRoot.withAddedRelationType(relationshipType);
    
    // 2. Register any constraints for this relationship type
    for (const constraint of constraints) {
      this._constraintRegistry.register(constraint);
    }
    
    // 3. Atomic transition
    const oldRoot = this._currentRoot;
    this._currentRoot = candidateRoot;
    
    // 4. Record and notify
    if (this._options.enableHistory) {
      this._recordTransition(oldRoot, candidateRoot, 'defineRelationType', { 
        relationshipType, 
        constraints: constraints.map(c => c.name) 
      });
    }
    
    this.emit('rootTransition', {
      oldRoot,
      newRoot: candidateRoot,
      operation: 'defineRelationType',
      relationshipType,
      timestamp: Date.now()
    });
    
    return relationshipType;
  }

  /**
   * Batch operations with single constraint validation
   */
  batch(operations) {
    if (!Array.isArray(operations)) {
      throw new Error('Operations must be an array');
    }
    
    // 1. Apply all operations to create candidate root
    let candidateRoot = this._currentRoot;
    const appliedOperations = [];
    const changedRelationships = new Set();
    
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'addEdge':
            const addEdge = new Edge(op.relationshipType, op.src, op.dst);
            candidateRoot = candidateRoot.withAddedEdge(addEdge);
            appliedOperations.push({ ...op, edge: addEdge });
            changedRelationships.add(op.relationshipType);
            break;
            
          case 'removeEdge':
            const removeEdge = new Edge(op.relationshipType, op.src, op.dst);
            candidateRoot = candidateRoot.withRemovedEdge(removeEdge);
            appliedOperations.push({ ...op, edge: removeEdge });
            changedRelationships.add(op.relationshipType);
            break;
            
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      } catch (error) {
        throw new Error(`Operation ${appliedOperations.length + 1} failed: ${error.message}`);
      }
    }
    
    // 2. Single constraint validation on final candidate root
    if (this._options.enableConstraints) {
      const violations = this._constraintValidator.validate(candidateRoot, changedRelationships);
      
      if (violations.length > 0) {
        const error = new ConstraintViolationError(violations);
        this.emit('constraintViolation', { 
          operations: appliedOperations, 
          violations, 
          candidateRoot 
        });
        throw error;
      }
    }
    
    // 3. All operations valid - atomic transition
    const oldRoot = this._currentRoot;
    this._currentRoot = candidateRoot;
    
    // 4. Record and notify
    if (this._options.enableHistory) {
      this._recordTransition(oldRoot, candidateRoot, 'batch', { 
        operations: appliedOperations,
        operationCount: appliedOperations.length
      });
    }
    
    this.emit('rootTransition', {
      oldRoot,
      newRoot: candidateRoot,
      operation: 'batch',
      operations: appliedOperations,
      timestamp: Date.now()
    });
    
    return appliedOperations;
  }

  // === CONSTRAINT MANAGEMENT ===

  /**
   * Register a constraint
   */
  addConstraint(constraint) {
    this._constraintRegistry.register(constraint);
    this.emit('constraintAdded', { constraint });
  }

  /**
   * Validate current state against all constraints
   */
  validateCurrentState() {
    const violations = this._constraintValidator.validate(this._currentRoot, new Set());
    return violations;
  }

  /**
   * Test if an operation would succeed without applying it
   */
  testOperation(operation) {
    try {
      let candidateRoot = this._currentRoot;
      
      switch (operation.type) {
        case 'addEdge':
          const edge = new Edge(operation.relationshipType, operation.src, operation.dst);
          candidateRoot = candidateRoot.withAddedEdge(edge);
          break;
          
        case 'removeEdge':
          const removeEdge = new Edge(operation.relationshipType, operation.src, operation.dst);
          candidateRoot = candidateRoot.withRemovedEdge(removeEdge);
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
      
      if (this._options.enableConstraints) {
        const violations = this._constraintValidator.validate(
          candidateRoot, 
          new Set([operation.relationshipType])
        );
        
        return {
          wouldSucceed: violations.length === 0,
          violations,
          candidateRoot
        };
      }
      
      return {
        wouldSucceed: true,
        violations: [],
        candidateRoot
      };
      
    } catch (error) {
      return {
        wouldSucceed: false,
        violations: [],
        error: error.message
      };
    }
  }

  // === DEBUGGING AND HISTORY ===

  /**
   * Get current state snapshot
   */
  getCurrentRoot() {
    return this._currentRoot;
  }

  /**
   * Rewind to previous state (time-travel debugging)
   */
  rewindToHistoryIndex(index) {
    if (index < 0 || index >= this._history.length) {
      throw new Error(`Invalid history index: ${index}`);
    }
    
    const historyEntry = this._history[index];
    const oldRoot = this._currentRoot;
    this._currentRoot = historyEntry.root;
    
    this.emit('rootTransition', {
      oldRoot,
      newRoot: this._currentRoot,
      operation: 'rewind',
      targetIndex: index,
      timestamp: Date.now()
    });
    
    return this._currentRoot;
  }

  /**
   * Compare two roots and show differences
   */
  diffRoots(rootA, rootB) {
    const aEdges = new Set(Array.from(rootA.getEdges().values()).map(e => e.toString()));
    const bEdges = new Set(Array.from(rootB.getEdges().values()).map(e => e.toString()));
    
    const added = [];
    const removed = [];
    
    for (const edge of bEdges) {
      if (!aEdges.has(edge)) {
        added.push(edge);
      }
    }
    
    for (const edge of aEdges) {
      if (!bEdges.has(edge)) {
        removed.push(edge);
      }
    }
    
    return { added, removed };
  }

  /**
   * Get complete history
   */
  getHistory() {
    return [...this._history]; // Return copy
  }

  /**
   * Clear history (keep current state)
   */
  clearHistory() {
    this._history = [];
    this.emit('historyCleared');
  }

  // === READ-ONLY ACCESSORS ===

  getEdges(type = null) {
    if (type) {
      return Array.from(this._currentRoot.getEdgesByType(type));
    } else {
      return Array.from(this._currentRoot.getEdges().values());
    }
  }

  hasEdge(type, src, dst) {
    const edge = new Edge(type, src, dst);
    return this._currentRoot.hasEdge(edge);
  }

  getEdgeCount() {
    return this._currentRoot.getEdgeCount();
  }

  getRelationshipTypes() {
    return Array.from(this._currentRoot.getRelationshipTypes().values());
  }

  hasRelationType(typeName) {
    return this._currentRoot.hasRelationType(typeName);
  }

  // === PRIVATE METHODS ===

  _recordTransition(oldRoot, newRoot, operation, context) {
    this._history.push({
      root: newRoot,
      operation,
      context,
      timestamp: Date.now(),
      version: newRoot.getMetadata().version
    });
    
    // Limit history size
    if (this._history.length > this._options.maxHistorySize) {
      this._history.shift(); // Remove oldest entry
    }
  }

  _setupBuiltInConstraints() {
    // Example built-in constraints can be added here
    // Users can override in options or add their own
  }
}

/**
 * Error thrown when constraint validation fails
 */
export class ConstraintViolationError extends Error {
  constructor(violations) {
    const message = `Constraint validation failed: ${violations.length} violation(s)`;
    super(message);
    this.name = 'ConstraintViolationError';
    this.violations = violations;
  }
}
```

---

## 6) Schema Definition System

### 6.1 Entity Type Schemas

```javascript
/**
 * Entity type definition with attribute constraints
 */
export class EntityType {
  constructor(name, attributes = {}, constraints = []) {
    this.name = name;
    this.attributes = attributes;
    this.constraints = constraints;
    Object.freeze(this);
  }

  /**
   * Validate entity instance against schema
   */
  validateEntity(entityId, root) {
    const violations = [];
    
    // Check required attributes
    for (const [attrName, attrSchema] of Object.entries(this.attributes)) {
      if (attrSchema.required) {
        const hasAttribute = root.getEdgesBySource(entityId)
          .some(edge => edge.type === attrName);
          
        if (!hasAttribute) {
          violations.push(new ConstraintViolation(
            `${this.name}_required_${attrName}`,
            `Required attribute '${attrName}' missing for ${this.name} entity '${entityId}'`,
            [entityId],
            { entityType: this.name, missingAttribute: attrName }
          ));
        }
      }
    }
    
    // Validate attribute values
    for (const edge of root.getEdgesBySource(entityId)) {
      const attrSchema = this.attributes[edge.type];
      if (attrSchema) {
        const attrViolations = this._validateAttribute(edge, attrSchema);
        violations.push(...attrViolations);
      }
    }
    
    return violations;
  }

  _validateAttribute(edge, schema) {
    const violations = [];
    const value = edge.dst;
    
    // Type validation
    if (schema.type) {
      if (!this._validateType(value, schema.type)) {
        violations.push(new ConstraintViolation(
          `${this.name}_type_${edge.type}`,
          `Attribute '${edge.type}' has invalid type. Expected ${schema.type}, got ${typeof value}`,
          [edge.src],
          { edge: edge.toString(), expectedType: schema.type, actualType: typeof value }
        ));
      }
    }
    
    // Range validation
    if (schema.min !== undefined && value < schema.min) {
      violations.push(new ConstraintViolation(
        `${this.name}_min_${edge.type}`,
        `Attribute '${edge.type}' value ${value} is below minimum ${schema.min}`,
        [edge.src],
        { edge: edge.toString(), value, min: schema.min }
      ));
    }
    
    if (schema.max !== undefined && value > schema.max) {
      violations.push(new ConstraintViolation(
        `${this.name}_max_${edge.type}`,
        `Attribute '${edge.type}' value ${value} exceeds maximum ${schema.max}`,
        [edge.src],
        { edge: edge.toString(), value, max: schema.max }
      ));
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      violations.push(new ConstraintViolation(
        `${this.name}_enum_${edge.type}`,
        `Attribute '${edge.type}' value '${value}' not in allowed values: ${schema.enum.join(', ')}`,
        [edge.src],
        { edge: edge.toString(), value, allowedValues: schema.enum }
      ));
    }
    
    return violations;
  }

  _validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      default:
        return true; // Unknown type, assume valid
    }
  }
}

/**
 * Entity type registry
 */
export class EntityTypeRegistry {
  constructor() {
    this._entityTypes = new Map(); // typeName -> EntityType
  }

  register(entityType) {
    if (!(entityType instanceof EntityType)) {
      throw new Error('Must be an EntityType instance');
    }
    
    this._entityTypes.set(entityType.name, entityType);
  }

  get(typeName) {
    return this._entityTypes.get(typeName);
  }

  has(typeName) {
    return this._entityTypes.has(typeName);
  }

  getAll() {
    return Array.from(this._entityTypes.values());
  }
}
```

### 6.2 Schema-Driven Constraint Generation

```javascript
/**
 * Automatically generate constraints from entity schemas
 */
export class SchemaConstraintGenerator {
  static generateEntityConstraints(entityType) {
    const constraints = [];
    
    // Generate required attribute constraints
    for (const [attrName, attrSchema] of Object.entries(entityType.attributes)) {
      if (attrSchema.required) {
        constraints.push(new CustomConstraint(
          `${entityType.name}_required_${attrName}`,
          `${entityType.name} entities must have ${attrName} attribute`,
          (root) => {
            const violations = [];
            
            // Find all entities of this type
            const typeEdges = root.getEdgesByType('InstanceOf');
            const entitiesOfType = typeEdges
              .filter(edge => edge.dst === entityType.name)
              .map(edge => edge.src);
            
            // Check each entity has required attribute
            for (const entityId of entitiesOfType) {
              const hasAttribute = root.getEdgesBySource(entityId)
                .some(edge => edge.type === attrName);
                
              if (!hasAttribute) {
                violations.push(new ConstraintViolation(
                  `${entityType.name}_required_${attrName}`,
                  `Required attribute '${attrName}' missing for ${entityType.name} entity '${entityId}'`,
                  [entityId]
                ));
              }
            }
            
            return violations.length > 0 
              ? ConstraintResult.failure(violations)
              : ConstraintResult.success();
          }
        ));
      }
      
      // Generate cardinality constraints
      if (attrSchema.maxCardinality) {
        constraints.push(new CardinalityConstraint(
          attrName, 
          attrSchema.maxCardinality, 
          'outgoing'
        ));
      }
    }
    
    return constraints;
  }

  static generateRelationshipConstraints(relationshipType, sourceEntityType, targetEntityType) {
    return [
      new EntityTypeConstraint(
        relationshipType.forwardName,
        sourceEntityType.name,
        targetEntityType.name
      )
    ];
  }
}
```

### 6.3 Usage Example

```javascript
// Define entity types
const personType = new EntityType('Person', {
  name: { type: 'string', required: true, maxLength: 100 },
  email: { type: 'email', required: true, unique: true },
  age: { type: 'integer', min: 0, max: 150 },
  status: { type: 'string', enum: ['active', 'inactive', 'pending'] }
});

const companyType = new EntityType('Company', {
  name: { type: 'string', required: true },
  founded: { type: 'date' },
  employeeCount: { type: 'integer', min: 0 }
});

// Create immutable data store
const dataStore = new ImmutableDataStore();

// Register entity types and auto-generate constraints
const personConstraints = SchemaConstraintGenerator.generateEntityConstraints(personType);
const companyConstraints = SchemaConstraintGenerator.generateEntityConstraints(companyType);

for (const constraint of [...personConstraints, ...companyConstraints]) {
  dataStore.addConstraint(constraint);
}

// Define relationship types with constraints
const worksAtConstraints = SchemaConstraintGenerator.generateRelationshipConstraints(
  new RelationshipType('worksAt', 'employs'),
  personType,
  companyType
);

dataStore.defineRelationType('worksAt', 'employs', [
  ...worksAtConstraints,
  new CardinalityConstraint('worksAt', 1, 'outgoing'), // Person works at most 1 company
  new CardinalityConstraint('worksAt', 50, 'incoming')  // Company employs at most 50 people
]);

// Usage with automatic validation
try {
  // Create entities
  dataStore.addEdge('InstanceOf', 'alice', 'Person');
  dataStore.addEdge('name', 'alice', 'Alice Johnson');
  dataStore.addEdge('email', 'alice', 'alice@company.com');
  dataStore.addEdge('age', 'alice', 30);
  dataStore.addEdge('status', 'alice', 'active');
  
  dataStore.addEdge('InstanceOf', 'acme', 'Company');
  dataStore.addEdge('name', 'acme', 'Acme Corporation');
  
  // Create relationship (validates all constraints)
  dataStore.addEdge('worksAt', 'alice', 'acme');
  
  console.log('✅ All constraints satisfied');
  
} catch (error) {
  if (error instanceof ConstraintViolationError) {
    console.log('❌ Constraint violations:');
    for (const violation of error.violations) {
      console.log(`  - ${violation.message}`);
    }
  }
}
```

---

## 7) Performance Optimizations

### 7.1 Copy-on-Write Optimizations

```javascript
/**
 * Optimized copy-on-write Map that shares structure
 */
export class COWMap {
  constructor(data = new Map(), isDirty = false) {
    this._data = data;
    this._isDirty = isDirty;
    this._copyThreshold = 1000; // Copy when map gets large
  }

  set(key, value) {
    // Lazy copy - only copy when first mutation
    if (!this._isDirty) {
      this._data = new Map(this._data);
      this._isDirty = true;
    }
    
    this._data.set(key, value);
    return this;
  }

  delete(key) {
    if (!this._isDirty) {
      this._data = new Map(this._data);
      this._isDirty = true;
    }
    
    return this._data.delete(key);
  }

  get(key) {
    return this._data.get(key);
  }

  has(key) {
    return this._data.has(key);
  }

  get size() {
    return this._data.size;
  }

  // Optimized for large maps
  setMany(entries) {
    if (entries.length === 0) return this;
    
    if (!this._isDirty) {
      // For large maps, consider incremental copying
      if (this._data.size > this._copyThreshold) {
        return this._incrementalCopy(entries);
      }
      
      this._data = new Map(this._data);
      this._isDirty = true;
    }
    
    for (const [key, value] of entries) {
      this._data.set(key, value);
    }
    
    return this;
  }

  _incrementalCopy(newEntries) {
    // For very large maps, copy only affected portions
    const newData = new Map();
    
    // Copy existing entries not being modified
    const modifiedKeys = new Set(newEntries.map(([key]) => key));
    for (const [key, value] of this._data) {
      if (!modifiedKeys.has(key)) {
        newData.set(key, value);
      }
    }
    
    // Add new/modified entries
    for (const [key, value] of newEntries) {
      newData.set(key, value);
    }
    
    return new COWMap(newData, true);
  }
}

/**
 * Optimized copy-on-write Set
 */
export class COWSet {
  constructor(data = new Set(), isDirty = false) {
    this._data = data;
    this._isDirty = isDirty;
  }

  add(value) {
    if (this._data.has(value)) {
      return this; // No change needed
    }
    
    if (!this._isDirty) {
      this._data = new Set(this._data);
      this._isDirty = true;
    }
    
    this._data.add(value);
    return this;
  }

  delete(value) {
    if (!this._data.has(value)) {
      return false; // No change needed
    }
    
    if (!this._isDirty) {
      this._data = new Set(this._data);
      this._isDirty = true;
    }
    
    return this._data.delete(value);
  }

  has(value) {
    return this._data.has(value);
  }

  get size() {
    return this._data.size;
  }

  [Symbol.iterator]() {
    return this._data[Symbol.iterator]();
  }
}
```

### 7.2 Structural Sharing for Trie Nodes

```javascript
/**
 * Enhanced ImmutableTrieNode with structural sharing
 */
export class OptimizedImmutableTrieNode extends ImmutableTrieNode {
  constructor(value, children, witnesses, isLeaf, depth, shareId = null) {
    super(value, children, witnesses, isLeaf, depth);
    this._shareId = shareId || this._generateShareId();
  }

  withAddedChild(value) {
    if (this._children.has(value)) {
      return this; // Share existing node
    }
    
    // Share children map if possible
    const newChildren = this._children.size < 10 
      ? new Map(this._children) // Small maps - copy
      : new COWMap(this._children); // Large maps - COW
    
    const newChild = new OptimizedImmutableTrieNode(
      value, 
      new Map(), 
      new Set(), 
      false, 
      this._depth + 1
    );
    
    newChildren.set(value, newChild);
    
    return new OptimizedImmutableTrieNode(
      this._value,
      newChildren,
      this._witnesses, // Share witnesses if unchanged
      this._isLeaf,
      this._depth,
      this._shareId // Inherit share ID for related nodes
    );
  }

  _generateShareId() {
    return Math.random().toString(36).substr(2, 9);
  }
}
```

### 7.3 Incremental Constraint Validation

```javascript
/**
 * Optimized constraint validator that only checks affected constraints
 */
export class IncrementalConstraintValidator extends ConstraintValidator {
  constructor(constraintRegistry) {
    super(constraintRegistry);
    this._constraintDependencies = new Map(); // constraint -> Set<relationshipType>
    this._buildDependencyGraph();
  }

  /**
   * Validate only constraints affected by the change
   */
  validateIncremental(candidateRoot, changedEdges, operation) {
    const affectedConstraints = new Set();
    
    // Determine which constraints might be affected
    for (const edge of changedEdges) {
      const constraintsForType = this._registry.getConstraintsForRelationship(edge.type);
      for (const constraint of constraintsForType) {
        affectedConstraints.add(constraint);
      }
      
      // Check constraints that depend on this relationship type
      for (const [constraint, dependencies] of this._constraintDependencies) {
        if (dependencies.has(edge.type)) {
          affectedConstraints.add(constraint);
        }
      }
    }
    
    // Run only affected constraints
    const violations = [];
    for (const constraint of affectedConstraints) {
      const result = constraint.validate(candidateRoot);
      if (!result.isValid) {
        violations.push(...result.violations);
      }
    }
    
    return violations;
  }

  _buildDependencyGraph() {
    // Analyze constraints to determine their dependencies
    for (const constraint of this._registry.getAllConstraints()) {
      const dependencies = this._analyzeConstraintDependencies(constraint);
      this._constraintDependencies.set(constraint, dependencies);
    }
  }

  _analyzeConstraintDependencies(constraint) {
    // Static analysis or runtime introspection to determine
    // which relationship types a constraint depends on
    const dependencies = new Set();
    
    if (constraint.relationshipType) {
      dependencies.add(constraint.relationshipType);
    }
    
    // For custom constraints, could use AST analysis or
    // runtime tracking of accessed relationship types
    
    return dependencies;
  }
}
```

---

## 8) Migration Strategy

### 8.1 Backward Compatibility Layer

```javascript
/**
 * Compatibility wrapper that provides mutable API over immutable store
 */
export class CompatibilityDataStore {
  constructor(immutableStore) {
    this._immutableStore = immutableStore;
    
    // Proxy all read methods directly
    this.getEdges = (...args) => this._immutableStore.getEdges(...args);
    this.hasEdge = (...args) => this._immutableStore.hasEdge(...args);
    this.getEdgeCount = () => this._immutableStore.getEdgeCount();
    this.getRelationshipTypes = () => this._immutableStore.getRelationshipTypes();
    this.hasRelationType = (...args) => this._immutableStore.hasRelationType(...args);
  }

  /**
   * Mutable-style addEdge that calls immutable version
   */
  addEdge(edge) {
    if (typeof edge === 'string') {
      // Handle (type, src, dst) signature
      return this._immutableStore.addEdge(arguments[0], arguments[1], arguments[2]);
    } else {
      // Handle Edge instance
      return this._immutableStore.addEdge(edge.type, edge.src, edge.dst);
    }
  }

  /**
   * Mutable-style removeEdge
   */
  removeEdge(edge) {
    if (typeof edge === 'string') {
      return this._immutableStore.removeEdge(arguments[0], arguments[1], arguments[2]);
    } else {
      return this._immutableStore.removeEdge(edge.type, edge.src, edge.dst);
    }
  }

  /**
   * Mutable-style defineRelationType
   */
  defineRelationType(forwardName, backwardName) {
    return this._immutableStore.defineRelationType(forwardName, backwardName);
  }

  // === BRIDGE TO IMMUTABLE FEATURES ===

  /**
   * Expose immutable-specific features
   */
  get immutable() {
    return {
      getCurrentRoot: () => this._immutableStore.getCurrentRoot(),
      testOperation: (op) => this._immutableStore.testOperation(op),
      validateCurrentState: () => this._immutableStore.validateCurrentState(),
      addConstraint: (constraint) => this._immutableStore.addConstraint(constraint),
      getHistory: () => this._immutableStore.getHistory(),
      rewindToHistoryIndex: (index) => this._immutableStore.rewindToHistoryIndex(index),
      batch: (operations) => this._immutableStore.batch(operations)
    };
  }
}
```

### 8.2 Incremental Migration Plan

**Phase 1: Add Immutable Infrastructure (No Breaking Changes)**
```javascript
// Step 1: Add immutable classes alongside existing mutable ones
// src/immutable/ImmutableStoreRoot.js
// src/immutable/ImmutableTrieNode.js
// src/immutable/ImmutableDataStore.js

// Step 2: Add tests for immutable classes
// __tests__/immutable/ImmutableStoreRoot.test.js

// Step 3: Add compatibility layer
// src/CompatibilityDataStore.js
```

**Phase 2: Constraint System (Additive)**
```javascript
// Step 1: Add constraint framework
// src/constraints/Constraint.js
// src/constraints/ConstraintRegistry.js
// src/constraints/ConstraintValidator.js

// Step 2: Add built-in constraint types
// src/constraints/CardinalityConstraint.js
// src/constraints/EntityTypeConstraint.js

// Step 3: Integrate with ImmutableDataStore
```

**Phase 3: Optional Migration (User Choice)**
```javascript
// Existing code continues to work:
const dataStore = new DataStore(); // Mutable version
dataStore.addEdge('worksAt', 'alice', 'company');

// New code can use immutable version:
const immutableStore = new ImmutableDataStore();
const compatStore = new CompatibilityDataStore(immutableStore);
compatStore.addEdge('worksAt', 'alice', 'company'); // Same API, immutable underneath

// Or use immutable features directly:
immutableStore.addConstraint(new CardinalityConstraint('worksAt', 1));
```

**Phase 4: Deprecation (Long Term)**
```javascript
// Eventually deprecate mutable classes with clear migration path
// Provide automated migration tools
// Update documentation and examples
```

---

## 9) Debugging and Development Tools

### 9.1 State Inspector

```javascript
/**
 * Development tool for inspecting data store state
 */
export class DataStoreInspector {
  constructor(dataStore) {
    this._dataStore = dataStore;
  }

  /**
   * Generate comprehensive state report
   */
  inspect() {
    const root = this._dataStore.getCurrentRoot();
    
    return {
      metadata: root.getMetadata(),
      statistics: this._getStatistics(root),
      relationshipTypes: this._getRelationshipTypeInfo(root),
      constraints: this._getConstraintInfo(),
      history: this._getHistoryInfo(),
      performance: this._getPerformanceInfo()
    };
  }

  /**
   * Visualize state as text-based tree
   */
  visualizeState() {
    const root = this._dataStore.getCurrentRoot();
    let output = 'Data Store State:\n';
    
    // Show relationship types
    output += '\nRelationship Types:\n';
    for (const [name, type] of root.getRelationshipTypes()) {
      output += `  ${type.forwardName} / ${type.backwardName}\n`;
    }
    
    // Show edges grouped by type
    output += '\nEdges by Type:\n';
    for (const [typeName] of root.getRelationshipTypes()) {
      const edges = Array.from(root.getEdgesByType(typeName));
      if (edges.length > 0) {
        output += `  ${typeName} (${edges.length}):\n`;
        for (const edge of edges.slice(0, 10)) { // Limit to first 10
          output += `    ${edge.src} → ${edge.dst}\n`;
        }
        if (edges.length > 10) {
          output += `    ... ${edges.length - 10} more\n`;
        }
      }
    }
    
    return output;
  }

  /**
   * Find entities and their relationships
   */
  inspectEntity(entityId) {
    const root = this._dataStore.getCurrentRoot();
    
    const outgoingEdges = Array.from(root.getEdgesBySource(entityId));
    const incomingEdges = Array.from(root.getEdgesByDestination(entityId));
    
    return {
      entityId,
      outgoing: outgoingEdges.map(e => ({ type: e.type, target: e.dst })),
      incoming: incomingEdges.map(e => ({ type: e.type, source: e.src })),
      totalRelationships: outgoingEdges.length + incomingEdges.length
    };
  }

  /**
   * Validate and report constraint status
   */
  validateConstraints() {
    const violations = this._dataStore.validateCurrentState();
    
    return {
      isValid: violations.length === 0,
      violationCount: violations.length,
      violations: violations.map(v => ({
        constraint: v.constraintName,
        message: v.message,
        entities: v.affectedEntities,
        context: v.context
      }))
    };
  }

  _getStatistics(root) {
    return {
      totalEdges: root.getEdgeCount(),
      relationshipTypeCount: root.getRelationshipTypes().size,
      uniqueSourceCount: new Set(
        Array.from(root.getEdges().values()).map(e => e.src)
      ).size,
      uniqueDestinationCount: new Set(
        Array.from(root.getEdges().values()).map(e => e.dst)
      ).size
    };
  }

  _getRelationshipTypeInfo(root) {
    const info = {};
    
    for (const [name, type] of root.getRelationshipTypes()) {
      const edges = Array.from(root.getEdgesByType(name));
      info[name] = {
        forwardName: type.forwardName,
        backwardName: type.backwardName,
        edgeCount: edges.length,
        uniqueSources: new Set(edges.map(e => e.src)).size,
        uniqueTargets: new Set(edges.map(e => e.dst)).size
      };
    }
    
    return info;
  }

  _getConstraintInfo() {
    // Access constraint registry through data store
    return {
      totalConstraints: this._dataStore._constraintRegistry.getAllConstraints().length,
      constraintTypes: this._dataStore._constraintRegistry.getAllConstraints()
        .map(c => c.constructor.name)
        .reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
    };
  }

  _getHistoryInfo() {
    const history = this._dataStore.getHistory();
    
    return {
      entryCount: history.length,
      operations: history.map(entry => entry.operation)
        .reduce((acc, op) => {
          acc[op] = (acc[op] || 0) + 1;
          return acc;
        }, {}),
      timespan: history.length > 0 ? {
        start: history[0].timestamp,
        end: history[history.length - 1].timestamp
      } : null
    };
  }

  _getPerformanceInfo() {
    // Could include memory usage, operation timing, etc.
    return {
      memoryEstimate: this._estimateMemoryUsage(),
      lastOperationTime: Date.now() // Placeholder
    };
  }

  _estimateMemoryUsage() {
    // Rough estimate based on edge count
    const root = this._dataStore.getCurrentRoot();
    const edgeCount = root.getEdgeCount();
    
    // Estimate bytes per edge (rough calculation)
    const bytesPerEdge = 100; // JSON strings, object overhead, etc.
    
    return {
      estimatedBytes: edgeCount * bytesPerEdge,
      edgeCount
    };
  }
}
```

### 9.2 Time-Travel Debugger

```javascript
/**
 * Time-travel debugging interface
 */
export class TimeTravelDebugger {
  constructor(dataStore) {
    this._dataStore = dataStore;
    this._inspector = new DataStoreInspector(dataStore);
  }

  /**
   * Interactive debugging session
   */
  createSession() {
    return {
      // Get current position in history
      getCurrentIndex: () => {
        const history = this._dataStore.getHistory();
        return history.length - 1;
      },

      // Navigate history
      goto: (index) => {
        this._dataStore.rewindToHistoryIndex(index);
        return this._inspector.inspect();
      },

      stepBack: () => {
        const history = this._dataStore.getHistory();
        const currentIndex = history.length - 1;
        if (currentIndex > 0) {
          return this.goto(currentIndex - 1);
        }
        throw new Error('Already at beginning of history');
      },

      stepForward: () => {
        const history = this._dataStore.getHistory();
        const currentIndex = this._findCurrentHistoryIndex();
        if (currentIndex < history.length - 1) {
          return this.goto(currentIndex + 1);
        }
        throw new Error('Already at end of history');
      },

      // Analyze history
      showTimeline: () => {
        const history = this._dataStore.getHistory();
        return history.map((entry, index) => ({
          index,
          operation: entry.operation,
          timestamp: new Date(entry.timestamp).toISOString(),
          context: entry.context
        }));
      },

      // Compare states
      diff: (indexA, indexB) => {
        const history = this._dataStore.getHistory();
        const rootA = history[indexA].root;
        const rootB = history[indexB].root;
        return this._dataStore.diffRoots(rootA, rootB);
      },

      // Find when entity/edge was added/removed
      traceEntity: (entityId) => {
        const history = this._dataStore.getHistory();
        const timeline = [];
        
        for (let i = 0; i < history.length; i++) {
          const root = history[i].root;
          const hasEntity = Array.from(root.getEdges().values())
            .some(edge => edge.src === entityId || edge.dst === entityId);
          
          timeline.push({
            index: i,
            operation: history[i].operation,
            hasEntity,
            timestamp: history[i].timestamp
          });
        }
        
        return timeline;
      },

      // Replay operations from a point
      replay: (fromIndex, operations) => {
        // Store current state
        const originalIndex = this._findCurrentHistoryIndex();
        
        try {
          // Go to starting point
          this.goto(fromIndex);
          
          // Apply operations
          const results = [];
          for (const op of operations) {
            const result = this._dataStore.testOperation(op);
            results.push(result);
            
            if (result.wouldSucceed) {
              // Apply the operation
              switch (op.type) {
                case 'addEdge':
                  this._dataStore.addEdge(op.relationshipType, op.src, op.dst);
                  break;
                case 'removeEdge':
                  this._dataStore.removeEdge(op.relationshipType, op.src, op.dst);
                  break;
              }
            } else {
              break; // Stop on first failure
            }
          }
          
          return results;
          
        } catch (error) {
          // Restore original state on error
          this.goto(originalIndex);
          throw error;
        }
      }
    };
  }

  _findCurrentHistoryIndex() {
    const currentRoot = this._dataStore.getCurrentRoot();
    const history = this._dataStore.getHistory();
    
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].root === currentRoot) {
        return i;
      }
    }
    
    return -1;
  }
}
```

---

## 10) Implementation Roadmap

### 10.1 Phase 1: Core Immutable Infrastructure (2-3 weeks)

**Week 1:**
- Implement `ImmutableStoreRoot` class
- Implement `ImmutableTrieNode` class
- Implement `ImmutableTrieManager` class
- Write comprehensive unit tests

**Week 2:**
- Implement `ImmutableDataStore` class
- Add basic constraint framework (`Constraint`, `ConstraintResult`)
- Add `ConstraintRegistry` and `ConstraintValidator`
- Write integration tests

**Week 3:**
- Add built-in constraint types (`CardinalityConstraint`, `EntityTypeConstraint`)
- Implement `CompatibilityDataStore` wrapper
- Performance optimization pass
- Documentation and examples

### 10.2 Phase 2: Advanced Features (2 weeks)

**Week 4:**
- Entity type schema system
- Schema-driven constraint generation
- Advanced constraint types (`CustomConstraint`)
- Batch operations

**Week 5:**
- Debugging tools (`DataStoreInspector`, `TimeTravelDebugger`)
- History management and optimization
- Performance benchmarking
- Error handling improvements

### 10.3 Phase 3: Production Readiness (1-2 weeks)

**Week 6:**
- Full test coverage (unit + integration + end-to-end)
- Performance optimization based on benchmarks
- Documentation completion
- Migration guides

**Week 7 (Optional):**
- Advanced optimizations (COW improvements, structural sharing)
- Developer tooling enhancements
- Example applications
- Stress testing

### 10.4 Success Criteria

**Functional Requirements:**
- ✅ All existing tests pass with compatibility layer
- ✅ Constraint violations are caught before state changes
- ✅ Time-travel debugging works correctly
- ✅ Performance within 2x of mutable version

**Quality Requirements:**
- ✅ 95%+ test coverage
- ✅ Zero breaking changes for existing code
- ✅ Complete API documentation
- ✅ Migration path clearly documented

**Performance Requirements:**
- ✅ Memory usage < 3x of mutable version
- ✅ Operation latency < 2x of mutable version
- ✅ Constraint validation completes in < 10ms for typical datasets

---

## 11) Conclusion

This design transforms the existing mutable data store into a powerful immutable system with:

### Key Innovations
1. **Zero breaking changes** - existing code continues to work
2. **Atomic operations** - no partial failures or inconsistent states
3. **Safe constraint validation** - test changes without side effects
4. **Amazing debugging** - complete operation history with time travel
5. **High performance** - copy-on-write with structural sharing

### Implementation Strategy
- **Minimal risk** - builds on existing LFTJ data structures
- **Incremental adoption** - compatibility layer enables gradual migration
- **Proven patterns** - copy-on-write is well-understood and optimized
- **Developer-friendly** - rich debugging tools and clear error messages

### Expected Impact
- **Reliability** - constraint validation prevents invalid states
- **Maintainability** - immutable state simplifies reasoning
- **Debuggability** - time-travel debugging accelerates development
- **Flexibility** - custom constraints enable complex business rules

This design provides a solid foundation for building reliable, constraint-validated data stores while preserving the performance characteristics of the existing LFTJ-optimized implementation.

---

**Next Steps:** Review this design, gather feedback, and proceed with Phase 1 implementation starting with `ImmutableStoreRoot` and basic constraint validation framework.