/**
 * SDObservabilityActor - Frontend actor for SD system observability
 * 
 * Handles communication with SDObservabilityAgent for real-time monitoring,
 * chat interactions, and visual diagram generation.
 */

import { Actor } from '/Legion/shared/actors/src/Actor.js';

export class SDObservabilityActor extends Actor {
  constructor(config = {}) {
    super();
    
    this.id = `sd-observability-actor-${Date.now()}`;
    this.remoteAgent = null;
    
    // Current state
    this.currentProject = null;
    this.artifacts = new Map();
    this.agentStatus = new Map();
    this.conversationHistory = [];
    
    // Event handlers
    this.eventHandlers = new Map();
    
    console.log(`[SDObservabilityActor] Initialized ${this.id}`);
  }

  /**
   * Set the remote agent reference
   */
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
    console.log('[SDObservabilityActor] Remote agent connected');
  }

  /**
   * Receive messages from backend or local components
   */
  async receive(payload, envelope) {
    const { type } = payload;
    
    console.log(`[SDObservabilityActor] Received ${type}`, payload);
    
    switch(type) {
      // Chat interactions
      case 'chat_message':
        return await this.sendChatMessage(payload);
      
      case 'chat_response':
        return this.handleChatResponse(payload);
      
      // Project monitoring
      case 'subscribe_project':
        return await this.subscribeToProject(payload);
      
      case 'get_project_status':
        return await this.getProjectStatus(payload);
      
      // Artifact management
      case 'get_artifacts':
        return await this.getArtifacts(payload);
      
      case 'artifact_created':
        return this.handleArtifactCreated(payload);
      
      // Agent monitoring
      case 'get_agent_status':
        return await this.getAgentStatus(payload);
      
      case 'agent_activity':
        return this.handleAgentActivity(payload);
      
      // Diagram generation
      case 'get_diagram':
        return await this.getDiagram(payload);
      
      case 'diagram_data':
        return this.handleDiagramData(payload);
      
      // Validation events
      case 'validation_result':
        return this.handleValidationResult(payload);
      
      // Metrics
      case 'get_metrics':
        return await this.getMetrics(payload);
      
      case 'metric_update':
        return this.handleMetricUpdate(payload);
      
      // Timeline
      case 'get_timeline':
        return await this.getTimeline(payload);
      
      default:
        console.warn(`[SDObservabilityActor] Unknown message type: ${type}`);
        return { success: false, error: `Unknown message type: ${type}` };
    }
  }

  /**
   * Send chat message to backend
   */
  async sendChatMessage(payload) {
    const { content, sessionId } = payload;
    
    // Add to local history
    this.conversationHistory.push({
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    });
    
    // Send to backend agent
    if (this.remoteAgent) {
      await this.remoteAgent.receive({
        type: 'chat_message',
        payload: {
          content,
          projectId: this.currentProject,
          sessionId
        }
      });
    }
    
    // Emit event for UI update
    this.emit('chat_message_sent', { content });
    
    return { success: true };
  }

  /**
   * Handle chat response from backend
   */
  handleChatResponse(payload) {
    const { data } = payload;
    
    // Add to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: data.content,
      artifacts: data.artifacts,
      commands: data.commands,
      timestamp: data.metadata?.timestamp || new Date().toISOString()
    });
    
    // Emit event for UI components
    this.emit('chat_response_received', data);
    
    // Handle any artifacts mentioned
    if (data.artifacts && data.artifacts.length > 0) {
      this.emit('artifacts_mentioned', data.artifacts);
    }
    
    // Execute any commands
    if (data.commands && data.commands.length > 0) {
      this.executeCommands(data.commands);
    }
    
    return { success: true };
  }

  /**
   * Subscribe to project updates
   */
  async subscribeToProject(payload) {
    const { projectId } = payload;
    
    this.currentProject = projectId;
    
    if (this.remoteAgent) {
      await this.remoteAgent.receive({
        type: 'subscribe_project',
        payload: {
          projectId,
          clientId: this.id
        }
      });
    }
    
    this.emit('project_subscribed', { projectId });
    
    return { success: true, projectId };
  }

  /**
   * Get project status
   */
  async getProjectStatus(payload) {
    if (this.remoteAgent) {
      const response = await this.remoteAgent.receive({
        type: 'get_project_status',
        payload
      });
      
      if (response.success) {
        this.emit('project_status_updated', response.data);
      }
      
      return response;
    }
    
    return { success: false, error: 'No remote agent connected' };
  }

  /**
   * Get artifacts
   */
  async getArtifacts(payload) {
    if (this.remoteAgent) {
      const response = await this.remoteAgent.receive({
        type: 'get_artifacts',
        payload
      });
      
      if (response.success) {
        // Cache artifacts locally
        for (const artifact of response.data.artifacts) {
          this.artifacts.set(artifact.id, artifact);
        }
        
        this.emit('artifacts_loaded', response.data);
      }
      
      return response;
    }
    
    return { success: false, error: 'No remote agent connected' };
  }

  /**
   * Handle artifact created event
   */
  handleArtifactCreated(payload) {
    const { artifact } = payload;
    
    // Add to cache
    this.artifacts.set(artifact.id, artifact);
    
    // Emit event for UI components
    this.emit('artifact_created', artifact);
    
    // Show notification
    this.emit('notification', {
      type: 'info',
      message: `New artifact created: ${artifact.name || artifact.type}`,
      artifact
    });
    
    return { success: true };
  }

  /**
   * Get agent status
   */
  async getAgentStatus(payload) {
    if (this.remoteAgent) {
      const response = await this.remoteAgent.receive({
        type: 'get_agent_status',
        payload
      });
      
      if (response.success) {
        // Update local cache
        for (const agent of response.data.agents) {
          this.agentStatus.set(agent.name, agent);
        }
        
        this.emit('agent_status_updated', response.data);
      }
      
      return response;
    }
    
    return { success: false, error: 'No remote agent connected' };
  }

  /**
   * Handle agent activity update
   */
  handleAgentActivity(payload) {
    const { agent, status, task } = payload;
    
    // Update local cache
    if (this.agentStatus.has(agent)) {
      const agentInfo = this.agentStatus.get(agent);
      agentInfo.status = status;
      agentInfo.currentTask = task;
      agentInfo.lastActivity = new Date().toISOString();
    }
    
    // Emit event for UI
    this.emit('agent_activity', { agent, status, task });
    
    return { success: true };
  }

  /**
   * Get diagram data
   */
  async getDiagram(payload) {
    if (this.remoteAgent) {
      const response = await this.remoteAgent.receive({
        type: 'get_diagram',
        payload
      });
      
      if (response.success) {
        this.emit('diagram_loaded', response.data);
      }
      
      return response;
    }
    
    return { success: false, error: 'No remote agent connected' };
  }

  /**
   * Handle diagram data from backend
   */
  handleDiagramData(payload) {
    const { diagram } = payload;
    
    // Emit event for diagram viewer
    this.emit('diagram_update', diagram);
    
    return { success: true };
  }

  /**
   * Handle validation result
   */
  handleValidationResult(payload) {
    const { result } = payload;
    
    // Emit event for validation view
    this.emit('validation_result', result);
    
    // Show notification for failures
    if (!result.valid) {
      this.emit('notification', {
        type: 'error',
        message: `Validation failed: ${result.error || 'Unknown error'}`,
        result
      });
    }
    
    return { success: true };
  }

  /**
   * Get project metrics
   */
  async getMetrics(payload) {
    if (this.remoteAgent) {
      const response = await this.remoteAgent.receive({
        type: 'get_metrics',
        payload
      });
      
      if (response.success) {
        this.emit('metrics_updated', response.data);
      }
      
      return response;
    }
    
    return { success: false, error: 'No remote agent connected' };
  }

  /**
   * Handle metric update
   */
  handleMetricUpdate(payload) {
    const { metrics } = payload;
    
    // Emit event for dashboard
    this.emit('metric_update', metrics);
    
    return { success: true };
  }

  /**
   * Get project timeline
   */
  async getTimeline(payload) {
    if (this.remoteAgent) {
      const response = await this.remoteAgent.receive({
        type: 'get_timeline',
        payload
      });
      
      if (response.success) {
        this.emit('timeline_loaded', response.data);
      }
      
      return response;
    }
    
    return { success: false, error: 'No remote agent connected' };
  }

  /**
   * Execute commands from chat response
   */
  executeCommands(commands) {
    for (const command of commands) {
      switch(command.type) {
        case 'show_diagram':
          this.emit('show_diagram', command);
          break;
        
        case 'show_timeline':
          this.emit('show_timeline', command);
          break;
        
        case 'show_validation':
          this.emit('show_validation', command);
          break;
        
        default:
          console.warn(`[SDObservabilityActor] Unknown command: ${command.type}`);
      }
    }
  }

  /**
   * Event emitter functionality
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      for (const handler of this.eventHandlers.get(event)) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[SDObservabilityActor] Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Get metadata
   */
  getMetadata() {
    return {
      type: 'sd-observability',
      id: this.id,
      currentProject: this.currentProject,
      artifactCount: this.artifacts.size,
      agentCount: this.agentStatus.size,
      conversationLength: this.conversationHistory.length
    };
  }

  /**
   * Quick actions for chat
   */
  getQuickActions() {
    return [
      { 
        label: "What's happening?", 
        message: "What agents are currently working and what are they doing?"
      },
      { 
        label: "Show deliverables", 
        message: "Where are all the generated deliverables located?"
      },
      { 
        label: "Explain current phase", 
        message: "What phase is the project in and what happens in this phase?"
      },
      { 
        label: "Show errors", 
        message: "Are there any errors or validation failures?"
      },
      { 
        label: "How does DDD work?", 
        message: "Explain how Domain-Driven Design works in the SD system"
      },
      { 
        label: "Show class diagram", 
        message: "Can you show me the class diagram for the domain model?"
      },
      { 
        label: "Project metrics", 
        message: "What are the current project metrics and quality scores?"
      },
      { 
        label: "Timeline status", 
        message: "Show me the development timeline and progress"
      }
    ];
  }
}