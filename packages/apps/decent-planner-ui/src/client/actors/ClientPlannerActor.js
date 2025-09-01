/**
 * Client Planner Actor - MVVM-based UI with proper components
 * Components are properly imported from separate files
 */

import { ProtocolActor } from '/src/shared/ProtocolActor.js';
import { SearchComponent } from '/src/client/components/SearchComponent.js';
import { TabsComponent } from '/src/client/components/TabsComponent.js';
import { ToolDiscoveryComponent } from '/src/client/components/ToolDiscoveryComponent.js';
import { FormalPlanningComponent } from '/src/client/components/FormalPlanningComponent.js';
import { TreeExecutionComponent } from '/src/client/components/TreeExecutionComponent.js';
// PlanningTabComponent removed - handling inline for now

// All components are now properly imported from separate files


export default class ClientPlannerActor extends ProtocolActor {
  constructor() {
    super(); // This initializes state from protocol.state.initial
    this.remoteActor = null;
    this.plannerComponent = null;
    
    // Component instances
    this.tabsComponent = null;
    this.toolDiscoveryComponent = null;
    this.formalPlanningComponent = null;
    this.searchComponent = null;
    this.executionComponent = null;
    
    // Merge additional state properties with the protocol-initialized state
    // Don't override the entire state object - just add additional properties
    Object.assign(this.state, {
      expandedToolsMetadata: new Set(), // For tracking expanded tool metadata in discovery panel
      llmInteractions: [], // Store prompt/response pairs
      goal: '',
      result: null,
      informalResult: null,
      formalResult: null,
      error: null,
      mode: 'manual', // 'full' or 'manual'
      progressMessage: null,
      progressMessages: [], // Array of all progress messages
      progressCollapsed: false, // Whether progress section is collapsed
      maxVisibleMessages: 8, // Number of messages to show when collapsed
      
      // Tool discovery state
      toolsDiscovering: false,
      toolsResult: null,
      
      // Formal planning state
      formalPlanning: false,
      formalResult: null,
      
      // UI state
      activeTab: 'planning', // 'planning', 'tools', 'formal', 'execution', or 'search'
      
      // Execution state
      executionTree: null,
      executionState: null,
      executionMode: 'step'
    });
  }

  getProtocol() {
    return {
      name: "ClientPlannerActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          planning: { type: 'boolean', required: true },
          informalPlanning: { type: 'boolean', required: true },
          formalPlanning: { type: 'boolean', required: true },
          toolsDiscovering: { type: 'boolean', required: true },
          cancelling: { type: 'boolean', required: true },
          goal: { type: 'string', required: true },
          result: { type: 'object', properties: {}, additionalProperties: true },
          informalResult: { type: 'object', properties: {}, additionalProperties: true },
          formalResult: { type: 'object', properties: {}, additionalProperties: true },
          toolsResult: { type: 'object', properties: {}, additionalProperties: true },
          error: { type: 'string' },
          mode: { type: 'string', required: true },
          progressMessage: { type: 'string' },
          activeTab: { type: 'string', required: true },
          executionTree: { type: 'object' },
          executionState: { type: 'object' },
          executionMode: { type: 'string', required: true }
        },
        initial: {
          connected: false,
          planning: false,
          informalPlanning: false,
          formalPlanning: false,
          toolsDiscovering: false,
          cancelling: false,
          goal: '',
          result: null,
          informalResult: null,
          formalResult: null,
          toolsResult: null,
          error: null,
          mode: 'manual',
          progressMessage: null,
          activeTab: 'planning',
          executionTree: null,
          executionState: null,
          executionMode: 'step'
        }
      },
      
      messages: {
        receives: {
          "ready": {
            schema: {
              timestamp: { type: 'string' }
            },
            preconditions: ["state.connected === false"],
            postconditions: ["state.connected === true"]
          },
          
          "informalPlanStarted": {
            schema: {
              goal: { type: 'string', required: true }
            },
            preconditions: ["state.informalPlanning === false"],
            postconditions: ["state.informalPlanning === true"]
          },
          
          "informalPlanProgress": {
            schema: {
              message: { type: 'string', required: true },
              percentage: { type: 'number', minimum: 0, maximum: 100 }
            },
            preconditions: ["state.informalPlanning === true"]
          },
          
          "informalPlanComplete": {
            schema: {
              result: { type: 'object', properties: {}, additionalProperties: true, required: true },
              goal: { type: 'string', required: true }
            },
            preconditions: ["state.informalPlanning === true"],
            postconditions: [
              "state.informalPlanning === false",
              "state.informalResult !== null"
            ]
          },
          
          "informalPlanError": {
            schema: {
              error: { type: 'string', required: true }
            },
            preconditions: ["state.informalPlanning === true"],
            postconditions: [
              "state.informalPlanning === false",
              "state.error !== null"
            ]
          },
          
          "toolsDiscoveryStarted": {
            schema: {},
            preconditions: ["state.connected === true"],
            postconditions: ["state.toolsDiscovering === true"]
          },
          
          "toolsDiscoveryProgress": {
            schema: {
              message: { type: 'string', required: true }
            },
            preconditions: ["state.toolsDiscovering === true"]
          },
          
          "toolsDiscoveryComplete": {
            schema: {
              tools: { type: 'array', items: { type: 'object', properties: {}, additionalProperties: true }, required: true }
            },
            preconditions: ["state.toolsDiscovering === true"],
            postconditions: [
              "state.toolsDiscovering === false",
              "state.toolsResult !== null"
            ]
          },
          
          "toolsDiscoveryError": {
            schema: {
              error: { type: 'string', required: true }
            },
            preconditions: ["state.toolsDiscovering === true"],
            postconditions: [
              "state.toolsDiscovering === false",
              "state.error !== null"
            ]
          },
          
          "formalPlanStarted": {
            schema: {},
            preconditions: ["state.formalPlanning === false"],
            postconditions: ["state.formalPlanning === true"]
          },
          
          "formalPlanProgress": {
            schema: {
              message: { type: 'string', required: true }
            },
            preconditions: ["state.formalPlanning === true"]
          },
          
          "formalPlanComplete": {
            schema: {
              result: { type: 'object', properties: {}, additionalProperties: true, required: true }
            },
            preconditions: ["state.formalPlanning === true"],
            postconditions: [
              "state.formalPlanning === false",
              "state.formalResult !== null"
            ]
          },
          
          "formalPlanError": {
            schema: {
              error: { type: 'string', required: true }
            },
            preconditions: ["state.formalPlanning === true"],
            postconditions: [
              "state.formalPlanning === false",
              "state.error !== null"
            ]
          },
          
          "llm-interaction": {
            schema: {
              type: { type: 'string', required: true },
              data: { type: 'object', properties: {}, additionalProperties: true, required: true }
            }
          }
        },
        
        sends: {
          "plan-informal": {
            schema: {
              goal: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ["state.connected === true"],
            triggers: ["informalPlanStarted", "informalPlanProgress", "informalPlanComplete", "informalPlanError"]
          },
          
          "discover-tools": {
            schema: {},
            preconditions: ["state.connected === true", "state.informalResult !== null"],
            triggers: ["toolsDiscoveryStarted", "toolsDiscoveryProgress", "toolsDiscoveryComplete", "toolsDiscoveryError"]
          },
          
          "plan-formal": {
            schema: {},
            preconditions: ["state.connected === true", "state.toolsResult !== null"],
            triggers: ["formalPlanStarted", "formalPlanProgress", "formalPlanComplete", "formalPlanError"]
          }
        }
      }
    };
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Client actor connected to server');
    console.log('Remote actor stored:', !!this.remoteActor);
    
    // Store reference for debugging
    window.clientActor = this;
    
    // Initialize UI after connection
    this.initializeUI();
  }

  handleMessage(messageType, data) {
    console.log('📨 Client handling:', messageType);
    
    switch (messageType) {
      case 'ready':
        this.handleReady(data);
        break;
        
      case 'planStarted':
        this.handlePlanStarted(data);
        break;
        
      case 'planComplete':
        this.handlePlanComplete(data);
        break;
        
      case 'planError':
        this.handlePlanError(data);
        break;
        
      case 'planCancelled':
        this.handlePlanCancelled(data);
        break;
        
      case 'llm-interaction':
        this.handleLLMInteraction(data);
        break;
        
      case 'toolsDiscoveryStarted':
        this.handleToolsDiscoveryStarted(data);
        break;
        
      case 'toolsDiscoveryProgress':
        this.handleToolsDiscoveryProgress(data);
        break;
        
      case 'toolsDiscoveryComplete':
        this.handleToolsDiscoveryComplete(data);
        break;
        
      case 'toolsDiscoveryError':
        this.handleToolsDiscoveryError(data);
        break;
        
      case 'informalPlanStarted':
        this.handleInformalPlanStarted(data);
        break;
        
      case 'informalPlanProgress':
        this.handleInformalPlanProgress(data);
        break;
        
      case 'informalPlanComplete':
        this.handleInformalPlanComplete(data);
        break;
        
      case 'informalPlanError':
        this.handleInformalPlanError(data);
        break;
        
      case 'formalPlanStarted':
        this.handleFormalPlanStarted(data);
        break;
        
      case 'formalPlanProgress':
        this.handleFormalPlanProgress(data);
        break;
        
      case 'formalPlanComplete':
        this.handleFormalPlanComplete(data);
        break;
        
      case 'formalPlanError':
        this.handleFormalPlanError(data);
        break;
        
      case 'execution-event':
        this.handleExecutionEvent(data);
        break;
        
      case 'error':
        this.handleError(data);
        break;
        
      case 'pong':
        console.log('Pong received');
        break;
        
      case 'ready':
        this.handleReady(data);
        break;
        
      // Search-related messages
      case 'registryStatsComplete':
      case 'toolsListComplete':
      case 'toolsSearchTextComplete':
      case 'toolsSearchSemanticComplete':
      case 'toolsListError':
      case 'toolsSearchTextError':
      case 'toolsSearchSemanticError':
      case 'registryStatsError':
        if (this.searchComponent) {
          this.searchComponent.receiveMessage(messageType, data);
        }
        
        // Enable informal planning button when tools are loaded
        if (messageType === 'toolsListComplete') {
          const informalBtn = document.getElementById('informal-button');
          const statusEl = document.getElementById('connection-status');
          if (informalBtn) {
            informalBtn.disabled = false;
          }
          if (statusEl) {
            statusEl.textContent = '🟢 Connected';
          }
          // Fix state.connected for preconditions
          this.updateState({ connected: true });
        }
        break;
        
      // Plan save/load responses
      case 'planSaveComplete':
        this.handlePlanSaveComplete(data);
        break;
        
      case 'planSaveError':
        this.handlePlanSaveError(data);
        break;
        
      case 'planLoadComplete':
        this.handlePlanLoadComplete(data);
        break;
        
      case 'planLoadError':
        this.handlePlanLoadError(data);
        break;
        
      case 'planListComplete':
        this.handlePlanListComplete(data);
        break;
        
      case 'planListError':
        this.handlePlanListError(data);
        break;
        
      case 'load-tree-response':
        // Handle tree loading response from execution component
        console.log('Tree loaded successfully:', data);
        break;
        
      case 'step-response':
        // Handle step execution response
        console.log('Step completed:', data);
        if (this.executionComponent && data.data?.state) {
          this.executionComponent.updateExecutionState(data.data.state);
          this.state.executionState = data.data.state;
        }
        break;
        
      case 'registryStatsComplete':
        this.handleRegistryStats(data);
        break;
        
      case 'toolsListComplete':
        this.handleToolsList(data);
        break;
        
      case 'toolsSearchTextComplete':
      case 'toolsSearchSemanticComplete':
        this.handleSearchResults(data);
        break;
        
      case 'toolsListError':
      case 'toolsSearchTextError':
      case 'toolsSearchSemanticError':
      case 'registryStatsError':
        this.handleError(data.error);
        break;
        
      default:
        console.warn('Unknown message type:', messageType);
    }
  }

  doSend(messageType, data) {
    if (this.remoteActor) {
      return this.remoteActor.receive(messageType, data);
    }
    throw new Error('No remote actor connected');
  }

  handleReady(data) {
    this.updateState({ connected: true });
    console.log('✅ Server is ready');
    
    // Update connection status display
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = '🟢 Connected';
    }
    
    // Enable the informal button
    const informalBtn = document.getElementById('informal-button');
    if (informalBtn) {
      informalBtn.disabled = false;
    }
  }

  handlePlanStarted(data) {
    this.updateState({ 
      planning: true,
      error: null
    });
  }

  handlePlanComplete(data) {
    this.updateState({
      planning: false,
      result: data.result,
      error: null
    });
  }

  handlePlanError(data) {
    this.updateState({
      planning: false,
      error: data.error
    });
  }

  handlePlanCancelled(data) {
    console.log('📨 Plan cancelled:', data);
    
    // Add success cancellation message
    const successMessage = {
      id: Date.now(),
      message: '✅ Planning cancelled successfully',
      timestamp: new Date().toISOString(),
      type: 'complete'
    };
    
    const newMessages = [...this.state.progressMessages, successMessage];
    
    this.updateState({
      informalPlanning: false,
      formalPlanning: false,
      cancelling: false,
      error: null, // Clear any existing error
      progressMessages: newMessages
    });
  }

  handleError(data) {
    this.updateState({
      connected: false,
      error: data.message
    });
  }

  handleInformalPlanStarted(data) {
    const startMessage = {
      id: Date.now(),
      message: 'Starting informal planning...',
      timestamp: new Date().toISOString(),
      type: 'start'
    };
    
    this.updateState({ 
      informalPlanning: true,
      error: null,
      progressMessage: startMessage.message,
      progressMessages: [startMessage]
    });
    
    // Re-render planning content to show progress
    this.renderPlanningContent();
  }

  handleInformalPlanProgress(data) {
    const progressMessage = {
      id: Date.now(),
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString(),
      type: 'progress'
    };
    
    const newMessages = [...this.state.progressMessages, progressMessage];
    
    this.updateState({
      progressMessage: data.message,
      progressMessages: newMessages,
      // Auto-collapse if we have more than 20 messages and user hasn't manually set collapse state
      progressCollapsed: newMessages.length > 20 && !this.state.manuallySetCollapse ? true : this.state.progressCollapsed
    });
    
    // Re-render planning content to show new progress
    this.renderPlanningContent();
  }

  handleInformalPlanComplete(data) {
    const completeMessage = {
      id: Date.now(),
      message: 'Task decomposition completed. Validating results...',
      timestamp: new Date().toISOString(),
      type: 'complete'
    };
    
    const newMessages = [...this.state.progressMessages, completeMessage];
    
    this.updateState({
      informalPlanning: false,
      informalResult: data.result,
      error: null,
      progressMessage: null,
      progressMessages: newMessages
    });
    
    // Re-render planning content to show results
    this.renderPlanningContent();
    
    // Enable the tools tab now that informal planning is complete
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('tools', true);
    }
  }

  handleInformalPlanError(data) {
    this.updateState({
      informalPlanning: false,
      error: data.error
    });
    
    // Re-render planning content to show error
    this.renderPlanningContent();
  }

  handleFormalPlanStarted(data) {
    this.updateState({ 
      formalPlanning: true,
      error: null
    });
    
    // Update formal planning component
    if (this.formalPlanningComponent) {
      this.formalPlanningComponent.setPlanning(true);
    }
  }
  
  handleFormalPlanProgress(data) {
    // Add thinking step to formal planning component
    if (this.formalPlanningComponent) {
      this.formalPlanningComponent.addThinkingStep(data.message, 'info');
    }
  }

  handleFormalPlanComplete(data) {
    this.updateState({
      formalPlanning: false,
      formalResult: data.result,
      error: null
    });
    
    // Update formal planning component
    if (this.formalPlanningComponent) {
      this.formalPlanningComponent.setResult(data.result);
    }
    
    // Update execution component with behavior trees
    if (this.executionComponent && data.result.plan && data.result.plan.behaviorTrees && data.result.plan.behaviorTrees.length > 0) {
      const behaviorTree = data.result.plan.behaviorTrees[0];
      this.executionComponent.setTree(behaviorTree);
      
      // Also send the tree to the server for execution
      if (this.remoteActor) {
        this.remoteActor.receive('load-execution-tree', { tree: behaviorTree });
      }
    }
    
    // Enable execution tab
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('execution', true);
    }
    
    // Refresh plans tab to show current plan
    this.renderPlansContent();
    
    // Load tree into execution component whenever formal planning completes
    if (this.executionComponent && data.result?.formal?.behaviorTrees?.[0]) {
      this.loadExecutionTree(data.result.formal.behaviorTrees[0]);
    }
    
    // Enable further tabs if needed
    if (this.tabsComponent) {
      // Future: enable execution tab if we add one
    }
  }

  handleFormalPlanError(data) {
    this.updateState({
      formalPlanning: false,
      error: data.error
    });
    
    // Update formal planning component
    if (this.formalPlanningComponent) {
      this.formalPlanningComponent.setError(data.error);
    }
  }

  handleToolsDiscoveryStarted(data) {
    this.updateState({ 
      toolsDiscovering: true,
      error: null,
      activeTab: 'tools' // Switch to tools tab when discovery starts
    });
    
    // Update the tool discovery component
    if (this.toolDiscoveryComponent) {
      this.toolDiscoveryComponent.setDiscovering(true);
    }
  }

  handleToolsDiscoveryProgress(data) {
    const progressMessage = {
      id: Date.now(),
      message: data.message,
      timestamp: data.timestamp || new Date().toISOString(),
      type: 'progress'
    };
    
    const newMessages = [...this.state.progressMessages, progressMessage];
    
    // Add thinking step to tool discovery component
    if (this.toolDiscoveryComponent) {
      this.toolDiscoveryComponent.addThinkingStep(data.message, 'info');
    }
    
    this.updateState({
      progressMessage: data.message,
      progressMessages: newMessages
    });
  }

  handleToolsDiscoveryComplete(data) {
    this.updateState({
      toolsDiscovering: false,
      toolsResult: data.result,
      error: null
    });
    
    // Update the tool discovery component
    if (this.toolDiscoveryComponent) {
      this.toolDiscoveryComponent.setResult(data.result);
    }
    
    // Enable formal planning tab
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('formal', true);
    }
  }

  handleToolsDiscoveryError(data) {
    this.updateState({
      toolsDiscovering: false,
      error: data.error
    });
    
    // Update the tool discovery component
    if (this.toolDiscoveryComponent) {
      this.toolDiscoveryComponent.setError(data.error);
    }
  }

  updateState(updates) {
    // Update state
    Object.assign(this.state, updates);
    
    // Re-render planning content if on planning tab and relevant changes
    const needsRerender = updates.informalPlanning !== undefined ||
                        updates.informalResult !== undefined ||
                        updates.progressMessages !== undefined ||
                        updates.error !== undefined ||
                        updates.cancelling !== undefined;
    
    if (needsRerender && (!this.state.activeTab || this.state.activeTab === 'planning')) {
      this.renderPlanningContent();
    }
    
    // Auto-scroll to bottom if new progress messages were added
    if (updates.progressMessages) {
      setTimeout(() => {
        const progressContainer = document.querySelector('.progress-messages');
        if (progressContainer) {
          progressContainer.scrollTop = progressContainer.scrollHeight;
        }
      }, 100);
    }
  }

  // Public API for UI component
  submitPlan(goal) {
    if (!goal || goal.trim() === '') {
      this.updateState({ error: 'Goal is required' });
      return;
    }
    
    if (!this.remoteActor) {
      this.updateState({ error: 'Not connected to server' });
      return;
    }
    
    this.updateState({ goal });
    this.remoteActor.receive('plan', { goal });
  }

  submitInformalPlan(goal) {
    if (!goal || goal.trim() === '') {
      this.updateState({ error: 'Goal is required' });
      return;
    }
    
    if (!this.remoteActor) {
      this.updateState({ error: 'Not connected to server' });
      return;
    }
    
    // Reset previous results and clear progress messages
    this.updateState({ 
      goal, 
      informalResult: null,
      formalResult: null,
      error: null,
      progressMessages: [],
      progressCollapsed: false,
      manuallySetCollapse: false
    });
    this.remoteActor.receive('plan-informal', { goal });
  }

  submitFormalPlan() {
    if (!this.state.informalResult) {
      this.updateState({ error: 'Informal result is required for formal planning' });
      return;
    }
    
    if (!this.remoteActor) {
      this.updateState({ error: 'Not connected to server' });
      return;
    }
    
    this.updateState({ error: null });
    // Just send command - server has the data!
    this.remoteActor.receive('plan-formal', {});
  }

  submitToolsDiscovery() {
    if (!this.state.informalResult) {
      this.updateState({ error: 'Informal result is required for tool discovery' });
      return;
    }
    
    if (!this.remoteActor) {
      this.updateState({ error: 'Not connected to server' });
      return;
    }
    
    // Reset previous results and clear progress messages
    this.updateState({ 
      toolsResult: null,
      toolsDiscovering: true,
      error: null,
      progressMessages: [],
      progressCollapsed: false,
      activeTab: 'tools' // Switch to tools tab when starting discovery
    });
    
    // Just send command - server has the data!
    this.remoteActor.receive('discover-tools', {});
  }

  submitFormalPlanning() {
    if (!this.state.toolsResult) {
      this.updateState({ error: 'Tool discovery result is required for formal planning' });
      return;
    }
    
    if (!this.remoteActor) {
      this.updateState({ error: 'Not connected to server' });
      return;
    }
    
    // Reset previous results
    this.updateState({ 
      formalResult: null,
      formalPlanning: true,
      error: null,
      activeTab: 'formal' // Switch to formal tab when starting planning
    });
    
    // Just send command - server has the data!
    this.remoteActor.receive('plan-formal', {});
  }

  switchTab(tabName) {
    this.updateState({ 
      activeTab: tabName 
    });
    
    // Automatically start tool discovery when switching to tools tab if we have informal results but no tools yet
    if (tabName === 'tools' && this.state.informalResult && !this.state.toolsResult && !this.state.toolsDiscovering) {
      this.submitToolsDiscovery();
    }
    
    // Automatically start formal planning when switching to formal tab if we have tools but no formal result yet
    if (tabName === 'formal' && this.state.toolsResult && !this.state.formalResult && !this.state.formalPlanning) {
      this.submitFormalPlanning();
    }
  }

  toggleProgressCollapse() {
    this.updateState({
      progressCollapsed: !this.state.progressCollapsed,
      manuallySetCollapse: true // Mark that user manually toggled
    });
  }

  cancelPlanning() {
    console.log('🛑🛑🛑 CLIENT CANCEL PLANNING CALLED 🛑🛑🛑');
    
    // Change button text to show cancellation in progress
    this.updateState({
      informalPlanning: false,
      formalPlanning: false,
      cancelling: true
    });
    
    // Notify server if connected
    console.log('🔍 Checking remote actor:', this.remoteActor);
    if (this.remoteActor) {
      try {
        console.log('🛑 Sending cancel message to server...');
        this.remoteActor.receive('cancel', {});
        console.log('✅ Sent cancel message to server successfully');
      } catch (error) {
        console.error('❌ Failed to notify server of cancellation:', error);
        // If we can't contact server, cancel locally
        this.handlePlanCancelled({ message: 'Local cancellation - server unreachable' });
      }
    } else {
      console.warn('❌ No remote actor found, cancelling locally');
      // No server connection, cancel locally
      this.handlePlanCancelled({ message: 'Local cancellation - no server connection' });
    }
  }

  renderProgressTitle() {
    const messages = this.state.progressMessages;
    if (messages.length === 0) return '📝 Progress Messages (0)';
    
    if (this.state.progressCollapsed) {
      // When collapsed, show count and latest message preview in title bar
      const latestMessage = messages[messages.length - 1];
      const latestText = latestMessage.message.length > 50 
        ? latestMessage.message.substring(0, 50) + '...'
        : latestMessage.message;
      const icon = latestMessage.type === 'complete' ? '✅' : 
                   latestMessage.type === 'start' ? '🚀' : '🔄';
      return `📝 Progress (${messages.length}) ${icon} ${latestText}`;
    } else {
      // When expanded, show simple count
      return `📝 Progress Messages (${messages.length})`;
    }
  }

  renderToolsTab() {
    if (!this.state.informalResult) {
      return `
        <div class="tools-placeholder">
          <h2>🔧 Tool Discovery</h2>
          <p>Complete informal planning first to discover tools for SIMPLE tasks.</p>
        </div>
      `;
    }

    // Show progress during tool discovery
    if (this.state.toolsDiscovering) {
      return `
        <div class="tools-discovering">
          <h2>🔧 Tool Discovery in Progress</h2>
          <p>Analyzing SIMPLE tasks and discovering appropriate tools...</p>
          
          ${this.state.progressMessages.length > 0 ? `
            <div class="progress-container">
              <div class="progress-header">
                <span class="progress-title">
                  ${this.renderProgressTitle()}
                </span>
                ${this.state.progressMessages.length > 5 ? `
                  <button class="collapse-btn" id="progress-collapse-btn">
                    ${this.state.progressCollapsed ? 'Expand ▼' : 'Collapse ▲'}
                  </button>
                ` : ''}
              </div>
              ${!this.state.progressCollapsed ? `
                <div class="progress-messages">
                  ${this.renderProgressMessages()}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }

    // Show results after tool discovery
    if (this.state.toolsResult) {
      return this.renderToolsResults();
    }

    // Show initial state - tool discovery will start automatically
    return `
      <div class="tools-initial">
        <div style="min-height: 400px;">
          <p>Starting tool discovery...</p>
        </div>
      </div>
    `;
  }

  renderToolsResults() {
    if (!this.state.toolsResult) return '';

    const result = this.state.toolsResult;
    
    return `
      <div class="tools-results">
        <h2>🔧 Tool Discovery Results</h2>
        
        <div class="tools-summary">
          <div class="summary-stats">
            <span class="stat">📊 ${result.statistics.totalSimpleTasks} SIMPLE tasks</span>
            <span class="stat success">✅ ${result.statistics.feasibleTasks} feasible</span>
            <span class="stat error">❌ ${result.statistics.infeasibleTasks} infeasible</span>
            <span class="stat">🔧 ${result.statistics.totalTools} tools found</span>
            <span class="stat">⏱️ ${result.processingTime}ms</span>
          </div>
        </div>
        
        <div class="tools-list-container">
          <h3>📋 Task Analysis Results</h3>
          <div class="tools-list">
            ${result.toolDiscovery.map((item, index) => this.renderToolDiscoveryItem(item, index)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderToolDiscoveryItem(item, index) {
    const isExpanded = this.state.expandedToolItems && this.state.expandedToolItems.includes(index);
    const feasible = item.discoveryResult ? item.discoveryResult.feasible : false;
    const statusIcon = feasible ? '✅' : '❌';
    const statusText = feasible ? 'Feasible' : 'Infeasible';
    
    return `
      <div class="tool-discovery-item ${feasible ? 'feasible' : 'infeasible'}">
        <div class="task-header" onclick="toggleToolItem(${index})">
          <span class="expand-icon">${isExpanded ? '🔽' : '▶️'}</span>
          <span class="task-title">${item.taskDescription}</span>
          <span class="feasibility-status">${statusIcon} ${statusText}</span>
        </div>
        
        ${isExpanded ? `
          <div class="task-details">
            ${item.error ? `
              <div class="error-details">
                <h4>❌ Error</h4>
                <p>${item.error}</p>
              </div>
            ` : item.discoveryResult ? `
              <div class="discovery-steps">
                <h4>🔍 Discovery Process</h4>
                
                <div class="step step1">
                  <h5>Step 1: Generated Tool Descriptions (${item.discoveryResult.debug.step1_descriptions.length})</h5>
                  <div class="descriptions-list">
                    ${item.discoveryResult.debug.step1_descriptions.map(desc => `
                      <div class="description-item">📝 "${desc}"</div>
                    `).join('')}
                  </div>
                </div>
                
                <div class="step step2">
                  <h5>Step 2: Tool Search Results</h5>
                  <div class="search-results">
                    ${item.discoveryResult.debug.step2_discoveries.map(search => `
                      <div class="search-result">
                        <div class="search-query">🔎 "${search.description}"</div>
                        <div class="found-tools">
                          ${search.tools.length > 0 ? `
                            <div class="tools-found">Found ${search.tools.length} tools:</div>
                            ${search.tools.map(tool => `
                              <div class="tool-item">
                                <span class="tool-name">${tool.name}</span>
                                <span class="tool-confidence">(${(tool.confidence * 100).toFixed(1)}%)</span>
                              </div>
                            `).join('')}
                          ` : `<div class="no-tools">No tools found</div>`}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
                
                <div class="step step3">
                  <h5>Step 3: Final Merged Tools (${item.discoveryResult.debug.step3_merged.length})</h5>
                  <div class="final-tools">
                    ${item.discoveryResult.debug.step3_merged.length > 0 ? `
                      ${item.discoveryResult.debug.step3_merged.map((tool, index) => {
                        const isExpanded = this.state.expandedToolsMetadata.has(`${item.discoveryResult.hierarchyIndex}-${index}`);
                        return `
                        <div class="final-tool">
                          <div class="tool-header clickable" data-tool-key="${item.discoveryResult.hierarchyIndex}-${index}">
                            <span class="tool-expand-icon">${isExpanded ? '▼' : '▶️'}</span>
                            <span class="tool-name">${tool.name}</span>
                            <span class="tool-confidence confidence-${this.getConfidenceClass(tool.confidence)}">
                              ${(tool.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div class="tool-meta">
                            ${tool.description ? `<div class="tool-desc">${tool.description}</div>` : ''}
                            <div class="tool-status">
                              ${tool.available ? '✅ Available' : '❌ Unavailable'} | 
                              ${tool.executable ? '🔧 Executable' : '❌ Not Executable'}
                            </div>
                            ${isExpanded ? `
                              <div class="tool-full-metadata">
                                <h6>Full Tool Metadata:</h6>
                                ${tool.metadata ? `
                                  <div class="metadata-section">
                                    <div class="metadata-field">
                                      <strong>Description:</strong> ${tool.metadata.description || 'None'}
                                    </div>
                                    <div class="metadata-field">
                                      <strong>Category:</strong> ${tool.metadata.category || 'None'}
                                    </div>
                                    <div class="metadata-field">
                                      <strong>Version:</strong> ${tool.metadata.version || 'None'}
                                    </div>
                                    <div class="metadata-field">
                                      <strong>Author:</strong> ${tool.metadata.author || 'None'}
                                    </div>
                                    <div class="metadata-field">
                                      <strong>Input Schema:</strong>
                                      <pre class="schema-json">${JSON.stringify(tool.metadata.inputSchema || {}, null, 2)}</pre>
                                    </div>
                                    <div class="metadata-field">
                                      <strong>Output Schema:</strong>
                                      <pre class="schema-json">${JSON.stringify(tool.metadata.outputSchema || {}, null, 2)}</pre>
                                    </div>
                                  </div>
                                ` : '<div class="no-metadata">No metadata available</div>'}
                              </div>
                            ` : ''}
                          </div>
                        </div>`;
                      }).join('')}
                    ` : `<div class="no-final-tools">No tools met the confidence threshold</div>`}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  getConfidenceClass(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  renderProgressMessages() {
    const messages = this.state.progressMessages;
    if (messages.length === 0) return '';

    // Always show all messages when expanded (collapsed state handled in render)
    let html = '';

    // Render all messages
    messages.forEach(msg => {
      const timeStr = new Date(msg.timestamp).toLocaleTimeString();
      const icon = msg.type === 'complete' ? '✅' : 
                  msg.type === 'start' ? '🚀' : '🔄';
      html += `
        <div class="progress-message" data-type="${msg.type}">
          <span class="message-icon">${icon}</span>
          <span class="message-text">${msg.message}</span>
          <span class="message-time">${timeStr}</span>
        </div>
      `;
    });

    return html;
  }

  renderLLMDebugTab() {
    const interactions = this.state.llmInteractions || [];
    
    if (interactions.length === 0) {
      return `
        <div class="llm-debug-placeholder">
          <h2>🧠 LLM Debug</h2>
          <p>No LLM interactions yet. Start planning to see prompts and responses.</p>
        </div>
      `;
    }
    
    return `
      <div class="llm-debug-container">
        <h2>🧠 LLM Debug (${interactions.length} interactions)</h2>
        
        <div class="interactions-list">
          ${interactions.map((interaction, index) => `
            <div class="interaction-item ${interaction.collapsed ? 'collapsed' : 'expanded'}" data-interaction-id="${interaction.id}">
              <div class="interaction-header" onclick="toggleInteraction('${interaction.id}')">
                <span class="expand-icon">${interaction.collapsed ? '▶️' : '🔽'}</span>
                <span class="interaction-info">
                  <strong>#${index + 1}</strong>
                  <span class="model-info">${interaction.provider}/${interaction.model}</span>
                  <span class="timestamp">${new Date(interaction.timestamp).toLocaleTimeString()}</span>
                  <span class="status">
                    ${interaction.response ? '✅ Complete' : interaction.error ? '❌ Error' : '🔄 Pending'}
                  </span>
                </span>
              </div>
              
              ${!interaction.collapsed ? `
                <div class="interaction-details">
                  <div class="prompt-section">
                    <h4>📝 Prompt</h4>
                    <pre class="prompt-content">${interaction.prompt}</pre>
                  </div>
                  
                  ${interaction.response ? `
                    <div class="response-section">
                      <h4>💬 Response</h4>
                      <pre class="response-content">${interaction.response}</pre>
                    </div>
                  ` : ''}
                  
                  ${interaction.error ? `
                    <div class="error-section">
                      <h4>❌ Error</h4>
                      <pre class="error-content">${interaction.error}</pre>
                    </div>
                  ` : ''}
                  
                  <div class="interaction-metadata">
                    <div class="metadata-item">
                      <strong>Max Tokens:</strong> ${interaction.maxTokens}
                    </div>
                    ${interaction.responseTimestamp ? `
                      <div class="metadata-item">
                        <strong>Response Time:</strong> ${new Date(interaction.responseTimestamp).toLocaleTimeString()}
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  initializeUI() {
    // Wait for DOM if needed
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeUI());
      return;
    }
    
    const appEl = document.getElementById('app');
    if (!appEl) {
      console.error('App element not found');
      return;
    }
    
    // Create basic layout with tabs
    appEl.innerHTML = `
      <div class="planner-container">
        <h1>🧠 Decent Planner</h1>
        <div class="connection-status" id="connection-status">
          ${this.state.connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <div id="tabs-container"></div>
      </div>
    `;
    
    // Initialize tabs component
    this.initializeTabs();
    
    // Add styles
    this.injectStyles();
  }

  initializeTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    
    // Create tabs component
    this.tabsComponent = new TabsComponent(container, {
      tabs: [
        { id: 'plans', label: 'Plans', icon: '📁' },
        { id: 'planning', label: 'Planning', icon: '📋' },
        { id: 'tools', label: 'Tool Discovery', icon: '🔧', disabled: !this.state.informalResult },
        { id: 'formal', label: 'Formal Planning', icon: '🏗️', disabled: !this.state.toolsResult },
        { id: 'execution', label: 'Execution', icon: '▶️', disabled: !this.state.formalResult },
        { id: 'search', label: 'Semantic Search', icon: '🔍' },
        { id: 'llm', label: 'LLM Debug', icon: '🧠' }
      ],
      activeTab: 'planning',
      onTabChange: (tabId) => this.handleTabChange(tabId)
    });
    
    // Initialize tab contents
    this.initializePlansTab();
    this.initializePlanningTab();
    this.initializeToolsTab();
    this.initializeFormalTab();
    this.initializeExecutionTab();
    this.initializeSearchTab();
    this.initializeLLMTab();
  }
  
  initializePlansTab() {
    const container = this.tabsComponent.getContentContainer('plans');
    if (!container) return;
    
    this.renderPlansContent();
  }
  
  renderPlansContent() {
    const container = this.tabsComponent.getContentContainer('plans');
    if (!container) return;
    
    // Clear container first
    container.innerHTML = '';
    
    // Create plans content div
    const plansContent = document.createElement('div');
    plansContent.className = 'plans-content';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = '📁 Saved Plans';
    plansContent.appendChild(title);
    
    // Load section
    const loadSection = document.createElement('div');
    loadSection.className = 'load-section';
    
    const loadControls = document.createElement('div');
    loadControls.className = 'load-controls';
    
    // Select dropdown
    const select = document.createElement('select');
    select.id = 'load-plan-select';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a saved plan to load...';
    select.appendChild(defaultOption);
    
    // Load button
    const loadButton = document.createElement('button');
    loadButton.id = 'load-plan-button';
    loadButton.textContent = '📂 Load Plan';
    loadButton.disabled = true;
    
    // Refresh button
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-plans-button';
    refreshButton.textContent = '🔄 Refresh';
    
    loadControls.appendChild(select);
    loadControls.appendChild(loadButton);
    loadControls.appendChild(refreshButton);
    loadSection.appendChild(loadControls);
    plansContent.appendChild(loadSection);
    
    // Current plan display
    const currentPlanDisplay = document.createElement('div');
    currentPlanDisplay.id = 'current-plan-display';
    
    const planContent = this.renderCurrentPlan();
    if (typeof planContent === 'string') {
      currentPlanDisplay.innerHTML = planContent;
    } else {
      currentPlanDisplay.appendChild(planContent);
    }
    
    plansContent.appendChild(currentPlanDisplay);
    container.appendChild(plansContent);
    
    // Attach event listeners
    const loadPlanSelect = document.getElementById('load-plan-select');
    const loadPlanButton = document.getElementById('load-plan-button');
    const refreshPlansButton = document.getElementById('refresh-plans-button');
    
    if (loadPlanSelect) {
      loadPlanSelect.addEventListener('change', (e) => {
        loadPlanButton.disabled = !e.target.value;
      });
    }
    
    if (loadPlanButton) {
      loadPlanButton.addEventListener('click', () => {
        this.handleLoadPlan();
      });
    }
    
    if (refreshPlansButton) {
      refreshPlansButton.addEventListener('click', () => {
        this.refreshSavedPlans();
      });
    }
    
    // Load available plans on render
    this.refreshSavedPlans();
  }
  
  renderCurrentPlan() {
    if (!this.state.formalResult) {
      const p = document.createElement('p');
      p.textContent = 'No plan loaded.';
      return p;
    }
    
    const behaviorTrees = this.state.formalResult.formal?.behaviorTrees || [];
    const firstTree = behaviorTrees[0];
    
    if (!firstTree) {
      const p = document.createElement('p');
      p.textContent = 'No behavior tree found in plan.';
      return p;
    }
    
    const currentPlan = document.createElement('div');
    currentPlan.className = 'current-plan';
    
    // Title
    const title = document.createElement('h3');
    title.textContent = `📋 Current Plan: ${firstTree.id || 'Unnamed'}`;
    currentPlan.appendChild(title);
    
    // Description
    const descDiv = document.createElement('div');
    descDiv.className = 'plan-description';
    const descStrong = document.createElement('strong');
    descStrong.textContent = 'Description:';
    descDiv.appendChild(descStrong);
    descDiv.appendChild(document.createTextNode(` ${firstTree.description || 'No description'}`));
    currentPlan.appendChild(descDiv);
    
    // Details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'plan-details';
    
    // Stats
    const statsDiv = document.createElement('div');
    statsDiv.className = 'plan-stats';
    
    const statItems = [
      `🌳 ${behaviorTrees.length} behavior tree(s)`,
      `📊 ${this.countPlanNodes(firstTree)} nodes`,
      `🎯 Goal: "${this.state.goal}"`
    ];
    
    statItems.forEach(statText => {
      const stat = document.createElement('span');
      stat.className = 'stat';
      stat.textContent = statText;
      statsDiv.appendChild(stat);
    });
    
    detailsDiv.appendChild(statsDiv);
    
    // Tree structure details
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'View Tree Structure';
    details.appendChild(summary);
    
    const pre = document.createElement('pre');
    pre.className = 'plan-tree';
    pre.textContent = JSON.stringify(firstTree, null, 2);
    details.appendChild(pre);
    
    detailsDiv.appendChild(details);
    currentPlan.appendChild(detailsDiv);
    
    return currentPlan;
  }
  
  countPlanNodes(tree) {
    if (!tree) return 0;
    
    let count = 1;
    if (tree.children) {
      tree.children.forEach(child => {
        count += this.countPlanNodes(child);
      });
    }
    if (tree.child) {
      count += this.countPlanNodes(tree.child);
    }
    return count;
  }
  
  initializePlanningTab() {
    const container = this.tabsComponent.getContentContainer('planning');
    if (!container) return;
    
    this.renderPlanningContent();
  }
  
  renderPlanningContent() {
    const container = this.tabsComponent.getContentContainer('planning');
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Create planning content
    const planningContent = document.createElement('div');
    planningContent.className = 'planning-content';
    
    // Label
    const label = document.createElement('label');
    label.setAttribute('for', 'goal-input');
    label.textContent = 'Planning Goal:';
    planningContent.appendChild(label);
    
    // Textarea
    const textarea = document.createElement('textarea');
    textarea.id = 'goal-input';
    textarea.placeholder = 'Enter your planning goal...';
    textarea.disabled = this.state.informalPlanning;
    textarea.value = this.state.goal || '';
    planningContent.appendChild(textarea);
    
    // Button group
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';
    
    // Start informal planning button
    const informalButton = document.createElement('button');
    informalButton.id = 'informal-button';
    informalButton.disabled = this.state.informalPlanning || !this.state.connected;
    informalButton.textContent = this.state.informalPlanning ? 
      '⏳ Running Informal Planning...' : 
      '🔍 Start Informal Planning';
    buttonGroup.appendChild(informalButton);
    
    // Cancel button (only if planning is running)
    if (this.state.informalPlanning) {
      const cancelButton = document.createElement('button');
      cancelButton.id = 'cancel-button';
      cancelButton.className = 'cancel-btn';
      cancelButton.disabled = this.state.cancelling;
      cancelButton.textContent = this.state.cancelling ? 
        '⏳ Cancellation pending' : 
        '❌ Cancel';
      buttonGroup.appendChild(cancelButton);
    }
    
    planningContent.appendChild(buttonGroup);
    
    // Progress messages section
    if (this.state.progressMessages && this.state.progressMessages.length > 0) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      
      const progressTitle = document.createElement('h3');
      progressTitle.textContent = '📊 Progress';
      progressContainer.appendChild(progressTitle);
      
      const progressMessages = document.createElement('div');
      progressMessages.className = 'progress-messages';
      
      this.state.progressMessages.forEach(msg => {
        const progressMsg = document.createElement('div');
        progressMsg.className = 'progress-msg';
        
        const msgIcon = document.createElement('span');
        msgIcon.className = 'msg-icon';
        msgIcon.textContent = '🔄';
        
        const msgText = document.createElement('span');
        msgText.className = 'msg-text';
        msgText.textContent = msg.message;
        
        const msgTime = document.createElement('span');
        msgTime.className = 'msg-time';
        msgTime.textContent = new Date(msg.timestamp).toLocaleTimeString();
        
        progressMsg.appendChild(msgIcon);
        progressMsg.appendChild(msgText);
        progressMsg.appendChild(msgTime);
        progressMessages.appendChild(progressMsg);
      });
      
      progressContainer.appendChild(progressMessages);
      planningContent.appendChild(progressContainer);
    }
    
    // Informal result section
    if (this.state.informalResult) {
      const informalResult = document.createElement('div');
      informalResult.className = 'informal-result';
      
      const resultTitle = document.createElement('h3');
      resultTitle.textContent = '📋 Informal Planning Result';
      informalResult.appendChild(resultTitle);
      
      const resultStats = document.createElement('div');
      resultStats.className = 'result-stats';
      
      ['Total Tasks: 1', 'Simple: 1', 'Complex: 0', 'Valid: ✅'].forEach(statText => {
        const stat = document.createElement('span');
        stat.textContent = statText;
        resultStats.appendChild(stat);
      });
      
      informalResult.appendChild(resultStats);
      
      // Hierarchy details
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'View Hierarchy';
      details.appendChild(summary);
      
      const hierarchyPre = document.createElement('pre');
      hierarchyPre.textContent = JSON.stringify(this.state.informalResult.informal?.hierarchy, null, 2);
      details.appendChild(hierarchyPre);
      
      informalResult.appendChild(details);
      planningContent.appendChild(informalResult);
    }
    
    // Error section
    if (this.state.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = `❌ Error: ${this.state.error}`;
      planningContent.appendChild(errorDiv);
    }
    
    container.appendChild(planningContent);
    
    // Attach event listeners
    textarea.addEventListener('input', (e) => {
      this.state.goal = e.target.value;
    });
    
    informalButton.addEventListener('click', () => {
      this.submitInformalPlan(this.state.goal);
    });
    
    if (this.state.informalPlanning) {
      const cancelButton = container.querySelector('#cancel-button');
      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          this.cancelPlanning();
        });
      }
    }
  }
  
  initializeToolsTab() {
    const container = this.tabsComponent.getContentContainer('tools');
    if (!container) return;
    
    // Create tool discovery component
    this.toolDiscoveryComponent = new ToolDiscoveryComponent(container);
  }
  
  initializeFormalTab() {
    const container = this.tabsComponent.getContentContainer('formal');
    if (!container) return;
    
    // Create formal planning component
    this.formalPlanningComponent = new FormalPlanningComponent(container);
  }
  
  initializeExecutionTab() {
    const container = this.tabsComponent.getContentContainer('execution');
    if (!container) return;
    
    // Create execution component
    this.executionComponent = new TreeExecutionComponent(container, {
      onStep: () => this.handleExecutionStep(),
      onRun: () => this.handleExecutionRun(),
      onPause: () => this.handleExecutionPause(),
      onReset: () => this.handleExecutionReset(),
      onBreakpoint: (nodeId, enabled) => this.handleBreakpoint(nodeId, enabled)
    });
    
    // Check if there's already a formal result available and load it
    if (this.state.formalResult?.formal?.behaviorTrees?.[0]) {
      this.loadExecutionTree(this.state.formalResult.formal.behaviorTrees[0]);
    }
  }
  
  initializeSearchTab() {
    const container = this.tabsComponent.getContentContainer('search');
    if (!container) return;
    
    // Create search component with remote actor
    this.searchComponent = new SearchComponent(container, {
      remoteActor: this.remoteActor
    });
  }
  
  initializeLLMTab() {
    const container = this.tabsComponent.getContentContainer('llm');
    if (!container) return;
    
    // Initial render of LLM debug content
    this.renderLLMDebugContent();
  }
  
  renderLLMDebugContent() {
    const container = this.tabsComponent.getContentContainer('llm');
    if (!container) return;
    
    container.innerHTML = this.renderLLMDebugTab();
    
    // Add global toggle function for interactions
    if (!window.toggleInteraction) {
      window.toggleInteraction = (interactionId) => {
        const interactions = [...this.state.llmInteractions];
        const interaction = interactions.find(i => i.id === interactionId);
        if (interaction) {
          interaction.collapsed = !interaction.collapsed;
          this.updateState({ llmInteractions: interactions });
          this.renderLLMDebugContent(); // Re-render the tab
        }
      };
    }
  }
  
  handleTabChange(tabId) {
    // Auto-start tool discovery when switching to tools tab
    if (tabId === 'tools' && this.state.informalResult && !this.state.toolsResult && !this.state.toolsDiscovering) {
      this.submitToolsDiscovery();
    }
    
    // Auto-start formal planning when switching to formal tab
    if (tabId === 'formal' && this.state.toolsResult && !this.state.formalResult && !this.state.formalPlanning) {
      this.submitFormalPlanning();
    }
    
    // Initialize search component when switching to search tab
    if (tabId === 'search' && !this.searchComponent) {
      this.initializeSearchTab();
    }
    
    // Initialize formal planning component when switching to formal tab
    if (tabId === 'formal' && !this.formalPlanningComponent) {
      this.initializeFormalTab();
    }
  }
  
  injectStyles() {
    if (document.getElementById('planner-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'planner-styles';
    style.textContent = `
      .planner-container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .tabs-nav {
        display: flex;
        gap: 10px;
        border-bottom: 2px solid #ddd;
        margin-bottom: 20px;
      }
      
      .tab-btn {
        padding: 10px 20px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        border-bottom: 3px solid transparent;
      }
      
      .tab-btn.active {
        border-bottom-color: #007bff;
        font-weight: bold;
      }
      
      .tab-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .tab-panel {
        min-height: 400px;
      }
      
      .tab-panel.hidden {
        display: none;
      }
      
      .tool-discovery-results {
        padding: 20px;
      }
      
      .tool-discovery-stats {
        display: flex;
        gap: 15px;
        margin: 10px 0;
        flex-wrap: wrap;
      }
      
      .stat {
        padding: 5px 10px;
        background: #f0f0f0;
        border-radius: 5px;
      }
      
      .task-item {
        border: 1px solid #ddd;
        margin: 10px 0;
        border-radius: 5px;
      }
      
      .task-header {
        padding: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .task-header:hover {
        background: #f5f5f5;
      }
      
      .task-expand-icon {
        font-size: 12px;
      }
      
      .task-description {
        flex: 1;
      }
      
      .task-item.feasible {
        border-color: #28a745;
      }
      
      .task-item.infeasible {
        border-color: #dc3545;
      }
      
      .task-details {
        padding: 15px;
        background: #f9f9f9;
        border-top: 1px solid #ddd;
      }
      
      .debug-step {
        margin: 10px 0;
      }
      
      .debug-step h5 {
        margin: 5px 0;
        color: #666;
      }
      
      textarea {
        width: 100%;
        min-height: 100px;
        padding: 10px;
        margin: 10px 0;
      }
      
      .button-group {
        margin: 10px 0;
      }
      
      button {
        padding: 10px 20px;
        margin: 5px;
        border: none;
        border-radius: 5px;
        background: #007bff;
        color: white;
        cursor: pointer;
      }
      
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .progress-container {
        margin: 20px 0;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
      }
      
      .progress-messages {
        max-height: 200px;
        overflow-y: auto;
        background: #f9f9f9;
        padding: 10px;
        border-radius: 3px;
      }
      
      .progress-msg {
        display: flex;
        gap: 10px;
        padding: 5px 0;
        border-bottom: 1px solid #eee;
      }
      
      .msg-text {
        flex: 1;
      }
      
      .msg-time {
        color: #999;
        font-size: 12px;
      }
      
      .informal-result {
        margin: 20px 0;
        padding: 15px;
        background: #f0f8ff;
        border-radius: 5px;
        border: 1px solid #b0d4ff;
      }
      
      .result-stats {
        display: flex;
        gap: 20px;
        margin: 10px 0;
      }
      
      .result-stats span {
        padding: 5px 10px;
        background: white;
        border-radius: 3px;
      }
      
      .error-message {
        padding: 15px;
        background: #ffe0e0;
        border: 1px solid #ffb0b0;
        border-radius: 5px;
        margin: 20px 0;
      }
      
      details {
        margin: 10px 0;
      }
      
      details summary {
        cursor: pointer;
        padding: 5px;
        background: #e0e0e0;
        border-radius: 3px;
      }
      
      details pre {
        background: white;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 3px;
        overflow-x: auto;
      }
      
      /* Search Component Styles */
      .search-container {
        padding: 20px;
        min-height: 400px;
      }
      
      .search-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #ddd;
      }
      
      .search-stats {
        display: flex;
        gap: 15px;
      }
      
      .search-stats .stat {
        padding: 5px 10px;
        background: #f0f0f0;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .search-controls {
        margin-bottom: 20px;
      }
      
      .search-input-group {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
      }
      
      .search-input {
        flex: 1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .search-button {
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .search-button:hover {
        background: #0056b3;
      }
      
      .search-button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      
      .search-type-selector {
        display: flex;
        gap: 20px;
      }
      
      .search-type-selector label {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }
      
      .search-error {
        padding: 10px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 4px;
        color: #c00;
        margin-bottom: 15px;
      }
      
      .search-loading {
        text-align: center;
        padding: 40px;
      }
      
      .search-loading .spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #007bff;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .search-results {
        background: #f9f9f9;
        padding: 15px;
        border-radius: 4px;
      }
      
      .results-header {
        margin-bottom: 15px;
      }
      
      .tools-list {
        max-height: 600px;
        overflow-y: auto;
      }
      
      .tool-item {
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 10px;
      }
      
      .tool-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        cursor: pointer;
      }
      
      .tool-header:hover {
        background: #f0f0f0;
      }
      
      .tool-expand-icon {
        font-size: 12px;
      }
      
      .tool-name {
        flex: 1;
        font-weight: bold;
      }
      
      .tool-module {
        font-size: 12px;
        color: #666;
        padding: 2px 6px;
        background: #f0f0f0;
        border-radius: 3px;
      }
      
      .tool-details {
        padding: 15px;
        background: #f9f9f9;
        border-top: 1px solid #ddd;
      }
      
      .tool-description {
        margin-bottom: 15px;
        color: #333;
      }
      
      .tool-schema {
        margin-bottom: 15px;
      }
      
      .tool-schema h5 {
        margin-bottom: 5px;
        color: #666;
      }
      
      .tool-schema pre {
        background: white;
        border: 1px solid #ddd;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        overflow-x: auto;
      }
      
      .no-results {
        text-align: center;
        color: #666;
        padding: 20px;
      }
      
      /* Plan Management Styles */
      .plan-management {
        background: #f8f9fa;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
      }
      
      .load-section, .save-section {
        margin-bottom: 15px;
      }
      
      .load-section:last-child, .save-section:last-child {
        margin-bottom: 0;
      }
      
      .load-controls {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-top: 5px;
      }
      
      .load-controls select {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        background: white;
      }
      
      .load-controls button {
        padding: 8px 16px;
        font-size: 14px;
        margin: 0;
        white-space: nowrap;
      }
      
      .planning-divider {
        border-top: 1px solid #e1e5e9;
        margin: 20px 0;
      }
      
      #save-plan-button {
        background: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 14px;
      }
      
      #save-plan-button:hover {
        background: #218838;
      }
      
      #load-plan-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      #refresh-plans-button {
        background: #6c757d;
        color: white;
        padding: 8px 12px;
        font-size: 14px;
      }
      
      #refresh-plans-button:hover {
        background: #5a6268;
      }
      
      /* Plans Tab Styles */
      .plans-content {
        padding: 20px;
      }
      
      .plans-content h2 {
        margin-top: 0;
        color: #333;
      }
      
      .current-plan {
        margin-top: 30px;
        padding: 20px;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        background: white;
      }
      
      .plan-description {
        margin: 10px 0;
        color: #666;
      }
      
      .plan-stats {
        display: flex;
        gap: 15px;
        margin: 15px 0;
        flex-wrap: wrap;
      }
      
      .plan-tree {
        background: #f8f9fa;
        border: 1px solid #e1e5e9;
        border-radius: 4px;
        padding: 15px;
        font-size: 12px;
        overflow-x: auto;
        max-height: 400px;
        overflow-y: auto;
      }
      
      /* Save Plan Button in Formal Tab */
      .save-plan-btn {
        background: #28a745 !important;
        color: white !important;
        padding: 8px 16px !important;
        border: none !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        margin: 0 !important;
        cursor: pointer !important;
      }
      
      .save-plan-btn:hover {
        background: #218838 !important;
      }
      
      /* Tool Metadata Styles */
      .tool-header.clickable {
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .tool-header.clickable:hover {
        background-color: #f5f5f5;
      }
      
      .tool-expand-icon {
        font-size: 12px;
        width: 16px;
        text-align: center;
      }
      
      .tool-full-metadata {
        margin-top: 15px;
        padding: 15px;
        background: #fafafa;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
      }
      
      .tool-full-metadata h6 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 14px;
        font-weight: bold;
      }
      
      .metadata-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .metadata-field {
        background: white;
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #e5e5e5;
      }
      
      .metadata-field strong {
        display: block;
        margin-bottom: 5px;
        color: #555;
        font-size: 12px;
        text-transform: uppercase;
      }
      
      .schema-json {
        background: #f8f8f8;
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 8px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 11px;
        max-height: 200px;
        overflow-y: auto;
        margin: 5px 0 0 0;
      }
      
      .no-metadata {
        padding: 10px;
        color: #999;
        font-style: italic;
        text-align: center;
        background: #f9f9f9;
        border-radius: 4px;
      }
      
      .final-tool {
        margin-bottom: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        overflow: hidden;
      }
      
      .final-tool .tool-meta {
        padding: 8px;
      }
    `;
    document.head.appendChild(style);
  }
  
  createPlannerComponent(container) {
    // Create the MVVM structure
    const viewModel = {
      state: this.state,
      
      submitPlan: (goal) => {
        this.submitPlan(goal);
      },
      
      submitInformalPlan: (goal) => {
        this.submitInformalPlan(goal);
      },
      
      submitFormalPlan: () => {
        this.submitFormalPlan();
      },
      
      submitToolsDiscovery: () => {
        this.submitToolsDiscovery();
      },
      
      switchTab: (tabName) => {
        this.switchTab(tabName);
      },
      
      updateState: (newState) => {
        Object.assign(this.state, newState);
        this.render();
      }
    };
    
    // Store reference to component
    this.plannerComponent = viewModel;
    
    // Initial render
    this.render = () => {
      container.innerHTML = `
        <div class="planner-container">
          <h1>🧠 Decent Planner - Manual Step Through</h1>
          
          <div class="connection-status">
            ${this.state.connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          
          <!-- Tab Navigation -->
          <div class="tab-nav">
            <button 
              class="tab-btn ${this.state.activeTab === 'planning' ? 'active' : ''}" 
              id="planning-tab-btn"
            >
              📋 Planning
            </button>
            <button 
              class="tab-btn ${this.state.activeTab === 'tools' ? 'active' : ''}" 
              id="tools-tab-btn"
              ${!this.state.informalResult ? 'disabled' : ''}
            >
              🔧 Tool Discovery
            </button>
            <button 
              class="tab-btn ${this.state.activeTab === 'llm' ? 'active' : ''}" 
              id="llm-tab-btn"
            >
              🧠 LLM Debug
            </button>
          </div>
          
          <!-- Planning Tab Content -->
          <div class="tab-content ${this.state.activeTab === 'planning' ? 'active' : 'hidden'}" id="planning-tab">
            <div class="planner-form">
            <label for="goal-input">Planning Goal:</label>
            <textarea 
              id="goal-input" 
              placeholder="Enter your planning goal..."
              ${this.state.informalPlanning || this.state.formalPlanning ? 'disabled' : ''}
            >${this.state.goal}</textarea>
            
            <div class="button-group">
              <button 
                id="informal-button"
                ${this.state.informalPlanning || this.state.formalPlanning || !this.state.connected ? 'disabled' : ''}
              >
                ${this.state.informalPlanning ? '⏳ Running Informal Planning...' : '🔍 Start Informal Planning'}
              </button>
              
              <button 
                id="formal-button"
                ${this.state.formalPlanning || !this.state.toolsResult || !this.state.connected ? 'disabled' : ''}
              >
                ${this.state.formalPlanning ? '⏳ Running Formal Planning...' : '🏗️ Continue to Formal Planning'}
              </button>
              
              ${this.state.informalPlanning || this.state.formalPlanning || this.state.cancelling ? `
                <button 
                  id="cancel-button"
                  class="cancel-btn"
                  ${!this.state.connected || this.state.cancelling ? 'disabled' : ''}
                >
                  ${this.state.cancelling ? '⏳ Cancellation pending' : '❌ Cancel Planning'}
                </button>
              ` : ''}
            </div>
          </div>
          
          ${this.state.progressMessages.length > 0 ? `
            <div class="progress-container">
              <div class="progress-header">
                <span class="progress-title">
                  ${this.renderProgressTitle()}
                </span>
                ${this.state.progressMessages.length > 5 ? `
                  <button class="collapse-btn" id="progress-collapse-btn">
                    ${this.state.progressCollapsed ? 'Expand ▼' : 'Collapse ▲'}
                  </button>
                ` : ''}
              </div>
              ${!this.state.progressCollapsed ? `
                <div class="progress-messages">
                  ${this.renderProgressMessages()}
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${this.state.error ? `
            <div class="error">
              ❌ Error: ${this.state.error}
            </div>
          ` : ''}
          
          ${this.state.informalResult ? `
            <div class="result informal-result">
              <h2>📋 Informal Planning Result</h2>
              <div class="phase-summary">
                <strong>Phase:</strong> ${this.state.informalResult.phase} | 
                <strong>Success:</strong> ${this.state.informalResult.success ? '✅ Yes' : '❌ No'} |
                <strong>Processing Time:</strong> ${this.state.informalResult.processingTime}ms
              </div>
              ${this.state.informalResult.success ? `
                <div class="statistics">
                  <h3>Statistics</h3>
                  <ul>
                    <li>Total Tasks: ${this.state.informalResult.informal.statistics.totalTasks}</li>
                    <li>Simple Tasks: ${this.state.informalResult.informal.statistics.simpleTasks}</li>
                    <li>Complex Tasks: ${this.state.informalResult.informal.statistics.complexTasks}</li>
                    <li>Feasible Tasks: ${this.state.informalResult.informal.statistics.feasibleTasks}</li>
                    <li>Max Depth: ${this.state.informalResult.informal.statistics.maxDepth}</li>
                  </ul>
                </div>
                <div class="hierarchy-preview">
                  <h3>Task Hierarchy (Preview)</h3>
                  <pre>${JSON.stringify(this.state.informalResult.informal.hierarchy, null, 2)}</pre>
                </div>
              ` : `
                <div class="failure-reason">
                  <h3>Failure Reason</h3>
                  <p>${this.state.informalResult.reason || 'Unknown error'}</p>
                  ${this.state.informalResult.errors ? `
                    <ul>
                      ${this.state.informalResult.errors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                  ` : ''}
                </div>
              `}
            </div>
          ` : ''}
          
          ${this.state.formalResult ? `
            <div class="result formal-result">
              <h2>🏗️ Formal Planning Result</h2>
              <div class="phase-summary">
                <strong>Phase:</strong> ${this.state.formalResult.phase} | 
                <strong>Success:</strong> ${this.state.formalResult.success ? '✅ Yes' : '❌ No'} |
                <strong>Processing Time:</strong> ${this.state.formalResult.processingTime}ms
              </div>
              ${this.state.formalResult.success && this.state.formalResult.formal ? `
                <div class="formal-details">
                  <h3>Behavior Trees</h3>
                  <p><strong>Status:</strong> ${this.state.formalResult.formal.status}</p>
                  <p><strong>Count:</strong> ${this.state.formalResult.formal.count || 0}</p>
                  ${this.state.formalResult.formal.behaviorTrees && this.state.formalResult.formal.behaviorTrees.length > 0 ? `
                    <pre>${JSON.stringify(this.state.formalResult.formal.behaviorTrees, null, 2)}</pre>
                  ` : '<p>No behavior trees generated</p>'}
                </div>
              ` : `
                <div class="failure-reason">
                  <h3>Failure Reason</h3>
                  <p>${this.state.formalResult.reason || 'Unknown error'}</p>
                </div>
              `}
            </div>
          ` : ''}
          
          ${this.state.result ? `
            <div class="result full-result">
              <h2>Full Planning Result (Legacy)</h2>
              <pre>${JSON.stringify(this.state.result, null, 2)}</pre>
            </div>
          ` : ''}
          </div>
          
          <!-- Tools Tab Content -->
          <div class="tab-content ${this.state.activeTab === 'tools' ? 'active' : 'hidden'}" id="tools-tab">
            ${this.renderToolsTab()}
          </div>
          
          <!-- LLM Debug Tab Content -->
          <div class="tab-content ${this.state.activeTab === 'llm' ? 'active' : 'hidden'}" id="llm-tab">
            ${this.renderLLMDebugTab()}
          </div>
        </div>
      `;
      
      // Add styles
      if (!document.getElementById('planner-styles')) {
        const style = document.createElement('style');
        style.id = 'planner-styles';
        style.textContent = `
          body {
            overflow-y: auto;
            height: 100vh;
          }
          
          .planner-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, sans-serif;
            max-height: none;
            overflow-y: visible;
          }
          
          .connection-status {
            margin: 10px 0;
            font-size: 14px;
          }
          
          .planner-form {
            margin: 20px 0;
          }
          
          .planner-form label {
            display: block;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .planner-form textarea {
            width: 100%;
            min-height: 100px;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            resize: vertical;
          }
          
          .button-group {
            display: flex;
            gap: 10px;
            margin-top: 10px;
          }
          
          .planner-form button {
            padding: 10px 20px;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            flex: 1;
          }
          
          #informal-button {
            background: #4CAF50;
          }
          
          #formal-button {
            background: #2196F3;
          }
          
          .cancel-btn {
            background: #f44336 !important;
            flex: 0 0 auto !important;
            min-width: 140px;
          }
          
          .cancel-btn:hover:not(:disabled) {
            background: #d32f2f !important;
          }
          
          .planner-form button:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          
          .progress-container {
            margin: 20px 0;
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 4px;
            overflow: hidden;
          }
          
          .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: #bbdefb;
            border-bottom: 1px solid #90caf9;
          }
          
          .progress-title {
            color: #1565c0;
            font-weight: 600;
            font-size: 14px;
          }
          
          .collapse-btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .collapse-btn:hover {
            background: #1565c0;
          }
          
          .progress-messages {
            max-height: 300px;
            overflow-y: auto;
            transition: max-height 0.3s ease;
          }
          
          .progress-messages.collapsed {
            max-height: 200px;
          }
          
          .hidden-messages-indicator {
            padding: 8px 15px;
            background: #f5f5f5;
            border-bottom: 1px solid #e0e0e0;
            color: #666;
            font-size: 12px;
            font-style: italic;
          }
          
          .progress-message {
            display: flex;
            align-items: center;
            padding: 8px 15px;
            border-bottom: 1px solid #e3f2fd;
            transition: background-color 0.2s;
          }
          
          .progress-message:hover {
            background: #f3f8ff;
          }
          
          .progress-message:last-child {
            border-bottom: none;
          }
          
          .message-icon {
            margin-right: 8px;
            font-size: 14px;
            min-width: 20px;
          }
          
          .message-text {
            flex: 1;
            color: #1565c0;
            font-size: 13px;
            line-height: 1.4;
          }
          
          .message-time {
            color: #666;
            font-size: 11px;
            margin-left: 8px;
            white-space: nowrap;
          }
          
          .progress-message[data-type="complete"] {
            background: #e8f5e8;
          }
          
          .progress-message[data-type="start"] {
            background: #fff3e0;
          }
          
          .error {
            margin: 20px 0;
            padding: 15px;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            color: #c00;
          }
          
          .result {
            margin: 20px 0;
            padding: 15px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          
          .result h2 {
            margin-top: 0;
          }
          
          .result pre {
            overflow-x: auto;
            background: white;
            padding: 10px;
            border-radius: 4px;
          }
          
          .informal-result {
            border-left: 4px solid #4CAF50;
          }
          
          .formal-result {
            border-left: 4px solid #2196F3;
          }
          
          .phase-summary {
            margin: 10px 0;
            padding: 10px;
            background: #f9f9f9;
            border-radius: 4px;
            font-size: 14px;
          }
          
          .statistics ul {
            margin: 0;
            padding-left: 20px;
          }
          
          .hierarchy-preview pre {
            max-height: 300px;
            overflow-y: auto;
          }
          
          .failure-reason {
            color: #c00;
          }
          
          /* LLM Debug Styles */
          .llm-debug-container {
            padding: 20px;
          }
          
          .llm-debug-placeholder {
            text-align: center;
            padding: 40px;
            color: #666;
          }
          
          .interactions-list {
            margin-top: 20px;
          }
          
          .interaction-item {
            border: 1px solid #ddd;
            margin: 10px 0;
            border-radius: 5px;
            background: #f9f9f9;
          }
          
          .interaction-header {
            padding: 12px;
            cursor: pointer;
            background: #f0f0f0;
            border-bottom: 1px solid #ddd;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .interaction-header:hover {
            background: #e8e8e8;
          }
          
          .expand-icon {
            font-size: 14px;
            width: 20px;
          }
          
          .interaction-info {
            display: flex;
            align-items: center;
            gap: 15px;
            flex: 1;
          }
          
          .model-info {
            font-family: monospace;
            background: #e3f2fd;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
          }
          
          .timestamp {
            color: #666;
            font-size: 12px;
          }
          
          .status {
            font-size: 12px;
            font-weight: bold;
          }
          
          .interaction-details {
            padding: 15px;
            background: white;
          }
          
          .prompt-section, .response-section, .error-section {
            margin: 15px 0;
          }
          
          .prompt-section h4, .response-section h4, .error-section h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
          }
          
          .prompt-content, .response-content, .error-content {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 12px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
            max-height: 400px;
            overflow-y: auto;
            line-height: 1.4;
          }
          
          .error-content {
            background: #ffeaea;
            border-color: #ffcdd2;
          }
          
          .interaction-metadata {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 20px;
          }
          
          .metadata-item {
            font-size: 12px;
            color: #666;
          }
        `;
        document.head.appendChild(style);
      }
      
      // Add global function for interaction toggling
      if (!window.toggleInteraction) {
        window.toggleInteraction = (interactionId) => {
          const interactions = [...this.state.llmInteractions];
          const interaction = interactions.find(i => i.id === interactionId);
          if (interaction) {
            interaction.collapsed = !interaction.collapsed;
            this.updateState({ llmInteractions: interactions });
          }
        };
      }
      
      // Set up event handlers
      const goalInput = document.getElementById('goal-input');
      const informalButton = document.getElementById('informal-button');
      const formalButton = document.getElementById('formal-button');
      const cancelButton = document.getElementById('cancel-button');
      const progressCollapseBtn = document.getElementById('progress-collapse-btn');
      
      if (goalInput) {
        goalInput.addEventListener('input', (e) => {
          this.state.goal = e.target.value;
        });
      }
      
      if (informalButton) {
        informalButton.addEventListener('click', () => {
          this.submitInformalPlan(this.state.goal);
        });
      }
      
      if (formalButton) {
        formalButton.addEventListener('click', () => {
          this.submitFormalPlan();
        });
      }
      
      // Discover tools button
      const discoverToolsButton = document.getElementById('discover-tools-btn');
      if (discoverToolsButton) {
        discoverToolsButton.addEventListener('click', () => {
          this.submitToolsDiscovery();
        });
      }
      
      // Tab navigation buttons
      const planningTabBtn = document.getElementById('planning-tab-btn');
      const toolsTabBtn = document.getElementById('tools-tab-btn');
      const llmTabBtn = document.getElementById('llm-tab-btn');
      
      if (planningTabBtn) {
        planningTabBtn.addEventListener('click', () => {
          this.switchTab('planning');
        });
      }
      
      if (toolsTabBtn) {
        toolsTabBtn.addEventListener('click', () => {
          this.switchTab('tools');
        });
      }
      
      if (llmTabBtn) {
        llmTabBtn.addEventListener('click', () => {
          this.switchTab('llm');
        });
      }
      
      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          this.cancelPlanning();
        });
      }
      
      if (progressCollapseBtn) {
        progressCollapseBtn.addEventListener('click', () => {
          this.toggleProgressCollapse();
        });
      }
      
      // Tool metadata expansion handlers
      document.addEventListener('click', (e) => {
        const toolHeader = e.target.closest('.tool-header.clickable');
        if (toolHeader && toolHeader.dataset.toolKey) {
          const toolKey = toolHeader.dataset.toolKey;
          const expandedTools = new Set(this.state.expandedToolsMetadata);
          
          if (expandedTools.has(toolKey)) {
            expandedTools.delete(toolKey);
          } else {
            expandedTools.add(toolKey);
          }
          
          this.updateState({ expandedToolsMetadata: expandedTools });
        }
      });
    };
    
    // Initial render
    this.render();
  }
  
  // Execution methods
  loadExecutionTree(tree) {
    if (!this.executionComponent) return;
    
    // Send tree to server
    if (this.remoteActor) {
      this.remoteActor.receive('load-execution-tree', { tree });
    }
    
    // Update component
    this.executionComponent.setTree(tree);
    this.state.executionTree = tree;
  }
  
  handleExecutionStep() {
    if (!this.remoteActor) return;
    this.remoteActor.receive('execution-step', {});
  }
  
  handleExecutionRun() {
    if (!this.remoteActor) return;
    this.remoteActor.receive('execution-run', {});
  }
  
  handleExecutionPause() {
    if (!this.remoteActor) return;
    this.remoteActor.receive('execution-pause', {});
  }
  
  handleExecutionReset() {
    if (!this.remoteActor) return;
    this.remoteActor.receive('execution-reset', {});
  }
  
  handleBreakpoint(nodeId, enabled) {
    if (!this.remoteActor) return;
    const messageType = enabled ? 'execution-set-breakpoint' : 'execution-remove-breakpoint';
    this.remoteActor.receive(messageType, { nodeId });
  }
  
  handleExecutionEvent(data) {
    if (!this.executionComponent) return;
    
    switch (data.type) {
      case 'node:step':
      case 'node:complete':
      case 'node:error':
      case 'tree:complete':
      case 'execution:paused':
      case 'execution:resumed':
        // Update execution state
        if (data.state) {
          this.executionComponent.updateExecutionState(data.state);
          this.state.executionState = data.state;
        }
        break;
        
      case 'breakpoint:hit':
        console.log('Breakpoint hit at node:', data.data.nodeId);
        if (data.state) {
          this.executionComponent.updateExecutionState(data.state);
        }
        break;
    }
  }
  
  // Plan Save/Load functionality
  refreshSavedPlans() {
    if (!this.remoteActor) return;
    this.remoteActor.receive('list-saved-plans', {});
  }
  
  handleLoadPlan() {
    const select = document.getElementById('load-plan-select');
    if (!select || !select.value || !this.remoteActor) return;
    
    this.remoteActor.receive('load-plan', { filename: select.value });
  }
  
  handleSavePlan() {
    if (!this.state.formalResult) {
      console.error('No formal result to save');
      return;
    }
    
    const name = prompt('Enter a name for this plan:');
    if (!name || !name.trim() || !this.remoteActor) {
      return;
    }
    
    this.remoteActor.receive('save-plan', {
      name: name.trim(),
      informalResult: this.state.informalResult,
      formalResult: this.state.formalResult
    });
  }
  
  // Server response handlers
  handlePlanSaveComplete(data) {
    console.log(`✅ ${data.message}`);
    // Refresh the plans list
    this.refreshSavedPlans();
  }
  
  handlePlanSaveError(data) {
    console.error('Failed to save plan:', data.error);
    this.updateState({ error: `Failed to save plan: ${data.error}` });
  }
  
  handlePlanLoadComplete(data) {
    const planData = data.planData;
    
    // Load the plan data into current state
    this.updateState({
      goal: planData.informalResult?.informal?.goal || '',
      informalResult: planData.informalResult,
      formalResult: planData.formalResult,
      toolsResult: planData.informalResult // Tool results are part of informal result
    });
    
    // Enable appropriate tabs
    if (this.tabsComponent) {
      if (planData.informalResult) {
        this.tabsComponent.enableTab('tools', true);
      }
      if (planData.formalResult) {
        this.tabsComponent.enableTab('formal', true);
        this.tabsComponent.enableTab('execution', true);
      }
    }
    
    // Update formal planning component with loaded result
    if (planData.formalResult && this.formalPlanningComponent) {
      this.formalPlanningComponent.setResult(planData.formalResult);
    }
    
    // Update UI components
    this.renderPlanningContent();
    this.renderPlansContent();
    
    // Load tree into execution if available
    if (planData.formalResult?.formal?.behaviorTrees?.[0] && this.executionComponent) {
      this.loadExecutionTree(planData.formalResult.formal.behaviorTrees[0]);
    }
    
    console.log(`✅ ${data.message}`);
  }
  
  handlePlanLoadError(data) {
    console.error('Failed to load plan:', data.error);
    this.updateState({ error: `Failed to load plan: ${data.error}` });
  }
  
  handlePlanListComplete(data) {
    const select = document.getElementById('load-plan-select');
    if (select) {
      // Keep the first default option
      select.innerHTML = '<option value="">Choose a saved plan...</option>';
      
      data.plans.forEach(plan => {
        const option = document.createElement('option');
        option.value = plan.filename;
        option.textContent = `${plan.name} (${new Date(plan.savedAt).toLocaleDateString()})`;
        select.appendChild(option);
      });
    }
  }
  
  handlePlanListError(data) {
    console.error('Failed to list saved plans:', data.error);
  }

  handleLLMInteraction(data) {
    console.log('🧠 LLM Interaction:', data.type, data.id);
    
    const interactions = [...this.state.llmInteractions];
    
    // Handle complete interactions with both prompt and response
    if (data.prompt && data.response) {
      interactions.push({
        id: data.id,
        timestamp: data.timestamp,
        prompt: data.prompt,
        response: data.response,
        model: data.model,
        provider: data.provider,
        requestTimestamp: data.requestTimestamp || data.timestamp,
        responseTimestamp: data.responseTimestamp || data.timestamp,
        collapsed: true
      });
    }
    
    this.updateState({ llmInteractions: interactions });
    
    // Always re-render LLM debug content when interactions are updated
    this.renderLLMDebugContent();
  }
}