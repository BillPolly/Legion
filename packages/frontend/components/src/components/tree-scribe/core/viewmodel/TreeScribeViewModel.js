/**
 * TreeScribeViewModel - Coordination layer between Model and View
 * Implements command pattern and manages state synchronization
 */

import { FoldingManager } from '../../features/interaction/FoldingManager.js';

export class TreeScribeViewModel {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.destroyed = false;
    this.eventListeners = new Map();
    this.modelEventListeners = [];
    
    this.state = {
      loading: false,
      error: null,
      hasDocument: false,
      nodeCount: 0
    };

    // Initialize folding manager
    this.foldingManager = null;

    // Available commands
    this.commands = new Map([
      ['loadYaml', this._loadYamlCommand.bind(this)],
      ['expandAll', this._expandAllCommand.bind(this)],
      ['collapseAll', this._collapseAllCommand.bind(this)],
      ['expandToDepth', this._expandToDepthCommand.bind(this)],
      ['toggleNode', this._toggleNodeCommand.bind(this)],
      ['search', this._searchCommand.bind(this)],
      ['export', this._exportCommand.bind(this)]
    ]);

    this._initializeEventHandlers();
  }

  /**
   * Initialize event handlers for model-view coordination
   * @private
   */
  _initializeEventHandlers() {
    // Listen to model changes and update view
    const modelChangeHandler = (data) => {
      if (this.destroyed) return;
      
      this._updateState();
      this._updateView();
      
      // Emit external events
      if (data.type === 'loaded') {
        this._emit('documentLoaded', this.model.rootNode);
      }
    };
    
    this.modelEventListeners.push(
      this.model.on('modelChanged', modelChangeHandler)
    );
    
    // Connect view's toggle handler to ViewModel
    if (this.view) {
      this.view.onNodeToggle = (nodeId) => {
        console.log('[TreeScribeViewModel] Node toggle requested:', nodeId);
        this.executeCommand('toggleNode', { nodeId });
      };
    }
  }

  /**
   * Execute a command with parameters
   */
  executeCommand(commandName, params = {}) {
    if (this.destroyed) return false;
    
    const command = this.commands.get(commandName);
    if (!command) return false;
    
    try {
      return command(params);
    } catch (error) {
      console.error(`Command execution failed: ${commandName}`, error);
      this.state.error = error.message;
      return false;
    }
  }

  /**
   * Check if a command can be executed
   */
  canExecuteCommand(commandName) {
    if (this.destroyed) return false;
    
    switch (commandName) {
      case 'loadYaml':
        return true;
      case 'expandAll':
      case 'collapseAll':
      case 'expandToDepth':
      case 'search':
      case 'export':
        return this.state.hasDocument;
      case 'toggleNode':
        return this.state.hasDocument;
      default:
        return false;
    }
  }

  /**
   * Get list of available commands
   */
  getAvailableCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Handle events from the view
   */
  handleViewEvent(eventType, data) {
    if (this.destroyed) return;
    
    switch (eventType) {
      case 'nodeToggle':
        this.executeCommand('toggleNode', { nodeId: data.nodeId });
        break;
      case 'search':
        this.executeCommand('search', { query: data.query });
        break;
      case 'expandAll':
        this.executeCommand('expandAll');
        break;
      case 'collapseAll':
        this.executeCommand('collapseAll');
        break;
      case 'export':
        this.executeCommand('export', data);
        break;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType);
    listeners.push(callback);
    
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(eventType, data) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  /**
   * Update internal state based on model
   * @private
   */
  _updateState() {
    this.state.hasDocument = !!this.model.rootNode;
    this.state.nodeCount = this.model.rootNode ? this.model.getAllNodes().length : 0;
    this.state.error = null; // Clear error on successful operations
  }

  /**
   * Update view with current model data
   * @private
   */
  _updateView() {
    if (!this.view || this.view.destroyed) return;
    
    if (this.model.rootNode) {
      const nodes = this._prepareNodesForView();
      this.view.renderTree(nodes);
    } else {
      this.view.renderTree([]);
    }
  }

  /**
   * Prepare model nodes for view rendering
   * @private
   */
  _prepareNodesForView() {
    // Only return root node as array - let view handle recursive rendering
    if (!this.model.rootNode) return [];
    
    // Convert node to view-friendly format recursively
    const prepareNode = (node) => ({
      id: node.id,
      title: node.title,
      content: node.content,
      contentType: node.contentType,
      expanded: node.state?.expanded || false,
      visible: node.state?.visible !== false,
      depth: node.getDepth(),
      isLeaf: node.isLeaf(),
      children: node.children.map(child => prepareNode(child))
    });
    
    return [prepareNode(this.model.rootNode)];
  }

  // Command implementations

  /**
   * Load YAML command
   * @private
   */
  _loadYamlCommand(params) {
    const { yamlContent } = params;
    if (!yamlContent) return false;
    
    this.state.loading = true;
    this.model.loadYaml(yamlContent);
    
    // Initialize folding manager after document is loaded
    if (this.foldingManager) {
      this.foldingManager.destroy();
    }
    this.foldingManager = new FoldingManager(this.model);
    
    this.state.loading = false;
    
    return true;
  }

  /**
   * Expand all nodes command
   * @private
   */
  _expandAllCommand() {
    if (!this.foldingManager) return false;
    
    const success = this.foldingManager.expandAll();
    if (success) {
      this._updateView();
    }
    return success;
  }

  /**
   * Collapse all nodes command
   * @private
   */
  _collapseAllCommand() {
    if (!this.foldingManager) return false;
    
    const success = this.foldingManager.collapseAll();
    if (success) {
      this._updateView();
    }
    return success;
  }

  /**
   * Expand to specific depth command
   * @private
   */
  _expandToDepthCommand(params) {
    const { depth } = params;
    if (!this.foldingManager) return false;
    
    const success = this.foldingManager.expandToDepth(depth);
    if (success) {
      this._updateView();
    }
    return success;
  }

  /**
   * Toggle node expanded state command
   * @private
   */
  _toggleNodeCommand(params) {
    const { nodeId } = params;
    if (!nodeId || !this.foldingManager) return false;
    
    const success = this.foldingManager.toggleNode(nodeId);
    if (success) {
      const node = this.model.getNode(nodeId);
      this._updateView();
      this._emit('nodeToggled', { nodeId, expanded: node.state.expanded });
    }
    
    return success;
  }

  /**
   * Search command
   * @private
   */
  _searchCommand(params) {
    const { query } = params;
    if (!query || !this.model.rootNode) return false;
    
    // Basic search implementation
    const allNodes = this.model.getAllNodes();
    const results = allNodes.filter(node => 
      node.title.toLowerCase().includes(query.toLowerCase()) ||
      node.content.toLowerCase().includes(query.toLowerCase())
    );
    
    // Highlight search results (basic implementation)
    allNodes.forEach(node => {
      node.setState({ searchHighlight: false });
    });
    
    results.forEach(node => {
      node.setState({ searchHighlight: true });
    });
    
    this._updateView();
    this._emit('searchCompleted', { query, results: results.length });
    
    return true;
  }

  /**
   * Export command
   * @private
   */
  _exportCommand(params) {
    if (!this.model.rootNode) return false;
    
    const format = params.format || 'json';
    let exportData;
    
    switch (format) {
      case 'json':
        exportData = this.model.exportJson();
        break;
      case 'html':
        // Basic HTML export (would be enhanced in full implementation)
        exportData = this._exportToHtml();
        break;
      default:
        return false;
    }
    
    this._emit('exportCompleted', { format, data: exportData });
    return true;
  }

  /**
   * Basic HTML export implementation
   * @private
   */
  _exportToHtml() {
    if (!this.model.rootNode) return '';
    
    const exportNode = (node, depth = 0) => {
      const indent = '  '.repeat(depth);
      let html = `${indent}<div class="tree-node" data-depth="${depth}">\n`;
      html += `${indent}  <h${Math.min(depth + 1, 6)}>${node.title}</h${Math.min(depth + 1, 6)}>\n`;
      
      if (node.content) {
        html += `${indent}  <div class="node-content">${node.content}</div>\n`;
      }
      
      if (node.children.length > 0) {
        html += `${indent}  <div class="node-children">\n`;
        node.children.forEach(child => {
          html += exportNode(child, depth + 1);
        });
        html += `${indent}  </div>\n`;
      }
      
      html += `${indent}</div>\n`;
      return html;
    };
    
    return `<div class="tree-scribe-export">\n${exportNode(this.model.rootNode)}</div>`;
  }

  /**
   * Render the tree view
   */
  render() {
    this._updateView();
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;
    
    // Destroy folding manager
    if (this.foldingManager) {
      this.foldingManager.destroy();
      this.foldingManager = null;
    }
    
    // Remove model event listeners
    this.modelEventListeners.forEach(removeListener => {
      if (typeof removeListener === 'function') {
        removeListener();
      }
    });
    this.modelEventListeners = [];
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Clear references
    this.model = null;
    this.view = null;
    
    this.destroyed = true;
  }
}