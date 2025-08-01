/**
 * Tests for ToolsPanelViewModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('ToolsPanelViewModel', () => {
  let ToolsPanelViewModel;
  let ToolsPanelModel;
  let ToolsPanelView;
  let viewModel;
  let model;
  let view;
  let actorSpace;
  let toolsActor;
  let commandActor;
  
  beforeEach(async () => {
    // Import classes
    ({ ToolsPanelViewModel } = await import('../../../../src/components/tools-panel/ToolsPanelViewModel.js'));
    ({ ToolsPanelModel } = await import('../../../../src/components/tools-panel/ToolsPanelModel.js'));
    ({ ToolsPanelView } = await import('../../../../src/components/tools-panel/ToolsPanelView.js'));
    
    // Create DOM container
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create instances
    model = new ToolsPanelModel();
    view = new ToolsPanelView(container);
    view.render();
    
    // Create mock actor space
    toolsActor = {
      receive: jest.fn()
    };
    commandActor = {
      receive: jest.fn()
    };
    
    actorSpace = TestUtilities.createMockActorSpace({
      'tools-actor': toolsActor,
      'command-actor': commandActor
    });
    
    // Create view model
    viewModel = new ToolsPanelViewModel(model, view, actorSpace);
  });

  describe('Initialization', () => {
    test('should initialize actors on setup', () => {
      viewModel.initialize();
      
      expect(actorSpace.getActor).toHaveBeenCalledWith('tools-actor');
      expect(actorSpace.getActor).toHaveBeenCalledWith('command-actor');
    });

    test('should request tools list on initialization', () => {
      viewModel.initialize();
      
      expect(toolsActor.receive).toHaveBeenCalledWith({
        type: 'getTools'
      });
    });

    test('should set loading state during initialization', () => {
      const setLoadingSpy = jest.spyOn(view, 'setLoading');
      
      viewModel.initialize();
      
      expect(setLoadingSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('Tools Management', () => {
    test('should handle tools list response from actor', () => {
      viewModel.initialize();
      
      const tools = [
        { id: 'tool1', name: 'Tool 1', description: 'First tool' },
        { id: 'tool2', name: 'Tool 2', description: 'Second tool' }
      ];
      
      viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools
      });
      
      expect(model.getTools()).toEqual(tools);
    });

    test('should render tools when model updates', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      
      const tools = [{ id: 'tool1', name: 'Tool 1' }];
      model.setTools(tools);
      
      expect(renderToolsSpy).toHaveBeenCalledWith(tools);
    });

    test('should handle empty tools list', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      
      viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: []
      });
      
      expect(renderToolsSpy).toHaveBeenCalledWith([]);
    });

    test('should clear loading state after tools load', () => {
      viewModel.initialize();
      viewModel.bind(); // Need to bind to subscribe to model events
      
      const setLoadingSpy = jest.spyOn(view, 'setLoading');
      
      viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: []
      });
      
      expect(setLoadingSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('Tool Selection', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      const tools = [
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' }
      ];
      model.setTools(tools);
    });

    test('should handle tool click from view', () => {
      view.onToolClick({ id: 'tool1', name: 'Tool 1' });
      
      expect(model.getSelectedTool()).toEqual({ id: 'tool1', name: 'Tool 1' });
    });

    test('should update view when tool is selected', () => {
      const setSelectedToolSpy = jest.spyOn(view, 'setSelectedTool');
      
      model.selectTool('tool2');
      
      expect(setSelectedToolSpy).toHaveBeenCalledWith('tool2');
    });

    test('should notify actor when tool is selected', () => {
      model.selectTool('tool1');
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'toolSelected',
        toolId: 'tool1',
        tool: { id: 'tool1', name: 'Tool 1' }
      });
    });

    test('should toggle selection when clicking selected tool', () => {
      model.selectTool('tool1');
      view.onToolClick({ id: 'tool1', name: 'Tool 1' });
      
      expect(model.getSelectedTool()).toBeNull();
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setTools([
        { id: 'tool1', name: 'Tool 1' }
      ]);
    });

    test('should execute selected tool on Enter', () => {
      model.selectTool('tool1');
      
      const executeSpy = jest.spyOn(viewModel, 'executeTool');
      
      view.onToolSelect({ id: 'tool1', name: 'Tool 1' });
      
      expect(executeSpy).toHaveBeenCalledWith('tool1');
    });

    test('should send execute command to actor', () => {
      viewModel.executeTool('tool1');
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'executeTool',
        toolId: 'tool1'
      });
    });

    test('should set executing state during tool execution', () => {
      const setToolExecutingSpy = jest.spyOn(view, 'setToolExecuting');
      
      viewModel.executeTool('tool1');
      
      expect(setToolExecutingSpy).toHaveBeenCalledWith('tool1', true);
    });

    test('should handle tool execution response', () => {
      viewModel.executeTool('tool1');
      
      const setToolExecutingSpy = jest.spyOn(view, 'setToolExecuting');
      
      viewModel.handleActorUpdate({
        type: 'toolExecutionComplete',
        toolId: 'tool1',
        success: true
      });
      
      expect(setToolExecutingSpy).toHaveBeenCalledWith('tool1', false);
    });

    test('should handle tool execution error', () => {
      viewModel.executeTool('tool1');
      
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'toolExecutionError',
        toolId: 'tool1',
        error: 'Execution failed'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Tool execution failed: Execution failed');
    });

    test('should not execute tool that is already executing', () => {
      model.setToolExecuting('tool1', true);
      
      const receiveSpy = jest.spyOn(commandActor, 'receive');
      receiveSpy.mockClear();
      
      viewModel.executeTool('tool1');
      
      expect(receiveSpy).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setTools([
        { id: 'file_read', name: 'Read File', description: 'Read file contents' },
        { id: 'file_write', name: 'Write File', description: 'Write to file' },
        { id: 'http_get', name: 'HTTP GET', description: 'Make HTTP request' }
      ]);
    });

    test('should handle search input from view', () => {
      view.onSearchInput('file');
      
      expect(model.searchQuery).toBe('file');
    });

    test('should render filtered tools when search changes', () => {
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      
      model.setSearchQuery('file');
      
      const filtered = model.getFilteredTools();
      expect(renderToolsSpy).toHaveBeenCalledWith(filtered);
      expect(filtered).toHaveLength(2);
    });

    test('should show search results count', () => {
      const showSearchResultsSpy = jest.spyOn(view, 'showSearchResults');
      
      model.setSearchQuery('file');
      
      expect(showSearchResultsSpy).toHaveBeenCalledWith(2, 3);
    });

    test('should show no results message', () => {
      const showNoResultsSpy = jest.spyOn(view, 'showNoResults');
      
      model.setSearchQuery('nonexistent');
      
      expect(showNoResultsSpy).toHaveBeenCalledWith('nonexistent');
    });

    test('should clear search on clear button click', () => {
      model.setSearchQuery('test');
      
      view.onSearchClear();
      
      expect(model.searchQuery).toBe('');
    });

    test('should render all tools when search is cleared', () => {
      model.setSearchQuery('file');
      
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      renderToolsSpy.mockClear();
      
      view.onSearchClear();
      
      expect(renderToolsSpy).toHaveBeenCalledWith(model.getTools());
    });
  });

  describe('Keyboard Navigation', () => {
    let tools;
    
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      tools = [
        { id: 'tool1', name: 'Tool 1' },
        { id: 'tool2', name: 'Tool 2' },
        { id: 'tool3', name: 'Tool 3' }
      ];
      model.setTools(tools);
    });

    test('should navigate down through tools', () => {
      const setHighlightedToolSpy = jest.spyOn(view, 'setHighlightedTool');
      
      view.onNavigate('down');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool1');
      
      view.onNavigate('down');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool2');
      
      view.onNavigate('down');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool3');
    });

    test('should navigate up through tools', () => {
      // Start at bottom
      viewModel.highlightedIndex = 2;
      
      const setHighlightedToolSpy = jest.spyOn(view, 'setHighlightedTool');
      
      view.onNavigate('up');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool2');
      
      view.onNavigate('up');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool1');
    });

    test('should wrap around when navigating past bounds', () => {
      const setHighlightedToolSpy = jest.spyOn(view, 'setHighlightedTool');
      
      // At top, go up
      viewModel.highlightedIndex = 0;
      view.onNavigate('up');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool3');
      
      // At bottom, go down
      viewModel.highlightedIndex = 2;
      view.onNavigate('down');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool1');
    });

    test('should respect filtered tools during navigation', () => {
      model.setSearchQuery('Tool 1');
      
      const setHighlightedToolSpy = jest.spyOn(view, 'setHighlightedTool');
      
      view.onNavigate('down');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool1');
      
      // Should not navigate to filtered out tools
      view.onNavigate('down');
      expect(setHighlightedToolSpy).toHaveBeenCalledWith('tool1');
    });
  });

  describe('Tool Categories', () => {
    test('should render tools by category when enabled', () => {
      viewModel.initialize();
      viewModel.bind();
      
      viewModel.groupByCategory = true;
      
      const tools = [
        { id: 'file1', name: 'Read File', category: 'File' },
        { id: 'net1', name: 'HTTP GET', category: 'Network' }
      ];
      model.setTools(tools);
      
      const renderByCategorySpy = jest.spyOn(view, 'renderToolsByCategory');
      
      viewModel.refreshView();
      
      expect(renderByCategorySpy).toHaveBeenCalledWith({
        'File': [tools[0]],
        'Network': [tools[1]]
      });
    });

    test('should toggle category grouping', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      const renderByCategorySpy = jest.spyOn(view, 'renderToolsByCategory');
      
      model.setTools([{ id: 'tool1', name: 'Tool 1', category: 'Test' }]);
      
      // Default is not grouped
      expect(renderToolsSpy).toHaveBeenCalled();
      
      // Toggle to grouped
      viewModel.toggleCategoryView();
      expect(renderByCategorySpy).toHaveBeenCalled();
      
      // Toggle back
      viewModel.toggleCategoryView();
      expect(renderToolsSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Tool Updates', () => {
    test('should handle tool details update from actor', () => {
      viewModel.initialize();
      
      model.setTools([{ id: 'tool1', name: 'Tool 1', lastUsed: null }]);
      
      viewModel.handleActorUpdate({
        type: 'toolDetailsUpdate',
        toolId: 'tool1',
        details: { lastUsed: '2024-01-01T00:00:00Z' }
      });
      
      const tool = model.getToolById('tool1');
      expect(tool.lastUsed).toBe('2024-01-01T00:00:00Z');
    });

    test('should refresh view when tool details update', () => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      renderToolsSpy.mockClear();
      
      model.updateToolDetails('tool1', { description: 'Updated' });
      
      expect(renderToolsSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should show error when tools fail to load', () => {
      viewModel.initialize();
      
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'toolsListError',
        error: 'Network error'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to load tools: Network error');
    });

    test('should clear error on successful tools load', () => {
      viewModel.initialize();
      
      const clearErrorSpy = jest.spyOn(view, 'clearError');
      
      viewModel.handleActorUpdate({
        type: 'toolsListResponse',
        tools: []
      });
      
      expect(clearErrorSpy).toHaveBeenCalled();
    });

    test('should retry loading tools on error retry', () => {
      viewModel.initialize();
      
      const receiveSpy = jest.spyOn(toolsActor, 'receive');
      receiveSpy.mockClear();
      
      viewModel.retryLoadTools();
      
      expect(receiveSpy).toHaveBeenCalledWith({
        type: 'getTools'
      });
    });
  });

  describe('Tools Panel API', () => {
    test('should expose tools panel API', () => {
      viewModel.initialize();
      
      const api = viewModel.getToolsPanelAPI();
      
      expect(api).toBeDefined();
      expect(typeof api.refreshTools).toBe('function');
      expect(typeof api.selectTool).toBe('function');
      expect(typeof api.executeTool).toBe('function');
      expect(typeof api.searchTools).toBe('function');
    });

    test('should refresh tools through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getToolsPanelAPI();
      const receiveSpy = jest.spyOn(toolsActor, 'receive');
      receiveSpy.mockClear();
      
      api.refreshTools();
      
      expect(receiveSpy).toHaveBeenCalledWith({ type: 'getTools' });
    });

    test('should select tool through API', () => {
      viewModel.initialize();
      model.setTools([{ id: 'tool1', name: 'Tool 1' }]);
      
      const api = viewModel.getToolsPanelAPI();
      api.selectTool('tool1');
      
      expect(model.getSelectedTool()).toEqual({ id: 'tool1', name: 'Tool 1' });
    });

    test('should search tools through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getToolsPanelAPI();
      api.searchTools('test');
      
      expect(model.searchQuery).toBe('test');
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const modelDestroySpy = jest.spyOn(model, 'destroy');
      const viewDestroySpy = jest.spyOn(view, 'destroy');
      
      viewModel.destroy();
      
      expect(modelDestroySpy).toHaveBeenCalled();
      expect(viewDestroySpy).toHaveBeenCalled();
    });
  });
});