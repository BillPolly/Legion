/**
 * Unit tests for ToolRegistryViewModel
 */

import { ToolRegistryViewModel } from '../../../src/viewmodel/ToolRegistryViewModel.js';
import { ToolRegistryModel } from '../../../src/model/ToolRegistryModel.js';
import { ToolRegistryView } from '../../../src/view/ToolRegistryView.js';
import { createConnectedMockActors } from '../../helpers/mockActors.js';

describe('ToolRegistryViewModel', () => {
  let viewModel;
  let model;
  let view;
  let container;
  let mockActors;
  
  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create model and view
    model = new ToolRegistryModel();
    view = new ToolRegistryView(container);
    
    // Create mock actors
    mockActors = createConnectedMockActors();
    
    // Create view model
    viewModel = new ToolRegistryViewModel(model, view);
  });
  
  afterEach(() => {
    if (viewModel) {
      viewModel.destroy();
      viewModel = null;
    }
    if (view) {
      view.destroy();
    }
    if (model) {
      model.destroy();
    }
    container.remove();
  });
  
  describe('Initialization', () => {
    test('should initialize with model and view', () => {
      expect(viewModel.model).toBe(model);
      expect(viewModel.view).toBe(view);
      expect(viewModel.actors).toBeNull();
    });
    
    test('should bind view events', () => {
      // Check that view events are bound by triggering them
      const searchSpy = jest.spyOn(viewModel, 'handleToolSearch');
      view.emit('tools:search', { query: 'test' });
      expect(searchSpy).toHaveBeenCalledWith({ query: 'test' });
    });
    
    test('should bind model events', () => {
      // Check that model events trigger view updates
      const renderSpy = jest.spyOn(view, 'renderTools');
      const mockTools = [{ name: 'test_tool' }];
      model.setTools(mockTools);
      expect(renderSpy).toHaveBeenCalledWith(mockTools);
    });
  });
  
  describe('Actor Connection', () => {
    test('should connect actors', () => {
      viewModel.connectActors(mockActors);
      
      expect(viewModel.actors).toBe(mockActors);
      expect(viewModel.actors.toolRegistryActor).toBeDefined();
      expect(viewModel.actors.databaseActor).toBeDefined();
      expect(viewModel.actors.semanticSearchActor).toBeDefined();
    });
    
    test('should load initial data after connecting actors', async () => {
      const loadSpy = jest.spyOn(viewModel, 'loadInitialData');
      
      viewModel.connectActors(mockActors);
      await nextTick();
      
      expect(loadSpy).toHaveBeenCalled();
    });
  });
  
  describe('Tool Management', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should handle tool search from view', () => {
      const filterSpy = jest.spyOn(model, 'filterTools');
      
      viewModel.handleToolSearch({ query: 'file' });
      
      expect(filterSpy).toHaveBeenCalledWith('file', undefined);
    });
    
    test('should handle module filter from view', () => {
      const filterSpy = jest.spyOn(model, 'filterTools');
      
      viewModel.handleToolFilter({ module: 'calculator' });
      
      expect(filterSpy).toHaveBeenCalledWith('', 'calculator');
    });
    
    test('should handle tool selection', () => {
      const selectSpy = jest.spyOn(model, 'selectTool');
      const detailsSpy = jest.spyOn(view, 'renderToolDetails');
      
      // Set up tools in model
      model.setTools([
        { name: 'test_tool', description: 'Test tool' }
      ]);
      
      viewModel.handleToolSelection('test_tool');
      
      expect(selectSpy).toHaveBeenCalledWith('test_tool');
      expect(detailsSpy).toHaveBeenCalled();
    });
    
    test('should handle tool execution', async () => {
      const args = { expression: '2 + 2' };
      
      await viewModel.handleToolExecution({ 
        toolName: 'calculator', 
        args 
      });
      
      // Check that actor received the message
      expect(mockActors.toolRegistryActor.receivedMessages).toContainEqual(
        expect.objectContaining({
          type: 'execute_tool',
          toolName: 'calculator',
          args
        })
      );
    });
    
    test('should display execution results', async () => {
      const renderSpy = jest.spyOn(view, 'renderExecutionResult');
      
      await viewModel.handleToolExecution({
        toolName: 'calculator',
        args: { expression: '2 + 2' }
      });
      
      await nextTick();
      
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          result: 42
        })
      );
    });
    
    test('should handle execution errors', async () => {
      const renderSpy = jest.spyOn(view, 'renderExecutionResult');
      
      await viewModel.handleToolExecution({
        toolName: 'unknown_tool',
        args: {}
      });
      
      await nextTick();
      
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unknown tool'
        })
      );
    });
  });
  
  describe('Collection Management', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should handle collection selection', async () => {
      const selectSpy = jest.spyOn(model, 'selectCollection');
      
      await viewModel.handleCollectionSelection('tools');
      
      expect(selectSpy).toHaveBeenCalledWith('tools');
      
      // Check that documents were requested
      expect(mockActors.databaseActor.receivedMessages).toContainEqual(
        expect.objectContaining({
          type: 'get_documents',
          collection: 'tools'
        })
      );
    });
    
    test('should render documents after loading', async () => {
      const renderSpy = jest.spyOn(view, 'renderDocuments');
      
      await viewModel.handleCollectionSelection('tools');
      await nextTick();
      
      expect(renderSpy).toHaveBeenCalled();
    });
  });
  
  describe('Semantic Search', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should handle semantic search', async () => {
      await viewModel.handleSemanticSearch({ query: 'file operations' });
      
      expect(mockActors.semanticSearchActor.receivedMessages).toContainEqual(
        expect.objectContaining({
          type: 'search',
          query: 'file operations'
        })
      );
    });
    
    test('should render search results', async () => {
      const renderSpy = jest.spyOn(view, 'renderSearchResults');
      
      await viewModel.handleSemanticSearch({ query: 'file operations' });
      await nextTick();
      
      expect(renderSpy).toHaveBeenCalled();
    });
    
    test('should update model with search results', async () => {
      const setSpy = jest.spyOn(model, 'setSearchResults');
      
      await viewModel.handleSemanticSearch({ query: 'file operations' });
      await nextTick();
      
      expect(setSpy).toHaveBeenCalled();
    });
  });
  
  describe('Tab Management', () => {
    test('should handle tab changes', () => {
      const loadSpy = jest.spyOn(viewModel, 'loadDatabaseData');
      
      viewModel.connectActors(mockActors);
      viewModel.handleTabChange('database');
      
      expect(loadSpy).toHaveBeenCalled();
    });
    
    test('should not reload if tab is already loaded', () => {
      viewModel.connectActors(mockActors);
      
      // First load
      viewModel.handleTabChange('database');
      const messageCount = mockActors.databaseActor.receivedMessages.length;
      
      // Second load
      viewModel.handleTabChange('database');
      expect(mockActors.databaseActor.receivedMessages.length).toBe(messageCount);
    });
  });
  
  describe('Data Loading', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should load initial tool data', async () => {
      await viewModel.loadInitialData();
      
      expect(mockActors.toolRegistryActor.receivedMessages).toContainEqual(
        expect.objectContaining({ type: 'list_tools' })
      );
      
      // Check that tools were set in model
      expect(model.tools.length).toBeGreaterThan(0);
    });
    
    test('should load database data', async () => {
      await viewModel.loadDatabaseData();
      
      expect(mockActors.databaseActor.receivedMessages).toContainEqual(
        expect.objectContaining({ type: 'list_collections' })
      );
      
      expect(mockActors.semanticSearchActor.receivedMessages).toContainEqual(
        expect.objectContaining({ type: 'get_collections' })
      );
    });
    
    test('should handle loading errors', async () => {
      const errorSpy = jest.spyOn(view, 'showError');
      
      // Make actor throw error
      mockActors.toolRegistryActor.receive = async () => {
        throw new Error('Network error');
      };
      
      await viewModel.loadInitialData();
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load tools')
      );
    });
  });
  
  describe('Loading States', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should show loading indicator during data fetch', async () => {
      const showLoadingSpy = jest.spyOn(view, 'showLoading');
      const hideLoadingSpy = jest.spyOn(view, 'hideLoading');
      
      const promise = viewModel.loadInitialData();
      
      expect(showLoadingSpy).toHaveBeenCalledWith('Loading tools...');
      
      await promise;
      
      expect(hideLoadingSpy).toHaveBeenCalled();
    });
    
    test('should hide loading on error', async () => {
      const hideLoadingSpy = jest.spyOn(view, 'hideLoading');
      
      // Make actor throw error
      mockActors.toolRegistryActor.receive = async () => {
        throw new Error('Error');
      };
      
      await viewModel.loadInitialData();
      
      expect(hideLoadingSpy).toHaveBeenCalled();
    });
  });
  
  describe('State Synchronization', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should sync model changes to view', () => {
      const renderToolsSpy = jest.spyOn(view, 'renderTools');
      const renderCollectionsSpy = jest.spyOn(view, 'renderCollections');
      
      // Update model
      model.setTools([{ name: 'new_tool' }]);
      expect(renderToolsSpy).toHaveBeenCalled();
      
      model.setCollections([{ name: 'new_collection' }]);
      expect(renderCollectionsSpy).toHaveBeenCalled();
    });
    
    test('should maintain selection state', () => {
      model.setTools([
        { name: 'tool1' },
        { name: 'tool2' }
      ]);
      
      viewModel.handleToolSelection('tool1');
      expect(model.selectedTool).toBe('tool1');
      
      // Changing tabs and coming back should maintain selection
      viewModel.handleTabChange('database');
      viewModel.handleTabChange('tools');
      
      expect(model.selectedTool).toBe('tool1');
    });
  });
  
  describe('Cleanup', () => {
    test('should unbind events on destroy', () => {
      viewModel.connectActors(mockActors);
      
      const searchSpy = jest.spyOn(viewModel, 'handleToolSearch');
      
      viewModel.destroy();
      
      // View events should not trigger after destroy
      view.emit('tools:search', { query: 'test' });
      expect(searchSpy).not.toHaveBeenCalled();
    });
    
    test('should clear actors on destroy', () => {
      viewModel.connectActors(mockActors);
      viewModel.destroy();
      
      expect(viewModel.actors).toBeNull();
    });
    
    test('should not throw if destroyed multiple times', () => {
      expect(() => {
        viewModel.destroy();
        viewModel.destroy();
      }).not.toThrow();
    });
  });
  
  describe('Error Recovery', () => {
    beforeEach(() => {
      viewModel.connectActors(mockActors);
    });
    
    test('should retry failed operations', async () => {
      let callCount = 0;
      mockActors.toolRegistryActor.receive = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network error');
        }
        return { type: 'tools_list', tools: [] };
      };
      
      await viewModel.loadInitialData();
      
      // Manual retry
      await viewModel.loadInitialData();
      
      expect(callCount).toBe(2);
      expect(model.tools).toEqual([]);
    });
    
    test('should clear errors on successful operation', async () => {
      const clearErrorSpy = jest.spyOn(view, 'clearError');
      
      await viewModel.loadInitialData();
      
      expect(clearErrorSpy).toHaveBeenCalled();
    });
  });
});