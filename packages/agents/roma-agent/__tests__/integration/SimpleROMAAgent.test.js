/**
 * Integration tests for SimpleROMAAgent
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import SimpleROMAAgent from '../../src/SimpleROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('SimpleROMAAgent Integration', () => {
  let agent;

  beforeAll(async () => {
    // Initialize ResourceManager singleton
    const resourceManager = await ResourceManager.getInstance();
    const toolRegistry = await ToolRegistry.getInstance();
  });

  beforeEach(async () => {
    agent = new SimpleROMAAgent();
    await agent.initialize();
  });

  describe('Simple Tool Execution', () => {
    it('should execute a simple calculator task', async () => {
      const task = {
        description: 'Calculate 42 * 10 using the calculator tool'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results[0]).toBeDefined();
      expect(result.results[0].result).toBe(420);
    }, 30000);

    it('should handle multiple tool calls', async () => {
      const task = {
        description: 'First calculate 5 * 8, then calculate 100 / 4'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThanOrEqual(2);
    }, 30000);
  });

  describe('Task Decomposition', () => {
    it('should decompose a complex task into subtasks', async () => {
      const task = {
        description: 'Create a simple web page with HTML that shows a greeting message'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.size).toBeGreaterThan(0);
    }, 60000);

    it('should handle nested decomposition', async () => {
      const task = {
        description: 'Create a calculator application with HTML and JavaScript'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      // Should have multiple artifacts for HTML and JS files
      expect(result.artifacts.size).toBeGreaterThan(1);
    }, 60000);
  });

  describe('Artifact Management', () => {
    it('should save and reference artifacts', async () => {
      const context = {
        artifacts: new Map(),
        conversation: [],
        depth: 0
      };

      // First task creates an artifact
      const task1 = {
        description: 'Calculate 15 * 3 and save the result'
      };

      const result1 = await agent.execute(task1, context);
      expect(result1.success).toBe(true);

      // Check if artifact was saved
      const hasCalculationResult = Array.from(context.artifacts.keys()).some(
        key => key.toLowerCase().includes('result') || key.toLowerCase().includes('calc')
      );
      expect(hasCalculationResult).toBe(true);

      // Second task uses the artifact
      const task2 = {
        description: 'Take the previous calculation result and multiply it by 2'
      };

      const result2 = await agent.execute(task2, context);
      expect(result2.success).toBe(true);
      expect(result2.results).toBeDefined();
    }, 60000);

    it('should resolve artifact references in parameters', async () => {
      const context = {
        artifacts: new Map([['test_value', 42]]),
        conversation: [],
        depth: 0
      };

      const resolvedObj = agent.resolveArtifacts(
        { value: '@test_value', other: 'static' },
        context
      );

      expect(resolvedObj.value).toBe(42);
      expect(resolvedObj.other).toBe('static');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool not found errors', async () => {
      const task = {
        description: 'Use a non-existent-tool-xyz to do something'
      };

      const result = await agent.execute(task);

      // Should either decompose or handle gracefully
      expect(result).toBeDefined();
      if (result.success === false) {
        expect(result.results).toBeDefined();
        expect(result.results[0].error).toContain('not found');
      }
    }, 30000);

    it('should prevent infinite recursion', async () => {
      const context = {
        artifacts: new Map(),
        conversation: [],
        depth: 11 // Already at max depth
      };

      const task = {
        description: 'Complex task requiring decomposition'
      };

      await expect(agent.execute(task, context)).rejects.toThrow('Maximum recursion depth exceeded');
    }, 30000);

    it('should handle LLM response parsing errors gracefully', async () => {
      // This test would need a way to mock the LLM response
      // For now, we just ensure the agent handles various task types
      const task = {
        description: 'What is the capital of France?'
      };

      const result = await agent.execute(task);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Should get a direct response
      expect(result.result || result.response || (result.results && result.results.length > 0)).toBeTruthy();
    }, 30000);
  });

  describe('Direct Response Tasks', () => {
    it('should handle analysis/question tasks with direct responses', async () => {
      const task = {
        description: 'Explain what 2 + 2 equals and why'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(typeof result.result).toBe('string');
      expect(result.result.toLowerCase()).toContain('4');
    }, 30000);
  });
});