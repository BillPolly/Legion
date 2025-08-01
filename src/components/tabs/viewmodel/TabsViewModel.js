/**
 * TabsViewModel - Coordination layer between TabsModel and TabsView
 * 
 * Handles user interactions, coordinates model updates with view updates,
 * manages drag & drop, keyboard navigation, and business logic orchestration.
 */

export class TabsViewModel {
  constructor(model, view, config = {}) {
    this.model = model;
    this.view = view;
    this.config = {
      keyboardNavigation: config.keyboardNavigation !== false,
      dragAndDrop: config.dragAndDrop || false,
      autoActivateOnAdd: config.autoActivateOnAdd !== false,
      ...config
    };

    // State
    this.isDestroyed = false;
    this.keyboardFocusedTabId = null;
    this.dragState = {
      isDragging: false,
      draggedTabId: null,
      dragStartX: 0,
      dragStartY: 0,
      dropTarget: null
    };

    // Bind methods to maintain context
    this._handleTabClick = this._handleTabClick.bind(this);
    this._handleTabClose = this._handleTabClose.bind(this);
    this._handleAddClick = this._handleAddClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleModelChange = this._handleModelChange.bind(this);
    this._handleDragStart = this._handleDragStart.bind(this);
    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
    this._handleDragEnd = this._handleDragEnd.bind(this);

    this._initialize();
  }

  /**
   * Initialize the ViewModel
   */
  _initialize() {
    // Listen to model changes
    this.model.addChangeListener(this._handleModelChange);

    // Setup view event listeners
    this._setupViewEventListeners();

    // Setup keyboard navigation
    if (this.config.keyboardNavigation) {
      this._setupKeyboardNavigation();
    }

    // Setup drag and drop
    if (this.config.dragAndDrop) {
      this._setupDragAndDrop();
    }

    // Initial render
    this.render();
  }

  /**
   * Setup view event listeners
   */
  _setupViewEventListeners() {
    const { tabsList, addButton } = this.view.elements;

    // Delegate tab clicks and close button clicks
    this.view.addEventListener(tabsList, 'click', this._handleTabClick);
    
    // Add button click
    if (addButton) {
      this.view.addEventListener(addButton, 'click', this._handleAddClick);
    }

    // Context menu (right-click)
    this.view.addEventListener(tabsList, 'contextmenu', (e) => {
      e.preventDefault();
      const tabElement = e.target.closest('.umbilical-tab');
      if (tabElement) {
        const tabId = tabElement.dataset.tabId;
        this._handleTabContextMenu(tabId, e);
      }
    });
  }

  /**
   * Setup keyboard navigation
   */
  _setupKeyboardNavigation() {
    const { wrapper } = this.view.elements;
    
    // Make wrapper focusable
    wrapper.setAttribute('tabindex', '0');
    
    this.view.addEventListener(wrapper, 'keydown', this._handleKeyDown);
    
    // Focus management
    this.view.addEventListener(wrapper, 'focus', () => {
      if (!this.keyboardFocusedTabId && this.model.getActiveTabId()) {
        this.keyboardFocusedTabId = this.model.getActiveTabId();
        this._updateKeyboardFocus();
      }
    });
  }

  /**
   * Setup drag and drop functionality
   */
  _setupDragAndDrop() {
    const { tabsList } = this.view.elements;

    this.view.addEventListener(tabsList, 'dragstart', this._handleDragStart);
    this.view.addEventListener(tabsList, 'dragover', this._handleDragOver);
    this.view.addEventListener(tabsList, 'drop', this._handleDrop);
    this.view.addEventListener(tabsList, 'dragend', this._handleDragEnd);

    // Make tabs draggable
    this._updateTabsDraggable();
  }

  /**
   * Handle tab click events
   */
  _handleTabClick(e) {
    const tabElement = e.target.closest('.umbilical-tab');
    if (!tabElement) return;

    const tabId = tabElement.dataset.tabId;
    const closeButton = e.target.closest('.umbilical-tab-close');

    if (closeButton) {
      this._handleTabClose(tabId, e);
    } else {
      this._activateTab(tabId);
    }
  }

  /**
   * Handle tab close
   */
  _handleTabClose(tabId, e) {
    e.stopPropagation();
    
    try {
      // Fire onBeforeClose callback if provided
      if (this.config.onBeforeClose) {
        const shouldClose = this.config.onBeforeClose(tabId, this.model.getTab(tabId));
        if (shouldClose === false) {
          return; // Cancel close
        }
      }

      this.model.removeTab(tabId);
      
      // Fire onAfterClose callback if provided
      if (this.config.onAfterClose) {
        this.config.onAfterClose(tabId);
      }
    } catch (error) {
      console.error('Error closing tab:', error);
      if (this.config.onError) {
        this.config.onError('close', error, tabId);
      }
    }
  }

  /**
   * Handle add button click
   */
  _handleAddClick(e) {
    try {
      if (this.config.onAdd) {
        this.config.onAdd(e);
      } else {
        // Default behavior: add a new tab
        const newTabId = this.model.addTab({
          title: `Tab ${this.model.getTabs().length + 1}`,
          content: `Content for tab ${this.model.getTabs().length + 1}`
        });

        if (this.config.autoActivateOnAdd) {
          this.model.setActiveTab(newTabId);
        }
      }
    } catch (error) {
      console.error('Error adding tab:', error);
      if (this.config.onError) {
        this.config.onError('add', error);
      }
    }
  }

  /**
   * Handle keyboard navigation
   */
  _handleKeyDown(e) {
    if (!this.config.keyboardNavigation) return;

    const tabs = this.model.getTabs();
    const activeTabId = this.model.getActiveTabId();
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        this._navigateTab('previous');
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        this._navigateTab('next');
        break;

      case 'Home':
        e.preventDefault();
        if (tabs.length > 0) {
          this._activateTab(tabs[0].id);
        }
        break;

      case 'End':
        e.preventDefault();
        if (tabs.length > 0) {
          this._activateTab(tabs[tabs.length - 1].id);
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const tab = this.model.getActiveTab();
          if (tab && tab.closable) {
            this._handleTabClose(tab.id, e);
          }
        }
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        // Could trigger tab-specific action
        if (this.config.onTabActivate) {
          this.config.onTabActivate(activeTabId, this.model.getTab(activeTabId));
        }
        break;

      case 't':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this._handleAddClick(e);
        }
        break;
    }
  }

  /**
   * Navigate to next/previous tab
   */
  _navigateTab(direction) {
    const tabs = this.model.getTabs().filter(tab => !tab.disabled);
    if (tabs.length === 0) return;

    const activeTabId = this.model.getActiveTabId();
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    
    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1;
    } else {
      newIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    }

    this._activateTab(tabs[newIndex].id);
  }

  /**
   * Handle tab context menu
   */
  _handleTabContextMenu(tabId, e) {
    if (this.config.onContextMenu) {
      this.config.onContextMenu(tabId, this.model.getTab(tabId), e);
    }
  }

  /**
   * Handle drag start
   */
  _handleDragStart(e) {
    if (!this.config.dragAndDrop) return;

    const tabElement = e.target.closest('.umbilical-tab');
    if (!tabElement) return;

    const tabId = tabElement.dataset.tabId;
    
    this.dragState.isDragging = true;
    this.dragState.draggedTabId = tabId;
    this.dragState.dragStartX = e.clientX;
    this.dragState.dragStartY = e.clientY;

    tabElement.classList.add('dragging');
    
    // Set drag data
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';

    if (this.config.onDragStart) {
      this.config.onDragStart(tabId, this.model.getTab(tabId), e);
    }
  }

  /**
   * Handle drag over
   */
  _handleDragOver(e) {
    if (!this.config.dragAndDrop || !this.dragState.isDragging) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const tabElement = e.target.closest('.umbilical-tab');
    if (tabElement && tabElement.dataset.tabId !== this.dragState.draggedTabId) {
      // Remove previous drop target highlighting
      this.view.getTabElements().forEach(el => el.classList.remove('drag-over'));
      
      // Add highlighting to current target
      tabElement.classList.add('drag-over');
      this.dragState.dropTarget = tabElement.dataset.tabId;
    }
  }

  /**
   * Handle drop
   */
  _handleDrop(e) {
    if (!this.config.dragAndDrop || !this.dragState.isDragging) return;

    e.preventDefault();

    const draggedTabId = this.dragState.draggedTabId;
    const dropTargetId = this.dragState.dropTarget;

    if (draggedTabId && dropTargetId && draggedTabId !== dropTargetId) {
      try {
        const targetIndex = this.model.getTabIndex(dropTargetId);
        this.model.reorderTab(draggedTabId, targetIndex);

        if (this.config.onTabReorder) {
          this.config.onTabReorder(draggedTabId, targetIndex);
        }
      } catch (error) {
        console.error('Error reordering tab:', error);
        if (this.config.onError) {
          this.config.onError('reorder', error, draggedTabId);
        }
      }
    }
  }

  /**
   * Handle drag end
   */
  _handleDragEnd(e) {
    if (!this.config.dragAndDrop) return;

    // Clean up drag state
    this.view.getTabElements().forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });

    this.dragState = {
      isDragging: false,
      draggedTabId: null,
      dragStartX: 0,
      dragStartY: 0,
      dropTarget: null
    };

    if (this.config.onDragEnd) {
      this.config.onDragEnd(e);
    }
  }

  /**
   * Handle model changes
   */
  _handleModelChange(changeType, data) {
    if (this.isDestroyed) return;

    switch (changeType) {
      case 'tabAdded':
        this._handleTabAdded(data);
        break;
      
      case 'tabRemoved':
        this._handleTabRemoved(data);
        break;
      
      case 'tabUpdated':
        this._handleTabUpdated(data);
        break;
      
      case 'activeTabChanged':
        this._handleActiveTabChanged(data);
        break;
      
      case 'tabReordered':
        this._handleTabReordered(data);
        break;
      
      case 'stateImported':
      case 'reset':
        this.render();
        break;
    }
  }

  /**
   * Handle tab added
   */
  _handleTabAdded(data) {
    const { tab, index } = data;
    this.view.addTab(tab, index);
    this._updateTabsDraggable();

    // Focus new tab if keyboard navigation is enabled
    if (this.config.keyboardNavigation && this.config.autoActivateOnAdd) {
      this.keyboardFocusedTabId = tab.id;
      this._updateKeyboardFocus();
    }
  }

  /**
   * Handle tab removed
   */
  _handleTabRemoved(data) {
    const { removedTab, newActiveTabId } = data;
    this.view.removeTab(removedTab.id);
    
    // Update keyboard focus if needed
    if (this.keyboardFocusedTabId === removedTab.id) {
      this.keyboardFocusedTabId = newActiveTabId;
      this._updateKeyboardFocus();
    }
  }

  /**
   * Handle tab updated
   */
  _handleTabUpdated(data) {
    const { tabId, updatedTab } = data;
    this.view.updateTab(tabId, updatedTab);
  }

  /**
   * Handle active tab changed
   */
  _handleActiveTabChanged(data) {
    const { activeTabId } = data;
    this.view.setActiveTab(activeTabId);
    
    // Update keyboard focus
    if (this.config.keyboardNavigation) {
      this.keyboardFocusedTabId = activeTabId;
      this._updateKeyboardFocus();
    }

    // Fire callback
    if (this.config.onActiveTabChange) {
      this.config.onActiveTabChange(activeTabId, data.activeTab, data.previousTabId);
    }
  }

  /**
   * Handle tab reordered
   */
  _handleTabReordered(data) {
    // Re-render to update DOM order
    this.render();
  }

  /**
   * Activate a tab
   */
  _activateTab(tabId) {
    try {
      this.model.setActiveTab(tabId);
    } catch (error) {
      console.error('Error activating tab:', error);
      if (this.config.onError) {
        this.config.onError('activate', error, tabId);
      }
    }
  }

  /**
   * Update keyboard focus styling
   */
  _updateKeyboardFocus() {
    if (!this.config.keyboardNavigation) return;

    // Remove focus from all tabs
    this.view.getTabElements().forEach(el => {
      el.classList.remove('keyboard-focused');
    });

    // Add focus to current tab
    if (this.keyboardFocusedTabId) {
      const tabElement = this.view.getTabElement(this.keyboardFocusedTabId);
      if (tabElement) {
        tabElement.classList.add('keyboard-focused');
      }
    }
  }

  /**
   * Update draggable attributes on all tabs
   */
  _updateTabsDraggable() {
    if (!this.config.dragAndDrop) return;

    this.view.getTabElements().forEach(tabElement => {
      tabElement.setAttribute('draggable', 'true');
    });
  }

  /**
   * Full render of all tabs
   */
  render() {
    if (this.isDestroyed) return;

    // Clear current view
    this.view.clear();

    // Render all tabs
    const tabs = this.model.getTabs();
    tabs.forEach((tab) => {
      this.view.addTab(tab);
    });

    // Set active tab
    const activeTabId = this.model.getActiveTabId();
    if (activeTabId) {
      this.view.setActiveTab(activeTabId);
    }

    // Update draggable state
    this._updateTabsDraggable();

    // Update keyboard focus
    this._updateKeyboardFocus();
  }

  /**
   * Public API methods
   */

  /**
   * Add a new tab
   */
  addTab(tabData, index) {
    return this.model.addTab(tabData, index);
  }

  /**
   * Remove a tab
   */
  removeTab(tabId) {
    return this.model.removeTab(tabId);
  }

  /**
   * Update a tab
   */
  updateTab(tabId, updates) {
    return this.model.updateTab(tabId, updates);
  }

  /**
   * Set active tab
   */
  setActiveTab(tabId) {
    return this.model.setActiveTab(tabId);
  }

  /**
   * Get all tabs
   */
  getTabs() {
    return this.model.getTabs();
  }

  /**
   * Get specific tab
   */
  getTab(tabId) {
    return this.model.getTab(tabId);
  }

  /**
   * Get active tab
   */
  getActiveTab() {
    return this.model.getActiveTab();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    
    // Re-setup features that may have changed
    if (newConfig.dragAndDrop !== undefined) {
      if (newConfig.dragAndDrop && !this.config.dragAndDrop) {
        this._setupDragAndDrop();
      }
      this._updateTabsDraggable();
    }
  }

  /**
   * Focus the tabs component
   */
  focus() {
    this.view.elements.wrapper.focus();
  }

  /**
   * Get component statistics
   */
  getStats() {
    return {
      ...this.model.getStats(),
      keyboardFocusedTabId: this.keyboardFocusedTabId,
      isDragging: this.dragState.isDragging
    };
  }

  /**
   * Export current state
   */
  exportState() {
    return this.model.exportState();
  }

  /**
   * Import state
   */
  importState(state) {
    this.model.importState(state);
  }

  /**
   * Destroy the ViewModel
   */
  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // Remove model listeners
    this.model.removeChangeListener(this._handleModelChange);

    // View will handle its own cleanup
    this.model = null;
    this.view = null;
    this.config = null;
    this.keyboardFocusedTabId = null;
    this.dragState = null;
  }
}