/**
 * ClientPlannerProtocolActor - Protocol-enhanced version of ClientPlannerActor
 * Demonstrates the Protocol Actor system with full message validation
 */

import { ProtocolActor } from './ProtocolActor.js';
import { SearchComponent } from '/src/components/SearchComponent.js';
import { TabsComponent } from '/src/components/TabsComponent.js';
import { ToolDiscoveryComponent } from '/src/components/ToolDiscoveryComponent.js';
import { FormalPlanningComponent } from '/src/components/FormalPlanningComponent.js';
import { TreeExecutionComponent } from '/src/components/TreeExecutionComponent.js';

export class ClientPlannerProtocolActor extends ProtocolActor {
  constructor(container, options = {}) {
    super();
    
    this.container = container;
    this.remoteActor = options.remoteActor || null;
    
    // Component instances
    this.tabsComponent = null;
    this.toolDiscoveryComponent = null;
    this.formalPlanningComponent = null;
    this.searchComponent = null;
    this.executionComponent = null;
    
    // UI state (separate from protocol state)
    this.ui = {
      expandedToolsMetadata: new Set(),
      llmInteractions: [],
      progressMessages: [],
      progressCollapsed: false,
      maxVisibleMessages: 8
    };
  }
  
  getProtocol() {
    return {
      name: "ClientPlannerActor",
      version: "1.0.0",
      
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          informalPlanning: { type: 'boolean', required: true },
          formalPlanning: { type: 'boolean', required: true },
          toolsDiscovering: { type: 'boolean', required: true },
          cancelling: { type: 'boolean', required: true },
          goal: { type: 'string', required: true },
          informalResult: { type: 'object' },
          formalResult: { type: 'object' },
          toolsResult: { type: 'object' },
          error: { type: 'string' },
          activeTab: { type: 'string', required: true },
          executionTree: { type: 'object' },
          executionState: { type: 'object' },
          executionMode: { type: 'string', required: true }
        },
        initial: {
          connected: false,
          informalPlanning: false,
          formalPlanning: false,
          toolsDiscovering: false,
          cancelling: false,
          goal: '',
          informalResult: null,
          formalResult: null,
          toolsResult: null,
          error: null,
          activeTab: 'planning',
          executionTree: null,
          executionState: null,
          executionMode: 'step'
        }
      },
      
      messages: {
        receives: {
          // Connection messages
          "ready": {
            schema: {
              timestamp: { type: 'string', required: true }
            },
            preconditions: ["state.connected === false"],
            postconditions: ["state.connected === true"],
            sideEffects: ["ui.enableButton('plan-button')"]
          },
          
          // Informal planning messages
          "informalPlanStarted": {
            schema: {
              goal: { type: 'string', required: true }
            },
            preconditions: ["state.informalPlanning === false"],
            postconditions: ["state.informalPlanning === true"],
            sideEffects: ["ui.showLoading('informal-planning')"]
          },
          
          "informalPlanProgress": {
            schema: {
              message: { type: 'string', required: true },
              percentage: { type: 'number', minimum: 0, maximum: 100 }
            },
            preconditions: ["state.informalPlanning === true"],
            sideEffects: ["ui.updateProgress(data.message, data.percentage)"]
          },
          
          "informalPlanComplete": {
            schema: {
              result: { type: 'object', required: true },
              goal: { type: 'string', required: true }
            },
            preconditions: ["state.informalPlanning === true"],
            postconditions: [
              "state.informalPlanning === false",
              "state.informalResult !== null"
            ],
            sideEffects: [
              "ui.enableTab('tools')",
              "ui.updateComponent('planning', data.result)"
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
            ],
            sideEffects: ["ui.showError(data.error)"]
          },
          
          // Tool discovery messages
          "toolsDiscoveryStarted": {
            schema: {},
            preconditions: ["state.toolsDiscovering === false", "state.informalResult !== null"],
            postconditions: ["state.toolsDiscovering === true"],
            sideEffects: ["ui.showLoading('tools-discovery')"]
          },
          
          "toolsDiscoveryProgress": {
            schema: {
              message: { type: 'string', required: true }
            },
            preconditions: ["state.toolsDiscovering === true"],
            sideEffects: ["ui.updateProgress(data.message)"]
          },
          
          "toolsDiscoveryComplete": {
            schema: {
              tools: { type: 'array', required: true },
              mappings: { type: 'object' }
            },
            preconditions: ["state.toolsDiscovering === true"],
            postconditions: [
              "state.toolsDiscovering === false",
              "state.toolsResult !== null"
            ],
            sideEffects: [
              "ui.enableTab('formal')",
              "ui.updateComponent('tools', data)"
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
            ],
            sideEffects: ["ui.showError(data.error)"]
          },
          
          // Formal planning messages
          "formalPlanStarted": {
            schema: {},
            preconditions: ["state.formalPlanning === false", "state.toolsResult !== null"],
            postconditions: ["state.formalPlanning === true"],
            sideEffects: ["ui.showLoading('formal-planning')"]
          },
          
          "formalPlanProgress": {
            schema: {
              message: { type: 'string', required: true }
            },
            preconditions: ["state.formalPlanning === true"],
            sideEffects: ["ui.updateProgress(data.message)"]
          },
          
          "formalPlanComplete": {
            schema: {
              behaviorTrees: { type: 'array', required: true },
              validation: { type: 'object', required: true }
            },
            preconditions: ["state.formalPlanning === true"],
            postconditions: [
              "state.formalPlanning === false",
              "state.formalResult !== null"
            ],
            sideEffects: [
              "ui.enableTab('execution')",
              "ui.updateComponent('formal', data)"
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
            ],
            sideEffects: ["ui.showError(data.error)"]
          },
          
          // Execution messages
          "step-response": {
            schema: {
              data: {
                type: 'object',
                properties: {
                  state: { type: 'object', required: true }
                }
              }
            },
            preconditions: ["state.executionTree !== null"],
            postconditions: ["state.executionState !== null"],
            sideEffects: ["ui.updateExecutionState(data.data.state)"]
          },
          
          // LLM interaction tracking
          "llm-interaction": {
            schema: {
              type: { type: 'string', required: true },
              data: { type: 'object', required: true }
            },
            sideEffects: ["ui.addLLMInteraction(data)"]
          },
          
          // Plan management
          "planSaveComplete": {
            schema: {
              planId: { type: 'string', required: true }
            },
            sideEffects: ["ui.showSuccess('Plan saved successfully')"]
          },
          
          "planLoadComplete": {
            schema: {
              plan: { type: 'object', required: true }
            },
            postconditions: [
              "state.informalResult !== null || state.formalResult !== null"
            ],
            sideEffects: ["ui.loadPlanData(data.plan)"]
          },
          
          // Search results
          "toolsSearchTextComplete": {
            schema: {
              results: { type: 'array', required: true }
            },
            sideEffects: ["ui.updateSearchResults(data.results)"]
          },
          
          "toolsSearchSemanticComplete": {
            schema: {
              results: { type: 'array', required: true }
            },
            sideEffects: ["ui.updateSearchResults(data.results)"]
          }
        },
        
        sends: {
          // Planning commands
          "plan-informal": {
            schema: {
              goal: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ["state.connected === true", "state.informalPlanning === false"],
            triggers: ["informalPlanStarted", "informalPlanProgress", "informalPlanComplete", "informalPlanError"]
          },
          
          "discover-tools": {
            schema: {},
            preconditions: [
              "state.connected === true", 
              "state.informalResult !== null",
              "state.toolsDiscovering === false"
            ],
            triggers: ["toolsDiscoveryStarted", "toolsDiscoveryProgress", "toolsDiscoveryComplete", "toolsDiscoveryError"]
          },
          
          "plan-formal": {
            schema: {},
            preconditions: [
              "state.connected === true",
              "state.toolsResult !== null",
              "state.formalPlanning === false"
            ],
            triggers: ["formalPlanStarted", "formalPlanProgress", "formalPlanComplete", "formalPlanError"]
          },
          
          // Execution commands
          "execution-load-tree": {
            schema: {
              tree: { type: 'object', required: true }
            },
            preconditions: ["state.connected === true", "state.formalResult !== null"],
            triggers: ["load-tree-response"]
          },
          
          "execution-step": {
            schema: {
              nodeId: { type: 'string' }
            },
            preconditions: ["state.connected === true", "state.executionTree !== null"],
            triggers: ["step-response"]
          },
          
          // Search commands
          "search-tools-text": {
            schema: {
              query: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ["state.connected === true"],
            triggers: ["toolsSearchTextComplete", "toolsSearchTextError"]
          },
          
          "search-tools-semantic": {
            schema: {
              query: { type: 'string', minLength: 1, required: true },
              limit: { type: 'number', minimum: 1, maximum: 100 }
            },
            preconditions: ["state.connected === true"],
            triggers: ["toolsSearchSemanticComplete", "toolsSearchSemanticError"]
          }
        }
      }
    };
  }
  
  handleMessage(messageType, data) {
    switch (messageType) {
      case 'ready':
        this.state.connected = true;
        this.updateUI();
        break;
        
      case 'informalPlanStarted':
        this.state.informalPlanning = true;
        this.state.goal = data.goal;
        this.showPlanningProgress();
        break;
        
      case 'informalPlanProgress':
        this.updateProgress(data.message, data.percentage);
        break;
        
      case 'informalPlanComplete':
        this.state.informalPlanning = false;
        this.state.informalResult = data.result;
        this.enableToolsTab();
        this.updatePlanningDisplay(data.result);
        break;
        
      case 'informalPlanError':
        this.state.informalPlanning = false;
        this.state.error = data.error;
        this.showError(data.error);
        break;
        
      case 'toolsDiscoveryStarted':
        this.state.toolsDiscovering = true;
        this.showToolDiscoveryProgress();
        break;
        
      case 'toolsDiscoveryProgress':
        this.updateProgress(data.message);
        break;
        
      case 'toolsDiscoveryComplete':
        this.state.toolsDiscovering = false;
        this.state.toolsResult = { tools: data.tools, mappings: data.mappings };
        this.enableFormalTab();
        this.updateToolsDisplay(data);
        break;
        
      case 'toolsDiscoveryError':
        this.state.toolsDiscovering = false;
        this.state.error = data.error;
        this.showError(data.error);
        break;
        
      case 'formalPlanStarted':
        this.state.formalPlanning = true;
        this.showFormalPlanningProgress();
        break;
        
      case 'formalPlanProgress':
        this.updateProgress(data.message);
        break;
        
      case 'formalPlanComplete':
        this.state.formalPlanning = false;
        this.state.formalResult = data;
        this.enableExecutionTab();
        this.updateFormalDisplay(data);
        break;
        
      case 'formalPlanError':
        this.state.formalPlanning = false;
        this.state.error = data.error;
        this.showError(data.error);
        break;
        
      case 'step-response':
        if (data.data?.state) {
          this.state.executionState = data.data.state;
          this.updateExecutionState(data.data.state);
        }
        break;
        
      case 'llm-interaction':
        this.ui.llmInteractions.push(data);
        this.updateLLMDisplay();
        break;
        
      default:
        console.warn(`Unhandled message type: ${messageType}`);
    }
  }
  
  doSend(messageType, data) {
    if (this.remoteActor) {
      return this.remoteActor.receive(messageType, data);
    }
    throw new Error('No remote actor connected');
  }
  
  // UI Methods (would be implemented to update the actual UI)
  updateUI() {
    console.log('UI updated - connected:', this.state.connected);
  }
  
  showPlanningProgress() {
    console.log('Showing planning progress');
  }
  
  updateProgress(message, percentage) {
    this.ui.progressMessages.push({ message, percentage, timestamp: Date.now() });
    console.log('Progress:', message, percentage ? `${percentage}%` : '');
  }
  
  enableToolsTab() {
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('tools', true);
    }
  }
  
  enableFormalTab() {
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('formal', true);
    }
  }
  
  enableExecutionTab() {
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('execution', true);
    }
  }
  
  updatePlanningDisplay(result) {
    console.log('Planning display updated:', result);
  }
  
  updateToolsDisplay(data) {
    console.log('Tools display updated:', data);
  }
  
  updateFormalDisplay(data) {
    console.log('Formal display updated:', data);
  }
  
  updateExecutionState(state) {
    console.log('Execution state updated:', state);
  }
  
  updateLLMDisplay() {
    console.log('LLM interactions updated, count:', this.ui.llmInteractions.length);
  }
  
  showError(error) {
    console.error('Actor error:', error);
  }
  
  showToolDiscoveryProgress() {
    console.log('Showing tool discovery progress');
  }
  
  showFormalPlanningProgress() {
    console.log('Showing formal planning progress');
  }
  
  // Public methods for triggering actions
  async startInformalPlanning(goal) {
    return this.send('plan-informal', { goal });
  }
  
  async startToolDiscovery() {
    return this.send('discover-tools', {});
  }
  
  async startFormalPlanning() {
    return this.send('plan-formal', {});
  }
  
  async searchTools(query, type = 'text', limit = 50) {
    const messageType = type === 'semantic' ? 'search-tools-semantic' : 'search-tools-text';
    const data = { query };
    if (type === 'semantic') {
      data.limit = limit;
    }
    return this.send(messageType, data);
  }
}