/**
 * Unit tests for TemplateProcessor core class
 * Tests template parsing, placeholder extraction, and basic substitution
 */

import { TemplateProcessor } from '../../src/TemplateProcessor.js';

describe('TemplateProcessor', () => {
  describe('constructor', () => {
    test('should create processor with template', () => {
      const template = 'Hello {{name}}!';
      const processor = new TemplateProcessor(template);
      
      expect(processor).toBeDefined();
      expect(processor.template).toBe(template);
    });

    test('should throw error for invalid template', () => {
      expect(() => new TemplateProcessor(null))
        .toThrow('Template must be a non-empty string');
      
      expect(() => new TemplateProcessor(''))
        .toThrow('Template must be a non-empty string');
    });
  });

  describe('extractPlaceholders', () => {
    test('should extract simple placeholders', () => {
      const template = 'Hello {{name}}, your score is {{score}}!';
      const processor = new TemplateProcessor(template);
      
      const placeholders = processor.extractPlaceholders();
      expect(placeholders).toEqual(['name', 'score']);
    });

    test('should extract placeholders with type hints', () => {
      const template = 'Code: {{code|type:code}} and chat: {{history|type:chat}}';
      const processor = new TemplateProcessor(template);
      
      const placeholders = processor.extractPlaceholders();
      expect(placeholders).toContain('code');
      expect(placeholders).toContain('history');
    });

    test('should extract context variables', () => {
      const template = 'Use {{@userGoals:goals}} and {{@techStack:stack}} in analysis';
      const processor = new TemplateProcessor(template);
      
      const placeholders = processor.extractPlaceholders();
      expect(placeholders).toContain('@userGoals');
      expect(placeholders).toContain('@techStack');
    });

    test('should handle nested object access', () => {
      const template = 'User: {{user.profile.name}} ({{user.account.type}})';
      const processor = new TemplateProcessor(template);
      
      const placeholders = processor.extractPlaceholders();
      expect(placeholders).toEqual(['user.profile.name', 'user.account.type']);
    });

    test('should handle conditional sections', () => {
      const template = '{{#hasItems}}Items: {{items}}{{/hasItems}}';
      const processor = new TemplateProcessor(template);
      
      const placeholders = processor.extractPlaceholders();
      expect(placeholders).toContain('hasItems');
      expect(placeholders).toContain('items');
    });
  });

  describe('parsePlaceholderOptions', () => {
    test('should parse type hints', () => {
      const processor = new TemplateProcessor('{{test}}');
      
      const options = processor.parsePlaceholderOptions('code|type:code|lang:javascript');
      expect(options).toEqual({
        name: 'code',
        type: 'code',
        lang: 'javascript'
      });
    });

    test('should parse size constraints', () => {
      const processor = new TemplateProcessor('{{test}}');
      
      const options = processor.parsePlaceholderOptions('text|maxLength:500|summarize:true');
      expect(options).toEqual({
        name: 'text',
        maxLength: '500',
        summarize: 'true'
      });
    });

    test('should handle simple placeholder names', () => {
      const processor = new TemplateProcessor('{{test}}');
      
      const options = processor.parsePlaceholderOptions('simpleVar');
      expect(options).toEqual({
        name: 'simpleVar'
      });
    });

    test('should parse context variable syntax', () => {
      const processor = new TemplateProcessor('{{test}}');
      
      const options = processor.parsePlaceholderOptions('@contextVar:description');
      expect(options).toEqual({
        name: '@contextVar',
        contextKey: 'description',
        isContextVariable: true
      });
    });
  });

  describe('validateTemplate', () => {
    test('should validate correct template', () => {
      const template = 'Hello {{name}}, analyze {{code|type:code}}';
      const processor = new TemplateProcessor(template);
      
      expect(() => processor.validateTemplate()).not.toThrow();
    });

    test('should detect unclosed placeholders', () => {
      const template = 'Hello {{name}, analyze {{code}}';
      const processor = new TemplateProcessor(template);
      
      expect(() => processor.validateTemplate())
        .toThrow('Unclosed placeholder found');
    });

    test('should detect unmatched sections', () => {
      const template = '{{#section}}Content{{/wrongSection}}';
      const processor = new TemplateProcessor(template);
      
      expect(() => processor.validateTemplate())
        .toThrow('Unmatched section');
    });

    test('should detect invalid context variable syntax', () => {
      const template = 'Use {{@invalidSyntax}} in analysis';
      const processor = new TemplateProcessor(template);
      
      expect(() => processor.validateTemplate())
        .toThrow('Invalid context variable syntax');
    });
  });

  describe('substituteBasic', () => {
    test('should substitute simple placeholders', () => {
      const template = 'Hello {{name}}, your score is {{score}}!';
      const processor = new TemplateProcessor(template);
      
      const result = processor.substituteBasic({
        name: 'John',
        score: 85
      });
      
      expect(result).toBe('Hello John, your score is 85!');
    });

    test('should handle nested object access', () => {
      const template = 'User: {{user.profile.name}} ({{user.account.type}})';
      const processor = new TemplateProcessor(template);
      
      const result = processor.substituteBasic({
        user: {
          profile: { name: 'John Doe' },
          account: { type: 'premium' }
        }
      });
      
      expect(result).toBe('User: John Doe (premium)');
    });

    test('should handle missing values gracefully', () => {
      const template = 'Hello {{name}}, your score is {{missing}}!';
      const processor = new TemplateProcessor(template);
      
      const result = processor.substituteBasic({
        name: 'John'
      });
      
      expect(result).toBe('Hello John, your score is {{missing}}!');
    });

    test('should handle arrays and objects', () => {
      const template = 'Items: {{items}} and config: {{config}}';
      const processor = new TemplateProcessor(template);
      
      const result = processor.substituteBasic({
        items: ['a', 'b', 'c'],
        config: { key: 'value' }
      });
      
      expect(result).toContain('Items: a,b,c');
      expect(result).toContain('config: [object Object]');
    });
  });

  describe('processConditionalSections', () => {
    test('should process conditional sections', () => {
      const template = '{{#hasItems}}Items: {{items}}{{/hasItems}}';
      const processor = new TemplateProcessor(template);
      
      const resultWith = processor.processConditionalSections({
        hasItems: true,
        items: ['a', 'b']
      });
      expect(resultWith).toBe('Items: a,b');
      
      const resultWithout = processor.processConditionalSections({
        hasItems: false,
        items: ['a', 'b']
      });
      expect(resultWithout).toBe('');
    });

    test('should handle nested conditional sections', () => {
      const template = '{{#user}}User: {{user.name}}{{#user.premium}} (Premium){{/user.premium}}{{/user}}';
      const processor = new TemplateProcessor(template);
      
      const result = processor.processConditionalSections({
        user: {
          name: 'John',
          premium: true
        }
      });
      
      expect(result).toContain('User: John (Premium)');
    });
  });

  describe('getNestedValue', () => {
    test('should get nested values from object', () => {
      const processor = new TemplateProcessor('{{test}}');
      
      const obj = {
        user: {
          profile: {
            name: 'John',
            settings: {
              theme: 'dark'
            }
          }
        }
      };
      
      expect(processor.getNestedValue(obj, 'user.profile.name')).toBe('John');
      expect(processor.getNestedValue(obj, 'user.profile.settings.theme')).toBe('dark');
      expect(processor.getNestedValue(obj, 'user.missing.path')).toBeUndefined();
    });

    test('should handle array indices', () => {
      const processor = new TemplateProcessor('{{test}}');
      
      const obj = {
        items: ['first', 'second', 'third'],
        users: [
          { name: 'John' },
          { name: 'Jane' }
        ]
      };
      
      expect(processor.getNestedValue(obj, 'items.0')).toBe('first');
      expect(processor.getNestedValue(obj, 'items.2')).toBe('third');
      expect(processor.getNestedValue(obj, 'users.1.name')).toBe('Jane');
    });
  });
});