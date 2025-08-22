/**
 * ConstraintValidator - Orchestrates constraint validation on edges
 * Per design §4.5: Validation engine for constraint system
 * 
 * Immutable validator that coordinates constraint execution and aggregates results.
 * Provides both single edge and batch validation with selective constraint execution.
 */

import { ConstraintRegistry } from './ConstraintRegistry.js';
import { ConstraintResult } from './ConstraintResult.js';
import { Edge } from '../../Edge.js';

/**
 * Immutable constraint validation engine
 * Orchestrates validation across registered constraints
 */
export class ConstraintValidator {
  constructor(registry) {
    // If no registry provided, create empty one
    if (registry === undefined) {
      this._registry = new ConstraintRegistry();
    } else {
      // Validate registry parameter - null is not allowed
      if (registry === null || !(registry instanceof ConstraintRegistry)) {
        throw new Error('Registry must be a ConstraintRegistry instance');
      }
      this._registry = registry;
    }
    
    // Track execution order for debugging
    this._executionOrder = [];
    
    // Make completely immutable
    Object.freeze(this);
  }

  // === PURE FUNCTIONAL INTERFACE ===

  /**
   * Return new validator with different registry (pure function)
   */
  withRegistry(registry) {
    // Validate input
    if (!(registry instanceof ConstraintRegistry)) {
      throw new Error('Registry must be a ConstraintRegistry instance');
    }

    // Optimization: return same instance if registry unchanged
    if (registry === this._registry) {
      return this;
    }

    // Return new validator instance
    return new ConstraintValidator(registry);
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Get the constraint registry
   */
  getRegistry() {
    return this._registry;
  }

  // === VALIDATION METHODS ===

  /**
   * Validate single edge against all applicable constraints
   */
  validateEdge(storeRoot, edge) {
    // Validate parameters
    this._validateEdgeParameters(storeRoot, edge);

    // Get applicable constraints from registry and execute them
    let results;
    try {
      results = this._registry.validateEdge(storeRoot, edge);
    } catch (error) {
      // Wrap constraint execution errors
      if (error.message.includes('Constraint execution error')) {
        throw new Error(`Constraint execution failed: ${error.message}`);
      }
      throw error;
    }
    
    // Track execution order
    const executionOrder = results.map(r => r.constraintId);
    
    // Combine results and add metadata
    const combinedResult = ConstraintResult.combine(results);
    
    // Add statistics and execution order as metadata
    return this._enrichResult(combinedResult, executionOrder, results);
  }

  /**
   * Validate multiple edges and return combined result
   */
  validateEdges(storeRoot, edges) {
    // Validate parameters
    if (storeRoot === null || storeRoot === undefined) {
      throw new Error('Store root is required');
    }
    if (!Array.isArray(edges)) {
      throw new Error('Edges must be an array');
    }
    
    // Validate all edges
    for (const edge of edges) {
      if (!edge || !(edge instanceof Edge)) {
        throw new Error('All edges must be Edge instances');
      }
    }

    // Handle empty array
    if (edges.length === 0) {
      return this._createBatchResult(true, []);
    }

    // Validate each edge
    const allResults = [];
    for (const edge of edges) {
      const edgeResults = this._registry.validateEdge(storeRoot, edge);
      allResults.push(...edgeResults);
    }

    // Combine all results
    const combinedResult = ConstraintResult.combine(allResults);
    
    // Return as batch result
    return this._createBatchResult(combinedResult.isValid, combinedResult.violations);
  }

  /**
   * Validate edge against specific constraint IDs only
   */
  validateEdgeWithConstraints(storeRoot, edge, constraintIds) {
    // Validate parameters
    this._validateEdgeParameters(storeRoot, edge);
    if (!Array.isArray(constraintIds)) {
      throw new Error('Constraint IDs must be an array');
    }
    for (const id of constraintIds) {
      if (typeof id !== 'string') {
        throw new Error('All constraint IDs must be strings');
      }
    }

    // Get and validate only specified constraints
    const results = [];
    for (const constraintId of constraintIds) {
      const constraint = this._registry.getConstraint(constraintId);
      if (constraint) {
        try {
          const result = constraint.validate(storeRoot, edge);
          results.push(result);
        } catch (error) {
          throw new Error(`Constraint execution failed for ${constraintId}: ${error.message}`);
        }
      }
    }

    // Combine results
    const combinedResult = results.length > 0 
      ? ConstraintResult.combine(results)
      : ConstraintResult.success('selective');
    
    // Track execution order
    const executionOrder = results.map(r => r.constraintId);
    
    return this._enrichResult(combinedResult, executionOrder, results);
  }

  /**
   * Validate edge for specific relation names only
   */
  validateEdgeForRelations(storeRoot, edge, relationNames) {
    // Validate parameters
    this._validateEdgeParameters(storeRoot, edge);
    if (!Array.isArray(relationNames)) {
      throw new Error('Relation names must be an array');
    }
    for (const name of relationNames) {
      if (typeof name !== 'string') {
        throw new Error('All relation names must be strings');
      }
    }

    // Get constraints for specified relations only (not including global)
    const results = [];
    for (const relationName of relationNames) {
      const constraints = this._registry.getConstraintsForRelation(relationName);
      // Filter out global constraints
      const relationSpecificConstraints = constraints.filter(c => c.relationName === relationName);
      
      for (const constraint of relationSpecificConstraints) {
        try {
          const result = constraint.validate(storeRoot, edge);
          results.push(result);
        } catch (error) {
          throw new Error(`Constraint execution failed for ${constraint.id}: ${error.message}`);
        }
      }
    }

    // Combine results
    const combinedResult = results.length > 0
      ? ConstraintResult.combine(results)
      : ConstraintResult.success('selective-relations');
    
    // Track execution order
    const executionOrder = results.map(r => r.constraintId);
    
    return this._enrichResult(combinedResult, executionOrder, results);
  }

  // === DEBUGGING AND STATISTICS ===

  /**
   * Get debug information about the validator
   */
  getDebugInfo() {
    const relationNames = this._registry.getRelationNames();
    return {
      constraintCount: this._registry.getConstraintCount(),
      relationNames: relationNames,
      hasGlobalConstraints: this._registry.hasGlobalConstraints()
    };
  }

  /**
   * String representation for debugging
   */
  toString() {
    const count = this._registry.getConstraintCount();
    return `ConstraintValidator(${count} constraints)`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate edge parameters
   */
  _validateEdgeParameters(storeRoot, edge) {
    if (storeRoot === null || storeRoot === undefined) {
      throw new Error('Store root is required');
    }
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (!(edge instanceof Edge)) {
      throw new Error('Edge must be an Edge instance');
    }
  }

  /**
   * Create batch result with proper structure
   */
  _createBatchResult(isValid, violations) {
    const baseResult = new ConstraintResult('batch', isValid, violations);
    
    // Create a wrapper object since ConstraintResult is frozen
    const batchWrapper = {
      // Expose base result properties
      get constraintId() { return baseResult.constraintId; },
      get isValid() { return baseResult.isValid; },
      get violations() { return baseResult.violations; },
      
      // Add batch-specific methods
      getViolationsByConstraint() {
        const byConstraint = {};
        for (const violation of violations) {
          if (!byConstraint[violation.constraintId]) {
            byConstraint[violation.constraintId] = [];
          }
          byConstraint[violation.constraintId].push(violation);
        }
        return byConstraint;
      },
      
      getValidationStatistics() {
        return {
          constraintsEvaluated: 0,
          constraintsPassed: 0,
          constraintsFailed: 0,
          totalViolations: violations.length
        };
      },
      
      getExecutionOrder() {
        return [];
      },
      
      // Preserve toString from base result
      toString() {
        return baseResult.toString();
      }
    };
    
    // Make wrapper look like a ConstraintResult for instanceof checks
    Object.setPrototypeOf(batchWrapper, ConstraintResult.prototype);
    
    return batchWrapper;
  }

  /**
   * Enrich result with additional metadata and methods
   */
  _enrichResult(baseResult, executionOrder, individualResults) {
    // Create a wrapper object that extends the result with additional methods
    // Since ConstraintResult is frozen, we can't add methods directly
    const enrichedWrapper = {
      // Expose base result properties
      get constraintId() { return baseResult.constraintId; },
      get isValid() { return baseResult.isValid; },
      get violations() { return baseResult.violations; },
      
      // Add violation grouping method
      getViolationsByConstraint() {
        const byConstraint = {};
        for (const violation of baseResult.violations) {
          if (!byConstraint[violation.constraintId]) {
            byConstraint[violation.constraintId] = [];
          }
          byConstraint[violation.constraintId].push(violation);
        }
        return byConstraint;
      },
      
      // Add statistics method
      getValidationStatistics() {
        const passed = individualResults.filter(r => r.isValid).length;
        const failed = individualResults.filter(r => !r.isValid).length;
        
        return {
          constraintsEvaluated: individualResults.length,
          constraintsPassed: passed,
          constraintsFailed: failed,
          totalViolations: baseResult.violations.length
        };
      },
      
      // Add execution order method
      getExecutionOrder() {
        return executionOrder;
      },
      
      // Preserve toString from base result
      toString() {
        return baseResult.toString();
      }
    };
    
    // Make wrapper look like a ConstraintResult for instanceof checks
    Object.setPrototypeOf(enrichedWrapper, ConstraintResult.prototype);
    
    return enrichedWrapper;
  }
}