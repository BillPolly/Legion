/**
 * Integration tests for AgentRegistry with MongoDB persistence
 * Tests the complete AgentRegistry -> AgentRepository -> MongoDB flow
 */

import { jest } from '@jest/globals';
import { AgentRegistry } from '../../src/AgentRegistry.js';
import { ResourceManager } from '@legion/resource-manager';

describe('AgentRegistry Integration with MongoDB', () => {
  let agentRegistry;
  let resourceManager;

  beforeAll(async () => {
    // Get the ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(async () => {
    // Create new AgentRegistry instance
    agentRegistry = new AgentRegistry(resourceManager);
    
    // Initialize with real MongoDB connection
    await agentRegistry.initialize();
    
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
    
    // Cleanup registry
    await agentRegistry.cleanup();
  });

  async function cleanupTestData() {
    if (agentRegistry.initialized && agentRegistry.repository.initialized) {
      // Delete test agents - broader pattern to catch all test data
      await agentRegistry.repository.collections.agents.deleteMany({
        $or: [
          { name: { $regex: /^Test.*Agent/i } },
          { agentId: { $regex: /^test-/i } }
        ]
      });
      
      // Delete test data from all collections
      await agentRegistry.repository.collections.versions.deleteMany({});
      await agentRegistry.repository.collections.deployments.deleteMany({});
      await agentRegistry.repository.collections.metrics.deleteMany({});
    }
  }

  describe('Agent Registration and Retrieval', () => {
    it('should register and retrieve an agent through the registry', async () => {
      const agentConfig = {
        agent: {
          id: 'test-integration-agent-001',
          name: 'Test Integration Agent',
          type: 'task',
          version: '1.0.0',
          description: 'Agent for testing registry integration',
          llm: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7
          },
          capabilities: [
            {
              name: 'file_operations',
              tools: ['file_read', 'file_write']
            }
          ],
          tags: ['test', 'integration']
        }
      };

      // Register agent
      const registerResult = await agentRegistry.registerAgent(agentConfig);
      
      expect(registerResult.success).toBe(true);
      expect(registerResult.agentId).toBe('test-integration-agent-001');
      expect(registerResult.version).toBe('1.0.0');
      expect(registerResult.id).toBeDefined(); // MongoDB ObjectId

      // Retrieve agent
      const retrievedAgent = await agentRegistry.getAgent('test-integration-agent-001');
      
      expect(retrievedAgent).toBeDefined();
      expect(retrievedAgent.agent.name).toBe('Test Integration Agent');
      expect(retrievedAgent.agent.type).toBe('task');
      expect(retrievedAgent.agent.llm.provider).toBe('openai');
      expect(retrievedAgent.agent.capabilities[0].tools).toEqual(['file_read', 'file_write']);
      expect(retrievedAgent.agent.tags).toEqual(['test', 'integration']);
    });

    it('should prevent duplicate agent registration without allowUpdate', async () => {
      const agentConfig = {
        agent: {
          id: 'test-duplicate-agent',
          name: 'Test Duplicate Agent',
          type: 'conversational',
          version: '1.0.0',
          llm: { provider: 'anthropic', model: 'claude-3' }
        }
      };

      // Register agent first time
      const firstResult = await agentRegistry.registerAgent(agentConfig);
      expect(firstResult.success).toBe(true);

      // Try to register again without allowUpdate
      const duplicateResult = await agentRegistry.registerAgent(agentConfig);
      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.error).toContain('already exists');
    });

    it('should allow agent updates with allowUpdate option', async () => {
      const initialConfig = {
        agent: {
          id: 'test-update-agent',
          name: 'Test Update Agent',
          type: 'task',
          version: '1.0.0',
          llm: { provider: 'openai', model: 'gpt-3.5' }
        }
      };

      // Register initial agent
      const initialResult = await agentRegistry.registerAgent(initialConfig);
      expect(initialResult.success).toBe(true);

      // Update the agent
      const updatedConfig = {
        agent: {
          id: 'test-update-agent',
          name: 'Test Update Agent',
          type: 'task', 
          version: '1.1.0',
          llm: { provider: 'openai', model: 'gpt-4' },
          description: 'Updated description'
        }
      };

      const updateResult = await agentRegistry.registerAgent(updatedConfig, { allowUpdate: true });
      expect(updateResult.success).toBe(true);
      expect(updateResult.version).toBe('1.1.0');

      // Verify update
      const retrievedAgent = await agentRegistry.getAgent('test-update-agent');
      expect(retrievedAgent.agent.version).toBe('1.1.0');
      expect(retrievedAgent.agent.llm.model).toBe('gpt-4');
      expect(retrievedAgent.agent.description).toBe('Updated description');
    });
  });

  describe('Agent Listing and Filtering', () => {
    beforeEach(async () => {
      // Create test agents with different attributes
      const testAgents = [
        {
          agent: {
            id: 'test-task-agent-1',
            name: 'Test Task Agent 1',
            type: 'task',
            version: '1.0.0',
            llm: { provider: 'openai', model: 'gpt-4' },
            tags: ['production', 'api']
          }
        },
        {
          agent: {
            id: 'test-chat-agent-1',
            name: 'Test Chat Agent 1',
            type: 'conversational',
            version: '1.0.0',
            llm: { provider: 'anthropic', model: 'claude-3' },
            tags: ['development', 'chat']
          }
        },
        {
          agent: {
            id: 'test-task-agent-2',
            name: 'Test Task Agent 2',
            type: 'task',
            version: '1.1.0',
            llm: { provider: 'openai', model: 'gpt-3.5' },
            tags: ['staging', 'api']
          }
        }
      ];

      for (const config of testAgents) {
        await agentRegistry.registerAgent(config);
      }
    });

    it('should list all agents without filters', async () => {
      const agents = await agentRegistry.listAgents();
      
      expect(agents.length).toBe(3);
      expect(agents.map(a => a.agent.name)).toEqual(
        expect.arrayContaining([
          'Test Task Agent 1',
          'Test Chat Agent 1', 
          'Test Task Agent 2'
        ])
      );
    });

    it('should filter agents by type', async () => {
      const taskAgents = await agentRegistry.listAgents({ type: 'task' });
      
      expect(taskAgents.length).toBe(2);
      expect(taskAgents.every(a => a.agent.type === 'task')).toBe(true);
    });

    it('should filter agents by provider', async () => {
      const openaiAgents = await agentRegistry.listAgents({ provider: 'openai' });
      
      expect(openaiAgents.length).toBe(2);
      expect(openaiAgents.every(a => a.agent.llm.provider === 'openai')).toBe(true);
    });

    it('should filter agents by tags', async () => {
      const apiAgents = await agentRegistry.listAgents({ tags: ['api'] });
      
      expect(apiAgents.length).toBe(2);
      expect(apiAgents.every(a => a.agent.tags.includes('api'))).toBe(true);
    });

    it('should search agents by name', async () => {
      const searchResults = await agentRegistry.searchAgents('Chat');
      
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].agent.name).toContain('Chat');
    });
  });

  describe('Agent Metadata Operations', () => {
    it('should get agent metadata without full configuration', async () => {
      const agentConfig = {
        agent: {
          id: 'test-metadata-agent',
          name: 'Test Metadata Agent',
          type: 'analytical',
          version: '2.1.0',
          description: 'Agent for metadata testing',
          llm: { provider: 'anthropic', model: 'claude-3-opus' },
          capabilities: [
            { name: 'analysis', tools: ['analyze_data', 'generate_report'] },
            { name: 'visualization', tools: ['create_chart'] }
          ],
          tags: ['analytics', 'reporting']
        }
      };

      await agentRegistry.registerAgent(agentConfig);

      const metadata = await agentRegistry.getAgentMetadata('test-metadata-agent');
      
      expect(metadata).toBeDefined();
      expect(metadata.id).toBe('test-metadata-agent');
      expect(metadata.name).toBe('Test Metadata Agent');
      expect(metadata.type).toBe('analytical');
      expect(metadata.version).toBe('2.1.0');
      expect(metadata.description).toBe('Agent for metadata testing');
      expect(metadata.tags).toEqual(['analytics', 'reporting']);
      expect(metadata.provider).toBe('anthropic');
      expect(metadata.model).toBe('claude-3-opus');
      expect(metadata.capabilityCount).toBe(2);
      expect(metadata.toolCount).toBe(3); // 2 + 1 tools
      expect(metadata.registeredAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
    });
  });

  describe('Agent Deletion', () => {
    it('should delete agent and all related data', async () => {
      const agentConfig = {
        agent: {
          id: 'test-delete-agent',
          name: 'Test Delete Agent',
          type: 'task',
          version: '1.0.0',
          llm: { provider: 'openai', model: 'gpt-4' }
        }
      };

      // Register agent
      const registerResult = await agentRegistry.registerAgent(agentConfig);
      expect(registerResult.success).toBe(true);

      // Verify agent exists
      let agent = await agentRegistry.getAgent('test-delete-agent');
      expect(agent).toBeDefined();

      // Delete agent
      const deleteResult = await agentRegistry.deleteAgent('test-delete-agent');
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.agentId).toBe('test-delete-agent');

      // Verify agent is gone
      agent = await agentRegistry.getAgent('test-delete-agent');
      expect(agent).toBeNull();
    });
  });

  describe('Import/Export Operations', () => {
    it('should export and import agents', async () => {
      // Register test agents
      const testAgents = [
        {
          agent: {
            id: 'test-export-agent-1',
            name: 'Test Export Agent 1',
            type: 'task',
            version: '1.0.0',
            llm: { provider: 'openai', model: 'gpt-4' }
          }
        },
        {
          agent: {
            id: 'test-export-agent-2', 
            name: 'Test Export Agent 2',
            type: 'conversational',
            version: '1.0.0',
            llm: { provider: 'anthropic', model: 'claude-3' }
          }
        }
      ];

      for (const config of testAgents) {
        await agentRegistry.registerAgent(config);
      }

      // Export agents
      const exportData = await agentRegistry.exportAgents();
      
      expect(exportData.version).toBe('1.0.0');
      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.agents).toHaveLength(2);
      expect(exportData.agents.map(a => a.agent.id)).toEqual(
        expect.arrayContaining(['test-export-agent-1', 'test-export-agent-2'])
      );

      // Clear registry
      await agentRegistry.deleteAgent('test-export-agent-1');
      await agentRegistry.deleteAgent('test-export-agent-2');

      // Import agents back
      const importResult = await agentRegistry.importAgents(exportData);
      
      expect(importResult.success).toBe(true);
      expect(importResult.imported).toBe(2);
      expect(importResult.skipped).toBe(0);
      expect(importResult.errors).toHaveLength(0);

      // Verify agents are back
      const agent1 = await agentRegistry.getAgent('test-export-agent-1');
      const agent2 = await agentRegistry.getAgent('test-export-agent-2');
      
      expect(agent1).toBeDefined();
      expect(agent2).toBeDefined();
      expect(agent1.agent.name).toBe('Test Export Agent 1');
      expect(agent2.agent.name).toBe('Test Export Agent 2');
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      // Create test agents for statistics
      const testAgents = [
        {
          agent: {
            id: 'test-stats-agent-1',
            name: 'Test Stats Agent 1',
            type: 'task',
            version: '1.0.0',
            llm: { provider: 'openai', model: 'gpt-4' }
          }
        },
        {
          agent: {
            id: 'test-stats-agent-2',
            name: 'Test Stats Agent 2', 
            type: 'task',
            version: '1.0.0',
            llm: { provider: 'openai', model: 'gpt-4' }
          }
        },
        {
          agent: {
            id: 'test-stats-agent-3',
            name: 'Test Stats Agent 3',
            type: 'conversational',
            version: '2.0.0',
            llm: { provider: 'anthropic', model: 'claude-3' }
          }
        }
      ];

      for (const config of testAgents) {
        await agentRegistry.registerAgent(config);
      }
    });

    it('should generate comprehensive statistics', async () => {
      const stats = await agentRegistry.getStatistics();
      
      expect(stats.totalAgents).toBe(3);
      expect(stats.byType.task).toBe(2);
      expect(stats.byType.conversational).toBe(1);
      expect(stats.byProvider.openai).toBe(2);
      expect(stats.byProvider.anthropic).toBe(1);
      expect(stats.byVersion['1.0.0']).toBe(2);
      expect(stats.byVersion['2.0.0']).toBe(1);
      expect(stats.byStatus.registered).toBe(3); // All agents start as 'registered'
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidConfig = {
        agent: {
          // Missing required fields
          name: 'Invalid Agent'
        }
      };

      const result = await agentRegistry.registerAgent(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should handle repository errors gracefully', async () => {
      // Create registry but don't initialize repository
      const uninitializedRegistry = new AgentRegistry(resourceManager);
      // Don't call initialize()

      const agentConfig = {
        agent: {
          id: 'test-uninitialized-agent',
          name: 'Test Uninitialized Agent',
          type: 'task',
          version: '1.0.0',
          llm: { provider: 'openai', model: 'gpt-4' }
        }
      };

      // Should auto-initialize and work
      const result = await uninitializedRegistry.registerAgent(agentConfig);
      expect(result.success).toBe(true);

      // Cleanup
      await uninitializedRegistry.cleanup();
    });
  });
});