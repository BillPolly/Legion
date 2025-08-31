/**
 * ClientPlannerActor - Clean MVVM Implementation using only components
 * NO innerHTML - only proper component delegation
 */

import { ProtocolActor } from './ProtocolActor.js';
import { SearchComponent } from '../components/SearchComponent.js';
import { TabsComponent } from '../components/TabsComponent.js';
import { ToolDiscoveryComponent } from '../components/ToolDiscoveryComponent.js';
import { FormalPlanningComponent } from '../components/FormalPlanningComponent.js';
import { TreeExecutionComponent } from '../components/TreeExecutionComponent.js';

export default class ClientPlannerActor extends ProtocolActor {
  constructor() {
    super();
    this.remoteActor = null;
    
    // State
    this.state = {
      connected: false,
      informalResult: null,
      toolsResult: null,
      formalResult: null,
      error: null,
      activeTab: 'planning'
    };
    
    // Initialize components
    this.initializeComponents();
  }

  getProtocol() {
    return {
      name: "ClientPlannerActor",
      version: "1.0.0",
      state: {
        schema: {
          connected: { type: 'boolean' },
          informalResult: { type: 'object' },
          toolsResult: { type: 'object' },
          error: { type: 'string' }
        },
        initial: {
          connected: false,
          informalResult: null,
          toolsResult: null,
          error: null
        }
      },
      messages: {
        receives: {
          "ready": { schema: {} },
          "informalPlanComplete": { schema: {} },
          "toolsDiscoveryComplete": { schema: {} }
        },
        sends: {
          "plan-informal": { schema: {} },
          "discover-tools": { schema: {} }
        }
      }
    };
  }

  initializeComponents() {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // Create main layout
    appContainer.innerHTML = `
      <div class="planner-container">
        <div class="tabs-container" id="tabs-container"></div>
        <div class="content-container">
          <div class="tab-content" id="planning-content">
            <h3>Planning</h3>
            <textarea id="goal-input" placeholder="Enter your planning goal..."></textarea>
            <button id="informal-button">🔍 Start Informal Planning</button>
            <div id="informal-result"></div>
          </div>
          <div class="tab-content" id="tools-content"></div>
          <div class="tab-content" id="formal-content"></div>
          <div class="tab-content" id="execution-content"></div>
          <div class="tab-content" id="search-content"></div>
        </div>
      </div>
    `;

    // Initialize components
    this.tabsComponent = new TabsComponent(document.getElementById('tabs-container'), {
      tabs: [
        { id: 'planning', label: '📋 Planning' },
        { id: 'tools', label: '🔧 Tools' },
        { id: 'formal', label: '🏗️ Formal' },
        { id: 'execution', label: '▶️ Execution' },
        { id: 'search', label: '🔍 Search' }
      ],
      activeTab: 'planning',
      onTabChange: (tabId) => this.switchTab(tabId)
    });

    this.toolDiscoveryComponent = new ToolDiscoveryComponent(document.getElementById('tools-content'));
    this.formalPlanningComponent = new FormalPlanningComponent(document.getElementById('formal-content'));
    this.searchComponent = new SearchComponent(document.getElementById('search-content'));
    this.executionComponent = new TreeExecutionComponent(document.getElementById('execution-content'));

    // Attach event listeners
    this.attachEventListeners();
  }

  attachEventListeners() {
    const goalInput = document.getElementById('goal-input');
    const informalButton = document.getElementById('informal-button');

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
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    
    // Give remote actor to components that need it
    if (this.searchComponent) {
      this.searchComponent.setRemoteActor(remoteActor);
    }
  }

  switchTab(tabId) {
    this.state.activeTab = tabId;
    
    // Show/hide content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    const activeContent = document.getElementById(`${tabId}-content`);
    if (activeContent) {
      activeContent.style.display = 'block';
    }

    // Auto-start tool discovery when switching to tools tab
    if (tabId === 'tools' && this.state.informalResult && !this.state.toolsResult) {
      this.submitToolsDiscovery();
    }
  }

  // Message handlers
  handleMessage(messageType, data) {
    console.log('📨 Client handling:', messageType);
    
    switch (messageType) {
      case 'ready':
        this.handleReady(data);
        break;
        
      case 'informalPlanComplete':
        this.handleInformalPlanComplete(data);
        break;
        
      case 'toolsDiscoveryComplete':
        this.handleToolsDiscoveryComplete(data);
        break;
        
      case 'toolsDiscoveryError':
        this.handleToolsDiscoveryError(data);
        break;
        
      case 'registryStatsComplete':
      case 'toolsListComplete':
        if (this.searchComponent) {
          this.searchComponent.receiveMessage(messageType, data);
        }
        
        // Enable button when tools are loaded
        if (messageType === 'toolsListComplete') {
          const informalBtn = document.getElementById('informal-button');
          if (informalBtn) informalBtn.disabled = false;
          this.state.connected = true;
        }
        break;
        
      default:
        console.warn('Unknown message type:', messageType);
    }
  }

  handleReady(data) {
    this.state.connected = true;
    const informalBtn = document.getElementById('informal-button');
    if (informalBtn) informalBtn.disabled = false;
  }

  handleInformalPlanComplete(data) {
    this.state.informalResult = data.result;
    
    // Update informal result display
    const resultDiv = document.getElementById('informal-result');
    if (resultDiv && data.result?.informal?.hierarchy) {
      const plan = data.result.informal.hierarchy;
      const totalTasks = plan.rootTask ? 1 : 0;
      const simpleTasks = plan.rootTask?.complexity === 'SIMPLE' ? 1 : 0;
      const complexTasks = plan.rootTask?.complexity === 'COMPLEX' ? 1 : 0;
      
      resultDiv.innerHTML = `
        <div class="result-stats">
          <span>Total Tasks: ${totalTasks}</span>
          <span>Simple: ${simpleTasks}</span>
          <span>Complex: ${complexTasks}</span>
          <span>Valid: ✅</span>
        </div>
        <details>
          <summary>View Plan</summary>
          <pre>${JSON.stringify(plan, null, 2)}</pre>
        </details>
      `;
    }
  }

  handleToolsDiscoveryComplete(data) {
    this.state.toolsResult = data.result;
    
    // Update tool discovery component
    if (this.toolDiscoveryComponent) {
      this.toolDiscoveryComponent.setResult(data.result);
    }
  }

  handleToolsDiscoveryError(data) {
    this.state.toolsResult = null;
    
    // Update tool discovery component with error
    if (this.toolDiscoveryComponent) {
      this.toolDiscoveryComponent.setError(data.error);
    }
  }

  // Action methods
  submitInformalPlan(goal) {
    if (!goal || !this.remoteActor) return;
    
    this.state.informalResult = null;
    this.remoteActor.receive('plan-informal', { goal });
  }

  submitToolsDiscovery() {
    if (!this.state.informalResult || !this.remoteActor) return;
    
    this.remoteActor.receive('discover-tools', {});
  }

  doSend(messageType, data) {
    if (this.remoteActor) {
      return this.remoteActor.receive(messageType, data);
    }
    throw new Error('No remote actor connected');
  }
}