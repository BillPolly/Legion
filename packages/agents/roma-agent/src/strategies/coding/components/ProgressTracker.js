/**
 * ProgressTracker - Monitors task completion status and calculates project progress metrics
 * 
 * Responsibilities:
 * - Monitors task completion status
 * - Calculates project progress metrics  
 * - Generates status reports
 * - Tracks time and resource usage
 * - Identifies bottlenecks and delays
 */
export default class ProgressTracker {
  constructor() {
    this.metrics = {
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
    };
    
    this.progressHistory = [];
    this.resourceUsage = {
      byTask: {},
      total: { memory: 0, cpu: 0, duration: 0 },
      average: { memory: 0, cpu: 0, duration: 0 }
    };
    this.updateCallbacks = [];
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get current progress (alias for getMetrics for compatibility)
   */
  getProgress() {
    return this.getMetrics();
  }
  
  /**
   * Update progress with new data
   */
  update(progressData) {
    // Handle different types of progress updates
    if (progressData.taskStarted) {
      console.log(`Task started: ${progressData.taskStarted} - ${progressData.description || ''}`);
      this.activeTask = progressData.taskStarted;
    }
    
    if (progressData.taskCompleted) {
      console.log(`Task completed: ${progressData.taskCompleted} - Success: ${progressData.success}`);
      this.completedTasks = this.completedTasks || [];
      this.completedTasks.push({
        id: progressData.taskCompleted,
        success: progressData.success,
        completedAt: new Date().toISOString()
      });
    }
    
    if (progressData.taskFailed) {
      console.log(`Task failed: ${progressData.taskFailed} - Error: ${progressData.error}`);
      this.failedTasks = this.failedTasks || [];
      this.failedTasks.push({
        id: progressData.taskFailed,
        error: progressData.error,
        failedAt: new Date().toISOString()
      });
    }
    
    // Emit progress update events if callbacks exist
    if (this.updateCallbacks && this.updateCallbacks.length > 0) {
      this.updateCallbacks.forEach(callback => {
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
  calculateProgress(project) {
    if (!project || !project.tasks || !Array.isArray(project.tasks)) {
      return { overall: 0, byPhase: {} };
    }

    const tasks = project.tasks;
    const phases = project.phases || [];
    
    // Calculate overall progress
    const totalTasks = tasks.length;
    if (totalTasks === 0) {
      return { overall: 0, byPhase: this._calculatePhaseProgress(phases, tasks) };
    }

    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const overall = Math.round((completedTasks / totalTasks) * 100);

    return {
      overall,
      byPhase: this._calculatePhaseProgress(phases, tasks)
    };
  }

  /**
   * Calculate progress by phase
   */
  _calculatePhaseProgress(phases, tasks) {
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
  getTaskStats(project) {
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
  calculateTiming(project, currentTime = null) {
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
  identifyBottlenecks(project) {
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
  generateReport(project) {
    if (!project) {
      throw new Error('Project data is required');
    }

    const progress = this.calculateProgress(project);
    const taskStats = this.getTaskStats(project);
    const timing = this.calculateTiming(project);
    const bottlenecks = this.identifyBottlenecks(project);

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
      resourceUsage: this.getResourceUsage()
    };
  }

  /**
   * Update project and recalculate metrics
   */
  updateProject(project) {
    if (!project) {
      throw new Error('Project data is required');
    }
    
    if (!project.projectId) {
      throw new Error('Project must have a projectId');
    }

    // Calculate new metrics
    const progress = this.calculateProgress(project);
    const taskStats = this.getTaskStats(project);
    const timing = this.calculateTiming(project);
    const bottlenecks = this.identifyBottlenecks(project);

    // Update metrics
    this.metrics = {
      overall: progress.overall,
      byPhase: progress.byPhase,
      tasks: taskStats,
      timing,
      bottlenecks
    };

    // Add to history
    this.progressHistory.push({
      timestamp: Date.now(),
      ...progress,
      taskStats
    });

    // Notify callbacks
    this.updateCallbacks.forEach(callback => {
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
  getProgressHistory() {
    return [...this.progressHistory];
  }

  /**
   * Register progress update callback
   */
  onProgressUpdate(callback) {
    if (typeof callback === 'function') {
      this.updateCallbacks.push(callback);
    }
  }

  /**
   * Record resource usage for a task
   */
  recordResourceUsage(taskId, usage) {
    this.resourceUsage.byTask[taskId] = usage;
    
    // Update totals and averages
    const allUsage = Object.values(this.resourceUsage.byTask);
    if (allUsage.length > 0) {
      this.resourceUsage.total = {
        memory: allUsage.reduce((sum, u) => sum + (u.memory || 0), 0),
        cpu: allUsage.reduce((sum, u) => sum + (u.cpu || 0), 0),
        duration: allUsage.reduce((sum, u) => sum + (u.duration || 0), 0)
      };
      
      this.resourceUsage.average = {
        memory: Math.round(this.resourceUsage.total.memory / allUsage.length),
        cpu: Math.round(this.resourceUsage.total.cpu / allUsage.length),
        duration: Math.round(this.resourceUsage.total.duration / allUsage.length)
      };
    }
  }

  /**
   * Get resource usage data
   */
  getResourceUsage() {
    return { ...this.resourceUsage };
  }

  /**
   * Get resource-intensive tasks
   */
  getResourceIntensiveTasks() {
    const intensive = [];
    const usage = this.resourceUsage.byTask;
    
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
}