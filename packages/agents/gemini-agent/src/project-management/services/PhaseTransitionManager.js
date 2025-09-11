/**
 * PhaseTransitionManager - Five-phase workflow management
 * Manages transitions between Requirements → Domain → Architecture → Implementation → Testing
 */

export class PhaseTransitionManager {
  static PHASE_SEQUENCE = ['requirements', 'domain', 'architecture', 'implementation', 'testing'];

  constructor(config = {}) {
    this.projectManager = config.projectManager;
    this.deliverableManager = config.deliverableManager;
    this.eventBroadcaster = config.eventBroadcaster;

    // Phase workflow state
    this.phaseSequence = [...PhaseTransitionManager.PHASE_SEQUENCE];
    this.transitionHistory = new Map(); // projectId -> transitions[]
    this.transitionRules = this.initializeTransitionRules();

    console.log('🔄 [PhaseTransitionManager] Initialized five-phase workflow management');
  }

  /**
   * Initialize transition rules and validations
   */
  initializeTransitionRules() {
    return {
      sequential: true, // Must follow phase sequence
      requireCompletion: true, // Current phase must be complete
      allowRollback: true, // Can rollback to previous phases
      maxRollbackDepth: 2 // Can rollback up to 2 phases
    };
  }

  /**
   * Validate phase transition
   * @param {string} projectId - Project ID
   * @param {string} fromPhase - Current phase
   * @param {string} toPhase - Target phase
   * @returns {Promise<Object>} Validation result
   */
  async validateTransition(projectId, fromPhase, toPhase) {
    const errors = [];
    
    // Check sequential transition rule
    const fromIndex = this.phaseSequence.indexOf(fromPhase);
    const toIndex = this.phaseSequence.indexOf(toPhase);
    
    if (this.transitionRules.sequential && (toIndex !== fromIndex + 1)) {
      errors.push(`Non-sequential phase transition: ${fromPhase} → ${toPhase}`);
    }

    // Check phase readiness through deliverable manager
    let phaseReadiness = null;
    if (this.deliverableManager) {
      phaseReadiness = await this.deliverableManager.validatePhaseTransition(projectId, fromPhase, toPhase);
      
      if (!phaseReadiness.canTransition) {
        phaseReadiness.blockers.forEach(blocker => {
          errors.push(`Phase readiness check failed: ${blocker}`);
        });
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid: isValid,
      fromPhase: fromPhase,
      toPhase: toPhase,
      isSequential: toIndex === fromIndex + 1,
      phaseReadiness: phaseReadiness,
      errors: errors,
      validatedAt: new Date()
    };
  }

  /**
   * Execute phase transition
   * @param {string} projectId - Project ID
   * @param {string} toPhase - Target phase
   * @returns {Promise<Object>} Transition result
   */
  async executeTransition(projectId, toPhase) {
    // Get current project state
    const project = this.projectManager 
      ? await this.projectManager.getProjectStatus(projectId)
      : null;

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const fromPhase = project.phase;

    // Validate transition
    const validation = await this.validateTransition(projectId, fromPhase, toPhase);
    if (!validation.isValid) {
      throw new Error(`Phase transition validation failed: ${validation.errors.join(', ')}`);
    }

    // Create transition record
    const transition = {
      id: `transition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: projectId,
      fromPhase: fromPhase,
      toPhase: toPhase,
      executedAt: new Date(),
      validation: validation
    };

    // Update project phase
    if (this.projectManager) {
      await this.projectManager.updateProject(projectId, { phase: toPhase });
    }

    // Create standard deliverables for new phase
    let newDeliverables = [];
    if (this.deliverableManager) {
      newDeliverables = await this.deliverableManager.createStandardDeliverables(projectId, toPhase);
    }

    // Record transition in history
    if (!this.transitionHistory.has(projectId)) {
      this.transitionHistory.set(projectId, []);
    }
    this.transitionHistory.get(projectId).push(transition);

    // Broadcast transition through actor framework
    let broadcastSent = false;
    if (this.eventBroadcaster) {
      await this.eventBroadcaster.broadcastUpdate({
        type: 'phase_transition',
        projectId: projectId,
        fromPhase: fromPhase,
        toPhase: toPhase,
        transitionId: transition.id,
        newDeliverables: newDeliverables.map(d => d.getSummary()),
        executedAt: transition.executedAt
      });
      broadcastSent = true;
    }

    console.log(`🔄 [PhaseTransitionManager] Executed transition ${fromPhase} → ${toPhase} for project ${projectId}`);

    return {
      success: true,
      transitionId: transition.id,
      projectId: projectId,
      fromPhase: fromPhase,
      toPhase: toPhase,
      deliverables: newDeliverables,
      broadcastSent: broadcastSent,
      executedAt: transition.executedAt
    };
  }

  /**
   * Get next phase in sequence
   * @param {string} currentPhase - Current phase
   * @returns {string|null} Next phase or null if at end
   */
  getNextPhase(currentPhase) {
    const index = this.phaseSequence.indexOf(currentPhase);
    if (index === -1 || index === this.phaseSequence.length - 1) {
      return null;
    }
    return this.phaseSequence[index + 1];
  }

  /**
   * Get previous phase in sequence
   * @param {string} currentPhase - Current phase
   * @returns {string|null} Previous phase or null if at beginning
   */
  getPreviousPhase(currentPhase) {
    const index = this.phaseSequence.indexOf(currentPhase);
    if (index <= 0) {
      return null;
    }
    return this.phaseSequence[index - 1];
  }

  /**
   * Check if transition to phase is possible
   * @param {string} projectId - Project ID
   * @param {string} toPhase - Target phase
   * @returns {Promise<boolean>} True if transition is possible
   */
  async canTransitionTo(projectId, toPhase) {
    try {
      const project = await this.projectManager.getProjectStatus(projectId);
      const validation = await this.validateTransition(projectId, project.phase, toPhase);
      return validation.isValid;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get complete phase workflow status
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Workflow status
   */
  async getPhaseWorkflowStatus(projectId) {
    const project = await this.projectManager.getProjectStatus(projectId);
    const currentPhase = project.phase;
    const nextPhase = this.getNextPhase(currentPhase);
    const previousPhase = this.getPreviousPhase(currentPhase);

    // Get phase progress
    const phaseProgress = this.deliverableManager
      ? await this.deliverableManager.getPhaseProgress(projectId, currentPhase)
      : { isPhaseComplete: false, averageCompletion: 0 };

    // Calculate workflow progress
    const currentPhaseIndex = this.phaseSequence.indexOf(currentPhase);
    const workflowProgress = Math.round(((currentPhaseIndex + (phaseProgress.averageCompletion / 100)) / this.phaseSequence.length) * 100);

    // Check if can advance
    const canAdvance = nextPhase ? await this.canTransitionTo(projectId, nextPhase) : false;

    // Get transition history
    const transitions = this.transitionHistory.get(projectId) || [];

    return {
      projectId: projectId,
      currentPhase: currentPhase,
      currentPhaseIndex: currentPhaseIndex,
      nextPhase: nextPhase,
      previousPhase: previousPhase,
      canAdvance: canAdvance,
      phaseProgress: phaseProgress,
      workflowProgress: workflowProgress,
      totalPhases: this.phaseSequence.length,
      totalTransitions: transitions.length,
      lastTransition: transitions.length > 0 ? transitions[transitions.length - 1] : null
    };
  }

  /**
   * Rollback to previous phase
   * @param {string} projectId - Project ID
   * @param {string} targetPhase - Phase to rollback to
   * @param {string} reason - Rollback reason
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackToPhase(projectId, targetPhase, reason = 'Manual rollback') {
    const project = await this.projectManager.getProjectStatus(projectId);
    const currentPhase = project.phase;
    
    const currentIndex = this.phaseSequence.indexOf(currentPhase);
    const targetIndex = this.phaseSequence.indexOf(targetPhase);

    // Validate rollback
    if (targetIndex >= currentIndex) {
      throw new Error('Cannot rollback to future phase');
    }

    if (currentIndex - targetIndex > this.transitionRules.maxRollbackDepth) {
      throw new Error(`Rollback depth exceeds limit (max ${this.transitionRules.maxRollbackDepth})`);
    }

    // Create rollback record
    const rollback = {
      id: `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: projectId,
      fromPhase: currentPhase,
      toPhase: targetPhase,
      reason: reason,
      executedAt: new Date(),
      type: 'rollback'
    };

    // Update project phase
    if (this.projectManager) {
      await this.projectManager.updateProject(projectId, { phase: targetPhase });
    }

    // Record in history
    if (!this.transitionHistory.has(projectId)) {
      this.transitionHistory.set(projectId, []);
    }
    this.transitionHistory.get(projectId).push(rollback);

    // Broadcast rollback through actor framework
    if (this.eventBroadcaster) {
      await this.eventBroadcaster.broadcastUpdate({
        type: 'phase_rollback',
        projectId: projectId,
        fromPhase: currentPhase,
        toPhase: targetPhase,
        reason: reason,
        rollbackId: rollback.id,
        executedAt: rollback.executedAt
      });
    }

    console.log(`🔄 [PhaseTransitionManager] Rollback ${currentPhase} → ${targetPhase} for project ${projectId}: ${reason}`);

    return {
      success: true,
      rollbackId: rollback.id,
      projectId: projectId,
      fromPhase: currentPhase,
      toPhase: targetPhase,
      rollbackReason: reason,
      executedAt: rollback.executedAt
    };
  }

  /**
   * Get transition history for project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array<Object>>} Transition history
   */
  async getTransitionHistory(projectId) {
    return this.transitionHistory.get(projectId) || [];
  }

  /**
   * Get transition statistics
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Transition statistics
   */
  async getTransitionStatistics(projectId) {
    const transitions = await this.getTransitionHistory(projectId);
    const forwardTransitions = transitions.filter(t => t.type !== 'rollback');
    const rollbacks = transitions.filter(t => t.type === 'rollback');

    return {
      projectId: projectId,
      totalTransitions: transitions.length,
      forwardTransitions: forwardTransitions.length,
      rollbacks: rollbacks.length,
      averageTransitionTime: this.calculateAverageTransitionTime(forwardTransitions),
      lastTransition: transitions.length > 0 ? transitions[transitions.length - 1] : null,
      workflowEfficiency: rollbacks.length === 0 ? 1.0 : Math.max(0, 1 - (rollbacks.length / forwardTransitions.length))
    };
  }

  /**
   * Calculate average time between transitions
   * @param {Array<Object>} transitions - Forward transitions
   * @returns {number} Average time in milliseconds
   */
  calculateAverageTransitionTime(transitions) {
    if (transitions.length < 2) return 0;

    let totalTime = 0;
    for (let i = 1; i < transitions.length; i++) {
      totalTime += transitions[i].executedAt.getTime() - transitions[i - 1].executedAt.getTime();
    }

    return Math.round(totalTime / (transitions.length - 1));
  }
}