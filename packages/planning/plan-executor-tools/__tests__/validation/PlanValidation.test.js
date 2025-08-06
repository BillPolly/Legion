/**
 * Comprehensive tests for plan validation system
 */

import { describe, it, expect } from '@jest/globals';
import { PlanInspectorTool } from '../../src/PlanInspectorTool.js';
import { ValidatePlanTool } from '../../src/ValidatePlanTool.js';
import { validatePlanSchema, detectPlanFormat, formatSchemaErrors } from '../../src/schemas/PlanSchemaZod.js';

// Mock ModuleLoader for tool validation
class MockModuleLoader {
  constructor() {
    this.tools = new Map();
    this.schemas = new Map();
  }
  
  addTool(name, tool, schema = null) {
    this.tools.set(name, tool);
    if (schema) {
      this.schemas.set(name, schema);
    }
  }
  
  async getToolByNameOrAlias(name) {
    return this.tools.get(name) || null;
  }
  
  async getToolSchema(name) {
    return this.schemas.get(name) || null;
  }
  
  hasTool(name) {
    return this.tools.has(name);
  }
}

describe('Plan Validation System', () => {
  describe('Schema Validation', () => {
    it('should validate a well-formed plan', () => {
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        description: 'A test plan',
        version: '1.0.0',
        status: 'draft',
        steps: [
          {
            id: 'step-1',
            name: 'First Step',
            actions: [
              {
                type: 'file_write',
                inputs: {
                  filepath: '/test/file.txt',
                  content: 'test content'
                }
              }
            ]
          }
        ]
      };
      
      const result = validatePlanSchema(plan);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should reject plan missing required fields', () => {
      const plan = {
        description: 'Missing id and name'
      };
      
      const result = validatePlanSchema(plan);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.path.includes('id'))).toBe(true);
      expect(result.errors.some(e => e.path.includes('name'))).toBe(true);
      expect(result.errors.some(e => e.path.includes('steps'))).toBe(true);
    });
    
    it('should validate plan with invalid ID format', () => {
      const plan = {
        id: '123-invalid!@#',
        name: 'Test Plan',
        steps: []
      };
      
      const result = validatePlanSchema(plan);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('alphanumeric'))).toBe(true);
    });
    
    it('should validate semantic version format', () => {
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        version: 'not-a-version',
        steps: []
      };
      
      const result = validatePlanSchema(plan);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('semantic versioning'))).toBe(true);
    });
    
    it('should reject step with both actions and sub-steps', () => {
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        steps: [
          {
            id: 'step-1',
            actions: [{ type: 'test', inputs: {} }],
            steps: [{ id: 'sub-1' }]
          }
        ]
      };
      
      const result = validatePlanSchema(plan);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('cannot have both actions and sub-steps'))).toBe(true);
    });
    
    it('should detect plan format correctly', () => {
      const newFormatPlan = {
        id: 'new',
        name: 'New Format',
        steps: [
          {
            id: 'step-1',
            actions: [
              { type: 'test', inputs: {}, outputs: {} }
            ]
          }
        ]
      };
      
      const legacyFormatPlan = {
        id: 'legacy',
        name: 'Legacy Format',
        steps: [
          {
            id: 'step-1',
            actions: [
              { type: 'test', parameters: {} }
            ]
          }
        ]
      };
      
      const mixedFormatPlan = {
        id: 'mixed',
        name: 'Mixed Format',
        steps: [
          {
            id: 'step-1',
            actions: [
              { type: 'test1', inputs: {} },
              { type: 'test2', parameters: {} }
            ]
          }
        ]
      };
      
      expect(detectPlanFormat(newFormatPlan)).toBe('new');
      expect(detectPlanFormat(legacyFormatPlan)).toBe('legacy');
      expect(detectPlanFormat(mixedFormatPlan)).toBe('mixed');
    });
    
    it('should format schema errors nicely', () => {
      const errors = [
        { path: 'id', message: 'Plan ID is required', code: 'invalid_type' },
        { path: 'steps.0.id', message: 'Step ID cannot be empty', code: 'too_small' }
      ];
      
      const formatted = formatSchemaErrors(errors);
      expect(formatted).toContain("at 'id': Plan ID is required");
      expect(formatted).toContain("at 'steps.0.id': Step ID cannot be empty");
    });
  });
  
  describe('Tool Validation', () => {
    it('should validate available tools', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('file_write', { name: 'file_write' }, {
        inputSchema: { properties: { filepath: { type: 'string' }, content: { type: 'any' } } }
      });
      moduleLoader.addTool('directory_create', { name: 'directory_create' }, {
        inputSchema: { properties: { dirpath: { type: 'string' } } }
      });
      
      const inspector = new PlanInspectorTool(moduleLoader);
      
      const plan = {
        id: 'tool-test',
        name: 'Tool Test',
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'file_write',
                inputs: { filepath: '/test.txt', content: 'test' }
              },
              {
                type: 'directory_create',
                inputs: { dirpath: '/test' }
              }
            ]
          }
        ]
      };
      
      const result = await inspector.execute({
        plan,
        validateTools: true
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);
      expect(result.toolAnalysis.requiredTools).toContain('file_write');
      expect(result.toolAnalysis.requiredTools).toContain('directory_create');
      expect(result.toolAnalysis.toolStatus['file_write'].available).toBe(true);
      expect(result.toolAnalysis.toolStatus['directory_create'].available).toBe(true);
    });
    
    // Note: Tool unavailability detection is tested via ValidatePlanTool tests
    
    // Note: Tool input/output field validation is covered by integration tests with real module loader
  });
  
  describe('Variable Flow Analysis', () => {
    it('should track variable definitions and usage', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('directory_create', { name: 'directory_create' }, {});
      moduleLoader.addTool('file_write', { name: 'file_write' }, {});
      
      const inspector = new PlanInspectorTool(moduleLoader);
      
      const plan = {
        id: 'var-flow-test',
        name: 'Variable Flow Test',
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'directory_create',
                inputs: { dirpath: '/test' },
                outputs: { dirpath: 'testDir' }
              }
            ]
          },
          {
            id: 'step-2',
            dependencies: ['step-1'],
            actions: [
              {
                type: 'file_write',
                inputs: {
                  filepath: '@testDir/file.txt',
                  content: 'test'
                },
                outputs: {
                  filepath: 'filePath'
                }
              }
            ]
          }
        ]
      };
      
      const result = await inspector.execute({
        plan,
        analyzeDepth: 'deep'
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);
      expect(result.variableFlowAnalysis.errors).toEqual([]);
      expect(result.variableFlowAnalysis.variableDefinitions).toHaveProperty('testDir');
      expect(result.variableFlowAnalysis.variableDefinitions).toHaveProperty('filePath');
      expect(result.variableFlowAnalysis.variableUsage).toHaveProperty('testDir');
    });
    
    it('should detect undefined variable usage', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('file_write', { name: 'file_write' }, {});
      
      const inspector = new PlanInspectorTool(moduleLoader);
      
      const plan = {
        id: 'undefined-var-test',
        name: 'Undefined Variable Test',
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'file_write',
                inputs: {
                  filepath: '@undefinedVar/file.txt',
                  content: 'test'
                }
              }
            ]
          }
        ]
      };
      
      const result = await inspector.execute({
        plan,
        analyzeDepth: 'deep'
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.variableFlowAnalysis.errors.some(e => 
        e.includes("variable '@undefinedVar' used") && e.includes('is not defined')
      )).toBe(true);
    });
    
    it('should warn about unused variables', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('directory_create', { name: 'directory_create' }, {});
      
      const inspector = new PlanInspectorTool(moduleLoader);
      
      const plan = {
        id: 'unused-var-test',
        name: 'Unused Variable Test',
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'directory_create',
                inputs: { dirpath: '/test' },
                outputs: { 
                  dirpath: 'unusedDir',
                  created: 'unusedFlag'
                }
              }
            ]
          }
        ]
      };
      
      const result = await inspector.execute({
        plan,
        analyzeDepth: 'deep'
      });
      
      expect(result.success).toBe(true);
      expect(result.variableFlowAnalysis.warnings.some(w => 
        w.includes("Variable 'unusedDir'") && w.includes('is never used')
      )).toBe(true);
      expect(result.variableFlowAnalysis.warnings.some(w => 
        w.includes("Variable 'unusedFlag'") && w.includes('is never used')
      )).toBe(true);
    });
    
    it('should handle plan inputs as available variables', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('file_write', { name: 'file_write' }, {});
      
      const inspector = new PlanInspectorTool(moduleLoader);
      
      const plan = {
        id: 'plan-inputs-test',
        name: 'Plan Inputs Test',
        inputs: [
          { name: 'PROJECT_DIR', type: 'string', required: true }
        ],
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'file_write',
                inputs: {
                  filepath: '@PROJECT_DIR/README.md',
                  content: 'Test'
                }
              }
            ]
          }
        ]
      };
      
      const result = await inspector.execute({
        plan,
        analyzeDepth: 'deep'
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(true);
      expect(result.variableFlowAnalysis.errors).toEqual([]);
      expect(result.variableFlowAnalysis.availableVariables).toContain('PROJECT_DIR');
    });
  });
  
  describe('Dependency Analysis', () => {
    it('should detect nonexistent dependencies', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('file_write', { name: 'file_write' }, {});
      
      const inspector = new PlanInspectorTool(moduleLoader);
      
      const plan = {
        id: 'nonexistent-dep-test',
        name: 'Nonexistent Dependency Test',
        steps: [
          {
            id: 'step-1',
            dependencies: ['nonexistent-step'],
            actions: [{ type: 'file_write', inputs: { filepath: '/test.txt', content: 'test' } }]
          }
        ]
      };
      
      const result = await inspector.execute({
        plan,
        showDependencies: true
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.dependencyAnalysis.errors.some(e => 
        e.includes('depends on nonexistent step: nonexistent-step')
      )).toBe(true);
    });
  });
  
  describe('ValidatePlanTool', () => {
    it('should mark valid plan as validated', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('file_write', { name: 'file_write' }, {});
      
      const validator = new ValidatePlanTool(moduleLoader);
      
      const plan = {
        id: 'valid-plan',
        name: 'Valid Plan',
        status: 'draft',
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'file_write',
                inputs: { filepath: '/test.txt', content: 'test' }
              }
            ]
          }
        ]
      };
      
      const result = await validator.execute({
        plan,
        markAsValidated: true
      });
      
      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.validatedPlan).toBeDefined();
      expect(result.validatedPlan.status).toBe('validated');
      expect(result.message).toContain('validated successfully');
    });
    
    it('should not mark invalid plan', async () => {
      const moduleLoader = new MockModuleLoader();
      moduleLoader.addTool('file_write', { name: 'file_write' }, {});
      
      const validator = new ValidatePlanTool(moduleLoader);
      
      const plan = {
        id: 'invalid-plan',
        name: 'Invalid Plan',
        status: 'draft',
        steps: [
          {
            id: 'step-1',
            actions: [
              {
                type: 'nonexistent_tool',
                inputs: {}
              }
            ]
          }
        ]
      };
      
      const result = await validator.execute({
        plan,
        markAsValidated: true
      });
      
      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.validatedPlan).toBeUndefined();
      expect(result.message).toContain('validation failed');
    });
  });
});