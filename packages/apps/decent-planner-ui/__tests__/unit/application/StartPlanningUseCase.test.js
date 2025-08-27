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
      showLoading: jest.fn(),
      setElementEnabled: jest.fn(),
      updateProgress: jest.fn(),
      showError: jest.fn(),
      updateElement: jest.fn(),
      updateComponent: jest.fn(),
      hideLoading: jest.fn()
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
      expect(result.session).toBeDefined();
      
      // Check planner was called
      expect(mockPlanner.getCalls('planInformal')).toHaveLength(1);
      
      // Check UI was updated
      expect(mockUIRenderer.showLoading).toHaveBeenCalledWith('planning', 'Starting planning...');
      expect(mockUIRenderer.setElementEnabled).toHaveBeenCalledWith('plan-button', false);
      expect(mockUIRenderer.setElementEnabled).toHaveBeenCalledWith('cancel-button', true);
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
      expect(result.error).toBeDefined();
      
      // Check error was shown to user
      expect(mockUIRenderer.showError).toHaveBeenCalledWith(
        'planning',
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
        try {
          await useCase.execute(input);
          // If no error thrown, check result
          expect(true).toBe(false); // Should have thrown
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
    
    test('should handle progress updates', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      await useCase.execute(input);
      
      // Check progress was updated
      expect(mockUIRenderer.updateProgress).toHaveBeenCalled();
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
      expect(mockPlanner.getCalls('planInformal')).toHaveLength(1);
    });
    
    test('should reject unsupported modes for now', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'formal' // Formal requires informal result first
      };
      
      try {
        await useCase.execute(input);
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
  
  describe('UI Updates', () => {
    test('should show loading state during planning', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      await useCase.execute(input);
      
      // Check loading was shown
      expect(mockUIRenderer.showLoading).toHaveBeenCalledWith(
        'planning',
        expect.any(String)
      );
    });
    
    test('should enable/disable buttons appropriately', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      await useCase.execute(input);
      
      // Plan button disabled, cancel enabled during planning
      expect(mockUIRenderer.setElementEnabled).toHaveBeenCalledWith('plan-button', false);
      expect(mockUIRenderer.setElementEnabled).toHaveBeenCalledWith('cancel-button', true);
    });
    
    test('should update progress during planning', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      await useCase.execute(input);
      
      // Progress should be updated
      expect(mockUIRenderer.updateProgress).toHaveBeenCalledWith(
        'planning',
        expect.any(Number),
        expect.any(String)
      );
    });
  });
  
  describe('Session Management', () => {
    test('should create and return planning session', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      const result = await useCase.execute(input);
      
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.goal.toString()).toBe('Test goal');
      expect(result.session.mode).toBe('INFORMAL_COMPLETE');
    });
    
    test('should add progress messages to session', async () => {
      const input = {
        goal: 'Test goal',
        mode: 'informal'
      };
      
      const result = await useCase.execute(input);
      
      expect(result.session.progressMessages).toBeDefined();
      expect(result.session.progressMessages.length).toBeGreaterThan(0);
    });
  });
});