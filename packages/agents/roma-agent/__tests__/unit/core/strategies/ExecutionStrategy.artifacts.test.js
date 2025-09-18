/**
 * Unit tests for ExecutionStrategy artifact management methods
 * Tests the new artifact methods that support parameter resolution and tool execution
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionStrategy } from '../../../../src/core/strategies/ExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('ExecutionStrategy - Artifact Management', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockTool;

  beforeEach(() => {
    // Create mock tool
    mockTool = {
      name: 'test_tool',
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: { output: 'test result' },
        metadata: { toolName: 'test_tool' }
      })
    };

    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue(mockTool)
    };

    // Create strategy with mock dependencies
    strategy = new ExecutionStrategy({
      toolRegistry: mockToolRegistry
    });

    // Create context with test artifacts
    context = new ExecutionContext();
    context.addArtifact('test_file', {
      type: 'file',
      value: '/tmp/test.js',
      description: 'Test file',
      purpose: 'Testing artifact resolution',
      timestamp: Date.now()
    });

    context.addArtifact('config_data', {
      type: 'data',
      value: { port: 3000, host: 'localhost' },
      description: 'Configuration data',
      purpose: 'Server configuration',
      timestamp: Date.now()
    });
  });

  describe('resolveToolInputs()', () => {
    it('should resolve simple @artifact references', () => {
      const inputs = {
        filepath: '@test_file',
        config: '@config_data'
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.filepath).toBe('/tmp/test.js');
      expect(resolved.config).toEqual({ port: 3000, host: 'localhost' });
    });

    it('should resolve @artifact references in arrays', () => {
      const inputs = {
        files: ['@test_file', 'other.js'],
        configs: ['@config_data']
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.files).toEqual(['/tmp/test.js', 'other.js']);
      expect(resolved.configs).toEqual([{ port: 3000, host: 'localhost' }]);
    });

    it('should resolve @artifact references in nested objects', () => {
      const inputs = {
        deployment: {
          sourceFile: '@test_file',
          serverConfig: '@config_data',
          metadata: {
            configFile: '@test_file'
          }
        }
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.deployment.sourceFile).toBe('/tmp/test.js');
      expect(resolved.deployment.serverConfig).toEqual({ port: 3000, host: 'localhost' });
      expect(resolved.deployment.metadata.configFile).toBe('/tmp/test.js');
    });

    it('should leave non-artifact values unchanged', () => {
      const inputs = {
        directValue: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' }
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved).toEqual(inputs);
    });

    it('should throw error for non-existent artifacts', () => {
      const inputs = {
        missing: '@non_existent_artifact'
      };

      expect(() => strategy.resolveToolInputs(inputs, context))
        .toThrow('Artifact not found: @non_existent_artifact');
    });

    it('should handle null and undefined inputs', () => {
      expect(strategy.resolveToolInputs(null, context)).toBeNull();
      expect(strategy.resolveToolInputs(undefined, context)).toBeUndefined();
      expect(strategy.resolveToolInputs('string', context)).toBe('string');
    });

    it('should handle mixed artifact and direct references', () => {
      const inputs = {
        source: '@test_file',
        destination: '/tmp/output.js',
        options: {
          config: '@config_data',
          verbose: true
        }
      };

      const resolved = strategy.resolveToolInputs(inputs, context);

      expect(resolved.source).toBe('/tmp/test.js');
      expect(resolved.destination).toBe('/tmp/output.js');
      expect(resolved.options.config).toEqual({ port: 3000, host: 'localhost' });
      expect(resolved.options.verbose).toBe(true);
    });
  });

  describe('executeToolWithArtifacts()', () => {
    it('should execute tool and store single output artifact', async () => {
      const toolCall = {
        tool: 'test_tool',
        inputs: {
          source: '@test_file',
          target: '/tmp/output.js'
        },
        outputs: [
          {
            name: 'result_file',
            type: 'file',
            description: 'Generated output file',
            purpose: 'Result of tool execution'
          }
        ]
      };

      const result = await strategy.executeToolWithArtifacts(toolCall, context);

      // Verify tool was called with resolved inputs
      expect(mockTool.execute).toHaveBeenCalledWith({
        source: '/tmp/test.js',
        target: '/tmp/output.js'
      });

      // Verify artifact was stored
      const artifact = context.getArtifact('result_file');
      expect(artifact).toBeDefined();
      expect(artifact.type).toBe('file');
      expect(artifact.value).toEqual({ output: 'test result' });
      expect(artifact.description).toBe('Generated output file');
      expect(artifact.purpose).toBe('Result of tool execution');
      expect(artifact.metadata.toolName).toBe('test_tool');
      expect(artifact.metadata.success).toBe(true);

      // Verify conversation history entry
      expect(context.conversationHistory).toHaveLength(1);
      expect(context.conversationHistory[0].role).toBe('assistant');
      expect(context.conversationHistory[0].content).toContain('@result_file');
    });

    it('should execute tool and store multiple output artifacts', async () => {
      // Mock tool that returns multiple outputs
      mockTool.execute.mockResolvedValue({
        success: true,
        data: {
          config_file: { host: 'localhost', port: 3000 },
          log_file: '/tmp/server.log'
        }
      });

      const toolCall = {
        tool: 'test_tool',
        inputs: { template: '@test_file' },
        outputs: [
          {
            name: 'server_config',
            type: 'data',
            description: 'Server configuration',
            purpose: 'Configure the server'
          },
          {
            name: 'log_location',
            type: 'file',
            description: 'Log file path',
            purpose: 'Where server logs are written'
          }
        ]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      // Verify both artifacts were stored
      const configArtifact = context.getArtifact('server_config');
      expect(configArtifact.type).toBe('data');
      expect(configArtifact.value).toEqual({ config_file: { host: 'localhost', port: 3000 }, log_file: '/tmp/server.log' });

      const logArtifact = context.getArtifact('log_location');
      expect(logArtifact.type).toBe('file');
      expect(logArtifact.value).toEqual({ config_file: { host: 'localhost', port: 3000 }, log_file: '/tmp/server.log' });

      // Verify conversation history has entries for both outputs
      expect(context.conversationHistory).toHaveLength(2);
    });

    it('should handle tool execution without outputs specification', async () => {
      const toolCall = {
        tool: 'test_tool',
        inputs: { file: '@test_file' }
        // No outputs specified
      };

      const result = await strategy.executeToolWithArtifacts(toolCall, context);

      // Tool should be executed
      expect(mockTool.execute).toHaveBeenCalled();
      
      // No artifacts should be stored
      expect(context.listArtifacts()).toHaveLength(2); // Only original test artifacts

      // No conversation history entries should be added
      expect(context.conversationHistory).toHaveLength(0);
    });

    it('should throw error if tool is not found', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);

      const toolCall = {
        tool: 'non_existent_tool',
        inputs: {}
      };

      await expect(strategy.executeToolWithArtifacts(toolCall, context))
        .rejects.toThrow('Tool not found: non_existent_tool');
    });

    it('should store metadata about input artifacts used', async () => {
      const toolCall = {
        tool: 'test_tool',
        inputs: {
          source: '@test_file',
          config: '@config_data',
          direct: 'value'
        },
        outputs: [
          {
            name: 'result',
            type: 'data',
            description: 'Tool result',
            purpose: 'Output from tool'
          }
        ]
      };

      await strategy.executeToolWithArtifacts(toolCall, context);

      const artifact = context.getArtifact('result');
      expect(artifact.metadata.inputArtifacts).toEqual(['test_file', 'config_data']);
    });
  });

  describe('formatConversationHistory()', () => {
    beforeEach(() => {
      // Add test messages to conversation history
      context.conversationHistory.push(
        {
          role: 'user',
          content: 'Create a server',
          timestamp: Date.now()
        },
        {
          role: 'assistant',
          content: 'I will create a server using @test_file',
          timestamp: Date.now()
        },
        {
          role: 'system',
          content: 'System message',
          timestamp: Date.now()
        }
      );
    });

    it('should format conversation history with role labels', () => {
      const formatted = strategy.formatConversationHistory(context);

      expect(formatted).toContain('User: Create a server');
      expect(formatted).toContain('Assistant: I will create a server using @test_file');
      expect(formatted).toContain('System: System message');
    });

    it('should limit conversation history to specified number', () => {
      // Add more messages
      for (let i = 0; i < 10; i++) {
        context.conversationHistory.push({
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      const formatted = strategy.formatConversationHistory(context, 2);
      const lines = formatted.split('\n');
      
      expect(lines).toHaveLength(2);
      expect(formatted).toContain('Message 8');
      expect(formatted).toContain('Message 9');
    });

    it('should handle empty conversation history', () => {
      const emptyContext = new ExecutionContext();
      const formatted = strategy.formatConversationHistory(emptyContext);

      expect(formatted).toBe('No previous conversation.');
    });

    it('should use default limit of 10 messages', () => {
      // Add 15 messages
      for (let i = 0; i < 15; i++) {
        context.conversationHistory.push({
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      const formatted = strategy.formatConversationHistory(context);
      const lines = formatted.split('\n');
      
      expect(lines).toHaveLength(10); // Should be limited to 10
    });
  });

  describe('formatArtifactsCatalog()', () => {
    it('should format artifacts catalog with details', () => {
      const formatted = strategy.formatArtifactsCatalog(context);

      expect(formatted).toContain('Available Artifacts (2):');
      expect(formatted).toContain('- @test_file (file): Test file');
      expect(formatted).toContain('Purpose: Testing artifact resolution');
      expect(formatted).toContain('- @config_data (data): Configuration data');
      expect(formatted).toContain('Purpose: Server configuration');
      expect(formatted).toContain('Size: 12 chars'); // '/tmp/test.js' length
      expect(formatted).toContain('Size: object{2 keys}'); // config object
    });

    it('should handle empty artifacts', () => {
      const emptyContext = new ExecutionContext();
      const formatted = strategy.formatArtifactsCatalog(emptyContext);

      expect(formatted).toBe('No artifacts available.');
    });

    it('should format artifact sizes correctly', () => {
      const testContext = new ExecutionContext();
      
      testContext.addArtifact('string_artifact', {
        type: 'data',
        value: 'test string',
        description: 'String data',
        purpose: 'Testing',
        timestamp: Date.now()
      });

      testContext.addArtifact('number_artifact', {
        type: 'data',
        value: 42,
        description: 'Number data',
        purpose: 'Testing',
        timestamp: Date.now()
      });

      testContext.addArtifact('array_artifact', {
        type: 'data',
        value: [1, 2, 3],
        description: 'Array data',
        purpose: 'Testing',
        timestamp: Date.now()
      });

      testContext.addArtifact('null_artifact', {
        type: 'data',
        value: null,
        description: 'Null data',
        purpose: 'Testing',
        timestamp: Date.now()
      });

      const formatted = strategy.formatArtifactsCatalog(testContext);

      expect(formatted).toContain('Size: 11 chars'); // 'test string'
      expect(formatted).toContain('Size: number');
      expect(formatted).toContain('Size: array[3]');
      expect(formatted).toContain('Size: empty');
    });
  });

  describe('buildPrompt()', () => {
    beforeEach(() => {
      context.conversationHistory.push({
        role: 'user',
        content: 'Create a server',
        timestamp: Date.now()
      });
    });

    it('should build prompt with two sections', () => {
      const task = {
        description: 'Deploy the application'
      };

      const prompt = strategy.buildPrompt(task, context);

      expect(prompt).toContain('## Conversation History');
      expect(prompt).toContain('User: Create a server');
      expect(prompt).toContain('## Available Artifacts');
      expect(prompt).toContain('- @test_file (file): Test file');
      expect(prompt).toContain('## Current Task');
      expect(prompt).toContain('Deploy the application');
      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain('"tool": "tool_name"');
      expect(prompt).toContain('@artifact_name');
    });

    it('should handle empty conversation and artifacts', () => {
      const emptyContext = new ExecutionContext();
      const task = { description: 'Test task' };

      const prompt = strategy.buildPrompt(task, emptyContext);

      expect(prompt).toContain('No previous conversation.');
      expect(prompt).toContain('No artifacts available.');
      expect(prompt).toContain('Test task');
    });
  });

  describe('extractArtifactReferences()', () => {
    it('should extract artifact references from simple inputs', () => {
      const inputs = {
        file: '@test_file',
        config: '@config_data',
        direct: 'value'
      };

      const refs = strategy.extractArtifactReferences(inputs);

      expect(refs).toEqual(['test_file', 'config_data']);
    });

    it('should extract artifact references from arrays', () => {
      const inputs = {
        files: ['@file1', '@file2', 'direct.js'],
        other: 'value'
      };

      const refs = strategy.extractArtifactReferences(inputs);

      expect(refs).toEqual(['file1', 'file2']);
    });

    it('should extract artifact references from nested objects', () => {
      const inputs = {
        deployment: {
          source: '@source_file',
          config: {
            settings: '@app_config'
          }
        },
        files: ['@helper_file']
      };

      const refs = strategy.extractArtifactReferences(inputs);

      expect(refs).toEqual(['source_file', 'app_config', 'helper_file']);
    });

    it('should return empty array if no artifacts found', () => {
      const inputs = {
        file: 'direct.js',
        value: 42,
        config: { key: 'value' }
      };

      const refs = strategy.extractArtifactReferences(inputs);

      expect(refs).toEqual([]);
    });

    it('should handle null and undefined inputs', () => {
      expect(strategy.extractArtifactReferences(null)).toEqual([]);
      expect(strategy.extractArtifactReferences(undefined)).toEqual([]);
      expect(strategy.extractArtifactReferences('string')).toEqual([]);
    });
  });

  describe('getArtifactSize() helper', () => {
    it('should return size for different value types', () => {
      expect(strategy.getArtifactSize('test')).toBe('4 chars');
      expect(strategy.getArtifactSize(42)).toBe('number');
      expect(strategy.getArtifactSize(true)).toBe('boolean');
      expect(strategy.getArtifactSize([1, 2, 3])).toBe('array[3]');
      expect(strategy.getArtifactSize({ a: 1, b: 2 })).toBe('object{2 keys}');
      expect(strategy.getArtifactSize(null)).toBe('empty');
      expect(strategy.getArtifactSize(undefined)).toBe('empty');
    });
  });
});