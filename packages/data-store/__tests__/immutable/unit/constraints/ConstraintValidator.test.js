/**
 * Unit Tests for Constraint Validator Engine
 * Per implementation plan Phase 2 Step 2.3
 * TDD approach - tests written first before implementation
 */

import { ConstraintValidator } from '../../../../src/immutable/constraints/ConstraintValidator.js';
import { ConstraintRegistry } from '../../../../src/immutable/constraints/ConstraintRegistry.js';
import { Constraint } from '../../../../src/immutable/constraints/Constraint.js';
import { ConstraintResult } from '../../../../src/immutable/constraints/ConstraintResult.js';
import { ConstraintViolation } from '../../../../src/immutable/constraints/ConstraintViolation.js';
import { Edge } from '../../../../src/Edge.js';

describe('Constraint Validator Engine', () => {
  let validator;
  let registry;
  let storeRoot;
  let sampleEdge;
  let passingConstraint;
  let failingConstraint;
  let globalConstraint;

  beforeEach(() => {
    registry = new ConstraintRegistry();
    validator = new ConstraintValidator(registry);
    storeRoot = { mockStoreRoot: true }; // Mock store root for testing
    sampleEdge = new Edge('worksAt', 'alice', 'company1');

    // Create test constraints
    passingConstraint = new PassingConstraint('passing', 'worksAt', 'Always passes');
    failingConstraint = new FailingConstraint('failing', 'worksAt', 'Always fails');
    globalConstraint = new PassingConstraint('global', '*', 'Global constraint');
  });

  describe('Constructor and Immutability', () => {
    test('should create immutable validator with registry', () => {
      expect(validator).toBeDefined();
      expect(validator.getRegistry()).toBe(registry);
      expect(Object.isFrozen(validator)).toBe(true);
    });

    test('should create validator with default empty registry', () => {
      const validatorWithoutRegistry = new ConstraintValidator();
      expect(validatorWithoutRegistry.getRegistry()).toBeInstanceOf(ConstraintRegistry);
      expect(validatorWithoutRegistry.getRegistry().getConstraintCount()).toBe(0);
    });

    test('should fail fast on invalid registry', () => {
      expect(() => new ConstraintValidator('not-registry')).toThrow('Registry must be a ConstraintRegistry instance');
      expect(() => new ConstraintValidator(null)).toThrow('Registry must be a ConstraintRegistry instance');
    });
  });

  describe('withRegistry() - Pure Function', () => {
    test('should return new validator with different registry', () => {
      const newRegistry = registry.withAddedConstraint(passingConstraint);
      const newValidator = validator.withRegistry(newRegistry);
      
      // Should return new instance
      expect(newValidator).not.toBe(validator);
      expect(newValidator).toBeInstanceOf(ConstraintValidator);
      
      // Original validator unchanged
      expect(validator.getRegistry()).toBe(registry);
      expect(validator.getRegistry().getConstraintCount()).toBe(0);
      
      // New validator has new registry
      expect(newValidator.getRegistry()).toBe(newRegistry);
      expect(newValidator.getRegistry().getConstraintCount()).toBe(1);
      
      // Both should be frozen
      expect(Object.isFrozen(validator)).toBe(true);
      expect(Object.isFrozen(newValidator)).toBe(true);
    });

    test('should return same instance when setting same registry', () => {
      const result = validator.withRegistry(registry);
      expect(result).toBe(validator);
    });

    test('should fail fast on invalid registry', () => {
      expect(() => validator.withRegistry('not-registry')).toThrow('Registry must be a ConstraintRegistry instance');
      expect(() => validator.withRegistry(null)).toThrow('Registry must be a ConstraintRegistry instance');
    });
  });

  describe('validateEdge() - Single Edge Validation', () => {
    let populatedValidator;

    beforeEach(() => {
      const populatedRegistry = registry
        .withAddedConstraint(passingConstraint)
        .withAddedConstraint(failingConstraint)
        .withAddedConstraint(globalConstraint);
      populatedValidator = validator.withRegistry(populatedRegistry);
    });

    test('should validate edge against all applicable constraints', () => {
      const result = populatedValidator.validateEdge(storeRoot, sampleEdge);
      
      expect(result).toBeInstanceOf(ConstraintResult);
      expect(result.constraintId).toBe('combined');
      expect(result.isValid).toBe(false); // Should fail due to failing constraint
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].constraintId).toBe('failing');
    });

    test('should return success when all constraints pass', () => {
      const validRegistry = registry
        .withAddedConstraint(passingConstraint)
        .withAddedConstraint(globalConstraint);
      const validValidator = validator.withRegistry(validRegistry);
      
      const result = validValidator.validateEdge(storeRoot, sampleEdge);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should handle edge with no applicable constraints', () => {
      const unknownEdge = new Edge('unknownRelation', 'x', 'y');
      const registryWithGlobal = registry.withAddedConstraint(globalConstraint);
      const validatorWithGlobal = validator.withRegistry(registryWithGlobal);
      
      const result = validatorWithGlobal.validateEdge(storeRoot, unknownEdge);
      
      expect(result.isValid).toBe(true); // Only global constraint, which passes
      expect(result.violations).toHaveLength(0);
    });

    test('should handle completely empty registry', () => {
      const result = validator.validateEdge(storeRoot, sampleEdge);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should fail fast on invalid parameters', () => {
      expect(() => populatedValidator.validateEdge(null, sampleEdge)).toThrow('Store root is required');
      expect(() => populatedValidator.validateEdge(storeRoot, null)).toThrow('Edge is required');
      expect(() => populatedValidator.validateEdge(storeRoot, 'not-edge')).toThrow('Edge must be an Edge instance');
    });
  });

  describe('validateEdges() - Batch Validation', () => {
    let populatedValidator;
    let validEdge;
    let invalidEdge;

    beforeEach(() => {
      const populatedRegistry = registry
        .withAddedConstraint(passingConstraint)
        .withAddedConstraint(failingConstraint);
      populatedValidator = validator.withRegistry(populatedRegistry);
      
      validEdge = new Edge('otherRelation', 'a', 'b'); // No constraints apply
      invalidEdge = new Edge('worksAt', 'alice', 'company1'); // Failing constraint applies
    });

    test('should validate multiple edges and return combined result', () => {
      const edges = [validEdge, invalidEdge];
      const result = populatedValidator.validateEdges(storeRoot, edges);
      
      expect(result).toBeInstanceOf(ConstraintResult);
      expect(result.constraintId).toBe('batch');
      expect(result.isValid).toBe(false); // One edge fails
      expect(result.violations).toHaveLength(1);
    });

    test('should return success when all edges pass', () => {
      const edges = [validEdge];
      const result = populatedValidator.validateEdges(storeRoot, edges);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should handle empty edge array', () => {
      const result = populatedValidator.validateEdges(storeRoot, []);
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should aggregate violations from multiple edges', () => {
      const edges = [invalidEdge, invalidEdge]; // Both will fail
      const result = populatedValidator.validateEdges(storeRoot, edges);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2); // Two violations
    });

    test('should fail fast on invalid parameters', () => {
      expect(() => populatedValidator.validateEdges(null, [])).toThrow('Store root is required');
      expect(() => populatedValidator.validateEdges(storeRoot, null)).toThrow('Edges must be an array');
      expect(() => populatedValidator.validateEdges(storeRoot, [null])).toThrow('All edges must be Edge instances');
      expect(() => populatedValidator.validateEdges(storeRoot, ['not-edge'])).toThrow('All edges must be Edge instances');
    });
  });

  describe('Selective Constraint Execution', () => {
    let selectiveValidator;

    beforeEach(() => {
      const selectiveRegistry = registry
        .withAddedConstraint(passingConstraint)
        .withAddedConstraint(failingConstraint)
        .withAddedConstraint(globalConstraint);
      selectiveValidator = validator.withRegistry(selectiveRegistry);
    });

    test('should validate against specific constraint IDs only', () => {
      const result = selectiveValidator.validateEdgeWithConstraints(
        storeRoot, 
        sampleEdge, 
        ['passing', 'global']
      );
      
      expect(result.isValid).toBe(true); // Should pass since we skip the failing constraint
      expect(result.violations).toHaveLength(0);
    });

    test('should validate against specific relation names only', () => {
      const result = selectiveValidator.validateEdgeForRelations(
        storeRoot,
        sampleEdge,
        ['worksAt'] // Only relation-specific, not global
      );
      
      expect(result.isValid).toBe(false); // Should fail due to failing constraint
      expect(result.violations).toHaveLength(1);
    });

    test('should handle non-existent constraint IDs gracefully', () => {
      const result = selectiveValidator.validateEdgeWithConstraints(
        storeRoot,
        sampleEdge,
        ['nonexistent']
      );
      
      expect(result.isValid).toBe(true); // No constraints executed
      expect(result.violations).toHaveLength(0);
    });

    test('should fail fast on invalid selective parameters', () => {
      expect(() => selectiveValidator.validateEdgeWithConstraints(storeRoot, sampleEdge, null))
        .toThrow('Constraint IDs must be an array');
      expect(() => selectiveValidator.validateEdgeWithConstraints(storeRoot, sampleEdge, [123]))
        .toThrow('All constraint IDs must be strings');
        
      expect(() => selectiveValidator.validateEdgeForRelations(storeRoot, sampleEdge, null))
        .toThrow('Relation names must be an array');
      expect(() => selectiveValidator.validateEdgeForRelations(storeRoot, sampleEdge, [123]))
        .toThrow('All relation names must be strings');
    });
  });

  describe('Violation Collection and Reporting', () => {
    let reportingValidator;

    beforeEach(() => {
      const reportingRegistry = registry
        .withAddedConstraint(new FailingConstraint('fail1', 'worksAt', 'First failure'))
        .withAddedConstraint(new FailingConstraint('fail2', 'worksAt', 'Second failure'))
        .withAddedConstraint(new CustomFailingConstraint('fail3', 'worksAt', 'Third failure', 'warning'));
      reportingValidator = validator.withRegistry(reportingRegistry);
    });

    test('should collect violations from multiple constraints', () => {
      const result = reportingValidator.validateEdge(storeRoot, sampleEdge);
      
      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(3);
      
      const violationIds = result.violations.map(v => v.constraintId);
      expect(violationIds).toContain('fail1');
      expect(violationIds).toContain('fail2');
      expect(violationIds).toContain('fail3');
    });

    test('should preserve violation metadata and severity', () => {
      const result = reportingValidator.validateEdge(storeRoot, sampleEdge);
      
      const warningViolation = result.violations.find(v => v.constraintId === 'fail3');
      expect(warningViolation.getSeverity()).toBe('warning');
    });

    test('should provide detailed violation reporting', () => {
      const result = reportingValidator.validateEdge(storeRoot, sampleEdge);
      
      const violationsByConstraint = result.getViolationsByConstraint();
      expect(violationsByConstraint).toHaveProperty('fail1');
      expect(violationsByConstraint).toHaveProperty('fail2');
      expect(violationsByConstraint).toHaveProperty('fail3');
      
      expect(violationsByConstraint.fail1).toHaveLength(1);
      expect(violationsByConstraint.fail2).toHaveLength(1);
      expect(violationsByConstraint.fail3).toHaveLength(1);
    });
  });

  describe('Performance and Statistics', () => {
    let performanceValidator;

    beforeEach(() => {
      const performanceRegistry = registry
        .withAddedConstraint(passingConstraint)
        .withAddedConstraint(failingConstraint)
        .withAddedConstraint(globalConstraint);
      performanceValidator = validator.withRegistry(performanceRegistry);
    });

    test('should provide validation statistics', () => {
      const result = performanceValidator.validateEdge(storeRoot, sampleEdge);
      
      const stats = result.getValidationStatistics();
      expect(stats).toHaveProperty('constraintsEvaluated', 3);
      expect(stats).toHaveProperty('constraintsPassed', 2);
      expect(stats).toHaveProperty('constraintsFailed', 1);
      expect(stats).toHaveProperty('totalViolations', 1);
    });

    test('should track execution order', () => {
      const result = performanceValidator.validateEdge(storeRoot, sampleEdge);
      
      const executionOrder = result.getExecutionOrder();
      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toContain('passing');
      expect(executionOrder).toContain('failing');
      expect(executionOrder).toContain('global');
    });
  });

  describe('Error Handling - Fail Fast', () => {
    test('should fail fast on constructor errors', () => {
      expect(() => new ConstraintValidator('not-registry')).toThrow('Registry must be a ConstraintRegistry instance');
    });

    test('should fail fast on validation errors', () => {
      expect(() => validator.validateEdge(null, sampleEdge)).toThrow('Store root is required');
      expect(() => validator.validateEdge(storeRoot, null)).toThrow('Edge is required');
    });

    test('should provide clear error messages', () => {
      try {
        validator.validateEdge(storeRoot, 'not-edge');
      } catch (error) {
        expect(error.message).toContain('Edge must be an Edge instance');
      }
    });

    test('should handle constraint execution errors', () => {
      const errorConstraint = new ErrorConstraint('error', 'worksAt', 'Throws error');
      const errorRegistry = registry.withAddedConstraint(errorConstraint);
      const errorValidator = validator.withRegistry(errorRegistry);
      
      // Should wrap constraint errors and continue with other constraints
      expect(() => errorValidator.validateEdge(storeRoot, sampleEdge)).toThrow('Constraint execution failed');
    });
  });

  describe('Integration with ConstraintRegistry', () => {
    test('should stay in sync with registry updates', () => {
      let currentValidator = validator;
      let currentRegistry = registry;
      
      // Add constraint
      currentRegistry = currentRegistry.withAddedConstraint(passingConstraint);
      currentValidator = currentValidator.withRegistry(currentRegistry);
      
      expect(currentValidator.getRegistry().getConstraintCount()).toBe(1);
      
      // Remove constraint
      currentRegistry = currentRegistry.withRemovedConstraint('passing');
      currentValidator = currentValidator.withRegistry(currentRegistry);
      
      expect(currentValidator.getRegistry().getConstraintCount()).toBe(0);
    });

    test('should respect registry constraint indexing', () => {
      const indexedRegistry = registry
        .withAddedConstraint(passingConstraint)
        .withAddedConstraint(globalConstraint);
      const indexedValidator = validator.withRegistry(indexedRegistry);
      
      // Should find constraints by relation name correctly
      const worksAtResult = indexedValidator.validateEdge(storeRoot, sampleEdge);
      expect(worksAtResult.isValid).toBe(true); // passing + global both pass
      
      const otherResult = indexedValidator.validateEdge(storeRoot, new Edge('other', 'x', 'y'));
      expect(otherResult.isValid).toBe(true); // only global applies
    });
  });

  describe('String Representation and Debugging', () => {
    test('should provide meaningful string representation', () => {
      const str = validator.toString();
      expect(str).toContain('ConstraintValidator');
      expect(str).toContain('0 constraints');
    });

    test('should provide detailed debugging information', () => {
      const populatedRegistry = registry.withAddedConstraint(passingConstraint);
      const populatedValidator = validator.withRegistry(populatedRegistry);
      
      const debugInfo = populatedValidator.getDebugInfo();
      expect(debugInfo).toHaveProperty('constraintCount', 1);
      expect(debugInfo).toHaveProperty('relationNames');
      expect(debugInfo.relationNames).toContain('worksAt');
    });
  });
});

// Helper test constraint classes
class PassingConstraint extends Constraint {
  constructor(id, relationName, description) {
    super(id, relationName, description);
  }
  
  validate(storeRoot, edge) {
    return ConstraintResult.success(this.id);
  }
}

class FailingConstraint extends Constraint {
  constructor(id, relationName, description) {
    super(id, relationName, description);
  }
  
  validate(storeRoot, edge) {
    const violation = new ConstraintViolation(this.id, this.description, edge);
    return ConstraintResult.failure(this.id, [violation]);
  }
}

// Store severity metadata outside the class since constraints are frozen
const severityMap = new Map();

class CustomFailingConstraint extends Constraint {
  constructor(id, relationName, description, severity = 'error') {
    super(id, relationName, description);
    // Store severity in external map since the constraint is frozen
    severityMap.set(id, severity);
  }
  
  validate(storeRoot, edge) {
    const severity = severityMap.get(this.id) || 'error';
    const violation = new ConstraintViolation(this.id, this.description, edge, { severity });
    return ConstraintResult.failure(this.id, [violation]);
  }
}

class ErrorConstraint extends Constraint {
  constructor(id, relationName, description) {
    super(id, relationName, description);
  }
  
  validate(storeRoot, edge) {
    throw new Error('Constraint execution error');
  }
}