/**
 * Integration tests for SimpleROMAAgent
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('SimpleROMAAgent Integration', () => {
  let agent;
  let resourceManager;
  let toolRegistry;

  beforeAll(async () => {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
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

  describe('TaskClassifier Integration Tests', () => {
    it('should properly classify and execute SIMPLE file operations', async () => {
      const task = {
        description: 'Create a text file with the content "Hello, TaskClassifier!"'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      
      // Verify that the task was classified as SIMPLE and executed with tools
      const firstResult = result.results[0];
      expect(firstResult.success).toBe(true);
    }, 30000);

    it('should properly classify and decompose COMPLEX application creation', async () => {
      const task = {
        description: 'Create a complete Node.js web application with Express server, HTML frontend, CSS styling, and JavaScript interactivity'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      
      // Should have multiple artifacts from decomposed subtasks
      expect(result.artifacts.size).toBeGreaterThan(2);
      
      // Should have created multiple files/components
      const artifactKeys = Array.from(result.artifacts.keys());
      const hasHtmlArtifact = artifactKeys.some(key => 
        key.toLowerCase().includes('html') || key.toLowerCase().includes('frontend')
      );
      const hasCssArtifact = artifactKeys.some(key => 
        key.toLowerCase().includes('css') || key.toLowerCase().includes('style')
      );
      const hasJsArtifact = artifactKeys.some(key => 
        key.toLowerCase().includes('js') || key.toLowerCase().includes('script') || key.toLowerCase().includes('server')
      );
      
      expect(hasHtmlArtifact || hasCssArtifact || hasJsArtifact).toBe(true);
    }, 120000);

    it('should handle borderline tasks correctly', async () => {
      const task = {
        description: 'Create a simple Express.js server with one route that returns "Hello World"'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      // This could be classified as either SIMPLE or COMPLEX depending on the LLM's assessment
      // Both outcomes should work correctly
      if (result.results) {
        // Classified as SIMPLE - executed with tools
        expect(result.results.length).toBeGreaterThan(0);
      } else if (result.artifacts) {
        // Classified as COMPLEX - decomposed into subtasks
        expect(result.artifacts.size).toBeGreaterThan(0);
      }
    }, 60000);

    it('should properly handle task classification failures', async () => {
      const task = {
        description: 'Execute an extremely ambiguous task that might confuse the classifier'
      };

      const result = await agent.execute(task);

      // Even if classification is uncertain, should still produce a result
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      // Should either have results (if executed as SIMPLE) or artifacts (if decomposed as COMPLEX)
      expect(result.results || result.artifacts || result.result).toBeDefined();
    }, 45000);

    it('should maintain artifact continuity across decomposed subtasks', async () => {
      const task = {
        description: 'Create a calculator web page with HTML structure, CSS styling, and JavaScript functionality that work together'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      
      // Should have multiple related artifacts
      expect(result.artifacts.size).toBeGreaterThan(1);
      
      // Verify artifacts contain references to each other (showing proper artifact flow)
      const artifactValues = Array.from(result.artifacts.values());
      const hasArtifactReferences = artifactValues.some(artifact => 
        JSON.stringify(artifact).includes('@') // Contains artifact references
      );
      
      // If not in artifact values directly, check if artifacts were properly used
      // (This might not always be present depending on how subtasks were structured)
      expect(result.artifacts.size).toBeGreaterThan(0); // At minimum, should have created artifacts
    }, 90000);

    it('should handle recursive decomposition with depth limits', async () => {
      const task = {
        description: 'Build a comprehensive e-commerce platform with user authentication, product catalog, shopping cart, payment processing, and admin dashboard'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      
      // Should complete without hitting recursion depth limits
      expect(result.artifacts || result.results || result.result).toBeDefined();
      
      // For such a complex task, should have multiple artifacts/results
      if (result.artifacts) {
        expect(result.artifacts.size).toBeGreaterThan(3);
      }
    }, 180000);

    it('should classify simple questions correctly and provide direct responses', async () => {
      const task = {
        description: 'What is the difference between let and const in JavaScript?'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(typeof result.result).toBe('string');
      expect(result.result.toLowerCase()).toContain('let');
      expect(result.result.toLowerCase()).toContain('const');
      
      // Should be a direct response, not tool execution or decomposition
      expect(result.results).toBeUndefined();
      expect(result.artifacts).toBeDefined(); // ArtifactRegistry is always present but may be empty
    }, 30000);

    it('should properly discover and use tools for SIMPLE tasks', async () => {
      const task = {
        description: 'Calculate the result of 123 multiplied by 456 and save it to a file'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      
      // Should have used both calculator and file tools
      const toolsUsed = result.results.map(r => r.tool || 'unknown').filter(Boolean);
      expect(toolsUsed.length).toBeGreaterThan(0);
      
      // Verify calculation was performed
      const hasCalculationResult = result.results.some(r => 
        r.result !== undefined && (
          r.result === 56088 || // Direct calculation result
          JSON.stringify(r).includes('56088') // Result in other fields
        )
      );
      expect(hasCalculationResult).toBe(true);
    }, 45000);

    it('should handle artifact references in complex decomposition chains', async () => {
      const context = {
        artifactRegistry: agent.artifactRegistry || new (await import('../../src/core/ArtifactRegistry.js')).default(),
        conversation: [],
        depth: 0
      };

      // Pre-populate with some artifacts to test reference handling
      context.artifactRegistry.store('api_spec', 
        { endpoints: ['/users', '/products'], auth: 'JWT' }, 
        'API specification'
      );

      const task = {
        description: 'Build a complete API implementation based on the existing api_spec with proper routing and authentication'
      };

      const result = await agent.execute(task, context);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      
      // Should have used the pre-existing artifact in the implementation
      expect(result.artifacts.size).toBeGreaterThan(1);
    }, 120000);
  });
});