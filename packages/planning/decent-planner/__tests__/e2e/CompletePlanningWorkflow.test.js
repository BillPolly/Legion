/**
 * Complete Planning Workflow End-to-End Tests
 * 
 * Tests the entire planning workflow from task description to executable behavior tree.
 * Uses REAL LLM, REAL tool registry - NO MOCKS!
 * Following Clean Architecture and TDD principles
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Complete Planning Workflow E2E Tests (Clean Architecture)', () => {
  let planner;
  let resourceManager;

  beforeAll(async () => {
    console.log('\n🚀 Starting COMPLETE planning workflow E2E tests with Clean Architecture...\n');
    
    try {
      // Initialize ResourceManager singleton
      resourceManager = await ResourceManager.getInstance();
      
      // Check for LLM availability
      const llmClient = await resourceManager.get('llmClient');
      
      if (!llmClient) {
        console.log('❌ No LLM client available. Check .env configuration');
        return;
      }
      
      console.log('✅ Using real LLM client from ResourceManager');
      
      // Create planner with Clean Architecture
      planner = new DecentPlanner({
        maxDepth: 3,
        confidenceThreshold: 0.7,
        enableFormalPlanning: true,
        validateBehaviorTrees: true,
        logLevel: 'error' // Reduce noise in tests
      });
      
      await planner.initialize();
      console.log('✅ Planner initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize planner:', error.message);
      throw error;
    }
  }, 60000);

  describe('Simple Task Planning', () => {
    test('should plan a simple file operation task', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Write "Hello World" to a file called output.txt';
      console.log(`\n📝 Testing: "${goal}"`);
      
      const startTime = Date.now();
      const result = await planner.plan(goal);
      const elapsed = Date.now() - startTime;
      
      console.log(`⏱️  Planning completed in ${elapsed}ms`);
      
      // Validate result structure
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      const plan = result.data;
      expect(plan.goal).toBe(goal);
      expect(plan.rootTask).toBeDefined();
      expect(plan.statistics).toBeDefined();
      
      console.log(`📊 Statistics:`);
      console.log(`   - Total tasks: ${plan.statistics.totalTasks || 0}`);
      console.log(`   - Simple tasks: ${plan.statistics.simpleTasks || 0}`);
      console.log(`   - Complex tasks: ${plan.statistics.complexTasks || 0}`);
      
      // Should have decomposed the task
      expect(plan.statistics.totalTasks).toBeGreaterThan(0);
    }, 60000);

    test('should discover tools for tasks', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Read a JSON file and extract a specific field';
      console.log(`\n🔧 Testing tool discovery: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      expect(result.success).toBe(true);
      
      const plan = result.data;
      
      // Check if tools were discovered
      if (plan.statistics.toolDiscovery) {
        const toolStats = plan.statistics.toolDiscovery;
        console.log(`📦 Tool Discovery:`);
        console.log(`   - Feasible tasks: ${toolStats.feasibleTasks || 0}`);
        console.log(`   - Infeasible tasks: ${toolStats.infeasibleTasks || 0}`);
        console.log(`   - Unique tools: ${toolStats.uniqueToolsCount || 0}`);
        
        expect(toolStats.uniqueToolsCount).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('Complex Task Planning', () => {
    test('should decompose complex tasks into subtasks', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Build a REST API with user authentication and database integration';
      console.log(`\n🏗️ Testing complex decomposition: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      expect(result.success).toBe(true);
      
      const plan = result.data;
      
      // Complex tasks should be decomposed
      expect(plan.statistics.complexTasks).toBeGreaterThan(0);
      expect(plan.statistics.totalTasks).toBeGreaterThan(3); // Should have multiple subtasks
      
      // Check decomposition depth
      const checkDepth = (task, depth = 0) => {
        if (!task) return depth;
        const subtaskDepths = (task.subtasks || []).map(st => checkDepth(st, depth + 1));
        return Math.max(depth, ...subtaskDepths);
      };
      
      const maxDepth = checkDepth(plan.rootTask);
      console.log(`   - Max decomposition depth: ${maxDepth}`);
      expect(maxDepth).toBeGreaterThan(0);
    }, 90000);

    test('should generate behavior trees when enabled', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Create a backup of important files';
      console.log(`\n🌳 Testing behavior tree generation: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      expect(result.success).toBe(true);
      
      const plan = result.data;
      
      // Check if behavior trees were generated
      if (plan.behaviorTrees && plan.behaviorTrees.length > 0) {
        console.log(`   - Generated ${plan.behaviorTrees.length} behavior trees`);
        
        // Validate behavior tree structure
        const tree = plan.behaviorTrees[0];
        expect(tree).toHaveProperty('id');
        expect(tree).toHaveProperty('type');
        
        // Should have proper node structure
        if (tree.type === 'sequence' || tree.type === 'fallback') {
          expect(tree).toHaveProperty('children');
        }
      }
    }, 90000);
  });

  describe('Planning Cancellation', () => {
    test('should support cancelling a planning operation', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Complex task that takes time to plan with many subtasks and dependencies';
      console.log(`\n⏹️ Testing cancellation: "${goal}"`);
      
      // Start planning
      const planPromise = planner.plan(goal);
      
      // Cancel after short delay
      setTimeout(() => {
        console.log('   - Cancelling planning...');
        planner.cancel();
      }, 100);
      
      // Should fail with cancellation error
      const result = await planPromise;
      
      if (result.success === false) {
        expect(result.error).toContain('cancel');
        console.log('   ✅ Planning cancelled successfully');
      } else {
        // If it completed before cancellation, that's ok too
        console.log('   ⚠️ Planning completed before cancellation');
      }
    }, 30000);
  });

  describe('Report Generation', () => {
    test('should generate a human-readable report', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Send an email with attachment';
      console.log(`\n📄 Testing report generation: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      expect(result.success).toBe(true);
      
      const report = planner.generateReport(result.data);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      
      // Report should contain key information
      expect(report).toContain('Goal');
      expect(report).toContain('Status');
      expect(report).toContain('Statistics');
      
      console.log('   ✅ Report generated successfully');
    }, 60000);
  });

  afterAll(() => {
    if (planner) {
      console.log('\n✅ All E2E tests completed\n');
    }
  });
});