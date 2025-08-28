/**
 * Unit tests for SDInitializer
 * 
 * Note: SDInitializer creates real LLMClient instances internally.
 * These tests focus on the initialization flow and resource management.
 */

import { jest } from '@jest/globals';
import { SDInitializer } from '../../src/utils/SDInitializer.js';

// Mock the database service to avoid real MongoDB connections
jest.mock('../../src/services/DesignDatabaseService.js', () => ({
  DesignDatabaseService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    connected: true
  }))
}));

describe('SDInitializer', () => {
  let initializer;
  let mockResourceManager;
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'env.ANTHROPIC_API_KEY') return 'test-anthropic-key';
        if (key === 'env.OPENAI_API_KEY') return 'test-openai-key';
        return null;
      }),
      set: jest.fn()
    };
    
    initializer = new SDInitializer();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create SDInitializer with default values', () => {
      expect(initializer.resourceManager).toBeNull();
      expect(initializer.llmClient).toBeNull();
      expect(initializer.dbService).toBeNull();
      expect(initializer.isInitialized).toBe(false);
    });
  });

  describe('initializeWithResourceManager', () => {
    it('should initialize with ResourceManager and create resources', async () => {
      const result = await initializer.initializeWithResourceManager(mockResourceManager);
      
      expect(result).toHaveProperty('resourceManager', mockResourceManager);
      expect(result).toHaveProperty('llmClient');
      expect(result).toHaveProperty('dbService');
      expect(initializer.isInitialized).toBe(true);
    });

    it('should prefer Anthropic when both API keys are available', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ LLM client initialized with Anthropic');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.ANTHROPIC_API_KEY');
    });

    it('should use OpenAI when only OpenAI key is available', async () => {
      mockResourceManager.get = jest.fn((key) => {
        if (key === 'env.OPENAI_API_KEY') return 'test-openai-key';
        return null;
      });
      
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ LLM client initialized with OpenAI');
    });

    it('should throw error when no API keys are available', async () => {
      mockResourceManager.get = jest.fn().mockReturnValue(null);
      
      await expect(initializer.initializeWithResourceManager(mockResourceManager))
        .rejects.toThrow('No LLM API key found in environment');
    });

    it('should register resources in ResourceManager', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      expect(mockResourceManager.set).toHaveBeenCalledWith('llmClient', expect.any(Object));
      expect(mockResourceManager.set).toHaveBeenCalledWith('sdModule', expect.objectContaining({
        llmClient: expect.any(Object)
      }));
      expect(mockResourceManager.set).toHaveBeenCalledWith('dbService', expect.any(Object));
    });

    it('should return existing resources if already initialized', async () => {
      const firstResult = await initializer.initializeWithResourceManager(mockResourceManager);
      mockResourceManager.set.mockClear();
      
      const secondResult = await initializer.initializeWithResourceManager(mockResourceManager);
      
      // Should return same object references
      expect(secondResult.llmClient).toBe(firstResult.llmClient);
      expect(secondResult.dbService).toBe(firstResult.dbService);
      expect(mockResourceManager.set).not.toHaveBeenCalled();
    });
  });

  describe('getAgentConfig', () => {
    it('should return agent configuration after initialization', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      const config = initializer.getAgentConfig();
      
      expect(config).toHaveProperty('llmClient');
      expect(config).toHaveProperty('dbService');
      expect(config).toHaveProperty('resourceManager', mockResourceManager);
      expect(config).toHaveProperty('designDatabase');
    });

    it('should throw error if not initialized', () => {
      expect(() => initializer.getAgentConfig())
        .toThrow('SDInitializer not initialized');
    });
  });

  describe('getToolDependencies', () => {
    it('should return tool dependencies after initialization', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      const deps = initializer.getToolDependencies();
      
      expect(deps).toHaveProperty('llmClient');
      expect(deps).toHaveProperty('designDatabase');
      expect(deps).toHaveProperty('resourceManager', mockResourceManager);
    });

    it('should throw error if not initialized', () => {
      expect(() => initializer.getToolDependencies())
        .toThrow('SDInitializer not initialized');
    });
  });

  describe('getStatus', () => {
    it('should return status when not initialized', () => {
      const status = initializer.getStatus();
      
      expect(status).toEqual({
        initialized: false,
        hasLLM: false,
        hasDB: false,
        hasResourceManager: false
      });
    });

    it('should return status when initialized', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      const status = initializer.getStatus();
      
      expect(status).toEqual({
        initialized: true,
        hasLLM: true,
        hasDB: true,
        hasResourceManager: true
      });
    });
  });

  describe('initializeAgent', () => {
    it('should initialize an agent with dependencies', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      const MockAgent = jest.fn().mockImplementation(function(config) {
        this.config = config;
        this.initialize = jest.fn().mockResolvedValue();
      });
      
      const agent = await initializer.initializeAgent(MockAgent, { name: 'TestAgent' });
      
      expect(MockAgent).toHaveBeenCalledWith(expect.objectContaining({
        llmClient: expect.any(Object),
        dbService: expect.any(Object),
        resourceManager: mockResourceManager,
        name: 'TestAgent'
      }));
      expect(agent.initialize).toHaveBeenCalled();
    });
  });

  describe('initializeAgents', () => {
    it('should initialize multiple agents', async () => {
      await initializer.initializeWithResourceManager(mockResourceManager);
      
      const MockAgent1 = jest.fn().mockImplementation(function() {
        this.initialize = jest.fn();
      });
      const MockAgent2 = jest.fn().mockImplementation(function() {
        this.initialize = jest.fn();
      });
      
      const agents = await initializer.initializeAgents({
        agent1: MockAgent1,
        agent2: MockAgent2
      });
      
      expect(agents).toHaveProperty('agent1');
      expect(agents).toHaveProperty('agent2');
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ agent1 agent initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ agent2 agent initialized');
    });
  });
});