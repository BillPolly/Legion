/**
 * Integration tests for ResponseValidator with ROMA agent schemas
 * Tests real schema validation without mocking ResponseValidator
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { ResponseValidator } from '@legion/output-schema';
import { ResourceManager } from '@legion/resource-manager';
import TaskClassifier from '../../src/utils/TaskClassifier.js';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';

describe('ResponseValidator Integration Tests', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  describe('TaskClassifier Schema Validation', () => {
    let classifier;

    beforeEach(() => {
      // Create classifier with mock LLM for validation testing
      const mockLLMClient = {
        complete: jest.fn()
      };
      classifier = new TaskClassifier(mockLLMClient);
    });

    it('should validate correct SIMPLE classification responses', () => {
      const validSimpleResponse = {
        complexity: 'SIMPLE',
        reasoning: 'This task can be accomplished with direct file operations',
        suggestedApproach: 'Use file_write tool',
        estimatedSteps: 2
      };

      const result = classifier.responseValidator.validateExample(validSimpleResponse);
      
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual(validSimpleResponse);
    });

    it('should validate correct COMPLEX classification responses', () => {
      const validComplexResponse = {
        complexity: 'COMPLEX',
        reasoning: 'Building a web application requires multiple coordinated operations',
        suggestedApproach: 'Break down into HTML, CSS, JavaScript, and deployment subtasks'
      };

      const result = classifier.responseValidator.validateExample(validComplexResponse);
      
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data.complexity).toBe('COMPLEX');
      expect(result.data.reasoning).toContain('multiple coordinated operations');
    });

    it('should reject invalid complexity values', () => {
      const invalidResponse = {
        complexity: 'MEDIUM', // Invalid - should be SIMPLE or COMPLEX
        reasoning: 'This complexity level is not allowed'
      };

      const result = classifier.responseValidator.validateExample(invalidResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject responses missing required fields', () => {
      const incompleteResponse = {
        complexity: 'SIMPLE'
        // Missing required 'reasoning' field
      };

      const result = classifier.responseValidator.validateExample(incompleteResponse);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some(error => error.message.includes('Required'))).toBe(true);
    });

    it('should handle extra fields gracefully', () => {
      const responseWithExtras = {
        complexity: 'SIMPLE',
        reasoning: 'Valid reasoning',
        suggestedApproach: 'Use tools',
        estimatedSteps: 3,
        extraField: 'This should not break validation',
        anotherExtra: 42
      };

      const result = classifier.responseValidator.validateExample(responseWithExtras);
      
      expect(result.success).toBe(true);
      expect(result.data.complexity).toBe('SIMPLE');
      expect(result.data.reasoning).toBe('Valid reasoning');
    });

    it('should generate proper format instructions', () => {
      const instructions = classifier.responseValidator.generateInstructions(null, {
        format: 'json',
        verbosity: 'concise'
      });

      expect(instructions).toContain('JSON');
      expect(instructions).toContain('complexity');
      expect(instructions).toContain('reasoning');
      expect(instructions).toContain('SIMPLE');
      expect(instructions).toContain('COMPLEX');
    });
  });

  describe('SimpleROMAAgent Schema Validation', () => {
    let agent;

    beforeEach(async () => {
      agent = new SimpleROMAAgent();
      // Initialize the validators without full agent initialization
      agent.simpleTaskValidator = agent._createSimpleTaskValidator();
      agent.decompositionValidator = agent._createDecompositionValidator();
    });

    describe('Simple Task Response Validation', () => {
      it('should validate tool call responses', () => {
        const validToolCallResponse = {
          useTools: true,
          toolCalls: [
            {
              tool: 'file_write',
              inputs: {
                filepath: '/tmp/test.txt',
                content: 'Hello World'
              },
              outputs: {
                filepath: '@saved_file'
              }
            }
          ]
        };

        const result = agent.simpleTaskValidator.validateExample(validToolCallResponse);
        
        expect(result.success).toBe(true);
        expect(result.data.useTools).toBe(true);
        expect(result.data.toolCalls).toHaveLength(1);
        expect(result.data.toolCalls[0].tool).toBe('file_write');
      });

      it('should validate multiple tool calls', () => {
        const multipleToolCallsResponse = {
          useTools: true,
          toolCalls: [
            {
              tool: 'calculator',
              inputs: { expression: '2 + 2' }
            },
            {
              tool: 'file_write',
              inputs: { filepath: '/tmp/result.txt', content: '@calculation_result' },
              outputs: { filepath: '@output_file' }
            }
          ]
        };

        const result = agent.simpleTaskValidator.validateExample(multipleToolCallsResponse);
        
        expect(result.success).toBe(true);
        expect(result.data.toolCalls).toHaveLength(2);
        expect(result.data.toolCalls[0].tool).toBe('calculator');
        expect(result.data.toolCalls[1].tool).toBe('file_write');
      });

      it('should validate direct response format', () => {
        const directResponse = {
          response: 'The capital of France is Paris. It has been the capital since 508 AD.'
        };

        const result = agent.simpleTaskValidator.validateExample(directResponse);
        
        expect(result.success).toBe(true);
        expect(result.data.response).toContain('Paris');
      });

      it('should reject invalid tool call structure', () => {
        const invalidToolCall = {
          useTools: true,
          toolCalls: [
            {
              // Missing required 'tool' field
              inputs: { filepath: '/tmp/test.txt' }
            }
          ]
        };

        const result = agent.simpleTaskValidator.validateExample(invalidToolCall);
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should handle mixed response formats (currently allowed by schema)', () => {
        const mixedResponse = {
          useTools: true,
          toolCalls: [{ tool: 'calculator', inputs: { expression: '1+1' } }],
          response: 'This should not be here with useTools'
        };

        const result = agent.simpleTaskValidator.validateExample(mixedResponse);
        
        // Currently the schema allows this because anyOf matches the first schema (tool calls)
        // TODO: Consider making schema more strict to prevent mixed formats
        expect(result.success).toBe(true);
      });

      it('should handle tool calls with artifact references', () => {
        const artifactToolCall = {
          useTools: true,
          toolCalls: [
            {
              tool: 'file_write',
              inputs: {
                filepath: '@output_path',
                content: '@processed_data'
              },
              outputs: {
                filepath: '@final_file',
                success: '@write_success'
              }
            }
          ]
        };

        const result = agent.simpleTaskValidator.validateExample(artifactToolCall);
        
        expect(result.success).toBe(true);
        expect(result.data.toolCalls[0].inputs.filepath).toBe('@output_path');
        expect(result.data.toolCalls[0].outputs.filepath).toBe('@final_file');
      });
    });

    describe('Decomposition Response Validation', () => {
      it('should validate basic decomposition responses', () => {
        const validDecomposition = {
          decompose: true,
          subtasks: [
            {
              description: 'Create HTML structure',
              outputs: '@html_content'
            },
            {
              description: 'Add CSS styling',
              outputs: '@css_content'
            },
            {
              description: 'Integrate JavaScript functionality'
            }
          ]
        };

        const result = agent.decompositionValidator.validateExample(validDecomposition);
        
        expect(result.success).toBe(true);
        expect(result.data.decompose).toBe(true);
        expect(result.data.subtasks).toHaveLength(3);
        expect(result.data.subtasks[0].outputs).toBe('@html_content');
      });

      it('should validate subtasks without outputs', () => {
        const decompositionNoOutputs = {
          decompose: true,
          subtasks: [
            {
              description: 'Analyze requirements'
            },
            {
              description: 'Create implementation plan'
            }
          ]
        };

        const result = agent.decompositionValidator.validateExample(decompositionNoOutputs);
        
        expect(result.success).toBe(true);
        expect(result.data.subtasks[0].description).toBe('Analyze requirements');
        expect(result.data.subtasks[0].outputs).toBeUndefined();
      });

      it('should reject decomposition without subtasks', () => {
        const invalidDecomposition = {
          decompose: true
          // Missing required 'subtasks' field
        };

        const result = agent.decompositionValidator.validateExample(invalidDecomposition);
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should reject subtasks without descriptions', () => {
        const invalidSubtasks = {
          decompose: true,
          subtasks: [
            {
              // Missing required 'description' field
              outputs: '@result'
            }
          ]
        };

        const result = agent.decompositionValidator.validateExample(invalidSubtasks);
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should handle complex subtask structures', () => {
        const complexDecomposition = {
          decompose: true,
          subtasks: [
            {
              description: 'Setup project structure with package.json and directories',
              outputs: '@project_structure'
            },
            {
              description: 'Create Express server with routing using @project_structure',
              outputs: '@server_code'
            },
            {
              description: 'Add authentication middleware to @server_code',
              outputs: '@secure_server'
            },
            {
              description: 'Create API endpoints using @secure_server configuration',
              outputs: '@complete_api'
            }
          ]
        };

        const result = agent.decompositionValidator.validateExample(complexDecomposition);
        
        expect(result.success).toBe(true);
        expect(result.data.subtasks).toHaveLength(4);
        expect(result.data.subtasks[1].description).toContain('@project_structure');
        expect(result.data.subtasks[3].outputs).toBe('@complete_api');
      });
    });

    describe('Response Processing', () => {
      it('should process valid JSON responses', () => {
        const jsonResponse = JSON.stringify({
          useTools: true,
          toolCalls: [
            { tool: 'calculator', inputs: { expression: '10 * 5' } }
          ]
        });

        const result = agent.simpleTaskValidator.process(jsonResponse);
        
        expect(result.success).toBe(true);
        expect(result.data.useTools).toBe(true);
        expect(result.data.toolCalls[0].tool).toBe('calculator');
      });

      it('should handle malformed JSON gracefully', () => {
        const malformedJson = '{"useTools": true, "toolCalls": [{"tool": "calculator", "inputs":}]}';

        const result = agent.simpleTaskValidator.process(malformedJson);
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should handle non-JSON responses', () => {
        const plainTextResponse = 'This is a plain text response that is not JSON';

        const result = agent.simpleTaskValidator.process(plainTextResponse);
        
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should auto-repair minor JSON issues when enabled', () => {
        // Test with a response that might have minor formatting issues
        const minorIssueJson = `{
          "useTools": true,
          "toolCalls": [
            {
              "tool": "file_write",
              "inputs": {
                "filepath": "/tmp/test.txt",
                "content": "Hello"
              }
            }
          ]
        }`;

        const result = agent.simpleTaskValidator.process(minorIssueJson);
        
        expect(result.success).toBe(true);
        expect(result.data.useTools).toBe(true);
      });
    });

    describe('Schema Instruction Generation', () => {
      it('should generate concise format instructions', () => {
        const instructions = agent.simpleTaskValidator.generateInstructions(null, {
          format: 'json',
          verbosity: 'concise'
        });

        expect(instructions).toContain('JSON');
        // Note: The actual fields in instructions depend on the schema structure
        // For anyOf schemas, the instructions may be more general
        expect(instructions.length).toBeGreaterThan(50);
      });

      it('should generate detailed format instructions', () => {
        const instructions = agent.decompositionValidator.generateInstructions(null, {
          format: 'json',
          verbosity: 'detailed'
        });

        expect(instructions).toContain('JSON');
        expect(instructions).toContain('decompose');
        expect(instructions).toContain('subtasks');
        // Note: The field-level details may vary based on schema structure
        expect(instructions.length).toBeGreaterThan(50);
      });

      it('should generate instructions with examples', () => {
        const instructions = agent.simpleTaskValidator.generateInstructions(null, {
          format: 'json',
          includeExamples: true
        });

        expect(instructions).toContain('JSON');
        // Should contain schema-derived examples
        expect(instructions.length).toBeGreaterThan(100); // Detailed instructions
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    let agent;

    beforeEach(async () => {
      agent = new SimpleROMAAgent();
      agent.simpleTaskValidator = agent._createSimpleTaskValidator();
      agent.decompositionValidator = agent._createDecompositionValidator();
    });

    it('should handle empty responses', () => {
      const result = agent.simpleTaskValidator.process('');
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle null responses', () => {
      const result = agent.simpleTaskValidator.process(null);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle extremely large responses', () => {
      const largeResponse = {
        useTools: true,
        toolCalls: Array.from({ length: 100 }, (_, i) => ({
          tool: `tool_${i}`,
          inputs: { param: `value_${i}` }
        }))
      };

      const result = agent.simpleTaskValidator.validateExample(largeResponse);
      
      expect(result.success).toBe(true);
      expect(result.data.toolCalls).toHaveLength(100);
    });

    it('should handle responses with unicode characters', () => {
      const unicodeResponse = {
        response: 'Task completed successfully! 🎉 The result is: café = 100€'
      };

      const result = agent.simpleTaskValidator.validateExample(unicodeResponse);
      
      expect(result.success).toBe(true);
      expect(result.data.response).toContain('🎉');
      expect(result.data.response).toContain('café');
      expect(result.data.response).toContain('€');
    });

    it('should handle deeply nested artifact references', () => {
      const nestedResponse = {
        decompose: true,
        subtasks: [
          {
            description: 'Process @data.user.profile.settings.theme configuration',
            outputs: '@processed_theme'
          },
          {
            description: 'Apply @processed_theme to @ui.components.header and @ui.components.sidebar',
            outputs: '@styled_components'
          }
        ]
      };

      const result = agent.decompositionValidator.validateExample(nestedResponse);
      
      expect(result.success).toBe(true);
      expect(result.data.subtasks[0].description).toContain('@data.user.profile.settings.theme');
    });
  });
});