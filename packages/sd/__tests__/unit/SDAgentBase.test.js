/**
 * Unit tests for SDAgentBase
 */

import { jest } from '@jest/globals';
import { SDAgentBase } from '../../src/agents/SDAgentBase.js';

// Mock BTAgentBase from local core module
jest.mock('../../src/core/BTAgentBase.js', () => ({
  BTAgentBase: class {
    constructor(config) {
      this.config = config;
      this.id = 'test-agent-id';
    }
    
    async initialize() {
      // Mock initialization
    }
    
    getResourceManager() {
      return this.config.resourceManager;
    }
  }
}));

describe('SDAgentBase', () => {
  let agent;
  let mockConfig;
  let mockLLMClient;
  let mockResourceManager;

  beforeEach(() => {
    mockLLMClient = {
      complete: jest.fn().mockResolvedValue('{"decision": "test", "reasoning": "test reasoning"}')
    };
    
    // Mock database service for unit tests (mocks are allowed in unit tests)
    const mockDatabaseService = {
      storeArtifact: jest.fn().mockResolvedValue({ 
        id: 'test-artifact-id', 
        type: 'test', 
        timestamp: new Date().toISOString() 
      }),
      retrieveArtifacts: jest.fn().mockResolvedValue([])
    };
    
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'llmClient') return mockLLMClient;
        if (key === 'sdModule') return { llmClient: mockLLMClient };
        return null;
      })
    };
    
    mockConfig = {
      designDatabase: { uri: 'mongodb://localhost:27017/test' },
      methodologyRules: { test: { rule1: () => true } },
      resourceManager: mockResourceManager,
      dbService: mockDatabaseService  // Add mock database service for unit tests
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create SDAgentBase instance', () => {
      agent = new SDAgentBase(mockConfig);
      
      expect(agent).toBeDefined();
      expect(agent.designDatabase).toBe(mockConfig.designDatabase);
      expect(agent.methodologyRules).toBe(mockConfig.methodologyRules);
      expect(agent.contextBuilder).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize agent and get LLM client', async () => {
      agent = new SDAgentBase(mockConfig);
      await agent.initialize();
      
      expect(agent.llmClient).toBe(mockLLMClient);
    });
  });

  describe('getLLMClient', () => {
    it('should get LLM client from ResourceManager', async () => {
      agent = new SDAgentBase(mockConfig);
      const client = await agent.getLLMClient();
      
      expect(client).toBe(mockLLMClient);
      expect(mockResourceManager.get).toHaveBeenCalledWith('llmClient');
    });

    it('should get LLM client from SD module if not in ResourceManager', async () => {
      mockResourceManager.get = jest.fn((key) => {
        if (key === 'sdModule') return { llmClient: mockLLMClient };
        return null;
      });
      
      agent = new SDAgentBase(mockConfig);
      const client = await agent.getLLMClient();
      
      expect(client).toBe(mockLLMClient);
    });

    it('should throw error if LLM client not available', async () => {
      mockResourceManager.get = jest.fn().mockReturnValue(null);
      
      agent = new SDAgentBase(mockConfig);
      await expect(agent.getLLMClient()).rejects.toThrow('LLM client not available');
    });
  });

  describe('buildContext', () => {
    it('should build context for requirements', async () => {
      agent = new SDAgentBase(mockConfig);
      const context = await agent.buildContext('requirements', { projectId: 'test-project' });
      
      expect(context).toHaveProperty('type', 'requirements');
      expect(context).toHaveProperty('projectId', 'test-project');
      expect(context).toHaveProperty('artifacts');
      expect(context).toHaveProperty('methodology');
    });

    it('should build context for domain', async () => {
      agent = new SDAgentBase(mockConfig);
      const context = await agent.buildContext('domain', { projectId: 'test-project' });
      
      expect(context).toHaveProperty('type', 'domain');
      expect(context).toHaveProperty('artifacts');
      expect(context.methodology).toContain('Domain-Driven Design');
    });

    it('should build generic context for unknown type', async () => {
      agent = new SDAgentBase(mockConfig);
      const context = await agent.buildContext('unknown', { projectId: 'test-project' });
      
      expect(context).toHaveProperty('type', 'generic');
    });
  });

  describe('createExecutionContext', () => {
    it('should create enhanced execution context', () => {
      agent = new SDAgentBase(mockConfig);
      agent.llmClient = mockLLMClient;
      
      const baseContext = { test: 'value' };
      const sdContext = agent.createExecutionContext(baseContext);
      
      expect(sdContext).toHaveProperty('test', 'value');
      expect(sdContext).toHaveProperty('designDatabase');
      expect(sdContext).toHaveProperty('methodologyRules');
      expect(sdContext).toHaveProperty('llmClient');
      expect(sdContext).toHaveProperty('retrieveArtifact');
      expect(sdContext).toHaveProperty('storeArtifact');
      expect(sdContext).toHaveProperty('buildLLMContext');
      expect(sdContext).toHaveProperty('makeLLMDecision');
    });
  });

  describe('makeLLMDecision', () => {
    it('should make LLM decision with context', async () => {
      agent = new SDAgentBase(mockConfig);
      await agent.initialize();
      
      const decision = await agent.makeLLMDecision('Test prompt', { artifactId: 'test-id' });
      
      expect(decision).toHaveProperty('decision', 'test');
      expect(decision).toHaveProperty('reasoning', 'test reasoning');
      expect(mockLLMClient.complete).toHaveBeenCalled();
    });

    it('should parse non-JSON response', async () => {
      mockLLMClient.complete = jest.fn().mockResolvedValue('Plain text response');
      
      agent = new SDAgentBase(mockConfig);
      await agent.initialize();
      
      const decision = await agent.makeLLMDecision('Test prompt', {});
      
      expect(decision).toHaveProperty('decision', 'Plain text response');
      expect(decision).toHaveProperty('reasoning', 'Plain text response');
    });
  });

  describe('buildPromptWithContext', () => {
    it('should build prompt with full context', () => {
      agent = new SDAgentBase(mockConfig);
      
      const prompt = agent.buildPromptWithContext('Base prompt', {
        artifacts: { test: 'artifact' },
        projectContext: { project: 'context' }
      });
      
      expect(prompt).toContain('Base prompt');
      expect(prompt).toContain('Methodology Rules');
      expect(prompt).toContain('Related Artifacts');
      expect(prompt).toContain('Project Context');
    });
  });

  describe('storeArtifact', () => {
    it('should store artifact with metadata', async () => {
      agent = new SDAgentBase(mockConfig);
      agent.getCurrentPhase = jest.fn().mockReturnValue('test-phase');
      
      const artifact = { type: 'test', data: 'test-data' };
      const stored = await agent.storeArtifact(artifact);
      
      expect(stored).toHaveProperty('id');
      expect(stored).toHaveProperty('agentId', agent.agentId);
      expect(stored).toHaveProperty('agentType', 'SDAgentBase');
      expect(stored).toHaveProperty('timestamp');
      expect(stored).toHaveProperty('methodologyPhase', 'test-phase');
    });
  });

  describe('retrieveArtifact', () => {
    it('should retrieve artifact from database', async () => {
      agent = new SDAgentBase(mockConfig);
      
      const result = await agent.retrieveArtifact('test-type', { projectId: 'test' });
      
      expect(result).toHaveProperty('type', 'test-type');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('results');
    });
  });

  describe('validateMethodology', () => {
    it('should validate artifact against methodology rules', () => {
      const rules = {
        testArtifact: {
          rule1: (artifact) => artifact.data === 'valid',
          rule2: (artifact) => artifact.type === 'testArtifact'
        }
      };
      
      agent = new SDAgentBase({ ...mockConfig, methodologyRules: rules });
      
      const validArtifact = { type: 'testArtifact', data: 'valid' };
      const validResult = agent.validateMethodology(validArtifact);
      
      expect(validResult.valid).toBe(true);
      expect(validResult.violations).toHaveLength(0);
      
      const invalidArtifact = { type: 'testArtifact', data: 'invalid' };
      const invalidResult = agent.validateMethodology(invalidArtifact);
      
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.violations).toContain('rule1');
    });
  });
});