/**
 * PlanExecutionArtifacts Tests
 * 
 * Tests artifact creation and assertion during plan execution
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PlanExecutionEngine } from '../PlanExecutionEngine.js';
import { TaskOrchestrator } from '../TaskOrchestrator.js';

// Mock the ArtifactActor
class MockArtifactActor {
  constructor() {
    this.artifacts = new Map();
    this.assertArtifactsCalls = [];
  }

  async assertArtifacts({ artifacts, context }) {
    this.assertArtifactsCalls.push({ artifacts, context });
    
    const stored = [];
    for (const artifact of artifacts) {
      // Validate required fields
      if (!artifact.label) {
        throw new Error('Artifact missing required label field');
      }
      if (!artifact.description) {
        throw new Error('Artifact missing required description field');
      }
      if (!artifact.content && !artifact.path) {
        throw new Error('Artifact must have content or path');
      }
      
      const id = `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const storedArtifact = {
        ...artifact,
        id,
        storedAt: new Date().toISOString()
      };
      this.artifacts.set(id, storedArtifact);
      stored.push(storedArtifact);
    }
    
    return {
      success: true,
      artifactsStored: stored.length,
      artifacts: stored
    };
  }

  getArtifacts() {
    return Array.from(this.artifacts.values());
  }

  clear() {
    this.artifacts.clear();
    this.assertArtifactsCalls = [];
  }
}

describe('PlanExecutionArtifacts', () => {
  let orchestrator;
  let planExecutionEngine;
  let mockArtifactActor;
  
  beforeEach(() => {
    // Create mock artifact actor
    mockArtifactActor = new MockArtifactActor();
    
    // Create mock dependencies
    const mockResourceManager = {
      get: jest.fn(),
      createLLMClient: jest.fn()
    };
    
    const mockModuleLoader = {
      initialize: jest.fn(),
      getToolByNameOrAlias: jest.fn(),
      getToolsFromModule: jest.fn().mockResolvedValue([]),
      loadModuleByName: jest.fn()
    };
    
    const mockChatAgent = {
      handleOrchestratorMessage: jest.fn()
    };
    
    const mockArtifactManager = {
      registerArtifact: jest.fn()
    };
    
    // Create orchestrator
    orchestrator = new TaskOrchestrator({
      sessionId: 'test',
      chatAgent: mockChatAgent,
      resourceManager: mockResourceManager,
      moduleLoader: mockModuleLoader,
      artifactManager: mockArtifactManager
    });
    
    // Get the plan execution engine
    planExecutionEngine = orchestrator.planExecutionEngine;
    
    // Inject mock artifact actor into the agentContext
    orchestrator.agentContext = {
      emit: jest.fn(),
      artifactActor: mockArtifactActor,
      sessionId: 'test-session'
    };
  });
  
  afterEach(() => {
    if (mockArtifactActor) {
      mockArtifactActor.clear();
    }
  });

  test('should assert artifacts for file_write operations', async () => {
    // Simulate action:complete event data
    const actionData = {
      planId: 'test-plan-1',
      stepId: 'step-1',
      stepName: 'Create JavaScript file',
      actionId: 'action-1',
      actionType: 'file_write',
      toolName: 'file_writer',
      parameters: {
        filePath: '/tmp/test.js',
        content: 'console.log("Hello World");'
      },
      result: {
        success: true,
        path: '/tmp/test.js',
        bytesWritten: 28
      }
    };

    // Call handleActionArtifacts directly
    await planExecutionEngine.handleActionArtifacts(actionData);
    
    // Check that artifacts were asserted
    expect(mockArtifactActor.assertArtifactsCalls).toHaveLength(1);
    
    const call = mockArtifactActor.assertArtifactsCalls[0];
    expect(call.artifacts).toHaveLength(1);
    
    const artifact = call.artifacts[0];
    expect(artifact.content).toBe('console.log("Hello World");');
    expect(artifact.path).toBe('/tmp/test.js');
    expect(artifact.label).toBe('@test');
    expect(artifact.type).toBe('code');
    expect(artifact.subtype).toBe('js');
    expect(artifact.metadata.isFromPlanExecution).toBe(true);
  });

  test('should handle package.json with object content', async () => {
    const packageContent = {
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project',
      main: 'index.js',
      scripts: {
        test: 'jest'
      }
    };

    const actionData = {
      planId: 'test-plan-2',
      stepId: 'step-1',
      stepName: 'Create package.json',
      actionId: 'action-1',
      actionType: 'file_write',
      toolName: 'file_writer',
      parameters: {
        filePath: '/tmp/package.json',
        content: packageContent
      },
      result: {
        success: true,
        path: '/tmp/package.json',
        bytesWritten: 100
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    const call = mockArtifactActor.assertArtifactsCalls[0];
    expect(call.artifacts).toHaveLength(1);
    
    const artifact = call.artifacts[0];
    // Content should be stringified JSON
    const expectedContent = JSON.stringify(packageContent, null, 2);
    expect(artifact.content).toBe(expectedContent);
    expect(artifact.type).toBe('config');
    expect(artifact.subtype).toBe('json');
  });

  test('should filter out non-artifact operations', async () => {
    // Test directory_create - should not create artifact
    const dirCreateData = {
      planId: 'test-plan-3',
      stepId: 'step-1',
      stepName: 'Create directory',
      actionId: 'action-1',
      actionType: 'directory_create',
      toolName: 'directory_create',
      parameters: {
        path: '/tmp/test-project'
      },
      result: {
        success: true,
        created: true
      }
    };

    await planExecutionEngine.handleActionArtifacts(dirCreateData);
    expect(mockArtifactActor.assertArtifactsCalls).toHaveLength(0);

    // Test execute_command - should not create artifact
    const commandData = {
      planId: 'test-plan-3',
      stepId: 'step-2',
      stepName: 'Install dependencies',
      actionId: 'action-2',
      actionType: 'execute_command',
      toolName: 'execute_command',
      parameters: {
        command: 'npm install'
      },
      result: {
        success: true,
        output: 'added 100 packages'
      }
    };

    await planExecutionEngine.handleActionArtifacts(commandData);
    expect(mockArtifactActor.assertArtifactsCalls).toHaveLength(0);
  });

  test('should handle generated code without file path', async () => {
    const actionData = {
      planId: 'test-plan-4',
      stepId: 'step-1',
      stepName: 'Generate module',
      actionId: 'action-1',
      actionType: 'generate_javascript_module',
      toolName: 'generate_javascript_module',
      parameters: {
        moduleName: 'TestModule',
        description: 'A test module'
      },
      result: {
        success: true,
        code: 'export class TestModule { constructor() {} }'
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    const call = mockArtifactActor.assertArtifactsCalls[0];
    expect(call.artifacts).toHaveLength(1);
    
    const artifact = call.artifacts[0];
    expect(artifact.content).toBe('export class TestModule { constructor() {} }');
    expect(artifact.path).toBeUndefined();
    expect(artifact.type).toBe('code');
    expect(artifact.metadata.noFilePath).toBe(true);
  });

  test('should include all required metadata in artifacts', async () => {
    const actionData = {
      planId: 'test-plan-5',
      stepId: 'step-1',
      stepName: 'Create HTML file',
      actionId: 'action-1',
      actionType: 'file_write',
      toolName: 'file_writer',
      parameters: {
        filePath: '/tmp/index.html',
        content: '<html><body>Test</body></html>'
      },
      result: {
        success: true,
        path: '/tmp/index.html'
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    const artifact = mockArtifactActor.assertArtifactsCalls[0].artifacts[0];
    
    // Required fields
    expect(artifact.label).toBeDefined();
    expect(artifact.label).toBe('@index');
    expect(artifact.description).toBeDefined();
    expect(artifact.description).toBe('Create HTML file: index.html');
    expect(artifact.content).toBeDefined();
    
    // Metadata
    expect(artifact.metadata).toMatchObject({
      stepId: 'step-1',
      stepName: 'Create HTML file',
      actionId: 'action-1',
      planId: 'test-plan-5',
      isFromPlanExecution: true
    });
    
    // Type detection
    expect(artifact.type).toBe('markup');
    expect(artifact.subtype).toBe('html');
  });

  test('should handle multiple parameter name variations', async () => {
    // Test with 'filepath' (lowercase p)
    const action1 = {
      planId: 'test-plan-6',
      stepId: 'step-1',
      stepName: 'Create file 1',
      actionId: 'action-1',
      actionType: 'file_write',
      parameters: {
        filepath: '/tmp/app.js',  // lowercase 'filepath'
        content: 'const express = require("express");'
      },
      result: { success: true }
    };

    await planExecutionEngine.handleActionArtifacts(action1);
    expect(mockArtifactActor.assertArtifactsCalls[0].artifacts[0].path).toBe('/tmp/app.js');
    mockArtifactActor.clear();

    // Test with 'filePath' (camelCase)
    const action2 = {
      planId: 'test-plan-6',
      stepId: 'step-2',
      stepName: 'Create file 2',
      actionId: 'action-2',
      actionType: 'file_write',
      parameters: {
        filePath: '/tmp/style.css',  // camelCase 'filePath'
        content: 'body { margin: 0; }'
      },
      result: { success: true }
    };

    await planExecutionEngine.handleActionArtifacts(action2);
    expect(mockArtifactActor.assertArtifactsCalls[0].artifacts[0].path).toBe('/tmp/style.css');
    mockArtifactActor.clear();

    // Test with just 'path'
    const action3 = {
      planId: 'test-plan-6',
      stepId: 'step-3',
      stepName: 'Create file 3',
      actionId: 'action-3',
      actionType: 'file_write',
      parameters: {
        path: '/tmp/config.json',  // just 'path'
        content: '{"port": 3000}'
      },
      result: { success: true }
    };

    await planExecutionEngine.handleActionArtifacts(action3);
    expect(mockArtifactActor.assertArtifactsCalls[0].artifacts[0].path).toBe('/tmp/config.json');
  });

  test('should skip artifacts for failed actions', async () => {
    const actionData = {
      planId: 'test-plan-7',
      stepId: 'step-1',
      stepName: 'Failed write',
      actionId: 'action-1',
      actionType: 'file_write',
      parameters: {
        filePath: '/invalid/path/bad.js',
        content: 'console.log("fail");'
      },
      result: {
        success: false,
        error: 'Invalid path'
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    // Should not assert any artifacts for failed actions
    expect(mockArtifactActor.assertArtifactsCalls).toHaveLength(0);
  });

  test('should handle HTML generation with proper type', async () => {
    const actionData = {
      planId: 'test-plan-8',
      stepId: 'step-1',
      stepName: 'Generate HTML',
      actionId: 'action-1',
      actionType: 'generate_html_page',
      toolName: 'generate_html',
      parameters: {
        title: 'Test Page'
      },
      result: {
        success: true,
        html: '<!DOCTYPE html><html><head><title>Test</title></head><body>Content</body></html>'
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    const artifact = mockArtifactActor.assertArtifactsCalls[0].artifacts[0];
    expect(artifact.content).toContain('<!DOCTYPE html>');
    expect(artifact.type).toBe('markup');
    expect(artifact.subtype).toBe('html');
    expect(artifact.title).toBe('Generated HTML');
  });

  test('should handle test generation with proper type', async () => {
    const actionData = {
      planId: 'test-plan-9',
      stepId: 'step-1',
      stepName: 'Generate tests',
      actionId: 'action-1',
      actionType: 'generate_unit_tests',
      parameters: {
        targetFile: 'math.js'
      },
      result: {
        success: true,
        code: 'describe("Math", () => { test("adds", () => { expect(1+1).toBe(2); }); });'
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    const artifact = mockArtifactActor.assertArtifactsCalls[0].artifacts[0];
    expect(artifact.content).toContain('describe("Math"');
    expect(artifact.type).toBe('code');
    expect(artifact.subtype).toBe('test.js');
    expect(artifact.title).toBe('Generated Test');
  });

  test('should handle package.json creation without file path', async () => {
    const actionData = {
      planId: 'test-plan-10',
      stepId: 'step-1',
      stepName: 'Create package.json',
      actionId: 'action-1',
      actionType: 'create_package_json',
      parameters: {
        name: 'my-app'
      },
      result: {
        success: true,
        content: {
          name: 'my-app',
          version: '1.0.0'
        }
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData);
    
    const artifact = mockArtifactActor.assertArtifactsCalls[0].artifacts[0];
    expect(artifact.content).toBe('{\n  "name": "my-app",\n  "version": "1.0.0"\n}');
    expect(artifact.type).toBe('config');
    expect(artifact.subtype).toBe('json');
    expect(artifact.title).toBe('package.json');
  });

  test('should not create artifact without content or with missing agentContext', async () => {
    // Test without content
    const actionData1 = {
      planId: 'test-plan-11',
      stepId: 'step-1',
      stepName: 'No content',
      actionId: 'action-1',
      actionType: 'file_write',
      parameters: {
        filePath: '/tmp/empty.js'
        // No content provided
      },
      result: {
        success: true,
        path: '/tmp/empty.js'
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData1);
    expect(mockArtifactActor.assertArtifactsCalls).toHaveLength(0);

    // Test without agentContext
    orchestrator.agentContext = null;
    
    const actionData2 = {
      planId: 'test-plan-11',
      stepId: 'step-2',
      stepName: 'No context',
      actionId: 'action-2',
      actionType: 'file_write',
      parameters: {
        filePath: '/tmp/test.js',
        content: 'console.log("test");'
      },
      result: {
        success: true
      }
    };

    await planExecutionEngine.handleActionArtifacts(actionData2);
    // Should not crash, just skip artifact creation
    expect(mockArtifactActor.assertArtifactsCalls).toHaveLength(0);
  });
});