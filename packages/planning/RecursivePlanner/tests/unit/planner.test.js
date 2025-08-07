/**
 * Tests for the Planner abstraction
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Planner } from '../../src/core/planning/Planner.js';
import { PlanValidator } from '../../src/core/planning/validation/PlanValidator.js';
import { SchemaValidator } from '../../src/core/planning/validation/SchemaValidator.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';

describe('Planner', () => {
  let planner;
  let mockStrategy;
  let validator;
  let tools;

  beforeEach(() => {
    // Create mock tools with metadata
    tools = [
      {
        name: 'writeFile',
        description: 'Write content to a file',
        getMetadata: () => ({
          name: 'writeFile',
          description: 'Write content to a file',
          input: { path: 'string', content: 'string' },
          output: { path: 'string', size: 'number' }
        })
      },
      {
        name: 'readFile',
        description: 'Read content from a file',
        getMetadata: () => ({
          name: 'readFile',
          description: 'Read content from a file',
          input: { path: 'string' },
          output: { content: 'string', path: 'string' }
        })
      }
    ];

    // Create real validator
    validator = new PlanValidator({
      schemaValidator: new SchemaValidator({ strictTypes: true }),
      strictMode: true,
      validateArtifacts: true
    });

    // Create mock strategy
    mockStrategy = {
      generatePlan: jest.fn()
    };

    planner = new Planner(mockStrategy, validator, {
      maxAttempts: 3,
      debugMode: false
    });
  });

  describe('createPlan - success cases', () => {
    test('should create a valid plan on first attempt', async () => {
      const validPlan = [
        new PlanStep('step1', 'Write a file', 'writeFile',
          { path: 'test.txt', content: 'hello' }, [])
      ];

      mockStrategy.generatePlan.mockResolvedValue(validPlan);

      const result = await planner.createPlan('Write a test file', tools);

      expect(result).toEqual(validPlan);
      expect(mockStrategy.generatePlan).toHaveBeenCalledTimes(1);
      expect(mockStrategy.generatePlan).toHaveBeenCalledWith(
        'Write a test file',
        tools,
        expect.objectContaining({
          validationErrors: [],
          attemptNumber: 1
        })
      );
    });

    test('should retry and succeed after validation failure', async () => {
      // First attempt: invalid plan (wrong parameter name)
      const invalidPlan = [
        new PlanStep('step1', 'Write a file', 'writeFile',
          { filename: 'test.txt', data: 'hello' }, []) // Wrong params
      ];

      // Second attempt: valid plan
      const validPlan = [
        new PlanStep('step1', 'Write a file', 'writeFile',
          { path: 'test.txt', content: 'hello' }, []) // Correct params
      ];

      mockStrategy.generatePlan
        .mockResolvedValueOnce(invalidPlan)
        .mockResolvedValueOnce(validPlan);

      const result = await planner.createPlan('Write a test file', tools);

      expect(result).toEqual(validPlan);
      expect(mockStrategy.generatePlan).toHaveBeenCalledTimes(2);
      
      // Check that second call included validation errors
      const secondCall = mockStrategy.generatePlan.mock.calls[1];
      expect(secondCall[2].validationErrors).toBeDefined();
      expect(secondCall[2].validationErrors.length).toBeGreaterThan(0);
      expect(secondCall[2].attemptNumber).toBe(2);
    });
  });

  describe('createPlan - failure cases', () => {
    test('should fail after max attempts', async () => {
      const invalidPlan = [
        new PlanStep('step1', 'Use unknown tool', 'unknownTool', {}, [])
      ];

      mockStrategy.generatePlan.mockResolvedValue(invalidPlan);

      await expect(planner.createPlan('Test goal', tools))
        .rejects.toThrow('Failed to create valid plan after 3 attempts');

      expect(mockStrategy.generatePlan).toHaveBeenCalledTimes(3);
    });

    test('should handle strategy errors', async () => {
      mockStrategy.generatePlan.mockRejectedValue(new Error('Strategy failed'));

      await expect(planner.createPlan('Test goal', tools))
        .rejects.toThrow('Strategy failed');
    });
  });

  describe('fixPlan', () => {
    test('should fix an invalid plan with validation errors', async () => {
      // Invalid plan with multiple issues
      const invalidPlan = [
        new PlanStep('step1', 'Write file', 'writeFile',
          { filename: 'test.txt', data: 'hello' }, []), // Wrong params
        new PlanStep('step2', 'Read file', 'readFile',
          { filepath: '@nonExistent' }, ['step1']) // Wrong param and bad artifact
      ];

      // Validation errors
      const validationErrors = [
        {
          type: 'MISSING_REQUIRED_FIELD',
          message: "Required field 'path' is missing",
          stepId: 'step1',
          details: { field: 'path', expectedType: 'string' }
        },
        {
          type: 'EXTRA_PROPERTY',
          message: "Unexpected property 'filename'",
          stepId: 'step1',
          details: { field: 'filename' }
        },
        {
          type: 'MISSING_REQUIRED_FIELD',
          message: "Required field 'path' is missing",
          stepId: 'step2',
          details: { field: 'path', expectedType: 'string' }
        },
        {
          type: 'ARTIFACT_NOT_FOUND',
          message: "Artifact '@nonExistent' has not been created yet",
          stepId: 'step2',
          details: { reference: '@nonExistent' }
        }
      ];

      // Fixed plan
      const fixedPlan = [
        new PlanStep('step1', 'Write file', 'writeFile',
          { path: 'test.txt', content: 'hello' }, [],
          { path: { name: 'testFile', description: 'Path to test file' } }),
        new PlanStep('step2', 'Read file', 'readFile',
          { path: '@testFile' }, ['step1'])
      ];

      mockStrategy.generatePlan.mockResolvedValue(fixedPlan);

      const result = await planner.fixPlan(
        'Write and read a file',
        invalidPlan,
        validationErrors,
        tools
      );

      expect(result).toEqual(fixedPlan);
      expect(mockStrategy.generatePlan).toHaveBeenCalledTimes(1);
      
      // Check that fix context was provided
      const callArgs = mockStrategy.generatePlan.mock.calls[0];
      expect(callArgs[2].isFixing).toBe(true);
      expect(callArgs[2].invalidPlan).toEqual(invalidPlan);
      expect(callArgs[2].validationErrors).toEqual(validationErrors);
      expect(callArgs[2].fixPrompt).toBeDefined();
      expect(callArgs[2].fixPrompt).toContain('You made a plan to meet this goal');
      expect(callArgs[2].fixPrompt).toContain('The Plan You Generated');
      expect(callArgs[2].fixPrompt).toContain('Validation Errors Found');
    });

    test('should throw if fixed plan is still invalid', async () => {
      const invalidPlan = [
        new PlanStep('step1', 'Bad step', 'unknownTool', {}, [])
      ];

      const validationErrors = [
        {
          type: 'TOOL_NOT_FOUND',
          message: "Tool 'unknownTool' is not available",
          stepId: 'step1'
        }
      ];

      // Still invalid after "fix"
      const stillInvalidPlan = [
        new PlanStep('step1', 'Bad step', 'anotherUnknownTool', {}, [])
      ];

      mockStrategy.generatePlan.mockResolvedValue(stillInvalidPlan);

      await expect(planner.fixPlan(
        'Test goal',
        invalidPlan,
        validationErrors,
        tools
      )).rejects.toThrow('Failed to fix plan');
    });
  });

  describe('validatePlan', () => {
    test('should validate a plan without generating new one', async () => {
      const plan = [
        new PlanStep('step1', 'Write file', 'writeFile',
          { path: 'test.txt', content: 'hello' }, [])
      ];

      const result = await planner.validatePlan(plan, tools);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockStrategy.generatePlan).not.toHaveBeenCalled();
    });

    test('should return validation errors for invalid plan', async () => {
      const plan = [
        new PlanStep('step1', 'Bad step', 'unknownTool', {}, [])
      ];

      const result = await planner.validatePlan(plan, tools);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('replan', () => {
    test('should handle replanning with context', async () => {
      const newPlan = [
        new PlanStep('step1', 'New approach', 'writeFile',
          { path: 'new.txt', content: 'retry' }, [])
      ];

      mockStrategy.generatePlan.mockResolvedValue(newPlan);

      const replanContext = {
        failedSteps: [{ id: 'old1', error: 'failed' }],
        completedSteps: [],
        currentState: { someState: 'value' }
      };

      const result = await planner.replan(
        'Original goal',
        tools,
        { originalContext: 'value' },
        replanContext
      );

      expect(result).toEqual(newPlan);
      
      const callArgs = mockStrategy.generatePlan.mock.calls[0];
      expect(callArgs[2].isReplanning).toBe(true);
      expect(callArgs[2].failedSteps).toEqual(replanContext.failedSteps);
    });
  });

  describe('error summary', () => {
    test('should summarize validation errors correctly', () => {
      const history = [
        {
          attempt: 1,
          errors: [
            { type: 'TOOL_NOT_FOUND', message: 'Tool not found' },
            { type: 'TOOL_NOT_FOUND', message: 'Another tool not found' },
            { type: 'MISSING_PARAMETER', message: 'Missing param' }
          ]
        }
      ];

      const summary = planner.summarizeErrors(history);

      expect(summary).toContain('TOOL_NOT_FOUND(2)');
      expect(summary).toContain('MISSING_PARAMETER(1)');
    });
  });
});