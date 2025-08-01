/**
 * ViewModeManager - Manages switching between tree and source views
 */
import { HierarchyTreeView } from './HierarchyTreeView.js';
import { SourceView } from './SourceView.js';

export class ViewModeManager {
  constructor(dom, config = {}) {
    this.dom = dom;
    this.config = {
      content: '',
      format: 'json',
      initialMode: 'tree',
      theme: 'light',
      ...config
    };
    
    this.currentMode = this.config.initialMode;
    this.currentView = null;
    this.isDestroyed = false;
    
    // State preservation
    this.state = {
      expandedNodes: new Set(),
      selectedNode: null,
      editingNode: null,
      sourceContent: this.config.content
    };
    
    // Event handlers
    this.eventHandlers = {
      modeChange: [],
      parseError: [],
      contentChange: []
    };
  }

  /**
   * Render the current view mode
   */
  render() {
    if (this.isDestroyed) {
      return;
    }

    this.destroyCurrentView();
    
    if (this.currentMode === 'tree') {
      this.renderTreeView();
    } else {
      this.renderSourceView();
    }
  }

  /**
   * Render tree view
   * @private
   */
  renderTreeView() {
    try {
      const treeConfig = {
        content: this.config.content,
        format: this.config.format,
        theme: this.config.theme,
        expandedNodes: Array.from(this.state.expandedNodes),
        selectedNode: this.state.selectedNode
      };

      this.currentView = new HierarchyTreeView(this.dom, treeConfig);
      this.currentView.render();
      
      // Attach tree view event listeners
      this.currentView.on('nodeExpanded', (nodeId) => {
        this.state.expandedNodes.add(nodeId);
      });
      
      this.currentView.on('nodeCollapsed', (nodeId) => {
        this.state.expandedNodes.delete(nodeId);
      });
      
      this.currentView.on('nodeSelected', (nodeId) => {
        this.state.selectedNode = nodeId;
      });
      
      this.currentView.on('editStart', (nodeId) => {
        this.state.editingNode = nodeId;
      });
      
      this.currentView.on('editEnd', () => {
        this.state.editingNode = null;
      });
      
      this.currentView.on('contentChange', (data) => {
        this.config.content = data.newContent;
        this.state.sourceContent = data.newContent;
        this.emit('contentChange', data);
      });
      
    } catch (error) {
      console.error('Failed to render tree view:', error);
      this.emit('parseError', {
        content: this.config.content,
        format: this.config.format,
        error: error.message
      });
    }
  }

  /**
   * Render source view
   * @private
   */
  renderSourceView() {
    const sourceConfig = {
      content: this.state.sourceContent || this.config.content,
      format: this.config.format,
      theme: this.config.theme,
      readOnly: false
    };

    this.currentView = new SourceView(this.dom, sourceConfig);
    this.currentView.render();
    
    // Attach source view event listeners
    this.currentView.on('contentChange', (data) => {
      this.state.sourceContent = data.newContent;
      this.emit('contentChange', data);
    });
  }

  /**
   * Switch to tree mode
   */
  async switchToTree() {
    if (this.currentMode === 'tree' || this.isDestroyed) {
      return { success: true };
    }

    try {
      // Validate source content before switching
      const sourceContent = this.getSourceContent();
      const validation = this.validateContent(sourceContent, this.config.format);
      
      if (!validation.valid) {
        this.emit('parseError', {
          content: sourceContent,
          format: this.config.format,
          errors: validation.errors
        });
        return { success: false, error: 'Invalid content format' };
      }

      // Cancel any ongoing editing
      if (this.state.editingNode) {
        this.state.editingNode = null;
      }

      const fromMode = this.currentMode;
      this.currentMode = 'tree';
      this.config.content = sourceContent;
      
      this.render();
      
      this.emit('modeChange', {
        fromMode: fromMode,
        toMode: 'tree',
        format: this.config.format
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to switch to tree mode:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch to source mode
   */
  async switchToSource() {
    if (this.currentMode === 'source' || this.isDestroyed) {
      return { success: true };
    }

    try {
      // Cancel any ongoing editing
      if (this.state.editingNode) {
        this.state.editingNode = null;
      }

      const fromMode = this.currentMode;
      this.currentMode = 'source';
      
      // Update source content with current tree content
      this.state.sourceContent = this.config.content;
      
      this.render();
      
      this.emit('modeChange', {
        fromMode: fromMode,
        toMode: 'source',
        format: this.config.format
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to switch to source mode:', error);
      // Restore previous mode on failure
      this.currentMode = 'tree';
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle between tree and source modes
   */
  async toggleMode() {
    if (this.currentMode === 'tree') {
      return await this.switchToSource();
    } else {
      return await this.switchToTree();
    }
  }

  /**
   * Get current view mode
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Check if in tree mode
   */
  isTreeMode() {
    return this.currentMode === 'tree';
  }

  /**
   * Check if in source mode
   */
  isSourceMode() {
    return this.currentMode === 'source';
  }

  /**
   * Get supported modes
   */
  getSupportedModes() {
    return ['tree', 'source'];
  }

  /**
   * Get current content
   */
  getContent() {
    if (this.currentMode === 'source') {
      return this.getSourceContent();
    }
    return this.config.content;
  }

  /**
   * Get source content
   */
  getSourceContent() {
    if (this.currentView && this.currentView.getContent) {
      return this.currentView.getContent();
    }
    return this.state.sourceContent || this.config.content;
  }

  /**
   * Set source content
   */
  setContent(content) {
    this.config.content = content;
    this.state.sourceContent = content;
    if (this.currentView && this.currentView.setContent) {
      this.currentView.setContent(content);
    }
  }
  
  setSourceContent(content) {
    this.state.sourceContent = content;
    if (this.currentView && this.currentView.setContent) {
      this.currentView.setContent(content);
    }
  }

  /**
   * Get current format
   */
  getFormat() {
    return this.config.format;
  }

  /**
   * Get tree data (when in tree mode)
   */
  getTreeData() {
    if (this.currentView && this.currentView.getTreeData) {
      return this.currentView.getTreeData();
    }
    return null;
  }

  /**
   * Get expanded nodes
   */
  getExpandedNodes() {
    return Array.from(this.state.expandedNodes);
  }

  /**
   * Expand a node
   */
  expandNode(nodeId) {
    this.state.expandedNodes.add(nodeId);
    if (this.currentView && this.currentView.expandNode) {
      this.currentView.expandNode(nodeId);
    }
  }

  /**
   * Get selected node
   */
  getSelectedNode() {
    return this.state.selectedNode;
  }

  /**
   * Select a node
   */
  selectNode(nodeId) {
    this.state.selectedNode = nodeId;
    if (this.currentView && this.currentView.selectNode) {
      this.currentView.selectNode(nodeId);
    }
  }

  /**
   * Check if currently editing
   */
  isEditing() {
    return this.state.editingNode !== null;
  }

  /**
   * Start editing a node
   */
  startEditing(nodeId) {
    this.state.editingNode = nodeId;
    if (this.currentView && this.currentView.startEditing) {
      this.currentView.startEditing(nodeId);
    }
  }

  /**
   * Get current view instance
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Validate content format
   * @private
   */
  validateContent(content, format) {
    try {
      switch (format) {
        case 'json':
          JSON.parse(content);
          return { valid: true, errors: [] };
          
        case 'xml':
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'application/xml');
          const errors = doc.getElementsByTagName('parsererror');
          if (errors.length > 0) {
            return {
              valid: false,
              errors: [errors[0].textContent]
            };
          }
          return { valid: true, errors: [] };
          
        default:
          // Other formats are always valid for now
          return { valid: true, errors: [] };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Destroy current view
   * @private
   */
  destroyCurrentView() {
    if (this.currentView) {
      try {
        if (this.currentView.destroy) {
          this.currentView.destroy();
        }
      } catch (error) {
        console.warn('Error destroying current view:', error);
      }
      this.currentView = null;
    }
  }

  /**
   * Add event listener
   */
  on(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].push(handler);
    }
  }

  /**
   * Remove event listener
   */
  off(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      const index = this.eventHandlers[eventName].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[eventName].splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   * @private
   */
  emit(eventName, data) {
    if (this.eventHandlers[eventName] && !this.isDestroyed) {
      this.eventHandlers[eventName].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }

  /**
   * Destroy the view mode manager
   */
  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    
    this.destroyCurrentView();
    
    // Clear event handlers
    Object.keys(this.eventHandlers).forEach(eventName => {
      this.eventHandlers[eventName] = [];
    });
    
    // Clear state
    this.state.expandedNodes.clear();
    this.state.selectedNode = null;
    this.state.editingNode = null;
    this.state.sourceContent = null;
    
    // Clear DOM
    if (this.dom) {
      this.dom.innerHTML = '';
    }
  }
}