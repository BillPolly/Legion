/**
 * Tests for VariablesPanelModel
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('VariablesPanelModel', () => {
  let VariablesPanelModel;
  let model;
  
  beforeEach(async () => {
    ({ VariablesPanelModel } = await import('../../../../src/components/variables-panel/VariablesPanelModel.js'));
    model = new VariablesPanelModel();
  });

  describe('Variable Management', () => {
    test('should initialize with empty variables list', () => {
      expect(model.getVariables()).toEqual([]);
      expect(model.searchQuery).toBe('');
      expect(model.selectedVariableId).toBeNull();
    });

    test('should set variables list', () => {
      const variables = [
        { id: 'var1', name: 'API_KEY', value: 'secret123', type: 'string', scope: 'global' },
        { id: 'var2', name: 'DEBUG_MODE', value: true, type: 'boolean', scope: 'session' }
      ];

      model.setVariables(variables);

      expect(model.getVariables()).toEqual(variables);
    });

    test('should emit event when variables are set', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      const variables = [{ id: 'var1', name: 'TEST_VAR', value: 'test', type: 'string' }];
      model.setVariables(variables);

      expect(listener).toHaveBeenCalledWith('variablesChanged', { variables });
    });

    test('should handle empty variables array', () => {
      model.setVariables([]);

      expect(model.getVariables()).toEqual([]);
    });

    test('should sort variables by name', () => {
      const variables = [
        { id: 'var2', name: 'ZEBRA', value: 'z', type: 'string' },
        { id: 'var1', name: 'ALPHA', value: 'a', type: 'string' },
        { id: 'var3', name: 'BETA', value: 'b', type: 'string' }
      ];

      model.setVariables(variables);
      const sorted = model.getVariables();

      expect(sorted[0].name).toBe('ALPHA');
      expect(sorted[1].name).toBe('BETA');
      expect(sorted[2].name).toBe('ZEBRA');
    });
  });

  describe('Variable Selection', () => {
    beforeEach(() => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' },
        { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
      ];
      model.setVariables(variables);
    });

    test('should select variable by id', () => {
      model.selectVariable('var1');

      expect(model.selectedVariableId).toBe('var1');
      expect(model.getSelectedVariable()).toEqual({
        id: 'var1', name: 'VAR1', value: 'value1', type: 'string'
      });
    });

    test('should emit event when variable is selected', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      model.selectVariable('var1');

      expect(listener).toHaveBeenCalledWith('variableSelected', {
        variableId: 'var1',
        variable: { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }
      });
    });

    test('should deselect variable when null is passed', () => {
      model.selectVariable('var1');
      model.selectVariable(null);

      expect(model.selectedVariableId).toBeNull();
      expect(model.getSelectedVariable()).toBeNull();
    });

    test('should not select non-existent variable', () => {
      model.selectVariable('nonexistent');

      expect(model.selectedVariableId).toBeNull();
    });

    test('should not emit event when selecting already selected variable', () => {
      model.selectVariable('var1');
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.selectVariable('var1');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Variable Creation', () => {
    test('should create new variable', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      const variableData = {
        name: 'NEW_VAR',
        value: 'new_value',
        type: 'string',
        scope: 'global',
        description: 'A new variable'
      };

      model.createVariable(variableData);

      expect(listener).toHaveBeenCalledWith('variableCreated', {
        variable: expect.objectContaining({
          ...variableData,
          id: expect.any(String),
          created: expect.any(Number),
          lastModified: expect.any(Number)
        })
      });
    });

    test('should generate unique variable IDs', () => {
      const var1Data = { name: 'VAR1', value: 'value1', type: 'string' };
      const var2Data = { name: 'VAR2', value: 'value2', type: 'string' };

      model.createVariable(var1Data);
      model.createVariable(var2Data);

      expect(model.pendingVariable).toBeDefined();
      // The last created variable should be stored in pendingVariable
      expect(model.pendingVariable.name).toBe('VAR2');
    });

    test('should validate required fields', () => {
      expect(() => {
        model.createVariable({ value: 'test', type: 'string' });
      }).toThrow('Variable name is required');

      expect(() => {
        model.createVariable({ name: 'TEST' });
      }).toThrow('Variable value is required');

      expect(() => {
        model.createVariable({ name: 'TEST', value: 'value' });
      }).toThrow('Variable type is required');
    });

    test('should validate variable name format', () => {
      expect(() => {
        model.createVariable({ name: '123invalid', value: 'test', type: 'string' });
      }).toThrow('Variable name must be a valid identifier');

      expect(() => {
        model.createVariable({ name: 'invalid-name', value: 'test', type: 'string' });
      }).toThrow('Variable name must be a valid identifier');
    });

    test('should validate variable types', () => {
      expect(() => {
        model.createVariable({ name: 'TEST', value: 'invalid', type: 'boolean' });
      }).toThrow('Boolean variable must have true/false value');

      expect(() => {
        model.createVariable({ name: 'TEST', value: 'invalid', type: 'number' });
      }).toThrow('Number variable must have numeric value');
    });
  });

  describe('Variable Updates', () => {
    beforeEach(() => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string', lastModified: 100 }
      ];
      model.setVariables(variables);
    });

    test('should update variable details', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      model.updateVariable('var1', { value: 'updated_value', description: 'Updated' });

      const variable = model.getVariableById('var1');
      expect(variable.value).toBe('updated_value');
      expect(variable.description).toBe('Updated');
      expect(variable.lastModified).toBeGreaterThan(100);

      expect(listener).toHaveBeenCalledWith('variableUpdated', {
        variableId: 'var1',
        updates: { value: 'updated_value', description: 'Updated' }
      });
    });

    test('should not update non-existent variable', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      model.updateVariable('nonexistent', { value: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });

    test('should validate updates', () => {
      expect(() => {
        model.updateVariable('var1', { type: 'boolean', value: 'invalid' });
      }).toThrow('Boolean variable must have true/false value');
    });

    test('should re-sort variables after name update', () => {
      model.setVariables([
        { id: 'var1', name: 'ALPHA', value: 'a', type: 'string' },
        { id: 'var2', name: 'BETA', value: 'b', type: 'string' }
      ]);

      model.updateVariable('var1', { name: 'ZULU' });

      const variables = model.getVariables();
      expect(variables[0].name).toBe('BETA');
      expect(variables[1].name).toBe('ZULU');
    });
  });

  describe('Variable Deletion', () => {
    beforeEach(() => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' },
        { id: 'var2', name: 'VAR2', value: 'value2', type: 'string' }
      ];
      model.setVariables(variables);
    });

    test('should delete variable by id', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      model.deleteVariable('var1');

      expect(model.getVariableById('var1')).toBeNull();
      expect(model.getVariables()).toHaveLength(1);

      expect(listener).toHaveBeenCalledWith('variableDeleted', { variableId: 'var1' });
    });

    test('should deselect deleted variable', () => {
      model.selectVariable('var1');
      model.deleteVariable('var1');

      expect(model.selectedVariableId).toBeNull();
    });

    test('should handle deletion of non-existent variable', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      model.deleteVariable('nonexistent');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      const variables = [
        { id: 'var1', name: 'API_KEY', value: 'secret123', type: 'string', description: 'API access key' },
        { id: 'var2', name: 'DEBUG_MODE', value: true, type: 'boolean', description: 'Enable debugging' },
        { id: 'var3', name: 'TIMEOUT', value: 5000, type: 'number', description: 'Request timeout' }
      ];
      model.setVariables(variables);
    });

    test('should set search query', () => {
      const listener = jest.fn();
      model.subscribe(listener);

      model.setSearchQuery('api');

      expect(model.searchQuery).toBe('api');
      expect(listener).toHaveBeenCalledWith('searchQueryChanged', { query: 'api' });
    });

    test('should filter variables by name', () => {
      model.setSearchQuery('api');

      const filtered = model.getFilteredVariables();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('API_KEY');
    });

    test('should filter variables by description', () => {
      model.setSearchQuery('timeout');

      const filtered = model.getFilteredVariables();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('TIMEOUT');
    });

    test('should filter variables by type', () => {
      model.setSearchQuery('boolean');

      const filtered = model.getFilteredVariables();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('DEBUG_MODE');
    });

    test('should filter case-insensitively', () => {
      model.setSearchQuery('API');

      const filtered = model.getFilteredVariables();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('API_KEY');
    });

    test('should return all variables when search is empty', () => {
      model.setSearchQuery('');

      const filtered = model.getFilteredVariables();
      expect(filtered).toHaveLength(3);
    });

    test('should trim search query', () => {
      model.setSearchQuery('  api  ');

      expect(model.searchQuery).toBe('api');
    });

    test('should not emit event when setting same query', () => {
      model.setSearchQuery('api');
      
      const listener = jest.fn();
      model.subscribe(listener);
      
      model.setSearchQuery('api');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Variable Types and Scopes', () => {
    beforeEach(() => {
      const variables = [
        { id: 'var1', name: 'STRING_VAR', value: 'text', type: 'string', scope: 'global' },
        { id: 'var2', name: 'BOOL_VAR', value: true, type: 'boolean', scope: 'session' },
        { id: 'var3', name: 'NUM_VAR', value: 42, type: 'number', scope: 'local' },
        { id: 'var4', name: 'OBJ_VAR', value: { key: 'value' }, type: 'object', scope: 'global' }
      ];
      model.setVariables(variables);
    });

    test('should group variables by type', () => {
      const grouped = model.getVariablesByType();

      expect(grouped.string).toHaveLength(1);
      expect(grouped.boolean).toHaveLength(1);
      expect(grouped.number).toHaveLength(1);
      expect(grouped.object).toHaveLength(1);
    });

    test('should group variables by scope', () => {
      const grouped = model.getVariablesByScope();

      expect(grouped.global).toHaveLength(2);
      expect(grouped.session).toHaveLength(1);
      expect(grouped.local).toHaveLength(1);
    });

    test('should get available variable types', () => {
      const types = model.getVariableTypes();

      expect(types).toContain('string');
      expect(types).toContain('boolean');
      expect(types).toContain('number');
      expect(types).toContain('object');
      expect(types).toHaveLength(4);
    });

    test('should get available variable scopes', () => {
      const scopes = model.getVariableScopes();

      expect(scopes).toContain('global');
      expect(scopes).toContain('session');
      expect(scopes).toContain('local');
      expect(scopes).toHaveLength(3);
    });

    test('should handle variables without type or scope', () => {
      model.setVariables([
        { id: 'var1', name: 'NO_TYPE', value: 'test' },
        { id: 'var2', name: 'NO_SCOPE', value: 'test', type: 'string' }
      ]);

      const byType = model.getVariablesByType();
      const byScope = model.getVariablesByScope();

      expect(byType.Unknown).toHaveLength(1);
      expect(byScope.Unknown).toHaveLength(2); // Both variables have no scope defined
    });
  });

  describe('Variable Details', () => {
    beforeEach(() => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string', lastModified: Date.now() },
        { id: 'var2', name: 'VAR2', value: 'value2', type: 'string', lastModified: Date.now() - 1000 }
      ];
      model.setVariables(variables);
    });

    test('should get variable by id', () => {
      const variable = model.getVariableById('var1');

      expect(variable).toBeDefined();
      expect(variable.name).toBe('VAR1');
    });

    test('should return null for non-existent variable', () => {
      const variable = model.getVariableById('nonexistent');

      expect(variable).toBeNull();
    });

    test('should get recent variables', () => {
      const recent = model.getRecentVariables(1);

      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe('VAR1'); // Most recent first
    });

    test('should get variables by name pattern', () => {
      model.setVariables([
        { id: 'var1', name: 'API_KEY_PROD', value: 'prod', type: 'string' },
        { id: 'var2', name: 'API_KEY_DEV', value: 'dev', type: 'string' },
        { id: 'var3', name: 'DB_HOST', value: 'localhost', type: 'string' }
      ]);

      const apiKeys = model.getVariablesByPattern(/^API_KEY/);
      expect(apiKeys).toHaveLength(2);
    });
  });

  describe('Variable Validation', () => {
    test('should validate string variables', () => {
      expect(model.validateVariableValue('test', 'string')).toBe(true);
      expect(model.validateVariableValue(123, 'string')).toBe(false);
      expect(model.validateVariableValue(null, 'string')).toBe(false);
    });

    test('should validate boolean variables', () => {
      expect(model.validateVariableValue(true, 'boolean')).toBe(true);
      expect(model.validateVariableValue(false, 'boolean')).toBe(true);
      expect(model.validateVariableValue('true', 'boolean')).toBe(false);
      expect(model.validateVariableValue(1, 'boolean')).toBe(false);
    });

    test('should validate number variables', () => {
      expect(model.validateVariableValue(42, 'number')).toBe(true);
      expect(model.validateVariableValue(3.14, 'number')).toBe(true);
      expect(model.validateVariableValue('42', 'number')).toBe(false);
      expect(model.validateVariableValue(NaN, 'number')).toBe(false);
    });

    test('should validate object variables', () => {
      expect(model.validateVariableValue({}, 'object')).toBe(true);
      expect(model.validateVariableValue({ key: 'value' }, 'object')).toBe(true);
      expect(model.validateVariableValue([], 'object')).toBe(true);
      expect(model.validateVariableValue(null, 'object')).toBe(false);
      expect(model.validateVariableValue('object', 'object')).toBe(false);
    });

    test('should validate variable names', () => {
      expect(model.isValidVariableName('VALID_NAME')).toBe(true);
      expect(model.isValidVariableName('valid_name')).toBe(true);
      expect(model.isValidVariableName('ValidName123')).toBe(true);
      expect(model.isValidVariableName('_validName')).toBe(true);
      
      expect(model.isValidVariableName('123invalid')).toBe(false);
      expect(model.isValidVariableName('invalid-name')).toBe(false);
      expect(model.isValidVariableName('invalid.name')).toBe(false);
      expect(model.isValidVariableName('invalid name')).toBe(false);
      expect(model.isValidVariableName('')).toBe(false);
    });
  });

  describe('Variable Import/Export', () => {
    test('should export variables as JSON', () => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string', scope: 'global' }
      ];
      model.setVariables(variables);

      const exported = model.exportVariables();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('VAR1');
      expect(parsed[0]).not.toHaveProperty('id'); // IDs should be excluded
    });

    test('should import variables from JSON', () => {
      const variablesJson = JSON.stringify([
        { name: 'IMPORTED_VAR', value: 'imported', type: 'string', scope: 'global' }
      ]);

      const listener = jest.fn();
      model.subscribe(listener);

      model.importVariables(variablesJson);

      expect(listener).toHaveBeenCalledWith('variablesImported', {
        variables: expect.arrayContaining([
          expect.objectContaining({
            name: 'IMPORTED_VAR',
            value: 'imported'
          })
        ])
      });
    });

    test('should handle invalid JSON during import', () => {
      expect(() => {
        model.importVariables('invalid json');
      }).toThrow('Invalid JSON format');
    });

    test('should validate imported variables', () => {
      const invalidJson = JSON.stringify([
        { name: 'invalid-name', value: 'test', type: 'string' }
      ]);

      expect(() => {
        model.importVariables(invalidJson);
      }).toThrow('Variable name must be a valid identifier');
    });
  });

  describe('Cleanup', () => {
    test('should clear all data on destroy', () => {
      const variables = [
        { id: 'var1', name: 'VAR1', value: 'value1', type: 'string' }
      ];
      model.setVariables(variables);
      model.selectVariable('var1');
      model.setSearchQuery('test');

      model.destroy();

      expect(model.getVariables()).toEqual([]);
      expect(model.selectedVariableId).toBeNull();
      expect(model.searchQuery).toBe('');
      expect(model.pendingVariable).toBeNull();
    });
  });
});