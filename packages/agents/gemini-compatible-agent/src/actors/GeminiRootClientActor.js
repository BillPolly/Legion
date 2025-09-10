/**
 * GeminiRootClientActor - EXACT copy of server framework pattern
 * Following the exact HTML template and actor initialization from Legion server framework
 */

import { ProtocolActor } from '/legion/decent-planner-ui/src/shared/ProtocolActor.js';

export default class GeminiRootClientActor extends ProtocolActor {
  constructor() {
    super();
    this.remoteActor = null;
    
    // Merge state with ProtocolActor
    Object.assign(this.state, {
      connected: false,
      tools: 0
    });
    
    // Project dashboard state
    this.dashboardInstance = null;
    this.currentProjectId = null;
    
    console.log('🎭 GeminiRootClientActor created (server framework pattern)');
    
    // Initialize interface immediately like server framework
    this.initializeInterface();
  }

  getProtocol() {
    return {
      name: "GeminiRootClientActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          tools: { type: 'number', required: true }
        },
        initial: {
          connected: false,
          tools: 0
        }
      },
      
      messages: {
        receives: {
          'ready': {
            schema: {
              timestamp: { type: 'string' },
              tools: { type: 'number' }
            },
            postconditions: ['connected is true']
          },
          'chat_response': {
            schema: {
              content: { type: 'string' }
            }
          }
        },
        sends: {
          'chat_message': {
            schema: {
              content: { type: 'string' }
            }
          }
        }
      }
    };
  }

  /**
   * Set remote actor reference (called by server framework)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 [CLIENT] Remote server actor set - ready to communicate');
    
    // Now that we have the server reference, we can communicate
    // The server should send us a ready message
  }

  /**
   * Set channel reference (needed for Legion actor framework)
   */
  setChannel(channel) {
    this.channel = channel;
    console.log('🔗 [CLIENT] Channel set for communication');
  }

  /**
   * Initialize interface (following server framework pattern)
   */
  initializeInterface() {
    console.log('🎨 [CLIENT] Creating interface...');
    
    // Create app container like server framework
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h1>🎭 Gemini Agent - Legion Actor Framework</h1>
          <div id="status" style="padding: 10px; background: #f0f0f0; margin: 10px 0; border-radius: 5px;">
            🔄 Waiting for server ready signal...
          </div>
          <div id="messages" style="height: 400px; border: 1px solid #ddd; padding: 15px; overflow-y: auto; margin: 10px 0; background: white; border-radius: 5px;">
            <div style="color: #666; font-style: italic;">🎭 Actor interface initialized. Waiting for server connection...</div>
          </div>
          <div style="display: flex; gap: 10px; margin: 10px 0;">
            <input type="text" id="messageInput" placeholder="Waiting for server ready..." disabled style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px;">
            <button id="sendButton" disabled style="padding: 12px 24px; background: #ccc; color: white; border: none; border-radius: 5px; cursor: pointer;">Send</button>
          </div>
        </div>
      `;
      
      // Get element references
      this.statusElement = document.getElementById('status');
      this.messagesElement = document.getElementById('messages');
      this.inputElement = document.getElementById('messageInput');
      this.sendButton = document.getElementById('sendButton');
      
      console.log('✅ [CLIENT] Interface elements created and ready');
    } else {
      console.error('❌ [CLIENT] No #app container found - interface cannot be created');
    }
  }

  /**
   * Receive messages from server actor (Legion actor framework)
   */
  receive(messageType, data) {
    console.log('📨 [CLIENT] GeminiRootClient received:', messageType);
    console.log('📋 [CLIENT] Message data:', typeof data, data);
    
    switch (messageType) {
      case 'ready':
        console.log('🎉 [CLIENT] READY MESSAGE RECEIVED - ACTIVATING INTERFACE!');
        this._handleReady(data);
        break;
        
      case 'chat_response':
        console.log('💬 [CLIENT] Chat response received');
        this._handleChatResponse(data);
        break;
        
      case 'slash_response':
        console.log('⚡ [CLIENT] Slash response received');
        this._handleSlashResponse(data);
        break;

      case 'project_response':
        console.log('🎯 [CLIENT] Project response received');
        this._handleProjectResponse(data);
        break;

      case 'project_update':
        console.log('📡 [CLIENT] Project update received');
        this._handleProjectUpdate(data);
        break;

      case 'project_data_response':
        console.log('📊 [CLIENT] Project data response received');
        this._handleProjectDataResponse(data);
        break;

      case 'project_data_error':
        console.log('❌ [CLIENT] Project data error received');
        this._handleProjectDataError(data);
        break;

      case 'deliverable_completed':
        console.log('✅ [CLIENT] Deliverable completed received');
        this._handleDeliverableCompleted(data);
        break;

      case 'deliverable_progress':
        console.log('📊 [CLIENT] Deliverable progress received');
        this._handleDeliverableProgress(data);
        break;

      case 'deliverable_failed':
        console.log('❌ [CLIENT] Deliverable failed received');
        this._handleDeliverableFailed(data);
        break;

      case 'project_work_started':
        console.log('🚀 [CLIENT] Project work started received');
        this._handleProjectWorkStarted(data);
        break;

      case 'deliverable_details_response':
        console.log('🔍 [CLIENT] Deliverable details received');
        this._handleDeliverableDetailsResponse(data);
        break;
        
      default:
        console.log('⚠️ [CLIENT] Unknown message type:', messageType);
    }
  }

  /**
   * Handle ready signal from server
   */
  _handleReady(data) {
    console.log('🔧 [CLIENT] Processing ready signal and activating interface');
    
    this.state.connected = true;
    this.state.tools = data.tools || 0;
    
    // Activate interface elements
    if (this.statusElement) {
      this.statusElement.textContent = `✅ Connected! ${this.state.tools} tools available`;
      this.statusElement.style.background = '#d4edda';
    }
    
    if (this.inputElement) {
      this.inputElement.disabled = false;
      this.inputElement.placeholder = 'Ask me anything about your project...';
    }
    
    if (this.sendButton) {
      this.sendButton.disabled = false;
      this.sendButton.style.background = '#007bff';
      this.sendButton.style.cursor = 'pointer';
    }
    
    // Add welcome message
    if (this.messagesElement) {
      this.messagesElement.innerHTML += `
        <div style="background: #e7f3ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
          <strong>🎉 Actor Framework Connected!</strong><br>
          🔧 Tools: ${this.state.tools} available<br>
          🔍 Observability: Active<br>
          🏗️ SD Methodology: Ready<br><br>
          Try: "Create a test file" or "Build a simple app" or "/help"
        </div>
      `;
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
    
    // Bind events
    this._bindEvents();
    
    console.log('🎯 [CLIENT] INTERFACE FULLY ACTIVATED!');
  }

  /**
   * Bind event listeners
   */
  _bindEvents() {
    if (this.sendButton) {
      this.sendButton.onclick = () => this.sendMessage();
    }
    
    if (this.inputElement) {
      this.inputElement.onkeypress = (e) => {
        if (e.key === 'Enter') this.sendMessage();
      };
    }
  }

  /**
   * Send message to server through actor framework
   */
  sendMessage() {
    const message = this.inputElement.value.trim();
    if (!message || !this.remoteActor || !this.state.connected) return;
    
    console.log('📤 [CLIENT] Sending message through actor framework:', message);
    
    // Add to interface
    this.messagesElement.innerHTML += `<div style="margin: 10px 0; text-align: right;"><strong>👤 You:</strong> ${message}</div>`;
    this.inputElement.value = '';
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    
    // Send through actor framework using remoteActor.receive() pattern
    this.remoteActor.receive('chat_message', { content: message });
  }

  /**
   * Handle chat response from server
   */
  _handleChatResponse(data) {
    console.log('💬 [CLIENT] Displaying chat response');
    this.messagesElement.innerHTML += `<div style="margin: 10px 0;"><strong>🤖 Agent:</strong> ${data.content}</div>`;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle slash response from server
   */
  _handleSlashResponse(data) {
    console.log('⚡ [CLIENT] Displaying slash response');
    this.messagesElement.innerHTML += `<div style="margin: 10px 0; background: #f8f9fa; padding: 10px; border-radius: 5px;"><strong>⚡ Command:</strong><br>${data.content}</div>`;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle project response from server
   */
  _handleProjectResponse(data) {
    console.log('🎯 [CLIENT] Displaying project response');
    this.messagesElement.innerHTML += `<div style="margin: 10px 0; background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;"><strong>🎯 Project:</strong><br>${data.content}</div>`;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle project update from server
   */
  _handleProjectUpdate(data) {
    console.log('📡 [CLIENT] Displaying project update');
    const updateType = data.type || 'update';
    const updateIcon = this._getUpdateIcon(updateType);
    this.messagesElement.innerHTML += `<div style="margin: 10px 0; background: #f3e5f5; padding: 10px; border-radius: 5px; border-left: 3px solid #9c27b0;"><strong>${updateIcon} Project Update:</strong> ${updateType}<br>Project: ${data.projectId || 'Unknown'}</div>`;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;

    // Show dashboard window if project created
    if (updateType === 'project_created' && data.projectId) {
      this._showProjectDashboard(data.projectId);
    }

    // Update dashboard if it exists
    if (this.dashboardInstance && data.projectId) {
      this._updateDashboard(data);
    }
  }

  /**
   * Get icon for update type
   */
  _getUpdateIcon(updateType) {
    switch (updateType) {
      case 'project_created': return '🎯';
      case 'phase_transition': return '🔄';
      case 'deliverable_completed': return '✅';
      case 'deliverable_progress': return '📊';
      case 'agent_activity': return '🤖';
      default: return '📡';
    }
  }

  /**
   * Show project dashboard window
   * @param {string} projectId - Project ID to display
   */
  async _showProjectDashboard(projectId) {
    try {
      console.log('🎯 [CLIENT] Creating project dashboard window for:', projectId);
      
      // Import ProjectDashboard component
      const { ProjectDashboard } = await import('/src/project-management/components/ProjectDashboard.js');
      
      // Create mock project manager for client side (gets data from server via actor messages)
      const clientProjectManager = this._createClientProjectManager(projectId);
      
      // Create dashboard window
      this.dashboardInstance = ProjectDashboard.create({
        dom: document.body,
        projectManager: clientProjectManager,
        projectId: projectId,
        theme: 'light',
        position: { x: 100, y: 100 },
        size: { width: 600, height: 500 },
        onProjectChange: (changeData) => {
          console.log('🎯 [CLIENT] Dashboard project change:', changeData.type);
        },
        onDeliverableClick: (deliverable) => {
          console.log('🎯 [CLIENT] Deliverable clicked:', deliverable.id);
          self._inspectDeliverable(deliverable);
        },
        onPhaseClick: (phase) => {
          console.log('🎯 [CLIENT] Phase clicked:', phase);
        },
        onClose: () => {
          this.dashboardInstance = null;
          this.currentProjectId = null;
        }
      });

      this.currentProjectId = projectId;
      console.log('✅ [CLIENT] Project dashboard window created and shown');

    } catch (error) {
      console.error('❌ [CLIENT] Failed to create dashboard:', error.message);
      
      // Fallback: show simple project info in chat
      this.messagesElement.innerHTML += `
        <div style="margin: 10px 0; background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 3px solid #ffc107;">
          <strong>🎯 Project Dashboard:</strong> Unable to load visual dashboard<br>
          Project ID: ${projectId}<br>
          Use <code>/project status</code> for project information.
        </div>
      `;
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
  }

  /**
   * Update dashboard with new data
   * @param {Object} updateData - Update data from server
   */
  _updateDashboard(updateData) {
    if (!this.dashboardInstance) return;

    try {
      // Update dashboard model based on update type
      switch (updateData.type) {
        case 'deliverable_completed':
        case 'deliverable_progress':
          this.dashboardInstance.model.updateDeliverable(updateData.deliverableId, {
            completion: updateData.completion,
            status: updateData.status
          });
          break;

        case 'phase_transition':
          this.dashboardInstance.model.updateProjectData({
            phase: updateData.toPhase
          });
          break;

        case 'agent_activity':
          // Could update agent status in dashboard if implemented
          console.log('🤖 [CLIENT] Agent activity update:', updateData.agentId);
          break;
      }

      console.log('🎯 [CLIENT] Dashboard updated with:', updateData.type);

    } catch (error) {
      console.error('❌ [CLIENT] Dashboard update failed:', error.message);
    }
  }

  /**
   * Create client-side project manager for dashboard
   * @param {string} projectId - Project ID
   * @returns {Object} Project manager that requests data from server via actor framework
   */
  _createClientProjectManager(projectId) {
    const self = this; // Capture 'this' reference
    
    return {
      currentProject: projectId,
      
      // Request real data from server via actor framework
      async generateProjectSummary(id) {
        // Send request to server for project data
        if (self.remoteActor) {
          self.remoteActor.receive('get_project_data', { projectId: id });
        }

        // For now, return basic data that will be updated by real-time updates
        return {
          projectId: id,
          projectName: 'Project Loading...', // Will be updated by server response
          projectDescription: 'Fetching project data...',
          currentPhase: 'requirements',
          currentStatus: 'planning',
          progressPercentage: 0,
          totalDeliverables: 0,
          completedDeliverables: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      },

      async getDeliverables(id) {
        return []; // Will be populated by real-time updates from server
      }
    };
  }

  /**
   * Handle project data response from server
   */
  _handleProjectDataResponse(data) {
    console.log('📊 [CLIENT] Updating dashboard with real project data');
    
    if (this.dashboardInstance && data.projectId === this.currentProjectId) {
      // Update dashboard with real project data
      this.dashboardInstance.model.updateProjectData({
        id: data.projectId,
        name: data.summary.projectName,
        description: data.summary.projectDescription,
        phase: data.summary.currentPhase,
        status: data.summary.currentStatus,
        progress: data.summary.progressPercentage,
        totalDeliverables: data.summary.totalDeliverables,
        completedDeliverables: data.summary.completedDeliverables
      });

      // Clear existing deliverables and add real ones
      this.dashboardInstance.model.deliverables = [];
      data.deliverables.forEach(deliverable => {
        this.dashboardInstance.model.deliverables.push({
          id: deliverable.id,
          name: deliverable.name,
          phase: deliverable.phase,
          status: deliverable.status,
          completion: deliverable.completion,
          assignedAgent: deliverable.assignedAgent
        });
      });

      // Update window title and trigger re-render
      this.dashboardInstance.windowInstance.setTitle(`🎯 Project: ${data.summary.projectName}`);
      
      // Force model to notify listeners to trigger view update
      this.dashboardInstance.model.notifyListeners({
        type: 'project_data_loaded',
        projectData: this.dashboardInstance.model.projectData,
        deliverables: this.dashboardInstance.model.deliverables
      });

      console.log(`📊 [CLIENT] Dashboard updated: ${data.deliverables.length} deliverables loaded`);
    }
  }

  /**
   * Handle project data error from server
   */
  _handleProjectDataError(data) {
    console.error('❌ [CLIENT] Project data error:', data.error);
    
    if (this.dashboardInstance) {
      // Show error in dashboard
      this.messagesElement.innerHTML += `
        <div style="margin: 10px 0; background: #ffebee; padding: 10px; border-radius: 5px; color: #c62828;">
          <strong>❌ Dashboard Error:</strong> ${data.error}
        </div>
      `;
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
  }

  /**
   * Handle deliverable completed update
   */
  _handleDeliverableCompleted(data) {
    console.log('✅ [CLIENT] Deliverable completed - updating dashboard');
    
    // Update dashboard
    if (this.dashboardInstance) {
      this.dashboardInstance.updateDeliverable(data.deliverableId, {
        completion: 100,
        status: 'completed'
      });
    }

    // Show completion in chat
    this.messagesElement.innerHTML += `
      <div style="margin: 10px 0; background: #e8f5e8; padding: 10px; border-radius: 5px; border-left: 3px solid #4caf50;">
        <strong>✅ Deliverable Completed:</strong> ${data.deliverableName}<br>
        <small>Project: ${data.projectId}</small>
      </div>
    `;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle deliverable progress update
   */
  _handleDeliverableProgress(data) {
    console.log('📊 [CLIENT] Deliverable progress - updating dashboard');
    
    // Update dashboard
    if (this.dashboardInstance) {
      this.dashboardInstance.updateDeliverable(data.deliverableId, {
        completion: data.completion,
        status: data.status
      });
    }

    // Show progress in chat
    this.messagesElement.innerHTML += `
      <div style="margin: 10px 0; background: #fff3cd; padding: 8px; border-radius: 5px; border-left: 3px solid #ffc107;">
        <strong>📊 Progress:</strong> ${data.deliverableName} - ${data.completion}%
      </div>
    `;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle deliverable failed update
   */
  _handleDeliverableFailed(data) {
    console.log('❌ [CLIENT] Deliverable failed - updating dashboard');
    
    // Update dashboard
    if (this.dashboardInstance) {
      this.dashboardInstance.updateDeliverable(data.deliverableId, {
        status: 'blocked'
      });
    }

    // Show failure in chat
    this.messagesElement.innerHTML += `
      <div style="margin: 10px 0; background: #ffebee; padding: 10px; border-radius: 5px; border-left: 3px solid #f44336;">
        <strong>❌ Deliverable Failed:</strong> ${data.deliverableId}<br>
        <small>Error: ${data.error}</small>
      </div>
    `;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle project work started update
   */
  _handleProjectWorkStarted(data) {
    console.log('🚀 [CLIENT] Project work started');
    
    this.messagesElement.innerHTML += `
      <div style="margin: 10px 0; background: #e3f2fd; padding: 10px; border-radius: 5px; border-left: 3px solid #2196f3;">
        <strong>🚀 Work Started:</strong> ${data.projectName}<br>
        <small>ProjectManager agent is actively working on this project</small>
      </div>
    `;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Inspect deliverable details when clicked
   */
  _inspectDeliverable(deliverable) {
    console.log('🔍 [CLIENT] Inspecting deliverable:', deliverable.id);
    
    // Request deliverable details from server
    if (this.remoteActor) {
      this.remoteActor.receive('get_deliverable_details', {
        projectId: this.currentProjectId,
        deliverableId: deliverable.id
      });
    }

    // Show inspection request in chat
    this.messagesElement.innerHTML += `
      <div style="margin: 10px 0; background: #f3e5f5; padding: 10px; border-radius: 5px; border-left: 3px solid #9c27b0;">
        <strong>🔍 Inspecting Deliverable:</strong> ${deliverable.name || deliverable.id}<br>
        <small>Requesting details from server...</small>
      </div>
    `;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  /**
   * Handle deliverable details response
   */
  _handleDeliverableDetailsResponse(data) {
    if (!data.found) {
      this.messagesElement.innerHTML += `
        <div style="margin: 10px 0; background: #ffebee; padding: 10px; border-radius: 5px; color: #c62828;">
          <strong>❌ Deliverable Not Found:</strong> ${data.deliverableId}<br>
          <small>Error: ${data.error}</small>
        </div>
      `;
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
      return;
    }

    // Show detailed deliverable information
    const resultSummary = data.result && typeof data.result === 'object' 
      ? `${Object.keys(data.result).length} result fields`
      : 'No detailed results';

    this.messagesElement.innerHTML += `
      <div style="margin: 10px 0; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
        <h4 style="margin: 0 0 10px 0; color: #495057;">🔍 Deliverable Details</h4>
        
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 14px;">
          <strong>Name:</strong> <span>${data.deliverableName}</span>
          <strong>Status:</strong> <span style="color: ${data.status === 'completed' ? '#4caf50' : '#666'}">${data.status}</span>
          <strong>Completion:</strong> <span>${data.completion}%</span>
          <strong>Agent:</strong> <span>${data.agent}</span>
          <strong>Phase:</strong> <span>${data.phase}</span>
          <strong>Completed:</strong> <span>${new Date(data.completedAt).toLocaleString()}</span>
          <strong>Results:</strong> <span>${resultSummary}</span>
          <strong>Artifacts:</strong> <span>${data.artifacts?.join(', ') || 'None'}</span>
        </div>

        ${data.result && data.result.parsedRequirements ? `
          <details style="margin-top: 10px;">
            <summary style="cursor: pointer; font-weight: bold;">📋 View Requirements Analysis Results</summary>
            <div style="margin-top: 8px; padding: 10px; background: #f1f3f4; border-radius: 4px; font-size: 13px;">
              <strong>Functional Requirements:</strong> ${data.result.parsedRequirements.functional?.length || 0}<br>
              <strong>Non-Functional:</strong> ${data.result.parsedRequirements.nonFunctional?.length || 0}<br>
              <strong>Domain Rules:</strong> ${data.result.parsedRequirements.domainRules?.length || 0}<br>
              <strong>Quality Score:</strong> ${data.result.qualityGates?.methodologyScore || 'N/A'}%
            </div>
          </details>
        ` : ''}
      </div>
    `;
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }
}