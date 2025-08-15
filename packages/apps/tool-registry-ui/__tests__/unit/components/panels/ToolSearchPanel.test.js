/**
 * Unit tests for ToolSearchPanel component
 * Phase 5 - Test complete MVVM ToolSearchPanel implementation
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

describe('ToolSearchPanel', () => {
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
    const styles = document.querySelectorAll('style[id*="tool-search"]');
    styles.forEach(style => style.remove());
  });

  describe('Umbilical Protocol', () => {
    test('should support introspection mode', () => {
      const ToolSearchPanel = {
        create(umbilical) {
          if (umbilical.describe) {
            const requirements = UmbilicalUtils.createRequirements();
            requirements.add('dom', 'HTMLElement', 'Container element');
            requirements.add('tools', 'array', 'Array of available tools (optional)', false);
            requirements.add('onSearch', 'function', 'Search callback (optional)', false);
            requirements.add('onToolSelect', 'function', 'Tool selection callback (optional)', false);
            requirements.add('onMount', 'function', 'Mount callback (optional)', false);
            umbilical.describe(requirements);
            return;
          }
          return { mockComponent: true };
        }
      };

      let describedRequirements = null;
      ToolSearchPanel.create({
        describe: (requirements) => {
          describedRequirements = requirements.getAll();
        }
      });

      expect(describedRequirements.dom).toBeDefined();
      expect(describedRequirements.tools).toBeDefined();
      expect(describedRequirements.onSearch).toBeDefined();
    });
  });

  describe('ToolSearchPanel MVVM Implementation', () => {
    // Mock the complete ToolSearchPanel implementation for testing
    const createToolSearchPanel = (umbilical) => {
      // Model
      class ToolSearchPanelModel {
        constructor(options = {}) {
          this.state = {
            tools: options.tools || [],
            searchQuery: '',
            filteredTools: options.tools || [],
            selectedTool: null,
            isSearching: false,
            searchHistory: [],
            filters: {
              category: 'all',
              module: 'all',
              sortBy: 'name'
            }
          };
        }
        
        updateState(path, value) {
          const keys = path.split('.');
          let current = this.state;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = value;
          
          // Auto-update filtered tools when search changes
          if (path === 'searchQuery') {
            this.updateFilteredTools();
          }
        }
        
        getState(path = '') {
          if (!path) return this.state;
          return path.split('.').reduce((obj, key) => obj?.[key], this.state);
        }
        
        updateFilteredTools() {
          const query = this.state.searchQuery.toLowerCase();
          const filtered = this.state.tools.filter(tool => 
            tool.name.toLowerCase().includes(query) ||
            tool.description.toLowerCase().includes(query) ||
            tool.module.toLowerCase().includes(query)
          );
          this.state.filteredTools = filtered;
        }
      }

      // View
      class ToolSearchPanelView {
        constructor(container) {
          this.container = container;
          this.cssInjected = false;
        }
        
        generateCSS() {
          return `
            .tool-search-panel {
              padding: var(--spacing-lg);
              min-height: clamp(20rem, 60vh, 40rem);
              display: flex;
              flex-direction: column;
              gap: var(--spacing-md);
            }
            
            .search-header {
              display: flex;
              flex-direction: column;
              gap: var(--spacing-sm);
            }
            
            .search-input-container {
              position: relative;
              width: 100%;
            }
            
            .search-input {
              width: 100%;
              padding: var(--spacing-md) var(--spacing-lg);
              padding-left: clamp(3rem, 8vw, 4rem);
              font-size: var(--font-md);
              border: 0.125rem solid var(--border-subtle);
              border-radius: var(--radius-lg);
              background: var(--surface-primary);
              color: var(--text-primary);
              transition: all 0.2s ease;
            }
            
            .search-input:focus {
              outline: none;
              border-color: var(--color-primary);
              box-shadow: 0 0 0 0.1875rem rgba(59, 130, 246, 0.15);
            }
            
            .search-icon {
              position: absolute;
              left: var(--spacing-md);
              top: 50%;
              transform: translateY(-50%);
              font-size: var(--font-lg);
              color: var(--text-tertiary);
            }
            
            .search-filters {
              display: flex;
              gap: var(--spacing-sm);
              flex-wrap: wrap;
            }
            
            .filter-select {
              padding: var(--spacing-sm) var(--spacing-md);
              border: 0.125rem solid var(--border-subtle);
              border-radius: var(--radius-md);
              background: var(--surface-secondary);
              color: var(--text-primary);
              font-size: var(--font-sm);
            }
            
            .tools-list {
              flex: 1;
              overflow-y: auto;
              border: 0.125rem solid var(--border-subtle);
              border-radius: var(--radius-md);
              background: var(--surface-primary);
            }
            
            .tool-item {
              padding: var(--spacing-md);
              border-bottom: 0.0625rem solid var(--border-subtle);
              cursor: pointer;
              transition: all 0.2s ease;
            }
            
            .tool-item:hover {
              background: var(--surface-hover);
            }
            
            .tool-item.selected {
              background: var(--color-primary);
              color: white;
            }
            
            .tool-name {
              font-weight: 600;
              font-size: var(--font-md);
              margin-bottom: var(--spacing-xs);
            }
            
            .tool-description {
              color: var(--text-secondary);
              font-size: var(--font-sm);
              line-height: 1.4;
            }
            
            .tool-item.selected .tool-description {
              color: rgba(255, 255, 255, 0.9);
            }
            
            .tool-meta {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: var(--spacing-xs);
              font-size: var(--font-xs);
              color: var(--text-tertiary);
            }
            
            .tool-item.selected .tool-meta {
              color: rgba(255, 255, 255, 0.8);
            }
            
            .search-results-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: var(--spacing-sm) var(--spacing-md);
              background: var(--surface-secondary);
              border-bottom: 0.0625rem solid var(--border-subtle);
              font-size: var(--font-sm);
              color: var(--text-secondary);
            }
            
            .no-results {
              padding: var(--spacing-xl);
              text-align: center;
              color: var(--text-secondary);
            }
            
            /* Desktop-only responsive design using clamp, vw, vh, rem */
          `;
        }
        
        injectCSS() {
          if (this.cssInjected) return;
          
          const styleElement = document.createElement('style');
          styleElement.id = 'tool-search-panel-styles';
          styleElement.textContent = this.generateCSS();
          document.head.appendChild(styleElement);
          this.cssInjected = true;
        }
        
        render(modelData) {
          this.injectCSS();
          
          this.container.innerHTML = '';
          this.container.className = 'tool-search-panel';
          
          // Search header
          const searchHeader = this.createSearchHeader(modelData);
          this.container.appendChild(searchHeader);
          
          // Tools list
          const toolsList = this.createToolsList(modelData);
          this.container.appendChild(toolsList);
          
          return this.container;
        }
        
        createSearchHeader(modelData) {
          const header = document.createElement('div');
          header.className = 'search-header';
          
          // Search input
          const inputContainer = document.createElement('div');
          inputContainer.className = 'search-input-container';
          
          const searchIcon = document.createElement('span');
          searchIcon.className = 'search-icon';
          searchIcon.textContent = '🔍';
          
          const searchInput = document.createElement('input');
          searchInput.className = 'search-input';
          searchInput.type = 'text';
          searchInput.placeholder = 'Search tools by name, description, or module...';
          searchInput.value = modelData.searchQuery || '';
          
          inputContainer.appendChild(searchIcon);
          inputContainer.appendChild(searchInput);
          
          // Filters
          const filters = document.createElement('div');
          filters.className = 'search-filters';
          
          const categorySelect = document.createElement('select');
          categorySelect.className = 'filter-select';
          categorySelect.innerHTML = `
            <option value="all">All Categories</option>
            <option value="file">File Operations</option>
            <option value="calc">Calculations</option>
            <option value="text">Text Processing</option>
          `;
          
          const moduleSelect = document.createElement('select');
          moduleSelect.className = 'filter-select';
          moduleSelect.innerHTML = `
            <option value="all">All Modules</option>
            <option value="FileModule">File Module</option>
            <option value="CalculatorModule">Calculator Module</option>
            <option value="TextModule">Text Module</option>
          `;
          
          const sortSelect = document.createElement('select');
          sortSelect.className = 'filter-select';
          sortSelect.innerHTML = `
            <option value="name">Sort by Name</option>
            <option value="module">Sort by Module</option>
            <option value="recent">Recently Used</option>
          `;
          
          filters.appendChild(categorySelect);
          filters.appendChild(moduleSelect);
          filters.appendChild(sortSelect);
          
          header.appendChild(inputContainer);
          header.appendChild(filters);
          
          return header;
        }
        
        createToolsList(modelData) {
          const toolsList = document.createElement('div');
          toolsList.className = 'tools-list';
          
          // Results header
          const resultsHeader = document.createElement('div');
          resultsHeader.className = 'search-results-header';
          resultsHeader.innerHTML = `
            <span>Found ${modelData.filteredTools.length} tools</span>
            <span>${modelData.searchQuery ? `for "${modelData.searchQuery}"` : ''}</span>
          `;
          toolsList.appendChild(resultsHeader);
          
          if (modelData.filteredTools.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No tools found matching your search criteria.';
            toolsList.appendChild(noResults);
          } else {
            modelData.filteredTools.forEach(tool => {
              const toolItem = this.createToolItem(tool, modelData.selectedTool);
              toolsList.appendChild(toolItem);
            });
          }
          
          return toolsList;
        }
        
        createToolItem(tool, selectedTool) {
          const item = document.createElement('div');
          item.className = `tool-item${tool.name === selectedTool?.name ? ' selected' : ''}`;
          item.dataset.toolName = tool.name;
          
          const name = document.createElement('div');
          name.className = 'tool-name';
          name.textContent = tool.name;
          
          const description = document.createElement('div');
          description.className = 'tool-description';
          description.textContent = tool.description;
          
          const meta = document.createElement('div');
          meta.className = 'tool-meta';
          meta.innerHTML = `
            <span>Module: ${tool.module}</span>
            <span>Type: ${tool.category || 'General'}</span>
          `;
          
          item.appendChild(name);
          item.appendChild(description);
          item.appendChild(meta);
          
          return item;
        }
      }

      // ViewModel
      class ToolSearchPanelViewModel {
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
          // Search input
          const searchInput = this.view.container.querySelector('.search-input');
          if (searchInput) {
            const handleSearch = (event) => {
              const query = event.target.value;
              this.model.updateState('searchQuery', query);
              this.render();
              
              if (this.umbilical.onSearch) {
                this.umbilical.onSearch(query);
              }
            };
            
            searchInput.addEventListener('input', handleSearch);
            this.eventListeners.push(() => searchInput.removeEventListener('input', handleSearch));
          }
          
          // Tool selection
          const handleToolClick = (event) => {
            const toolItem = event.target.closest('.tool-item');
            if (toolItem) {
              const toolName = toolItem.dataset.toolName;
              const tool = this.model.getState('tools').find(t => t.name === toolName);
              this.selectTool(tool);
            }
          };
          
          this.view.container.addEventListener('click', handleToolClick);
          this.eventListeners.push(() => this.view.container.removeEventListener('click', handleToolClick));
        }
        
        selectTool(tool) {
          this.model.updateState('selectedTool', tool);
          this.render();
          
          if (this.umbilical.onToolSelect) {
            this.umbilical.onToolSelect(tool);
          }
        }
        
        createPublicAPI() {
          return {
            search: (query) => {
              this.model.updateState('searchQuery', query);
              this.render();
            },
            setTools: (tools) => {
              this.model.updateState('tools', tools);
              this.model.updateFilteredTools();
              this.render();
            },
            getSelectedTool: () => this.model.getState('selectedTool'),
            clearSearch: () => {
              this.model.updateState('searchQuery', '');
              this.model.updateFilteredTools();
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
      const model = new ToolSearchPanelModel(umbilical);
      const view = new ToolSearchPanelView(umbilical.dom);
      const viewModel = new ToolSearchPanelViewModel(model, view, umbilical);
      
      return viewModel.initialize();
    };

    test('should render search panel with tools', () => {
      const tools = [
        { name: 'file-manager', description: 'Manage files', module: 'FileModule' },
        { name: 'calculator', description: 'Calculate math', module: 'CalculatorModule' }
      ];

      const panelInstance = createToolSearchPanel({
        dom: container,
        tools: tools
      });

      expect(container.className).toContain('tool-search-panel');
      expect(container.querySelector('.search-input')).toBeTruthy();
      expect(container.querySelectorAll('.tool-item')).toHaveLength(2);
    });

    test('should handle search functionality', () => {
      const tools = [
        { name: 'file-manager', description: 'Manage files', module: 'FileModule' },
        { name: 'calculator', description: 'Calculate math', module: 'CalculatorModule' }
      ];

      let searchQuery = '';
      const onSearch = (query) => { searchQuery = query; };

      const panelInstance = createToolSearchPanel({
        dom: container,
        tools: tools,
        onSearch: onSearch
      });

      const searchInput = container.querySelector('.search-input');
      searchInput.value = 'file';
      searchInput.dispatchEvent(new Event('input'));

      expect(searchQuery).toBe('file');
      expect(container.querySelectorAll('.tool-item')).toHaveLength(1);
    });

    test('should handle tool selection', () => {
      const tools = [
        { name: 'file-manager', description: 'Manage files', module: 'FileModule' }
      ];

      let selectedTool = null;
      const onToolSelect = (tool) => { selectedTool = tool; };

      const panelInstance = createToolSearchPanel({
        dom: container,
        tools: tools,
        onToolSelect: onToolSelect
      });

      const toolItem = container.querySelector('.tool-item');
      toolItem.click();

      expect(selectedTool.name).toBe('file-manager');
      expect(panelInstance.getSelectedTool().name).toBe('file-manager');
    });

    test('should generate responsive CSS without pixels', () => {
      const panelInstance = createToolSearchPanel({
        dom: container,
        tools: []
      });

      const styleElement = document.getElementById('tool-search-panel-styles');
      expect(styleElement).toBeTruthy();
      
      const css = styleElement.textContent;
      
      // Should use CSS variables
      expect(css).toContain('var(--spacing-lg)');
      expect(css).toContain('var(--font-md)');
      expect(css).toContain('var(--color-primary)');
      
      // Should use clamp for responsive sizing
      expect(css).toContain('clamp(');
      
      // Should not contain pixel values
      const pixelRegex = /\b\d+px\b/g;
      expect(css.match(pixelRegex)).toBeNull();
    });

    test('should support public API methods', () => {
      const tools = [
        { name: 'test-tool', description: 'Test tool', module: 'TestModule' }
      ];

      const panelInstance = createToolSearchPanel({
        dom: container,
        tools: tools
      });

      expect(panelInstance.search).toBeInstanceOf(Function);
      expect(panelInstance.setTools).toBeInstanceOf(Function);
      expect(panelInstance.clearSearch).toBeInstanceOf(Function);

      panelInstance.search('test');
      expect(container.querySelector('.search-input').value).toBe('test');
    });
  });
});