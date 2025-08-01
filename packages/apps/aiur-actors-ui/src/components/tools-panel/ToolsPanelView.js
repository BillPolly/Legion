/**
 * ToolsPanelView - View for tools panel component
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';

export class ToolsPanelView extends ExtendedBaseView {
  constructor(parentElement) {
    super(parentElement);
    
    this.parentElement = parentElement; // Store reference for compatibility
    this.onToolClick = null;
    this.onSearchInput = null;
    this.onSearchClear = null;
    this.onNavigate = null;
    this.onToolSelect = null;
    
    this.highlightedToolId = null;
    this.currentTools = [];
  }

  /**
   * Render the tools panel
   * @param {Object} options - Render options
   */
  render(options = {}) {
    this.toolsPanel = this.createElement('div', ['tools-panel']);
    
    // Apply theme if provided
    if (options.theme) {
      this.toolsPanel.classList.add(`tools-panel-theme-${options.theme}`);
    }
    
    // Header
    this.renderHeader();
    
    // Search
    this.renderSearch();
    
    // Tools list
    this.renderToolsList();
    
    // Add to parent
    this.parentElement.appendChild(this.toolsPanel);
    
    // Bind events
    this.bindEvents();
  }

  /**
   * Render header section
   */
  renderHeader() {
    this.header = this.createElement('div', ['tools-header']);
    
    const title = this.createElement('h3', ['tools-title']);
    title.textContent = 'Tools';
    
    this.header.appendChild(title);
    this.toolsPanel.appendChild(this.header);
  }

  /**
   * Render search section
   */
  renderSearch() {
    this.searchContainer = this.createElement('div', ['tools-search']);
    
    this.searchInput = this.createElement('input', [], {
      type: 'text',
      placeholder: 'Search tools...'
    });
    
    this.clearButton = this.createElement('button', ['search-clear'], {
      type: 'button',
      'aria-label': 'Clear search'
    });
    this.clearButton.textContent = '✕';
    this.clearButton.style.display = 'none';
    
    this.searchContainer.appendChild(this.searchInput);
    this.searchContainer.appendChild(this.clearButton);
    this.toolsPanel.appendChild(this.searchContainer);
    
    // Search results count
    this.searchResults = this.createElement('div', ['search-results-count']);
    this.searchResults.style.display = 'none';
    this.toolsPanel.appendChild(this.searchResults);
  }

  /**
   * Render tools list section
   */
  renderToolsList() {
    this.toolsList = this.createElement('div', ['tools-list'], {
      tabindex: '0'
    });
    
    this.toolsPanel.appendChild(this.toolsList);
    
    // Initially show empty state
    this.showEmptyState();
  }

  /**
   * Render list of tools
   * @param {Array} tools - Array of tools to render
   */
  renderTools(tools) {
    this.currentTools = tools || [];
    this.toolsList.innerHTML = '';
    
    if (this.currentTools.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.currentTools.forEach(tool => {
      const toolItem = this.createToolItem(tool);
      this.toolsList.appendChild(toolItem);
    });
  }

  /**
   * Render tools grouped by category
   * @param {Object} toolsByCategory - Tools grouped by category
   */
  renderToolsByCategory(toolsByCategory) {
    this.toolsList.innerHTML = '';
    this.currentTools = [];
    
    const categories = Object.keys(toolsByCategory);
    if (categories.length === 0) {
      this.showEmptyState();
      return;
    }
    
    categories.forEach(categoryName => {
      const tools = toolsByCategory[categoryName];
      this.currentTools.push(...tools);
      
      const categoryContainer = this.createElement('div', ['tool-category']);
      
      const categoryHeader = this.createElement('div', ['category-header']);
      categoryHeader.textContent = categoryName;
      categoryContainer.appendChild(categoryHeader);
      
      tools.forEach(tool => {
        const toolItem = this.createToolItem(tool);
        categoryContainer.appendChild(toolItem);
      });
      
      this.toolsList.appendChild(categoryContainer);
    });
  }

  /**
   * Create a tool item element
   * @param {Object} tool - Tool object
   * @returns {HTMLElement} Tool item element
   */
  createToolItem(tool) {
    const toolItem = this.createElement('div', ['tool-item'], {
      'data-tool-id': tool.id
    });
    
    const toolName = this.createElement('div', ['tool-name']);
    toolName.textContent = tool.name;
    
    const toolDescription = this.createElement('div', ['tool-description']);
    toolDescription.textContent = tool.description || '';
    
    toolItem.appendChild(toolName);
    toolItem.appendChild(toolDescription);
    
    // Add click handler
    toolItem.addEventListener('click', (e) => {
      if (toolItem.classList.contains('disabled')) {
        return;
      }
      if (this.onToolClick) {
        this.onToolClick(tool);
      }
    });
    
    // Add double-click handler for execution
    toolItem.addEventListener('dblclick', (e) => {
      if (toolItem.classList.contains('disabled')) {
        return;
      }
      if (this.onToolSelect) {
        this.onToolSelect(tool);
      }
    });
    
    // Add hover handlers
    toolItem.addEventListener('mouseenter', () => {
      toolItem.classList.add('hover');
    });
    
    toolItem.addEventListener('mouseleave', () => {
      toolItem.classList.remove('hover');
    });
    
    return toolItem;
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const emptyState = this.createElement('div', ['tools-empty']);
    emptyState.textContent = 'No tools available';
    this.toolsList.appendChild(emptyState);
  }

  /**
   * Set selected tool
   * @param {string|null} toolId - Tool ID to select
   */
  setSelectedTool(toolId) {
    // Clear previous selection
    const previousSelected = this.toolsList.querySelector('.tool-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Select new tool
    if (toolId) {
      const toolItem = this.toolsList.querySelector(`[data-tool-id="${toolId}"]`);
      if (toolItem) {
        toolItem.classList.add('selected');
      }
    }
  }

  /**
   * Set highlighted tool (for keyboard navigation)
   * @param {string|null} toolId - Tool ID to highlight
   */
  setHighlightedTool(toolId) {
    // Clear previous highlight
    const previousHighlighted = this.toolsList.querySelector('.tool-item.highlighted');
    if (previousHighlighted) {
      previousHighlighted.classList.remove('highlighted');
    }
    
    this.highlightedToolId = toolId;
    
    // Highlight new tool
    if (toolId) {
      const toolItem = this.toolsList.querySelector(`[data-tool-id="${toolId}"]`);
      if (toolItem) {
        toolItem.classList.add('highlighted');
        // Scroll into view if needed
        if (toolItem.scrollIntoView) {
          toolItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  /**
   * Set tool executing state
   * @param {string} toolId - Tool ID
   * @param {boolean} executing - Whether tool is executing
   */
  setToolExecuting(toolId, executing) {
    const toolItem = this.toolsList.querySelector(`[data-tool-id="${toolId}"]`);
    if (!toolItem) {
      return;
    }
    
    if (executing) {
      toolItem.classList.add('executing', 'disabled');
      
      // Add spinner
      const spinner = this.createElement('div', ['tool-spinner']);
      spinner.innerHTML = '⟳';
      toolItem.appendChild(spinner);
    } else {
      toolItem.classList.remove('executing', 'disabled');
      
      // Remove spinner
      const spinner = toolItem.querySelector('.tool-spinner');
      if (spinner) {
        spinner.remove();
      }
    }
  }

  /**
   * Set loading state for entire panel
   * @param {boolean} loading - Whether panel is loading
   */
  setLoading(loading) {
    if (loading) {
      this.toolsPanel.classList.add('loading');
      
      // Add loading overlay
      if (!this.loadingOverlay) {
        this.loadingOverlay = this.createElement('div', ['tools-loading']);
        this.loadingOverlay.textContent = 'Loading tools...';
        this.toolsPanel.appendChild(this.loadingOverlay);
      }
    } else {
      this.toolsPanel.classList.remove('loading');
      
      // Remove loading overlay
      if (this.loadingOverlay) {
        this.loadingOverlay.remove();
        this.loadingOverlay = null;
      }
    }
  }

  /**
   * Set search query in input
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    this.searchInput.value = query || '';
    this.clearButton.style.display = query ? 'block' : 'none';
  }

  /**
   * Show search results count
   * @param {number} count - Number of results
   * @param {number} total - Total number of tools
   */
  showSearchResults(count, total) {
    this.searchResults.textContent = `${count} of ${total} tools`;
    this.searchResults.style.display = 'block';
  }

  /**
   * Show no results message
   * @param {string} query - Search query
   */
  showNoResults(query) {
    const noResults = this.createElement('div', ['tools-no-results']);
    noResults.textContent = `No tools found for "${query}"`;
    this.toolsList.appendChild(noResults);
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.clearError();
    
    this.errorMessage = this.createElement('div', ['tools-error']);
    this.errorMessage.textContent = message;
    
    // Add retry button
    const retryButton = this.createElement('button', ['retry-button']);
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => {
      if (this.onRetry) {
        this.onRetry();
      }
    });
    
    this.errorMessage.appendChild(retryButton);
    this.toolsPanel.appendChild(this.errorMessage);
  }

  /**
   * Clear error message
   */
  clearError() {
    if (this.errorMessage) {
      this.errorMessage.remove();
      this.errorMessage = null;
    }
  }

  /**
   * Focus search input
   */
  focusSearch() {
    this.searchInput.focus();
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      this.clearButton.style.display = query ? 'block' : 'none';
      
      if (this.onSearchInput) {
        this.onSearchInput(query);
      }
    });
    
    // Clear search button
    this.clearButton.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearButton.style.display = 'none';
      
      if (this.onSearchClear) {
        this.onSearchClear();
      }
    });
    
    // Keyboard navigation
    this.toolsList.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (this.onNavigate) {
            this.onNavigate('down');
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (this.onNavigate) {
            this.onNavigate('up');
          }
          break;
          
        case 'Enter':
          e.preventDefault();
          if (this.highlightedToolId && this.onToolSelect) {
            const tool = this.currentTools.find(t => t.id === this.highlightedToolId);
            if (tool) {
              this.onToolSelect(tool);
            }
          }
          break;
      }
    });
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus search unless already in an input
        if (document.activeElement.tagName !== 'INPUT' && 
            document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.focusSearch();
        }
      }
    });
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.toolsPanel && this.toolsPanel.parentNode) {
      this.toolsPanel.parentNode.removeChild(this.toolsPanel);
    }
    
    // Clear references
    this.onToolClick = null;
    this.onSearchInput = null;
    this.onSearchClear = null;
    this.onNavigate = null;
    this.onToolSelect = null;
    
    super.destroy();
  }
}