/**
 * Tests for ToolsPanelView
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('ToolsPanelView', () => {
  let ToolsPanelView;
  let view;
  let container;
  
  beforeEach(async () => {
    ({ ToolsPanelView } = await import('../../../../src/components/tools-panel/ToolsPanelView.js'));
    
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    view = new ToolsPanelView(container);
  });
  
  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initial Rendering', () => {
    test('should render tools panel structure', () => {
      view.render();
      
      expect(container.querySelector('.tools-panel')).toBeDefined();
      expect(container.querySelector('.tools-header')).toBeDefined();
      expect(container.querySelector('.tools-search')).toBeDefined();
      expect(container.querySelector('.tools-list')).toBeDefined();
    });

    test('should render search input', () => {
      view.render();
      
      const searchInput = container.querySelector('.tools-search input');
      expect(searchInput).toBeDefined();
      expect(searchInput.getAttribute('type')).toBe('text');
      expect(searchInput.getAttribute('placeholder')).toBe('Search tools...');
    });

    test('should show empty state when no tools', () => {
      view.render();
      view.renderTools([]);
      
      const emptyState = container.querySelector('.tools-empty');
      expect(emptyState).toBeDefined();
      expect(emptyState.textContent).toContain('No tools available');
    });

    test('should apply theme class if provided', () => {
      view.render({ theme: 'dark' });
      
      const panel = container.querySelector('.tools-panel');
      expect(panel.classList.contains('tools-panel-theme-dark')).toBe(true);
    });
  });

  describe('Tools Display', () => {
    const mockTools = [
      { id: 'tool1', name: 'Tool 1', description: 'First tool' },
      { id: 'tool2', name: 'Tool 2', description: 'Second tool' },
      { id: 'tool3', name: 'Tool 3', description: 'Third tool' }
    ];

    test('should render list of tools', () => {
      view.render();
      view.renderTools(mockTools);
      
      const toolItems = container.querySelectorAll('.tool-item');
      expect(toolItems.length).toBe(3);
      
      expect(toolItems[0].textContent).toContain('Tool 1');
      expect(toolItems[1].textContent).toContain('Tool 2');
      expect(toolItems[2].textContent).toContain('Tool 3');
    });

    test('should display tool descriptions', () => {
      view.render();
      view.renderTools(mockTools);
      
      const descriptions = container.querySelectorAll('.tool-description');
      expect(descriptions[0].textContent).toBe('First tool');
      expect(descriptions[1].textContent).toBe('Second tool');
      expect(descriptions[2].textContent).toBe('Third tool');
    });

    test('should render tools with categories', () => {
      const categorizedTools = [
        { id: 'file1', name: 'Read File', category: 'File Operations' },
        { id: 'file2', name: 'Write File', category: 'File Operations' },
        { id: 'net1', name: 'HTTP GET', category: 'Network' }
      ];
      
      view.render();
      view.renderToolsByCategory({
        'File Operations': [categorizedTools[0], categorizedTools[1]],
        'Network': [categorizedTools[2]]
      });
      
      const categories = container.querySelectorAll('.tool-category');
      expect(categories.length).toBe(2);
      
      expect(categories[0].querySelector('.category-header').textContent).toBe('File Operations');
      expect(categories[1].querySelector('.category-header').textContent).toBe('Network');
      
      expect(categories[0].querySelectorAll('.tool-item').length).toBe(2);
      expect(categories[1].querySelectorAll('.tool-item').length).toBe(1);
    });

    test('should handle tools without descriptions', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const description = container.querySelector('.tool-description');
      expect(description.textContent).toBe('');
    });
  });

  describe('Tool Selection', () => {
    test('should highlight selected tool', () => {
      view.render();
      view.renderTools([
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' }
      ]);
      
      view.setSelectedTool('tool2');
      
      const toolItems = container.querySelectorAll('.tool-item');
      expect(toolItems[0].classList.contains('selected')).toBe(false);
      expect(toolItems[1].classList.contains('selected')).toBe(true);
    });

    test('should clear selection when null', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      view.setSelectedTool('tool1');
      view.setSelectedTool(null);
      
      const toolItem = container.querySelector('.tool-item');
      expect(toolItem.classList.contains('selected')).toBe(false);
    });

    test('should handle selection of non-existent tool', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      // Should not throw
      view.setSelectedTool('invalid-id');
      
      const toolItem = container.querySelector('.tool-item');
      expect(toolItem.classList.contains('selected')).toBe(false);
    });
  });

  describe('Tool Execution State', () => {
    test('should show loading state for executing tool', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      view.setToolExecuting('tool1', true);
      
      const toolItem = container.querySelector('[data-tool-id="tool1"]');
      expect(toolItem.classList.contains('executing')).toBe(true);
      
      const spinner = toolItem.querySelector('.tool-spinner');
      expect(spinner).toBeDefined();
    });

    test('should remove loading state when execution ends', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      view.setToolExecuting('tool1', true);
      view.setToolExecuting('tool1', false);
      
      const toolItem = container.querySelector('[data-tool-id="tool1"]');
      expect(toolItem.classList.contains('executing')).toBe(false);
      
      const spinner = toolItem.querySelector('.tool-spinner');
      expect(spinner).toBeNull();
    });

    test('should disable tool during execution', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      view.setToolExecuting('tool1', true);
      
      const toolItem = container.querySelector('[data-tool-id="tool1"]');
      expect(toolItem.classList.contains('disabled')).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    test('should update search input value', () => {
      view.render();
      view.setSearchQuery('file');
      
      const searchInput = container.querySelector('.tools-search input');
      expect(searchInput.value).toBe('file');
    });

    test('should show search results count', () => {
      view.render();
      view.renderTools([
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' }
      ]);
      view.showSearchResults(2, 5);
      
      const resultsCount = container.querySelector('.search-results-count');
      expect(resultsCount).toBeDefined();
      expect(resultsCount.textContent).toContain('2 of 5');
    });

    test('should show no results message', () => {
      view.render();
      view.renderTools([]);
      view.showNoResults('test');
      
      const noResults = container.querySelector('.tools-no-results');
      expect(noResults).toBeDefined();
      expect(noResults.textContent).toContain('No tools found for "test"');
    });
  });

  describe('Event Handlers', () => {
    test('should call onToolClick when tool is clicked', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const onToolClick = jest.fn();
      view.onToolClick = onToolClick;
      
      const toolItem = container.querySelector('.tool-item');
      toolItem.click();
      
      expect(onToolClick).toHaveBeenCalledWith({ id: 'tool1', name: 'Tool 1' });
    });

    test('should call onSearchInput when typing in search', () => {
      view.render();
      
      const onSearchInput = jest.fn();
      view.onSearchInput = onSearchInput;
      
      const searchInput = container.querySelector('.tools-search input');
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));
      
      expect(onSearchInput).toHaveBeenCalledWith('test');
    });

    test('should clear search when clear button clicked', () => {
      view.render();
      view.setSearchQuery('test');
      
      const onSearchClear = jest.fn();
      view.onSearchClear = onSearchClear;
      
      const clearButton = container.querySelector('.search-clear');
      clearButton.click();
      
      expect(onSearchClear).toHaveBeenCalled();
    });

    test('should not call onToolClick for disabled tools', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      view.setToolExecuting('tool1', true);
      
      const onToolClick = jest.fn();
      view.onToolClick = onToolClick;
      
      const toolItem = container.querySelector('.tool-item');
      toolItem.click();
      
      expect(onToolClick).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should focus search on / key', () => {
      view.render();
      
      const searchInput = container.querySelector('.tools-search input');
      const focusSpy = jest.spyOn(searchInput, 'focus');
      
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
      
      expect(focusSpy).toHaveBeenCalled();
    });

    test('should navigate tools with arrow keys', () => {
      view.render();
      view.renderTools([
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' },
        { id: 'tool3', name: 'Tool 3' }
      ]);
      
      const onNavigate = jest.fn();
      view.onNavigate = onNavigate;
      
      const toolsList = container.querySelector('.tools-list');
      toolsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      
      expect(onNavigate).toHaveBeenCalledWith('down');
      
      toolsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      
      expect(onNavigate).toHaveBeenCalledWith('up');
    });

    test('should select tool on Enter key', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      view.setHighlightedTool('tool1');
      
      const onToolSelect = jest.fn();
      view.onToolSelect = onToolSelect;
      
      const toolsList = container.querySelector('.tools-list');
      toolsList.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(onToolSelect).toHaveBeenCalledWith({ id: 'tool1', name: 'Tool 1' });
    });
  });

  describe('Visual States', () => {
    test('should show loading state for entire panel', () => {
      view.render();
      view.setLoading(true);
      
      const panel = container.querySelector('.tools-panel');
      expect(panel.classList.contains('loading')).toBe(true);
      
      const loadingOverlay = container.querySelector('.tools-loading');
      expect(loadingOverlay).toBeDefined();
    });

    test('should show error state', () => {
      view.render();
      view.showError('Failed to load tools');
      
      const errorMessage = container.querySelector('.tools-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain('Failed to load tools');
    });

    test('should clear error state', () => {
      view.render();
      view.showError('Error');
      view.clearError();
      
      const errorMessage = container.querySelector('.tools-error');
      expect(errorMessage).toBeNull();
    });

    test('should highlight tool on hover', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const toolItem = container.querySelector('.tool-item');
      
      toolItem.dispatchEvent(new MouseEvent('mouseenter'));
      expect(toolItem.classList.contains('hover')).toBe(true);
      
      toolItem.dispatchEvent(new MouseEvent('mouseleave'));
      expect(toolItem.classList.contains('hover')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should remove all event listeners on destroy', () => {
      view.render();
      view.renderTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const onToolClick = jest.fn();
      view.onToolClick = onToolClick;
      
      view.destroy();
      
      const toolItem = container.querySelector('.tool-item');
      if (toolItem) {
        toolItem.click();
        expect(onToolClick).not.toHaveBeenCalled();
      }
    });

    test('should clear container on destroy', () => {
      view.render();
      view.destroy();
      
      expect(container.innerHTML).toBe('');
    });
  });
});