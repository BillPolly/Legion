/**
 * Integration tests for ToolFeasibilityChecker with real ToolRegistry
 * Tests actual tool discovery using semantic search
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ToolFeasibilityChecker } from '../../../src/core/informal/ToolFeasibilityChecker.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ToolFeasibilityChecker Live Integration', () => {
  let checker;
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager singleton
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();

    // Get ToolRegistry singleton and initialize it
    toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Create checker with real registry
    checker = new ToolFeasibilityChecker(toolRegistry, {
      confidenceThreshold: 0.6  // Lower threshold for testing
    });
    
    console.log('ToolRegistry initialized with semantic search:', toolRegistry.enableSemanticSearch);
  });

  describe('Real Tool Discovery', () => {
    it('should find file system tools for file operations', async () => {
      const task = new TaskNode({
        description: 'Write configuration data to a JSON file',
        complexity: 'SIMPLE',
        suggestedInputs: ['config object'],
        suggestedOutputs: ['config.json file']
      });

      const result = await checker.checkTaskFeasibility(task);

      console.log('File operation tools found:', result.tools.map(t => ({
        name: t.name,
        confidence: t.confidence
      })));

      expect(result.feasible).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Should find file-related tools
      const toolNames = result.tools.map(t => t.name.toLowerCase());
      const hasFileTools = toolNames.some(name => 
        name.includes('file') || 
        name.includes('write') || 
        name.includes('fs')
      );
      expect(hasFileTools).toBe(true);
    });

    it('should find calculation tools for math operations', async () => {
      const task = new TaskNode({
        description: 'Calculate the sum of numbers in an array',
        complexity: 'SIMPLE',
        suggestedInputs: ['array of numbers'],
        suggestedOutputs: ['sum value']
      });

      const result = await checker.checkTaskFeasibility(task);

      console.log('Calculation tools found:', result.tools.map(t => ({
        name: t.name,
        confidence: t.confidence
      })));

      expect(result.feasible).toBe(true);
      
      // Should find calculation-related tools
      const toolNames = result.tools.map(t => t.name.toLowerCase());
      const hasCalcTools = toolNames.some(name => 
        name.includes('calc') || 
        name.includes('sum') || 
        name.includes('math') ||
        name.includes('add')
      );
      
      if (!hasCalcTools) {
        console.log('Warning: No calculation tools found. Available tools:', toolNames);
      }
    });

    it('should find HTTP tools for API operations', async () => {
      const task = new TaskNode({
        description: 'Make an HTTP GET request to fetch user data from API',
        complexity: 'SIMPLE',
        suggestedInputs: ['API endpoint', 'auth token'],
        suggestedOutputs: ['user data JSON']
      });

      const result = await checker.checkTaskFeasibility(task);

      console.log('HTTP tools found:', result.tools.map(t => ({
        name: t.name,
        confidence: t.confidence
      })));

      expect(result.feasible).toBe(true);
      
      // Should find HTTP-related tools
      const toolNames = result.tools.map(t => t.name.toLowerCase());
      const hasHttpTools = toolNames.some(name => 
        name.includes('http') || 
        name.includes('request') || 
        name.includes('fetch') ||
        name.includes('api')
      );
      
      if (!hasHttpTools) {
        console.log('Warning: No HTTP tools found. Available tools:', toolNames);
      }
    });

    it('should mark infeasible when no matching tools exist', async () => {
      const task = new TaskNode({
        description: 'Perform quantum entanglement on photons',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      console.log('Quantum task result:', {
        feasible: result.feasible,
        toolsFound: result.tools.length,
        reason: result.reason
      });

      // Should either be infeasible or have very low confidence tools
      if (result.feasible) {
        // If feasible, tools should have low relevance
        expect(result.tools[0].confidence).toBeLessThan(0.8);
      } else {
        expect(result.reason).toBeDefined();
      }
    });
  });

  describe('Hierarchy Feasibility with Real Tools', () => {
    it('should validate a complete task hierarchy', async () => {
      // Build a realistic hierarchy
      const root = new TaskNode({
        description: 'Build a data processing pipeline',
        complexity: 'COMPLEX'
      });

      const readTask = new TaskNode({
        description: 'Read data from CSV file',
        complexity: 'SIMPLE',
        suggestedInputs: ['file path'],
        suggestedOutputs: ['data array']
      });

      const processTask = new TaskNode({
        description: 'Transform and filter the data',
        complexity: 'SIMPLE',
        suggestedInputs: ['data array'],
        suggestedOutputs: ['processed data']
      });

      const writeTask = new TaskNode({
        description: 'Write results to output file',
        complexity: 'SIMPLE',
        suggestedInputs: ['processed data'],
        suggestedOutputs: ['output file']
      });

      root.addSubtask(readTask);
      root.addSubtask(processTask);
      root.addSubtask(writeTask);

      const result = await checker.checkHierarchyFeasibility(root);

      console.log('Hierarchy feasibility:', {
        feasible: result.feasible,
        totalTasks: result.totalTasks,
        simpleTasks: result.simpleTasks,
        feasibleTasks: result.feasibleTasks,
        infeasibleTasks: result.infeasibleTasks
      });

      expect(result.totalTasks).toBe(4);
      expect(result.simpleTasks).toBe(3);
      
      // Should find tools for common operations
      expect(result.feasibleTasks).toBeGreaterThan(0);
      
      // Generate and log report
      const report = checker.generateReport(result);
      console.log('\nFeasibility Report:\n', report);
    });

    it('should identify partially feasible hierarchies', async () => {
      const root = new TaskNode({
        description: 'Build advanced system',
        complexity: 'COMPLEX'
      });

      const feasibleTask = new TaskNode({
        description: 'Create configuration file',
        complexity: 'SIMPLE'
      });

      const questionableTask = new TaskNode({
        description: 'Implement neural network from scratch',
        complexity: 'SIMPLE'
      });

      root.addSubtask(feasibleTask);
      root.addSubtask(questionableTask);

      const result = await checker.checkHierarchyFeasibility(root);

      console.log('Mixed feasibility result:', {
        feasible: result.feasible,
        feasibleTasks: result.feasibleTasks,
        infeasibleTasks: result.infeasibleTasks.map(t => t.task)
      });

      expect(result.totalTasks).toBe(3);
      expect(result.simpleTasks).toBe(2);
      
      // At least one task should be feasible
      expect(result.feasibleTasks).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tool Confidence and Filtering', () => {
    it('should respect confidence thresholds', async () => {
      const strictChecker = new ToolFeasibilityChecker(toolRegistry, {
        confidenceThreshold: 0.9  // Very high threshold
      });

      const task = new TaskNode({
        description: 'Perform a vague operation on some data',
        complexity: 'SIMPLE'
      });

      const result = await strictChecker.checkTaskFeasibility(task);

      console.log('High threshold result:', {
        feasible: result.feasible,
        toolCount: result.tools.length,
        topConfidence: result.tools[0]?.confidence
      });

      if (result.feasible) {
        // All tools should have high confidence
        result.tools.forEach(tool => {
          expect(tool.confidence).toBeGreaterThanOrEqual(0.9);
        });
      }
    });

    it('should limit number of tools returned', async () => {
      const limitedChecker = new ToolFeasibilityChecker(toolRegistry, {
        maxTools: 3,
        confidenceThreshold: 0.5
      });

      const task = new TaskNode({
        description: 'Process data and save results',
        complexity: 'SIMPLE'
      });

      const result = await limitedChecker.checkTaskFeasibility(task);

      console.log('Limited tools:', result.tools.length);

      expect(result.tools.length).toBeLessThanOrEqual(3);
      
      // Should be sorted by confidence
      for (let i = 1; i < result.tools.length; i++) {
        expect(result.tools[i-1].confidence).toBeGreaterThanOrEqual(result.tools[i].confidence);
      }
    });
  });
});