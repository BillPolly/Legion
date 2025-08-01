/**
 * KeyboardNavigation - Advanced keyboard navigation system for TreeScribe
 * 
 * Provides comprehensive keyboard shortcuts, focus management, and navigation
 * with accessibility support
 */

export class KeyboardNavigation {
  constructor(treeView, interactionManager, options = {}) {
    if (!treeView) {
      throw new Error('TreeView is required');
    }
    
    if (!interactionManager) {
      throw new Error('InteractionManager is required');
    }

    this.treeView = treeView;
    this.interactionManager = interactionManager;
    this.destroyed = false;
    
    this.options = {
      enableShortcuts: true,
      enableAriaSupport: true,
      enableFocusTrapping: true,
      announceNavigation: true,
      ...options
    };

    // Focus management
    this.focusHistory = [];
    this.maxHistorySize = 50;
    this.focusTrapped = false;
    
    // Keyboard shortcut mappings
    this.shortcuts = new Map();
    this.eventListeners = new Map();
    this.interactionSubscriptions = [];

    // ARIA live region for announcements
    this.ariaLiveRegion = null;

    this._initializeDefaultShortcuts();
    this._initializeAriaSupport();
    this._subscribeToInteractionManager();
  }

  /**
   * Initialize default keyboard shortcuts
   * @private
   */
  _initializeDefaultShortcuts() {
    // Navigation shortcuts
    this.registerShortcut('ArrowUp', 'Navigate to previous node', (event) => {
      this._navigateToPrevious(event);
    });

    this.registerShortcut('ArrowDown', 'Navigate to next node', (event) => {
      this._navigateToNext(event);
    });

    this.registerShortcut('ArrowLeft', 'Collapse node or navigate to parent', (event) => {
      this._navigateLeft(event);
    });

    this.registerShortcut('ArrowRight', 'Expand node or navigate to first child', (event) => {
      this._navigateRight(event);
    });

    this.registerShortcut('Home', 'Navigate to first node', (event) => {
      this._navigateToFirst(event);
    });

    this.registerShortcut('End', 'Navigate to last node', (event) => {
      this._navigateToLast(event);
    });

    // Toggle shortcuts
    this.registerShortcut('Enter', 'Toggle node expansion', (event) => {
      this._toggleCurrentNode(event);
    });

    this.registerShortcut(' ', 'Toggle node expansion', (event) => {
      this._toggleCurrentNode(event);
    });

    // Batch operations
    this.registerShortcut('*', 'Expand all nodes', (event) => {
      this._expandAll(event);
    });

    this.registerShortcut('/', 'Focus search', (event) => {
      this._focusSearch(event);
    });

    // With modifiers
    this.registerShortcut('Escape', 'Clear focus or exit search', (event) => {
      this._handleEscape(event);
    });

    this.registerShortcut('Tab', 'Navigate to next focusable element', (event) => {
      this._handleTab(event);
    });

    this.registerShortcut('Shift+Tab', 'Navigate to previous focusable element', (event) => {
      this._handleShiftTab(event);
    });
  }

  /**
   * Initialize ARIA support
   * @private
   */
  _initializeAriaSupport() {
    if (!this.options.enableAriaSupport) return;

    // Create ARIA live region for announcements
    this.ariaLiveRegion = document.createElement('div');
    this.ariaLiveRegion.setAttribute('aria-live', 'polite');
    this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
    this.ariaLiveRegion.className = 'sr-only';
    this.ariaLiveRegion.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;

    // Add to container
    if (this.treeView.container) {
      this.treeView.container.appendChild(this.ariaLiveRegion);
    }
  }

  /**
   * Subscribe to interaction manager events
   * @private
   */
  _subscribeToInteractionManager() {
    const keyboardSubscription = this.interactionManager.on('keyboardNavigation', (data) => {
      this._handleKeyboardNavigation(data);
    });
    this.interactionSubscriptions.push(keyboardSubscription);

    const focusSubscription = this.interactionManager.on('nodeFocus', (data) => {
      this._handleNodeFocus(data);
    });
    this.interactionSubscriptions.push(focusSubscription);
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(keyCombo, description, handler) {
    if (this.destroyed || !keyCombo || !handler) return false;

    const normalizedCombo = this._normalizeKeyCombo(keyCombo);
    this.shortcuts.set(normalizedCombo, {
      description,
      handler,
      enabled: true
    });

    return true;
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(keyCombo) {
    if (this.destroyed || !keyCombo) return false;

    const normalizedCombo = this._normalizeKeyCombo(keyCombo);
    return this.shortcuts.delete(normalizedCombo);
  }

  /**
   * Enable or disable a specific shortcut
   */
  setShortcutEnabled(keyCombo, enabled) {
    if (this.destroyed || !keyCombo) return false;

    const normalizedCombo = this._normalizeKeyCombo(keyCombo);
    const shortcut = this.shortcuts.get(normalizedCombo);
    
    if (shortcut) {
      shortcut.enabled = enabled;
      return true;
    }
    
    return false;
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts() {
    if (this.destroyed) return [];

    return Array.from(this.shortcuts.entries()).map(([combo, data]) => ({
      keyCombo: combo,
      description: data.description,
      enabled: data.enabled
    }));
  }

  /**
   * Handle keyboard navigation from interaction manager
   * @private
   */
  _handleKeyboardNavigation(data) {
    if (this.destroyed || !this.options.enableShortcuts) return;

    const { key, nodeId, event } = data;
    const keyCombo = this._getKeyCombo(event);
    const shortcut = this.shortcuts.get(keyCombo);

    if (shortcut && shortcut.enabled) {
      try {
        shortcut.handler(event, { nodeId, key });
      } catch (error) {
        console.error('Keyboard shortcut handler error:', error);
      }
    }
  }

  /**
   * Handle node focus events
   * @private
   */
  _handleNodeFocus(data) {
    if (this.destroyed) return;

    const { nodeId } = data;
    
    // Update focus history
    this._updateFocusHistory(nodeId);
    
    // Announce navigation if enabled
    if (this.options.announceNavigation) {
      this._announceNodeFocus(nodeId);
    }
  }

  /**
   * Navigate to previous visible node
   * @private
   */
  _navigateToPrevious(event) {
    if (this.interactionManager.focusPreviousNode) {
      this.interactionManager.focusPreviousNode();
    }
  }

  /**
   * Navigate to next visible node
   * @private
   */
  _navigateToNext(event) {
    if (this.interactionManager.focusNextNode) {
      this.interactionManager.focusNextNode();
    }
  }

  /**
   * Navigate left (collapse or move to parent)
   * @private
   */
  _navigateLeft(event) {
    const focusedNodeId = this.interactionManager.getFocusedNodeId();
    if (!focusedNodeId) return;

    // Get node from tree view
    const node = this.treeView.model ? 
      this.treeView.model.getNode(focusedNodeId) : 
      null;

    if (node) {
      // If expanded, collapse it
      if (node.getState().expanded) {
        this._emitToggle(focusedNodeId);
      } else if (node.getParent()) {
        // Otherwise, navigate to parent
        this.interactionManager.focusNode(node.getParent().getId());
      }
    }
  }

  /**
   * Navigate right (expand or move to first child)
   * @private
   */
  _navigateRight(event) {
    const focusedNodeId = this.interactionManager.getFocusedNodeId();
    if (!focusedNodeId) return;

    const node = this.treeView.model ? 
      this.treeView.model.getNode(focusedNodeId) : 
      null;

    if (node) {
      const state = node.getState();
      
      // If collapsed and has children, expand it
      if (!state.expanded && node.getChildren().length > 0) {
        this._emitToggle(focusedNodeId);
      } else if (state.expanded && node.getChildren().length > 0) {
        // If expanded, navigate to first child
        this.interactionManager.focusNode(node.getChildren()[0].getId());
      }
    }
  }

  /**
   * Navigate to first node
   * @private
   */
  _navigateToFirst(event) {
    if (this.interactionManager.focusFirstNode) {
      this.interactionManager.focusFirstNode();
    }
  }

  /**
   * Navigate to last node
   * @private
   */
  _navigateToLast(event) {
    if (this.interactionManager.focusLastNode) {
      this.interactionManager.focusLastNode();
    }
  }

  /**
   * Toggle current node
   * @private
   */
  _toggleCurrentNode(event) {
    const focusedNodeId = this.interactionManager.getFocusedNodeId();
    if (focusedNodeId) {
      this._emitToggle(focusedNodeId);
    }
  }

  /**
   * Expand all nodes
   * @private
   */
  _expandAll(event) {
    if (this.treeView.foldingManager && this.treeView.foldingManager.expandAll) {
      this.treeView.foldingManager.expandAll();
      this._announce('All nodes expanded');
    }
  }

  /**
   * Focus search input
   * @private
   */
  _focusSearch(event) {
    // Prevent default to avoid typing "/" in search
    if (event.preventDefault) event.preventDefault();
    
    // Find search input in tree view
    const searchInput = this.treeView.container ? 
      this.treeView.container.querySelector('.search-input, [data-search-input]') : 
      null;
    
    if (searchInput && searchInput.focus) {
      searchInput.focus();
      this._announce('Search focused');
    }
  }

  /**
   * Handle Escape key
   * @private
   */
  _handleEscape(event) {
    // Clear search if active
    const searchInput = this.treeView.container ? 
      this.treeView.container.querySelector('.search-input, [data-search-input]') : 
      null;
    
    if (searchInput && document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.blur();
      this._announce('Search cleared');
      return;
    }

    // Clear focus if trapped
    if (this.focusTrapped) {
      this.releaseFocusTrap();
      return;
    }

    // Otherwise, focus first node
    if (this.interactionManager.focusFirstNode) {
      this.interactionManager.focusFirstNode();
    }
  }

  /**
   * Handle Tab key
   * @private
   */
  _handleTab(event) {
    if (!this.options.enableFocusTrapping || !this.focusTrapped) return;

    // Handle focus trapping
    const focusableElements = this._getFocusableElements();
    if (focusableElements.length === 0) return;

    const currentIndex = focusableElements.indexOf(document.activeElement);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    
    focusableElements[nextIndex].focus();
    if (event.preventDefault) event.preventDefault();
  }

  /**
   * Handle Shift+Tab key
   * @private
   */
  _handleShiftTab(event) {
    if (!this.options.enableFocusTrapping || !this.focusTrapped) return;

    const focusableElements = this._getFocusableElements();
    if (focusableElements.length === 0) return;

    const currentIndex = focusableElements.indexOf(document.activeElement);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
    
    focusableElements[prevIndex].focus();
    if (event.preventDefault) event.preventDefault();
  }

  /**
   * Enable focus trapping within the tree
   */
  enableFocusTrap() {
    if (this.destroyed || this.focusTrapped) return false;

    this.focusTrapped = true;
    
    // Set aria-modal on container
    if (this.treeView.container) {
      this.treeView.container.setAttribute('aria-modal', 'true');
    }

    this._announce('Focus trapped in tree');
    return true;
  }

  /**
   * Release focus trap
   */
  releaseFocusTrap() {
    if (this.destroyed || !this.focusTrapped) return false;

    this.focusTrapped = false;
    
    // Remove aria-modal
    if (this.treeView.container) {
      this.treeView.container.removeAttribute('aria-modal');
    }

    this._announce('Focus trap released');
    return true;
  }

  /**
   * Get focus history
   */
  getFocusHistory() {
    return [...this.focusHistory];
  }

  /**
   * Clear focus history
   */
  clearFocusHistory() {
    this.focusHistory = [];
  }

  /**
   * Get keyboard navigation info
   */
  getInfo() {
    return {
      name: 'KeyboardNavigation',
      version: '1.0.0',
      shortcutCount: this.shortcuts.size,
      focusHistory: this.focusHistory.length,
      focusTrapped: this.focusTrapped,
      options: { ...this.options },
      destroyed: this.destroyed
    };
  }

  /**
   * Normalize key combination string
   * @private
   */
  _normalizeKeyCombo(keyCombo) {
    if (!keyCombo) return '';

    // Split by + and normalize each part
    const parts = keyCombo.split('+').map(part => {
      // Handle space character specially - don't trim it
      if (part === ' ') {
        return ' ';
      }
      
      const trimmed = part.trim();
      
      // Normalize modifier names
      if (trimmed.toLowerCase() === 'ctrl' || trimmed.toLowerCase() === 'control') {
        return 'Ctrl';
      }
      if (trimmed.toLowerCase() === 'alt') {
        return 'Alt';
      }
      if (trimmed.toLowerCase() === 'shift') {
        return 'Shift';
      }
      if (trimmed.toLowerCase() === 'meta' || trimmed.toLowerCase() === 'cmd') {
        return 'Meta';
      }
      
      return trimmed;
    });

    // Sort modifiers consistently (Ctrl, Alt, Shift, Meta, then key)
    const modifiers = [];
    let key = '';
    
    parts.forEach(part => {
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].includes(part)) {
        modifiers.push(part);
      } else {
        key = part;
      }
    });

    // Sort modifiers in standard order
    const sortOrder = { 'Ctrl': 0, 'Alt': 1, 'Shift': 2, 'Meta': 3 };
    modifiers.sort((a, b) => sortOrder[a] - sortOrder[b]);

    return modifiers.length > 0 ? 
      modifiers.join('+') + '+' + key : 
      key;
  }

  /**
   * Get key combination from event
   * @private
   */
  _getKeyCombo(event) {
    if (!event) return '';

    const parts = [];
    
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    parts.push(event.key);
    
    return parts.join('+');
  }

  /**
   * Update focus history
   * @private
   */
  _updateFocusHistory(nodeId) {
    if (!nodeId) return;

    // Remove if already in history
    const existingIndex = this.focusHistory.indexOf(nodeId);
    if (existingIndex > -1) {
      this.focusHistory.splice(existingIndex, 1);
    }

    // Add to beginning
    this.focusHistory.unshift(nodeId);

    // Trim to max size
    if (this.focusHistory.length > this.maxHistorySize) {
      this.focusHistory = this.focusHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Announce node focus for screen readers
   * @private
   */
  _announceNodeFocus(nodeId) {
    if (!this.options.announceNavigation || !this.ariaLiveRegion) return;

    const node = this.treeView.model ? 
      this.treeView.model.getNode(nodeId) : 
      null;

    if (node) {
      const title = node.getTitle() || 'Untitled';
      const depth = node.getDepth();
      const hasChildren = node.getChildren().length > 0;
      const isExpanded = node.getState().expanded;
      
      let announcement = `${title}, level ${depth + 1}`;
      
      if (hasChildren) {
        announcement += isExpanded ? ', expanded' : ', collapsed';
      }
      
      this._announce(announcement);
    }
  }

  /**
   * Make an announcement to screen readers
   * @private
   */
  _announce(message) {
    if (!this.ariaLiveRegion || !message) return;

    this.ariaLiveRegion.textContent = message;
    
    // Clear after delay to allow for re-announcements
    setTimeout(() => {
      if (this.ariaLiveRegion) {
        this.ariaLiveRegion.textContent = '';
      }
    }, 1000);
  }

  /**
   * Get focusable elements in container
   * @private
   */
  _getFocusableElements() {
    if (!this.treeView.container) return [];

    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '.tree-node[tabindex="0"]'
    ].join(', ');

    return Array.from(this.treeView.container.querySelectorAll(selector))
      .filter(el => {
        // Check if element is visible
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
      });
  }

  /**
   * Emit toggle event
   * @private
   */
  _emitToggle(nodeId) {
    if (this.interactionManager._emit) {
      this.interactionManager._emit('nodeToggle', {
        nodeId,
        action: 'toggle',
        source: 'keyboard'
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;

    // Remove ARIA live region
    if (this.ariaLiveRegion && this.ariaLiveRegion.parentNode) {
      this.ariaLiveRegion.parentNode.removeChild(this.ariaLiveRegion);
    }
    this.ariaLiveRegion = null;

    // Unsubscribe from interaction manager
    this.interactionSubscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.interactionSubscriptions = [];

    // Clear shortcuts and listeners
    this.shortcuts.clear();
    this.eventListeners.clear();

    // Clear references
    this.treeView = null;
    this.interactionManager = null;
    this.focusHistory = [];

    this.destroyed = true;
  }
}