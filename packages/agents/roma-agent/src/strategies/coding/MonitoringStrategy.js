/**
 * MonitoringStrategy - Monitors task completion status and calculates project progress metrics
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createMonitoringStrategy = createTypedStrategy(
  'coding-monitoring',                                   // Strategy type for prompt path resolution
  [],                                                   // No tools required (pure monitoring)
  {                                                     // Prompt names (schemas come from YAML frontmatter)
    analyzeProgress: 'analyzeProgress',
    generateReport: 'generateReport',
    identifyBottlenecks: 'identifyBottlenecks'
  },
  {                                                     // Additional config
    updateInterval: 5000,
    enableResourceTracking: true,
    maxHistoryEntries: 100
  }
);

// Export default for backward compatibility
export default createMonitoringStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createMonitoringStrategy.doWork = async function doWork() {
  console.log(`📊 MonitoringStrategy monitoring: ${this.description}`);
  
  // Extract project data from artifacts or description
  const project = extractProjectData(this);
  if (!project) {
    return this.failWithError(
      new Error('No project data provided for monitoring'),
      'Cannot monitor without project data'
    );
  }
  
  this.addConversationEntry('system', 
    `Starting monitoring for project with ${project.tasks?.length || 0} tasks`);
  
  // Initialize metrics structure
  const metrics = {
    progressHistory: this.progressHistory || [],
    resourceUsage: this.resourceUsage || {
      byTask: {},
      total: { memory: 0, cpu: 0, duration: 0 },
      average: { memory: 0, cpu: 0, duration: 0 }
    }
  };
  
  // Calculate current project metrics
  const progress = calculateProgress(project);
  const taskStats = getTaskStats(project);
  const timing = calculateTiming(project);
  const bottlenecks = identifyBottlenecks(project);
  
  // Generate comprehensive report
  const report = generateReport(project, progress, taskStats, timing, bottlenecks);
  
  this.addConversationEntry('system', 
    `Monitoring complete: ${report.progress.overall}% progress, ${report.tasks.completed}/${report.tasks.total} tasks completed`);
  
  console.log(`✅ MonitoringStrategy completed: ${report.progress.overall}% progress`);
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  this.completeWithArtifacts({
    'monitoring-report': {
      value: JSON.stringify(report, null, 2),
      description: `Progress monitoring report at ${new Date().toISOString()}`,
      type: 'monitoring'
    },
    'progress-metrics': {
      value: JSON.stringify({
        progress: progress,
        taskStats: taskStats,
        timing: timing,
        bottlenecks: bottlenecks
      }, null, 2),
      description: 'Current progress metrics and analysis',
      type: 'metrics'
    }
  }, {
    success: true,
    progress: report.progress.overall,
    tasksCompleted: taskStats.completed,
    tasksTotal: taskStats.total,
    bottlenecksFound: bottlenecks.length
  });
};

// ============================================================================
// Helper functions - now much simpler since all boilerplate is handled
// ============================================================================

/**
 * Extract project data from task context
 */
function extractProjectData(task) {
  // Check for project-plan artifact first
  const projectPlanArtifact = task.getArtifact('project-plan');
  if (projectPlanArtifact?.value) {
    return projectPlanArtifact.value;
  }
  
  // Check for project artifact
  const projectArtifact = task.getArtifact('project');
  if (projectArtifact?.value) {
    return projectArtifact.value;
  }
  
  // Check for plan in metadata
  if (task.metadata?.project) {
    return task.metadata.project;
  }
  
  // Check for plan from parent task
  if (task.parent) {
    const parentProject = task.parent.getArtifact('project-plan');
    if (parentProject?.value) {
      return parentProject.value;
    }
  }
  
  return null;
}


/**
 * Calculate overall project progress
 */
function calculateProgress(project) {
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
function generateReport(project, progress, taskStats, timing, bottlenecks) {
  if (!project) {
    throw new Error('Project data is required');
  }

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
    phases
  };
}

