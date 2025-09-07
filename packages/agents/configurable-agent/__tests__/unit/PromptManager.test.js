/**
 * Unit tests for PromptManager
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptManager } from '../../src/prompts/PromptManager.js';

describe('PromptManager', () => {
  let manager;

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      manager = new PromptManager();
      
      expect(manager).toBeDefined();
      expect(manager.templates).toEqual({});
      expect(manager.responseFormat).toBe('text');
      expect(manager.variables).toEqual({});
    });

    it('should initialize with custom configuration', () => {
      const config = {
        responseFormat: 'json',
        templates: {
          system: 'You are a helpful assistant',
          greeting: 'Hello, {{name}}!'
        },
        variables: {
          name: 'User',
          role: 'assistant'
        }
      };
      
      manager = new PromptManager(config);
      
      expect(manager.responseFormat).toBe('json');
      expect(manager.templates.system).toBe('You are a helpful assistant');
      expect(manager.templates.greeting).toBe('Hello, {{name}}!');
      expect(manager.variables.name).toBe('User');
    });

    it('should support markdown response format', () => {
      manager = new PromptManager({ responseFormat: 'markdown' });
      expect(manager.responseFormat).toBe('markdown');
    });
  });

  describe('Template Loading', () => {
    beforeEach(() => {
      manager = new PromptManager();
    });

    it('should load a single template', () => {
      manager.loadTemplate('welcome', 'Welcome to {{appName}}!');
      
      expect(manager.templates.welcome).toBe('Welcome to {{appName}}!');
    });

    it('should load multiple templates', () => {
      const templates = {
        system: 'You are {{role}}',
        user: 'My name is {{name}}',
        error: 'Error: {{message}}'
      };
      
      manager.loadTemplates(templates);
      
      expect(manager.templates.system).toBe('You are {{role}}');
      expect(manager.templates.user).toBe('My name is {{name}}');
      expect(manager.templates.error).toBe('Error: {{message}}');
    });

    it('should override existing templates', () => {
      manager.loadTemplate('greeting', 'Hello!');
      manager.loadTemplate('greeting', 'Hi there!');
      
      expect(manager.templates.greeting).toBe('Hi there!');
    });

    it('should get template by name', () => {
      manager.loadTemplate('test', 'Test template');
      
      const template = manager.getTemplate('test');
      expect(template).toBe('Test template');
    });

    it('should return null for non-existent template', () => {
      const template = manager.getTemplate('non-existent');
      expect(template).toBeNull();
    });
  });

  describe('Variable Management', () => {
    beforeEach(() => {
      manager = new PromptManager();
    });

    it('should set a single variable', () => {
      manager.setVariable('username', 'Alice');
      
      expect(manager.variables.username).toBe('Alice');
    });

    it('should set multiple variables', () => {
      manager.setVariables({
        user: 'Bob',
        age: 25,
        active: true
      });
      
      expect(manager.variables.user).toBe('Bob');
      expect(manager.variables.age).toBe(25);
      expect(manager.variables.active).toBe(true);
    });

    it('should get variable value', () => {
      manager.setVariable('key', 'value');
      
      expect(manager.getVariable('key')).toBe('value');
    });

    it('should return undefined for non-existent variable', () => {
      expect(manager.getVariable('non-existent')).toBeUndefined();
    });

    it('should clear all variables', () => {
      manager.setVariables({ a: 1, b: 2, c: 3 });
      manager.clearVariables();
      
      expect(manager.variables).toEqual({});
    });
  });

  describe('Template Variable Replacement', () => {
    beforeEach(() => {
      manager = new PromptManager();
    });

    it('should replace single variable in template', () => {
      const template = 'Hello, {{name}}!';
      const result = manager.renderTemplate(template, { name: 'World' });
      
      expect(result).toBe('Hello, World!');
    });

    it('should replace multiple variables in template', () => {
      const template = '{{greeting}}, {{name}}! You have {{count}} messages.';
      const result = manager.renderTemplate(template, {
        greeting: 'Hi',
        name: 'Alice',
        count: 5
      });
      
      expect(result).toBe('Hi, Alice! You have 5 messages.');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello, {{name}}! Your role is {{role}}.';
      const result = manager.renderTemplate(template, { name: 'Bob' });
      
      expect(result).toBe('Hello, Bob! Your role is {{role}}.');
    });

    it('should use global variables if not provided', () => {
      manager.setVariable('globalName', 'GlobalUser');
      
      const template = 'Hello, {{globalName}}!';
      const result = manager.renderTemplate(template);
      
      expect(result).toBe('Hello, GlobalUser!');
    });

    it('should prefer provided variables over global ones', () => {
      manager.setVariable('name', 'GlobalName');
      
      const template = 'Hello, {{name}}!';
      const result = manager.renderTemplate(template, { name: 'LocalName' });
      
      expect(result).toBe('Hello, LocalName!');
    });

    it('should handle nested variable replacement', () => {
      const template = '{{user.name}} is {{user.age}} years old';
      const result = manager.renderTemplate(template, {
        'user.name': 'John',
        'user.age': 30
      });
      
      expect(result).toBe('John is 30 years old');
    });
  });

  describe('Prompt Construction', () => {
    beforeEach(() => {
      manager = new PromptManager({
        templates: {
          system: 'You are {{role}}. {{instructions}}',
          user: 'User: {{message}}',
          assistant: 'Assistant: {{response}}'
        }
      });
    });

    it('should construct system prompt', () => {
      const prompt = manager.constructSystemPrompt({
        role: 'a helpful assistant',
        instructions: 'Be concise and accurate.'
      });
      
      expect(prompt).toBe('You are a helpful assistant. Be concise and accurate.');
    });

    it('should construct user prompt', () => {
      const prompt = manager.constructUserPrompt('What is the weather?');
      
      expect(prompt).toBe('User: What is the weather?');
    });

    it('should construct full conversation prompt', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];
      
      const prompt = manager.constructConversationPrompt(messages);
      
      expect(prompt).toContain('You are helpful');
      expect(prompt).toContain('Hello');
      expect(prompt).toContain('Hi there!');
      expect(prompt).toContain('How are you?');
    });

    it('should format messages for LLM', () => {
      const messages = [
        { role: 'user', content: 'Test message' }
      ];
      
      const formatted = manager.formatForLLM(messages, {
        maxTokens: 100,
        temperature: 0.7
      });
      
      expect(formatted.messages).toEqual(messages);
      expect(formatted.maxTokens).toBe(100);
      expect(formatted.temperature).toBe(0.7);
    });
  });

  describe('Response Formatting', () => {
    beforeEach(() => {
      manager = new PromptManager();
    });

    it('should format response as plain text', () => {
      manager.responseFormat = 'text';
      const formatted = manager.formatResponse('Hello, world!');
      
      expect(formatted).toBe('Hello, world!');
    });

    it('should format response as JSON', () => {
      manager.responseFormat = 'json';
      const response = { message: 'Hello', status: 'success' };
      const formatted = manager.formatResponse(response);
      
      expect(formatted).toBe(JSON.stringify(response, null, 2));
    });

    it('should format response as markdown', () => {
      manager.responseFormat = 'markdown';
      const response = {
        title: 'Test',
        content: 'This is content',
        list: ['item1', 'item2']
      };
      
      const formatted = manager.formatResponse(response);
      
      expect(formatted).toContain('# Test');
      expect(formatted).toContain('This is content');
      expect(formatted).toContain('- item1');
      expect(formatted).toContain('- item2');
    });

    it('should handle string response in JSON format', () => {
      manager.responseFormat = 'json';
      const formatted = manager.formatResponse('Simple string');
      
      expect(formatted).toBe('"Simple string"');
    });

    it('should parse response based on format', () => {
      manager.responseFormat = 'json';
      const parsed = manager.parseResponse('{"key": "value"}');
      
      expect(parsed).toEqual({ key: 'value' });
    });

    it('should handle parse errors gracefully', () => {
      manager.responseFormat = 'json';
      const parsed = manager.parseResponse('not valid json');
      
      expect(parsed).toBe('not valid json');
    });
  });

  describe('Template Validation', () => {
    beforeEach(() => {
      manager = new PromptManager();
    });

    it('should validate template syntax', () => {
      const valid = manager.validateTemplate('Hello {{name}}!');
      expect(valid).toBe(true);
    });

    it('should detect unclosed variables', () => {
      const valid = manager.validateTemplate('Hello {{name!');
      expect(valid).toBe(false);
    });

    it('should detect unmatched brackets', () => {
      const valid = manager.validateTemplate('Hello {{name}} {{age');
      expect(valid).toBe(false);
    });

    it('should extract variable names from template', () => {
      const vars = manager.extractVariables('Hello {{name}}, you are {{age}} years old');
      
      expect(vars).toEqual(['name', 'age']);
    });

    it('should handle duplicate variables', () => {
      const vars = manager.extractVariables('{{name}} is {{name}} and {{age}}');
      
      expect(vars).toEqual(['name', 'age']);
    });
  });

  describe('Prompt Chaining', () => {
    beforeEach(() => {
      manager = new PromptManager({
        templates: {
          step1: 'First: {{input}}',
          step2: 'Second: {{previous}}',
          step3: 'Final: {{result}}'
        }
      });
    });

    it('should chain prompts together', () => {
      const chain = manager.createPromptChain([
        { template: 'step1', variables: { input: 'start' } },
        { template: 'step2', useOutput: 'previous' },
        { template: 'step3', useOutput: 'result' }
      ]);
      
      expect(chain).toHaveLength(3);
      expect(chain[0]).toContain('First: start');
    });

    it('should pass output between chained prompts', async () => {
      const executor = async (prompt) => {
        return `Processed: ${prompt}`;
      };
      
      const result = await manager.executePromptChain([
        { template: 'step1', variables: { input: 'test' } }
      ], executor);
      
      expect(result).toContain('Processed');
      expect(result).toContain('First: test');
    });
  });

  describe('Prompt History', () => {
    beforeEach(() => {
      manager = new PromptManager({ enableHistory: true });
    });

    it('should track prompt history', () => {
      manager.addToHistory('prompt1', 'response1');
      manager.addToHistory('prompt2', 'response2');
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].prompt).toBe('prompt1');
      expect(history[0].response).toBe('response1');
    });

    it('should limit history size', () => {
      manager.maxHistorySize = 2;
      
      manager.addToHistory('prompt1', 'response1');
      manager.addToHistory('prompt2', 'response2');
      manager.addToHistory('prompt3', 'response3');
      
      const history = manager.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].prompt).toBe('prompt2');
      expect(history[1].prompt).toBe('prompt3');
    });

    it('should clear history', () => {
      manager.addToHistory('prompt1', 'response1');
      manager.clearHistory();
      
      expect(manager.getHistory()).toHaveLength(0);
    });
  });
});