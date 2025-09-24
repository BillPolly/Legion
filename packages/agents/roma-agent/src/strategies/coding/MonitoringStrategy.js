/**
 * MonitoringStrategy - Monitors task completion status and calculates project progress metrics
 * Converted to pure prototypal pattern
 * 
 * Responsibilities:
 * - Monitors task completion status
 * - Calculates project progress metrics  
 * - Generates status reports
 * - Tracks time and resource usage
 * - Identifies bottlenecks and delays
 */

import { TaskStrategy } from '@legion/tasks';

/**
 * Create a MonitoringStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createMonitoringStrategy(options = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration in closure
  const config = {
    options: {
      updateInterval: 5000,
      enableResourceTracking: true,
      ...options
    },
    metrics: {
      overall: 0,
      byPhase: {},
      tasks: {
        total: 0,
        completed: 0,
        running: 0,
        pending: 0,
        failed: 0
      },
      timing: {
        estimatedCompletion: null,
        averageTaskDuration: null,
        totalElapsed: null
      },
      bottlenecks: []
    },
    progressHistory: [],
    resourceUsage: {
      byTask: {},
      total: { memory: 0, cpu: 0, duration: 0 },
      average: { memory: 0, cpu: 0, duration: 0 }
    },
    updateCallbacks: []
  };

  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent/initiator
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            console.log(`✅ Monitoring child task completed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-completed', child: senderTask });
            break;
            
          case 'failed':
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ MonitoringStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'monitor':
            // Fire-and-forget async operation with error boundary
            handleMonitoringRequest.call(this, config, message).catch(error => {
              console.error(`❌ MonitoringStrategy async operation failed: ${error.message}`);
              // Don't let async errors escape - handle them internally
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle async error: ${innerError.message}`);
              }
            });
            break;
            
          case 'update':
            // Fire-and-forget async operation
            handleUpdateRequest.call(this, config, message).catch(error => {
              console.error(`❌ MonitoringStrategy update failed: ${error.message}`);
            });
            break;
            
          case 'report':
            // Fire-and-forget async operation
            handleReportRequest.call(this, config, message).catch(error => {
              console.error(`❌ MonitoringStrategy report failed: ${error.message}`);
            });
            break;
            
          case 'stats':
            // Fire-and-forget - respond via send
            this.send(senderTask, { type: 'stats-response', stats: getMetrics(config) });
            break;
            
          case 'abort':
            console.log(`🛑 Monitoring task aborted`);
            break;
            
          default:
            console.log(`ℹ️ MonitoringStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ MonitoringStrategy message handler error: ${error.message}`);
      // Don't let errors escape the message handler - handle them gracefully
      try {
        if (this.addConversationEntry) {
          this.addConversationEntry('system', `Message handling error: ${error.message}`);
        }
      } catch (innerError) {
        console.error(`❌ Failed to log message handling error: ${innerError.message}`);
      }
    }
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createMonitoringStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config
// ============================================================================

/**
 * Handle monitoring request - main execution logic
 * Called with task as 'this' context
 */
async function handleMonitoringRequest(config, message) {
  try {
    console.log(`📊 MonitoringStrategy monitoring: ${this.description}`);
    
    const project = message.project;
    if (!project) {
      this.fail(new Error('No project data provided for monitoring'));
      // Notify parent of failure (fire-and-forget)
      if (this.parent) {
        this.send(this.parent, { 
          type: 'failed', 
          error: new Error('No project data provided for monitoring') 
        });
      }
      return; // Fire-and-forget - no return value
    }
    
    // Add conversation entry
    this.addConversationEntry('system', 
      `Starting monitoring for project with ${project.tasks?.length || 0} tasks`);
    
    // Update project metrics
    updateProject(project, config);
    
    // Generate comprehensive report
    const report = generateReport(project, config);
    
    // Store monitoring artifacts
    this.storeArtifact(
      'monitoring-report',
      report,
      `Progress monitoring report at ${new Date().toISOString()}`,
      'monitoring'
    );
    
    this.storeArtifact(
      'progress-metrics',
      config.metrics,
      'Current progress metrics',
      'metrics'
    );
    
    // Add conversation entry about completion
    this.addConversationEntry('system', 
      `Monitoring complete: ${report.progress.overall}% progress, ${report.tasks.completed}/${report.tasks.total} tasks completed`);
    
    console.log(`✅ MonitoringStrategy completed: ${report.progress.overall}% progress`);
    
    const result = {
      success: true,
      result: {
        report: report,
        metrics: config.metrics,
        progress: report.progress.overall
      },
      artifacts: ['monitoring-report', 'progress-metrics']
    };
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    console.error(`❌ MonitoringStrategy failed: ${error.message}`);
    
    this.addConversationEntry('system', 
      `Monitoring failed: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
    
    // Fire-and-forget - no return value
  }
}

/**
 * Handle progress update request
 */
async function handleUpdateRequest(config, message) {
  try {
    update(message.progressData, config);
    this.addConversationEntry('system', 'Progress updated successfully');
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    console.error(`❌ MonitoringStrategy update failed: ${error.message}`);
    this.addConversationEntry('system', `Progress update failed: ${error.message}`);
    
    // Fire-and-forget - no return value
  }
}

/**
 * Handle report generation request
 */
async function handleReportRequest(config, message) {
  try {
    const report = generateReport(message.project, config);
    
    // Send response back to requester
    this.send(message.sender || this.parent, {
      type: 'report-response',
      report: report
    });
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    console.error(`❌ MonitoringStrategy report failed: ${error.message}`);
    
    // Send error response
    this.send(message.sender || this.parent, {
      type: 'report-error',
      error: error.message
    });
    
    // Fire-and-forget - no return value
  }
}

/**
 * Get current metrics
 */
function getMetrics(config) {
  return { ...config.metrics };
}

/**
 * Get current progress (alias for getMetrics for compatibility)
 */
function getProgress(config) {
  return getMetrics(config);
}
  
/**
 * Update progress with new data
 */
function update(progressData, config) {
  // Handle different types of progress updates
  if (progressData.taskStarted) {
    console.log(`Task started: ${progressData.taskStarted} - ${progressData.description || ''}`);
    config.activeTask = progressData.taskStarted;
  }
  
  if (progressData.taskCompleted) {
    console.log(`Task completed: ${progressData.taskCompleted} - Success: ${progressData.success}`);
    config.completedTasks = config.completedTasks || [];
    config.completedTasks.push({
      id: progressData.taskCompleted,
      success: progressData.success,
      completedAt: new Date().toISOString()
    });
  }
  
  if (progressData.taskFailed) {
    console.log(`Task failed: ${progressData.taskFailed} - Error: ${progressData.error}`);
    config.failedTasks = config.failedTasks || [];
    config.failedTasks.push({
      id: progressData.taskFailed,
      error: progressData.error,
      failedAt: new Date().toISOString()
    });
  }
  
  // Emit progress update events if callbacks exist
  if (config.updateCallbacks && config.updateCallbacks.length > 0) {
    config.updateCallbacks.forEach(callback => {
      try {
        callback(progressData);
      } catch (error) {
        console.error('Progress update callback failed:', error);
      }
    });
  }
}

/**
 * Calculate overall project progress
 */
function calculateProgress(project, config) {
  if (!project || !project.tasks || !Array.isArray(project.tasks)) {
    return { overall: 0, byPhase: {} };
  }

  const tasks = project.tasks;
  const phases = project.phases || [];
  
  // Calculate overall progress
  const totalTasks = tasks.length;
  if (totalTasks === 0) {
    return { overall: 0, byPhase: calculatePhaseProgress(phases, tasks) };
  }

  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const overall = Math.round((completedTasks / totalTasks) * 100);

  return {
    overall,
    byPhase: calculatePhaseProgress(phases, tasks)
  };
}

/**
 * Calculate progress by phase
 */
function calculatePhaseProgress(phases, tasks) {
  const byPhase = {};
  
  phases.forEach(phase => {
    const phaseTasks = tasks.filter(task => phase.tasks && phase.tasks.includes(task.id));
    
    if (phaseTasks.length === 0) {
      byPhase[phase.id] = 0;
      return;
    }

    const completed = phaseTasks.filter(task => task.status === 'completed').length;
    byPhase[phase.id] = Math.round((completed / phaseTasks.length) * 100 * 100) / 100; // Round to 2 decimal places
  });

  return byPhase;
}

/**
 * Get task statistics by status
 */
function getTaskStats(project) {
    if (!project || !project.tasks || !Array.isArray(project.tasks)) {
      return {
        total: 0,
        completed: 0,
        running: 0,
        pending: 0,
        failed: 0
      };
    }

    const tasks = project.tasks;
    const stats = {
      total: tasks.length,
      completed: 0,
      running: 0,
      pending: 0,
      failed: 0
    };

    tasks.forEach(task => {
      switch (task.status) {
        case 'completed':
          stats.completed++;
          break;
        case 'running':
          stats.running++;
          break;
        case 'pending':
          stats.pending++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    });

    return stats;
  }

/**
 * Calculate timing metrics
 */
function calculateTiming(project, currentTime = null) {
    if (!project || !project.tasks || !Array.isArray(project.tasks)) {
      return {
        averageTaskDuration: null,
        totalElapsed: null,
        estimatedCompletion: null
      };
    }

    const tasks = project.tasks;
    const completedTasks = tasks.filter(task => 
      task.status === 'completed' && task.startedAt && task.completedAt
    );

    // Calculate average task duration
    let averageTaskDuration = null;
    if (completedTasks.length > 0) {
      const totalDuration = completedTasks.reduce((sum, task) => {
        const start = new Date(task.startedAt).getTime();
        const end = new Date(task.completedAt).getTime();
        return sum + (end - start);
      }, 0);
      
      averageTaskDuration = Math.round(totalDuration / completedTasks.length);
    }

    // Calculate total elapsed time
    let totalElapsed = null;
    if (project.createdAt && completedTasks.length > 0) {
      const projectStart = new Date(project.createdAt).getTime();
      const latestCompletion = completedTasks.reduce((latest, task) => {
        const completion = new Date(task.completedAt).getTime();
        return Math.max(latest, completion);
      }, projectStart);
      
      totalElapsed = latestCompletion - projectStart;
    }

    // Estimate completion time
    let estimatedCompletion = null;
    if (averageTaskDuration && completedTasks.length > 0) {
      const remainingTasks = tasks.filter(task => 
        task.status === 'pending' || task.status === 'running'
      ).length;
      
      if (remainingTasks > 0) {
        const now = currentTime || Date.now();
        estimatedCompletion = now + (remainingTasks * averageTaskDuration);
      }
    }

    return {
      averageTaskDuration,
      totalElapsed,
      estimatedCompletion
    };
  }

/**
 * Identify bottlenecks and delays
 */
function identifyBottlenecks(project) {
    const bottlenecks = [];
    
    if (!project || !project.tasks || !Array.isArray(project.tasks)) {
      return bottlenecks;
    }

    const now = Date.now();
    const tasks = project.tasks;

    // Check for slow-running tasks
    tasks.forEach(task => {
      if (task.status === 'running' && task.startedAt) {
        const startTime = new Date(task.startedAt).getTime();
        const duration = now - startTime;
        
        // Flag tasks running longer than 20 minutes
        if (duration > 20 * 60 * 1000) {
          bottlenecks.push({
            taskId: task.id,
            type: 'slow_task',
            description: task.description,
            duration: duration,
            impact: 'high'
          });
        }
      }
    });

    // Check for blocked tasks (pending with dependencies)
    tasks.forEach(task => {
      if (task.status === 'pending' && task.dependencies && task.dependencies.length > 0) {
        const hasUnmetDependencies = task.dependencies.some(depId => {
          const depTask = tasks.find(t => t.id === depId);
          return !depTask || depTask.status !== 'completed';
        });

        if (hasUnmetDependencies) {
          bottlenecks.push({
            taskId: task.id,
            type: 'blocked_dependency',
            description: task.description,
            dependencies: task.dependencies,
            impact: 'high'
          });
        }
      }
    });

    return bottlenecks;
  }

/**
 * Generate comprehensive status report
 */
function generateReport(project, config) {
  if (!project) {
    throw new Error('Project data is required');
  }

  const progress = calculateProgress(project, config);
  const taskStats = getTaskStats(project);
  const timing = calculateTiming(project);
  const bottlenecks = identifyBottlenecks(project);

    // Generate phase details
    const phases = (project.phases || []).map(phase => {
      const phaseTasks = (project.tasks || []).filter(task => 
        phase.tasks && phase.tasks.includes(task.id)
      );
      
      return {
        id: phase.id,
        name: phase.name,
        status: phase.status,
        progress: progress.byPhase[phase.id] || 0,
        taskCount: phaseTasks.length,
        startedAt: phase.startedAt,
        completedAt: phase.completedAt
      };
    });

    // Determine overall status
    let status = 'in_progress';
    if (progress.overall === 100) {
      status = 'completed';
    } else if (taskStats.failed > 0) {
      status = 'has_errors';
    } else if (taskStats.running === 0 && taskStats.pending === 0) {
      status = 'stalled';
    }

    return {
      projectId: project.projectId,
      timestamp: Date.now(),
      status,
      progress,
      tasks: taskStats,
      timing,
      bottlenecks,
      phases,
      resourceUsage: getResourceUsage(config)
    };
  }

/**
 * Collect metrics for a project
 * This is a public method for integration with other strategies
 */
function collectMetrics(project, config) {
  if (!project) {
    return getMetrics(config);
  }
  
  // Update metrics based on the project
  const progress = calculateProgress(project, config);
  const taskStats = getTaskStats(project);
  const timing = calculateTiming(project);
  const bottlenecks = identifyBottlenecks(project);
  
  // Update internal metrics
  config.metrics.overall = progress.overall;
  config.metrics.byPhase = progress.byPhase;
  config.metrics.tasks = taskStats;
  config.metrics.timing = timing;
  config.metrics.bottlenecks = bottlenecks;
  
  // Store in history
  config.progressHistory.push({
    timestamp: Date.now(),
    overall: progress.overall,
    byPhase: { ...progress.byPhase },
    tasks: { ...taskStats }
  });
  
  return {
    phases: progress.byPhase,
    tasks: taskStats,
    overall: progress.overall,
    timing: timing,
    bottlenecks: bottlenecks
  };
}

/**
 * Update project and recalculate metrics
 */
function updateProject(project, config) {
  if (!project) {
    throw new Error('Project data is required');
  }
  
  if (!project.projectId) {
    throw new Error('Project must have a projectId');
  }

  // Calculate new metrics
  const progress = calculateProgress(project, config);
  const taskStats = getTaskStats(project);
  const timing = calculateTiming(project);
  const bottlenecks = identifyBottlenecks(project);

  // Update metrics
  config.metrics = {
    overall: progress.overall,
    byPhase: progress.byPhase,
    tasks: taskStats,
    timing,
    bottlenecks
  };

  // Add to history
  config.progressHistory.push({
    timestamp: Date.now(),
    ...progress,
    taskStats
  });

  // Notify callbacks
  config.updateCallbacks.forEach(callback => {
    try {
      callback(progress);
    } catch (error) {
      console.error('Progress update callback failed:', error);
    }
  });
}

/**
 * Get progress history
 */
function getProgressHistory(config) {
  return [...config.progressHistory];
}

/**
 * Register progress update callback
 */
function onProgressUpdate(callback, config) {
  if (typeof callback === 'function') {
    config.updateCallbacks.push(callback);
  }
}

/**
 * Record resource usage for a task
 */
function recordResourceUsage(taskId, usage, config) {
  config.resourceUsage.byTask[taskId] = usage;
  
  // Update totals and averages
  const allUsage = Object.values(config.resourceUsage.byTask);
  if (allUsage.length > 0) {
    config.resourceUsage.total = {
      memory: allUsage.reduce((sum, u) => sum + (u.memory || 0), 0),
      cpu: allUsage.reduce((sum, u) => sum + (u.cpu || 0), 0),
      duration: allUsage.reduce((sum, u) => sum + (u.duration || 0), 0)
    };
    
    config.resourceUsage.average = {
      memory: Math.round(config.resourceUsage.total.memory / allUsage.length),
      cpu: Math.round(config.resourceUsage.total.cpu / allUsage.length),
      duration: Math.round(config.resourceUsage.total.duration / allUsage.length)
    };
  }
}

/**
 * Get resource usage data
 */
function getResourceUsage(config) {
  return { ...config.resourceUsage };
}

/**
 * Get resource-intensive tasks
 */
function getResourceIntensiveTasks(config) {
  const intensive = [];
  const usage = config.resourceUsage.byTask;
  
  Object.entries(usage).forEach(([taskId, data]) => {
    if (data.memory && data.memory > 500) {
      intensive.push({
        taskId,
        reason: 'high_memory',
        value: data.memory
      });
    }
    
    if (data.cpu && data.cpu > 80) {
      intensive.push({
        taskId,
        reason: 'high_cpu',
        value: data.cpu
      });
    }
    
    if (data.duration && data.duration > 20000) {
      intensive.push({
        taskId,
        reason: 'long_duration',
        value: data.duration
      });
    }
  });
  
  return intensive;
}