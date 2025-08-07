/**
 * Tests for Configuration-driven tool creation
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest } from '@jest/globals';
import { 
  ConfigurationWrapper,
  parseToolConfiguration,
  validateToolSchema,
  generateToolFromConfig,
  generateMetadataFromSchema
} from '../../src/utils/ConfigurationWrapper.js';

describe('Configuration-driven Tool Creation', () => {
  describe('parseToolConfiguration - Configuration parsing', () => {
    test('should parse basic tool configuration', () => {
      const config = {
        name: 'testTool',
        description: 'A test tool',
        input: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        output: {
          type: 'object',
          properties: {
            result: { type: 'string' }
          }
        }
      };

      const parsed = parseToolConfiguration(config);
      
      expect(parsed.name).toBe('testTool');
      expect(parsed.description).toBe('A test tool');
      expect(parsed.input).toBeDefined();
      expect(parsed.output).toBeDefined();
    });

    test('should parse configuration with method reference', () => {
      const config = {
        name: 'methodTool',
        method: 'processData',
        parameterMapping: {
          input: 0,
          options: 1
        }
      };

      const parsed = parseToolConfiguration(config);
      
      expect(parsed.method).toBe('processData');
      expect(parsed.parameterMapping).toBeDefined();
    });

    test('should parse configuration with transforms', () => {
      const config = {
        name: 'transformTool',
        inputTransform: (input) => ({ data: input }),
        outputTransform: (output) => output.result
      };

      const parsed = parseToolConfiguration(config);
      
      expect(typeof parsed.inputTransform).toBe('function');
      expect(typeof parsed.outputTransform).toBe('function');
    });

    test('should handle missing required fields', () => {
      const config = {
        description: 'Missing name'
      };

      expect(() => parseToolConfiguration(config)).toThrow('Tool configuration must have a name');
    });
  });

  describe('validateToolSchema - Schema validation', () => {
    test('should validate input against schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          age: { type: 'number', required: false }
        }
      };

      const valid = validateToolSchema({ name: 'John' }, schema);
      expect(valid).toBe(true);

      const invalid = validateToolSchema({ age: 'thirty' }, schema);
      expect(invalid).toBe(false);
    });

    test('should validate nested schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', required: true },
              email: { type: 'string', required: true }
            }
          }
        }
      };

      const valid = validateToolSchema({
        user: { id: '123', email: 'test@example.com' }
      }, schema);
      expect(valid).toBe(true);
    });

    test('should validate array schemas', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' }
      };

      const valid = validateToolSchema([1, 2, 3], schema);
      expect(valid).toBe(true);

      const invalid = validateToolSchema([1, 'two', 3], schema);
      expect(invalid).toBe(false);
    });

    test('should handle optional fields with defaults', () => {
      const schema = {
        type: 'object',
        properties: {
          timeout: { type: 'number', default: 5000 }
        }
      };

      const result = validateToolSchema({}, schema, { applyDefaults: true });
      expect(result).toEqual({ timeout: 5000 });
    });
  });

  describe('generateToolFromConfig - Automatic tool generation', () => {
    test('should generate tool from simple configuration', async () => {
      const config = {
        name: 'simpleTool',
        description: 'A simple tool',
        execute: async (input) => {
          return { message: `Hello ${input.name}` };
        }
      };

      const tool = generateToolFromConfig(config);
      
      expect(tool.name).toBe('simpleTool');
      const result = await tool.execute({ name: 'World' });
      expect(result).toEqual({ message: 'Hello World' });
    });

    test('should generate tool with method binding', async () => {
      const sourceObject = {
        value: 10,
        multiply(input) {
          return this.value * input.factor;
        }
      };

      const config = {
        name: 'multiplyTool',
        method: 'multiply',
        source: sourceObject
      };

      const tool = generateToolFromConfig(config);
      const result = await tool.execute({ factor: 5 });
      expect(result).toBe(50);
    });

    test('should generate tool with input validation', async () => {
      const config = {
        name: 'validatedTool',
        inputSchema: {
          type: 'object',
          properties: {
            required: { type: 'string', required: true }
          }
        },
        execute: async (input) => {
          return { got: input.required };
        }
      };

      const tool = generateToolFromConfig(config);
      
      // Valid input
      const result = await tool.execute({ required: 'value' });
      expect(result).toEqual({ got: 'value' });

      // Invalid input - Tool wraps errors instead of throwing
      const errorResult = await tool.execute({});
      expect(errorResult.success).toBe(false);
      expect(errorResult.error.message).toBe('Input validation failed');
    });

    test('should generate tool with transforms', async () => {
      const config = {
        name: 'transformedTool',
        inputTransform: (input) => ({ processed: input.raw }),
        outputTransform: (output) => ({ final: output.intermediate }),
        execute: async (input) => {
          return { intermediate: input.processed.toUpperCase() };
        }
      };

      const tool = generateToolFromConfig(config);
      const result = await tool.execute({ raw: 'hello' });
      expect(result).toEqual({ final: 'HELLO' });
    });
  });

  describe('generateMetadataFromSchema - Schema-based metadata', () => {
    test('should generate metadata from input/output schemas', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message to process' }
        }
      };

      const outputSchema = {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'The processing result' }
        }
      };

      const metadata = generateMetadataFromSchema({
        description: 'Process a message',
        inputSchema,
        outputSchema
      });

      expect(metadata.description).toBe('Process a message');
      expect(metadata.input).toEqual(inputSchema);
      expect(metadata.output).toEqual(outputSchema);
    });

    test('should include examples if provided', () => {
      const metadata = generateMetadataFromSchema({
        description: 'Example tool',
        examples: [
          { input: { x: 1 }, output: { y: 2 } }
        ]
      });

      expect(metadata.examples).toHaveLength(1);
      expect(metadata.examples[0]).toEqual({ input: { x: 1 }, output: { y: 2 } });
    });

    test('should include tags and categories', () => {
      const metadata = generateMetadataFromSchema({
        description: 'Tagged tool',
        tags: ['utility', 'text'],
        category: 'text-processing'
      });

      expect(metadata.tags).toEqual(['utility', 'text']);
      expect(metadata.category).toBe('text-processing');
    });

    test('should handle complex nested schemas', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  name: { type: 'string' }
                }
              }
            }
          }
        }
      };

      const metadata = generateMetadataFromSchema({
        description: 'Complex tool',
        inputSchema
      });

      expect(metadata.input).toEqual(inputSchema);
    });
  });

  describe('ConfigurationWrapper - Complete configuration system', () => {
    test('should create multiple tools from configuration object', () => {
      const config = {
        tools: {
          tool1: {
            description: 'First tool',
            execute: async (input) => ({ result: 'tool1' })
          },
          tool2: {
            description: 'Second tool',
            execute: async (input) => ({ result: 'tool2' })
          }
        }
      };

      const wrapper = new ConfigurationWrapper(config);
      const tools = wrapper.createTools();

      expect(tools.tool1).toBeDefined();
      expect(tools.tool2).toBeDefined();
      expect(tools.tool1.name).toBe('tool1');
      expect(tools.tool2.name).toBe('tool2');
    });

    test('should bind methods from source object', async () => {
      const source = {
        prefix: 'Result: ',
        process(input) {
          return this.prefix + input.value;
        }
      };

      const config = {
        source,
        tools: {
          processTool: {
            method: 'process',
            description: 'Process with prefix'
          }
        }
      };

      const wrapper = new ConfigurationWrapper(config);
      const tools = wrapper.createTools();

      const result = await tools.processTool.execute({ value: 'test' });
      expect(result).toBe('Result: test');
    });

    test('should apply global defaults to all tools', async () => {
      const config = {
        defaults: {
          timeout: 3000,
          retries: 2
        },
        tools: {
          tool1: {
            execute: async (input) => ({ result: 'ok' })
          }
        }
      };

      const wrapper = new ConfigurationWrapper(config);
      const tools = wrapper.createTools();

      const metadata = tools.tool1.getMetadata();
      expect(metadata.timeout).toBe(3000);
      expect(metadata.retries).toBe(2);
    });

    test('should validate configuration schema', () => {
      const config = {
        schema: {
          version: { type: 'string', required: true }
        },
        version: '1.0.0',
        tools: {}
      };

      const wrapper = new ConfigurationWrapper(config);
      expect(() => wrapper.validate()).not.toThrow();

      const invalidConfig = {
        schema: {
          version: { type: 'string', required: true }
        },
        tools: {}
      };

      const invalidWrapper = new ConfigurationWrapper(invalidConfig);
      expect(() => invalidWrapper.validate()).toThrow('Configuration validation failed');
    });

    test('should support async tool initialization', async () => {
      const config = {
        tools: {
          asyncTool: {
            initialize: async () => {
              // Simulate async initialization
              await new Promise(resolve => setTimeout(resolve, 10));
              return { initialized: true };
            },
            execute: async function(input) {
              return { ...this.state, ...input };
            }
          }
        }
      };

      const wrapper = new ConfigurationWrapper(config);
      const tools = await wrapper.createToolsAsync();

      const result = await tools.asyncTool.execute({ value: 'test' });
      expect(result).toEqual({ initialized: true, value: 'test' });
    });
  });
});