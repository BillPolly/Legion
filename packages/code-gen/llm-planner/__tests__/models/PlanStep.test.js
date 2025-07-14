/**
 * Tests for PlanStep model
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanStep } from '../../src/models/PlanStep.js';

describe('PlanStep', () => {
  let stepData;

  beforeEach(() => {
    stepData = {
      id: 'step-123',
      name: 'Initialize project structure',
      description: 'Create the initial project directory structure and configuration files',
      type: 'setup',
      status: 'pending',
      dependencies: [],
      inputs: {
        projectName: 'todo-app',
        projectType: 'fullstack'
      },
      outputs: {
        directories: ['src', 'public', 'server'],
        files: ['package.json', 'README.md', '.gitignore']
      },
      actions: [
        {
          type: 'create-directory',
          path: 'todo-app',
          recursive: true
        },
        {
          type: 'create-file',
          path: 'todo-app/package.json',
          content: '{\n  "name": "todo-app",\n  "version": "1.0.0"\n}'
        }
      ],
      validation: {
        criteria: [
          'Directory structure exists',
          'Package.json is valid JSON',
          'All required files created'
        ],
        validators: [
          { type: 'path-exists', path: 'todo-app' },
          { type: 'file-valid-json', path: 'todo-app/package.json' }
        ]
      },
      rollback: {
        actions: [
          {
            type: 'delete-directory',
            path: 'todo-app',
            recursive: true
          }
        ]
      },
      estimatedDuration: 5,
      retryable: true,
      maxRetries: 3
    };
  });

  describe('Constructor', () => {
    test('should create a PlanStep instance with all properties', () => {
      const step = new PlanStep(stepData);

      expect(step.id).toBe('step-123');
      expect(step.name).toBe('Initialize project structure');
      expect(step.description).toBe(stepData.description);
      expect(step.type).toBe('setup');
      expect(step.status).toBe('pending');
      expect(step.dependencies).toEqual([]);
      expect(step.inputs).toEqual(stepData.inputs);
      expect(step.outputs).toEqual(stepData.outputs);
      expect(step.actions).toHaveLength(2);
      expect(step.validation).toEqual(stepData.validation);
      expect(step.rollback).toEqual(stepData.rollback);
      expect(step.estimatedDuration).toBe(5);
      expect(step.retryable).toBe(true);
      expect(step.maxRetries).toBe(3);
    });

    test('should generate ID if not provided', () => {
      const dataWithoutId = { ...stepData };
      delete dataWithoutId.id;
      
      const step = new PlanStep(dataWithoutId);
      
      expect(step.id).toBeDefined();
      expect(step.id).toMatch(/^step-[a-z0-9-]+$/);
    });

    test('should set default values', () => {
      const minimalData = {
        name: 'Test Step'
      };
      
      const step = new PlanStep(minimalData);
      
      expect(step.type).toBe('implementation');
      expect(step.status).toBe('pending');
      expect(step.dependencies).toEqual([]);
      expect(step.inputs).toEqual({});
      expect(step.outputs).toEqual({});
      expect(step.actions).toEqual([]);
      expect(step.retryable).toBe(true);
      expect(step.maxRetries).toBe(3);
    });

    test('should validate step type', () => {
      const validTypes = ['setup', 'implementation', 'integration', 'testing', 'validation', 'deployment'];
      
      validTypes.forEach(type => {
        const step = new PlanStep({ name: 'Test', type });
        expect(step.type).toBe(type);
      });
    });

    test('should throw error for invalid step type', () => {
      expect(() => {
        new PlanStep({ name: 'Test', type: 'invalid-type' });
      }).toThrow('Invalid step type: invalid-type');
    });

    test('should validate status', () => {
      const validStatuses = ['pending', 'in-progress', 'completed', 'failed', 'skipped'];
      
      validStatuses.forEach(status => {
        const step = new PlanStep({ name: 'Test', status });
        expect(step.status).toBe(status);
      });
    });
  });

  describe('Methods', () => {
    test('should update status', () => {
      const step = new PlanStep(stepData);
      
      step.updateStatus('in-progress');
      expect(step.status).toBe('in-progress');
      
      step.updateStatus('completed');
      expect(step.status).toBe('completed');
    });

    test('should track status history', () => {
      const step = new PlanStep(stepData);
      
      step.updateStatus('in-progress');
      step.updateStatus('completed');
      
      const history = step.getStatusHistory();
      expect(history).toHaveLength(3); // pending, in-progress, completed
      expect(history[0].status).toBe('pending');
      expect(history[1].status).toBe('in-progress');
      expect(history[2].status).toBe('completed');
    });

    test('should add dependencies', () => {
      const step = new PlanStep(stepData);
      
      step.addDependency('step-456');
      
      expect(step.dependencies).toContain('step-456');
    });

    test('should not add duplicate dependencies', () => {
      const step = new PlanStep({ ...stepData, dependencies: ['step-456'] });
      
      step.addDependency('step-456');
      
      expect(step.dependencies).toHaveLength(1);
    });

    test('should remove dependencies', () => {
      const step = new PlanStep({ ...stepData, dependencies: ['step-456', 'step-789'] });
      
      step.removeDependency('step-456');
      
      expect(step.dependencies).toEqual(['step-789']);
    });

    test('should add actions', () => {
      const step = new PlanStep(stepData);
      const newAction = {
        type: 'run-command',
        command: 'npm install'
      };
      
      step.addAction(newAction);
      
      expect(step.actions).toHaveLength(3);
      expect(step.actions[2]).toEqual(newAction);
    });

    test('should validate step completeness', () => {
      const step = new PlanStep(stepData);
      
      const validation = step.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const step = new PlanStep({});
      
      const validation = step.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Step name is required');
    });

    test('should detect invalid actions', () => {
      const step = new PlanStep({
        name: 'Test Step',
        actions: [
          { type: 'create-file' } // Missing required 'path' field
        ]
      });
      
      const validation = step.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Action of type create-file is missing required field: path');
    });

    test('should check if step can be executed', () => {
      const step = new PlanStep(stepData);
      const completedSteps = ['step-1', 'step-2'];
      
      expect(step.canExecute(completedSteps)).toBe(true);
    });

    test('should check if step cannot be executed due to dependencies', () => {
      const step = new PlanStep({
        ...stepData,
        dependencies: ['step-999']
      });
      const completedSteps = ['step-1', 'step-2'];
      
      expect(step.canExecute(completedSteps)).toBe(false);
    });

    test('should estimate completion percentage', () => {
      const step = new PlanStep({
        ...stepData,
        actions: [
          { type: 'action1', completed: true },
          { type: 'action2', completed: true },
          { type: 'action3', completed: false },
          { type: 'action4', completed: false }
        ]
      });
      
      expect(step.getCompletionPercentage()).toBe(50);
    });

    test('should clone the step', () => {
      const step = new PlanStep(stepData);
      
      const cloned = step.clone();
      
      expect(cloned).not.toBe(step);
      expect(cloned.id).not.toBe(step.id);
      expect(cloned.name).toBe(step.name);
      expect(cloned.actions).toEqual(step.actions);
    });

    test('should export to JSON', () => {
      const step = new PlanStep(stepData);
      
      const json = step.toJSON();
      
      expect(json).toMatchObject({
        id: step.id,
        name: step.name,
        type: step.type,
        status: step.status,
        dependencies: step.dependencies,
        actions: step.actions
      });
    });

    test('should create from JSON', () => {
      const json = {
        id: 'imported-step',
        name: 'Imported Step',
        type: 'setup',
        actions: [{ type: 'test-action' }]
      };
      
      const step = PlanStep.fromJSON(json);
      
      expect(step).toBeInstanceOf(PlanStep);
      expect(step.id).toBe('imported-step');
      expect(step.name).toBe('Imported Step');
    });

    test('should track execution attempts', () => {
      const step = new PlanStep(stepData);
      
      step.recordExecutionAttempt({ success: false, error: 'Network error' });
      step.recordExecutionAttempt({ success: true });
      
      const attempts = step.getExecutionAttempts();
      expect(attempts).toHaveLength(2);
      expect(attempts[0].success).toBe(false);
      expect(attempts[1].success).toBe(true);
    });

    test('should check if max retries exceeded', () => {
      const step = new PlanStep({ ...stepData, maxRetries: 2 });
      
      step.recordExecutionAttempt({ success: false });
      expect(step.hasExceededMaxRetries()).toBe(false);
      
      step.recordExecutionAttempt({ success: false });
      expect(step.hasExceededMaxRetries()).toBe(true);
    });

    test('should merge outputs', () => {
      const step = new PlanStep(stepData);
      
      step.mergeOutputs({
        files: ['new-file.js'],
        data: { key: 'value' }
      });
      
      expect(step.outputs.files).toContain('new-file.js');
      expect(step.outputs.data).toEqual({ key: 'value' });
    });
  });

  describe('Action Types', () => {
    test('should validate create-directory action', () => {
      const step = new PlanStep({
        name: 'Test',
        actions: [{
          type: 'create-directory',
          path: '/test/path',
          recursive: true
        }]
      });
      
      const validation = step.validate();
      expect(validation.isValid).toBe(true);
    });

    test('should validate create-file action', () => {
      const step = new PlanStep({
        name: 'Test',
        actions: [{
          type: 'create-file',
          path: '/test/file.js',
          content: 'console.log("test");'
        }]
      });
      
      const validation = step.validate();
      expect(validation.isValid).toBe(true);
    });

    test('should validate run-command action', () => {
      const step = new PlanStep({
        name: 'Test',
        actions: [{
          type: 'run-command',
          command: 'npm install',
          cwd: '/project'
        }]
      });
      
      const validation = step.validate();
      expect(validation.isValid).toBe(true);
    });
  });
});