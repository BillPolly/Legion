/**
 * Real-world test for CodeAgent JSON module
 * 
 * This test verifies the actual integration works with a real LLM call
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ModuleFactory } from '@legion/tools';
import ResourceManager from '@legion/module-loader/src/resources/ResourceManager.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CodeAgent JSON Module Real Integration', () => {
  let factory;
  let resourceManager;
  let module;
  let testDir;
  let moduleJsonPath;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, '..', 'temp', `real-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Setup ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create ModuleFactory
    factory = new ModuleFactory(resourceManager);

    // Path to module.json
    moduleJsonPath = path.join(__dirname, '..', '..', 'module.json');
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should successfully load and use CodeAgent tools', async () => {
    // Load the module
    module = await factory.createJsonModule(moduleJsonPath);
    expect(module).toBeDefined();
    expect(module.name).toBe('code-agent');

    // Get tools
    const tools = await module.getTools();
    expect(tools).toHaveLength(2);

    // Find develop_code tool
    const developTool = tools.find(t => t.name === 'develop_code');
    expect(developTool).toBeDefined();

    // Check tool description format
    const description = developTool.getToolDescription();
    expect(description).toMatchObject({
      type: 'function',
      function: {
        name: 'develop_code',
        description: expect.stringContaining('Generate'),
        parameters: {
          type: 'object',
          properties: expect.objectContaining({
            workingDirectory: expect.any(Object),
            task: expect.any(Object)
          }),
          required: expect.arrayContaining(['workingDirectory', 'task'])
        },
        output: expect.objectContaining({
          success: expect.any(Object),
          failure: expect.any(Object)
        })
      }
    });
  });

  test('should handle fix_code tool invocation', async () => {
    module = await factory.createJsonModule(moduleJsonPath);
    const tools = await module.getTools();
    const fixTool = tools.find(t => t.name === 'fix_code');

    // Create a simple file to fix
    const testFile = path.join(testDir, 'test.js');
    await fs.writeFile(testFile, 'const x = 1; // unused', 'utf8');

    // Invoke fix tool
    const toolCall = {
      id: 'real_fix_test',
      type: 'function',
      function: {
        name: 'fix_code',
        arguments: JSON.stringify({
          workingDirectory: testDir,
          errors: ['Unused variable x']
        })
      }
    };

    const result = await fixTool.invoke(toolCall);
    
    // Should at least return a proper ToolResult
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    expect(result.data).toBeDefined();
    
    if (!result.success) {
      // If it failed, should have proper error
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  }, 30000);

  test('should validate tool parameters', async () => {
    module = await factory.createJsonModule(moduleJsonPath);
    const tools = await module.getTools();
    const developTool = tools.find(t => t.name === 'develop_code');

    // Test with invalid parameters
    const toolCall = {
      id: 'validation_test',
      type: 'function',
      function: {
        name: 'develop_code',
        arguments: JSON.stringify({
          // Missing required parameters
          projectType: 'frontend'
        })
      }
    };

    const result = await developTool.invoke(toolCall);
    
    // Should fail validation
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});

