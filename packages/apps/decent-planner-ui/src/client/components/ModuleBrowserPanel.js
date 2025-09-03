/**
 * ModuleBrowserPanel Component - MVVM Implementation
 * Browse and manage tool modules with detailed information
 * Following the design document specification
 */

// Note: Using simplified component pattern for decent-planner-ui
// No external umbilical dependencies

/**
 * Generic module name formatting - works for any module
 * ConanTheDeployerModule → "Conan The Deployer"
 * AIGenerationModule → "AI Generation"
 * JSGeneratorModule → "JS Generator"
 */
function formatModuleName(rawName) {
  if (!rawName) return 'Unknown Module';
  
  // Remove "Module" suffix
  let name = rawName.replace(/Module$/, '');
  
  // Handle special acronyms that should stay uppercase
  const acronyms = ['AI', 'API', 'JS', 'CSS', 'HTML', 'JSON', 'XML', 'HTTP', 'URL', 'UI', 'DB', 'SQL'];
  
  // Split camelCase into words
  let formatted = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Handle multiple uppercase letters (e.g., "AI" in "AIGeneration")
  formatted = formatted.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  
  // Split into words and process each
  const words = formatted.split(/\s+/);
  const processedWords = words.map(word => {
    // Keep acronyms uppercase
    if (acronyms.includes(word.toUpperCase())) {
      return word.toUpperCase();
    }
    // Capitalize first letter of regular words
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return processedWords.join(' ');
}

class ModuleBrowserPanelModel {
  constructor(options = {}) {
    this.state = {
      modules: options.modules || [],
      filteredModules: options.modules || [],
      selectedModule: null,
      expandedModules: new Set(), // Track which modules are expanded
      searchQuery: '',
      sortBy: 'name', // name, toolCount, status
      filterBy: 'all', // all, active, inactive, error
      viewMode: 'grid' // grid, list
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
    
    // Auto-update filtered modules when search or filters change
    if (path === 'searchQuery' || path === 'sortBy' || path === 'filterBy') {
      this.updateFilteredModules();
    }
  }
  
  getState(path = '') {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
  
  updateFilteredModules() {
    const query = this.state.searchQuery.toLowerCase();
    const filterBy = this.state.filterBy;
    const sortBy = this.state.sortBy;
    
    let filtered = this.state.modules.filter(module => {
      // Text search across name, description, and tools
      const searchableText = [
        module.name,
        module.description || '',
        ...(module.tools || []).map(tool => typeof tool === 'string' ? tool : tool.name || '')
      ].join(' ').toLowerCase();
      
      const matchesQuery = !query || searchableText.includes(query);
      
      // Status filter
      const matchesFilter = filterBy === 'all' || (module.status || 'active') === filterBy;
      
      return matchesQuery && matchesFilter;
    });
    
    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'toolCount':
          return ((b.tools || []).length) - ((a.tools || []).length);
        case 'status':
          return (a.status || 'active').localeCompare(b.status || 'active');
        default:
          return 0;
      }
    });
    
    this.state.filteredModules = filtered;
  }
  
  toggleModuleExpansion(moduleName) {
    if (this.state.expandedModules.has(moduleName)) {
      this.state.expandedModules.delete(moduleName);
    } else {
      this.state.expandedModules.add(moduleName);
    }
  }
  
  isModuleExpanded(moduleName) {
    return this.state.expandedModules.has(moduleName);
  }
}

class ModuleBrowserPanelView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  generateCSS() {
    return `
      .module-browser-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 0.75rem;
        box-sizing: border-box;
        background: var(--surface-primary, #ffffff);
        color: var(--text-primary, #1f2937);
        overflow: auto;
      }
      
      
      .module-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 0.25rem;
        flex-shrink: 0;
      }
      
      .module-search {
        flex: 1;
        min-width: 20rem;
        position: relative;
      }
      
      .module-search-input {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 3rem;
        font-size: 1rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        background: var(--surface-secondary);
        color: var(--text-primary);
        transition: all 0.2s ease;
      }
      
      .module-search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .module-search-icon {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-tertiary);
      }
      
      .module-filters {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      
      .module-filter-select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.375rem;
        background: var(--surface-secondary);
        color: var(--text-primary);
        font-size: 0.875rem;
        cursor: pointer;
      }
      
      .view-toggle {
        display: flex;
        gap: 0.5rem;
      }
      
      .view-button {
        padding: 0.5rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.25rem;
        background: var(--surface-secondary);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .view-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }
      
      .modules-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }
      
      .modules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
        padding: 0;
      }
      
      .modules-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      
      .module-card {
        background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        border: 1px solid var(--border-subtle, #e5e7eb);
        border-radius: 12px;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }
      
      .module-card:hover {
        border-color: var(--color-primary, #3b82f6);
        box-shadow: 0 12px 32px rgba(59, 130, 246, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08);
        transform: translateY(-3px) scale(1.02);
        background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
      }
      
      .module-card.selected {
        border-color: var(--color-primary);
        background: rgba(59, 130, 246, 0.05);
      }
      
      .module-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.75rem;
      }
      
      .module-name {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary, #1f2937);
        margin: 0;
        line-height: 1.3;
      }
      
      .module-status {
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
      }
      
      .module-tool-count-badge {
        background: linear-gradient(135deg, #ecfdf5, #d1fae5);
        color: #059669;
        border: 1px solid #a7f3d0;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: lowercase;
      }
      
      .module-status.inactive {
        background: rgba(107, 114, 128, 0.1);
        color: var(--text-tertiary);
      }
      
      .module-status.error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--color-error);
      }
      
      .module-description {
        color: var(--text-secondary, #6b7280);
        font-size: 0.8125rem;
        line-height: 1.4;
        margin-bottom: 0.75rem;
        max-height: 2.5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      
      .module-stats {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
        color: var(--text-tertiary, #9ca3af);
        margin-top: 0.5rem;
      }
      
      .module-tool-count {
        font-weight: 500;
      }
      
      .module-last-used {
        font-style: italic;
      }
      
      .module-tools-section {
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--border-subtle);
      }
      
      .module-tools-header {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 0.25rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--text-secondary);
      }
      
      .module-tools-toggle {
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        border: 1px solid #93c5fd;
        color: #1d4ed8;
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        transition: all 0.2s;
        font-weight: 500;
      }
      
      .module-tools-toggle:hover {
        background: linear-gradient(135deg, #dbeafe, #bfdbfe);
        border-color: #60a5fa;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);
      }
      
      .module-tools-list {
        display: none;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .module-tools-list.expanded {
        display: flex;
      }
      
      .module-tool-item {
        padding: 0.5rem;
        background: var(--surface-secondary);
        border-radius: 0.25rem;
        font-size: 0.875rem;
        border: 1px solid var(--border-subtle);
      }
      
      .module-tool-name {
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      }
      
      .module-tool-description {
        color: var(--text-secondary);
        font-size: 0.8125rem;
        line-height: 1.4;
      }
      
      .no-modules {
        text-align: center;
        padding: 4rem 2rem;
        color: var(--text-secondary);
      }
      
      .no-modules-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      
      .no-modules-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'module-browser-panel-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'module-browser-panel';
    
    // Controls (moved to top - no header)
    const controls = this.createControls(modelData);
    this.container.appendChild(controls);
    
    // Content
    const content = this.createContent(modelData);
    this.container.appendChild(content);
    
    return this.container;
  }
  
  createHeader() {
    const header = document.createElement('div');
    header.className = 'module-header';
    
    const title = document.createElement('h1');
    title.className = 'module-title';
    title.innerHTML = '📦 Module Browser';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'module-subtitle';
    subtitle.textContent = 'Browse and manage tool modules with detailed information and controls.';
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    return header;
  }
  
  createControls(modelData) {
    const controls = document.createElement('div');
    controls.className = 'module-controls';
    
    // Search
    const search = document.createElement('div');
    search.className = 'module-search';
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'module-search-icon';
    searchIcon.textContent = '🔍';
    
    const searchInput = document.createElement('input');
    searchInput.className = 'module-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search modules...';
    searchInput.value = modelData.searchQuery || '';
    
    search.appendChild(searchIcon);
    search.appendChild(searchInput);
    
    // Filters
    const filters = document.createElement('div');
    filters.className = 'module-filters';
    
    const sortSelect = document.createElement('select');
    sortSelect.className = 'module-filter-select';
    sortSelect.innerHTML = `
      <option value="name">Sort by Name</option>
      <option value="toolCount">Sort by Tool Count</option>
      <option value="status">Sort by Status</option>
    `;
    sortSelect.value = modelData.sortBy;
    
    const filterSelect = document.createElement('select');
    filterSelect.className = 'module-filter-select';
    filterSelect.innerHTML = `
      <option value="all">All Modules</option>
      <option value="active">Active Only</option>
      <option value="inactive">Inactive Only</option>
      <option value="error">Error Status</option>
    `;
    filterSelect.value = modelData.filterBy;
    
    filters.appendChild(sortSelect);
    filters.appendChild(filterSelect);
    
    // View toggle
    const viewToggle = document.createElement('div');
    viewToggle.className = 'view-toggle';
    
    const gridButton = document.createElement('button');
    gridButton.className = `view-button${modelData.viewMode === 'grid' ? ' active' : ''}`;
    gridButton.innerHTML = '⊞';
    gridButton.dataset.view = 'grid';
    
    const listButton = document.createElement('button');
    listButton.className = `view-button${modelData.viewMode === 'list' ? ' active' : ''}`;
    listButton.innerHTML = '☰';
    listButton.dataset.view = 'list';
    
    viewToggle.appendChild(gridButton);
    viewToggle.appendChild(listButton);
    
    controls.appendChild(search);
    controls.appendChild(filters);
    controls.appendChild(viewToggle);
    
    return controls;
  }
  
  createContent(modelData) {
    const content = document.createElement('div');
    content.className = 'modules-content';
    
    if (modelData.filteredModules.length === 0) {
      const noModules = this.createNoModules();
      content.appendChild(noModules);
    } else {
      const modulesList = document.createElement('div');
      modulesList.className = modelData.viewMode === 'grid' ? 'modules-grid' : 'modules-list';
      
      modelData.filteredModules.forEach(module => {
        const moduleCard = this.createModuleCard(module, modelData);
        modulesList.appendChild(moduleCard);
      });
      
      content.appendChild(modulesList);
    }
    
    return content;
  }
  
  createModuleCard(module, modelData) {
    const card = document.createElement('div');
    card.className = `module-card${module.name === modelData.selectedModule?.name ? ' selected' : ''}`;
    card.dataset.moduleName = module.name;
    
    const header = document.createElement('div');
    header.className = 'module-card-header';
    
    const name = document.createElement('h3');
    name.className = 'module-name';
    name.textContent = formatModuleName(module.name);
    
    const status = document.createElement('span');
    status.className = 'module-tool-count-badge';
    const tools = module.tools || [];
    const toolCountText = tools.length === 1 ? '1 tool' : `${tools.length} tools`;
    status.textContent = toolCountText;
    
    header.appendChild(name);
    header.appendChild(status);
    
    const description = document.createElement('p');
    description.className = 'module-description';
    description.textContent = module.description || 'No description available';
    
    // Remove redundant stats section - tool count now in header
    
    card.appendChild(header);
    card.appendChild(description);
    
    // Add tools section if tools exist (driven by Model state)
    if (tools.length > 0) {
      const isExpanded = modelData.expandedModules.has(module.name);
      const toolsSection = this.createToolsSection(module, tools, isExpanded);
      card.appendChild(toolsSection);
    }
    
    return card;
  }
  
  createToolsSection(module, tools, isExpanded) {
    const toolsSection = document.createElement('div');
    toolsSection.className = 'module-tools-section';
    
    const toolsHeader = document.createElement('div');
    toolsHeader.className = 'module-tools-header';
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'module-tools-toggle';
    toggleButton.textContent = isExpanded ? 'Hide Tools' : 'Show Tools';
    toggleButton.dataset.moduleName = module.name;
    toggleButton.dataset.action = 'toggle-tools';
    toggleButton.style.width = '100%';
    toggleButton.style.textAlign = 'center';
    
    toolsHeader.appendChild(toggleButton);
    
    const toolsList = document.createElement('div');
    toolsList.className = `module-tools-list${isExpanded ? ' expanded' : ''}`;
    
    tools.forEach(tool => {
      const toolItem = document.createElement('div');
      toolItem.className = 'module-tool-item';
      
      const toolName = document.createElement('div');
      toolName.className = 'module-tool-name';
      
      // Handle both string and object tool formats
      const toolDisplayName = tool.name || tool;
      const toolDescription = tool.description || this.getToolDescription(toolDisplayName);
      
      toolName.textContent = toolDisplayName;
      
      if (toolDescription) {
        const toolDesc = document.createElement('div');
        toolDesc.className = 'module-tool-description';
        toolDesc.textContent = toolDescription;
        
        toolItem.appendChild(toolName);
        toolItem.appendChild(toolDesc);
      } else {
        toolItem.appendChild(toolName);
      }
      
      toolsList.appendChild(toolItem);
    });
    
    toolsSection.appendChild(toolsHeader);
    toolsSection.appendChild(toolsList);
    
    return toolsSection;
  }
  
  /**
   * Get tool description from global tools list if available
   */
  getToolDescription(toolName) {
    // Try to get description from the parent component's tools data
    const allTools = window.toolRegistryApp?.getTools?.() || [];
    const foundTool = allTools.find(t => t.name === toolName);
    return foundTool?.description || null;
  }
  
  createNoModules() {
    const noModules = document.createElement('div');
    noModules.className = 'no-modules';
    
    const icon = document.createElement('div');
    icon.className = 'no-modules-icon';
    icon.textContent = '📦';
    
    const title = document.createElement('h3');
    title.className = 'no-modules-title';
    title.textContent = 'No modules found';
    
    const message = document.createElement('p');
    message.textContent = 'No modules match your current search and filter criteria.';
    
    noModules.appendChild(icon);
    noModules.appendChild(title);
    noModules.appendChild(message);
    
    return noModules;
  }
}

class ModuleBrowserPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.eventListeners = [];
    this.searchTimeout = null;
  }
  
  initialize() {
    this.render();
    this.setupEventListeners();
    
    // Request initial module load through proper MVVM pattern
    this.requestModuleSearch('');
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
  }
  
  // Proper MVVM: Request backend action through umbilical callbacks
  requestModuleSearch(query) {
    console.log(`📦 ModuleBrowserPanel: Requesting module search: "${query}"`);
    if (this.umbilical.onSearchModules) {
      this.umbilical.onSearchModules(query);
    }
  }
  
  render() {
    this.view.render(this.model.getState());
  }
  
  setupEventListeners() {
    // Search input
    const searchInput = this.view.container.querySelector('.module-search-input');
    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value;
        this.model.updateState('searchQuery', query);
        
        // Debounce backend search requests
        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }
        
        this.searchTimeout = setTimeout(() => {
          this.requestModuleSearch(query);
        }, 300); // 300ms debounce
        
        if (this.umbilical.onSearch) {
          this.umbilical.onSearch(query);
        }
      };
      
      searchInput.addEventListener('input', handleSearch);
      this.eventListeners.push(() => searchInput.removeEventListener('input', handleSearch));
    }
    
    // Filter selects
    const filterSelects = this.view.container.querySelectorAll('.module-filter-select');
    filterSelects.forEach((select, index) => {
      const handleFilterChange = (event) => {
        const filterType = index === 0 ? 'sortBy' : 'filterBy';
        this.model.updateState(filterType, event.target.value);
        
        // Re-search with current query when filters change
        this.requestModuleSearch(this.model.getState('searchQuery'));
      };
      
      select.addEventListener('change', handleFilterChange);
      this.eventListeners.push(() => select.removeEventListener('change', handleFilterChange));
    });
    
    // View buttons
    const viewButtons = this.view.container.querySelectorAll('.view-button');
    viewButtons.forEach(button => {
      const handleViewChange = () => {
        const viewMode = button.dataset.view;
        this.model.updateState('viewMode', viewMode);
        this.render();
      };
      
      button.addEventListener('click', handleViewChange);
      this.eventListeners.push(() => button.removeEventListener('click', handleViewChange));
    });
    
    // Module and tool toggle event handling
    const handleClick = (event) => {
      // Handle tools toggle
      if (event.target.dataset.action === 'toggle-tools') {
        const moduleName = event.target.dataset.moduleName;
        this.toggleModuleExpansion(moduleName);
        return;
      }
      
      // Handle module selection
      const moduleCard = event.target.closest('.module-card');
      if (moduleCard) {
        const moduleName = moduleCard.dataset.moduleName;
        const module = this.model.getState('modules').find(m => m.name === moduleName);
        this.selectModule(module);
      }
    };
    
    this.view.container.addEventListener('click', handleClick);
    this.eventListeners.push(() => this.view.container.removeEventListener('click', handleClick));
  }
  
  selectModule(module) {
    this.model.updateState('selectedModule', module);
    this.render();
    
    if (this.umbilical.onModuleSelect) {
      this.umbilical.onModuleSelect(module);
    }
  }
  
  toggleModuleExpansion(moduleName) {
    this.model.toggleModuleExpansion(moduleName);
    this.render(); // Re-render to show/hide tools
  }
  
  createPublicAPI() {
    return {
      setModules: (modules) => {
        console.log(`📦 ModuleBrowserPanel: Received ${modules.length} modules from backend`);
        this.model.updateState('modules', modules);
        this.model.updateFilteredModules();
        this.render();
      },
      getSelectedModule: () => this.model.getState('selectedModule'),
      getFilteredModules: () => this.model.getState('filteredModules'),
      search: (query) => {
        this.model.updateState('searchQuery', query);
        this.requestModuleSearch(query);
      },
      clearSearch: () => {
        this.model.updateState('searchQuery', '');
        this.requestModuleSearch(''); // Reload all modules
      },
      loadAllModules: () => this.requestModuleSearch(''),
      selectModule: (module) => this.selectModule(module),
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

export class ModuleBrowserPanel {
  constructor(container, options = {}) {
    const umbilical = {
      dom: container,
      modules: options.modules || [],
      onSearchModules: options.onSearchModules,
      onModuleSelect: options.onModuleSelect,
      onMount: options.onMount,
      onDestroy: options.onDestroy
    };
    
    const model = new ModuleBrowserPanelModel(umbilical);
    const view = new ModuleBrowserPanelView(umbilical.dom);
    this.viewModel = new ModuleBrowserPanelViewModel(model, view, umbilical);
    
    return this.viewModel.initialize();
  }
  
  // Delegate methods to viewModel
  setModules(modules) {
    return this.viewModel.setModules(modules);
  }
  
  search(query) {
    return this.viewModel.search(query);
  }
  
  getSelectedModule() {
    return this.viewModel.getSelectedModule();
  }
  
  destroy() {
    return this.viewModel.destroy();
  }
}