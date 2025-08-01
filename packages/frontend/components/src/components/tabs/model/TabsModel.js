/**
 * TabsModel - State management and business logic for Tabs component
 * 
 * Handles tab data, selection state, validation, and provides controlled
 * access to tab operations. Maintains immutable state patterns.
 */
import { UmbilicalError } from '../../../umbilical/index.js';

export class TabsModel {
  constructor(initialTabs = [], config = {}) {
    // Configuration
    this.config = {
      allowClosable: config.allowClosable || false,
      allowReorderable: config.allowReorderable || false,
      minTabs: config.minTabs || 1,
      maxTabs: config.maxTabs || Infinity,
      defaultTabOptions: config.defaultTabOptions || {},
      validateTabContent: config.validateTabContent || null,
      ...config
    };

    // State
    this._tabs = [];
    this._activeTabId = null;
    this._nextId = 1;
    this._changeListeners = new Set();
    this._validationErrors = new Map();

    // Initialize with provided tabs
    if (initialTabs.length > 0) {
      this._initializeTabs(initialTabs);
    }
  }

  /**
   * Initialize tabs from provided data
   */
  _initializeTabs(tabsData) {
    this._tabs = tabsData.map((tabData, index) => {
      const tab = this._createTabFromData(tabData, index);
      this._validateTab(tab);
      return tab;
    });

    // Set first tab as active if none specified
    if (this._tabs.length > 0 && !this._activeTabId) {
      this._activeTabId = this._tabs[0].id;
    }
  }

  /**
   * Create a standardized tab object from raw data
   */
  _createTabFromData(tabData, index) {
    // Handle different input formats
    if (typeof tabData === 'string') {
      tabData = { title: tabData };
    }

    const tab = {
      id: tabData.id || `tab-${this._nextId++}`,
      title: tabData.title || `Tab ${index + 1}`,
      content: tabData.content || null,
      disabled: tabData.disabled || false,
      closable: tabData.closable !== undefined ? tabData.closable : this.config.allowClosable,
      icon: tabData.icon || null,
      badge: tabData.badge || null,
      tooltip: tabData.tooltip || null,
      metadata: tabData.metadata || {},
      
      // Merge with default options
      ...this.config.defaultTabOptions,
      ...tabData
    };

    // Ensure ID is unique
    while (this._tabs.some(existingTab => existingTab.id === tab.id)) {
      tab.id = `tab-${this._nextId++}`;
    }

    return tab;
  }

  /**
   * Validate a tab object
   */
  _validateTab(tab) {
    const errors = [];

    if (!tab.title || typeof tab.title !== 'string') {
      errors.push('Tab title must be a non-empty string');
    }

    if (tab.title.length > 100) {
      errors.push('Tab title must be 100 characters or less');
    }

    if (this.config.validateTabContent && tab.content) {
      try {
        const contentValid = this.config.validateTabContent(tab.content, tab);
        if (!contentValid) {
          errors.push('Tab content failed validation');
        }
      } catch (error) {
        errors.push(`Tab content validation error: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      this._validationErrors.set(tab.id, errors);
      throw new UmbilicalError(`Tab validation failed: ${errors.join(', ')}`, 'TabsModel');
    } else {
      this._validationErrors.delete(tab.id);
    }
  }

  /**
   * Notify change listeners
   */
  _notifyChange(changeType, data = {}) {
    this._changeListeners.forEach(listener => {
      try {
        listener(changeType, data, this);
      } catch (error) {
        console.error('Tab change listener error:', error);
      }
    });
  }

  /**
   * Add a change listener
   */
  addChangeListener(listener) {
    if (typeof listener !== 'function') {
      throw new UmbilicalError('Change listener must be a function', 'TabsModel');
    }
    this._changeListeners.add(listener);
  }

  /**
   * Remove a change listener
   */
  removeChangeListener(listener) {
    this._changeListeners.delete(listener);
  }

  /**
   * Get all tabs (immutable copy)
   */
  getTabs() {
    return this._tabs.map(tab => ({ ...tab }));
  }

  /**
   * Get tab by ID
   */
  getTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    return tab ? { ...tab } : null;
  }

  /**
   * Get active tab
   */
  getActiveTab() {
    return this.getTab(this._activeTabId);
  }

  /**
   * Get active tab ID
   */
  getActiveTabId() {
    return this._activeTabId;
  }

  /**
   * Get tab index by ID
   */
  getTabIndex(tabId) {
    return this._tabs.findIndex(t => t.id === tabId);
  }

  /**
   * Set active tab
   */
  setActiveTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) {
      throw new UmbilicalError(`Tab with ID '${tabId}' not found`, 'TabsModel');
    }

    if (tab.disabled) {
      throw new UmbilicalError(`Cannot activate disabled tab '${tabId}'`, 'TabsModel');
    }

    if (this._activeTabId !== tabId) {
      const previousTabId = this._activeTabId;
      this._activeTabId = tabId;
      this._notifyChange('activeTabChanged', {
        previousTabId,
        activeTabId: tabId,
        activeTab: { ...tab }
      });
    }
  }

  /**
   * Add a new tab
   */
  addTab(tabData, index = -1) {
    if (this._tabs.length >= this.config.maxTabs) {
      throw new UmbilicalError(`Cannot add tab: maximum of ${this.config.maxTabs} tabs allowed`, 'TabsModel');
    }

    const tab = this._createTabFromData(tabData, this._tabs.length);
    this._validateTab(tab);

    // Insert at specified index or append
    if (index >= 0 && index < this._tabs.length) {
      this._tabs.splice(index, 0, tab);
    } else {
      this._tabs.push(tab);
      index = this._tabs.length - 1;
    }

    // Set as active if it's the first tab
    if (this._tabs.length === 1) {
      this._activeTabId = tab.id;
    }

    this._notifyChange('tabAdded', {
      tab: { ...tab },
      index,
      totalTabs: this._tabs.length
    });

    return tab.id;
  }

  /**
   * Remove a tab
   */
  removeTab(tabId) {
    const index = this.getTabIndex(tabId);
    if (index === -1) {
      throw new UmbilicalError(`Tab with ID '${tabId}' not found`, 'TabsModel');
    }

    const tab = this._tabs[index];
    if (!tab.closable) {
      throw new UmbilicalError(`Tab '${tabId}' is not closable`, 'TabsModel');
    }

    if (this._tabs.length <= this.config.minTabs) {
      throw new UmbilicalError(`Cannot remove tab: minimum of ${this.config.minTabs} tabs required`, 'TabsModel');
    }

    // Remove the tab
    this._tabs.splice(index, 1);
    this._validationErrors.delete(tabId);

    // Handle active tab change if necessary
    let newActiveTabId = this._activeTabId;
    if (this._activeTabId === tabId) {
      if (this._tabs.length > 0) {
        // Activate adjacent tab (prefer next, then previous)
        const newIndex = Math.min(index, this._tabs.length - 1);
        newActiveTabId = this._tabs[newIndex].id;
        this._activeTabId = newActiveTabId;
      } else {
        this._activeTabId = null;
      }
    }

    this._notifyChange('tabRemoved', {
      removedTab: { ...tab },
      removedIndex: index,
      newActiveTabId,
      totalTabs: this._tabs.length
    });

    return newActiveTabId;
  }

  /**
   * Update tab properties
   */
  updateTab(tabId, updates) {
    const index = this.getTabIndex(tabId);
    if (index === -1) {
      throw new UmbilicalError(`Tab with ID '${tabId}' not found`, 'TabsModel');
    }

    const oldTab = { ...this._tabs[index] };
    const updatedTab = { ...oldTab, ...updates, id: tabId }; // Preserve ID

    this._validateTab(updatedTab);
    this._tabs[index] = updatedTab;

    this._notifyChange('tabUpdated', {
      tabId,
      oldTab,
      updatedTab: { ...updatedTab },
      index
    });

    return { ...updatedTab };
  }

  /**
   * Reorder tabs (for drag & drop)
   */
  reorderTab(tabId, newIndex) {
    if (!this.config.allowReorderable) {
      throw new UmbilicalError('Tab reordering is not enabled', 'TabsModel');
    }

    const oldIndex = this.getTabIndex(tabId);
    if (oldIndex === -1) {
      throw new UmbilicalError(`Tab with ID '${tabId}' not found`, 'TabsModel');
    }

    if (newIndex < 0 || newIndex >= this._tabs.length) {
      throw new UmbilicalError('Invalid target index for tab reordering', 'TabsModel');
    }

    if (oldIndex === newIndex) {
      return; // No change needed
    }

    // Remove tab from old position and insert at new position
    const [tab] = this._tabs.splice(oldIndex, 1);
    this._tabs.splice(newIndex, 0, tab);

    this._notifyChange('tabReordered', {
      tabId,
      oldIndex,
      newIndex,
      tab: { ...tab }
    });
  }

  /**
   * Find tabs matching criteria
   */
  findTabs(predicate) {
    if (typeof predicate !== 'function') {
      throw new UmbilicalError('Find predicate must be a function', 'TabsModel');
    }

    return this._tabs
      .map((tab, index) => ({ tab: { ...tab }, index }))
      .filter(({ tab, index }) => predicate(tab, index));
  }

  /**
   * Get validation errors for a specific tab
   */
  getTabValidationErrors(tabId) {
    return this._validationErrors.get(tabId) || [];
  }

  /**
   * Check if model has any validation errors
   */
  hasValidationErrors() {
    return this._validationErrors.size > 0;
  }

  /**
   * Get all validation errors
   */
  getAllValidationErrors() {
    const allErrors = {};
    this._validationErrors.forEach((errors, tabId) => {
      allErrors[tabId] = [...errors];
    });
    return allErrors;
  }

  /**
   * Get model statistics
   */
  getStats() {
    return {
      totalTabs: this._tabs.length,
      activeTabId: this._activeTabId,
      closableTabs: this._tabs.filter(t => t.closable).length,
      disabledTabs: this._tabs.filter(t => t.disabled).length,
      tabsWithContent: this._tabs.filter(t => t.content !== null).length,
      tabsWithIcons: this._tabs.filter(t => t.icon !== null).length,
      tabsWithBadges: this._tabs.filter(t => t.badge !== null).length,
      validationErrors: this._validationErrors.size,
      changeListeners: this._changeListeners.size
    };
  }

  /**
   * Export current state
   */
  exportState() {
    return {
      tabs: this.getTabs(),
      activeTabId: this._activeTabId,
      config: { ...this.config },
      validationErrors: this.getAllValidationErrors()
    };
  }

  /**
   * Import state (replaces current state)
   */
  importState(state) {
    if (!state || typeof state !== 'object') {
      throw new UmbilicalError('Invalid state object for import', 'TabsModel');
    }

    // Clear current state
    this._tabs = [];
    this._activeTabId = null;
    this._validationErrors.clear();

    // Import configuration if provided
    if (state.config) {
      Object.assign(this.config, state.config);
    }

    // Import tabs
    if (state.tabs && Array.isArray(state.tabs)) {
      this._initializeTabs(state.tabs);
    }

    // Set active tab
    if (state.activeTabId && this._tabs.some(t => t.id === state.activeTabId)) {
      this._activeTabId = state.activeTabId;
    }

    this._notifyChange('stateImported', { importedState: state });
  }

  /**
   * Reset to initial state
   */
  reset(initialTabs = []) {
    this._tabs = [];
    this._activeTabId = null;
    this._validationErrors.clear();
    
    if (initialTabs.length > 0) {
      this._initializeTabs(initialTabs);
    }

    this._notifyChange('reset', { newTabs: this.getTabs() });
  }

  /**
   * Destroy model and cleanup
   */
  destroy() {
    this._changeListeners.clear();
    this._validationErrors.clear();
    this._tabs = [];
    this._activeTabId = null;
  }
}