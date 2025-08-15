/**
 * LoadingControlPanel Component - Full control over Tool Registry loading
 * Provides complete access to module loading, registry management, and status monitoring
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

class LoadingControlPanelModel {
  constructor(options = {}) {
    this.state = {
      loading: false,
      lastLoadResult: null,
      registryStats: {
        modules: 0,
        tools: 0,
        perspectives: 0,
        timestamp: null
      },
      loadHistory: [],
      moduleStatuses: new Map()
    };
  }
  
  updateState(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  
  getState(path = '') {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
  
  addLoadResult(result) {
    this.state.lastLoadResult = result;
    this.state.loadHistory.unshift({
      ...result,
      timestamp: new Date()
    });
    // Keep only last 10 results
    if (this.state.loadHistory.length > 10) {
      this.state.loadHistory.pop();
    }
  }
}

class LoadingControlPanelView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  generateCSS() {
    return `
      .loading-control-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 1.5rem;
        overflow: hidden;
        background: var(--surface-secondary);
      }
      
      .loading-header {
        margin-bottom: 2rem;
      }
      
      .loading-title {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 0.5rem 0;
      }
      
      .loading-subtitle {
        font-size: 1rem;
        color: var(--text-secondary);
      }
      
      .control-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      
      .action-button {
        padding: 1rem;
        border: 2px solid var(--border-medium);
        border-radius: 0.5rem;
        background: var(--surface-primary);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
      }
      
      .action-button:hover:not(:disabled) {
        border-color: var(--color-primary);
        background: var(--surface-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .action-button.primary {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }
      
      .action-button.primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }
      
      .action-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
      
      .action-label {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.25rem;
      }
      
      .action-description {
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
      
      .status-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .status-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border-subtle);
      }
      
      .status-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .status-stats {
        display: flex;
        gap: 2rem;
      }
      
      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-primary);
      }
      
      .stat-label {
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
      
      .results-container {
        flex: 1;
        overflow-y: auto;
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        padding: 1rem;
      }
      
      .result-item {
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        background: var(--surface-secondary);
        border-radius: 0.375rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .result-module {
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .result-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .result-status.success {
        color: var(--color-success);
      }
      
      .result-status.failed {
        color: var(--color-error);
      }
      
      .result-tools {
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
      
      .loading-spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--border-subtle);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .empty-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-secondary);
      }
      
      .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      
      .empty-message {
        font-size: 1.125rem;
      }
      
      .single-module-section {
        margin-bottom: 2rem;
        padding: 1rem;
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
      }
      
      .single-module-header {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.75rem;
      }
      
      .single-module-input-group {
        display: flex;
        gap: 0.5rem;
      }
      
      .single-module-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-medium);
        border-radius: 0.375rem;
        background: var(--surface-secondary);
        color: var(--text-primary);
        font-size: 1rem;
      }
      
      .single-module-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }
      
      .single-module-btn {
        padding: 0.5rem 1rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      
      .single-module-btn:hover:not(:disabled) {
        background: var(--color-primary-hover);
      }
      
      .single-module-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'loading-control-panel-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'loading-control-panel';
    
    // Header
    const header = this.createHeader();
    this.container.appendChild(header);
    
    // Control Actions
    const actions = this.createControlActions(modelData);
    this.container.appendChild(actions);
    
    // Single Module Load Section
    const singleModuleSection = this.createSingleModuleSection(modelData);
    this.container.appendChild(singleModuleSection);
    
    // Status Section
    const status = this.createStatusSection(modelData);
    this.container.appendChild(status);
    
    return this.container;
  }
  
  createHeader() {
    const header = document.createElement('div');
    header.className = 'loading-header';
    
    const title = document.createElement('h1');
    title.className = 'loading-title';
    title.textContent = '🔧 Tool Registry Control';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'loading-subtitle';
    subtitle.textContent = 'Full control over module loading and registry management';
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    return header;
  }
  
  createControlActions(modelData) {
    const actions = document.createElement('div');
    actions.className = 'control-actions';
    
    // Load All Modules button
    const loadAllBtn = this.createActionButton({
      icon: '📦',
      label: 'Load All Modules',
      description: 'Discover and load all modules from filesystem',
      primary: true,
      disabled: modelData.loading,
      id: 'load-all-modules'
    });
    
    // Refresh Registry button
    const refreshBtn = this.createActionButton({
      icon: '🔄',
      label: 'Refresh Registry',
      description: 'Reload tools and modules from database',
      disabled: modelData.loading,
      id: 'refresh-registry'
    });
    
    // Generate Perspectives button
    const perspectivesBtn = this.createActionButton({
      icon: '🔮',
      label: 'Generate Perspectives',
      description: 'Generate AI perspectives for all tools',
      disabled: modelData.loading,
      id: 'generate-perspectives'
    });
    
    // Clear Database button
    const clearBtn = this.createActionButton({
      icon: '🗑️',
      label: 'Clear Database',
      description: 'Remove all tools and modules (use with caution)',
      disabled: modelData.loading,
      id: 'clear-database'
    });
    
    actions.appendChild(loadAllBtn);
    actions.appendChild(refreshBtn);
    actions.appendChild(perspectivesBtn);
    actions.appendChild(clearBtn);
    
    return actions;
  }
  
  createActionButton(config) {
    const button = document.createElement('button');
    button.className = `action-button${config.primary ? ' primary' : ''}`;
    button.disabled = config.disabled;
    button.id = config.id;
    
    const icon = document.createElement('div');
    icon.className = 'action-icon';
    icon.textContent = config.icon;
    
    const label = document.createElement('div');
    label.className = 'action-label';
    label.textContent = config.label;
    
    const description = document.createElement('div');
    description.className = 'action-description';
    description.textContent = config.description;
    
    button.appendChild(icon);
    button.appendChild(label);
    button.appendChild(description);
    
    return button;
  }
  
  createSingleModuleSection(modelData) {
    const section = document.createElement('div');
    section.className = 'single-module-section';
    
    const header = document.createElement('div');
    header.className = 'single-module-header';
    header.textContent = '📦 Load Single Module';
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'single-module-input-group';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'single-module-input';
    input.id = 'single-module-name';
    input.placeholder = 'Enter module name (e.g., Calculator, File, Railway)';
    input.disabled = modelData.loading;
    
    const button = document.createElement('button');
    button.className = 'single-module-btn';
    button.id = 'load-single-module-btn';
    button.textContent = 'Load Module';
    button.disabled = modelData.loading;
    
    inputGroup.appendChild(input);
    inputGroup.appendChild(button);
    
    section.appendChild(header);
    section.appendChild(inputGroup);
    
    return section;
  }
  
  createStatusSection(modelData) {
    const section = document.createElement('div');
    section.className = 'status-section';
    
    // Status Header with Stats
    const header = document.createElement('div');
    header.className = 'status-header';
    
    const title = document.createElement('div');
    title.className = 'status-title';
    title.textContent = modelData.loading ? 'Loading... ' : 'Status';
    
    if (modelData.loading) {
      const spinner = document.createElement('span');
      spinner.className = 'loading-spinner';
      title.appendChild(spinner);
    }
    
    const stats = document.createElement('div');
    stats.className = 'status-stats';
    
    stats.appendChild(this.createStatItem('Modules', modelData.registryStats.modules));
    stats.appendChild(this.createStatItem('Tools', modelData.registryStats.tools));
    stats.appendChild(this.createStatItem('Perspectives', modelData.registryStats.perspectives));
    
    header.appendChild(title);
    header.appendChild(stats);
    
    // Results Container
    const results = document.createElement('div');
    results.className = 'results-container';
    
    if (modelData.lastLoadResult && modelData.lastLoadResult.results) {
      modelData.lastLoadResult.results.forEach(result => {
        results.appendChild(this.createResultItem(result));
      });
    } else if (modelData.loadHistory.length > 0) {
      // Show last load result
      const lastResult = modelData.loadHistory[0];
      if (lastResult.results) {
        lastResult.results.forEach(result => {
          results.appendChild(this.createResultItem(result));
        });
      }
    } else {
      // Empty state
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      
      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.textContent = '📋';
      
      const message = document.createElement('div');
      message.className = 'empty-message';
      message.textContent = 'No loading operations yet. Click "Load All Modules" to start.';
      
      empty.appendChild(icon);
      empty.appendChild(message);
      
      results.appendChild(empty);
    }
    
    section.appendChild(header);
    section.appendChild(results);
    
    return section;
  }
  
  createStatItem(label, value) {
    const item = document.createElement('div');
    item.className = 'stat-item';
    
    const valueEl = document.createElement('div');
    valueEl.className = 'stat-value';
    valueEl.textContent = value || 0;
    
    const labelEl = document.createElement('div');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    
    item.appendChild(valueEl);
    item.appendChild(labelEl);
    
    return item;
  }
  
  createResultItem(result) {
    const item = document.createElement('div');
    item.className = 'result-item';
    
    const module = document.createElement('div');
    module.className = 'result-module';
    module.textContent = result.module;
    
    const status = document.createElement('div');
    status.className = `result-status ${result.status}`;
    
    if (result.status === 'success') {
      status.innerHTML = `✅ <span class="result-tools">${result.tools} tools</span>`;
    } else {
      status.innerHTML = `❌ <span class="result-tools">${result.error || 'Failed'}</span>`;
    }
    
    item.appendChild(module);
    item.appendChild(status);
    
    return item;
  }
}

class LoadingControlPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.eventListeners = [];
  }
  
  initialize() {
    this.render();
    this.setupEventListeners();
    this.setupCallbacks();
    
    // Request initial stats
    this.getStats();
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
  }
  
  setupCallbacks() {
    // Set up callbacks for registry operations on the toolRegistryBrowser
    const toolRegistryBrowser = window.toolRegistryApp;
    if (toolRegistryBrowser) {
      toolRegistryBrowser.onRegistryLoadComplete = (data) => {
        console.log('✅ Load complete:', data);
        this.model.updateState('loading', false);
        this.model.addLoadResult(data);
        this.render();
      };
      
      toolRegistryBrowser.onRegistryLoadFailed = (error) => {
        console.error('❌ Load failed:', error);
        this.model.updateState('loading', false);
        this.render();
        alert(`Failed to load modules: ${error}`);
      };
      
      toolRegistryBrowser.onRegistryStats = (data) => {
        console.log('📊 Stats received:', data);
        this.model.updateState('registryStats', data);
        this.render();
      };
      
      toolRegistryBrowser.onRegistryClearComplete = (data) => {
        console.log('✅ Database cleared:', data);
        this.model.updateState('loading', false);
        this.model.updateState('registryStats', {
          modules: 0,
          tools: 0,
          perspectives: 0,
          timestamp: new Date()
        });
        this.render();
      };
      
      toolRegistryBrowser.onRegistryClearFailed = (error) => {
        console.error('❌ Clear failed:', error);
        this.model.updateState('loading', false);
        this.render();
      };
      
      toolRegistryBrowser.onModuleLoadComplete = (data) => {
        console.log('✅ Module loaded:', data);
        this.model.updateState('loading', false);
        this.render();
      };
      
      toolRegistryBrowser.onModuleLoadFailed = (data) => {
        console.error('❌ Module load failed:', data);
        this.model.updateState('loading', false);
        this.render();
      };
      
      toolRegistryBrowser.onPerspectivesComplete = (data) => {
        console.log('✅ Perspectives generated:', data);
        this.model.updateState('loading', false);
        this.render();
      };
      
      toolRegistryBrowser.onPerspectivesFailed = (data) => {
        console.error('❌ Perspective generation failed:', data);
        this.model.updateState('loading', false);
        this.render();
      };
    }
  }
  
  render() {
    this.view.render(this.model.getState());
    // Re-attach event listeners after render
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Clean up existing listeners first
    this.eventListeners.forEach(cleanup => cleanup());
    this.eventListeners = [];
    
    // Load All Modules button
    const loadAllBtn = this.view.container.querySelector('#load-all-modules');
    if (loadAllBtn) {
      const handleLoadAll = () => {
        this.loadAllModules();
      };
      loadAllBtn.addEventListener('click', handleLoadAll);
      this.eventListeners.push(() => loadAllBtn.removeEventListener('click', handleLoadAll));
    }
    
    // Refresh Registry button
    const refreshBtn = this.view.container.querySelector('#refresh-registry');
    if (refreshBtn) {
      const handleRefresh = () => {
        this.refreshRegistry();
      };
      refreshBtn.addEventListener('click', handleRefresh);
      this.eventListeners.push(() => refreshBtn.removeEventListener('click', handleRefresh));
    }
    
    // Generate Perspectives button
    const perspectivesBtn = this.view.container.querySelector('#generate-perspectives');
    if (perspectivesBtn) {
      const handlePerspectives = () => {
        this.generatePerspectives();
      };
      perspectivesBtn.addEventListener('click', handlePerspectives);
      this.eventListeners.push(() => perspectivesBtn.removeEventListener('click', handlePerspectives));
    }
    
    // Clear Database button
    const clearBtn = this.view.container.querySelector('#clear-database');
    if (clearBtn) {
      const handleClear = () => {
        this.clearDatabase();
      };
      clearBtn.addEventListener('click', handleClear);
      this.eventListeners.push(() => clearBtn.removeEventListener('click', handleClear));
    }
    
    // Load Single Module input and button
    const loadModuleBtn = this.view.container.querySelector('#load-single-module-btn');
    const moduleNameInput = this.view.container.querySelector('#single-module-name');
    if (loadModuleBtn && moduleNameInput) {
      const handleLoadModule = () => {
        const moduleName = moduleNameInput.value.trim();
        if (moduleName) {
          this.loadSingleModule(moduleName);
          moduleNameInput.value = '';
        }
      };
      loadModuleBtn.addEventListener('click', handleLoadModule);
      moduleNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleLoadModule();
        }
      });
      this.eventListeners.push(() => loadModuleBtn.removeEventListener('click', handleLoadModule));
    }
  }
  
  loadAllModules() {
    console.log('🔧 Loading all modules...');
    this.model.updateState('loading', true);
    this.render();
    
    // Get the actor manager from the global app
    const actorManager = window.toolRegistryApp?.getActorManager();
    if (actorManager) {
      actorManager.loadAllModules();
      // Callbacks are already set up in setupCallbacks()
    } else {
      console.error('Actor manager not available');
      this.model.updateState('loading', false);
      this.render();
      alert('WebSocket connection not available. Please check connection.');
    }
  }
  
  refreshRegistry() {
    console.log('🔄 Refreshing registry...');
    const actorManager = window.toolRegistryApp?.getActorManager();
    if (actorManager) {
      actorManager.loadTools();
      actorManager.loadModules();
      // Stats will be automatically sent after tools and modules are loaded
    }
  }
  
  getStats() {
    console.log('📊 Getting stats...');
    const actorManager = window.toolRegistryApp?.getActorManager();
    if (actorManager) {
      actorManager.getRegistryStats();
      // Callback is already set up in setupCallbacks()
    }
  }
  
  clearDatabase() {
    console.log('🗑️ Clearing database...');
    this.model.updateState('loading', true);
    this.render();
    
    const actorManager = window.toolRegistryApp?.getActorManager();
    if (actorManager) {
      actorManager.clearDatabase();
    } else {
      console.error('Actor manager not available');
      this.model.updateState('loading', false);
      this.render();
    }
  }
  
  loadSingleModule(moduleName) {
    console.log(`📦 Loading single module: ${moduleName}`);
    this.model.updateState('loading', true);
    this.render();
    
    const actorManager = window.toolRegistryApp?.getActorManager();
    if (actorManager) {
      actorManager.loadSingleModule(moduleName);
    } else {
      console.error('Actor manager not available');
      this.model.updateState('loading', false);
      this.render();
    }
  }
  
  generatePerspectives() {
    console.log('🔮 Generating perspectives...');
    this.model.updateState('loading', true);
    this.render();
    
    const actorManager = window.toolRegistryApp?.getActorManager();
    if (actorManager) {
      actorManager.generatePerspectives();
    } else {
      console.error('Actor manager not available');
      this.model.updateState('loading', false);
      this.render();
    }
  }
  
  createPublicAPI() {
    return {
      loadAllModules: () => this.loadAllModules(),
      refreshRegistry: () => this.refreshRegistry(),
      getStats: () => this.getStats(),
      generatePerspectives: () => this.generatePerspectives(),
      clearDatabase: () => this.clearDatabase(),
      destroy: () => this.destroy()
    };
  }
  
  destroy() {
    this.eventListeners.forEach(cleanup => cleanup());
    this.view.container.innerHTML = '';
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
  }
}

export const LoadingControlPanel = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onDestroy', 'function', 'Destroy callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'LoadingControlPanel');
    
    const model = new LoadingControlPanelModel(umbilical);
    const view = new LoadingControlPanelView(umbilical.dom);
    const viewModel = new LoadingControlPanelViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};