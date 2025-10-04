/**
 * ModernTreeView - Tree view component extending BaseView
 * 
 * Handles DOM rendering, user interactions, animations, and visual state.
 * Supports virtual scrolling, custom renderers, and accessibility.
 */

import { BaseView } from '@legion/components';

export class ModernTreeView extends BaseView {
  constructor(dom, config) {
    super(dom, config);
    
    // View-specific state
    this.nodeElements = new Map(); // nodeId -> DOM element
    this.virtualScrolling = config.virtualScrolling || false;
    this.viewportTop = 0;
    this.viewportHeight = 0;
    this.itemHeight = 24; // Default row height
    this.renderBuffer = 5; // Extra items to render outside viewport
    
    // Custom renderers
    this.nodeRenderer = config.nodeRenderer || null;
    this.iconProvider = config.iconProvider || this._defaultIconProvider.bind(this);
    
    // Animation state
    this.animateTransitions = config.animateTransitions !== false;
    this.expandAnimations = new Map(); // nodeId -> animation
    
    // Accessibility
    this.ariaLiveRegion = null;
    
    this._setupTreeContainer();
    this._setupVirtualScrolling();
    this._setupAccessibility();
  }

  /**
   * Get container CSS classes
   * @protected
   */
  _getContainerClasses() {
    return [
      'modern-tree',
      'modern-tree-view',
      `theme-${this.currentTheme}`,
      this.config.showLines ? 'show-lines' : '',
      this.config.showIcons ? 'show-icons' : '',
      this.virtualScrolling ? 'virtual-scroll' : ''
    ].filter(Boolean);
  }

  /**
   * Setup tree-specific container
   * @private
   */
  _setupTreeContainer() {
    this.container.setAttribute('role', 'tree');
    this.container.setAttribute('aria-label', this.config.ariaLabel || 'Tree view');
    this.container.tabIndex = 0;
    
    // Create tree content container
    this.treeContent = document.createElement('div');
    this.treeContent.className = 'tree-content';
    this.container.appendChild(this.treeContent);
    this.addElement('treeContent', this.treeContent);
    
    // Add CSS styles
    this._injectTreeStyles();
  }

  /**
   * Setup virtual scrolling if enabled
   * @private
   */
  _setupVirtualScrolling() {
    if (!this.virtualScrolling) return;
    
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'scroll-container';
    this.scrollContainer.style.position = 'relative';
    this.scrollContainer.style.overflow = 'auto';
    this.scrollContainer.style.height = '100%';
    
    this.virtualContent = document.createElement('div');
    this.virtualContent.className = 'virtual-content';
    this.virtualContent.style.position = 'relative';
    
    this.scrollContainer.appendChild(this.virtualContent);
    this.container.appendChild(this.scrollContainer);
    
    // Listen for scroll events
    this.addEventListener(this.scrollContainer, 'scroll', this._handleVirtualScroll.bind(this));
    
    this.addElement('scrollContainer', this.scrollContainer);
    this.addElement('virtualContent', this.virtualContent);
  }

  /**
   * Setup accessibility features
   * @protected
   */
  _setupAccessibility() {
    super._setupAccessibility();
    
    // Override role for tree component
    this.container.setAttribute('role', 'tree');
    this.container.setAttribute('aria-label', this.config.ariaLabel || 'Tree view');
    
    // Create aria-live region for announcements
    this.ariaLiveRegion = document.createElement('div');
    this.ariaLiveRegion.className = 'sr-only';
    this.ariaLiveRegion.setAttribute('aria-live', 'polite');
    this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
    this.container.appendChild(this.ariaLiveRegion);
    this.addElement('ariaLive', this.ariaLiveRegion);
    
    // Keyboard navigation
    this.addEventListener(this.container, 'keydown', this._handleKeyDown.bind(this));
    this.addEventListener(this.container, 'focus', this._handleFocus.bind(this));
    this.addEventListener(this.container, 'blur', this._handleBlur.bind(this));
  }

  /**
   * Set the model reference (called by ViewModel)
   * @param {Object} model - Model instance
   */
  setModel(model) {
    this.model = model;
  }

  /**
   * Render the tree
   */
  render() {
    if (!this.model || this.destroyed) return;
    
    console.log('🎨 [VIEW] Rendering tree...');
    
    if (this.virtualScrolling) {
      this._renderVirtual();
    } else {
      this._renderStandard();
    }
    
    super.render();
  }

  /**
   * Standard rendering for smaller trees
   * @private
   */
  _renderStandard() {
    const visibleNodes = this.model.getVisibleNodes();
    const container = this.virtualScrolling ? this.virtualContent : this.treeContent;
    
    // CRITICAL FIX: Don't destroy existing elements, update incrementally
    console.log('🔄 [VIEW] Incremental render - preserving existing elements');
    
    // Find which nodes need to be added or removed
    const existingNodes = new Set(this.nodeElements.keys());
    const currentNodes = new Set(visibleNodes);
    
    // Remove nodes that are no longer visible
    for (const nodeId of existingNodes) {
      if (!currentNodes.has(nodeId)) {
        const element = this.nodeElements.get(nodeId);
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
        this.nodeElements.delete(nodeId);
        console.log('🗑️ [VIEW] Removed node element:', nodeId);
      }
    }
    
    // Add or update nodes that are visible
    visibleNodes.forEach((nodeId, index) => {
      let nodeElement = this.nodeElements.get(nodeId);
      
      if (!nodeElement) {
        // Create new element
        nodeElement = this._createNodeElement(nodeId);
        this.nodeElements.set(nodeId, nodeElement);
        console.log('➕ [VIEW] Created new node element:', nodeId);
      }
      
      // Ensure element is in the correct position
      const currentIndex = Array.from(container.children).indexOf(nodeElement);
      if (currentIndex !== index) {
        if (index >= container.children.length) {
          container.appendChild(nodeElement);
        } else {
          container.insertBefore(nodeElement, container.children[index]);
        }
      }
    });
    
    this._updateSelection();
    this._updateExpansion();
    this._updateSearch();
    this._updateFocus();
  }

  /**
   * Virtual scrolling rendering for large trees
   * @private
   */
  _renderVirtual() {
    const visibleNodes = this.model.getVisibleNodes();
    const containerHeight = this.scrollContainer.clientHeight;
    const totalHeight = visibleNodes.length * this.itemHeight;
    
    // Update virtual content height
    this.virtualContent.style.height = `${totalHeight}px`;
    
    // Calculate visible range
    const scrollTop = this.scrollContainer.scrollTop;
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.renderBuffer);
    const endIndex = Math.min(
      visibleNodes.length,
      Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.renderBuffer
    );
    
    // Clear and render visible items
    this.virtualContent.innerHTML = '';
    this.nodeElements.clear();
    
    for (let i = startIndex; i < endIndex; i++) {
      const nodeId = visibleNodes[i];
      const nodeElement = this._createNodeElement(nodeId);
      nodeElement.style.position = 'absolute';
      nodeElement.style.top = `${i * this.itemHeight}px`;
      nodeElement.style.width = '100%';
      nodeElement.style.height = `${this.itemHeight}px`;
      
      this.virtualContent.appendChild(nodeElement);
      this.nodeElements.set(nodeId, nodeElement);
    }
    
    this._updateSelection();
    this._updateExpansion();
    this._updateSearch();
    this._updateFocus();
  }

  /**
   * Create DOM element for a tree node
   * @private
   */
  _createNodeElement(nodeId) {
    const node = this.model.getNode(nodeId);
    const depth = this.model.getNodeDepth(nodeId);
    const hasChildren = this.model.hasChildren(nodeId);
    const isExpanded = this.model.isExpanded(nodeId);
    
    // Use custom renderer if provided
    if (this.nodeRenderer) {
      const customElement = this.nodeRenderer(node, {
        nodeId,
        depth,
        hasChildren,
        isExpanded,
        isSelected: this.model.isSelected(nodeId),
        isSearchResult: this.model.isSearchResult(nodeId),
        isFocused: this.model.getFocusedNode() === nodeId
      });
      
      if (customElement) {
        this._addNodeEventListeners(customElement, nodeId);
        return customElement;
      }
    }
    
    // Default node rendering
    const element = document.createElement('div');
    element.className = 'tree-node';
    element.setAttribute('role', 'treeitem');
    element.setAttribute('aria-level', depth + 1);
    element.setAttribute('aria-expanded', hasChildren ? isExpanded : undefined);
    element.setAttribute('data-node-id', nodeId);
    element.tabIndex = -1;
    
    // Indentation
    const indent = depth * 20;
    element.style.paddingLeft = `${indent + 8}px`;
    
    // Expand/collapse toggle
    if (hasChildren) {
      const toggle = document.createElement('button');
      toggle.className = 'node-toggle';
      toggle.setAttribute('aria-label', isExpanded ? 'Collapse' : 'Expand');
      toggle.innerHTML = this._getToggleIcon(isExpanded);
      toggle.tabIndex = -1;
      
      this.addEventListener(toggle, 'click', (e) => {
        e.stopPropagation();
        // CRITICAL FIX: Read nodeId from DOM to handle element reuse
        const actualNodeId = element.getAttribute('data-node-id');
        this._emitViewEvent('nodeToggle', { nodeId: actualNodeId });
      });
      
      element.appendChild(toggle);
    } else {
      // Spacer for alignment
      const spacer = document.createElement('span');
      spacer.className = 'node-spacer';
      element.appendChild(spacer);
    }
    
    // Node icon
    if (this.config.showIcons) {
      const icon = document.createElement('span');
      icon.className = 'node-icon';
      icon.innerHTML = this.iconProvider(node, { hasChildren, isExpanded });
      element.appendChild(icon);
    }
    
    // Node content
    const content = document.createElement('span');
    content.className = 'node-content';
    content.textContent = node.name || node.title || 'Unnamed';
    
    // Add specific editing functionality to the content span
    if (this.config.editable) {
      content.style.cursor = 'text';
      content.title = 'Click to edit';
      
      // Add click listener specifically to the content span for editing
      this.addEventListener(content, 'click', (e) => {
        // CRITICAL FIX: Read nodeId from DOM instead of closure to handle element reuse
        const actualNodeId = element.getAttribute('data-node-id');
        console.log('🖱️ [VIEW] Click detected on content span for node:', actualNodeId);
        console.log('🖱️ [VIEW] Event target:', e.target.tagName, e.target.className);
        console.log('🖱️ [VIEW] Current target:', e.currentTarget.tagName, e.currentTarget.className);
        console.log('🖱️ [VIEW] Config editable:', this.config.editable);
        console.log('🖱️ [VIEW] Content text:', content.textContent);
        
        // IMPORTANT: First select the node, then start editing
        console.log('🔵 [VIEW] Selecting node before editing:', actualNodeId);
        this._emitViewEvent('nodeClick', { 
          nodeId: actualNodeId, 
          ctrlKey: e.ctrlKey, 
          shiftKey: e.shiftKey 
        });
        
        // Then start editing
        console.log('🎯 [VIEW] About to emit nodeStartEdit event for:', actualNodeId);
        this._emitViewEvent('nodeStartEdit', { nodeId: actualNodeId });
        console.log('🎯 [VIEW] nodeStartEdit event emitted for:', actualNodeId);
        
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering other click handlers
      });
    }
    
    element.appendChild(content);
    
    // Add event listeners
    this._addNodeEventListeners(element, nodeId);
    
    return element;
  }

  /**
   * Add event listeners to node element
   * @private
   */
  _addNodeEventListeners(element, nodeId) {
    // CRITICAL FIX: All event handlers must read nodeId from DOM to handle element reuse
    
    // Click selection
    this.addEventListener(element, 'click', (e) => {
      const actualNodeId = element.getAttribute('data-node-id');
      this._emitViewEvent('nodeClick', { 
        nodeId: actualNodeId, 
        ctrlKey: e.ctrlKey, 
        shiftKey: e.shiftKey 
      });
    });
    
    // Double-click (only for non-editable mode or non-content clicks)
    this.addEventListener(element, 'dblclick', (e) => {
      // If editable and clicked on content, let the content handler deal with it
      if (this.config.editable && e.target.classList.contains('node-content')) {
        return; // Content span will handle this
      }
      
      if (!this.config.editable) {
        const actualNodeId = element.getAttribute('data-node-id');
        this._emitViewEvent('nodeDoubleClick', { nodeId: actualNodeId });
      }
    });
    
    // Context menu
    this.addEventListener(element, 'contextmenu', (e) => {
      e.preventDefault();
      const actualNodeId = element.getAttribute('data-node-id');
      this._emitViewEvent('nodeContextMenu', { 
        nodeId: actualNodeId, 
        x: e.clientX, 
        y: e.clientY 
      });
    });
    
    // Focus
    this.addEventListener(element, 'focus', () => {
      const actualNodeId = element.getAttribute('data-node-id');
      this._emitViewEvent('nodeFocus', { nodeId: actualNodeId });
    });
    
    // Drag and drop (if enabled)
    if (this.config.draggable) {
      element.draggable = true;
      
      this.addEventListener(element, 'dragstart', (e) => {
        const actualNodeId = element.getAttribute('data-node-id');
        this._emitViewEvent('dragStart', { nodeId: actualNodeId, dataTransfer: e.dataTransfer });
      });
      
      this.addEventListener(element, 'dragover', (e) => {
        e.preventDefault();
        const actualNodeId = element.getAttribute('data-node-id');
        this._emitViewEvent('dragOver', { nodeId: actualNodeId, dataTransfer: e.dataTransfer });
      });
      
      this.addEventListener(element, 'drop', (e) => {
        e.preventDefault();
        const actualNodeId = element.getAttribute('data-node-id');
        this._emitViewEvent('drop', { nodeId: actualNodeId, dataTransfer: e.dataTransfer });
      });
    }
  }

  /**
   * Update visual selection state
   */
  _updateSelection() {
    const selectedNodes = this.model.getSelectedNodes();
    
    this.nodeElements.forEach((element, nodeId) => {
      const isSelected = selectedNodes.includes(nodeId);
      element.classList.toggle('selected', isSelected);
      element.setAttribute('aria-selected', isSelected);
    });
  }

  /**
   * Update visual expansion state
   */
  _updateExpansion() {
    this.nodeElements.forEach((element, nodeId) => {
      const isExpanded = this.model.isExpanded(nodeId);
      const hasChildren = this.model.hasChildren(nodeId);
      
      if (hasChildren) {
        element.setAttribute('aria-expanded', isExpanded);
        
        const toggle = element.querySelector('.node-toggle');
        if (toggle) {
          toggle.innerHTML = this._getToggleIcon(isExpanded);
          toggle.setAttribute('aria-label', isExpanded ? 'Collapse' : 'Expand');
        }
      }
      
      element.classList.toggle('expanded', isExpanded);
    });
  }

  /**
   * Update search highlighting
   */
  _updateSearch() {
    this.nodeElements.forEach((element, nodeId) => {
      const isSearchResult = this.model.isSearchResult(nodeId);
      element.classList.toggle('search-result', isSearchResult);
    });
  }

  /**
   * Update focus state - now just manages tabIndex for keyboard navigation
   */
  _updateFocus() {
    const focusedNodeId = this.model.getFocusedNode();
    
    this.nodeElements.forEach((element, nodeId) => {
      const isFocused = nodeId === focusedNodeId;
      
      if (isFocused) {
        element.tabIndex = 0;
      } else {
        element.tabIndex = -1;
      }
    });
  }

  /**
   * Scroll node into view
   * @param {string} nodeId - Node ID to scroll to
   */
  scrollToNode(nodeId) {
    const element = this.nodeElements.get(nodeId);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Announce to screen readers
   * @param {string} message - Message to announce
   */
  announce(message) {
    if (this.ariaLiveRegion) {
      this.ariaLiveRegion.textContent = message;
    }
  }

  /**
   * Get toggle icon HTML
   * @private
   */
  _getToggleIcon(isExpanded) {
    return isExpanded ? '▼' : '▶';
  }

  /**
   * Default icon provider
   * @private
   */
  _defaultIconProvider(node, { hasChildren, isExpanded }) {
    if (hasChildren) {
      return isExpanded ? '📂' : '📁';
    }
    return '📄';
  }

  /**
   * Handle keyboard navigation
   * @private
   */
  _handleKeyDown(e) {
    const focusedNode = this.model.getFocusedNode();
    if (!focusedNode) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._emitViewEvent('keyboardNavigate', { direction: 'down', nodeId: focusedNode });
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._emitViewEvent('keyboardNavigate', { direction: 'up', nodeId: focusedNode });
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._emitViewEvent('keyboardNavigate', { direction: 'right', nodeId: focusedNode });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this._emitViewEvent('keyboardNavigate', { direction: 'left', nodeId: focusedNode });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this._emitViewEvent('nodeActivate', { nodeId: focusedNode });
        break;
      case 'Home':
        e.preventDefault();
        this._emitViewEvent('keyboardNavigate', { direction: 'home' });
        break;
      case 'End':
        e.preventDefault();
        this._emitViewEvent('keyboardNavigate', { direction: 'end' });
        break;
    }
  }

  /**
   * Handle focus events
   * @private
   */
  _handleFocus(e) {
    if (!this.model.getFocusedNode()) {
      // Focus first visible node if none is focused
      const visibleNodes = this.model.getVisibleNodes();
      if (visibleNodes.length > 0) {
        this._emitViewEvent('nodeFocus', { nodeId: visibleNodes[0] });
      }
    }
  }

  /**
   * Handle blur events
   * @private
   */
  _handleBlur(e) {
    // Only blur if focus is leaving the tree entirely
    if (!this.container.contains(e.relatedTarget)) {
      this._emitViewEvent('treeBlur', {});
    }
  }

  /**
   * Handle virtual scroll events
   * @private
   */
  _handleVirtualScroll() {
    if (this.virtualScrolling) {
      this.requestRender();
    }
  }

  /**
   * Inject CSS styles for the tree
   * @private
   */
  _injectTreeStyles() {
    if (document.getElementById('modern-tree-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'modern-tree-styles';
    styles.textContent = `
      .modern-tree {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.4;
        outline: none;
        user-select: none;
      }
      
      .tree-content {
        padding: 4px 0;
      }
      
      .tree-node {
        display: flex;
        align-items: center;
        padding: 2px 8px;
        cursor: pointer;
        border-radius: 3px;
        margin: 1px 0;
        min-height: 20px;
      }
      
      .tree-node:hover {
        background-color: var(--tree-hover-bg, #f0f0f0);
      }
      
      .tree-node.selected {
        outline: 2px solid var(--tree-selected-color, #0078d4);
        outline-offset: -2px;
      }
      
      .tree-node.search-result {
        background-color: var(--tree-search-bg, #ffeb3b);
        color: var(--tree-search-color, #000);
      }
      
      .node-toggle {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0;
        margin-right: 4px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
      }
      
      .node-spacer {
        width: 20px;
        flex-shrink: 0;
      }
      
      .node-icon {
        margin-right: 6px;
        flex-shrink: 0;
      }
      
      .node-content {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .node-content[title*="edit"] {
        border-radius: 2px;
        padding: 1px 3px;
        margin: -1px -3px;
      }
      
      .node-content[title*="edit"]:hover {
        background-color: rgba(0, 123, 255, 0.1);
        outline: 1px dashed rgba(0, 123, 255, 0.3);
      }
      
      .node-content.editing {
        overflow: visible;
      }
      
      .tree-node-edit-container {
        display: flex !important;
        align-items: center;
        gap: 4px;
        width: 100%;
      }
      
      .tree-node-label-input {
        flex: 1;
        min-width: 0;
        background: white;
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 2px 4px;
        font-size: inherit;
        font-family: inherit;
      }
      
      .tree-node-label-input:focus {
        outline: 2px solid var(--tree-focus-color, #0078d4);
        outline-offset: -2px;
      }
      
      .tree-node-emoji {
        flex-shrink: 0;
      }
      
      .theme-light {
        background-color: #ffffff;
        color: #333333;
        border: 1px solid #e1e5e9;
        --tree-hover-bg: #f0f0f0;
        --tree-selected-bg: #0078d4;
        --tree-selected-color: #ffffff;
        --tree-focus-color: #0078d4;
        --tree-search-bg: #ffeb3b;
        --tree-search-color: #000000;
      }
      
      .theme-dark {
        background-color: #1e1e1e;
        color: #cccccc;
        border: 1px solid #404040;
        --tree-hover-bg: #2d2d2d;
        --tree-selected-bg: #0e639c;
        --tree-selected-color: #ffffff;
        --tree-focus-color: #007fd4;
        --tree-search-bg: #ffeb3b;
        --tree-search-color: #000000;
      }
      
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Start inline editing of a node label
   * @param {string} nodeId - Node ID to edit
   * @param {string} currentValue - Current text value (without emoji)
   * @param {string} emoji - Emoji prefix if present
   * @returns {HTMLInputElement|null} - Input element or null if failed
   */
  startEditingNode(nodeId, currentValue, emoji = '') {
    console.log('🏗️ [VIEW] startEditingNode called with:', { nodeId, currentValue, emoji });
    
    const nodeElement = this.nodeElements.get(nodeId);
    console.log('🏗️ [VIEW] Node element found:', !!nodeElement);
    if (!nodeElement) {
      console.log('❌ [VIEW] No node element found for:', nodeId);
      return null;
    }
    
    const contentElement = nodeElement.querySelector('.node-content');
    console.log('🏗️ [VIEW] Content element found:', !!contentElement);
    console.log('🏗️ [VIEW] Content element already editing:', contentElement?.classList.contains('editing'));
    if (!contentElement || contentElement.classList.contains('editing')) {
      console.log('❌ [VIEW] Content element not found or already editing');
      return null;
    }
    
    // Store original content and emoji
    const originalContent = contentElement.textContent;
    console.log('🏗️ [VIEW] Original content:', originalContent);
    contentElement.setAttribute('data-original', originalContent);
    contentElement.setAttribute('data-emoji', emoji);
    
    // Create a container for emoji + input
    const editContainer = document.createElement('div');
    editContainer.className = 'tree-node-edit-container';
    editContainer.style.display = 'flex';
    editContainer.style.alignItems = 'center';
    editContainer.style.gap = '4px';
    console.log('🏗️ [VIEW] Created edit container');
    
    // Add emoji if present
    if (emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = emoji;
      emojiSpan.className = 'tree-node-emoji';
      editContainer.appendChild(emojiSpan);
      console.log('🏗️ [VIEW] Added emoji span:', emoji);
    }
    
    // Create input element
    const input = document.createElement('input');
    input.className = 'tree-node-label-input';
    input.type = 'text';
    input.value = currentValue || originalContent;
    input.style.flex = '1';
    input.style.minWidth = '0';
    input.style.background = 'white';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '3px';
    input.style.padding = '2px 4px';
    console.log('🏗️ [VIEW] Created input element with value:', input.value);
    
    editContainer.appendChild(input);
    console.log('🏗️ [VIEW] Added input to container');
    
    // Replace content with edit container
    console.log('🏗️ [VIEW] About to replace content element innerHTML');
    contentElement.innerHTML = '';
    contentElement.appendChild(editContainer);
    contentElement.classList.add('editing');
    console.log('🏗️ [VIEW] Replaced content and added editing class');
    
    // Verify the DOM changes
    const verifyInput = contentElement.querySelector('.tree-node-label-input');
    console.log('🏗️ [VIEW] Verification - input in DOM:', !!verifyInput);
    console.log('🏗️ [VIEW] Verification - content has editing class:', contentElement.classList.contains('editing'));
    
    // Focus and select all text
    console.log('🏗️ [VIEW] About to focus and select input');
    setTimeout(() => {
      input.focus();
      input.select();
      console.log('🏗️ [VIEW] Input focused and selected');
      console.log('🏗️ [VIEW] Document active element:', document.activeElement === input);
    }, 10);
    
    console.log('✅ [VIEW] startEditingNode successful, returning input element');
    return input;
  }

  /**
   * Finish editing a node label
   * @param {string} nodeId - Node ID being edited
   * @param {string} newValue - New value (optional, will read from input if not provided)
   * @param {boolean} cancelled - Whether editing was cancelled
   * @returns {Object|null} - Result object with originalValue, newValue, and changed flag
   */
  finishEditingNode(nodeId, newValue = null, cancelled = false) {
    const nodeElement = this.nodeElements.get(nodeId);
    if (!nodeElement) return null;
    
    const contentElement = nodeElement.querySelector('.node-content');
    if (!contentElement || !contentElement.classList.contains('editing')) return null;
    
    const originalContent = contentElement.getAttribute('data-original');
    const emoji = contentElement.getAttribute('data-emoji') || '';
    
    contentElement.removeAttribute('data-original');
    contentElement.removeAttribute('data-emoji');
    contentElement.classList.remove('editing');
    
    // Get the text from input if not cancelled
    let finalValue;
    if (cancelled) {
      // When cancelled, restore original content as-is
      finalValue = originalContent;
    } else {
      // When not cancelled, get new text and combine with emoji
      const input = contentElement.querySelector('.tree-node-label-input');
      const textValue = newValue || (input ? input.value : originalContent);
      finalValue = emoji ? `${emoji} ${textValue}` : textValue;
    }
    contentElement.textContent = finalValue;
    
    return {
      originalValue: originalContent,
      newValue: finalValue,
      changed: !cancelled && finalValue !== originalContent
    };
  }

  /**
   * Cancel editing and restore original value
   * @param {string} nodeId - Node ID being edited
   * @returns {Object|null} - Result object
   */
  cancelEditingNode(nodeId) {
    return this.finishEditingNode(nodeId, null, true);
  }

  /**
   * Check if a node is currently being edited
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} - Whether the node is being edited
   */
  isEditingNode(nodeId) {
    const nodeElement = this.nodeElements.get(nodeId);
    if (!nodeElement) return false;
    
    const contentElement = nodeElement.querySelector('.node-content');
    return contentElement && contentElement.classList.contains('editing');
  }

  /**
   * Clean up view resources
   */
  destroy() {
    // Clear animations
    this.expandAnimations.forEach(animation => animation.cancel());
    this.expandAnimations.clear();
    
    // Clear node elements
    this.nodeElements.clear();
    
    super.destroy();
  }
}