/**
 * ToolsBrowserComponent - Enhanced tool browsing and testing
 * 
 * Enhances the existing SearchComponent with:
 * - Direct database inspection
 * - Tool execution testing
 * - Registration status verification
 * - Perspectives/embeddings view
 */

import { SearchComponent } from './SearchComponent.js';
import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class ToolsBrowserComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // Model
    this.model = {
      tools: [],
      searchResults: [],
      selectedTool: null,
      viewMode: 'search', // 'search', 'database', 'testing'
      connected: false
    };
    
    // View elements
    this.elements = {};
    this.components = {};
    
    this.createView();
    this.initializeComponents();
  }

  /**
   * Create the tools browser interface
   */
  createView() {
    this.container.innerHTML = '';
    
    // Main container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'tools-browser-container';
    mainDiv.style.height = '100%';
    mainDiv.style.display = 'flex';
    mainDiv.style.flexDirection = 'column';
    
    // View mode selector
    const modeSelector = document.createElement('div');
    modeSelector.className = 'tools-view-mode-selector';
    modeSelector.style.padding = '8px';
    modeSelector.style.borderBottom = '1px solid #e5e7eb';
    modeSelector.style.display = 'flex';
    modeSelector.style.gap = '8px';
    
    ['search', 'database', 'testing'].forEach(mode => {
      const button = document.createElement('button');
      button.className = `mode-btn ${mode === this.model.viewMode ? 'active' : ''}`;
      button.textContent = this.getModeLabel(mode);
      button.style.padding = '6px 12px';
      button.style.border = '1px solid #d1d5db';
      button.style.borderRadius = '4px';
      button.style.backgroundColor = mode === this.model.viewMode ? '#3b82f6' : 'white';
      button.style.color = mode === this.model.viewMode ? 'white' : '#374151';
      button.style.cursor = 'pointer';
      button.onclick = () => this.switchViewMode(mode);
      
      modeSelector.appendChild(button);
    });
    
    // Content container
    this.elements.contentContainer = document.createElement('div');
    this.elements.contentContainer.className = 'tools-content-container';
    this.elements.contentContainer.style.flex = '1';
    this.elements.contentContainer.style.overflow = 'hidden';
    
    // Assemble view
    mainDiv.appendChild(modeSelector);
    mainDiv.appendChild(this.elements.contentContainer);
    this.container.appendChild(mainDiv);
  }

  /**
   * Initialize components for different view modes
   */
  initializeComponents() {
    // Initialize search component (reuse existing)
    this.components.search = new SearchComponent(this.elements.contentContainer, {
      remoteActor: this.options.remoteActor,
      onSearch: (query, type) => this.handleSearch(query, type),
      onToolSelect: (tool) => this.handleToolSelect(tool)
    });
    
    // Initially show search view
    this.switchViewMode('search');
  }

  /**
   * Get label for view mode
   */
  getModeLabel(mode) {
    const labels = {
      'search': '🔍 Search',
      'database': '🗄️ Database',
      'testing': '🧪 Testing'
    };
    return labels[mode] || mode;
  }

  /**
   * Switch view mode
   */
  switchViewMode(mode) {
    this.model.viewMode = mode;
    
    // Update button states
    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      const isActive = btn.textContent.includes(this.getModeLabel(mode).split(' ')[1]);
      btn.style.backgroundColor = isActive ? '#3b82f6' : 'white';
      btn.style.color = isActive ? 'white' : '#374151';
    });
    
    // Show appropriate content
    this.renderModeContent(mode);
  }

  /**
   * Render content for specific mode
   */
  renderModeContent(mode) {
    this.elements.contentContainer.innerHTML = '';
    
    switch (mode) {
      case 'search':
        this.renderSearchMode();
        break;
      case 'database':
        this.renderDatabaseMode();
        break;
      case 'testing':
        this.renderTestingMode();
        break;
    }
  }

  /**
   * Render search mode (enhanced SearchComponent)
   */
  renderSearchMode() {
    const searchDiv = document.createElement('div');
    searchDiv.style.height = '100%';
    this.elements.contentContainer.appendChild(searchDiv);
    
    // Reinitialize search component in new container
    this.components.search = new SearchComponent(searchDiv, {
      remoteActor: this.options.remoteActor,
      onSearch: (query, type) => this.handleSearch(query, type),
      onToolSelect: (tool) => this.handleToolSelect(tool)
    });
  }

  /**
   * Render database inspection mode
   */
  renderDatabaseMode() {
    const dbDiv = document.createElement('div');
    dbDiv.className = 'database-inspection';
    dbDiv.style.padding = '16px';
    
    const title = document.createElement('h3');
    title.textContent = '🗄️ Database Inspection';
    title.style.marginBottom = '16px';
    
    // Raw tools query interface
    const queryDiv = document.createElement('div');
    queryDiv.style.marginBottom = '16px';
    
    const queryLabel = document.createElement('label');
    queryLabel.textContent = 'Database Query:';
    queryLabel.style.display = 'block';
    queryLabel.style.marginBottom = '4px';
    queryLabel.style.fontWeight = 'bold';
    
    const queryInput = document.createElement('textarea');
    queryInput.placeholder = 'Enter MongoDB query (e.g., {"name": {"$regex": "mongo", "$options": "i"}})';
    queryInput.style.width = '100%';
    queryInput.style.height = '80px';
    queryInput.style.padding = '8px';
    queryInput.style.border = '1px solid #d1d5db';
    queryInput.style.borderRadius = '4px';
    queryInput.style.fontFamily = 'monospace';
    queryInput.style.fontSize = '12px';
    
    const queryBtn = document.createElement('button');
    queryBtn.textContent = '🔍 Query Tools';
    queryBtn.style.marginTop = '8px';
    queryBtn.style.padding = '8px 16px';
    queryBtn.style.backgroundColor = '#6366f1';
    queryBtn.style.color = 'white';
    queryBtn.style.border = 'none';
    queryBtn.style.borderRadius = '4px';
    queryBtn.style.cursor = 'pointer';
    queryBtn.onclick = () => this.executeDbQuery(queryInput.value);
    
    // Results area
    this.elements.dbResults = document.createElement('div');
    this.elements.dbResults.className = 'db-query-results';
    this.elements.dbResults.style.marginTop = '16px';
    this.elements.dbResults.style.padding = '12px';
    this.elements.dbResults.style.backgroundColor = '#f9fafb';
    this.elements.dbResults.style.border = '1px solid #e5e7eb';
    this.elements.dbResults.style.borderRadius = '4px';
    this.elements.dbResults.style.maxHeight = '400px';
    this.elements.dbResults.style.overflow = 'auto';
    this.elements.dbResults.style.fontFamily = 'monospace';
    this.elements.dbResults.style.fontSize = '11px';
    this.elements.dbResults.textContent = 'No query executed yet';
    
    queryDiv.appendChild(queryLabel);
    queryDiv.appendChild(queryInput);
    queryDiv.appendChild(queryBtn);
    
    dbDiv.appendChild(title);
    dbDiv.appendChild(queryDiv);
    dbDiv.appendChild(this.elements.dbResults);
    
    this.elements.contentContainer.appendChild(dbDiv);
  }

  /**
   * Render tool testing mode
   */
  renderTestingMode() {
    const testDiv = document.createElement('div');
    testDiv.className = 'tool-testing';
    testDiv.style.padding = '16px';
    
    const title = document.createElement('h3');
    title.textContent = '🧪 Tool Testing';
    title.style.marginBottom = '16px';
    
    const instructionsDiv = document.createElement('div');
    instructionsDiv.style.marginBottom = '16px';
    instructionsDiv.style.padding = '12px';
    instructionsDiv.style.backgroundColor = '#fef3c7';
    instructionsDiv.style.border = '1px solid #f59e0b';
    instructionsDiv.style.borderRadius = '4px';
    instructionsDiv.innerHTML = `
      <strong>Tool Testing Instructions:</strong><br>
      1. Search for a tool in the Search tab<br>
      2. Click on a tool to select it<br>
      3. Return to this tab to test execution<br>
      4. Provide test parameters and execute
    `;
    
    // Tool selection display
    this.elements.selectedToolDiv = document.createElement('div');
    this.elements.selectedToolDiv.className = 'selected-tool-display';
    this.elements.selectedToolDiv.style.marginBottom = '16px';
    this.elements.selectedToolDiv.textContent = 'No tool selected';
    
    testDiv.appendChild(title);
    testDiv.appendChild(instructionsDiv);
    testDiv.appendChild(this.elements.selectedToolDiv);
    
    this.elements.contentContainer.appendChild(testDiv);
  }

  /**
   * Execute database query
   */
  executeDbQuery(queryString) {
    try {
      const query = JSON.parse(queryString || '{}');
      
      if (this.options.onDatabaseQuery) {
        this.options.onDatabaseQuery('tools', 'find', { query });
      }
      
      this.elements.dbResults.textContent = 'Executing query...';
    } catch (error) {
      this.elements.dbResults.textContent = `Invalid JSON query: ${error.message}`;
    }
  }

  /**
   * Handle database query result
   */
  handleDbQueryResult(result) {
    if (this.elements.dbResults) {
      this.elements.dbResults.textContent = JSON.stringify(result, null, 2);
    }
  }

  /**
   * Handle search
   */
  handleSearch(query, type) {
    if (this.options.onSearch) {
      this.options.onSearch(query, type);
    }
  }

  /**
   * Handle tool selection
   */
  handleToolSelect(tool) {
    this.model.selectedTool = tool;
    
    if (this.options.onToolSelect) {
      this.options.onToolSelect(tool);
    }
    
    // Update testing mode display
    if (this.elements.selectedToolDiv) {
      this.elements.selectedToolDiv.innerHTML = `
        <strong>Selected Tool:</strong> ${tool.name}<br>
        <strong>Description:</strong> ${tool.description}<br>
        <strong>Module:</strong> ${tool.moduleName}
      `;
    }
  }

  /**
   * Update tools data
   */
  updateTools(tools) {
    this.model.tools = tools || [];
    
    if (this.components.search) {
      this.components.search.updateTools(tools);
    }
  }

  /**
   * Set connection status
   */
  setConnected(connected) {
    this.model.connected = connected;
    
    if (this.components.search) {
      this.components.search.setConnected(connected);
    }
  }

  /**
   * Set remote actor for communication
   * @param {Object} remoteActor - Remote actor instance for backend communication
   */
  setRemoteActor(remoteActor) {
    this.options.remoteActor = remoteActor;
    
    if (this.components.search) {
      this.components.search.setRemoteActor(remoteActor);
    }
  }

  /**
   * Get component state for debugging
   */
  getState() {
    return {
      toolCount: this.model.tools.length,
      viewMode: this.model.viewMode,
      selectedTool: this.model.selectedTool?.name,
      connected: this.model.connected
    };
  }
}