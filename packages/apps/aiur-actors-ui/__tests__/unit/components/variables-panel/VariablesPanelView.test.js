/**
 * Tests for VariablesPanelView
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('VariablesPanelView', () => {
  let VariablesPanelView;
  let view;
  let container;
  
  beforeEach(async () => {
    ({ VariablesPanelView } = await import('../../../../src/components/variables-panel/VariablesPanelView.js'));
    
    container = document.createElement('div');
    document.body.appendChild(container);
    
    view = new VariablesPanelView(container);
  });
  
  afterEach(() => {
    if (view) {
      view.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initial Rendering', () => {
    test('should render variables panel structure', () => {
      view.render();

      const panel = container.querySelector('.variables-panel');
      expect(panel).toBeDefined();

      expect(container.querySelector('.variables-header')).toBeDefined();
      expect(container.querySelector('.variables-search')).toBeDefined();
      expect(container.querySelector('.variables-actions')).toBeDefined();
      expect(container.querySelector('.variables-list')).toBeDefined();
    });

    test('should render search input', () => {
      view.render();

      const searchInput = container.querySelector('.variables-search input');
      expect(searchInput).toBeDefined();
      expect(searchInput.placeholder).toBe('Search variables...');
      expect(searchInput.type).toBe('text');
    });

    test('should render action buttons', () => {
      view.render();

      const newButton = container.querySelector('.new-variable-button');
      const importButton = container.querySelector('.import-variables-button');
      const exportButton = container.querySelector('.export-variables-button');

      expect(newButton).toBeDefined();
      expect(importButton).toBeDefined();
      expect(exportButton).toBeDefined();
      expect(newButton.textContent).toBe('+ New Variable');
    });

    test('should show empty state when no variables', () => {
      view.render();

      expect(container.querySelector('.variables-empty')).toBeDefined();
    });

    test('should apply theme class if provided', () => {
      view.render({ theme: 'dark' });

      const panel = container.querySelector('.variables-panel');
      expect(panel.classList.contains('variables-panel-theme-dark')).toBe(true);
    });

    test('should render dialogs', () => {
      view.render();

      expect(container.querySelector('.new-variable-dialog')).toBeDefined();
      expect(container.querySelector('.edit-variable-dialog')).toBeDefined();
      expect(container.querySelector('.import-variables-dialog')).toBeDefined();
      expect(container.querySelector('.delete-confirmation')).toBeDefined();
    });
  });

  describe('Variables Display', () => {
    beforeEach(() => {
      view.render();
    });

    test('should render list of variables', () => {
      const variables = [
        { id: 'var1', name: 'API_KEY', value: 'secret123', type: 'string', scope: 'global' },
        { id: 'var2', name: 'DEBUG_MODE', value: true, type: 'boolean', scope: 'session' }
      ];

      view.renderVariables(variables);

      const variableItems = container.querySelectorAll('.variable-item');
      expect(variableItems.length).toBe(2);
      expect(variableItems[0].textContent).toContain('API_KEY');
      expect(variableItems[1].textContent).toContain('DEBUG_MODE');
    });

    test('should display variable types and scopes', () => {
      const variables = [
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string', scope: 'global' }
      ];

      view.renderVariables(variables);

      const variableItem = container.querySelector('.variable-item');
      expect(variableItem.textContent).toContain('string');
      expect(variableItem.textContent).toContain('global');
    });

    test('should display variable values based on type', () => {
      const variables = [
        { id: 'var1', name: 'STRING_VAR', value: 'text value', type: 'string' },
        { id: 'var2', name: 'BOOL_VAR', value: true, type: 'boolean' },
        { id: 'var3', name: 'NUM_VAR', value: 42, type: 'number' },
        { id: 'var4', name: 'OBJ_VAR', value: { key: 'value' }, type: 'object' }
      ];

      view.renderVariables(variables);

      const items = container.querySelectorAll('.variable-item');
      expect(items[0].textContent).toContain('text value');
      expect(items[1].textContent).toContain('true');
      expect(items[2].textContent).toContain('42');
      expect(items[3].textContent).toContain('{"key":"value"}');
    });

    test('should render variables grouped by type', () => {
      const variablesByType = {
        string: [
          { id: 'var1', name: 'STRING_VAR', value: 'test', type: 'string' }
        ],
        boolean: [
          { id: 'var2', name: 'BOOL_VAR', value: true, type: 'boolean' }
        ]
      };

      view.renderVariablesByType(variablesByType);

      const categories = container.querySelectorAll('.variable-category');
      expect(categories.length).toBe(2);

      const stringCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'String'
      );
      expect(stringCategory).toBeDefined();
      expect(stringCategory.querySelectorAll('.variable-item').length).toBe(1);

      const booleanCategory = Array.from(categories).find(cat => 
        cat.querySelector('.category-header').textContent === 'Boolean'
      );
      expect(booleanCategory).toBeDefined();
      expect(booleanCategory.querySelectorAll('.variable-item').length).toBe(1);
    });

    test('should render variables grouped by scope', () => {
      const variablesByScope = {
        global: [
          { id: 'var1', name: 'GLOBAL_VAR', value: 'test', scope: 'global' }
        ],
        session: [
          { id: 'var2', name: 'SESSION_VAR', value: 'test', scope: 'session' }
        ]
      };

      view.renderVariablesByScope(variablesByScope);

      const categories = container.querySelectorAll('.variable-category');
      expect(categories.length).toBe(2);

      expect(container.textContent).toContain('Global');
      expect(container.textContent).toContain('Session');
    });

    test('should handle variables without descriptions', () => {
      const variables = [
        { id: 'var1', name: 'NO_DESC', value: 'test', type: 'string' }
      ];

      view.renderVariables(variables);

      const variableItem = container.querySelector('.variable-item');
      expect(variableItem).toBeDefined();
    });

    test('should show variable descriptions when available', () => {
      const variables = [
        { id: 'var1', name: 'WITH_DESC', value: 'test', type: 'string', description: 'Test variable' }
      ];

      view.renderVariables(variables);

      const description = container.querySelector('.variable-description');
      expect(description.textContent).toBe('Test variable');
    });

    test('should truncate long values', () => {
      const longValue = 'a'.repeat(200);
      const variables = [
        { id: 'var1', name: 'LONG_VAR', value: longValue, type: 'string' }
      ];

      view.renderVariables(variables);

      const valueElement = container.querySelector('.variable-value');
      expect(valueElement.textContent.length).toBeLessThan(longValue.length);
      expect(valueElement.textContent).toContain('...');
    });
  });

  describe('Variable Selection', () => {
    beforeEach(() => {
      view.render();
      
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' },
        { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
      ];
      view.renderVariables(variables);
    });

    test('should highlight selected variable', () => {
      view.setSelectedVariable('var1');

      const selectedItem = container.querySelector('.variable-item.selected');
      expect(selectedItem).toBeDefined();
      expect(selectedItem.dataset.variableId).toBe('var1');
    });

    test('should clear selection when null', () => {
      view.setSelectedVariable('var1');
      view.setSelectedVariable(null);

      const selectedItem = container.querySelector('.variable-item.selected');
      expect(selectedItem).toBeNull();
    });

    test('should handle selection of non-existent variable', () => {
      view.setSelectedVariable('nonexistent');

      const selectedItem = container.querySelector('.variable-item.selected');
      expect(selectedItem).toBeNull();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      view.render();
    });

    test('should update search input value', () => {
      view.setSearchQuery('test query');

      const searchInput = container.querySelector('.variables-search input');
      expect(searchInput.value).toBe('test query');
    });

    test('should show search results count', () => {
      view.showSearchResults(5, 10);

      const resultsCount = container.querySelector('.search-results-count');
      expect(resultsCount.textContent).toBe('5 of 10 variables');
      expect(resultsCount.style.display).not.toBe('none');
    });

    test('should show no results message', () => {
      view.showNoResults('nonexistent');

      expect(container.textContent).toContain('No variables found for "nonexistent"');
    });

    test('should show clear search button when query exists', () => {
      view.setSearchQuery('test');

      const clearButton = container.querySelector('.search-clear');
      expect(clearButton.style.display).not.toBe('none');
    });

    test('should hide clear search button when query is empty', () => {
      view.setSearchQuery('');

      const clearButton = container.querySelector('.search-clear');
      expect(clearButton.style.display).toBe('none');
    });
  });

  describe('Variable Creation Dialog', () => {
    beforeEach(() => {
      view.render();
    });

    test('should show new variable dialog', () => {
      view.showNewVariableDialog();

      const dialog = container.querySelector('.new-variable-dialog');
      expect(dialog.style.display).not.toBe('none');

      // Should focus name input
      const nameInput = dialog.querySelector('input[name="name"]');
      expect(document.activeElement).toBe(nameInput);
    });

    test('should hide new variable dialog', () => {
      view.showNewVariableDialog();
      view.hideNewVariableDialog();

      const dialog = container.querySelector('.new-variable-dialog');
      expect(dialog.style.display).toBe('none');
    });

    test('should clear dialog form when hidden', () => {
      view.showNewVariableDialog();
      
      const nameInput = container.querySelector('.new-variable-dialog input[name="name"]');
      nameInput.value = 'TEST_VAR';
      
      view.hideNewVariableDialog();
      view.showNewVariableDialog();

      expect(nameInput.value).toBe('');
    });

    test('should populate variable type options', () => {
      view.showNewVariableDialog();

      const typeSelect = container.querySelector('.new-variable-dialog select[name="type"]');
      const options = typeSelect.querySelectorAll('option');
      
      expect(options.length).toBeGreaterThan(1);
      expect(Array.from(options).some(opt => opt.value === 'string')).toBe(true);
      expect(Array.from(options).some(opt => opt.value === 'boolean')).toBe(true);
      expect(Array.from(options).some(opt => opt.value === 'number')).toBe(true);
    });

    test('should populate variable scope options', () => {
      view.showNewVariableDialog();

      const scopeSelect = container.querySelector('.new-variable-dialog select[name="scope"]');
      const options = scopeSelect.querySelectorAll('option');
      
      expect(Array.from(options).some(opt => opt.value === 'global')).toBe(true);
      expect(Array.from(options).some(opt => opt.value === 'session')).toBe(true);
      expect(Array.from(options).some(opt => opt.value === 'local')).toBe(true);
    });
  });

  describe('Variable Edit Dialog', () => {
    beforeEach(() => {
      view.render();
    });

    test('should show edit variable dialog', () => {
      const variable = {
        id: 'var1',
        name: 'TEST_VAR',
        value: 'test_value',
        type: 'string',
        scope: 'global',
        description: 'Test variable'
      };

      view.showEditVariableDialog(variable);

      const dialog = container.querySelector('.edit-variable-dialog');
      expect(dialog.style.display).not.toBe('none');

      // Should populate form with variable data
      expect(dialog.querySelector('input[name="name"]').value).toBe('TEST_VAR');
      expect(dialog.querySelector('textarea[name="value"]').value).toBe('test_value');
      expect(dialog.querySelector('select[name="type"]').value).toBe('string');
      expect(dialog.querySelector('select[name="scope"]').value).toBe('global');
      expect(dialog.querySelector('textarea[name="description"]').value).toBe('Test variable');
    });

    test('should handle different value types in edit dialog', () => {
      const booleanVar = { id: 'var1', name: 'BOOL_VAR', value: true, type: 'boolean' };
      view.showEditVariableDialog(booleanVar);

      const valueField = container.querySelector('.edit-variable-dialog [name="value"]');
      expect(valueField.value).toBe('true');

      const numberVar = { id: 'var2', name: 'NUM_VAR', value: 42, type: 'number' };
      view.showEditVariableDialog(numberVar);
      expect(valueField.value).toBe('42');

      const objectVar = { id: 'var3', name: 'OBJ_VAR', value: { key: 'value' }, type: 'object' };
      view.showEditVariableDialog(objectVar);
      expect(valueField.value).toBe('{\n  "key": "value"\n}');
    });

    test('should hide edit variable dialog', () => {
      const variable = { id: 'var1', name: 'TEST', value: 'test', type: 'string' };
      view.showEditVariableDialog(variable);
      view.hideEditVariableDialog();

      const dialog = container.querySelector('.edit-variable-dialog');
      expect(dialog.style.display).toBe('none');
    });
  });

  describe('Import/Export Dialogs', () => {
    beforeEach(() => {
      view.render();
    });

    test('should show import variables dialog', () => {
      view.showImportVariablesDialog();

      const dialog = container.querySelector('.import-variables-dialog');
      expect(dialog.style.display).not.toBe('none');

      const textarea = dialog.querySelector('textarea');
      expect(textarea.placeholder).toContain('JSON');
    });

    test('should hide import variables dialog', () => {
      view.showImportVariablesDialog();
      view.hideImportVariablesDialog();

      const dialog = container.querySelector('.import-variables-dialog');
      expect(dialog.style.display).toBe('none');
    });

    test('should trigger export download', () => {
      const mockCreateElement = jest.spyOn(document, 'createElement');
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        remove: jest.fn()
      };
      mockCreateElement.mockReturnValue(mockLink);

      const variablesJson = JSON.stringify([{ name: 'TEST', value: 'test' }]);
      view.triggerExportDownload(variablesJson);

      expect(mockLink.download).toBe('variables.json');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.remove).toHaveBeenCalled();

      mockCreateElement.mockRestore();
    });
  });

  describe('Variable Actions', () => {
    beforeEach(() => {
      view.render();

      const variables = [
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }
      ];
      view.renderVariables(variables);
    });

    test('should show variable context menu', () => {
      view.showVariableContextMenu('var1', { x: 100, y: 200 });

      const contextMenu = container.querySelector('.variable-context-menu');
      expect(contextMenu.style.display).not.toBe('none');
      expect(contextMenu.style.left).toBe('100px');
      expect(contextMenu.style.top).toBe('200px');
      expect(contextMenu.dataset.variableId).toBe('var1');
    });

    test('should hide variable context menu', () => {
      view.showVariableContextMenu('var1', { x: 100, y: 200 });
      view.hideVariableContextMenu();

      const contextMenu = container.querySelector('.variable-context-menu');
      expect(contextMenu.style.display).toBe('none');
      expect(contextMenu.dataset.variableId).toBeUndefined();
    });

    test('should show delete confirmation', () => {
      const variable = { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' };
      view.showDeleteConfirmation(variable);

      const confirmation = container.querySelector('.delete-confirmation');
      expect(confirmation.style.display).not.toBe('none');
      expect(confirmation.textContent).toContain('TEST_VAR');
      expect(confirmation.dataset.variableId).toBe('var1');
    });

    test('should hide delete confirmation', () => {
      const variable = { id: 'var1', name: 'TEST', value: 'test', type: 'string' };
      view.showDeleteConfirmation(variable);
      view.hideDeleteConfirmation();

      const confirmation = container.querySelector('.delete-confirmation');
      expect(confirmation.style.display).toBe('none');
      expect(confirmation.dataset.variableId).toBeUndefined();
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      view.render();
    });

    test('should call onVariableClick when variable is clicked', () => {
      const mockHandler = jest.fn();
      view.onVariableClick = mockHandler;

      const variables = [
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }
      ];
      view.renderVariables(variables);

      const variableItem = container.querySelector('.variable-item');
      variableItem.click();

      expect(mockHandler).toHaveBeenCalledWith({
        id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string'
      });
    });

    test('should call onSearchInput when typing in search', () => {
      const mockHandler = jest.fn();
      view.onSearchInput = mockHandler;

      const searchInput = container.querySelector('.variables-search input');
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));

      expect(mockHandler).toHaveBeenCalledWith('test');
    });

    test('should call onNewVariable when new variable button clicked', () => {
      const mockHandler = jest.fn();
      view.onNewVariable = mockHandler;

      const newButton = container.querySelector('.new-variable-button');
      newButton.click();

      expect(mockHandler).toHaveBeenCalled();
    });

    test('should call onCreateVariable when dialog form submitted', () => {
      const mockHandler = jest.fn();
      view.onCreateVariable = mockHandler;

      view.showNewVariableDialog();

      const form = container.querySelector('.new-variable-form');
      const nameInput = form.querySelector('input[name="name"]');
      const valueInput = form.querySelector('textarea[name="value"]');
      const typeSelect = form.querySelector('select[name="type"]');

      nameInput.value = 'NEW_VAR';
      valueInput.value = 'new_value';
      typeSelect.value = 'string';

      form.dispatchEvent(new Event('submit'));

      expect(mockHandler).toHaveBeenCalledWith({
        name: 'NEW_VAR',
        value: 'new_value',
        type: 'string',
        scope: 'local',
        description: ''
      });
    });

    test('should not call onVariableClick for disabled variables', () => {
      const mockHandler = jest.fn();
      view.onVariableClick = mockHandler;

      const variables = [
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }
      ];
      view.renderVariables(variables);

      const variableItem = container.querySelector('.variable-item');
      variableItem.classList.add('disabled');
      variableItem.click();

      expect(mockHandler).not.toHaveBeenCalled();
    });

    test('should handle right-click for context menu', () => {
      const mockHandler = jest.fn();
      view.onVariableRightClick = mockHandler;

      const variables = [
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }
      ];
      view.renderVariables(variables);

      const variableItem = container.querySelector('.variable-item');
      variableItem.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: 100,
        clientY: 200
      }));

      expect(mockHandler).toHaveBeenCalledWith(
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' },
        { x: 100, y: 200 }
      );
    });
  });

  describe('Visual States', () => {
    beforeEach(() => {
      view.render();
    });

    test('should show loading state for entire panel', () => {
      view.setLoading(true);

      const panel = container.querySelector('.variables-panel');
      expect(panel.classList.contains('loading')).toBe(true);

      const loadingOverlay = container.querySelector('.variables-loading');
      expect(loadingOverlay).toBeDefined();
      expect(loadingOverlay.textContent).toBe('Loading variables...');
    });

    test('should hide loading state', () => {
      view.setLoading(true);
      view.setLoading(false);

      const panel = container.querySelector('.variables-panel');
      expect(panel.classList.contains('loading')).toBe(false);

      const loadingOverlay = container.querySelector('.variables-loading');
      expect(loadingOverlay).toBeNull();
    });

    test('should show error state', () => {
      view.showError('Failed to load variables');

      const errorMessage = container.querySelector('.variables-error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain('Failed to load variables');

      const retryButton = errorMessage.querySelector('.retry-button');
      expect(retryButton).toBeDefined();
    });

    test('should clear error state', () => {
      view.showError('Test error');
      view.clearError();

      const errorMessage = container.querySelector('.variables-error');
      expect(errorMessage).toBeNull();
    });

    test('should highlight variable on hover', () => {
      const variables = [
        { id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }
      ];
      view.renderVariables(variables);

      const variableItem = container.querySelector('.variable-item');
      variableItem.dispatchEvent(new Event('mouseenter'));

      expect(variableItem.classList.contains('hover')).toBe(true);

      variableItem.dispatchEvent(new Event('mouseleave'));

      expect(variableItem.classList.contains('hover')).toBe(false);
    });

    test('should set highlighted variable for keyboard navigation', () => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'test', type: 'string' },
        { id: 'var2', name: 'VAR2', value: 'test', type: 'string' }
      ];
      view.renderVariables(variables);

      view.setHighlightedVariable('var2');

      const highlightedItem = container.querySelector('.variable-item.highlighted');
      expect(highlightedItem).toBeDefined();
      expect(highlightedItem.dataset.variableId).toBe('var2');
    });
  });

  describe('Cleanup', () => {
    test('should remove all event listeners on destroy', () => {
      view.render();
      
      const panel = container.querySelector('.variables-panel');
      expect(panel).toBeDefined();

      view.destroy();

      // Check that panel is removed
      expect(container.querySelector('.variables-panel')).toBeNull();
    });

    test('should clear container on destroy', () => {
      view.render();
      
      expect(container.children.length).toBeGreaterThan(0);

      view.destroy();

      expect(container.children.length).toBe(0);
    });

    test('should clear all callbacks on destroy', () => {
      view.onVariableClick = jest.fn();
      view.onSearchInput = jest.fn();
      view.onNewVariable = jest.fn();

      view.destroy();

      expect(view.onVariableClick).toBeNull();
      expect(view.onSearchInput).toBeNull();
      expect(view.onNewVariable).toBeNull();
    });
  });
});