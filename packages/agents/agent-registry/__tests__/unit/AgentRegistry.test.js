/**
 * Unit tests for AgentRegistry
 * Following TDD methodology
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AgentRegistry } from '../../src/AgentRegistry.js';
import { ResourceManager } from '@legion/resource-manager';

describe('AgentRegistry', () => {
  let registry;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    registry = new AgentRegistry(resourceManager);
    await registry.initialize();
    
    // Clean up any existing test data to prevent contamination
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
    await registry.cleanup();
  });

  async function cleanupTestData() {
    if (registry && registry.repository && registry.repository.initialized) {
      // Delete ALL test data from all collections - more aggressive cleanup
      await registry.repository.collections.agents.deleteMany({});
      await registry.repository.collections.versions.deleteMany({});
      await registry.repository.collections.deployments.deleteMany({});
      await registry.repository.collections.metrics.deleteMany({});
    }
  }

  describe('Initialization', () => {
    it('should initialize with ResourceManager', async () => {
      expect(registry).toBeDefined();
      expect(registry.initialized).toBe(true);
    });

    it('should fail without ResourceManager', () => {
      expect(() => new AgentRegistry()).toThrow('ResourceManager is required');
    });
  });

  describe('Agent Registration', () => {
    it('should register a new agent configuration', async () => {
      const agentConfig = {
        agent: {
          id: 'test-agent-001',
          name: 'TestAgent',
          type: 'conversational',
          version: '1.0.0',
          description: 'A test agent for unit testing',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
            maxTokens: 4096
          },
          capabilities: [
            {
              module: 'calculator',
              tools: ['add', 'subtract']
            }
          ]
        }
      };

      const result = await registry.registerAgent(agentConfig);
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('test-agent-001');
    });

    it('should reject invalid agent configuration', async () => {
      const invalidConfig = {
        agent: {
          // Missing required fields
          name: 'InvalidAgent'
        }
      };

      const result = await registry.registerAgent(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should handle duplicate agent IDs', async () => {
      const agentConfig = {
        agent: {
          id: 'duplicate-001',
          name: 'FirstAgent',
          type: 'task',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      await registry.registerAgent(agentConfig);
      
      // Try to register with same ID
      agentConfig.agent.name = 'SecondAgent';
      const result = await registry.registerAgent(agentConfig);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should allow updating existing agent with new version', async () => {
      const agentConfig = {
        agent: {
          id: 'versioned-agent',
          name: 'VersionedAgent',
          type: 'analytical',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      await registry.registerAgent(agentConfig);
      
      // Update with new version
      agentConfig.agent.version = '1.1.0';
      agentConfig.agent.description = 'Updated description';
      
      const result = await registry.registerAgent(agentConfig, { allowUpdate: true });
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.1.0');
    });
  });

  describe('Agent Retrieval', () => {
    beforeEach(async () => {
      // Register some test agents
      const agents = [
        {
          agent: {
            id: 'retrieval-001',
            name: 'ChatAgent',
            type: 'conversational',
            version: '1.0.0',
            tags: ['chat', 'general'],
            llm: {
              provider: 'anthropic',
              model: 'claude-3-5-sonnet-20241022'
            }
          }
        },
        {
          agent: {
            id: 'retrieval-002',
            name: 'TaskAgent',
            type: 'task',
            version: '1.0.0',
            tags: ['task', 'automation'],
            llm: {
              provider: 'openai',
              model: 'gpt-4'
            }
          }
        },
        {
          agent: {
            id: 'retrieval-003',
            name: 'AnalysisAgent',
            type: 'analytical',
            version: '1.0.0',
            tags: ['analysis', 'data'],
            llm: {
              provider: 'anthropic',
              model: 'claude-3-5-sonnet-20241022'
            }
          }
        }
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }
    });

    it('should retrieve agent by ID', async () => {
      const agent = await registry.getAgent('retrieval-001');
      expect(agent).toBeDefined();
      expect(agent.agent.name).toBe('ChatAgent');
      expect(agent.agent.type).toBe('conversational');
    });

    it('should return null for non-existent agent', async () => {
      const agent = await registry.getAgent('non-existent');
      expect(agent).toBeNull();
    });

    it('should list all agents', async () => {
      const agents = await registry.listAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.agent.id)).toContain('retrieval-001');
      expect(agents.map(a => a.agent.id)).toContain('retrieval-002');
      expect(agents.map(a => a.agent.id)).toContain('retrieval-003');
    });

    it('should filter agents by type', async () => {
      const agents = await registry.listAgents({ type: 'conversational' });
      expect(agents).toHaveLength(1);
      expect(agents[0].agent.name).toBe('ChatAgent');
    });

    it('should filter agents by tags', async () => {
      const agents = await registry.listAgents({ tags: ['task'] });
      expect(agents).toHaveLength(1);
      expect(agents[0].agent.name).toBe('TaskAgent');
    });

    it('should filter agents by LLM provider', async () => {
      const agents = await registry.listAgents({ provider: 'anthropic' });
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.agent.name)).toContain('ChatAgent');
      expect(agents.map(a => a.agent.name)).toContain('AnalysisAgent');
    });

    it('should search agents by name', async () => {
      const agents = await registry.searchAgents('Chat');
      expect(agents).toHaveLength(1);
      expect(agents[0].agent.name).toBe('ChatAgent');
    });
  });

  describe('Agent Deletion', () => {
    it('should delete an agent', async () => {
      const agentConfig = {
        agent: {
          id: 'delete-test',
          name: 'DeleteAgent',
          type: 'task',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      await registry.registerAgent(agentConfig);
      
      const result = await registry.deleteAgent('delete-test');
      expect(result.success).toBe(true);
      
      const agent = await registry.getAgent('delete-test');
      expect(agent).toBeNull();
    });

    it('should handle deletion of non-existent agent', async () => {
      const result = await registry.deleteAgent('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Agent Metadata', () => {
    it('should get agent metadata without full configuration', async () => {
      const agentConfig = {
        agent: {
          id: 'metadata-test',
          name: 'MetadataAgent',
          type: 'analytical',
          version: '1.0.0',
          description: 'Agent for metadata testing',
          tags: ['test', 'metadata'],
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          },
          capabilities: [
            {
              module: 'file',
              tools: ['read', 'write']
            },
            {
              module: 'calculator',
              tools: ['add', 'subtract', 'multiply', 'divide']
            }
          ]
        }
      };

      await registry.registerAgent(agentConfig);
      
      const metadata = await registry.getAgentMetadata('metadata-test');
      expect(metadata).toBeDefined();
      expect(metadata.id).toBe('metadata-test');
      expect(metadata.name).toBe('MetadataAgent');
      expect(metadata.type).toBe('analytical');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.tags).toContain('test');
      expect(metadata.tags).toContain('metadata');
      expect(metadata.capabilityCount).toBe(2);
      expect(metadata.toolCount).toBe(6);
    });
  });

  describe('Agent Export/Import', () => {
    it('should export agents to JSON', async () => {
      const agentConfig = {
        agent: {
          id: 'export-test',
          name: 'ExportAgent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      await registry.registerAgent(agentConfig);
      
      const exported = await registry.exportAgents(['export-test']);
      expect(exported).toBeDefined();
      expect(exported.agents).toHaveLength(1);
      expect(exported.agents[0].agent.id).toBe('export-test');
      expect(exported.version).toBe('1.0.0');
      expect(exported.exportedAt).toBeDefined();
    });

    it('should import agents from JSON', async () => {
      const importData = {
        version: '1.0.0',
        agents: [
          {
            agent: {
              id: 'import-test',
              name: 'ImportAgent',
              type: 'task',
              version: '1.0.0',
              llm: {
                provider: 'openai',
                model: 'gpt-4'
              }
            }
          }
        ]
      };

      const result = await registry.importAgents(importData);
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      
      const agent = await registry.getAgent('import-test');
      expect(agent).toBeDefined();
      expect(agent.agent.name).toBe('ImportAgent');
    });

    it('should handle import conflicts', async () => {
      const existingConfig = {
        agent: {
          id: 'conflict-test',
          name: 'ExistingAgent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      await registry.registerAgent(existingConfig);
      
      const importData = {
        version: '1.0.0',
        agents: [
          {
            agent: {
              id: 'conflict-test',
              name: 'ImportedAgent',
              type: 'task',
              version: '1.0.0',
              llm: {
                provider: 'openai',
                model: 'gpt-4'
              }
            }
          }
        ]
      };

      const result = await registry.importAgents(importData, { overwrite: false });
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(1);
      
      // Original should remain
      const agent = await registry.getAgent('conflict-test');
      expect(agent.agent.name).toBe('ExistingAgent');
    });
  });

  describe('Agent Statistics', () => {
    it('should provide registry statistics', async () => {
      const agents = [
        {
          agent: {
            id: 'stats-001',
            name: 'Agent1',
            type: 'conversational',
            version: '1.0.0',
            llm: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }
          }
        },
        {
          agent: {
            id: 'stats-002',
            name: 'Agent2',
            type: 'task',
            version: '1.0.0',
            llm: { provider: 'openai', model: 'gpt-4' }
          }
        },
        {
          agent: {
            id: 'stats-003',
            name: 'Agent3',
            type: 'task',
            version: '1.0.0',
            llm: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' }
          }
        }
      ];

      for (const agent of agents) {
        await registry.registerAgent(agent);
      }

      const stats = await registry.getStatistics();
      expect(stats.totalAgents).toBe(3);
      expect(stats.byType.conversational).toBe(1);
      expect(stats.byType.task).toBe(2);
      expect(stats.byProvider.anthropic).toBe(2);
      expect(stats.byProvider.openai).toBe(1);
    });
  });
});