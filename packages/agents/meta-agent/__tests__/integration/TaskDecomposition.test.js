/**
 * Integration tests for task decomposition functionality
 */

import { jest } from '@jest/globals';
import { AgentCreator } from '../../src/AgentCreator.js';
import { ResourceManager } from '@legion/resource-manager';
import { InformalPlanner } from '../../../../planning/decent-planner/src/index.js';

describe('Task Decomposition Integration', () => {
  let agentCreator;
  let resourceManager;
  let informalPlanner;

  beforeEach(async () => {
    jest.setTimeout(60000); // 60 second timeout for LLM calls
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create AgentCreator with real components
    agentCreator = new AgentCreator(resourceManager);
    await agentCreator.initialize();
    
    // Get the real InformalPlanner instance
    informalPlanner = agentCreator.informalPlanner;
  });

  afterEach(async () => {
    if (agentCreator) {
      await agentCreator.cleanup();
    }
  });

  describe('Real Task Decomposition', () => {
    test('should decompose a simple task into subtasks', async () => {
      const requirements = {
        purpose: 'Create a simple calculator',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.description).toBeDefined();
      expect(result.hierarchy.complexity).toBeDefined();
      
      // Should identify this as a simple task
      expect(result.hierarchy.complexity).toBe('SIMPLE');
    });

    test('should decompose a simple multi-step task', async () => {
      const requirements = {
        purpose: 'Read a file and display its content',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.hierarchy).toBeDefined();
      
      // Should be simple or moderate complexity
      expect(['SIMPLE', 'MODERATE']).toContain(result.hierarchy.complexity);
      
      // Should have some subtasks or be atomic
      if (result.hierarchy.subtasks) {
        expect(result.hierarchy.subtasks.length).toBeLessThanOrEqual(3);
      }
    });

    test('should identify simple data flow', async () => {
      const requirements = {
        purpose: 'Read a text file and count the words',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Should have data flow information (even for simple tasks)
      expect(result.dataFlow).toBeDefined();
    });

    test('should handle simple automation tasks', async () => {
      const requirements = {
        purpose: 'Copy files from one directory to another',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(['SIMPLE', 'MODERATE']).toContain(result.hierarchy.complexity);
    });

    test('should provide tool suggestions for simple tasks', async () => {
      const requirements = {
        purpose: 'Create a simple text reader',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Should suggest tools for the task
      expect(result.tools).toBeDefined();
      expect(result.tools.size).toBeGreaterThan(0);
      
      // Should include file-related tools
      const toolNames = Array.from(result.tools);
      expect(toolNames.some(name => 
        name.includes('file') || name.includes('read') || name.includes('text')
      )).toBe(true);
    });

    test('should handle simple creative tasks', async () => {
      const requirements = {
        purpose: 'Create a simple text generator',
        taskType: 'creative'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.hierarchy).toBeDefined();
      
      // Simple creative tasks should be straightforward
      expect(['SIMPLE', 'MODERATE']).toContain(result.hierarchy.complexity);
    });

    test('should handle conversational agents as simple tasks', async () => {
      const requirements = {
        purpose: 'Create a customer support chatbot',
        taskType: 'conversational'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.hierarchy).toBeDefined();
      
      // Conversational agents are typically simpler
      expect(['SIMPLE', 'MODERATE']).toContain(result.hierarchy.complexity);
      
      // May not have many subtasks
      if (result.hierarchy.subtasks) {
        expect(result.hierarchy.subtasks.length).toBeLessThanOrEqual(3);
      }
    });

    test('should respect decomposition constraints', async () => {
      const requirements = {
        purpose: 'Create a complex system with many interdependent parts',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Check that constraints are respected
      const checkDepth = (node, depth = 0) => {
        if (depth > 3) return false; // Max depth should be 3
        if (node.subtasks) {
          if (node.subtasks.length > 5) return false; // Max 5 subtasks
          return node.subtasks.every(subtask => checkDepth(subtask, depth + 1));
        }
        return true;
      };
      
      expect(checkDepth(result.hierarchy)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid requirements gracefully', async () => {
      const requirements = {
        purpose: '', // Empty purpose
        taskType: 'task'
      };

      await expect(agentCreator.decomposeRequirements(requirements))
        .rejects.toThrow();
    });

    test('should handle extremely vague requirements', async () => {
      const requirements = {
        purpose: 'Do something',
        taskType: 'task'
      };

      const result = await agentCreator.decomposeRequirements(requirements);

      // Should still produce some result, even if simple
      expect(result).toBeDefined();
      expect(result.hierarchy).toBeDefined();
      expect(result.hierarchy.complexity).toBe('SIMPLE');
    });
  });

  describe('Performance', () => {
    test('should decompose within reasonable time', async () => {
      const requirements = {
        purpose: 'Create a web scraper that extracts data and saves it',
        taskType: 'task'
      };

      const startTime = Date.now();
      const result = await agentCreator.decomposeRequirements(requirements);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    });

    test('should handle multiple decompositions efficiently', async () => {
      const requirements = [
        { purpose: 'Create a calculator', taskType: 'task' },
        { purpose: 'Build a chat bot', taskType: 'conversational' },
        { purpose: 'Make a data analyzer', taskType: 'analytical' }
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        requirements.map(req => agentCreator.decomposeRequirements(req))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
      
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(60000); // 60 seconds for all three
    });
  });
});

// Helper function to check for nested complexity
function checkForNestedComplexity(node, depth = 0) {
  if (depth > 0 && node.complexity === 'COMPLEX') {
    return true;
  }
  
  if (node.subtasks) {
    return node.subtasks.some(subtask => 
      checkForNestedComplexity(subtask, depth + 1)
    );
  }
  
  return false;
}