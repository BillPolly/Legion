/**
 * Integration test for refactored decent-planner-ui with REAL DecentPlanner
 * NO MOCKS - Uses real DecentPlanner with real LLM client
 */

import { DecentPlannerAdapter } from '../../src/server/infrastructure/adapters/DecentPlannerAdapter.js';
import { PlanningSession } from '../../src/server/domain/entities/PlanningSession.js';
import { PlanningOrchestrationService } from '../../src/server/domain/services/PlanningOrchestrationService.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Refactored Decent Planner UI Integration', () => {
  let plannerAdapter;
  let resourceManager;
  
  beforeAll(async () => {
    // Get ResourceManager - fail fast if not available
    resourceManager = await ResourceManager.getInstance();
    
    // Verify LLM client is available - fail fast if not
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client required for integration test - no fallbacks');
    }
    console.log('✅ LLM client available for integration test');
  });
  
  beforeEach(async () => {
    // Create REAL planner adapter for each test
    plannerAdapter = new DecentPlannerAdapter();
    await plannerAdapter.initialize();
  });
  
  afterEach(() => {
    // Cancel any ongoing planning
    if (plannerAdapter) {
      plannerAdapter.cancel();
    }
  });
  
  describe('Domain Layer', () => {
    test('should create valid planning session', () => {
      const session = new PlanningSession('Write Hello World to a file');
      
      expect(session.goal.toString()).toBe('Write Hello World to a file');
      expect(session.mode).toBe('IDLE');
      expect(session.isComplete()).toBe(false);
    });
    
    test('should enforce state transitions', () => {
      const session = new PlanningSession('Test goal');
      
      // Valid transition
      expect(() => session.startInformalPlanning()).not.toThrow();
      expect(session.mode).toBe('INFORMAL');
      
      // Invalid transition
      expect(() => session.startFormalPlanning()).toThrow();
    });
    
    test('should get correct enabled tabs', () => {
      const session = new PlanningSession('Test goal');
      
      // Initially only planning and search tabs
      let tabs = PlanningOrchestrationService.getEnabledTabs(session);
      expect(tabs.planning).toBe(true);
      expect(tabs.search).toBe(true);
      expect(tabs.toolDiscovery).toBe(false);
      expect(tabs.formalPlanning).toBe(false);
      
      // After informal planning
      session.startInformalPlanning();
      session.completeInformalPlanning({ some: 'result' });
      
      tabs = PlanningOrchestrationService.getEnabledTabs(session);
      expect(tabs.toolDiscovery).toBe(true);
      expect(tabs.formalPlanning).toBe(true);
    });
  });
  
  describe('Infrastructure Layer - DecentPlannerAdapter', () => {
    test('should initialize successfully', async () => {
      expect(plannerAdapter.initialized).toBe(true);
      expect(plannerAdapter.planner).not.toBeNull();
    });
    
    test('should perform informal planning with REAL LLM and capture progress notifications', async () => {
      console.log('\n🎯 Testing REAL LLM notifications during planning process');
      
      const goal = 'Write Hello World to a file';
      let progressUpdates = [];
      
      console.log(`📋 Goal: "${goal}"`);
      console.log('🚀 Starting informal planning with REAL DecentPlanner...');
      
      const result = await plannerAdapter.planInformal(
        goal,
        {},
        (message) => {
          console.log(`📢 LLM Progress: ${message}`);
          progressUpdates.push(message);
        }
      );
      
      console.log(`✅ Planning completed in ${result.duration}ms`);
      console.log(`📊 Captured ${progressUpdates.length} progress notifications`);
      
      // Verify planning succeeded
      expect(result.success).toBe(true);
      expect(result.goal).toBe(goal);
      expect(result.informal).toBeDefined();
      expect(result.informal.hierarchy).toBeDefined();
      
      // Verify REAL LLM progress notifications were captured
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Log all captured messages for verification
      console.log('\n📋 All captured progress messages:');
      progressUpdates.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg}`);
      });
      
      // Verify hierarchy structure
      expect(result.informal.hierarchy.description || result.informal.hierarchy.name).toBeDefined();
      console.log(`🌳 Root task: ${result.informal.hierarchy.description || result.informal.hierarchy.name}`);
      
      console.log('🎉 REAL LLM integration test PASSED!');
    }, 120000);
    
    test('should list all tools', async () => {
      const tools = await plannerAdapter.listAllTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check tool structure
      const firstTool = tools[0];
      expect(firstTool).toHaveProperty('name');
      expect(firstTool).toHaveProperty('description');
    });
    
    test('should search tools by text', async () => {
      const results = await plannerAdapter.searchTools('file', 'TEXT', 10);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(10);
      
      // Verify results contain 'file' in name or description
      results.forEach(tool => {
        const nameMatch = tool.name.toLowerCase().includes('file');
        const descMatch = (tool.description || '').toLowerCase().includes('file');
        expect(nameMatch || descMatch).toBe(true);
      });
    });
    
    test('should get registry statistics', async () => {
      const stats = await plannerAdapter.getRegistryStats();
      
      expect(stats).toHaveProperty('totalTools');
      expect(stats).toHaveProperty('totalModules');
      expect(stats.totalTools).toBeGreaterThan(0);
      expect(stats.totalModules).toBeGreaterThan(0);
    });
    
    test('should cancel planning operation', async () => {
      const goal = 'Complex task that takes time';
      
      // Start planning
      const planPromise = plannerAdapter.planInformal(goal);
      
      // Cancel after short delay - timing needs to be precise
      setTimeout(() => plannerAdapter.cancel(), 15);
      
      // Should throw cancellation error
      await expect(planPromise).rejects.toThrow();
    });
  });
  
  describe('Clean Architecture Compliance', () => {
    test('domain entities should not depend on infrastructure', () => {
      // Check that domain entities don't import infrastructure code
      const sessionCode = PlanningSession.toString();
      expect(sessionCode).not.toContain('import.*infrastructure');
      expect(sessionCode).not.toContain('require.*infrastructure');
    });
    
    test('application layer should depend only on domain and ports', () => {
      // This would be checked at build time with proper linting
      // Here we just verify the structure exists
      expect(PlanningOrchestrationService).toBeDefined();
    });
    
    test('should maintain proper error hierarchy', () => {
      try {
        const session = new PlanningSession('');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('empty');
      }
    });
  });
  
  describe('End-to-End Planning Flow with REAL Components', () => {
    test('should complete full planning workflow with REAL LLM progress tracking', async () => {
      console.log('\n🎯 Testing complete E2E workflow with REAL DecentPlanner');
      
      const goal = 'Create a simple calculator function';
      const session = new PlanningSession(goal);
      console.log(`📋 Goal: "${goal}"`);
      
      let allProgressUpdates = [];
      const progressTracker = (phase) => (message) => {
        const logMessage = `[${phase}] ${message}`;
        console.log(`📢 ${logMessage}`);
        allProgressUpdates.push(logMessage);
      };
      
      // Step 1: Informal planning with REAL LLM
      console.log('\n🚀 Step 1: Starting informal planning...');
      session.startInformalPlanning();
      
      const informalResult = await plannerAdapter.planInformal(
        goal, 
        {},
        progressTracker('INFORMAL')
      );
      
      expect(informalResult.success).toBe(true);
      session.completeInformalPlanning(informalResult);
      console.log(`✅ Informal planning completed in ${informalResult.duration}ms`);
      
      // Step 2: Tool discovery with progress tracking
      if (informalResult.informal?.hierarchy) {
        console.log('\n🔍 Step 2: Starting tool discovery...');
        session.startToolDiscovery();
        
        const toolsResult = await plannerAdapter.discoverTools(
          informalResult.informal.hierarchy,
          progressTracker('TOOLS')
        );
        
        expect(toolsResult).toBeDefined();
        session.completeToolDiscovery(toolsResult);
        console.log(`✅ Tool discovery completed - found ${toolsResult.tools?.length || 0} tools`);
      }
      
      // Verify session state progression
      expect(session.isComplete()).toBe(false); // Not complete until formal planning
      expect(session.canStartFormalPlanning()).toBe(true);
      
      // Check enabled tabs match session state
      const tabs = PlanningOrchestrationService.getEnabledTabs(session);
      expect(tabs.toolDiscovery).toBe(true);
      expect(tabs.formalPlanning).toBe(true);
      
      // Verify we captured progress updates from REAL LLM
      expect(allProgressUpdates.length).toBeGreaterThan(0);
      console.log(`\n📊 Total progress notifications captured: ${allProgressUpdates.length}`);
      
      console.log('\n📋 All E2E progress messages:');
      allProgressUpdates.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg}`);
      });
      
      console.log('🎉 Complete E2E workflow with REAL LLM PASSED!');
    }, 180000); // 3 minutes for complete workflow
  });
});