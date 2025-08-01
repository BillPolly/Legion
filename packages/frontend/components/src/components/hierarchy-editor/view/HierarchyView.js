/**
 * HierarchyView - Main view controller for hierarchy display
 */
import { BaseView } from '../../base/index.js';
import { NodeViewMapping } from './NodeViewMapping.js';
import { HierarchyTreeView } from './HierarchyTreeView.js';
import { SourceView } from './SourceView.js';

export class HierarchyView extends BaseView {
  constructor(dom, config) {
    super(dom, config);
    this.dom = dom;
    this.config = config;
    this.hierarchyView = null;
    this.sourceView = null;
    this.currentMode = 'tree';
    this.nodeMapping = new NodeViewMapping(); // Two-way mapping
    
    // Simple event system for MVP
    this.eventHandlers = {};
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Render the main component structure
   */
  render() {
    this.dom.innerHTML = `
      <div class="hierarchy-editor">
        <div class="he-toolbar">
          <button class="he-mode-btn active" data-mode="tree">Tree</button>
          <button class="he-mode-btn" data-mode="source">Source</button>
          <span class="he-format">Format: <span class="format-name">-</span></span>
        </div>
        <div class="he-content">
          <div class="he-tree-view"></div>
          <div class="he-source-view" style="display:none;"></div>
        </div>
      </div>
    `;

    this.initializeViews();
    this.attachEventListeners();
  }

  /**
   * Initialize sub-views
   */
  initializeViews() {
    const hierarchyContainer = this.dom.querySelector('.he-tree-view');
    const sourceContainer = this.dom.querySelector('.he-source-view');
    
    this.hierarchyView = new HierarchyTreeView(hierarchyContainer, this.config, this.nodeMapping);
    this.sourceView = new SourceView(sourceContainer, this.config);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Mode switching
    const modeButtons = this.dom.querySelectorAll('.he-mode-btn');
    modeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode');
        this.setMode(mode);
        this.emit('modeChanged', { mode });
      });
    });

    // Forward events from sub-views
    if (this.hierarchyView) {
      this.hierarchyView.on('nodeEdit', (data) => this.emit('nodeEdit', data));
      this.hierarchyView.on('nodeValueChanged', (data) => this.emit('nodeValueChanged', data));
      this.hierarchyView.on('addNodeRequest', (data) => this.emit('addNodeRequest', data));
      this.hierarchyView.on('removeNodeRequest', (data) => this.emit('removeNodeRequest', data));
    }

    if (this.sourceView) {
      this.sourceView.on('sourceChanged', (data) => this.emit('sourceChanged', data));
    }
  }

  /**
   * Render hierarchy in tree view
   */
  renderHierarchy(root, format) {
    if (this.hierarchyView) {
      this.hierarchyView.render(root, format);
    }
    
    const formatName = this.dom.querySelector('.format-name');
    if (formatName) {
      formatName.textContent = format.toUpperCase();
    }
  }

  /**
   * Render source in source view
   */
  renderSource(source, format) {
    if (this.sourceView) {
      this.sourceView.render(source, format);
    }
  }

  /**
   * Set view mode
   */
  setMode(mode) {
    if (mode === this.currentMode) return;
    
    this.currentMode = mode;
    
    // Update button states
    const buttons = this.dom.querySelectorAll('.he-mode-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    
    // Show/hide views
    const treeView = this.dom.querySelector('.he-tree-view');
    const sourceView = this.dom.querySelector('.he-source-view');
    
    if (mode === 'tree') {
      treeView.style.display = 'block';
      sourceView.style.display = 'none';
    } else if (mode === 'source') {
      treeView.style.display = 'none';
      sourceView.style.display = 'block';
    }
  }

  /**
   * Incremental update - only re-render changed nodes
   */
  updateNodes(nodeIds) {
    const dirtyElements = nodeIds.map(id => this.nodeMapping.modelToView.get(id));
    dirtyElements.forEach((element, index) => {
      if (element && this.hierarchyView) {
        this.hierarchyView.updateNode(nodeIds[index], element);
      }
    });
  }

  /**
   * Expand all nodes
   */
  expandAll() {
    if (this.hierarchyView) {
      this.hierarchyView.expandAll();
    }
  }

  /**
   * Collapse all nodes
   */
  collapseAll() {
    if (this.hierarchyView) {
      this.hierarchyView.collapseAll();
    }
  }

  /**
   * Expand to specific level
   */
  expandToLevel(level) {
    if (this.hierarchyView) {
      this.hierarchyView.expandToLevel(level);
    }
  }

  /**
   * Find and highlight nodes
   */
  findNodes(query) {
    if (this.hierarchyView) {
      return this.hierarchyView.findNodes(query);
    }
    return [];
  }

  /**
   * Clear all highlights
   */
  clearHighlights() {
    if (this.hierarchyView) {
      this.hierarchyView.clearHighlights();
    }
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.currentMode;
  }

  /**
   * Destroy view and clean up
   */
  destroy() {
    if (this.hierarchyView) {
      this.hierarchyView.destroy();
    }
    
    if (this.sourceView) {
      this.sourceView.destroy();
    }
    
    if (this.dom) {
      this.dom.innerHTML = '';
    }
    
    super.destroy();
  }
}