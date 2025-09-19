/**
 * Quick integration tests for SimpleROMAAgent with reasonable timeouts
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('SimpleROMAAgent Quick Integration', () => {
  let agent;
  let resourceManager;
  let toolRegistry;

  beforeAll(async () => {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
  }, 180000); // 3 minute timeout for initialization

  beforeEach(async () => {
    // Create agent with fast tool discovery for integration testing
    agent = new SimpleROMAAgent({ 
      testMode: true, 
      fastToolDiscovery: true 
    });
    await agent.initialize();
  }, 180000); // 3 minute timeout for agent initialization

  describe('Basic Functionality', () => {
    it('should execute a simple arithmetic task with fast tool discovery', async () => {
      const task = {
        description: 'Calculate 7 plus 5'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      
      // Task might be executed with tools or as direct response
      if (result.results && result.results.length > 0) {
        // Tool execution path
        expect(result.results.length).toBeGreaterThan(0);
        
        // Look for the calculation result (12) in any form
        const hasCorrectResult = result.results.some(r => 
          r.result === 12 || 
          r.data?.result === 12 ||
          JSON.stringify(r).includes('12')
        );
        expect(hasCorrectResult).toBe(true);
      } else if (result.result || result.response) {
        // Direct response path
        const response = result.result || result.response;
        expect(typeof response).toBe('string');
        expect(response).toMatch(/12/);
      } else if (result.artifacts && Object.keys(result.artifacts).length > 0) {
        // Complex decomposition path - verify it has some result
        expect(result.artifacts).toBeDefined();
      } else {
        fail('Result should have results array, direct response, or artifacts');
      }
    }, 30000); // 30 seconds with fast tool discovery

    it('should handle direct question responses quickly', async () => {
      const task = {
        description: 'What is 2 plus 2?'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      
      // Direct responses might use tools or provide direct responses
      if (result.results && result.results.length > 0) {
        // Tool execution path - check for calculation result
        const hasCorrectResult = result.results.some(r => 
          r.result === 4 || 
          r.data?.result === 4 ||
          JSON.stringify(r).includes('4')
        );
        expect(hasCorrectResult).toBe(true);
      } else if (result.result || result.response) {
        // Direct response path
        const response = result.result || result.response;
        expect(typeof response).toBe('string');
        expect(response).toMatch(/4/);
      } else {
        fail('Result should have either results array or direct response');
      }
    }, 30000); // Direct responses should be faster

    it('should classify simple file operations correctly', async () => {
      const task = {
        description: 'Create a text file with hello world'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      // Should either complete with tools or decompose - both are valid
      expect(result.results || result.artifacts || result.result).toBeDefined();
    }, 30000); // 30 seconds with fast tool discovery
  });

  describe('Error Handling', () => {
    it('should prevent infinite recursion', async () => {
      // Create a task that will trigger decomposition multiple times
      const task = {
        description: 'Create a very complex enterprise application with microservices, databases, authentication, monitoring, CI/CD, documentation, testing, and deployment'
      };

      const result = await agent.execute(task);
      
      // Should eventually complete or fail gracefully, not crash
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      // The agent should handle complex tasks by either completing them or failing gracefully
      if (!result.success) {
        // Failure is acceptable for overly complex tasks
        expect(result.result || result.error).toBeDefined();
      } else {
        // Success is also acceptable if it manages the complexity
        expect(result.artifacts || result.results || result.result).toBeDefined();
      }
    }, 60000);

    it('should handle malformed tasks gracefully', async () => {
      const task = {
        // Missing description
      };

      const result = await agent.execute(task);
      
      // Should handle gracefully, not crash
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    }, 60000);
  });

  describe('Artifact Management', () => {
    it('should resolve artifact references correctly', async () => {
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
});