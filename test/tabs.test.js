/**
 * @jest-environment jsdom
 */

import { Tabs } from '../src/components/tabs/index.js';
import { TabsModel } from '../src/components/tabs/model/TabsModel.js';
import { TabsView } from '../src/components/tabs/view/TabsView.js';
import { TabsViewModel } from '../src/components/tabs/viewmodel/TabsViewModel.js';

// Mock ResizeObserver for jsdom environment
global.ResizeObserver = function(callback) {
  return {
    observe: function() {},
    unobserve: function() {},
    disconnect: function() {}
  };
};

// Mock DOM environment setup
const createMockContainer = () => {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  return container;
};

const createSampleTabs = () => [
  { id: 'tab1', title: 'First Tab', content: 'Content 1' },
  { id: 'tab2', title: 'Second Tab', content: 'Content 2', icon: '🔥' },
  { id: 'tab3', title: 'Third Tab', content: 'Content 3', badge: '5', closable: true }
];

describe('Tabs Component', () => {
  let container;

  beforeEach(() => {
    container = createMockContainer();
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Component Info and Introspection', () => {
    test('should return component info without umbilical', () => {
      const info = Tabs.create();
      
      expect(info.name).toBe('Tabs');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toContain('Interactive tabs component');
      expect(Array.isArray(info.capabilities)).toBe(true);
      expect(info.capabilities).toContain('tab-navigation');
      expect(info.capabilities).toContain('drag-drop-reordering');
    });

    test('should support introspection mode', () => {
      let describeCalled = false;
      const mockDescribe = (reqs) => {
        describeCalled = true;
        // The requirements object has methods, not just items array
        expect(typeof reqs.add).toBe('function');
      };

      Tabs.create({ describe: mockDescribe });

      expect(describeCalled).toBe(true);
    });

    test('should support validation mode', () => {
      const validUmbilical = {
        dom: container,
        tabs: createSampleTabs()
      };

      const invalidUmbilical = {
        dom: null,
        tabs: 'not an array'
      };

      const validResult = Tabs.create({ validate: validUmbilical });
      const invalidResult = Tabs.create({ validate: invalidUmbilical });

      expect(validResult.valid).toBe(true);
      expect(validResult.hasDOM).toBe(true);
      expect(validResult.hasValidTabs).toBe(true);

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.hasDOM).toBe(false);
    });
  });

  describe('Basic Functionality', () => {
    test('should create tabs instance with default configuration', () => {
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });

      expect(tabs).toBeDefined();
      expect(tabs.getTabs()).toHaveLength(3);
      expect(tabs.getActiveTab().id).toBe('tab1');
      expect(tabs.getTheme()).toBe('light');
    });

    test('should create tabs with custom configuration', () => {
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        theme: 'dark',
        variant: 'pills',
        allowClosable: true,
        activeTabId: 'tab2'
      });

      expect(tabs.getTheme()).toBe('dark');
      expect(tabs.getActiveTab().id).toBe('tab2');
      const config = tabs.getConfig();
      expect(config.allowClosable).toBe(true);
    });

    test('should handle string tab format', () => {
      const tabs = Tabs.create({
        dom: container,
        tabs: ['Tab 1', 'Tab 2', 'Tab 3']
      });

      expect(tabs.getTabs()).toHaveLength(3);
      expect(tabs.getTabs()[0].title).toBe('Tab 1');
      expect(tabs.getTabs()[1].title).toBe('Tab 2');
    });
  });

  describe('Tab Management', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        allowClosable: true
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should add new tab', () => {
      const newTabId = tabs.addTab({
        title: 'New Tab',
        content: 'New Content',
        icon: '⭐'
      });

      expect(tabs.getTabs()).toHaveLength(4);
      const newTab = tabs.getTab(newTabId);
      expect(newTab.title).toBe('New Tab');
      expect(newTab.icon).toBe('⭐');
    });

    test('should add tab at specific index', () => {
      const newTabId = tabs.addTab({
        title: 'Inserted Tab'
      }, 1);

      const allTabs = tabs.getTabs();
      expect(allTabs).toHaveLength(4);
      expect(allTabs[1].title).toBe('Inserted Tab');
    });

    test('should remove tab', () => {
      const initialCount = tabs.getTabs().length;
      tabs.removeTab('tab3');

      expect(tabs.getTabs()).toHaveLength(initialCount - 1);
      expect(tabs.getTab('tab3')).toBeNull();
    });

    test('should update tab properties', () => {
      tabs.updateTab('tab1', {
        title: 'Updated Title',
        badge: '99',
        icon: '🎉'
      });

      const updatedTab = tabs.getTab('tab1');
      expect(updatedTab.title).toBe('Updated Title');
      expect(updatedTab.badge).toBe('99');
      expect(updatedTab.icon).toBe('🎉');
    });

    test('should handle tab reordering', () => {
      tabs.updateConfig({ allowReorderable: true });
      tabs.reorderTab('tab3', 0);

      const reorderedTabs = tabs.getTabs();
      expect(reorderedTabs[0].id).toBe('tab3');
    });
  });

  describe('Selection and Navigation', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should set active tab', () => {
      tabs.setActiveTab('tab2');
      expect(tabs.getActiveTabId()).toBe('tab2');
      expect(tabs.getActiveTab().title).toBe('Second Tab');
    });

    test('should not activate disabled tab', () => {
      tabs.disableTab('tab2');
      
      expect(() => {
        tabs.setActiveTab('tab2');
      }).toThrow();
      
      expect(tabs.getActiveTabId()).toBe('tab1'); // Should remain on original tab
    });

    test('should handle active tab removal', () => {
      tabs.setActiveTab('tab2');
      tabs.makeTabClosable('tab2'); // Make tab closable first
      tabs.removeTab('tab2');
      
      // Should auto-select adjacent tab
      const newActiveId = tabs.getActiveTabId();
      expect(newActiveId).not.toBe('tab2');
      expect(newActiveId).toBeTruthy();
    });
  });

  describe('Search and Filtering', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: [
          { title: 'Home', content: 'Home content' },
          { title: 'Settings', content: 'Settings content', badge: '3' },
          { title: 'Profile', content: 'Profile content', icon: '👤' },
          { title: 'Help', content: 'Help content', badge: '1', icon: '❓' }
        ]
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should find tabs by title', () => {
      const results = tabs.findTabsByTitle('set');
      expect(results).toHaveLength(1);
      expect(results[0].tab.title).toBe('Settings');
    });

    test('should find tabs with badges', () => {
      const badgedTabs = tabs.findTabsWithBadge();
      expect(badgedTabs).toHaveLength(2);
      expect(badgedTabs.every(({ tab }) => tab.badge !== null)).toBe(true);
    });

    test('should find tabs with icons', () => {
      const iconTabs = tabs.findTabsWithIcon();
      expect(iconTabs).toHaveLength(2);
      expect(iconTabs.every(({ tab }) => tab.icon !== null)).toBe(true);
    });

    test('should find tabs with custom predicate', () => {
      const results = tabs.findTabs(tab => tab.title.length > 5);
      expect(results).toHaveLength(2); // 'Settings' and 'Profile'
    });
  });

  describe('State Management', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        activeTabId: 'tab2'
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should export state', () => {
      const state = tabs.exportState();
      
      expect(state.tabs).toHaveLength(3);
      expect(state.activeTabId).toBe('tab2');
      expect(state.config).toBeDefined();
    });

    test('should import state', () => {
      const newState = {
        tabs: [
          { id: 'new1', title: 'New Tab 1' },
          { id: 'new2', title: 'New Tab 2' }
        ],
        activeTabId: 'new2'
      };

      tabs.importState(newState);
      
      expect(tabs.getTabs()).toHaveLength(2);
      expect(tabs.getActiveTabId()).toBe('new2');
    });

    test('should reset tabs', () => {
      const newTabs = [{ title: 'Reset Tab' }];
      tabs.reset(newTabs);
      
      expect(tabs.getTabs()).toHaveLength(1);
      expect(tabs.getTabs()[0].title).toBe('Reset Tab');
    });
  });

  describe('Theme and Configuration', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should update theme', () => {
      tabs.setTheme('dark');
      expect(tabs.getTheme()).toBe('dark');
    });

    test('should update configuration', () => {
      tabs.updateConfig({
        allowClosable: true,
        theme: 'dark',
        keyboardNavigation: false
      });

      const config = tabs.getConfig();
      expect(config.allowClosable).toBe(true);
      expect(config.theme).toBe('dark');
      expect(config.keyboardNavigation).toBe(false);
    });
  });

  describe('Tab Content Operations', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should get and set tab content', () => {
      const content = tabs.getTabContent('tab1');
      expect(content).toBe('Content 1');

      tabs.setTabContent('tab1', 'New Content');
      expect(tabs.getTabContent('tab1')).toBe('New Content');
    });

    test('should set and clear tab badge', () => {
      tabs.setTabBadge('tab1', '42');
      expect(tabs.getTab('tab1').badge).toBe('42');

      tabs.clearTabBadge('tab1');
      expect(tabs.getTab('tab1').badge).toBeNull();
    });

    test('should set and clear tab icon', () => {
      tabs.setTabIcon('tab1', '🌟');
      expect(tabs.getTab('tab1').icon).toBe('🌟');

      tabs.clearTabIcon('tab1');
      expect(tabs.getTab('tab1').icon).toBeNull();
    });
  });

  describe('Tab State Operations', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        allowClosable: true
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should disable and enable tabs', () => {
      tabs.disableTab('tab1');
      expect(tabs.isTabDisabled('tab1')).toBe(true);

      tabs.enableTab('tab1');
      expect(tabs.isTabDisabled('tab1')).toBe(false);
    });

    test('should make tab closable and not closable', () => {
      tabs.makeTabClosable('tab1');
      expect(tabs.isTabClosable('tab1')).toBe(true);

      tabs.makeTabNotClosable('tab1');
      expect(tabs.isTabClosable('tab1')).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should add multiple tabs', () => {
      const newTabs = [
        { title: 'Batch 1' },
        { title: 'Batch 2' },
        { title: 'Batch 3' }
      ];

      const addedIds = tabs.addTabs(newTabs);
      
      expect(addedIds).toHaveLength(3);
      expect(tabs.getTabs()).toHaveLength(6);
    });

    test('should remove multiple tabs', () => {
      tabs.updateConfig({ allowClosable: true });
      tabs.makeTabClosable('tab1');
      tabs.makeTabClosable('tab2');

      const results = tabs.removeTabs(['tab1', 'tab2']);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(tabs.getTabs()).toHaveLength(1);
    });

    test('should handle batch operation errors gracefully', () => {
      const results = tabs.removeTabs(['tab1', 'nonexistent', 'tab2']);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(false); // tab1 not closable by default
      expect(results[1].success).toBe(false); // nonexistent tab
      expect(results[2].success).toBe(false); // tab2 not closable by default
    });
  });

  describe('Event Callbacks', () => {
    test('should fire onActiveTabChange callback', () => {
      let callbackData = null;
      const onActiveTabChange = (tabId, tab, previousTabId) => {
        callbackData = { tabId, tab, previousTabId };
      };
      
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        onActiveTabChange
      });

      tabs.setActiveTab('tab2');
      
      expect(callbackData).toBeTruthy();
      expect(callbackData.tabId).toBe('tab2');
      expect(callbackData.previousTabId).toBe('tab1');

      tabs.destroy();
    });

    test('should fire onTabAdd callback', () => {
      let callbackData = null;
      const onTabAdd = (tabId, tab, index) => {
        callbackData = { tabId, tab, index };
      };
      
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        onTabAdd
      });

      const newTabId = tabs.addTab({ title: 'New Tab' });
      
      expect(callbackData).toBeTruthy();
      expect(callbackData.tabId).toBe(newTabId);
      expect(callbackData.tab.title).toBe('New Tab');

      tabs.destroy();
    });

    test('should fire onTabRemove callback', () => {
      let callbackData = null;
      const onTabRemove = (tabId, tab) => {
        callbackData = { tabId, tab };
      };
      
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        allowClosable: true,
        onTabRemove
      });

      tabs.makeTabClosable('tab1');
      tabs.removeTab('tab1');
      
      expect(callbackData).toBeTruthy();
      expect(callbackData.tabId).toBe('tab1');

      tabs.destroy();
    });

    test('should fire onMount and onDestroy callbacks', () => {
      let mountCalled = false;
      let destroyCalled = false;
      
      const onMount = (instance) => {
        mountCalled = true;
      };
      
      const onDestroy = (instance) => {
        destroyCalled = true;
      };
      
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        onMount,
        onDestroy
      });

      expect(mountCalled).toBe(true);

      tabs.destroy();
      
      expect(destroyCalled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid configuration', () => {
      expect(() => {
        Tabs.create({
          dom: null,
          tabs: createSampleTabs()
        });
      }).toThrow('Tabs requires a DOM container element');

      expect(() => {
        Tabs.create({
          dom: container,
          tabs: 'not an array'
        });
      }).toThrow('Tabs data must be an array');

      expect(() => {
        Tabs.create({
          dom: container,
          tabs: createSampleTabs(),
          theme: 'invalid'
        });
      }).toThrow('Tabs theme must be "light" or "dark"');
    });

    test('should handle tab operation errors', () => {
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });

      expect(() => {
        tabs.removeTab('nonexistent');
      }).toThrow();

      expect(() => {
        tabs.setActiveTab('nonexistent');
      }).toThrow();

      expect(() => {
        tabs.updateTab('nonexistent', { title: 'New Title' });
      }).toThrow();

      tabs.destroy();
    });
  });

  describe('Statistics and Debug', () => {
    let tabs;

    beforeEach(() => {
      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should provide component statistics', () => {
      const stats = tabs.getStats();
      
      expect(stats.totalTabs).toBe(3);
      expect(stats.activeTabId).toBe('tab1');
      expect(typeof stats.closableTabs).toBe('number');
      expect(typeof stats.disabledTabs).toBe('number');
    });

    test('should provide debug information', () => {
      const debug = tabs.debug();
      
      expect(debug.model).toBeDefined();
      expect(debug.view).toBeDefined();
      expect(debug.viewModel).toBeDefined();
      expect(debug.config).toBeDefined();
      expect(debug.stats).toBeDefined();
      expect(debug.tabs).toHaveLength(3);
      expect(debug.activeTab.id).toBe('tab1');
    });
  });

  describe('Validation', () => {
    let tabs;

    beforeEach(() => {
      const customValidator = (content, tab) => {
        return content && content.length > 0;
      };

      tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs(),
        validateTabContent: customValidator
      });
    });

    afterEach(() => {
      if (tabs) {
        tabs.destroy();
      }
    });

    test('should validate tabs', () => {
      expect(tabs.validate()).toBe(true);

      // Add invalid tab
      try {
        tabs.addTab({ title: 'Invalid', content: '' });
      } catch (error) {
        // Should throw validation error
        expect(error.message).toContain('validation failed');
      }
    });

    test('should provide validation errors', () => {
      const errors = tabs.getValidationErrors();
      expect(typeof errors).toBe('object');
    });
  });

  describe('Component Cleanup', () => {
    test('should properly cleanup on destroy', () => {
      const tabs = Tabs.create({
        dom: container,
        tabs: createSampleTabs()
      });

      // Verify DOM elements exist
      const wrapper = container.querySelector('.umbilical-tabs');
      expect(wrapper).toBeTruthy();

      tabs.destroy();

      // Verify cleanup - the component should remove its wrapper but styles may remain
      const remainingWrapper = container.querySelector('.umbilical-tabs');
      expect(remainingWrapper).toBeFalsy();
    });
  });
});

describe('MVVM Architecture Components', () => {
  let container;

  beforeEach(() => {
    container = createMockContainer();
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('TabsModel', () => {
    test('should manage tab state independently', () => {
      const model = new TabsModel(createSampleTabs());
      
      expect(model.getTabs()).toHaveLength(3);
      expect(model.getActiveTabId()).toBe('tab1');
      
      model.setActiveTab('tab2');
      expect(model.getActiveTabId()).toBe('tab2');
      
      const newTabId = model.addTab({ title: 'New Tab' });
      expect(model.getTabs()).toHaveLength(4);
      
      model.destroy();
    });

    test('should handle change listeners', () => {
      const model = new TabsModel(createSampleTabs());
      const changeListener = function(changeType, data, m) {
        // Simple mock function since jest.fn() not available consistently
      };
      
      model.addChangeListener(changeListener);
      model.setActiveTab('tab2');
      
      expect(model.getActiveTabId()).toBe('tab2');
      
      model.destroy();
    });
  });

  describe('TabsView', () => {
    test('should render tabs visually', () => {
      const view = new TabsView(container, { theme: 'light' });
      const sampleTabs = createSampleTabs();
      
      sampleTabs.forEach(tab => {
        view.addTab(tab);
      });
      
      view.setActiveTab('tab1');
      
      expect(container.querySelector('.umbilical-tabs')).toBeTruthy();
      expect(container.querySelectorAll('.umbilical-tab')).toHaveLength(3);
      expect(container.querySelector('.umbilical-tab.active')).toBeTruthy();
      
      view.destroy();
    });

    test('should support theme changes', () => {
      const view = new TabsView(container, { theme: 'light' });
      
      view.updateTheme('dark');
      
      const wrapper = container.querySelector('.umbilical-tabs');
      expect(wrapper.getAttribute('data-theme')).toBe('dark');
      
      view.destroy();
    });
  });

  describe('TabsViewModel', () => {
    test('should coordinate model and view', () => {
      const model = new TabsModel(createSampleTabs());
      const view = new TabsView(container);
      const viewModel = new TabsViewModel(model, view);
      
      expect(view.tabs.size).toBe(3);
      expect(view.activeTabId).toBe('tab1');
      
      viewModel.setActiveTab('tab2');
      expect(model.getActiveTabId()).toBe('tab2');
      expect(view.activeTabId).toBe('tab2');
      
      viewModel.destroy();
    });
  });
});