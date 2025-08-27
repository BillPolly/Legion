/**
 * Tests for ProgressManager class
 * 
 * ProgressManager is responsible for managing and persisting progress
 * across different code generation phases and sessions.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ProgressManager } from '../../../src/tracking/ProgressManager.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

describe('ProgressManager', () => {
  let progressManager;

  beforeEach(() => {
    progressManager = new ProgressManager();
  });

  afterEach(async () => {
    // Clean up any temporary files or state
    if (progressManager) {
      await progressManager.clear();
      progressManager.destroy();
    }
  });

  describe('Constructor', () => {
    test('should create ProgressManager with default configuration', () => {
      expect(progressManager).toBeDefined();
      expect(progressManager.config).toBeDefined();
      expect(progressManager.config.autoSave).toBe(true);
      expect(progressManager.config.persistToFile).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customManager = new ProgressManager({
        autoSave: false,
        persistToFile: false,
        saveInterval: 5000
      });

      expect(customManager.config.autoSave).toBe(false);
      expect(customManager.config.persistToFile).toBe(false);
      expect(customManager.config.saveInterval).toBe(5000);
      
      customManager.destroy();
    });
  });

  describe('Progress Tracking', () => {
    test('should track phase progress', async () => {
      await progressManager.setPhaseProgress('planning', 50);
      
      const progress = await progressManager.getPhaseProgress('planning');
      expect(progress).toBe(50);
    });

    test('should track overall project progress', async () => {
      await progressManager.setPhaseProgress('planning', 100);
      await progressManager.setPhaseProgress('generation', 75);
      await progressManager.setPhaseProgress('testing', 25);
      
      const overallProgress = await progressManager.getOverallProgress();
      expect(overallProgress).toBeCloseTo(50, 1); // (100 + 75 + 25 + 0) / 4
    });

    test('should track task completion within phases', async () => {
      await progressManager.setTaskProgress('planning', 'requirements', 100);
      await progressManager.setTaskProgress('planning', 'architecture', 50);
      
      const phaseProgress = await progressManager.getPhaseProgress('planning');
      expect(phaseProgress).toBe(75); // (100 + 50) / 2
    });

    test('should get progress for all phases', async () => {
      await progressManager.setPhaseProgress('planning', 100);
      await progressManager.setPhaseProgress('generation', 50);
      await progressManager.setPhaseProgress('testing', 0);
      
      const allProgress = await progressManager.getAllProgress();
      expect(allProgress.planning).toBe(100);
      expect(allProgress.generation).toBe(50);
      expect(allProgress.testing).toBe(0);
    });
  });

  describe('Phase Management', () => {
    test('should register new phases', async () => {
      await progressManager.registerPhase('validation', {
        order: 4,
        weight: 1.0,
        tasks: ['unit-tests', 'integration-tests', 'e2e-tests']
      });
      
      const phases = await progressManager.getPhases();
      expect(phases.validation).toBeDefined();
      expect(phases.validation.order).toBe(4);
      expect(phases.validation.tasks).toHaveLength(3);
    });

    test('should get current active phase', async () => {
      await progressManager.setPhaseProgress('planning', 100);
      await progressManager.setPhaseProgress('generation', 50);
      
      const activePhase = await progressManager.getCurrentPhase();
      expect(activePhase).toBe('generation');
    });

    test('should mark phase as complete', async () => {
      await progressManager.completePhase('planning');
      
      const progress = await progressManager.getPhaseProgress('planning');
      expect(progress).toBe(100);
      
      const phaseInfo = await progressManager.getPhaseInfo('planning');
      expect(phaseInfo.completed).toBe(true);
      expect(phaseInfo.completedAt).toBeDefined();
    });

    test('should get next phase', async () => {
      await progressManager.completePhase('planning');
      
      const nextPhase = await progressManager.getNextPhase();
      expect(nextPhase).toBe('generation');
    });
  });

  describe('Task Management', () => {
    test('should track individual task progress', async () => {
      await progressManager.setTaskProgress('planning', 'requirements', 75);
      
      const taskProgress = await progressManager.getTaskProgress('planning', 'requirements');
      expect(taskProgress).toBe(75);
    });

    test('should list tasks for a phase', async () => {
      await progressManager.setTaskProgress('planning', 'requirements', 50);
      await progressManager.setTaskProgress('planning', 'architecture', 25);
      
      const tasks = await progressManager.getPhaseTasks('planning');
      expect(tasks).toHaveLength(2);
      expect(tasks.some(t => t.name === 'requirements')).toBe(true);
      expect(tasks.some(t => t.name === 'architecture')).toBe(true);
    });

    test('should mark task as complete', async () => {
      await progressManager.completeTask('planning', 'requirements');
      
      const taskInfo = await progressManager.getTaskInfo('planning', 'requirements');
      expect(taskInfo.progress).toBe(100);
      expect(taskInfo.completed).toBe(true);
      expect(taskInfo.completedAt).toBeDefined();
    });

    test('should get incomplete tasks', async () => {
      await progressManager.setTaskProgress('planning', 'requirements', 100);
      await progressManager.setTaskProgress('planning', 'architecture', 50);
      await progressManager.setTaskProgress('planning', 'dependencies', 0);
      
      const incompleteTasks = await progressManager.getIncompleteTasks('planning');
      expect(incompleteTasks).toHaveLength(2);
      expect(incompleteTasks.some(t => t.name === 'architecture')).toBe(true);
      expect(incompleteTasks.some(t => t.name === 'dependencies')).toBe(true);
    });
  });

  describe('Session Management', () => {
    test('should start new session', async () => {
      const sessionId = await progressManager.startSession('test-project');
      
      expect(sessionId).toBeDefined();
      
      const session = await progressManager.getCurrentSession();
      expect(session.id).toBe(sessionId);
      expect(session.projectName).toBe('test-project');
      expect(session.startedAt).toBeDefined();
    });

    test('should end current session', async () => {
      const sessionId = await progressManager.startSession('test-project');
      await progressManager.setPhaseProgress('planning', 50);
      
      await progressManager.endSession();
      
      const session = await progressManager.getSession(sessionId);
      expect(session.endedAt).toBeDefined();
      expect(session.finalProgress).toBeDefined();
    });

    test('should resume previous session', async () => {
      const sessionId = await progressManager.startSession('test-project');
      await progressManager.setPhaseProgress('planning', 75);
      await progressManager.endSession();
      
      await progressManager.resumeSession(sessionId);
      
      const progress = await progressManager.getPhaseProgress('planning');
      expect(progress).toBe(75);
    });

    test('should get session history', async () => {
      await progressManager.startSession('project-1');
      await progressManager.endSession();
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await progressManager.startSession('project-2');
      await progressManager.endSession();
      
      const sessions = await progressManager.getSessionHistory();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].projectName).toBe('project-2'); // Most recent first
      expect(sessions[1].projectName).toBe('project-1');
    });
  });

  describe('Progress Analytics', () => {
    test('should calculate completion statistics', async () => {
      await progressManager.setPhaseProgress('planning', 100);
      await progressManager.setPhaseProgress('generation', 75);
      await progressManager.setPhaseProgress('testing', 25);
      await progressManager.setPhaseProgress('validation', 0);
      
      const stats = await progressManager.getCompletionStats();
      expect(stats.totalPhases).toBe(4);
      expect(stats.completedPhases).toBe(1);
      expect(stats.inProgressPhases).toBe(2);
      expect(stats.pendingPhases).toBe(1);
      expect(stats.overallCompletion).toBeCloseTo(50, 0);
    });

    test('should calculate estimated time remaining', async () => {
      await progressManager.startSession('test-project');
      
      // Simulate some progress over time
      await progressManager.setPhaseProgress('planning', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      await progressManager.setPhaseProgress('planning', 100);
      
      const estimate = await progressManager.getTimeEstimate();
      expect(estimate.estimatedRemaining).toBeGreaterThan(0);
      expect(estimate.basedOnCurrentSpeed).toBe(true);
    });

    test('should track velocity metrics', async () => {
      await progressManager.startSession('test-project');
      
      // Add some delay and progress to calculate meaningful velocity
      await progressManager.setTaskProgress('planning', 'requirements', 50);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Complete some tasks
      await progressManager.completeTask('planning', 'requirements');
      await progressManager.completeTask('planning', 'architecture');
      
      const velocity = await progressManager.getVelocityMetrics();
      expect(velocity.tasksCompletedPerHour).toBeGreaterThan(0);
      expect(velocity.progressPerHour).toBeGreaterThan(0);
    });
  });

  describe('Milestone Tracking', () => {
    test('should create milestones', async () => {
      await progressManager.createMilestone('planning-complete', {
        description: 'Planning phase completed',
        targetDate: Date.now() + 86400000, // 1 day from now
        requiredPhases: ['planning']
      });
      
      const milestone = await progressManager.getMilestone('planning-complete');
      expect(milestone.description).toBe('Planning phase completed');
      expect(milestone.requiredPhases).toContain('planning');
    });

    test('should check milestone completion', async () => {
      await progressManager.createMilestone('planning-complete', {
        requiredPhases: ['planning']
      });
      
      await progressManager.completePhase('planning');
      
      const milestone = await progressManager.getMilestone('planning-complete');
      expect(milestone.completed).toBe(true);
      expect(milestone.completedAt).toBeDefined();
    });

    test('should get upcoming milestones', async () => {
      const tomorrow = Date.now() + 86400000;
      const nextWeek = Date.now() + 604800000;
      
      await progressManager.createMilestone('milestone-1', { targetDate: tomorrow });
      await progressManager.createMilestone('milestone-2', { targetDate: nextWeek });
      
      const upcoming = await progressManager.getUpcomingMilestones();
      expect(upcoming).toHaveLength(2);
      expect(upcoming[0].name).toBe('milestone-1'); // Sorted by date
    });
  });

  describe('Data Persistence', () => {
    test('should save progress to file', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-test-'));
      const manager = new ProgressManager({
        persistToFile: true,
        saveFilePath: path.join(tempDir, 'test-progress.json')
      });
      
      await manager.setPhaseProgress('planning', 75);
      await manager.save();
      
      // Should not throw
      expect(manager.isDirty()).toBe(false);
      
      manager.destroy();
    });

    test('should load progress from file', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-test-'));
      const saveFilePath = path.join(tempDir, 'test-progress-load.json');
      
      const manager1 = new ProgressManager({
        saveFilePath: saveFilePath
      });
      
      await manager1.setPhaseProgress('planning', 80);
      await manager1.save();
      manager1.destroy();
      
      const manager2 = new ProgressManager({
        saveFilePath: saveFilePath
      });
      
      await manager2.load();
      const progress = await manager2.getPhaseProgress('planning');
      expect(progress).toBe(80);
      
      manager2.destroy();
    });

    test('should handle auto-save', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-test-'));
      const manager = new ProgressManager({
        autoSave: true,
        saveInterval: 100, // 100ms for testing
        saveFilePath: path.join(tempDir, 'test-autosave.json')
      });
      
      await manager.setPhaseProgress('planning', 60);
      
      // Wait for auto-save
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(manager.isDirty()).toBe(false);
      
      manager.destroy();
    });
  });

  describe('Progress Validation', () => {
    test('should validate progress values', async () => {
      await expect(progressManager.setPhaseProgress('planning', -10))
        .rejects.toThrow('Progress must be between 0 and 100');
        
      await expect(progressManager.setPhaseProgress('planning', 150))
        .rejects.toThrow('Progress must be between 0 and 100');
    });

    test('should validate phase names', async () => {
      await expect(progressManager.setPhaseProgress('', 50))
        .rejects.toThrow('Phase name cannot be empty');
        
      await expect(progressManager.setPhaseProgress(null, 50))
        .rejects.toThrow('Phase name is required');
    });

    test('should validate task names', async () => {
      await expect(progressManager.setTaskProgress('planning', '', 50))
        .rejects.toThrow('Task name cannot be empty');
    });
  });

  describe('Progress Events', () => {
    test('should emit events on progress changes', async () => {
      const events = [];
      progressManager.on('progress-updated', (event) => {
        events.push(event);
      });
      
      await progressManager.setPhaseProgress('planning', 50);
      await progressManager.completePhase('planning');
      
      expect(events).toHaveLength(3); // progress, progress to 100, completion
      expect(events[0].type).toBe('phase-progress');
      expect(events[1].type).toBe('phase-progress');
      expect(events[2].type).toBe('phase-completed');
    });

    test('should emit milestone events', async () => {
      const events = [];
      progressManager.on('milestone-reached', (event) => {
        events.push(event);
      });
      
      await progressManager.createMilestone('test-milestone', {
        requiredPhases: ['planning']
      });
      
      await progressManager.completePhase('planning');
      
      expect(events).toHaveLength(1);
      expect(events[0].milestone).toBe('test-milestone');
    });
  });

  describe('Progress Rollback', () => {
    test('should create progress checkpoints', async () => {
      await progressManager.setPhaseProgress('planning', 75);
      const checkpointId = await progressManager.createCheckpoint('before-generation');
      
      expect(checkpointId).toBeDefined();
      
      const checkpoint = await progressManager.getCheckpoint(checkpointId);
      expect(checkpoint.progress.planning).toBe(75);
    });

    test('should rollback to checkpoint', async () => {
      await progressManager.setPhaseProgress('planning', 75);
      const checkpointId = await progressManager.createCheckpoint('test-checkpoint');
      
      await progressManager.setPhaseProgress('planning', 100);
      await progressManager.setPhaseProgress('generation', 50);
      
      await progressManager.rollbackToCheckpoint(checkpointId);
      
      const planningProgress = await progressManager.getPhaseProgress('planning');
      const generationProgress = await progressManager.getPhaseProgress('generation');
      
      expect(planningProgress).toBe(75);
      expect(generationProgress).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid phase names gracefully', async () => {
      await expect(progressManager.getPhaseProgress('nonexistent'))
        .resolves.toBe(0); // Should return 0 for unknown phases
    });

    test('should handle save errors gracefully', async () => {
      const manager = new ProgressManager({
        saveFilePath: '/invalid/path/progress.json'
      });
      
      await manager.setPhaseProgress('planning', 50);
      
      // Should not throw, just log warning
      await expect(manager.save()).resolves.not.toThrow();
      
      manager.destroy();
    });

    test('should handle concurrent updates', async () => {
      const promises = [
        progressManager.setPhaseProgress('planning', 25),
        progressManager.setPhaseProgress('planning', 50),
        progressManager.setPhaseProgress('planning', 75)
      ];
      
      await Promise.all(promises);
      
      // Should have the last value
      const progress = await progressManager.getPhaseProgress('planning');
      expect([25, 50, 75]).toContain(progress);
    });
  });
});