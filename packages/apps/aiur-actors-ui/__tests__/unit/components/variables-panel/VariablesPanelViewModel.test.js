/**
 * Tests for VariablesPanelViewModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('VariablesPanelViewModel', () => {
  let VariablesPanelViewModel;
  let VariablesPanelModel;
  let VariablesPanelView;
  let viewModel;
  let model;
  let view;
  let actorSpace;
  let variablesActor;
  let commandActor;
  
  beforeEach(async () => {
    // Import classes
    ({ VariablesPanelViewModel } = await import('../../../../src/components/variables-panel/VariablesPanelViewModel.js'));
    ({ VariablesPanelModel } = await import('../../../../src/components/variables-panel/VariablesPanelModel.js'));
    ({ VariablesPanelView } = await import('../../../../src/components/variables-panel/VariablesPanelView.js'));
    
    // Create DOM container
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create instances
    model = new VariablesPanelModel();
    view = new VariablesPanelView(container);
    view.render();
    
    // Create mock actor space
    variablesActor = {
      receive: jest.fn()
    };
    commandActor = {
      receive: jest.fn()
    };
    
    actorSpace = TestUtilities.createMockActorSpace({
      'variables-actor': variablesActor,
      'command-actor': commandActor
    });
    
    // Create view model
    viewModel = new VariablesPanelViewModel(model, view, actorSpace);
  });

  describe('Initialization', () => {
    test('should initialize actors on setup', () => {
      viewModel.initialize();
      
      expect(actorSpace.getActor).toHaveBeenCalledWith('variables-actor');
      expect(actorSpace.getActor).toHaveBeenCalledWith('command-actor');
    });

    test('should request variables list on initialization', () => {
      viewModel.initialize();
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'getVariables'
      });
    });

    test('should set loading state during initialization', () => {
      const setLoadingSpy = jest.spyOn(view, 'setLoading');
      
      viewModel.initialize();
      
      expect(setLoadingSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('Variables Management', () => {
    test('should handle variables list response from actor', () => {
      viewModel.initialize();
      
      const variables = [
        { id: 'var1', name: 'API_KEY', value: 'secret', type: 'string', scope: 'global' },
        { id: 'var2', name: 'DEBUG_MODE', value: true, type: 'boolean', scope: 'session' }
      ];
      
      viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables
      });
      
      expect(model.getVariables()).toEqual(variables);
    });

    test('should render variables when model updates', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      
      const variables = [{ id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }];
      model.setVariables(variables);
      
      expect(renderVariablesSpy).toHaveBeenCalledWith(variables);
    });

    test('should handle empty variables list', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      
      viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: []
      });
      
      expect(renderVariablesSpy).toHaveBeenCalledWith([]);
    });

    test('should clear loading state after variables load', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const setLoadingSpy = jest.spyOn(view, 'setLoading');
      
      viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: []
      });
      
      expect(setLoadingSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('Variable Selection', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' },
        { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
      ];
      model.setVariables(variables);
    });

    test('should handle variable click from view', () => {
      view.onVariableClick({ id: 'var1', name: 'VAR1', value: 'value1', type: 'string' });
      
      expect(model.getSelectedVariable()).toEqual({ id: 'var1', name: 'VAR1', value: 'value1', type: 'string' });
    });

    test('should update view when variable is selected', () => {
      const setSelectedVariableSpy = jest.spyOn(view, 'setSelectedVariable');
      
      model.selectVariable('var2');
      
      expect(setSelectedVariableSpy).toHaveBeenCalledWith('var2');
    });

    test('should notify command actor when variable is selected', () => {
      model.selectVariable('var1');
      
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'variableSelected',
        variableId: 'var1',
        variable: { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }
      });
    });
  });

  describe('Variable Creation', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
    });

    test('should handle new variable button click', () => {
      const showNewVariableDialogSpy = jest.spyOn(view, 'showNewVariableDialog');
      
      view.onNewVariable();
      
      expect(showNewVariableDialogSpy).toHaveBeenCalled();
    });

    test('should create variable from dialog', () => {
      const variableData = {
        name: 'NEW_VAR',
        value: 'new_value',
        type: 'string',
        scope: 'global',
        description: 'A new variable'
      };
      
      view.onCreateVariable(variableData);
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'createVariable',
        variableData: expect.objectContaining(variableData)
      });
    });

    test('should hide dialog after variable creation', () => {
      const hideNewVariableDialogSpy = jest.spyOn(view, 'hideNewVariableDialog');
      
      const variableData = { name: 'TEST_VAR', value: 'test', type: 'string' };
      view.onCreateVariable(variableData);
      
      expect(hideNewVariableDialogSpy).toHaveBeenCalled();
    });

    test('should handle variable creation response', () => {
      viewModel.handleActorUpdate({
        type: 'variableCreated',
        variable: { id: 'new-var', name: 'NEW_VAR', value: 'new', type: 'string' }
      });
      
      // Should refresh variables list
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'getVariables'
      });
    });

    test('should validate variable data before creation', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      // Missing name
      view.onCreateVariable({ value: 'test', type: 'string' });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Variable name is required');
      expect(variablesActor.receive).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'createVariable' })
      );
    });

    test('should validate variable name format', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      view.onCreateVariable({ name: 'invalid-name', value: 'test', type: 'string' });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Variable name must be a valid identifier');
    });

    test('should validate variable type constraints', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      view.onCreateVariable({ name: 'BOOL_VAR', value: 'invalid', type: 'boolean' });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Boolean variable must have true/false value');
    });
  });

  describe('Variable Updates', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setVariables([
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }
      ]);
    });

    test('should show edit dialog for variable', () => {
      const showEditVariableDialogSpy = jest.spyOn(view, 'showEditVariableDialog');
      
      viewModel.editVariable('var1');
      
      expect(showEditVariableDialogSpy).toHaveBeenCalledWith({
        id: 'var1', name: 'VAR1', value: 'value1', type: 'string'
      });
    });

    test('should update variable details', () => {
      const updates = { value: 'updated_value', description: 'Updated' };
      viewModel.updateVariable('var1', updates);
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'updateVariable',
        variableId: 'var1',
        updates
      });
    });

    test('should handle variable update response', () => {
      viewModel.handleActorUpdate({
        type: 'variableUpdated',
        variableId: 'var1',
        variable: { id: 'var1', name: 'VAR1', value: 'updated', type: 'string' }
      });
      
      const variable = model.getVariableById('var1');
      expect(variable.value).toBe('updated');
    });

    test('should refresh view when variable details update', () => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setVariables([{ id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }]);
      
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      renderVariablesSpy.mockClear();
      
      model.updateVariable('var1', { value: 'updated' });
      
      expect(renderVariablesSpy).toHaveBeenCalled();
    });
  });

  describe('Variable Deletion', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setVariables([
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' },
        { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
      ]);
    });

    test('should show delete confirmation', () => {
      const showDeleteConfirmationSpy = jest.spyOn(view, 'showDeleteConfirmation');
      
      viewModel.requestDeleteVariable('var1');
      
      expect(showDeleteConfirmationSpy).toHaveBeenCalledWith(
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }
      );
    });

    test('should delete variable when confirmed', () => {
      viewModel.confirmDeleteVariable('var1');
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'deleteVariable',
        variableId: 'var1'
      });
    });

    test('should handle variable deletion response', () => {
      model.selectVariable('var1');
      
      viewModel.handleActorUpdate({
        type: 'variableDeleted',
        variableId: 'var1'
      });
      
      expect(model.getVariableById('var1')).toBeNull();
      expect(model.getSelectedVariable()).toBeNull(); // Should deselect
    });

    test('should refresh view after deletion', () => {
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      renderVariablesSpy.mockClear();
      
      viewModel.handleActorUpdate({
        type: 'variableDeleted',
        variableId: 'var1'
      });
      
      expect(renderVariablesSpy).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setVariables([
        { id: 'var1', name: 'API_KEY', value: 'secret', type: 'string', description: 'API access key' },
        { id: 'var2', name: 'DEBUG_MODE', value: true, type: 'boolean', description: 'Debug flag' },
        { id: 'var3', name: 'TIMEOUT', value: 5000, type: 'number', description: 'Timeout value' }
      ]);
    });

    test('should handle search input from view', () => {
      view.onSearchInput('api');
      
      expect(model.searchQuery).toBe('api');
    });

    test('should render filtered variables when search changes', () => {
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      
      model.setSearchQuery('debug');
      
      const filtered = model.getFilteredVariables();
      expect(renderVariablesSpy).toHaveBeenCalledWith(filtered);
      expect(filtered).toHaveLength(1);
    });

    test('should show search results count', () => {
      const showSearchResultsSpy = jest.spyOn(view, 'showSearchResults');
      
      model.setSearchQuery('_');
      
      expect(showSearchResultsSpy).toHaveBeenCalledWith(2, 3); // Only API_KEY and DEBUG_MODE have underscores
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

    test('should render all variables when search is cleared', () => {
      model.setSearchQuery('api');
      
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      renderVariablesSpy.mockClear();
      
      view.onSearchClear();
      
      expect(renderVariablesSpy).toHaveBeenCalledWith(model.getVariables());
    });
  });

  describe('Variable Types and Scopes', () => {
    test('should render variables by type when enabled', () => {
      viewModel.initialize();
      viewModel.bind();
      
      viewModel.groupByType = true;
      
      const variables = [
        { id: 'var1', name: 'STRING_VAR', value: 'test', type: 'string' },
        { id: 'var2', name: 'BOOL_VAR', value: true, type: 'boolean' }
      ];
      model.setVariables(variables);
      
      const renderByTypeSpy = jest.spyOn(view, 'renderVariablesByType');
      
      viewModel.refreshView();
      
      // After sorting by name: BOOL_VAR comes before STRING_VAR
      const sortedVariables = model.getVariables();
      expect(renderByTypeSpy).toHaveBeenCalledWith({
        'string': [sortedVariables.find(v => v.name === 'STRING_VAR')],
        'boolean': [sortedVariables.find(v => v.name === 'BOOL_VAR')]
      });
    });

    test('should render variables by scope when enabled', () => {
      viewModel.initialize();
      viewModel.bind();
      
      viewModel.groupByScope = true;
      
      const variables = [
        { id: 'var1', name: 'GLOBAL_VAR', value: 'test', scope: 'global' },
        { id: 'var2', name: 'SESSION_VAR', value: 'test', scope: 'session' }
      ];
      model.setVariables(variables);
      
      const renderByScopeSpy = jest.spyOn(view, 'renderVariablesByScope');
      
      viewModel.refreshView();
      
      expect(renderByScopeSpy).toHaveBeenCalledWith({
        'global': [variables[0]],
        'session': [variables[1]]
      });
    });

    test('should toggle type grouping', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      const renderByTypeSpy = jest.spyOn(view, 'renderVariablesByType');
      
      model.setVariables([{ id: 'var1', name: 'VAR1', value: 'test', type: 'string' }]);
      
      // Default is not grouped
      expect(renderVariablesSpy).toHaveBeenCalled();
      
      // Toggle to grouped
      viewModel.toggleTypeView();
      expect(renderByTypeSpy).toHaveBeenCalled();
      
      // Toggle back
      viewModel.toggleTypeView();
      expect(renderVariablesSpy).toHaveBeenCalledTimes(2);
    });

    test('should toggle scope grouping', () => {
      viewModel.initialize();
      viewModel.bind();
      
      const renderVariablesSpy = jest.spyOn(view, 'renderVariables');
      const renderByScopeSpy = jest.spyOn(view, 'renderVariablesByScope');
      
      model.setVariables([{ id: 'var1', name: 'VAR1', value: 'test', scope: 'global' }]);
      
      // Default is not grouped
      expect(renderVariablesSpy).toHaveBeenCalled();
      
      // Toggle to grouped
      viewModel.toggleScopeView();
      expect(renderByScopeSpy).toHaveBeenCalled();
      
      // Toggle back
      viewModel.toggleScopeView();
      expect(renderVariablesSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context Menu Actions', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
      
      model.setVariables([
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }
      ]);
    });

    test('should show context menu on right click', () => {
      const showVariableContextMenuSpy = jest.spyOn(view, 'showVariableContextMenu');
      
      const variable = { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' };
      const position = { x: 100, y: 200 };
      
      view.onVariableRightClick(variable, position);
      
      expect(showVariableContextMenuSpy).toHaveBeenCalledWith('var1', position);
    });

    test('should handle edit variable action', () => {
      const showEditVariableDialogSpy = jest.spyOn(view, 'showEditVariableDialog');
      
      viewModel.editVariable('var1');
      
      expect(showEditVariableDialogSpy).toHaveBeenCalledWith({
        id: 'var1', name: 'VAR1', value: 'value1', type: 'string'
      });
    });

    test('should handle duplicate variable action', () => {
      viewModel.duplicateVariable('var1');
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'duplicateVariable',
        variableId: 'var1'
      });
    });

    test('should handle copy variable value action', () => {
      // Mock clipboard API
      const mockWriteText = jest.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText
        }
      });
      
      viewModel.copyVariableValue('var1');
      
      expect(mockWriteText).toHaveBeenCalledWith('value1');
    });
  });

  describe('Import/Export Functionality', () => {
    beforeEach(() => {
      viewModel.initialize();
      viewModel.bind();
    });

    test('should show import dialog', () => {
      const showImportVariablesDialogSpy = jest.spyOn(view, 'showImportVariablesDialog');
      
      viewModel.showImportDialog();
      
      expect(showImportVariablesDialogSpy).toHaveBeenCalled();
    });

    test('should handle import variables', () => {
      const variablesJson = JSON.stringify([
        { name: 'IMPORTED_VAR', value: 'imported', type: 'string', scope: 'global' }
      ]);
      
      viewModel.importVariables(variablesJson);
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'importVariables',
        variablesJson
      });
    });

    test('should handle export variables', () => {
      model.setVariables([
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string', scope: 'global' }
      ]);
      
      const triggerExportDownloadSpy = jest.spyOn(view, 'triggerExportDownload');
      
      viewModel.exportVariables();
      
      expect(triggerExportDownloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('VAR1')
      );
    });

    test('should validate import data', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.importVariables('invalid json');
      
      expect(showErrorSpy).toHaveBeenCalledWith('Invalid JSON format');
    });
  });

  describe('Error Handling', () => {
    test('should show error when variables fail to load', () => {
      viewModel.initialize();
      
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'variablesListError',
        error: 'Database connection failed'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to load variables: Database connection failed');
    });

    test('should clear error on successful variables load', () => {
      viewModel.initialize();
      
      const clearErrorSpy = jest.spyOn(view, 'clearError');
      
      viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: []
      });
      
      expect(clearErrorSpy).toHaveBeenCalled();
    });

    test('should handle variable creation errors', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'variableCreationError',
        error: 'Variable name already exists'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to create variable: Variable name already exists');
    });

    test('should handle variable update errors', () => {
      const showErrorSpy = jest.spyOn(view, 'showError');
      
      viewModel.handleActorUpdate({
        type: 'variableUpdateError',
        variableId: 'var1',
        error: 'Invalid variable value'
      });
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to update variable: Invalid variable value');
    });

    test('should retry loading variables on error retry', () => {
      viewModel.initialize();
      
      const receiveSpy = jest.spyOn(variablesActor, 'receive');
      receiveSpy.mockClear();
      
      viewModel.retryLoadVariables();
      
      expect(receiveSpy).toHaveBeenCalledWith({
        type: 'getVariables'
      });
    });
  });

  describe('Variables Panel API', () => {
    test('should expose variables panel API', () => {
      viewModel.initialize();
      
      const api = viewModel.getVariablesPanelAPI();
      
      expect(api).toBeDefined();
      expect(typeof api.refreshVariables).toBe('function');
      expect(typeof api.selectVariable).toBe('function');
      expect(typeof api.createVariable).toBe('function');
      expect(typeof api.deleteVariable).toBe('function');
      expect(typeof api.searchVariables).toBe('function');
    });

    test('should refresh variables through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getVariablesPanelAPI();
      const receiveSpy = jest.spyOn(variablesActor, 'receive');
      receiveSpy.mockClear();
      
      api.refreshVariables();
      
      expect(receiveSpy).toHaveBeenCalledWith({ type: 'getVariables' });
    });

    test('should select variable through API', () => {
      viewModel.initialize();
      model.setVariables([{ id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }]);
      
      const api = viewModel.getVariablesPanelAPI();
      api.selectVariable('var1');
      
      expect(model.getSelectedVariable()).toEqual({ id: 'var1', name: 'VAR1', value: 'value1', type: 'string' });
    });

    test('should create variable through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getVariablesPanelAPI();
      const variableData = { name: 'API_VAR', value: 'api_value', type: 'string' };
      
      api.createVariable(variableData);
      
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'createVariable',
        variableData: expect.objectContaining(variableData)
      });
    });

    test('should search variables through API', () => {
      viewModel.initialize();
      
      const api = viewModel.getVariablesPanelAPI();
      api.searchVariables('test');
      
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