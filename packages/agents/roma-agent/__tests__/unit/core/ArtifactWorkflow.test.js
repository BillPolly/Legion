/**
 * Comprehensive unit tests for artifact workflow logic
 * Tests the complete artifact lifecycle without LLM dependency using mocks
 * 
 * This test suite validates:
 * - Artifact creation from tool execution results
 * - Parameter resolution system (@artifact_name → actual values)
 * - Artifact chaining across multiple tool executions
 * - Error handling for missing/invalid artifacts
 * - Artifact inheritance in child contexts
 * - Metadata tracking and lineage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionStrategy } from '../../../src/core/strategies/ExecutionStrategy.js';
import { ExecutionContext } from '../../../src/core/ExecutionContext.js';

describe('Artifact Workflow - Complete Lifecycle', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockFileWriteTool;
  let mockFileReadTool;
  let mockServerStartTool;

  beforeEach(() => {
    // Create mock tools that simulate real tool behavior
    mockFileWriteTool = {
      name: 'file_write',
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: { filepath: '/tmp/server.js', size: 1024 },
        metadata: { toolName: 'file_write', operation: 'write' }
      })
    };

    mockFileReadTool = {
      name: 'file_read',
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: { content: 'const express = require("express");', encoding: 'utf-8' },
        metadata: { toolName: 'file_read', operation: 'read' }
      })
    };

    mockServerStartTool = {
      name: 'start_server',
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: { pid: 12345, port: 3000, status: 'running' },
        metadata: { toolName: 'start_server', operation: 'start' }
      })
    };

    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn().mockImplementation((toolName) => {
        switch (toolName) {
          case 'file_write': return mockFileWriteTool;
          case 'file_read': return mockFileReadTool;
          case 'start_server': return mockServerStartTool;
          default: return null;
        }
      })
    };

    // Create strategy with mock dependencies
    strategy = new ExecutionStrategy({
      toolRegistry: mockToolRegistry
    });

    // Create context
    context = new ExecutionContext();
  });

  describe('Artifact Creation from Tool Outputs', () => {
    it('should create artifact from single tool output', async () => {
      const toolCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/server.js',
          content: 'const express = require("express");'
        },
        outputs: [{
          name: 'server_file',
          type: 'file',
          description: 'Express server implementation file',
          purpose: 'Main server entry point for the application'
        }]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      // Verify artifact was created with correct structure
      const artifact = context.getArtifact('server_file');
      expect(artifact).toBeDefined();
      expect(artifact.type).toBe('file');
      expect(artifact.value).toEqual({ filepath: '/tmp/server.js', size: 1024 });
      expect(artifact.description).toBe('Express server implementation file');
      expect(artifact.purpose).toBe('Main server entry point for the application');
      expect(artifact.timestamp).toBeDefined();
      expect(artifact.metadata.toolName).toBe('file_write');
      expect(artifact.metadata.success).toBe(true);
    });

    it('should create multiple artifacts from single tool execution', async () => {
      // Mock tool that returns multiple outputs
      const multiOutputTool = {
        name: 'setup_project',
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: {
            package_json: { name: 'my-app', version: '1.0.0' },
            main_file: '/tmp/index.js',
            config_file: '/tmp/config.json'
          }
        })
      };

      mockToolRegistry.getTool.mockImplementation((name) => 
        name === 'setup_project' ? multiOutputTool : null
      );

      const toolCall = {
        tool: 'setup_project',
        inputs: { projectName: 'my-app' },
        outputs: [
          {
            name: 'package_config',
            type: 'data',
            description: 'Package.json configuration',
            purpose: 'Define project metadata and dependencies'
          },
          {
            name: 'main_entry',
            type: 'file',
            description: 'Main application entry point',
            purpose: 'Primary file to start the application'
          },
          {
            name: 'app_config',
            type: 'config',
            description: 'Application configuration file',
            purpose: 'Store application settings and parameters'
          }
        ]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      // Verify all artifacts were created
      expect(context.listArtifacts()).toHaveLength(3);
      
      const packageConfig = context.getArtifact('package_config');
      expect(packageConfig.type).toBe('data');
      expect(packageConfig.value).toEqual({
        package_json: { name: 'my-app', version: '1.0.0' },
        main_file: '/tmp/index.js',
        config_file: '/tmp/config.json'
      });

      const mainEntry = context.getArtifact('main_entry');
      expect(mainEntry.type).toBe('file');
      
      const appConfig = context.getArtifact('app_config');
      expect(appConfig.type).toBe('config');
    });

    it('should track artifact lineage and input dependencies', async () => {
      // First create a base artifact
      context.addArtifact('base_config', {
        type: 'data',
        value: { port: 3000, host: 'localhost' },
        description: 'Base server configuration',
        purpose: 'Initial server settings',
        timestamp: Date.now()
      });

      const toolCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/server.js',
          config: '@base_config'  // Reference to existing artifact
        },
        outputs: [{
          name: 'server_file',
          type: 'file',
          description: 'Server file with configuration',
          purpose: 'Configured server implementation'
        }]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      const artifact = context.getArtifact('server_file');
      expect(artifact.metadata.inputArtifacts).toEqual(['base_config']);
      expect(artifact.metadata.toolName).toBe('file_write');
    });
  });

  describe('Parameter Resolution System', () => {
    beforeEach(() => {
      // Setup test artifacts
      context.addArtifact('server_file', {
        type: 'file',
        value: '/tmp/server.js',
        description: 'Server implementation file',
        purpose: 'Main server script',
        timestamp: Date.now()
      });

      context.addArtifact('server_config', {
        type: 'data',
        value: { port: 3000, host: 'localhost', ssl: false },
        description: 'Server configuration object',
        purpose: 'Runtime server settings',
        timestamp: Date.now()
      });

      context.addArtifact('env_vars', {
        type: 'data',
        value: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
        description: 'Environment variables',
        purpose: 'Runtime environment configuration',
        timestamp: Date.now()
      });
    });

    it('should resolve single artifact reference', () => {
      const inputs = {
        filepath: '@server_file',
        mode: 'read'
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.filepath).toBe('/tmp/server.js');
      expect(resolved.mode).toBe('read');
    });

    it('should resolve multiple artifact references', () => {
      const inputs = {
        serverPath: '@server_file',
        config: '@server_config',
        environment: '@env_vars',
        command: 'start'
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.serverPath).toBe('/tmp/server.js');
      expect(resolved.config).toEqual({ port: 3000, host: 'localhost', ssl: false });
      expect(resolved.environment).toEqual({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
      expect(resolved.command).toBe('start');
    });

    it('should resolve artifact references in nested objects', () => {
      const inputs = {
        deployment: {
          server: {
            scriptPath: '@server_file',
            configuration: '@server_config'
          },
          environment: '@env_vars',
          metadata: {
            configSource: '@server_config'
          }
        },
        options: {
          verbose: true
        }
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.deployment.server.scriptPath).toBe('/tmp/server.js');
      expect(resolved.deployment.server.configuration).toEqual({ port: 3000, host: 'localhost', ssl: false });
      expect(resolved.deployment.environment).toEqual({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
      expect(resolved.deployment.metadata.configSource).toEqual({ port: 3000, host: 'localhost', ssl: false });
      expect(resolved.options.verbose).toBe(true);
    });

    it('should resolve artifact references in arrays', () => {
      const inputs = {
        files: ['@server_file', '/tmp/package.json'],
        configs: ['@server_config', '@env_vars'],
        options: {
          sources: ['@server_file']
        }
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.files).toEqual(['/tmp/server.js', '/tmp/package.json']);
      expect(resolved.configs).toEqual([
        { port: 3000, host: 'localhost', ssl: false },
        { NODE_ENV: 'production', LOG_LEVEL: 'info' }
      ]);
      expect(resolved.options.sources).toEqual(['/tmp/server.js']);
    });

    it('should throw error for non-existent artifact references', () => {
      const inputs = {
        filepath: '@missing_artifact',
        config: '@server_config'
      };

      expect(() => strategy.resolveToolInputs(inputs, context))
        .toThrow('Artifact not found: @missing_artifact');
    });

    it('should handle mixed artifact and direct values', () => {
      const inputs = {
        serverScript: '@server_file',
        outputPath: '/tmp/output',
        config: '@server_config',
        enabled: true,
        count: 5,
        tags: ['server', '@server_file'],  // Mixed array
        nested: {
          source: '@server_file',
          destination: '/tmp/backup'
        }
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.serverScript).toBe('/tmp/server.js');
      expect(resolved.outputPath).toBe('/tmp/output');
      expect(resolved.config).toEqual({ port: 3000, host: 'localhost', ssl: false });
      expect(resolved.enabled).toBe(true);
      expect(resolved.count).toBe(5);
      expect(resolved.tags).toEqual(['server', '/tmp/server.js']);
      expect(resolved.nested.source).toBe('/tmp/server.js');
      expect(resolved.nested.destination).toBe('/tmp/backup');
    });
  });

  describe('Artifact Chaining Workflow', () => {
    it('should chain artifacts across multiple tool executions', async () => {
      // Step 1: Write server file
      const writeCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/server.js',
          content: 'const express = require("express");'
        },
        outputs: [{
          name: 'server_file',
          type: 'file',
          description: 'Express server file',
          purpose: 'Main server implementation'
        }]
      };

      await strategy.executeToolWithArtifacts(writeCall, context);

      // Step 2: Read server file (using artifact from step 1)
      const readCall = {
        tool: 'file_read',
        inputs: {
          filepath: '@server_file'  // Use artifact from previous step
        },
        outputs: [{
          name: 'server_content',
          type: 'data',
          description: 'Server file content',
          purpose: 'Content for analysis or processing'
        }]
      };

      await strategy.executeToolWithArtifacts(readCall, context);

      // Step 3: Start server (using both artifacts)
      const startCall = {
        tool: 'start_server',
        inputs: {
          scriptPath: '@server_file',
          sourceCode: '@server_content'
        },
        outputs: [{
          name: 'server_process',
          type: 'process',
          description: 'Running server process',
          purpose: 'Active server instance'
        }]
      };

      await strategy.executeToolWithArtifacts(startCall, context);

      // Verify the complete chain
      expect(context.listArtifacts()).toHaveLength(3);

      const serverFile = context.getArtifact('server_file');
      const serverContent = context.getArtifact('server_content');
      const serverProcess = context.getArtifact('server_process');

      expect(serverFile.type).toBe('file');
      expect(serverContent.type).toBe('data');
      expect(serverProcess.type).toBe('process');

      // Verify tools were called with resolved values
      expect(mockFileWriteTool.execute).toHaveBeenCalledWith({
        filepath: '/tmp/server.js',
        content: 'const express = require("express");'
      });

      expect(mockFileReadTool.execute).toHaveBeenCalledWith({
        filepath: { filepath: '/tmp/server.js', size: 1024 }  // Resolved from artifact
      });

      expect(mockServerStartTool.execute).toHaveBeenCalledWith({
        scriptPath: { filepath: '/tmp/server.js', size: 1024 },
        sourceCode: { content: 'const express = require("express");', encoding: 'utf-8' }
      });

      // Verify artifact lineage
      expect(serverContent.metadata.inputArtifacts).toEqual(['server_file']);
      expect(serverProcess.metadata.inputArtifacts).toEqual(['server_file', 'server_content']);
    });

    it('should support branching artifact workflows', async () => {
      // Create base artifact
      context.addArtifact('source_code', {
        type: 'data',
        value: 'const app = express();',
        description: 'Source code content',
        purpose: 'Base application code',
        timestamp: Date.now()
      });

      // Branch 1: Create server file
      const serverCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/server.js',
          content: '@source_code'
        },
        outputs: [{
          name: 'server_file',
          type: 'file',
          description: 'Server implementation',
          purpose: 'Main server file'
        }]
      };

      // Branch 2: Create test file (using same source)
      const testCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/test.js',
          content: '@source_code'
        },
        outputs: [{
          name: 'test_file',
          type: 'file',
          description: 'Test implementation',
          purpose: 'Test file'
        }]
      };

      // Execute both branches
      await strategy.executeToolWithArtifacts(serverCall, context);
      await strategy.executeToolWithArtifacts(testCall, context);

      // Verify both artifacts were created with same source
      const serverArtifact = context.getArtifact('server_file');
      const testArtifact = context.getArtifact('test_file');

      expect(serverArtifact.metadata.inputArtifacts).toEqual(['source_code']);
      expect(testArtifact.metadata.inputArtifacts).toEqual(['source_code']);

      // Verify tools were called with resolved values
      expect(mockFileWriteTool.execute).toHaveBeenCalledTimes(2);
      expect(mockFileWriteTool.execute).toHaveBeenNthCalledWith(1, {
        filepath: '/tmp/server.js',
        content: 'const app = express();'
      });
      expect(mockFileWriteTool.execute).toHaveBeenNthCalledWith(2, {
        filepath: '/tmp/test.js',
        content: 'const app = express();'
      });
    });

    it('should handle complex multi-step workflow with dependencies', async () => {
      // Step 1: Create configuration
      const configTool = {
        name: 'generate_config',
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: { 
            server: { port: 3000, host: 'localhost' },
            database: { url: 'mongodb://localhost/test' }
          }
        })
      };

      mockToolRegistry.getTool.mockImplementation((name) => {
        if (name === 'generate_config') return configTool;
        return mockToolRegistry.getTool.mockImplementation((toolName) => {
          switch (toolName) {
            case 'file_write': return mockFileWriteTool;
            case 'file_read': return mockFileReadTool;
            case 'start_server': return mockServerStartTool;
            default: return null;
          }
        })(name);
      });

      const configCall = {
        tool: 'generate_config',
        inputs: { environment: 'development' },
        outputs: [{
          name: 'app_config',
          type: 'config',
          description: 'Application configuration',
          purpose: 'Runtime configuration for the application'
        }]
      };

      await strategy.executeToolWithArtifacts(configCall, context);

      // Step 2: Write server file using config
      const serverCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/server.js',
          content: 'server template',
          config: '@app_config'
        },
        outputs: [{
          name: 'server_file',
          type: 'file',
          description: 'Configured server file',
          purpose: 'Server with embedded configuration'
        }]
      };

      await strategy.executeToolWithArtifacts(serverCall, context);

      // Step 3: Start server with both config and file
      const startCall = {
        tool: 'start_server',
        inputs: {
          scriptPath: '@server_file',
          config: '@app_config'
        },
        outputs: [{
          name: 'server_process',
          type: 'process',
          description: 'Running server with config',
          purpose: 'Active configured server'
        }]
      };

      await strategy.executeToolWithArtifacts(startCall, context);

      // Verify complete workflow
      expect(context.listArtifacts()).toHaveLength(3);

      const config = context.getArtifact('app_config');
      const serverFile = context.getArtifact('server_file');
      const serverProcess = context.getArtifact('server_process');

      // Verify dependency chains
      expect(config.metadata.inputArtifacts).toEqual([]);
      expect(serverFile.metadata.inputArtifacts).toEqual(['app_config']);
      expect(serverProcess.metadata.inputArtifacts).toEqual(['server_file', 'app_config']);

      // Verify tools received resolved artifacts
      expect(mockFileWriteTool.execute).toHaveBeenCalledWith({
        filepath: '/tmp/server.js',
        content: 'server template',
        config: { 
          server: { port: 3000, host: 'localhost' },
          database: { url: 'mongodb://localhost/test' }
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tool execution failure gracefully', async () => {
      const failingTool = {
        name: 'failing_tool',
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      };

      mockToolRegistry.getTool.mockImplementation((name) => 
        name === 'failing_tool' ? failingTool : null
      );

      const toolCall = {
        tool: 'failing_tool',
        inputs: { data: 'test' },
        outputs: [{
          name: 'failed_artifact',
          type: 'data',
          description: 'This should not be created',
          purpose: 'Test failure handling'
        }]
      };

      await expect(strategy.executeToolWithArtifacts(toolCall, context))
        .rejects.toThrow('Tool execution failed');

      // Verify no artifact was created
      expect(context.getArtifact('failed_artifact')).toBeUndefined();
      expect(context.listArtifacts()).toHaveLength(0);
    });

    it('should handle missing tool gracefully', async () => {
      const toolCall = {
        tool: 'non_existent_tool',
        inputs: { data: 'test' },
        outputs: [{
          name: 'should_not_exist',
          type: 'data',
          description: 'Should not be created',
          purpose: 'Test missing tool handling'
        }]
      };

      await expect(strategy.executeToolWithArtifacts(toolCall, context))
        .rejects.toThrow('Tool not found: non_existent_tool');

      expect(context.getArtifact('should_not_exist')).toBeUndefined();
    });

    it('should handle circular artifact references', () => {
      // This should not be possible in normal workflow, but test defensive programming
      context.addArtifact('circular_a', {
        type: 'data',
        value: '@circular_b',  // This would create a circular reference
        description: 'Circular reference A',
        purpose: 'Test circular reference handling',
        timestamp: Date.now()
      });

      context.addArtifact('circular_b', {
        type: 'data',
        value: '@circular_a',  // Circular reference
        description: 'Circular reference B',
        purpose: 'Test circular reference handling',
        timestamp: Date.now()
      });

      const inputs = {
        data: '@circular_a'
      };

      // The resolution should get the value as-is (the string '@circular_b')
      // since artifact values are extracted directly without recursive resolution
      const resolved = strategy.resolveToolInputs(inputs, context);
      expect(resolved.data).toBe('@circular_b');
    });

    it('should handle null and undefined artifact values', () => {
      context.addArtifact('null_artifact', {
        type: 'data',
        value: null,
        description: 'Null value artifact',
        purpose: 'Test null handling',
        timestamp: Date.now()
      });

      const inputs = {
        nullValue: '@null_artifact',
        normalValue: 'test'
      };

      const resolved = strategy.resolveToolInputs(inputs, context);
      expect(resolved.nullValue).toBeNull();
      expect(resolved.normalValue).toBe('test');
    });

    it('should preserve artifact immutability during resolution', () => {
      const originalData = { config: { port: 3000 }, mutable: true };
      context.addArtifact('immutable_test', {
        type: 'data',
        value: originalData,
        description: 'Immutability test artifact',
        purpose: 'Test that resolution does not modify original',
        timestamp: Date.now()
      });

      const inputs = {
        config: '@immutable_test'
      };

      const resolved = strategy.resolveToolInputs(inputs, context);
      
      // Modify resolved value
      resolved.config.mutable = false;
      resolved.config.config.port = 8080;

      // Original should be unchanged
      const originalArtifact = context.getArtifact('immutable_test');
      expect(originalArtifact.value.mutable).toBe(true);
      expect(originalArtifact.value.config.port).toBe(3000);
    });
  });

  describe('Artifact Inheritance in Child Contexts', () => {
    it('should inherit artifacts in child contexts', () => {
      // Add artifacts to parent context
      context.addArtifact('parent_artifact', {
        type: 'data',
        value: 'parent_value',
        description: 'Parent artifact',
        purpose: 'Test inheritance',
        timestamp: Date.now()
      });

      // Create child context
      const childContext = context.createChild('child-task');

      // Child should have access to parent artifacts
      expect(childContext.getArtifact('parent_artifact')).toBeDefined();
      expect(childContext.getArtifactValue('parent_artifact')).toBe('parent_value');
    });

    it('should allow child to override parent artifacts', () => {
      // Add artifact to parent
      context.addArtifact('config', {
        type: 'data',
        value: { version: 1 },
        description: 'Parent config',
        purpose: 'Configuration data',
        timestamp: Date.now()
      });

      // Create child and override
      const childContext = context.createChild('child-task');
      childContext.addArtifact('config', {
        type: 'data',
        value: { version: 2 },
        description: 'Child config',
        purpose: 'Updated configuration',
        timestamp: Date.now()
      });

      // Child sees overridden value, parent unchanged
      expect(childContext.getArtifactValue('config')).toEqual({ version: 2 });
      expect(context.getArtifactValue('config')).toEqual({ version: 1 });
    });

    it('should support artifact workflow across context hierarchy', async () => {
      // Parent creates base artifact
      context.addArtifact('base_config', {
        type: 'config',
        value: { environment: 'development' },
        description: 'Base configuration',
        purpose: 'Environment configuration',
        timestamp: Date.now()
      });

      // Child context uses parent artifact
      const childContext = context.createChild('child-task');
      
      const toolCall = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/child-config.json',
          content: '@base_config'  // Reference parent artifact
        },
        outputs: [{
          name: 'child_file',
          type: 'file',
          description: 'Child configuration file',
          purpose: 'Serialized configuration'
        }]
      };

      await strategy.executeToolWithArtifacts(toolCall, childContext);

      // Verify child artifact was created
      const childArtifact = childContext.getArtifact('child_file');
      expect(childArtifact).toBeDefined();
      expect(childArtifact.metadata.inputArtifacts).toEqual(['base_config']);

      // Verify tool was called with resolved parent artifact
      expect(mockFileWriteTool.execute).toHaveBeenCalledWith({
        filepath: '/tmp/child-config.json',
        content: { environment: 'development' }
      });

      // Parent should not have child artifact
      expect(context.getArtifact('child_file')).toBeUndefined();
    });

    it('should maintain separate artifact lineage per context', async () => {
      // Create base artifact in parent
      context.addArtifact('shared_data', {
        type: 'data',
        value: { shared: true },
        description: 'Shared data',
        purpose: 'Data shared across contexts',
        timestamp: Date.now()
      });

      // Child 1 creates artifact using shared data
      const child1 = context.createChild('child-1');
      const child1Call = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/child1.json',
          data: '@shared_data'
        },
        outputs: [{
          name: 'child1_file',
          type: 'file',
          description: 'Child 1 file',
          purpose: 'Child 1 output'
        }]
      };

      await strategy.executeToolWithArtifacts(child1Call, child1);

      // Child 2 creates different artifact using same shared data
      const child2 = context.createChild('child-2');
      const child2Call = {
        tool: 'file_write',
        inputs: {
          filepath: '/tmp/child2.json',
          data: '@shared_data'
        },
        outputs: [{
          name: 'child2_file',
          type: 'file',
          description: 'Child 2 file',
          purpose: 'Child 2 output'
        }]
      };

      await strategy.executeToolWithArtifacts(child2Call, child2);

      // Verify separate lineage
      const child1Artifact = child1.getArtifact('child1_file');
      const child2Artifact = child2.getArtifact('child2_file');

      expect(child1Artifact.metadata.inputArtifacts).toEqual(['shared_data']);
      expect(child2Artifact.metadata.inputArtifacts).toEqual(['shared_data']);

      // Children should not see each other's artifacts
      expect(child1.getArtifact('child2_file')).toBeUndefined();
      expect(child2.getArtifact('child1_file')).toBeUndefined();

      // Parent should not see child artifacts
      expect(context.getArtifact('child1_file')).toBeUndefined();
      expect(context.getArtifact('child2_file')).toBeUndefined();
    });
  });

  describe('Conversation History Integration', () => {
    it('should add conversation entries when artifacts are created', async () => {
      expect(context.conversationHistory).toHaveLength(0);

      const toolCall = {
        tool: 'file_write',
        inputs: { filepath: '/tmp/test.js', content: 'test' },
        outputs: [{
          name: 'test_file',
          type: 'file',
          description: 'Test file',
          purpose: 'Testing conversation integration'
        }]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      // Verify conversation entry was added
      expect(context.conversationHistory).toHaveLength(1);
      const message = context.conversationHistory[0];
      expect(message.role).toBe('assistant');
      expect(message.content).toContain('file_write');
      expect(message.content).toContain('@test_file');
      expect(message.timestamp).toBeDefined();
    });

    it('should add separate conversation entries for multiple outputs', async () => {
      const multiOutputTool = {
        name: 'multi_tool',
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: { result1: 'data1', result2: 'data2' }
        })
      };

      mockToolRegistry.getTool.mockImplementation((name) => 
        name === 'multi_tool' ? multiOutputTool : null
      );

      const toolCall = {
        tool: 'multi_tool',
        inputs: {},
        outputs: [
          {
            name: 'artifact1',
            type: 'data',
            description: 'First artifact',
            purpose: 'Test multiple outputs'
          },
          {
            name: 'artifact2', 
            type: 'data',
            description: 'Second artifact',
            purpose: 'Test multiple outputs'
          }
        ]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      // Should have conversation entries for each output
      expect(context.conversationHistory).toHaveLength(2);
      expect(context.conversationHistory[0].content).toContain('@artifact1');
      expect(context.conversationHistory[1].content).toContain('@artifact2');
    });
  });
});