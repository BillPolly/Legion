/**
 * ToolRegistryView - Main view container for tool registry UI
 */

export class ToolRegistryView {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    this.activeTab = config.initialTab || 'tools';
    
    // Child views
    this.toolListView = null;
    this.toolExecutionView = null;
    this.databaseView = null;
    this.vectorSearchView = null;
    
    // DOM elements
    this.elements = {};
    
    // Initialize view
    this.init();
  }

  init() {
    // Clear container
    this.container.innerHTML = '';
    
    // Apply theme
    this.container.className = `tool-registry-ui theme-${this.config.theme || 'dark'}`;
    
    // Create main structure
    this.createMainStructure();
    
    // Add styles
    this.injectStyles();
  }

  createMainStructure() {
    // Create header
    const header = document.createElement('div');
    header.className = 'trui-header';
    header.innerHTML = `
      <h1>🔧 Legion Tool Registry</h1>
      <div class="trui-header-stats">
        <span id="tool-count">0 tools</span>
        <span id="module-count">0 modules</span>
        <span id="connection-status" class="status-disconnected">⚫ Disconnected</span>
      </div>
    `;
    
    // Create tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'trui-tab-bar';
    tabBar.innerHTML = `
      <button class="trui-tab ${this.activeTab === 'tools' ? 'active' : ''}" data-tab="tools">
        🛠️ Tool Registry
      </button>
      <button class="trui-tab ${this.activeTab === 'database' ? 'active' : ''}" data-tab="database">
        🗄️ Database & Vectors
      </button>
    `;
    
    // Create tab content containers
    const content = document.createElement('div');
    content.className = 'trui-content';
    
    // Tools tab
    const toolsTab = document.createElement('div');
    toolsTab.className = `trui-tab-content ${this.activeTab === 'tools' ? 'active' : ''}`;
    toolsTab.id = 'tools-tab';
    toolsTab.innerHTML = `
      <div class="trui-split-view">
        <div class="trui-left-panel">
          <div class="trui-panel-header">
            <h2>Available Tools</h2>
            <input type="text" id="tool-search" placeholder="Search tools..." class="trui-search-input">
          </div>
          <div id="tool-list" class="trui-tool-list">
            <div class="trui-loading">Loading tools...</div>
          </div>
        </div>
        <div class="trui-right-panel">
          <div class="trui-panel-header">
            <h2>Tool Details & Execution</h2>
          </div>
          <div id="tool-details" class="trui-tool-details">
            <div class="trui-placeholder">Select a tool to view details</div>
          </div>
        </div>
      </div>
    `;
    
    // Database tab
    const databaseTab = document.createElement('div');
    databaseTab.className = `trui-tab-content ${this.activeTab === 'database' ? 'active' : ''}`;
    databaseTab.id = 'database-tab';
    databaseTab.innerHTML = `
      <div class="trui-split-view">
        <div class="trui-left-panel">
          <div class="trui-panel-header">
            <h2>MongoDB Collections</h2>
          </div>
          <div id="collection-tree" class="trui-collection-tree">
            <div class="trui-loading">Loading collections...</div>
          </div>
        </div>
        <div class="trui-right-panel">
          <div class="trui-tabs-inner">
            <div class="trui-inner-tab-bar">
              <button class="trui-inner-tab active" data-inner-tab="documents">Documents</button>
              <button class="trui-inner-tab" data-inner-tab="vectors">Vector Search</button>
              <button class="trui-inner-tab" data-inner-tab="qdrant">Qdrant Stats</button>
            </div>
            <div class="trui-inner-content">
              <div id="documents-view" class="trui-inner-tab-content active">
                <div class="trui-placeholder">Select a collection to view documents</div>
              </div>
              <div id="vectors-view" class="trui-inner-tab-content">
                <div class="trui-vector-search">
                  <input type="text" id="vector-search-input" placeholder="Enter semantic search query..." class="trui-search-input">
                  <button id="vector-search-btn" class="trui-btn trui-btn-primary">Search</button>
                  <div id="vector-results" class="trui-vector-results"></div>
                </div>
              </div>
              <div id="qdrant-view" class="trui-inner-tab-content">
                <div id="qdrant-stats" class="trui-qdrant-stats">
                  <div class="trui-loading">Loading Qdrant stats...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Append to container
    content.appendChild(toolsTab);
    content.appendChild(databaseTab);
    
    this.container.appendChild(header);
    this.container.appendChild(tabBar);
    this.container.appendChild(content);
    
    // Store element references
    this.elements = {
      header,
      tabBar,
      content,
      toolsTab,
      databaseTab,
      toolCount: header.querySelector('#tool-count'),
      moduleCount: header.querySelector('#module-count'),
      connectionStatus: header.querySelector('#connection-status'),
      toolSearch: toolsTab.querySelector('#tool-search'),
      toolList: toolsTab.querySelector('#tool-list'),
      toolDetails: toolsTab.querySelector('#tool-details'),
      collectionTree: databaseTab.querySelector('#collection-tree'),
      documentsView: databaseTab.querySelector('#documents-view'),
      vectorsView: databaseTab.querySelector('#vectors-view'),
      qdrantView: databaseTab.querySelector('#qdrant-view'),
      vectorSearchInput: databaseTab.querySelector('#vector-search-input'),
      vectorSearchBtn: databaseTab.querySelector('#vector-search-btn'),
      vectorResults: databaseTab.querySelector('#vector-results'),
      qdrantStats: databaseTab.querySelector('#qdrant-stats')
    };
    
    // Attach event listeners
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Tab switching
    this.elements.tabBar.querySelectorAll('.trui-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
    
    // Inner tab switching for database view
    const innerTabs = this.container.querySelectorAll('.trui-inner-tab');
    innerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.innerTab;
        this.switchInnerTab(tabName);
      });
    });
    
    // Tool search
    this.elements.toolSearch.addEventListener('input', (e) => {
      this.emit('tool-search', e.target.value);
    });
    
    // Vector search button
    this.elements.vectorSearchBtn.addEventListener('click', () => {
      const query = this.elements.vectorSearchInput.value;
      if (query) {
        this.emit('vector-search', query);
      }
    });
    
    // Enter key for vector search
    this.elements.vectorSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value;
        if (query) {
          this.emit('vector-search', query);
        }
      }
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    
    // Update tab buttons
    this.elements.tabBar.querySelectorAll('.trui-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    this.container.querySelectorAll('.trui-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    this.emit('tab-switched', tabName);
  }

  switchInnerTab(tabName) {
    // Update inner tab buttons
    this.container.querySelectorAll('.trui-inner-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.innerTab === tabName);
    });
    
    // Update inner tab content
    this.container.querySelectorAll('.trui-inner-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-view`);
    });
  }

  // Update methods
  updateToolList(tools) {
    const listEl = this.elements.toolList;
    
    if (tools.length === 0) {
      listEl.innerHTML = '<div class="trui-empty">No tools found</div>';
      return;
    }
    
    listEl.innerHTML = tools.map(tool => `
      <div class="trui-tool-item" data-tool="${tool.name}">
        <div class="trui-tool-name">${tool.name}</div>
        <div class="trui-tool-module">${tool.moduleName || 'Unknown'}</div>
        <div class="trui-tool-description">${tool.description || 'No description'}</div>
      </div>
    `).join('');
    
    // Add click handlers
    listEl.querySelectorAll('.trui-tool-item').forEach(item => {
      item.addEventListener('click', () => {
        const toolName = item.dataset.tool;
        this.selectTool(toolName);
        this.emit('tool-selected', toolName);
      });
    });
  }

  selectTool(toolName) {
    // Update selection state
    this.elements.toolList.querySelectorAll('.trui-tool-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.tool === toolName);
    });
  }

  updateToolDetails(tool) {
    const detailsEl = this.elements.toolDetails;
    
    if (!tool) {
      detailsEl.innerHTML = '<div class="trui-placeholder">Select a tool to view details</div>';
      return;
    }
    
    detailsEl.innerHTML = `
      <div class="trui-tool-header">
        <h3>${tool.name}</h3>
        <span class="trui-tool-badge">${tool.moduleName || 'Unknown Module'}</span>
      </div>
      
      <div class="trui-tool-section">
        <h4>Description</h4>
        <p>${tool.description || 'No description available'}</p>
      </div>
      
      <div class="trui-tool-section">
        <h4>Parameters</h4>
        <div id="tool-params" class="trui-params">
          ${this.renderToolParams(tool)}
        </div>
      </div>
      
      <div class="trui-tool-section">
        <button id="execute-tool" class="trui-btn trui-btn-primary">Execute Tool</button>
        <button id="test-search" class="trui-btn">Test Semantic Search</button>
      </div>
      
      <div class="trui-tool-section">
        <h4>Execution Results</h4>
        <div id="execution-results" class="trui-results">
          <div class="trui-placeholder">No executions yet</div>
        </div>
      </div>
    `;
    
    // Add button handlers
    const executeBtn = detailsEl.querySelector('#execute-tool');
    executeBtn.addEventListener('click', () => {
      const params = this.collectToolParams();
      this.emit('execute-tool', tool.name, params);
    });
    
    const testSearchBtn = detailsEl.querySelector('#test-search');
    testSearchBtn.addEventListener('click', () => {
      this.emit('test-semantic-search', tool.name);
    });
  }

  renderToolParams(tool) {
    if (!tool.inputSchema || !tool.inputSchema.properties) {
      return '<div class="trui-placeholder">No parameters defined</div>';
    }
    
    const properties = tool.inputSchema.properties;
    const required = tool.inputSchema.required || [];
    
    return Object.entries(properties).map(([name, schema]) => {
      const isRequired = required.includes(name);
      const inputType = this.getInputType(schema);
      
      return `
        <div class="trui-param">
          <label for="param-${name}">
            ${name} ${isRequired ? '<span class="required">*</span>' : ''}
          </label>
          ${this.renderParamInput(name, schema, inputType)}
          <div class="trui-param-desc">${schema.description || ''}</div>
        </div>
      `;
    }).join('');
  }

  getInputType(schema) {
    if (schema.type === 'boolean') return 'checkbox';
    if (schema.type === 'number' || schema.type === 'integer') return 'number';
    if (schema.enum) return 'select';
    if (schema.type === 'object' || schema.type === 'array') return 'textarea';
    return 'text';
  }

  renderParamInput(name, schema, inputType) {
    const id = `param-${name}`;
    
    if (inputType === 'select') {
      return `
        <select id="${id}" class="trui-input">
          ${schema.enum.map(value => `<option value="${value}">${value}</option>`).join('')}
        </select>
      `;
    }
    
    if (inputType === 'textarea') {
      return `<textarea id="${id}" class="trui-input" rows="3" placeholder='${schema.type === 'object' ? '{}' : '[]'}'></textarea>`;
    }
    
    if (inputType === 'checkbox') {
      return `<input type="checkbox" id="${id}" class="trui-checkbox">`;
    }
    
    return `<input type="${inputType}" id="${id}" class="trui-input" placeholder="${schema.default || ''}">`;
  }

  collectToolParams() {
    const params = {};
    this.elements.toolDetails.querySelectorAll('[id^="param-"]').forEach(input => {
      const name = input.id.replace('param-', '');
      
      if (input.type === 'checkbox') {
        params[name] = input.checked;
      } else if (input.type === 'number') {
        params[name] = input.value ? parseFloat(input.value) : undefined;
      } else if (input.tagName === 'TEXTAREA') {
        try {
          params[name] = JSON.parse(input.value);
        } catch {
          params[name] = input.value;
        }
      } else {
        params[name] = input.value || undefined;
      }
    });
    
    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });
    
    return params;
  }

  updateExecutionResults(results) {
    const resultsEl = this.elements.toolDetails?.querySelector('#execution-results');
    if (!resultsEl) return;
    
    resultsEl.innerHTML = `
      <div class="trui-result ${results.success ? 'success' : 'error'}">
        <div class="trui-result-header">
          <span class="trui-result-time">${new Date().toLocaleTimeString()}</span>
          <span class="trui-result-status">${results.success ? '✅ Success' : '❌ Error'}</span>
        </div>
        <pre class="trui-result-content">${JSON.stringify(results.data || results.error, null, 2)}</pre>
      </div>
    `;
  }

  updateCollectionTree(collections) {
    const treeEl = this.elements.collectionTree;
    
    if (collections.length === 0) {
      treeEl.innerHTML = '<div class="trui-empty">No collections found</div>';
      return;
    }
    
    treeEl.innerHTML = `
      <div class="trui-tree">
        ${collections.map(collection => `
          <div class="trui-tree-item" data-collection="${collection.name}">
            <span class="trui-tree-icon">📁</span>
            <span class="trui-tree-name">${collection.name}</span>
            <span class="trui-tree-count">${collection.count || 0} docs</span>
          </div>
        `).join('')}
      </div>
    `;
    
    // Add click handlers
    treeEl.querySelectorAll('.trui-tree-item').forEach(item => {
      item.addEventListener('click', () => {
        const collectionName = item.dataset.collection;
        this.selectCollection(collectionName);
        this.emit('collection-selected', collectionName);
      });
    });
  }

  selectCollection(collectionName) {
    this.elements.collectionTree.querySelectorAll('.trui-tree-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.collection === collectionName);
    });
  }

  updateDocumentsView(documents) {
    const docsEl = this.elements.documentsView;
    
    if (!documents || documents.length === 0) {
      docsEl.innerHTML = '<div class="trui-placeholder">No documents to display</div>';
      return;
    }
    
    docsEl.innerHTML = `
      <div class="trui-documents">
        ${documents.map((doc, i) => `
          <div class="trui-document">
            <div class="trui-document-header">Document ${i + 1}</div>
            <pre class="trui-document-content">${JSON.stringify(doc, null, 2)}</pre>
          </div>
        `).join('')}
      </div>
    `;
  }

  updateVectorResults(results) {
    const resultsEl = this.elements.vectorResults;
    
    if (!results || results.length === 0) {
      resultsEl.innerHTML = '<div class="trui-empty">No results found</div>';
      return;
    }
    
    resultsEl.innerHTML = `
      <div class="trui-vector-list">
        ${results.map(result => `
          <div class="trui-vector-item">
            <div class="trui-vector-name">${result.toolName}</div>
            <div class="trui-vector-score">Score: ${result.score.toFixed(4)}</div>
            <div class="trui-vector-type">${result.perspectiveType}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  updateQdrantStats(stats) {
    const statsEl = this.elements.qdrantStats;
    
    if (!stats) {
      statsEl.innerHTML = '<div class="trui-loading">Loading Qdrant stats...</div>';
      return;
    }
    
    statsEl.innerHTML = `
      <div class="trui-stats-grid">
        <div class="trui-stat-card">
          <div class="trui-stat-label">Collection</div>
          <div class="trui-stat-value">${stats.collection || 'legion_tools'}</div>
        </div>
        <div class="trui-stat-card">
          <div class="trui-stat-label">Vector Count</div>
          <div class="trui-stat-value">${stats.vectorCount || 0}</div>
        </div>
        <div class="trui-stat-card">
          <div class="trui-stat-label">Dimensions</div>
          <div class="trui-stat-value">${stats.dimensions || 384}</div>
        </div>
        <div class="trui-stat-card">
          <div class="trui-stat-label">Distance Metric</div>
          <div class="trui-stat-value">${stats.distance || 'cosine'}</div>
        </div>
        <div class="trui-stat-card">
          <div class="trui-stat-label">Index Status</div>
          <div class="trui-stat-value">${stats.status || 'Ready'}</div>
        </div>
        <div class="trui-stat-card">
          <div class="trui-stat-label">Embedding Model</div>
          <div class="trui-stat-value">ONNX all-MiniLM-L6-v2</div>
        </div>
      </div>
    `;
  }

  updateConnectionStatus(connected) {
    const statusEl = this.elements.connectionStatus;
    if (connected) {
      statusEl.className = 'status-connected';
      statusEl.textContent = '🟢 Connected';
    } else {
      statusEl.className = 'status-disconnected';
      statusEl.textContent = '⚫ Disconnected';
    }
  }

  updateStats(stats) {
    if (this.elements.toolCount) {
      this.elements.toolCount.textContent = `${stats.totalTools || 0} tools`;
    }
    if (this.elements.moduleCount) {
      this.elements.moduleCount.textContent = `${stats.totalModules || 0} modules`;
    }
  }

  showLoading(show = true) {
    if (show) {
      this.container.classList.add('loading');
    } else {
      this.container.classList.remove('loading');
    }
  }

  showError(error) {
    // Could show a toast or modal
    console.error('UI Error:', error);
  }

  setTheme(theme) {
    this.container.className = `tool-registry-ui theme-${theme}`;
    this.config.theme = theme;
  }

  getActiveTab() {
    return this.activeTab;
  }

  // Event handling
  listeners = new Map();

  emit(event, ...args) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Cleanup
  destroy() {
    this.listeners.clear();
    this.container.innerHTML = '';
  }

  // Inject styles
  injectStyles() {
    if (document.getElementById('trui-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'trui-styles';
    style.textContent = `
      .tool-registry-ui {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      /* Theme */
      .theme-dark {
        background: #1a1a1a;
        color: #e0e0e0;
      }
      
      .theme-light {
        background: #ffffff;
        color: #333333;
      }
      
      /* Header */
      .trui-header {
        padding: 1rem;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .trui-header h1 {
        margin: 0;
        font-size: 1.5rem;
      }
      
      .trui-header-stats {
        display: flex;
        gap: 1rem;
        font-size: 0.9rem;
      }
      
      .status-connected { color: #4caf50; }
      .status-disconnected { color: #f44336; }
      
      /* Tabs */
      .trui-tab-bar {
        display: flex;
        border-bottom: 1px solid #333;
        background: #252525;
      }
      
      .trui-tab {
        padding: 0.75rem 1.5rem;
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        transition: all 0.3s;
        border-bottom: 2px solid transparent;
      }
      
      .trui-tab:hover {
        color: #e0e0e0;
      }
      
      .trui-tab.active {
        color: #4caf50;
        border-bottom-color: #4caf50;
      }
      
      /* Content */
      .trui-content {
        flex: 1;
        overflow: hidden;
      }
      
      .trui-tab-content {
        display: none;
        height: 100%;
      }
      
      .trui-tab-content.active {
        display: block;
      }
      
      /* Split View */
      .trui-split-view {
        display: flex;
        height: 100%;
      }
      
      .trui-left-panel,
      .trui-right-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .trui-left-panel {
        border-right: 1px solid #333;
        flex: 0 0 40%;
      }
      
      /* Panel Header */
      .trui-panel-header {
        padding: 1rem;
        border-bottom: 1px solid #333;
      }
      
      .trui-panel-header h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
      }
      
      /* Search Input */
      .trui-search-input {
        width: 100%;
        padding: 0.5rem;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        color: #e0e0e0;
      }
      
      /* Tool List */
      .trui-tool-list {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
      }
      
      .trui-tool-item {
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        background: #2a2a2a;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .trui-tool-item:hover {
        background: #333;
      }
      
      .trui-tool-item.selected {
        background: #3a3a3a;
        border-left: 3px solid #4caf50;
      }
      
      .trui-tool-name {
        font-weight: bold;
        margin-bottom: 0.25rem;
      }
      
      .trui-tool-module {
        font-size: 0.85rem;
        color: #999;
        margin-bottom: 0.25rem;
      }
      
      .trui-tool-description {
        font-size: 0.85rem;
        color: #ccc;
      }
      
      /* Tool Details */
      .trui-tool-details {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
      }
      
      .trui-tool-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      
      .trui-tool-badge {
        padding: 0.25rem 0.5rem;
        background: #4caf50;
        border-radius: 4px;
        font-size: 0.85rem;
      }
      
      .trui-tool-section {
        margin-bottom: 1.5rem;
      }
      
      .trui-tool-section h4 {
        margin: 0 0 0.5rem 0;
        color: #4caf50;
      }
      
      /* Parameters */
      .trui-param {
        margin-bottom: 1rem;
      }
      
      .trui-param label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: bold;
      }
      
      .trui-param .required {
        color: #f44336;
      }
      
      .trui-input,
      .trui-checkbox {
        padding: 0.5rem;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 4px;
        color: #e0e0e0;
        width: 100%;
      }
      
      .trui-param-desc {
        font-size: 0.85rem;
        color: #999;
        margin-top: 0.25rem;
      }
      
      /* Buttons */
      .trui-btn {
        padding: 0.5rem 1rem;
        background: #3a3a3a;
        border: 1px solid #555;
        border-radius: 4px;
        color: #e0e0e0;
        cursor: pointer;
        margin-right: 0.5rem;
        transition: all 0.2s;
      }
      
      .trui-btn:hover {
        background: #444;
      }
      
      .trui-btn-primary {
        background: #4caf50;
        border-color: #4caf50;
      }
      
      .trui-btn-primary:hover {
        background: #45a049;
      }
      
      /* Results */
      .trui-results {
        padding: 1rem;
        background: #2a2a2a;
        border-radius: 4px;
      }
      
      .trui-result {
        margin-bottom: 1rem;
      }
      
      .trui-result-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }
      
      .trui-result-content {
        background: #1a1a1a;
        padding: 0.5rem;
        border-radius: 4px;
        overflow-x: auto;
      }
      
      /* Collections Tree */
      .trui-collection-tree {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
      }
      
      .trui-tree-item {
        padding: 0.5rem;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .trui-tree-item:hover {
        background: #2a2a2a;
      }
      
      .trui-tree-item.selected {
        background: #3a3a3a;
      }
      
      .trui-tree-icon {
        margin-right: 0.5rem;
      }
      
      .trui-tree-name {
        flex: 1;
      }
      
      .trui-tree-count {
        font-size: 0.85rem;
        color: #999;
      }
      
      /* Inner Tabs */
      .trui-inner-tab-bar {
        display: flex;
        border-bottom: 1px solid #333;
        padding: 0 1rem;
      }
      
      .trui-inner-tab {
        padding: 0.5rem 1rem;
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        border-bottom: 2px solid transparent;
      }
      
      .trui-inner-tab.active {
        color: #4caf50;
        border-bottom-color: #4caf50;
      }
      
      .trui-inner-content {
        flex: 1;
        overflow: hidden;
      }
      
      .trui-inner-tab-content {
        display: none;
        height: 100%;
        padding: 1rem;
        overflow-y: auto;
      }
      
      .trui-inner-tab-content.active {
        display: block;
      }
      
      /* Vector Search */
      .trui-vector-search {
        padding: 1rem;
      }
      
      .trui-vector-results {
        margin-top: 1rem;
      }
      
      .trui-vector-item {
        padding: 0.75rem;
        background: #2a2a2a;
        margin-bottom: 0.5rem;
        border-radius: 4px;
      }
      
      .trui-vector-name {
        font-weight: bold;
        margin-bottom: 0.25rem;
      }
      
      .trui-vector-score {
        color: #4caf50;
        font-size: 0.85rem;
      }
      
      .trui-vector-type {
        color: #999;
        font-size: 0.85rem;
      }
      
      /* Stats Grid */
      .trui-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }
      
      .trui-stat-card {
        padding: 1rem;
        background: #2a2a2a;
        border-radius: 4px;
      }
      
      .trui-stat-label {
        font-size: 0.85rem;
        color: #999;
        margin-bottom: 0.5rem;
      }
      
      .trui-stat-value {
        font-size: 1.2rem;
        font-weight: bold;
        color: #4caf50;
      }
      
      /* Utilities */
      .trui-placeholder {
        text-align: center;
        color: #666;
        padding: 2rem;
      }
      
      .trui-empty {
        text-align: center;
        color: #999;
        padding: 1rem;
      }
      
      .trui-loading {
        text-align: center;
        color: #999;
        padding: 2rem;
      }
      
      .loading {
        opacity: 0.5;
        pointer-events: none;
      }
    `;
    
    document.head.appendChild(style);
  }
}