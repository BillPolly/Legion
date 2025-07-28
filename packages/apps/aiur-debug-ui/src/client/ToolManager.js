/**
 * ToolManager - Elegant tool state management with reactive updates
 * 
 * Provides a single source of truth for tool definitions with automatic
 * propagation to UI components via EventEmitter pattern.
 */
export class ToolManager extends EventTarget {
  constructor(mcpInterface) {
    super();
    this.mcpInterface = mcpInterface;
    this.tools = new Map(); // Canonical source of truth
    this.isReady = false;
    this.isLoading = false;
  }

  /**
   * Initialize tool manager and load initial tools
   * @returns {Promise<Map>} The loaded tools
   */
  async initialize() {
    if (this.isLoading) {
      // Return existing promise if already loading
      return this.loadingPromise;
    }

    this.isLoading = true;
    this.loadingPromise = this._loadTools();
    
    try {
      await this.loadingPromise;
      this.isReady = true;
      this.dispatchEvent(new CustomEvent('ready', { detail: this.tools }));
      return this.tools;
    } finally {
      this.isLoading = false;
      this.loadingPromise = null;
    }
  }

  /**
   * Get current tools map
   * @returns {Map<string, Object>} Tool definitions
   */
  getTools() {
    return this.tools;
  }

  /**
   * Check if tools are ready
   * @returns {boolean} True if tools are loaded and ready
   */
  isToolsReady() {
    return this.isReady;
  }

  /**
   * Get tool by name
   * @param {string} toolName - Name of the tool
   * @returns {Object|undefined} Tool definition or undefined
   */
  getTool(toolName) {
    return this.tools.get(toolName);
  }

  /**
   * Get all tool names
   * @returns {string[]} Array of tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Refresh tools from server
   * @returns {Promise<Map>} The updated tools
   */
  async refresh() {
    console.log('[ToolManager] Refreshing tools...');
    await this._loadTools();
    this.dispatchEvent(new CustomEvent('toolsChanged', { detail: this.tools }));
    return this.tools;
  }

  /**
   * Handle tools update from external source
   * @param {Object[]} toolsArray - Array of tool definitions
   */
  onToolsUpdated(toolsArray) {
    console.log(`[ToolManager] Updating tools: ${toolsArray.length} tools received`);
    
    // Clear existing tools
    this.tools.clear();
    
    // Add new tools
    toolsArray.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
    
    // Notify listeners
    this.dispatchEvent(new CustomEvent('toolsChanged', { detail: this.tools }));
    
    if (!this.isReady) {
      this.isReady = true;
      this.dispatchEvent(new CustomEvent('ready', { detail: this.tools }));
    }
  }

  /**
   * Private method to load tools from MCP interface
   * @private
   * @returns {Promise<void>}
   */
  async _loadTools() {
    if (!this.mcpInterface || !this.mcpInterface.requestTools) {
      console.warn('[ToolManager] No MCP interface available for tool loading');
      return;
    }

    try {
      console.log('[ToolManager] Loading tools from MCP interface...');
      const toolsArray = await this.mcpInterface.requestTools();
      
      // Clear and rebuild tools map
      this.tools.clear();
      if (toolsArray && Array.isArray(toolsArray)) {
        toolsArray.forEach(tool => {
          this.tools.set(tool.name, tool);
        });
      }
      
      console.log(`[ToolManager] Loaded ${this.tools.size} tools`);
    } catch (error) {
      console.error('[ToolManager] Failed to load tools:', error);
      // Don't throw - allow app to continue with empty tools
    }
  }

  /**
   * Create a reactive interface for components that need tool access
   * @returns {Object} Interface with getTools and reactive update support
   */
  createInterface() {
    return {
      getTools: () => this.tools,
      isReady: () => this.isReady,
      onReady: (callback) => {
        if (this.isReady) {
          callback(this.tools);
        } else {
          this.addEventListener('ready', (event) => callback(event.detail));
        }
      },
      onToolsChanged: (callback) => {
        this.addEventListener('toolsChanged', (event) => callback(event.detail));
      },
      refresh: () => this.refresh()
    };
  }
}

export default ToolManager;