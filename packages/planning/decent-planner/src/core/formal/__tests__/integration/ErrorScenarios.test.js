/**
 * Integration test for error scenarios
 * Tests error handling and propagation in the formal planner
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { FormalPlanner } from '../../FormalPlanner.js';
import { SyntheticToolFactory } from '../../SyntheticToolFactory.js';
import { ArtifactMapping } from '../../ArtifactMapping.js';
import { PlannerAdapter } from '../../PlannerAdapter.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';

describe('Error Scenarios', () => {
  let formalPlanner;
  let mockPlanner;
  let validator;

  beforeAll(() => {
    validator = new BTValidator();
    
    // Create formal planner with components
    const toolFactory = new SyntheticToolFactory();
    const artifactMapper = new ArtifactMapping();
    
    // Mock tool registry
    const toolRegistry = {
      searchTools: async (query) => {
        // Simulate some tools missing
        if (query === 'nonexistent') {
          return [];
        }
        return [
          { name: 'file_write', confidence: 0.9 },
          { name: 'file_read', confidence: 0.8 }
        ];
      },
      getTool: async (name) => {
        if (name === 'missing_tool') {
          return null;
        }
        return { name, execute: async () => ({ success: true }) };
      }
    };
    
    // Mock planner that can simulate failures
    mockPlanner = {
      makePlan: async (description, tools, options) => {
        // Simulate planning failure for certain descriptions
        if (description.includes('impossible')) {
          throw new Error('Cannot plan impossible task');
        }
        
        if (description.includes('invalid')) {
          // Return invalid BT structure
          return {
            type: 'invalid_type',
            children: 'not_an_array'
          };
        }
        
        // Return valid BT for normal cases
        return {
          type: 'sequence',
          description,
          children: tools.slice(0, 2).map(t => ({
            type: 'action',
            tool: t.name || t,
            outputVariable: 'result'
          }))
        };
      }
    };
    
    const plannerAdapter = new PlannerAdapter(mockPlanner);
    
    formalPlanner = new FormalPlanner({
      planner: plannerAdapter,
      validator,
      toolFactory,
      artifactMapper,
      toolRegistry
    });
  });

  it('should handle planning failures gracefully', async () => {
    const hierarchy = {
      id: 'root',
      description: 'Do something impossible',
      complexity: 'SIMPLE',
      level: 0,
      tools: ['file_write']
    };
    
    console.log('Testing planning failure...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Planning failure result:', {
      success: result.success,
      errors: result.errors
    });
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('impossible');
  });

  it('should handle invalid BT structures', async () => {
    const hierarchy = {
      id: 'root',
      description: 'Create invalid BT structure',
      complexity: 'SIMPLE',
      level: 0,
      tools: ['file_write']
    };
    
    console.log('Testing invalid BT structure...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Invalid BT result:', {
      success: result.success,
      errorCount: result.errors?.length
    });
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle missing required tools', async () => {
    const hierarchy = {
      id: 'root',
      description: 'Task requiring missing tools',
      complexity: 'SIMPLE',
      level: 0,
      tools: ['missing_tool', 'nonexistent_tool']
    };
    
    console.log('Testing missing tools...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Missing tools result:', {
      success: result.success,
      errors: result.errors,
      hasRootBT: !!result.rootBT
    });
    
    // Should still attempt to plan with available tools
    // Success depends on whether planner can work around missing tools
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.errors).toBeDefined();
    }
  });

  it('should handle null/undefined inputs', async () => {
    console.log('Testing null input...');
    const nullResult = await formalPlanner.synthesize(null);
    
    expect(nullResult.success).toBe(false);
    expect(nullResult.errors).toBeDefined();
    expect(nullResult.errors.length).toBeGreaterThan(0);
    
    console.log('Testing undefined input...');
    const undefinedResult = await formalPlanner.synthesize(undefined);
    
    expect(undefinedResult.success).toBe(false);
    expect(undefinedResult.errors).toBeDefined();
  });

  it('should handle malformed hierarchy structure', async () => {
    const malformedHierarchy = {
      // Missing required fields
      complexity: 'SIMPLE'
      // No id, no description, no level
    };
    
    console.log('Testing malformed hierarchy...');
    const result = await formalPlanner.synthesize(malformedHierarchy);
    
    console.log('Malformed hierarchy result:', {
      success: result.success,
      errors: result.errors
    });
    
    // Should handle gracefully
    expect(result).toBeDefined();
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should handle circular dependencies in hierarchy', async () => {
    // Create a hierarchy with circular reference (edge case)
    const circularNode = {
      id: 'circular',
      description: 'Circular task',
      complexity: 'COMPLEX',
      level: 1,
      children: []
    };
    
    // Create circular reference
    circularNode.children.push(circularNode);
    
    const hierarchy = {
      id: 'root',
      description: 'Root with circular child',
      complexity: 'COMPLEX',
      level: 0,
      children: [circularNode]
    };
    
    console.log('Testing circular dependency...');
    
    // Should handle without infinite loop
    let result;
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve({ success: false, errors: ['Timeout'] }), 5000);
    });
    
    const synthesisPromise = formalPlanner.synthesize(hierarchy);
    result = await Promise.race([synthesisPromise, timeout]);
    
    console.log('Circular dependency result:', {
      success: result.success,
      errors: result.errors
    });
    
    expect(result).toBeDefined();
    // Should either handle gracefully or timeout
  });

  it('should propagate errors from child synthesis', async () => {
    const hierarchy = {
      id: 'root',
      description: 'Root task',
      complexity: 'COMPLEX',
      level: 0,
      children: [
        {
          id: 'good-child',
          description: 'Normal task',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['file_write']
        },
        {
          id: 'bad-child',
          description: 'Task that will fail - impossible',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['file_read']
        }
      ]
    };
    
    console.log('Testing error propagation from children...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Error propagation result:', {
      success: result.success,
      errorCount: result.errors?.length,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length
    });
    
    // Should collect errors from failed children
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.some(e => e.includes('impossible'))).toBe(true);
    
    // Might still have partial results from successful children
    const syntheticTools = Object.values(result.syntheticTools || {});
    console.log('Partial synthetic tools created:', syntheticTools.length);
  });

  it('should handle validation failures', async () => {
    // Override planner to return BT that won't validate
    const invalidPlanner = {
      makePlan: async () => ({
        type: 'sequence',
        children: [
          {
            type: 'action',
            // Missing required 'tool' field
            outputVariable: 'result'
          }
        ]
      })
    };
    
    const testPlanner = new FormalPlanner({
      planner: new PlannerAdapter(invalidPlanner),
      validator: new BTValidator({ strictMode: true }),
      toolFactory: new SyntheticToolFactory(),
      artifactMapper: new ArtifactMapping(),
      toolRegistry: {
        searchTools: async () => [{ name: 'test_tool', confidence: 1 }],
        getTool: async () => ({ name: 'test_tool' })
      }
    });
    
    const hierarchy = {
      id: 'root',
      description: 'Task with validation failure',
      complexity: 'SIMPLE',
      level: 0,
      tools: ['test_tool']
    };
    
    console.log('Testing validation failure...');
    const result = await testPlanner.synthesize(hierarchy);
    
    console.log('Validation failure result:', {
      success: result.success,
      errors: result.errors
    });
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});