/**
 * Tests for all Node.js strategy prompts
 * Tests prompts SEPARATELY from strategies with proper example data
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import PromptFactory from '../../src/utils/PromptFactory.js';

// Import strategies to get their prompt definitions
import SimpleNodeServerStrategy from '../../src/strategies/simple-node/SimpleNodeServerStrategy.js';
import SimpleNodeTestStrategy from '../../src/strategies/simple-node/SimpleNodeTestStrategy.js';
import SimpleNodeDebugStrategy from '../../src/strategies/simple-node/SimpleNodeDebugStrategy.js';

describe('Node Strategy Prompts', () => {
  let llmClient;
  let resourceManager;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    if (!llmClient) {
      throw new Error('LLM client not available from ResourceManager');
    }
  });

  describe('SimpleNodeServerStrategy prompts', () => {
    let prompts;

    beforeAll(() => {
      const strategy = new SimpleNodeServerStrategy();
      const promptDefs = strategy._getPromptDefinitions();
      
      // Create all prompts with the factory
      prompts = PromptFactory.createPrompts(promptDefs, llmClient);
    });

    test('analyzeServerRequirements prompt should extract server requirements', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.analyzeServerRequirements,
        {
          taskDescription: 'Create an Express API server with /users and /posts endpoints for a blog'
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.serverType).toBeDefined();
      expect(['express', 'http', 'fastify', 'koa']).toContain(result.data.serverType);
      expect(result.data.endpoints).toBeInstanceOf(Array);
      expect(result.data.endpoints.length).toBeGreaterThan(0);
      
      // Check endpoint structure
      const firstEndpoint = result.data.endpoints[0];
      expect(firstEndpoint).toHaveProperty('method');
      expect(firstEndpoint).toHaveProperty('path');
      expect(firstEndpoint).toHaveProperty('description');
    }, 30000);

    test('generateServerCode prompt should generate server code', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.generateServerCode,
        {
          serverType: 'express',
          endpoints: [
            { method: 'GET', path: '/api/health', description: 'Health check' },
            { method: 'GET', path: '/api/users', description: 'Get all users' },
            { method: 'POST', path: '/api/users', description: 'Create user' }
          ]
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.code).toBeDefined();
      expect(typeof result.data.code).toBe('string');
      expect(result.data.code.length).toBeGreaterThan(100);
      expect(result.data.code).toContain('express');
      expect(result.data.code).toContain('/api/health');
      expect(result.data.dependencies).toBeInstanceOf(Array);
      expect(result.data.dependencies).toContain('express');
    }, 30000);

    test('generatePackageJson prompt should create valid package.json', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.generatePackageJson,
        {
          serverType: 'fastify',
          dependencies: 'fastify, @fastify/cors, dotenv'
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.packageJson).toBeDefined();
      expect(typeof result.data.packageJson).toBe('object');
      expect(result.data.packageJson.name).toBeDefined();
      expect(result.data.packageJson.scripts).toBeDefined();
      expect(result.data.packageJson.scripts.start).toBeDefined();
      expect(result.data.packageJson.type).toBe('module');
    }, 30000);
  });

  describe('SimpleNodeTestStrategy prompts', () => {
    let prompts;

    beforeAll(() => {
      const strategy = new SimpleNodeTestStrategy();
      const promptDefs = strategy._getPromptDefinitions();
      prompts = PromptFactory.createPrompts(promptDefs, llmClient);
    });

    test('analyzeCodeForTesting prompt should identify test targets', async () => {
      const sampleCode = `
        export function calculateTotal(price, tax) {
          if (!price || price < 0) throw new Error('Invalid price');
          return price + (price * tax);
        }
        
        export class UserService {
          async getUser(id) {
            // Fetch user from database
            return { id, name: 'Test User' };
          }
        }
      `;

      const result = await PromptFactory.executePrompt(
        prompts.analyzeCodeForTesting,
        { code: sampleCode }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.testTargets).toBeInstanceOf(Array);
      expect(result.data.testTargets.length).toBeGreaterThan(0);
      
      // Should identify both function and class
      const targetTypes = result.data.testTargets.map(t => t.type);
      expect(targetTypes).toContain('function');
      expect(targetTypes).toContain('class');
      
      expect(result.data.edgeCases).toBeInstanceOf(Array);
      expect(result.data.errorScenarios).toBeInstanceOf(Array);
    }, 30000);

    test('generateTestCode prompt should generate Jest tests', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.generateTestCode,
        {
          targetName: 'calculateDiscount',
          targetType: 'function',
          targetDescription: 'Calculates discount based on amount and percentage',
          edgeCases: ['zero amount', 'negative percentage', '100% discount']
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.testCode).toBeDefined();
      expect(typeof result.data.testCode).toBe('string');
      expect(result.data.testCode).toContain('describe');
      expect(result.data.testCode).toContain('it');
      expect(result.data.testCode).toContain('expect');
      expect(result.data.testDescription).toBeDefined();
    }, 15000);

    test('generateTestScript prompt should create test configuration', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.generateTestScript,
        {
          testFiles: 'user.test.js, api.test.js, utils.test.js'
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.scripts).toBeDefined();
      expect(result.data.scripts.test).toBeDefined();
      expect(result.data.scripts.test).toContain('jest');
      expect(result.data.jestConfig).toBeDefined();
      expect(result.data.jestConfig.testEnvironment).toBe('node');
    });
  });

  describe('SimpleNodeDebugStrategy prompts', () => {
    let prompts;

    beforeAll(() => {
      const strategy = new SimpleNodeDebugStrategy();
      const promptDefs = strategy._getPromptDefinitions();
      prompts = PromptFactory.createPrompts(promptDefs, llmClient);
    });

    test('analyzeError prompt should identify error causes', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.analyzeError,
        {
          errorMessage: "Cannot read property 'name' of undefined",
          stackTrace: `TypeError: Cannot read property 'name' of undefined
    at getUserName (/app/user.js:15:22)
    at processUser (/app/main.js:42:18)`,
          codeContext: `function getUserName(user) {
  return user.name.toUpperCase();
}`
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.rootCause).toBeDefined();
      expect(result.data.errorType).toBeDefined();
      expect(result.data.errorType).toContain('TypeError');
      expect(result.data.suggestedFix).toBeDefined();
      expect(result.data.location).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.data.confidence);
    });

    test('generateFix prompt should fix code issues', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.generateFix,
        {
          problem: "Server crashes with 'port already in use' error",
          rootCause: 'Port is not released properly on shutdown',
          originalCode: `const server = app.listen(3000, () => {
  console.log('Server started');
});`
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.fixedCode).toBeDefined();
      expect(typeof result.data.fixedCode).toBe('string');
      expect(result.data.explanation).toBeDefined();
      expect(result.data.testingSteps).toBeDefined();
    }, 15000);

    test('addDebugging prompt should add debug statements', async () => {
      const result = await PromptFactory.executePrompt(
        prompts.addDebugging,
        {
          code: `async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}`
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.debugCode).toBeDefined();
      expect(typeof result.data.debugCode).toBe('string');
      expect(result.data.debugCode).toContain('console.log');
      expect(result.data.debugPoints).toBeDefined();
    }, 15000);
  });

  describe('Format specification in prompts', () => {
    test('code generation prompts should use delimited format', () => {
      const serverStrategy = new SimpleNodeServerStrategy();
      const serverPromptDefs = serverStrategy._getPromptDefinitions();
      
      // Check that code generation uses delimited format
      expect(serverPromptDefs.generateServerCode.responseSchema['x-output-format']).toBe('delimited');
      
      const testStrategy = new SimpleNodeTestStrategy();
      const testPromptDefs = testStrategy._getPromptDefinitions();
      expect(testPromptDefs.generateTestCode.responseSchema['x-output-format']).toBe('delimited');
      
      const debugStrategy = new SimpleNodeDebugStrategy();
      const debugPromptDefs = debugStrategy._getPromptDefinitions();
      expect(debugPromptDefs.generateFix.responseSchema['x-output-format']).toBe('delimited');
      expect(debugPromptDefs.addDebugging.responseSchema['x-output-format']).toBe('delimited');
    });

    test('data structure prompts should use JSON format', () => {
      const serverStrategy = new SimpleNodeServerStrategy();
      const serverPromptDefs = serverStrategy._getPromptDefinitions();
      
      // Analysis prompts should default to JSON (no x-output-format specified)
      expect(serverPromptDefs.analyzeServerRequirements.responseSchema['x-output-format']).toBeUndefined();
      expect(serverPromptDefs.generatePackageJson.responseSchema['x-output-format']).toBeUndefined();
    });
  });

  describe('Example data validation', () => {
    test('all prompts should have valid examples', () => {
      // Test SimpleNodeServerStrategy examples
      const serverStrategy = new SimpleNodeServerStrategy();
      const serverPromptDefs = serverStrategy._getPromptDefinitions();
      
      for (const [name, def] of Object.entries(serverPromptDefs)) {
        expect(def.examples).toBeDefined();
        expect(def.examples.length).toBeGreaterThan(0);
        
        // Validate examples against schema
        expect(() => {
          PromptFactory.validateExamples(def.examples, def.responseSchema);
        }).not.toThrow();
      }
      
      // Test SimpleNodeTestStrategy examples
      const testStrategy = new SimpleNodeTestStrategy();
      const testPromptDefs = testStrategy._getPromptDefinitions();
      
      for (const [name, def] of Object.entries(testPromptDefs)) {
        expect(def.examples).toBeDefined();
        expect(def.examples.length).toBeGreaterThan(0);
        
        expect(() => {
          PromptFactory.validateExamples(def.examples, def.responseSchema);
        }).not.toThrow();
      }
      
      // Test SimpleNodeDebugStrategy examples
      const debugStrategy = new SimpleNodeDebugStrategy();
      const debugPromptDefs = debugStrategy._getPromptDefinitions();
      
      for (const [name, def] of Object.entries(debugPromptDefs)) {
        expect(def.examples).toBeDefined();
        expect(def.examples.length).toBeGreaterThan(0);
        
        expect(() => {
          PromptFactory.validateExamples(def.examples, def.responseSchema);
        }).not.toThrow();
      }
    });
  });
});