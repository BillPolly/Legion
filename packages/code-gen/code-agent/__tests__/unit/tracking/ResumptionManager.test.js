/**
 * Tests for ResumptionManager class
 * 
 * ResumptionManager is responsible for managing resumption capabilities
 * across code generation sessions and workflows.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ResumptionManager } from '../../../src/tracking/ResumptionManager.js';

describe('ResumptionManager', () => {
  let resumptionManager;

  beforeEach(() => {
    resumptionManager = new ResumptionManager();
  });

  afterEach(async () => {
    // Clean up any temporary files or state
    if (resumptionManager) {
      await resumptionManager.clear();
      resumptionManager.destroy();
    }
  });

  describe('Constructor', () => {
    test('should create ResumptionManager with default configuration', () => {
      expect(resumptionManager).toBeDefined();
      expect(resumptionManager.config).toBeDefined();
      expect(resumptionManager.config.autoSave).toBe(true);
      expect(resumptionManager.config.maxSnapshots).toBe(10);
    });

    test('should accept custom configuration', () => {
      const customManager = new ResumptionManager({
        autoSave: false,
        maxSnapshots: 5,
        compressionEnabled: true
      });

      expect(customManager.config.autoSave).toBe(false);
      expect(customManager.config.maxSnapshots).toBe(5);
      expect(customManager.config.compressionEnabled).toBe(true);
      
      customManager.destroy();
    });
  });

  describe('State Snapshots', () => {
    test('should create state snapshot', async () => {
      const state = {
        currentPhase: 'planning',
        progress: { planning: 50, generation: 0 },
        tasks: ['requirements', 'architecture'],
        metadata: { startedAt: Date.now() }
      };

      const snapshotId = await resumptionManager.createSnapshot('test-snapshot', state);
      
      expect(snapshotId).toBeDefined();
      
      const snapshot = await resumptionManager.getSnapshot(snapshotId);
      expect(snapshot.name).toBe('test-snapshot');
      expect(snapshot.state.currentPhase).toBe('planning');
      expect(snapshot.state.progress.planning).toBe(50);
    });

    test('should list all snapshots', async () => {
      await resumptionManager.createSnapshot('snapshot-1', { data: 'test1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await resumptionManager.createSnapshot('snapshot-2', { data: 'test2' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await resumptionManager.createSnapshot('snapshot-3', { data: 'test3' });

      const snapshots = await resumptionManager.listSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].name).toBe('snapshot-3'); // Most recent first
    });

    test('should delete snapshot', async () => {
      const snapshotId = await resumptionManager.createSnapshot('temp-snapshot', { test: true });
      
      await resumptionManager.deleteSnapshot(snapshotId);
      
      await expect(resumptionManager.getSnapshot(snapshotId))
        .rejects.toThrow('Snapshot not found');
    });

    test('should limit number of snapshots', async () => {
      const manager = new ResumptionManager({ maxSnapshots: 3 });
      
      // Create more than max snapshots with delays
      await manager.createSnapshot('snap-1', { order: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.createSnapshot('snap-2', { order: 2 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.createSnapshot('snap-3', { order: 3 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.createSnapshot('snap-4', { order: 4 });

      const snapshots = await manager.listSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].name).toBe('snap-4'); // Most recent kept
      
      manager.destroy();
    });
  });

  describe('Session Management', () => {
    test('should create resumable session', async () => {
      const sessionConfig = {
        projectName: 'test-project',
        workingDirectory: '/tmp/test',
        targetFramework: 'react',
        requirements: ['auth', 'crud', 'api']
      };

      const sessionId = await resumptionManager.createSession('test-session', sessionConfig);
      
      expect(sessionId).toBeDefined();
      
      const session = await resumptionManager.getSession(sessionId);
      expect(session.name).toBe('test-session');
      expect(session.config.projectName).toBe('test-project');
      expect(session.status).toBe('active');
    });

    test('should pause and resume session', async () => {
      const sessionId = await resumptionManager.createSession('pausable-session', {
        projectName: 'test'
      });

      await resumptionManager.pauseSession(sessionId);
      
      let session = await resumptionManager.getSession(sessionId);
      expect(session.status).toBe('paused');
      expect(session.pausedAt).toBeDefined();

      await resumptionManager.resumeSession(sessionId);
      
      session = await resumptionManager.getSession(sessionId);
      expect(session.status).toBe('active');
      expect(session.resumedAt).toBeDefined();
    });

    test('should complete session', async () => {
      const sessionId = await resumptionManager.createSession('complete-session', {
        projectName: 'test'
      });

      await resumptionManager.completeSession(sessionId, {
        finalState: { completed: true },
        artifacts: ['package.json', 'src/app.js']
      });
      
      const session = await resumptionManager.getSession(sessionId);
      expect(session.status).toBe('completed');
      expect(session.completedAt).toBeDefined();
      expect(session.result.artifacts).toContain('package.json');
    });

    test('should get active sessions', async () => {
      await resumptionManager.createSession('active-1', { projectName: 'proj1' });
      await resumptionManager.createSession('active-2', { projectName: 'proj2' });
      
      const sessionId3 = await resumptionManager.createSession('completed', { projectName: 'proj3' });
      await resumptionManager.completeSession(sessionId3, {});

      const activeSessions = await resumptionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.every(s => s.status === 'active')).toBe(true);
    });
  });

  describe('State Restoration', () => {
    test('should restore state from snapshot', async () => {
      const originalState = {
        currentPhase: 'generation',
        progress: { planning: 100, generation: 75 },
        tasks: { completed: ['requirements'], inProgress: ['implementation'] },
        configuration: { framework: 'react', database: 'mongodb' }
      };

      const snapshotId = await resumptionManager.createSnapshot('restore-test', originalState);
      
      const restoredState = await resumptionManager.restoreState(snapshotId);
      
      expect(restoredState.currentPhase).toBe('generation');
      expect(restoredState.progress.planning).toBe(100);
      expect(restoredState.tasks.completed).toContain('requirements');
      expect(restoredState.configuration.framework).toBe('react');
    });

    test('should validate state integrity during restoration', async () => {
      const validState = {
        currentPhase: 'planning',
        progress: { planning: 50 },
        version: '1.0.0'
      };

      const snapshotId = await resumptionManager.createSnapshot('valid-state', validState);
      
      // Corrupt the snapshot data
      const snapshot = await resumptionManager.getSnapshot(snapshotId);
      delete snapshot.state.currentPhase;
      
      const validation = await resumptionManager.validateState(snapshot.state);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing required field: currentPhase');
    });

    test('should handle partial state restoration', async () => {
      const partialState = {
        currentPhase: 'testing',
        progress: { planning: 100, generation: 100, testing: 25 }
        // Missing tasks and configuration
      };

      const snapshotId = await resumptionManager.createSnapshot('partial-state', partialState);
      
      const restoredState = await resumptionManager.restoreState(snapshotId, {
        allowPartial: true,
        fillDefaults: true
      });
      
      expect(restoredState.currentPhase).toBe('testing');
      expect(restoredState.tasks).toBeDefined(); // Should be filled with defaults
      expect(restoredState.configuration).toBeDefined();
    });
  });

  describe('Resumption Points', () => {
    test('should create resumption point', async () => {
      const pointData = {
        phase: 'generation',
        step: 'component-creation',
        context: {
          currentFile: 'src/components/UserList.jsx',
          generatedFiles: ['src/App.js', 'package.json'],
          pendingTasks: ['add-routing', 'setup-state']
        }
      };

      const pointId = await resumptionManager.createResumptionPoint('component-gen', pointData);
      
      expect(pointId).toBeDefined();
      
      const point = await resumptionManager.getResumptionPoint(pointId);
      expect(point.name).toBe('component-gen');
      expect(point.data.phase).toBe('generation');
      expect(point.data.context.currentFile).toBe('src/components/UserList.jsx');
    });

    test('should find resumption points by criteria', async () => {
      await resumptionManager.createResumptionPoint('planning-start', {
        phase: 'planning',
        step: 'requirements'
      });
      
      await resumptionManager.createResumptionPoint('planning-arch', {
        phase: 'planning',
        step: 'architecture'
      });
      
      await resumptionManager.createResumptionPoint('gen-start', {
        phase: 'generation',
        step: 'setup'
      });

      const planningPoints = await resumptionManager.findResumptionPoints({
        phase: 'planning'
      });
      
      expect(planningPoints).toHaveLength(2);
      expect(planningPoints.every(p => p.data.phase === 'planning')).toBe(true);
    });

    test('should get latest resumption point', async () => {
      await resumptionManager.createResumptionPoint('point-1', { step: 1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await resumptionManager.createResumptionPoint('point-2', { step: 2 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await resumptionManager.createResumptionPoint('point-3', { step: 3 });

      const latest = await resumptionManager.getLatestResumptionPoint();
      expect(latest.name).toBe('point-3');
      expect(latest.data.step).toBe(3);
    });
  });

  describe('Workflow Continuity', () => {
    test('should detect interrupted workflows', async () => {
      const sessionId = await resumptionManager.createSession('interrupted-session', {
        projectName: 'test'
      });

      // Simulate workflow interruption
      await resumptionManager.markWorkflowInterrupted(sessionId, {
        interruptedAt: Date.now(),
        reason: 'system-crash',
        lastStep: 'file-generation',
        recoveryHints: ['check-file-locks', 'validate-permissions']
      });

      const interruptions = await resumptionManager.getInterruptedWorkflows();
      expect(interruptions).toHaveLength(1);
      expect(interruptions[0].sessionId).toBe(sessionId);
      expect(interruptions[0].reason).toBe('system-crash');
    });

    test('should suggest resumption strategy', async () => {
      const sessionId = await resumptionManager.createSession('strategy-session', {
        projectName: 'test',
        currentPhase: 'generation',
        lastCompletedStep: 'component-setup'
      });

      await resumptionManager.createResumptionPoint('last-good-state', {
        phase: 'generation',
        step: 'component-setup',
        context: { filesGenerated: 5, errors: 0 }
      });

      const strategy = await resumptionManager.suggestResumptionStrategy(sessionId);
      
      expect(strategy.recommended).toBeDefined();
      expect(strategy.options).toHaveLength(3); // Continue, restart-step, rollback
      expect(strategy.options.some(o => o.type === 'continue')).toBe(true);
      expect(strategy.options.some(o => o.type === 'restart-step')).toBe(true);
      expect(strategy.options.some(o => o.type === 'rollback')).toBe(true);
    });

    test('should validate resumption feasibility', async () => {
      const sessionId = await resumptionManager.createSession('feasibility-session', {
        workingDirectory: '/tmp/test-project',
        targetFramework: 'react'
      });

      // Mock file system state
      const currentState = {
        files: ['package.json', 'src/App.js'],
        dependencies: ['react', 'react-dom'],
        configuration: { framework: 'react' }
      };

      const feasibility = await resumptionManager.validateResumptionFeasibility(
        sessionId, 
        currentState
      );
      
      expect(feasibility.canResume).toBeDefined();
      expect(feasibility.requiredActions).toBeDefined();
      expect(feasibility.riskLevel).toBeDefined();
    });
  });

  describe('Recovery Mechanisms', () => {
    test('should perform automatic recovery', async () => {
      const sessionId = await resumptionManager.createSession('recovery-session', {
        projectName: 'test'
      });

      // Create recovery state
      await resumptionManager.createSnapshot('pre-error', {
        currentPhase: 'generation',
        progress: { planning: 100, generation: 50 },
        lastValidState: true
      });

      const recovery = await resumptionManager.performAutomaticRecovery(sessionId, {
        strategy: 'rollback-to-snapshot',
        snapshotName: 'pre-error'
      });

      expect(recovery.success).toBe(true);
      expect(recovery.restoredState).toBeDefined();
      expect(recovery.restoredState.currentPhase).toBe('generation');
    });

    test('should handle recovery conflicts', async () => {
      const sessionId = await resumptionManager.createSession('conflict-session', {
        projectName: 'test'
      });

      // Simulate conflicting state
      const conflictingState = {
        currentPhase: 'generation',
        files: ['modified-file.js'],
        conflicts: [
          { file: 'src/App.js', type: 'content-mismatch' },
          { file: 'package.json', type: 'version-conflict' }
        ]
      };

      const resolution = await resumptionManager.resolveRecoveryConflicts(
        sessionId,
        conflictingState
      );

      expect(resolution.strategy).toBeDefined();
      expect(resolution.actions).toBeDefined();
      expect(resolution.userInteractionRequired).toBeDefined();
    });

    test('should create recovery report', async () => {
      const sessionId = await resumptionManager.createSession('report-session', {
        projectName: 'test'
      });

      await resumptionManager.markWorkflowInterrupted(sessionId, {
        reason: 'user-abort',
        lastStep: 'api-generation'
      });

      const report = await resumptionManager.generateRecoveryReport(sessionId);

      expect(report.sessionInfo).toBeDefined();
      expect(report.interruptionDetails).toBeDefined();
      expect(report.availableRecoveryOptions).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.riskAssessment).toBeDefined();
    });
  });

  describe('Data Persistence', () => {
    test('should save resumption data to file', async () => {
      const manager = new ResumptionManager({
        persistToFile: true,
        saveFilePath: './test-resumption.json'
      });

      await manager.createSnapshot('test-snapshot', { data: 'test' });
      await manager.save();

      expect(manager.isDirty()).toBe(false);
      
      manager.destroy();
    });

    test('should load resumption data from file', async () => {
      const manager1 = new ResumptionManager({
        saveFilePath: './test-resumption-load.json'
      });

      await manager1.createSnapshot('persistent-snapshot', { value: 42 });
      await manager1.save();
      manager1.destroy();

      const manager2 = new ResumptionManager({
        saveFilePath: './test-resumption-load.json'
      });

      await manager2.load();
      const snapshots = await manager2.listSnapshots();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].name).toBe('persistent-snapshot');
      
      // Get full snapshot with state to check value
      const fullSnapshot = await manager2.getSnapshot(snapshots[0].id);
      expect(fullSnapshot.state.value).toBe(42);
      
      manager2.destroy();
    });

    test('should handle compression', async () => {
      const manager = new ResumptionManager({
        compressionEnabled: true
      });

      const largeState = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          content: `Content for item ${i}`,
          metadata: { created: Date.now(), index: i }
        }))
      };

      const snapshotId = await manager.createSnapshot('compressed-snapshot', largeState);
      const snapshot = await manager.getSnapshot(snapshotId);

      expect(snapshot.compressed).toBe(true);
      expect(snapshot.state.data).toHaveLength(1000);
      
      manager.destroy();
    });
  });

  describe('Integration Points', () => {
    test('should integrate with TaskTracker', async () => {
      const taskTrackerState = {
        tasks: [
          { id: '1', title: 'Requirements', status: 'completed' },
          { id: '2', title: 'Architecture', status: 'in_progress' }
        ],
        dependencies: { '2': ['1'] }
      };

      const snapshotId = await resumptionManager.createSnapshot('task-state', {
        taskTracker: taskTrackerState,
        currentPhase: 'planning'
      });

      const integration = await resumptionManager.integrateWithTaskTracker(snapshotId);
      
      expect(integration.tasksToRestore).toHaveLength(2);
      expect(integration.dependenciesToRestore).toBeDefined();
      expect(integration.resumptionPoint).toBeDefined();
    });

    test('should integrate with ProgressManager', async () => {
      const progressState = {
        phases: { planning: 75, generation: 0 },
        currentSession: { id: 'session-123', startedAt: Date.now() },
        milestones: [{ name: 'planning-complete', completed: false }]
      };

      const snapshotId = await resumptionManager.createSnapshot('progress-state', {
        progressManager: progressState,
        currentPhase: 'planning'
      });

      const integration = await resumptionManager.integrateWithProgressManager(snapshotId);
      
      expect(integration.progressToRestore).toBeDefined();
      expect(integration.sessionToResume).toBeDefined();
      expect(integration.milestonesToCheck).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid snapshot data', async () => {
      await expect(resumptionManager.createSnapshot('', null))
        .rejects.toThrow('Snapshot name cannot be empty');

      await expect(resumptionManager.createSnapshot('valid-name', null))
        .rejects.toThrow('Snapshot state cannot be null');
    });

    test('should handle missing snapshots gracefully', async () => {
      await expect(resumptionManager.getSnapshot('nonexistent-id'))
        .rejects.toThrow('Snapshot not found');

      await expect(resumptionManager.restoreState('nonexistent-id'))
        .rejects.toThrow('Snapshot not found');
    });

    test('should handle corrupted resumption data', async () => {
      const corruptedData = {
        sessions: 'invalid-format',
        snapshots: null
      };

      const recovery = await resumptionManager.recoverFromCorruption(corruptedData);
      
      expect(recovery.recoveredSessions).toBeDefined();
      expect(recovery.recoveredSnapshots).toBeDefined();
      expect(recovery.lostData).toBeDefined();
    });

    test('should validate resumption compatibility', async () => {
      const oldVersionSnapshot = {
        version: '0.1.0',
        state: { legacy: true }
      };

      const compatibility = await resumptionManager.checkCompatibility(oldVersionSnapshot);
      
      expect(compatibility.isCompatible).toBeDefined();
      expect(compatibility.migrationRequired).toBeDefined();
      expect(compatibility.warnings).toBeDefined();
    });
  });
});