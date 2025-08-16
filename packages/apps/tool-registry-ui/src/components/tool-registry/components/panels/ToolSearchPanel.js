/**
 * ToolSearchPanel Component - MVVM Implementation
 * Provides comprehensive tool search and filtering functionality
 * Desktop-only responsive design with no media queries
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { BaseUmbilicalComponent } from '/legion/frontend-components/src/components/base/BaseUmbilicalComponent.js';

class ToolSearchPanelModel {
  constructor(options = {}) {
    this.state = {
      tools: options.tools || [],
      searchQuery: '',
      filteredTools: options.tools || [],
      selectedTool: null,
      isSearching: false,
      searchHistory: [],
      filters: {
        category: 'all',
        module: 'all',
        sortBy: 'name'
      },
      searchMode: 'text', // text, semantic, both
      viewMode: 'list' // list, grid, detailed
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
    
    // Auto-update filtered tools when search or filters change
    if (path === 'searchQuery' || path.startsWith('filters.')) {
      this.updateFilteredTools();
    }
  }
  
  getState(path = '') {
    if (!path) return this.state;
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }
  
  calculateTextSearchScore(tool, query) {
    if (!query) return 1;
    
    const lowerQuery = query.toLowerCase();
    const name = (tool.name || '').toLowerCase();
    const description = (tool.description || '').toLowerCase();
    const module = (tool.moduleName || '').toLowerCase();
    const category = (tool.category || '').toLowerCase();
    const tags = (tool.tags || []).join(' ').toLowerCase();
    
    let score = 0;
    
    // Exact name match (highest priority)
    if (name === lowerQuery) score += 10;
    else if (name.includes(lowerQuery)) score += 5;
    
    // Description matches
    if (description.includes(lowerQuery)) score += 3;
    
    // Module name matches
    if (module.includes(lowerQuery)) score += 2;
    
    // Category/tag matches
    if (category.includes(lowerQuery)) score += 1;
    if (tags.includes(lowerQuery)) score += 1;
    
    // Bonus for word boundary matches
    const wordBoundaryRegex = new RegExp(`\\b${lowerQuery}\\b`, 'i');
    if (wordBoundaryRegex.test(name)) score += 2;
    if (wordBoundaryRegex.test(description)) score += 1;
    
    return score;
  }
  
  updateFilteredTools() {
    const query = this.state.searchQuery.toLowerCase();
    const filters = this.state.filters;
    
    let filtered = this.state.tools.filter(tool => {
      // Text search with confidence scoring
      let matchesQuery = !query;
      let searchScore = 0;
      
      if (query) {
        searchScore = this.calculateTextSearchScore(tool, query);
        matchesQuery = searchScore > 0;
        // Add the score to the tool for sorting
        tool._searchScore = searchScore;
      }
      
      // Category filter
      const matchesCategory = filters.category === 'all' || 
        tool.category === filters.category;
      
      // Module filter
      const matchesModule = filters.module === 'all' || 
        tool.moduleName === filters.module;
      
      return matchesQuery && matchesCategory && matchesModule;
    });
    
    // Sort results
    filtered.sort((a, b) => {
      // If we have search scores, sort by relevance first
      if (query && a._searchScore !== undefined && b._searchScore !== undefined) {
        const scoreDiff = b._searchScore - a._searchScore;
        if (scoreDiff !== 0) return scoreDiff;
      }
      
      // Then apply regular sorting
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'module':
          return (a.moduleName || '').localeCompare(b.moduleName || '');
        case 'recent':
          return (b.lastUsed || 0) - (a.lastUsed || 0);
        default:
          return 0;
      }
    });
    
    this.state.filteredTools = filtered;
  }
  
  addToSearchHistory(query) {
    if (!query || this.state.searchHistory.includes(query)) return;
    this.state.searchHistory.unshift(query);
    if (this.state.searchHistory.length > 10) {
      this.state.searchHistory = this.state.searchHistory.slice(0, 10);
    }
  }
}

class ToolSearchPanelView {
  constructor(container) {
    this.container = container;
    this.cssInjected = false;
  }
  
  generateCSS() {
    return `
      /* Global box-sizing for all search panel elements */
      .tool-search-panel * {
        box-sizing: border-box;
      }
      
      .tool-search-panel {
        padding: clamp(1rem, 3vw, 1.5rem);
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: clamp(0.5rem, 2vw, 1rem);
        background: var(--surface-primary);
        overflow: hidden;
        box-sizing: border-box;
        max-width: 100vw;
      }
      
      .search-header {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex-shrink: 0;
        width: 100%;
        box-sizing: border-box;
      }
      
      .search-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .search-input-container {
        position: relative;
        width: 100%;
        max-width: 100%;
        flex-shrink: 0;
        box-sizing: border-box;
      }
      
      .search-input {
        width: 100%;
        max-width: 100%;
        padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 2vw, 1rem);
        padding-left: clamp(2.5rem, 6vw, 3rem);
        font-size: clamp(0.875rem, 2.5vw, 1rem);
        border: 1px solid var(--border-subtle);
        border-radius: clamp(0.375rem, 1vw, 0.5rem);
        box-sizing: border-box;
        background: var(--surface-secondary);
        color: var(--text-primary);
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);
      }
      
      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 0.1875rem rgba(59, 130, 246, 0.15), var(--shadow-md);
        background: var(--surface-primary);
      }
      
      .search-input::placeholder {
        color: var(--text-tertiary);
      }
      
      .search-icon {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1rem;
        color: var(--text-tertiary);
        pointer-events: none;
      }
      
      .search-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: clamp(0.5rem, 2vw, 1rem);
        flex-wrap: wrap;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }
      
      .search-filters {
        display: flex;
        gap: 1rem;
        align-items: center;
        flex-wrap: wrap;
      }
      
      .filter-label {
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      .filter-select {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.375rem;
        background: var(--surface-secondary);
        color: var(--text-primary);
        font-size: 0.875rem;
        min-width: 8rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .filter-select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 0.1875rem rgba(59, 130, 246, 0.15);
      }
      
      .view-controls {
        display: flex;
        gap: var(--spacing-xs);
      }
      
      .view-button {
        padding: clamp(0.5rem, 1.5vw, 0.75rem);
        border: 0.125rem solid var(--border-subtle);
        border-radius: var(--radius-sm);
        background: var(--surface-secondary);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: var(--font-sm);
      }
      
      .view-button.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }
      
      .view-button:hover:not(.active) {
        background: var(--surface-hover);
        border-color: var(--border-medium);
      }
      
      .show-all-button {
        padding: clamp(0.5rem, 1.5vw, 0.75rem) clamp(0.75rem, 2vw, 1rem);
        border: 0.125rem solid var(--color-secondary);
        border-radius: var(--radius-sm);
        background: var(--color-secondary);
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: var(--font-sm);
        font-weight: 500;
        margin-left: 0.5rem;
      }
      
      .show-all-button:hover {
        background: var(--color-secondary-dark, #0056b3);
        border-color: var(--color-secondary-dark, #0056b3);
        transform: translateY(-1px);
      }
      
      .search-results {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      
      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--surface-tertiary);
        border-radius: 0.375rem 0.375rem 0 0;
        border-bottom: 1px solid var(--border-subtle);
        flex-shrink: 0;
      }
      
      .results-count {
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      .results-query {
        font-size: 0.875rem;
        color: var(--color-primary);
        font-weight: 600;
      }
      
      .tools-list {
        flex: 1;
        overflow-y: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 0 0 0.375rem 0.375rem;
        background: var(--surface-primary);
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }
      
      .tool-item {
        padding: clamp(0.75rem, 2vw, 1rem);
        border-bottom: 1px solid var(--border-subtle);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        word-wrap: break-word;
        overflow-wrap: break-word;
        display: flex;
        flex-direction: column;
        gap: clamp(0.25rem, 1vw, 0.5rem);
      }
      
      .tool-item:last-child {
        border-bottom: none;
      }
      
      .tool-item:hover {
        background: var(--surface-hover);
      }
      
      .tool-item.selected {
        background: var(--color-primary);
        color: white;
      }
      
      .tool-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.5rem;
      }
      
      .tool-name {
        font-weight: 700;
        font-size: 1.125rem;
        color: var(--text-primary);
        margin: 0;
      }
      
      .tool-item.selected .tool-name {
        color: white;
      }
      
      .tool-module-badge {
        background: var(--color-secondary);
        color: white;
        padding: clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.5rem, 1vw, 0.75rem);
        border-radius: var(--radius-sm);
        font-size: var(--font-xs);
        font-weight: 600;
        white-space: nowrap;
      }
      
      .tool-item.selected .tool-module-badge {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .tool-description {
        color: var(--text-secondary);
        font-size: var(--font-sm);
        line-height: 1.5;
        margin-bottom: var(--spacing-sm);
      }
      
      .tool-item.selected .tool-description {
        color: rgba(255, 255, 255, 0.9);
      }
      
      .tool-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: var(--font-xs);
        color: var(--text-tertiary);
      }
      
      .tool-item.selected .tool-meta {
        color: rgba(255, 255, 255, 0.8);
      }
      
      .tool-schema-info {
        display: flex;
        gap: var(--spacing-sm);
        align-items: center;
      }
      
      .tool-usage-count {
        background: var(--surface-tertiary);
        padding: clamp(0.125rem, 0.25vw, 0.25rem) clamp(0.375rem, 0.75vw, 0.5rem);
        border-radius: var(--radius-sm);
        font-weight: 500;
      }
      
      .tool-item.selected .tool-usage-count {
        background: rgba(255, 255, 255, 0.15);
      }
      
      .tool-params-detail, .tool-output-detail {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: var(--surface-secondary);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--color-primary);
      }
      
      .tool-item.selected .tool-params-detail,
      .tool-item.selected .tool-output-detail {
        background: rgba(255, 255, 255, 0.1);
        border-left-color: rgba(255, 255, 255, 0.5);
      }
      
      .params-header, .output-header {
        font-weight: 600;
        font-size: var(--font-xs);
        color: var(--color-primary);
        margin-bottom: 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .tool-item.selected .params-header,
      .tool-item.selected .output-header {
        color: rgba(255, 255, 255, 0.9);
      }
      
      .param-item, .output-item {
        display: inline-block;
        background: var(--surface-tertiary);
        color: var(--text-secondary);
        padding: 0.2rem 0.4rem;
        margin: 0.1rem 0.2rem 0.1rem 0;
        border-radius: var(--radius-xs);
        font-size: var(--font-xs);
        font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      }
      
      .tool-item.selected .param-item,
      .tool-item.selected .output-item {
        background: rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.9);
      }
      
      .no-results {
        padding: clamp(2rem, 5vw, 4rem);
        text-align: center;
        color: var(--text-secondary);
      }
      
      .no-results-icon {
        font-size: clamp(2rem, 5vw, 3rem);
        margin-bottom: var(--spacing-md);
        opacity: 0.5;
      }
      
      .no-results-title {
        font-size: clamp(1.25rem, 3vw, 1.5rem);
        font-weight: 600;
        margin-bottom: var(--spacing-sm);
        color: var(--text-primary);
      }
      
      .no-results-message {
        font-size: var(--font-md);
        line-height: 1.5;
      }
      
      .search-suggestions {
        margin-top: var(--spacing-md);
        font-size: var(--font-sm);
        color: var(--text-tertiary);
      }
      
      .suggestion-link {
        color: var(--color-primary);
        text-decoration: none;
        font-weight: 500;
        cursor: pointer;
      }
      
      .suggestion-link:hover {
        text-decoration: underline;
      }
      
      /* Scrollbar styling */
      .tools-list::-webkit-scrollbar {
        width: clamp(0.5rem, 1vw, 0.75rem);
      }
      
      .tools-list::-webkit-scrollbar-track {
        background: var(--surface-secondary);
      }
      
      .tools-list::-webkit-scrollbar-thumb {
        background: var(--border-medium);
        border-radius: var(--radius-sm);
      }
      
      .tools-list::-webkit-scrollbar-thumb:hover {
        background: var(--border-strong);
      }
      
      /* Loading states */
      .search-input.searching {
        background-image: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
        animation: search-loading 1.5s ease-in-out infinite;
      }
      
      @keyframes search-loading {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      .tools-list.loading {
        opacity: 0.7;
        pointer-events: none;
      }
      
      .tools-list.loading::before {
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
      
      /* Mobile and Tablet Responsive Design */
      @media (max-width: 768px) {
        .tool-search-panel {
          padding: clamp(0.5rem, 3vw, 1rem);
        }
        
        .search-controls {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }
        
        .search-filters {
          flex-direction: column;
          align-items: stretch;
          gap: 0.5rem;
        }
        
        .view-controls {
          justify-content: center;
        }
        
        .filter-select {
          min-width: auto;
          width: 100%;
        }
        
        .tool-item {
          padding: 0.75rem;
        }
        
        .search-input {
          font-size: 16px; /* Prevent zoom on iOS */
        }
      }
      
      @media (max-width: 480px) {
        .search-title {
          font-size: 1.25rem;
          flex-direction: column;
          text-align: center;
          gap: 0.25rem;
        }
        
        .search-input-container {
          width: 100%;
        }
        
        .search-input {
          padding: 0.625rem 0.75rem;
          padding-left: 2.5rem;
          font-size: 16px;
        }
        
        .search-icon {
          left: 0.75rem;
          font-size: 0.875rem;
        }
        
        .tool-item {
          padding: 0.5rem;
        }
        
        .param-item, .output-item {
          font-size: 0.75rem;
          padding: 0.15rem 0.3rem;
        }
      }
    `;
  }
  
  injectCSS() {
    if (this.cssInjected) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'tool-search-panel-styles';
    styleElement.textContent = this.generateCSS();
    document.head.appendChild(styleElement);
    this.cssInjected = true;
  }
  
  render(modelData) {
    this.injectCSS();
    
    this.container.innerHTML = '';
    this.container.className = 'tool-search-panel';
    
    // Search header
    const searchHeader = this.createSearchHeader(modelData);
    this.container.appendChild(searchHeader);
    
    // Search results
    const searchResults = this.createSearchResults(modelData);
    this.container.appendChild(searchResults);
    
    return this.container;
  }
  
  createSearchHeader(modelData) {
    const header = document.createElement('div');
    header.className = 'search-header';
    
    // Title
    const title = document.createElement('h2');
    title.className = 'search-title';
    title.innerHTML = '🔍 Tool Search & Discovery';
    
    // Search input
    const inputContainer = document.createElement('div');
    inputContainer.className = 'search-input-container';
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'search-icon';
    searchIcon.textContent = '🔍';
    
    const searchInput = document.createElement('input');
    searchInput.className = 'search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search tools by name, description, module, or functionality...';
    searchInput.value = modelData.searchQuery || '';
    searchInput.id = 'tool-search-input';
    
    inputContainer.appendChild(searchIcon);
    inputContainer.appendChild(searchInput);
    
    // Search mode toggle
    const searchModeContainer = this.createSearchModeToggle(modelData);
    
    // Controls
    const controls = this.createSearchControls(modelData);
    
    header.appendChild(title);
    header.appendChild(inputContainer);
    header.appendChild(searchModeContainer);
    header.appendChild(controls);
    
    return header;
  }
  
  createSearchModeToggle(modelData) {
    const container = document.createElement('div');
    container.className = 'search-mode-container';
    container.style.cssText = `
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 0.75rem;
      background: var(--surface-tertiary);
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
    `;
    
    const label = document.createElement('span');
    label.className = 'search-mode-label';
    label.textContent = 'Search Mode:';
    label.style.cssText = 'font-weight: 600; color: var(--text-secondary);';
    
    const modes = ['text', 'semantic', 'both'];
    const modeButtons = document.createElement('div');
    modeButtons.className = 'search-mode-buttons';
    modeButtons.style.cssText = 'display: flex; gap: 0.5rem;';
    
    modes.forEach(mode => {
      const button = document.createElement('button');
      button.className = `search-mode-button ${modelData.searchMode === mode ? 'active' : ''}`;
      button.dataset.mode = mode;
      button.style.cssText = `
        padding: 0.5rem 1rem;
        border: 2px solid var(--border-subtle);
        border-radius: 0.375rem;
        background: ${modelData.searchMode === mode ? 'var(--color-primary)' : 'var(--surface-secondary)'};
        color: ${modelData.searchMode === mode ? 'white' : 'var(--text-primary)'};
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
        text-transform: capitalize;
      `;
      
      const icons = {
        text: '📝',
        semantic: '🧠',
        both: '🔀'
      };
      
      button.innerHTML = `${icons[mode]} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
      modeButtons.appendChild(button);
    });
    
    // Add info text
    const infoText = document.createElement('span');
    infoText.className = 'search-mode-info';
    infoText.style.cssText = 'font-size: 0.875rem; color: var(--text-tertiary); margin-left: auto;';
    
    const infoMessages = {
      text: 'Exact keyword matching',
      semantic: 'AI-powered concept search',
      both: 'Combined keyword + AI search'
    };
    
    infoText.textContent = infoMessages[modelData.searchMode];
    
    container.appendChild(label);
    container.appendChild(modeButtons);
    container.appendChild(infoText);
    
    return container;
  }
  
  createSearchControls(modelData) {
    const controls = document.createElement('div');
    controls.className = 'search-controls';
    
    // Filters
    const filters = document.createElement('div');
    filters.className = 'search-filters';
    
    // Category filter
    const categoryLabel = document.createElement('span');
    categoryLabel.className = 'filter-label';
    categoryLabel.textContent = 'Category:';
    
    const categorySelect = document.createElement('select');
    categorySelect.className = 'filter-select';
    categorySelect.innerHTML = `
      <option value="all">All Categories</option>
      <option value="file">File Operations</option>
      <option value="calc">Calculations</option>
      <option value="text">Text Processing</option>
      <option value="web">Web & API</option>
      <option value="data">Data Processing</option>
    `;
    categorySelect.value = modelData.filters.category;
    
    // Module filter
    const moduleLabel = document.createElement('span');
    moduleLabel.className = 'filter-label';
    moduleLabel.textContent = 'Module:';
    
    const moduleSelect = document.createElement('select');
    moduleSelect.className = 'filter-select';
    moduleSelect.innerHTML = `
      <option value="all">All Modules</option>
      <option value="FileModule">File Module</option>
      <option value="CalculatorModule">Calculator Module</option>
      <option value="TextModule">Text Module</option>
      <option value="WebModule">Web Module</option>
    `;
    moduleSelect.value = modelData.filters.module;
    
    // Sort filter
    const sortLabel = document.createElement('span');
    sortLabel.className = 'filter-label';
    sortLabel.textContent = 'Sort:';
    
    const sortSelect = document.createElement('select');
    sortSelect.className = 'filter-select';
    sortSelect.innerHTML = `
      <option value="name">Name A-Z</option>
      <option value="module">By Module</option>
      <option value="recent">Recently Used</option>
    `;
    sortSelect.value = modelData.filters.sortBy;
    
    filters.appendChild(categoryLabel);
    filters.appendChild(categorySelect);
    filters.appendChild(moduleLabel);
    filters.appendChild(moduleSelect);
    filters.appendChild(sortLabel);
    filters.appendChild(sortSelect);
    
    // View controls
    const viewControls = document.createElement('div');
    viewControls.className = 'view-controls';
    
    const listButton = document.createElement('button');
    listButton.className = `view-button${modelData.viewMode === 'list' ? ' active' : ''}`;
    listButton.textContent = '📋 List';
    listButton.dataset.viewMode = 'list';
    BaseUmbilicalComponent.assignId(listButton, 'ToolSearchPanel', 'button');
    
    const gridButton = document.createElement('button');
    gridButton.className = `view-button${modelData.viewMode === 'grid' ? ' active' : ''}`;
    gridButton.textContent = '⊞ Grid';
    gridButton.dataset.viewMode = 'grid';
    BaseUmbilicalComponent.assignId(gridButton, 'ToolSearchPanel', 'button');
    
    const showAllButton = document.createElement('button');
    showAllButton.className = 'show-all-button';
    showAllButton.textContent = '📋 Show All Tools';
    showAllButton.dataset.action = 'show-all';
    BaseUmbilicalComponent.assignId(showAllButton, 'ToolSearchPanel', 'button');
    
    viewControls.appendChild(listButton);
    viewControls.appendChild(gridButton);
    viewControls.appendChild(showAllButton);
    
    controls.appendChild(filters);
    controls.appendChild(viewControls);
    
    return controls;
  }
  
  createSearchResults(modelData) {
    const results = document.createElement('div');
    results.className = 'search-results';
    
    // Results header
    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'results-header';
    
    const resultsCount = document.createElement('span');
    resultsCount.className = 'results-count';
    resultsCount.textContent = `Found ${modelData.filteredTools.length} tools`;
    
    const resultsQuery = document.createElement('span');
    resultsQuery.className = 'results-query';
    resultsQuery.textContent = modelData.searchQuery ? `for "${modelData.searchQuery}"` : '';
    
    resultsHeader.appendChild(resultsCount);
    resultsHeader.appendChild(resultsQuery);
    
    // Tools list
    const toolsList = document.createElement('div');
    toolsList.className = 'tools-list';
    
    if (modelData.filteredTools.length === 0) {
      const noResults = this.createNoResults(modelData);
      toolsList.appendChild(noResults);
    } else {
      modelData.filteredTools.forEach(tool => {
        const toolItem = this.createToolItem(tool, modelData.selectedTool);
        toolsList.appendChild(toolItem);
      });
    }
    
    results.appendChild(resultsHeader);
    results.appendChild(toolsList);
    
    return results;
  }
  
  createNoResults(modelData) {
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    
    const icon = document.createElement('div');
    icon.className = 'no-results-icon';
    icon.textContent = '🔍';
    
    const title = document.createElement('h3');
    title.className = 'no-results-title';
    title.textContent = 'No tools found';
    
    const message = document.createElement('p');
    message.className = 'no-results-message';
    message.textContent = modelData.searchQuery 
      ? `No tools match your search for "${modelData.searchQuery}"`
      : 'Try adjusting your search criteria or filters.';
    
    const suggestions = document.createElement('div');
    suggestions.className = 'search-suggestions';
    suggestions.innerHTML = `
      Try searching for: 
      <a class="suggestion-link" data-suggestion="file">file operations</a>, 
      <a class="suggestion-link" data-suggestion="calculate">calculations</a>, 
      <a class="suggestion-link" data-suggestion="text">text processing</a>
    `;
    
    noResults.appendChild(icon);
    noResults.appendChild(title);
    noResults.appendChild(message);
    noResults.appendChild(suggestions);
    
    return noResults;
  }
  
  createToolItem(tool, selectedTool) {
    const item = document.createElement('div');
    item.className = `tool-item${tool.name === selectedTool?.name ? ' selected' : ''}`;
    item.dataset.toolName = tool.name;
    item.id = `tool-item-${tool.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    // Header
    const header = document.createElement('div');
    header.className = 'tool-header';
    
    const name = document.createElement('h4');
    name.className = 'tool-name';
    name.textContent = tool.name;
    
    const moduleBadge = document.createElement('span');
    moduleBadge.className = 'tool-module-badge module-badge';
    moduleBadge.textContent = tool.moduleName || tool.module || 'Unknown';
    
    header.appendChild(name);
    header.appendChild(moduleBadge);
    
    // Description
    const description = document.createElement('p');
    description.className = 'tool-description';
    description.textContent = tool.description || tool.summary || 'No description available';
    
    // Meta information
    const meta = document.createElement('div');
    meta.className = 'tool-meta';
    
    const schemaInfo = document.createElement('div');
    schemaInfo.className = 'tool-schema-info';
    
    // Calculate parameter count more robustly
    let paramCount = 0;
    if (tool.inputSchema && typeof tool.inputSchema === 'object') {
      if (tool.inputSchema.properties && typeof tool.inputSchema.properties === 'object') {
        paramCount = Object.keys(tool.inputSchema.properties).length;
      }
    }
    
    // Check for output schema
    let hasOutput = false;
    if (tool.outputSchema && typeof tool.outputSchema === 'object' && 
        tool.outputSchema.properties && Object.keys(tool.outputSchema.properties).length > 0) {
      hasOutput = true;
    }
    
    schemaInfo.innerHTML = `
      <span>📝 ${paramCount} parameter${paramCount !== 1 ? 's' : ''}</span>
      <span>🏷️ ${tool.category || 'general'}</span>
      ${hasOutput ? '<span>📤 Returns data</span>' : '<span>📤 No return data</span>'}
    `;
    
    // Add detailed parameter information if available
    if (paramCount > 0 && tool.inputSchema?.properties) {
      const paramsDetail = document.createElement('div');
      paramsDetail.className = 'tool-params-detail';
      
      const paramsList = Object.entries(tool.inputSchema.properties).map(([name, schema]) => {
        const required = tool.inputSchema.required?.includes(name) ? '*' : '';
        const type = schema.type || 'any';
        return `<span class="param-item">${name}${required}: ${type}</span>`;
      }).join('');
      
      paramsDetail.innerHTML = `<div class="params-header">Parameters:</div>${paramsList}`;
      meta.appendChild(paramsDetail);
    }
    
    // Add output information if available
    if (hasOutput && tool.outputSchema?.properties) {
      const outputDetail = document.createElement('div');
      outputDetail.className = 'tool-output-detail';
      
      const outputList = Object.entries(tool.outputSchema.properties).map(([name, schema]) => {
        const type = schema.type || 'any';
        return `<span class="output-item">${name}: ${type}</span>`;
      }).join('');
      
      outputDetail.innerHTML = `<div class="output-header">Returns:</div>${outputList}`;
      meta.appendChild(outputDetail);
    }
    
    const usageCount = document.createElement('span');
    usageCount.className = 'tool-usage-count';
    usageCount.textContent = `Used ${tool.usageCount || 0} times`;
    
    meta.appendChild(schemaInfo);
    meta.appendChild(usageCount);
    
    item.appendChild(header);
    item.appendChild(description);
    item.appendChild(meta);
    
    return item;
  }
  
  updateToolsList(filteredTools, selectedTool) {
    const toolsList = this.container.querySelector('.tools-list');
    if (!toolsList) return;
    
    toolsList.innerHTML = '';
    
    if (filteredTools.length === 0) {
      const noResults = this.createNoResults({ searchQuery: this.container.querySelector('.search-input').value });
      toolsList.appendChild(noResults);
    } else {
      filteredTools.forEach(tool => {
        const toolItem = this.createToolItem(tool, selectedTool);
        toolsList.appendChild(toolItem);
      });
    }
  }
  
  showLoading() {
    const searchInput = this.container.querySelector('.search-input');
    const toolsList = this.container.querySelector('.tools-list');
    
    if (searchInput) searchInput.classList.add('searching');
    if (toolsList) toolsList.classList.add('loading');
  }
  
  hideLoading() {
    const searchInput = this.container.querySelector('.search-input');
    const toolsList = this.container.querySelector('.tools-list');
    
    if (searchInput) searchInput.classList.remove('searching');
    if (toolsList) toolsList.classList.remove('loading');
  }
}

class ToolSearchPanelViewModel {
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
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(this.createPublicAPI());
    }
    
    return this.createPublicAPI();
  }
  
  render() {
    this.view.render(this.model.getState());
  }
  
  setupEventListeners() {
    // Search input with debouncing
    const searchInput = this.view.container.querySelector('.search-input');
    if (searchInput) {
      const handleSearch = (event) => {
        const query = event.target.value;
        
        // Clear previous timeout
        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }
        
        // Show loading state
        this.view.showLoading();
        
        // Debounce search
        this.searchTimeout = setTimeout(async () => {
          this.model.updateState('searchQuery', query);
          this.model.addToSearchHistory(query);
          
          // Perform search based on mode
          await this.performSearch();
          
          if (this.umbilical.onSearch) {
            this.umbilical.onSearch(query, this.model.getState('filteredTools'));
          }
        }, 300);
      };
      
      // Handle Enter key
      const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
          console.log('⌨️ Enter key pressed, triggering immediate search');
          clearTimeout(this.searchTimeout);
          this.searchTimeout = setTimeout(async () => {
            this.model.updateState('searchQuery', event.target.value);
            this.model.addToSearchHistory(event.target.value);
            await this.performSearch();
            if (this.umbilical.onSearch) {
              this.umbilical.onSearch(event.target.value, this.model.getState('filteredTools'));
            }
          }, 100);
        }
      };
      
      searchInput.addEventListener('input', handleSearch);
      searchInput.addEventListener('keydown', handleKeyDown);
      this.eventListeners.push(() => searchInput.removeEventListener('input', handleSearch));
      this.eventListeners.push(() => searchInput.removeEventListener('keydown', handleKeyDown));
    }
    
    // Filter selects
    const filterSelects = this.view.container.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
      const handleFilterChange = (event) => {
        const filterType = event.target.previousElementSibling.textContent.replace(':', '').toLowerCase();
        this.model.updateState(`filters.${filterType}`, event.target.value);
        this.render();
      };
      
      select.addEventListener('change', handleFilterChange);
      this.eventListeners.push(() => select.removeEventListener('change', handleFilterChange));
    });
    
    // Search mode buttons (use event delegation)
    const handleModeChange = (event) => {
      const button = event.target.closest('.search-mode-button');
      if (!button) return;
      
      const mode = button.dataset.mode;
      console.log('🔄 Search mode changed to:', mode);
      this.model.updateState('searchMode', mode);
      
      // Update button states
      const searchModeButtons = this.view.container.querySelectorAll('.search-mode-button');
      searchModeButtons.forEach(btn => {
        if (btn.dataset.mode === mode) {
          btn.classList.add('active');
          btn.style.background = 'var(--color-primary)';
          btn.style.color = 'white';
        } else {
          btn.classList.remove('active');
          btn.style.background = 'var(--surface-secondary)';
          btn.style.color = 'var(--text-primary)';
        }
      });
      
      // Update info text
      const infoText = this.view.container.querySelector('.search-mode-info');
      if (infoText) {
        const infoMessages = {
          text: 'Exact keyword matching',
          semantic: 'AI-powered concept search',
          both: 'Combined keyword + AI search'
        };
        infoText.textContent = infoMessages[mode];
      }
      
      // Trigger search if we have a query
      const currentQuery = this.model.getState('searchQuery');
      console.log('🔍 Current query:', currentQuery, 'Mode:', mode);
      if (currentQuery) {
        this.performSearch();
      }
    };
    
    this.view.container.addEventListener('click', handleModeChange);
    this.eventListeners.push(() => this.view.container.removeEventListener('click', handleModeChange));
    
    // View mode buttons
    const viewButtons = this.view.container.querySelectorAll('.view-button');
    viewButtons.forEach(button => {
      const handleViewChange = () => {
        const viewMode = button.dataset.viewMode;
        this.model.updateState('viewMode', viewMode);
        this.render();
      };
      
      button.addEventListener('click', handleViewChange);
      this.eventListeners.push(() => button.removeEventListener('click', handleViewChange));
    });
    
    // Show All Tools button
    const showAllButton = this.view.container.querySelector('.show-all-button');
    if (showAllButton) {
      const handleShowAll = () => {
        console.log('🔍 Show All Tools clicked');
        // Clear search query
        this.model.updateState('searchQuery', '');
        // Clear search input
        const searchInput = this.view.container.querySelector('.search-input');
        if (searchInput) {
          searchInput.value = '';
        }
        // Show all tools
        this.showAllTools();
      };
      
      showAllButton.addEventListener('click', handleShowAll);
      this.eventListeners.push(() => showAllButton.removeEventListener('click', handleShowAll));
    }
    
    // Tool selection
    const handleToolClick = (event) => {
      const toolItem = event.target.closest('.tool-item');
      if (toolItem) {
        const toolName = toolItem.dataset.toolName;
        const tool = this.model.getState('tools').find(t => t.name === toolName);
        this.selectTool(tool);
      }
    };
    
    // Suggestion links
    const handleSuggestionClick = (event) => {
      if (event.target.classList.contains('suggestion-link')) {
        const suggestion = event.target.dataset.suggestion;
        this.model.updateState('searchQuery', suggestion);
        this.render();
        
        // Focus search input
        const searchInput = this.view.container.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.value = suggestion;
        }
      }
    };
    
    this.view.container.addEventListener('click', (event) => {
      handleToolClick(event);
      handleSuggestionClick(event);
    });
    
    this.eventListeners.push(() => {
      this.view.container.removeEventListener('click', handleToolClick);
      this.view.container.removeEventListener('click', handleSuggestionClick);
    });
  }
  
  async performSearch() {
    const query = this.model.getState('searchQuery');
    const mode = this.model.getState('searchMode');
    
    if (!query) {
      this.model.updateFilteredTools();
      this.view.updateToolsList(this.model.getState('filteredTools'), this.model.getState('selectedTool'));
      return;
    }
    
    this.view.showLoading();
    
    if (mode === 'text') {
      // Text search only
      this.model.updateFilteredTools();
      this.view.updateToolsList(this.model.getState('filteredTools'), this.model.getState('selectedTool'));
    } else if (mode === 'semantic' && this.umbilical.onSemanticSearch) {
      // Semantic search only
      const results = await this.umbilical.onSemanticSearch(query);
      if (results) {
        this.model.updateState('filteredTools', results);
        this.view.updateToolsList(results, this.model.getState('selectedTool'));
      }
    } else if (mode === 'both' && this.umbilical.onSemanticSearch) {
      // Combined search
      const textResults = this.model.getState('filteredTools');
      const semanticResults = await this.umbilical.onSemanticSearch(query) || [];
      
      // Merge results, combining scores
      const mergedResults = this.mergeSearchResults(textResults, semanticResults);
      this.model.updateState('filteredTools', mergedResults);
      this.view.updateToolsList(mergedResults, this.model.getState('selectedTool'));
    }
    
    // Update results count
    const resultsCount = this.view.container.querySelector('.results-count');
    if (resultsCount) {
      resultsCount.textContent = `Found ${this.model.getState('filteredTools').length} tools`;
    }
    
    const resultsQuery = this.view.container.querySelector('.results-query');
    if (resultsQuery) {
      resultsQuery.textContent = query ? `for "${query}"` : '';
    }
    
    this.view.hideLoading();
  }
  
  mergeSearchResults(textResults, semanticResults) {
    const merged = new Map();
    
    // Add text results with their scores
    textResults.forEach(tool => {
      merged.set(tool.name, {
        ...tool,
        textScore: tool._searchScore || 0,
        semanticScore: 0,
        combinedScore: tool._searchScore || 0
      });
    });
    
    // Add/update with semantic results
    semanticResults.forEach((tool, index) => {
      const semanticScore = 10 - (index * 0.1); // Higher score for higher rank
      
      if (merged.has(tool.name)) {
        const existing = merged.get(tool.name);
        existing.semanticScore = semanticScore;
        // Weighted combination: 40% text, 60% semantic
        existing.combinedScore = (existing.textScore * 0.4) + (semanticScore * 0.6);
      } else {
        merged.set(tool.name, {
          ...tool,
          textScore: 0,
          semanticScore: semanticScore,
          combinedScore: semanticScore
        });
      }
    });
    
    // Convert to array and sort by combined score
    return Array.from(merged.values()).sort((a, b) => b.combinedScore - a.combinedScore);
  }
  
  async showAllTools() {
    console.log('🔍 Loading all tools...');
    this.view.showLoading();
    
    try {
      // Get all tools from the registry
      const allTools = this.model.getState('allTools') || [];
      console.log(`📋 Showing all ${allTools.length} tools`);
      
      // Update state with all tools as filtered results
      this.model.updateState('filteredTools', allTools);
      this.model.updateState('searchQuery', '');
      this.model.updateState('searchMode', 'text');
      
      // Update UI
      const resultsCount = this.view.container.querySelector('.results-count');
      if (resultsCount) {
        resultsCount.textContent = `Found ${allTools.length} tools`;
      }
      
      const resultsQuery = this.view.container.querySelector('.results-query');
      if (resultsQuery) {
        resultsQuery.textContent = '(showing all available tools)';
      }
      
      // Re-render the view
      this.render();
      
    } catch (error) {
      console.error('Error loading all tools:', error);
    } finally {
      this.view.hideLoading();
    }
  }
  
  selectTool(tool) {
    this.model.updateState('selectedTool', tool);
    this.render();
    
    if (this.umbilical.onToolSelect) {
      this.umbilical.onToolSelect(tool);
    }
  }
  
  createPublicAPI() {
    return {
      search: (query) => {
        this.model.updateState('searchQuery', query);
        this.render();
        
        // Update input field
        const searchInput = this.view.container.querySelector('.search-input');
        if (searchInput) searchInput.value = query;
      },
      setTools: (tools) => {
        this.model.updateState('tools', tools);
        this.model.updateFilteredTools();
        this.render();
      },
      getSelectedTool: () => this.model.getState('selectedTool'),
      getFilteredTools: () => this.model.getState('filteredTools'),
      clearSearch: () => {
        this.model.updateState('searchQuery', '');
        this.model.updateFilteredTools();
        this.render();
        
        const searchInput = this.view.container.querySelector('.search-input');
        if (searchInput) searchInput.value = '';
      },
      setFilters: (filters) => {
        Object.keys(filters).forEach(key => {
          this.model.updateState(`filters.${key}`, filters[key]);
        });
        this.render();
      },
      getSearchHistory: () => this.model.getState('searchHistory'),
      selectTool: (tool) => this.selectTool(tool),
      destroy: () => this.destroy()
    };
  }
  
  destroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.eventListeners.forEach(cleanup => cleanup());
    this.view.container.innerHTML = '';
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
  }
}

export const ToolSearchPanel = {
  create(umbilical) {
    // 1. Introspection Mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Container element');
      requirements.add('tools', 'array', 'Array of available tools (optional)', false);
      requirements.add('onSearch', 'function', 'Search callback (optional)', false);
      requirements.add('onToolSelect', 'function', 'Tool selection callback (optional)', false);
      requirements.add('onMount', 'function', 'Mount callback (optional)', false);
      requirements.add('onDestroy', 'function', 'Destroy callback (optional)', false);
      umbilical.describe(requirements);
      return;
    }
    
    // 2. Validation Mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidTools: !umbilical.tools || Array.isArray(umbilical.tools)
      });
    }
    
    // 3. Instance Creation Mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ToolSearchPanel');
    
    const model = new ToolSearchPanelModel(umbilical);
    const view = new ToolSearchPanelView(umbilical.dom);
    const viewModel = new ToolSearchPanelViewModel(model, view, umbilical);
    
    return viewModel.initialize();
  }
};