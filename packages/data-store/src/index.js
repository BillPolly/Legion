/**
 * @legion/data-store
 * 
 * Immutable Data Store with Constraint Validation
 * Provides immutable binary relationship storage with comprehensive validation
 */

// Shared Core Classes (used by immutable implementation)
export { Edge } from './Edge.js';
export { Attribute } from './Attribute.js';
export { RelationshipType } from './RelationshipType.js';

// Immutable Data Store (MVP Implementation)
import { ImmutableDataStore } from './immutable/ImmutableDataStore.js';
export { ImmutableDataStore };
export { ImmutableStoreRoot } from './immutable/ImmutableStoreRoot.js';
export { ImmutableTrieManager } from './immutable/ImmutableTrieManager.js';
export { ImmutableTrieNode } from './immutable/ImmutableTrieNode.js';
export { ImmutableOutTrie } from './immutable/ImmutableOutTrie.js';
export { ImmutableInTrie } from './immutable/ImmutableInTrie.js';

// Constraint System
export { Constraint } from './immutable/constraints/Constraint.js';
export { ConstraintResult } from './immutable/constraints/ConstraintResult.js';
export { ConstraintViolation } from './immutable/constraints/ConstraintViolation.js';
export { ConstraintRegistry } from './immutable/constraints/ConstraintRegistry.js';
export { ConstraintValidator } from './immutable/constraints/ConstraintValidator.js';
export { CardinalityConstraint } from './immutable/constraints/CardinalityConstraint.js';
export { EntityTypeConstraint } from './immutable/constraints/EntityTypeConstraint.js';
export { CustomConstraint } from './immutable/constraints/CustomConstraint.js';

// Entity Schema System
export { EntityType } from './immutable/schema/EntityType.js';
export { EntityTypeRegistry } from './immutable/schema/EntityTypeRegistry.js';
export { SchemaConstraintGenerator } from './immutable/schema/SchemaConstraintGenerator.js';

// Error Types
export { ConstraintViolationError } from './immutable/ConstraintViolationError.js';

// Default export - Main Data Store
export default ImmutableDataStore;

// Named export for convenience
export const createDataStore = () => new ImmutableDataStore();