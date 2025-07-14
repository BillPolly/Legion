/**
 * Tests for StateManager - State persistence and management
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { StateManager } from '../../src/config/StateManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('StateManager', () => {
  let manager;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp', `state-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new StateManager({ stateDir: testDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create StateManager with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.config).toBeDefined();
      expect(manager.initialized).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should initialize state manager', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);
    });
  });

  describe('State Persistence', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should save and load state', async () => {
      const state = {
        currentTask: 'test-task',
        progress: 50,
        files: ['file1.js', 'file2.js']
      };

      await manager.saveState('test-session', state);
      const loadedState = await manager.loadState('test-session');
      
      expect(loadedState).toEqual(state);
    });

    test('should handle non-existent state', async () => {
      const state = await manager.loadState('non-existent');
      expect(state).toBeNull();
    });

    test('should save current working state', async () => {
      const workingState = {
        workingDirectory: '/test/dir',
        currentFiles: ['test.js'],
        lastOperation: 'generate'
      };

      manager.setCurrentState(workingState);
      await manager.saveCurrentState();
      
      const loaded = await manager.loadCurrentState();
      expect(loaded.workingDirectory).toBe(workingState.workingDirectory);
      expect(loaded.currentFiles).toEqual(workingState.currentFiles);
      expect(loaded.lastOperation).toBe(workingState.lastOperation);
      expect(loaded.timestamp).toBeDefined();
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should track task progress', async () => {
      manager.startTask('code-generation', {
        type: 'generate',
        target: 'frontend'
      });

      manager.updateTaskProgress('code-generation', 25);
      manager.updateTaskProgress('code-generation', 50);
      
      const task = manager.getCurrentTask();
      expect(task.id).toBe('code-generation');
      expect(task.progress).toBe(50);
    });

    test('should complete tasks', async () => {
      manager.startTask('test-task', { type: 'test' });
      manager.completeTask('test-task', { success: true });
      
      const completedTasks = manager.getCompletedTasks();
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].status).toBe('completed');
    });

    test('should handle task failures', async () => {
      manager.startTask('failing-task', { type: 'test' });
      manager.failTask('failing-task', 'Test error');
      
      const failedTasks = manager.getFailedTasks();
      expect(failedTasks).toHaveLength(1);
      expect(failedTasks[0].status).toBe('failed');
    });
  });

  describe('File Tracking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should track generated files', () => {
      manager.addGeneratedFile('src/test.js', {
        type: 'javascript',
        size: 1024
      });

      const files = manager.getGeneratedFiles();
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('src/test.js');
    });

    test('should track test files', () => {
      manager.addTestFile('tests/test.test.js', {
        type: 'jest',
        coverage: 85
      });

      const testFiles = manager.getTestFiles();
      expect(testFiles).toHaveLength(1);
      expect(testFiles[0].metadata.coverage).toBe(85);
    });

    test('should remove files from tracking', () => {
      manager.addGeneratedFile('temp.js', {});
      manager.removeGeneratedFile('temp.js');

      const files = manager.getGeneratedFiles();
      expect(files).toHaveLength(0);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should create and manage sessions', async () => {
      const sessionId = manager.createSession({
        projectType: 'frontend',
        workingDirectory: '/test'
      });

      expect(sessionId).toBeDefined();
      
      const session = manager.getSession(sessionId);
      expect(session.config.projectType).toBe('frontend');
    });

    test('should list active sessions', async () => {
      manager.createSession({ name: 'session1' });
      manager.createSession({ name: 'session2' });

      const sessions = manager.getActiveSessions();
      expect(sessions).toHaveLength(2);
    });

    test('should end sessions', async () => {
      const sessionId = manager.createSession({ name: 'test' });
      manager.endSession(sessionId);

      const session = manager.getSession(sessionId);
      expect(session.status).toBe('ended');
    });
  });

  describe('Quality Gate Tracking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should track quality check results', () => {
      const results = {
        eslint: { passed: true, errors: 0 },
        jest: { passed: false, failures: 2 },
        coverage: { percentage: 75 }
      };

      manager.recordQualityCheck('test-session', results);
      
      const recorded = manager.getQualityCheckHistory('test-session');
      expect(recorded).toHaveLength(1);
      expect(recorded[0].results.eslint.passed).toBe(true);
    });

    test('should track quality gate status', () => {
      manager.updateQualityGateStatus({
        eslintPassed: true,
        testsPassed: false,
        coverageThresholdMet: true
      });

      const status = manager.getQualityGateStatus();
      expect(status.eslintPassed).toBe(true);
      expect(status.testsPassed).toBe(false);
      expect(status.allGatesPassed).toBe(false);
    });
  });

  describe('Recovery and Resumption', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should support recovery checkpoints', async () => {
      const checkpoint = {
        step: 'code-generation',
        completedTasks: ['planning'],
        currentProgress: 50
      };

      manager.createCheckpoint('recovery-point', checkpoint);
      
      const recovered = manager.getCheckpoint('recovery-point');
      expect(recovered.step).toBe('code-generation');
    });

    test('should restore from checkpoint', async () => {
      const checkpoint = {
        currentTask: 'testing',
        generatedFiles: ['test1.js', 'test2.js']
      };

      manager.createCheckpoint('restore-point', checkpoint);
      await manager.restoreFromCheckpoint('restore-point');

      const state = manager.getCurrentState();
      expect(state.currentTask).toBe('testing');
    });
  });

  describe('State Validation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should validate state structure', () => {
      const validState = {
        currentTask: 'test',
        progress: 50,
        timestamp: Date.now()
      };

      const invalidState = {
        currentTask: null,
        progress: 'invalid'
      };

      expect(manager.validateState(validState)).toBe(true);
      expect(manager.validateState(invalidState)).toBe(false);
    });

    test('should clean invalid state', async () => {
      const mixedState = {
        valid: 'data',
        invalid: null,
        undefined: undefined,
        empty: ''
      };

      const cleaned = manager.cleanState(mixedState);
      expect(cleaned.valid).toBe('data');
      expect(cleaned).not.toHaveProperty('invalid');
      expect(cleaned).not.toHaveProperty('undefined');
    });
  });

  describe('State Export and Import', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should export complete state', async () => {
      manager.startTask('export-test', { type: 'test' });
      manager.addGeneratedFile('test.js', {});

      const exported = await manager.exportState();
      
      expect(exported).toHaveProperty('tasks');
      expect(exported).toHaveProperty('generatedFiles');
      expect(exported).toHaveProperty('timestamp');
    });

    test('should import state', async () => {
      const stateToImport = {
        tasks: [{ id: 'imported-task', status: 'completed' }],
        generatedFiles: [{ path: 'imported.js' }],
        timestamp: Date.now()
      };

      await manager.importState(stateToImport);
      
      const tasks = manager.getCompletedTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('imported-task');
    });
  });
});