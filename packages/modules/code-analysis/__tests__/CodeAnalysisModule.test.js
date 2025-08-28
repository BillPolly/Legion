/**
 * Test for CodeAnalysisModule - Legion Module Pattern
 */

import { describe, test, expect } from '@jest/globals';
import CodeAnalysisModule from '../src/CodeAnalysisModule.js';

describe('CodeAnalysisModule', () => {
  let module;

  beforeEach(async () => {
    module = new CodeAnalysisModule();
    await module.initialize();
  });

  afterEach(async () => {
    if (module) {
      await module.cleanup();
    }
  });

  describe('Legion Module Pattern Compliance', () => {
    test('should be properly configured as a Legion module', () => {
      expect(module.name).toBe('code-analysis');
      expect(module.description).toContain('Code analysis tools');
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
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBe('validate_javascript');
    });

    test('should allow tool retrieval by name', () => {
      const tool = module.getTool('validate_javascript');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('validate_javascript');
    });

    test('should provide comprehensive metadata', () => {
      const metadata = module.getMetadata();
      expect(metadata).toHaveProperty('name', 'code-analysis');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('version', '1.0.0');
      expect(metadata).toHaveProperty('capabilities');
      expect(metadata).toHaveProperty('supportedFeatures');
      expect(Array.isArray(metadata.capabilities)).toBe(true);
      expect(Array.isArray(metadata.supportedFeatures)).toBe(true);
    });
  });

  describe('Module Initialization', () => {
    test('should throw error when getting tools before initialization', async () => {
      const uninitializedModule = new CodeAnalysisModule();
      expect(() => uninitializedModule.getTools()).toThrow('CodeAnalysisModule must be initialized before getting tools');
    });

    test('should register tools during initialization', async () => {
      const newModule = new CodeAnalysisModule();
      await newModule.initialize();
      
      const tools = newModule.getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
      
      await newModule.cleanup();
    });
  });

  describe('Codebase Analysis', () => {
    test('should analyze JavaScript files', async () => {
      const result = await module.analyzeCodebase({
        javascriptFiles: [
          {
            path: 'test.js',
            code: 'const x = 42; console.log(x);'
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.javascript).toHaveLength(1);
      expect(result.results.summary.totalFiles).toBe(1);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    test('should handle analysis errors gracefully', async () => {
      // Mock the tool to throw an error
      const originalTool = module.getTool('validate_javascript');
      module.tools['validate_javascript'] = {
        execute: async () => {
          throw new Error('Analysis failed');
        }
      };

      const result = await module.analyzeCodebase({
        javascriptFiles: [
          {
            path: 'test.js',
            code: 'const x = 42;'
          }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analysis failed');
      
      // Restore original tool
      module.tools['validate_javascript'] = originalTool;
    });

    test('should generate recommendations based on analysis', async () => {
      const result = await module.analyzeCodebase({
        javascriptFiles: [
          {
            path: 'security-issue.js',
            code: 'eval(userInput); document.innerHTML = userData;' // Security issues
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.category === 'security')).toBe(true);
    });
  });

  describe('Static Factory Method', () => {
    test('should create module with static create method', async () => {
      const createdModule = await CodeAnalysisModule.create(null);
      expect(createdModule).toBeInstanceOf(CodeAnalysisModule);
      expect(createdModule.initialized).toBe(true);
      
      await createdModule.cleanup();
    });
  });
});