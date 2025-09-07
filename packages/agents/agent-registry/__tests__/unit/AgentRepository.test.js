/**
 * Memory-safe unit tests for AgentRepository
 * Based on debugging results - avoids memory accumulation issues
 */

import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';

import { AgentRepository } from '../../src/AgentRepository.js';
import { ResourceManager } from '@legion/resource-manager';

describe('AgentRepository', () => {
  let agentRepository;
  let mockResourceManager;
  
  beforeAll(async () => {
    mockResourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    // Create fresh, simple mocks for each test - this prevents accumulation
    const mockCollection = {
      createIndex: jest.fn().mockResolvedValue(),
      replaceOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([])
      }),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      })
    };

    const mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    const mockClient = {
      connect: jest.fn().mockResolvedValue(),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue()
    };

    // Create fresh AgentRepository for each test
    agentRepository = new AgentRepository(mockResourceManager);
    
    // Override internals with fresh mocks
    agentRepository.client = mockClient;
    agentRepository.db = mockDb;
    agentRepository.collections = {
      agents: mockCollection,
      versions: mockCollection,
      deployments: mockCollection,
      metrics: mockCollection
    };
    
    // CRITICAL: Prevent _ensureInitialized from causing issues
    agentRepository.initialized = true;
  });

  afterEach(() => {
    // Clean up to prevent memory accumulation
    agentRepository = null;
  });

  describe('Constructor and Initialization', () => {
    it('should create AgentRepository with ResourceManager', () => {
      expect(agentRepository.resourceManager).toBe(mockResourceManager);
      expect(agentRepository.connectionString).toContain('mongodb://');
      expect(agentRepository.databaseName).toBeDefined();
    });

    it('should throw error without ResourceManager', () => {
      expect(() => {
        new AgentRepository();
      }).toThrow('ResourceManager is required');
    });

    it('should verify initialization properties', () => {
      expect(agentRepository.initialized).toBe(true);
      expect(agentRepository.collections).toBeDefined();
      expect(agentRepository.client).toBeDefined();
      expect(agentRepository.db).toBeDefined();
    });
  });

  describe('Agent CRUD Operations', () => {
    it('should save new agent successfully', async () => {
      const agentData = {
        name: 'Test Agent',
        type: 'task',
        configuration: { tools: ['file_read'] }
      };

      agentRepository.collections.agents.replaceOne.mockResolvedValueOnce({
        modifiedCount: 0,
        upsertedCount: 1
      });

      const result = await agentRepository.saveAgent(agentData);
      
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should retrieve agent by ID', async () => {
      const mockAgent = { _id: 'test-id', name: 'Test Agent' };
      agentRepository.collections.agents.findOne.mockResolvedValueOnce(mockAgent);

      const result = await agentRepository.getAgentById('test-id');
      
      expect(result).toEqual(mockAgent);
    });

    it('should retrieve agent by name', async () => {
      const mockAgent = { name: 'Test Agent', type: 'task' };
      agentRepository.collections.agents.findOne.mockResolvedValueOnce(mockAgent);

      const result = await agentRepository.getAgentByName('Test Agent');
      
      expect(result).toEqual(mockAgent);
    });

    it('should list agents with filters', async () => {
      const mockAgents = [
        { _id: '1', name: 'Agent 1', type: 'task' },
        { _id: '2', name: 'Agent 2', type: 'conversational' }
      ];
      
      agentRepository.collections.agents.find().toArray.mockResolvedValueOnce(mockAgents);

      const result = await agentRepository.listAgents({ type: 'task' });
      
      expect(result).toEqual(mockAgents);
    });

    it('should update agent status', async () => {
      agentRepository.collections.agents.updateOne.mockResolvedValueOnce({
        modifiedCount: 1
      });

      const result = await agentRepository.updateAgentStatus('agent-id', 'active');
      
      expect(result.success).toBe(true);
      expect(result.modifiedCount).toBe(1);
    });

    it('should delete agent with cascade', async () => {
      // Use a valid ObjectId format for the test
      const mockObjectId = '507f1f77bcf86cd799439011';
      const mockAgent = { _id: mockObjectId, name: 'Test Agent' };
      
      // Use direct mock instead of jest.spyOn to avoid memory leaks
      agentRepository.collections.agents.findOne.mockResolvedValueOnce(mockAgent);
      agentRepository.collections.agents.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result = await agentRepository.deleteAgent(mockObjectId);
      
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      
      // Verify cascade deletion calls
      expect(agentRepository.collections.versions.deleteMany).toHaveBeenCalledWith({ agentId: mockObjectId });
      expect(agentRepository.collections.deployments.deleteMany).toHaveBeenCalledWith({ agentId: mockObjectId });
      expect(agentRepository.collections.metrics.deleteMany).toHaveBeenCalledWith({ agentId: mockObjectId });
    });
  });

  describe('Advanced Operations', () => {
    it('should save deployment information', async () => {
      const mockAgent = { _id: 'agent-id', name: 'Test Agent' };
      // Use direct mock instead of jest.spyOn to avoid memory leaks  
      agentRepository.collections.agents.findOne.mockResolvedValueOnce(mockAgent);

      const result = await agentRepository.saveDeployment('agent-id', {
        environment: 'production',
        version: '1.0.0'
      });
      
      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
    });

    it('should save agent metrics', async () => {
      const mockAgent = { _id: 'agent-id', name: 'Test Agent' };
      // Use direct mock instead of jest.spyOn to avoid memory leaks
      agentRepository.collections.agents.findOne.mockResolvedValueOnce(mockAgent);

      const result = await agentRepository.saveMetrics('agent-id', {
        responseTime: 150,
        throughput: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.metricId).toBeDefined();
    });

    it('should get comprehensive statistics', async () => {
      // Setup multiple mock calls for different statistics queries
      agentRepository.collections.agents.countDocuments
        .mockResolvedValueOnce(25)  // totalAgents
        .mockResolvedValueOnce(5);  // recentlyCreated
        
      agentRepository.collections.agents.aggregate().toArray
        .mockResolvedValueOnce([{ _id: 'task', count: 15 }])  // byType
        .mockResolvedValueOnce([{ _id: 'active', count: 20 }]);  // byStatus
        
      agentRepository.collections.deployments.countDocuments
        .mockResolvedValueOnce(40)  // totalDeployments
        .mockResolvedValueOnce(35); // activeDeployments

      const stats = await agentRepository.getStatistics();
      
      expect(stats.totalAgents).toBe(25);
      expect(stats.recentlyCreated).toBe(5);
      expect(stats.totalDeployments).toBe(40);
      expect(stats.activeDeployments).toBe(35);
    });

    it('should search agents by capabilities', async () => {
      const mockAgents = [{ name: 'File Agent', tools: ['file_read'] }];
      agentRepository.collections.agents.find().toArray.mockResolvedValueOnce(mockAgents);

      const result = await agentRepository.searchByCapabilities(['file_read']);
      
      expect(result).toEqual(mockAgents);
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      agentRepository.collections.agents.replaceOne.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(agentRepository.saveAgent({ name: 'Test' }))
        .rejects.toThrow('Failed to save agent');
    });

    it('should handle retrieval errors gracefully', async () => {
      agentRepository.collections.agents.findOne.mockRejectedValueOnce(
        new Error('Network timeout')
      );

      await expect(agentRepository.getAgentById('test-id'))
        .rejects.toThrow('Failed to retrieve agent');
    });

    it('should handle agent not found for operations', async () => {
      // Use direct mock instead of jest.spyOn to avoid memory leaks
      agentRepository.collections.agents.findOne.mockResolvedValue(null);

      await expect(agentRepository.saveDeployment('nonexistent', {}))
        .rejects.toThrow('Agent not found');
        
      await expect(agentRepository.saveMetrics('nonexistent', {}))
        .rejects.toThrow('Agent not found');
    });
  });

  describe('Lifecycle Management', () => {
    it('should cleanup resources properly', async () => {
      // Set up a client to test cleanup
      const mockClient = {
        close: jest.fn().mockResolvedValue()
      };
      agentRepository.client = mockClient;
      agentRepository.initialized = true;

      await agentRepository.cleanup();
      
      expect(mockClient.close).toHaveBeenCalled();
      expect(agentRepository.client).toBeNull();
      expect(agentRepository.db).toBeNull();
      expect(agentRepository.initialized).toBe(false);
    });

    it('should handle cleanup when not initialized', async () => {
      agentRepository.client = null;
      
      await expect(agentRepository.cleanup()).resolves.not.toThrow();
    });

    it('should verify _ensureInitialized works when already initialized', async () => {
      // This tests the "already initialized" path safely
      expect(agentRepository.initialized).toBe(true);
      await expect(agentRepository._ensureInitialized()).resolves.not.toThrow();
    });
  });
});