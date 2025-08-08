/**
 * Integration tests for SD Module
 */

import { jest } from '@jest/globals';
import SDModule from '../../src/SDModule.js';
import { RequirementsAgent } from '../../src/agents/RequirementsAgent.js';
import { RequirementParserTool } from '../../src/tools/requirements/RequirementParserTool.js';

// Mock Legion dependencies
jest.mock('@legion/llm', () => ({
  LLMClient: jest.fn().mockImplementation(() => ({
    complete: jest.fn().mockResolvedValue(JSON.stringify({
      functional: [
        {
          id: 'FR-001',
          description: 'Test requirement',
          priority: 'high'
        }
      ],
      nonFunctional: [],
      reasoning: 'Test analysis'
    }))
  }))
}));

jest.mock('../../src/core/BTAgentBase.js', () => ({
  BTAgentBase: class {
    constructor(config) {
      this.config = config;
      this.id = 'test-agent';
      this.name = config.name;
    }
    
    async initialize() {}
    
    getResourceManager() {
      return this.config.resourceManager;
    }
  }
}));

jest.mock('@legion/tools', () => ({
  Tool: class {
    constructor(config) {
      this.name = config.name;
      this.description = config.description;
      this.inputSchema = config.inputSchema;
    }
    emit(event, data) {}
  },
  ToolResult: {
    success: jest.fn((data) => ({ success: true, data })),
    failure: jest.fn((message) => ({ success: false, error: message }))
  },
  Module: class {
    constructor(name, dependencies) {
      this.name = name;
      this.dependencies = dependencies;
    }
  }
}));

describe('SD Module Integration', () => {
  let module;
  let mockResourceManager;

  beforeEach(() => {
    const mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify({
        functional: [
          {
            id: 'FR-001',
            description: 'Test requirement',
            priority: 'high'
          }
        ],
        nonFunctional: [],
        constraints: [],
        assumptions: [],
        dependencies: [],
        reasoning: 'Test analysis'
      }))
    };
    
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'env.ANTHROPIC_API_KEY') return 'test-key';
        if (key === 'env.MONGODB_URI') return 'mongodb://localhost:27017/test';
        if (key === 'llmClient') return mockLLMClient;
        return null;
      }),
      register: jest.fn(),
      set: jest.fn() // Add set method for completeness
    };
    
    // Pre-register the mock LLM client
    mockResourceManager.get.mockImplementation((key) => {
      if (key === 'env.ANTHROPIC_API_KEY') return 'test-key';
      if (key === 'env.MONGODB_URI') return 'mongodb://localhost:27017/test';
      if (key === 'llmClient') return mockLLMClient;
      return null;
    });
  });

  describe('Module Loading', () => {
    it('should create and initialize SD module', async () => {
      module = await SDModule.create(mockResourceManager);
      
      expect(module).toBeDefined();
      expect(module.name).toBe('SDModule');
      expect(module.llmClient).toBeDefined();
      expect(module.tools.size).toBeGreaterThan(0);
    });

    it('should register all required tools', async () => {
      module = await SDModule.create(mockResourceManager);
      const tools = module.getTools();
      
      const toolNames = tools.map(t => t.name);
      
      // Requirements tools
      expect(toolNames).toContain('parse_requirements');
      expect(toolNames).toContain('generate_user_stories');
      expect(toolNames).toContain('generate_acceptance_criteria');
      
      // Domain tools
      expect(toolNames).toContain('identify_bounded_contexts');
      expect(toolNames).toContain('model_entities');
      expect(toolNames).toContain('design_aggregates');
      
      // Architecture tools
      expect(toolNames).toContain('design_layers');
      expect(toolNames).toContain('generate_use_cases');
      
      // Database tools
      expect(toolNames).toContain('database_connect');
      expect(toolNames).toContain('store_artifact');
      expect(toolNames).toContain('retrieve_context');
    });

    it('should provide all SD profiles', async () => {
      module = await SDModule.create(mockResourceManager);
      const profiles = module.getProfiles();
      
      const profileNames = profiles.map(p => p.name);
      
      expect(profileNames).toContain('sd-full');
      expect(profileNames).toContain('sd-requirements');
      expect(profileNames).toContain('sd-domain');
      expect(profileNames).toContain('sd-architecture');
      expect(profileNames).toContain('sd-implementation');
      expect(profileNames).toContain('sd-testing');
    });
  });

  describe('Profile Integration', () => {
    it('should load full SD profile with all actions', async () => {
      module = await SDModule.create(mockResourceManager);
      const profile = module.getProfile('sd-full');
      
      expect(profile).toBeDefined();
      expect(profile.name).toBe('sd-full');
      expect(profile.allowableActions).toBeDefined();
      expect(profile.allowableActions.length).toBeGreaterThan(20);
      
      // Check for key actions
      const actionTypes = profile.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('parse_requirements');
      expect(actionTypes).toContain('identify_bounded_contexts');
      expect(actionTypes).toContain('generate_use_cases');
      expect(actionTypes).toContain('generate_entity_code');
    });

    it('should load requirements profile with focused actions', async () => {
      module = await SDModule.create(mockResourceManager);
      const profile = module.getProfile('sd-requirements');
      
      expect(profile).toBeDefined();
      expect(profile.name).toBe('sd-requirements');
      expect(profile.allowableActions.length).toBeLessThan(10);
      
      const actionTypes = profile.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('parse_requirements');
      expect(actionTypes).toContain('generate_user_stories');
      expect(actionTypes).toContain('generate_acceptance_criteria');
    });
  });

  describe('Agent Integration', () => {
    it('should create RequirementsAgent with SD context', () => {
      const agent = new RequirementsAgent({
        designDatabase: {},
        resourceManager: mockResourceManager
      });
      
      expect(agent).toBeDefined();
      expect(agent.name).toBe('RequirementsAgent');
      expect(agent.getCurrentPhase()).toBe('requirements-analysis');
      expect(agent.workflowConfig).toBeDefined();
    });

    it('should have proper workflow configuration', () => {
      const agent = new RequirementsAgent({
        designDatabase: {},
        resourceManager: mockResourceManager
      });
      
      const workflow = agent.workflowConfig;
      
      expect(workflow.type).toBe('sequence');
      expect(workflow.children).toBeDefined();
      expect(workflow.children.length).toBeGreaterThan(0);
      
      // Check workflow steps
      const steps = workflow.children.map(c => c.id);
      expect(steps).toContain('parse-requirements');
      expect(steps).toContain('generate-user-stories');
      expect(steps).toContain('generate-acceptance-criteria');
      expect(steps).toContain('store-artifacts');
    });
  });

  describe('Tool Integration', () => {
    it('should execute RequirementParserTool', async () => {
      // Create module first to ensure LLM client is available
      module = await SDModule.create(mockResourceManager);
      
      const tool = new RequirementParserTool({
        llmClient: module.llmClient,
        resourceManager: mockResourceManager
      });
      
      const result = await tool.execute({
        requirementsText: 'The system should allow users to login',
        analysisDepth: 'basic'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('parsedRequirements');
      expect(result.data.parsedRequirements).toHaveProperty('functional');
    });
  });

  describe('End-to-End Workflow', () => {
    it('should process requirements through agent', async () => {
      // Create module first to ensure LLM client is available
      module = await SDModule.create(mockResourceManager);
      
      // Create enhanced mock resource manager that includes the LLM client from module
      const enhancedMockResourceManager = {
        ...mockResourceManager,
        get: jest.fn((key) => {
          if (key === 'env.ANTHROPIC_API_KEY') return 'test-key';
          if (key === 'env.MONGODB_URI') return 'mongodb://localhost:27017/test';
          if (key === 'llmClient') return module.llmClient;
          if (key === 'sdModule') return { llmClient: module.llmClient };
          return null;
        })
      };
      
      const agent = new RequirementsAgent({
        designDatabase: {},
        resourceManager: enhancedMockResourceManager
      });
      
      await agent.initialize();
      
      const result = await agent.receive({
        type: 'analyze_requirements',
        payload: {
          requirementsText: 'Users should be able to create, read, update, and delete items',
          projectId: 'test-project'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('projectId', 'test-project');
      expect(result.data).toHaveProperty('phase', 'requirements-analysis');
      expect(result.data).toHaveProperty('validation');
    });

    it('should reject invalid message types', async () => {
      const agent = new RequirementsAgent({
        designDatabase: {},
        resourceManager: mockResourceManager
      });
      
      const result = await agent.receive({
        type: 'invalid_type',
        payload: {}
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('only handles analyze_requirements');
    });
  });
});