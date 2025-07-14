/**
 * Tests for PlanValidator class
 * 
 * PlanValidator provides comprehensive validation for plans including
 * structural validation, dependency validation, and completeness checks.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanValidator } from '../../src/core/PlanValidator.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('PlanValidator', () => {
  let validator;
  let plan;
  let context;

  beforeEach(() => {
    validator = new PlanValidator();
    
    context = new PlanContext({
      projectType: 'frontend',
      technologies: { frontend: ['html', 'javascript'] }
    });

    plan = new Plan({
      name: 'Test Plan',
      description: 'A test plan',
      context: context.toJSON()
    });
  });

  describe('Constructor', () => {
    test('should create PlanValidator with default configuration', () => {
      expect(validator).toBeDefined();
      expect(validator.config).toBeDefined();
      expect(validator.config.strictValidation).toBe(true);
      expect(validator.config.validateDependencies).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customValidator = new PlanValidator({
        strictValidation: false,
        validateDependencies: false,
        maxSteps: 50
      });

      expect(customValidator.config.strictValidation).toBe(false);
      expect(customValidator.config.validateDependencies).toBe(false);
      expect(customValidator.config.maxSteps).toBe(50);
    });
  });

  describe('Basic Validation', () => {
    test('should validate a valid plan', async () => {
      const step = new PlanStep({
        id: 'step1',
        name: 'Setup Project',
        type: 'setup',
        actions: []
      });
      plan.addStep(step);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeDefined();
    });

    test('should reject plan without steps', async () => {
      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Plan must contain at least one step');
    });

    test('should reject plan without name', async () => {
      const invalidPlan = new Plan({
        description: 'Test plan without name',
        context: context.toJSON()
      });

      const result = await validator.validate(invalidPlan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Plan must have a name');
    });

    test('should reject plan without description', async () => {
      const invalidPlan = new Plan({
        name: 'Test Plan',
        context: context.toJSON()
      });

      const result = await validator.validate(invalidPlan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Plan must have a description');
    });

    test('should validate plan with maximum steps limit', async () => {
      const limitedValidator = new PlanValidator({ maxSteps: 2 });

      // Add 3 steps to exceed limit
      for (let i = 1; i <= 3; i++) {
        plan.addStep(new PlanStep({
          id: `step${i}`,
          name: `Step ${i}`,
          type: 'implementation'
        }));
      }

      const result = await limitedValidator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Plan exceeds maximum number of steps (2)');
    });
  });

  describe('Structural Validation', () => {
    test('should validate step structure', async () => {
      const step = new PlanStep({
        id: 'step1',
        name: 'Valid Step',
        type: 'implementation',
        actions: []
      });
      plan.addStep(step);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(true);
    });

    test('should reject steps with duplicate IDs', async () => {
      const step1 = new PlanStep({
        id: 'duplicate',
        name: 'Step 1',
        type: 'setup'
      });
      const step2 = new PlanStep({
        id: 'duplicate',
        name: 'Step 2',
        type: 'implementation'
      });

      plan.addStep(step1);
      plan.addStep(step2);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate step ID found: duplicate');
    });

    test('should validate required step fields', async () => {
      // Manually create invalid step to bypass PlanStep validation
      const invalidStep = {
        id: 'invalid',
        // missing name
        type: 'implementation'
      };
      plan.steps.push(invalidStep);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Step invalid: missing required field "name"'))).toBe(true);
    });

    test('should validate step types', async () => {
      const invalidStep = {
        id: 'invalid',
        name: 'Invalid Step',
        type: 'invalid-type'
      };
      plan.steps.push(invalidStep);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Step invalid: invalid type "invalid-type"'))).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    test('should validate valid dependencies', async () => {
      const step1 = new PlanStep({
        id: 'step1',
        name: 'First Step',
        type: 'setup'
      });
      const step2 = new PlanStep({
        id: 'step2',
        name: 'Second Step',
        type: 'implementation',
        dependencies: ['step1']
      });

      plan.addStep(step1);
      plan.addStep(step2);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(true);
    });

    test('should detect missing dependencies', async () => {
      const step = new PlanStep({
        id: 'step1',
        name: 'Step with missing dependency',
        type: 'implementation',
        dependencies: ['nonexistent']
      });
      plan.addStep(step);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Step step1 depends on non-existent step: nonexistent');
    });

    test('should detect circular dependencies', async () => {
      const step1 = new PlanStep({
        id: 'step1',
        name: 'Step 1',
        type: 'setup',
        dependencies: ['step2']
      });
      const step2 = new PlanStep({
        id: 'step2',
        name: 'Step 2',
        type: 'implementation',
        dependencies: ['step1']
      });

      plan.addStep(step1);
      plan.addStep(step2);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Circular dependency detected'))).toBe(true);
    });

    test('should detect complex circular dependencies', async () => {
      const step1 = new PlanStep({
        id: 'step1',
        name: 'Step 1',
        type: 'setup',
        dependencies: ['step3']
      });
      const step2 = new PlanStep({
        id: 'step2',
        name: 'Step 2',
        type: 'implementation',
        dependencies: ['step1']
      });
      const step3 = new PlanStep({
        id: 'step3',
        name: 'Step 3',
        type: 'testing',
        dependencies: ['step2']
      });

      plan.addStep(step1);
      plan.addStep(step2);
      plan.addStep(step3);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Circular dependency detected'))).toBe(true);
    });

    test('should skip dependency validation when disabled', async () => {
      const noDepsValidator = new PlanValidator({ validateDependencies: false });

      const step = new PlanStep({
        id: 'step1',
        name: 'Step with missing dependency',
        type: 'implementation',
        dependencies: ['nonexistent']
      });
      plan.addStep(step);

      const result = await noDepsValidator.validate(plan, context);

      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain('Step step1 depends on non-existent step: nonexistent');
    });
  });

  describe('Completeness Validation', () => {
    test('should validate plan completeness for frontend project', async () => {
      const setupStep = new PlanStep({
        id: 'setup',
        name: 'Setup Project',
        type: 'setup'
      });
      const implStep = new PlanStep({
        id: 'impl',
        name: 'Implement Features',
        type: 'implementation'
      });
      const testStep = new PlanStep({
        id: 'test',
        name: 'Test Implementation',
        type: 'testing'
      });

      plan.addStep(setupStep);
      plan.addStep(implStep);
      plan.addStep(testStep);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(true);
    });

    test('should warn about missing testing steps', async () => {
      const setupStep = new PlanStep({
        id: 'setup',
        name: 'Setup Project',
        type: 'setup'
      });
      const implStep = new PlanStep({
        id: 'impl',
        name: 'Implement Features',
        type: 'implementation'
      });

      plan.addStep(setupStep);
      plan.addStep(implStep);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(true); // Valid but with warnings
      expect(result.warnings).toContain('Plan is missing testing steps');
    });

    test('should warn about missing setup steps', async () => {
      const implStep = new PlanStep({
        id: 'impl',
        name: 'Implement Features',
        type: 'implementation'
      });

      plan.addStep(implStep);

      const result = await validator.validate(plan, context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Plan is missing setup steps');
    });

    test('should validate different project types', async () => {
      const backendContext = new PlanContext({
        projectType: 'backend',
        technologies: { backend: ['nodejs', 'express'] }
      });

      const backendPlan = new Plan({
        name: 'Backend Plan',
        description: 'A backend plan',
        context: backendContext.toJSON()
      });

      const setupStep = new PlanStep({
        id: 'setup',
        name: 'Setup Server',
        type: 'setup'
      });
      backendPlan.addStep(setupStep);

      const result = await validator.validate(backendPlan, backendContext);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Custom Validation Rules', () => {
    test('should support custom validation rules', async () => {
      const customValidator = new PlanValidator();
      
      // Add custom rule
      customValidator.addRule('custom-test', (plan, context) => {
        if (plan.name.toLowerCase().includes('test')) {
          return { valid: false, message: 'Plan names cannot contain "test"' };
        }
        return { valid: true };
      });

      const testPlan = new Plan({
        name: 'Test Plan',
        description: 'A test plan',
        context: context.toJSON()
      });
      testPlan.addStep(new PlanStep({
        id: 'step1',
        name: 'Step 1',
        type: 'implementation'
      }));

      const result = await customValidator.validate(testPlan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Plan names cannot contain "test"');
    });

    test('should support custom warning rules', async () => {
      const customValidator = new PlanValidator();
      
      // Add custom warning rule
      customValidator.addRule('custom-warning', (plan, context) => {
        if (plan.steps.length < 3) {
          return { valid: true, warning: 'Plans with fewer than 3 steps may be incomplete' };
        }
        return { valid: true };
      });

      const simplePlan = new Plan({
        name: 'Simple Plan',
        description: 'A simple plan',
        context: context.toJSON()
      });
      simplePlan.addStep(new PlanStep({
        id: 'step1',
        name: 'Single Step',
        type: 'implementation'
      }));

      const result = await customValidator.validate(simplePlan, context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Plans with fewer than 3 steps may be incomplete');
    });

    test('should remove custom validation rules', async () => {
      const customValidator = new PlanValidator();
      
      // Add and then remove custom rule
      customValidator.addRule('removable-rule', (plan, context) => {
        return { valid: false, message: 'This rule should be removed' };
      });

      customValidator.removeRule('removable-rule');

      const simplePlan = new Plan({
        name: 'Test Plan',
        description: 'A test plan',
        context: context.toJSON()
      });
      simplePlan.addStep(new PlanStep({
        id: 'step1',
        name: 'Step 1',
        type: 'implementation'
      }));

      const result = await customValidator.validate(simplePlan, context);

      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain('This rule should be removed');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large plans efficiently', async () => {
      // Create plan with many steps
      for (let i = 1; i <= 100; i++) {
        plan.addStep(new PlanStep({
          id: `step${i}`,
          name: `Step ${i}`,
          type: 'implementation'
        }));
      }

      const startTime = Date.now();
      const result = await validator.validate(plan, context);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle empty plan gracefully', async () => {
      const emptyPlan = new Plan({
        name: 'Empty Plan',
        description: 'An empty plan',
        context: context.toJSON()
      });

      const result = await validator.validate(emptyPlan, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Plan must contain at least one step');
    });

    test('should handle null/undefined inputs', async () => {
      await expect(validator.validate(null, context)).rejects.toThrow('Plan must be provided');
      await expect(validator.validate(plan, null)).rejects.toThrow('Context must be provided');
    });

    test('should handle malformed plan objects', async () => {
      const malformedPlan = { name: 'Bad Plan' }; // Missing required Plan structure

      const result = await validator.validate(malformedPlan, context);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Result Structure', () => {
    test('should return consistent validation result structure', async () => {
      plan.addStep(new PlanStep({
        id: 'step1',
        name: 'Test Step',
        type: 'implementation'
      }));

      const result = await validator.validate(plan, context);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.metadata).toBe('object');
    });

    test('should include validation metadata', async () => {
      plan.addStep(new PlanStep({
        id: 'step1',
        name: 'Test Step',
        type: 'implementation'
      }));

      const result = await validator.validate(plan, context);

      expect(result.metadata.validatedAt).toBeDefined();
      expect(result.metadata.validator).toBe('PlanValidator');
      expect(result.metadata.rulesApplied).toBeDefined();
      expect(typeof result.metadata.validationDuration).toBe('number');
    });
  });
});