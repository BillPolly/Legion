/**
 * AgentMonitor - Monitors SD agent activity and status
 */

export class AgentMonitor {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.agentStatus = new Map();
    this.agentActivity = new Map();
    
    // Initialize with known SD agents
    this.initializeAgents();
  }

  initializeAgents() {
    const sdAgents = [
      'RequirementsAgent',
      'DomainModelingAgent',
      'ArchitectureAgent',
      'StateDesignAgent',
      'FluxAgent',
      'TestGenerationAgent',
      'CodeGenerationAgent',
      'QualityAssuranceAgent',
      'LiveTestingAgent'
    ];
    
    for (const agent of sdAgents) {
      this.agentStatus.set(agent, {
        name: agent,
        status: 'idle',
        currentTask: null,
        lastActivity: null,
        tasksCompleted: 0,
        errors: 0
      });
    }
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentName, status, currentTask = null) {
    if (!this.agentStatus.has(agentName)) {
      this.agentStatus.set(agentName, {
        name: agentName,
        status: 'idle',
        currentTask: null,
        lastActivity: null,
        tasksCompleted: 0,
        errors: 0
      });
    }
    
    const agentInfo = this.agentStatus.get(agentName);
    agentInfo.status = status;
    agentInfo.currentTask = currentTask;
    agentInfo.lastActivity = new Date().toISOString();
    
    if (status === 'completed') {
      agentInfo.tasksCompleted++;
    } else if (status === 'error') {
      agentInfo.errors++;
    }
    
    // Record activity
    this.recordActivity(agentName, status, currentTask);
  }

  /**
   * Record agent activity for history
   */
  recordActivity(agentName, status, task) {
    if (!this.agentActivity.has(agentName)) {
      this.agentActivity.set(agentName, []);
    }
    
    this.agentActivity.get(agentName).push({
      status,
      task,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 activities per agent
    const activities = this.agentActivity.get(agentName);
    if (activities.length > 100) {
      activities.shift();
    }
  }

  /**
   * Get all active agents
   */
  getActiveAgents() {
    const active = [];
    
    for (const [name, info] of this.agentStatus) {
      if (info.status !== 'idle') {
        active.push({
          name,
          status: info.status,
          currentTask: info.currentTask,
          startTime: info.lastActivity
        });
      }
    }
    
    return active;
  }

  /**
   * Get all agent status
   */
  getAllAgentStatus() {
    return Array.from(this.agentStatus.values());
  }

  /**
   * Get specific agent status
   */
  getAgentStatus(agentName) {
    return this.agentStatus.get(agentName) || null;
  }

  /**
   * Get agent activity history
   */
  getAgentActivity(agentName, limit = 10) {
    const activities = this.agentActivity.get(agentName) || [];
    return activities.slice(-limit);
  }

  /**
   * Get activity metrics
   */
  getActivityMetrics() {
    const metrics = {
      totalAgents: this.agentStatus.size,
      activeAgents: 0,
      idleAgents: 0,
      totalTasksCompleted: 0,
      totalErrors: 0,
      agentUtilization: {}
    };
    
    for (const [name, info] of this.agentStatus) {
      if (info.status !== 'idle') {
        metrics.activeAgents++;
      } else {
        metrics.idleAgents++;
      }
      
      metrics.totalTasksCompleted += info.tasksCompleted;
      metrics.totalErrors += info.errors;
      
      // Calculate utilization (simplified)
      const activities = this.agentActivity.get(name) || [];
      const activeTime = activities.filter(a => a.status === 'working').length;
      const totalTime = activities.length;
      
      metrics.agentUtilization[name] = totalTime > 0 ? 
        ((activeTime / totalTime) * 100).toFixed(2) + '%' : '0%';
    }
    
    return metrics;
  }

  /**
   * Get agent timeline
   */
  getAgentTimeline(agentName) {
    const activities = this.agentActivity.get(agentName) || [];
    
    return activities.map(activity => ({
      time: activity.timestamp,
      status: activity.status,
      task: activity.task
    }));
  }

  /**
   * Get current workload distribution
   */
  getWorkloadDistribution() {
    const distribution = {};
    
    for (const [name, info] of this.agentStatus) {
      const phase = this.getAgentPhase(name);
      if (!distribution[phase]) {
        distribution[phase] = [];
      }
      
      distribution[phase].push({
        agent: name,
        status: info.status,
        task: info.currentTask
      });
    }
    
    return distribution;
  }

  /**
   * Get agent phase mapping
   */
  getAgentPhase(agentName) {
    const phaseMap = {
      'RequirementsAgent': 'requirements',
      'DomainModelingAgent': 'domain-modeling',
      'ArchitectureAgent': 'architecture',
      'StateDesignAgent': 'state-design',
      'FluxAgent': 'flux-architecture',
      'TestGenerationAgent': 'testing',
      'CodeGenerationAgent': 'implementation',
      'QualityAssuranceAgent': 'quality-assurance',
      'LiveTestingAgent': 'live-testing'
    };
    
    return phaseMap[agentName] || 'unknown';
  }

  /**
   * Simulate agent activity (for demo purposes)
   */
  simulateActivity() {
    const agents = Array.from(this.agentStatus.keys());
    const randomAgent = agents[Math.floor(Math.random() * agents.length)];
    
    const statuses = ['idle', 'working', 'completed', 'validating'];
    const tasks = [
      'Parsing requirements',
      'Creating domain model',
      'Designing architecture',
      'Generating code',
      'Running tests',
      'Validating compliance'
    ];
    
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
    
    this.updateAgentStatus(randomAgent, randomStatus, randomTask);
  }

  /**
   * Reset all agent status
   */
  reset() {
    for (const [name, info] of this.agentStatus) {
      info.status = 'idle';
      info.currentTask = null;
      info.lastActivity = null;
    }
    
    this.agentActivity.clear();
  }
}