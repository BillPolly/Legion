/**
 * Unit tests for ProgressCalculator
 * Tests percentage calculations, time estimation, and weighted progress
 */

import { jest } from '@jest/globals';
import { ProgressCalculator } from '../../../src/core/progress/ProgressCalculator.js';

describe('ProgressCalculator', () => {
  let calculator;
  let mockDateNow;

  beforeEach(() => {
    // Mock Date.now() for consistent testing
    mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1000000);
    calculator = new ProgressCalculator(5, {
      weights: { 'step1': 2, 'step2': 1, 'step3': 3 },
      baseTimePerStep: 1000
    });
  });

  afterEach(() => {
    mockDateNow.mockRestore();
  });

  describe('Basic Progress Calculation', () => {
    it('should initialize with correct default values', () => {
      const calc = new ProgressCalculator(10);
      
      expect(calc.totalSteps).toBe(10);
      expect(calc.completedSteps).toBe(0);
      expect(calc.calculatePercentage()).toBe(0);
    });

    it('should calculate percentage correctly', () => {
      expect(calculator.calculatePercentage()).toBe(0);
      
      calculator.completeStep('step1');
      expect(calculator.calculatePercentage()).toBe(20);
      
      calculator.completeStep('step2');
      expect(calculator.calculatePercentage()).toBe(40);
      
      calculator.completeStep('step3');
      calculator.completeStep('step4');
      calculator.completeStep('step5');
      expect(calculator.calculatePercentage()).toBe(100);
    });

    it('should handle zero total steps gracefully', () => {
      const calc = new ProgressCalculator(0);
      expect(calc.calculatePercentage()).toBe(0);
    });

    it('should allow percentage to exceed 100% when more steps completed than planned', () => {
      // Complete more steps than total
      for (let i = 0; i < 10; i++) {
        calculator.completeStep(`step${i}`);
      }
      expect(calculator.calculatePercentage()).toBe(200); // 10/5 = 200%
    });
  });

  describe('Time Estimation', () => {
    it('should return null for remaining time when no steps completed', () => {
      expect(calculator.estimateRemainingTime()).toBeNull();
    });

    it('should estimate remaining time correctly', () => {
      // Advance time and complete a step
      mockDateNow.mockReturnValue(1003000); // 3 seconds elapsed
      calculator.completeStep('step1');
      
      // Remaining time should be: (3000ms / 1 step) * 4 remaining steps = 12000ms
      expect(calculator.estimateRemainingTime()).toBe(12000);
    });

    it('should update estimates as more steps complete', () => {
      // Complete first step after 2 seconds
      mockDateNow.mockReturnValue(1002000);
      calculator.completeStep('step1');
      expect(calculator.estimateRemainingTime()).toBe(8000); // 2s * 4 remaining
      
      // Complete second step after 1 more second (total 3s, 2 steps = 1.5s avg)
      mockDateNow.mockReturnValue(1003000);
      calculator.completeStep('step2');
      expect(calculator.estimateRemainingTime()).toBe(4500); // 1.5s * 3 remaining
    });

    it('should handle varying step durations', () => {
      // First step takes 5 seconds
      mockDateNow.mockReturnValue(1005000);
      calculator.completeStep('step1');
      
      // Second step takes 1 second (total 6s, 2 steps = 3s avg)
      mockDateNow.mockReturnValue(1006000);
      calculator.completeStep('step2');
      
      expect(calculator.estimateRemainingTime()).toBe(9000); // 3s * 3 remaining
    });
  });

  describe('Weighted Progress', () => {
    it('should calculate weighted progress correctly', () => {
      const subtaskProgress = new Map([
        ['step1', 100], // weight 2
        ['step2', 50],  // weight 1  
        ['step3', 0]    // weight 3
      ]);
      
      // Weighted sum: (100*2 + 50*1 + 0*3) = 250
      // Total weight: (2 + 1 + 3) = 6
      // Result: 250/6 = 41.67 rounded to 42
      const weighted = calculator.calculateWeightedProgress(subtaskProgress);
      expect(weighted).toBe(Math.round(250/6));
    });

    it('should handle empty subtask progress', () => {
      const weighted = calculator.calculateWeightedProgress(new Map());
      expect(weighted).toBe(0);
    });

    it('should use default weight of 1 for unspecified tasks', () => {
      const subtaskProgress = new Map([
        ['unknown_task', 50]
      ]);
      
      const weighted = calculator.calculateWeightedProgress(subtaskProgress);
      expect(weighted).toBe(50); // 50*1 / 1 = 50
    });

    it('should handle multiple tasks with mixed weights', () => {
      const subtaskProgress = new Map([
        ['step1', 100],     // weight 2
        ['step2', 100],     // weight 1
        ['step3', 0],       // weight 3
        ['unknown', 60]     // weight 1 (default)
      ]);
      
      // Weighted sum: (100*2 + 100*1 + 0*3 + 60*1) = 360
      // Total weight: (2 + 1 + 3 + 1) = 7
      // Result: 360/7 = 51.43 rounded to 51
      const weighted = calculator.calculateWeightedProgress(subtaskProgress);
      expect(weighted).toBe(Math.round(360/7));
    });
  });

  describe('Step Tracking', () => {
    it('should track step start times', () => {
      calculator.startStep('step1');
      
      expect(calculator.stepStartTimes.has('step1')).toBe(true);
      expect(calculator.stepStartTimes.get('step1')).toBe(1000000);
    });

    it('should track step completion times', () => {
      calculator.startStep('step1');
      
      mockDateNow.mockReturnValue(1002000);
      calculator.completeStep('step1');
      
      expect(calculator.stepCompletionTimes.has('step1')).toBe(true);
      expect(calculator.stepCompletionTimes.get('step1')).toBe(2000); // Duration, not timestamp
      expect(calculator.completedSteps).toBe(1);
    });
  });

  describe('Subtask Progress Tracking', () => {
    it('should track subtask progress updates', () => {
      calculator.updateSubtaskProgress('task1', 25);
      calculator.updateSubtaskProgress('task2', 75);
      
      expect(calculator.subtaskProgress.get('task1')).toBe(25);
      expect(calculator.subtaskProgress.get('task2')).toBe(75);
    });

    it('should add new steps dynamically', () => {
      expect(calculator.totalSteps).toBe(5);
      
      calculator.addStep('newStep', 2);
      expect(calculator.totalSteps).toBe(6);
      expect(calculator.weights['newStep']).toBe(2);
    });

    it('should add step with default weight when weight not specified', () => {
      calculator.addStep('newStepDefault');
      expect(calculator.totalSteps).toBe(6);
      expect(calculator.weights['newStepDefault']).toBeUndefined(); // Default weight not stored
    });
  });

  describe('Progress Details', () => {
    it('should return comprehensive progress details', () => {
      calculator.startStep('step1');
      mockDateNow.mockReturnValue(1002000);
      calculator.completeStep('step1');
      
      calculator.updateSubtaskProgress('step2', 50);
      calculator.updateSubtaskProgress('step3', 25);
      
      const details = calculator.getProgressDetails();
      
      expect(details).toEqual({
        percentage: 20, // 1/5 steps completed
        weightedPercentage: expect.any(Number),
        completedSteps: 1,
        totalSteps: 5,
        elapsedTime: 2000,
        remainingTime: 8000,
        estimatedTotalTime: 10000,
        subtaskProgress: {
          'step1': 100, // From completeStep
          'step2': 50,
          'step3': 25
        },
        averageStepTime: 2000
      });
    });

    it('should handle empty progress details', () => {
      const details = calculator.getProgressDetails();
      expect(details.percentage).toBe(0);
      expect(details.completedSteps).toBe(0);
      expect(details.totalSteps).toBe(5);
      expect(details.remainingTime).toBeNull();
      expect(details.averageStepTime).toBeNull();
    });
  });

  describe('Time Estimation with Base Time', () => {
    it('should use base time per step for initial estimates', () => {
      const calc = new ProgressCalculator(4, { baseTimePerStep: 2000 });
      
      const initialTime = calc.estimateInitialTime(0.5); // 50% complexity
      // Formula: totalSteps * baseTimePerStep * (1 + complexity * 2)
      // 4 * 2000 * (1 + 0.5 * 2) = 4 * 2000 * 2 = 16000
      expect(initialTime).toBe(16000);
    });

    it('should handle complexity scaling correctly', () => {
      const calc = new ProgressCalculator(3, { baseTimePerStep: 1000 });
      
      expect(calc.estimateInitialTime(0)).toBe(3000);   // 3 * 1000 * 1 = 3000
      expect(calc.estimateInitialTime(0.5)).toBe(6000); // 3 * 1000 * (1 + 0.5 * 2) = 6000
      expect(calc.estimateInitialTime(1)).toBe(9000);   // 3 * 1000 * (1 + 1 * 2) = 9000
    });

    it('should handle high complexity values', () => {
      const calc = new ProgressCalculator(2, { baseTimePerStep: 1000 });
      
      // Very high complexity multiplier: 1 + (10 * 2) = 21
      const highComplexity = calc.estimateInitialTime(10); // 2 * 1000 * 21 = 42000
      expect(highComplexity).toBe(42000);
    });
  });

  describe('Error Handling', () => {
    it('should handle negative step counts gracefully', () => {
      const calc = new ProgressCalculator(-5);
      expect(calc.totalSteps).toBe(-5); // Keeps the value as-is
      expect(calc.calculatePercentage()).toBe(-0); // Division by negative returns -0
    });

    it('should handle invalid subtask progress values', () => {
      calculator.updateSubtaskProgress('task1', -10);  // Negative
      calculator.updateSubtaskProgress('task2', 150);  // Over 100
      
      expect(calculator.subtaskProgress.get('task1')).toBe(0);   // Should be clamped to 0
      expect(calculator.subtaskProgress.get('task2')).toBe(100); // Should be clamped to 100
    });

    it('should handle null/undefined step IDs gracefully', () => {
      expect(() => calculator.startStep(null)).not.toThrow();
      expect(() => calculator.completeStep(undefined)).not.toThrow();
      
      // completeStep increments completedSteps even for null/undefined stepId
      expect(calculator.completedSteps).toBe(1);
    });
  });
});