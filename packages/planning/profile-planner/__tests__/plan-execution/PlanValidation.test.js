import { describe, test, expect, beforeAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Plan Validation', () => {
  let planData;
  
  beforeAll(async () => {
    // Load the generated plan
    const planPath = path.join(__dirname, 'node-addition-api-plan.json');
    const planContent = await fs.readFile(planPath, 'utf8');
    planData = JSON.parse(planContent);
  });
  
  describe('Plan Structure Validation', () => {
    test('should have valid plan structure', () => {
      expect(planData).toBeDefined();
      expect(planData.id).toBe('plan-m59mlkdr9-6o0ovzdjy');
      expect(planData.name).toBe('Create Addition API Server');
      expect(planData.description).toBeTruthy();
      expect(planData.version).toBe('1.0.0');
    });
    
    test('should have valid metadata', () => {
      expect(planData.metadata).toBeDefined();
      expect(planData.metadata.createdAt).toBeTruthy();
      expect(planData.metadata.createdBy).toBe('ProfilePlannerTool');
      expect(planData.metadata.estimatedDuration).toBe(15);
      expect(planData.metadata.complexity).toBe('medium');
      expect(planData.metadata.profile).toBe('javascript-development');
    });
    
    test('should have valid context', () => {
      expect(planData.context).toBeDefined();
      expect(planData.context.task).toBeTruthy();
      expect(planData.context.profile).toBe('javascript-development');
    });
    
    test('should have steps array', () => {
      expect(planData.steps).toBeInstanceOf(Array);
      expect(planData.steps.length).toBe(5);
    });
    
    test('should have execution order', () => {
      expect(planData.executionOrder).toBeInstanceOf(Array);
      expect(planData.executionOrder).toEqual([
        'step-1',
        'step-2',
        'step-3',
        'step-4',
        'step-5'
      ]);
    });
    
    test('should have success criteria', () => {
      expect(planData.successCriteria).toBeInstanceOf(Array);
      expect(planData.successCriteria.length).toBeGreaterThan(0);
    });
  });
  
  describe('Step Validation', () => {
    test('all steps should have required fields', () => {
      planData.steps.forEach((step, index) => {
        expect(step.id).toBeTruthy();
        expect(step.name).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(step.type).toBe('action');
        expect(step.estimatedDuration).toBeGreaterThan(0);
        expect(step.inputs).toBeInstanceOf(Array);
        expect(step.outputs).toBeInstanceOf(Array);
        expect(step.actions).toBeInstanceOf(Array);
        expect(step.dependencies).toBeInstanceOf(Array);
      });
    });
    
    test('all actions should have valid structure', () => {
      planData.steps.forEach(step => {
        step.actions.forEach(action => {
          expect(action.id).toBeTruthy();
          expect(action.type).toBeTruthy();
          expect(action.parameters).toBeDefined();
          
          // Validate specific action types
          if (action.type === 'file_write') {
            expect(action.parameters.filepath).toBeTruthy();
            expect(action.parameters.content).toBeTruthy();
          } else if (action.type === 'node_run_command') {
            expect(action.parameters.command).toBeTruthy();
          }
        });
      });
    });
    
    test('dependencies should reference existing steps', () => {
      const stepIds = planData.steps.map(s => s.id);
      
      planData.steps.forEach(step => {
        step.dependencies.forEach(depId => {
          expect(stepIds).toContain(depId);
        });
      });
    });
  });
  
  describe('Input/Output Flow Validation', () => {
    test('each step should have inputs satisfied by previous outputs', () => {
      const availableOutputs = new Set(planData.inputs || []);
      
      // Process in execution order
      const executionOrder = planData.executionOrder;
      
      for (const stepId of executionOrder) {
        const step = planData.steps.find(s => s.id === stepId);
        
        // Check inputs (except for first step which has no inputs)
        if (step.inputs.length > 0) {
          step.inputs.forEach(input => {
            expect(availableOutputs.has(input)).toBe(true);
          });
        }
        
        // Add outputs
        step.outputs.forEach(output => {
          availableOutputs.add(output);
        });
      }
    });
  });
  
  describe('Action Type Validation', () => {
    test('all actions should use valid types for javascript profile', () => {
      const validActionTypes = ['file_write', 'command_executor'];
      
      planData.steps.forEach(step => {
        step.actions.forEach(action => {
          expect(validActionTypes).toContain(action.type);
        });
      });
    });
    
    test('file_write actions should have valid parameters', () => {
      planData.steps.forEach(step => {
        step.actions
          .filter(a => a.type === 'file_write')
          .forEach(action => {
            expect(action.parameters.filepath).toBeTruthy();
            expect(typeof action.parameters.filepath).toBe('string');
            expect(action.parameters.content).toBeTruthy();
            expect(typeof action.parameters.content).toBe('string');
          });
      });
    });
    
    test('command_executor actions should have valid parameters', () => {
      planData.steps.forEach(step => {
        step.actions
          .filter(a => a.type === 'command_executor')
          .forEach(action => {
            expect(action.parameters.command).toBeTruthy();
            expect(typeof action.parameters.command).toBe('string');
          });
      });
    });
  });
  
  describe('Plan Readiness for Execution', () => {
    test('plan should be ready for execution', () => {
      // Verify plan structure is ready
      expect(planData.steps.length).toBeGreaterThan(0);
      expect(planData.executionOrder.length).toBe(planData.steps.length);
      
      // All steps should have actions
      planData.steps.forEach(step => {
        expect(step.actions.length).toBeGreaterThan(0);
      });
    });
  });
});