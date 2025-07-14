/**
 * Tests for PlanRefiner class
 * 
 * PlanRefiner provides intelligent plan refinement based on validation results,
 * applying targeted fixes and improvements to plans.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanRefiner } from '../../src/core/PlanRefiner.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('PlanRefiner', () => {
  let refiner;
  let plan;
  let context;

  beforeEach(() => {
    refiner = new PlanRefiner();
    
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
    test('should create PlanRefiner with default configuration', () => {
      expect(refiner).toBeDefined();
      expect(refiner.config).toBeDefined();
      expect(refiner.config.autoFix).toBe(true);
      expect(refiner.config.preserveUserSteps).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customRefiner = new PlanRefiner({
        autoFix: false,
        preserveUserSteps: false,
        maxRefinements: 5
      });

      expect(customRefiner.config.autoFix).toBe(false);
      expect(customRefiner.config.preserveUserSteps).toBe(false);
      expect(customRefiner.config.maxRefinements).toBe(5);
    });
  });

  describe('Basic Refinement', () => {
    test('should refine plan based on validation errors', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan).toBeDefined();
      expect(refinedPlan.steps.length).toBeGreaterThan(0);
    });

    test('should return original plan if no refinement needed', async () => {
      plan.addStep(new PlanStep({
        id: 'step1',
        name: 'Existing Step',
        type: 'implementation'
      }));

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan).toBe(plan);
      expect(refinedPlan.steps).toHaveLength(1);
    });

    test('should track refinement metadata', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.metadata.refinements).toBeDefined();
      expect(refinedPlan.metadata.refinements.length).toBeGreaterThan(0);
      expect(refinedPlan.metadata.lastRefinement).toBeDefined();
    });
  });

  describe('Error-Specific Refinements', () => {
    test('should add missing steps when plan is empty', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.steps.length).toBeGreaterThan(0);
      expect(refinedPlan.steps.some(step => step.type === 'setup')).toBe(true);
    });

    test('should fix duplicate step IDs', async () => {
      plan.addStep(new PlanStep({ id: 'duplicate', name: 'Step 1', type: 'setup' }));
      plan.addStep(new PlanStep({ id: 'duplicate', name: 'Step 2', type: 'implementation' }));

      const validationResult = {
        isValid: false,
        errors: ['Duplicate step ID found: duplicate'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      const stepIds = refinedPlan.steps.map(step => step.id);
      const uniqueIds = new Set(stepIds);
      expect(stepIds.length).toBe(uniqueIds.size);
    });

    test('should fix missing dependencies', async () => {
      plan.addStep(new PlanStep({
        id: 'step1',
        name: 'Step with missing dependency',
        type: 'implementation',
        dependencies: ['nonexistent']
      }));

      const validationResult = {
        isValid: false,
        errors: ['Step step1 depends on non-existent step: nonexistent'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      // Should either add the missing step or remove the dependency
      const step1 = refinedPlan.getStepById('step1');
      const hasNonexistentStep = refinedPlan.getStepById('nonexistent');
      
      if (hasNonexistentStep) {
        expect(hasNonexistentStep).toBeDefined();
      } else {
        expect(step1.dependencies).not.toContain('nonexistent');
      }
    });

    test('should resolve circular dependencies', async () => {
      plan.addStep(new PlanStep({
        id: 'step1',
        name: 'Step 1',
        type: 'setup',
        dependencies: ['step2']
      }));
      plan.addStep(new PlanStep({
        id: 'step2',
        name: 'Step 2',
        type: 'implementation',
        dependencies: ['step1']
      }));

      const validationResult = {
        isValid: false,
        errors: ['Circular dependency detected: step1 -> step2 -> step1'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      // Check that circular dependency is resolved
      const step1 = refinedPlan.getStepById('step1');
      const step2 = refinedPlan.getStepById('step2');
      
      const hasCircularDep = (
        step1.dependencies.includes('step2') && 
        step2.dependencies.includes('step1')
      );
      
      expect(hasCircularDep).toBe(false);
    });

    test('should fix invalid step types', async () => {
      // Manually add invalid step to bypass validation
      plan.steps.push({
        id: 'invalid',
        name: 'Invalid Step',
        type: 'invalid-type'
      });

      const validationResult = {
        isValid: false,
        errors: ['Step invalid: invalid type "invalid-type"'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      const invalidStep = refinedPlan.steps.find(step => step.id === 'invalid');
      expect(invalidStep.type).not.toBe('invalid-type');
      expect(['setup', 'implementation', 'integration', 'testing', 'validation', 'deployment'])
        .toContain(invalidStep.type);
    });
  });

  describe('Warning-Based Improvements', () => {
    test('should add missing setup steps', async () => {
      plan.addStep(new PlanStep({
        id: 'impl',
        name: 'Implementation',
        type: 'implementation'
      }));

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: ['Plan is missing setup steps']
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.steps.some(step => step.type === 'setup')).toBe(true);
    });

    test('should add missing testing steps', async () => {
      plan.addStep(new PlanStep({
        id: 'setup',
        name: 'Setup',
        type: 'setup'
      }));
      plan.addStep(new PlanStep({
        id: 'impl',
        name: 'Implementation',
        type: 'implementation'
      }));

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: ['Plan is missing testing steps']
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.steps.some(step => step.type === 'testing')).toBe(true);
    });

    test('should add project-specific steps for frontend', async () => {
      plan.addStep(new PlanStep({
        id: 'setup',
        name: 'Setup',
        type: 'setup'
      }));

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [
          'Frontend plan may be missing HTML/markup steps',
          'Frontend plan may be missing CSS/styling steps',
          'Frontend plan may be missing JavaScript steps'
        ]
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      const stepNames = refinedPlan.steps.map(step => step.name.toLowerCase());
      expect(stepNames.some(name => name.includes('html') || name.includes('markup'))).toBe(true);
      expect(stepNames.some(name => name.includes('css') || name.includes('style'))).toBe(true);
      expect(stepNames.some(name => name.includes('javascript') || name.includes('script'))).toBe(true);
    });
  });

  describe('Preservation and Safety', () => {
    test('should preserve existing user steps when configured', async () => {
      const preservingRefiner = new PlanRefiner({ preserveUserSteps: true });
      
      const userStep = new PlanStep({
        id: 'user-step',
        name: 'User Created Step',
        type: 'implementation'
      });
      plan.addStep(userStep);

      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'], // This should not remove user step
        warnings: ['Plan is missing setup steps']
      };

      const refinedPlan = await preservingRefiner.refine(plan, validationResult, context);

      const preservedStep = refinedPlan.getStepById('user-step');
      expect(preservedStep).toBeDefined();
      expect(preservedStep.name).toBe('User Created Step');
    });

    test('should not exceed maximum refinements', async () => {
      const limitedRefiner = new PlanRefiner({ maxRefinements: 2 });

      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: ['Plan is missing setup steps', 'Plan is missing testing steps']
      };

      const refinedPlan = await limitedRefiner.refine(plan, validationResult, context);

      expect(refinedPlan.metadata.refinements.length).toBeLessThanOrEqual(2);
    });

    test('should not modify plan when autoFix is disabled', async () => {
      const manualRefiner = new PlanRefiner({ autoFix: false });

      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await manualRefiner.refine(plan, validationResult, context);

      expect(refinedPlan).toBe(plan);
      expect(refinedPlan.steps).toHaveLength(0);
    });
  });

  describe('Context-Aware Refinement', () => {
    test('should refine based on project type', async () => {
      const backendContext = new PlanContext({
        projectType: 'backend',
        technologies: { backend: ['nodejs', 'express'] }
      });

      const backendPlan = new Plan({
        name: 'Backend Plan',
        description: 'A backend plan',
        context: backendContext.toJSON()
      });

      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(backendPlan, validationResult, backendContext);

      const stepNames = refinedPlan.steps.map(step => step.name.toLowerCase());
      expect(stepNames.some(name => 
        name.includes('server') || name.includes('api') || name.includes('backend')
      )).toBe(true);
    });

    test('should consider technology stack in refinements', async () => {
      const reactContext = new PlanContext({
        projectType: 'frontend',
        technologies: { frontend: ['react', 'typescript'] }
      });

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: ['Frontend plan may be missing JavaScript steps']
      };

      const refinedPlan = await refiner.refine(plan, validationResult, reactContext);

      const stepNames = refinedPlan.steps.map(step => step.name.toLowerCase());
      // Should add React/TypeScript specific steps if technologies are considered
      expect(refinedPlan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Refinement Strategies', () => {
    test('should apply multiple refinement strategies', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: ['Plan is missing setup steps', 'Plan is missing testing steps']
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.steps.length).toBeGreaterThan(2); // Should address multiple issues
      expect(refinedPlan.steps.some(step => step.type === 'setup')).toBe(true);
      expect(refinedPlan.steps.some(step => step.type === 'testing')).toBe(true);
    });

    test('should prioritize error fixes over warning improvements', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: ['Plan is missing setup steps']
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      // Should have addressed the error (added steps) and ideally the warning too
      expect(refinedPlan.steps.length).toBeGreaterThan(0);
      
      // Verify refinement metadata tracks what was fixed
      expect(refinedPlan.metadata.refinements.some(r => 
        r.type === 'error-fix'
      )).toBe(true);
    });

    test('should create logical step dependencies', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      // Check that generated steps have logical dependencies
      const setupSteps = refinedPlan.steps.filter(step => step.type === 'setup');
      const implSteps = refinedPlan.steps.filter(step => step.type === 'implementation');

      if (setupSteps.length > 0 && implSteps.length > 0) {
        // Implementation steps should depend on setup steps
        const hasLogicalDeps = implSteps.some(impl => 
          impl.dependencies.some(depId => 
            setupSteps.some(setup => setup.id === depId)
          )
        );
        expect(hasLogicalDeps).toBe(true);
      }
    });
  });

  describe('Refinement History and Tracking', () => {
    test('should track refinement history', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: ['Plan is missing setup steps']
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.metadata.refinements).toBeDefined();
      expect(Array.isArray(refinedPlan.metadata.refinements)).toBe(true);
      expect(refinedPlan.metadata.refinements.length).toBeGreaterThan(0);

      const firstRefinement = refinedPlan.metadata.refinements[0];
      expect(firstRefinement.timestamp).toBeDefined();
      expect(firstRefinement.type).toBeDefined();
      expect(firstRefinement.description).toBeDefined();
    });

    test('should preserve previous refinement history', async () => {
      // Add existing refinement history
      plan.metadata.refinements = [{
        timestamp: Date.now() - 1000,
        type: 'manual',
        description: 'Previous manual refinement'
      }];

      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, context);

      expect(refinedPlan.metadata.refinements.length).toBeGreaterThan(1);
      expect(refinedPlan.metadata.refinements[0].type).toBe('manual');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle plans with no validation result', async () => {
      const refinedPlan = await refiner.refine(plan, null, context);
      expect(refinedPlan).toBe(plan); // Should return unchanged
    });

    test('should handle invalid validation results gracefully', async () => {
      const invalidValidationResult = { /* missing required fields */ };

      const refinedPlan = await refiner.refine(plan, invalidValidationResult, context);
      expect(refinedPlan).toBeDefined();
    });

    test('should handle missing context gracefully', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan must contain at least one step'],
        warnings: []
      };

      const refinedPlan = await refiner.refine(plan, validationResult, null);
      expect(refinedPlan).toBeDefined();
      expect(refinedPlan.steps.length).toBeGreaterThan(0);
    });
  });
});