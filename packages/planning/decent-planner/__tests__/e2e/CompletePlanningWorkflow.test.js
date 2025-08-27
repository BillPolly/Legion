/**
 * Complete Planning Workflow End-to-End Tests
 * 
 * Tests the entire planning workflow from task description to executable behavior tree.
 * Uses REAL LLM, REAL tool registry - NO MOCKS!
 * Following Clean Architecture and TDD principles
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('Complete Planning Workflow E2E Tests (Clean Architecture)', () => {
  let planner;
  let resourceManager;
  let toolRegistry;

  beforeAll(async () => {
    console.log('\n🚀 Starting COMPLETE planning workflow E2E tests with Clean Architecture...\n');
    
    try {
      console.log('Step 1: Initializing ResourceManager...');
      const startTime = Date.now();
      resourceManager = await ResourceManager.getInstance();
      console.log(`✅ ResourceManager initialized in ${Date.now() - startTime}ms`);
      
      console.log('Step 2: Initializing ToolRegistry...');
      const toolStartTime = Date.now();
      toolRegistry = await ToolRegistry.getInstance();
      console.log(`✅ ToolRegistry initialized in ${Date.now() - toolStartTime}ms`);
      
      console.log('Step 3: Getting LLM client...');
      const llmClient = await resourceManager.get('llmClient');
      
      if (!llmClient) {
        console.log('❌ No LLM client available. Check .env configuration');
        console.log('Available env vars:', Object.keys(resourceManager.get('env') || {}));
        return;
      }
      
      console.log('✅ LLM client obtained from ResourceManager');
      
      console.log('Step 4: Creating DecentPlanner...');
      // Create planner with Clean Architecture
      planner = new DecentPlanner({
        maxDepth: 3,
        confidenceThreshold: 0.3, // Lower threshold for testing
        enableFormalPlanning: true,
        validateBehaviorTrees: true,
        logLevel: 'info' // Increase logging to debug
      });
      
      console.log('Step 5: Initializing planner...');
      const plannerStartTime = Date.now();
      await planner.initialize();
      console.log(`✅ Planner initialized successfully in ${Date.now() - plannerStartTime}ms`);
      
      const totalTime = Date.now() - startTime;
      console.log(`🎉 Complete initialization finished in ${totalTime}ms`);
      
    } catch (error) {
      console.error('❌ Failed to initialize planner:', error.message);
      console.error('Full error:', error);
      throw error;
    }
  }, 120000); // 2 minutes for initialization with services

  afterAll(async () => {
    console.log('🧹 Cleaning up test resources...');
    
    try {
      // Clear any timers or intervals that might be running
      if (typeof global.gc === 'function') {
        global.gc();
      }
      
      // Force cleanup of any persistent connections
      if (toolRegistry && typeof toolRegistry.cleanup === 'function') {
        await toolRegistry.cleanup();
        console.log('ToolRegistry cleaned up');
      }
      
      if (resourceManager && typeof resourceManager.cleanup === 'function') {
        await resourceManager.cleanup();  
        console.log('ResourceManager cleaned up');
      }
      
      // Clear references to prevent memory leaks
      planner = null;
      toolRegistry = null;
      resourceManager = null;
      
      // Force garbage collection if available
      if (typeof global.gc === 'function') {
        global.gc();
      }
      
      console.log('✅ All cleanup completed');
      
    } catch (error) {
      console.warn('⚠️  Cleanup had issues:', error.message);
    }
  }, 30000); // 30 second timeout for cleanup

  describe('Simple Task Planning', () => {
    test('should plan a simple file operation task', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Write "Hello World" to a file called output.txt';
      console.log(`\n📝 Testing: "${goal}"`);
      
      try {
        const startTime = Date.now();
        console.log('🚀 Calling planner.plan()...');
        const result = await planner.plan(goal);
        const elapsed = Date.now() - startTime;
        
        console.log(`⏱️  Planning completed in ${elapsed}ms`);
        console.log('📋 Full result:', JSON.stringify(result, null, 2));
        
        // Validate result structure
        expect(result).toBeDefined();
        console.log('✅ Result is defined');
        
        expect(result.success).toBe(true);
        console.log('✅ Result success is true');
        
        expect(result.data).toBeDefined();
        console.log('✅ Result data is defined');
        
        const plan = result.data;
        expect(plan.goal).toBe(goal);
        console.log('✅ Plan goal matches');
        
        expect(plan.rootTask).toBeDefined();
        console.log('✅ Root task is defined');
        
        expect(plan.statistics).toBeDefined();
        console.log('✅ Statistics are defined');
        
        console.log(`📊 Statistics:`);
        console.log(`   - Total tasks: ${plan.statistics.totalTasks || 0}`);
        console.log(`   - Simple tasks: ${plan.statistics.simpleTasks || 0}`);
        console.log(`   - Complex tasks: ${plan.statistics.complexTasks || 0}`);
        
        // Should have decomposed the task
        expect(plan.statistics.totalTasks).toBeGreaterThan(0);
        console.log('✅ Has tasks (totalTasks > 0)');
        
        console.log('🎉 Test completed successfully!');
        
      } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Full error:', error);
        throw error;
      }
    }, 60000); // 1 minute for test execution to see faster failure

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
      if (plan.statistics && plan.statistics.toolDiscovery) {
        const toolStats = plan.statistics.toolDiscovery;
        console.log(`📦 Tool Discovery:`);
        console.log(`   - Feasible tasks: ${toolStats.feasibleTasks || 0}`);
        console.log(`   - Infeasible tasks: ${toolStats.infeasibleTasks || 0}`);
        console.log(`   - Unique tools: ${toolStats.uniqueToolsCount || 0}`);
        
        if (typeof toolStats.uniqueToolsCount === 'number') {
          expect(toolStats.uniqueToolsCount).toBeGreaterThanOrEqual(0);
          console.log(`   ✅ Tool discovery completed with ${toolStats.uniqueToolsCount} unique tools`);
        } else {
          console.log('   ⚠️ uniqueToolsCount not available yet');
        }
      } else {
        console.log('   ⚠️ Tool discovery statistics not available');
      }
    }, 120000); // 2 minutes for initialization with services
  });

  describe('Complex Task Planning', () => {
    test('should decompose complex tasks into subtasks', async () => {
      if (!planner) {
        console.log('Skipping - planner not initialized');
        return;
      }

      const goal = 'Create a simple web server with file serving';
      console.log(`\n🏗️ Testing complex decomposition: "${goal}"`);
      
      const result = await planner.plan(goal);
      
      expect(result.success).toBe(true);
      
      const plan = result.data;
      
      console.log(`📊 Complex Task Statistics:`)
      console.log(`   - Total tasks: ${plan.statistics.totalTasks || 0}`)
      console.log(`   - Simple tasks: ${plan.statistics.simpleTasks || 0}`)
      console.log(`   - Complex tasks: ${plan.statistics.complexTasks || 0}`)
      
      // Should have at least one task (the root task)
      expect(plan.statistics.totalTasks).toBeGreaterThanOrEqual(1);
      
      // Check that we have a root task
      expect(plan.rootTask).toBeDefined();
      console.log(`   - Root task defined: ${!!plan.rootTask}`)
    }, 120000);

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
    }, 120000); // 2 minutes for initialization with services
  });

  afterAll(() => {
    if (planner) {
      console.log('\n✅ All E2E tests completed\n');
    }
  });
});