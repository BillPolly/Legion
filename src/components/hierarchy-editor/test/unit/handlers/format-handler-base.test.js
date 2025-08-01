/**
 * FormatHandler Base Class Tests
 */
import { createTestNode } from '../../test-helpers.js';

describe('FormatHandler Base Class', () => {
  let FormatHandler;
  let ConcreteHandler;

  beforeEach(async () => {
    const module = await import('../../../handlers/FormatHandler.js');
    FormatHandler = module.FormatHandler;
    
    // Create concrete implementation for testing
    ConcreteHandler = class extends FormatHandler {
      constructor() {
        super('test', {
          name: 'Test Format',
          extensions: ['.test'],
          mimeTypes: ['text/test']
        });
      }

      parse(content) {
        if (!content) return null;
        return createTestNode('object', 'parsed', null);
      }

      serialize(node) {
        if (!node) return '';
        return `test:${node.name}:${node.value}`;
      }

      validate(content) {
        return {
          valid: typeof content === 'string' && content.length > 0,
          errors: typeof content === 'string' && content.length > 0 ? [] : ['Content must be non-empty string']
        };
      }
    };
  });

  describe('FormatHandler Interface', () => {
    test('should define abstract interface', () => {
      expect(FormatHandler).toBeDefined();
      expect(typeof FormatHandler).toBe('function');
    });

    test('should throw error when instantiating abstract class directly', () => {
      expect(() => new FormatHandler()).toThrow();
    });

    test('should require format type in constructor', () => {
      expect(() => new ConcreteHandler()).not.toThrow();
    });

    test('should store format metadata', () => {
      const handler = new ConcreteHandler();
      
      expect(handler.formatType).toBe('test');
      expect(handler.metadata.name).toBe('Test Format');
      expect(handler.metadata.extensions).toEqual(['.test']);
      expect(handler.metadata.mimeTypes).toEqual(['text/test']);
    });

    test('should provide format information methods', () => {
      const handler = new ConcreteHandler();
      
      expect(handler.getFormatType()).toBe('test');
      expect(handler.getName()).toBe('Test Format');
      expect(handler.getExtensions()).toEqual(['.test']);
      expect(handler.getMimeTypes()).toEqual(['text/test']);
    });
  });

  describe('Format Metadata', () => {
    test('should store and retrieve format name', () => {
      const handler = new ConcreteHandler();
      
      expect(handler.getName()).toBe('Test Format');
      expect(handler.metadata.name).toBe('Test Format');
    });

    test('should store file extensions', () => {
      const handler = new ConcreteHandler();
      
      expect(handler.getExtensions()).toEqual(['.test']);
      expect(handler.metadata.extensions).toContain('.test');
    });

    test('should store MIME types', () => {
      const handler = new ConcreteHandler();
      
      expect(handler.getMimeTypes()).toEqual(['text/test']);
      expect(handler.metadata.mimeTypes).toContain('text/test');
    });

    test('should support multiple extensions and MIME types', () => {
      class MultiFormatHandler extends FormatHandler {
        constructor() {
          super('multi', {
            name: 'Multi Format',
            extensions: ['.multi', '.m', '.mf'],
            mimeTypes: ['text/multi', 'application/multi']
          });
        }

        parse() { return null; }
        serialize() { return ''; }
        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new MultiFormatHandler();
      
      expect(handler.getExtensions()).toEqual(['.multi', '.m', '.mf']);
      expect(handler.getMimeTypes()).toEqual(['text/multi', 'application/multi']);
    });

    test('should handle optional metadata fields', () => {
      class MinimalHandler extends FormatHandler {
        constructor() {
          super('minimal');
        }

        parse() { return null; }
        serialize() { return ''; }
        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new MinimalHandler();
      
      expect(handler.getFormatType()).toBe('minimal');
      expect(handler.getName()).toBe('minimal'); // Defaults to format type
      expect(handler.getExtensions()).toEqual([]);
      expect(handler.getMimeTypes()).toEqual([]);
    });
  });

  describe('Validation Interface', () => {
    test('should provide validation method', () => {
      const handler = new ConcreteHandler();
      
      expect(typeof handler.validate).toBe('function');
    });

    test('should validate content correctly', () => {
      const handler = new ConcreteHandler();
      
      const validResult = handler.validate('valid content');
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);
      
      const invalidResult = handler.validate('');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('should return validation object with required structure', () => {
      const handler = new ConcreteHandler();
      
      const result = handler.validate('test content');
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    test('should handle edge cases in validation', () => {
      const handler = new ConcreteHandler();
      
      const nullResult = handler.validate(null);
      expect(nullResult.valid).toBe(false);
      
      const undefinedResult = handler.validate(undefined);
      expect(undefinedResult.valid).toBe(false);
      
      const numberResult = handler.validate(123);
      expect(numberResult.valid).toBe(false);
    });
  });

  describe('Abstract Method Requirements', () => {
    test('should require parse method implementation', () => {
      class IncompleteHandler extends FormatHandler {
        constructor() {
          super('incomplete');
        }
        // Missing parse method
        serialize() { return ''; }
        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new IncompleteHandler();
      expect(() => handler.parse('content')).toThrow();
    });

    test('should require serialize method implementation', () => {
      class IncompleteHandler extends FormatHandler {
        constructor() {
          super('incomplete');
        }
        parse() { return null; }
        // Missing serialize method
        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new IncompleteHandler();
      expect(() => handler.serialize({})).toThrow();
    });

    test('should require validate method implementation', () => {
      class IncompleteHandler extends FormatHandler {
        constructor() {
          super('incomplete');
        }
        parse() { return null; }
        serialize() { return ''; }
        // Missing validate method
      }

      const handler = new IncompleteHandler();
      expect(() => handler.validate('content')).toThrow();
    });

    test('should work when all abstract methods are implemented', () => {
      const handler = new ConcreteHandler();
      
      expect(() => handler.parse('content')).not.toThrow();
      expect(() => handler.serialize({})).not.toThrow();
      expect(() => handler.validate('content')).not.toThrow();
    });
  });

  describe('Handler Capabilities', () => {
    test('should report supported operations', () => {
      const handler = new ConcreteHandler();
      
      expect(handler.canParse()).toBe(true);
      expect(handler.canSerialize()).toBe(true);
      expect(handler.canValidate()).toBe(true);
    });

    test('should support capability checking', () => {
      const handler = new ConcreteHandler();
      
      const capabilities = handler.getCapabilities();
      expect(capabilities).toHaveProperty('parse');
      expect(capabilities).toHaveProperty('serialize');
      expect(capabilities).toHaveProperty('validate');
      expect(capabilities.parse).toBe(true);
      expect(capabilities.serialize).toBe(true);
      expect(capabilities.validate).toBe(true);
    });

    test('should allow partial implementations', () => {
      class ReadOnlyHandler extends FormatHandler {
        constructor() {
          super('readonly', {
            name: 'Read Only Format'
          });
        }

        parse(content) {
          return createTestNode('value', 'readonly', content);
        }

        serialize() {
          throw new Error('Serialization not supported');
        }

        validate(content) {
          return { valid: true, errors: [] };
        }

        canSerialize() {
          return false;
        }
      }

      const handler = new ReadOnlyHandler();
      
      expect(handler.canParse()).toBe(true);
      expect(handler.canSerialize()).toBe(false);
      expect(handler.canValidate()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle parse errors gracefully', () => {
      class ErrorHandler extends FormatHandler {
        constructor() {
          super('error');
        }

        parse() {
          throw new Error('Parse error');
        }

        serialize() { return ''; }
        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new ErrorHandler();
      
      expect(() => handler.parse('content')).toThrow('Parse error');
    });

    test('should handle serialize errors gracefully', () => {
      class ErrorHandler extends FormatHandler {
        constructor() {
          super('error');
        }

        parse() { return null; }
        
        serialize() {
          throw new Error('Serialize error');
        }

        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new ErrorHandler();
      
      expect(() => handler.serialize({})).toThrow('Serialize error');
    });

    test('should provide error context', () => {
      class ContextualErrorHandler extends FormatHandler {
        constructor() {
          super('contextual');
        }

        parse(content) {
          if (!content) {
            const error = new Error('Empty content provided');
            error.formatType = this.formatType;
            error.operation = 'parse';
            throw error;
          }
          return null;
        }

        serialize() { return ''; }
        validate() { return { valid: true, errors: [] }; }
      }

      const handler = new ContextualErrorHandler();
      
      try {
        handler.parse('');
      } catch (error) {
        expect(error.formatType).toBe('contextual');
        expect(error.operation).toBe('parse');
      }
    });
  });
});