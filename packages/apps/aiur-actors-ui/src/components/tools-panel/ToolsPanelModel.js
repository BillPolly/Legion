/**
 * ToolsPanelModel - Model for tools panel component
 */
import { ExtendedBaseModel } from '../base/ExtendedBaseModel.js';

export class ToolsPanelModel extends ExtendedBaseModel {
  constructor() {
    super();
    
    this.tools = [];
    this.selectedToolId = null;
    this.searchQuery = '';
    this.executingTools = new Set();
  }

  /**
   * Set the tools list
   * @param {Array} tools - Array of tool objects
   */
  setTools(tools) {
    this.tools = tools || [];
    this.notify('toolsChanged', { tools: this.tools });
  }

  /**
   * Get all tools
   * @returns {Array} Array of tools
   */
  getTools() {
    return this.tools;
  }

  /**
   * Select a tool by ID
   * @param {string|null} toolId - Tool ID to select, or null to deselect
   */
  selectTool(toolId) {
    if (toolId && !this.getToolById(toolId)) {
      return; // Tool doesn't exist
    }
    
    if (this.selectedToolId === toolId) {
      return; // Already selected
    }
    
    this.selectedToolId = toolId;
    const tool = toolId ? this.getToolById(toolId) : null;
    
    this.notify('toolSelected', { toolId, tool });
  }

  /**
   * Get the currently selected tool
   * @returns {Object|null} Selected tool object or null
   */
  getSelectedTool() {
    return this.selectedToolId ? this.getToolById(this.selectedToolId) : null;
  }

  /**
   * Set the search query
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    const trimmedQuery = (query || '').trim();
    if (this.searchQuery === trimmedQuery) {
      return;
    }
    
    this.searchQuery = trimmedQuery;
    this.notify('searchQueryChanged', { query: this.searchQuery });
  }

  /**
   * Get filtered tools based on search query
   * @returns {Array} Filtered tools
   */
  getFilteredTools() {
    if (!this.searchQuery) {
      return this.tools;
    }
    
    const query = this.searchQuery.toLowerCase();
    
    return this.tools.filter(tool => {
      const name = (tool.name || '').toLowerCase();
      const description = (tool.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }

  /**
   * Group tools by category
   * @returns {Object} Tools grouped by category
   */
  getToolsByCategory() {
    const grouped = {};
    
    this.tools.forEach(tool => {
      const category = tool.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tool);
    });
    
    return grouped;
  }

  /**
   * Get tool by ID
   * @param {string} toolId - Tool ID
   * @returns {Object|null} Tool object or null
   */
  getToolById(toolId) {
    return this.tools.find(tool => tool.id === toolId) || null;
  }

  /**
   * Update tool details
   * @param {string} toolId - Tool ID
   * @param {Object} updates - Properties to update
   */
  updateToolDetails(toolId, updates) {
    const tool = this.getToolById(toolId);
    if (!tool) {
      return;
    }
    
    Object.assign(tool, updates);
    this.notify('toolDetailsUpdated', { toolId, updates });
  }

  /**
   * Set tool execution state
   * @param {string} toolId - Tool ID
   * @param {boolean} executing - Whether tool is executing
   */
  setToolExecuting(toolId, executing) {
    if (!this.getToolById(toolId)) {
      return;
    }
    
    if (executing) {
      this.executingTools.add(toolId);
    } else {
      this.executingTools.delete(toolId);
    }
    
    this.notify('toolExecutionStateChanged', { toolId, executing });
  }

  /**
   * Check if tool is executing
   * @param {string} toolId - Tool ID
   * @returns {boolean} Whether tool is executing
   */
  isToolExecuting(toolId) {
    return this.executingTools.has(toolId);
  }

  /**
   * Add a new tool
   * @param {Object} tool - Tool object
   */
  addTool(tool) {
    if (!tool || !tool.id) {
      return;
    }
    
    // Don't add if already exists
    if (this.getToolById(tool.id)) {
      return;
    }
    
    this.tools.push(tool);
    this.notify('toolAdded', { tool });
  }

  /**
   * Remove a tool
   * @param {string} toolId - Tool ID
   */
  removeTool(toolId) {
    const index = this.tools.findIndex(tool => tool.id === toolId);
    if (index === -1) {
      return;
    }
    
    const tool = this.tools[index];
    this.tools.splice(index, 1);
    
    // Deselect if selected
    if (this.selectedToolId === toolId) {
      this.selectedToolId = null;
    }
    
    // Remove from executing set
    this.executingTools.delete(toolId);
    
    this.notify('toolRemoved', { toolId, tool });
  }

  /**
   * Clear all data
   */
  destroy() {
    this.tools = [];
    this.selectedToolId = null;
    this.searchQuery = '';
    this.executingTools.clear();
    super.destroy();
  }
}