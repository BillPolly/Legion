/**
 * ModuleBrowserPanel Component - MVVM Implementation
 * Browse and manage tool modules with detailed information
 * Following the design document specification
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

class ModuleBrowserPanelModel {
  constructor(options = {}) {
    this.state = {
      modules: options.modules || [],
      filteredModules: options.modules || [],
      selectedModule: null,
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
      // Text search
      const matchesQuery = !query || 
        module.name.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query);
      
      // Status filter
      const matchesFilter = filterBy === 'all' || module.status === filterBy;
      
      return matchesQuery && matchesFilter;
    });
    
    // Sort results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'toolCount':
          return (b.toolCount || 0) - (a.toolCount || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
    
    this.state.filteredModules = filtered;
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
        const moduleCard = this.createModuleCard(module, modelData.selectedModule);
        modulesList.appendChild(moduleCard);
      });
      
      content.appendChild(modulesList);
    }
    
    return content;
  }
  
  createModuleCard(module, selectedModule) {
    const card = document.createElement('div');
    card.className = `module-card${module.name === selectedModule?.name ? ' selected' : ''}`;
    card.dataset.moduleName = module.name;
    
    const header = document.createElement('div');
    header.className = 'module-card-header';
    
    const name = document.createElement('h3');
    name.className = 'module-name';
    name.textContent = module.name;
    
    const status = document.createElement('span');
    status.className = `module-status ${module.status}`;
    status.textContent = module.status;
    
    header.appendChild(name);
    header.appendChild(status);
    
    const description = document.createElement('p');
    description.className = 'module-description';
    description.textContent = module.description;
    
    const stats = document.createElement('div');
    stats.className = 'module-stats';
    
    const toolCount = document.createElement('span');
    toolCount.className = 'module-tool-count';
    toolCount.textContent = `${module.toolCount || 0} tools`;
    
    const lastUsed = document.createElement('span');
    lastUsed.className = 'module-last-used';
    lastUsed.textContent = module.lastUsed || 'Never used';
    
    stats.appendChild(toolCount);
    stats.appendChild(lastUsed);
    
    card.appendChild(header);
    card.appendChild(description);
    card.appendChild(stats);
    
    return card;
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
  }
  
  initialize() {
    this.render();
    this.setupEventListeners();
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
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
        this.render();
        
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
        this.render();
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
    
    // Module selection
    const handleModuleClick = (event) => {
      const moduleCard = event.target.closest('.module-card');
      if (moduleCard) {
        const moduleName = moduleCard.dataset.moduleName;
        const module = this.model.getState('modules').find(m => m.name === moduleName);
        this.selectModule(module);
      }
    };
    
    this.view.container.addEventListener('click', handleModuleClick);
    this.eventListeners.push(() => this.view.container.removeEventListener('click', handleModuleClick));
  }
  
  selectModule(module) {
    this.model.updateState('selectedModule', module);
    this.render();
    
    if (this.umbilical.onModuleSelect) {
      this.umbilical.onModuleSelect(module);
    }
  }
  
  createPublicAPI() {
    return {
      setModules: (modules) => {
        this.model.updateState('modules', modules);
        this.model.updateFilteredModules();
        this.render();
      },
      getSelectedModule: () => this.model.getState('selectedModule'),
      getFilteredModules: () => this.model.getState('filteredModules'),
      search: (query) => {
        this.model.updateState('searchQuery', query);
        this.render();
      },
      clearSearch: () => {
        this.model.updateState('searchQuery', '');
        this.model.updateFilteredModules();
        this.render();
      },
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

export const ModuleBrowserPanel = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('modules', 'array', 'Array of available modules (optional)', false);
      requirements.add('onSearch', 'function', 'Search callback (optional)', false);
      requirements.add('onModuleSelect', 'function', 'Module selection callback (optional)', false);
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onDestroy', 'function', 'Destroy callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidModules: !umbilical.modules || Array.isArray(umbilical.modules)
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ModuleBrowserPanel');
    
    const model = new ModuleBrowserPanelModel(umbilical);
    const view = new ModuleBrowserPanelView(umbilical.dom);
    const viewModel = new ModuleBrowserPanelViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};