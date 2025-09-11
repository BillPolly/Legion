/**
 * PhaseTransitionManager Tests
 * Unit tests for five-phase workflow management
 */

import { PhaseTransitionManager } from '../../../src/project-management/services/PhaseTransitionManager.js';
import { ProjectState } from '../../../src/project-management/models/ProjectState.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';

describe('PhaseTransitionManager', () => {
  let manager;
  let mockProjectManager;
  let mockDeliverableManager;
  let mockEventBroadcaster;

  beforeEach(() => {
    // Mock dependencies
    mockProjectManager = {
      getProjectStatus: async (id) => new ProjectState({
        id: id,
        name: 'Test Project',
        description: 'Test Description',
        phase: 'requirements'
      }),
      updateProject: async (projectId, updates) => ({
        id: projectId,
        ...updates
      })
    };

    mockDeliverableManager = {
      validatePhaseTransition: async (projectId, fromPhase, toPhase) => ({
        canTransition: true,
        fromPhase,
        toPhase,
        readinessPercentage: 100,
        blockers: []
      }),
      getPhaseProgress: async (projectId, phase) => ({
        phase: phase,
        isPhaseComplete: true,
        averageCompletion: 100
      }),
      createStandardDeliverables: async (projectId, phase) => [
        new Deliverable({
          id: `${phase}_del_001`,
          name: `${phase} deliverable`,
          description: `Test deliverable for ${phase}`,
          phase: phase
        })
      ]
    };

    mockEventBroadcaster = {
      broadcastUpdate: async (data) => ({
        success: true,
        eventId: 'event-123'
      })
    };

    manager = new PhaseTransitionManager({
      projectManager: mockProjectManager,
      deliverableManager: mockDeliverableManager,
      eventBroadcaster: mockEventBroadcaster
    });
  });

  describe('constructor', () => {
    test('should create manager with phase workflow configuration', () => {
      expect(manager.projectManager).toBe(mockProjectManager);
      expect(manager.deliverableManager).toBe(mockDeliverableManager);
      expect(manager.eventBroadcaster).toBe(mockEventBroadcaster);
      expect(manager.phaseSequence).toEqual([
        'requirements', 'domain', 'architecture', 'implementation', 'testing'
      ]);
      expect(manager.transitionHistory).toBeInstanceOf(Map);
    });
  });

  describe('validateTransition', () => {
    test('should validate valid phase transition', async () => {
      const validation = await manager.validateTransition('test-project-001', 'requirements', 'domain');
      
      expect(validation.isValid).toBe(true);
      expect(validation.fromPhase).toBe('requirements');
      expect(validation.toPhase).toBe('domain');
      expect(validation.isSequential).toBe(true);
      expect(validation.phaseReadiness).toBeDefined();
    });

    test('should reject non-sequential transitions', async () => {
      const validation = await manager.validateTransition('test-project-001', 'requirements', 'implementation');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Non-sequential phase transition: requirements → implementation');
    });

    test('should reject transitions when deliverable manager blocks', async () => {
      mockDeliverableManager.validatePhaseTransition = async () => ({
        canTransition: false,
        blockers: ['Incomplete deliverables']
      });

      const validation = await manager.validateTransition('test-project-001', 'requirements', 'domain');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Phase readiness check failed: Incomplete deliverables');
    });
  });

  describe('executeTransition', () => {
    test('should execute valid phase transition', async () => {
      const result = await manager.executeTransition('test-project-001', 'domain');
      
      expect(result.success).toBe(true);
      expect(result.fromPhase).toBe('requirements');
      expect(result.toPhase).toBe('domain');
      expect(result.transitionId).toBeDefined();
      expect(result.deliverables).toHaveLength(1);
      expect(result.broadcastSent).toBe(true);
    });

    test('should record transition in history', async () => {
      await manager.executeTransition('test-project-001', 'domain');
      
      const history = await manager.getTransitionHistory('test-project-001');
      expect(history).toHaveLength(1);
      expect(history[0].fromPhase).toBe('requirements');
      expect(history[0].toPhase).toBe('domain');
      expect(history[0].id).toBeDefined();
    });

    test('should throw error for invalid transitions', async () => {
      mockDeliverableManager.validatePhaseTransition = async () => ({
        canTransition: false,
        blockers: ['Test blocker']
      });

      await expect(manager.executeTransition('test-project-001', 'domain'))
        .rejects.toThrow('Phase transition validation failed');
    });
  });

  describe('getNextPhase', () => {
    test('should return next phase in sequence', () => {
      expect(manager.getNextPhase('requirements')).toBe('domain');
      expect(manager.getNextPhase('domain')).toBe('architecture');
      expect(manager.getNextPhase('architecture')).toBe('implementation');
      expect(manager.getNextPhase('implementation')).toBe('testing');
      expect(manager.getNextPhase('testing')).toBe(null);
    });

    test('should return null for invalid phase', () => {
      expect(manager.getNextPhase('invalid')).toBe(null);
    });
  });

  describe('getPreviousPhase', () => {
    test('should return previous phase in sequence', () => {
      expect(manager.getPreviousPhase('domain')).toBe('requirements');
      expect(manager.getPreviousPhase('architecture')).toBe('domain');
      expect(manager.getPreviousPhase('implementation')).toBe('architecture');
      expect(manager.getPreviousPhase('testing')).toBe('implementation');
      expect(manager.getPreviousPhase('requirements')).toBe(null);
    });
  });

  describe('canTransitionTo', () => {
    test('should check if transition is possible', async () => {
      const canTransition = await manager.canTransitionTo('test-project-001', 'domain');
      expect(canTransition).toBe(true);

      const cannotTransition = await manager.canTransitionTo('test-project-001', 'implementation');
      expect(cannotTransition).toBe(false);
    });
  });

  describe('getPhaseWorkflowStatus', () => {
    test('should return complete workflow status', async () => {
      const status = await manager.getPhaseWorkflowStatus('test-project-001');
      
      expect(status.projectId).toBe('test-project-001');
      expect(status.currentPhase).toBe('requirements');
      expect(status.nextPhase).toBe('domain');
      expect(status.canAdvance).toBe(true);
      expect(status.workflowProgress).toBeDefined();
      expect(status.totalTransitions).toBe(0);
    });
  });

  describe('rollbackToPhase', () => {
    test('should rollback to previous phase', async () => {
      // Setup project in domain phase
      mockProjectManager.getProjectStatus = async () => new ProjectState({
        id: 'test-project-001',
        name: 'Test Project',
        description: 'Test',
        phase: 'domain'
      });

      const result = await manager.rollbackToPhase('test-project-001', 'requirements');
      
      expect(result.success).toBe(true);
      expect(result.fromPhase).toBe('domain');
      expect(result.toPhase).toBe('requirements');
      expect(result.rollbackReason).toBeDefined();
    });

    test('should throw error for invalid rollback', async () => {
      await expect(manager.rollbackToPhase('test-project-001', 'testing'))
        .rejects.toThrow('Cannot rollback to future phase');
    });
  });
});