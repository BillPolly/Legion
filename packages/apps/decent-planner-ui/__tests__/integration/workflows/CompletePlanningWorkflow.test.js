/**
 * End-to-end workflow tests using all mock infrastructure
 */

import { jest } from '@jest/globals';
import { PlanningSession } from '../../../src/domain/entities/PlanningSession.js';
import { MockDecentPlannerAdapter } from '../../mocks/MockDecentPlannerAdapter.js';
import { MockWebSocketConnection } from '../../mocks/MockActorSystem.js';
import { StartPlanningUseCase } from '../../../src/application/use-cases/StartPlanningUseCase.js';
import { DiscoverToolsUseCase } from '../../../src/application/use-cases/DiscoverToolsUseCase.js';
import { SearchToolsUseCase } from '../../../src/application/use-cases/SearchToolsUseCase.js';

describe('Complete Planning Workflow E2E', () => {
  let mockPlanner;
  let mockConnection;
  let session;
  
  beforeEach(() => {
    mockPlanner = new MockDecentPlannerAdapter();
    mockConnection = new MockWebSocketConnection();
    session = null;
  });
  
  afterEach(() => {
    mockConnection.close();
    mockPlanner.reset();
  });
  
  describe('Full Planning Flow', () => {
    test('should complete informal -> tools -> formal workflow', async () => {
      // Step 1: Initialize infrastructure
      await mockPlanner.initialize();
      await mockConnection.connect('ws://localhost:8083/planner');
      
      // Step 2: Create session and start informal planning
      session = new PlanningSession('Create a web scraper');
      session.startInformalPlanning();
      
      const informalResult = await mockPlanner.planInformal(
        'Create a web scraper',
        {},
        (progress) => console.log('Progress:', progress)
      );
      
      expect(informalResult.success).toBe(true);
      expect(informalResult.informal.hierarchy).toBeDefined();
      
      session.completeInformalPlanning(informalResult.informal);
      expect(session.mode).toBe('INFORMAL_COMPLETE');
      
      // Step 3: Discover tools
      session.startToolDiscovery();
      
      const toolsResult = await mockPlanner.discoverTools(
        informalResult.informal.hierarchy
      );
      
      expect(toolsResult.tools).toBeDefined();
      expect(toolsResult.tools.length).toBeGreaterThan(0);
      
      session.completeToolDiscovery(toolsResult);
      expect(session.mode).toBe('TOOLS_DISCOVERED');
      
      // Step 4: Start formal planning
      session.startFormalPlanning();
      
      const formalResult = await mockPlanner.planFormal(informalResult.informal);
      
      expect(formalResult.success).toBe(true);
      expect(formalResult.behaviorTrees).toBeDefined();
      expect(formalResult.validation.valid).toBe(true);
      
      session.completeFormalPlanning(formalResult);
      expect(session.mode).toBe('COMPLETE');
      expect(session.isComplete()).toBe(true);
    });
    
    test('should handle workflow with use cases', async () => {
      // Setup use cases with mocks
      const mockUIRenderer = {
        showLoading: jest.fn(),
        setElementEnabled: jest.fn(),
        updateProgress: jest.fn(),
        showError: jest.fn(),
        updateElement: jest.fn(),
        updateComponent: jest.fn(),
        switchTab: jest.fn(),
        hideLoading: jest.fn()
      };
      
      const mockActorComm = {
        send: jest.fn(),
        onMessage: jest.fn()
      };
      
      const startPlanningUseCase = new StartPlanningUseCase({
        plannerService: mockPlanner,
        uiRenderer: mockUIRenderer,
        actorCommunication: mockActorComm
      });
      
      const discoverToolsUseCase = new DiscoverToolsUseCase({
        plannerService: mockPlanner,
        uiRenderer: mockUIRenderer
      });
      
      // Execute workflow
      const goal = 'Build a REST API';
      
      // Start informal planning
      const informalResult = await startPlanningUseCase.execute({
        goal,
        mode: 'informal'
      });
      
      expect(informalResult.success).toBe(true);
      session = informalResult.session;
      
      // Discover tools
      const toolsResult = await discoverToolsUseCase.execute({
        session
      });
      
      expect(toolsResult.success).toBe(true);
      expect(toolsResult.toolDiscoveryResult).toBeDefined();
      expect(toolsResult.toolDiscoveryResult.tools.length).toBeGreaterThan(0);
      
      // Formal planning not yet implemented in StartPlanningUseCase
      // Just verify we have informal result and tool discovery
      expect(session.mode).toBe('TOOLS_DISCOVERED');
      
      // Verify UI was updated throughout
      expect(mockUIRenderer.showLoading).toHaveBeenCalled();
      expect(mockUIRenderer.setElementEnabled).toHaveBeenCalled();
    });
  });
  
  describe('Tool Search Workflow', () => {
    test('should search tools with text search', async () => {
      const mockUIRenderer = {
        showLoading: jest.fn(),
        updateComponent: jest.fn(),
        showError: jest.fn()
      };
      
      const searchUseCase = new SearchToolsUseCase({
        plannerService: mockPlanner,
        uiRenderer: mockUIRenderer
      });
      
      const result = await searchUseCase.execute({
        query: 'file',
        searchType: 'TEXT',
        limit: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeLessThanOrEqual(10);
      
      // Verify all results contain 'file'
      result.results.forEach(tool => {
        const hasFileInName = tool.name.toLowerCase().includes('file');
        const hasFileInDesc = tool.description.toLowerCase().includes('file');
        expect(hasFileInName || hasFileInDesc).toBe(true);
      });
    });
    
    test('should search tools with semantic search', async () => {
      const mockUIRenderer = {
        showLoading: jest.fn(),
        updateComponent: jest.fn(),
        showError: jest.fn()
      };
      
      const searchUseCase = new SearchToolsUseCase({
        plannerService: mockPlanner,
        uiRenderer: mockUIRenderer
      });
      
      const result = await searchUseCase.execute({
        query: 'manage files on disk',
        searchType: 'SEMANTIC',
        limit: 5
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeLessThanOrEqual(5);
      
      // Results should have relevance scores
      result.results.forEach(tool => {
        expect(tool.relevance).toBeDefined();
        expect(tool.relevance).toBeGreaterThanOrEqual(0);
        expect(tool.relevance).toBeLessThanOrEqual(1);
      });
    });
  });
  
  describe('Error Recovery Workflow', () => {
    test('should handle cancellation during workflow', async () => {
      session = new PlanningSession('Test cancellation');
      
      // Start planning
      session.startInformalPlanning();
      const planPromise = mockPlanner.planInformal('Test cancellation');
      
      // Cancel after short delay - timing needs to be precise
      setTimeout(() => {
        session.cancel();
        mockPlanner.cancel();
      }, 15);
      
      await expect(planPromise).rejects.toThrow('cancelled');
      
      expect(session.mode).toBe('CANCELLED');
    });
    
    test('should recover from planning errors', async () => {
      session = new PlanningSession('Test error recovery');
      
      // Make planner fail first time
      mockPlanner.planInformal = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          goal: 'Test error recovery',
          informal: { hierarchy: { id: 'root' } }
        });
      
      // First attempt fails
      session.startInformalPlanning();
      
      try {
        await mockPlanner.planInformal('Test error recovery');
      } catch (error) {
        expect(error.message).toBe('Network error');
        session.setError(error);
      }
      
      expect(session.error).not.toBeNull();
      
      // Retry after error - reset to IDLE
      session.mode = 'IDLE';
      session.error = null;
      session.startInformalPlanning();
      
      const result = await mockPlanner.planInformal('Test error recovery');
      expect(result.success).toBe(true);
      
      session.completeInformalPlanning(result.informal);
      expect(session.error).toBeNull();
    });
  });
  
  describe('Concurrent Operations', () => {
    test('should handle multiple sessions simultaneously', async () => {
      const sessions = [];
      const promises = [];
      
      // Create multiple sessions
      for (let i = 1; i <= 3; i++) {
        const s = new PlanningSession(`Goal ${i}`);
        sessions.push(s);
        
        s.startInformalPlanning();
        promises.push(
          mockPlanner.planInformal(`Goal ${i}`).then(result => {
            s.completeInformalPlanning(result.informal);
            return result;
          })
        );
      }
      
      // Wait for all to complete
      const results = await Promise.all(promises);
      
      // Verify all succeeded
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.goal).toBe(`Goal ${index + 1}`);
      });
      
      sessions.forEach(s => {
        expect(s.mode).toBe('INFORMAL_COMPLETE');
      });
    });
    
    test('should handle tool search while planning', async () => {
      // Start planning
      const planPromise = mockPlanner.planInformal('Main task');
      
      // Do tool search concurrently
      const searchPromise = mockPlanner.searchTools('file', 'TEXT');
      
      // Both should complete successfully
      const [planResult, searchResult] = await Promise.all([
        planPromise,
        searchPromise
      ]);
      
      expect(planResult.success).toBe(true);
      expect(searchResult).toBeInstanceOf(Array);
      expect(searchResult.length).toBeGreaterThan(0);
    });
  });
  
  describe('State Persistence', () => {
    test('should maintain session state through workflow', async () => {
      const goal = 'Persistent task';
      session = new PlanningSession(goal);
      
      const stateHistory = [];
      
      // Track state changes
      const trackState = () => {
        stateHistory.push({
          mode: session.mode,
          hasInformal: session.hasInformalResult(),
          hasTools: session.hasToolDiscoveryResult(),
          hasFormal: session.hasFormalResult()
        });
      };
      
      trackState(); // Initial
      
      // Go through workflow
      session.startInformalPlanning();
      trackState();
      
      const informalResult = await mockPlanner.planInformal(goal);
      session.completeInformalPlanning(informalResult.informal);
      trackState();
      
      session.startToolDiscovery();
      trackState();
      
      const toolsResult = await mockPlanner.discoverTools(informalResult.informal.hierarchy);
      session.completeToolDiscovery(toolsResult);
      trackState();
      
      session.startFormalPlanning();
      trackState();
      
      const formalResult = await mockPlanner.planFormal(informalResult.informal);
      session.completeFormalPlanning(formalResult);
      trackState();
      
      // Verify state progression
      expect(stateHistory).toHaveLength(7);
      expect(stateHistory[0].mode).toBe('IDLE');
      expect(stateHistory[6].mode).toBe('COMPLETE');
      expect(stateHistory[6].hasInformal).toBe(true);
      expect(stateHistory[6].hasTools).toBe(true);
      expect(stateHistory[6].hasFormal).toBe(true);
    });
  });
  
  describe('Report Generation', () => {
    test('should generate planning report after completion', async () => {
      // Complete planning workflow
      const goal = 'Generate report task';
      session = new PlanningSession(goal);
      
      session.startInformalPlanning();
      const informalResult = await mockPlanner.planInformal(goal);
      session.completeInformalPlanning(informalResult.informal);
      
      session.startFormalPlanning();
      const formalResult = await mockPlanner.planFormal(informalResult.informal);
      session.completeFormalPlanning(formalResult);
      
      // Generate report
      const plan = {
        goal,
        informal: informalResult.informal,
        formal: formalResult,
        session: session.getSummary()
      };
      
      const report = mockPlanner.generateReport(plan);
      
      expect(report).toBeDefined();
      expect(report.summary).toContain('successfully');
      expect(report.markdown).toContain('# Planning Report');
      expect(report.details.goal).toBe(goal);
    });
  });
});