/**
 * Unit tests for ExecutionValidator class
 * Tests validation framework for task execution including pre/post validation,
 * tool existence checks, schema validation, and custom validators
 */

import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ExecutionValidator } from '../../../../src/core/validation/ExecutionValidator.js';
import { Logger } from '../../../../src/utils/Logger.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ExecutionValidator', () => {
  let validator;
  let mockLogger;
  let mockToolRegistry;
  let testDir;

  beforeEach(async () => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockToolRegistry = {
      getTool: jest.fn()
    };

    validator = new ExecutionValidator({
      logger: mockLogger,
      toolRegistry: mockToolRegistry,
      enableStrictValidation: true
    });

    // Create temporary directory for file tests
    testDir = join(tmpdir(), 'execution-validator-test-' + Date.now());
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultValidator = new ExecutionValidator();
      expect(defaultValidator.enableStrictValidation).toBe(true);
      expect(defaultValidator.customValidators.size).toBeGreaterThan(0);
      expect(defaultValidator.preValidators).toEqual([]);
      expect(defaultValidator.postValidators).toEqual([]);
    });

    it('should accept custom options', () => {
      const customValidator = new ExecutionValidator({
        enableStrictValidation: false,
        logger: mockLogger,
        toolRegistry: mockToolRegistry
      });

      expect(customValidator.enableStrictValidation).toBe(false);
      expect(customValidator.logger).toBe(mockLogger);
      expect(customValidator.toolRegistry).toBe(mockToolRegistry);
    });

    it('should register default validators', () => {
      expect(validator.customValidators.has('file_content')).toBe(true);
      expect(validator.customValidators.has('result_type')).toBe(true);
      expect(validator.customValidators.has('non_empty')).toBe(true);
    });
  });

  describe('setToolRegistry', () => {
    it('should update tool registry', () => {
      const newToolRegistry = { getTool: jest.fn() };
      validator.setToolRegistry(newToolRegistry);
      expect(validator.toolRegistry).toBe(newToolRegistry);
    });
  });

  describe('validateBeforeExecution', () => {
    it('should validate basic task with description', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task description'
      };
      const context = {};

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.phase).toBe('pre-execution');
    });

    it('should validate task with tool', async () => {
      mockToolRegistry.getTool.mockResolvedValue({
        name: 'test_tool',
        execute: jest.fn(),
        inputSchema: { type: 'object' }
      });

      const task = {
        id: 'test-task',
        tool: 'test_tool',
        params: { input: 'test' }
      };
      const context = {};

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(true);
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('test_tool');
    });

    it('should fail validation for missing tool', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);

      const task = {
        id: 'test-task',
        tool: 'missing_tool'
      };
      const context = {};

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool not found: missing_tool');
    });

    it('should warn about tool without execute method', async () => {
      mockToolRegistry.getTool.mockResolvedValue({
        name: 'broken_tool'
        // No execute method
      });

      const task = {
        id: 'test-task',
        tool: 'broken_tool'
      };
      const context = {};

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(true); // Tool exists so valid is true  
      expect(result.warnings).toContain("Tool 'broken_tool' exists but has no execute method");
    });

    it('should validate context requirements', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        requires: ['userId', 'sessionId']
      };
      const context = {
        userId: '123',
        sessionId: 'session-456'
      };

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing context requirements', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        requires: ['userId', 'missingKey']
      };
      const context = {
        userId: '123'
      };

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required context: missingKey');
    });

    it('should validate input parameters against schema', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true },
            age: { type: 'number' }
          }
        },
        params: {
          name: 'John',
          age: 30
        }
      };
      const context = {};

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(true);
    });

    it('should fail validation for invalid input parameters', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true }
          }
        },
        params: {
          name: 123 // Wrong type
        }
      };
      const context = {};

      const result = await validator.validateBeforeExecution(task, context);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Input parameter validation'))).toBe(true);
    });

    it('should handle validation process errors gracefully', async () => {
      // Create a task that will cause validator to throw
      const task = {
        id: 'test-task',
        tool: 'error_tool'
      };
      
      mockToolRegistry.getTool.mockRejectedValue(new Error('Registry error'));

      const result = await validator.validateBeforeExecution(task, {});

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe('Tool not found: error_tool');
    });
  });

  describe('validateAfterExecution', () => {
    it('should validate successful task execution result', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task'
      };
      const result = { success: true, data: 'test result' };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.phase).toBe('post-execution');
    });

    it('should validate output schema', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'string' }
          }
        }
      };
      const result = { success: true, data: 'test result' };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.checks.some(c => c.name === 'output_schema')).toBe(true);
    });

    it('should fail validation for output schema mismatch', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      };
      const result = { success: 'not-a-boolean' }; // Wrong type
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(e => e.includes('Output schema validation failed'))).toBe(true);
    });

    it('should validate file creation', async () => {
      const testFile = join(testDir, 'test-output.txt');
      await writeFile(testFile, 'test content');

      const task = {
        id: 'test-task',
        description: 'Test task',
        createsFiles: [testFile]
      };
      const result = { success: true };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.checks.some(c => c.name === `file_${testFile}` && c.passed)).toBe(true);
    });

    it('should fail validation for missing files', async () => {
      const missingFile = join(testDir, 'missing-file.txt');

      const task = {
        id: 'test-task',
        description: 'Test task',
        createsFiles: [missingFile]
      };
      const result = { success: true };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain(`Expected file not created: ${missingFile}`);
    });

    it('should validate tool result format', async () => {
      const task = {
        id: 'test-task',
        tool: 'test_tool'
      };
      const result = { success: true, data: 'tool output' };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.checks.some(c => c.name === 'tool_result_format')).toBe(true);
    });

    it('should execute custom validators', async () => {
      const customValidator = jest.fn().mockReturnValue(true);
      Object.defineProperty(customValidator, 'name', { value: 'custom_test_validator', writable: true });

      const task = {
        id: 'test-task',
        description: 'Test task',
        validators: [customValidator]
      };
      const result = { success: true };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(customValidator).toHaveBeenCalledWith(result, context, task);
      expect(validationResult.checks.some(c => c.name === 'custom_test_validator' && c.passed)).toBe(true);
    });

    it('should handle custom validator failures', async () => {
      const failingValidator = jest.fn().mockReturnValue(false);
      Object.defineProperty(failingValidator, 'name', { value: 'failing_validator', writable: true });

      const task = {
        id: 'test-task',
        description: 'Test task',
        validators: [failingValidator]
      };
      const result = { success: true };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain('Custom validator failed: failing_validator');
    });

    it('should handle custom validator errors', async () => {
      const errorValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validator crashed');
      });
      Object.defineProperty(errorValidator, 'name', { value: 'error_validator', writable: true });

      const task = {
        id: 'test-task',
        description: 'Test task',
        validators: [errorValidator]
      };
      const result = { success: true };
      const context = {};

      const validationResult = await validator.validateAfterExecution(task, result, context);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain('Custom validator error: Validator crashed');
    });
  });

  describe('validateTaskStructure', () => {
    it('should validate well-formed task', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task description',
        dependencies: ['dep1', 'dep2'],
        atomic: true
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail for task without execution instruction', async () => {
      const task = {
        id: 'test-task'
        // No description, prompt, operation, tool, etc.
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toContain('Task must have description, prompt, operation, tool, or executable function');
    });

    it('should warn about missing ID', async () => {
      const task = {
        description: 'Test task'
        // No id
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.warnings).toContain('Task has no ID - one will be generated automatically');
    });

    it('should warn about non-boolean atomic flag', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        atomic: 'yes' // Should be boolean
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.warnings).toContain('atomic flag should be boolean');
    });

    it('should warn about multiple execution methods', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        tool: 'test_tool',
        execute: () => {}
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.warnings).toContain('Task has multiple execution methods - precedence is tool > function > LLM');
    });

    it('should validate dependencies format', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        dependencies: ['string-dep', { id: 'object-dep' }]
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid dependencies format', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        dependencies: 'not-an-array'
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toContain('dependencies must be an array');
    });

    it('should fail for invalid dependency objects', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        dependencies: [{ name: 'no-id' }] // Missing id/taskId
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toContain('dependency at index 0 must be string or have id/taskId');
    });

    it('should validate subtasks format', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        subtasks: [
          { id: 'subtask1', description: 'Subtask 1' },
          { id: 'subtask2', description: 'Subtask 2' }
        ]
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid subtasks format', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        subtasks: 'not-an-array'
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.errors).toContain('subtasks must be an array');
    });

    it('should warn about atomic task with subtasks', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        atomic: true,
        subtasks: [{ id: 'subtask1' }]
      };

      const result = await validator.validateTaskStructure(task);

      expect(result.warnings).toContain('atomic task has subtasks - atomic flag will be ignored');
    });
  });

  describe('validateToolExists', () => {
    it('should validate existing tool with execute method', async () => {
      const mockTool = {
        name: 'test_tool',
        execute: jest.fn(),
        inputSchema: { type: 'object' }
      };
      mockToolRegistry.getTool.mockResolvedValue(mockTool);

      const result = await validator.validateToolExists('test_tool');

      expect(result.exists).toBe(true);
      expect(result.tool).toBe(mockTool);
      expect(result.warnings).toBeUndefined();
    });

    it('should warn about tool without input schema', async () => {
      const mockTool = {
        name: 'test_tool',
        execute: jest.fn()
        // No inputSchema
      };
      mockToolRegistry.getTool.mockResolvedValue(mockTool);

      const result = await validator.validateToolExists('test_tool');

      expect(result.exists).toBe(true);
      expect(result.warnings).toContain("Tool 'test_tool' has no input schema - parameter validation will be limited");
    });

    it('should fail for non-existent tool', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);

      const result = await validator.validateToolExists('missing_tool');

      expect(result.exists).toBe(false);
      expect(result.error).toBe("Tool 'missing_tool' not found in registry");
    });

    it('should fail for tool without execute method', async () => {
      const mockTool = {
        name: 'broken_tool'
        // No execute method
      };
      mockToolRegistry.getTool.mockResolvedValue(mockTool);

      const result = await validator.validateToolExists('broken_tool');

      expect(result.exists).toBe(true);
      expect(result.error).toBe('Tool not executable');
      expect(result.warnings).toContain("Tool 'broken_tool' exists but has no execute method");
    });

    it('should handle tool registry errors', async () => {
      mockToolRegistry.getTool.mockRejectedValue(new Error('Registry failed'));

      const result = await validator.validateToolExists('error_tool');

      expect(result.exists).toBe(false);
      expect(result.error).toBe('Tool validation failed: Registry failed');
    });

    it('should handle missing tool registry', async () => {
      const validatorWithoutRegistry = new ExecutionValidator();

      const result = await validatorWithoutRegistry.validateToolExists('any_tool');

      expect(result.exists).toBe(false);
      expect(result.warnings).toContain('No tool registry available for validation');
      expect(result.error).toBe('Tool registry not configured');
    });
  });

  describe('validateContextRequirements', () => {
    it('should validate simple string requirements', async () => {
      const requirements = ['userId', 'sessionId'];
      const context = {
        userId: '123',
        sessionId: 'session-456'
      };

      const result = await validator.validateContextRequirements(requirements, context);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing simple requirements', async () => {
      const requirements = ['userId', 'missingKey'];
      const context = {
        userId: '123'
      };

      const result = await validator.validateContextRequirements(requirements, context);

      expect(result.errors).toContain('Missing required context: missingKey');
    });

    it('should validate complex requirements with type checking', async () => {
      const requirements = [
        { key: 'userId', type: 'string' },
        { key: 'count', type: 'number' },
        { key: 'items', type: 'array' }
      ];
      const context = {
        userId: '123',
        count: 42,
        items: ['a', 'b', 'c']
      };

      const result = await validator.validateContextRequirements(requirements, context);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail for wrong types in complex requirements', async () => {
      const requirements = [
        { key: 'userId', type: 'string' },
        { key: 'count', type: 'number' }
      ];
      const context = {
        userId: 123, // Wrong type
        count: '42' // Wrong type
      };

      const result = await validator.validateContextRequirements(requirements, context);

      expect(result.errors).toContain('Context userId has wrong type: expected string, got number');
      expect(result.errors).toContain('Context count has wrong type: expected number, got string');
    });

    it('should handle optional requirements', async () => {
      const requirements = [
        { key: 'required', type: 'string' },
        { key: 'optional', type: 'string', optional: true }
      ];
      const context = {
        required: 'present'
        // optional is missing
      };

      const result = await validator.validateContextRequirements(requirements, context);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain('Optional context missing: optional');
    });
  });

  describe('validateInputParameters', () => {
    it('should validate parameters against schema', async () => {
      const task = {
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' }
          }
        },
        params: {
          name: 'John',
          age: 30
        }
      };

      const result = await validator.validateInputParameters(task);

      expect(result.errors).toHaveLength(0);
    });

    it('should return empty result for task without schema', async () => {
      const task = {
        params: { anything: 'goes' }
        // No inputSchema
      };

      const result = await validator.validateInputParameters(task);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle schema validation errors', async () => {
      const task = {
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true }
          }
        },
        params: {
          name: 123 // Wrong type
        }
      };

      const result = await validator.validateInputParameters(task);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Input parameter validation');
    });
  });

  describe('validateSchema', () => {
    it('should validate correct data types', async () => {
      const schema = { type: 'string' };
      const data = 'test string';

      const result = await validator.validateSchema(data, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for incorrect data types', async () => {
      const schema = { type: 'string' };
      const data = 123;

      const result = await validator.validateSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Type mismatch: expected string, got number');
    });

    it('should validate object properties', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          age: { type: 'number' }
        }
      };
      const data = {
        name: 'John',
        age: 30
      };

      const result = await validator.validateSchema(data, schema);

      expect(result.valid).toBe(true);
    });

    it('should fail for missing required properties', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', required: true }
        }
      };
      const data = {}; // Missing required 'name'

      const result = await validator.validateSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Required property missing: name');
    });

    it('should validate string length constraints', async () => {
      const schema = {
        type: 'string',
        minLength: 5,
        maxLength: 10
      };

      // Valid length
      let result = await validator.validateSchema('hello', schema);
      expect(result.valid).toBe(true);

      // Too short
      result = await validator.validateSchema('hi', schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('String too short: minimum length 5, got 2');

      // Too long
      result = await validator.validateSchema('this is too long', schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('String too long: maximum length 10, got 16');
    });

    it('should handle schema validation errors gracefully', async () => {
      // Simulate an error in validation logic
      const invalidSchema = { type: 'unknown_type' };
      const data = 'test';

      const result = await validator.validateSchema(data, invalidSchema);

      // Should not crash and should return some result
      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
    });
  });

  describe('validateFileExists', () => {
    it('should validate existing readable file', async () => {
      const testFile = join(testDir, 'test-file.txt');
      await writeFile(testFile, 'test content');

      const result = await validator.validateFileExists(testFile);

      expect(result.exists).toBe(true);
      expect(result.readable).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should fail for non-existent file', async () => {
      const missingFile = join(testDir, 'missing-file.txt');

      const result = await validator.validateFileExists(missingFile);

      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateToolResult', () => {
    it('should validate proper tool result format', async () => {
      const result = {
        success: true,
        data: 'tool output',
        message: 'Operation completed'
      };
      const task = { tool: 'test_tool' };

      const validation = await validator.validateToolResult(result, task);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should warn about missing success field', async () => {
      const result = {
        data: 'tool output'
        // No success field
      };
      const task = { tool: 'test_tool' };

      const validation = await validator.validateToolResult(result, task);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Tool result has no success field - assuming success if no exception thrown');
    });

    it('should warn about non-boolean success field', async () => {
      const result = {
        success: 'yes', // Should be boolean
        data: 'tool output'
      };
      const task = { tool: 'test_tool' };

      const validation = await validator.validateToolResult(result, task);

      expect(validation.warnings).toContain('Tool result has success field but it is not boolean');
    });

    it('should warn about failure without error information', async () => {
      const result = {
        success: false
        // No error or message
      };
      const task = { tool: 'test_tool' };

      const validation = await validator.validateToolResult(result, task);

      expect(validation.warnings).toContain('Tool result indicates failure but provides no error information');
    });

    it('should warn about missing data fields', async () => {
      const result = {
        success: true
        // No result, data, output, or content
      };
      const task = { tool: 'test_tool' };

      const validation = await validator.validateToolResult(result, task);

      expect(validation.warnings).toContain('Tool result has no data fields (result, data, output, content)');
    });

    it('should warn about null/undefined result', async () => {
      const task = { tool: 'test_tool' };

      let validation = await validator.validateToolResult(null, task);
      expect(validation.warnings).toContain('Tool returned null/undefined result');

      validation = await validator.validateToolResult(undefined, task);
      expect(validation.warnings).toContain('Tool returned null/undefined result');
    });
  });

  describe('custom validators', () => {
    it('should register custom validator', () => {
      const customValidator = jest.fn().mockResolvedValue({ valid: true });
      validator.registerValidator('custom_test', customValidator);

      expect(validator.customValidators.has('custom_test')).toBe(true);
    });

    it('should fail to register non-function validator', () => {
      expect(() => {
        validator.registerValidator('invalid', 'not-a-function');
      }).toThrow('Validator must be a function');
    });

    it('should add pre-execution validator', () => {
      const preValidator = jest.fn();
      validator.addPreValidator(preValidator);

      expect(validator.preValidators).toContain(preValidator);
    });

    it('should add post-execution validator', () => {
      const postValidator = jest.fn();
      validator.addPostValidator(postValidator);

      expect(validator.postValidators).toContain(postValidator);
    });

    it('should fail to add non-function validators', () => {
      expect(() => {
        validator.addPreValidator('not-a-function');
      }).toThrow('Pre-validator must be a function');

      expect(() => {
        validator.addPostValidator('not-a-function');
      }).toThrow('Post-validator must be a function');
    });
  });

  describe('context value helpers', () => {
    it('should check context values with direct access', () => {
      const context = {
        userId: '123',
        nested: {
          value: 'test'
        }
      };

      expect(validator.hasContextValue(context, 'userId')).toBe(true);
      expect(validator.hasContextValue(context, 'nested.value')).toBe(true);
      expect(validator.hasContextValue(context, 'missing')).toBe(false);
    });

    it('should check context values with context methods', () => {
      const context = {
        has: jest.fn().mockReturnValue(true),
        getSharedState: jest.fn()
      };

      validator.hasContextValue(context, 'test');
      expect(context.has).toHaveBeenCalledWith('test');
    });

    it('should get context values with direct access', () => {
      const context = {
        userId: '123',
        nested: {
          value: 'test'
        }
      };

      expect(validator.getContextValue(context, 'userId')).toBe('123');
      expect(validator.getContextValue(context, 'nested.value')).toBe('test');
      expect(validator.getContextValue(context, 'missing')).toBeUndefined();
    });

    it('should get context values with context methods', () => {
      const context = {
        get: jest.fn().mockReturnValue('value'),
        getSharedState: jest.fn()
      };

      const result = validator.getContextValue(context, 'test');
      expect(context.get).toHaveBeenCalledWith('test');
      expect(result).toBe('value');
    });
  });

  describe('default validators', () => {
    it('should validate file content', async () => {
      const testFile = join(testDir, 'content-test.txt');
      await writeFile(testFile, 'expected content here');

      const fileContentValidator = validator.customValidators.get('file_content');
      const task = {
        createsFiles: [testFile],
        expectedFileContent: {
          [testFile]: 'expected content'
        }
      };

      const result = await fileContentValidator({}, {}, task);

      expect(result.valid).toBe(true);
    });

    it('should fail file content validation for missing content', async () => {
      const testFile = join(testDir, 'content-test.txt');
      await writeFile(testFile, 'different content');

      const fileContentValidator = validator.customValidators.get('file_content');
      const task = {
        createsFiles: [testFile],
        expectedFileContent: {
          [testFile]: 'expected content'
        }
      };

      const result = await fileContentValidator({}, {}, task);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('does not contain expected content');
    });

    it('should validate result type', async () => {
      const resultTypeValidator = validator.customValidators.get('result_type');
      const task = { expectedResultType: 'string' };

      let result = await resultTypeValidator('test string', {}, task);
      expect(result.valid).toBe(true);

      result = await resultTypeValidator(123, {}, task);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Expected result type string, got number');
    });

    it('should validate non-empty results', async () => {
      const nonEmptyValidator = validator.customValidators.get('non_empty');
      const task = { requireNonEmptyResult: true };

      // Valid cases
      let result = await nonEmptyValidator('non-empty string', {}, task);
      expect(result.valid).toBe(true);

      result = await nonEmptyValidator(['item'], {}, task);
      expect(result.valid).toBe(true);

      result = await nonEmptyValidator({ key: 'value' }, {}, task);
      expect(result.valid).toBe(true);

      // Invalid cases
      result = await nonEmptyValidator(null, {}, task);
      expect(result.valid).toBe(false);

      result = await nonEmptyValidator('', {}, task);
      expect(result.valid).toBe(false);

      result = await nonEmptyValidator([], {}, task);
      expect(result.valid).toBe(false);

      result = await nonEmptyValidator({}, {}, task);
      expect(result.valid).toBe(false);
    });
  });

  describe('statistics and management', () => {
    it('should provide validation statistics', () => {
      validator.registerValidator('test1', jest.fn());
      validator.registerValidator('test2', jest.fn());
      validator.addPreValidator(jest.fn());
      validator.addPostValidator(jest.fn());

      const stats = validator.getStats();

      expect(stats.customValidators).toBeGreaterThanOrEqual(2); // At least our 2 + defaults
      expect(stats.preValidators).toBe(1);
      expect(stats.postValidators).toBe(1);
      expect(stats.strictValidation).toBe(true);
      expect(stats.hasToolRegistry).toBe(true);
    });

    it('should clear all validators', () => {
      validator.registerValidator('test', jest.fn());
      validator.addPreValidator(jest.fn());
      validator.addPostValidator(jest.fn());

      expect(validator.customValidators.size).toBeGreaterThan(0);
      expect(validator.preValidators.length).toBeGreaterThan(0);
      expect(validator.postValidators.length).toBeGreaterThan(0);

      validator.clearValidators();

      expect(validator.customValidators.size).toBe(0);
      expect(validator.preValidators).toHaveLength(0);
      expect(validator.postValidators).toHaveLength(0);
    });
  });
});