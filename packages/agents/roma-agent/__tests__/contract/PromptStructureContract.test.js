/**
 * Contract tests for prompt structure validation
 * Ensures prompts meet expected formats and contain required information
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PromptBuilder from '../../src/utils/PromptBuilder.js';
import TaskClassifier from '../../src/utils/TaskClassifier.js';
import { ArtifactRegistry } from '@legion/tasks';

describe('Prompt Structure Contract Tests', () => {
  let promptBuilder;
  let mockArtifactRegistry;
  let mockToolRegistry;
  let mockTaskClassifier;

  beforeEach(async () => {
    promptBuilder = new PromptBuilder();
    await promptBuilder.initialize();
    // Create mock artifact registry with sample data
    mockArtifactRegistry = new ArtifactRegistry();
    mockArtifactRegistry.store('test_file', '/tmp/test.txt', 'Test file path');
    mockArtifactRegistry.store('user_data', { name: 'John', age: 30 }, 'User information');

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
        }
      ])
    };

    // Create mock task classifier
    const mockLLMClient = { complete: jest.fn() };
    mockTaskClassifier = new TaskClassifier(mockLLMClient);
  });

  describe('Decomposition Prompt Contract', () => {
    it('should contain required sections for task decomposition', () => {
      const task = { description: 'Build a web application' };
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        classification: {
          reasoning: 'Multiple components required',
          suggestedApproach: 'Break into subtasks'
        }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      // Required sections - updated to match actual template
      expect(prompt).toMatch(/Task to Decompose/);
      expect(prompt).toContain('Build a web application');
      expect(prompt).toContain('Multiple components required');
      expect(prompt).toContain('Break into subtasks');
      
      // Schema requirements
      expect(prompt).toMatch(/"decompose":\s*<boolean>/);
      expect(prompt).toMatch(/"subtasks":\s*\[/);
      expect(prompt).toMatch(/"description":\s*"<string:/);
      expect(prompt).toMatch(/"outputs":\s*"<string:/);

      // Artifact reference instructions
      expect(prompt).toMatch(/@\w+/); // Any artifact name with @
      expect(prompt).toMatch(/AVAILABLE ARTIFACTS/);
    });

    it('should include artifact information when available', () => {
      const task = { description: 'Process data' };
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        classification: { reasoning: 'Data processing task' }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).toMatch(/@test_file/);
      expect(prompt).toMatch(/@user_data/);
      expect(prompt).toMatch(/Test file path/);
      expect(prompt).toMatch(/User information/);
    });

    it('should exclude artifact section when no artifacts exist', () => {
      const task = { description: 'New task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        classification: { reasoning: 'New task setup' }
      };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      expect(prompt).not.toMatch(/AVAILABLE ARTIFACTS/);
      expect(prompt).toMatch(/Task to Decompose/);
    });

    it('should have consistent JSON schema format', () => {
      const task = 'Test task';
      const context = { artifactRegistry: new ArtifactRegistry() };

      const prompt = promptBuilder.buildDecompositionPrompt(task, context);

      // Verify JSON structure is properly formatted
      expect(prompt).toMatch(/{\s*"decompose":\s*true,\s*"subtasks":\s*\[/);
      expect(prompt).toMatch(/"description":\s*".*",?\s*"outputs":\s*"@.*"/);
      
      // Should not have syntax errors
      expect(prompt).not.toMatch(/{\s*{/); // No double braces
      expect(prompt).not.toMatch(/\[\s*\[/); // No double brackets
    });
  });

  describe('Execution Prompt Contract', () => {
    it('should contain required sections for tool execution', async () => {
      const task = { description: 'Write a file' };
      const discoveredTools = [
        {
          name: 'file_write',
          description: 'Write to file',
          confidence: 0.9,
          inputSchema: { properties: { filepath: { type: 'string' } } }
        }
      ];
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        discoveredTools: discoveredTools,
        isSimpleTask: true
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // Required sections - updated to match actual template content
      expect(prompt).toContain('This task has been classified as SIMPLE');
      expect(prompt).toContain('Write a file');
      expect(prompt).toMatch(/AVAILABLE TOOLS \(discovered for this task\):/);
      expect(prompt).toMatch(/file_write.*confidence: 90%/);
      
      // Tool call format requirements
      expect(prompt).toMatch(/"useTools":\s*true/);
      expect(prompt).toMatch(/"toolCalls":\s*\[/);
      expect(prompt).toMatch(/"tool":\s*"file_write"/);
      expect(prompt).toMatch(/"inputs":\s*{/);
      expect(prompt).toMatch(/"outputs":\s*{/);

      // Artifact handling - check for actual example artifact
      expect(prompt).toMatch(/@test_file/);
      expect(prompt).toMatch(/AVAILABLE ARTIFACTS/);
    });

    it('should fall back to tool registry when no discovered tools', async () => {
      const task = { description: 'Generic task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        discoveredTools: [],
        toolRegistry: mockToolRegistry,
        isSimpleTask: false
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toMatch(/AVAILABLE TOOLS:/);
      expect(prompt).toMatch(/file_write/);
      expect(prompt).toMatch(/Write content to a file/);
      expect(prompt).not.toMatch(/discovered for this task/);
    });

    it('should include decision options for non-simple tasks', async () => {
      const task = { description: 'Complex task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        toolRegistry: mockToolRegistry,
        isSimpleTask: false
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // The actual prompt doesn't mention "three options" explicitly
      // It just provides instructions based on the task type
      expect(prompt).toContain('Return JSON with either');
      expect(prompt).toContain('"useTools" and "toolCalls"');
      expect(prompt).toContain('"decompose" and "subtasks"');
      expect(prompt).toContain('"response" string');
    });

    it('should have proper tool call format specification', async () => {
      const task = { description: 'Simple task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        discoveredTools: [{ name: 'test_tool', confidence: 0.8 }],
        isSimpleTask: true
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // Check that prompt contains basic structure elements
      // Since no artifacts exist, the example won't be shown
      expect(prompt).toContain('AVAILABLE TOOLS');
      expect(prompt).toContain('test_tool');
      expect(prompt).toContain('Return JSON');
    });
  });

  describe('TaskClassifier Prompt Contract', () => {
    it('should contain required classification criteria', async () => {
      const mockLLMClient = { 
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Direct tool call'
        }))
      };
      const classifier = new TaskClassifier(mockLLMClient);

      // The classifier now uses Prompt internally, not ResponseValidator
      // We can test that the prompt is created correctly
      expect(classifier.prompt).toBeDefined();
      expect(classifier.prompt.llmClient).toBe(mockLLMClient);

      await classifier.classify('test task');

      // The Prompt class calls the LLM client
      expect(mockLLMClient.complete).toHaveBeenCalled();
      const capturedPrompt = mockLLMClient.complete.mock.calls[0][0];

      // Required sections - updated to match actual template
      expect(capturedPrompt).toMatch(/Task to Analyze/);
      expect(capturedPrompt).toMatch(/"test task"/);
      expect(capturedPrompt).toMatch(/Classification Framework/);
      
      // SIMPLE criteria - updated to match actual template
      expect(capturedPrompt).toMatch(/SIMPLE.*direct sequence of tool calls/si);
      expect(capturedPrompt).toMatch(/Read configuration from config\.json.*parse/);
      
      // COMPLEX criteria - updated to match actual template
      expect(capturedPrompt).toMatch(/COMPLEX.*breaking down into smaller subtasks/si);
      expect(capturedPrompt).toMatch(/Build a complete web application.*authentication/);
      
      // Decision process - updated to match actual template
      expect(capturedPrompt).toMatch(/Decision Process/);
      expect(capturedPrompt).toMatch(/Tool Sufficiency/);
      expect(capturedPrompt).toMatch(/Coordination Need/);
    });

    it('should include format instructions from ResponseValidator', async () => {
      const mockLLMClient = { complete: jest.fn() };
      const classifier = new TaskClassifier(mockLLMClient);

      await classifier.classify('test task');

      const capturedPrompt = mockLLMClient.complete.mock.calls[0][0];

      // Should include format instructions
      expect(capturedPrompt).toMatch(/JSON/);
      expect(capturedPrompt).toMatch(/complexity/);
      expect(capturedPrompt).toMatch(/reasoning/);
    });

    it('should build classification prompt with context', () => {
      const context = {
        artifactRegistry: {
          size: () => 2,
          list: () => [
            { name: 'test_data', type: 'string', description: 'Test data' },
            { name: 'config', type: 'object', description: 'Configuration' }
          ]
        }
      };

      const prompt = TaskClassifier.buildClassificationPrompt('process data', context);

      expect(prompt).toMatch(/Available artifacts from previous steps:/);
      expect(prompt).toMatch(/@test_data.*string.*Test data/);
      expect(prompt).toMatch(/@config.*object.*Configuration/);
      expect(prompt).toMatch(/Classification criteria:/);
    });
  });

  describe('Tool Section Format Contract', () => {
    it('should format discovered tools consistently', () => {
      const discoveredTools = [
        {
          name: 'calculator',
          description: 'Perform calculations',
          confidence: 0.95,
          inputSchema: {
            properties: {
              expression: { type: 'string' },
              precision: { type: 'number' }
            },
            required: ['expression']
          },
          outputSchema: {
            properties: {
              result: { type: 'number' },
              formatted: { type: 'string' }
            }
          }
        }
      ];

      const section = promptBuilder.formatDiscoveredToolsSection(discoveredTools);

      // Header format
      expect(section).toMatch(/AVAILABLE TOOLS \(discovered for this task\):/);
      expect(section).toMatch(/These are the ONLY tools you can use/);
      
      // Tool format
      expect(section).toMatch(/• calculator \(confidence: 95%\)/);
      expect(section).toMatch(/Description: Perform calculations/);
      expect(section).toMatch(/Inputs: expression, precision\?/); // precision is optional
      expect(section).toMatch(/Outputs: result, formatted/);
    });

    it('should format tool registry consistently', async () => {
      const section = await promptBuilder.formatToolsSection(mockToolRegistry);

      expect(section).toMatch(/AVAILABLE TOOLS:/);
      expect(section).toMatch(/These are the ONLY tools you can use/);
      expect(section).toMatch(/• file_write/);
      expect(section).toMatch(/Description: Write content to a file/);
      expect(section).toMatch(/Inputs: filepath, content/);
    });

    it('should handle empty tool lists correctly', () => {
      const emptySection = promptBuilder.formatDiscoveredToolsSection([]);
      expect(emptySection).toMatch(/No suitable tools discovered/);

      const nullSection = promptBuilder.formatDiscoveredToolsSection(null);
      expect(nullSection).toMatch(/No suitable tools discovered/);
    });
  });

  describe('Artifact Section Format Contract', () => {
    it('should format artifacts consistently', () => {
      const section = promptBuilder.formatArtifactsSection(mockArtifactRegistry);

      // Header format
      expect(section).toMatch(/AVAILABLE ARTIFACTS:/);
      expect(section).toMatch(/values from previous steps/);
      expect(section).toMatch(/reference any artifact using the @ symbol/);
      
      // Artifact format
      expect(section).toMatch(/• @test_file/);
      expect(section).toMatch(/Type: string/);
      expect(section).toMatch(/Description: Test file path/);
      expect(section).toMatch(/• @user_data/);
      expect(section).toMatch(/Type: object/);
      
      // Usage instructions
      expect(section).toMatch(/IMPORTANT.*using artifacts in tool calls/);
      expect(section).toMatch(/automatically replaced/);
      expect(section).toMatch(/COMPLETE EXAMPLE/);
    });

    it('should include proper example format', () => {
      const section = promptBuilder.formatArtifactsSection(mockArtifactRegistry);

      expect(section).toMatch(/"content": "@test_file"/);
      expect(section).toMatch(/"outputs": {\s*"path": "@saved_file_path"/);
    });

    it('should handle empty artifact registry', () => {
      const emptyRegistry = new ArtifactRegistry();
      const section = promptBuilder.formatArtifactsSection(emptyRegistry);

      expect(section).toMatch(/ARTIFACTS: None available yet/);
    });
  });

  describe('Response Format Contract', () => {
    it('should specify JSON structure correctly', async () => {
      // Test by building an actual prompt and checking its content
      const task = { description: 'Test task' };
      // Create artifact registry with an artifact so the example is shown
      const artifactRegistry = new ArtifactRegistry();
      artifactRegistry.store('test_artifact', 'value', 'Test artifact');
      
      const context = { 
        artifactRegistry: artifactRegistry,
        toolRegistry: mockToolRegistry,
        isSimpleTask: true
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // JSON structure should be demonstrated in the example when artifacts exist
      expect(prompt).toContain('COMPLETE EXAMPLE OF A TOOL CALL WITH ARTIFACT');
      expect(prompt).toMatch(/"useTools":\s*true/);
      expect(prompt).toMatch(/"toolCalls":\s*\[/);
      expect(prompt).toMatch(/"tool":\s*"/);
      expect(prompt).toMatch(/"inputs":\s*{/);
      expect(prompt).toMatch(/"outputs":\s*{/);
    });

    it('should provide clear decision options', async () => {
      // Test with non-simple task to get decision options
      const task = { description: 'Complex task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        toolRegistry: mockToolRegistry,
        isSimpleTask: false
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // Check for the actual instructions given
      expect(prompt).toContain('Return JSON with either');
      expect(prompt).toContain('"useTools" and "toolCalls"');
      expect(prompt).toContain('"decompose" and "subtasks"');
      expect(prompt).toContain('"response" string');
    });
  });

  describe('Error and Edge Case Contract', () => {
    it('should handle missing tool registry gracefully', async () => {
      const task = { description: 'Test task' };
      const context = { 
        artifactRegistry: new ArtifactRegistry(),
        toolRegistry: null
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      expect(prompt).toMatch(/None configured/);
      expect(prompt).toContain('Test task'); // Should still include task
    });

    it('should handle tool registry errors gracefully', async () => {
      const errorToolRegistry = {
        listTools: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      const section = await promptBuilder.formatToolsSection(errorToolRegistry);

      expect(section).toMatch(/Error loading tools.*Database error/);
    });

    it('should format error messages consistently', () => {
      const error = promptBuilder.formatError('Tool not found', {
        tool: 'missing_tool',
        suggestion: 'Check spelling'
      });

      expect(error).toMatch(/Error: Tool not found/);
      expect(error).toMatch(/Tool: missing_tool/);
      expect(error).toMatch(/Suggestion: Check spelling/);
    });

    it('should format progress messages consistently', () => {
      const progress = promptBuilder.formatProgress('Processing task', {
        depth: 2,
        subtask: 'Create files',
        artifact: 'output'
      });

      expect(progress).toMatch(/\[Depth 2\] Processing task: Create files \(saving as @output\)/);
    });
  });

  describe('Prompt Length and Structure Contract', () => {
    it('should generate prompts within reasonable length limits', async () => {
      const task = { description: 'Test task' };
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        toolRegistry: mockToolRegistry
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // Should be comprehensive but not excessively long
      expect(prompt.length).toBeGreaterThan(500); // Comprehensive
      expect(prompt.length).toBeLessThan(10000); // Not excessive
      
      // Should have clear structure
      expect(prompt.split('\n').length).toBeGreaterThan(10); // Multi-line
    });

    it('should maintain consistent section ordering', async () => {
      const task = { description: 'Test task' };
      const context = { 
        artifactRegistry: mockArtifactRegistry,
        toolRegistry: mockToolRegistry,
        isSimpleTask: true
      };

      const prompt = await promptBuilder.buildExecutionPrompt(task, context);

      // Actual order from template: Task -> Artifacts -> Tool Selection Strategy -> Tools -> Instructions
      const taskIndex = prompt.indexOf('Task to Execute');
      const artifactsIndex = prompt.indexOf('AVAILABLE ARTIFACTS');
      const strategyIndex = prompt.indexOf('Tool Selection Strategy');
      const toolsIndex = prompt.indexOf('AVAILABLE TOOLS');
      const instructionsIndex = prompt.indexOf('Return JSON');

      expect(taskIndex).toBeGreaterThan(-1);
      expect(artifactsIndex).toBeGreaterThan(taskIndex);
      expect(strategyIndex).toBeGreaterThan(artifactsIndex);
      expect(toolsIndex).toBeGreaterThan(strategyIndex);
      expect(instructionsIndex).toBeGreaterThan(toolsIndex);
    });
  });
});