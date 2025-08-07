/**
 * Test for Specialist Agent Factory and Hierarchical Composition
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSpecialistAgentDefinition, createSimpleSpecialistAgent, registerSpecialistAgents } from '../../src/factories/SpecialistAgentFactory.js';
import { PlanningAgent } from '../../src/core/agents/base/PlanningAgent.js';
import { ToolRegistry, ModuleProvider } from '../../tools/src/integration/ToolRegistry.js';

// Mock LLM provider
class MockLLMProvider {
  async complete(prompt, options = {}) {
    // Return a simple plan based on the prompt content
    if (prompt.includes('ClassGenerator') || prompt.includes('class')) {
      return `Here is a plan:
[
  { "id": "step1", "tool": "codeGenerator", "description": "Generate class code", "params": { "className": "TestClass" } },
  { "id": "step2", "tool": "testGenerator", "description": "Generate unit tests", "params": { "className": "TestClass" } },
  { "id": "step3", "tool": "testRunner", "description": "Run tests", "params": { "testPath": "./tests/" } }
]`;
    } else if (prompt.includes('SystemBuilder') || prompt.includes('system')) {
      return `Here is a system plan:
[
  { "id": "step1", "tool": "ClassGenerator", "description": "Generate User class", "params": { "className": "User" } },
  { "id": "step2", "tool": "ClassGenerator", "description": "Generate Order class", "params": { "className": "Order" } },
  { "id": "step3", "tool": "integrationTester", "description": "Test system integration", "params": {} }
]`;
    }
    return `Simple plan: [{ "id": "step1", "tool": "codeGenerator", "description": "Generate code", "params": {} }]`;
  }

  getTokenUsage() {
    return { total: 100, input: 50, output: 50 };
  }
}

// Mock atomic tools
const mockAtomicTools = {
  codeGenerator: {
    name: 'codeGenerator',
    description: 'Generates code',
    async run(params) {
      return { success: true, code: `class ${params.className} { }` };
    }
  },
  testGenerator: {
    name: 'testGenerator', 
    description: 'Generates tests',
    async run(params) {
      return { success: true, tests: `test('${params.className}', () => { expect(true).toBe(true); })` };
    }
  },
  testRunner: {
    name: 'testRunner',
    description: 'Runs tests',
    async run(params) {
      return { success: true, results: { passed: 1, failed: 0, coverage: 100 } };
    }
  },
  integrationTester: {
    name: 'integrationTester',
    description: 'Tests integration',
    async run(params) {
      return { success: true, results: 'All integration tests passed' };
    }
  }
};

describe('Specialist Agent Factory', () => {
  let mockLLMProvider;
  let toolRegistry;

  beforeEach(async () => {
    mockLLMProvider = new MockLLMProvider();
    toolRegistry = new ToolRegistry();

    // Register atomic tools
    for (const [name, tool] of Object.entries(mockAtomicTools)) {
      await toolRegistry.registerProvider(new ModuleProvider({
        name,
        definition: {
          create: () => Promise.resolve(tool),
          getMetadata: () => ({
            name,
            description: tool.description,
            type: 'atomic-tool'
          })
        },
        config: {}
      }));
    }
  });

  describe('Agent Definition Creation', () => {
    test('should create specialist agent definition from config', async () => {
      const config = {
        name: 'TestSpecialist',
        description: 'Test specialist agent',
        domains: ['testing'],
        capabilities: ['test-creation'],
        llmProvider: mockLLMProvider
      };

      const definition = createSpecialistAgentDefinition(config);
      
      expect(definition).toBeDefined();
      expect(definition.create).toBeInstanceOf(Function);
      expect(definition.getMetadata).toBeInstanceOf(Function);

      const metadata = definition.getMetadata();
      expect(metadata.name).toBe('TestSpecialist');
      expect(metadata.domains).toEqual(['testing']);
      expect(metadata.specialist).toBe(true);
    });

    test('should create agent instance from definition', async () => {
      const config = {
        name: 'ClassGenerator',
        description: 'Generates classes with tests',
        domains: ['code', 'testing'],
        capabilities: ['code-generation', 'test-creation'],
        llmProvider: mockLLMProvider
      };

      const definition = createSpecialistAgentDefinition(config);
      const agent = await definition.create();

      expect(agent).toBeInstanceOf(PlanningAgent);
      expect(agent.config.name).toBe('ClassGenerator');
      expect(agent.config.orchestration.enabled).toBe(true);
      
      const metadata = agent.getMetadata();
      expect(metadata.specialist).toBe(true);
      expect(metadata.domains).toEqual(['code', 'testing']);
    });
  });

  describe('Simple Specialist Creation', () => {
    test('should create simple specialist agent', async () => {
      const definition = createSimpleSpecialistAgent(
        'CodeReviewer',
        'Reviews code for quality',
        ['code', 'quality'],
        ['code-review', 'quality-analysis']
      );

      expect(definition.getMetadata().name).toBe('CodeReviewer');
      expect(definition.getMetadata().domains).toEqual(['code', 'quality']);
      expect(definition.getMetadata().capabilities).toEqual(['code-review', 'quality-analysis']);
    });
  });

  describe('Tool Registry Integration', () => {
    test('should register specialist agents with tool registry', async () => {
      const agentConfigs = [
        {
          name: 'ClassGenerator',
          description: 'Generates classes',
          domains: ['code'],
          capabilities: ['code-generation'],
          llmProvider: mockLLMProvider
        }
      ];

      await registerSpecialistAgents(toolRegistry, agentConfigs);

      const toolNames = await toolRegistry.listTools();
      expect(toolNames).toContain('ClassGenerator.ClassGenerator');
      
      const classGenTool = await toolRegistry.getTool('ClassGenerator.ClassGenerator');
      expect(classGenTool).toBeDefined();
      expect(classGenTool.getMetadata().specialist).toBe(true);
    });

    test('should enable specialist agents to be discovered as tools', async () => {
      await registerSpecialistAgents(toolRegistry, [
        {
          name: 'ClassGenerator',
          description: 'Generates classes with comprehensive testing',
          domains: ['code', 'testing', 'development'],
          capabilities: ['code-generation', 'test-creation'],
          llmProvider: mockLLMProvider
        }
      ]);

      const relevantTools = await toolRegistry.getRelevantToolsForGoal(
        'Create a User class with authentication methods'
      );

      const specialistTools = relevantTools.filter(tool => 
        tool.getMetadata && tool.getMetadata().specialist === true
      );
      
      expect(specialistTools.length).toBeGreaterThan(0);
      const metadata = specialistTools[0].getMetadata();
      expect(metadata.name).toBe('ClassGenerator');
    });
  });

  describe('Hierarchical Composition', () => {
    test('should enable specialist agents to be used as tools by higher-level agents', async () => {
      // Register specialist agent
      await registerSpecialistAgents(toolRegistry, [
        {
          name: 'ClassGenerator',
          description: 'Generates classes with tests',
          domains: ['code', 'testing'],
          capabilities: ['code-generation'],
          llmProvider: mockLLMProvider,
          orchestration: { enabled: true }
        }
      ]);

      // Create higher-level system builder
      const systemBuilder = new PlanningAgent({
        name: 'SystemBuilder',
        description: 'Builds complete systems',
        orchestration: { enabled: false } // Planning-only for this test
      }, {
        async generatePlan(goal, tools, context) {
          // System builder can see and use ClassGenerator as a tool
          const classGenTool = tools.find(t => 
            t.getMetadata && t.getMetadata().name === 'ClassGenerator'
          );
          expect(classGenTool).toBeDefined();
          
          return [
            { 
              id: 'step1', 
              tool: 'ClassGenerator', 
              description: 'Generate User class',
              params: { className: 'User', requirements: ['authentication'] }
            }
          ];
        }
      });

      // Get tools including the specialist agent
      const toolNames = await toolRegistry.listTools();
      const toolObjects = [];
      for (const toolName of toolNames) {
        const tool = await toolRegistry.getTool(toolName);
        if (tool) toolObjects.push(tool);
      }
      
      const result = await systemBuilder.run(
        'Build a user management system', 
        toolObjects
      );

      expect(result.success).toBe(true);
      expect(result.context.plan).toBeDefined();
      expect(result.context.plan[0].tool).toBe('ClassGenerator');
    });

    test('should support nested agent composition', async () => {
      // Register multiple levels of specialist agents
      await registerSpecialistAgents(toolRegistry, [
        {
          name: 'ClassGenerator',
          description: 'Generates classes',
          domains: ['code'],
          capabilities: ['code-generation'],
          llmProvider: mockLLMProvider
        },
        {
          name: 'APIGenerator', 
          description: 'Generates APIs',
          domains: ['api', 'web'],
          capabilities: ['api-creation'],
          llmProvider: mockLLMProvider
        }
      ]);

      // System builder can use multiple specialist agents
      const systemBuilder = new PlanningAgent({
        name: 'SystemBuilder',
        orchestration: { enabled: false }
      }, {
        async generatePlan(goal, tools, context) {
          const specialists = tools.filter(t => 
            t.getMetadata && t.getMetadata().specialist
          );
          expect(specialists.length).toBeGreaterThanOrEqual(2);
          
          return [
            { id: 'step1', tool: 'ClassGenerator', description: 'Generate models' },
            { id: 'step2', tool: 'APIGenerator', description: 'Generate API layer' }
          ];
        }
      });

      const toolNames = await toolRegistry.listTools();
      const toolObjects = [];
      for (const toolName of toolNames) {
        const tool = await toolRegistry.getTool(toolName);
        if (tool) toolObjects.push(tool);
      }
      
      const result = await systemBuilder.run(
        'Build a microservice with models and API',
        toolObjects
      );

      expect(result.success).toBe(true);
      expect(result.context.plan.length).toBe(2);
      expect(result.context.plan[0].tool).toBe('ClassGenerator');
      expect(result.context.plan[1].tool).toBe('APIGenerator');
    });
  });

  describe('Agent as Tool Interface', () => {
    test('should enable agents to work as executable tools', async () => {
      const agentConfig = {
        name: 'SimpleClassGen',
        description: 'Simple class generator',
        domains: ['code'],
        capabilities: ['code-generation'],
        llmProvider: mockLLMProvider,
        orchestration: { enabled: false } // Planning-only for simpler test
      };

      const definition = createSpecialistAgentDefinition(agentConfig);
      const agent = await definition.create();

      // Agent should be executable as a tool
      expect(agent.isExecutable()).toBe(true);
      expect(agent.execute).toBeInstanceOf(Function);

      // Test execution as a tool
      const toolResult = await agent.execute({
        goal: 'Create a User class',
        tools: Object.values(mockAtomicTools),
        context: { className: 'User' }
      });

      expect(toolResult).toBeDefined();
      expect(toolResult.goal).toBe('Create a User class');
    });
  });
});