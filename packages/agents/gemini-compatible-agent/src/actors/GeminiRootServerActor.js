/**
 * GeminiRootServerActor - Top-level server actor wrapping existing functionality
 * Minimal wrapper around ToolCallingConversationManager with actor framework integration
 */

import ToolCallingConversationManager from '../conversation/ToolCallingConversationManager.js';
import { ProjectManagerAgent } from '../project-management/agents/ProjectManagerAgent.js';
import { DeliverableLifecycleManager } from '../project-management/services/DeliverableLifecycleManager.js';
import { AgentCoordinationMonitor } from '../project-management/services/AgentCoordinationMonitor.js';
import { ProjectEventBroadcaster } from '../project-management/services/ProjectEventBroadcaster.js';

/**
 * Root server actor for Gemini agent (wraps existing functionality)
 */
export default class GeminiRootServerActor {
  constructor(services = {}) {
    this.services = services;
    this.remoteActor = null;
    this.conversationManager = null;
    this.isReady = false;
    
    // Initialize ResourceManager from services or create one
    this.resourceManager = services.resourceManager || this._createResourceManager();
    
    // Project management components
    this.projectManager = null;
    this.deliverableManager = null;
    this.coordinationMonitor = null;
    this.eventBroadcaster = null;
    
    console.log('🎭 GeminiRootServerActor created with services:', Object.keys(services));
  }

  /**
   * Create ResourceManager if not provided in services
   */
  async _createResourceManager() {
    const { ResourceManager } = await import('@legion/resource-manager');
    return await ResourceManager.getInstance();
  }

  /**
   * Initialize project management components
   */
  async _initializeProjectManagement() {
    try {
      // Initialize ProjectManagerAgent
      this.projectManager = new ProjectManagerAgent({
        resourceManager: this.resourceManager
      });
      await this.projectManager.initialize();

      // Initialize event broadcaster with actor reference
      this.eventBroadcaster = new ProjectEventBroadcaster({
        remoteActor: this.remoteActor
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

      console.log('🎯 [ACTOR] Project management components initialized');
      
    } catch (error) {
      console.error('❌ Project management initialization failed:', error.message);
      // Don't fail the entire actor - project management is optional
    }
  }

  /**
   * Set remote actor connection (Legion actor framework pattern)
   * @param {Object} remoteActor - Remote actor reference
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Gemini server actor connected to client');
    
    try {
      // Ensure ResourceManager is ready
      if (!this.resourceManager.getInstance) {
        this.resourceManager = await this._createResourceManager();
      }
      
      console.log('🎭 Creating ToolCallingConversationManager with ResourceManager...');
      
      // Initialize existing conversation manager (no changes to it)
      this.conversationManager = new ToolCallingConversationManager(this.resourceManager);
      
      // Initialize project management components
      await this._initializeProjectManagement();
      
      // Wait for conversation manager to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Existing conversation manager and project management wrapped in actor');
      
      // Wait for client to be fully ready before sending ready signal
      setTimeout(() => {
        console.log('📤 [SERVER] Sending ready signal to client...');
        this.remoteActor.receive('ready', {
          timestamp: new Date().toISOString(),
          tools: this.conversationManager.toolsModule?.getStatistics()?.toolCount || 0,
          observability: !!this.conversationManager.observabilityService,
          sdMethodology: !!this.conversationManager.sdMethodologyService
        });
        console.log('✅ [SERVER] Ready signal sent!');
      }, 1000); // Wait 1 second for client to fully initialize
      
      this.isReady = true;
      
    } catch (error) {
      console.error('❌ Gemini actor initialization failed:', error.message);
      console.error('❌ Full error stack:', error.stack);
      
      this.remoteActor.receive('error', {
        message: error.message,
        component: 'GeminiRootServerActor'
      });
    }
  }

  /**
   * Receive messages from client actor (Legion actor framework pattern)
   * @param {string} messageType - Type of message
   * @param {Object} data - Message data
   */
  async receive(messageType, data) {
    if (!this.isReady) {
      console.warn('⚠️ Actor not ready, ignoring message:', messageType);
      return;
    }

    try {
      switch (messageType) {
        case 'chat_message':
          await this._handleChatMessage(data);
          break;
          
        case 'slash_command':
          await this._handleSlashCommand(data);
          break;
          
        case 'observability_request':
          await this._handleObservabilityRequest(data);
          break;
          
        default:
          console.warn('⚠️ Unknown message type:', messageType);
      }
    } catch (error) {
      console.error('❌ Actor message handling failed:', error.message);
      
      this.remoteActor.receive('error', {
        message: error.message,
        messageType,
        component: 'message_handling'
      });
    }
  }

  /**
   * Handle chat messages (wraps existing functionality)
   * @param {Object} data - Chat message data
   */
  async _handleChatMessage(data) {
    const message = data.content.trim();
    
    // Check if this is a slash command
    if (message.startsWith('/')) {
      console.log('⚡ [ACTOR] Processing slash command directly');
      const parts = message.substring(1).split(' ');
      const command = parts[0];
      const args = parts.slice(1);
      
      // Check if it's a project command
      if (command === 'project' && this.projectManager) {
        const response = await this._handleProjectCommand(args);
        this.remoteActor.receive('project_response', {
          type: 'response',
          content: response,
          isProjectCommand: true
        });
        return;
      }
      
      // Handle regular slash command directly (not through LLM)
      const response = await this._handleSlashCommandLegacy(command, args);
      
      // Send response through actor framework
      this.remoteActor.receive('slash_response', {
        type: 'response',
        content: response,
        isSlashCommand: true
      });
      
      return;
    }
    
    console.log('💬 [ACTOR] Processing chat message through existing conversation manager');
    
    // Add project context if available
    let enhancedMessage = data.content;
    if (this.projectManager && this.projectManager.currentProject) {
      const projectContext = await this._getProjectContext();
      enhancedMessage = `${data.content}\n\n[Project Context: ${projectContext}]`;
    }
    
    // Use existing working conversation manager (no changes needed)
    const response = await this.conversationManager.processMessage(enhancedMessage);
    
    console.log('📤 [ACTOR] Sending response through actor framework');
    
    // Send response back through actor framework (not WebSocket)
    this.remoteActor.receive('chat_response', {
      type: 'response',
      content: response.content,
      tools: response.tools || [],
      timestamp: response.timestamp,
      sdMethodologyApplied: response.sdMethodologyApplied || false,
      projectContext: this.projectManager?.currentProject || null
    });
  }

  /**
   * Handle slash commands (wraps existing functionality) 
   * @param {Object} data - Slash command data
   */
  async _handleSlashCommand(data) {
    console.log('⚡ [ACTOR] Processing slash command');
    
    // Use existing slash command handling (from server.js)
    const response = await this._handleSlashCommandLegacy(data.command, data.args);
    
    // Send response through actor framework
    this.remoteActor.receive('slash_response', {
      type: 'response',
      content: response,
      isSlashCommand: true
    });
  }

  /**
   * Handle observability requests
   * @param {Object} data - Observability request data
   */
  async _handleObservabilityRequest(data) {
    const observabilityData = this.conversationManager.observabilityService?.getSystemStatus() || {};
    
    this.remoteActor.receive('observability_data', observabilityData);
  }

  /**
   * Legacy slash command handling (preserve existing functionality)
   * @param {string} command - Slash command
   * @param {Array} args - Command arguments
   * @returns {string} Command response
   */
  async _handleSlashCommandLegacy(command, args = []) {
    // Copy existing slash command logic from server.js
    switch (command) {
      case 'help':
        return `**Available Slash Commands:**

⚡ **/help** - Show this help message
📊 **/show <param>** - Show agent state (tools, context, files, errors, debug, all)
🧹 **/clear** - Clear conversation history

Regular chat messages work as before for tool calling!`;

      case 'show':
        const param = args[0];
        if (!param) {
          return `**Show Command Usage:**

Use \`/show <parameter>\` where parameter is:
• tools, context, debug, all`;
        }
        
        switch (param.toLowerCase()) {
          case 'tools':
            const toolsStats = this.conversationManager.toolsModule?.getStatistics();
            return toolsStats ? `**🔧 Tools (${toolsStats.toolCount}):** ${toolsStats.tools.join(', ')}` : 'Tools not available';
            
          case 'all':
            const allStats = this.conversationManager.toolsModule?.getStatistics() || {};
            const obsStats = this.conversationManager.observabilityService?.getSystemStatus() || {};
            return `**🎯 Complete State:**
🔧 Tools: ${allStats.toolCount || 0}
💬 Messages: ${this.conversationManager.getConversationHistory().length}
📊 Active Executions: ${obsStats.activeExecutions || 0}
💾 Memory: ${obsStats.memoryUsage || 'unknown'}
🔍 Observability: ${obsStats.totalEvents || 0} events tracked`;
            
          default:
            return `Unknown parameter: ${param}`;
        }

      case 'clear':
        this.conversationManager.clearHistory();
        return '🧹 **Everything Cleared!**';

      default:
        return `❌ **Unknown Command:** /${command}`;
    }
  }

  /**
   * Handle project management commands
   * @param {Array} args - Command arguments
   * @returns {string} Command response
   */
  async _handleProjectCommand(args = []) {
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

        default:
          return `❌ **Unknown Project Command:** /project ${subCommand}`;
      }
    } catch (error) {
      console.error('❌ Project command error:', error.message);
      return `❌ **Project Command Error:** ${error.message}`;
    }
  }

  /**
   * Handle /project status command
   */
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

  /**
   * Handle /project plan command
   */
  async _handleProjectPlan(args) {
    const goal = args.join(' ');
    if (!goal) {
      return `❌ **Project Goal Required:** Use \`/project plan <your project goal>\`

**Example:** \`/project plan Build a user authentication system\``;
    }

    try {
      // Generate unique project ID
      const projectId = `project-${Date.now()}`;
      
      // Create project
      const project = await this.projectManager.initializeProject({
        id: projectId,
        name: goal,
        description: `Project created from goal: ${goal}`
      });

      // Create standard deliverables for requirements phase
      const deliverables = this.deliverableManager 
        ? await this.deliverableManager.createStandardDeliverables(projectId, 'requirements')
        : [];

      // Start monitoring
      if (this.coordinationMonitor) {
        await this.coordinationMonitor.startMonitoring(projectId);
      }

      // Broadcast project creation
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

  /**
   * Handle /project deliverables command
   */
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

  /**
   * Handle /project phase command
   */
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

  /**
   * Handle /project list command
   */
  async _handleProjectList() {
    try {
      const projects = await this.projectManager.getProjectList();
      
      if (projects.length === 0) {
        return `**📁 No Projects Found**

Use \`/project plan <goal>\` to create your first project!

**Example:** \`/project plan Build a user authentication system\``;
      }

      let response = `**📁 All Projects (${projects.length})**\n\n`;
      
      projects.forEach(project => {
        const current = project.id === this.projectManager.currentProject ? '👉 ' : '   ';
        const progress = project.getProgressSummary();
        response += `${current}**${project.name}** (${project.id})\n`;
        response += `   🔄 Phase: ${project.phase}\n`;
        response += `   📊 Progress: ${progress.progressPercentage}%\n`;
        response += `   📈 Status: ${project.status}\n\n`;
      });

      return response;

    } catch (error) {
      return `❌ **Error:** ${error.message}`;
    }
  }

  /**
   * Handle /project switch command
   */
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

  /**
   * Render phase indicator
   */
  _renderPhaseIndicator(currentPhase) {
    const phases = ['requirements', 'domain', 'architecture', 'implementation', 'testing'];
    const currentIndex = phases.indexOf(currentPhase);
    
    return phases.map((phase, index) => {
      if (index < currentIndex) return `✅ ${phase}`;
      if (index === currentIndex) return `🔄 ${phase} (current)`;
      return `⏳ ${phase}`;
    }).join(' → ');
  }

  /**
   * Get project context for LLM enhancement
   */
  async _getProjectContext() {
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
   * Get actor status
   * @returns {Object} Actor status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      conversationManagerReady: !!this.conversationManager,
      toolsAvailable: this.conversationManager?.toolsModule?.getStatistics()?.toolCount || 0,
      observabilityActive: !!this.conversationManager?.observabilityService,
      sdMethodologyReady: !!this.conversationManager?.sdMethodologyService
    };
  }
}