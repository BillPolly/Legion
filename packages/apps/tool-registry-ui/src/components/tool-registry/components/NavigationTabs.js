/**
 * NavigationTabs Component - MVVM Implementation
 * Provides tabbed navigation for the tool registry application
 * Following the design document specification
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

class NavigationTabsModel {
  constructor(options = {}) {
    this.state = {
      tabs: options.tabs || [],
      activeTab: options.activeTab || (options.tabs?.[0]?.id || null),
      isCollapsed: false
    };
  }
  
  updateState(path, value) {
    const keys = path.split('.');
    let current = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  
  getState(path = '') {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
}

class NavigationTabsView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
    this.elements = new Map();
  }
  
  generateCSS() {
    return `
      .navigation-tabs-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
      
      .navigation-tabs-container {
        display: flex;
        background: var(--surface-primary);
        border-bottom: 0.125rem solid var(--border-subtle);
        min-height: 4rem;
        position: relative;
        flex-shrink: 0;
      }
      
      .tab-content-area {
        flex: 1;
        position: relative;
        overflow: hidden;
        background: var(--surface-secondary);
        min-height: 0; /* Important for flex items */
      }
      
      .navigation-tabs-list {
        display: flex;
        width: 100%;
        gap: 0;
        padding: 0 1rem;
        align-items: stretch;
      }
      
      .navigation-tab {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 1.5rem;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
        color: var(--text-secondary);
        white-space: nowrap;
        flex: 1;
        justify-content: center;
        font-family: inherit;
        text-decoration: none;
        outline: none;
        min-height: 4rem;
      }
      
      .navigation-tab:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
        transform: translateY(-0.0625rem);
      }
      
      .navigation-tab:focus {
        outline: 0.125rem solid var(--color-primary);
        outline-offset: -0.125rem;
      }
      
      .navigation-tab.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
        background: var(--surface-secondary);
        font-weight: 600;
      }
      
      .navigation-tab.active:hover {
        transform: none;
      }
      
      .tab-icon {
        font-size: var(--font-md);
        line-height: 1;
        flex-shrink: 0;
      }
      
      .tab-label {
        font-weight: 500;
        line-height: 1.4;
      }
      
      .navigation-tab.active .tab-label {
        font-weight: 600;
      }
      
      /* Badge for notifications or counts */
      .tab-badge {
        background: var(--color-error);
        color: white;
        border-radius: 50%;
        min-width: clamp(1rem, 2vw, 1.25rem);
        height: clamp(1rem, 2vw, 1.25rem);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--font-xs);
        font-weight: 600;
        margin-left: var(--spacing-xs);
      }
      
      /* Tab Panels */
      .tab-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        opacity: 0;
        visibility: hidden;
        transform: translateX(0.625rem);
        transition: all 0.3s ease;
        background: var(--surface-secondary);
        padding: 0;
        overflow: auto;
      }
      
      .tab-panel.active {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
        z-index: 1;
      }
      
      .tab-panel.entering {
        opacity: 0;
        transform: translateX(0.625rem);
      }
      
      .tab-panel.exiting {
        opacity: 0;
        transform: translateX(-0.625rem);
      }
      
      /* Panel Loading State */
      .tab-panel-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-secondary);
        gap: var(--spacing-md);
      }
      
      .tab-panel-loading .loading-spinner {
        width: clamp(2rem, 5vw, 3rem);
        height: clamp(2rem, 5vw, 3rem);
        border: 0.25rem solid var(--border-subtle);
        border-top: 0.25rem solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Panel Error State */
      .tab-panel-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-secondary);
        text-align: center;
        padding: var(--spacing-xl);
        gap: var(--spacing-md);
      }
      
      .tab-panel-error .error-icon {
        font-size: var(--font-xxl);
        color: var(--color-error);
      }
      
      .tab-panel-error .error-title {
        font-size: var(--font-lg);
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .tab-panel-error .error-message {
        font-size: var(--font-md);
        color: var(--text-secondary);
        max-width: 30rem;
        line-height: 1.6;
      }
      
      /* Responsive Design */
      @media (max-width: 48rem) {
        .navigation-tabs-list {
          padding: 0 var(--spacing-sm);
        }
        
        .navigation-tab {
          min-width: clamp(6rem, 20vw, 8rem);
          padding: var(--spacing-sm) var(--spacing-md);
          font-size: var(--font-xs);
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        
        .tab-label {
          display: none;
        }
        
        .tab-icon {
          font-size: var(--font-lg);
        }
      }
      
      @media (max-width: 30rem) {
        .navigation-tab {
          min-width: clamp(4rem, 25vw, 6rem);
          padding: var(--spacing-xs) var(--spacing-sm);
        }
        
        .tab-icon {
          font-size: var(--font-md);
        }
      }
      
      /* Animation for tab switching */
      .navigation-tabs-container::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        height: 0.1875rem;
        background: var(--color-primary);
        transition: all 0.3s ease;
        opacity: 0;
      }
      
      /* Loading state */
      .navigation-tabs-container.loading {
        opacity: 0.7;
        pointer-events: none;
      }
      
      .navigation-tabs-container.loading::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 0.125rem;
        background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
        animation: loading-sweep 2s ease-in-out infinite;
      }
      
      @keyframes loading-sweep {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'navigation-tabs-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'navigation-tabs-wrapper';
    
    // Create the navigation tabs header
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'navigation-tabs-container';
    
    if (modelData.tabs && modelData.tabs.length > 0) {
      const tabsList = this.createTabsList(modelData);
      tabsContainer.appendChild(tabsList);
      this.elements.set('tabsList', tabsList);
    }
    
    // Create the content area for panels
    const contentArea = document.createElement('div');
    contentArea.className = 'tab-content-area';
    
    // Create panels for each tab
    if (modelData.tabs && modelData.tabs.length > 0) {
      modelData.tabs.forEach(tab => {
        const panel = this.createTabPanel(tab, modelData);
        contentArea.appendChild(panel);
      });
    }
    
    this.elements.set('content', contentArea);
    
    // Assemble the complete structure
    this.container.appendChild(tabsContainer);
    this.container.appendChild(contentArea);
    
    return this.container;
  }
  
  createTabsList(modelData) {
    const tabsList = document.createElement('div');
    tabsList.className = 'navigation-tabs-list';
    tabsList.setAttribute('role', 'tablist');
    
    modelData.tabs.forEach((tab, index) => {
      const tabElement = this.createTabElement(tab, modelData.activeTab, index);
      tabsList.appendChild(tabElement);
    });
    
    return tabsList;
  }
  
  createTabElement(tab, activeTab, index) {
    const tabElement = document.createElement('button');
    tabElement.className = `navigation-tab${tab.id === activeTab ? ' active' : ''}`;
    tabElement.dataset.tabId = tab.id;
    tabElement.setAttribute('role', 'tab');
    tabElement.setAttribute('aria-selected', tab.id === activeTab ? 'true' : 'false');
    tabElement.setAttribute('aria-controls', `panel-${tab.id}`);
    tabElement.setAttribute('id', `tab-${tab.id}`);
    tabElement.setAttribute('tabindex', tab.id === activeTab ? '0' : '-1');
    
    // Add accessible label
    const label = tab.label || tab.id;
    tabElement.setAttribute('aria-label', label);
    
    // Icon
    if (tab.icon) {
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = tab.icon;
      icon.setAttribute('aria-hidden', 'true');
      tabElement.appendChild(icon);
    }
    
    // Label
    const labelElement = document.createElement('span');
    labelElement.className = 'tab-label';
    labelElement.textContent = label;
    tabElement.appendChild(labelElement);
    
    // Badge (if provided)
    if (tab.badge !== undefined && tab.badge !== null) {
      const badge = document.createElement('span');
      badge.className = 'tab-badge';
      badge.textContent = tab.badge;
      badge.setAttribute('aria-label', `${tab.badge} notifications`);
      tabElement.appendChild(badge);
    }
    
    return tabElement;
  }
  
  createTabPanel(tab, modelData) {
    const panel = document.createElement('div');
    panel.className = `tab-panel${tab.id === modelData.activeTab ? ' active' : ''}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${tab.id}`);
    panel.id = `panel-${tab.id}`;
    panel.dataset.tabId = tab.id;
    
    // Initially show loading state
    this.showPanelLoading(panel, tab);
    
    return panel;
  }
  
  showPanelLoading(panel, tab) {
    panel.innerHTML = `
      <div class="tab-panel-loading">
        <div class="loading-spinner"></div>
        <div>Loading ${tab.title}...</div>
      </div>
    `;
  }
  
  showPanelError(panel, tab, error) {
    panel.innerHTML = `
      <div class="tab-panel-error">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Failed to Load ${tab.title}</div>
        <div class="error-message">${error.message || 'An unexpected error occurred'}</div>
      </div>
    `;
  }
  
  showPanelContent(panel, contentElement) {
    panel.innerHTML = '';
    panel.appendChild(contentElement);
  }
  
  updateActiveTab(tabId) {
    // Update tab buttons
    const tabs = this.elements.get('tabsList')?.querySelectorAll('.navigation-tab');
    tabs?.forEach(tab => {
      const isActive = tab.dataset.tabId === tabId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    
    // Update panels
    const panels = this.elements.get('content')?.querySelectorAll('.tab-panel');
    panels?.forEach(panel => {
      const isActive = panel.dataset.tabId === tabId;
      panel.classList.toggle('active', isActive);
    });
  }
  
  getPanelElement(tabId) {
    return this.elements.get('content')?.querySelector(`[data-tab-id="${tabId}"]`);
  }
  
  showLoading() {
    this.container.classList.add('loading');
  }
  
  hideLoading() {
    this.container.classList.remove('loading');
  }
}

class NavigationTabsViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.eventListeners = [];
    this.panelComponents = new Map(); // Store loaded panel component instances
    this.loadingPromises = new Map(); // Track loading promises to avoid duplicate loads
  }
  
  async initialize() {
    this.render();
    this.setupEventListeners();
    
    // Load the initial active panel
    const activeTab = this.model.getState('activeTab');
    if (activeTab) {
      await this.loadPanelContent(activeTab);
    }
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
  }
  
  render() {
    this.view.render(this.model.getState());
  }
  
  setupEventListeners() {
    // Tab click handling
    const handleTabClick = (event) => {
      const tabElement = event.target.closest('.navigation-tab');
      if (tabElement) {
        const tabId = tabElement.dataset.tabId;
        this.switchTab(tabId);
      }
    };
    
    // Keyboard navigation
    const handleKeyDown = (event) => {
      const tabElement = event.target.closest('.navigation-tab');
      if (!tabElement) return;
      
      const tabs = Array.from(this.view.container.querySelectorAll('.navigation-tab'));
      const currentIndex = tabs.indexOf(tabElement);
      let newIndex = currentIndex;
      
      switch (event.key) {
        case 'ArrowLeft':
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          event.preventDefault();
          break;
        case 'ArrowRight':
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          event.preventDefault();
          break;
        case 'Home':
          newIndex = 0;
          event.preventDefault();
          break;
        case 'End':
          newIndex = tabs.length - 1;
          event.preventDefault();
          break;
        case 'Enter':
        case ' ':
          this.switchTab(tabElement.dataset.tabId);
          event.preventDefault();
          break;
      }
      
      if (newIndex !== currentIndex) {
        tabs[newIndex].focus();
      }
    };
    
    this.view.container.addEventListener('click', handleTabClick);
    this.view.container.addEventListener('keydown', handleKeyDown);
    
    this.eventListeners.push(() => {
      this.view.container.removeEventListener('click', handleTabClick);
      this.view.container.removeEventListener('keydown', handleKeyDown);
    });
  }
  
  async switchTab(tabId) {
    const previousTab = this.model.getState('activeTab');
    if (previousTab === tabId) return;
    
    const tabs = this.model.getState('tabs');
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // Update model and view
    this.model.updateState('activeTab', tabId);
    this.view.updateActiveTab(tabId);
    
    // Load panel content if not already loaded
    await this.loadPanelContent(tabId);
    
    // Notify parent component
    if (this.umbilical.onTabChange) {
      this.umbilical.onTabChange(tabId, tab);
    }
  }
  
  async loadPanelContent(tabId) {
    // Check if already loading
    if (this.loadingPromises.has(tabId)) {
      return await this.loadingPromises.get(tabId);
    }
    
    // Check if already loaded
    if (this.panelComponents.has(tabId)) {
      return this.panelComponents.get(tabId);
    }
    
    const tabs = this.model.getState('tabs');
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const panel = this.view.getPanelElement(tabId);
    if (!panel) return;
    
    // Create loading promise
    const loadingPromise = this.loadTabComponent(tab, panel);
    this.loadingPromises.set(tabId, loadingPromise);
    
    try {
      const componentInstance = await loadingPromise;
      this.panelComponents.set(tabId, componentInstance);
      return componentInstance;
    } catch (error) {
      console.error(`Failed to load panel ${tabId}:`, error);
      this.view.showPanelError(panel, tab, error);
    } finally {
      this.loadingPromises.delete(tabId);
    }
  }
  
  async loadTabComponent(tab, panel) {
    // Dynamic import based on tab configuration
    const componentName = tab.component;
    if (!componentName) {
      throw new Error(`No component specified for tab ${tab.id}`);
    }
    
    try {
      console.log(`🔄 Loading panel component: ${componentName}`);
      
      // Import the panel component
      const module = await import(`./panels/${componentName}.js`);
      const ComponentClass = module[componentName];
      
      if (!ComponentClass) {
        throw new Error(`Component ${componentName} not found in module`);
      }
      
      // Create a container for the component within the panel
      const componentContainer = document.createElement('div');
      componentContainer.className = `panel-component ${componentName.toLowerCase()}`;
      
      // Create the component instance with enhanced umbilical
      const umbilicalConfig = {
        dom: componentContainer,
        onMount: () => {
          console.log(`✅ Panel component ${componentName} mounted`);
        },
        onError: (error) => {
          console.error(`❌ Panel component ${componentName} error:`, error);
          this.view.showPanelError(panel, tab, error);
        }
      };
      
      // Add component-specific configurations
      if (componentName === 'PlanningWorkspacePanel') {
        // Planning workspace configuration
        umbilicalConfig.planningActor = this.umbilical.planningActor;
        umbilicalConfig.executionActor = this.umbilical.executionActor;
        umbilicalConfig.toolRegistryActor = this.umbilical.toolRegistryActor;
        
        // Planning callbacks
        umbilicalConfig.onPlanCreate = (plan) => {
          if (this.umbilical.onPlanCreate) {
            this.umbilical.onPlanCreate(plan);
          }
        };
        
        umbilicalConfig.onPlanComplete = (plan) => {
          if (this.umbilical.onPlanComplete) {
            this.umbilical.onPlanComplete(plan);
          }
        };
        
        umbilicalConfig.onExecutionStart = (executionId) => {
          if (this.umbilical.onExecutionStart) {
            this.umbilical.onExecutionStart(executionId);
          }
        };
        
        umbilicalConfig.onDecompositionNode = (data) => {
          // Forward to visualization panels if loaded
          const visualizationPanel = this.panelComponents.get('visualization');
          const progressPanel = this.panelComponents.get('progress');
          
          if (visualizationPanel && visualizationPanel.api) {
            visualizationPanel.api.handleDecompositionNode(data);
          }
          
          if (progressPanel && progressPanel.api) {
            progressPanel.api.updateTaskProgress(data.node.id, {
              status: 'pending',
              progress: 0
            });
          }
        };
        
      } else if (componentName === 'PlanVisualizationPanel') {
        // Visualization panel configuration
        umbilicalConfig.onViewChange = (mode) => {
          console.log('📊 Visualization view mode changed:', mode);
        };
        
        umbilicalConfig.onLayoutChange = (layout) => {
          console.log('📊 Visualization layout changed:', layout);
        };
        
        umbilicalConfig.onNodeClick = (node) => {
          console.log('📊 Node clicked:', node.id);
          if (this.umbilical.onNodeSelect) {
            this.umbilical.onNodeSelect(node);
          }
        };
        
        umbilicalConfig.onNodeHover = (node) => {
          if (this.umbilical.onNodeHover) {
            this.umbilical.onNodeHover(node);
          }
        };
        
      } else if (componentName === 'ProgressOverlayPanel') {
        // Progress overlay configuration
        umbilicalConfig.onExecutionStart = (executionId) => {
          if (this.umbilical.onExecutionStart) {
            this.umbilical.onExecutionStart(executionId);
          }
        };
        
        umbilicalConfig.onExecutionComplete = (executionId) => {
          if (this.umbilical.onExecutionComplete) {
            this.umbilical.onExecutionComplete(executionId);
          }
        };
        
        umbilicalConfig.onTaskProgress = (taskId, progress) => {
          // Forward to workspace panel
          const workspacePanel = this.panelComponents.get('planning');
          if (workspacePanel && workspacePanel.api) {
            workspacePanel.api.handleTaskProgress(taskId, progress);
          }
        };
        
      } else if (componentName === 'ExecutionControlPanel') {
        // Execution control configuration
        umbilicalConfig.executionActor = this.umbilical.executionActor;
        umbilicalConfig.planningActor = this.umbilical.planningActor;
        
        umbilicalConfig.onExecutionStart = (executionId) => {
          // Notify progress overlay
          const progressPanel = this.panelComponents.get('progress');
          if (progressPanel && progressPanel.api) {
            progressPanel.api.startExecution(executionId, []);
          }
          
          if (this.umbilical.onExecutionStart) {
            this.umbilical.onExecutionStart(executionId);
          }
        };
        
        umbilicalConfig.onExecutionComplete = (executionId) => {
          const progressPanel = this.panelComponents.get('progress');
          if (progressPanel && progressPanel.api) {
            progressPanel.api.stopExecution();
          }
          
          if (this.umbilical.onExecutionComplete) {
            this.umbilical.onExecutionComplete(executionId);
          }
        };
        
      } else if (componentName === 'PlanLibraryPanel') {
        // Plan library configuration
        umbilicalConfig.planningActor = this.umbilical.planningActor;
        
        umbilicalConfig.onPlanLoad = (plan) => {
          // Load plan into workspace
          const workspacePanel = this.panelComponents.get('planning');
          if (workspacePanel && workspacePanel.api) {
            workspacePanel.api.setCurrentPlan(plan);
          }
          
          // Load plan into visualization
          const visualizationPanel = this.panelComponents.get('visualization');
          if (visualizationPanel && visualizationPanel.api) {
            visualizationPanel.api.setPlan(plan);
          }
          
          // Load plan into execution control
          const executionPanel = this.panelComponents.get('execution');
          if (executionPanel && executionPanel.api) {
            executionPanel.api.setPlan(plan);
          }
          
          // Switch to planning workspace
          this.switchTab('planning');
          
          if (this.umbilical.onPlanLoad) {
            this.umbilical.onPlanLoad(plan);
          }
        };
        
        umbilicalConfig.onPlanEdit = (plan) => {
          this.switchTab('planning');
          if (this.umbilical.onPlanEdit) {
            this.umbilical.onPlanEdit(plan);
          }
        };
        
        umbilicalConfig.onCreateNewPlan = () => {
          this.switchTab('planning');
          if (this.umbilical.onCreateNewPlan) {
            this.umbilical.onCreateNewPlan();
          }
        };
        
        umbilicalConfig.onPlanImported = (plan) => {
          if (this.umbilical.onPlanImported) {
            this.umbilical.onPlanImported(plan);
          }
        };
        
      } else if (componentName === 'ToolDetailsPanel') {
        // Pass current global state to ToolDetailsPanel
        const selectedTool = this.umbilical.getSelectedTool ? this.umbilical.getSelectedTool() : null;
        umbilicalConfig.selectedTool = selectedTool;
        
        // Provide execution callback
        umbilicalConfig.onExecute = (tool) => {
          if (this.umbilical.onToolExecute) {
            this.umbilical.onToolExecute(tool);
          }
        };
      } else if (componentName === 'ToolSearchPanel') {
        // Pass available tools to search panel
        const tools = this.umbilical.getTools ? this.umbilical.getTools() : [];
        umbilicalConfig.tools = tools;
        
        // Provide tool selection callback
        umbilicalConfig.onToolSelect = (tool) => {
          console.log('🔧 Tool selected in search panel:', tool.name);
          if (this.umbilical.onToolSelect) {
            this.umbilical.onToolSelect(tool);
          }
        };
        
        // Provide semantic search callback
        umbilicalConfig.onSemanticSearch = async (query) => {
          console.log('🧠 Semantic search requested:', query);
          if (this.umbilical.onSemanticSearch) {
            return await this.umbilical.onSemanticSearch(query);
          }
          return null;
        };
        
        // Provide search callback
        umbilicalConfig.onSearch = (query, results) => {
          if (this.umbilical.onSearch) {
            this.umbilical.onSearch(query, results);
          }
        };
      } else if (componentName === 'ModuleBrowserPanel') {
        // Pass available modules to browser panel
        const modules = this.umbilical.getModules ? this.umbilical.getModules() : [];
        umbilicalConfig.modules = modules;
        
        // Provide module selection callback
        umbilicalConfig.onModuleSelect = (module) => {
          if (this.umbilical.onModuleSelect) {
            this.umbilical.onModuleSelect(module);
          }
        };
      }
      
      const componentInstance = ComponentClass.create(umbilicalConfig);
      
      // Show the component in the panel
      this.view.showPanelContent(panel, componentContainer);
      
      console.log(`✅ Panel component ${componentName} loaded successfully`);
      return componentInstance;
      
    } catch (error) {
      console.error(`❌ Failed to load component ${componentName}:`, error);
      
      // Show error fallback content
      const errorContainer = document.createElement('div');
      errorContainer.className = 'panel-component-fallback';
      errorContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
          <h3>🚧 ${tab.title} Coming Soon</h3>
          <p>This panel is under development.</p>
          <small>Component: ${componentName}</small>
        </div>
      `;
      
      this.view.showPanelContent(panel, errorContainer);
      
      return {
        destroy: () => {
          errorContainer.remove();
        }
      };
    }
  }
  
  createPublicAPI() {
    return {
      // Tab Management
      switchTab: (tabId) => this.switchTab(tabId),
      switchToTab: (tabId) => this.switchTab(tabId), // Alias for compatibility
      getActiveTab: () => this.model.getState('activeTab'),
      getTabs: () => this.model.getState('tabs'),
      
      // Tab Modification
      addTab: (tab) => {
        const tabs = [...this.model.getState('tabs'), tab];
        this.model.updateState('tabs', tabs);
        this.render();
      },
      removeTab: (tabId) => {
        const tabs = this.model.getState('tabs').filter(t => t.id !== tabId);
        this.model.updateState('tabs', tabs);
        
        // If removing active tab, switch to first available tab
        if (this.model.getState('activeTab') === tabId && tabs.length > 0) {
          this.switchTab(tabs[0].id);
        }
        
        this.render();
      },
      updateTab: (tabId, updates) => {
        const tabs = this.model.getState('tabs').map(tab => 
          tab.id === tabId ? { ...tab, ...updates } : tab
        );
        this.model.updateState('tabs', tabs);
        this.render();
      },
      
      // Component Access
      getTabComponent: (tabId) => this.panelComponents.get(tabId),
      loadPanelContent: (tabId) => this.loadPanelContent(tabId),
      
      // Global State Updates
      updateComponentState: (tabId, updates) => {
        const component = this.panelComponents.get(tabId);
        if (component) {
          if (tabId === 'details' && updates.selectedTool && component.setSelectedTool) {
            console.log('🔄 NavigationTabs updating ToolDetailsPanel with selected tool:', updates.selectedTool.name);
            component.setSelectedTool(updates.selectedTool);
          } else if (tabId === 'search' && updates.tools && component.setTools) {
            component.setTools(updates.tools);
          } else if (tabId === 'modules' && updates.modules && component.setModules) {
            component.setModules(updates.modules);
          }
        }
      },
      
      // State
      getState: (path) => this.model.getState(path),
      
      // UI State
      showLoading: () => this.view.showLoading(),
      hideLoading: () => this.view.hideLoading(),
      
      // Cleanup
      destroy: () => this.destroy()
    };
  }
  
  destroy() {
    // Clean up event listeners
    this.eventListeners.forEach(cleanup => cleanup());
    
    // Destroy panel components
    this.panelComponents.forEach((component, tabId) => {
      try {
        if (component && component.destroy) {
          component.destroy();
        }
      } catch (error) {
        console.error(`Error destroying panel component ${tabId}:`, error);
      }
    });
    this.panelComponents.clear();
    
    // Clear loading promises
    this.loadingPromises.clear();
    
    // Clear view
    this.view.container.innerHTML = '';
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
  }
}

export const NavigationTabs = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('tabs', 'array', 'Array of tab configurations');
      requirements.add('activeTab', 'string', 'Initial active tab ID (optional)', false);
      requirements.add('onTabChange', 'function', 'Tab change callback (optional)', false);
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onDestroy', 'function', 'Destroy callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasTabsArray: Array.isArray(umbilical.tabs),
        hasValidTabs: umbilical.tabs?.every(tab => tab.id && tab.label)
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'tabs'], 'NavigationTabs');
    
    const model = new NavigationTabsModel(umbilical);
    const view = new NavigationTabsView(umbilical.dom);
    const viewModel = new NavigationTabsViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};