/**
 * Simple test for ToolFeasibilityChecker without external dependencies
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ToolFeasibilityChecker } from '../../../src/core/informal/ToolFeasibilityChecker.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';

describe('Simple ToolFeasibilityChecker Test', () => {
  let checker;
  let mockRegistry;

  beforeAll(() => {
    // Create a mock registry that returns predictable results
    mockRegistry = {
      searchTools: async (query, options) => {
        console.log(`Mock search for: "${query}"`);
        
        // Return mock tools based on query
        if (query.toLowerCase().includes('file') || query.toLowerCase().includes('write')) {
          return [
            { name: 'writeFile', confidence: 0.9, description: 'Write content to a file' },
            { name: 'createFile', confidence: 0.8, description: 'Create a new file' },
            { name: 'saveJson', confidence: 0.7, description: 'Save JSON data to file' }
          ];
        }
        
        if (query.toLowerCase().includes('calculate') || query.toLowerCase().includes('sum')) {
          return [
            { name: 'calculate', confidence: 0.85, description: 'Perform calculations' },
            { name: 'sum', confidence: 0.75, description: 'Calculate sum of numbers' }
          ];
        }
        
        if (query.toLowerCase().includes('api') || query.toLowerCase().includes('http')) {
          return [
            { name: 'httpRequest', confidence: 0.8, description: 'Make HTTP requests' },
            { name: 'callAPI', confidence: 0.7, description: 'Call external APIs' }
          ];
        }
        
        // Default: no tools found
        return [];
      }
    };
    
    // Create checker with mock registry
    checker = new ToolFeasibilityChecker(mockRegistry, {
      confidenceThreshold: 0.6
    });
  });

  it('should find tools for file operations', async () => {
    console.log('\n🔍 Testing file operation task...');
    
    const task = new TaskNode({
      description: 'Write configuration data to a JSON file',
      complexity: 'SIMPLE',
      suggestedInputs: ['config object'],
      suggestedOutputs: ['config.json file']
    });

    const result = await checker.checkTaskFeasibility(task);
    
    console.log('Result:', result);
    console.log('Tools found:', result.tools.map(t => `${t.name} (${t.confidence})`));
    
    expect(result.feasible).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.tools[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('should find tools for calculations', async () => {
    console.log('\n🔍 Testing calculation task...');
    
    const task = new TaskNode({
      description: 'Calculate the sum of numbers in an array',
      complexity: 'SIMPLE',
      suggestedInputs: ['array of numbers'],
      suggestedOutputs: ['sum value']
    });

    const result = await checker.checkTaskFeasibility(task);
    
    console.log('Result:', result);
    console.log('Tools found:', result.tools.map(t => `${t.name} (${t.confidence})`));
    
    expect(result.feasible).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it('should handle tasks with no matching tools', async () => {
    console.log('\n🔍 Testing task with no tools...');
    
    const task = new TaskNode({
      description: 'Perform quantum entanglement analysis',
      complexity: 'SIMPLE'
    });

    const result = await checker.checkTaskFeasibility(task);
    
    console.log('Result:', result);
    
    expect(result.feasible).toBe(false);
    expect(result.tools.length).toBe(0);
    expect(result.reason).toContain('No tools found');
  });

  it('should skip tool discovery for COMPLEX tasks', async () => {
    console.log('\n🔍 Testing COMPLEX task...');
    
    const task = new TaskNode({
      description: 'Build a complete web application',
      complexity: 'COMPLEX'
    });

    const result = await checker.checkTaskFeasibility(task);
    
    console.log('Result:', result);
    
    expect(result.feasible).toBe(true);
    expect(result.tools.length).toBe(0);
    expect(result.reason).toContain('COMPLEX tasks do not require tools directly');
  });

  it('should check feasibility of task hierarchy', async () => {
    console.log('\n🔍 Testing task hierarchy...');
    
    // Create a hierarchy
    const root = new TaskNode({
      description: 'Process data files',
      complexity: 'COMPLEX',
      subtasks: [
        new TaskNode({
          description: 'Read input files',
          complexity: 'SIMPLE'
        }),
        new TaskNode({
          description: 'Calculate statistics',
          complexity: 'SIMPLE'
        }),
        new TaskNode({
          description: 'Write output file',
          complexity: 'SIMPLE'
        })
      ]
    });

    const result = await checker.checkHierarchyFeasibility(root);
    
    console.log('Hierarchy result:', result);
    
    expect(result.feasible).toBe(true);
    expect(result.simpleTasks).toBe(3);
    expect(result.feasibleTasks).toBeGreaterThan(0);
  });
});