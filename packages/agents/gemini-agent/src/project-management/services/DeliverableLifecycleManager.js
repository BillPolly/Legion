/**
 * DeliverableLifecycleManager - Comprehensive deliverable lifecycle management
 * Handles creation, assignment, completion tracking, and dependency resolution
 */

import { Deliverable } from '../models/Deliverable.js';

export class DeliverableLifecycleManager {
  static STANDARD_DELIVERABLES = {
    requirements: [
      {
        id: 'requirements_analysis',
        name: 'Requirements Analysis',
        description: 'Parse and analyze project requirements using DDD methodology'
      },
      {
        id: 'user_stories',
        name: 'User Stories',
        description: 'Generate user stories from parsed requirements'
      },
      {
        id: 'acceptance_criteria',
        name: 'Acceptance Criteria',
        description: 'Define acceptance criteria for user stories'
      }
    ],
    domain: [
      {
        id: 'domain_model',
        name: 'Domain Model',
        description: 'Create comprehensive domain model with entities and value objects'
      },
      {
        id: 'bounded_contexts',
        name: 'Bounded Contexts',
        description: 'Identify and define bounded contexts for domain separation'
      },
      {
        id: 'aggregates',
        name: 'Aggregates',
        description: 'Design aggregates and their boundaries'
      },
      {
        id: 'domain_events',
        name: 'Domain Events',
        description: 'Extract and define domain events for system communication'
      }
    ],
    architecture: [
      {
        id: 'layer_design',
        name: 'Layer Design',
        description: 'Design system layers following Clean Architecture principles'
      },
      {
        id: 'use_cases',
        name: 'Use Cases',
        description: 'Define application use cases and business logic'
      },
      {
        id: 'interface_design',
        name: 'Interface Design',
        description: 'Design interfaces and API contracts'
      }
    ],
    implementation: [
      {
        id: 'code_generation',
        name: 'Code Generation',
        description: 'Generate implementation code from architecture'
      },
      {
        id: 'unit_tests',
        name: 'Unit Tests',
        description: 'Implement comprehensive unit test suite'
      }
    ],
    testing: [
      {
        id: 'integration_tests',
        name: 'Integration Tests',
        description: 'Implement integration test suite'
      },
      {
        id: 'quality_validation',
        name: 'Quality Validation',
        description: 'Perform code quality validation and analysis'
      }
    ]
  };

  constructor(config = {}) {
    this.projectManager = config.projectManager;
    this.coordinationMonitor = config.coordinationMonitor;

    // Deliverable management state
    this.deliverableTemplates = new Map();
    this.dependencyGraph = new Map(); // deliverableId -> dependencies
    this.completionCallbacks = new Map(); // deliverableId -> callback functions

    // Initialize standard templates
    this.initializeStandardTemplates();

    console.log('📋 [DeliverableLifecycleManager] Initialized with comprehensive deliverable management');
  }

  /**
   * Initialize standard deliverable templates
   */
  initializeStandardTemplates() {
    Object.entries(DeliverableLifecycleManager.STANDARD_DELIVERABLES).forEach(([phase, templates]) => {
      templates.forEach(template => {
        this.deliverableTemplates.set(`${phase}_${template.id}`, {
          ...template,
          phase: phase
        });
      });
    });
  }

  /**
   * Create standard deliverables for a project phase
   * @param {string} projectId - Project ID
   * @param {string} phase - Project phase
   * @returns {Promise<Array<Deliverable>>} Created deliverables
   */
  async createStandardDeliverables(projectId, phase) {
    const templates = DeliverableLifecycleManager.STANDARD_DELIVERABLES[phase];
    if (!templates) {
      throw new Error(`Invalid phase: ${phase}`);
    }

    const deliverables = [];

    for (const template of templates) {
      const deliverable = new Deliverable({
        id: `${projectId}_${template.id}`,
        name: template.name,
        description: template.description,
        phase: phase
      });

      deliverables.push(deliverable);

      // Add to project through ProjectManager
      if (this.projectManager) {
        await this.projectManager.addDeliverable(projectId, deliverable);
      }
    }

    console.log(`📋 [DeliverableLifecycleManager] Created ${deliverables.length} standard deliverables for phase ${phase}`);

    return deliverables;
  }

  /**
   * Assign deliverable to agent
   * @param {string} projectId - Project ID
   * @param {string} deliverableId - Deliverable ID
   * @param {string} agentId - Agent ID to assign
   * @param {Deliverable} deliverable - Deliverable instance
   * @returns {Promise<Object>} Assignment result
   */
  async assignDeliverableToAgent(projectId, deliverableId, agentId, deliverable) {
    // Assign agent to deliverable
    deliverable.assignAgent(agentId);

    // Update status to in_progress if currently pending
    if (deliverable.status === 'pending') {
      deliverable.updateStatus('in_progress');
    }

    // Update through project manager
    if (this.projectManager) {
      await this.projectManager.updateDeliverable(projectId, deliverableId, {
        assignedAgent: agentId,
        status: deliverable.status
      });
    }

    console.log(`📋 [DeliverableLifecycleManager] Assigned deliverable ${deliverableId} to agent ${agentId}`);

    return {
      success: true,
      deliverableId: deliverableId,
      agentId: agentId,
      assignedAt: new Date(),
      statusUpdated: true,
      newStatus: deliverable.status
    };
  }

  /**
   * Complete deliverable with result data
   * @param {string} projectId - Project ID
   * @param {string} deliverableId - Deliverable ID
   * @param {Object} completionData - Completion data and results
   * @param {Deliverable} deliverable - Deliverable instance
   * @returns {Promise<Object>} Completion result
   */
  async completeDeliverable(projectId, deliverableId, completionData, deliverable) {
    // Validate deliverable can be completed
    if (deliverable.status !== 'in_progress') {
      throw new Error(`Cannot complete deliverable ${deliverableId} - not in progress`);
    }

    // Update deliverable to completed
    deliverable.updateStatus('completed');
    deliverable.updateCompletion(100);

    // Add artifacts if provided
    if (completionData.artifacts) {
      completionData.artifacts.forEach(artifact => {
        deliverable.addArtifact(artifact);
      });
    }

    // Update through project manager
    if (this.projectManager) {
      await this.projectManager.updateDeliverable(projectId, deliverableId, {
        status: 'completed',
        completion: 100
      });
    }

    // Record progress through coordination monitor
    let progressRecorded = false;
    if (this.coordinationMonitor) {
      await this.coordinationMonitor.recordDeliverableProgress(projectId, {
        deliverableId: deliverableId,
        agentId: deliverable.assignedAgent,
        completion: 100,
        status: 'completed',
        result: completionData.result,
        executionTime: completionData.executionTime
      });
      progressRecorded = true;
    }

    console.log(`📋 [DeliverableLifecycleManager] Completed deliverable ${deliverableId} in project ${projectId}`);

    return {
      success: true,
      deliverableId: deliverableId,
      completedAt: deliverable.completedAt,
      progressRecorded: progressRecorded,
      artifactsAdded: completionData.artifacts?.length || 0
    };
  }

  /**
   * Check deliverable dependencies
   * @param {string} projectId - Project ID
   * @param {string} deliverableId - Deliverable ID to check
   * @returns {Promise<Object>} Dependency check result
   */
  async checkDependencies(projectId, deliverableId) {
    // Get all project deliverables
    const allDeliverables = this.projectManager 
      ? await this.projectManager.getDeliverables(projectId)
      : [];

    // Find target deliverable
    const targetDeliverable = allDeliverables.find(d => d.id === deliverableId);
    if (!targetDeliverable) {
      throw new Error(`Deliverable ${deliverableId} not found in project ${projectId}`);
    }

    // Check each dependency
    const dependencyStatuses = [];
    const blockedBy = [];

    for (const depId of targetDeliverable.dependencies) {
      const depDeliverable = allDeliverables.find(d => d.id === depId);
      
      if (!depDeliverable) {
        blockedBy.push(depId);
        dependencyStatuses.push({
          id: depId,
          status: 'missing',
          completed: false
        });
      } else {
        const isCompleted = depDeliverable.isCompleted();
        dependencyStatuses.push({
          id: depId,
          status: depDeliverable.status,
          completed: isCompleted,
          completion: depDeliverable.completion
        });

        if (!isCompleted) {
          blockedBy.push(depId);
        }
      }
    }

    const resolvedDependencies = dependencyStatuses.filter(d => d.completed).length;
    const canProceed = blockedBy.length === 0;

    return {
      deliverableId: deliverableId,
      totalDependencies: targetDeliverable.dependencies.length,
      resolvedDependencies: resolvedDependencies,
      canProceed: canProceed,
      blockedBy: blockedBy,
      dependencyStatuses: dependencyStatuses
    };
  }

  /**
   * Get deliverables grouped by phase
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Deliverables grouped by phase
   */
  async getDeliverablesByPhase(projectId) {
    const allDeliverables = this.projectManager 
      ? await this.projectManager.getDeliverables(projectId)
      : [];

    const groupedDeliverables = {
      requirements: [],
      domain: [],
      architecture: [],
      implementation: [],
      testing: []
    };

    allDeliverables.forEach(deliverable => {
      if (groupedDeliverables[deliverable.phase]) {
        groupedDeliverables[deliverable.phase].push(deliverable);
      }
    });

    return groupedDeliverables;
  }

  /**
   * Get phase completion progress
   * @param {string} projectId - Project ID
   * @param {string} phase - Phase name
   * @returns {Promise<Object>} Phase progress
   */
  async getPhaseProgress(projectId, phase) {
    const phaseDeliverables = this.projectManager
      ? await this.projectManager.getDeliverables(projectId, phase)
      : [];

    const completedDeliverables = phaseDeliverables.filter(d => d.isCompleted()).length;
    const totalCompletion = phaseDeliverables.reduce((sum, d) => sum + d.completion, 0);
    const averageCompletion = phaseDeliverables.length > 0 
      ? Math.round(totalCompletion / phaseDeliverables.length)
      : 0;

    const isPhaseComplete = phaseDeliverables.length > 0 && completedDeliverables === phaseDeliverables.length;

    return {
      phase: phase,
      totalDeliverables: phaseDeliverables.length,
      completedDeliverables: completedDeliverables,
      inProgressDeliverables: phaseDeliverables.filter(d => d.isInProgress()).length,
      blockedDeliverables: phaseDeliverables.filter(d => d.isBlocked()).length,
      averageCompletion: averageCompletion,
      isPhaseComplete: isPhaseComplete,
      deliverables: phaseDeliverables.map(d => d.getSummary())
    };
  }

  /**
   * Validate phase transition readiness
   * @param {string} projectId - Project ID
   * @param {string} fromPhase - Current phase
   * @param {string} toPhase - Target phase
   * @returns {Promise<Object>} Validation result
   */
  async validatePhaseTransition(projectId, fromPhase, toPhase) {
    const phaseProgress = await this.getPhaseProgress(projectId, fromPhase);
    const blockers = [];

    // Check if current phase is complete
    if (!phaseProgress.isPhaseComplete) {
      blockers.push(`Phase ${fromPhase} has incomplete deliverables`);
    }

    // Check if any deliverables are blocked
    if (phaseProgress.blockedDeliverables > 0) {
      blockers.push(`Phase ${fromPhase} has ${phaseProgress.blockedDeliverables} blocked deliverables`);
    }

    const canTransition = blockers.length === 0;

    return {
      canTransition: canTransition,
      fromPhase: fromPhase,
      toPhase: toPhase,
      readinessPercentage: phaseProgress.averageCompletion,
      blockers: blockers,
      phaseProgress: phaseProgress,
      validatedAt: new Date()
    };
  }

  /**
   * Get deliverable lifecycle statistics
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Lifecycle statistics
   */
  async getLifecycleStatistics(projectId) {
    const deliverablesByPhase = await this.getDeliverablesByPhase(projectId);
    
    const phaseStats = {};
    let totalDeliverables = 0;
    let totalCompleted = 0;

    for (const [phase, deliverables] of Object.entries(deliverablesByPhase)) {
      const completed = deliverables.filter(d => d.isCompleted()).length;
      const inProgress = deliverables.filter(d => d.isInProgress()).length;
      const blocked = deliverables.filter(d => d.isBlocked()).length;

      phaseStats[phase] = {
        total: deliverables.length,
        completed: completed,
        inProgress: inProgress,
        blocked: blocked,
        completion: deliverables.length > 0 
          ? Math.round((completed / deliverables.length) * 100)
          : 0
      };

      totalDeliverables += deliverables.length;
      totalCompleted += completed;
    }

    return {
      projectId: projectId,
      totalDeliverables: totalDeliverables,
      totalCompleted: totalCompleted,
      overallCompletion: totalDeliverables > 0 
        ? Math.round((totalCompleted / totalDeliverables) * 100)
        : 0,
      phaseStatistics: phaseStats,
      generatedAt: new Date()
    };
  }
}