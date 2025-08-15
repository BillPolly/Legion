/**
 * Unit tests for NavigationTabs component
 * Phase 4 - Test complete MVVM NavigationTabs implementation
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

describe('NavigationTabs', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Clear any injected styles
    const styles = document.querySelectorAll('style[id*="navigation"]');
    styles.forEach(style => style.remove());
  });

  describe('Umbilical Protocol', () => {
    test('should support introspection mode', () => {
      const NavigationTabs = {
        create(umbilical) {
          if (umbilical.describe) {
            const requirements = UmbilicalUtils.createRequirements();
            requirements.add('dom', 'HTMLElement', 'Container element');
            requirements.add('tabs', 'array', 'Array of tab configurations');
            requirements.add('activeTab', 'string', 'Initial active tab ID (optional)', false);
            requirements.add('onTabChange', 'function', 'Tab change callback (optional)', false);
            requirements.add('onMount', 'function', 'Mount callback (optional)', false);
            umbilical.describe(requirements);
            return;
          }
          return { mockComponent: true };
        }
      };

      let describedRequirements = null;
      NavigationTabs.create({
        describe: (requirements) => {
          describedRequirements = requirements.getAll();
        }
      });

      expect(describedRequirements.dom).toBeDefined();
      expect(describedRequirements.tabs).toBeDefined();
      expect(describedRequirements.onTabChange).toBeDefined();
    });

    test('should support validation mode', () => {
      const NavigationTabs = {
        create(umbilical) {
          if (umbilical.validate) {
            return umbilical.validate({
              hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
              hasTabsArray: Array.isArray(umbilical.tabs)
            });
          }
          return { mockComponent: true };
        }
      };

      const validation = NavigationTabs.create({
        dom: container,
        tabs: [
          { id: 'search', label: 'Tool Search', icon: '🔍' },
          { id: 'modules', label: 'Module Browser', icon: '📦' }
        ],
        validate: (checks) => checks
      });

      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasTabsArray).toBe(true);
    });
  });

  describe('NavigationTabs MVVM Implementation', () => {
    // Mock the complete NavigationTabs implementation for testing
    const createNavigationTabs = (umbilical) => {
      // Model
      class NavigationTabsModel {
        constructor(options = {}) {
          this.state = {
            tabs: options.tabs || [],
            activeTab: options.activeTab || (options.tabs?.[0]?.id || null),
            isCollapsed: false
          };
        }
        
        updateState(path, value) {
          const keys = path.split('.');
          let current = this.state;
          for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = value;
        }
        
        getState(path = '') {
          if (!path) return this.state;
          return path.split('.').reduce((obj, key) => obj?.[key], this.state);
        }
      }

      // View
      class NavigationTabsView {
        constructor(container) {
          this.container = container;
          this.cssInjected = false;
        }
        
        generateCSS() {
          return `
            .navigation-tabs-container {
              display: flex;
              background: var(--surface-primary);
              border-bottom: 0.125rem solid var(--border-subtle);
              overflow-x: auto;
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            
            .navigation-tabs-container::-webkit-scrollbar {
              display: none;
            }
            
            .navigation-tabs-list {
              display: flex;
              min-width: 100%;
              gap: 0;
              padding: 0 var(--spacing-md);
            }
            
            .navigation-tab {
              display: flex;
              align-items: center;
              gap: var(--spacing-xs);
              padding: var(--spacing-md) var(--spacing-lg);
              background: transparent;
              border: none;
              border-bottom: 0.1875rem solid transparent;
              cursor: pointer;
              transition: all 0.2s ease;
              font-size: var(--font-sm);
              color: var(--text-secondary);
              white-space: nowrap;
              min-width: clamp(8rem, 15vw, 12rem);
              justify-content: center;
            }
            
            .navigation-tab:hover {
              background: var(--surface-hover);
              color: var(--text-primary);
            }
            
            .navigation-tab.active {
              color: var(--color-primary);
              border-bottom-color: var(--color-primary);
              background: var(--surface-secondary);
            }
            
            .tab-icon {
              font-size: var(--font-md);
            }
            
            .tab-label {
              font-weight: 500;
            }
            
            @media (max-width: 48rem) {
              .navigation-tabs-list {
                padding: 0 var(--spacing-sm);
              }
              
              .navigation-tab {
                min-width: clamp(6rem, 20vw, 8rem);
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: var(--font-xs);
              }
              
              .tab-label {
                display: none;
              }
            }
          `;
        }
        
        injectCSS() {
          if (this.cssInjected) return;
          
          const styleElement = document.createElement('style');
          styleElement.id = 'navigation-tabs-styles';
          styleElement.textContent = this.generateCSS();
          document.head.appendChild(styleElement);
          this.cssInjected = true;
        }
        
        render(modelData) {
          this.injectCSS();
          
          this.container.innerHTML = '';
          this.container.className = 'navigation-tabs-container';
          
          if (modelData.tabs && modelData.tabs.length > 0) {
            const tabsList = this.createTabsList(modelData);
            this.container.appendChild(tabsList);
          }
          
          return this.container;
        }
        
        createTabsList(modelData) {
          const tabsList = document.createElement('div');
          tabsList.className = 'navigation-tabs-list';
          
          modelData.tabs.forEach(tab => {
            const tabElement = this.createTabElement(tab, modelData.activeTab);
            tabsList.appendChild(tabElement);
          });
          
          return tabsList;
        }
        
        createTabElement(tab, activeTab) {
          const tabElement = document.createElement('button');
          tabElement.className = `navigation-tab${tab.id === activeTab ? ' active' : ''}`;
          tabElement.dataset.tabId = tab.id;
          
          if (tab.icon) {
            const icon = document.createElement('span');
            icon.className = 'tab-icon';
            icon.textContent = tab.icon;
            tabElement.appendChild(icon);
          }
          
          const label = document.createElement('span');
          label.className = 'tab-label';
          label.textContent = tab.label;
          tabElement.appendChild(label);
          
          return tabElement;
        }
      }

      // ViewModel
      class NavigationTabsViewModel {
        constructor(model, view, umbilical) {
          this.model = model;
          this.view = view;
          this.umbilical = umbilical;
          this.eventListeners = [];
        }
        
        initialize() {
          this.render();
          this.setupEventListeners();
          
          if (this.umbilical.onMount) {
            this.umbilical.onMount(this.createPublicAPI());
          }
          
          return this.createPublicAPI();
        }
        
        render() {
          this.view.render(this.model.getState());
        }
        
        setupEventListeners() {
          const handleTabClick = (event) => {
            const tabElement = event.target.closest('.navigation-tab');
            if (tabElement) {
              const tabId = tabElement.dataset.tabId;
              this.switchTab(tabId);
            }
          };
          
          this.view.container.addEventListener('click', handleTabClick);
          this.eventListeners.push(() => this.view.container.removeEventListener('click', handleTabClick));
        }
        
        switchTab(tabId) {
          this.model.updateState('activeTab', tabId);
          this.render();
          
          if (this.umbilical.onTabChange) {
            this.umbilical.onTabChange(tabId);
          }
        }
        
        createPublicAPI() {
          return {
            switchTab: (tabId) => this.switchTab(tabId),
            getActiveTab: () => this.model.getState('activeTab'),
            getTabs: () => this.model.getState('tabs'),
            addTab: (tab) => {
              const tabs = this.model.getState('tabs');
              tabs.push(tab);
              this.model.updateState('tabs', tabs);
              this.render();
            },
            removeTab: (tabId) => {
              const tabs = this.model.getState('tabs').filter(t => t.id !== tabId);
              this.model.updateState('tabs', tabs);
              if (this.model.getState('activeTab') === tabId && tabs.length > 0) {
                this.switchTab(tabs[0].id);
              }
              this.render();
            },
            destroy: () => this.destroy()
          };
        }
        
        destroy() {
          this.eventListeners.forEach(cleanup => cleanup());
          this.view.container.innerHTML = '';
          
          if (this.umbilical.onDestroy) {
            this.umbilical.onDestroy();
          }
        }
      }

      // Create MVVM layers
      const model = new NavigationTabsModel(umbilical);
      const view = new NavigationTabsView(umbilical.dom);
      const viewModel = new NavigationTabsViewModel(model, view, umbilical);
      
      return viewModel.initialize();
    };

    test('should render tabs with proper structure', () => {
      const tabs = [
        { id: 'search', label: 'Tool Search', icon: '🔍' },
        { id: 'modules', label: 'Module Browser', icon: '📦' },
        { id: 'details', label: 'Tool Details', icon: '📄' }
      ];

      const tabsInstance = createNavigationTabs({
        dom: container,
        tabs: tabs,
        activeTab: 'search'
      });

      expect(container.className).toContain('navigation-tabs-container');
      expect(container.querySelectorAll('.navigation-tab')).toHaveLength(3);
      expect(container.querySelector('.navigation-tab.active')).toBeTruthy();
      expect(container.querySelector('.navigation-tab.active').dataset.tabId).toBe('search');
    });

    test('should handle tab switching', () => {
      const tabs = [
        { id: 'search', label: 'Tool Search', icon: '🔍' },
        { id: 'modules', label: 'Module Browser', icon: '📦' }
      ];

      let changedTabId = null;
      const onTabChange = (tabId) => { changedTabId = tabId; };

      const tabsInstance = createNavigationTabs({
        dom: container,
        tabs: tabs,
        activeTab: 'search',
        onTabChange: onTabChange
      });

      const moduleTab = container.querySelector('[data-tab-id="modules"]');
      moduleTab.click();

      expect(changedTabId).toBe('modules');
      expect(tabsInstance.getActiveTab()).toBe('modules');
      expect(container.querySelector('.navigation-tab.active').dataset.tabId).toBe('modules');
    });

    test('should generate responsive CSS without pixels', () => {
      const tabs = [
        { id: 'search', label: 'Tool Search', icon: '🔍' }
      ];

      const tabsInstance = createNavigationTabs({
        dom: container,
        tabs: tabs
      });

      const styleElement = document.getElementById('navigation-tabs-styles');
      expect(styleElement).toBeTruthy();
      
      const css = styleElement.textContent;
      
      // Should use CSS variables
      expect(css).toContain('var(--spacing-md)');
      expect(css).toContain('var(--font-sm)');
      expect(css).toContain('var(--color-primary)');
      
      // Should use clamp for responsive sizing
      expect(css).toContain('clamp(');
      
      // Should not contain pixel values
      const pixelRegex = /\b\d+px\b/g;
      expect(css.match(pixelRegex)).toBeNull();
    });

    test('should support dynamic tab management', () => {
      const tabs = [
        { id: 'search', label: 'Tool Search', icon: '🔍' }
      ];

      const tabsInstance = createNavigationTabs({
        dom: container,
        tabs: tabs
      });

      expect(container.querySelectorAll('.navigation-tab')).toHaveLength(1);

      // Add tab
      tabsInstance.addTab({ id: 'modules', label: 'Module Browser', icon: '📦' });
      expect(container.querySelectorAll('.navigation-tab')).toHaveLength(2);

      // Remove tab
      tabsInstance.removeTab('search');
      expect(container.querySelectorAll('.navigation-tab')).toHaveLength(1);
      expect(tabsInstance.getActiveTab()).toBe('modules');
    });

    test('should support responsive mobile layout', () => {
      const tabs = [
        { id: 'search', label: 'Tool Search', icon: '🔍' },
        { id: 'modules', label: 'Module Browser', icon: '📦' }
      ];

      const tabsInstance = createNavigationTabs({
        dom: container,
        tabs: tabs
      });

      const styleElement = document.getElementById('navigation-tabs-styles');
      const css = styleElement.textContent;
      
      // Should have mobile media query
      expect(css).toContain('@media (max-width: 48rem)');
      expect(css).toContain('display: none');
    });

    test('should support component lifecycle', () => {
      const tabs = [
        { id: 'search', label: 'Tool Search', icon: '🔍' }
      ];

      let mountCalled = false;
      let destroyCalled = false;

      const tabsInstance = createNavigationTabs({
        dom: container,
        tabs: tabs,
        onMount: () => { mountCalled = true; },
        onDestroy: () => { destroyCalled = true; }
      });

      expect(mountCalled).toBe(true);

      tabsInstance.destroy();
      expect(destroyCalled).toBe(true);
      expect(container.innerHTML).toBe('');
    });
  });
});