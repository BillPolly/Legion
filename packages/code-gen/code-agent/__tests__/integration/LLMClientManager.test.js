/**
 * Tests for LLMClientManager integration with @jsenvoy/llm
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LLMClientManager } from '../../src/integration/LLMClientManager.js';

describe('LLMClientManager', () => {
  let manager;

  beforeEach(() => {
    manager = new LLMClientManager({
      provider: 'mock',
      apiKey: 'test-key',
      model: 'test-model'
    });
  });

  describe('Constructor', () => {
    test('should create LLMClientManager instance', () => {
      expect(manager).toBeDefined();
      expect(manager.config.provider).toBe('mock');
      expect(manager.config.apiKey).toBe('test-key');
      expect(manager.config.model).toBe('test-model');
      expect(manager.llmClient).toBeNull();
      expect(manager.initialized).toBe(false);
    });

    test('should create with default configuration', () => {
      const defaultManager = new LLMClientManager();
      
      expect(defaultManager.config.provider).toBe('openai');
      expect(defaultManager.config.model).toBe('gpt-3.5-turbo');
      expect(defaultManager.config.maxRetries).toBe(3);
      expect(defaultManager.config.baseDelay).toBe(1000);
    });
  });

  describe('Initialization', () => {
    test('should initialize with LLM client', async () => {
      await manager.initialize();
      
      expect(manager.initialized).toBe(true);
      expect(manager.llmClient).toBeDefined();
    });

    test('should throw error if initialization fails with invalid config', async () => {
      const invalidManager = new LLMClientManager({
        provider: 'invalid-provider'
      });
      
      await expect(invalidManager.initialize()).rejects.toThrow();
    });

    test('should handle missing API key gracefully', async () => {
      const noKeyManager = new LLMClientManager({
        provider: 'mock', // Use mock provider for testing
        apiKey: null
      });
      
      // Should initialize but may fail on actual calls
      await expect(noKeyManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Code Generation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should generate JavaScript code', async () => {
      const prompt = 'Create a function that adds two numbers';
      const options = {
        language: 'javascript',
        style: 'functional'
      };

      const result = await manager.generateCode(prompt, options);
      
      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(typeof result.code).toBe('string');
      expect(result.language).toBe('javascript');
    });

    test('should generate HTML code', async () => {
      const prompt = 'Create a simple HTML form with name and email fields';
      const options = {
        language: 'html',
        semantic: true
      };

      const result = await manager.generateCode(prompt, options);
      
      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toContain('<form');
      expect(result.language).toBe('html');
    });

    test('should generate CSS code', async () => {
      const prompt = 'Create CSS for a responsive navigation bar';
      const options = {
        language: 'css',
        responsive: true
      };

      const result = await manager.generateCode(prompt, options);
      
      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.language).toBe('css');
    });

    test('should handle code generation errors', async () => {
      const invalidPrompt = '';
      
      const result = await manager.generateCode(invalidPrompt);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Code Analysis', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should analyze existing code patterns', async () => {
      const codeExample = `
        function calculateTotal(items) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `;

      const result = await manager.analyzeCode(codeExample, {
        detectPatterns: true,
        language: 'javascript'
      });
      
      expect(result.success).toBe(true);
      expect(result.patterns).toBeDefined();
      expect(result.language).toBe('javascript');
      expect(result.analysis).toBeDefined();
    });

    test('should identify coding style', async () => {
      const codeExample = `
        const users = [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ];
      `;

      const result = await manager.analyzeCode(codeExample, {
        detectStyle: true
      });
      
      expect(result.success).toBe(true);
      expect(result.style).toBeDefined();
      expect(result.style).toHaveProperty('quotes');
      expect(result.style).toHaveProperty('indentation');
    });

    test('should detect dependencies and imports', async () => {
      const codeExample = `
        import React from 'react';
        import { useState } from 'react';
        const fs = require('fs');
      `;

      const result = await manager.analyzeCode(codeExample, {
        detectDependencies: true
      });
      
      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Test Generation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should generate unit tests for functions', async () => {
      const sourceCode = `
        function add(a, b) {
          return a + b;
        }
      `;

      const result = await manager.generateTests(sourceCode, {
        testType: 'unit',
        framework: 'jest'
      });
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      expect(result.tests).toContain('describe');
      expect(result.tests).toContain('test');
      expect(result.framework).toBe('jest');
    });

    test('should generate integration tests', async () => {
      const sourceCode = `
        class UserService {
          async getUser(id) {
            // Implementation
          }
        }
      `;

      const result = await manager.generateTests(sourceCode, {
        testType: 'integration',
        framework: 'jest'
      });
      
      expect(result.success).toBe(true);
      expect(result.tests).toBeDefined();
      expect(result.testType).toBe('integration');
    });

    test('should generate test data and fixtures', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' }
        }
      };

      const result = await manager.generateTestData(schema, {
        count: 5,
        realistic: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(5);
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('age');
      expect(result.data[0]).toHaveProperty('email');
    });
  });

  describe('Error Handling and Fixes', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should analyze ESLint errors and suggest fixes', async () => {
      const errorReport = {
        filePath: '/path/to/file.js',
        messages: [
          {
            ruleId: 'no-unused-vars',
            severity: 2,
            message: "'unusedVar' is defined but never used.",
            line: 5,
            column: 7
          }
        ]
      };

      const result = await manager.analyzeLintErrors(errorReport);
      
      expect(result.success).toBe(true);
      expect(result.fixes).toBeDefined();
      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.fixes[0]).toHaveProperty('ruleId');
      expect(result.fixes[0]).toHaveProperty('suggestedFix');
    });

    test('should analyze test failures and suggest fixes', async () => {
      const testFailure = {
        testName: 'should calculate total correctly',
        error: 'Expected 15, received 10',
        code: 'const total = calculateTotal([5, 5]);',
        expectedResult: 15,
        actualResult: 10
      };

      const result = await manager.analyzeTestFailures([testFailure]);
      
      expect(result.success).toBe(true);
      expect(result.fixes).toBeDefined();
      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.fixes[0]).toHaveProperty('testName');
      expect(result.fixes[0]).toHaveProperty('suggestedFix');
    });

    test('should generate targeted code fixes', async () => {
      const brokenCode = `
        function calculateDiscount(price, discount) {
          return price * discount; // Bug: should be price * (1 - discount)
        }
      `;

      const issue = {
        type: 'logic_error',
        description: 'Discount calculation is incorrect',
        line: 3
      };

      const result = await manager.generateFix(brokenCode, issue);
      
      expect(result.success).toBe(true);
      expect(result.fixedCode).toBeDefined();
      expect(result.fixedCode).toContain('1 - discount');
      expect(result.explanation).toBeDefined();
    });
  });

  describe('Response Validation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should validate generated code syntax', async () => {
      const validCode = 'const x = 5;';
      const invalidCode = 'const x = ;';

      const validResult = await manager.validateCodeSyntax(validCode, 'javascript');
      const invalidResult = await manager.validateCodeSyntax(invalidCode, 'javascript');
      
      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
    });

    test('should validate JSON responses', async () => {
      const validJson = '{"name": "test", "value": 123}';
      const invalidJson = '{"name": "test", "value":}';

      const validResult = await manager.validateJSON(validJson);
      const invalidResult = await manager.validateJSON(invalidJson);
      
      expect(validResult.valid).toBe(true);
      expect(validResult.data).toEqual({ name: 'test', value: 123 });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('Configuration and Settings', () => {
    test('should update configuration', () => {
      manager.updateConfig({
        model: 'gpt-4',
        temperature: 0.7
      });
      
      expect(manager.config.model).toBe('gpt-4');
      expect(manager.config.temperature).toBe(0.7);
    });

    test('should get current configuration', () => {
      const config = manager.getConfig();
      
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('apiKey');
    });

    test('should validate configuration', () => {
      const validConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo'
      };

      const invalidConfig = {
        provider: 'invalid'
      };

      expect(manager.validateConfig(validConfig)).toBe(true);
      expect(manager.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('Integration with jsEnvoy LLM', () => {
    test('should use LLMClient from @jsenvoy/llm', async () => {
      await manager.initialize();
      
      expect(manager.llmClient).toBeDefined();
      expect(typeof manager.llmClient.sendAndReceiveResponse).toBe('function');
    });

    test('should handle different LLM providers', async () => {
      const providers = ['openai', 'anthropic', 'deepseek', 'mock'];
      
      for (const provider of providers) {
        const testManager = new LLMClientManager({
          provider,
          apiKey: 'test-key'
        });
        
        await expect(testManager.initialize()).resolves.not.toThrow();
        expect(testManager.config.provider).toBe(provider);
      }
    });

    test('should handle retry logic and error recovery', async () => {
      const retryManager = new LLMClientManager({
        provider: 'mock',
        maxRetries: 3,
        baseDelay: 100
      });

      await retryManager.initialize();
      
      // Mock a failing request that succeeds on retry
      const result = await retryManager.generateCode('test prompt', {
        simulateFailure: true,
        succeedOnRetry: 2
      });
      
      expect(result.success).toBe(true);
      expect(result.retries).toBeLessThanOrEqual(3);
    });
  });
});