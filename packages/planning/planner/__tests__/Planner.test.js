/**
 * Unit tests for Planner class
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Planner } from '../src/core/Planner.js';

describe('Planner', () => {
  let mockLLMClient;
  let mockValidator;
  let planner;

  beforeEach(() => {
    // Mock LLM client
    mockLLMClient = {
      complete: jest.fn()
    };

    // Mock BTValidator (we'll spy on the real one)
    mockValidator = {
      validate: jest.fn()
    };
  });

  describe('constructor', () => {
    it('should require an llmClient', () => {
      expect(() => new Planner({})).toThrow('Planner requires an llmClient');
      expect(() => new Planner({ llmClient: null })).toThrow('Planner requires an llmClient');
    });

    it('should create planner with llmClient', () => {
      const planner = new Planner({ llmClient: mockLLMClient });
      expect(planner.llmClient).toBe(mockLLMClient);
      expect(planner.validator).toBeDefined();
      expect(planner.prompt).toBeDefined();
    });

    it('should accept optional tools', () => {
      const tools = [{ name: 'test_tool' }];
      const planner = new Planner({ llmClient: mockLLMClient, tools });
      expect(planner.defaultTools).toBe(tools);
    });

    it('should initialize with null tools if not provided', () => {
      const planner = new Planner({ llmClient: mockLLMClient });
      expect(planner.defaultTools).toBe(null);
    });
  });

  describe('makePlan', () => {
    beforeEach(() => {
      planner = new Planner({ llmClient: mockLLMClient });
      // Replace validator with mock
      planner.validator = mockValidator;
    });

    it('should validate input requirements', async () => {
      const result = await planner.makePlan(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Requirements must be a non-empty string');
      
      const result2 = await planner.makePlan('');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Requirements must be a non-empty string');
    });

    it('should require tools either in call or constructor', async () => {
      const result = await planner.makePlan('Create a server');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No tools available');
    });

    it('should use tools from constructor if not provided in call', async () => {
      const tools = [{ name: 'file_write' }];
      planner = new Planner({ llmClient: mockLLMClient, tools });
      planner.validator = mockValidator;
      
      mockLLMClient.complete.mockResolvedValue('{"type": "sequence", "id": "root"}');
      mockValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      
      const result = await planner.makePlan('Create a file');
      
      expect(result.success).toBe(true);
      expect(mockValidator.validate).toHaveBeenCalledWith(
        { type: 'sequence', id: 'root' },
        tools
      );
    });

    it('should prefer tools from call over constructor', async () => {
      const defaultTools = [{ name: 'default_tool' }];
      const callTools = [{ name: 'call_tool' }];
      planner = new Planner({ llmClient: mockLLMClient, tools: defaultTools });
      planner.validator = mockValidator;
      
      mockLLMClient.complete.mockResolvedValue('{"type": "sequence", "id": "root"}');
      mockValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      
      const result = await planner.makePlan('Create a file', callTools);
      
      expect(mockValidator.validate).toHaveBeenCalledWith(
        expect.any(Object),
        callTools
      );
    });

    it('should return success with valid plan', async () => {
      const tools = [{ name: 'file_write' }];
      const plan = {
        type: 'sequence',
        id: 'root',
        children: [
          { type: 'action', id: 'act1', tool: 'file_write' }
        ]
      };
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify(plan));
      mockValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      
      const result = await planner.makePlan('Create a file', tools);
      
      expect(result.success).toBe(true);
      expect(result.data.plan).toEqual(plan);
      expect(result.data.attempts).toBe(1);
      expect(result.data.nodeCount).toBe(2); // root + action
      expect(result.error).toBe(null);
    });

    it('should retry with fix prompt on validation failure', async () => {
      const tools = [{ name: 'file_write' }];
      const invalidPlan = { type: 'sequence', id: 'root' };
      const validPlan = {
        type: 'sequence',
        id: 'root',
        children: [{ type: 'action', id: 'act1', tool: 'file_write' }]
      };
      
      // First attempt returns invalid plan
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify(invalidPlan))
        .mockResolvedValueOnce(JSON.stringify(validPlan));
      
      // First validation fails, second succeeds
      mockValidator.validate
        .mockResolvedValueOnce({
          valid: false,
          errors: [{ type: 'MISSING_CHILDREN', message: 'No children' }]
        })
        .mockResolvedValueOnce({ valid: true, errors: [] });
      
      const result = await planner.makePlan('Create a file', tools);
      
      expect(result.success).toBe(true);
      expect(result.data.attempts).toBe(2);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
      
      // Check that second call used fix prompt (has higher temperature)
      const secondCallOptions = mockLLMClient.complete.mock.calls[1][1];
      expect(secondCallOptions.temperature).toBe(0.3);
    });

    it('should fail after max attempts', async () => {
      const tools = [{ name: 'file_write' }];
      const invalidPlan = { type: 'invalid' };
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify(invalidPlan));
      mockValidator.validate.mockResolvedValue({
        valid: false,
        errors: [{ type: 'INVALID_TYPE', message: 'Invalid node type' }]
      });
      
      const result = await planner.makePlan('Create a file', tools, { maxAttempts: 2 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create valid plan after 2 attempts');
      expect(result.data.attempts).toBe(2);
      expect(result.data.lastPlan).toEqual(invalidPlan);
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
    });

    it('should handle JSON parsing errors', async () => {
      const tools = [{ name: 'file_write' }];
      
      mockLLMClient.complete.mockResolvedValue('Not valid JSON at all');
      
      const result = await planner.makePlan('Create a file', tools, { maxAttempts: 1 });
      
      expect(result.success).toBe(false);
      expect(result.data.validation.errors[0].type).toBe('generation');
    });

    it('should handle LLM client errors', async () => {
      const tools = [{ name: 'file_write' }];
      
      mockLLMClient.complete.mockRejectedValue(new Error('LLM service error'));
      
      const result = await planner.makePlan('Create a file', tools, { maxAttempts: 1 });
      
      expect(result.success).toBe(false);
      expect(result.data.validation.errors[0].message).toContain('LLM service error');
    });

    it('should support debug mode', async () => {
      const tools = [{ name: 'file_write' }];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockLLMClient.complete.mockResolvedValue('{"type": "sequence", "id": "root"}');
      mockValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      
      await planner.makePlan('Create a file', tools, { debug: true });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Planner] Attempt 1/3'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('setDefaultTools / getDefaultTools', () => {
    beforeEach(() => {
      planner = new Planner({ llmClient: mockLLMClient });
    });

    it('should update default tools', () => {
      const tools = [{ name: 'new_tool' }];
      planner.setDefaultTools(tools);
      expect(planner.getDefaultTools()).toBe(tools);
    });

    it('should validate tools array', () => {
      expect(() => planner.setDefaultTools('not an array')).toThrow('Tools must be an array');
      expect(() => planner.setDefaultTools(null)).toThrow('Tools must be an array');
    });

    it('should return null if no default tools', () => {
      expect(planner.getDefaultTools()).toBe(null);
    });
  });

  describe('_countNodes', () => {
    beforeEach(() => {
      planner = new Planner({ llmClient: mockLLMClient });
    });

    it('should count single node', () => {
      const node = { type: 'action', id: 'act1' };
      expect(planner._countNodes(node)).toBe(1);
    });

    it('should count nodes with children', () => {
      const node = {
        type: 'sequence',
        id: 'root',
        children: [
          { type: 'action', id: 'act1' },
          { type: 'action', id: 'act2' }
        ]
      };
      expect(planner._countNodes(node)).toBe(3);
    });

    it('should count nested structures', () => {
      const node = {
        type: 'sequence',
        id: 'root',
        children: [
          {
            type: 'sequence',
            id: 'sub',
            children: [
              { type: 'action', id: 'act1' },
              { type: 'action', id: 'act2' }
            ]
          },
          { type: 'action', id: 'act3' }
        ]
      };
      expect(planner._countNodes(node)).toBe(5);
    });

    it('should handle retry nodes with single child', () => {
      const node = {
        type: 'retry',
        id: 'retry1',
        child: { type: 'action', id: 'act1' }
      };
      expect(planner._countNodes(node)).toBe(2);
    });

    it('should handle null input', () => {
      expect(planner._countNodes(null)).toBe(0);
      expect(planner._countNodes(undefined)).toBe(0);
    });
  });
});