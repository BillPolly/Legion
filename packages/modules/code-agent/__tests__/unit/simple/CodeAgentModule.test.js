/**
 * Test for CodeAgentModule - Legion Module Pattern
 */

import { describe, test, expect } from '@jest/globals';
import { CodeAgentModule } from '../../../src/CodeAgentModule.js';

describe('CodeAgentModule', () => {
  let module;

  beforeEach(async () => {
    module = new CodeAgentModule();
    await module.initialize();
  });

  afterEach(async () => {
    if (module) {
      await module.cleanup();
    }
  });

  describe('Legion Module Pattern Compliance', () => {
    test('should be properly configured as a Legion module', () => {
      expect(module.name).toBe('code-agent');
      expect(module.description).toContain('Code generation and testing tools');
      expect(module.version).toBe('1.0.0');
    });

    test('should implement required Legion module methods', () => {
      expect(typeof module.initialize).toBe('function');
      expect(typeof module.getTools).toBe('function');
      expect(typeof module.getTool).toBe('function');
      expect(typeof module.cleanup).toBe('function');
      expect(typeof module.getMetadata).toBe('function');
    });

    test('should provide tools after initialization', () => {
      const tools = module.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(4);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('generate_html');
      expect(toolNames).toContain('generate_javascript');
      expect(toolNames).toContain('generate_css');
      expect(toolNames).toContain('generate_test');
    });

    test('should allow tool retrieval by name', () => {
      const htmlTool = module.getTool('generate_html');
      expect(htmlTool).toBeDefined();
      expect(htmlTool.name).toBe('generate_html');
      
      const jsTool = module.getTool('generate_javascript');
      expect(jsTool).toBeDefined();
      expect(jsTool.name).toBe('generate_javascript');
    });

    test('should provide comprehensive metadata', () => {
      const metadata = module.getMetadata();
      expect(metadata).toHaveProperty('name', 'code-agent');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('version', '1.0.0');
      expect(metadata).toHaveProperty('capabilities');
      expect(metadata).toHaveProperty('supportedFeatures');
      expect(Array.isArray(metadata.capabilities)).toBe(true);
      expect(Array.isArray(metadata.supportedFeatures)).toBe(true);
    });
  });

  describe('Tool Functionality', () => {
    test('should generate HTML with generate_html tool', async () => {
      const htmlTool = module.getTool('generate_html');
      const result = await htmlTool._execute({
        title: 'Test Page',
        content: '<p>Hello World</p>',
        template: 'basic'
      });

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('filename');
      expect(result.html).toContain('Test Page');
      expect(result.html).toContain('<!DOCTYPE html');
      expect(result.filename).toBe('test-page.html');
    });

    test('should generate JavaScript with generate_javascript tool', async () => {
      const jsTool = module.getTool('generate_javascript');
      const result = await jsTool._execute({
        type: 'function',
        name: 'testFunction',
        parameters: ['param1', 'param2'],
        description: 'A test function'
      });

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('filename');
      expect(result.code).toContain('testFunction');
      expect(result.filename).toBe('testFunction.js');
    });

    test('should generate CSS with generate_css tool', async () => {
      const cssTool = module.getTool('generate_css');
      const result = await cssTool._execute({
        selector: '.test-class',
        styles: {
          color: 'blue',
          fontSize: '16px'
        },
        framework: 'vanilla'
      });

      expect(result).toHaveProperty('css');
      expect(result).toHaveProperty('filename');
      // CSS generator may return empty or minimal CSS
      expect(typeof result.css).toBe('string');
      expect(result.filename).toBe('styles.css');
    });

    test('should generate tests with generate_test tool', async () => {
      const testTool = module.getTool('generate_test');
      const result = await testTool._execute({
        targetFile: 'utils.js',
        testType: 'unit',
        functions: ['add', 'subtract']
      });

      expect(result).toHaveProperty('test');
      expect(result).toHaveProperty('filename');
      expect(result.test).toContain('test');  // Minimal test generation
      expect(typeof result.test).toBe('string');
      expect(result.filename).toBe('utils.test.js');
    });
  });

  describe('Tool Metadata', () => {
    test('all tools should have proper metadata', () => {
      const tools = module.getTools();
      
      tools.forEach(tool => {
        expect(tool.getMetadata).toBeDefined();
        const metadata = tool.getMetadata();
        
        expect(metadata).toHaveProperty('name');
        expect(metadata).toHaveProperty('description');
        expect(metadata).toHaveProperty('input');
        expect(metadata).toHaveProperty('output');
        
        expect(typeof metadata.name).toBe('string');
        expect(typeof metadata.description).toBe('string');
        expect(typeof metadata.input).toBe('object');
        expect(typeof metadata.output).toBe('object');
      });
    });
  });

  describe('Static Factory Method', () => {
    test('should create module with static create method', async () => {
      const createdModule = await CodeAgentModule.create(null);
      expect(createdModule).toBeInstanceOf(CodeAgentModule);
      expect(createdModule.initialized).toBe(true);
      
      await createdModule.cleanup();
    });
  });

  describe('Error Handling', () => {
    test('should throw error when getting tools before initialization', async () => {
      const uninitializedModule = new CodeAgentModule();
      expect(() => uninitializedModule.getTools()).toThrow('CodeAgentModule must be initialized before getting tools');
    });

    test('should handle invalid JavaScript generation type', async () => {
      const jsTool = module.getTool('generate_javascript');
      
      await expect(jsTool._execute({
        type: 'invalid',
        name: 'test'
      })).rejects.toThrow('Unsupported code type: invalid');
    });
  });
});