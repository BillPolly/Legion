/**
 * E2E test for loading and executing BT workflows from JSON configuration
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { RealDevTools } from '../../src/tools/dev-tools.js';
import fs from 'fs/promises';
import path from 'path';

// Mock ToolRegistry
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.providers = new Map();
  }

  async getTool(toolName) {
    return this.tools.get(toolName);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  async registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }
}

describe('Config-Based Workflow E2E Tests', () => {
  let toolRegistry;
  let executor;
  let devTools;
  const testWorkingDir = './test-config-generated';

  beforeEach(async () => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);
    devTools = new RealDevTools(testWorkingDir);

    // Register all real tools
    toolRegistry.registerTool('classGenerator', devTools.createClassGenerator());
    toolRegistry.registerTool('testGenerator', devTools.createTestGenerator());
    toolRegistry.registerTool('testRunner', devTools.createTestRunner());
    toolRegistry.registerTool('codeFixer', devTools.createCodeFixer());
    toolRegistry.registerTool('successValidator', devTools.createSuccessValidator());

    // Ensure clean test environment
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Cleanup after tests
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('SimpleClassGenerator Configuration', () => {
    test('should load and execute SimpleClassGenerator config', async () => {
      // Load the configuration
      const configPath = path.join(process.cwd(), 'configs/SimpleClassGenerator.json');
      const configJson = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configJson);

      // Create BT tool from configuration
      const btTool = new BehaviorTreeTool(config, toolRegistry);
      
      // Execute the workflow
      const result = await btTool.execute({
        className: 'SimpleService',
        description: 'A simple service class',
        methods: ['process', 'validate', 'cleanup']
      });

      expect(result.success).toBe(true);
      
      // Access the data from the execution context
      const classData = result.data.context['generate-class'].data;
      const testData = result.data.context['generate-tests'].data;
      
      expect(classData.code).toContain('class SimpleService');
      expect(testData.testCode).toContain('describe(\'SimpleService\'');
      
      // Verify actual files were created
      const classFile = path.join(testWorkingDir, 'src', 'SimpleService.js');
      const testFile = path.join(testWorkingDir, 'tests', 'SimpleService.test.js');
      
      const classExists = await fs.access(classFile).then(() => true).catch(() => false);
      const testExists = await fs.access(testFile).then(() => true).catch(() => false);
      
      expect(classExists).toBe(true);
      expect(testExists).toBe(true);
    });
  });

  describe('ClassGeneratorWorkflow Configuration', () => {
    test('should load and execute ClassGeneratorWorkflow config with retry', async () => {
      // Load the configuration  
      const configPath = path.join(process.cwd(), 'configs/ClassGeneratorWorkflow.json');
      const configJson = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configJson);

      // Create BT tool from configuration
      const btTool = new BehaviorTreeTool(config, toolRegistry);
      
      // Execute the workflow
      const result = await btTool.execute({
        className: 'ProductManager',
        description: 'Manages product inventory',
        methods: ['addProduct', 'findProduct', 'updateStock']
      });

      expect(result.success).toBe(true);
      
      // Access the data from the execution context 
      const classData = result.data.context['generate-class'].data;
      const testData = result.data.context['generate-tests'].data;
      
      expect(classData.code).toContain('class ProductManager');
      expect(testData.testCode).toContain('describe(\'ProductManager\'');
      expect(result.data.context.totalAttempts || 1).toBeGreaterThan(0);
      
      // Verify actual files were created
      const classFile = path.join(testWorkingDir, 'src', 'ProductManager.js'); 
      const testFile = path.join(testWorkingDir, 'tests', 'ProductManager.test.js');
      
      const classExists = await fs.access(classFile).then(() => true).catch(() => false);
      const testExists = await fs.access(testFile).then(() => true).catch(() => false);
      
      expect(classExists).toBe(true);
      expect(testExists).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration structure', async () => {
      const configPath = path.join(process.cwd(), 'configs/SimpleClassGenerator.json');
      const configJson = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configJson);

      // Validate required fields
      expect(config.name).toBeDefined();
      expect(config.description).toBeDefined();
      expect(config.input).toBeDefined();
      expect(config.output).toBeDefined();
      expect(config.implementation).toBeDefined();

      // Validate input schema
      expect(config.input.className).toBeDefined();
      expect(config.input.className.required).toBe(true);
      expect(config.input.methods).toBeDefined();
      expect(config.input.methods.required).toBe(true);

      // Validate workflow structure
      expect(config.implementation.type).toBe('sequence');
      expect(config.implementation.children).toBeInstanceOf(Array);
      expect(config.implementation.children.length).toBeGreaterThan(0);
    });

    test('should validate ClassGeneratorWorkflow config has retry structure', async () => {
      const configPath = path.join(process.cwd(), 'configs/ClassGeneratorWorkflow.json');
      const configJson = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configJson);

      // Validate retry structure
      expect(config.implementation.type).toBe('retry');
      expect(config.implementation.maxAttempts).toBeGreaterThan(1);
      expect(config.implementation.child).toBeDefined();
      expect(config.implementation.child.type).toBe('sequence');
    });
  });

  describe('Configuration as Reusable Tool', () => {
    test('should use config-based tool in larger workflow', async () => {
      // Load SimpleClassGenerator config
      const configPath = path.join(process.cwd(), 'configs/SimpleClassGenerator.json');
      const configJson = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configJson);

      // Register as tool
      const classGenTool = new BehaviorTreeTool(config, toolRegistry);
      toolRegistry.registerTool('SimpleClassGen', classGenTool);

      // Create a workflow that uses the config-based tool multiple times
      const multiClassWorkflow = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'SimpleClassGen',
            params: {
              className: 'AuthService',
              description: 'Authentication service',
              methods: ['login', 'logout', 'verify']
            }
          },
          {
            type: 'action', 
            tool: 'SimpleClassGen',
            params: {
              className: 'EmailService',
              description: 'Email sending service',
              methods: ['send', 'validate', 'queue']
            }
          },
          {
            type: 'action',
            tool: 'SimpleClassGen',
            params: {
              className: 'LogService',
              description: 'Logging service',
              methods: ['info', 'warn', 'error']
            }
          }
        ]
      };

      const result = await executor.executeTree(multiClassWorkflow, {});

      expect(result.success).toBe(true);
      
      // Verify all classes were created
      const expectedClasses = ['AuthService', 'EmailService', 'LogService'];
      for (const className of expectedClasses) {
        const classFile = path.join(testWorkingDir, 'src', `${className}.js`);
        const testFile = path.join(testWorkingDir, 'tests', `${className}.test.js`);
        
        const classExists = await fs.access(classFile).then(() => true).catch(() => false);
        const testExists = await fs.access(testFile).then(() => true).catch(() => false);
        
        expect(classExists).toBe(true);
        expect(testExists).toBe(true);
      }
    });
  });

  describe('Error Handling with Configurations', () => {
    test('should handle invalid input according to config schema', async () => {
      const configPath = path.join(process.cwd(), 'configs/SimpleClassGenerator.json');
      const configJson = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configJson);

      const btTool = new BehaviorTreeTool(config, toolRegistry);
      
      // Missing required field
      const result = await btTool.execute({
        className: 'TestClass'
        // Missing methods array
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('Missing required inputs');
    });
  });
});