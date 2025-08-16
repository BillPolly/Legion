/**
 * ToolRegistryBrowser - Root Application Component
 * Complete MVVM architecture following design document specification
 * Main application container that coordinates all child components and manages global application state
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { ToolRegistryModel } from './model/ToolRegistryModel.js';
import { ToolRegistryView } from './view/ToolRegistryView.js';
import { WebSocketActorManager } from '../../actors/WebSocketActorManager.js';

class ToolRegistryViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Child components
    this.components = new Map();
    
    // WebSocket Actor System (will be initialized later with public API)
    this.actorManager = null;
    
    // Cleanup functions
    this.cleanupFunctions = [];
  }
  
  async initialize() {
    try {
      console.log('🚀 ToolRegistryBrowser initializing...');
      
      // Show loading state
      this.view.showLoading();
      
      // Render initial structure
      this.view.render(this.model.getState());
      console.log('📄 Initial structure rendered');
      
      // Initialize WebSocket Actor System (if provided)
      if (this.umbilical.websocketUrl) {
        await this.initializeActorSystem();
      }
      
      // Load child components
      await this.loadChildComponents();
      console.log('🧩 Child components loaded');
      
      // Set up event listeners
      this.setupEventListeners();
      console.log('👂 Event listeners configured');
      
      // Load initial data
      await this.loadInitialData();
      console.log('📊 Initial data loaded');
      
      // Hide loading state
      this.view.hideLoading();
      
      // Notify parent of successful mount
      if (this.umbilical.onMount) {
        this.umbilical.onMount(this.createPublicAPI());
      }
      
      console.log('✅ ToolRegistryBrowser initialized successfully');
      return this.createPublicAPI();
      
    } catch (error) {
      console.error('❌ ToolRegistryBrowser initialization failed:', error);
      this.view.hideLoading();
      this.view.showError(error);
      
      if (this.umbilical.onError) {
        this.umbilical.onError(error);
      }
      
      throw error;
    }
  }
  
  async initializeActorSystem() {
    try {
      console.log('🎭 Initializing WebSocket Actor System...', this.umbilical.websocketUrl);
      
      // Create WebSocket Actor Manager with the public API
      const publicAPI = this.createPublicAPI();
      this.actorManager = new WebSocketActorManager(publicAPI);
      
      // Connect to WebSocket with actor system  
      let wsUrl = this.umbilical.websocketUrl;
      // Ensure the URL ends with /ws for the actor system
      if (!wsUrl.endsWith('/ws')) {
        wsUrl = wsUrl.replace(/\/+$/, '') + '/ws';
      }
      await this.actorManager.connect(wsUrl);
      
      console.log('✅ Actor system connected successfully');
      
    } catch (error) {
      console.warn('⚠️ Actor system connection failed, continuing without real-time data:', error.message);
      this.model.updateState('connectionStatus', 'offline');
      // Don't throw error - app should work offline
    }
  }
  
  async loadChildComponents() {
    console.log('🔄 Loading child components...');
    
    // Load ApplicationHeader
    try {
      const { ApplicationHeader } = await import('./components/ApplicationHeader.js');
      const headerContainer = this.view.getElement('header');
      
      if (headerContainer) {
        const headerInstance = ApplicationHeader.create({
          dom: headerContainer,
          title: this.umbilical.title || '🛠️ Legion Tool Registry',
          subtitle: this.umbilical.subtitle || 'Professional tool management and discovery platform',
          showSearch: true,
          userInfo: this.umbilical.userInfo || { name: 'Developer', initials: 'DV' },
          onMount: () => console.log('✅ ApplicationHeader mounted'),
          onSearch: (query) => {
            console.log('🔍 Global search:', query);
            this.handleGlobalSearch(query);
          },
          onUserClick: () => {
            console.log('👤 User menu clicked');
            if (this.umbilical.onUserAction) {
              this.umbilical.onUserAction('menu');
            }
          }
        });
        
        this.components.set('header', headerInstance);
      }
    } catch (error) {
      console.error('❌ Failed to load ApplicationHeader:', error);
      throw new Error(`ApplicationHeader loading failed: ${error.message}`);
    }
    
    // Load NavigationTabs with Panel Integration
    try {
      const { NavigationTabs } = await import('./components/NavigationTabs.js');
      const mainContainer = this.view.getElement('main');
      
      if (mainContainer) {
        const tabsInstance = await NavigationTabs.create({
          dom: mainContainer,
          tabs: [
            { 
              id: 'loading', 
              title: '🔧 Loading', 
              icon: '🔧',
              label: 'Loading',
              component: 'LoadingControlPanel'
            },
            { 
              id: 'search', 
              title: '🔍 Tool Search', 
              icon: '🔍',
              label: 'Search',
              component: 'ToolSearchPanel'
            },
            { 
              id: 'modules', 
              title: '📦 Module Browser', 
              icon: '📦',
              label: 'Modules',
              component: 'ModuleBrowserPanel'
            },
            { 
              id: 'details', 
              title: '📋 Tool Details', 
              icon: '📋',
              label: 'Details',
              component: 'ToolDetailsPanel'
            },
            { 
              id: 'admin', 
              title: '⚙️ Administration', 
              icon: '⚙️',
              label: 'Admin',
              component: 'AdministrationPanel'
            }
          ],
          activeTab: this.model.getState('currentPanel'),
          variant: 'default',
          showIcons: true,
          onMount: () => console.log('✅ NavigationTabs mounted'),
          onTabChange: (tabId, tab) => {
            console.log(`🔄 Tab changed to: ${tabId}`);
            this.handleTabChange(tabId, tab);
          },
          
          // Provide data accessors for panels
          getTools: () => this.model.getToolsArray(),
          getModules: () => this.model.getModulesArray(),
          getSelectedTool: () => this.model.getState('selectedTool'),
          getSelectedModule: () => this.model.getState('selectedModule'),
          
          // Provide callbacks for panel interactions
          onToolSelect: (tool) => {
            console.log('🔧 Tool selected from panel:', tool.name);
            this.model.updateState('selectedTool', tool);
            
            // Auto-switch to details panel and update it
            this.switchToDetailsPanel();
          },
          onModuleSelect: (module) => {
            console.log('📦 Module selected from panel:', module.name);
            this.model.updateState('selectedModule', module);
          },
          onToolExecute: (tool) => {
            console.log('🚀 Tool execution requested:', tool.name);
            if (this.umbilical.onToolExecute) {
              this.umbilical.onToolExecute(tool);
            }
          },
          onSearch: (query, results) => {
            console.log('🔍 Search performed:', query, 'Results:', results.length);
            this.model.updateState('globalSearchQuery', query);
          },
          
          // Provide semantic search callback
          onSemanticSearch: async (query) => {
            console.log('🧠 Semantic search requested in main component:', query);
            
            // Use the semantic search actor if available
            if (this.actorManager && this.actorManager.getSearchActor()) {
              const searchActor = this.actorManager.getSearchActor();
              
              // Create a promise to wait for search results
              return new Promise((resolve) => {
                // Store the resolver for the search actor to call
                searchActor.searchResultsResolver = resolve;
                
                // Perform the search
                searchActor.searchTools(query, {
                  limit: 20,
                  threshold: 0,
                  includeMetadata: true
                });
                
                // Set a timeout in case results don't come back
                setTimeout(() => {
                  console.warn('⚠️ Semantic search timeout');
                  resolve([]);
                }, 5000);
              });
            }
            
            console.warn('⚠️ Semantic search actor not available');
            return [];
          }
        });
        
        this.components.set('navigation', tabsInstance);
      }
    } catch (error) {
      console.error('❌ Failed to load NavigationTabs:', error);
      throw new Error(`NavigationTabs loading failed: ${error.message}`);
    }
  }
  
  handleTabChange(tabId, tab) {
    const previousTab = this.model.getState('currentPanel');
    this.model.updateState('currentPanel', tabId);
    
    // Clear any selected items when switching tabs  
    if (tabId !== 'details') {
      this.model.updateState('selectedTool', null);
      this.model.updateState('selectedModule', null);
    }
    
    console.log(`📑 Panel switched: ${previousTab} → ${tabId}`);
    
    // Notify parent component
    if (this.umbilical.onTabChange) {
      this.umbilical.onTabChange(tabId, { 
        previousTab, 
        title: tab.title,
        component: tab.component
      });
    }
  }
  
  switchToDetailsPanel() {
    const navigationTabs = this.components.get('navigation');
    if (navigationTabs) {
      // Switch to details tab
      navigationTabs.switchToTab('details');
      
      // Update the details panel with the selected tool
      this.updateDetailsPanel();
    }
  }
  
  async updateDetailsPanel() {
    const navigationTabs = this.components.get('navigation');
    if (!navigationTabs) return;
    
    const selectedTool = this.model.getState('selectedTool');
    
    if (selectedTool) {
      console.log('🔄 Updating details panel with tool:', selectedTool.name);
      
      // Use the NavigationTabs API to update the details component
      navigationTabs.updateComponentState('details', { selectedTool });
    } else {
      console.log('⚠️ No tool selected');
    }
  }
  
  handleGlobalSearch(query) {
    console.log('🌐 Global search triggered:', query);
    
    // Update model state
    this.model.updateState('globalSearchQuery', query);
    
    // If not on search tab, switch to it
    const currentPanel = this.model.getState('currentPanel');
    if (currentPanel !== 'search' && query.trim()) {
      const navigationTabs = this.components.get('navigation');
      if (navigationTabs) {
        navigationTabs.switchToTab('search');
      }
    }
    
    // Propagate search to active panel components
    this.propagateSearchToComponents(query);
    
    // Notify parent
    if (this.umbilical.onGlobalSearch) {
      this.umbilical.onGlobalSearch(query);
    }
  }
  
  propagateSearchToComponents(query) {
    const navigationTabs = this.components.get('navigation');
    if (navigationTabs) {
      const activeTabComponent = navigationTabs.getTabComponent('search');
      if (activeTabComponent && activeTabComponent.search) {
        activeTabComponent.search(query);
      }
    }
  }
  
  setupEventListeners() {
    console.log('👂 Setting up event listeners...');
    
    // Window resize handling  
    const handleResize = () => {
      this.model.updateState('windowDimensions', {
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    this.cleanupFunctions.push(() => window.removeEventListener('resize', handleResize));
    
    // Initial window size
    handleResize();
    
    // Model state change listeners
    this.model.eventEmitter.addEventListener('stateChanged', (event) => {
      this.handleStateChange(event.detail);
    });
    
    // Keyboard shortcuts
    const handleKeyDown = (event) => {
      // Ctrl/Cmd + K = Focus global search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        this.focusGlobalSearch();
      }
      
      // Escape = Clear search
      if (event.key === 'Escape') {
        this.clearGlobalSearch();
      }
      
      // Tab navigation shortcuts
      if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '4') {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;
        const tabs = ['search', 'modules', 'details', 'admin'];
        const navigationTabs = this.components.get('navigation');
        if (navigationTabs && tabs[tabIndex]) {
          navigationTabs.switchToTab(tabs[tabIndex]);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    this.cleanupFunctions.push(() => document.removeEventListener('keydown', handleKeyDown));
  }
  
  handleStateChange(change) {
    const { path, value, oldValue } = change;
    
    console.log('🔄 State changed:', { path, value, oldValue });
    
    // Handle specific state changes that require coordinated updates
    switch (path) {
      case 'currentPanel':
        // Panel changes are handled by NavigationTabs
        break;
        
      case 'connectionStatus':
        console.log(`📡 Connection status: ${oldValue} → ${value}`);
        // Update UI indicators
        break;
        
      case 'selectedTool':
        // When a tool is selected, ensure details panel shows it
        if (value) {
          console.log('🔧 selectedTool state changed, updating details panel');
          this.switchToDetailsPanel();
        }
        break;
        
      case 'errorState':
        if (value) {
          console.error('💥 Application error:', value);
          this.view.showError(value);
        } else {
          this.view.clearError();
        }
        break;
        
      case 'isLoading':
        if (value) {
          this.view.showLoading();
        } else {
          this.view.hideLoading();
        }
        break;
    }
  }
  
  focusGlobalSearch() {
    const header = this.components.get('header');
    if (header) {
      const searchInput = document.querySelector('.global-search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }
  }
  
  clearGlobalSearch() {
    const header = this.components.get('header');
    if (header && header.clearSearch) {
      header.clearSearch();
    }
    this.model.updateState('globalSearchQuery', '');
  }
  
  async loadInitialData() {
    console.log('📥 Loading real data from server via actor system...');
    
    try {
      // If actor system is connected, request real data from server
      if (this.actorManager.isActorSystemConnected()) {
        console.log('🎭 Requesting tools and modules from server actors...');
        
        // The actors will automatically request data when connected
        // Data will be loaded asynchronously via actor messages
        
        // Set initial loading state
        this.model.updateState('isLoading', true);
        
        // Update connection status
        this.model.updateState('connectionStatus', 'connected');
        
        console.log('✅ Data requests sent to server actors');
        
      } else {
        console.log('⚠️ Actor system not connected, using offline mode');
        
        // Set empty data for offline mode
        this.model.setTools([]);
        this.model.setModules([]);
        this.model.updateState('connectionStatus', 'offline');
      }
      
    } catch (error) {
      console.error('❌ Failed to load data from server:', error);
      this.model.updateState('errorState', new Error(`Data loading failed: ${error.message}`));
      this.model.updateState('connectionStatus', 'error');
    }
  }
  
  createPublicAPI() {
    return {
      // State management
      getState: (path) => this.model.getState(path),
      updateState: (path, value) => this.model.updateState(path, value),
      subscribe: (path, callback) => this.model.subscribe(path, callback),
      
      // Navigation
      switchToPanel: (panelId) => {
        const navigationTabs = this.components.get('navigation');
        if (navigationTabs) {
          navigationTabs.switchToTab(panelId);
        }
      },
      getCurrentPanel: () => this.model.getState('currentPanel'),
      
      // Data access
      getTools: () => this.model.getToolsArray(),
      getModules: () => this.model.getModulesArray(),
      getSelectedTool: () => this.model.getState('selectedTool'),
      getSelectedModule: () => this.model.getState('selectedModule'),
      
      // Data updates (called by actors)
      setTools: (tools) => {
        this.model.setTools(tools);
        this.model.updateState('isLoading', false);
        console.log(`🔄 UI updated with ${tools.length} real tools from server`);
        
        // Update the search panel with the new tools
        const navigationTabs = this.components.get('navigation');
        if (navigationTabs) {
          const searchPanel = navigationTabs.getTabComponent('search');
          if (searchPanel && searchPanel.setTools) {
            console.log('🔄 Updating search panel with tools');
            searchPanel.setTools(tools);
          }
        }
      },
      setModules: (modules) => {
        this.model.setModules(modules);
        console.log(`🔄 UI updated with ${modules.length} real modules from server`);
        
        // Update the modules panel with the new modules
        const navigationTabs = this.components.get('navigation');
        if (navigationTabs) {
          const modulesPanel = navigationTabs.getTabComponent('modules');
          if (modulesPanel && modulesPanel.setModules) {
            console.log('🔄 Updating modules panel with modules');
            modulesPanel.setModules(modules);
          }
        }
      },
      
      // Tool and module selection
      selectTool: (tool) => {
        this.model.updateState('selectedTool', tool);
        // Auto-switch to details panel
        const navigationTabs = this.components.get('navigation');
        if (navigationTabs) {
          navigationTabs.switchToTab('details');
        }
      },
      selectModule: (module) => {
        this.model.updateState('selectedModule', module);
      },
      
      // Search
      search: (query) => this.handleGlobalSearch(query),
      getSearchQuery: () => this.model.getState('globalSearchQuery'),
      clearSearch: () => this.clearGlobalSearch(),
      
      // Component access
      getComponent: (name) => this.components.get(name),
      getComponents: () => Array.from(this.components.keys()),
      
      // Connection management
      getConnectionStatus: () => this.model.getState('connectionStatus'),
      reconnect: () => {
        if (this.umbilical.websocketUrl) {
          return this.initializeActorSystem();
        }
      },
      
      // Actor system access
      getActorManager: () => this.actorManager,
      executeTool: (toolName, params) => {
        console.log('🚀 Executing tool via actor system:', toolName, params);
        this.actorManager.executeTool(toolName, params);
      },
      searchToolsSemantic: (query, options = {}) => {
        console.log('🔍 Performing semantic search via actor system:', query);
        this.actorManager.searchTools(query, options);
      },
      
      // Registry control callbacks
      onRegistryLoadComplete: null,
      onRegistryLoadFailed: null,
      onRegistryStats: null,
      
      // Error handling
      showError: (error) => {
        this.model.updateState('errorState', error);
      },
      clearError: () => {
        this.model.updateState('errorState', null);
      },
      
      // Loading states
      showLoading: () => {
        this.model.updateState('isLoading', true);
      },
      hideLoading: () => {
        this.model.updateState('isLoading', false);
      },
      
      // Testing and development
      simulateError: () => {
        const testError = new Error('Simulated error for testing error handling');
        this.showError(testError);
      },
      simulateLoading: (duration = 2000) => {
        this.showLoading();
        setTimeout(() => this.hideLoading(), duration);
      },
      
      // Cleanup
      destroy: () => this.destroy()
    };
  }
  
  destroy() {
    console.log('🧹 Cleaning up ToolRegistryBrowser...');
    
    // Run all cleanup functions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('⚠️ Cleanup function error:', error);
      }
    });
    this.cleanupFunctions = [];
    
    // Destroy child components
    this.components.forEach((component, name) => {
      try {
        if (component && component.destroy) {
          component.destroy();
        }
      } catch (error) {
        console.error(`⚠️ Component ${name} destruction error:`, error);
      }
    });
    this.components.clear();
    
    // Disconnect actor system
    if (this.actorManager) {
      try {
        this.actorManager.disconnect();
      } catch (error) {
        console.error('⚠️ Actor system disconnect error:', error);
      }
    }
    
    // Clean up model
    if (this.model.destroy) {
      this.model.destroy();
    }
    
    // Clear DOM
    this.view.container.innerHTML = '';
    
    // Notify parent of destruction
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    
    console.log('✅ ToolRegistryBrowser destroyed');
  }
}

export const ToolRegistryBrowser = {
  create(umbilical) {
    // 1. Introspection Mode - Component self-documentation
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element for the application');
      requirements.add('websocketUrl', 'string', 'WebSocket URL for real-time data (optional)', false);
      requirements.add('title', 'string', 'Application title (optional)', false);
      requirements.add('subtitle', 'string', 'Application subtitle (optional)', false);
      requirements.add('userInfo', 'object', 'User information object (optional)', false);
      requirements.add('onMount', 'function', 'Callback when application is mounted (optional)', false);
      requirements.add('onDestroy', 'function', 'Callback when application is destroyed (optional)', false);
      requirements.add('onTabChange', 'function', 'Callback when navigation tab changes (optional)', false);
      requirements.add('onGlobalSearch', 'function', 'Callback for global search (optional)', false);
      requirements.add('onUserAction', 'function', 'Callback for user actions (optional)', false);
      requirements.add('onError', 'function', 'Callback for error handling (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode - Verify umbilical capabilities
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidWebSocketUrl: !umbilical.websocketUrl || typeof umbilical.websocketUrl === 'string',
        hasValidTitle: !umbilical.title || typeof umbilical.title === 'string',
        hasValidSubtitle: !umbilical.subtitle || typeof umbilical.subtitle === 'string',
        hasValidUserInfo: !umbilical.userInfo || typeof umbilical.userInfo === 'object'
      });
    }
    
    // 3. Instance Creation Mode - Create the actual component
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ToolRegistryBrowser');
    
    // Create MVVM layers
    const model = new ToolRegistryModel();
    const view = new ToolRegistryView(umbilical.dom);
    const viewModel = new ToolRegistryViewModel(model, view, umbilical);
    
    // Initialize and return public API
    return viewModel.initialize();
  }
};