/**
 * Tabs Component - Main entry point
 * 
 * A flexible, interactive tabs component that follows the umbilical protocol
 * externally and uses MVVM pattern internally. Supports multiple themes, 
 * drag & drop reordering, keyboard navigation, and extensive customization.
 */
import { UmbilicalUtils, UmbilicalError } from '@legion/components';
import { TabsModel } from './model/TabsModel.js';
import { TabsView } from './view/TabsView.js';
import { TabsViewModel } from './viewmodel/TabsViewModel.js';

export const Tabs = {
  /**
   * Create a Tabs instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical && umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      
      // Required capabilities
      requirements.add('dom', 'HTMLElement', 'DOM container element for the tabs');
      requirements.add('tabs', 'array', 'Array of tab definitions to display');
      
      // Tab structure
      requirements.add('tabs[].title', 'string', 'Tab title text (required)');
      requirements.add('tabs[].id', 'string', 'Unique tab identifier (optional, auto-generated if not provided)');
      requirements.add('tabs[].content', 'string|HTMLElement', 'Tab content (optional)');
      requirements.add('tabs[].disabled', 'boolean', 'Whether tab is disabled (optional, defaults to false)');
      requirements.add('tabs[].closable', 'boolean', 'Whether tab can be closed (optional, defaults to allowClosable config)');
      requirements.add('tabs[].icon', 'string', 'Tab icon HTML (optional)');
      requirements.add('tabs[].badge', 'string|number', 'Tab badge content (optional)');
      requirements.add('tabs[].tooltip', 'string', 'Tab tooltip text (optional)');
      requirements.add('tabs[].metadata', 'object', 'Custom tab metadata (optional)');
      
      // Configuration options
      requirements.add('activeTabId', 'string', 'ID of initially active tab (optional, defaults to first tab)');
      requirements.add('theme', 'string', 'Visual theme: "light" or "dark" (optional, defaults to "light")');
      requirements.add('position', 'string', 'Tab bar position: "top", "bottom", "left", "right" (optional, defaults to "top")');
      requirements.add('variant', 'string', 'Visual style: "default", "pills", "underline", "cards" (optional, defaults to "default")');
      
      // Behavior options
      requirements.add('allowClosable', 'boolean', 'Enable tab closing (optional, defaults to false)');
      requirements.add('allowReorderable', 'boolean', 'Enable drag & drop reordering (optional, defaults to false)');
      requirements.add('keyboardNavigation', 'boolean', 'Enable keyboard navigation (optional, defaults to true)');
      requirements.add('scrollable', 'boolean', 'Enable horizontal scrolling for overflow tabs (optional, defaults to true)');
      requirements.add('showAddButton', 'boolean', 'Show add new tab button (optional, defaults to false)');
      
      // Limits and validation
      requirements.add('minTabs', 'number', 'Minimum number of tabs required (optional, defaults to 1)');
      requirements.add('maxTabs', 'number', 'Maximum number of tabs allowed (optional, defaults to Infinity)');
      requirements.add('validateTabContent', 'function', 'Custom tab content validation function (optional)');
      
      // Visual customization
      requirements.add('animationDuration', 'number', 'Animation duration in milliseconds (optional, defaults to 300)');
      requirements.add('showCloseButtons', 'boolean', 'Show close buttons on closable tabs (optional, defaults to true)');
      
      // Event callbacks
      requirements.add('onActiveTabChange', 'function', 'Callback when active tab changes (optional)');
      requirements.add('onTabAdd', 'function', 'Callback when tab is added (optional)');
      requirements.add('onTabRemove', 'function', 'Callback when tab is removed (optional)');
      requirements.add('onTabUpdate', 'function', 'Callback when tab is updated (optional)');
      requirements.add('onTabReorder', 'function', 'Callback when tab is reordered (optional)');
      requirements.add('onBeforeClose', 'function', 'Callback before tab closes, can prevent closing (optional)');
      requirements.add('onAfterClose', 'function', 'Callback after tab is closed (optional)');
      requirements.add('onAdd', 'function', 'Callback when add button is clicked (optional)');
      requirements.add('onContextMenu', 'function', 'Callback for tab context menu (optional)');
      requirements.add('onError', 'function', 'Callback for error handling (optional)');
      
      // Lifecycle callbacks
      requirements.add('onMount', 'function', 'Callback fired after component is mounted (optional)');
      requirements.add('onDestroy', 'function', 'Callback fired before component is destroyed (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical && umbilical.validate) {
      const testUmbilical = umbilical.validate;
      const hasDOM = !!(testUmbilical.dom && testUmbilical.dom.nodeType === 1);
      const hasTabs = Array.isArray(testUmbilical.tabs);
      const hasValidTabs = hasTabs && testUmbilical.tabs.every(tab => 
        typeof tab === 'object' && tab !== null && 
        (typeof tab === 'string' || typeof tab.title === 'string')
      );
      
      return {
        valid: hasDOM && hasValidTabs,
        hasDOM,
        hasTabs,
        hasValidTabs,
        hasRequiredCapabilities: hasDOM && hasValidTabs
      };
    }

    // No umbilical - return component info
    if (!umbilical) {
      return {
        name: 'Tabs',
        version: '1.0.0',
        description: 'Interactive tabs component with themes, drag & drop, and extensive customization',
        capabilities: [
          'tab-navigation', 'closable-tabs', 'drag-drop-reordering', 'keyboard-navigation',
          'multiple-themes', 'custom-content', 'badge-support', 'icon-support',
          'scroll-overflow', 'context-menus', 'validation', 'state-management'
        ]
      };
    }

    // Instance mode - create actual tabs instance
    const {
      // Required
      dom = null,
      tabs = [],
      
      // Configuration
      activeTabId = null,
      theme = 'light',
      position = 'top',
      variant = 'default',
      
      // Behavior
      allowClosable = false,
      allowReorderable = false,
      keyboardNavigation = true,
      scrollable = true,
      showAddButton = false,
      
      // Limits
      minTabs = 1,
      maxTabs = Infinity,
      validateTabContent = null,
      
      // Visual
      animationDuration = 300,
      showCloseButtons = true,
      
      // Event callbacks
      onActiveTabChange = null,
      onTabAdd = null,
      onTabRemove = null,
      onTabUpdate = null,
      onTabReorder = null,
      onBeforeClose = null,
      onAfterClose = null,
      onAdd = null,
      onContextMenu = null,
      onError = null,
      
      // Lifecycle callbacks
      onMount = null,
      onDestroy = null
    } = umbilical;

    // Validation
    if (!dom) {
      throw new UmbilicalError('Tabs requires a DOM container element', 'Tabs');
    }

    if (!Array.isArray(tabs)) {
      throw new UmbilicalError('Tabs data must be an array', 'Tabs');
    }

    if (!['light', 'dark'].includes(theme)) {
      throw new UmbilicalError('Tabs theme must be "light" or "dark"', 'Tabs');
    }

    if (!['top', 'bottom', 'left', 'right'].includes(position)) {
      throw new UmbilicalError('Tabs position must be "top", "bottom", "left", or "right"', 'Tabs');
    }

    if (!['default', 'pills', 'underline', 'cards'].includes(variant)) {
      throw new UmbilicalError('Tabs variant must be "default", "pills", "underline", or "cards"', 'Tabs');
    }

    if (minTabs < 0 || maxTabs < 1 || minTabs > maxTabs) {
      throw new UmbilicalError('Invalid tabs limits: minTabs and maxTabs must be positive, minTabs <= maxTabs', 'Tabs');
    }

    // Create configuration objects
    const modelConfig = {
      allowClosable,
      allowReorderable,
      minTabs,
      maxTabs,
      validateTabContent
    };

    const viewConfig = {
      theme,
      position,
      variant,
      animationDuration,
      showCloseButtons,
      showAddButton,
      scrollable
    };

    const viewModelConfig = {
      keyboardNavigation,
      dragAndDrop: allowReorderable,
      autoActivateOnAdd: true,
      onActiveTabChange,
      onBeforeClose,
      onAfterClose,
      onAdd,
      onContextMenu,
      onTabReorder,
      onError
    };

    // Create MVVM components
    const model = new TabsModel(tabs, modelConfig);
    const view = new TabsView(dom, viewConfig);
    const viewModel = new TabsViewModel(model, view, viewModelConfig);

    // Set initial active tab
    if (activeTabId) {
      try {
        model.setActiveTab(activeTabId);
      } catch (error) {
        console.warn('Could not set initial active tab:', error.message);
        // Fallback to first tab if available
        const availableTabs = model.getTabs();
        if (availableTabs.length > 0) {
          model.setActiveTab(availableTabs[0].id);
        }
      }
    }

    // Create tabs instance
    const tabsInstance = {
      // Data operations
      getTabs() {
        return viewModel.getTabs();
      },

      getTab(tabId) {
        return viewModel.getTab(tabId);
      },

      addTab(tabData, index) {
        try {
          const tabId = viewModel.addTab(tabData, index);
          
          if (onTabAdd) {
            onTabAdd(tabId, viewModel.getTab(tabId), index);
          }
          
          return tabId;
        } catch (error) {
          if (onError) {
            onError('add', error, tabData);
          }
          throw error;
        }
      },

      removeTab(tabId) {
        try {
          const tab = viewModel.getTab(tabId);
          const result = viewModel.removeTab(tabId);
          
          if (onTabRemove) {
            onTabRemove(tabId, tab);
          }
          
          return result;
        } catch (error) {
          if (onError) {
            onError('remove', error, tabId);
          }
          throw error;
        }
      },

      updateTab(tabId, updates) {
        try {
          const oldTab = viewModel.getTab(tabId);
          const updatedTab = viewModel.updateTab(tabId, updates);
          
          if (onTabUpdate) {
            onTabUpdate(tabId, updatedTab, oldTab);
          }
          
          return updatedTab;
        } catch (error) {
          if (onError) {
            onError('update', error, tabId);
          }
          throw error;
        }
      },

      reorderTab(tabId, newIndex) {
        return model.reorderTab(tabId, newIndex);
      },

      // Selection operations
      getActiveTab() {
        return viewModel.getActiveTab();
      },

      getActiveTabId() {
        return model.getActiveTabId();
      },

      setActiveTab(tabId) {
        return viewModel.setActiveTab(tabId);
      },

      // Search operations
      findTabs(predicate) {
        return model.findTabs(predicate);
      },

      findTabsByTitle(title) {
        return model.findTabs(tab => tab.title.toLowerCase().includes(title.toLowerCase()));
      },

      findTabsWithBadge() {
        return model.findTabs(tab => tab.badge !== null);
      },

      findTabsWithIcon() {
        return model.findTabs(tab => tab.icon !== null);
      },

      // State operations
      exportState() {
        return viewModel.exportState();
      },

      importState(state) {
        viewModel.importState(state);
      },

      reset(newTabs = []) {
        model.reset(newTabs);
      },

      // Configuration
      getConfig() {
        return {
          ...modelConfig,
          ...viewConfig,
          ...viewModelConfig
        };
      },

      updateConfig(newConfig) {
        // Update model config
        if (newConfig.allowClosable !== undefined || 
            newConfig.allowReorderable !== undefined ||
            newConfig.minTabs !== undefined ||
            newConfig.maxTabs !== undefined ||
            newConfig.validateTabContent !== undefined) {
          Object.assign(modelConfig, newConfig);
          Object.assign(model.config, newConfig);
        }

        // Update view config
        if (newConfig.theme !== undefined || 
            newConfig.variant !== undefined ||
            newConfig.position !== undefined ||
            newConfig.animationDuration !== undefined ||
            newConfig.showCloseButtons !== undefined ||
            newConfig.showAddButton !== undefined ||
            newConfig.scrollable !== undefined) {
          view.updateConfig(newConfig);
          Object.assign(viewConfig, newConfig);
        }

        // Update viewmodel config
        viewModel.updateConfig(newConfig);
        Object.assign(viewModelConfig, newConfig);
      },

      // Theme operations
      getTheme() {
        return viewConfig.theme;
      },

      setTheme(newTheme) {
        this.updateConfig({ theme: newTheme });
      },

      // Validation operations
      validate() {
        return !model.hasValidationErrors();
      },

      getValidationErrors() {
        return model.getAllValidationErrors();
      },

      validateTab(tabId) {
        return model.getTabValidationErrors(tabId);
      },

      // Statistics
      getStats() {
        return viewModel.getStats();
      },

      // Focus management
      focus() {
        viewModel.focus();
      },

      // Utility operations
      refresh() {
        viewModel.render();
      },

      // Tab content operations
      getTabContent(tabId) {
        const tab = this.getTab(tabId);
        return tab ? tab.content : null;
      },

      setTabContent(tabId, content) {
        return this.updateTab(tabId, { content });
      },

      // Badge operations
      setTabBadge(tabId, badge) {
        return this.updateTab(tabId, { badge });
      },

      clearTabBadge(tabId) {
        return this.updateTab(tabId, { badge: null });
      },

      // Icon operations
      setTabIcon(tabId, icon) {
        return this.updateTab(tabId, { icon });
      },

      clearTabIcon(tabId) {
        return this.updateTab(tabId, { icon: null });
      },

      // Disable/enable operations
      disableTab(tabId) {
        return this.updateTab(tabId, { disabled: true });
      },

      enableTab(tabId) {
        return this.updateTab(tabId, { disabled: false });
      },

      isTabDisabled(tabId) {
        const tab = this.getTab(tabId);
        return tab ? tab.disabled : false;
      },

      // Closable operations
      makeTabClosable(tabId) {
        return this.updateTab(tabId, { closable: true });
      },

      makeTabNotClosable(tabId) {
        return this.updateTab(tabId, { closable: false });
      },

      isTabClosable(tabId) {
        const tab = this.getTab(tabId);
        return tab ? tab.closable : false;
      },

      // Batch operations
      addTabs(tabsData) {
        const addedIds = [];
        tabsData.forEach((tabData, index) => {
          try {
            const tabId = this.addTab(tabData);
            addedIds.push(tabId);
          } catch (error) {
            console.error(`Failed to add tab at index ${index}:`, error);
          }
        });
        return addedIds;
      },

      removeTabs(tabIds) {
        const results = [];
        tabIds.forEach(tabId => {
          try {
            const result = this.removeTab(tabId);
            results.push({ tabId, success: true, result });
          } catch (error) {
            results.push({ tabId, success: false, error: error.message });
          }
        });
        return results;
      },

      // Development helpers
      debug() {
        return {
          model,
          view,
          viewModel,
          config: this.getConfig(),
          stats: this.getStats(),
          tabs: this.getTabs(),
          activeTab: this.getActiveTab()
        };
      },

      // Cleanup
      destroy() {
        viewModel.destroy();
        view.destroy();
        model.destroy();
        
        if (onDestroy) {
          onDestroy(tabsInstance);
        }
      }
    };

    // Call onMount callback
    if (onMount) {
      onMount(tabsInstance);
    }

    return tabsInstance;
  }
};

// Export individual components for advanced usage
export { TabsModel } from './model/TabsModel.js';
export { TabsView } from './view/TabsView.js';
export { TabsViewModel } from './viewmodel/TabsViewModel.js';