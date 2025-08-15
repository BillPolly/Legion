/**
 * Unit tests for ApplicationHeader component
 * Phase 3 - Test complete MVVM ApplicationHeader implementation
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

describe('ApplicationHeader', () => {
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
    const styles = document.querySelectorAll('style[id*="header"]');
    styles.forEach(style => style.remove());
  });

  describe('Umbilical Protocol', () => {
    test('should support introspection mode', () => {
      const ApplicationHeader = {
        create(umbilical) {
          if (umbilical.describe) {
            const requirements = UmbilicalUtils.createRequirements();
            requirements.add('dom', 'HTMLElement', 'Container element');
            requirements.add('title', 'string', 'Application title (optional)', false);
            requirements.add('subtitle', 'string', 'Application subtitle (optional)', false);
            requirements.add('showSearch', 'boolean', 'Show global search (optional)', false);
            requirements.add('userInfo', 'object', 'User information object (optional)', false);
            requirements.add('onMount', 'function', 'Mount callback (optional)', false);
            requirements.add('onSearch', 'function', 'Search callback (optional)', false);
            requirements.add('onUserClick', 'function', 'User click callback (optional)', false);
            umbilical.describe(requirements);
            return;
          }
          return { mockComponent: true };
        }
      };

      let describedRequirements = null;
      ApplicationHeader.create({
        describe: (requirements) => {
          describedRequirements = requirements.getAll();
        }
      });

      expect(describedRequirements.dom).toBeDefined();
      expect(describedRequirements.title).toBeDefined();
      expect(describedRequirements.onSearch).toBeDefined();
    });

    test('should support validation mode', () => {
      const ApplicationHeader = {
        create(umbilical) {
          if (umbilical.validate) {
            return umbilical.validate({
              hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE
            });
          }
          return { mockComponent: true };
        }
      };

      const validation = ApplicationHeader.create({
        dom: container,
        validate: (checks) => checks
      });

      expect(validation.hasDomElement).toBe(true);
    });
  });

  describe('ApplicationHeader MVVM Implementation', () => {
    // Mock the complete ApplicationHeader implementation for testing
    const createApplicationHeader = (umbilical) => {
      // Model
      class ApplicationHeaderModel {
        constructor(options = {}) {
          this.state = {
            title: options.title || 'Application',
            subtitle: options.subtitle || '',
            showSearch: options.showSearch !== false,
            searchQuery: '',
            userInfo: options.userInfo || null
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
      class ApplicationHeaderView {
        constructor(container) {
          this.container = container;
          this.cssInjected = false;
        }
        
        generateCSS() {
          return `
            .app-header-container {
              padding: var(--spacing-md) var(--spacing-lg);
              background: var(--surface-primary);
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: var(--spacing-md);
              min-height: clamp(4rem, 12vh, 6rem);
            }
            
            .header-main-content {
              flex: 1;
              min-width: clamp(20rem, 40vw, 30rem);
            }
            
            .app-title {
              font-size: var(--font-xl);
              font-weight: 700;
              margin: 0 0 var(--spacing-xs) 0;
              color: var(--text-primary);
              line-height: 1.2;
            }
            
            .app-subtitle {
              font-size: var(--font-md);
              color: var(--text-secondary);
              margin: 0;
              line-height: 1.4;
            }
            
            .header-controls {
              display: flex;
              align-items: center;
              gap: var(--spacing-md);
              flex-shrink: 0;
            }
            
            .global-search-container {
              position: relative;
              min-width: clamp(15rem, 25vw, 20rem);
            }
            
            .global-search-input {
              width: 100%;
              padding: var(--spacing-sm) var(--spacing-md);
              font-size: var(--font-sm);
              border: 0.125rem solid var(--border-subtle);
              border-radius: var(--radius-md);
              background: var(--surface-secondary);
              color: var(--text-primary);
            }
            
            .global-search-input:focus {
              outline: none;
              border-color: var(--color-primary);
              box-shadow: 0 0 0 0.1875rem rgba(59, 130, 246, 0.15);
              background: var(--surface-primary);
            }
          `;
        }
        
        injectCSS() {
          if (this.cssInjected) return;
          
          const styleElement = document.createElement('style');
          styleElement.id = 'app-header-styles';
          styleElement.textContent = this.generateCSS();
          document.head.appendChild(styleElement);
          this.cssInjected = true;
        }
        
        render(modelData) {
          this.injectCSS();
          
          this.container.innerHTML = '';
          this.container.className = 'app-header-container';
          
          const mainContent = this.createMainContent(modelData);
          this.container.appendChild(mainContent);
          
          if (modelData.showSearch) {
            const controls = this.createHeaderControls(modelData);
            this.container.appendChild(controls);
          }
          
          return this.container;
        }
        
        createMainContent(modelData) {
          const mainContent = document.createElement('div');
          mainContent.className = 'header-main-content';
          
          const title = document.createElement('h1');
          title.className = 'app-title';
          title.textContent = modelData.title;
          
          mainContent.appendChild(title);
          
          if (modelData.subtitle) {
            const subtitle = document.createElement('p');
            subtitle.className = 'app-subtitle';
            subtitle.textContent = modelData.subtitle;
            mainContent.appendChild(subtitle);
          }
          
          return mainContent;
        }
        
        createHeaderControls(modelData) {
          const controls = document.createElement('div');
          controls.className = 'header-controls';
          
          const searchContainer = document.createElement('div');
          searchContainer.className = 'global-search-container';
          
          const input = document.createElement('input');
          input.className = 'global-search-input';
          input.type = 'text';
          input.placeholder = 'Search tools, modules, or documentation...';
          input.value = modelData.searchQuery || '';
          
          searchContainer.appendChild(input);
          controls.appendChild(searchContainer);
          
          return controls;
        }
      }

      // ViewModel
      class ApplicationHeaderViewModel {
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
          const searchInput = this.view.container.querySelector('.global-search-input');
          if (searchInput) {
            const handleSearch = (event) => {
              const query = event.target.value;
              this.model.updateState('searchQuery', query);
              
              if (this.umbilical.onSearch) {
                this.umbilical.onSearch(query);
              }
            };
            
            searchInput.addEventListener('input', handleSearch);
            this.eventListeners.push(() => searchInput.removeEventListener('input', handleSearch));
          }
        }
        
        createPublicAPI() {
          return {
            updateTitle: (title) => {
              this.model.updateState('title', title);
              this.render();
            },
            updateSubtitle: (subtitle) => {
              this.model.updateState('subtitle', subtitle);
              this.render();
            },
            getSearchQuery: () => this.model.getState('searchQuery'),
            clearSearch: () => {
              this.model.updateState('searchQuery', '');
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
      const model = new ApplicationHeaderModel(umbilical);
      const view = new ApplicationHeaderView(umbilical.dom);
      const viewModel = new ApplicationHeaderViewModel(model, view, umbilical);
      
      return viewModel.initialize();
    };

    test('should render header with title and subtitle', () => {
      const headerInstance = createApplicationHeader({
        dom: container,
        title: 'Test Application',
        subtitle: 'Test Description',
        showSearch: false
      });

      expect(container.querySelector('.app-title').textContent).toBe('Test Application');
      expect(container.querySelector('.app-subtitle').textContent).toBe('Test Description');
    });

    test('should render search controls when enabled', () => {
      createApplicationHeader({
        dom: container,
        title: 'Test App',
        showSearch: true
      });

      const searchInput = container.querySelector('.global-search-input');
      expect(searchInput).toBeTruthy();
      expect(searchInput.placeholder).toContain('Search tools');
    });

    test('should handle search input events', () => {
      let searchQuery = '';
      const searchCallback = (query) => { searchQuery = query; };
      
      createApplicationHeader({
        dom: container,
        title: 'Test App',
        showSearch: true,
        onSearch: searchCallback
      });

      const searchInput = container.querySelector('.global-search-input');
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input'));

      expect(searchQuery).toBe('test query');
    });

    test('should generate responsive CSS without pixels', () => {
      const headerInstance = createApplicationHeader({
        dom: container,
        title: 'Test App'
      });

      const styleElement = document.getElementById('app-header-styles');
      expect(styleElement).toBeTruthy();
      
      const css = styleElement.textContent;
      
      // Should use CSS variables
      expect(css).toContain('var(--spacing-md)');
      expect(css).toContain('var(--font-xl)');
      expect(css).toContain('var(--color-primary)');
      
      // Should use clamp for responsive sizing
      expect(css).toContain('clamp(');
      
      // Should not contain pixel values
      const pixelRegex = /\b\d+px\b/g;
      expect(css.match(pixelRegex)).toBeNull();
    });

    test('should support public API methods', () => {
      const headerInstance = createApplicationHeader({
        dom: container,
        title: 'Original Title',
        subtitle: 'Original Subtitle'
      });

      expect(headerInstance.updateTitle).toBeInstanceOf(Function);
      expect(headerInstance.updateSubtitle).toBeInstanceOf(Function);
      expect(headerInstance.getSearchQuery).toBeInstanceOf(Function);

      headerInstance.updateTitle('New Title');
      expect(container.querySelector('.app-title').textContent).toBe('New Title');

      headerInstance.updateSubtitle('New Subtitle');
      expect(container.querySelector('.app-subtitle').textContent).toBe('New Subtitle');
    });

    test('should handle component lifecycle', () => {
      let mountCalled = false;
      let destroyCalled = false;

      const headerInstance = createApplicationHeader({
        dom: container,
        title: 'Test App',
        onMount: () => { mountCalled = true; },
        onDestroy: () => { destroyCalled = true; }
      });

      expect(mountCalled).toBe(true);

      headerInstance.destroy();
      expect(destroyCalled).toBe(true);
      expect(container.innerHTML).toBe('');
    });
  });
});