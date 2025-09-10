/**
 * ProjectManagementServerActor - Server-side project management coordination
 * 
 * Handles all project management functionality that was previously in GeminiRootServerActor
 */

import { ProjectManagerAgent } from '../../project-management/agents/ProjectManagerAgent.js';
import { DeliverableLifecycleManager } from '../../project-management/services/DeliverableLifecycleManager.js';
import { AgentCoordinationMonitor } from '../../project-management/services/AgentCoordinationMonitor.js';
import { ProjectEventBroadcaster } from '../../project-management/services/ProjectEventBroadcaster.js';
import { ProjectState } from '../../project-management/models/ProjectState.js';
import { Deliverable } from '../../project-management/models/Deliverable.js';

/**
 * Server actor for project management coordination
 */
export default class ProjectManagementServerActor {
  constructor(config = {}) {
    this.resourceManager = config.resourceManager;
    this.mainActor = null; // Reference to main server actor
    this.dashboardActor = null; // Reference to dashboard actor
    
    // Project management components
    this.projectManager = null;
    this.deliverableManager = null;
    this.coordinationMonitor = null;
    this.eventBroadcaster = null;
    
    console.log('🎯 ProjectManagementServerActor created');
  }

  /**
   * Set main server actor reference
   */
  setMainActor(mainActor) {
    this.mainActor = mainActor;
  }

  /**
   * Set dashboard actor reference
   */
  setDashboardActor(dashboardActor) {
    this.dashboardActor = dashboardActor;
  }

  /**
   * Initialize project management components
   */
  async initialize() {
    try {
      // Initialize ProjectManagerAgent
      this.projectManager = new ProjectManagerAgent({
        resourceManager: this.resourceManager
      });
      await this.projectManager.initialize();

      // Initialize event broadcaster
      this.eventBroadcaster = new ProjectEventBroadcaster({
        remoteActor: this.mainActor?.remoteActor
      });

      // Initialize coordination monitor
      this.coordinationMonitor = new AgentCoordinationMonitor({
        projectManager: this.projectManager,
        eventBroadcaster: this.eventBroadcaster
      });

      // Initialize deliverable manager
      this.deliverableManager = new DeliverableLifecycleManager({
        projectManager: this.projectManager,
        coordinationMonitor: this.coordinationMonitor
      });

      // Set up project manager connections
      if (this.projectManager) {
        this.projectManager.setParentActor(this);
        // ProjectManager will connect directly to dashboard when dashboard connects
        console.log('🔗 ProjectManager ready for direct dashboard connection');
      }

      console.log('🎯 [ProjectManagementServerActor] Project management components initialized');
      
    } catch (error) {
      console.error('❌ Project management initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Handle get project data request
   */
  async handleGetProjectData(data) {
    if (!this.projectManager) {
      console.warn('⚠️ Project manager not available');
      return;
    }

    try {
      const projectId = data.projectId;
      const summary = await this.projectManager.generateProjectSummary(projectId);
      const deliverables = await this.projectManager.getDeliverables(projectId);

      const response = {
        projectId: projectId,
        summary: summary,
        deliverables: deliverables.map(d => ({
          id: d.id,
          name: d.name,
          phase: d.phase,
          status: d.status,
          completion: d.completion,
          assignedAgent: d.assignedAgent
        }))
      };

      console.log(`📊 [ProjectManagementServerActor] Sent project data for: ${projectId}`);
      return response;

    } catch (error) {
      console.error('❌ Failed to get project data:', error.message);
      throw error;
    }
  }

  /**
   * Handle get deliverable details request
   */
  async handleGetDeliverableDetails(data) {
    try {
      const projectId = data.projectId;
      const deliverableId = data.deliverableId;

      if (!this.projectManager.databaseService) {
        throw new Error('Database service not available');
      }

      const deliverableArtifacts = await this.projectManager.databaseService.mongoProvider
        .find('sd_artifacts', { 
          type: 'deliverable_completion', 
          projectId: projectId, 
          deliverableId: deliverableId 
        });

      if (deliverableArtifacts.length === 0) {
        return {
          deliverableId: deliverableId,
          error: 'Deliverable not found in database',
          found: false
        };
      }

      const deliverableData = deliverableArtifacts[0];
      
      const response = {
        deliverableId: deliverableId,
        deliverableName: deliverableData.content.name,
        status: deliverableData.content.status,
        completion: deliverableData.content.completion,
        result: deliverableData.content.result,
        artifacts: deliverableData.content.artifacts,
        completedAt: deliverableData.content.completedAt,
        agent: deliverableData.metadata.agent,
        phase: deliverableData.metadata.phase,
        executionTime: deliverableData.metadata.executionTime,
        found: true
      };

      console.log(`🔍 [ProjectManagementServerActor] Sent deliverable details for: ${deliverableId}`);
      return response;

    } catch (error) {
      console.error('❌ Failed to get deliverable details:', error.message);
      throw error;
    }
  }

  /**
   * Handle project management commands
   */
  async handleProjectCommand(args = []) {
    if (!this.projectManager) {
      return `❌ **Project Management Not Available:** Project management features are not initialized.`;
    }

    const subCommand = args[0];
    if (!subCommand) {
      return `**Project Management Commands:**

🎯 **/project status** - Show current project status and progress
📋 **/project plan <goal>** - Initialize new project planning
📊 **/project deliverables** - Show deliverable status and progress
🔄 **/project phase** - Show current phase and transition readiness
📈 **/project list** - List all projects
🎯 **/project switch <project-id>** - Switch to different project
🚀 **/project start** - Start agents working on current project
⏸️ **/project pause** - Pause current project work

Current project: ${this.projectManager.currentProject || 'None'}`;
    }

    try {
      switch (subCommand.toLowerCase()) {
        case 'status':
          return await this._handleProjectStatus(args.slice(1));
        case 'plan':
          return await this._handleProjectPlan(args.slice(1));
        case 'deliverables':
          return await this._handleProjectDeliverables(args.slice(1));
        case 'phase':
          return await this._handleProjectPhase(args.slice(1));
        case 'list':
          return await this._handleProjectList();
        case 'switch':
          return await this._handleProjectSwitch(args.slice(1));
        case 'start':
          return await this._handleProjectStart(args.slice(1));
        case 'load':
          return await this._handleProjectLoad(args.slice(1));
        case 'pause':
          return await this._handleProjectPause(args.slice(1));
        default:
          return `❌ **Unknown Project Command:** /project ${subCommand}`;
      }
    } catch (error) {
      console.error('❌ Project command error:', error.message);
      return `❌ **Project Command Error:** ${error.message}`;
    }
  }

  /**
   * Get project context for LLM enhancement
   */
  async getProjectContext() {
    if (!this.projectManager || !this.projectManager.currentProject) {
      return 'No active project';
    }

    try {
      const projectId = this.projectManager.currentProject;
      const summary = await this.projectManager.generateProjectSummary(projectId);
      
      return `Active project "${summary.projectName}" (${summary.currentPhase} phase, ${summary.progressPercentage}% complete, ${summary.completedDeliverables}/${summary.totalDeliverables} deliverables done)`;
    } catch (error) {
      return 'Project context unavailable';
    }
  }

  /**
   * Get current project for context
   */
  getCurrentProject() {
    return this.projectManager?.currentProject || null;
  }

  // Private methods - extracted from GeminiRootServerActor

  async _handleProjectStatus(args) {
    const projectId = args[0] || this.projectManager.currentProject;
    if (!projectId) {
      return `❌ **No Project Selected:** Use \`/project list\` to see available projects or \`/project plan <goal>\` to create one.`;
    }

    try {
      const summary = await this.projectManager.generateProjectSummary(projectId);
      const phaseProgress = this.deliverableManager 
        ? await this.deliverableManager.getPhaseProgress(projectId, summary.currentPhase)
        : null;

      return `**🎯 Project Status: ${summary.projectName}**

📊 **Progress:** ${summary.progressPercentage}% (${summary.completedDeliverables}/${summary.totalDeliverables} deliverables)
🔄 **Current Phase:** ${summary.currentPhase}
📈 **Status:** ${summary.currentStatus}
🤖 **Active Agents:** ${summary.activeAgents}

${phaseProgress ? `**Phase Progress:**
✅ Completed: ${phaseProgress.completedDeliverables}/${phaseProgress.totalDeliverables}
🔄 In Progress: ${phaseProgress.inProgressDeliverables}
🚫 Blocked: ${phaseProgress.blockedDeliverables}
📊 Phase Completion: ${phaseProgress.averageCompletion}%` : ''}

🕒 **Last Updated:** ${new Date(summary.updatedAt).toLocaleString()}
📅 **Created:** ${new Date(summary.createdAt).toLocaleString()}`;

    } catch (error) {
      return `❌ **Error:** ${error.message}`;
    }
  }

  async _handleProjectPlan(args) {
    const goal = args.join(' ');
    if (!goal) {
      return `❌ **Project Goal Required:** Use \`/project plan <your project goal>\`

**Example:** \`/project plan Build a user authentication system\``;
    }

    try {
      const projectId = `project-${Date.now()}`;
      
      const project = await this.projectManager.initializeProject({
        id: projectId,
        name: goal,
        description: `Project created from goal: ${goal}`
      });

      const deliverables = this.deliverableManager 
        ? await this.deliverableManager.createStandardDeliverables(projectId, 'requirements')
        : [];

      if (this.coordinationMonitor) {
        await this.coordinationMonitor.startMonitoring(projectId);
      }

      if (this.eventBroadcaster) {
        await this.eventBroadcaster.broadcastUpdate({
          type: 'project_created',
          projectId: projectId,
          projectName: goal,
          phase: 'requirements',
          deliverables: deliverables.map(d => d.getSummary())
        });
      }

      return `**🎯 New Project Created: ${goal}**

📝 **Project ID:** ${projectId}
🔄 **Initial Phase:** Requirements
📋 **Deliverables Created:** ${deliverables.length}

**Next Steps:**
1. Requirements Analysis
2. User Stories Generation  
3. Acceptance Criteria Definition

Use \`/project status\` to monitor progress!`;

    } catch (error) {
      return `❌ **Project Creation Failed:** ${error.message}`;
    }
  }

  async _handleProjectDeliverables(args) {
    const projectId = args[0] || this.projectManager.currentProject;
    if (!projectId) {
      return `❌ **No Project Selected:** Use \`/project list\` to see projects.`;
    }

    try {
      const deliverablesByPhase = this.deliverableManager
        ? await this.deliverableManager.getDeliverablesByPhase(projectId)
        : {};

      let response = `**📋 Deliverables for Project: ${projectId}**\n\n`;

      for (const [phase, deliverables] of Object.entries(deliverablesByPhase)) {
        if (deliverables.length > 0) {
          response += `**🔄 ${phase.toUpperCase()} Phase:**\n`;
          
          deliverables.forEach(deliverable => {
            const statusIcon = deliverable.isCompleted() ? '✅' : 
                              deliverable.isInProgress() ? '🔄' : 
                              deliverable.isBlocked() ? '🚫' : '⏳';
            response += `${statusIcon} ${deliverable.name} (${deliverable.completion}%)\n`;
            if (deliverable.assignedAgent) {
              response += `   👤 Agent: ${deliverable.assignedAgent}\n`;
            }
          });
          response += '\n';
        }
      }

      return response;

    } catch (error) {
      return `❌ **Error:** ${error.message}`;
    }
  }

  async _handleProjectPhase(args) {
    const projectId = args[0] || this.projectManager.currentProject;
    if (!projectId) {
      return `❌ **No Project Selected:** Use \`/project list\` to see projects.`;
    }

    try {
      const project = await this.projectManager.getProjectStatus(projectId);
      const phaseProgress = this.deliverableManager
        ? await this.deliverableManager.getPhaseProgress(projectId, project.phase)
        : null;

      return `**🔄 Phase Information: ${project.phase.toUpperCase()}**

📊 **Phase Progress:** ${phaseProgress ? phaseProgress.averageCompletion : 0}%
✅ **Completed:** ${phaseProgress ? phaseProgress.completedDeliverables : 0}
🔄 **In Progress:** ${phaseProgress ? phaseProgress.inProgressDeliverables : 0}
🚫 **Blocked:** ${phaseProgress ? phaseProgress.blockedDeliverables : 0}
🎯 **Phase Complete:** ${phaseProgress ? (phaseProgress.isPhaseComplete ? 'Yes' : 'No') : 'Unknown'}

**Phase Sequence:**
Requirements → Domain → Architecture → Implementation → Testing
${this._renderPhaseIndicator(project.phase)}`;

    } catch (error) {
      return `❌ **Error:** ${error.message}`;
    }
  }

  async _handleProjectList() {
    try {
      const memoryProjects = await this.projectManager.getProjectList();
      
      let databaseProjects = [];
      if (this.projectManager.databaseService) {
        const dbArtifacts = await this.projectManager.databaseService.mongoProvider
          .find('sd_artifacts', { type: 'project_state' });
        
        databaseProjects = dbArtifacts.map(artifact => ({
          id: artifact.projectId,
          name: artifact.content.name,
          phase: artifact.content.phase,
          status: artifact.content.status,
          createdAt: artifact.content.createdAt
        }));
      }
      
      const totalProjects = memoryProjects.length + databaseProjects.length;
      
      if (totalProjects === 0) {
        return `**📁 No Projects Found**

Use \`/project plan <goal>\` to create your first project!

**Example:** \`/project plan Build a user authentication system\``;
      }

      let response = `**📁 All Projects (${totalProjects})**\n\n`;

      if (memoryProjects.length > 0) {
        response += `**💾 Current Session (${memoryProjects.length}):**\n`;
        memoryProjects.forEach(project => {
          const current = project.id === this.projectManager.currentProject ? '👉 ' : '   ';
          const progress = project.getProgressSummary();
          response += `${current}**${project.name}** (${project.id})\n`;
          response += `   🔄 Phase: ${project.phase}\n`;
          response += `   📊 Progress: ${progress.progressPercentage}%\n`;
          response += `   📈 Status: ${project.status}\n\n`;
        });
      }

      if (databaseProjects.length > 0) {
        response += `**🗄️ Database Projects (${databaseProjects.length}):**\n`;
        databaseProjects.forEach(project => {
          response += `   **${project.name}** (${project.id})\n`;
          response += `   🔄 Phase: ${project.phase}\n`;
          response += `   📈 Status: ${project.status}\n`;
          response += `   📅 Created: ${new Date(project.createdAt).toLocaleDateString()}\n\n`;
        });
        
        response += `💡 **Tip:** Use \`/project load <project-id>\` to load a database project.`;
      }

      return response;

    } catch (error) {
      return `❌ **Error:** ${error.message}`;
    }
  }

  async _handleProjectSwitch(args) {
    const projectId = args[0];
    if (!projectId) {
      return `❌ **Project ID Required:** Use \`/project switch <project-id>\``;
    }

    try {
      await this.projectManager.setCurrentProject(projectId);
      const project = await this.projectManager.getCurrentProject();

      return `**🎯 Switched to Project: ${project.name}**

📝 **ID:** ${project.id}
🔄 **Phase:** ${project.phase}
📊 **Progress:** ${project.getProgressSummary().progressPercentage}%

Use \`/project status\` for detailed information.`;

    } catch (error) {
      return `❌ **Error:** ${error.message}`;
    }
  }

  async _handleProjectStart(args) {
    const projectId = args[0] || this.projectManager.currentProject;
    if (!projectId) {
      return `❌ **No Project Selected:** Use \`/project list\` to see projects.`;
    }

    try {
      const result = await this.projectManager.startWorkingOnCurrentProject();
      
      if (this.eventBroadcaster) {
        await this.eventBroadcaster.broadcastUpdate({
          type: 'project_work_started',
          projectId: projectId,
          deliverablesStarted: result.deliverablesStarted,
          phase: result.phase
        });
      }

      return `**🚀 Project Work Started!**

📊 **Project:** ${projectId}
🔄 **Phase:** ${result.phase}
🤖 **Deliverables Started:** ${result.deliverablesStarted}

Agents are now working on deliverables. Use \`/project status\` to monitor progress!
Real-time updates will show in the project dashboard as agents complete work.`;

    } catch (error) {
      return `❌ **Error Starting Project Work:** ${error.message}`;
    }
  }

  async _handleProjectPause(args) {
    const projectId = args[0] || this.projectManager.currentProject;
    if (!projectId) {
      return `❌ **No Project Selected:** Use \`/project list\` to see projects.`;
    }

    try {
      const project = await this.projectManager.getProjectStatus(projectId);
      await this.projectManager.updateProject(projectId, { status: 'paused' });

      return `**⏸️ Project Work Paused**

📊 **Project:** ${project.name}
🔄 **Phase:** ${project.phase}

Project work has been paused. Use \`/project start\` to resume.`;

    } catch (error) {
      return `❌ **Error Pausing Project:** ${error.message}`;
    }
  }

  async _handleProjectLoad(args) {
    const projectId = args[0];
    if (!projectId) {
      return `❌ **Project ID Required:** Use \`/project load <project-id>\`

Use \`/project list\` to see available projects in database.`;
    }

    try {
      if (this.projectManager.databaseService) {
        const projectArtifacts = await this.projectManager.databaseService.mongoProvider
          .find('sd_artifacts', { type: 'project_state', projectId: projectId });

        if (projectArtifacts.length === 0) {
          return `❌ **Project Not Found:** No project with ID ${projectId} found in database.`;
        }

        const projectData = projectArtifacts[0].content;
        const projectState = ProjectState.fromJSON(projectData);
        
        const deliverableArtifacts = await this.projectManager.databaseService.mongoProvider
          .find('sd_artifacts', { type: 'deliverable_completion', projectId: projectId });

        for (const delArtifact of deliverableArtifacts) {
          const deliverable = new Deliverable({
            id: delArtifact.deliverableId,
            name: delArtifact.content.name,
            description: `Restored from database - ${delArtifact.content.name}`,
            phase: delArtifact.metadata.phase,
            status: delArtifact.content.status,
            completion: delArtifact.content.completion,
            assignedAgent: delArtifact.metadata.agent,
            completedAt: delArtifact.content.completedAt
          });
          
          projectState.addDeliverable(delArtifact.deliverableId, deliverable);
        }

        await this.projectManager._createStandardDeliverables(projectId, projectState.phase);
        
        this.projectManager.projects.set(projectId, projectState);
        await this.projectManager.setCurrentProject(projectId);

        let completedDeliverables = deliverableArtifacts.length;

        return `**📂 Project Loaded from Database**

📝 **Project:** ${projectData.name}
📊 **ID:** ${projectId}
🔄 **Phase:** ${projectData.phase}
📈 **Status:** ${projectData.status}
✅ **Completed Deliverables:** ${completedDeliverables}

**Database Records Found:**
- Project state record ✅
- ${completedDeliverables} deliverable completion records

Use \`/project status\` to see current details or \`/project start\` to continue work.`;

      } else {
        return `❌ **Database Not Available:** Cannot load projects from database.`;
      }

    } catch (error) {
      return `❌ **Load Error:** ${error.message}`;
    }
  }

  _renderPhaseIndicator(currentPhase) {
    const phases = ['requirements', 'domain', 'architecture', 'implementation', 'testing'];
    const currentIndex = phases.indexOf(currentPhase);
    
    return phases.map((phase, index) => {
      if (index < currentIndex) return `✅ ${phase}`;
      if (index === currentIndex) return `🔄 ${phase} (current)`;
      return `⏳ ${phase}`;
    }).join(' → ');
  }
}