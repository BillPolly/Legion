/**
 * ClientPlanningActor - Client-side actor for planning operations
 * Handles plan creation, validation, and management through UI
 */

export class ClientPlanningActor {
  constructor(applicationContext) {
    this.applicationContext = applicationContext;
    this.remoteActor = null;
    this.activePlans = new Map();
    this.currentPlan = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async onConnected() {
    console.log('✅ Planning actor connected');
    this.applicationContext.updateState?.('planningAvailable', true);
  }

  /**
   * Create a new plan
   */
  async createPlan(goal, context = {}, options = {}) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    const planRequest = {
      goal,
      context,
      options,
      requestId: `plan-${Date.now()}`
    };

    // Update UI state
    this.applicationContext.updateState?.('planningStatus', 'creating');
    this.applicationContext.updateState?.('currentGoal', goal);

    // Send plan creation request
    await this.remoteActor.receive({
      type: 'plan:create',
      data: planRequest
    });

    return planRequest.requestId;
  }

  /**
   * Save a plan
   */
  async savePlan(plan) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    await this.remoteActor.receive({
      type: 'plan:save',
      data: plan
    });
  }

  /**
   * Load a plan by ID
   */
  async loadPlan(planId) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    await this.remoteActor.receive({
      type: 'plan:load',
      data: { planId }
    });
  }

  /**
   * List available plans
   */
  async listPlans(filter = {}) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    await this.remoteActor.receive({
      type: 'plan:list',
      data: { filter }
    });
  }

  /**
   * Validate a plan
   */
  async validatePlan(hierarchy) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    await this.remoteActor.receive({
      type: 'plan:validate',
      data: { hierarchy }
    });
  }

  /**
   * Update a plan
   */
  async updatePlan(planId, updates) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    await this.remoteActor.receive({
      type: 'plan:update',
      data: { planId, updates }
    });
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId) {
    if (!this.remoteActor) {
      throw new Error('Planning actor not connected');
    }

    await this.remoteActor.receive({
      type: 'plan:delete',
      data: { planId }
    });
  }

  /**
   * Handle incoming messages from server
   */
  async receive(message) {
    const { type, data } = message;

    switch (type) {
      case 'plan:decomposition:start':
        this.handleDecompositionStart(data);
        break;

      case 'plan:decomposition:node':
        this.handleDecompositionNode(data);
        break;

      case 'plan:validation:result':
        this.handleValidationResult(data);
        break;

      case 'plan:complete':
        this.handlePlanComplete(data);
        break;

      case 'plan:saved':
        this.handlePlanSaved(data);
        break;

      case 'plan:loaded':
        this.handlePlanLoaded(data);
        break;

      case 'plan:list:result':
        this.handlePlanList(data);
        break;

      case 'plan:updated':
        this.handlePlanUpdated(data);
        break;

      case 'plan:deleted':
        this.handlePlanDeleted(data);
        break;

      case 'plan:error':
        this.handlePlanError(data);
        break;

      default:
        console.warn(`Unknown planning message type: ${type}`);
    }
  }

  handleDecompositionStart(data) {
    console.log('🚀 Plan decomposition started:', data.goal);
    this.applicationContext.updateState?.('planningStatus', 'decomposing');
    this.applicationContext.onDecompositionStart?.(data);
  }

  handleDecompositionNode(data) {
    console.log('📦 Decomposition node:', data.node);
    this.applicationContext.onDecompositionNode?.(data);
  }

  handleValidationResult(data) {
    console.log('✅ Validation result:', data);
    this.applicationContext.updateState?.('validationResult', data);
    this.applicationContext.onValidationResult?.(data);
  }

  handlePlanComplete(data) {
    console.log('🎉 Plan complete:', data);
    this.currentPlan = data;
    this.activePlans.set(data.metadata?.goal || 'current', data);
    
    this.applicationContext.updateState?.('planningStatus', 'complete');
    this.applicationContext.updateState?.('currentPlan', data);
    this.applicationContext.onPlanComplete?.(data);
  }

  handlePlanSaved(data) {
    console.log('💾 Plan saved:', data.planId);
    this.applicationContext.onPlanSaved?.(data.planId);
  }

  handlePlanLoaded(data) {
    console.log('📂 Plan loaded:', data);
    this.currentPlan = data;
    this.applicationContext.updateState?.('currentPlan', data);
    this.applicationContext.onPlanLoaded?.(data);
  }

  handlePlanList(data) {
    console.log('📋 Plans list:', data.plans);
    this.applicationContext.updateState?.('availablePlans', data.plans);
    this.applicationContext.onPlansList?.(data.plans);
  }

  handlePlanUpdated(data) {
    console.log('🔄 Plan updated:', data.planId);
    this.applicationContext.onPlanUpdated?.(data.planId);
  }

  handlePlanDeleted(data) {
    console.log('🗑️ Plan deleted:', data.planId);
    this.applicationContext.onPlanDeleted?.(data.planId);
  }

  handlePlanError(data) {
    console.error('❌ Planning error:', data.error);
    this.applicationContext.updateState?.('planningStatus', 'error');
    this.applicationContext.updateState?.('planningError', data.error);
    this.applicationContext.onPlanError?.(data);
  }

  /**
   * Get current plan
   */
  getCurrentPlan() {
    return this.currentPlan;
  }

  /**
   * Get all active plans
   */
  getActivePlans() {
    return Array.from(this.activePlans.values());
  }

  /**
   * Clean up
   */
  async cleanup() {
    this.activePlans.clear();
    this.currentPlan = null;
    this.remoteActor = null;
  }
}