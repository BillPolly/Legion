/**
 * Unit tests for PromptBuilder
 * Tests prompt generation logic for different scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PromptBuilder from '../../../src/utils/PromptBuilder.js';
import { ArtifactRegistry } from '@legion/tasks';

describe('PromptBuilder Unit Tests', () => {
  let promptBuilder;
  let mockArtifactRegistry;
  let mockToolRegistry;

  beforeEach(async () => {
    promptBuilder = new PromptBuilder();
    await promptBuilder.initialize();
    // Create mock artifact registry
    mockArtifactRegistry = new ArtifactRegistry();
    mockArtifactRegistry.store('test_file', '/tmp/test.txt', 'Test file path');
    mockArtifactRegistry.store('user_data', { name: 'John', age: 30 }, 'User information');
    mockArtifactRegistry.store('count', 42, 'A number value');

    // Create mock tool registry
    mockToolRegistry = {
      listTools: jest.fn().mockResolvedValue([
        {
          name: 'file_write',
          description: 'Write content to a file',
          inputSchema: {
            properties: {
              filepath: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['filepath', 'content']
          },
          outputSchema: {
            properties: {
              filepath: { type: 'string' },
              success: { type: 'boolean' }
            }
          }
        },
        {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          inputSchema: {
            properties: {
              expression: { type: 'string' }
            },
            required: ['expression']
          },
          outputSchema: {
            properties: {
              result: { type: 'number' }
            }
          }
        }
      ])
    };
  });

  describe('Decomposition Prompt Building', () => {
    it('should build basic decomposition prompt', () => {
      const task = { description: 'Build a web application' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        classification: {
          reasoning: 'Multiple components required',
          suggestedApproach: 'Break into frontend and backend'
        }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toContain('Build a web application');
      expect(prompt).toContain('task decomposition expert');
      expect(prompt).toContain('Multiple components required');
      expect(prompt).toContain('Break into frontend and backend');
    });

    it('should include artifacts in decomposition prompt', () => {
      const task = { description: 'Process the data file' };
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        classification: { reasoning: 'Complex data processing' }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toContain('@test_file');
      expect(prompt).toContain('@user_data');
      expect(prompt).toContain('@count');
      expect(prompt).toContain('AVAILABLE ARTIFACTS');
      expect(prompt).toContain('Test file path');
      expect(prompt).toContain('User information');
    });

    it('should handle empty artifact registry', () => {
      const task = { description: 'Create new project' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        classification: { reasoning: 'Multiple files needed' }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toContain('Create new project');
      expect(prompt).not.toContain('AVAILABLE ARTIFACTS');
      expect(prompt).toContain('task decomposition expert');
    });

    it('should handle string task input', () => {
      const task = 'Build a complete API';
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        classification: { reasoning: 'API requires multiple endpoints' }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toContain('Build a complete API');
      expect(prompt).toContain('API requires multiple endpoints');
    });

    it('should handle task without classification', () => {
      const task = { description: 'Complex task' };
      const context = { artifactRegistry: new ArtifactRegistry() };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toContain('Complex task');
      expect(prompt).toContain('task decomposition expert');
      expect(prompt).not.toContain('Classification reasoning');
    });
  });

  describe('Execution Prompt Building', () => {
    it('should build execution prompt for SIMPLE tasks with discovered tools', async () => {
      const task = { description: 'Write hello world to a file' };
      const discoveredTools = [
        {
          name: 'file_write',
          description: 'Write content to a file',
          confidence: 0.95,
          inputSchema: {
            properties: {
              filepath: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['filepath', 'content']
          },
          outputSchema: {
            properties: {
              filepath: { type: 'string' }
            }
          }
        }
      ];
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        discoveredTools: discoveredTools,
        isSimpleTask: true
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toContain('Write hello world to a file');
      expect(prompt).toContain('task execution specialist');
      expect(prompt).toContain('file_write');
      expect(prompt).toContain('confidence: 95%');
      expect(prompt).toContain('filepath, content');
    });

    it('should build execution prompt with tool registry fallback', async () => {
      const task = { description: 'Calculate something' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        toolRegistry: mockToolRegistry,
        isSimpleTask: false
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toContain('Calculate something');
      expect(prompt).toContain('file_write');
      expect(prompt).toContain('calculator');
      expect(prompt).toContain('Write content to a file');
      expect(prompt).toContain('Perform mathematical calculations');
    });

    it('should include artifacts in execution prompt', async () => {
      const task = { description: 'Process user data' };
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        discoveredTools: [],
        toolRegistry: mockToolRegistry
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toContain('@test_file');
      expect(prompt).toContain('@user_data');
      expect(prompt).toContain('@count');
      expect(prompt).toContain('AVAILABLE ARTIFACTS');
      expect(prompt).toContain('Test file path');
    });

    it('should handle empty discovered tools array', async () => {
      const task = { description: 'Generic task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        discoveredTools: [],
        toolRegistry: mockToolRegistry,
        isSimpleTask: true
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toContain('Generic task');
      // Should fall back to tool registry
      expect(prompt).toContain('file_write');
      expect(prompt).toContain('calculator');
    });

    it('should handle null tool registry', async () => {
      const task = { description: 'Task without tools' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        discoveredTools: [],
        toolRegistry: null
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toContain('Task without tools');
      expect(prompt).toContain('None configured');
    });
  });

  describe('Tool Section Formatting', () => {
    it('should format discovered tools section correctly', () => {
      const discoveredTools = [
        {
          name: 'file_read',
          description: 'Read file contents',
          confidence: 0.88,
          inputSchema: {
            properties: {
              filepath: { type: 'string' }
            },
            required: ['filepath']
          },
          outputSchema: {
            properties: {
              content: { type: 'string' },
              filepath: { type: 'string' }
            }
          }
        },
        {
          name: 'json_parse',
          description: 'Parse JSON data',
          confidence: 0.75,
          inputSchema: {
            properties: {
              jsonString: { type: 'string' },
              validate: { type: 'boolean' }
            },
            required: ['jsonString']
          }
        }
      ];

      const section = promptBuilder.formatDiscoveredToolsSection(discoveredTools);

      expect(section).toContain('AVAILABLE TOOLS (discovered for this task)');
      expect(section).toContain('file_read');
      expect(section).toContain('confidence: 88%');
      expect(section).toContain('json_parse');
      expect(section).toContain('confidence: 75%');
      expect(section).toContain('filepath');
      expect(section).toContain('jsonString, validate?'); // validate is optional
      expect(section).toContain('content, filepath');
    });

    it('should handle empty discovered tools', () => {
      const section = promptBuilder.formatDiscoveredToolsSection([]);

      expect(section).toContain('No suitable tools discovered');
    });

    it('should handle null discovered tools', () => {
      const section = promptBuilder.formatDiscoveredToolsSection(null);

      expect(section).toContain('No suitable tools discovered');
    });

    it('should format tool registry section', async () => {
      const section = await promptBuilder.formatToolsSection(mockToolRegistry);

      expect(section).toContain('AVAILABLE TOOLS:');
      expect(section).toContain('file_write');
      expect(section).toContain('calculator');
      expect(section).toContain('Write content to a file');
      expect(section).toContain('filepath, content');
      expect(section).toContain('expression');
    });

    it('should handle tool registry errors', async () => {
      const errorToolRegistry = {
        listTools: jest.fn().mockRejectedValue(new Error('Registry failed'))
      };

      const section = await promptBuilder.formatToolsSection(errorToolRegistry);

      expect(section).toContain('Error loading tools');
      expect(section).toContain('Registry failed');
    });

    it('should handle empty tool registry', async () => {
      const emptyToolRegistry = {
        listTools: jest.fn().mockResolvedValue([])
      };

      const section = await promptBuilder.formatToolsSection(emptyToolRegistry);

      expect(section).toContain('None found');
    });
  });

  describe('Artifacts Section Formatting', () => {
    it('should format artifacts section with multiple artifacts', () => {
      const section = promptBuilder.formatArtifactsSection(mockArtifactRegistry);

      expect(section).toContain('AVAILABLE ARTIFACTS:');
      expect(section).toContain('@test_file');
      expect(section).toContain('@user_data');
      expect(section).toContain('@count');
      expect(section).toContain('Test file path');
      expect(section).toContain('User information');
      expect(section).toContain('A number value');
      expect(section).toContain('string');
      expect(section).toContain('object');
      expect(section).toContain('number');
    });

    it('should handle empty artifact registry', () => {
      const emptyRegistry = new ArtifactRegistry();
      const section = promptBuilder.formatArtifactsSection(emptyRegistry);

      expect(section).toContain('None available yet');
    });

    it('should handle null artifact registry', () => {
      const section = promptBuilder.formatArtifactsSection(null);

      expect(section).toContain('None available yet');
    });

    it('should include usage instructions', () => {
      const section = promptBuilder.formatArtifactsSection(mockArtifactRegistry);

      expect(section).toContain('@ symbol');
      expect(section).toContain('automatically replaced');
      expect(section).toContain('COMPLETE EXAMPLE');
    });

    it('should include tool call example with first artifact', () => {
      const section = promptBuilder.formatArtifactsSection(mockArtifactRegistry);

      expect(section).toContain('@test_file'); // Should use first artifact
      expect(section).toContain('file_write');
      expect(section).toContain('"content": "@test_file"');
    });
  });

  describe('Instruction Generation', () => {
    it('should use template-based instructions in execution prompts', async () => {
      // Test that buildExecutionPrompt works with the new template-based approach
      const mockTools = [
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { properties: { input: { type: 'string' } } }
        }
      ];

      const prompt = await promptBuilder.buildExecutionPrompt(
        'test task',
        mockTools,
        [],
        { artifactRegistry: null }
      );

      expect(prompt).toContain('test task');
      expect(prompt).toContain('test_tool');
      expect(prompt).toContain('Return JSON');
    });

    it('should handle legacy signature for execution prompts', async () => {
      // Test that the legacy signature still works
      const task = { description: 'test task' };
      const context = { 
        isSimpleTask: true,
        discoveredTools: [],
        artifactRegistry: null
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toContain('test task');
      expect(prompt).toContain('Return JSON');
    });

    it('should generate artifact usage instructions', () => {
      const instructions = promptBuilder.getArtifactUsageInstructions();

      expect(instructions).toContain('@ symbol');
      expect(instructions).toContain('artifact name');
      expect(instructions).toContain('DO NOT include the actual value');
      expect(instructions).toContain('automatically replaced');
    });

    it('should generate tool call example', () => {
      const example = promptBuilder.getToolCallExample(mockArtifactRegistry);

      expect(example).toContain('COMPLETE EXAMPLE');
      expect(example).toContain('file_write');
      expect(example).toContain('@test_file');
      expect(example).toContain('outputs');
      expect(example).toContain('@saved_file_path');
    });
  });

  describe('Utility Methods', () => {
    it('should format error messages', () => {
      const error = promptBuilder.formatError('Tool not found', {
        tool: 'missing_tool',
        suggestion: 'Check tool name'
      });

      expect(error).toContain('Tool not found');
      expect(error).toContain('Tool: missing_tool');
      expect(error).toContain('Suggestion: Check tool name');
    });

    it('should format error messages without context', () => {
      const error = promptBuilder.formatError('Simple error');

      expect(error).toBe('Error: Simple error');
    });

    it('should format progress messages', () => {
      const progress = promptBuilder.formatProgress('Executing subtask', {
        depth: 2,
        subtask: 'Create HTML file',
        artifact: 'html_content'
      });

      expect(progress).toContain('[Depth 2]');
      expect(progress).toContain('Executing subtask');
      expect(progress).toContain(': Create HTML file');
      expect(progress).toContain('(saving as @html_content)');
    });

    it('should format progress messages with minimal context', () => {
      const progress = promptBuilder.formatProgress('Simple action');

      expect(progress).toBe('Simple action');
    });

    it('should get system message', () => {
      const message = promptBuilder.getSystemMessage();

      expect(message).toContain('task decomposition agent');
      expect(message).toContain('valid JSON');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle task objects without description', () => {
      const task = { action: 'create', target: 'file' };
      const context = { artifactRegistry: new ArtifactRegistry() };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toContain(JSON.stringify(task));
    });

    it('should handle missing artifact registry size method', () => {
      const mockRegistry = {
        artifacts: new Map(),
        size: undefined // Missing size method
      };
      const context = { artifactRegistry: mockRegistry };

      const prompt = promptBuilder.buildDecompositionPrompt('test', context);

      expect(prompt).toContain('test');
      // Should not crash, just not include artifacts section
    });

    it('should handle tool registry with missing tools', async () => {
      const toolRegistry = {
        listTools: jest.fn().mockResolvedValue(null)
      };

      const section = await promptBuilder.formatToolsSection(toolRegistry);

      expect(section).toContain('None found');
    });

    it('should handle tools without schema information', () => {
      const tools = [
        {
          name: 'minimal_tool',
          description: 'Tool without schema'
          // No inputSchema or outputSchema
        }
      ];

      const section = promptBuilder.formatDiscoveredToolsSection(tools);

      expect(section).toContain('minimal_tool');
      expect(section).toContain('Tool without schema');
      // Should not crash on missing schema
    });
  });
});