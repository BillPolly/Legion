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
    
    // Resolve the task decomposition promise if it exists
    if (this.taskDecomposeResolver) {
      console.log('📋 Resolving task decomposition promise with hierarchy');
      // Extract the decomposition data for the TaskBreakdownPanel
      const decompositionResult = {
        decomposition: this.formatHierarchyAsDecomposition(data.hierarchy),
        complexity: data.hierarchy?.complexity,
        tools: this.extractToolsFromHierarchy(data.hierarchy),
        validation: data.validation
      };
      
      this.taskDecomposeResolver(decompositionResult);
      this.taskDecomposeResolver = null;
      this.taskDecomposeRejecter = null;
    }
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
    
    // Check if we have a partial hierarchy even though validation failed
    if (this.taskDecomposeResolver && data.details?.phases?.informal?.hierarchy) {
      console.log('📋 Plan validation failed but hierarchy was generated, returning partial result');
      const decompositionResult = {
        decomposition: this.formatHierarchyAsDecomposition(data.details.phases.informal.hierarchy),
        complexity: data.details.phases.informal.hierarchy?.complexity,
        tools: this.extractToolsFromHierarchy(data.details.phases.informal.hierarchy),
        validation: data.details.phases.informal.validation,
        error: data.error
      };
      
      // Resolve with partial result instead of rejecting
      this.taskDecomposeResolver(decompositionResult);
      this.taskDecomposeResolver = null;
      this.taskDecomposeRejecter = null;
    } else if (this.taskDecomposeRejecter) {
      // Only reject if we have no hierarchy at all
      console.log('📋 Rejecting task decomposition promise with error');
      this.taskDecomposeRejecter(new Error(data.error));
      this.taskDecomposeResolver = null;
      this.taskDecomposeRejecter = null;
    }
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
   * Format hierarchy data as decomposition tree for TaskBreakdownPanel
   */
  formatHierarchyAsDecomposition(hierarchy) {
    if (!hierarchy) return null;
    
    const convertNode = (node) => {
      if (!node) return null;
      
      return {
        id: node.id || `node-${Date.now()}-${Math.random()}`,
        task: node.description || node.task,
        description: node.description || node.task,
        complexity: node.complexity || 'simple',
        reasoning: node.reasoning,
        inputs: node.expectedInputs || node.inputs || [],
        outputs: node.expectedOutputs || node.outputs || [],
        suggestedTools: node.suggestedTools || node.tools || [],
        subtasks: node.subtasks ? node.subtasks.map(convertNode).filter(Boolean) : []
      };
    };
    
    return {
      root: convertNode(hierarchy)
    };
  }
  
  /**
   * Extract tools from hierarchy
   */
  extractToolsFromHierarchy(hierarchy) {
    const tools = new Set();
    
    const extractFromNode = (node) => {
      if (!node) return;
      
      if (node.suggestedTools) {
        node.suggestedTools.forEach(tool => tools.add(tool));
      }
      if (node.tools) {
        node.tools.forEach(tool => tools.add(tool));
      }
      
      if (node.subtasks) {
        node.subtasks.forEach(extractFromNode);
      }
    };
    
    extractFromNode(hierarchy);
    return Array.from(tools);
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