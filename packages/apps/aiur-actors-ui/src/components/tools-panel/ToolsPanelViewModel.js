/**
 * ToolsPanelViewModel - ViewModel for tools panel component
 */
import { ExtendedBaseViewModel } from '../base/ExtendedBaseViewModel.js';

export class ToolsPanelViewModel extends ExtendedBaseViewModel {
  constructor(model, view, actorSpace) {
    super(model, view, actorSpace);
    
    this.groupByCategory = false;
    this.showDescriptions = true;
    this.highlightedIndex = -1;
  }

  /**
   * Initialize the view model
   */
  initialize() {
    super.initialize();
    
    // Get additional actors for tools panel
    this.actors.toolsActor = this.actorSpace.getActor('tools-actor');
    
    // Request initial tools list
    this.requestToolsList();
  }

  /**
   * Bind model and view
   */
  bind() {
    super.bind();
    
    // Bind view event handlers
    this.view.onToolClick = this.handleToolClick.bind(this);
    this.view.onSearchInput = this.handleSearchInput.bind(this);
    this.view.onSearchClear = this.handleSearchClear.bind(this);
    this.view.onNavigate = this.handleNavigate.bind(this);
    this.view.onToolSelect = this.handleToolSelect.bind(this);
    this.view.onRetry = this.handleRetry.bind(this);
  }

  /**
   * Request tools list from actor
   */
  requestToolsList() {
    this.view.setLoading(true);
    
    if (this.actors.toolsActor) {
      this.actors.toolsActor.receive({
        type: 'getTools'
      });
    }
  }

  /**
   * Handle tool click from view
   * @param {Object} tool - Tool object
   */
  handleToolClick(tool) {
    // Toggle selection
    const currentSelected = this.model.getSelectedTool();
    if (currentSelected && currentSelected.id === tool.id) {
      this.model.selectTool(null);
    } else {
      this.model.selectTool(tool.id);
    }
  }

  /**
   * Handle tool selection (execute)
   * @param {Object} tool - Tool object
   */
  handleToolSelect(tool) {
    this.executeTool(tool.id);
  }

  /**
   * Handle search input from view
   * @param {string} query - Search query
   */
  handleSearchInput(query) {
    this.model.setSearchQuery(query);
  }

  /**
   * Handle search clear from view
   */
  handleSearchClear() {
    this.model.setSearchQuery('');
  }

  /**
   * Handle keyboard navigation
   * @param {string} direction - Navigation direction ('up' or 'down')
   */
  handleNavigate(direction) {
    const filteredTools = this.model.getFilteredTools();
    if (filteredTools.length === 0) {
      return;
    }
    
    if (direction === 'down') {
      this.highlightedIndex = (this.highlightedIndex + 1) % filteredTools.length;
    } else if (direction === 'up') {
      this.highlightedIndex = this.highlightedIndex <= 0 
        ? filteredTools.length - 1 
        : this.highlightedIndex - 1;
    }
    
    const highlightedTool = filteredTools[this.highlightedIndex];
    if (highlightedTool) {
      this.view.setHighlightedTool(highlightedTool.id);
    }
  }

  /**
   * Handle retry button click
   */
  handleRetry() {
    this.view.clearError();
    this.requestToolsList();
  }

  /**
   * Execute a tool
   * @param {string} toolId - Tool ID
   */
  executeTool(toolId) {
    if (this.model.isToolExecuting(toolId)) {
      return; // Already executing
    }
    
    this.model.setToolExecuting(toolId, true);
    
    if (this.actors.commandActor) {
      this.actors.commandActor.receive({
        type: 'executeTool',
        toolId
      });
    }
  }

  /**
   * Toggle category view
   */
  toggleCategoryView() {
    this.groupByCategory = !this.groupByCategory;
    this.refreshView();
  }

  /**
   * Refresh the view based on current state
   */
  refreshView() {
    const filteredTools = this.model.getFilteredTools();
    
    if (this.groupByCategory) {
      const grouped = this.model.getToolsByCategory();
      // Filter each category
      const filteredGrouped = {};
      Object.keys(grouped).forEach(category => {
        const categoryTools = grouped[category].filter(tool => 
          filteredTools.includes(tool)
        );
        if (categoryTools.length > 0) {
          filteredGrouped[category] = categoryTools;
        }
      });
      this.view.renderToolsByCategory(filteredGrouped);
    } else {
      this.view.renderTools(filteredTools);
    }
    
    // Update search results
    if (this.model.searchQuery) {
      const totalTools = this.model.getTools().length;
      if (filteredTools.length === 0) {
        this.view.showNoResults(this.model.searchQuery);
      } else {
        this.view.showSearchResults(filteredTools.length, totalTools);
      }
    }
  }

  /**
   * Handle model changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  onModelChange(event, data) {
    super.onModelChange(event, data);
    
    switch (event) {
      case 'toolsChanged':
        this.view.setLoading(false);
        this.refreshView();
        break;
        
      case 'toolSelected':
        this.view.setSelectedTool(data.toolId);
        
        // Notify command actor
        if (data.toolId && this.actors.commandActor) {
          this.actors.commandActor.receive({
            type: 'toolSelected',
            toolId: data.toolId,
            tool: data.tool
          });
        }
        break;
        
      case 'searchQueryChanged':
        this.view.setSearchQuery(data.query);
        this.highlightedIndex = -1; // Reset navigation
        this.refreshView();
        break;
        
      case 'toolExecutionStateChanged':
        this.view.setToolExecuting(data.toolId, data.executing);
        break;
        
      case 'toolDetailsUpdated':
        this.refreshView();
        break;
        
      case 'toolAdded':
        this.refreshView();
        break;
        
      case 'toolRemoved':
        this.refreshView();
        break;
    }
  }

  /**
   * Handle updates from actors
   * @param {Object} update - Update from actor
   */
  handleActorUpdate(update) {
    super.handleActorUpdate(update);
    
    switch (update.type) {
      case 'toolsListResponse':
        this.view.clearError();
        this.model.setTools(update.tools || []);
        break;
        
      case 'toolsListError':
        this.view.setLoading(false);
        this.view.showError(`Failed to load tools: ${update.error}`);
        break;
        
      case 'toolExecutionComplete':
        this.model.setToolExecuting(update.toolId, false);
        break;
        
      case 'toolExecutionError':
        this.model.setToolExecuting(update.toolId, false);
        this.view.showError(`Tool execution failed: ${update.error}`);
        break;
        
      case 'toolDetailsUpdate':
        this.model.updateToolDetails(update.toolId, update.details);
        break;
        
      case 'toolAdded':
        this.model.addTool(update.tool);
        break;
        
      case 'toolRemoved':
        this.model.removeTool(update.toolId);
        break;
    }
  }

  /**
   * Get tools panel API
   * @returns {Object} Tools panel API
   */
  getToolsPanelAPI() {
    return {
      refreshTools: () => this.requestToolsList(),
      selectTool: (toolId) => this.model.selectTool(toolId),
      getSelectedTool: () => this.model.getSelectedTool(),
      executeTool: (toolId) => this.executeTool(toolId),
      searchTools: (query) => this.model.setSearchQuery(query),
      toggleCategoryView: () => this.toggleCategoryView(),
      getTools: () => this.model.getTools(),
      getFilteredTools: () => this.model.getFilteredTools()
    };
  }

  /**
   * Retry loading tools
   */
  retryLoadTools() {
    this.requestToolsList();
  }
}