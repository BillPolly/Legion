/**
 * Unit tests for TemplatedPrompt class
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TemplatedPrompt from '../../src/TemplatedPrompt.js';

describe('TemplatedPrompt', () => {
  let prompt;
  const basicTemplate = 'Hello {{name}}, welcome to {{place}}!';

  beforeEach(() => {
    prompt = new TemplatedPrompt(basicTemplate);
  });

  describe('Constructor', () => {
    it('should create a prompt with a template', () => {
      expect(prompt.template).toBe(basicTemplate);
      expect(prompt.name).toBe('unnamed');
    });

    it('should accept options', () => {
      const customPrompt = new TemplatedPrompt(basicTemplate, {
        name: 'greeting',
        maxRetries: 5,
        retryDelay: 2000,
        temperature: 0.5,
        maxTokens: 2000
      });

      expect(customPrompt.name).toBe('greeting');
      expect(customPrompt.maxRetries).toBe(5);
      expect(customPrompt.retryDelay).toBe(2000);
      expect(customPrompt.temperature).toBe(0.5);
      expect(customPrompt.maxTokens).toBe(2000);
    });

    it('should throw error for invalid template', () => {
      expect(() => new TemplatedPrompt()).toThrow('Template must be a non-empty string');
      expect(() => new TemplatedPrompt('')).toThrow('Template must be a non-empty string');
      expect(() => new TemplatedPrompt(null)).toThrow('Template must be a non-empty string');
      expect(() => new TemplatedPrompt(123)).toThrow('Template must be a non-empty string');
    });

    it('should set default values', () => {
      expect(prompt.maxRetries).toBe(3);
      expect(prompt.retryDelay).toBe(1000);
      expect(prompt.temperature).toBe(0.7);
      expect(prompt.maxTokens).toBe(4000);
      expect(prompt.schema).toBeNull();
      expect(prompt.validator).toBeNull();
      expect(prompt.systemPrompt).toBeNull();
    });
  });

  describe('substitute', () => {
    it('should substitute simple placeholders', () => {
      const result = prompt.substitute({
        name: 'Alice',
        place: 'Wonderland'
      });
      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should handle missing required variables', () => {
      expect(() => prompt.substitute({ name: 'Alice' }))
        .toThrow('Missing required template variables: place');
    });

    it('should allow partial substitution with flag', () => {
      const result = prompt.substitute(
        { name: 'Alice', allowPartial: true }
      );
      expect(result).toBe('Hello Alice, welcome to {{place}}!');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = new TemplatedPrompt('{{name}} is {{name}} and {{name}} again');
      const result = template.substitute({ name: 'Bob' });
      expect(result).toBe('Bob is Bob and Bob again');
    });

    it('should handle empty string values', () => {
      const result = prompt.substitute({
        name: '',
        place: 'Nowhere'
      });
      expect(result).toBe('Hello , welcome to Nowhere!');
    });

    it('should handle null and undefined values as empty strings', () => {
      const result = prompt.substitute({
        name: null,
        place: undefined,
        allowPartial: true
      });
      expect(result).toBe('Hello , welcome to !');
    });

    it('should throw error for non-object variables', () => {
      expect(() => prompt.substitute('not an object'))
        .toThrow('Variables must be an object');
      expect(() => prompt.substitute(null))
        .toThrow('Variables must be an object');
    });

    it('should handle templates with no placeholders', () => {
      const staticPrompt = new TemplatedPrompt('Hello World');
      const result = staticPrompt.substitute({});
      expect(result).toBe('Hello World');
    });

    it('should handle optional placeholders', () => {
      const template = new TemplatedPrompt(
        'Task: {{taskDescription}}\n{{artifactsSection}}\n{{toolsSection}}'
      );
      const result = template.substitute({
        taskDescription: 'Do something'
      });
      expect(result).toBe('Task: Do something\n{{artifactsSection}}\n{{toolsSection}}');
    });
  });

  describe('isOptionalPlaceholder', () => {
    it('should identify optional placeholders', () => {
      expect(prompt.isOptionalPlaceholder('artifactsSection')).toBe(true);
      expect(prompt.isOptionalPlaceholder('toolsSection')).toBe(true);
      expect(prompt.isOptionalPlaceholder('outputPrompt')).toBe(true);
      expect(prompt.isOptionalPlaceholder('instructions')).toBe(true);
      expect(prompt.isOptionalPlaceholder('taskIntro')).toBe(true);
      expect(prompt.isOptionalPlaceholder('classificationReasoning')).toBe(true);
      expect(prompt.isOptionalPlaceholder('suggestedApproach')).toBe(true);
    });

    it('should not identify required placeholders as optional', () => {
      expect(prompt.isOptionalPlaceholder('taskDescription')).toBe(false);
      expect(prompt.isOptionalPlaceholder('name')).toBe(false);
      expect(prompt.isOptionalPlaceholder('place')).toBe(false);
    });
  });

  describe('format', () => {
    it('should format messages without system prompt', () => {
      const messages = prompt.format({
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'Hello Alice, welcome to Wonderland!'
      });
    });

    it('should include system prompt when provided', () => {
      const promptWithSystem = new TemplatedPrompt(basicTemplate, {
        systemPrompt: 'You are a friendly assistant'
      });

      const messages = promptWithSystem.format({
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a friendly assistant'
      });
      expect(messages[1]).toEqual({
        role: 'user',
        content: 'Hello Alice, welcome to Wonderland!'
      });
    });
  });

  describe('call', () => {
    let mockLLMClient;

    beforeEach(() => {
      mockLLMClient = {
        complete: jest.fn()
      };
    });

    it('should call LLM with complete method', async () => {
      mockLLMClient.complete.mockResolvedValue('Hello response');

      const result = await prompt.call(mockLLMClient, {
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(result).toBe('Hello response');
      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        'Hello Alice, welcome to Wonderland!',
        {
          temperature: 0.7,
          maxTokens: 4000,
          systemPrompt: null
        }
      );
    });

    it('should use chat method if available', async () => {
      mockLLMClient = {
        chat: jest.fn().mockResolvedValue('Chat response')
      };

      const result = await prompt.call(mockLLMClient, {
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(result).toBe('Chat response');
      expect(mockLLMClient.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello Alice, welcome to Wonderland!' }],
        { temperature: 0.7, maxTokens: 4000 }
      );
    });

    it('should use invoke method if available', async () => {
      mockLLMClient = {
        invoke: jest.fn().mockResolvedValue('Invoke response')
      };

      const result = await prompt.call(mockLLMClient, {
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(result).toBe('Invoke response');
      expect(mockLLMClient.invoke).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'Hello Alice, welcome to Wonderland!' }],
        temperature: 0.7,
        maxTokens: 4000
      });
    });

    it('should throw error if LLM client is missing', async () => {
      await expect(prompt.call(null, { name: 'Alice', place: 'Wonderland' }))
        .rejects.toThrow('LLM client is required');
    });

    it('should throw error if LLM client has no recognized method', async () => {
      const badClient = {};
      await expect(prompt.call(badClient, { name: 'Alice', place: 'Wonderland' }))
        .rejects.toThrow('LLM client does not have a recognized method');
    });

    it('should retry on validation failure', async () => {
      const validator = jest.fn()
        .mockResolvedValueOnce({ valid: false, error: 'Invalid format' })
        .mockResolvedValueOnce({ valid: false, error: 'Still invalid' })
        .mockResolvedValueOnce({ valid: true, data: 'Valid response' });

      const promptWithValidator = new TemplatedPrompt(basicTemplate, {
        validator,
        retryDelay: 10 // Short delay for testing
      });

      mockLLMClient.complete
        .mockResolvedValueOnce('Invalid response 1')
        .mockResolvedValueOnce('Invalid response 2')
        .mockResolvedValueOnce('Valid response');

      const result = await promptWithValidator.call(mockLLMClient, {
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(result).toBe('Valid response');
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(3);
      expect(validator).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const validator = jest.fn()
        .mockResolvedValue({ valid: false, error: 'Always invalid' });

      const promptWithValidator = new TemplatedPrompt(basicTemplate, {
        validator,
        maxRetries: 2,
        retryDelay: 10
      });

      mockLLMClient.complete.mockResolvedValue('Invalid response');

      await expect(
        promptWithValidator.call(mockLLMClient, {
          name: 'Alice',
          place: 'Wonderland'
        })
      ).rejects.toThrow('Validation failed: Always invalid');

      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
    });

    it('should override temperature and maxTokens', async () => {
      mockLLMClient.complete.mockResolvedValue('Response');

      await prompt.call(
        mockLLMClient,
        { name: 'Alice', place: 'Wonderland' },
        { temperature: 0.9, maxTokens: 1000 }
      );

      expect(mockLLMClient.complete).toHaveBeenCalledWith(
        'Hello Alice, welcome to Wonderland!',
        {
          temperature: 0.9,
          maxTokens: 1000,
          systemPrompt: null
        }
      );
    });
  });

  describe('validate', () => {
    it('should return valid for no validator', async () => {
      const result = await prompt.validate('any response');
      expect(result).toEqual({ valid: true, data: 'any response' });
    });

    it('should use function validator', async () => {
      const validator = jest.fn().mockResolvedValue(true);
      prompt.validator = validator;

      const result = await prompt.validate('test response');
      expect(result).toEqual({ valid: true, data: 'test response' });
      expect(validator).toHaveBeenCalledWith('test response');
    });

    it('should handle function validator returning object', async () => {
      const validator = jest.fn().mockResolvedValue({
        valid: true,
        data: { parsed: 'data' }
      });
      prompt.validator = validator;

      const result = await prompt.validate('test response');
      expect(result).toEqual({ valid: true, data: { parsed: 'data' } });
    });

    it('should handle function validator error', async () => {
      const validator = jest.fn().mockRejectedValue(new Error('Validation error'));
      prompt.validator = validator;

      const result = await prompt.validate('test response');
      expect(result).toEqual({ valid: false, error: 'Validation error' });
    });

    it('should use validator.validate method', async () => {
      const validator = {
        validate: jest.fn().mockResolvedValue({ valid: true, data: 'validated' })
      };
      prompt.validator = validator;

      const result = await prompt.validate('test response');
      expect(result).toEqual({ valid: true, data: 'validated' });
      expect(validator.validate).toHaveBeenCalledWith('test response');
    });

    it('should use validator.parseAndValidate method', async () => {
      const validator = {
        parseAndValidate: jest.fn().mockResolvedValue({ 
          valid: true, 
          data: { parsed: true } 
        })
      };
      prompt.validator = validator;

      const result = await prompt.validate('test response');
      expect(result).toEqual({ valid: true, data: { parsed: true } });
      expect(validator.parseAndValidate).toHaveBeenCalledWith('test response');
    });
  });

  describe('clone', () => {
    it('should create a copy with same properties', () => {
      const original = new TemplatedPrompt(basicTemplate, {
        name: 'original',
        maxRetries: 5,
        temperature: 0.5
      });

      const cloned = original.clone();

      expect(cloned.template).toBe(original.template);
      expect(cloned.name).toBe('original');
      expect(cloned.maxRetries).toBe(5);
      expect(cloned.temperature).toBe(0.5);
      expect(cloned).not.toBe(original);
    });

    it('should override properties in clone', () => {
      const original = new TemplatedPrompt(basicTemplate, {
        name: 'original',
        maxRetries: 5
      });

      const cloned = original.clone({
        name: 'cloned',
        temperature: 0.9
      });

      expect(cloned.name).toBe('cloned');
      expect(cloned.maxRetries).toBe(5);
      expect(cloned.temperature).toBe(0.9);
    });
  });

  describe('getPlaceholders', () => {
    it('should return unique placeholders', () => {
      const template = new TemplatedPrompt(
        '{{name}} likes {{food}} and {{name}} eats {{food}} daily'
      );
      const placeholders = template.getPlaceholders();

      expect(placeholders).toEqual(['name', 'food']);
    });

    it('should return empty array for no placeholders', () => {
      const template = new TemplatedPrompt('No placeholders here');
      const placeholders = template.getPlaceholders();

      expect(placeholders).toEqual([]);
    });

    it('should handle complex templates', () => {
      const template = new TemplatedPrompt(
        'Task: {{taskDescription}}\n' +
        '{{artifactsSection}}\n' +
        'Tools: {{toolsSection}}\n' +
        'Output: {{outputPrompt}}'
      );
      const placeholders = template.getPlaceholders();

      expect(placeholders).toContain('taskDescription');
      expect(placeholders).toContain('artifactsSection');
      expect(placeholders).toContain('toolsSection');
      expect(placeholders).toContain('outputPrompt');
      expect(placeholders).toHaveLength(4);
    });
  });

  describe('hasPlaceholder', () => {
    it('should check for specific placeholder', () => {
      expect(prompt.hasPlaceholder('name')).toBe(true);
      expect(prompt.hasPlaceholder('place')).toBe(true);
      expect(prompt.hasPlaceholder('nonexistent')).toBe(false);
    });
  });

  describe('delay', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await prompt.delay(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(elapsed).toBeLessThan(150);
    });
  });
});