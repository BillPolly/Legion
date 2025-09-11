/**
 * ProjectDashboardModel - Data layer for project dashboard component
 * Manages project state, deliverable data, and change notifications following MVVM pattern
 */

export class ProjectDashboardModel {
  constructor(config = {}) {
    this.projectManager = config.projectManager;
    this.observabilityService = config.observabilityService;

    // Model state
    this.projectData = {};
    this.deliverables = [];
    this.phases = this.initializePhases();
    this.agents = [];
    
    // Change notification system
    this.changeListeners = [];
    
    // Auto-refresh mechanism
    this.refreshInterval = null;
    this.refreshRate = 5000; // 5 seconds default

    console.log('📊 [ProjectDashboardModel] Initialized MVVM model layer');
  }

  /**
   * Initialize phase structure
   */
  initializePhases() {
    return [
      { id: 'requirements', name: 'Requirements', status: 'pending', progress: 0 },
      { id: 'domain', name: 'Domain', status: 'pending', progress: 0 },
      { id: 'architecture', name: 'Architecture', status: 'pending', progress: 0 },
      { id: 'implementation', name: 'Implementation', status: 'pending', progress: 0 },
      { id: 'testing', name: 'Testing', status: 'pending', progress: 0 }
    ];
  }

  /**
   * Load project data from ProjectManager
   * @param {string} projectId - Project ID to load
   * @returns {Promise<Object>} Load result
   */
  async loadProject(projectId) {
    try {
      // Load project summary
      const projectSummary = this.projectManager
        ? await this.projectManager.generateProjectSummary(projectId)
        : null;

      if (!projectSummary) {
        throw new Error('Project not found');
      }

      // Update project data
      this.projectData = {
        id: projectSummary.projectId,
        name: projectSummary.projectName,
        description: projectSummary.projectDescription,
        phase: projectSummary.currentPhase,
        status: projectSummary.currentStatus,
        progress: projectSummary.progressPercentage,
        totalDeliverables: projectSummary.totalDeliverables,
        completedDeliverables: projectSummary.completedDeliverables,
        createdAt: projectSummary.createdAt,
        updatedAt: projectSummary.updatedAt
      };

      // Load deliverables
      if (this.projectManager) {
        const allDeliverables = await this.projectManager.getDeliverables(projectId);
        this.deliverables = allDeliverables.map(d => ({
          id: d.id,
          name: d.name,
          phase: d.phase,
          status: d.status,
          completion: d.completion,
          assignedAgent: d.assignedAgent
        }));
      }

      // Update phase progress
      this.updatePhaseProgress();

      // Notify listeners
      this.notifyListeners({
        type: 'project_loaded',
        projectId: projectId,
        projectData: this.projectData
      });

      console.log(`📊 [ProjectDashboardModel] Loaded project: ${this.projectData.name}`);

      return {
        success: true,
        projectId: projectId,
        projectName: this.projectData.name
      };

    } catch (error) {
      console.error('📊 [ProjectDashboardModel] Load error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update project data
   * @param {Object} updates - Data updates
   */
  updateProjectData(updates) {
    const previousData = { ...this.projectData };
    Object.assign(this.projectData, updates);

    this.notifyListeners({
      type: 'project_updated',
      previous: previousData,
      current: this.projectData,
      updates: updates
    });

    console.log(`📊 [ProjectDashboardModel] Updated project data:`, Object.keys(updates));
  }

  /**
   * Update deliverable status
   * @param {string} deliverableId - Deliverable ID
   * @param {Object} updates - Deliverable updates
   * @returns {Object} Update result
   */
  updateDeliverable(deliverableId, updates) {
    const deliverable = this.deliverables.find(d => d.id === deliverableId);
    
    if (!deliverable) {
      return {
        success: false,
        error: `Deliverable ${deliverableId} not found in model`
      };
    }

    const previousData = { ...deliverable };
    Object.assign(deliverable, updates);

    // Update phase progress if completion changed
    if (updates.completion !== undefined || updates.status !== undefined) {
      this.updatePhaseProgress();
    }

    this.notifyListeners({
      type: 'deliverable_updated',
      deliverableId: deliverableId,
      previous: previousData,
      current: deliverable,
      updates: updates
    });

    console.log(`📊 [ProjectDashboardModel] Updated deliverable: ${deliverableId}`);

    return { success: true };
  }

  /**
   * Update phase progress based on deliverable completion
   */
  updatePhaseProgress() {
    this.phases.forEach(phase => {
      const phaseDeliverables = this.deliverables.filter(d => d.phase === phase.id);
      
      if (phaseDeliverables.length > 0) {
        const totalCompletion = phaseDeliverables.reduce((sum, d) => sum + d.completion, 0);
        const averageCompletion = Math.round(totalCompletion / phaseDeliverables.length);
        const completedCount = phaseDeliverables.filter(d => d.status === 'completed').length;
        
        phase.progress = averageCompletion;
        phase.status = completedCount === phaseDeliverables.length ? 'completed' :
                      phaseDeliverables.some(d => d.status === 'in_progress') ? 'in_progress' :
                      'pending';
      } else {
        phase.progress = 0;
        phase.status = 'pending';
      }
    });

    // Set current phase status
    if (this.projectData.phase) {
      const currentPhase = this.phases.find(p => p.id === this.projectData.phase);
      if (currentPhase && currentPhase.status === 'pending') {
        currentPhase.status = 'active';
      }
    }
  }

  /**
   * Get phase status information
   * @returns {Object} Phase status
   */
  getPhaseStatus() {
    const currentPhase = this.projectData.phase || 'requirements';
    const progress = this.projectData.progress || 0;

    return {
      currentPhase: currentPhase,
      isRequirements: currentPhase === 'requirements',
      isDomain: currentPhase === 'domain',
      isArchitecture: currentPhase === 'architecture',
      isImplementation: currentPhase === 'implementation',
      isTesting: currentPhase === 'testing',
      progress: progress,
      phases: this.phases
    };
  }

  /**
   * Get deliverables summary
   * @returns {Object} Deliverables summary
   */
  getDeliverablesSummary() {
    const total = this.deliverables.length;
    const completed = this.deliverables.filter(d => d.status === 'completed').length;
    const inProgress = this.deliverables.filter(d => d.status === 'in_progress').length;
    const pending = this.deliverables.filter(d => d.status === 'pending').length;
    const blocked = this.deliverables.filter(d => d.status === 'blocked').length;

    const totalCompletion = this.deliverables.reduce((sum, d) => sum + d.completion, 0);
    const averageCompletion = total > 0 ? Math.round(totalCompletion / total) : 0;

    return {
      total,
      completed,
      inProgress,
      pending,
      blocked,
      averageCompletion
    };
  }

  /**
   * Add change listener for reactive updates
   * @param {Function} listener - Change listener function
   */
  addChangeListener(listener) {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   * @param {Function} listener - Change listener to remove
   */
  removeChangeListener(listener) {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify all change listeners
   * @param {Object} changeData - Change data
   */
  notifyListeners(changeData) {
    this.changeListeners.forEach(listener => {
      try {
        listener(changeData);
      } catch (error) {
        console.error('📊 [ProjectDashboardModel] Listener error:', error.message);
      }
    });
  }

  /**
   * Start automatic data refresh
   * @param {number} intervalMs - Refresh interval in milliseconds
   */
  async startAutoRefresh(intervalMs = this.refreshRate) {
    if (this.refreshInterval) {
      this.stopAutoRefresh();
    }

    this.refreshInterval = setInterval(async () => {
      if (this.projectData.id) {
        await this.refreshData();
      }
    }, intervalMs);

    console.log(`📊 [ProjectDashboardModel] Started auto-refresh every ${intervalMs}ms`);
  }

  /**
   * Stop automatic data refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('📊 [ProjectDashboardModel] Stopped auto-refresh');
    }
  }

  /**
   * Refresh data from project manager
   */
  async refreshData() {
    if (!this.projectData.id) return;

    try {
      await this.loadProject(this.projectData.id);
    } catch (error) {
      console.error('📊 [ProjectDashboardModel] Refresh error:', error.message);
    }
  }

  /**
   * Get current model state for debugging
   * @returns {Object} Current state
   */
  getState() {
    return {
      projectData: { ...this.projectData },
      deliverables: [...this.deliverables],
      phases: [...this.phases],
      agents: [...this.agents],
      hasRefresh: !!this.refreshInterval,
      listenerCount: this.changeListeners.length
    };
  }

  /**
   * Destroy model and clean up resources
   */
  destroy() {
    this.stopAutoRefresh();
    this.changeListeners = [];
    this.projectData = {};
    this.deliverables = [];
    this.phases = this.initializePhases();
    this.agents = [];
    
    console.log('📊 [ProjectDashboardModel] Model destroyed and cleaned up');
  }
}