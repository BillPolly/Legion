/**
 * AgentCoordinationMonitor - Monitor SD agent activity within project context
 * Tracks agent assignments, activities, and deliverable progress for project coordination
 */

export class AgentCoordinationMonitor {
  constructor(config = {}) {
    this.projectManager = config.projectManager;
    this.eventBroadcaster = config.eventBroadcaster;

    // Monitoring state
    this.monitoredProjects = new Set();
    this.agentActivities = new Map(); // projectId -> activities[]
    this.deliverableProgress = new Map(); // projectId -> Map(deliverableId -> progress)
    this.maxActivitiesPerProject = 100;

    console.log('🎯 [AgentCoordinationMonitor] Initialized for SD agent coordination monitoring');
  }

  /**
   * Start monitoring agent coordination for a project
   * @param {string} projectId - Project ID to monitor
   * @returns {Promise<Object>} Monitoring start result
   */
  async startMonitoring(projectId) {
    if (this.monitoredProjects.has(projectId)) {
      console.log(`🎯 [AgentCoordinationMonitor] Already monitoring project: ${projectId}`);
      return {
        success: true,
        projectId: projectId,
        alreadyMonitoring: true
      };
    }

    this.monitoredProjects.add(projectId);
    this.agentActivities.set(projectId, []);
    this.deliverableProgress.set(projectId, new Map());

    console.log(`🎯 [AgentCoordinationMonitor] Started monitoring project: ${projectId}`);

    return {
      success: true,
      projectId: projectId,
      startedAt: new Date()
    };
  }

  /**
   * Stop monitoring agent coordination for a project
   * @param {string} projectId - Project ID to stop monitoring
   * @returns {Promise<Object>} Monitoring stop result
   */
  async stopMonitoring(projectId) {
    if (!this.monitoredProjects.has(projectId)) {
      return {
        success: false,
        error: `Project ${projectId} is not being monitored`
      };
    }

    this.monitoredProjects.delete(projectId);
    this.agentActivities.delete(projectId);
    this.deliverableProgress.delete(projectId);

    console.log(`🎯 [AgentCoordinationMonitor] Stopped monitoring project: ${projectId}`);

    return {
      success: true,
      projectId: projectId,
      stoppedAt: new Date()
    };
  }

  /**
   * Record agent activity for a project
   * @param {string} projectId - Project ID
   * @param {Object} activity - Agent activity data
   * @returns {Promise<Object>} Recording result
   */
  async recordAgentActivity(projectId, activity) {
    if (!this.monitoredProjects.has(projectId)) {
      throw new Error(`Project ${projectId} is not being monitored`);
    }

    const activityRecord = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      projectId: projectId,
      ...activity
    };

    // Add to project activities
    const projectActivities = this.agentActivities.get(projectId);
    projectActivities.push(activityRecord);

    // Trim activities if exceeding limit
    if (projectActivities.length > this.maxActivitiesPerProject) {
      this.agentActivities.set(projectId, projectActivities.slice(-this.maxActivitiesPerProject));
    }

    console.log(`🎯 [AgentCoordinationMonitor] Recorded activity for ${activity.agentId} in project ${projectId}`);

    // Broadcast activity update through actor framework
    if (this.eventBroadcaster) {
      await this.eventBroadcaster.broadcastUpdate({
        type: 'agent_activity',
        projectId: projectId,
        agentId: activity.agentId,
        activity: activity.activity,
        status: activity.status,
        timestamp: activityRecord.timestamp
      });
    }

    return {
      success: true,
      activityId: activityRecord.id,
      projectId: projectId,
      agentId: activity.agentId
    };
  }

  /**
   * Record deliverable progress and coordinate with project manager
   * @param {string} projectId - Project ID
   * @param {Object} progress - Deliverable progress data
   * @returns {Promise<Object>} Recording result
   */
  async recordDeliverableProgress(projectId, progress) {
    if (!this.monitoredProjects.has(projectId)) {
      throw new Error(`Project ${projectId} is not being monitored`);
    }

    const progressRecord = {
      id: `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      projectId: projectId,
      ...progress
    };

    // Update deliverable progress tracking
    const projectProgress = this.deliverableProgress.get(projectId);
    projectProgress.set(progress.deliverableId, progressRecord);

    // Update project manager if deliverable status changed
    if (this.projectManager && (progress.status || progress.completion !== undefined)) {
      const updates = {};
      if (progress.status) updates.status = progress.status;
      if (progress.completion !== undefined) updates.completion = progress.completion;
      
      try {
        await this.projectManager.updateDeliverable(projectId, progress.deliverableId, updates);
      } catch (error) {
        console.warn(`🎯 [AgentCoordinationMonitor] Failed to update project manager: ${error.message}`);
      }
    }

    console.log(`🎯 [AgentCoordinationMonitor] Recorded progress for deliverable ${progress.deliverableId} in project ${projectId}`);

    // Broadcast progress update through actor framework
    if (this.eventBroadcaster) {
      await this.eventBroadcaster.broadcastUpdate({
        type: 'deliverable_progress',
        projectId: projectId,
        deliverableId: progress.deliverableId,
        completion: progress.completion,
        status: progress.status,
        agentId: progress.agentId,
        timestamp: progressRecord.timestamp
      });
    }

    return {
      success: true,
      progressId: progressRecord.id,
      projectId: projectId,
      deliverableId: progress.deliverableId,
      broadcastSent: !!this.eventBroadcaster
    };
  }

  /**
   * Get agent activities for a project
   * @param {string} projectId - Project ID
   * @param {string} agentId - Optional agent filter
   * @returns {Promise<Array<Object>>} Agent activities
   */
  async getAgentActivities(projectId, agentId = null) {
    if (!this.monitoredProjects.has(projectId)) {
      throw new Error(`Project ${projectId} is not being monitored`);
    }

    const activities = this.agentActivities.get(projectId) || [];

    if (agentId) {
      return activities.filter(a => a.agentId === agentId);
    }

    return activities;
  }

  /**
   * Get deliverable progress for a project
   * @param {string} projectId - Project ID
   * @param {string} deliverableId - Optional deliverable filter
   * @returns {Promise<Map<string, Object>|Object>} Progress data
   */
  async getDeliverableProgress(projectId, deliverableId = null) {
    if (!this.monitoredProjects.has(projectId)) {
      throw new Error(`Project ${projectId} is not being monitored`);
    }

    const progress = this.deliverableProgress.get(projectId) || new Map();

    if (deliverableId) {
      return progress.get(deliverableId) || null;
    }

    return progress;
  }

  /**
   * Get coordination summary for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Coordination summary
   */
  async getProjectCoordinationSummary(projectId) {
    if (!this.monitoredProjects.has(projectId)) {
      throw new Error(`Project ${projectId} is not being monitored`);
    }

    const activities = this.agentActivities.get(projectId) || [];
    const progress = this.deliverableProgress.get(projectId) || new Map();

    // Analyze agent status
    const latestAgentStatus = new Map();
    activities.forEach(activity => {
      if (!latestAgentStatus.has(activity.agentId) || 
          activity.timestamp > latestAgentStatus.get(activity.agentId).timestamp) {
        latestAgentStatus.set(activity.agentId, activity);
      }
    });

    const busyAgents = Array.from(latestAgentStatus.values()).filter(a => a.status === 'busy').length;
    const availableAgents = Array.from(latestAgentStatus.values()).filter(a => a.status === 'available').length;

    // Analyze deliverable progress
    const deliverables = Array.from(progress.values());
    const totalCompletion = deliverables.reduce((sum, d) => sum + (d.completion || 0), 0);
    const averageCompletion = deliverables.length > 0 ? Math.round(totalCompletion / deliverables.length) : 0;

    return {
      projectId: projectId,
      totalAgents: latestAgentStatus.size,
      busyAgents: busyAgents,
      availableAgents: availableAgents,
      totalDeliverables: deliverables.length,
      averageCompletion: averageCompletion,
      lastActivity: activities.length > 0 ? activities[activities.length - 1].timestamp : null,
      monitoringDuration: Date.now() - this.getMonitoringStartTime(projectId)
    };
  }

  /**
   * Get overall monitoring statistics
   * @returns {Promise<Object>} Monitoring statistics
   */
  async getMonitoringStatistics() {
    const totalActivities = Array.from(this.agentActivities.values())
      .reduce((sum, activities) => sum + activities.length, 0);
    
    const totalProgress = Array.from(this.deliverableProgress.values())
      .reduce((sum, progress) => sum + progress.size, 0);

    return {
      monitoredProjects: this.monitoredProjects.size,
      totalAgentActivities: totalActivities,
      totalDeliverableProgress: totalProgress,
      monitoringActive: this.monitoredProjects.size > 0,
      projectManagerConnected: !!this.projectManager,
      eventBroadcasterConnected: !!this.eventBroadcaster
    };
  }

  /**
   * Clear all monitoring data (for testing)
   * @returns {Promise<void>}
   */
  async clearAll() {
    this.monitoredProjects.clear();
    this.agentActivities.clear();
    this.deliverableProgress.clear();
    
    console.log('🎯 [AgentCoordinationMonitor] Cleared all monitoring data');
  }

  /**
   * Get monitoring start time for project (helper method)
   * @param {string} projectId - Project ID
   * @returns {number} Start timestamp
   */
  getMonitoringStartTime(projectId) {
    // For MVP, return current time minus 1 hour as placeholder
    // In real implementation, this would track actual start times
    return Date.now() - (60 * 60 * 1000);
  }
}