/**
 * Integration tests for VariablesPanel component
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestUtilities } from '../../../utils/test-utilities.js';

describe('VariablesPanel Component Integration', () => {
  let VariablesPanel;
  let variablesPanel;
  let container;
  let actorSpace;
  let variablesActor;
  let commandActor;
  
  beforeEach(async () => {
    ({ VariablesPanel } = await import('../../../../src/components/variables-panel/index.js'));
    
    // Create DOM environment
    const env = TestUtilities.createDOMTestEnvironment();
    container = env.container;
    
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
  });
  
  afterEach(() => {
    if (variablesPanel) {
      variablesPanel.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Complete Variables Workflow', () => {
    test('should load and display variables', async () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Verify variables request was sent
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'getVariables'
      });
      
      // Simulate variables response
      const variables = [
        { id: 'var1', name: 'API_KEY', value: 'secret123', type: 'string', scope: 'global' },
        { id: 'var2', name: 'DEBUG_MODE', value: true, type: 'boolean', scope: 'session' },
        { id: 'var3', name: 'TIMEOUT', value: 5000, type: 'number', scope: 'local' }
      ];
      
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables
      });
      
      // Check variables are displayed
      const variableItems = container.querySelectorAll('.variable-item');
      expect(variableItems.length).toBe(3);
      expect(variableItems[0].textContent).toContain('API_KEY');
      expect(variableItems[1].textContent).toContain('DEBUG_MODE');
      expect(variableItems[2].textContent).toContain('TIMEOUT');
    });

    test('should select variable', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'test_var', name: 'TEST_VAR', value: 'test_value', type: 'string' }]
      });
      
      // Click on variable
      const variableItem = container.querySelector('.variable-item');
      variableItem.click();
      
      // Verify variable is selected
      expect(variableItem.classList.contains('selected')).toBe(true);
      expect(commandActor.receive).toHaveBeenCalledWith({
        type: 'variableSelected',
        variableId: 'test_var',
        variable: { id: 'test_var', name: 'TEST_VAR', value: 'test_value', type: 'string' }
      });
    });

    test('should create new variable', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Click new variable button
      const newButton = container.querySelector('.new-variable-button');
      newButton.click();
      
      // Check dialog is shown
      const dialog = container.querySelector('.new-variable-dialog');
      expect(dialog.style.display).not.toBe('none');
      
      // Fill form
      const nameInput = dialog.querySelector('input[name="name"]');
      const valueInput = dialog.querySelector('textarea[name="value"]');
      const typeSelect = dialog.querySelector('select[name="type"]');
      const scopeSelect = dialog.querySelector('select[name="scope"]');
      const descTextarea = dialog.querySelector('textarea[name="description"]');
      
      nameInput.value = 'NEW_API_KEY';
      valueInput.value = 'new_secret_123';
      typeSelect.value = 'string';
      scopeSelect.value = 'global';
      descTextarea.value = 'New API key for production';
      
      // Submit form
      const form = dialog.querySelector('.new-variable-form');
      form.dispatchEvent(new Event('submit'));
      
      // Verify variable creation request
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'createVariable',
        variableData: expect.objectContaining({
          name: 'NEW_API_KEY',
          value: 'new_secret_123',
          type: 'string',
          scope: 'global',
          description: 'New API key for production'
        })
      });
      
      // Verify dialog is hidden
      expect(dialog.style.display).toBe('none');
    });

    test('should search and filter variables', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      const variables = [
        { id: 'var1', name: 'API_KEY_PROD', value: 'prod_secret', type: 'string', scope: 'global' },
        { id: 'var2', name: 'API_KEY_DEV', value: 'dev_secret', type: 'string', scope: 'global' },
        { id: 'var3', name: 'DEBUG_MODE', value: true, type: 'boolean', scope: 'session' }
      ];
      
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables
      });
      
      // Search for "API"
      const searchInput = container.querySelector('.variables-search input');
      searchInput.value = 'API';
      searchInput.dispatchEvent(new Event('input'));
      
      // Check filtered results - should show API_KEY variables but not DEBUG_MODE
      const visibleVariables = container.querySelectorAll('.variable-item:not(.hidden)');
      expect(visibleVariables.length).toBe(2);
      
      // Check search results count
      const resultsCount = container.querySelector('.search-results-count');
      expect(resultsCount.textContent).toContain('2 of 3');
    });

    test('should edit existing variable', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'var1', name: 'TEST_VAR', value: 'old_value', type: 'string', scope: 'global' }]
      });
      
      // Right-click to show context menu
      const variableItem = container.querySelector('.variable-item');
      variableItem.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: 100,
        clientY: 200
      }));
      
      // Check context menu shown
      const contextMenu = container.querySelector('.variable-context-menu');
      expect(contextMenu.style.display).not.toBe('none');
      
      // Click edit option
      const editOption = contextMenu.querySelector('.edit-option');
      editOption.click();
      
      // Check edit dialog shown
      const editDialog = container.querySelector('.edit-variable-dialog');
      expect(editDialog.style.display).not.toBe('none');
      
      // Verify form is populated
      expect(editDialog.querySelector('input[name="name"]').value).toBe('TEST_VAR');
      expect(editDialog.querySelector('textarea[name="value"]').value).toBe('old_value');
      
      // Update value
      const valueInput = editDialog.querySelector('textarea[name="value"]');
      valueInput.value = 'updated_value';
      
      // Submit form
      const editForm = editDialog.querySelector('.edit-variable-form');
      editForm.dispatchEvent(new Event('submit'));
      
      // Verify update request
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'updateVariable',
        variableId: 'var1',
        updates: expect.objectContaining({
          value: 'updated_value'
        })
      });
    });

    test('should delete variable with confirmation', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'var1', name: 'DELETE_ME', value: 'to_be_deleted', type: 'string' }]
      });
      
      // Right-click to show context menu
      const variableItem = container.querySelector('.variable-item');
      variableItem.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: 100,
        clientY: 200
      }));
      
      // Click delete option
      const deleteOption = container.querySelector('.delete-option');
      deleteOption.click();
      
      // Check confirmation dialog
      const confirmation = container.querySelector('.delete-confirmation');
      expect(confirmation.style.display).not.toBe('none');
      expect(confirmation.textContent).toContain('DELETE_ME');
      
      // Confirm deletion
      const confirmButton = confirmation.querySelector('.confirm-delete');
      confirmButton.click();
      
      // Verify delete request
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'deleteVariable',
        variableId: 'var1'
      });
    });

    test('should handle different variable types correctly', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables with different types
      const variables = [
        { id: 'str_var', name: 'STRING_VAR', value: 'text value', type: 'string' },
        { id: 'bool_var', name: 'BOOL_VAR', value: true, type: 'boolean' },
        { id: 'num_var', name: 'NUM_VAR', value: 42, type: 'number' },
        { id: 'obj_var', name: 'OBJ_VAR', value: { key: 'value' }, type: 'object' }
      ];
      
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables
      });
      
      const variableItems = container.querySelectorAll('.variable-item');
      
      // Variables are sorted alphabetically: BOOL_VAR, NUM_VAR, OBJ_VAR, STRING_VAR
      // Check boolean variable (index 0)
      expect(variableItems[0].textContent).toContain('true');
      expect(variableItems[0].textContent).toContain('boolean');
      
      // Check number variable (index 1)
      expect(variableItems[1].textContent).toContain('42');
      expect(variableItems[1].textContent).toContain('number');
      
      // Check object variable (index 2)
      expect(variableItems[2].textContent).toContain('{"key":"value"}');
      expect(variableItems[2].textContent).toContain('object');
      
      // Check string variable (index 3)
      expect(variableItems[3].textContent).toContain('text value');
      expect(variableItems[3].textContent).toContain('string');
    });

    test('should import variables from JSON', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Click import button
      const importButton = container.querySelector('.import-variables-button');
      importButton.click();
      
      // Check import dialog is shown
      const importDialog = container.querySelector('.import-variables-dialog');
      expect(importDialog.style.display).not.toBe('none');
      
      // Fill JSON data
      const jsonTextarea = importDialog.querySelector('textarea');
      const importData = JSON.stringify([
        { name: 'IMPORTED_VAR1', value: 'imported1', type: 'string', scope: 'global' },
        { name: 'IMPORTED_VAR2', value: 123, type: 'number', scope: 'session' }
      ]);
      jsonTextarea.value = importData;
      
      // Submit import
      const importForm = importDialog.querySelector('.import-variables-form');
      importForm.dispatchEvent(new Event('submit'));
      
      // Verify import request
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'importVariables',
        variablesJson: importData
      });
    });

    test('should export variables to JSON file', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [
          { id: 'var1', name: 'EXPORT_VAR1', value: 'export1', type: 'string', scope: 'global' },
          { id: 'var2', name: 'EXPORT_VAR2', value: 456, type: 'number', scope: 'session' }
        ]
      });
      
      // Mock document.createElement for download link
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        remove: jest.fn()
      };
      mockCreateElement.mockReturnValue(mockLink);
      
      // Click export button
      const exportButton = container.querySelector('.export-variables-button');
      exportButton.click();
      
      // Verify download was triggered
      expect(mockLink.download).toBe('variables.json');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.remove).toHaveBeenCalled();
      
      mockCreateElement.mockRestore();
    });
  });

  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      VariablesPanel.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.actorSpace).toBeDefined();
      expect(requirements.config).toBeDefined();
    });

    test('should support validation mode', () => {
      let validationChecks = null;
      
      const umbilical = {
        validate: (checks) => {
          validationChecks = checks;
          return true;
        },
        dom: container,
        actorSpace: actorSpace
      };
      
      const result = VariablesPanel.create(umbilical);
      
      expect(result).toBe(true);
      expect(validationChecks).toBeDefined();
      expect(validationChecks.hasDomElement).toBe(true);
      expect(validationChecks.hasActorSpace).toBe(true);
    });

    test('should validate required properties', () => {
      // Missing dom
      expect(() => {
        VariablesPanel.create({ actorSpace });
      }).toThrow();
      
      // Missing actor space
      expect(() => {
        VariablesPanel.create({ dom: container });
      }).toThrow();
    });

    test('should handle lifecycle callbacks', () => {
      const onMount = jest.fn();
      const onDestroy = jest.fn();
      
      const umbilical = {
        dom: container,
        actorSpace,
        onMount,
        onDestroy
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      expect(onMount).toHaveBeenCalledWith(variablesPanel);
      
      variablesPanel.destroy();
      
      expect(onDestroy).toHaveBeenCalledWith(variablesPanel);
    });

    test('should expose public API', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      expect(variablesPanel).toBeDefined();
      expect(typeof variablesPanel.refreshVariables).toBe('function');
      expect(typeof variablesPanel.selectVariable).toBe('function');
      expect(typeof variablesPanel.createVariable).toBe('function');
      expect(typeof variablesPanel.deleteVariable).toBe('function');
      expect(typeof variablesPanel.searchVariables).toBe('function');
      expect(typeof variablesPanel.importVariables).toBe('function');
      expect(typeof variablesPanel.exportVariables).toBe('function');
      expect(typeof variablesPanel.destroy).toBe('function');
    });

    test('should handle configuration options', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: {
          theme: 'dark',
          groupByType: true,
          groupByScope: false,
          showDescriptions: true
        }
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Check theme applied
      const panel = container.querySelector('.variables-panel');
      expect(panel.classList.contains('variables-panel-theme-dark')).toBe(true);
      
      // Check grouping settings
      expect(variablesPanel.viewModel.groupByType).toBe(true);
      expect(variablesPanel.viewModel.groupByScope).toBe(false);
      
      // Check descriptions setting
      expect(variablesPanel.viewModel.showDescriptions).toBe(true);
    });
  });

  describe('Variable Grouping', () => {
    test('should display variables grouped by type', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: { groupByType: true }
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables with different types
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [
          { id: 'str1', name: 'STRING_VAR1', value: 'test1', type: 'string' },
          { id: 'str2', name: 'STRING_VAR2', value: 'test2', type: 'string' },
          { id: 'bool1', name: 'BOOL_VAR', value: true, type: 'boolean' },
          { id: 'num1', name: 'NUM_VAR', value: 42, type: 'number' }
        ]
      });
      
      // Check categories displayed
      const categories = container.querySelectorAll('.variable-category');
      expect(categories.length).toBe(3);
      
      const stringCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'String'
      );
      expect(stringCategory.querySelectorAll('.variable-item').length).toBe(2);
      
      const booleanCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'Boolean'
      );
      expect(booleanCategory.querySelectorAll('.variable-item').length).toBe(1);
    });

    test('should display variables grouped by scope', () => {
      const umbilical = {
        dom: container,
        actorSpace,
        config: { groupByScope: true }
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables with different scopes
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [
          { id: 'global1', name: 'GLOBAL_VAR1', value: 'g1', scope: 'global' },
          { id: 'global2', name: 'GLOBAL_VAR2', value: 'g2', scope: 'global' },
          { id: 'session1', name: 'SESSION_VAR', value: 's1', scope: 'session' },
          { id: 'local1', name: 'LOCAL_VAR', value: 'l1', scope: 'local' }
        ]
      });
      
      // Check categories displayed
      const categories = container.querySelectorAll('.variable-category');
      expect(categories.length).toBe(3);
      
      const globalCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'Global'
      );
      expect(globalCategory.querySelectorAll('.variable-item').length).toBe(2);
    });

    test('should toggle between flat and grouped views', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables with types
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [
          { id: 'var1', name: 'VAR1', value: 'test', type: 'string' },
          { id: 'var2', name: 'VAR2', value: true, type: 'boolean' }
        ]
      });
      
      // Initially flat list
      expect(container.querySelector('.variable-category')).toBeNull();
      expect(container.querySelectorAll('.variable-item').length).toBe(2);
      
      // Toggle to type view
      variablesPanel.toggleTypeView();
      
      expect(container.querySelectorAll('.variable-category').length).toBe(2);
      
      // Toggle back
      variablesPanel.toggleTypeView();
      
      expect(container.querySelector('.variable-category')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should display error when variables fail to load', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Simulate error response
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListError',
        error: 'Database connection failed'
      });
      
      // Check error displayed
      const errorMessage = container.querySelector('.variables-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain('Failed to load variables');
      
      // Check retry button
      const retryButton = errorMessage.querySelector('.retry-button');
      expect(retryButton).toBeDefined();
      
      // Click retry
      retryButton.click();
      
      // Verify new request sent
      expect(variablesActor.receive).toHaveBeenLastCalledWith({
        type: 'getVariables'
      });
    });

    test('should handle variable creation errors', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Simulate creation error
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variableCreationError',
        error: 'Variable name already exists'
      });
      
      // Check error displayed
      const errorMessage = container.querySelector('.variables-error');
      expect(errorMessage.textContent).toContain('Failed to create variable');
    });

    test('should handle invalid import data', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Click import button
      const importButton = container.querySelector('.import-variables-button');
      importButton.click();
      
      // Fill invalid JSON
      const jsonTextarea = container.querySelector('.import-variables-dialog textarea');
      jsonTextarea.value = 'invalid json';
      
      // Submit import
      const importForm = container.querySelector('.import-variables-form');
      importForm.dispatchEvent(new Event('submit'));
      
      // Check error displayed
      const errorMessage = container.querySelector('.variables-error');
      expect(errorMessage.textContent).toContain('Invalid JSON format');
    });

    test('should validate variable creation form', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Open new variable dialog
      const newButton = container.querySelector('.new-variable-button');
      newButton.click();
      
      // Submit empty form
      const form = container.querySelector('.new-variable-form');
      form.dispatchEvent(new Event('submit'));
      
      // Check validation error
      const errorMessage = container.querySelector('.variables-error');
      expect(errorMessage.textContent).toContain('Variable name is required');
    });
  });

  describe('Real-time Updates', () => {
    test('should update variable details in real-time', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'var1', name: 'ORIGINAL_NAME', value: 'original', type: 'string' }]
      });
      
      // Update variable details
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variableUpdated',
        variableId: 'var1',
        variable: { id: 'var1', name: 'UPDATED_NAME', value: 'updated', type: 'string' }
      });
      
      // Check details updated in view
      const variableItem = container.querySelector('[data-variable-id="var1"]');
      expect(variableItem.textContent).toContain('UPDATED_NAME');
      expect(variableItem.textContent).toContain('updated');
    });

    test('should add new variables dynamically', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load initial variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }]
      });
      
      expect(container.querySelectorAll('.variable-item').length).toBe(1);
      
      // Add new variable
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variableCreated',
        variable: { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
      });
      
      // Should refresh variables list
      expect(variablesActor.receive).toHaveBeenLastCalledWith({
        type: 'getVariables'
      });
    });

    test('should remove deleted variables dynamically', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [
          { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' },
          { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
        ]
      });
      
      expect(container.querySelectorAll('.variable-item').length).toBe(2);
      
      // Delete variable
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variableDeleted',
        variableId: 'var1'
      });
      
      expect(container.querySelectorAll('.variable-item').length).toBe(1);
      expect(container.querySelector('[data-variable-id="var1"]')).toBeNull();
      expect(container.querySelector('[data-variable-id="var2"]')).toBeDefined();
    });
  });

  describe('Variable Operations', () => {
    test('should duplicate variable', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'var1', name: 'ORIGINAL_VAR', value: 'original', type: 'string' }]
      });
      
      // Trigger duplicate action
      variablesPanel.duplicateVariable('var1');
      
      // Verify duplicate request
      expect(variablesActor.receive).toHaveBeenCalledWith({
        type: 'duplicateVariable',
        variableId: 'var1'
      });
    });

    test('should copy variable value to clipboard', () => {
      const umbilical = {
        dom: container,
        actorSpace
      };
      
      variablesPanel = VariablesPanel.create(umbilical);
      
      // Mock clipboard API
      const mockWriteText = jest.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText
        }
      });
      
      // Load variables
      variablesPanel.viewModel.handleActorUpdate({
        type: 'variablesListResponse',
        variables: [{ id: 'var1', name: 'SECRET_KEY', value: 'super_secret_123', type: 'string' }]
      });
      
      // Copy variable value
      variablesPanel.copyVariableValue('var1');
      
      // Verify clipboard write
      expect(mockWriteText).toHaveBeenCalledWith('super_secret_123');
    });
  });
});