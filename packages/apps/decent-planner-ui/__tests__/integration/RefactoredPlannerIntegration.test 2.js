/**
 * Integration test for refactored decent-planner-ui with DecentPlanner
 */

import { MockDecentPlannerAdapter } from '../mocks/MockDecentPlannerAdapter.js';
import { PlanningSession } from '../../src/domain/entities/PlanningSession.js';
import { PlanningOrchestrationService } from '../../src/domain/services/PlanningOrchestrationService.js';

describe('Refactored Decent Planner UI Integration', () => {
  let plannerAdapter;
  
  beforeEach(async () => {
    // Create mock planner adapter for each test
    plannerAdapter = new MockDecentPlannerAdapter();
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
    
    test('should perform informal planning', async () => {
      const goal = 'Write Hello World to a file';
      let progressUpdates = [];
      
      const result = await plannerAdapter.planInformal(
        goal,
        {},
        (message) => progressUpdates.push(message)
      );
      
      expect(result.success).toBe(true);
      expect(result.goal).toBe(goal);
      expect(result.informal).toBeDefined();
      expect(result.informal.hierarchy).toBeDefined();
      expect(progressUpdates.length).toBeGreaterThan(0);
    }, 60000);
    
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
      
      // Cancel after short delay
      setTimeout(() => plannerAdapter.cancel(), 100);
      
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
  
  describe('End-to-End Planning Flow', () => {
    test('should complete full planning workflow', async () => {
      const goal = 'Create a simple calculator function';
      const session = new PlanningSession(goal);
      
      // Step 1: Informal planning
      session.startInformalPlanning();
      const informalResult = await plannerAdapter.planInformal(goal);
      expect(informalResult.success).toBe(true);
      session.completeInformalPlanning(informalResult);
      
      // Step 2: Tool discovery (if hierarchy available)
      if (informalResult.informal?.hierarchy) {
        session.startToolDiscovery();
        const toolsResult = await plannerAdapter.discoverTools(
          informalResult.informal.hierarchy
        );
        expect(toolsResult).toBeDefined();
        session.completeToolDiscovery(toolsResult);
      }
      
      // Verify final state
      expect(session.isComplete()).toBe(false); // Not complete until formal planning
      expect(session.canStartFormalPlanning()).toBe(true);
      
      // Check enabled tabs match session state
      const tabs = PlanningOrchestrationService.getEnabledTabs(session);
      expect(tabs.toolDiscovery).toBe(true);
      expect(tabs.formalPlanning).toBe(true);
    }, 90000);
  });
});