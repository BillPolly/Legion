/**
 * HierarchyViewModel - Main coordination between model and view
 */
import { EditingManager } from './EditingManager.js';
import { ValidationManager } from './ValidationManager.js';

export class HierarchyViewModel {
  constructor(model, view, config) {
    this.model = model;
    this.view = view;
    this.config = config;
    this.editingManager = new EditingManager(this);
    this.validationManager = new ValidationManager(this);
    this.updateTimer = null;
  }

  /**
   * Initialize event handlers and coordination
   */
  initialize() {
    this.setupModelEvents();
    this.setupViewEvents();
  }

  /**
   * Set up model event handlers
   */
  setupModelEvents() {
    // Content loaded - render in both views
    this.model.on('contentLoaded', (data) => {
      this.view.renderHierarchy(data.root, data.format);
      this.view.renderSource(this.model.source, data.format);
    });

    // Node updated - mark for incremental update
    this.model.on('nodeUpdated', (data) => {
      this.view.nodeMapping.markDirty(data.node.id);
      this.scheduleIncrementalUpdate();
    });

    // Node added - mark parent for incremental update
    this.model.on('nodeAdded', (data) => {
      this.view.nodeMapping.markDirty(data.parent.id);
      this.scheduleIncrementalUpdate();
    });

    // Node removed - mark parent for incremental update
    this.model.on('nodeRemoved', (data) => {
      this.view.nodeMapping.markDirty(data.parent.id);
      this.scheduleIncrementalUpdate();
    });

    // Node moved - mark both parents for incremental update
    this.model.on('nodeMoved', (data) => {
      this.view.nodeMapping.markDirty(data.oldParent.id);
      this.view.nodeMapping.markDirty(data.newParent.id);
      this.scheduleIncrementalUpdate();
    });

    // Source updated - render in source view
    this.model.on('sourceUpdated', (data) => {
      this.view.renderSource(data.source, this.model.format);
    });

    // Validation errors
    this.model.on('validationError', (data) => {
      this.handleValidationError(data);
    });
  }

  /**
   * Set up view event handlers
   */
  setupViewEvents() {
    // Node editing
    this.view.on('nodeEdit', (data) => {
      this.editingManager.startEdit(data.nodeId);
    });

    // Node value changed
    this.view.on('nodeValueChanged', (data) => {
      this.model.updateNodeValue(data.nodeId, data.value);
    });

    // Add node request
    this.view.on('addNodeRequest', (data) => {
      this.showAddNodeDialog(data.parentId);
    });

    // Remove node request
    this.view.on('removeNodeRequest', (data) => {
      this.confirmRemoveNode(data.nodeId);
    });

    // View mode changed
    this.view.on('modeChanged', (data) => {
      this.handleModeChange(data.mode);
    });

    // Source changed in source view
    this.view.on('sourceChanged', (data) => {
      this.handleSourceChange(data.source);
    });
  }

  /**
   * Batch incremental updates for efficiency
   */
  scheduleIncrementalUpdate() {
    if (this.updateTimer) return;
    
    this.updateTimer = requestAnimationFrame(() => {
      const dirtyNodes = this.view.nodeMapping.getDirtyNodes();
      this.view.updateNodes(dirtyNodes);
      this.view.nodeMapping.clearDirty();
      this.updateTimer = null;
    });
  }

  /**
   * Handle validation errors
   */
  handleValidationError(data) {
    // TODO: Display validation errors in UI
    console.warn('Validation error:', data);
    
    // Emit event for external handling
    this.emit('validationError', data);
  }

  /**
   * Show add node dialog
   */
  showAddNodeDialog(parentId) {
    // TODO: Implement add node dialog
    // For now, add a default node
    const nodeData = {
      type: 'value',
      name: 'newProperty',
      value: ''
    };
    
    this.model.addNode(parentId, nodeData);
  }

  /**
   * Confirm node removal
   */
  confirmRemoveNode(nodeId) {
    // TODO: Add confirmation dialog
    // For now, remove directly
    this.model.removeNode(nodeId);
  }

  /**
   * Handle view mode change
   */
  handleModeChange(mode) {
    // Emit event for external handling
    this.emit('modeChanged', { mode });
  }

  /**
   * Handle source code changes
   */
  handleSourceChange(source) {
    try {
      // Validate and parse new source
      const validation = this.validationManager.validateSource(source, this.model.format);
      
      if (validation.valid) {
        this.model.loadContent(source, this.model.format);
      } else {
        this.handleValidationError({
          errors: validation.errors,
          source: source
        });
      }
    } catch (error) {
      this.handleValidationError({
        errors: [error.message],
        source: source
      });
    }
  }

  /**
   * Load content with format
   */
  loadContent(content, format) {
    this.model.loadContent(content, format);
  }

  /**
   * Get current content
   */
  getContent() {
    return this.model.source;
  }

  /**
   * Set view mode
   */
  setMode(mode) {
    this.view.setMode(mode);
  }

  /**
   * Add node
   */
  addNode(parentId, nodeData) {
    this.model.addNode(parentId, nodeData);
  }

  /**
   * Update node
   */
  updateNode(nodeId, value) {
    this.model.updateNodeValue(nodeId, value);
  }

  /**
   * Remove node
   */
  removeNode(nodeId) {
    this.model.removeNode(nodeId);
  }

  /**
   * Validate current content
   */
  validate() {
    return this.model.validate();
  }

  /**
   * Check if content is dirty
   */
  isDirty() {
    return this.model.isDirty;
  }

  /**
   * Clear all content
   */
  clear() {
    this.model.clear();
  }

  /**
   * Emit event (simple implementation)
   */
  emit(event, data) {
    // TODO: Implement proper event emission
    console.log(`ViewModel event: ${event}`, data);
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    if (this.updateTimer) {
      cancelAnimationFrame(this.updateTimer);
      this.updateTimer = null;
    }
    
    if (this.editingManager) {
      this.editingManager.destroy();
    }
    
    if (this.validationManager) {
      this.validationManager.destroy();
    }
  }
}