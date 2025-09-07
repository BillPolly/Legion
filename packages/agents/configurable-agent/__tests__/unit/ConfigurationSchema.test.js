/**
 * Unit tests for ConfigurationSchema
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { AgentConfigSchema, validateAgentConfig } from '../../src/ConfigurationSchema.js';

describe('ConfigurationSchema', () => {
  describe('validateAgentConfig', () => {
    it('should validate a minimal valid configuration', () => {
      const config = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate a configuration with all optional fields', () => {
      const config = {
        agent: {
          id: 'full-agent',
          name: 'Full Agent',
          type: 'task',
          version: '1.0.0',
          llm: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000,
            systemPrompt: 'You are a helpful assistant',
            retryStrategy: {
              maxRetries: 5,
              backoffMs: 2000
            }
          },
          capabilities: [
            {
              module: 'file',
              tools: ['file_read', 'file_write'],
              permissions: {
                basePath: '/workspace',
                maxFileSize: 1048576,
                allowedExtensions: ['.txt', '.json']
              }
            }
          ],
          behaviorTree: {
            type: 'sequence',
            children: []
          },
          knowledge: {
            enabled: true,
            persistence: 'session',
            storage: 'memory',
            schemas: [],
            relationships: []
          },
          prompts: {
            templates: {
              greeting: 'Hello {{userName}}'
            },
            responseFormats: {
              default: {
                type: 'markdown',
                includeMetadata: false
              }
            }
          },
          state: {
            conversationHistory: {
              maxMessages: 100,
              pruningStrategy: 'sliding-window'
            },
            contextVariables: {
              userName: {
                type: 'string',
                persistent: true
              }
            }
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject configuration missing required fields', () => {
      const config = {
        agent: {
          name: 'Test Agent'
          // Missing id, type, version, llm
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('id'))).toBe(true);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
      expect(result.errors.some(e => e.includes('llm'))).toBe(true);
    });

    it('should reject configuration with invalid agent type', () => {
      const config = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          type: 'invalid-type',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('should reject configuration with invalid LLM provider', () => {
      const config = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'invalid-provider',
            model: 'some-model'
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('provider'))).toBe(true);
    });

    it('should reject configuration with invalid temperature', () => {
      const config = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            temperature: 1.5 // Invalid: > 1.0
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('temperature'))).toBe(true);
    });

    it('should validate behavior tree configuration', () => {
      const config = {
        agent: {
          id: 'bt-agent',
          name: 'BT Agent',
          type: 'task',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          },
          behaviorTree: {
            type: 'selector',
            children: [
              {
                type: 'action',
                id: 'action1',
                tool: 'llm_classify',
                params: {
                  categories: ['question', 'command']
                }
              },
              {
                type: 'sequence',
                children: [
                  {
                    type: 'action',
                    id: 'action2',
                    tool: 'tool_executor'
                  }
                ]
              }
            ]
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should validate knowledge graph configuration', () => {
      const config = {
        agent: {
          id: 'kg-agent',
          name: 'KG Agent',
          type: 'analytical',
          version: '1.0.0',
          llm: {
            provider: 'openai',
            model: 'gpt-4'
          },
          knowledge: {
            enabled: true,
            persistence: 'persistent',
            storage: 'mongodb',
            schemas: [
              {
                name: 'Task',
                properties: {
                  id: 'string',
                  title: 'string',
                  completed: 'boolean'
                }
              }
            ],
            relationships: [
              {
                type: 'DEPENDS_ON',
                from: 'Task',
                to: 'Task'
              }
            ]
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid knowledge storage type', () => {
      const config = {
        agent: {
          id: 'kg-agent',
          name: 'KG Agent',
          type: 'analytical',
          version: '1.0.0',
          llm: {
            provider: 'openai',
            model: 'gpt-4'
          },
          knowledge: {
            enabled: true,
            persistence: 'persistent',
            storage: 'invalid-storage'
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('storage'))).toBe(true);
    });

    it('should validate capability permissions', () => {
      const config = {
        agent: {
          id: 'cap-agent',
          name: 'Capability Agent',
          type: 'task',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          },
          capabilities: [
            {
              module: 'file',
              tools: ['*'],
              permissions: {
                basePath: '/workspace',
                maxFileSize: 10485760,
                allowedExtensions: ['.txt', '.md', '.json']
              }
            },
            {
              module: 'calculator',
              tools: ['calculator', 'add', 'subtract'],
              permissions: {}
            }
          ]
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should validate state configuration', () => {
      const config = {
        agent: {
          id: 'state-agent',
          name: 'State Agent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          },
          state: {
            conversationHistory: {
              maxMessages: 50,
              pruningStrategy: 'importance-based'
            },
            contextVariables: {
              userName: {
                type: 'string',
                persistent: true,
                extractionPattern: 'my name is ([\\w]+)'
              },
              currentTask: {
                type: 'object',
                persistent: false
              },
              taskCount: {
                type: 'number',
                persistent: true
              }
            }
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid pruning strategy', () => {
      const config = {
        agent: {
          id: 'state-agent',
          name: 'State Agent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          },
          state: {
            conversationHistory: {
              maxMessages: 50,
              pruningStrategy: 'invalid-strategy'
            }
          }
        }
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('pruningStrategy'))).toBe(true);
    });
  });

  describe('AgentConfigSchema', () => {
    it('should export a valid schema object', () => {
      expect(AgentConfigSchema).toBeDefined();
      expect(AgentConfigSchema.type).toBe('object');
      expect(AgentConfigSchema.properties).toBeDefined();
      expect(AgentConfigSchema.properties.agent).toBeDefined();
      expect(AgentConfigSchema.required).toContain('agent');
    });
  });
});