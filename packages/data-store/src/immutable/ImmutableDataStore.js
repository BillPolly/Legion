/**
 * ImmutableDataStore - Main API for immutable data store with constraint validation
 * Per design §5: Public API with integrated constraint validation
 * 
 * High-level interface that orchestrates ImmutableStoreRoot, ConstraintRegistry,
 * and ConstraintValidator to provide a complete data store with validation.
 */

import { ImmutableStoreRoot } from './ImmutableStoreRoot.js';
import { ImmutableTrieManager } from './ImmutableTrieManager.js';
import { ConstraintRegistry } from './constraints/ConstraintRegistry.js';
import { ConstraintValidator } from './constraints/ConstraintValidator.js';
import { Constraint } from './constraints/Constraint.js';
import { ConstraintResult } from './constraints/ConstraintResult.js';
import { ConstraintViolationError } from './ConstraintViolationError.js';
import { Edge } from '../Edge.js';
import { RelationshipType } from '../RelationshipType.js';
import { EntityType } from './schema/EntityType.js';
import { EntityTypeRegistry } from './schema/EntityTypeRegistry.js';
import { SchemaConstraintGenerator } from './schema/SchemaConstraintGenerator.js';

// Use WeakMaps to store additional data since stores are frozen
const storeEntityTypes = new WeakMap();
const storeEventEmitters = new WeakMap();
const storeHistory = new WeakMap();
const storeMetadata = new WeakMap();
const storeEntityTypeRegistry = new WeakMap();
const storeSchemaConfig = new WeakMap();

/**
 * Main immutable data store with integrated constraint validation
 */
export class ImmutableDataStore {
  constructor(config = {}) {
    // Validate configuration
    this._validateConfig(config);
    
    // Initialize components
    this._root = new ImmutableStoreRoot(
      new Map(),           // edges
      new Map(),           // edgesByType  
      new Map(),           // edgesBySource
      new Map(),           // edgesByDestination
      new Map(),           // relationshipTypes
      new ImmutableTrieManager()
    );
    
    this._registry = new ConstraintRegistry();
    this._validator = new ConstraintValidator(this._registry);
    
    // Initialize entity type registry
    const entityTypeRegistry = config.entityTypeRegistry || new EntityTypeRegistry();
    storeEntityTypeRegistry.set(this, entityTypeRegistry);
    
    // Initialize schema configuration
    storeSchemaConfig.set(this, {
      enableSchemaValidation: config.enableSchemaValidation || false,
      generateSchemaConstraints: config.generateSchemaConstraints || false,
      generateAttributeConstraints: config.generateAttributeConstraints || false,
      relationshipSchema: config.relationshipSchema || {}
    });
    
    // Apply initial configuration
    if (config.relationshipTypes) {
      for (const relType of config.relationshipTypes) {
        this._root = this._root.withAddedRelationType(relType);
      }
    }
    
    if (config.constraints) {
      for (const constraint of config.constraints) {
        this._registry = this._registry.withAddedConstraint(constraint);
      }
      this._validator = this._validator.withRegistry(this._registry);
    }
    
    // Generate schema constraints if requested
    if (config.generateSchemaConstraints || config.generateAttributeConstraints) {
      const generator = new SchemaConstraintGenerator(entityTypeRegistry);
      const schemaConstraints = [];
      
      // Generate relationship constraints
      if (config.generateSchemaConstraints && config.relationshipSchema) {
        const relConstraints = generator.generateAllConstraints(config.relationshipSchema);
        schemaConstraints.push(...relConstraints);
      }
      
      // Generate attribute constraints
      if (config.generateAttributeConstraints) {
        const attrConstraints = generator.generateFromRegistry();
        schemaConstraints.push(...attrConstraints);
      }
      
      // Add generated constraints
      for (const constraint of schemaConstraints) {
        this._registry = this._registry.withAddedConstraint(constraint);
      }
      this._validator = this._validator.withRegistry(this._registry);
    }
    
    // Initialize additional data structures
    storeEntityTypes.set(this, {});
    storeEventEmitters.set(this, new EventEmitter(config.inheritEvents !== false));
    storeHistory.set(this, []);
    storeMetadata.set(this, {
      version: this._generateVersion(),
      createdAt: Date.now(),
      lastModified: Date.now(),
      operationCount: 0,
      historyLimit: config.historyLimit || 10
    });
    
    // Make immutable
    Object.freeze(this);
  }

  /**
   * Add an edge with constraint validation
   * Returns new store instance, throws on constraint violation
   */
  addEdge(edge) {
    this._validateEdge(edge);
    
    // Work with a local root variable that can be updated
    let currentRoot = this._root;
    
    // Ensure relationship type exists before adding edge
    if (!currentRoot.hasRelationType(edge.type)) {
      // Auto-create the relationship type
      const relType = new RelationshipType(edge.type, edge.type + '_inverse');
      currentRoot = currentRoot.withAddedRelationType(relType);
    }
    
    // Create validation root with entity metadata support
    const validationRoot = this._createValidationRoot(currentRoot);
    
    // Validate against constraints
    const validationStart = Date.now();
    const validationResult = this._validator.validateEdge(validationRoot, edge);
    
    if (!validationResult.isValid) {
      // Emit constraint violation event
      this._emitEvent('constraintViolation', {
        edge,
        violations: validationResult.violations
      });
      
      const performanceMetrics = {
        validationTime: Date.now() - validationStart,
        constraintsChecked: this._registry.getAllConstraints().length,
        edgesValidated: 1
      };
      
      const error = ConstraintViolationError.fromValidationFailure(
        'addEdge', 
        validationResult.violations, 
        this, 
        edge,
        {
          performanceMetrics,
          validationPath: ['ImmutableDataStore.addEdge', 'ConstraintValidator.validateEdge']
        }
      );
      
      throw error;
    }
    
    // Add edge to root
    const newRoot = currentRoot.withAddedEdge(edge);
    
    // Create new store instance
    const newStore = this._createNewStore(newRoot, this._registry, this._validator);
    
    // Record history and emit event
    this._addToHistory(newStore, {
      operation: 'addEdge',
      edge
    });
    
    this._emitEvent('edgeAdded', {
      edge,
      previousState: this,
      newState: newStore
    });
    
    return newStore;
  }

  /**
   * Remove an edge with constraint validation
   * Returns new store instance, throws on constraint violation
   */
  removeEdge(edge) {
    this._validateEdge(edge);
    
    // Early return if edge doesn't exist
    if (!this._root.hasEdge(edge)) {
      return this; // No change needed
    }
    
    // Create validation root with entity metadata support
    const validationRoot = this._createValidationRoot(this._root);
    
    // Validate removal against constraints (min cardinality)
    const validationStart = Date.now();
    const applicableConstraints = this._registry.getConstraintsForRelation(edge.type);
    
    for (const constraint of applicableConstraints) {
      // Check if constraint has validateRemoval method
      if (typeof constraint.validateRemoval === 'function') {
        const removalResult = constraint.validateRemoval(validationRoot, edge);
        
        if (!removalResult.isValid) {
          const performanceMetrics = {
            validationTime: Date.now() - validationStart,
            constraintsChecked: applicableConstraints.length,
            edgesValidated: 1
          };
          
          const error = ConstraintViolationError.fromValidationFailure(
            'removeEdge', 
            removalResult.violations, 
            this, 
            edge,
            {
              performanceMetrics,
              validationPath: ['ImmutableDataStore.removeEdge', 'CardinalityConstraint.validateRemoval']
            }
          );
          
          throw error;
        }
      }
    }
    
    // Remove edge from root
    const newRoot = this._root.withRemovedEdge(edge);
    
    // Create new store instance
    const newStore = this._createNewStore(newRoot, this._registry, this._validator);
    
    // Record history and emit event
    this._addToHistory(newStore, {
      operation: 'removeEdge',
      edge
    });
    
    this._emitEvent('edgeRemoved', {
      edge,
      previousState: this,
      newState: newStore
    });
    
    return newStore;
  }

  /**
   * Define a relationship type with optional constraints
   * Returns new store instance
   */
  defineRelationType(relationshipType, constraints = []) {
    this._validateRelationshipType(relationshipType);
    
    if (!Array.isArray(constraints)) {
      throw new Error('Constraints must be an array');
    }
    
    // Validate all constraints
    for (const constraint of constraints) {
      if (!(constraint instanceof Constraint)) {
        throw new Error('All constraints must be Constraint instances');
      }
    }
    
    // Early return if type already exists
    if (this._root.hasRelationType(relationshipType.forwardName)) {
      return this; // No change needed
    }
    
    // Add relationship type to root
    const newRoot = this._root.withAddedRelationType(relationshipType);
    
    // Add associated constraints to registry
    let newRegistry = this._registry;
    for (const constraint of constraints) {
      newRegistry = newRegistry.withAddedConstraint(constraint);
    }
    
    // Update validator if registry changed
    const newValidator = newRegistry !== this._registry
      ? this._validator.withRegistry(newRegistry)
      : this._validator;
    
    // Create new store instance
    const newStore = this._createNewStore(newRoot, newRegistry, newValidator);
    
    // Record history and emit event
    this._addToHistory(newStore, {
      operation: 'defineRelationType',
      relationType: relationshipType,
      constraints
    });
    
    this._emitEvent('relationTypeAdded', {
      relationType: relationshipType,
      previousState: this,
      newState: newStore
    });
    
    return newStore;
  }

  /**
   * Add a constraint to the store
   * Returns new store instance
   */
  addConstraint(constraint) {
    if (!constraint) {
      throw ConstraintViolationError.fromParameterValidation('addConstraint', 'Constraint is required', constraint);
    }
    
    if (!(constraint instanceof Constraint)) {
      throw ConstraintViolationError.fromParameterValidation('addConstraint', 'Constraint must be a Constraint instance', constraint);
    }
    
    // Add to registry
    const newRegistry = this._registry.withAddedConstraint(constraint);
    
    // Update validator
    const newValidator = this._validator.withRegistry(newRegistry);
    
    // Create new store instance
    const newStore = this._createNewStore(this._root, newRegistry, newValidator);
    
    // Record history and emit event
    this._addToHistory(newStore, {
      operation: 'addConstraint',
      constraint
    });
    
    this._emitEvent('constraintAdded', {
      constraint,
      previousState: this,
      newState: newStore
    });
    
    return newStore;
  }

  /**
   * Add entity type metadata with optional attributes
   * Returns new store instance
   */
  withEntityType(entityId, type, attributes = null) {
    // Get schema config and registry
    const schemaConfig = storeSchemaConfig.get(this);
    const registry = storeEntityTypeRegistry.get(this);
    
    // Validate attributes against schema if enabled
    if (schemaConfig.enableSchemaValidation && attributes && registry.hasType(type)) {
      const entityType = registry.getType(type);
      const validationResult = entityType.validate(attributes);
      
      if (!validationResult.isValid) {
        throw new Error(`Entity attributes do not match schema for type ${type}: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }
    }
    
    // Get current entity types
    const currentTypes = storeEntityTypes.get(this) || {};
    const newTypes = { 
      ...currentTypes, 
      [entityId]: attributes ? { type, attributes } : type 
    };
    
    // Create new store instance
    const newStore = this._createNewStore(this._root, this._registry, this._validator);
    
    // Set entity types for new store
    storeEntityTypes.set(newStore, newTypes);
    
    return newStore;
  }

  /**
   * Execute multiple operations atomically in a batch
   * All operations are validated before any are applied
   * Returns new store instance or throws if any operation fails
   */
  batch(batchFunction) {
    if (!batchFunction) {
      throw ConstraintViolationError.fromParameterValidation('batch', 'Batch function is required', batchFunction);
    }
    
    if (typeof batchFunction !== 'function') {
      throw ConstraintViolationError.fromParameterValidation('batch', 'Batch function must be a function', batchFunction);
    }
    
    // Create batch context
    const batchContext = new BatchContext(this);
    
    try {
      // Execute batch function
      batchFunction(batchContext);
      
      // Close context to prevent further operations
      batchContext.close();
      
      // Get all operations
      const operations = batchContext.getOperations();
      
      // If no operations, return same instance
      if (operations.length === 0) {
        return this;
      }
      
      // Validate all operations first
      const validationStart = Date.now();
      const validationResult = this._validateBatchOperations(operations);
      
      if (!validationResult.isValid) {
        const performanceMetrics = {
          validationTime: Date.now() - validationStart,
          constraintsChecked: this._registry.getAllConstraints().length,
          edgesValidated: operations.filter(op => op.type === 'addEdge' || op.type === 'removeEdge').length
        };
        
        const error = ConstraintViolationError.fromBatchFailure(
          validationResult.violations, 
          operations,
          this,
          {
            performanceMetrics,
            validationPath: ['ImmutableDataStore.batch', 'ImmutableDataStore._validateBatchOperations']
          }
        );
        
        throw error;
      }
      
      // Apply all operations
      const newStore = this._applyBatchOperations(operations);
      
      // Adjust operation count to reflect individual operations, not just the batch
      const currentMetadata = storeMetadata.get(this);
      const batchMetadata = storeMetadata.get(newStore);
      storeMetadata.set(newStore, {
        ...batchMetadata,
        operationCount: currentMetadata.operationCount + operations.length
      });
      
      // Record history and emit event for batch
      this._addToHistory(newStore, {
        operation: 'batch',
        operationCount: operations.length
      });
      
      this._emitEvent('batchExecuted', {
        operationCount: operations.length,
        previousState: this,
        newState: newStore
      });
      
      return newStore;
      
    } catch (error) {
      // Close context if not already closed
      if (!batchContext.isClosed()) {
        batchContext.close();
      }
      throw error;
    }
  }

  /**
   * Validate the current state against all constraints
   * Returns detailed validation result
   */
  validateCurrentState() {
    const startTime = Date.now();
    const violations = [];
    let edgesValidated = 0;
    let constraintsChecked = 0;
    
    // Get all edges
    const edges = this._root.getEdges();
    
    // Validate each edge against all applicable constraints
    for (const [, edge] of edges) {
      edgesValidated++;
      
      // Get applicable constraints for this edge
      const applicableConstraints = this._registry.getConstraintsForRelation(edge.type);
      
      for (const constraint of applicableConstraints) {
        constraintsChecked++;
        
        // Create validation root with entity metadata
        const validationRoot = this._createValidationRoot(this._root);
        
        // Validate edge with constraint
        const result = constraint.validate(validationRoot, edge);
        
        if (!result.isValid) {
          for (const violation of result.violations) {
            violations.push({
              edge,
              constraintId: constraint.id,
              message: violation.message,
              metadata: violation.metadata
            });
          }
        }
      }
      
      // Also check global constraints
      const globalConstraints = this._registry.getConstraintsForRelation('*');
      for (const constraint of globalConstraints) {
        constraintsChecked++;
        
        const validationRoot = this._createValidationRoot(this._root);
        const result = constraint.validate(validationRoot, edge);
        
        if (!result.isValid) {
          for (const violation of result.violations) {
            violations.push({
              edge,
              constraintId: constraint.id,
              message: violation.message,
              metadata: violation.metadata
            });
          }
        }
      }
    }
    
    const validationTime = Date.now() - startTime;
    
    return {
      isValid: violations.length === 0,
      violations,
      summary: {
        edgesValidated,
        constraintsChecked,
        violationsFound: violations.length,
        validationTime
      }
    };
  }

  /**
   * Test an operation without applying it (dry run)
   * Returns whether operation would succeed and any violations
   */
  testOperation(operationType, operationData) {
    try {
      let simulatedStore = this;
      let simulatedState;
      
      switch (operationType) {
        case 'addEdge':
          simulatedState = this._simulateAddEdge(simulatedStore, operationData);
          break;
          
        case 'removeEdge':
          simulatedState = this._simulateRemoveEdge(simulatedStore, operationData);
          break;
          
        case 'addConstraint':
          simulatedState = this._simulateAddConstraint(simulatedStore, operationData);
          
          // Also validate current state with new constraint
          const tempStore = this._createNewStore(simulatedStore._root, 
            simulatedStore._registry.withAddedConstraint(operationData), 
            simulatedStore._validator.withRegistry(
              simulatedStore._registry.withAddedConstraint(operationData)
            ));
          
          const currentStateValidation = tempStore.validateCurrentState();
          
          return {
            wouldSucceed: true,
            violations: [],
            simulatedState,
            currentStateValidation
          };
          
        case 'defineRelationType':
          const { relType, constraints } = operationData;
          simulatedState = this._simulateDefineRelationType(simulatedStore, relType, constraints);
          break;
          
        case 'removeConstraint':
          simulatedState = this._simulateRemoveConstraint(simulatedStore, operationData);
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }
      
      return {
        wouldSucceed: true,
        violations: [],
        simulatedState
      };
      
    } catch (error) {
      return {
        wouldSucceed: false,
        violations: error.violations || [{
          message: error.message,
          error
        }],
        simulatedState: null
      };
    }
  }

  /**
   * Remove a constraint from the store
   * Returns new store instance
   */
  removeConstraint(constraintId) {
    if (!constraintId) {
      throw ConstraintViolationError.fromParameterValidation('removeConstraint', 'Constraint ID is required', constraintId);
    }
    
    if (typeof constraintId !== 'string') {
      throw ConstraintViolationError.fromParameterValidation('removeConstraint', 'Constraint ID must be a string', constraintId);
    }
    
    // Check if constraint exists
    const existingConstraint = this._registry.getConstraint(constraintId);
    if (!existingConstraint) {
      return this; // No change needed
    }
    
    // Remove from registry
    const newRegistry = this._registry.withRemovedConstraint(constraintId);
    
    // Update validator
    const newValidator = this._validator.withRegistry(newRegistry);
    
    // Create new store instance
    const newStore = this._createNewStore(this._root, newRegistry, newValidator);
    
    // Record history and emit event
    this._addToHistory(newStore, {
      operation: 'removeConstraint',
      constraintId,
      constraint: existingConstraint
    });
    
    this._emitEvent('constraintRemoved', {
      constraintId,
      constraint: existingConstraint,
      previousState: this,
      newState: newStore
    });
    
    return newStore;
  }

  /**
   * Get all constraints
   * Returns immutable array of constraints
   */
  getConstraints() {
    const constraints = [];
    
    // Get all constraints from registry
    const allConstraints = this._registry.getAllConstraints();
    for (const constraint of allConstraints) {
      constraints.push(constraint);
    }
    
    // Return frozen array
    return Object.freeze(constraints);
  }

  /**
   * Validate a batch of operations without applying them (dry run)
   * Returns validation result with details about which operations would succeed/fail
   */
  validateBatch(batchFunction) {
    if (!batchFunction) {
      throw new Error('Batch function is required');
    }
    
    if (typeof batchFunction !== 'function') {
      throw new Error('Batch function must be a function');
    }
    
    // Create batch context
    const batchContext = new BatchContext(this);
    
    try {
      // Execute batch function
      batchFunction(batchContext);
      
      // Close context
      batchContext.close();
      
      // Get all operations
      const operations = batchContext.getOperations();
      
      // Validate and return detailed result
      return this._validateBatchOperations(operations, true);
      
    } catch (error) {
      // Close context if not already closed
      if (!batchContext.isClosed()) {
        batchContext.close();
      }
      
      // Return validation failure for exception
      return {
        isValid: false,
        violations: [{
          message: `Batch function error: ${error.message}`,
          error
        }],
        wouldSucceed: [],
        wouldFail: []
      };
    }
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Check if edge exists
   */
  hasEdge(edge) {
    return this._root.hasEdge(edge);
  }

  /**
   * Get all edges
   */
  getEdges() {
    return this._root.getEdges();
  }

  /**
   * Get edges by source entity
   */
  getEdgesBySource(src) {
    return Object.freeze(Array.from(this._root.getEdgesBySource(src)));
  }

  /**
   * Get edges by destination entity
   */
  getEdgesByDestination(dst) {
    return Object.freeze(Array.from(this._root.getEdgesByDestination(dst)));
  }

  /**
   * Get edges by type
   */
  getEdgesByType(type) {
    return Object.freeze(Array.from(this._root.getEdgesByType(type)));
  }

  /**
   * Get total edge count
   */
  getEdgeCount() {
    return this._root.getEdgeCount();
  }

  /**
   * Check if relationship type exists
   */
  hasRelationType(typeName) {
    return this._root.hasRelationType(typeName);
  }

  /**
   * Get all relationship types
   */
  getRelationshipTypes() {
    return this._root.getRelationshipTypes();
  }

  /**
   * Get constraint by ID
   */
  getConstraint(constraintId) {
    const constraint = this._registry.getConstraint(constraintId);
    return constraint === null ? undefined : constraint;
  }

  /**
   * Get constraints for a specific relation
   */
  getConstraintsForRelation(relationName) {
    return this._registry.getConstraintsForRelation(relationName);
  }

  /**
   * Get total constraint count
   */
  getConstraintCount() {
    return this._registry.getConstraintCount();
  }

  /**
   * Get number of relationship types
   */
  getRelationTypeCount() {
    return this._root.getRelationTypeCount();
  }

  /**
   * Get entity metadata
   */
  getEntityMetadata(entityId) {
    const types = storeEntityTypes.get(this) || {};
    const metadata = types[entityId];
    
    if (!metadata) {
      return undefined;
    }
    
    // Handle both old format (string) and new format (object with type and attributes)
    if (typeof metadata === 'string') {
      return { type: metadata };
    }
    
    return metadata; // Already has { type, attributes }
  }

  /**
   * Get store statistics
   */
  getStatistics() {
    return {
      edgeCount: this._root.getEdgeCount(),
      relationshipTypeCount: this._root.getRelationshipTypes().size,
      constraintCount: this._registry.getConstraintCount(),
      version: this._root.getMetadata().version || Date.now()
    };
  }

  /**
   * String representation
   */
  toString() {
    const stats = this.getStatistics();
    return `ImmutableDataStore(edges: ${stats.edgeCount}, relationshipTypes: ${stats.relationshipTypeCount}, constraints: ${stats.constraintCount})`;
  }

  // === EVENT METHODS ===

  /**
   * Add event listener
   */
  on(eventName, listener) {
    const emitter = storeEventEmitters.get(this);
    emitter.on(eventName, listener);
  }

  /**
   * Remove event listener
   */
  off(eventName, listener) {
    const emitter = storeEventEmitters.get(this);
    emitter.off(eventName, listener);
  }

  /**
   * Add one-time event listener
   */
  once(eventName, listener) {
    const emitter = storeEventEmitters.get(this);
    emitter.once(eventName, listener);
  }

  // === HISTORY METHODS ===

  /**
   * Get operation history
   */
  getHistory() {
    return storeHistory.get(this) || [];
  }

  /**
   * Get history diff between this state and another
   */
  getHistoryDiff(otherStore) {
    const thisEdges = new Set(this._root.getEdges().values());
    const otherEdges = new Set(otherStore._root.getEdges().values());
    
    const edgesAdded = [];
    const edgesRemoved = [];
    
    for (const edge of thisEdges) {
      if (!otherEdges.has(edge)) {
        edgesAdded.push(edge);
      }
    }
    
    for (const edge of otherEdges) {
      if (!thisEdges.has(edge)) {
        edgesRemoved.push(edge);
      }
    }
    
    const thisConstraints = new Set(this.getConstraints());
    const otherConstraints = new Set(otherStore.getConstraints());
    
    const constraintsAdded = [];
    const constraintsRemoved = [];
    
    for (const constraint of thisConstraints) {
      if (!otherConstraints.has(constraint)) {
        constraintsAdded.push(constraint);
      }
    }
    
    for (const constraint of otherConstraints) {
      if (!thisConstraints.has(constraint)) {
        constraintsRemoved.push(constraint);
      }
    }
    
    const thisTypes = new Set(this._root.getRelationshipTypes().values());
    const otherTypes = new Set(otherStore._root.getRelationshipTypes().values());
    
    const relationTypesAdded = [];
    
    for (const relType of thisTypes) {
      if (!otherTypes.has(relType)) {
        relationTypesAdded.push(relType);
      }
    }
    
    return {
      edgesAdded,
      edgesRemoved,
      constraintsAdded,
      constraintsRemoved,
      relationTypesAdded
    };
  }

  /**
   * Get previous state from history
   */
  getPreviousState() {
    const metadata = storeMetadata.get(this);
    return metadata?.previousState || null;
  }

  /**
   * Get state metadata
   */
  getStateMetadata() {
    const metadata = storeMetadata.get(this);
    const stats = this.getStatistics();
    
    return {
      version: metadata.version,
      createdAt: metadata.createdAt,
      lastModified: metadata.lastModified,
      operationCount: metadata.operationCount,
      edgeCount: stats.edgeCount,
      constraintCount: stats.constraintCount,
      relationTypeCount: stats.relationshipTypeCount
    };
  }

  /**
   * Get state fingerprint for comparison
   */
  getStateFingerprint() {
    // Create a deterministic string representation of the state
    const edges = Array.from(this._root.getEdges().values())
      .map(e => `${e.type}:${e.src}:${e.dst}`)
      .sort()
      .join('|');
    
    const constraints = this.getConstraints()
      .map(c => `${c.id}:${c.relationName}`)
      .sort()
      .join('|');
    
    const relationTypes = Array.from(this._root.getRelationshipTypes().values())
      .map(rt => `${rt.forwardName}:${rt.backwardName}`)
      .sort()
      .join('|');
    
    const stateString = `edges:${edges}|constraints:${constraints}|types:${relationTypes}`;
    
    // Simple hash function (for demo - in production would use crypto.createHash)
    return this._simpleHash(stateString);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const metadata = storeMetadata.get(this);
    const history = this.getHistory();
    
    let totalValidationTime = 0;
    let totalOperationTime = 0;
    
    for (const entry of history) {
      if (entry.validationTime) {
        totalValidationTime += entry.validationTime;
      }
      if (entry.operationTime) {
        totalOperationTime += entry.operationTime;
      }
    }
    
    return {
      totalOperations: metadata.operationCount,
      lastOperationTime: metadata.lastModified,
      averageOperationTime: history.length > 0 ? totalOperationTime / history.length : 0,
      totalValidationTime
    };
  }

  // === SCHEMA METHODS ===
  
  /**
   * Get the entity type registry
   */
  getEntityTypeRegistry() {
    return storeEntityTypeRegistry.get(this);
  }
  
  /**
   * Register an entity type
   */
  registerEntityType(entityType) {
    if (!(entityType instanceof EntityType)) {
      throw new Error('Entity type must be an EntityType instance');
    }
    
    const currentRegistry = storeEntityTypeRegistry.get(this);
    const newRegistry = currentRegistry.registerType(entityType);
    
    // Create new store with updated registry
    const newStore = this._createNewStore(this._root, this._registry, this._validator);
    
    // Copy all WeakMap data
    this._copyWeakMapData(this, newStore);
    
    // Update registry
    storeEntityTypeRegistry.set(newStore, newRegistry);
    
    return newStore;
  }
  
  /**
   * Register multiple entity types
   */
  registerEntityTypes(entityTypes) {
    if (!Array.isArray(entityTypes)) {
      throw new Error('Entity types must be an array');
    }
    
    const currentRegistry = storeEntityTypeRegistry.get(this);
    const newRegistry = currentRegistry.registerBatch(entityTypes);
    
    // Create new store with updated registry
    const newStore = this._createNewStore(this._root, this._registry, this._validator);
    
    // Copy all WeakMap data
    this._copyWeakMapData(this, newStore);
    
    // Update registry
    storeEntityTypeRegistry.set(newStore, newRegistry);
    
    return newStore;
  }
  
  /**
   * Unregister an entity type
   */
  unregisterEntityType(typeName) {
    const currentRegistry = storeEntityTypeRegistry.get(this);
    const newRegistry = currentRegistry.unregisterType(typeName);
    
    if (newRegistry === currentRegistry) {
      return this; // No change
    }
    
    // Create new store with updated registry
    const newStore = this._createNewStore(this._root, this._registry, this._validator);
    
    // Copy all WeakMap data
    this._copyWeakMapData(this, newStore);
    
    // Update registry
    storeEntityTypeRegistry.set(newStore, newRegistry);
    
    return newStore;
  }
  
  /**
   * Check if an entity type exists
   */
  hasEntityType(typeName) {
    const registry = storeEntityTypeRegistry.get(this);
    return registry.hasType(typeName);
  }
  
  /**
   * Get an entity type by name
   */
  getEntityType(typeName) {
    const registry = storeEntityTypeRegistry.get(this);
    return registry.getType(typeName);
  }
  
  /**
   * Get all entity types
   */
  getAllEntityTypes() {
    const registry = storeEntityTypeRegistry.get(this);
    return registry.getAllTypes();
  }
  
  /**
   * Get all entity type names
   */
  getEntityTypeNames() {
    const registry = storeEntityTypeRegistry.get(this);
    return registry.getTypeNames().sort();
  }
  
  /**
   * Validate entity against schema
   */
  validateEntityAgainstSchema(typeName, entity) {
    const registry = storeEntityTypeRegistry.get(this);
    return registry.validateEntity(typeName, entity);
  }
  
  /**
   * Enable schema validation
   */
  enableSchemaValidation() {
    const currentConfig = storeSchemaConfig.get(this);
    const newConfig = { ...currentConfig, enableSchemaValidation: true };
    
    // Create new store
    const newStore = this._createNewStore(this._root, this._registry, this._validator);
    
    // Copy all WeakMap data
    this._copyWeakMapData(this, newStore);
    
    // Update config
    storeSchemaConfig.set(newStore, newConfig);
    
    return newStore;
  }
  
  /**
   * Disable schema validation
   */
  disableSchemaValidation() {
    const currentConfig = storeSchemaConfig.get(this);
    const newConfig = { ...currentConfig, enableSchemaValidation: false };
    
    // Create new store
    const newStore = this._createNewStore(this._root, this._registry, this._validator);
    
    // Copy all WeakMap data
    this._copyWeakMapData(this, newStore);
    
    // Update config
    storeSchemaConfig.set(newStore, newConfig);
    
    return newStore;
  }
  
  /**
   * Get schema report
   */
  getSchemaReport() {
    const registry = storeEntityTypeRegistry.get(this);
    const schemaConfig = storeSchemaConfig.get(this);
    const entityTypes = registry.getAllTypes();
    
    return {
      entityTypes: entityTypes.map(t => t.toJSON()),
      relationships: schemaConfig.relationshipSchema,
      statistics: {
        totalEntityTypes: entityTypes.length,
        totalRelationships: Object.keys(schemaConfig.relationshipSchema).length,
        schemaValidationEnabled: schemaConfig.enableSchemaValidation,
        schemaConstraintsGenerated: schemaConfig.generateSchemaConstraints,
        attributeConstraintsGenerated: schemaConfig.generateAttributeConstraints
      }
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Validate configuration object
   */
  _validateConfig(config) {
    if (config.constraints && !Array.isArray(config.constraints)) {
      throw new Error('Constraints must be an array');
    }
    
    if (config.relationshipTypes && !Array.isArray(config.relationshipTypes)) {
      throw new Error('Relationship types must be an array');
    }
    
    if (config.constraints) {
      for (const constraint of config.constraints) {
        if (!(constraint instanceof Constraint)) {
          throw new Error('All constraints must be Constraint instances');
        }
      }
    }
    
    if (config.relationshipTypes) {
      for (const relType of config.relationshipTypes) {
        if (!(relType instanceof RelationshipType)) {
          throw new Error('All relationship types must be RelationshipType instances');
        }
      }
    }
  }

  /**
   * Validate edge parameter
   */
  _validateEdge(edge) {
    if (!edge) {
      throw ConstraintViolationError.fromParameterValidation('validateEdge', 'Edge is required', edge);
    }
    if (!(edge instanceof Edge)) {
      throw ConstraintViolationError.fromParameterValidation('validateEdge', 'Edge must be an Edge instance', edge);
    }
  }

  /**
   * Validate relationship type parameter
   */
  _validateRelationshipType(relationshipType) {
    if (!relationshipType) {
      throw ConstraintViolationError.fromParameterValidation('validateRelationshipType', 'RelationshipType is required', relationshipType);
    }
    if (!(relationshipType instanceof RelationshipType)) {
      throw ConstraintViolationError.fromParameterValidation('validateRelationshipType', 'RelationshipType must be a RelationshipType instance', relationshipType);
    }
  }

  /**
   * Emit an event
   */
  _emitEvent(eventName, eventData) {
    const emitter = storeEventEmitters.get(this);
    emitter.emit(eventName, {
      type: eventName,
      timestamp: Date.now(),
      ...eventData
    });
  }

  /**
   * Add operation to history
   */
  _addToHistory(newStore, historyEntry) {
    const currentHistory = storeHistory.get(this) || [];
    const metadata = storeMetadata.get(this);
    
    const entry = {
      timestamp: Date.now(),
      stateVersion: storeMetadata.get(newStore)?.version,
      ...historyEntry
    };
    
    const newHistory = [...currentHistory, entry];
    
    // Limit history size
    const limit = metadata.historyLimit || 10;
    if (newHistory.length > limit) {
      newHistory.splice(0, newHistory.length - limit);
    }
    
    storeHistory.set(newStore, newHistory);
  }

  /**
   * Generate unique version identifier
   */
  _generateVersion() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }

  /**
   * Simple hash function for fingerprinting
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to positive hex string and pad to 64 characters
    const hexHash = Math.abs(hash).toString(16);
    return hexHash.padStart(64, '0');
  }

  /**
   * Copy WeakMap data from one store to another
   */
  _copyWeakMapData(fromStore, toStore) {
    // Copy entity types
    const entityTypes = storeEntityTypes.get(fromStore);
    if (entityTypes) {
      storeEntityTypes.set(toStore, entityTypes);
    }
    
    // Copy entity type registry
    const registry = storeEntityTypeRegistry.get(fromStore);
    if (registry) {
      storeEntityTypeRegistry.set(toStore, registry);
    }
    
    // Copy schema config
    const schemaConfig = storeSchemaConfig.get(fromStore);
    if (schemaConfig) {
      storeSchemaConfig.set(toStore, schemaConfig);
    }
    
    // Copy event emitters
    const emitter = storeEventEmitters.get(fromStore);
    if (emitter) {
      storeEventEmitters.set(toStore, emitter);
    }
    
    // Copy history
    const history = storeHistory.get(fromStore);
    if (history) {
      storeHistory.set(toStore, history);
    }
    
    // Copy metadata
    const metadata = storeMetadata.get(fromStore);
    if (metadata) {
      storeMetadata.set(toStore, metadata);
    }
  }

  /**
   * Create new store instance with updated components
   */
  _createNewStore(newRoot, newRegistry, newValidator) {
    const newStore = Object.create(ImmutableDataStore.prototype);
    
    newStore._root = newRoot;
    newStore._registry = newRegistry;
    newStore._validator = newValidator;
    
    // Preserve entity types
    const currentTypes = storeEntityTypes.get(this) || {};
    storeEntityTypes.set(newStore, currentTypes);
    
    // Preserve entity type registry
    const currentRegistry = storeEntityTypeRegistry.get(this);
    if (currentRegistry) {
      storeEntityTypeRegistry.set(newStore, currentRegistry);
    }
    
    // Preserve schema config
    const currentSchemaConfig = storeSchemaConfig.get(this);
    if (currentSchemaConfig) {
      storeSchemaConfig.set(newStore, currentSchemaConfig);
    }
    
    // Set up event emitter with inheritance
    const currentEmitter = storeEventEmitters.get(this);
    const newEmitter = new EventEmitter(currentEmitter._inheritEvents);
    newEmitter.inherit(currentEmitter);
    storeEventEmitters.set(newStore, newEmitter);
    
    // Initialize history (will be populated by _addToHistory)
    storeHistory.set(newStore, storeHistory.get(this) || []);
    
    // Update metadata
    const currentMetadata = storeMetadata.get(this);
    storeMetadata.set(newStore, {
      ...currentMetadata,
      version: this._generateVersion(),
      lastModified: Date.now(),
      operationCount: currentMetadata.operationCount + 1,
      previousState: this
    });
    
    // Make immutable
    Object.freeze(newStore);
    
    return newStore;
  }

  /**
   * Create a validation root that includes entity metadata
   */
  _createValidationRoot(root) {
    // Create a wrapper object that delegates to root but adds entity metadata
    const entityTypes = storeEntityTypes.get(this) || {};
    const entityTypeRegistry = storeEntityTypeRegistry.get(this);
    
    // Need to pass root as parameter, not use this._root
    const validationRoot = Object.create(root);
    validationRoot.getEntityMetadata = function(entityId) {
      const metadata = entityTypes[entityId];
      if (!metadata) {
        return undefined;
      }
      // Handle both old format (string) and new format (object with type and attributes)
      if (typeof metadata === 'string') {
        return { type: metadata };
      }
      return metadata; // Already has { type, attributes }
    };
    
    // Add entity type registry access for inheritance checks
    validationRoot.getEntityTypeRegistry = function() {
      return entityTypeRegistry;
    };
    
    return validationRoot;
  }

  /**
   * Validate all batch operations by checking final state
   */
  _validateBatchOperations(operations, detailed = false) {
    const violations = [];
    const wouldSucceed = [];
    const wouldFail = [];
    
    // Apply all operations without constraint validation to get final state
    let finalStore = this;
    try {
      for (const op of operations) {
        switch (op.type) {
          case 'addEdge':
            finalStore = this._addEdgeWithoutValidation(finalStore, op.edge);
            break;
            
          case 'removeEdge':
            finalStore = this._removeEdgeWithoutValidation(finalStore, op.edge);
            break;
            
          case 'addConstraint':
            finalStore = finalStore.addConstraint(op.constraint);
            break;
            
          case 'defineRelationType':
            finalStore = finalStore.defineRelationType(op.relationType, op.constraints || []);
            break;
            
          case 'withEntityType':
            finalStore = finalStore.withEntityType(op.entityId, op.entityType, op.attributes);
            break;
            
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      }
    } catch (error) {
      // Non-constraint errors (like invalid parameters) still fail immediately
      violations.push({
        operationIndex: operations.findIndex(o => o === op),
        operation: op,
        error: error.message
      });
      
      return {
        isValid: false,
        violations,
        wouldSucceed: [],
        wouldFail: operations.map((_, i) => i)
      };
    }
    
    // Validate the final state against all constraints properly
    // Note: We can't use validateCurrentState() because it has false positives
    // (validates existing edges as if they're being added)
    // Instead, validate the final state by checking global constraints
    
    const finalConstraints = finalStore._registry.getAllConstraints();
    
    for (const constraint of finalConstraints) {
      // Check if this is a cardinality constraint
      if (constraint.constructor.name === 'CardinalityConstraint') {
        // For cardinality constraints, check all entities in the final state
        const finalEdges = finalStore._root.getEdges();
        const entityCounts = new Map();
        
        // Count relationships per entity for this constraint's type and direction
        for (const [, edge] of finalEdges) {
          if (edge.type === constraint.relationName) {
            const entityId = constraint._direction === 'source' ? edge.src : edge.dst;
            entityCounts.set(entityId, (entityCounts.get(entityId) || 0) + 1);
          }
        }
        
        // Check each entity's count against the constraint
        for (const [entityId, count] of entityCounts) {
          if (constraint._min !== null && count < constraint._min) {
            violations.push({
              operationIndex: -1,
              operation: { type: 'batch', operations },
              error: `Entity "${entityId}" has ${count} relationships but requires at least ${constraint._min}`,
              constraintViolations: []
            });
          }
          if (constraint._max !== null && count > constraint._max) {
            violations.push({
              operationIndex: -1,
              operation: { type: 'batch', operations },
              error: `Entity "${entityId}" has ${count} relationships but allows at most ${constraint._max}`,
              constraintViolations: []
            });
          }
        }
        
        // Check for entities that have zero relationships but minimum constraint > 0
        if (constraint._min !== null && constraint._min > 0) {
          // Find all entities that appear in operations but aren't in final counts
          const entitiesInOperations = new Set();
          for (const op of operations) {
            if (op.type === 'addEdge' || op.type === 'removeEdge') {
              const entityId = constraint._direction === 'source' ? op.edge.src : op.edge.dst;
              if (finalStore._root.getEdgesByType(constraint.relationName).size > 0 || entityCounts.has(entityId)) {
                entitiesInOperations.add(entityId);
              }
            }
          }
          
          // Check if any entity ended up with 0 relationships but needs minimum
          for (const entityId of entitiesInOperations) {
            if (!entityCounts.has(entityId) || entityCounts.get(entityId) === 0) {
              violations.push({
                operationIndex: -1,
                operation: { type: 'batch', operations },
                error: `Entity "${entityId}" has 0 relationships but requires at least ${constraint._min}`,
                constraintViolations: []
              });
            }
          }
        }
      } else if (constraint.constructor.name === 'EntityTypeConstraint') {
        // For entity type constraints, validate each edge in the final state
        const finalEdges = finalStore._root.getEdges();
        const requiredTypes = constraint.getEntityTypes();
        
        for (const [, edge] of finalEdges) {
          if (edge.type === constraint.relationName) {
            // Check source type if specified
            if (requiredTypes.source) {
              const sourceMetadata = finalStore.getEntityMetadata(edge.src);
              if (sourceMetadata?.type !== requiredTypes.source) {
                violations.push({
                  operationIndex: -1,
                  operation: { type: 'batch', operations },
                  error: `Entity "${edge.src}" has type "${sourceMetadata?.type}" but constraint requires "${requiredTypes.source}" for source`,
                  constraintViolations: []
                });
              }
            }
            
            // Check target type if specified
            if (requiredTypes.target) {
              const targetMetadata = finalStore.getEntityMetadata(edge.dst);
              if (targetMetadata?.type !== requiredTypes.target) {
                violations.push({
                  operationIndex: -1,
                  operation: { type: 'batch', operations },
                  error: `Entity "${edge.dst}" has type "${targetMetadata?.type}" but constraint requires "${requiredTypes.target}" for target`,
                  constraintViolations: []
                });
              }
            }
          }
        }
      } else if (constraint.constructor.name === 'CustomConstraint') {
        // For custom constraints, validate each edge in the final state
        const finalEdges = finalStore._root.getEdges();
        
        for (const [, edge] of finalEdges) {
          if (edge.type === constraint.relationName) {
            const validationRoot = finalStore._createValidationRoot(finalStore._root);
            const result = constraint.validate(validationRoot, edge);
            
            if (!result.isValid) {
              violations.push({
                operationIndex: -1,
                operation: { type: 'batch', operations },
                error: `Custom constraint ${constraint.id} violated: ${result.violations[0]?.message}`,
                constraintViolations: result.violations
              });
            }
          }
        }
      }
      // Could add more constraint types here as needed
    }
    
    // For detailed mode, provide operation-level analysis
    if (detailed) {
      if (violations.length === 0) {
        // All operations succeed together
        wouldSucceed = operations.map((_, i) => i);
      } else {
        // For dry-run analysis, test each operation sequentially
        let sequentialStore = this;
        
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          try {
            // Try to apply this operation to the current sequential state
            switch (op.type) {
              case 'addEdge':
                sequentialStore = sequentialStore.addEdge(op.edge);
                wouldSucceed.push(i);
                break;
              case 'removeEdge':
                sequentialStore = sequentialStore.removeEdge(op.edge);
                wouldSucceed.push(i);
                break;
              case 'withEntityType':
                sequentialStore = sequentialStore.withEntityType(op.entityId, op.entityType, op.attributes);
                wouldSucceed.push(i);
                break;
              case 'addConstraint':
                sequentialStore = sequentialStore.addConstraint(op.constraint);
                wouldSucceed.push(i);
                break;
              case 'defineRelationType':
                sequentialStore = sequentialStore.defineRelationType(op.relationType, op.constraints || []);
                wouldSucceed.push(i);
                break;
              default:
                wouldFail.push(i);
            }
          } catch (error) {
            // This operation would fail when applied sequentially
            wouldFail.push(i);
            // Don't continue applying subsequent operations after a failure
            for (let j = i + 1; j < operations.length; j++) {
              wouldFail.push(j);
            }
            break;
          }
        }
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      wouldSucceed,
      wouldFail
    };
  }

  /**
   * Apply all batch operations to create new store WITHOUT validation
   * This is used after we've already validated the final state will be valid
   */
  _applyBatchOperations(operations) {
    let currentStore = this;
    
    for (const op of operations) {
      switch (op.type) {
        case 'addEdge':
          // Use low-level operation that doesn't validate constraints
          currentStore = this._addEdgeWithoutValidation(currentStore, op.edge);
          break;
          
        case 'removeEdge':
          // Use low-level operation that doesn't validate constraints
          currentStore = this._removeEdgeWithoutValidation(currentStore, op.edge);
          break;
          
        case 'addConstraint':
          currentStore = currentStore.addConstraint(op.constraint);
          break;
          
        case 'defineRelationType':
          currentStore = currentStore.defineRelationType(op.relationType, op.constraints || []);
          break;
          
        case 'withEntityType':
          currentStore = currentStore.withEntityType(op.entityId, op.entityType, op.attributes);
          break;
          
        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    }
    
    return currentStore;
  }
  
  /**
   * Add edge without constraint validation (for batch operations)
   */
  _addEdgeWithoutValidation(store, edge) {
    // Validate edge parameter
    this._validateEdge(edge);
    
    // Check if relationship type exists, add if not
    let currentRoot = store._root;
    if (!currentRoot.hasRelationType(edge.type)) {
      const relType = new RelationshipType(edge.type, edge.type + '_inverse');
      currentRoot = currentRoot.withAddedRelationType(relType);
    }
    
    // Add edge using low-level operation (no constraint validation)
    const newRoot = currentRoot.withAddedEdge(edge);
    
    // Create new store instance, preserving entity types from the source store
    const newStore = this._createNewStore(newRoot, store._registry, store._validator);
    // Copy entity types from the source store instead of this
    const currentTypes = storeEntityTypes.get(store) || {};
    storeEntityTypes.set(newStore, currentTypes);
    return newStore;
  }
  
  /**
   * Remove edge without constraint validation (for batch operations)
   */
  _removeEdgeWithoutValidation(store, edge) {
    // Validate edge parameter
    this._validateEdge(edge);
    
    // Early return if edge doesn't exist
    if (!store._root.hasEdge(edge)) {
      return store;
    }
    
    // Remove edge using low-level operation (no constraint validation)
    const newRoot = store._root.withRemovedEdge(edge);
    
    // Create new store instance, preserving entity types from the source store
    const newStore = this._createNewStore(newRoot, store._registry, store._validator);
    // Copy entity types from the source store instead of this
    const currentTypes = storeEntityTypes.get(store) || {};
    storeEntityTypes.set(newStore, currentTypes);
    return newStore;
  }

  // Simulation methods for validation
  _simulateAddEdge(store, edge) {
    // Similar to addEdge but using the provided store
    let currentRoot = store._root;
    
    if (!currentRoot.hasRelationType(edge.type)) {
      const relType = new RelationshipType(edge.type, edge.type + '_inverse');
      currentRoot = currentRoot.withAddedRelationType(relType);
    }
    
    const validationRoot = this._createValidationRootForStore(store, currentRoot);
    const validationResult = store._validator.validateEdge(validationRoot, edge);
    
    if (!validationResult.isValid) {
      const error = new Error('Constraint validation failed');
      error.violations = validationResult.violations;
      throw error;
    }
    
    const newRoot = currentRoot.withAddedEdge(edge);
    return this._createNewStore(newRoot, store._registry, store._validator);
  }

  _simulateRemoveEdge(store, edge) {
    if (!store._root.hasEdge(edge)) {
      return store;
    }
    
    const validationRoot = this._createValidationRootForStore(store, store._root);
    const applicableConstraints = store._registry.getConstraintsForRelation(edge.type);
    
    for (const constraint of applicableConstraints) {
      if (typeof constraint.validateRemoval === 'function') {
        const removalResult = constraint.validateRemoval(validationRoot, edge);
        
        if (!removalResult.isValid) {
          const error = new Error('Constraint validation failed');
          error.violations = removalResult.violations;
          throw error;
        }
      }
    }
    
    const newRoot = store._root.withRemovedEdge(edge);
    return this._createNewStore(newRoot, store._registry, store._validator);
  }

  _simulateAddConstraint(store, constraint) {
    const newRegistry = store._registry.withAddedConstraint(constraint);
    const newValidator = store._validator.withRegistry(newRegistry);
    return this._createNewStore(store._root, newRegistry, newValidator);
  }

  _simulateDefineRelationType(store, relationType, constraints = []) {
    if (store._root.hasRelationType(relationType.forwardName)) {
      return store;
    }
    
    const newRoot = store._root.withAddedRelationType(relationType);
    
    let newRegistry = store._registry;
    for (const constraint of constraints) {
      newRegistry = newRegistry.withAddedConstraint(constraint);
    }
    
    const newValidator = newRegistry !== store._registry
      ? store._validator.withRegistry(newRegistry)
      : store._validator;
    
    return this._createNewStore(newRoot, newRegistry, newValidator);
  }

  _simulateWithEntityType(store, entityId, type, attributes = null) {
    const currentTypes = storeEntityTypes.get(store) || {};
    const newTypes = { 
      ...currentTypes, 
      [entityId]: attributes ? { type, attributes } : type 
    };
    
    const newStore = this._createNewStore(store._root, store._registry, store._validator);
    storeEntityTypes.set(newStore, newTypes);
    
    return newStore;
  }

  _simulateAddEdgeWithoutValidation(store, edge) {
    // Add edge without constraint validation
    let currentRoot = store._root;
    
    if (!currentRoot.hasRelationType(edge.type)) {
      const relType = new RelationshipType(edge.type, edge.type + '_inverse');
      currentRoot = currentRoot.withAddedRelationType(relType);
    }
    
    const newRoot = currentRoot.withAddedEdge(edge);
    return this._createNewStore(newRoot, store._registry, store._validator);
  }

  _simulateRemoveEdgeWithoutValidation(store, edge) {
    // Remove edge without constraint validation
    if (!store._root.hasEdge(edge)) {
      return store;
    }
    
    const newRoot = store._root.withRemovedEdge(edge);
    return this._createNewStore(newRoot, store._registry, store._validator);
  }

  _simulateRemoveConstraint(store, constraintId) {
    if (!store._registry.getConstraint(constraintId)) {
      return store;
    }
    
    const newRegistry = store._registry.withRemovedConstraint(constraintId);
    const newValidator = store._validator.withRegistry(newRegistry);
    return this._createNewStore(store._root, newRegistry, newValidator);
  }

  _createValidationRootForStore(store, root) {
    const entityTypes = storeEntityTypes.get(store) || {};
    const entityTypeRegistry = storeEntityTypeRegistry.get(store);
    
    const validationRoot = Object.create(root);
    validationRoot.getEntityMetadata = function(entityId) {
      const metadata = entityTypes[entityId];
      if (!metadata) {
        return undefined;
      }
      // Handle both old format (string) and new format (object with type and attributes)
      if (typeof metadata === 'string') {
        return { type: metadata };
      }
      return metadata; // Already has { type, attributes }
    };
    
    // Add entity type registry access for inheritance checks
    validationRoot.getEntityTypeRegistry = function() {
      return entityTypeRegistry;
    };
    
    return validationRoot;
  }
}

/**
 * BatchContext - Provides batch operation interface
 */
class BatchContext {
  constructor(store) {
    this._store = store;
    this._operations = [];
    this._closed = false;
    this._currentState = store;
  }

  addEdge(edge) {
    this._checkClosed();
    this._operations.push({ type: 'addEdge', edge });
    // Don't actually apply operations yet for proper atomicity
  }

  removeEdge(edge) {
    this._checkClosed();
    this._operations.push({ type: 'removeEdge', edge });
  }

  addConstraint(constraint) {
    this._checkClosed();
    this._operations.push({ type: 'addConstraint', constraint });
  }

  defineRelationType(relationType, constraints) {
    this._checkClosed();
    this._operations.push({ type: 'defineRelationType', relationType, constraints });
  }

  withEntityType(entityId, type, attributes = null) {
    this._checkClosed();
    this._operations.push({ type: 'withEntityType', entityId, entityType: type, attributes });
  }

  batch(nestedBatchFunction) {
    this._checkClosed();
    // Create nested context
    const nestedContext = new BatchContext(this._currentState);
    nestedBatchFunction(nestedContext);
    nestedContext.close();
    
    // Add nested operations to this context
    const nestedOps = nestedContext.getOperations();
    for (const op of nestedOps) {
      this._operations.push(op);
    }
  }

  getCurrentState() {
    // Apply operations up to this point to get current state
    let state = this._store;
    
    for (const op of this._operations) {
      try {
        switch (op.type) {
          case 'addEdge':
            state = state.addEdge(op.edge);
            break;
          case 'removeEdge':
            state = state.removeEdge(op.edge);
            break;
          case 'addConstraint':
            state = state.addConstraint(op.constraint);
            break;
          case 'defineRelationType':
            state = state.defineRelationType(op.relationType, op.constraints || []);
            break;
          case 'withEntityType':
            state = this._simulateWithEntityType(state, op.entityId, op.entityType, op.attributes);
            break;
        }
      } catch (error) {
        // If operation fails during simulation, return current state
        break;
      }
    }
    
    return state;
  }

  getOperations() {
    return this._operations;
  }

  close() {
    this._closed = true;
  }

  isClosed() {
    return this._closed;
  }

  _checkClosed() {
    if (this._closed) {
      throw new Error('Batch context has been closed');
    }
  }
}

/**
 * EventEmitter - Simple event emitter for store events
 */
class EventEmitter {
  constructor(inheritEvents = true) {
    this._listeners = new Map();
    this._inheritEvents = inheritEvents;
  }

  on(eventName, listener) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }
    this._listeners.get(eventName).push(listener);
  }

  off(eventName, listener) {
    if (!this._listeners.has(eventName)) return;
    
    const listeners = this._listeners.get(eventName);
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  once(eventName, listener) {
    const onceListener = (...args) => {
      this.off(eventName, onceListener);
      listener(...args);
    };
    this.on(eventName, onceListener);
  }

  emit(eventName, eventData) {
    if (!this._listeners.has(eventName)) return;
    
    const listeners = this._listeners.get(eventName);
    for (const listener of listeners) {
      try {
        listener(eventData);
      } catch (error) {
        // Emit error event for failed listeners
        this.emit('listenerError', {
          type: 'listenerError',
          originalEvent: eventName,
          error,
          timestamp: Date.now()
        });
      }
    }
  }

  inherit(parentEmitter) {
    if (!this._inheritEvents || !parentEmitter) return;
    
    for (const [eventName, listeners] of parentEmitter._listeners) {
      for (const listener of listeners) {
        this.on(eventName, listener);
      }
    }
  }
}

// Extend ImmutableStoreRoot prototype to support entity metadata
// This allows the constraint validator to access entity types
ImmutableStoreRoot.prototype.getEntityMetadata = function(entityId) {
  // This will be overridden by ImmutableDataStore
  return undefined;
};