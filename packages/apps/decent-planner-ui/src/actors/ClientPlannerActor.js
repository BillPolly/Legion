/**
 * Client Planner Actor - MVVM-based UI with proper components
 * Components are properly imported from separate files
 */

import { SearchComponent } from '/src/components/SearchComponent.js';
import { TabsComponent } from '/src/components/TabsComponent.js';
import { ToolDiscoveryComponent } from '/src/components/ToolDiscoveryComponent.js';
import { FormalPlanningComponent } from '/src/components/FormalPlanningComponent.js';
import { TreeExecutionComponent } from '/src/components/TreeExecutionComponent.js';

// All components are now properly imported from separate files

/* OLD INLINE COMPONENTS REMOVED
class TabsComponent_OLD {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      tabs: options.tabs || [],
      activeTab: options.activeTab || (options.tabs?.[0]?.id || null),
      onTabChange: options.onTabChange || (() => {})
    };
    
    // View elements
    this.elements = {};
    
    this.render();
    this.attachEventListeners();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="tabs-container">
        <div class="tabs-nav">
          ${this.model.tabs.map(tab => `
            <button 
              class="tab-btn ${this.model.activeTab === tab.id ? 'active' : ''}"
              data-tab-id="${tab.id}"
              ${tab.disabled ? 'disabled' : ''}
            >
              ${tab.icon || ''} ${tab.label}
            </button>
          `).join('')}
        </div>
        <div class="tabs-content">
          ${this.model.tabs.map(tab => `
            <div 
              class="tab-panel ${this.model.activeTab === tab.id ? 'active' : 'hidden'}"
              data-panel-id="${tab.id}"
            >
              <div id="${tab.id}-content"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Store element references
    this.elements.buttons = this.container.querySelectorAll('.tab-btn');
    this.elements.panels = this.container.querySelectorAll('.tab-panel');
  }
  
  attachEventListeners() {
    this.elements.buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tabId;
        if (tabId && !e.target.disabled) {
          this.switchTab(tabId);
        }
      });
    });
  }
  
  switchTab(tabId) {
    if (this.model.activeTab === tabId) return;
    
    this.model.activeTab = tabId;
    
    // Update UI
    this.elements.buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabId === tabId);
    });
    
    this.elements.panels.forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panelId === tabId);
      panel.classList.toggle('hidden', panel.dataset.panelId !== tabId);
    });
    
    // Callback
    this.model.onTabChange(tabId);
  }
  
  getContentContainer(tabId) {
    return this.container.querySelector(`#${tabId}-content`);
  }
  
  enableTab(tabId, enabled = true) {
    const button = Array.from(this.elements.buttons).find(
      btn => btn.dataset.tabId === tabId
    );
    if (button) {
      button.disabled = !enabled;
    }
  }
  
  updateTabLabel(tabId, label) {
    const button = Array.from(this.elements.buttons).find(
      btn => btn.dataset.tabId === tabId
    );
    if (button) {
      const tab = this.model.tabs.find(t => t.id === tabId);
      if (tab) {
        button.innerHTML = `${tab.icon || ''} ${label}`;
      }
    }
  }
}

// OLD ToolDiscoveryComponent
class ToolDiscoveryComponent_OLD {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      discoveryResult: null,
      isDiscovering: false,
      error: null,
      expandedTasks: new Set()
    };
    
    // View
    this.elements = {};
    
    this.render();
  }
  
  setDiscovering(isDiscovering) {
    this.model.isDiscovering = isDiscovering;
    this.render();
  }
  
  setResult(result) {
    this.model.discoveryResult = result;
    this.model.isDiscovering = false;
    this.model.error = null;
    this.render();
  }
  
  setError(error) {
    this.model.error = error;
    this.model.isDiscovering = false;
    this.render();
  }
  
  render() {
    if (this.model.isDiscovering) {
      this.renderDiscovering();
    } else if (this.model.error) {
      this.renderError();
    } else if (this.model.discoveryResult) {
      this.renderResults();
    } else {
      this.renderEmpty();
    }
  }
  
  renderEmpty() {
    this.container.innerHTML = `
      <div class="tool-discovery-empty">
        <p>Tool discovery will start automatically when you switch to this tab.</p>
      </div>
    `;
  }
  
  renderDiscovering() {
    this.container.innerHTML = `
      <div class="tool-discovery-progress">
        <h3>🔍 Discovering Tools...</h3>
        <div class="spinner"></div>
        <p>Analyzing tasks and searching for appropriate tools...</p>
      </div>
    `;
  }
  
  renderError() {
    this.container.innerHTML = `
      <div class="tool-discovery-error">
        <h3>❌ Error</h3>
        <p>${this.model.error}</p>
      </div>
    `;
  }
  
  renderResults() {
    const result = this.model.discoveryResult;
    if (!result) return;
    
    const stats = result.statistics || {};
    const toolDiscovery = result.toolDiscovery || [];
    
    this.container.innerHTML = `
      <div class="tool-discovery-results">
        <div class="tool-discovery-header">
          <h3>🔧 Tool Discovery Results</h3>
          <div class="tool-discovery-stats">
            <span class="stat">📊 ${stats.totalSimpleTasks || 0} SIMPLE tasks</span>
            <span class="stat">✅ ${stats.feasibleTasks || 0} feasible</span>
            <span class="stat">❌ ${stats.infeasibleTasks || 0} infeasible</span>
            <span class="stat">🔧 ${stats.uniqueToolsCount || 0} tools found</span>
            <span class="stat">⏱️ ${result.processingTime || 0}ms</span>
          </div>
        </div>
        
        <div class="tool-discovery-tasks">
          <h4>📋 Task Analysis Results</h4>
          ${toolDiscovery.map((item, index) => this.renderTaskItem(item, index)).join('')}
        </div>
      </div>
    `;
    
    // Attach event listeners for expand/collapse
    this.attachTaskEventListeners();
  }
  
  renderTaskItem(item, index) {
    const isExpanded = this.model.expandedTasks.has(index);
    const feasible = item.discoveryResult?.feasible;
    
    return `
      <div class="task-item ${feasible ? 'feasible' : 'infeasible'}">
        <div class="task-header" data-task-index="${index}">
          <span class="task-expand-icon">${isExpanded ? '▼' : '▶️'}</span>
          <span class="task-description">${item.taskDescription}</span>
          <span class="task-status">${feasible ? '✅ Feasible' : '❌ Infeasible'}</span>
        </div>
        
        ${isExpanded ? `
          <div class="task-details">
            ${this.renderTaskDebugInfo(item.discoveryResult?.debug)}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  renderTaskDebugInfo(debug) {
    if (!debug) return '<p>No debug information available</p>';
    
    return `
      <div class="debug-info">
        <div class="debug-step">
          <h5>Step 1: Generated Tool Descriptions</h5>
          <ul class="tool-descriptions">
            ${(debug.step1_descriptions || []).map(desc => 
              `<li>${desc}</li>`
            ).join('')}
          </ul>
        </div>
        
        <div class="debug-step">
          <h5>Step 2: Tool Search Results</h5>
          ${(debug.step2_discoveries || []).map(discovery => `
            <div class="search-result">
              <span class="search-desc">"${discovery.description}"</span>
              <span class="search-count">→ ${discovery.toolsFound} tools</span>
            </div>
          `).join('')}
        </div>
        
        <div class="debug-step">
          <h5>Step 3: Final Tools</h5>
          ${debug.step3_merged && debug.step3_merged.length > 0 ? `
            <ul class="final-tools">
              ${debug.step3_merged.map(tool => 
                `<li>${tool.name} (confidence: ${(tool.confidence * 100).toFixed(1)}%)</li>`
              ).join('')}
            </ul>
          ` : '<p>No tools found</p>'}
        </div>
        
        <div class="debug-reason">
          <strong>Reason:</strong> ${debug.final_feasible ? 
            `Found ${debug.step3_merged?.length || 0} suitable tools` : 
            'No suitable tools found through semantic search'}
        </div>
      </div>
    `;
  }
  
  attachTaskEventListeners() {
    const headers = this.container.querySelectorAll('.task-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        const index = parseInt(header.dataset.taskIndex);
        if (this.model.expandedTasks.has(index)) {
          this.model.expandedTasks.delete(index);
        } else {
          this.model.expandedTasks.add(index);
        }
        this.render();
      });
    });
  }
}

// OLD SearchComponent
class SearchComponent_OLD {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      stats: {
        totalTools: 0,
        totalModules: 0
      },
      allTools: [],
      searchResults: [],
      searchQuery: '',
      searchType: 'text', // 'text' or 'semantic'
      isLoading: false,
      error: null,
      expandedTools: new Set(),
      remoteActor: options.remoteActor || null
    };
    
    // View elements
    this.elements = {};
    
    // Bind event handlers
    this.handleSearch = this.handleSearch.bind(this);
    this.handleSearchTypeChange = this.handleSearchTypeChange.bind(this);
    
    this.render();
    this.attachEventListeners();
    
    // Load initial data
    if (this.model.remoteActor) {
      this.loadRegistryStats();
      this.loadAllTools();
    }
  }
  
  setRemoteActor(remoteActor) {
    this.model.remoteActor = remoteActor;
    this.loadRegistryStats();
    this.loadAllTools();
  }
  
  loadRegistryStats() {
    if (!this.model.remoteActor) return;
    
    // Request stats from server
    this.model.remoteActor.receive('get-registry-stats', {});
  }
  
  loadAllTools() {
    if (!this.model.remoteActor) return;
    
    this.model.isLoading = true;
    this.render();
    
    // Request all tools from server
    this.model.remoteActor.receive('list-all-tools', {});
  }
  
  handleRegistryStats(stats) {
    this.model.stats = stats;
    this.render();
  }
  
  handleToolsList(data) {
    this.model.allTools = data.tools || [];
    this.model.searchResults = this.model.allTools; // Initially show all tools
    this.model.isLoading = false;
    this.render();
  }
  
  handleSearchResults(data) {
    this.model.searchResults = data.results || [];
    this.model.isLoading = false;
    this.render();
  }
  
  handleError(error) {
    this.model.error = error;
    this.model.isLoading = false;
    this.render();
  }
  
  handleSearch() {
    const query = this.elements.searchInput.value.trim();
    if (!query) {
      // Show all tools if no query
      this.model.searchResults = this.model.allTools;
      this.render();
      return;
    }
    
    this.model.searchQuery = query;
    this.model.isLoading = true;
    this.model.error = null;
    this.render();
    
    if (this.model.searchType === 'text') {
      // Request text search
      this.model.remoteActor.receive('search-tools-text', { query });
    } else {
      // Request semantic search
      this.model.remoteActor.receive('search-tools-semantic', { query, limit: 50 });
    }
  }
  
  handleSearchTypeChange(event) {
    this.model.searchType = event.target.value;
    // Re-run search if there's a query
    if (this.model.searchQuery) {
      this.handleSearch();
    }
  }
  
  render() {
    this.container.innerHTML = `
      <div class="search-container">
        <div class="search-header">
          <h3>🔍 Tool Search & Discovery</h3>
          <div class="search-stats">
            <span class="stat">📦 ${this.model.stats.totalModules} modules</span>
            <span class="stat">🔧 ${this.model.stats.totalTools} tools</span>
          </div>
        </div>
        
        <div class="search-controls">
          <div class="search-input-group">
            <input 
              type="text" 
              id="search-input"
              class="search-input" 
              placeholder="Search for tools..."
              value="${this.model.searchQuery}"
            />
            <button id="search-button" class="search-button">
              ${this.model.isLoading ? '⏳' : '🔍'} Search
            </button>
          </div>
          
          <div class="search-type-selector">
            <label>
              <input 
                type="radio" 
                name="searchType" 
                value="text" 
                ${this.model.searchType === 'text' ? 'checked' : ''}
              />
              Text Search
            </label>
            <label>
              <input 
                type="radio" 
                name="searchType" 
                value="semantic" 
                ${this.model.searchType === 'semantic' ? 'checked' : ''}
              />
              Semantic Search
            </label>
          </div>
        </div>
        
        ${this.model.error ? `
          <div class="search-error">
            ❌ ${this.model.error}
          </div>
        ` : ''}
        
        ${this.model.isLoading ? `
          <div class="search-loading">
            <div class="spinner"></div>
            <p>Searching tools...</p>
          </div>
        ` : `
          <div class="search-results">
            <div class="results-header">
              <h4>
                ${this.model.searchQuery 
                  ? `Results for "${this.model.searchQuery}" (${this.model.searchResults.length} tools)` 
                  : `All Tools (${this.model.searchResults.length})`}
              </h4>
            </div>
            
            <div class="tools-list">
              ${this.model.searchResults.length === 0 ? `
                <p class="no-results">No tools found</p>
              ` : this.model.searchResults.map((tool, index) => this.renderTool(tool, index)).join('')}
            </div>
          </div>
        `}
      </div>
    `;
    
    // Store element references
    this.elements.searchInput = this.container.querySelector('#search-input');
    this.elements.searchButton = this.container.querySelector('#search-button');
    this.elements.searchTypeRadios = this.container.querySelectorAll('input[name="searchType"]');
  }
  
  renderTool(tool, index) {
    const isExpanded = this.model.expandedTools.has(index);
    const confidence = tool.confidence ? ` (${(tool.confidence * 100).toFixed(1)}% match)` : '';
    
    return `
      <div class="tool-item">
        <div class="tool-header" data-tool-index="${index}">
          <span class="tool-expand-icon">${isExpanded ? '▼' : '▶️'}</span>
          <span class="tool-name">${tool.name}${confidence}</span>
          <span class="tool-module">${tool.moduleName || 'Unknown Module'}</span>
        </div>
        
        ${isExpanded ? `
          <div class="tool-details">
            <p class="tool-description">${tool.description || 'No description available'}</p>
            
            ${tool.inputSchema ? `
              <div class="tool-schema">
                <h5>Input Schema:</h5>
                <pre>${JSON.stringify(tool.inputSchema, null, 2)}</pre>
              </div>
            ` : ''}
            
            ${tool.outputSchema ? `
              <div class="tool-schema">
                <h5>Output Schema:</h5>
                <pre>${JSON.stringify(tool.outputSchema, null, 2)}</pre>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  attachEventListeners() {
    // Search button
    if (this.elements.searchButton) {
      this.elements.searchButton.addEventListener('click', this.handleSearch);
    }
    
    // Search input (enter key)
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSearch();
        }
      });
    }
    
    // Search type radio buttons
    this.elements.searchTypeRadios.forEach(radio => {
      radio.addEventListener('change', this.handleSearchTypeChange);
    });
    
    // Tool expand/collapse
    this.container.addEventListener('click', (e) => {
      const header = e.target.closest('.tool-header');
      if (header) {
        const index = parseInt(header.dataset.toolIndex);
        if (this.model.expandedTools.has(index)) {
          this.model.expandedTools.delete(index);
        } else {
          this.model.expandedTools.add(index);
        }
        this.render();
        this.attachEventListeners(); // Re-attach after re-render
      }
    });
  }
  
  // Methods to be called by the actor when receiving server responses
  receiveMessage(messageType, data) {
    switch (messageType) {
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
    }
  }
}
*/

export default class ClientPlannerActor {
  constructor() {
    this.remoteActor = null;
    this.plannerComponent = null;
    
    // Component instances
    this.tabsComponent = null;
    this.toolDiscoveryComponent = null;
    this.formalPlanningComponent = null;
    this.searchComponent = null;
    this.executionComponent = null;
    
    // State for MVVM binding
    this.state = {
      connected: false,
      planning: false,
      informalPlanning: false,
      formalPlanning: false,
      cancelling: false,
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

  receive(messageType, data) {
    console.log('📨 Client received:', messageType);
    
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
        break;
        
      default:
        console.warn('Unknown message type:', messageType);
    }
  }

  handleReady(data) {
    this.updateState({ connected: true });
    console.log('✅ Server is ready');
    
    // Update connection status display
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.innerHTML = '🟢 Connected';
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
    
    // Enable execution tab
    if (this.tabsComponent) {
      this.tabsComponent.enableTab('execution', true);
    }
    
    // Load tree into execution component if on execution tab
    if (this.state.activeTab === 'execution' && this.executionComponent && data.result?.formal?.behaviorTrees?.[0]) {
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
                      ${item.discoveryResult.debug.step3_merged.map(tool => `
                        <div class="final-tool">
                          <div class="tool-header">
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
                          </div>
                        </div>
                      `).join('')}
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
        { id: 'planning', label: 'Planning', icon: '📋' },
        { id: 'tools', label: 'Tool Discovery', icon: '🔧', disabled: !this.state.informalResult },
        { id: 'formal', label: 'Formal Planning', icon: '🏗️', disabled: !this.state.toolsResult },
        { id: 'execution', label: 'Execution', icon: '▶️', disabled: !this.state.formalResult },
        { id: 'search', label: 'Semantic Search', icon: '🔍' }
      ],
      activeTab: 'planning',
      onTabChange: (tabId) => this.handleTabChange(tabId)
    });
    
    // Initialize tab contents
    this.initializePlanningTab();
    this.initializeToolsTab();
    this.initializeFormalTab();
    this.initializeExecutionTab();
    this.initializeSearchTab();
  }
  
  initializePlanningTab() {
    const container = this.tabsComponent.getContentContainer('planning');
    if (!container) return;
    
    this.renderPlanningContent();
  }
  
  renderPlanningContent() {
    const container = this.tabsComponent.getContentContainer('planning');
    if (!container) return;
    
    container.innerHTML = `
      <div class="planning-content">
        <label for="goal-input">Planning Goal:</label>
        <textarea 
          id="goal-input" 
          placeholder="Enter your planning goal..."
          ${this.state.informalPlanning ? 'disabled' : ''}
        >${this.state.goal}</textarea>
        
        <div class="button-group">
          <button 
            id="informal-button"
            ${this.state.informalPlanning || !this.state.connected ? 'disabled' : ''}
          >
            ${this.state.informalPlanning ? '⏳ Running Informal Planning...' : '🔍 Start Informal Planning'}
          </button>
          
          ${this.state.informalPlanning ? `
            <button 
              id="cancel-button"
              class="cancel-btn"
              ${this.state.cancelling ? 'disabled' : ''}
            >
              ${this.state.cancelling ? '⏳ Cancellation pending' : '❌ Cancel'}
            </button>
          ` : ''}
        </div>
        
        ${this.state.progressMessages && this.state.progressMessages.length > 0 ? `
          <div class="progress-container">
            <h3>📊 Progress</h3>
            <div class="progress-messages">
              ${this.state.progressMessages.map(msg => `
                <div class="progress-msg">
                  <span class="msg-icon">🔄</span>
                  <span class="msg-text">${msg.message}</span>
                  <span class="msg-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${this.state.informalResult ? `
          <div class="informal-result">
            <h3>📋 Informal Planning Result</h3>
            <div class="result-stats">
              <span>Total Tasks: ${this.state.informalResult.summary?.informal?.totalTasks || 0}</span>
              <span>Simple: ${this.state.informalResult.summary?.informal?.simpleTasks || 0}</span>
              <span>Complex: ${this.state.informalResult.summary?.informal?.complexTasks || 0}</span>
              <span>Valid: ${this.state.informalResult.summary?.informal?.valid ? '✅' : '❌'}</span>
            </div>
            <details>
              <summary>View Hierarchy</summary>
              <pre>${JSON.stringify(this.state.informalResult.informal?.hierarchy, null, 2)}</pre>
            </details>
          </div>
        ` : ''}
        
        ${this.state.error ? `
          <div class="error-message">
            ❌ Error: ${this.state.error}
          </div>
        ` : ''}
      </div>
    `;
    
    // Attach event listeners
    const goalInput = document.getElementById('goal-input');
    if (goalInput) {
      goalInput.addEventListener('input', (e) => {
        this.state.goal = e.target.value;
      });
    }
    
    const informalButton = document.getElementById('informal-button');
    if (informalButton) {
      informalButton.addEventListener('click', () => {
        this.submitInformalPlan(this.state.goal);
      });
    }
    
    const cancelButton = document.getElementById('cancel-button');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        this.cancelPlanning();
      });
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
    
    // Load tree if we have formal planning results
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
        `;
        document.head.appendChild(style);
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
}