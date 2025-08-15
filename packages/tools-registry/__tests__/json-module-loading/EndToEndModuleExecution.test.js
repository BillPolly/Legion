/**
 * End-to-End JSON Module Loading Test
 * 
 * Tests the complete JSON module loading flow including:
 * - Loading actual module.json files
 * - Instantiating real module implementations
 * - Executing tools with real method calls
 * - Validating results and error handling
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ModuleLoader } from '../../src/loading/ModuleLoader.js';
import { DynamicJsonModule } from '../../src/loading/DynamicJsonModule.js';
import { ResourceManager } from '@legion/core';
import fs from 'fs/promises';
import path from 'path';

describe('End-to-End JSON Module Loading', () => {
  let moduleLoader;
  let resourceManager;
  
  beforeEach(async () => {
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    moduleLoader = new ModuleLoader({ 
      resourceManager,
      verbose: false 
    });
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  test('should create and execute a simple JSON module with actual implementation', async () => {
    // Create a simple test module implementation
    const testModuleDir = '/tmp/test-json-module-' + Date.now();
    await fs.mkdir(testModuleDir, { recursive: true });

    try {
      // Write the module implementation as CommonJS (to avoid ES module import issues in temp files)
      const moduleImplementation = `
class TestModule {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async executeCalculation(input) {
    if (!this.initialized) {
      throw new Error('Module not initialized');
    }
    
    const { operation, a, b } = input;
    
    switch (operation) {
      case 'add':
        return { result: a + b, operation };
      case 'multiply':
        return { result: a * b, operation };
      case 'subtract':
        return { result: a - b, operation };
      default:
        throw new Error(\`Unknown operation: \${operation}\`);
    }
  }

  getModuleInfo() {
    return {
      name: 'TestModule',
      version: '1.0.0',
      initialized: this.initialized,
      config: this.config
    };
  }
}

module.exports = TestModule;`;

      await fs.writeFile(path.join(testModuleDir, 'TestModule.js'), moduleImplementation);

      // Create the module.json definition
      const moduleDefinition = {
        name: 'test-calculation-module',
        version: '1.0.0',
        description: 'A test module for end-to-end JSON loading validation',
        package: './TestModule.js',
        type: 'constructor',
        dependencies: {
          'TEST_CONFIG_VALUE': {
            type: 'string',
            description: 'Test configuration value'
          }
        },
        initialization: {
          className: 'TestModule',
          config: {
            testValue: '${TEST_CONFIG_VALUE}',
            enableLogging: true
          }
        },
        tools: [
          {
            name: 'calculate',
            description: 'Performs mathematical calculations',
            function: 'executeCalculation',
            instanceMethod: true,
            async: true,
            parameters: {
              type: 'object',
              properties: {
                operation: {
                  type: 'string',
                  enum: ['add', 'subtract', 'multiply'],
                  description: 'The mathematical operation to perform'
                },
                a: {
                  type: 'number',
                  description: 'First operand'
                },
                b: {
                  type: 'number',
                  description: 'Second operand'
                }
              },
              required: ['operation', 'a', 'b']
            },
            resultMapping: {
              success: {
                value: '$.result',
                operationType: '$.operation'
              }
            }
          },
          {
            name: 'module_info',
            description: 'Gets information about the module',
            function: 'getModuleInfo',
            instanceMethod: true,
            async: false,
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };

      // Set test environment variable
      process.env.TEST_CONFIG_VALUE = 'test-config-12345';

      // Add basePath to definition
      moduleDefinition.basePath = testModuleDir;

      // Create module from definition
      // First write the module.json file
      await fs.writeFile(path.join(testModuleDir, 'module.json'), JSON.stringify(moduleDefinition, null, 2));
      const module = await DynamicJsonModule.createFromJson(path.join(testModuleDir, 'module.json'), testModuleDir);

      expect(module).toBeDefined();
      expect(module.definition.name).toBe('test-calculation-module');
      expect(module.moduleImplementation).toBeDefined();
      expect(module.moduleImplementation.initialized).toBe(true);

      // Test that tools were created
      const tools = module.getTools();
      expect(tools).toHaveLength(2);

      const calculateTool = module.getTool('calculate');
      const moduleInfoTool = module.getTool('module_info');

      expect(calculateTool).toBeDefined();
      expect(moduleInfoTool).toBeDefined();

      // Test tool execution - addition
      const addResult = await calculateTool.execute({
        operation: 'add',
        a: 5,
        b: 3
      });

      expect(addResult.success).toBe(true);
      expect(addResult.data.value).toBe(8);
      expect(addResult.data.operationType).toBe('add');

      // Test tool execution - multiplication
      const multiplyResult = await calculateTool.execute({
        operation: 'multiply',
        a: 4,
        b: 7
      });

      expect(multiplyResult.success).toBe(true);
      expect(multiplyResult.data.value).toBe(28);
      expect(multiplyResult.data.operationType).toBe('multiply');

      // Test module info tool
      const infoResult = await moduleInfoTool.execute({});

      expect(infoResult.success).toBe(true);
      expect(infoResult.data.name).toBe('TestModule');
      expect(infoResult.data.initialized).toBe(true);
      expect(infoResult.data.config.testValue).toBe('test-config-12345');
      expect(infoResult.data.config.enableLogging).toBe(true);

      // Test error handling - validation should catch invalid enum value
      const errorResult = await calculateTool.execute({
        operation: 'divide',  // Unsupported operation - not in enum
        a: 10,
        b: 2
      });

      expect(errorResult.success).toBe(false);
      // The Tool class validates input and rejects invalid enum values
      const errorMessage = errorResult.error || errorResult.data?.errorMessage;
      expect(errorMessage).toContain('Validation failed');
      expect(errorMessage).toContain('divide');

      // Clean up
      delete process.env.TEST_CONFIG_VALUE;

    } finally {
      // Clean up test directory
      await fs.rm(testModuleDir, { recursive: true, force: true });
    }
  });

  test('should handle modules without package implementation (definition-only)', async () => {
    // Create a module definition without package (no actual implementation)
    const moduleDefinition = {
      name: 'definition-only-module',
      description: 'A module that has no actual implementation file',
      tools: [
        {
          name: 'mock_tool',
          description: 'A tool that has no actual implementation',
          function: 'mockFunction',
          parameters: {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: 'Mock input'
              }
            }
          }
        }
      ]
    };

    // This should create the module but tools will fail when executed
    const testDir = '/tmp/test-definition-only-' + Date.now();
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'module.json'), JSON.stringify(moduleDefinition, null, 2));
    const module = await DynamicJsonModule.createFromJson(path.join(testDir, 'module.json'), testDir);
    await fs.rm(testDir, { recursive: true, force: true });

    expect(module).toBeDefined();
    expect(module.definition.name).toBe('definition-only-module');
    expect(module.moduleImplementation).toBeNull();

    const tools = module.getTools();
    expect(tools).toHaveLength(1);

    const mockTool = module.getTool('mock_tool');
    expect(mockTool).toBeDefined();

    // Execution should fail because there's no implementation
    const result = await mockTool.execute({ input: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No module implementation loaded for tool mock_tool');
  });

  test('should handle module loading errors gracefully', async () => {
    // Create module definition with invalid package path
    const moduleDefinition = {
      name: 'invalid-package-module',
      description: 'A module with an invalid package path',
      package: './NonExistentModule.js',
      basePath: '/tmp',
      tools: [
        {
          name: 'test_tool',
          description: 'Test tool',
          function: 'execute'
        }
      ]
    };

    // This should fail during module creation
    const testDir = '/tmp/test-invalid-' + Date.now();
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'module.json'), JSON.stringify(moduleDefinition, null, 2));
    
    await expect(DynamicJsonModule.createFromJson(path.join(testDir, 'module.json'), testDir))
      .rejects
      .toThrow();
    
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should validate environment variable resolution in real module execution', async () => {
    const testModuleDir = '/tmp/test-env-module-' + Date.now();
    await fs.mkdir(testModuleDir, { recursive: true });

    try {
      // Create a module that uses environment variables (CommonJS format)
      const moduleImplementation = `
class EnvTestModule {
  constructor(config = {}) {
    this.config = config;
  }

  getConfig() {
    return this.config;
  }

  processWithKey(input) {
    return {
      input: input,
      apiKey: this.config.apiKey,
      environment: this.config.environment,
      processed: true
    };
  }
}

module.exports = EnvTestModule;`;

      await fs.writeFile(path.join(testModuleDir, 'EnvTestModule.js'), moduleImplementation);

      // Set multiple environment variables
      process.env.TEST_API_KEY = 'secret-api-key-98765';
      process.env.TEST_ENVIRONMENT = 'development';

      const moduleDefinition = {
        name: 'env-test-module',
        description: 'Module for testing environment variable resolution',
        package: './EnvTestModule.js',
        basePath: testModuleDir,
        dependencies: {
          'TEST_API_KEY': {
            type: 'string',
            description: 'API key for external service'
          },
          'TEST_ENVIRONMENT': {
            type: 'string',
            description: 'Current environment'
          }
        },
        initialization: {
          config: {
            apiKey: '${TEST_API_KEY}',
            environment: '${TEST_ENVIRONMENT}',
            staticValue: 'unchanged'
          }
        },
        tools: [
          {
            name: 'get_config',
            description: 'Get module configuration',
            function: 'getConfig',
            instanceMethod: true,
            async: false
          },
          {
            name: 'process_with_key',
            description: 'Process input using API key',
            function: 'processWithKey',
            instanceMethod: true,
            async: false,
            parameters: {
              type: 'object',
              properties: {
                data: {
                  type: 'string',
                  description: 'Data to process'
                }
              },
              required: ['data']
            }
          }
        ]
      };

      await fs.writeFile(path.join(testModuleDir, 'module.json'), JSON.stringify(moduleDefinition, null, 2));
      const module = await DynamicJsonModule.createFromJson(path.join(testModuleDir, 'module.json'), testModuleDir);

      // Test configuration resolution
      const configTool = module.getTool('get_config');
      const configResult = await configTool.execute({});

      expect(configResult.success).toBe(true);
      expect(configResult.data.apiKey).toBe('secret-api-key-98765');
      expect(configResult.data.environment).toBe('development');
      expect(configResult.data.staticValue).toBe('unchanged');

      // Test tool that uses resolved configuration
      const processTool = module.getTool('process_with_key');
      const processResult = await processTool.execute({ data: 'test-data' });

      expect(processResult.success).toBe(true);
      expect(processResult.data.input.data).toBe('test-data');
      expect(processResult.data.apiKey).toBe('secret-api-key-98765');
      expect(processResult.data.environment).toBe('development');
      expect(processResult.data.processed).toBe(true);

      // Clean up environment variables
      delete process.env.TEST_API_KEY;
      delete process.env.TEST_ENVIRONMENT;

    } finally {
      await fs.rm(testModuleDir, { recursive: true, force: true });
    }
  });
});