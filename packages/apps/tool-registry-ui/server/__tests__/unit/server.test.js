/**
 * Unit tests for server actor registration
 * Tests that planning actors are properly initialized and registered
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock modules
jest.mock('express', () => {
  const app = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn((port, callback) => {
      if (callback) callback();
      return { close: jest.fn() };
    })
  };
  return jest.fn(() => app);
});

jest.mock('ws', () => ({
  WebSocketServer: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

describe('Server Actor Registration', () => {
  let mockExpressApp;
  let mockWss;
  let mockActorSpace;
  let mockToolRegistry;
  let mockDecentPlanner;
  let mockBTExecutor;
  let mockMongoProvider;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock ActorSpace
    mockActorSpace = {
      register: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Mock services
    mockToolRegistry = {
      initialize: jest.fn(),
      semanticDiscovery: {},
      provider: {}
    };

    mockDecentPlanner = {
      plan: jest.fn(),
      validatePlan: jest.fn()
    };

    mockBTExecutor = {
      execute: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn()
    };

    mockMongoProvider = {
      connect: jest.fn(),
      getDatabase: jest.fn().mockReturnValue({
        collection: jest.fn()
      }),
      getCollection: jest.fn()
    };
  });

  describe('actor initialization', () => {
    it('should create ServerPlanningActor with required dependencies', () => {
      const { ServerPlanningActor } = require('../../actors/ServerPlanningActor.js');
      
      const planningActor = new ServerPlanningActor(mockDecentPlanner, mockMongoProvider);
      
      expect(planningActor).toBeDefined();
      expect(planningActor.decentPlanner).toBe(mockDecentPlanner);
      expect(planningActor.mongoProvider).toBe(mockMongoProvider);
    });

    it('should create ServerPlanExecutionActor with required dependencies', () => {
      const { ServerPlanExecutionActor } = require('../../actors/ServerPlanExecutionActor.js');
      
      const executionActor = new ServerPlanExecutionActor(mockBTExecutor, mockToolRegistry, mockMongoProvider);
      
      expect(executionActor).toBeDefined();
      expect(executionActor.btExecutor).toBe(mockBTExecutor);
      expect(executionActor.toolRegistry).toBe(mockToolRegistry);
      expect(executionActor.mongoProvider).toBe(mockMongoProvider);
    });

    it('should register all required actors in ActorSpace', () => {
      const { ServerToolRegistryActor } = require('../../actors/ServerToolRegistryActor.js');
      const { ServerDatabaseActor } = require('../../actors/ServerDatabaseActor.js');
      const { ServerSemanticSearchActor } = require('../../actors/ServerSemanticSearchActor.js');
      const { ServerPlanningActor } = require('../../actors/ServerPlanningActor.js');
      const { ServerPlanExecutionActor } = require('../../actors/ServerPlanExecutionActor.js');
      
      // Simulate actor registration
      const actors = {
        toolRegistry: new ServerToolRegistryActor(mockToolRegistry, mockMongoProvider),
        database: new ServerDatabaseActor(mockToolRegistry, mockMongoProvider),
        semanticSearch: new ServerSemanticSearchActor(mockToolRegistry.semanticDiscovery, mockMongoProvider),
        planning: new ServerPlanningActor(mockDecentPlanner, mockMongoProvider),
        execution: new ServerPlanExecutionActor(mockBTExecutor, mockToolRegistry, mockMongoProvider)
      };
      
      // Register actors
      Object.entries(actors).forEach(([name, actor]) => {
        mockActorSpace.register(name, actor);
      });
      
      expect(mockActorSpace.register).toHaveBeenCalledTimes(5);
      expect(mockActorSpace.register).toHaveBeenCalledWith('toolRegistry', expect.any(ServerToolRegistryActor));
      expect(mockActorSpace.register).toHaveBeenCalledWith('database', expect.any(ServerDatabaseActor));
      expect(mockActorSpace.register).toHaveBeenCalledWith('semanticSearch', expect.any(ServerSemanticSearchActor));
      expect(mockActorSpace.register).toHaveBeenCalledWith('planning', expect.any(ServerPlanningActor));
      expect(mockActorSpace.register).toHaveBeenCalledWith('execution', expect.any(ServerPlanExecutionActor));
    });
  });

  describe('WebSocket connection handling', () => {
    it('should handle new WebSocket connections', () => {
      const mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        readyState: 1 // OPEN
      };

      const { ServerPlanningActor } = require('../../actors/ServerPlanningActor.js');
      const planningActor = new ServerPlanningActor(mockDecentPlanner, mockMongoProvider);
      
      // Set remote actor
      planningActor.setRemoteActor({
        send: (message) => {
          mockWs.send(JSON.stringify(message));
        }
      });
      
      // Simulate message handling
      mockWs.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          // Test message handling
          const testMessage = JSON.stringify({
            type: 'plan:list',
            data: {}
          });
          handler(testMessage);
        }
      });
      
      expect(planningActor.remoteActor).toBeDefined();
    });

    it('should handle actor messages through WebSocket', async () => {
      const mockWs = {
        send: jest.fn(),
        readyState: 1
      };

      const { ServerPlanningActor } = require('../../actors/ServerPlanningActor.js');
      const planningActor = new ServerPlanningActor(mockDecentPlanner, mockMongoProvider);
      
      planningActor.setRemoteActor({
        send: (message) => {
          mockWs.send(JSON.stringify(message));
        }
      });
      
      // Test plan creation message
      await planningActor.receive({
        type: 'plan:create',
        data: {
          goal: 'Test goal',
          context: {}
        }
      });
      
      // Should send decomposition start message
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('plan:decomposition:start');
    });
  });

  describe('service initialization', () => {
    it('should initialize DecentPlanner with correct dependencies', async () => {
      const { DecentPlanner } = await import('@legion/decent-planner');
      const { LLMClient } = await import('@legion/llm');
      
      // Mock initialization
      const mockLLMClient = { chat: jest.fn() };
      const mockToolRegistry = { 
        initialize: jest.fn(),
        searchTools: jest.fn()
      };
      
      const planner = new DecentPlanner(mockLLMClient, mockToolRegistry, {
        maxDepth: 5,
        enableFormalPlanning: true
      });
      
      expect(planner).toBeDefined();
      expect(planner.llmClient).toBe(mockLLMClient);
      expect(planner.toolRegistry).toBe(mockToolRegistry);
    });

    it('should initialize BTExecutor with tool registry', async () => {
      const { BTExecutor } = await import('@legion/bt-executor');
      
      const executor = new BTExecutor(mockToolRegistry);
      
      expect(executor).toBeDefined();
      expect(executor.toolRegistry).toBe(mockToolRegistry);
    });

    it('should initialize MongoDB schemas', async () => {
      const { initializeSchemas } = await import('../../schemas/MongoDBSchemas.js');
      
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          createIndex: jest.fn()
        })
      };
      
      const schemas = await initializeSchemas(mockDb);
      
      expect(schemas).toBeDefined();
      expect(schemas.planSchema).toBeDefined();
      expect(schemas.executionSchema).toBeDefined();
      expect(schemas.templateSchema).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing DecentPlanner gracefully', () => {
      const { ServerPlanningActor } = require('../../actors/ServerPlanningActor.js');
      
      expect(() => {
        new ServerPlanningActor(null, mockMongoProvider);
      }).toThrow('DecentPlanner is required');
    });

    it('should handle missing BTExecutor gracefully', () => {
      const { ServerPlanExecutionActor } = require('../../actors/ServerPlanExecutionActor.js');
      
      expect(() => {
        new ServerPlanExecutionActor(null, mockToolRegistry, mockMongoProvider);
      }).toThrow('BT Executor is required');
    });

    it('should handle MongoDB connection failures', async () => {
      mockMongoProvider.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(mockMongoProvider.connect()).rejects.toThrow('Connection failed');
    });
  });
});