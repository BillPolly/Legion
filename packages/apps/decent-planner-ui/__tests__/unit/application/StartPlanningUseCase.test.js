/**
 * Unit tests for StartPlanningUseCase
 */

import { jest } from '@jest/globals';
import { StartPlanningUseCase } from '../../../src/application/use-cases/StartPlanningUseCase.js';
import { MockDecentPlannerAdapter } from '../../mocks/MockDecentPlannerAdapter.js';

describe('StartPlanningUseCase', () => {
  let useCase;
  let mockPlanner;
  let mockUIRenderer;
  let mockActorComm;
  
  beforeEach(() => {
    // Create mocks
    mockPlanner = new MockDecentPlannerAdapter();
    
    mockUIRenderer = {
      updatePlanningState: jest.fn(),
      showProgress: jest.fn(),
      showError: jest.fn()
    };
    
    mockActorComm = {
      send: jest.fn(),
      onMessage: jest.fn()
    };
    
    // Create use case with mocks
    useCase = new StartPlanningUseCase({
      plannerService: mockPlanner,
      uiRenderer: mockUIRenderer,
      actorCommunication: mockActorComm
    });
  });
  
  describe('Execution', () => {
    test('should start informal planning successfully', async () => {
      const input = {
        goal: 'Write Hello World to a file',
        mode: 'informal'
      };
      
      const result = await useCase.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('session');
      expect(result.data).toHaveProperty('informalResult');
      
      // Check planner was called
      expect(mockPlanner.getCalls('planInformal')).toHaveLength(1);
      
      // Check UI was updated
      expect(mockUIRenderer.updatePlanningState).toHaveBeenCalled();
      expect(mockUIRenderer.showProgress).toHaveBeenCalled();
    });
    
    test('should handle planning errors gracefully', async () => {
      // Make planner fail
      mockPlanner.setMockResponse('planInformal', null);
      mockPlanner.planInformal = jest.fn().mockRejectedValue(new Error('Planning failed'));
      
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      const result = await useCase.execute(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Planning failed');
      
      // Check error was shown to user
      expect(mockUIRenderer.showError).toHaveBeenCalledWith(
        expect.stringContaining('Planning failed')
      );
    });
    
    test('should validate input parameters', async () => {
      const invalidInputs = [
        { goal: '', mode: 'informal' }, // Empty goal
        { goal: 'Test', mode: 'invalid' }, // Invalid mode
        { mode: 'informal' }, // Missing goal
        { goal: 'Test' } // Missing mode
      ];
      
      for (const input of invalidInputs) {
        const result = await useCase.execute(input);
        expect(result.success).toBe(false);
        expect(result.error).toContain('validation');
      }
    });
    
    test('should send actor messages when configured', async () => {
      mockActorComm.enabled = true;
      
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      await useCase.execute(input);
      
      // Check actor communication
      expect(mockActorComm.send).toHaveBeenCalledWith({
        type: 'plan-informal',
        data: expect.objectContaining({
          goal: 'Test goal'
        })
      });
    });
    
    test('should handle progress callbacks', async () => {
      const progressMessages = [];
      
      const input = {
        goal: 'Test goal',
        mode: 'informal',
        onProgress: (message) => progressMessages.push(message)
      };
      
      await useCase.execute(input);
      
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages).toContain('Starting informal planning...');
    });
  });
  
  describe('Mode Handling', () => {
    test('should handle informal mode', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      const result = await useCase.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.mode).toBe('informal');
      expect(mockPlanner.getCalls('planInformal')).toHaveLength(1);
    });
    
    test('should handle formal mode with existing informal result', async () => {
      // First do informal
      const informalInput = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      const informalResult = await useCase.execute(informalInput);
      expect(informalResult.success).toBe(true);
      
      // Then do formal
      const formalInput = {
        goal: 'Test goal',
        mode: 'formal',
        informalResult: informalResult.data.informalResult
      };
      
      const formalResult = await useCase.execute(formalInput);
      
      expect(formalResult.success).toBe(true);
      expect(formalResult.data.mode).toBe('formal');
      expect(mockPlanner.getCalls('planFormal')).toHaveLength(1);
    });
    
    test('should handle full mode (informal + formal)', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'full'
      };
      
      const result = await useCase.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.data.mode).toBe('full');
      
      // Should call both informal and formal
      expect(mockPlanner.getCalls('planInformal')).toHaveLength(1);
      expect(mockPlanner.getCalls('planFormal')).toHaveLength(1);
    });
  });
  
  describe('Context and Options', () => {
    test('should pass context to planner', async () => {
      const context = {
        previousPlan: { id: 'prev' },
        constraints: { maxDepth: 3 }
      };
      
      const input = {
        goal: 'Test goal',
        mode: 'informal',
        context
      };
      
      await useCase.execute(input);
      
      const calls = mockPlanner.getCalls('planInformal');
      expect(calls[0].args[1]).toEqual(context);
    });
    
    test('should respect timeout option', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal',
        options: { timeout: 1000 }
      };
      
      // Make planner slow
      mockPlanner.planInformal = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );
      
      const result = await useCase.execute(input);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 3000);
    
    test('should handle cancellation', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      // Start planning
      const planPromise = useCase.execute(input);
      
      // Cancel after short delay
      setTimeout(() => useCase.cancel(), 10);
      
      const result = await planPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancel');
      expect(mockPlanner.getCalls('cancel')).toHaveLength(1);
    });
  });
  
  describe('State Management', () => {
    test('should create and maintain session state', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      const result = await useCase.execute(input);
      
      const session = result.data.session;
      expect(session).toBeDefined();
      expect(session.goal).toBe('Test goal');
      expect(session.mode).toBe('INFORMAL_COMPLETE');
      expect(session.hasInformalResult()).toBe(true);
    });
    
    test('should update UI state during execution', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      await useCase.execute(input);
      
      // Check UI renderer was called with correct states
      const updateCalls = mockUIRenderer.updatePlanningState.mock.calls;
      
      // Should have at least: starting, in-progress, complete
      expect(updateCalls.length).toBeGreaterThanOrEqual(3);
      
      // Check first call was starting
      expect(updateCalls[0][0]).toMatchObject({
        mode: 'INFORMAL',
        status: 'starting'
      });
      
      // Check last call was complete
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[0]).toMatchObject({
        mode: 'INFORMAL_COMPLETE',
        status: 'complete'
      });
    });
    
    test('should preserve session across multiple operations', async () => {
      // Start informal
      const informalResult = await useCase.execute({
        goal: 'Test goal',
        mode: 'informal'
      });
      
      const sessionId = informalResult.data.session.id;
      
      // Continue with formal using same session
      const formalResult = await useCase.execute({
        goal: 'Test goal',
        mode: 'formal',
        sessionId,
        informalResult: informalResult.data.informalResult
      });
      
      // Session ID should be preserved
      expect(formalResult.data.session.id).toBe(sessionId);
      expect(formalResult.data.session.hasInformalResult()).toBe(true);
      expect(formalResult.data.session.hasFormalResult()).toBe(true);
    });
  });
});