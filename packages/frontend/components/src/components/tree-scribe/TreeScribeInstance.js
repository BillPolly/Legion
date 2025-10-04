/**
 * TreeScribeInstance - Complete TreeScribe component instance
 * Integrates Model, View, ViewModel, and Renderers into a cohesive component
 */

import { UmbilicalUtils } from '@legion/components';
import { TreeScribeModel } from './core/model/TreeScribeModel.js';
import { TreeScribeView } from './core/view/TreeScribeView.js';
import { TreeScribeViewModel } from './core/viewmodel/TreeScribeViewModel.js';
import { PlaintextRenderer } from './features/rendering/renderers/PlaintextRenderer.js';

export class TreeScribeInstance {
  constructor(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'TreeScribeInstance');
    
    this.umbilical = umbilical;
    this.destroyed = false;
    
    // Initialize MVVM components
    this._initializeComponents();
    
    // Register built-in renderers
    this._registerRenderers();
    
    // Set up event bindings
    this._bindEvents();
    
    // Call onMount if provided
    if (umbilical.onMount) {
      umbilical.onMount(this);
    }
  }

  /**
   * Initialize the MVVM components
   * @private
   */
  _initializeComponents() {
    // Create Model
    this.model = new TreeScribeModel();
    
    // Create View with options
    const viewOptions = {
      theme: this.umbilical.theme || 'light'
    };
    this.view = new TreeScribeView(this.umbilical.dom, viewOptions);
    
    // Create ViewModel to coordinate Model and View
    this.viewModel = new TreeScribeViewModel(this.model, this.view);
    
    // Store renderers registry
    this.renderers = new Map();
  }

  /**
   * Register built-in renderers
   * @private
   */
  _registerRenderers() {
    const plaintextRenderer = new PlaintextRenderer();
    this.renderers.set('plaintext', plaintextRenderer);
    
    // Register for all supported types
    plaintextRenderer.getSupportedTypes().forEach(type => {
      this.renderers.set(type, plaintextRenderer);
    });
  }

  /**
   * Bind events between components and external callbacks
   * @private
   */
  _bindEvents() {
    // Bind ViewModel events to umbilical callbacks
    if (this.umbilical.onNodeToggle) {
      this.viewModel.on('nodeToggled', (data) => {
        this.umbilical.onNodeToggle(data.nodeId, data.expanded);
      });
    }
    
    if (this.umbilical.onSearch) {
      this.viewModel.on('searchCompleted', (data) => {
        this.umbilical.onSearch(data.query, data.results);
      });
    }
    
    if (this.umbilical.onRendererError) {
      // Error handling for renderer failures
      this.viewModel.on('rendererError', (error) => {
        this.umbilical.onRendererError(error);
      });
    }
  }

  /**
   * Load YAML content into the tree
   */
  async loadYaml(yamlContent) {
    if (this.destroyed) {
      return { success: false, error: 'Component destroyed' };
    }
    
    try {
      const result = this.viewModel.executeCommand('loadYaml', { yamlContent });
      const nodeCount = this.model.getNodeCount();
      return { success: true, nodeCount };
    } catch (error) {
      console.error('Failed to load YAML:', error);
      if (this.umbilical.onError) {
        this.umbilical.onError(error);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Expand all nodes in the tree
   */
  expandAll() {
    if (this.destroyed) return;
    
    this.viewModel.executeCommand('expandAll');
  }

  /**
   * Collapse all nodes in the tree
   */
  collapseAll() {
    if (this.destroyed) return;
    
    this.viewModel.executeCommand('collapseAll');
  }

  /**
   * Expand tree to specific depth
   */
  expandToDepth(depth) {
    if (this.destroyed) return;
    
    this.viewModel.executeCommand('expandToDepth', { depth });
  }

  /**
   * Search content in the tree
   */
  searchContent(query) {
    if (this.destroyed) return [];
    
    if (!query || !this.model.rootNode) {
      return [];
    }
    
    // Execute search command
    this.viewModel.executeCommand('search', { query });
    
    // Return search results
    const allNodes = this.model.getAllNodes();
    const results = allNodes
      .filter(node => 
        node.title.toLowerCase().includes(query.toLowerCase()) ||
        node.content.toLowerCase().includes(query.toLowerCase())
      )
      .map(node => ({
        nodeId: node.id,
        title: node.title,
        content: node.content,
        matches: this._findMatches(node, query)
      }));
    
    return results;
  }

  /**
   * Find matches in node content
   * @private
   */
  _findMatches(node, query) {
    const matches = [];
    const lowerQuery = query.toLowerCase();
    
    if (node.title.toLowerCase().includes(lowerQuery)) {
      matches.push({ field: 'title', text: node.title });
    }
    
    if (node.content.toLowerCase().includes(lowerQuery)) {
      matches.push({ field: 'content', text: node.content });
    }
    
    return matches;
  }

  /**
   * Get node state by ID
   */
  getNodeState(nodeId) {
    if (this.destroyed) return null;
    
    const node = this.model.getNode(nodeId);
    return node ? node.getState() : null;
  }

  /**
   * Set node state by ID
   */
  setNodeState(nodeId, state) {
    if (this.destroyed) return;
    
    const node = this.model.getNode(nodeId);
    if (node) {
      const oldExpanded = node.state.expanded;
      node.setState(state);
      
      // Trigger view update
      this.viewModel._updateView();
      
      // Emit event if expanded state changed
      if (state.expanded !== undefined && state.expanded !== oldExpanded) {
        this.viewModel._emit('nodeToggled', { 
          nodeId, 
          expanded: state.expanded 
        });
      }
    }
  }

  /**
   * Get current folding state of all nodes
   */
  getFoldingState() {
    if (this.destroyed) return {};
    
    const state = {};
    if (this.model.rootNode) {
      const allNodes = this.model.getAllNodes();
      allNodes.forEach(node => {
        state[node.id] = {
          expanded: node.state.expanded,
          visible: node.state.visible
        };
      });
    }
    
    return state;
  }

  /**
   * Export tree to HTML format
   */
  exportHtml() {
    if (this.destroyed || !this.model.rootNode) return null;
    
    this.viewModel.executeCommand('export', { format: 'html' });
    
    // Return the generated HTML (this would be enhanced in full implementation)
    return this._generateHtmlExport();
  }

  /**
   * Generate HTML export
   * @private
   */
  _generateHtmlExport() {
    if (!this.model.rootNode) return null;
    
    const exportNode = (node, depth = 0) => {
      const indent = '  '.repeat(depth);
      let html = `${indent}<div class="tree-node" data-depth="${depth}">\n`;
      html += `${indent}  <h${Math.min(depth + 1, 6)}>${this._escapeHtml(node.title)}</h${Math.min(depth + 1, 6)}>\n`;
      
      if (node.content) {
        html += `${indent}  <div class="node-content">${this._escapeHtml(node.content)}</div>\n`;
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
   * Escape HTML characters
   * @private
   */
  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Export tree to JSON format
   */
  exportJson() {
    if (this.destroyed || !this.model.rootNode) return null;
    
    this.viewModel.executeCommand('export', { format: 'json' });
    
    return this.model.exportJson();
  }

  /**
   * Clean up and destroy the instance
   */
  destroy() {
    if (this.destroyed) return;
    
    // Call onDestroy callback if provided
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy(this);
    }
    
    // Destroy MVVM components in reverse order
    if (this.viewModel) {
      this.viewModel.destroy();
      this.viewModel = null;
    }
    
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    
    if (this.model) {
      this.model.destroy();
      this.model = null;
    }
    
    // Clear renderers
    this.renderers.clear();
    
    // Clear references
    this.umbilical = null;
    
    this.destroyed = true;
  }
}