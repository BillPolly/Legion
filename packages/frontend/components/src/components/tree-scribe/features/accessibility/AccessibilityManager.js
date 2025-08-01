/**
 * AccessibilityManager - Comprehensive accessibility support for TreeScribe
 * 
 * Ensures WCAG 2.1 AA compliance with full keyboard navigation,
 * screen reader support, and accessibility features.
 */

export class AccessibilityManager {
  constructor(options = {}) {
    this.options = {
      container: null,
      announcer: null,
      enableAnnouncements: true,
      enableFocusTrap: true,
      enableHighContrast: true,
      announceDelay: 100,
      clearDelay: 1000,
      ...options
    };

    this.destroyed = false;
    this.container = this.options.container;
    this.announcer = this.options.announcer || this._createAnnouncer();
    
    // State
    this.currentFocus = null;
    this.focusHistory = [];
    this.savedFocusState = null;
    this.focusTrapEnabled = false;
    this.highContrastEnabled = false;
    
    // Timers
    this.announceTimeout = null;
    this.clearTimeout = null;
    
    // Initialize
    this._init();
  }

  /**
   * Initialize accessibility features
   * @private
   */
  _init() {
    if (this.container) {
      this._setupContainerAttributes();
      this._attachEventListeners();
    }
    
    // Check for accessibility preferences
    this._detectAccessibilitySettings();
  }

  /**
   * Setup container ARIA attributes
   * @private
   */
  _setupContainerAttributes() {
    if (!this.container.getAttribute('role')) {
      this.container.setAttribute('role', 'tree');
    }
    
    if (!this.container.hasAttribute('aria-label') && 
        !this.container.hasAttribute('aria-labelledby')) {
      this.container.setAttribute('aria-label', 'Tree view');
    }
    
    if (!this.container.hasAttribute('tabindex')) {
      this.container.setAttribute('tabindex', '0');
    }
    
    this.container.setAttribute('aria-orientation', 'vertical');
  }

  /**
   * Attach event listeners
   * @private
   */
  _attachEventListeners() {
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleFocusIn = this._handleFocusIn.bind(this);
    this._handleFocusOut = this._handleFocusOut.bind(this);
    
    this.container.addEventListener('keydown', this._handleKeyDown);
    this.container.addEventListener('focusin', this._handleFocusIn);
    this.container.addEventListener('focusout', this._handleFocusOut);
  }

  /**
   * Create announcer element
   * @private
   */
  _createAnnouncer() {
    const announcer = document.createElement('div');
    announcer.className = 'tree-scribe-announcer sr-only';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.overflow = 'hidden';
    
    document.body.appendChild(announcer);
    return announcer;
  }

  /**
   * Detect accessibility settings
   * @private
   */
  _detectAccessibilitySettings() {
    // Check for reduced motion
    if (window.matchMedia) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (prefersReducedMotion.matches) {
        this.container?.classList.add('reduce-motion');
      }
      
      // Check for high contrast
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
      if (prefersHighContrast.matches) {
        this.applyHighContrastMode(true);
      }
    }
  }

  /**
   * Set node ARIA attributes
   */
  setNodeAttributes(node, data) {
    node.setAttribute('role', 'treeitem');
    
    if (data.id) {
      node.id = `treeitem-${data.id}`;
    }
    
    if (data.level !== undefined) {
      node.setAttribute('aria-level', String(data.level));
    }
    
    if (data.hasChildren) {
      node.setAttribute('aria-expanded', String(data.expanded || false));
    }
    
    if (data.selected !== undefined) {
      node.setAttribute('aria-selected', String(data.selected));
    }
    
    if (data.index !== undefined && data.totalSiblings !== undefined) {
      node.setAttribute('aria-posinset', String(data.index + 1));
      node.setAttribute('aria-setsize', String(data.totalSiblings));
    }
    
    if (data.disabled) {
      node.setAttribute('aria-disabled', 'true');
    }
    
    // Set focusability
    node.setAttribute('tabindex', data.focused ? '0' : '-1');
  }

  /**
   * Update expanded state
   */
  updateExpanded(node, expanded) {
    if (node.hasAttribute('aria-expanded')) {
      node.setAttribute('aria-expanded', String(expanded));
      
      if (this.options.enableAnnouncements) {
        const label = node.getAttribute('aria-label') || node.textContent;
        this.announce(`${label} ${expanded ? 'expanded' : 'collapsed'}`);
      }
    }
  }

  /**
   * Update selected state
   */
  updateSelected(node, selected) {
    node.setAttribute('aria-selected', String(selected));
    
    if (this.options.enableAnnouncements && selected) {
      const label = node.getAttribute('aria-label') || node.textContent;
      this.announce(`${label} selected`);
    }
  }

  /**
   * Set loading state
   */
  setLoadingState(node, loading) {
    node.setAttribute('aria-busy', String(loading));
    
    if (loading) {
      const currentLabel = node.getAttribute('aria-label') || node.textContent;
      node.setAttribute('aria-label', `Loading ${currentLabel}...`);
    } else {
      // Remove loading suffix
      const label = node.getAttribute('aria-label');
      if (label && label.includes('Loading')) {
        node.setAttribute('aria-label', label.replace(/^Loading |\.\.\.$/g, ''));
      }
    }
  }

  /**
   * Set node description
   */
  setNodeDescription(node, descriptionElement) {
    if (descriptionElement && descriptionElement.id) {
      node.setAttribute('aria-describedby', descriptionElement.id);
    }
  }

  /**
   * Announce message to screen readers
   */
  announce(message, priority = 'polite') {
    if (!this.options.enableAnnouncements || this.destroyed) return;
    
    // Clear existing timeouts
    if (this.announceTimeout) {
      clearTimeout(this.announceTimeout);
    }
    if (this.clearTimeout) {
      clearTimeout(this.clearTimeout);
    }
    
    // Set priority
    this.announcer.setAttribute('aria-live', priority);
    
    // Announce after delay to ensure it's picked up
    this.announceTimeout = setTimeout(() => {
      this.announcer.textContent = message;
      
      // Clear after delay
      this.clearTimeout = setTimeout(() => {
        this.announcer.textContent = '';
      }, this.options.clearDelay);
    }, this.options.announceDelay);
  }

  /**
   * Format node announcement
   */
  formatNodeAnnouncement(nodeData) {
    const parts = [];
    
    parts.push(nodeData.title || 'Unnamed item');
    
    if (nodeData.level) {
      parts.push(`level ${nodeData.level}`);
    }
    
    if (nodeData.hasChildren) {
      parts.push(nodeData.expanded ? 'expanded' : 'collapsed');
      if (nodeData.childCount) {
        parts.push(`${nodeData.childCount} items`);
      }
    }
    
    if (nodeData.selected) {
      parts.push('selected');
    }
    
    return parts.join(', ');
  }

  /**
   * Announce navigation
   */
  announceNavigation(direction, context) {
    const parts = [];
    
    if (context.currentNode) {
      parts.push(context.currentNode);
    }
    
    if (context.currentLevel) {
      parts.push(`level ${context.currentLevel}`);
    }
    
    if (context.parentNode) {
      parts.push(`in ${context.parentNode}`);
    }
    
    this.announce(parts.join(', '));
  }

  /**
   * Set focus to node
   */
  setFocus(node) {
    if (this.destroyed || !node) return;
    
    // Update tabindex
    if (this.currentFocus) {
      this.currentFocus.setAttribute('tabindex', '-1');
    }
    
    node.setAttribute('tabindex', '0');
    node.focus();
    
    this.currentFocus = node;
    this.focusHistory.push(node);
    
    // Limit history size
    if (this.focusHistory.length > 10) {
      this.focusHistory.shift();
    }
  }

  /**
   * Get current focus
   */
  getCurrentFocus() {
    return this.currentFocus;
  }

  /**
   * Save focus state
   */
  saveFocusState() {
    this.savedFocusState = this.currentFocus;
  }

  /**
   * Restore focus state
   */
  restoreFocusState() {
    if (this.savedFocusState && this.savedFocusState.isConnected) {
      this.setFocus(this.savedFocusState);
    }
  }

  /**
   * Enable focus trap
   */
  enableFocusTrap() {
    this.focusTrapEnabled = true;
  }

  /**
   * Disable focus trap
   */
  disableFocusTrap() {
    this.focusTrapEnabled = false;
  }

  /**
   * Handle focus trap
   */
  handleFocusTrap(event) {
    if (!this.focusTrapEnabled || !event.key === 'Tab') return;
    
    const focusables = this._getFocusableElements();
    if (focusables.length === 0) return;
    
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Get next focusable element
   */
  getNextFocusable(current) {
    const focusables = this._getFocusableElements();
    const currentIndex = focusables.indexOf(current);
    
    if (currentIndex === -1 || currentIndex === focusables.length - 1) {
      return focusables[0];
    }
    
    return focusables[currentIndex + 1];
  }

  /**
   * Get previous focusable element
   */
  getPreviousFocusable(current) {
    const focusables = this._getFocusableElements();
    const currentIndex = focusables.indexOf(current);
    
    if (currentIndex === -1 || currentIndex === 0) {
      return focusables[focusables.length - 1];
    }
    
    return focusables[currentIndex - 1];
  }

  /**
   * Get focusable elements
   * @private
   */
  _getFocusableElements() {
    if (!this.container) return [];
    
    const selector = '[role="treeitem"]:not([aria-disabled="true"])';
    return Array.from(this.container.querySelectorAll(selector))
      .filter(el => {
        const tabindex = el.getAttribute('tabindex');
        return tabindex === null || parseInt(tabindex) >= 0;
      });
  }

  /**
   * Handle keydown
   * @private
   */
  _handleKeyDown(event) {
    if (this.focusTrapEnabled) {
      this.handleFocusTrap(event);
    }
  }

  /**
   * Handle focus in
   * @private
   */
  _handleFocusIn(event) {
    const treeItem = event.target.closest('[role="treeitem"]');
    if (treeItem) {
      this.currentFocus = treeItem;
    }
  }

  /**
   * Handle focus out
   * @private
   */
  _handleFocusOut(event) {
    // Handle focus leaving the tree
    if (!this.container.contains(event.relatedTarget)) {
      // Focus has left the tree
    }
  }

  /**
   * Get navigation instructions
   */
  getNavigationInstructions() {
    return `Use arrow keys to navigate. Right arrow to expand, left arrow to collapse. 
            Enter or Space to select. Home for first item, End for last item.`;
  }

  /**
   * Get keyboard shortcuts
   */
  getKeyboardShortcuts() {
    return {
      'ArrowUp': 'Move to previous item',
      'ArrowDown': 'Move to next item',
      'ArrowLeft': 'Collapse item or move to parent',
      'ArrowRight': 'Expand item or move to first child',
      'Enter': 'Select/activate item',
      'Space': 'Toggle selection',
      'Home': 'Move to first item',
      'End': 'Move to last item',
      'PageUp': 'Move up multiple items',
      'PageDown': 'Move down multiple items',
      'Ctrl+A': 'Select all',
      'Ctrl+Shift+E': 'Expand all',
      'Ctrl+Shift+C': 'Collapse all',
      'Escape': 'Clear selection or cancel operation'
    };
  }

  /**
   * Get contextual help
   */
  getContextualHelp(context) {
    const helps = [];
    
    if (context.nodeType === 'folder' && !context.expanded && context.hasChildren) {
      helps.push('Press Enter or Right arrow to expand this folder');
    }
    
    if (context.expanded) {
      helps.push('Press Left arrow to collapse');
    }
    
    if (context.selectable) {
      helps.push('Press Space to toggle selection');
    }
    
    return helps.join('. ');
  }

  /**
   * Check if screen reader is active
   */
  isScreenReaderActive() {
    // This is a heuristic - no perfect way to detect screen readers
    return !!(
      window.navigator.userAgent.match(/NVDA|JAWS|VoiceOver|TalkBack/i) ||
      document.body.getAttribute('aria-hidden') === 'false'
    );
  }

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotion() {
    if (window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  /**
   * Check if high contrast mode is active
   */
  isHighContrastMode() {
    if (window.matchMedia) {
      return window.matchMedia('(prefers-contrast: high)').matches;
    }
    
    // Fallback detection
    const testElement = document.createElement('div');
    testElement.style.backgroundColor = 'rgb(128, 128, 128)';
    document.body.appendChild(testElement);
    const computed = window.getComputedStyle(testElement).backgroundColor;
    document.body.removeChild(testElement);
    
    return computed !== 'rgb(128, 128, 128)';
  }

  /**
   * Apply high contrast mode
   */
  applyHighContrastMode(enabled) {
    this.highContrastEnabled = enabled;
    
    if (this.container) {
      if (enabled) {
        this.container.classList.add('high-contrast');
        this.container.setAttribute('data-high-contrast', 'true');
      } else {
        this.container.classList.remove('high-contrast');
        this.container.removeAttribute('data-high-contrast');
      }
    }
  }

  /**
   * Get high contrast colors
   */
  getHighContrastColors() {
    return {
      foreground: 'WindowText',
      background: 'Window',
      border: 'WindowText',
      focus: 'Highlight',
      selected: 'Highlight',
      selectedText: 'HighlightText'
    };
  }

  /**
   * Create status region
   */
  createStatusRegion() {
    const status = document.createElement('div');
    status.className = 'tree-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-relevant', 'additions text');
    return status;
  }

  /**
   * Update status
   */
  updateStatus(message) {
    const status = this.container?.querySelector('[role="status"]');
    if (status) {
      status.textContent = message;
    }
  }

  /**
   * Create alert region
   */
  createAlertRegion() {
    const alert = document.createElement('div');
    alert.className = 'tree-alert';
    alert.setAttribute('role', 'alert');
    alert.setAttribute('aria-live', 'assertive');
    return alert;
  }

  /**
   * Show alert
   */
  showAlert(message) {
    const alert = this.container?.querySelector('[role="alert"]');
    if (alert) {
      alert.textContent = message;
      
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        alert.textContent = '';
      }, 3000);
    }
  }

  /**
   * Enhance search input
   */
  enhanceSearchInput(input) {
    input.setAttribute('role', 'searchbox');
    input.setAttribute('aria-label', 'Search tree items');
    
    // Create description
    const desc = document.createElement('span');
    desc.id = `search-desc-${Date.now()}`;
    desc.className = 'sr-only';
    desc.textContent = 'Type to search tree items. Results will be announced.';
    
    input.parentNode?.appendChild(desc);
    input.setAttribute('aria-describedby', desc.id);
    
    if (this.container) {
      input.setAttribute('aria-controls', this.container.id);
    }
  }

  /**
   * Announce search results
   */
  announceSearchResults(input, results) {
    const message = results.resultCount === 0
      ? `No results found for "${results.query}"`
      : `${results.resultCount} results found for "${results.query}". Showing result ${results.currentIndex + 1}`;
    
    this.announce(message);
    
    // Update description
    const descId = input.getAttribute('aria-describedby');
    const desc = document.getElementById(descId);
    if (desc) {
      desc.textContent = message;
    }
  }

  /**
   * Enhance filter group
   */
  enhanceFilterGroup(group, label) {
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
  }

  /**
   * Enhance touch target
   */
  enhanceTouchTarget(element) {
    const styles = window.getComputedStyle(element);
    const width = parseInt(styles.width);
    const height = parseInt(styles.height);
    
    if (width < 44) {
      element.style.minWidth = '44px';
    }
    if (height < 44) {
      element.style.minHeight = '44px';
    }
    
    element.style.cursor = 'pointer';
  }

  /**
   * Enable touch exploration
   */
  enableTouchExploration(node) {
    node.addEventListener('touchstart', (event) => {
      event.preventDefault();
      node.setAttribute('data-touch-explored', 'true');
      
      // Announce node
      const label = node.getAttribute('aria-label') || node.textContent;
      this.announce(label);
    });
  }

  /**
   * Set reading order
   */
  setReadingOrder(nodes) {
    nodes.forEach((node, index) => {
      if (!node.id) {
        node.id = `tree-node-${Date.now()}-${index}`;
      }
      
      if (index < nodes.length - 1) {
        node.setAttribute('aria-flowto', nodes[index + 1].id);
      }
    });
  }

  /**
   * Set nested reading order
   */
  setNestedReadingOrder(parent) {
    const children = Array.from(parent.children);
    this.setReadingOrder(children);
  }

  /**
   * Create navigation landmark
   */
  createNavigationLandmark(label) {
    const nav = document.createElement('nav');
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', label);
    return nav;
  }

  /**
   * Create main landmark
   */
  createMainLandmark(label) {
    const main = document.createElement('main');
    main.setAttribute('role', 'main');
    main.setAttribute('aria-label', label);
    return main;
  }

  /**
   * Create toolbar landmark
   */
  createToolbarLandmark(label) {
    const toolbar = document.createElement('div');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', label);
    toolbar.setAttribute('aria-orientation', 'horizontal');
    return toolbar;
  }

  /**
   * Announce error
   */
  announceError(message) {
    // Set priority first
    this.announcer.setAttribute('aria-live', 'assertive');
    
    // Clear existing timeouts
    if (this.announceTimeout) {
      clearTimeout(this.announceTimeout);
    }
    if (this.clearTimeout) {
      clearTimeout(this.clearTimeout);
    }
    
    // Announce immediately for errors
    this.announcer.textContent = `Error: ${message}`;
  }

  /**
   * Get error recovery instructions
   */
  getErrorRecoveryInstructions(errorData) {
    const instructions = [];
    
    if (errorData.type === 'network') {
      instructions.push('Please check your internet connection and try again');
    }
    
    if (errorData.recoverable) {
      instructions.push('Press Enter to retry or Escape to cancel');
    }
    
    instructions.push('Press F5 to refresh the entire tree');
    
    return instructions.join('. ');
  }

  /**
   * Get accessibility preferences
   */
  getAccessibilityPreferences() {
    return {
      announcements: this.options.enableAnnouncements,
      animations: !this.prefersReducedMotion(),
      highContrast: this.highContrastEnabled,
      fontSize: 'normal',
      focusIndicator: true,
      keyboardShortcuts: true
    };
  }

  /**
   * Apply accessibility preferences
   */
  applyAccessibilityPreferences(prefs) {
    if (prefs.announcements !== undefined) {
      this.options.enableAnnouncements = prefs.announcements;
    }
    
    if (prefs.animations !== undefined && this.container) {
      this.container.classList.toggle('no-animations', !prefs.animations);
    }
    
    if (prefs.highContrast !== undefined) {
      this.applyHighContrastMode(prefs.highContrast);
    }
    
    if (prefs.fontSize && this.container) {
      this.container.classList.remove('font-size-small', 'font-size-normal', 'font-size-large');
      this.container.classList.add(`font-size-${prefs.fontSize}`);
    }
  }

  /**
   * Build accessibility tree
   */
  buildAccessibilityTree(treeData) {
    const nodeMap = new Map();
    const rootNodes = [];
    
    // First pass: create node map
    treeData.nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        children: []
      });
    });
    
    // Second pass: build hierarchy
    treeData.nodes.forEach(node => {
      const mappedNode = nodeMap.get(node.id);
      
      if (node.parent) {
        const parent = nodeMap.get(node.parent);
        if (parent) {
          parent.children.push(mappedNode);
        }
      } else {
        rootNodes.push(mappedNode);
      }
    });
    
    // Create flat list for screen readers
    const flatList = [];
    const addToFlatList = (node, level = 1) => {
      flatList.push({ ...node, level });
      node.children.forEach(child => addToFlatList(child, level + 1));
    };
    
    rootNodes.forEach(root => addToFlatList(root));
    
    return {
      root: rootNodes[0],
      roots: rootNodes,
      flatList,
      nodeMap
    };
  }

  /**
   * Generate accessibility report
   */
  generateAccessibilityReport() {
    const issues = [];
    const recommendations = [];
    
    // Check for missing labels
    if (this.container) {
      const unlabeled = this.container.querySelectorAll(
        '[role="treeitem"]:not([aria-label]):empty'
      );
      if (unlabeled.length > 0) {
        issues.push(`${unlabeled.length} tree items without accessible labels`);
        recommendations.push('Add aria-label or text content to all tree items');
      }
    }
    
    // Check focus management
    const focusables = this._getFocusableElements();
    if (focusables.length === 0) {
      issues.push('No focusable tree items found');
      recommendations.push('Ensure at least one tree item has tabindex="0"');
    }
    
    return {
      compliance: issues.length === 0 ? 'Pass' : 'Fail',
      wcagLevel: 'AA',
      issues,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Destroy
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Clear timeouts
    if (this.announceTimeout) {
      clearTimeout(this.announceTimeout);
    }
    if (this.clearTimeout) {
      clearTimeout(this.clearTimeout);
    }
    
    // Remove event listeners
    if (this.container) {
      this.container.removeEventListener('keydown', this._handleKeyDown);
      this.container.removeEventListener('focusin', this._handleFocusIn);
      this.container.removeEventListener('focusout', this._handleFocusOut);
    }
    
    // Remove announcer if we created it
    if (this.announcer && this.announcer.parentNode && 
        this.announcer.className.includes('tree-scribe-announcer')) {
      this.announcer.parentNode.removeChild(this.announcer);
    }
    
    // Clear references
    this.container = null;
    this.announcer = null;
    this.currentFocus = null;
    this.focusHistory = [];
    this.savedFocusState = null;
  }
}