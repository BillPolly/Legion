/**
 * Test for Unified PlanningAgent Interface
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlanningAgent } from '../../src/core/agents/base/PlanningAgent.js';
import { AgentConfig } from '../../src/core/agents/base/AgentConfig.js';

// Mock planning strategy
class MockPlanningStrategy {
  async generatePlan(prompt, options) {
    return [
      { id: 'step1', tool: 'tool1', description: 'Test step 1', params: {} },
      { id: 'step2', tool: 'tool2', description: 'Test step 2', params: {} }
    ];
  }
}

// Mock tools
const mockTools = [
  {
    name: 'tool1',
    description: 'Mock tool 1',
    async run(params) {
      return { success: true, data: 'result1' };
    }
  },
  {
    name: 'tool2', 
    description: 'Mock tool 2',
    async run(params) {
      return { success: true, data: 'result2' };
    }
  }
];

describe('Unified PlanningAgent Interface', () => {
  let planningStrategy;

  beforeEach(() => {
    planningStrategy = new MockPlanningStrategy();
  });

  describe('Configuration-based behavior', () => {
    test('should work with orchestration enabled (default)', async () => {
      const config = new AgentConfig({
        name: 'TestAgent',
        description: 'Test agent with orchestration',
        debugMode: true,
        orchestration: {
          enabled: true
        }
      });

      const agent = new PlanningAgent(config, planningStrategy);
      expect(agent.config.orchestration.enabled).toBe(true);
      
      // Should have orchestration metadata
      const metadata = agent.getMetadata();
      expect(metadata.capabilities.execution).toBe(true);
      expect(metadata.capabilities.replanning).toBe(true);
    });

    test('should work with orchestration disabled (planning-only)', async () => {
      const config = new AgentConfig({
        name: 'PlannerAgent',
        description: 'Planning-only agent',
        debugMode: true,
        orchestration: {
          enabled: false
        }
      });

      const agent = new PlanningAgent(config, planningStrategy);
      expect(agent.config.orchestration.enabled).toBe(false);

      // Test planning-only mode
      const result = await agent.run('Create a test plan', mockTools);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Plan created for');
      expect(result.context.mode).toBe('planning-only');
      expect(result.context.plan).toHaveLength(2);
    });
  });

  describe('Unified interface', () => {
    test('should maintain consistent run() interface', async () => {
      const agent = new PlanningAgent({
        name: 'TestAgent',
        orchestration: { enabled: false } // Use planning-only for simpler test
      }, planningStrategy);

      // Test the standard interface
      const result = await agent.run('Test goal', mockTools, { testContext: true });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(typeof result.message).toBe('string');
      expect(result.context).toBeDefined();
    });

    test('should work as an executable tool', async () => {
      const agent = new PlanningAgent({
        name: 'SubAgent',
        orchestration: { enabled: false }
      }, planningStrategy);

      // Test tool interface
      expect(agent.isExecutable()).toBe(true);
      
      const toolResult = await agent.execute({
        goal: 'Sub-agent goal',
        tools: mockTools,
        context: { subTask: true }
      });

      expect(toolResult).toBeDefined();
      expect(toolResult.goal).toBe('Sub-agent goal');
      expect(toolResult.plan).toHaveLength(2);
    });

    test('should handle errors gracefully', async () => {
      const agent = new PlanningAgent({
        name: 'ErrorAgent',
        orchestration: { enabled: false }
      }); // No strategy provided

      const result = await agent.run('This will fail', mockTools);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.message).toContain('No planning strategy configured');
    });
  });

  describe('Agent composition', () => {
    test('should work when used as a tool by another agent', async () => {
      // Create a sub-agent
      const subAgent = new PlanningAgent({
        name: 'SubAgent',
        description: 'Sub-agent for delegation',
        orchestration: { enabled: false }
      }, planningStrategy);

      // Create main agent
      const mainAgent = new PlanningAgent({
        name: 'MainAgent',
        description: 'Main orchestrating agent', 
        orchestration: { enabled: false }
      }, planningStrategy);

      // Use sub-agent as a tool
      const toolsWithSubAgent = [...mockTools, {
        name: 'subAgent',
        description: 'Delegate to sub-agent',
        run: async (params) => {
          return await subAgent.execute(params);
        }
      }];

      const result = await mainAgent.run('Main goal with delegation', toolsWithSubAgent);
      
      expect(result.success).toBe(true);
      expect(result.context.plan.some(step => step.tool === 'subAgent')).toBe(false); // Won't use it unless strategy chooses it
    });
  });

  describe('Backward compatibility', () => {
    test('should work with existing agent creation patterns', async () => {
      // Old pattern - should still work
      const agent = new PlanningAgent({
        name: 'LegacyAgent',
        maxRetries: 2,
        debugMode: false
      }, planningStrategy);

      expect(agent.config.name).toBe('LegacyAgent');
      expect(agent.config.maxRetries).toBe(2);
      expect(agent.config.orchestration.enabled).toBe(true); // Default
      
      const metadata = agent.getMetadata();
      expect(metadata.interface.method).toBe('run');
      expect(metadata.interface.parameters).toEqual(['goal', 'tools', 'context']);
    });

    test('should support dependency injection', async () => {
      const agent = new PlanningAgent({
        name: 'TestAgent'
      }, planningStrategy);

      const mockTracer = { startSpan: () => ({}) };
      const mockLLM = { complete: () => Promise.resolve('test') };

      agent.setDependencies({
        tracer: mockTracer,
        llmProvider: mockLLM
      });

      expect(agent.tracer).toBe(mockTracer);
      expect(agent.llmProvider).toBe(mockLLM);
    });
  });
});