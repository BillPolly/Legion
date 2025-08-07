/**
 * Integration test for artifact naming and referencing system
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanningAgent, AgentConfig } from '../../src/core/agents/base/index.js';
import { TemplatePlanningStrategy } from '../../src/core/execution/planning/strategies/index.js';
import { AtomicTool } from '../../src/core/execution/tools/index.js';

describe('Artifact System Integration', () => {
  let agent;
  let tools;
  let fileStorage = {};

  beforeEach(() => {
    // Reset file storage
    fileStorage = {};

    // Create mock tools that simulate file operations
    tools = [
      new AtomicTool(
        'writeFile',
        'Write content to a file',
        async (params) => {
          fileStorage[params.path] = params.content;
          return {
            success: true,
            data: {
              path: params.path,
              size: params.content.length
            }
          };
        }
      ),
      new AtomicTool(
        'readFile',
        'Read content from a file',
        async (params) => {
          const content = fileStorage[params.path];
          if (!content) {
            throw new Error(`File not found: ${params.path}`);
          }
          return {
            success: true,
            data: {
              content,
              path: params.path
            }
          };
        }
      ),
      new AtomicTool(
        'processFile',
        'Process file content',
        async (params) => {
          const content = fileStorage[params.inputPath];
          if (!content) {
            throw new Error(`File not found: ${params.inputPath}`);
          }
          const processed = content.toUpperCase();
          fileStorage[params.outputPath] = processed;
          return {
            success: true,
            data: {
              outputPath: params.outputPath,
              processedLines: processed.split('\n').length
            }
          };
        }
      )
    ];
  });

  test('should save and reference artifacts using template strategy', async () => {
    // Create a template that uses artifact naming
    const templates = {
      'create and process': [
        {
          id: 'create_file',
          description: 'Create initial file',
          tool: 'writeFile',
          params: {
            path: 'input.txt',
            content: 'hello world\nthis is a test'
          },
          dependencies: [],
          saveOutputs: {
            path: {
              name: 'inputFile',
              description: 'Path to the input file we created'
            }
          }
        },
        {
          id: 'process_file',
          description: 'Process the created file',
          tool: 'processFile',
          params: {
            inputPath: '@inputFile',  // Reference the artifact
            outputPath: 'output.txt'
          },
          dependencies: ['create_file'],
          saveOutputs: {
            outputPath: {
              name: 'processedFile',
              description: 'Path to the processed output file'
            }
          }
        },
        {
          id: 'read_output',
          description: 'Read the processed file',
          tool: 'readFile',
          params: {
            path: '@processedFile'  // Reference the second artifact
          },
          dependencies: ['process_file']
        }
      ]
    ];

    const strategy = new TemplatePlanningStrategy(templates);
    const config = new AgentConfig({
      name: 'ArtifactTestAgent',
      description: 'Test agent for artifact system',
      debugMode: false
    });

    agent = new PlanningAgent(config, strategy);

    const result = await agent.run('create and process', tools);

    expect(result.success).toBe(true);
    
    // Check that files were created correctly
    expect(fileStorage['input.txt']).toBe('hello world\nthis is a test');
    expect(fileStorage['output.txt']).toBe('HELLO WORLD\nTHIS IS A TEST');
    
    // Check that the final result contains the processed content
    expect(result.result.finalOutput.data.content).toBe('HELLO WORLD\nTHIS IS A TEST');
  });

  test('should handle artifacts in reflection context', async () => {
    const capturedPrompts = [];
    
    // Create agent with mock LLM that captures prompts
    const mockLLM = {
      complete: async (prompt) => {
        capturedPrompts.push(prompt);
        // Return a decision to proceed
        return JSON.stringify({
          type: 'proceed',
          details: {},
          reasoning: 'Continue with plan'
        });
      }
    };

    const templates = {
      'multi-step': [
        {
          id: 'step1',
          tool: 'writeFile',
          params: { path: 'file1.txt', content: 'content1' },
          saveOutputs: {
            path: {
              name: 'firstFile',
              description: 'The first file created in the workflow'
            }
          }
        },
        {
          id: 'step2',
          tool: 'writeFile',
          params: { path: 'file2.txt', content: 'content2' },
          dependencies: ['step1'],
          saveOutputs: {
            path: {
              name: 'secondFile',
              description: 'The second file created in the workflow'
            }
          }
        }
      ]
    };

    const strategy = new TemplatePlanningStrategy(templates);
    const config = new AgentConfig({
      name: 'ReflectionTestAgent',
      reflectionEnabled: true,
      debugMode: false
    });

    agent = new PlanningAgent(config, strategy);
    agent.setDependencies({ llm: mockLLM });

    await agent.run('multi-step', tools);

    // Check that reflection prompts included artifact context
    const lastPrompt = capturedPrompts[capturedPrompts.length - 1];
    expect(lastPrompt).toContain('Named Artifacts');
    expect(lastPrompt).toContain('@firstFile');
    expect(lastPrompt).toContain('@secondFile');
    expect(lastPrompt).toContain('The first file created in the workflow');
    expect(lastPrompt).toContain('The second file created in the workflow');
  });

  test('should handle missing artifact references gracefully', async () => {
    const templates = {
      'missing-ref': [
        {
          id: 'step1',
          tool: 'readFile',
          params: {
            path: '@nonexistentArtifact'  // This artifact doesn't exist
          }
        }
      ]
    };

    const strategy = new TemplatePlanningStrategy(templates);
    const config = new AgentConfig({
      name: 'MissingRefAgent',
      debugMode: false
    });

    agent = new PlanningAgent(config, strategy);

    const result = await agent.run('missing-ref', tools);

    // Should fail because the artifact reference wasn't resolved
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('@nonexistentArtifact');
  });

  test('should handle complex nested artifact references', async () => {
    // Create a tool that accepts multiple file paths
    const mergeFiles = new AtomicTool(
      'mergeFiles',
      'Merge multiple files',
      async (params) => {
        const contents = params.files.map(path => fileStorage[path] || '');
        const merged = contents.join('\n---\n');
        fileStorage[params.outputPath] = merged;
        return {
          success: true,
          data: {
            outputPath: params.outputPath,
            fileCount: params.files.length
          }
        };
      }
    );

    tools.push(mergeFiles);

    const templates = {
      'complex-workflow': [
        {
          id: 'create1',
          tool: 'writeFile',
          params: { path: 'doc1.txt', content: 'Document 1' },
          saveOutputs: {
            path: { name: 'doc1', description: 'First document' }
          }
        },
        {
          id: 'create2',
          tool: 'writeFile',
          params: { path: 'doc2.txt', content: 'Document 2' },
          saveOutputs: {
            path: { name: 'doc2', description: 'Second document' }
          }
        },
        {
          id: 'merge',
          tool: 'mergeFiles',
          params: {
            files: ['@doc1', '@doc2'],  // Array of artifact references
            outputPath: 'merged.txt'
          },
          dependencies: ['create1', 'create2'],
          saveOutputs: {
            outputPath: { name: 'mergedDoc', description: 'Merged document' }
          }
        },
        {
          id: 'read',
          tool: 'readFile',
          params: { path: '@mergedDoc' },
          dependencies: ['merge']
        }
      ]
    };

    const strategy = new TemplatePlanningStrategy(templates);
    const config = new AgentConfig({ name: 'ComplexAgent' });
    agent = new PlanningAgent(config, strategy);

    const result = await agent.run('complex-workflow', tools);

    expect(result.success).toBe(true);
    expect(fileStorage['merged.txt']).toBe('Document 1\n---\nDocument 2');
    expect(result.result.finalOutput.data.content).toBe('Document 1\n---\nDocument 2');
  });
});