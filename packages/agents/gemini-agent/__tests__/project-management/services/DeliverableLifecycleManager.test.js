/**
 * DeliverableLifecycleManager Tests
 * Unit tests for comprehensive deliverable lifecycle management
 */

import { DeliverableLifecycleManager } from '../../../src/project-management/services/DeliverableLifecycleManager.js';
import { Deliverable } from '../../../src/project-management/models/Deliverable.js';

describe('DeliverableLifecycleManager', () => {
  let manager;
  let mockProjectManager;
  let mockCoordinationMonitor;

  beforeEach(() => {
    // Mock dependencies for unit tests
    mockProjectManager = {
      addDeliverable: async (projectId, deliverable) => deliverable,
      updateDeliverable: async (projectId, deliverableId, updates) => ({
        id: deliverableId,
        ...updates
      }),
      getDeliverables: async (projectId) => []
    };

    mockCoordinationMonitor = {
      recordDeliverableProgress: async (projectId, progress) => ({
        success: true,
        progressId: 'progress-123'
      })
    };

    manager = new DeliverableLifecycleManager({
      projectManager: mockProjectManager,
      coordinationMonitor: mockCoordinationMonitor
    });
  });

  describe('constructor', () => {
    test('should create manager with proper configuration', () => {
      expect(manager.projectManager).toBe(mockProjectManager);
      expect(manager.coordinationMonitor).toBe(mockCoordinationMonitor);
      expect(manager.deliverableTemplates).toBeInstanceOf(Map);
      expect(manager.dependencyGraph).toBeInstanceOf(Map);
    });
  });

  describe('createStandardDeliverables', () => {
    test('should create standard deliverables for requirements phase', async () => {
      const deliverables = await manager.createStandardDeliverables('test-project-001', 'requirements');
      
      expect(deliverables).toHaveLength(3); // requirements_analysis, user_stories, acceptance_criteria
      expect(deliverables.map(d => d.phase)).toEqual(['requirements', 'requirements', 'requirements']);
      expect(deliverables.map(d => d.name)).toContain('Requirements Analysis');
      expect(deliverables.map(d => d.name)).toContain('User Stories');
      expect(deliverables.map(d => d.name)).toContain('Acceptance Criteria');
    });

    test('should create standard deliverables for domain phase', async () => {
      const deliverables = await manager.createStandardDeliverables('test-project-001', 'domain');
      
      expect(deliverables).toHaveLength(4); // domain_model, bounded_contexts, aggregates, domain_events
      expect(deliverables.every(d => d.phase === 'domain')).toBe(true);
      expect(deliverables.map(d => d.name)).toContain('Domain Model');
      expect(deliverables.map(d => d.name)).toContain('Bounded Contexts');
    });

    test('should throw error for invalid phase', async () => {
      await expect(manager.createStandardDeliverables('test-project-001', 'invalid')).rejects.toThrow('Invalid phase: invalid');
    });
  });

  describe('assignDeliverableToAgent', () => {
    test('should assign deliverable to agent', async () => {
      const deliverable = new Deliverable({
        id: 'del-001',
        name: 'Test Deliverable',
        description: 'Test',
        phase: 'requirements'
      });

      const result = await manager.assignDeliverableToAgent('test-project-001', 'del-001', 'RequirementsAgent', deliverable);
      
      expect(result.success).toBe(true);
      expect(result.deliverableId).toBe('del-001');
      expect(result.agentId).toBe('RequirementsAgent');
      expect(result.assignedAt).toBeInstanceOf(Date);
    });

    test('should update deliverable status to in_progress when assigned', async () => {
      const deliverable = new Deliverable({
        id: 'del-001',
        name: 'Test Deliverable',
        description: 'Test',
        phase: 'requirements'
      });

      const result = await manager.assignDeliverableToAgent('test-project-001', 'del-001', 'RequirementsAgent', deliverable);
      
      expect(result.statusUpdated).toBe(true);
      expect(result.newStatus).toBe('in_progress');
    });
  });

  describe('completeDeliverable', () => {
    test('should complete deliverable with result data', async () => {
      const deliverable = new Deliverable({
        id: 'del-001',
        name: 'Test Deliverable',
        description: 'Test',
        phase: 'requirements',
        status: 'in_progress'
      });

      const completionData = {
        result: {
          parsedRequirements: ['req1', 'req2'],
          quality: 0.95
        },
        artifacts: ['requirements.json'],
        executionTime: 1200
      };

      const result = await manager.completeDeliverable('test-project-001', 'del-001', completionData, deliverable);
      
      expect(result.success).toBe(true);
      expect(result.deliverableId).toBe('del-001');
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.progressRecorded).toBe(true);
    });

    test('should validate deliverable completion requirements', async () => {
      const deliverable = new Deliverable({
        id: 'del-001',
        name: 'Test Deliverable',
        description: 'Test',
        phase: 'requirements',
        status: 'pending' // Not in progress
      });

      await expect(manager.completeDeliverable('test-project-001', 'del-001', {}, deliverable))
        .rejects.toThrow('Cannot complete deliverable del-001 - not in progress');
    });
  });

  describe('checkDependencies', () => {
    test('should check deliverable dependencies', async () => {
      // Create deliverables with dependencies
      const del1 = new Deliverable({
        id: 'del-001',
        name: 'First Deliverable',
        description: 'Test',
        phase: 'requirements'
      });

      const del2 = new Deliverable({
        id: 'del-002', 
        name: 'Second Deliverable',
        description: 'Test',
        phase: 'requirements'
      });

      del2.addDependency('del-001');

      // Mock project manager to return deliverables
      mockProjectManager.getDeliverables = async () => [del1, del2];

      const dependencyCheck = await manager.checkDependencies('test-project-001', 'del-002');
      
      expect(dependencyCheck.deliverableId).toBe('del-002');
      expect(dependencyCheck.totalDependencies).toBe(1);
      expect(dependencyCheck.resolvedDependencies).toBe(0); // del-001 not completed yet
      expect(dependencyCheck.canProceed).toBe(false);
      expect(dependencyCheck.blockedBy).toEqual(['del-001']);
    });

    test('should allow proceeding when dependencies are resolved', async () => {
      const del1 = new Deliverable({
        id: 'del-001',
        name: 'First Deliverable',
        description: 'Test',
        phase: 'requirements',
        status: 'completed'
      });

      const del2 = new Deliverable({
        id: 'del-002',
        name: 'Second Deliverable', 
        description: 'Test',
        phase: 'requirements'
      });

      del2.addDependency('del-001');

      mockProjectManager.getDeliverables = async () => [del1, del2];

      const dependencyCheck = await manager.checkDependencies('test-project-001', 'del-002');
      
      expect(dependencyCheck.canProceed).toBe(true);
      expect(dependencyCheck.resolvedDependencies).toBe(1);
      expect(dependencyCheck.blockedBy).toEqual([]);
    });
  });

  describe('getDeliverablesByPhase', () => {
    test('should return deliverables grouped by phase', async () => {
      const deliverables = [
        new Deliverable({
          id: 'req-001',
          name: 'Requirements',
          description: 'Test',
          phase: 'requirements'
        }),
        new Deliverable({
          id: 'dom-001',
          name: 'Domain Model',
          description: 'Test',
          phase: 'domain'
        }),
        new Deliverable({
          id: 'req-002',
          name: 'User Stories',
          description: 'Test', 
          phase: 'requirements'
        })
      ];

      mockProjectManager.getDeliverables = async () => deliverables;

      const groupedDeliverables = await manager.getDeliverablesByPhase('test-project-001');
      
      expect(groupedDeliverables.requirements).toHaveLength(2);
      expect(groupedDeliverables.domain).toHaveLength(1);
      expect(groupedDeliverables.architecture).toHaveLength(0);
      expect(groupedDeliverables.implementation).toHaveLength(0);
      expect(groupedDeliverables.testing).toHaveLength(0);
    });
  });

  describe('getPhaseProgress', () => {
    test('should calculate phase completion progress', async () => {
      const deliverables = [
        new Deliverable({
          id: 'req-001',
          name: 'Requirements',
          description: 'Test',
          phase: 'requirements',
          status: 'completed',
          completion: 100
        }),
        new Deliverable({
          id: 'req-002',
          name: 'User Stories',
          description: 'Test',
          phase: 'requirements',
          status: 'in_progress',
          completion: 50
        })
      ];

      mockProjectManager.getDeliverables = async (projectId, phase) => 
        deliverables.filter(d => d.phase === phase);

      const progress = await manager.getPhaseProgress('test-project-001', 'requirements');
      
      expect(progress.phase).toBe('requirements');
      expect(progress.totalDeliverables).toBe(2);
      expect(progress.completedDeliverables).toBe(1);
      expect(progress.averageCompletion).toBe(75); // (100 + 50) / 2
      expect(progress.isPhaseComplete).toBe(false);
    });

    test('should identify complete phases', async () => {
      const deliverables = [
        new Deliverable({
          id: 'req-001',
          name: 'Requirements',
          description: 'Test',
          phase: 'requirements',
          status: 'completed',
          completion: 100
        })
      ];

      mockProjectManager.getDeliverables = async () => deliverables;

      const progress = await manager.getPhaseProgress('test-project-001', 'requirements');
      expect(progress.isPhaseComplete).toBe(true);
      expect(progress.averageCompletion).toBe(100);
    });
  });

  describe('validatePhaseTransition', () => {
    test('should validate phase transition readiness', async () => {
      // Mock completed requirements phase
      const requirementsDeliverables = [
        new Deliverable({
          id: 'req-001',
          name: 'Requirements',
          description: 'Test',
          phase: 'requirements', 
          status: 'completed',
          completion: 100
        })
      ];

      mockProjectManager.getDeliverables = async (projectId, phase) => {
        if (phase === 'requirements') return requirementsDeliverables;
        return [];
      };

      const validation = await manager.validatePhaseTransition('test-project-001', 'requirements', 'domain');
      
      expect(validation.canTransition).toBe(true);
      expect(validation.fromPhase).toBe('requirements');
      expect(validation.toPhase).toBe('domain');
      expect(validation.blockers).toEqual([]);
      expect(validation.readinessPercentage).toBe(100);
    });

    test('should block transition when phase incomplete', async () => {
      const incompleteDeliverables = [
        new Deliverable({
          id: 'req-001',
          name: 'Requirements',
          description: 'Test',
          phase: 'requirements',
          status: 'in_progress',
          completion: 60
        })
      ];

      mockProjectManager.getDeliverables = async () => incompleteDeliverables;

      const validation = await manager.validatePhaseTransition('test-project-001', 'requirements', 'domain');
      
      expect(validation.canTransition).toBe(false);
      expect(validation.blockers).toContain('Phase requirements has incomplete deliverables');
      expect(validation.readinessPercentage).toBe(60);
    });
  });
});