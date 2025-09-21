/**
 * Unit tests for StateManager
 * Tests persistent state management with JSON storage
 * NO MOCKS - using real file system
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import StateManager from '../../../../../src/strategies/coding/components/StateManager.js';
import fs from 'fs/promises';
import path from 'path';

describe('StateManager', () => {
  const testRoot = '/tmp/test-state-manager-' + Date.now();
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager(testRoot);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create state manager with project root', () => {
      const manager = new StateManager('/tmp/test');
      expect(manager.projectRoot).toBe('/tmp/test');
      expect(manager.state).toBeNull();
    });

    test('should throw error if no project root provided', () => {
      expect(() => new StateManager()).toThrow('Project root is required');
    });
  });

  describe('loadOrCreate() method', () => {
    test('should create new state if file does not exist', async () => {
      const state = await stateManager.loadOrCreate('test-project');
      
      expect(state).toBeDefined();
      expect(state.projectId).toBe('test-project');
      expect(state.status).toBe('planning');
      expect(state.createdAt).toBeDefined();
      expect(state.updatedAt).toBeDefined();
      expect(state.requirements).toBeNull();
      expect(state.plan).toBeNull();
      expect(Array.isArray(state.phases)).toBe(true);
      expect(Array.isArray(state.tasks)).toBe(true);
      expect(Array.isArray(state.artifacts)).toBe(true);
    });

    test('should load existing state from file', async () => {
      // First create a state
      const projectId = 'existing-project';
      await stateManager.loadOrCreate(projectId);
      await stateManager.updateRequirements({ type: 'api' });
      
      // Create new manager and load
      const newManager = new StateManager(testRoot);
      const loadedState = await newManager.loadOrCreate(projectId);
      
      expect(loadedState.projectId).toBe(projectId);
      expect(loadedState.requirements).toEqual({ type: 'api' });
    });

    test('should include version in state', async () => {
      const state = await stateManager.loadOrCreate('versioned-project');
      expect(state.version).toBe(1);
    });
  });

  describe('save() method', () => {
    test('should save state to JSON file', async () => {
      const projectId = 'save-test';
      await stateManager.loadOrCreate(projectId);
      
      const testData = { test: 'data' };
      stateManager.state.customData = testData;
      await stateManager.save();
      
      // Read file directly
      const statePath = path.join(testRoot, projectId, 'state.json');
      const content = await fs.readFile(statePath, 'utf-8');
      const saved = JSON.parse(content);
      
      expect(saved.customData).toEqual(testData);
    });

    test('should create directory if it does not exist', async () => {
      await stateManager.loadOrCreate('new-dir-test');
      await stateManager.save();
      
      const dirPath = path.join(testRoot, 'new-dir-test');
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should update timestamp on save', async () => {
      await stateManager.loadOrCreate('timestamp-test');
      const initialTime = stateManager.state.updatedAt;
      
      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await stateManager.save();
      expect(stateManager.state.updatedAt).not.toBe(initialTime);
    });
  });

  describe('update() method', () => {
    test('should update state fields', async () => {
      await stateManager.loadOrCreate('update-test');
      
      const updates = {
        status: 'executing',
        currentPhase: 'core'
      };
      
      await stateManager.update(updates);
      
      expect(stateManager.state.status).toBe('executing');
      expect(stateManager.state.currentPhase).toBe('core');
    });

    test('should increment version on update', async () => {
      await stateManager.loadOrCreate('version-test');
      const initialVersion = stateManager.state.version;
      
      await stateManager.update({ status: 'testing' });
      
      expect(stateManager.state.version).toBe(initialVersion + 1);
    });

    test('should save automatically after update', async () => {
      const projectId = 'auto-save-test';
      await stateManager.loadOrCreate(projectId);
      
      await stateManager.update({ status: 'completed' });
      
      // Load in new manager to verify persistence
      const newManager = new StateManager(testRoot);
      const loaded = await newManager.loadOrCreate(projectId);
      expect(loaded.status).toBe('completed');
    });
  });

  describe('updateRequirements() method', () => {
    test('should update requirements in state', async () => {
      await stateManager.loadOrCreate('req-test');
      
      const requirements = {
        type: 'api',
        features: ['auth', 'crud'],
        technologies: ['express']
      };
      
      await stateManager.updateRequirements(requirements);
      
      expect(stateManager.state.requirements).toEqual(requirements);
    });

    test('should persist requirements to file', async () => {
      const projectId = 'req-persist-test';
      await stateManager.loadOrCreate(projectId);
      
      const requirements = { type: 'web' };
      await stateManager.updateRequirements(requirements);
      
      const newManager = new StateManager(testRoot);
      const loaded = await newManager.loadOrCreate(projectId);
      expect(loaded.requirements).toEqual(requirements);
    });
  });

  describe('savePlan() method', () => {
    test('should save plan to state', async () => {
      await stateManager.loadOrCreate('plan-test');
      
      const plan = {
        planId: 'plan-123',
        phases: ['setup', 'core', 'testing']
      };
      
      await stateManager.savePlan(plan);
      
      expect(stateManager.state.plan).toEqual(plan);
    });

    test('should update status to executing when plan saved', async () => {
      await stateManager.loadOrCreate('plan-status-test');
      
      await stateManager.savePlan({ planId: 'test' });
      
      expect(stateManager.state.status).toBe('executing');
    });
  });

  describe('updateTask() method', () => {
    test('should add task if not exists', async () => {
      await stateManager.loadOrCreate('task-test');
      
      const task = {
        id: 'task-1',
        status: 'pending',
        description: 'Test task'
      };
      
      await stateManager.updateTask(task);
      
      expect(stateManager.state.tasks).toHaveLength(1);
      expect(stateManager.state.tasks[0]).toEqual(task);
    });

    test('should update existing task', async () => {
      await stateManager.loadOrCreate('task-update-test');
      
      // Add initial task
      await stateManager.updateTask({
        id: 'task-1',
        status: 'pending'
      });
      
      // Update task
      await stateManager.updateTask({
        id: 'task-1',
        status: 'completed'
      });
      
      expect(stateManager.state.tasks).toHaveLength(1);
      expect(stateManager.state.tasks[0].status).toBe('completed');
    });
  });

  describe('addArtifact() method', () => {
    test('should add artifact to state', async () => {
      await stateManager.loadOrCreate('artifact-test');
      
      const artifact = {
        id: 'artifact-1',
        name: 'server.js',
        type: 'code',
        path: '/tmp/server.js'
      };
      
      await stateManager.addArtifact(artifact);
      
      expect(stateManager.state.artifacts).toHaveLength(1);
      expect(stateManager.state.artifacts[0]).toEqual(artifact);
    });

    test('should generate ID if not provided', async () => {
      await stateManager.loadOrCreate('artifact-id-test');
      
      await stateManager.addArtifact({
        name: 'test.js',
        type: 'code'
      });
      
      expect(stateManager.state.artifacts[0].id).toBeDefined();
      expect(stateManager.state.artifacts[0].id).toContain('artifact-');
    });
  });

  describe('markComplete() method', () => {
    test('should mark state as completed', async () => {
      await stateManager.loadOrCreate('complete-test');
      
      const result = {
        success: true,
        artifacts: ['file1.js', 'file2.js']
      };
      
      await stateManager.markComplete(result);
      
      expect(stateManager.state.status).toBe('completed');
      expect(stateManager.state.result).toEqual(result);
      expect(stateManager.state.completedAt).toBeDefined();
    });
  });

  describe('rollback() method', () => {
    test('should rollback to previous version', async () => {
      await stateManager.loadOrCreate('rollback-test');
      
      // Make some changes
      await stateManager.update({ status: 'executing' });
      await stateManager.update({ status: 'testing' });
      
      // Rollback
      await stateManager.rollback();
      
      expect(stateManager.state.status).toBe('executing');
      expect(stateManager.state.version).toBe(2);
    });

    test('should maintain rollback history', async () => {
      await stateManager.loadOrCreate('rollback-history-test');
      
      await stateManager.update({ status: 'v1' });
      await stateManager.update({ status: 'v2' });
      await stateManager.update({ status: 'v3' });
      
      await stateManager.rollback(); // Back to v2
      expect(stateManager.state.status).toBe('v2');
      
      await stateManager.rollback(); // Back to v1
      expect(stateManager.state.status).toBe('v1');
    });
  });

  describe('getHistory() method', () => {
    test('should return state history', async () => {
      await stateManager.loadOrCreate('history-test');
      
      await stateManager.update({ status: 'step1' });
      await stateManager.update({ status: 'step2' });
      
      const history = await stateManager.getHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].status).toBe('step2');
    });
  });

  describe('lock() and unlock() methods', () => {
    test('should create lock file', async () => {
      await stateManager.loadOrCreate('lock-test');
      
      await stateManager.lock();
      
      const lockPath = path.join(testRoot, 'lock-test', 'state.lock');
      const exists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      await stateManager.unlock();
    });

    test('should prevent concurrent modifications when locked', async () => {
      await stateManager.loadOrCreate('concurrent-test');
      
      await stateManager.lock();
      
      // Try to lock from another manager
      const manager2 = new StateManager(testRoot);
      await manager2.loadOrCreate('concurrent-test');
      
      await expect(manager2.lock()).rejects.toThrow('State is locked');
      
      await stateManager.unlock();
    });

    test('should auto-unlock on timeout', async () => {
      await stateManager.loadOrCreate('timeout-test');
      
      await stateManager.lock({ timeout: 100 });
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be able to lock now
      const manager2 = new StateManager(testRoot);
      await manager2.loadOrCreate('timeout-test');
      await expect(manager2.lock()).resolves.not.toThrow();
      
      await manager2.unlock();
    });
  });
});