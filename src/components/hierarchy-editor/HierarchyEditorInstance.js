/**
 * HierarchyEditorInstance - Main instance implementation
 */

import { HierarchyModel } from './model/HierarchyModel.js';
import { HierarchyRenderer } from './renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from './state/ExpansionStateManager.js';
import { FormatHandlerFactory } from './handlers/FormatHandlerFactory.js';
import { ViewModeManager } from './view/ViewModeManager.js';
import { EventEmitter } from './EventEmitter.js';

export class HierarchyEditorInstance extends EventEmitter {
  constructor(umbilical) {
    super();
    this.umbilical = umbilical;
    this.dom = umbilical.dom;
    
    // Initialize configuration
    this.config = {
      format: umbilical.format || 'json',
      editable: umbilical.editable !== false,
      showToolbar: umbilical.showToolbar !== false,
      defaultMode: umbilical.defaultMode || 'tree',
      theme: umbilical.theme || 'light',
      indentSize: umbilical.indentSize || 20,
      indentChar: umbilical.indentChar || '  ',
      validators: umbilical.validators || {},
      icons: umbilical.icons || {},
      labels: umbilical.labels || {},
      direction: umbilical.direction || 'ltr',
      virtualScroll: umbilical.virtualScroll || false,
      virtualScrollHeight: umbilical.virtualScrollHeight || 500,
      validationDelay: umbilical.validationDelay || 300,
      realtimeValidation: umbilical.realtimeValidation || false,
      showInlineErrors: umbilical.showInlineErrors || false,
      showErrorSuggestions: umbilical.showErrorSuggestions || false,
      highContrast: umbilical.highContrast || false,
      enableKeyboardShortcuts: umbilical.enableKeyboardShortcuts !== false,
      ariaLabels: umbilical.ariaLabels || {},
      requiredPaths: umbilical.requiredPaths || [],
      trackErrors: umbilical.trackErrors || false,
      plugins: umbilical.plugins || [],
      exportFormats: umbilical.exportFormats || {},
      importParsers: umbilical.importParsers || {},
      errorHandler: umbilical.errorHandler,
      shortcuts: umbilical.shortcuts || {},
      slowOperationThreshold: umbilical.slowOperationThreshold || 500
    };
    
    // Initialize state
    this.destroyed = false;
    this.rendered = false;
    this.currentMode = this.config.defaultMode;
    this.errorHistory = [];
    this.bulkMode = false;
    this.pendingChanges = [];
    
    // Initialize components
    this.model = null;
    this.renderer = null;
    this.expansionState = null;
    this.viewModeManager = null;
    this.formatHandler = null;
    
    // Bind event callbacks from umbilical
    this._bindCallbacks();
    
    // Initialize DOM
    this._initializeDOM();
    
    // Initialize plugins
    this._initializePlugins();
  }

  _initializeDOM() {
    const themeClass = `theme-${this.config.theme}`;
    const dirAttr = this.config.direction === 'rtl' ? 'dir="rtl"' : '';
    const highContrastClass = this.config.highContrast ? 'high-contrast' : '';
    
    this.dom.innerHTML = `
      <div class="hierarchy-editor ${themeClass} ${highContrastClass}" ${dirAttr}>
        ${this.config.showToolbar ? `
          <div class="he-toolbar">
            <button class="mode-btn" data-mode="tree">${this.config.labels.treeView || 'Tree View'}</button>
            <button class="mode-btn" data-mode="source">${this.config.labels.sourceView || 'Source View'}</button>
          </div>
        ` : ''}
        <div class="he-content">
          <div class="he-tree-view"></div>
        </div>
      </div>
    `;
    
    // Set up toolbar event handlers
    if (this.config.showToolbar) {
      this._setupToolbar();
    }
    
    // Set up keyboard shortcuts
    if (this.config.enableKeyboardShortcuts) {
      this._setupKeyboardShortcuts();
    }
  }
  
  _bindCallbacks() {
    // Bind all umbilical callbacks
    const callbacks = [
      'onMount', 'onDestroy', 'onReady', 'onContentChange', 'onChange',
      'onBeforeChange', 'onNodeEdit', 'onEditStart', 'onEditEnd', 'onEditCancel',
      'onNodeAdd', 'onNodeRemove', 'onNodeMove', 'onValidation', 'onValidationError',
      'onSelect', 'onExpand', 'onCollapse', 'onNavigate', 'onModeChange',
      'onBeforeModeChange', 'onFormatChange', 'onFormatDetected', 'onError',
      'onRecovery', 'onRenderComplete', 'onSlowOperation', 'onSave', 'onUndo',
      'onEditValidate', 'onEditCommit', 'onNodeDelete', 'onBeforeDelete'
    ];
    
    callbacks.forEach(callback => {
      if (this.umbilical[callback]) {
        this.on(callback.replace(/^on/, '').toLowerCase(), this.umbilical[callback]);
      }
    });
  }
  
  _initializePlugins() {
    for (const plugin of this.config.plugins) {
      try {
        if (plugin.init) {
          plugin.init(this);
        }
      } catch (error) {
        this._handleError({
          type: 'plugin-error',
          plugin: plugin.name,
          error,
          contained: true
        });
      }
    }
  }
  
  _setupToolbar() {
    const toolbar = this.dom.querySelector('.he-toolbar');
    toolbar.addEventListener('click', (e) => {
      if (e.target.matches('.mode-btn')) {
        const mode = e.target.dataset.mode;
        this.setMode(mode);
      }
    });
  }
  
  _setupKeyboardShortcuts() {
    this.dom.addEventListener('keydown', (e) => {
      const key = this._getShortcutKey(e);
      const action = this.config.shortcuts[key];
      
      if (action) {
        e.preventDefault();
        this._handleShortcut(action);
      }
    });
  }
  
  _getShortcutKey(e) {
    const parts = [];
    if (e.metaKey || e.ctrlKey) parts.push('cmd');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }
  
  _handleShortcut(action) {
    switch (action) {
      case 'save':
        this.emit('save', { content: this.getContent() });
        break;
      case 'undo':
        this.emit('undo');
        break;
      case 'redo':
        this.emit('redo');
        break;
      case 'deleteNode':
        if (this.selectedNode) {
          this.deleteNode(this.selectedNode);
        }
        break;
      case 'editNode':
        if (this.selectedNode) {
          this.startInlineEdit(this.selectedNode);
        }
        break;
    }
  }
  
  // Public API Methods
  
  render() {
    if (this.rendered) return this;
    
    const startTime = Date.now();
    
    try {
      // Initialize format handler
      this.formatHandler = FormatHandlerFactory.create(this.config.format);
      
      // Initialize model
      this.model = new HierarchyModel();
      this.model.registerHandler('json', this.formatHandler);
      
      // Initialize expansion state
      this.expansionState = new ExpansionStateManager({
        defaultExpanded: true,
        maxDepth: 10,
        persistKey: this.config.persistExpansion ? `hierarchy-expansion-${this.config.format}` : null
      });
      
      // Initialize renderer
      const viewContainer = this.dom.querySelector('.he-tree-view');
      this.renderer = new HierarchyRenderer({
        theme: this.config.theme,
        enableEditing: this.config.editable,
        expansionState: this.expansionState,
        onEdit: this._handleRendererEdit.bind(this),
        onExpand: this._handleExpand.bind(this),
        onCollapse: this._handleCollapse.bind(this)
      });
      
      // Initialize view mode manager
      this.viewModeManager = new ViewModeManager(this.dom.querySelector('.he-content'), {
        defaultMode: this.config.defaultMode,
        format: this.config.format,
        theme: this.config.theme,
        editable: this.config.editable,
        indentChar: this.config.indentChar,
        realtimeValidation: this.config.realtimeValidation
      });
      
      // Set up event forwarding
      this._setupEventForwarding();
      
      // Load initial content if provided
      if (this.umbilical.content) {
        this.loadContent(this.umbilical.content, this.config.format);
      } else {
        this._showEmptyState();
      }
      
      // Set initial mode
      if (this.config.defaultMode === 'source') {
        this.setMode('source');
      }
      
      this.rendered = true;
      
      // Emit mount event
      this.emit('mount', {
        instance: this,
        format: this.config.format,
        mode: this.currentMode
      });
      
      // Emit ready event
      setTimeout(() => {
        const renderTime = Date.now() - startTime;
        this.emit('ready', {
          instance: this,
          nodeCount: this.model ? this.model.getNodeCount() : 0,
          format: this.config.format
        });
        
        this.emit('rendercomplete', {
          nodeCount: this.model ? this.model.getNodeCount() : 0,
          renderTime,
          mode: this.currentMode,
          format: this.config.format
        });
      }, 0);
      
    } catch (error) {
      this._handleError({
        type: 'render-error',
        error,
        recoverable: false
      });
    }
    
    return this;
  }
  
  _setupEventForwarding() {
    // Forward model events
    if (this.model) {
      this.model.on('change', (data) => {
        if (!this.bulkMode) {
          this._emitContentChange(data.source || 'model');
        } else {
          this.pendingChanges.push(data);
        }
      });
    }
    
    // Forward expansion state events
    if (this.expansionState) {
      this.expansionState.on('expand', (path) => this.emit('expand', { path }));
      this.expansionState.on('collapse', (path) => this.emit('collapse', { path }));
      this.expansionState.on('change', (data) => {
        // Re-render on expansion changes
        this._renderTree();
      });
    }
    
    // Forward view mode manager events
    if (this.viewModeManager) {
      this.viewModeManager.on('modechange', (data) => {
        this.currentMode = data.toMode;
        this.emit('modechange', data);
      });
      
      this.viewModeManager.on('validation', (data) => this.emit('validation', data));
    }
  }
  
  _emitContentChange(source) {
    const content = this.getContent();
    const previousContent = this._previousContent || '';
    
    if (content !== previousContent) {
      this.emit('contentchange', {
        content,
        previousContent,
        source,
        format: this.config.format
      });
      
      this.emit('change', {
        type: source,
        content,
        format: this.config.format
      });
      
      this._previousContent = content;
    }
  }
  
  _showEmptyState() {
    const contentEl = this.dom.querySelector('.he-content');
    contentEl.innerHTML = '<div class="empty-state">No content loaded</div>';
  }
  
  _showErrorState(error) {
    const contentEl = this.dom.querySelector('.he-content');
    const message = error.message || 'An error occurred';
    const suggestion = this._getErrorSuggestion(error);
    
    contentEl.innerHTML = `
      <div class="error-state">
        <div class="error-message">${message}</div>
        ${suggestion ? `<div class="error-suggestion">${suggestion}</div>` : ''}
      </div>
    `;
  }
  
  _getErrorSuggestion(error) {
    if (!this.config.showErrorSuggestions) return null;
    
    const message = error.message.toLowerCase();
    if (message.includes('trailing comma')) {
      return 'Remove the trailing comma from your JSON';
    }
    if (message.includes('unexpected token')) {
      return 'Check for missing quotes or brackets';
    }
    if (message.includes('unterminated string')) {
      return 'Make sure all strings are properly closed with quotes';
    }
    
    return null;
  }
  
  getContent() {
    if (!this.model || !this.formatHandler) return '';
    
    try {
      const rootNode = this.model.getRootNode();
      return this.formatHandler.serialize(rootNode, this.config.indentChar);
    } catch (error) {
      this._handleError({
        type: 'serialization-error',
        error,
        recoverable: true
      });
      return '';
    }
  }
  
  setContent(content) {
    if (!this.config.editable) return this;
    
    const event = {
      content,
      preventDefault: false
    };
    
    this.emit('beforechange', event);
    if (event.preventDefault) return this;
    
    try {
      if (this.viewModeManager && this.currentMode === 'source') {
        this.viewModeManager.setContent(content);
      } else {
        this.loadContent(content, this.config.format);
      }
      
      this._emitContentChange('set-content');
    } catch (error) {
      this._handleError({
        type: 'content-error',
        error,
        recoverable: true
      });
    }
    
    return this;
  }
  
  loadContent(content, format) {
    if (!content) {
      this._showEmptyState();
      return this;
    }
    
    try {
      // Auto-detect format if not specified
      if (!format) {
        format = this._detectFormat(content);
      }
      
      // Update format if different
      if (format !== this.config.format) {
        const oldFormat = this.config.format;
        this.config.format = format;
        this.formatHandler = FormatHandlerFactory.create(format);
        
        this.emit('formatchange', {
          fromFormat: oldFormat,
          toFormat: format,
          content
        });
      }
      
      // Parse content
      const rootNode = this.formatHandler.parse(content);
      
      // Update model
      if (this.model) {
        this.model.setRootNode(rootNode);
      }
      
      // Render tree
      this._renderTree();
      
      // Update view mode manager
      if (this.viewModeManager) {
        this.viewModeManager.config.format = format;
        this.viewModeManager.setContent(content);
      }
      
      this._previousContent = content;
      
      // Clear error state
      if (this.errorHistory.length > 0) {
        this.emit('recovery', {
          fromError: this.errorHistory[this.errorHistory.length - 1].type,
          newContent: content,
          newFormat: format
        });
      }
      
    } catch (error) {
      this._handleError({
        type: 'parse-error',
        message: `Invalid ${format} content`,
        format,
        content,
        error,
        recoverable: true
      });
      
      this._showErrorState(error);
    }
    
    return this;
  }
  
  _detectFormat(content) {
    // Try each format handler
    const formats = ['json', 'xml', 'yaml', 'markdown'];
    
    for (const format of formats) {
      const handler = FormatHandlerFactory.create(format);
      if (handler.detect && handler.detect(content)) {
        const confidence = handler.getConfidence ? handler.getConfidence(content) : 1.0;
        
        this.emit('formatdetected', {
          format,
          confidence,
          content
        });
        
        return format;
      }
    }
    
    // Default to JSON
    return 'json';
  }
  
  async setMode(mode) {
    if (!this.viewModeManager) {
      return { success: false, error: new Error('View mode manager not initialized') };
    }
    
    const event = {
      fromMode: this.currentMode,
      toMode: mode,
      preventDefault: false
    };
    
    this.emit('beforemodechange', event);
    if (event.preventDefault) {
      return { success: false, reason: 'prevented' };
    }
    
    try {
      let result;
      
      if (mode === 'tree') {
        result = await this.viewModeManager.switchToTree();
      } else if (mode === 'source') {
        result = await this.viewModeManager.switchToSource();
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }
      
      if (!result || result.error) {
        throw result ? result.error : new Error('Mode switch failed');
      }
      
      return { success: true };
      
    } catch (error) {
      this._handleError({
        type: 'mode-switch-error',
        fromMode: this.currentMode,
        toMode: mode,
        reason: 'invalid-content',
        error
      });
      
      return { success: false, error };
    }
  }
  
  getMode() {
    return this.currentMode;
  }
  
  selectNode(pathOrId) {
    const node = this._findNode(pathOrId);
    if (node) {
      this.selectedNode = node.id;
      this.emit('select', { nodeId: node.id, path: pathOrId });
    }
    
    return this;
  }
  
  expandNode(pathOrId, recursive = false) {
    if (!this.expansionState) return this;
    
    const node = this._findNode(pathOrId);
    if (node) {
      const path = this._getNodePath(node);
      if (recursive) {
        const paths = this._collectExpandablePaths(node, path);
        paths.forEach(p => this.expansionState.expand(p));
      } else {
        this.expansionState.expand(path);
      }
    }
    
    return this;
  }
  
  collapseNode(pathOrId) {
    if (!this.expansionState) return this;
    
    const node = this._findNode(pathOrId);
    if (node) {
      const path = this._getNodePath(node);
      this.expansionState.collapse(path);
    }
    
    return this;
  }
  
  expandAll() {
    if (!this.expansionState || !this.model) return this;
    const rootNode = this.model.getRootNode();
    if (rootNode) {
      this.expansionState.expandAll(rootNode);
    }
    return this;
  }
  
  collapseAll() {
    if (!this.expansionState) return this;
    this.expansionState.collapseAll();
    return this;
  }
  
  editNode(pathOrId, value) {
    if (!this.config.editable || !this.model) return false;
    
    const node = this._findNode(pathOrId);
    if (!node) return false;
    
    // Validate if validator exists
    const validator = this.config.validators[node.path || node.name];
    if (validator) {
      const result = validator(value);
      if (!result.valid) {
        this.emit('validationerror', {
          path: node.path || node.name,
          value,
          error: result.error,
          validator: node.path || node.name
        });
        return false;
      }
    }
    
    try {
      this.model.updateNodeValue(node.id, value);
      
      this.emit('nodeedit', {
        path: node.path || node.name,
        oldValue: node.value,
        newValue: value,
        nodeId: node.id,
        parentPath: node.parent ? node.parent.path : ''
      });
      
      this._emitContentChange('tree-edit');
      return true;
      
    } catch (error) {
      this._handleError({
        type: 'edit-error',
        error,
        recoverable: true
      });
      return false;
    }
  }
  
  startInlineEdit(pathOrId) {
    if (!this.config.editable) return this;
    
    const node = this._findNode(pathOrId);
    if (node) {
      this.emit('editstart', {
        path: node.path || node.name,
        currentValue: node.value,
        mode: 'inline'
      });
      
      // The renderer handles inline editing through its own mechanism
      this._startInlineEditMode = true;
      this._editingNodeId = node.id;
      this._renderTree();
    }
    
    return this;
  }
  
  cancelEdit() {
    if (this._startInlineEditMode && this._editingNodeId) {
      const node = this._findNode(this._editingNodeId);
      
      this._startInlineEditMode = false;
      this._editingNodeId = null;
      this._renderTree();
      
      if (node) {
        this.emit('editcancel', {
          path: node.path || node.name,
          originalValue: node.value,
          reason: 'user-cancelled'
        });
      }
    }
    
    return this;
  }
  
  addNode(parentPath, value, key) {
    if (!this.config.editable || !this.model) return false;
    
    try {
      const parentNode = this._findNode(parentPath);
      if (!parentNode) return false;
      
      const nodeData = {
        type: this._inferNodeType(value),
        name: key || '',
        value: typeof value === 'object' ? null : value
      };
      
      this.model.addNode(parentNode.id, nodeData);
      const result = { nodeId: nodeData.id, index: parentNode.children ? parentNode.children.length - 1 : 0 };
      
      if (result) {
        const parentNode = this._findNode(parentPath);
        
        this.emit('nodeadd', {
          parentPath,
          value,
          key,
          index: result.index,
          nodeId: result.nodeId,
          parentType: parentNode ? parentNode.type : 'unknown'
        });
        
        this._emitContentChange('node-add');
      }
      
      return result;
      
    } catch (error) {
      this._handleError({
        type: 'operation-error',
        operation: 'add',
        path: parentPath,
        error,
        recoverable: true
      });
      return false;
    }
  }
  
  deleteNode(pathOrId) {
    if (!this.config.editable || !this.model) return false;
    
    const node = this._findNode(pathOrId);
    if (!node) return false;
    
    // Check if node is required
    if (this.config.requiredPaths.includes(node.path || node.name)) {
      this._handleError({
        type: 'operation-error',
        operation: 'delete',
        path: node.path || node.name,
        error: new Error(`Cannot delete required node: ${node.path || node.name}`),
        recoverable: true
      });
      return false;
    }
    
    try {
      const hadChildren = node.children && node.children.length > 0;
      const parentPath = node.parent ? (node.parent.path || '') : '';
      
      this.model.removeNode(node.id);
      const result = true;
      
      if (result) {
        this.emit('noderemove', {
          path: node.path || node.name,
          value: node.value,
          parentPath,
          hadChildren
        });
        
        this.emit('nodedelete', {
          path: node.path || node.name,
          value: node.value,
          parentPath,
          index: node.index
        });
        
        this._emitContentChange('node-delete');
      }
      
      return result;
      
    } catch (error) {
      this._handleError({
        type: 'operation-error',
        operation: 'delete',
        path: pathOrId,
        error,
        recoverable: true
      });
      return false;
    }
  }
  
  moveNode(fromPath, toPath, toIndex) {
    if (!this.config.editable || !this.model) return false;
    
    try {
      const fromNode = this._findNode(fromPath);
      const toNode = this._findNode(toPath);
      
      if (!fromNode || !toNode) return false;
      
      // Check for circular reference
      if (this._isDescendantOf(toNode, fromNode)) {
        throw new Error('Cannot move node into its own descendant (circular reference)');
      }
      
      this.model.moveNode(fromNode.id, toNode.id, toIndex);
      const result = true;
      
      if (result) {
        this.emit('nodemove', {
          fromPath,
          toPath,
          toIndex,
          value: fromNode.value,
          fromParent: fromNode.parent ? fromNode.parent.path : '',
          toParent: toPath
        });
        
        this._emitContentChange('node-move');
      }
      
      return result;
      
    } catch (error) {
      this._handleError({
        type: 'operation-error',
        operation: 'move',
        fromPath,
        toPath,
        error,
        recoverable: true
      });
      return false;
    }
  }
  
  getTreeData() {
    if (!this.model) return null;
    return this.model.getRootNode();
  }
  
  validate(content, format) {
    try {
      const fmt = format || this.config.format;
      const handler = FormatHandlerFactory.create(fmt);
      handler.parse(content);
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error };
    }
  }
  
  bulkOperation(operation) {
    this.bulkMode = true;
    this.pendingChanges = [];
    
    const startTime = Date.now();
    
    try {
      operation();
      
      // Emit single change event for all changes
      if (this.pendingChanges.length > 0) {
        this._emitContentChange('bulk-operation');
      }
      
      const duration = Date.now() - startTime;
      if (duration > this.config.slowOperationThreshold) {
        this.emit('slowoperation', {
          operation: 'bulk-operation',
          duration,
          itemCount: this.pendingChanges.length
        });
      }
      
    } finally {
      this.bulkMode = false;
      this.pendingChanges = [];
    }
    
    return this;
  }
  
  on(event, handler) {
    super.on(event, handler);
    return this;
  }
  
  off(event, handler) {
    super.off(event, handler);
    return this;
  }
  
  exportAs(format) {
    const exporter = this.config.exportFormats[format];
    if (!exporter) {
      throw new Error(`Export format not supported: ${format}`);
    }
    
    const data = this.getTreeData();
    return exporter(data);
  }
  
  importFrom(content, format) {
    const parser = this.config.importParsers[format];
    if (!parser) {
      throw new Error(`Import format not supported: ${format}`);
    }
    
    try {
      const data = parser(content);
      this.loadContent(JSON.stringify(data), 'json');
    } catch (error) {
      this._handleError({
        type: 'import-error',
        format,
        error,
        recoverable: true
      });
    }
    
    return this;
  }
  
  setTheme(theme) {
    this.config.theme = theme;
    const editorEl = this.dom.querySelector('.hierarchy-editor');
    
    // Remove existing theme classes
    Array.from(editorEl.classList)
      .filter(c => c.startsWith('theme-'))
      .forEach(c => editorEl.classList.remove(c));
    
    // Add new theme class
    editorEl.classList.add(`theme-${theme}`);
    
    // Update view theme
    if (this.view && this.view.setTheme) {
      this.view.setTheme(theme);
    }
    
    // Update view mode manager theme
    if (this.viewModeManager) {
      this.viewModeManager.config.theme = theme;
    }
    
    return this;
  }
  
  hasErrors() {
    return this.errorHistory.length > 0;
  }
  
  getErrorHistory() {
    return [...this.errorHistory];
  }
  
  retry() {
    if (this._lastOperation) {
      this._lastOperation();
    }
    return this;
  }
  
  convertTo(format) {
    try {
      const content = this.getContent();
      const currentHandler = this.formatHandler;
      const targetHandler = FormatHandlerFactory.create(format);
      
      // Parse with current handler and serialize with target
      const rootNode = currentHandler.parse(content);
      const converted = targetHandler.serialize(rootNode, this.config.indentChar);
      
      this.loadContent(converted, format);
      
    } catch (error) {
      this._handleError({
        type: 'conversion-error',
        fromFormat: this.config.format,
        toFormat: format,
        error,
        recoverable: true
      });
    }
    
    return this;
  }
  
  navigate(direction) {
    if (!this.view || !this.view.navigate) return this;
    
    this.view.navigate(direction);
    return this;
  }
  
  _findNode(pathOrId) {
    if (!this.model) return null;
    
    // Try as path first
    let node = this.model.findByPath(pathOrId);
    
    // Try as ID if not found by path
    if (!node) {
      node = this.model.findById(pathOrId);
    }
    
    return node;
  }
  
  _isDescendantOf(node, potentialAncestor) {
    let current = node;
    while (current && current.parent) {
      if (current.parent.id === potentialAncestor.id) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
  
  _handleError(error) {
    // Add timestamp and context
    error.timestamp = Date.now();
    error.context = {
      mode: this.currentMode,
      nodeCount: this.model ? this.model.getNodeCount() : 0
    };
    
    // Track error if enabled
    if (this.config.trackErrors) {
      this.errorHistory.push(error);
    }
    
    // Use custom error handler if provided
    if (this.config.errorHandler) {
      const result = this.config.errorHandler(error);
      if (result && result.handled) {
        return;
      }
    }
    
    // Emit error event
    this.emit('error', error);
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[HierarchyEditor]', error);
    }
  }
  
  _renderTree() {
    if (!this.model || !this.renderer) return;
    
    const viewContainer = this.dom.querySelector('.he-tree-view');
    if (!viewContainer) return;
    
    // Clear existing content
    viewContainer.innerHTML = '';
    
    // Get root node
    const rootNode = this.model.getRootNode();
    if (!rootNode) {
      this._showEmptyState();
      return;
    }
    
    // Render the tree
    const renderedElement = this.renderer.render(rootNode, {
      formatHandler: this.formatHandler
    });
    
    viewContainer.appendChild(renderedElement);
  }
  
  _handleRendererEdit(editData) {
    const { node, type, oldValue, newValue } = editData;
    
    if (type === 'key') {
      // Handle key edit - need to recreate node with new key
      const parentNode = node.parent;
      if (parentNode) {
        const nodeData = {
          type: node.type,
          name: newValue,
          value: node.value,
          children: node.children
        };
        this.model.removeNode(node.id);
        this.model.addNode(parentNode.id, nodeData);
      }
    } else if (type === 'value') {
      // Handle value edit
      this.model.updateNodeValue(node.id, newValue);
    }
    
    this.emit('nodeedit', {
      path: node.path || node.name,
      oldValue,
      newValue,
      type
    });
    
    this._emitContentChange('edit');
  }
  
  _handleExpand(node, nodePath) {
    this.emit('expand', { node, path: nodePath });
  }
  
  _handleCollapse(node, nodePath) {
    this.emit('collapse', { node, path: nodePath });
  }
  
  _getNodePath(node) {
    if (!node) return '';
    
    const parts = [];
    let current = node;
    
    while (current) {
      if (current.name) {
        parts.unshift(current.name);
      } else if (current.id && current.id !== 'root') {
        parts.unshift(current.id);
      }
      current = current.parent;
    }
    
    return parts.join('.');
  }
  
  _collectExpandablePaths(node, basePath) {
    const paths = [];
    
    if (node.children && node.children.length > 0) {
      paths.push(basePath);
      
      node.children.forEach((child, index) => {
        const childPath = basePath ? `${basePath}.${child.name || index}` : (child.name || index.toString());
        paths.push(...this._collectExpandablePaths(child, childPath));
      });
    }
    
    return paths;
  }
  
  _inferNodeType(value) {
    if (value === null || value === undefined) return 'value';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'value';
  }

  destroy() {
    if (this.destroyed) return;
    
    // Destroy plugins
    for (const plugin of this.config.plugins) {
      try {
        if (plugin.destroy) {
          plugin.destroy();
        }
      } catch (error) {
        console.error('Error destroying plugin:', error);
      }
    }
    
    // Destroy components
    if (this.viewModeManager) {
      this.viewModeManager.destroy();
    }
    
    if (this.expansionState) {
      this.expansionState.destroy();
    }
    
    if (this.renderer) {
      this.renderer.clearCache();
    }
    
    if (this.model) {
      this.model.destroy();
    }
    
    // Clear DOM
    if (this.dom) {
      this.dom.innerHTML = '';
    }
    
    // Clear all event listeners
    this.removeAllListeners();
    
    this.destroyed = true;
    
    // Emit destroy event
    this.emit('destroy', { instance: this });
  }
}