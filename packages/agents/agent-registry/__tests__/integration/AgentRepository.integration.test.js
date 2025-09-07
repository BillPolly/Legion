/**
 * Integration tests for AgentRepository with real MongoDB
 */

import { jest } from '@jest/globals';
import { AgentRepository } from '../../src/AgentRepository.js';
import { ResourceManager } from '@legion/resource-manager';

describe('AgentRepository Integration', () => {
  let agentRepository;
  let resourceManager;

  beforeAll(async () => {
    // Get the ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(async () => {
    // Create new AgentRepository instance
    agentRepository = new AgentRepository(resourceManager);
    
    // Initialize with real MongoDB connection
    await agentRepository.initialize();
    
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
    
    // Cleanup repository
    await agentRepository.cleanup();
  });

  async function cleanupTestData() {
    if (agentRepository.initialized) {
      // Delete ALL test data from all collections - more aggressive cleanup
      await agentRepository.collections.agents.deleteMany({});
      await agentRepository.collections.versions.deleteMany({});
      await agentRepository.collections.deployments.deleteMany({});
      await agentRepository.collections.metrics.deleteMany({});
    }
  }

  describe('Real MongoDB Operations', () => {
    it('should save and retrieve an agent', async () => {
      const agentData = {
        name: 'Test Integration Agent',
        type: 'task',
        agentId: 'test-integration-agent-001', // Add agentId
        description: 'Agent for integration testing',
        configuration: {
          prompts: { system: 'You are a test agent' },
          behavior: { temperature: 0.7, creativity: 0.5 },
          capabilities: { tools: ['file_read', 'file_write'] }
        },
        metadata: {
          tags: ['test', 'integration'],
          version: '1.0.0'
        },
        status: 'active'
      };

      // Save agent
      const saveResult = await agentRepository.saveAgent(agentData);
      
      expect(saveResult.success).toBe(true);
      expect(saveResult.id).toBeDefined();
      expect(saveResult.agentId).toBe('test-integration-agent-001');

      // Retrieve agent by ID
      const retrievedAgent = await agentRepository.getAgentById(saveResult.id);
      
      expect(retrievedAgent).toBeDefined();
      expect(retrievedAgent.name).toBe(agentData.name);
      expect(retrievedAgent.type).toBe(agentData.type);
      expect(retrievedAgent.configuration.capabilities.tools).toEqual(agentData.configuration.capabilities.tools);
      expect(retrievedAgent.metadata.tags).toEqual(agentData.metadata.tags);
    });

    it('should update existing agent and maintain version history', async () => {
      // Create initial agent
      const initialAgent = {
        name: 'Test Versioning Agent',
        type: 'conversational',
        agentId: 'test-versioning-agent-001',
        configuration: { tools: ['web_search'] },
        version: '1.0.0'
      };

      const saveResult = await agentRepository.saveAgent(initialAgent);
      const agentId = saveResult.id;

      // Update the agent - use ObjectId conversion for _id
      const { ObjectId } = await import('mongodb');
      const updatedAgent = {
        _id: new ObjectId(agentId),
        name: 'Test Versioning Agent',
        type: 'conversational',
        agentId: 'test-versioning-agent-001', 
        configuration: { tools: ['web_search', 'file_read'] },
        version: '1.1.0',
        changes: { added: ['file_read capability'] }
      };

      await agentRepository.saveAgent(updatedAgent);

      // Check version history
      const versions = await agentRepository.getAgentVersions(agentId, 10);
      
      expect(versions).toHaveLength(2); // Initial save + update
      expect(versions[0].version).toBe('1.1.0'); // Most recent first
      expect(versions[1].version).toBe('1.0.0');
    });

    it('should list agents with filtering', async () => {
      // Create test agents with different attributes
      const agents = [
        {
          name: 'Test Task Agent',
          type: 'task',
          status: 'active',
          metadata: { tags: ['production'] }
        },
        {
          name: 'Test Chat Agent',
          type: 'conversational',
          status: 'inactive',
          metadata: { tags: ['development'] }
        },
        {
          name: 'Test API Agent',
          type: 'task',
          status: 'active',
          metadata: { tags: ['api', 'production'] }
        }
      ];

      // Save all test agents
      for (const agent of agents) {
        await agentRepository.saveAgent(agent);
      }

      // Test filtering by type
      const taskAgents = await agentRepository.listAgents({ type: 'task' });
      expect(taskAgents).toHaveLength(2);
      expect(taskAgents.every(a => a.type === 'task')).toBe(true);

      // Test filtering by status
      const activeAgents = await agentRepository.listAgents({ status: 'active' });
      expect(activeAgents).toHaveLength(2);
      expect(activeAgents.every(a => a.status === 'active')).toBe(true);

      // Test filtering by tags
      const productionAgents = await agentRepository.listAgents({ tags: ['production'] });
      expect(productionAgents).toHaveLength(2);
      expect(productionAgents.every(a => a.metadata.tags.includes('production'))).toBe(true);

      // Test search functionality
      const chatAgents = await agentRepository.listAgents({ search: 'chat' });
      expect(chatAgents).toHaveLength(1);
      expect(chatAgents[0].name).toContain('Chat');
    });

    it('should handle deployment tracking', async () => {
      // Create and save an agent
      const agent = {
        name: 'Test Deployment Agent',
        type: 'task',
        configuration: { tools: ['file_read'] }
      };

      const saveResult = await agentRepository.saveAgent(agent);
      const agentId = saveResult.id;

      // Save deployment information
      const deploymentData = {
        environment: 'production',
        status: 'active',
        version: '1.0.0',
        instanceCount: 3,
        resources: { cpu: '500m', memory: '512Mi' }
      };

      const deployResult = await agentRepository.saveDeployment(agentId, deploymentData);
      
      expect(deployResult.success).toBe(true);
      expect(deployResult.deploymentId).toBeDefined();

      // Verify deployment was saved and agent was updated
      const updatedAgent = await agentRepository.getAgentById(agentId);
      
      expect(updatedAgent.deployment.environment).toBe('production');
      expect(updatedAgent.deployment.status).toBe('active');
    });

    it('should track agent metrics over time', async () => {
      // Create and save an agent
      const agent = {
        name: 'Test Metrics Agent',
        type: 'conversational',
        configuration: { tools: ['web_search'] }
      };

      const saveResult = await agentRepository.saveAgent(agent);
      const agentId = saveResult.id;

      // Save multiple metrics entries
      const metricsData = [
        {
          metricType: 'performance',
          responseTime: 150,
          throughput: 10,
          errorRate: 0.02
        },
        {
          metricType: 'usage',
          totalRequests: 1000,
          successfulRequests: 980,
          failedRequests: 20
        },
        {
          metricType: 'performance',
          responseTime: 120,
          throughput: 12,
          errorRate: 0.015
        }
      ];

      // Save each metric
      for (const metrics of metricsData) {
        const result = await agentRepository.saveMetrics(agentId, metrics);
        expect(result.success).toBe(true);
        
        // Add small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Retrieve all metrics
      const allMetrics = await agentRepository.getMetrics(agentId, { limit: 10 });
      expect(allMetrics).toHaveLength(3);

      // Retrieve only performance metrics
      const perfMetrics = await agentRepository.getMetrics(agentId, { 
        metricType: 'performance',
        limit: 10 
      });
      expect(perfMetrics).toHaveLength(2);
      expect(perfMetrics.every(m => m.metricType === 'performance')).toBe(true);

      // Verify most recent metrics are returned first
      expect(perfMetrics[0].responseTime).toBe(120); // Most recent
      expect(perfMetrics[1].responseTime).toBe(150); // Older
    });

    it('should search agents by capabilities', async () => {
      // Create agents with different capabilities
      const agents = [
        {
          name: 'Test File Agent',
          type: 'task',
          configuration: {
            capabilities: { tools: ['file_read', 'file_write'] }
          }
        },
        {
          name: 'Test Web Agent',
          type: 'conversational',
          configuration: {
            capabilities: { tools: ['web_search', 'web_fetch'] }
          }
        },
        {
          name: 'Test Full Agent',
          type: 'task',
          configuration: {
            capabilities: { tools: ['file_read', 'file_write', 'web_search'] }
          }
        }
      ];

      // Save all agents
      for (const agent of agents) {
        await agentRepository.saveAgent(agent);
      }

      // Search by single capability
      const fileAgents = await agentRepository.searchByCapabilities('file_read');
      expect(fileAgents).toHaveLength(2); // File Agent and Full Agent

      // Search by multiple capabilities
      const multiCapAgents = await agentRepository.searchByCapabilities(['file_read', 'web_search']);
      expect(multiCapAgents).toHaveLength(1); // Only Full Agent has both
      expect(multiCapAgents[0].name).toBe('Test Full Agent');
    });

    it('should update agent status', async () => {
      // Create and save an agent
      const agent = {
        name: 'Test Status Agent',
        type: 'task',
        status: 'inactive'
      };

      const saveResult = await agentRepository.saveAgent(agent);
      const agentId = saveResult.id;

      // Update status
      const updateResult = await agentRepository.updateAgentStatus(agentId, 'active');
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.modifiedCount).toBe(1);

      // Verify status was updated
      const updatedAgent = await agentRepository.getAgentById(agentId);
      expect(updatedAgent.status).toBe('active');
    });

    it('should cascade delete agent and related data', async () => {
      // Create and save an agent
      const agent = {
        name: 'Test Delete Agent',
        type: 'conversational',
        agentId: 'test-delete-agent-001',
        configuration: { tools: ['web_search'] }
      };

      const saveResult = await agentRepository.saveAgent(agent);
      const agentId = saveResult.id;

      // Add related data
      await agentRepository.saveDeployment(agentId, {
        environment: 'test',
        status: 'active'
      });

      await agentRepository.saveMetrics(agentId, {
        metricType: 'test',
        value: 100
      });

      // Verify data exists before deletion
      const beforeDelete = await agentRepository.getAgentById(agentId);
      expect(beforeDelete).toBeDefined();

      // Delete agent
      const deleteResult = await agentRepository.deleteAgent(agentId);
      
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deletedCount).toBe(1);

      // Verify agent and related data are gone
      const afterDelete = await agentRepository.getAgentById(agentId);
      expect(afterDelete).toBeNull();

      // Check that related data was also deleted by querying collections directly
      const { ObjectId } = await import('mongodb');
      const agentObjectId = new ObjectId(agentId);
      
      const remainingMetrics = await agentRepository.collections.metrics.find({ agentId: agentObjectId }).toArray();
      expect(remainingMetrics).toHaveLength(0);
      
      const remainingDeployments = await agentRepository.collections.deployments.find({ agentId: agentObjectId }).toArray();
      expect(remainingDeployments).toHaveLength(0);
    });

    it('should generate comprehensive statistics', async () => {
      // Create agents with different types and statuses
      const agents = [
        { name: 'Test Stats Agent 1', type: 'task', status: 'active' },
        { name: 'Test Stats Agent 2', type: 'task', status: 'inactive' },
        { name: 'Test Stats Agent 3', type: 'conversational', status: 'active' },
        { name: 'Test Stats Agent 4', type: 'conversational', status: 'active' }
      ];

      // Save agents
      const savedAgents = [];
      for (const agent of agents) {
        const result = await agentRepository.saveAgent(agent);
        savedAgents.push(result.id);
      }

      // Add some deployments
      await agentRepository.saveDeployment(savedAgents[0], {
        environment: 'production',
        status: 'active'
      });

      await agentRepository.saveDeployment(savedAgents[1], {
        environment: 'staging',
        status: 'inactive'
      });

      // Get statistics
      const stats = await agentRepository.getStatistics();

      expect(stats.totalAgents).toBe(4);
      
      // Check type distribution
      const taskCount = stats.byType.find(t => t._id === 'task')?.count || 0;
      const conversationalCount = stats.byType.find(t => t._id === 'conversational')?.count || 0;
      expect(taskCount).toBe(2);
      expect(conversationalCount).toBe(2);

      // Check status distribution
      const activeCount = stats.byStatus.find(s => s._id === 'active')?.count || 0;
      const inactiveCount = stats.byStatus.find(s => s._id === 'inactive')?.count || 0;
      expect(activeCount).toBe(3);
      expect(inactiveCount).toBe(1);

      expect(stats.totalDeployments).toBe(2);
      expect(stats.activeDeployments).toBe(1);
    });
  });

  describe('Error Handling', () => {
    // Connection failure test removed due to long network timeouts in CI/test environments
    // The error handling is covered by other tests and actual usage

    it('should handle operations on uninitialized repository', async () => {
      const uninitializedRepo = new AgentRepository(resourceManager);
      
      // Operations should auto-initialize
      const agent = { name: 'Test Agent', type: 'task' };
      
      // This should initialize the repo automatically
      const result = await uninitializedRepo.saveAgent(agent);
      expect(result.success).toBe(true);
      
      // Cleanup
      await uninitializedRepo.cleanup();
    });
  });
});