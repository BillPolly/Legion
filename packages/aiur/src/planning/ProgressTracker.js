/**
 * ProgressTracker - Real-time progress tracking for plan execution
 * 
 * Provides progress updates, event emission, resource updates,
 * and progress history functionality
 */

import { EventEmitter } from 'events';

export class ProgressTracker extends EventEmitter {
  constructor(plan, options = {}) {
    super();
    
    this.plan = plan;
    this.resourceUpdater = options.resourceUpdater;
    
    this.options = {
      emitEvents: options.emitEvents !== false,
      updateResources: options.updateResources !== false,
      trackHistory: options.trackHistory !== false,
      historyLimit: options.historyLimit || 100,
      updateInterval: options.updateInterval || 0,
      batchUpdates: options.batchUpdates || false,
      ...options
    };

    this.history = [];
    this.subscriptions = new Map();
    this.updateTimer = null;
    this.pendingUpdate = null;
    this.active = false;
    this.stepDurations = new Map();
    
    this._setupPlanListeners();
  }

  /**
   * Start progress tracking
   */
  async start() {
    this.active = true;
    
    if (this.options.updateResources && this.resourceUpdater) {
      await this._updateResource();
    }
  }

  /**
   * Stop progress tracking
   */
  async stop() {
    this.active = false;
    this._cleanup();
  }

  /**
   * Check if tracker is active
   */
  isActive() {
    return this.active;
  }

  /**
   * Get current progress
   */
  getCurrentProgress() {
    try {
      if (!this.plan || !this.plan.state) {
        return {
          status: 'error',
          error: 'Invalid plan state',
          totalSteps: 0,
          completedSteps: 0,
          failedSteps: 0,
          runningSteps: 0,
          percentage: 0
        };
      }

      const totalSteps = this.plan.steps.length;
      const completedSteps = this.plan.state.completedSteps.length;
      const failedSteps = this.plan.state.failedSteps.length;
      const runningSteps = this.plan.state.currentStep ? 1 : 0;
      const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      
      let status = 'pending';
      let error = null;
      
      if (failedSteps > 0) {
        status = 'failed';
        const failedStepId = this.plan.state.failedSteps[0];
        const failedStep = this.plan.state.stepStates[failedStepId];
        error = `Step ${failedStepId} failed: ${failedStep?.error?.message || 'Unknown error'}`;
      } else if (completedSteps === totalSteps) {
        status = 'completed';
      } else if (this.plan.state.status === 'running' || runningSteps > 0 || completedSteps > 0) {
        status = 'running';
      }

      const progress = {
        totalSteps,
        completedSteps,
        failedSteps,
        runningSteps,
        percentage,
        currentStep: this.plan.state.currentStep,
        status,
        error,
        startedAt: this.plan.state.startedAt,
        updatedAt: new Date()
      };

      if (status === 'completed' && this.plan.state.completedAt) {
        progress.duration = this.plan.state.completedAt.getTime() - this.plan.state.startedAt.getTime();
      }

      return progress;
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        runningSteps: 0,
        percentage: 0
      };
    }
  }

  /**
   * Get detailed progress with step information
   */
  getDetailedProgress() {
    const progress = this.getCurrentProgress();
    
    const steps = this.plan.steps.map(step => {
      const stepState = this.plan.state.stepStates[step.id];
      const stepInfo = {
        id: step.id,
        title: step.title,
        status: stepState?.status || 'pending'
      };

      if (stepState?.startedAt) {
        stepInfo.startedAt = stepState.startedAt;
      }

      if (stepState?.completedAt) {
        stepInfo.completedAt = stepState.completedAt;
        stepInfo.duration = stepState.completedAt.getTime() - stepState.startedAt.getTime();
      }

      if (stepState?.error) {
        stepInfo.error = stepState.error;
      }

      return stepInfo;
    });

    return {
      ...progress,
      steps
    };
  }

  /**
   * Get progress resource for MCP
   */
  getProgressResource() {
    const progress = this.getCurrentProgress();
    
    return {
      uri: `aiur://progress/${this.plan.id}`,
      name: `Progress: ${this.plan.title}`,
      mimeType: 'application/json',
      contents: {
        planId: this.plan.id,
        planTitle: this.plan.title,
        ...progress
      }
    };
  }

  /**
   * Get progress history
   */
  getProgressHistory(options = {}) {
    if (!this.options.trackHistory) {
      return [];
    }

    let history = [...this.history];
    
    if (options.filter) {
      switch (options.filter) {
        case 'completed':
          history = history.filter(h => h.event === 'step-completed');
          break;
        case 'failed':
          history = history.filter(h => h.event === 'step-failed');
          break;
        case 'started':
          history = history.filter(h => h.event === 'step-started');
          break;
      }
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get progress analytics
   */
  getProgressAnalytics() {
    const completedSteps = this.plan.state.completedSteps.length;
    const failedSteps = this.plan.state.failedSteps.length;
    const totalAttempts = completedSteps + failedSteps;
    
    let totalDuration = 0;
    let stepDurations = [];
    
    for (const [stepId, duration] of this.stepDurations.entries()) {
      totalDuration += duration;
      stepDurations.push({ stepId, duration });
    }

    const averageStepDuration = stepDurations.length > 0 ? 
      totalDuration / stepDurations.length : 0;

    // Identify bottlenecks (steps taking > 2x average)
    const bottlenecks = stepDurations
      .filter(s => s.duration > averageStepDuration * 2)
      .sort((a, b) => b.duration - a.duration);

    return {
      totalAttempts,
      successfulSteps: completedSteps,
      failedSteps,
      successRate: totalAttempts > 0 ? (completedSteps / totalAttempts) * 100 : 0,
      totalDuration,
      averageStepDuration,
      bottlenecks
    };
  }

  /**
   * Get estimated time to completion
   */
  getEstimatedTimeToCompletion() {
    const analytics = this.getProgressAnalytics();
    const remainingSteps = this.plan.steps.length - 
      this.plan.state.completedSteps.length - 
      this.plan.state.failedSteps.length;
    
    if (remainingSteps <= 0 || analytics.averageStepDuration === 0) {
      return 0;
    }

    return remainingSteps * analytics.averageStepDuration;
  }

  /**
   * Get progress monitoring tools
   */
  getProgressTools() {
    return {
      progress_status: {
        name: 'progress_status',
        description: 'Get current progress status',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const progress = this.getCurrentProgress();
            return {
              success: true,
              progress
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      },
      progress_history: {
        name: 'progress_history',
        description: 'Get progress history',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' },
            limit: { type: 'number' },
            filter: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const history = this.getProgressHistory(params);
            return {
              success: true,
              history
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      },
      progress_analytics: {
        name: 'progress_analytics',
        description: 'Get progress analytics',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const analytics = this.getProgressAnalytics();
            return {
              success: true,
              analytics
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      },
      progress_subscribe: {
        name: 'progress_subscribe',
        description: 'Subscribe to progress events',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } }
          }
        },
        execute: async (params) => {
          try {
            const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.subscriptions.set(subscriptionId, params);
            return {
              success: true,
              subscriptionId
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      }
    };
  }

  /**
   * Setup plan event listeners
   * @private
   */
  _setupPlanListeners() {
    this.plan.on('step-started', (event) => this._handleStepStarted(event));
    this.plan.on('step-completed', (event) => this._handleStepCompleted(event));
    this.plan.on('step-failed', (event) => this._handleStepFailed(event));
    this.plan.on('status-changed', (event) => this._handleStatusChanged(event));
  }

  /**
   * Handle step started event
   * @private
   */
  _handleStepStarted(event) {
    const progress = this.getCurrentProgress();
    
    this._addToHistory({
      event: 'step-started',
      stepId: event.stepId,
      timestamp: event.timestamp,
      progress: { ...progress }
    });

    if (this.options.emitEvents) {
      this.emit('progress', {
        type: 'step-started',
        stepId: event.stepId,
        progress,
        timestamp: event.timestamp
      });
    }

    this._scheduleResourceUpdate();
  }

  /**
   * Handle step completed event
   * @private
   */
  _handleStepCompleted(event) {
    // Track step duration
    const stepState = this.plan.state.stepStates[event.stepId];
    if (stepState?.startedAt && stepState?.completedAt) {
      const duration = stepState.completedAt.getTime() - stepState.startedAt.getTime();
      this.stepDurations.set(event.stepId, duration);
    }

    const progress = this.getCurrentProgress();
    
    this._addToHistory({
      event: 'step-completed',
      stepId: event.stepId,
      timestamp: event.timestamp,
      progress: { ...progress }
    });

    if (this.options.emitEvents) {
      this.emit('progress', {
        type: 'step-completed',
        stepId: event.stepId,
        progress,
        result: event.output,
        timestamp: event.timestamp
      });

      // Emit milestone events
      if (progress.percentage === 50) {
        this.emit('milestone', {
          milestone: '50%',
          progress,
          timestamp: new Date()
        });
      }
    }

    // Check for plan completion
    if (progress.status === 'completed') {
      this._handlePlanCompleted(progress);
    }

    this._scheduleResourceUpdate();
  }

  /**
   * Handle step failed event
   * @private
   */
  _handleStepFailed(event) {
    const progress = this.getCurrentProgress();
    
    this._addToHistory({
      event: 'step-failed',
      stepId: event.stepId,
      timestamp: event.timestamp,
      error: event.error,
      progress: { ...progress }
    });

    if (this.options.emitEvents) {
      this.emit('progress', {
        type: 'step-failed',
        stepId: event.stepId,
        progress,
        error: event.error,
        timestamp: event.timestamp
      });

      this.emit('progress', {
        type: 'plan-failed',
        progress,
        error: event.error,
        timestamp: event.timestamp
      });
    }

    this._scheduleResourceUpdate();
  }

  /**
   * Handle status changed event
   * @private
   */
  _handleStatusChanged(event) {
    const progress = this.getCurrentProgress();
    
    if (this.options.emitEvents) {
      this.emit('progress', {
        type: 'status-changed',
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        progress,
        timestamp: event.timestamp
      });
    }

    this._scheduleResourceUpdate();
  }

  /**
   * Handle plan completed
   * @private
   */
  _handlePlanCompleted(progress) {
    if (this.options.emitEvents) {
      this.emit('progress', {
        type: 'plan-completed',
        progress,
        timestamp: new Date()
      });
    }
  }

  /**
   * Add event to history
   * @private
   */
  _addToHistory(entry) {
    if (!this.options.trackHistory) {
      return;
    }

    this.history.push(entry);
    
    // Limit history size
    if (this.history.length > this.options.historyLimit) {
      this.history = this.history.slice(-this.options.historyLimit);
    }
  }

  /**
   * Schedule resource update
   * @private
   */
  _scheduleResourceUpdate() {
    if (!this.options.updateResources || !this.resourceUpdater) {
      return;
    }

    if (this.options.batchUpdates && this.options.updateInterval > 0) {
      // Cancel previous timer
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }

      // Schedule batched update
      this.updateTimer = setTimeout(() => {
        this._updateResource();
      }, this.options.updateInterval);
    } else {
      // Immediate update
      this._updateResource();
    }
  }

  /**
   * Update progress resource
   * @private
   */
  async _updateResource() {
    if (!this.active || !this.resourceUpdater) {
      return;
    }

    try {
      const progress = this.getCurrentProgress();
      await this.resourceUpdater.updateResource('progress', {
        planId: this.plan.id,
        planTitle: this.plan.title,
        ...progress
      });
    } catch (error) {
      this.emit('error', {
        type: 'resource-update-error',
        error
      });
    }
  }

  /**
   * Clean up resources
   * @private
   */
  _cleanup() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    
    this.removeAllListeners();
    this.subscriptions.clear();
  }
}