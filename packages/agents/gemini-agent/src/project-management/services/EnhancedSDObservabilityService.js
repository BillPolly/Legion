/**
 * EnhancedSDObservabilityService - Project-aware monitoring service
 * Extends SD observability with project management capabilities
 */

export class EnhancedSDObservabilityService {
  constructor(config = {}) {
    this.resourceManager = config.resourceManager;
    this.projectManager = config.projectManager;

    // Project monitoring state
    this.projectSubscriptions = new Map(); // projectId -> subscription info
    this.projectMetrics = new Map(); // projectId -> metrics
    this.projectEvents = []; // Global event log
    this.maxEvents = 1000; // Limit event history

    // Broadcast callback for real-time updates
    this.onBroadcast = null;

    console.log('👁️ [EnhancedSDObservability] Initialized with project monitoring capabilities');
  }

  /**
   * Subscribe to project monitoring
   * @param {string} projectId - Project ID to monitor
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToProject(projectId) {
    // Check if already subscribed
    if (this.projectSubscriptions.has(projectId)) {
      console.log(`👁️ [EnhancedSDObservability] Already subscribed to project: ${projectId}`);
      return {
        success: true,
        projectId: projectId,
        alreadySubscribed: true
      };
    }

    // Create subscription
    const subscription = {
      projectId: projectId,
      subscribedAt: new Date(),
      eventCount: 0,
      lastActivity: new Date()
    };

    this.projectSubscriptions.set(projectId, subscription);
    
    // Initialize metrics for this project
    this.projectMetrics.set(projectId, {
      projectId: projectId,
      subscribed: true,
      eventCount: 0,
      lastActivity: new Date(),
      createdAt: new Date()
    });

    console.log(`👁️ [EnhancedSDObservability] Subscribed to project: ${projectId}`);

    return {
      success: true,
      projectId: projectId,
      subscribedAt: subscription.subscribedAt
    };
  }

  /**
   * Unsubscribe from project monitoring
   * @param {string} projectId - Project ID to stop monitoring
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribeFromProject(projectId) {
    if (!this.projectSubscriptions.has(projectId)) {
      return {
        success: false,
        error: `Not subscribed to project ${projectId}`
      };
    }

    this.projectSubscriptions.delete(projectId);
    this.projectMetrics.delete(projectId);

    console.log(`👁️ [EnhancedSDObservability] Unsubscribed from project: ${projectId}`);

    return {
      success: true,
      projectId: projectId
    };
  }

  /**
   * Get project monitoring metrics
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project metrics
   */
  async getProjectMetrics(projectId) {
    if (!this.projectSubscriptions.has(projectId)) {
      throw new Error(`Not subscribed to project ${projectId}`);
    }

    const metrics = this.projectMetrics.get(projectId);
    const subscription = this.projectSubscriptions.get(projectId);

    return {
      projectId: projectId,
      subscribed: true,
      eventCount: subscription.eventCount,
      lastActivity: subscription.lastActivity,
      subscribedAt: subscription.subscribedAt,
      ...metrics
    };
  }

  /**
   * Record project event for monitoring
   * @param {string} projectId - Project ID
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Recording result
   */
  async recordProjectEvent(projectId, eventData) {
    if (!this.projectSubscriptions.has(projectId)) {
      throw new Error(`Not subscribed to project ${projectId}`);
    }

    // Create event record
    const event = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: projectId,
      timestamp: new Date(),
      ...eventData
    };

    // Add to global event log
    this.projectEvents.push(event);

    // Trim events if exceeding max
    if (this.projectEvents.length > this.maxEvents) {
      this.projectEvents = this.projectEvents.slice(-this.maxEvents);
    }

    // Update subscription metrics
    const subscription = this.projectSubscriptions.get(projectId);
    subscription.eventCount++;
    subscription.lastActivity = new Date();

    console.log(`👁️ [EnhancedSDObservability] Recorded event for project ${projectId}: ${eventData.type}`);

    return {
      success: true,
      eventId: event.id,
      projectId: projectId
    };
  }

  /**
   * Generate comprehensive project report
   * @param {string} projectId - Project ID
   * @param {string} reportType - Type of report ('summary', 'detailed', 'metrics')
   * @returns {Promise<Object>} Generated report
   */
  async generateProjectReport(projectId, reportType = 'summary') {
    // Get project summary from ProjectManagerAgent
    const projectSummary = this.projectManager 
      ? await this.projectManager.generateProjectSummary(projectId)
      : { projectId: projectId, error: 'ProjectManager not available' };

    // Get project events
    const projectEvents = this.projectEvents.filter(e => e.projectId === projectId);
    
    // Generate event summary
    const eventSummary = {
      totalEvents: projectEvents.length,
      eventTypes: [...new Set(projectEvents.map(e => e.type))],
      recentEvents: projectEvents.slice(-10),
      firstEvent: projectEvents.length > 0 ? projectEvents[0] : null,
      lastEvent: projectEvents.length > 0 ? projectEvents[projectEvents.length - 1] : null
    };

    const report = {
      projectId: projectId,
      reportType: reportType,
      generatedAt: new Date(),
      projectSummary: projectSummary,
      eventSummary: eventSummary
    };

    if (reportType === 'detailed') {
      report.allEvents = projectEvents;
      report.metrics = this.projectMetrics.get(projectId) || {};
    }

    console.log(`👁️ [EnhancedSDObservability] Generated ${reportType} report for project ${projectId}`);

    return report;
  }

  /**
   * Broadcast project update to subscribers
   * @param {string} projectId - Project ID
   * @param {Object} updateData - Update data to broadcast
   * @returns {Promise<Object>} Broadcast result
   */
  async broadcastProjectUpdate(projectId, updateData) {
    // Record the update as an event
    await this.recordProjectEvent(projectId, {
      type: 'broadcast_update',
      updateType: updateData.type,
      data: updateData
    });

    // Simulate broadcast (in real implementation, this would use WebSocket)
    const broadcastData = {
      projectId: projectId,
      timestamp: new Date(),
      ...updateData
    };

    // Call broadcast callback if set (for testing)
    if (this.onBroadcast) {
      this.onBroadcast(broadcastData);
    }

    console.log(`👁️ [EnhancedSDObservability] Broadcast update for project ${projectId}: ${updateData.type}`);

    return {
      success: true,
      projectId: projectId,
      broadcastCount: 1, // In real implementation, this would be actual subscriber count
      timestamp: broadcastData.timestamp
    };
  }

  /**
   * Get list of actively monitored projects
   * @returns {Promise<Array<string>>} Array of project IDs
   */
  async getActiveProjects() {
    return Array.from(this.projectSubscriptions.keys());
  }

  /**
   * Get enhanced system status including project monitoring
   * @returns {Promise<Object>} Enhanced system status
   */
  async getSystemStatus() {
    const activeProjects = await this.getActiveProjects();
    
    return {
      subscribedProjects: activeProjects.length,
      totalEvents: this.projectEvents.length,
      monitoringActive: true,
      projectManagerIntegrated: !!this.projectManager,
      activeProjectIds: activeProjects,
      memoryUsage: {
        subscriptions: this.projectSubscriptions.size,
        metrics: this.projectMetrics.size,
        events: this.projectEvents.length
      },
      lastActivity: this.projectSubscriptions.size > 0 
        ? Math.max(...Array.from(this.projectSubscriptions.values()).map(s => s.lastActivity.getTime()))
        : null
    };
  }

  /**
   * Clear all monitoring data (for testing)
   * @returns {Promise<void>}
   */
  async clearAll() {
    this.projectSubscriptions.clear();
    this.projectMetrics.clear();
    this.projectEvents = [];
    
    console.log('👁️ [EnhancedSDObservability] Cleared all monitoring data');
  }

  /**
   * Get recent events for a project
   * @param {string} projectId - Project ID
   * @param {number} limit - Maximum number of events to return
   * @returns {Promise<Array<Object>>} Recent events
   */
  async getRecentEvents(projectId, limit = 10) {
    if (!this.projectSubscriptions.has(projectId)) {
      throw new Error(`Not subscribed to project ${projectId}`);
    }

    const projectEvents = this.projectEvents
      .filter(e => e.projectId === projectId)
      .slice(-limit);

    return projectEvents;
  }

  /**
   * Search events by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array<Object>>} Matching events
   */
  async searchEvents(criteria) {
    let filteredEvents = [...this.projectEvents];

    if (criteria.projectId) {
      filteredEvents = filteredEvents.filter(e => e.projectId === criteria.projectId);
    }

    if (criteria.type) {
      filteredEvents = filteredEvents.filter(e => e.type === criteria.type);
    }

    if (criteria.since) {
      const sinceDate = new Date(criteria.since);
      filteredEvents = filteredEvents.filter(e => e.timestamp >= sinceDate);
    }

    if (criteria.limit) {
      filteredEvents = filteredEvents.slice(-criteria.limit);
    }

    return filteredEvents;
  }
}