/**
 * ModuleBrowserPanel Component - MVVM Implementation
 * Browse and manage tool modules with detailed information
 * Following the design document specification
 */

// Note: Using simplified component pattern for decent-planner-ui
// No external umbilical dependencies

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
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        padding: 0.5rem;
        overflow: hidden;
        box-sizing: border-box;
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
        grid-template-columns: repeat(auto-fit, minmax(clamp(15rem, 25vw, 20rem), 1fr));
        gap: 1.5rem;
        padding: 0;
      }
      
      .modules-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      
      .module-card {
        background: var(--surface-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        padding: 1.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .module-card:hover {
        border-color: var(--color-primary);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        transform: translateY(-2px);
      }
      
      .module-card.selected {
        border-color: var(--color-primary);
        background: rgba(59, 130, 246, 0.05);
      }
      
      .module-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
      }
      
      .module-name {
        font-size: clamp(1.125rem, 3vw, 1.5rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      
      .module-status {
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
      }
      
      .module-status.active {
        background: rgba(16, 185, 129, 0.1);
        color: var(--color-success);
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
        color: var(--text-secondary);
        font-size: clamp(0.875rem, 2vw, 1rem);
        line-height: 1.5;
        margin-bottom: 1rem;
      }
      
      .module-stats {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: clamp(0.75rem, 1.5vw, 0.875rem);
        color: var(--text-tertiary);
      }
      
      .module-tool-count {
        font-weight: 500;
      }
      
      .module-last-used {
        font-style: italic;
      }
      
      .module-tools-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-subtle);
      }
      
      .module-tools-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-secondary);
      }
      
      .module-tools-toggle {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        transition: background 0.2s;
      }
      
      .module-tools-toggle:hover {
        background: rgba(59, 130, 246, 0.1);
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
    name.textContent = module.name;
    
    const status = document.createElement('span');
    status.className = `module-status ${module.status || 'active'}`;
    status.textContent = module.status || 'loaded';
    
    header.appendChild(name);
    header.appendChild(status);
    
    const description = document.createElement('p');
    description.className = 'module-description';
    description.textContent = module.description || 'No description available';
    
    const stats = document.createElement('div');
    stats.className = 'module-stats';
    
    const toolCount = document.createElement('span');
    toolCount.className = 'module-tool-count';
    const tools = module.tools || [];
    toolCount.textContent = `${tools.length} tools`;
    
    const lastUsed = document.createElement('span');
    lastUsed.className = 'module-last-used';
    lastUsed.textContent = module.lastUsed || 'Recently loaded';
    
    stats.appendChild(toolCount);
    stats.appendChild(lastUsed);
    
    card.appendChild(header);
    card.appendChild(description);
    card.appendChild(stats);
    
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
    
    const toolsLabel = document.createElement('span');
    toolsLabel.textContent = `Tools (${tools.length})`;
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'module-tools-toggle';
    toggleButton.textContent = isExpanded ? 'Hide Tools' : 'Show Tools';
    toggleButton.dataset.moduleName = module.name;
    toggleButton.dataset.action = 'toggle-tools';
    
    toolsHeader.appendChild(toolsLabel);
    toolsHeader.appendChild(toggleButton);
    
    const toolsList = document.createElement('div');
    toolsList.className = `module-tools-list${isExpanded ? ' expanded' : ''}`;
    
    tools.forEach(tool => {
      const toolItem = document.createElement('div');
      toolItem.className = 'module-tool-item';
      
      const toolName = document.createElement('div');
      toolName.className = 'module-tool-name';
      toolName.textContent = tool.name || tool;
      
      const toolDesc = document.createElement('div');
      toolDesc.className = 'module-tool-description';
      toolDesc.textContent = tool.description || 'No description available';
      
      toolItem.appendChild(toolName);
      toolItem.appendChild(toolDesc);
      toolsList.appendChild(toolItem);
    });
    
    toolsSection.appendChild(toolsHeader);
    toolsSection.appendChild(toolsList);
    
    return toolsSection;
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