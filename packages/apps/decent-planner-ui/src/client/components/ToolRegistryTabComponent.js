/**
 * ToolRegistryTabComponent - Tool Registry Management Interface
 * 
 * Top-level tab for comprehensive tool registry management:
 * - Modules sub-tab: Browse, load/unload modules
 * - Tools sub-tab: Browse tools, search, test execution
 * - Database inspection and module discovery
 */

import { TabsComponent } from './TabsComponent.js';
import { ModuleBrowserPanel } from './ModuleBrowserPanel.js';
import { ToolsBrowserComponent } from './ToolsBrowserComponent.js';

export class ToolRegistryTabComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // Model
    this.model = {
      activeSubTab: 'modules',
      modules: [],
      tools: [],
      registryStats: null,
      connected: false
    };
    
    // View elements
    this.elements = {};
    this.components = {};
    
    this.createView();
    this.initializeComponents();
  }

  /**
   * Create the main tool registry interface
   */
  createView() {
    this.container.innerHTML = '';
    
    // Main container
    this.elements.mainContainer = document.createElement('div');
    this.elements.mainContainer.className = 'tool-registry-container';
    this.elements.mainContainer.style.height = '100%';
    this.elements.mainContainer.style.display = 'flex';
    this.elements.mainContainer.style.flexDirection = 'column';
    
    // Header with title and stats
    const headerDiv = document.createElement('div');
    headerDiv.className = 'tool-registry-header';
    headerDiv.style.padding = '16px';
    headerDiv.style.borderBottom = '1px solid #e5e7eb';
    headerDiv.style.backgroundColor = '#f9fafb';
    
    const titleH2 = document.createElement('h2');
    titleH2.textContent = '🛠️ Tool Registry Management';
    titleH2.style.margin = '0 0 8px 0';
    titleH2.style.fontSize = '20px';
    titleH2.style.color = '#1f2937';
    
    this.elements.statsDiv = document.createElement('div');
    this.elements.statsDiv.className = 'tool-registry-stats';
    this.elements.statsDiv.style.fontSize = '14px';
    this.elements.statsDiv.style.color = '#6b7280';
    this.elements.statsDiv.textContent = 'Loading registry status...';
    
    headerDiv.appendChild(titleH2);
    headerDiv.appendChild(this.elements.statsDiv);
    
    // Sub-tabs container
    this.elements.tabsContainer = document.createElement('div');
    this.elements.tabsContainer.className = 'tool-registry-tabs';
    this.elements.tabsContainer.style.flex = '1';
    this.elements.tabsContainer.style.overflow = 'hidden';
    
    // Assemble view
    this.elements.mainContainer.appendChild(headerDiv);
    this.elements.mainContainer.appendChild(this.elements.tabsContainer);
    this.container.appendChild(this.elements.mainContainer);
  }

  /**
   * Initialize sub-components
   */
  initializeComponents() {
    // Create sub-tabs for Modules and Tools
    this.components.tabs = new TabsComponent(this.elements.tabsContainer, {
      tabs: [
        { 
          id: 'modules', 
          label: 'Modules',
          icon: '📦'
        },
        { 
          id: 'tools', 
          label: 'Tools',
          icon: '🔧'
        }
      ],
      activeTab: this.model.activeSubTab,
      onTabChange: (tabId) => this.handleSubTabChange(tabId)
    });
    
    // Initialize new module browser panel
    const modulesContainer = this.components.tabs.getContentContainer('modules');
    if (modulesContainer) {
      this.components.modules = new ModuleBrowserPanel(modulesContainer, {
        modules: this.model.modules,
        onSearchModules: (query) => this.handleModuleSearch(query),
        onModuleSelect: (module) => this.handleModuleSelect(module),
        onMount: (api) => {
          console.log('📦 ModuleBrowserPanel mounted in decent planner');
          this.modulesBrowserAPI = api;
        }
      });
    }
    
    // Initialize tools browser component  
    const toolsContainer = this.components.tabs.getContentContainer('tools');
    if (toolsContainer) {
      this.components.tools = new ToolsBrowserComponent(toolsContainer, {
        remoteActor: this.options.remoteActor,
        onToolTest: (toolName, params) => this.handleToolTest(toolName, params),
        onSearch: (query, type) => this.handleToolSearch(query, type)
      });
    }
    
    // Load initial data
    this.loadRegistryData();
  }

  /**
   * Handle sub-tab changes
   */
  handleSubTabChange(tabId) {
    this.model.activeSubTab = tabId;
    
    if (this.options.onSubTabChange) {
      this.options.onSubTabChange(tabId);
    }
  }

  /**
   * Handle module search (new backend search)
   */
  handleModuleSearch(query) {
    console.log(`Tool Registry: Module search requested: "${query}"`);
    
    if (this.options.onModuleSearch) {
      this.options.onModuleSearch(query);
    }
  }
  
  /**
   * Handle module selection
   */
  handleModuleSelect(module) {
    console.log(`Tool Registry: Module selected:`, module.name);
    
    if (this.options.onModuleSelect) {
      this.options.onModuleSelect(module);
    }
  }

  /**
   * Handle tool testing
   */
  handleToolTest(toolName, params) {
    console.log(`Tool Registry: Testing tool ${toolName}`, params);
    
    if (this.options.onToolTest) {
      this.options.onToolTest(toolName, params);
    }
  }

  /**
   * Handle tool search
   */
  handleToolSearch(query, searchType) {
    console.log(`Tool Registry: Searching tools - ${searchType}: "${query}"`);
    
    if (this.options.onToolSearch) {
      this.options.onToolSearch(query, searchType);
    }
  }

  /**
   * Load registry data
   */
  loadRegistryData() {
    if (this.options.onLoadData) {
      this.options.onLoadData();
    }
  }

  /**
   * Refresh modules list (trigger search for all)
   */
  refreshModules() {
    console.log('Tool Registry: Refreshing modules list via search');
    this.handleModuleSearch(''); // Search for all modules
  }

  /**
   * Update registry statistics
   */
  updateStats(stats) {
    this.model.registryStats = stats;
    
    if (stats) {
      this.elements.statsDiv.textContent = 
        `📦 ${stats.totalModules} modules • 🔧 ${stats.totalTools} tools • 📝 ${stats.perspectivesGenerated || 0} perspectives • 🎯 ${stats.vectorsIndexed || 0} vectors`;
    } else {
      this.elements.statsDiv.textContent = 'Registry status unavailable';
    }
  }

  /**
   * Update modules list (new API)
   */
  updateModules(modules) {
    this.model.modules = modules;
    
    if (this.components.modules && this.components.modules.setModules) {
      this.components.modules.setModules(modules);
    }
  }

  /**
   * Update tools list
   */
  updateTools(tools) {
    this.model.tools = tools;
    
    if (this.components.tools) {
      this.components.tools.updateTools(tools);
    }
  }

  /**
   * Set connection status
   */
  setConnected(connected) {
    this.model.connected = connected;
    
    // Note: ModuleBrowserPanel doesn't have setConnected method
    // Connection status is handled through data flow
    
    if (this.components.tools && this.components.tools.setConnected) {
      this.components.tools.setConnected(connected);
    }
  }

  /**
   * Set remote actor for communication
   * @param {Object} remoteActor - Remote actor instance
   */
  setRemoteActor(remoteActor) {
    this.options.remoteActor = remoteActor;
    
    if (this.components.tools && this.components.tools.setRemoteActor) {
      this.components.tools.setRemoteActor(remoteActor);
    }
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      activeSubTab: this.model.activeSubTab,
      moduleCount: this.model.modules.length,
      toolCount: this.model.tools.length,
      connected: this.model.connected,
      hasStats: !!this.model.registryStats
    };
  }
}