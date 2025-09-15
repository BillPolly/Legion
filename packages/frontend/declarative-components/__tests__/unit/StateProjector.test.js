/**
 * Unit tests for StateProjector utility
 * Tests complex projection rules with array indexing and nested property projection
 */

import { StateProjector } from '../../src/utils/StateProjector.js';

describe('StateProjector', () => {
  let projector;

  beforeEach(() => {
    projector = new StateProjector();
  });

  describe('Constructor', () => {
    it('should create StateProjector with default empty rules', () => {
      expect(projector).toBeInstanceOf(StateProjector);
      expect(projector.projectionRules).toEqual({});
      expect(projector.variables).toBeInstanceOf(Map);
      expect(projector.variables.size).toBe(0);
    });

    it('should create StateProjector with initial rules', () => {
      const initialRules = {
        'local.prop': 'parent.prop',
        'item.name': 'data.items[0].name'
      };

      const projectorWithRules = new StateProjector(initialRules);

      expect(projectorWithRules.projectionRules).toEqual(initialRules);
    });

    it('should validate initial rules format', () => {
      expect(() => {
        new StateProjector('invalid rules');
      }).toThrow('Initial rules must be an object');

      expect(() => {
        new StateProjector(['invalid', 'rules']);
      }).toThrow('Initial rules must be an object');
    });
  });

  describe('Project Method', () => {
    it('should project simple property paths', () => {
      const rules = {
        'child.name': 'parent.title',
        'child.value': 'parent.data.value',
        'local.setting': 'global.config.setting'
      };

      projector.setProjectionRules(rules);

      expect(projector.project('child.name')).toBe('parent.title');
      expect(projector.project('child.value')).toBe('parent.data.value');
      expect(projector.project('local.setting')).toBe('global.config.setting');
      expect(projector.project('unmapped.path')).toBe('unmapped.path');
    });

    it('should handle static array indexing in projection rules', () => {
      const rules = {
        'current.id': 'items[0].id',
        'first.name': 'users[0].profile.name',
        'third.value': 'data.list[2].value',
        'nested.array': 'complex.data[1].items[3].property'
      };

      projector.setProjectionRules(rules);

      expect(projector.project('current.id')).toBe('items[0].id');
      expect(projector.project('first.name')).toBe('users[0].profile.name');
      expect(projector.project('third.value')).toBe('data.list[2].value');
      expect(projector.project('nested.array')).toBe('complex.data[1].items[3].property');
    });

    it('should resolve dynamic variables in projection paths', () => {
      const rules = {
        'current.item': 'items[{index}].data',
        'user.profile': 'users[{userId}].profile',
        'nested.prop': 'data[{category}].items[{position}].value'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('index', 2);
      projector.setVariable('userId', 'user123');
      projector.setVariable('category', 'products');
      projector.setVariable('position', 5);

      expect(projector.project('current.item')).toBe('items[2].data');
      expect(projector.project('user.profile')).toBe('users[user123].profile');
      expect(projector.project('nested.prop')).toBe('data[products].items[5].value');
    });

    it('should handle multiple variables in single projection path', () => {
      const rules = {
        'complex.path': 'data[{type}].collections[{collectionId}].items[{itemIndex}].properties[{propName}]'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('type', 'user_data');
      projector.setVariable('collectionId', 42);
      projector.setVariable('itemIndex', 7);
      projector.setVariable('propName', 'displayName');

      expect(projector.project('complex.path')).toBe('data[user_data].collections[42].items[7].properties[displayName]');
    });

    it('should handle partial variable resolution', () => {
      const rules = {
        'partial.path': 'items[{index}].data[{missing}].value'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('index', 3);
      // 'missing' variable not set

      expect(projector.project('partial.path')).toBe('items[3].data[{missing}].value');
    });
  });

  describe('Complex Projection Rules with Array Indexing', () => {
    it('should handle deeply nested array indexing', () => {
      const rules = {
        'item.title': 'categories[0].subcategories[1].items[2].metadata.title',
        'user.email': 'organizations[{orgIndex}].departments[{deptIndex}].employees[{empIndex}].contact.email'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('orgIndex', 1);
      projector.setVariable('deptIndex', 3);
      projector.setVariable('empIndex', 0);

      expect(projector.project('item.title')).toBe('categories[0].subcategories[1].items[2].metadata.title');
      expect(projector.project('user.email')).toBe('organizations[1].departments[3].employees[0].contact.email');
    });

    it('should support array-like string indices', () => {
      const rules = {
        'current.data': 'lookup[{key}].value',
        'user.info': 'profiles[{username}].details'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('key', 'primary_config');
      projector.setVariable('username', 'john.doe');

      expect(projector.project('current.data')).toBe('lookup[primary_config].value');
      expect(projector.project('user.info')).toBe('profiles[john.doe].details');
    });

    it('should handle mixed static and dynamic indexing', () => {
      const rules = {
        'mixed.path': 'static[0].dynamic[{index}].static[1].final'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('index', 'calculated_key');

      expect(projector.project('mixed.path')).toBe('static[0].dynamic[calculated_key].static[1].final');
    });
  });

  describe('Nested Property Projection', () => {
    it('should handle deeply nested object property paths', () => {
      const rules = {
        'ui.theme.color': 'app.settings.appearance.theme.primaryColor',
        'user.preferences.lang': 'profile.user.preferences.localization.language',
        'data.cache.ttl': 'config.system.performance.cache.timeToLive.default'
      };

      projector.setProjectionRules(rules);

      expect(projector.project('ui.theme.color')).toBe('app.settings.appearance.theme.primaryColor');
      expect(projector.project('user.preferences.lang')).toBe('profile.user.preferences.localization.language');
      expect(projector.project('data.cache.ttl')).toBe('config.system.performance.cache.timeToLive.default');
    });

    it('should handle nested properties with array indexing', () => {
      const rules = {
        'selected.item.title': 'collections[{collectionId}].items[{itemId}].metadata.display.title',
        'current.user.avatar': 'users[{userId}].profile.media.images.avatar.url'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('collectionId', 'favorites');
      projector.setVariable('itemId', 12);
      projector.setVariable('userId', 'user_abc123');

      expect(projector.project('selected.item.title')).toBe('collections[favorites].items[12].metadata.display.title');
      expect(projector.project('current.user.avatar')).toBe('users[user_abc123].profile.media.images.avatar.url');
    });

    it('should preserve complex path structures', () => {
      const rules = {
        'component.state': 'runtime.components[{componentId}].internal.state.current',
        'event.handlers': 'registry.events[{eventType}].handlers.active[{priority}]'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('componentId', 'comp_123');
      projector.setVariable('eventType', 'user_click');
      projector.setVariable('priority', 'high');

      expect(projector.project('component.state')).toBe('runtime.components[comp_123].internal.state.current');
      expect(projector.project('event.handlers')).toBe('registry.events[user_click].handlers.active[high]');
    });
  });

  describe('Projection Rule Validation', () => {
    it('should validate projection rules format', () => {
      expect(() => {
        projector.setProjectionRules('invalid');
      }).toThrow('Projection rules must be an object');

      expect(() => {
        projector.setProjectionRules(['array', 'rules']);
      }).toThrow('Projection rules must be an object');

      expect(() => {
        projector.setProjectionRules(null);
      }).toThrow('Projection rules must be an object');
    });

    it('should validate individual projection rule entries', () => {
      expect(() => {
        projector.setProjectionRules({
          '': 'valid.path'
        });
      }).toThrow('Invalid projection rule: local path cannot be empty');

      expect(() => {
        projector.setProjectionRules({
          'valid.path': ''
        });
      }).toThrow('Invalid projection rule: parent path cannot be empty');

      expect(() => {
        projector.setProjectionRules({
          'valid.path': null
        });
      }).toThrow('Invalid projection rule: parent path must be a string');

      // Test that numeric keys get converted to strings (this is valid JS behavior)
      expect(() => {
        projector.setProjectionRules({
          123: 'valid.path'  // This becomes "123": "valid.path" 
        });
      }).not.toThrow(); // This should actually work since JS converts keys to strings
    });

    it('should validate complex projection paths', () => {
      // These should not throw
      expect(() => {
        projector.setProjectionRules({
          'complex[0].path[{var}].nested': 'target[1].items[{index}].deeply.nested.property'
        });
      }).not.toThrow();

      expect(() => {
        projector.setProjectionRules({
          'a.b.c.d.e.f.g': 'x[0][1][2].y.z'
        });
      }).not.toThrow();
    });
  });

  describe('Variable Management', () => {
    it('should set and get projection variables', () => {
      projector.setVariable('index', 5);
      projector.setVariable('key', 'test_key');
      projector.setVariable('userId', 'user123');

      expect(projector.getVariable('index')).toBe(5);
      expect(projector.getVariable('key')).toBe('test_key');
      expect(projector.getVariable('userId')).toBe('user123');
      expect(projector.getVariable('nonexistent')).toBeUndefined();
    });

    it('should handle variable updates', () => {
      const rules = {
        'current.item': 'items[{index}].data'
      };

      projector.setProjectionRules(rules);
      projector.setVariable('index', 0);

      expect(projector.project('current.item')).toBe('items[0].data');

      projector.setVariable('index', 5);
      expect(projector.project('current.item')).toBe('items[5].data');

      projector.setVariable('index', 'dynamic_key');
      expect(projector.project('current.item')).toBe('items[dynamic_key].data');
    });

    it('should clear variables', () => {
      projector.setVariable('test1', 'value1');
      projector.setVariable('test2', 'value2');

      expect(projector.variables.size).toBe(2);

      projector.clearVariable('test1');
      expect(projector.getVariable('test1')).toBeUndefined();
      expect(projector.getVariable('test2')).toBe('value2');
      expect(projector.variables.size).toBe(1);

      projector.clearAllVariables();
      expect(projector.variables.size).toBe(0);
    });

    it('should handle batch variable setting', () => {
      const variables = {
        index: 3,
        userId: 'user456',
        category: 'electronics',
        sortBy: 'name'
      };

      projector.setVariables(variables);

      expect(projector.getVariable('index')).toBe(3);
      expect(projector.getVariable('userId')).toBe('user456');
      expect(projector.getVariable('category')).toBe('electronics');
      expect(projector.getVariable('sortBy')).toBe('name');
    });
  });

  describe('Rule Management', () => {
    it('should add single projection rule', () => {
      projector.addProjectionRule('test.path', 'target.path');

      expect(projector.project('test.path')).toBe('target.path');
      expect(projector.project('other.path')).toBe('other.path');
    });

    it('should update existing projection rule', () => {
      projector.addProjectionRule('test.path', 'first.target');
      expect(projector.project('test.path')).toBe('first.target');

      projector.addProjectionRule('test.path', 'second.target');
      expect(projector.project('test.path')).toBe('second.target');
    });

    it('should remove projection rule', () => {
      projector.addProjectionRule('test.path', 'target.path');
      expect(projector.project('test.path')).toBe('target.path');

      projector.removeProjectionRule('test.path');
      expect(projector.project('test.path')).toBe('test.path'); // No projection
    });

    it('should clear all projection rules', () => {
      projector.setProjectionRules({
        'rule1': 'target1',
        'rule2': 'target2',
        'rule3': 'target3'
      });

      expect(Object.keys(projector.projectionRules)).toHaveLength(3);

      projector.clearAllProjectionRules();

      expect(Object.keys(projector.projectionRules)).toHaveLength(0);
      expect(projector.project('rule1')).toBe('rule1'); // No projection
    });
  });

  describe('Utility Methods', () => {
    it('should provide metadata about current state', () => {
      projector.setProjectionRules({
        'rule1': 'target1',
        'rule2': 'target2'
      });
      projector.setVariable('var1', 'value1');
      projector.setVariable('var2', 'value2');

      const metadata = projector.getMetadata();

      expect(metadata).toEqual({
        projectionRuleCount: 2,
        variableCount: 2,
        projectionRuleKeys: ['rule1', 'rule2'],
        variableKeys: ['var1', 'var2']
      });
    });

    it('should check if projection rule exists', () => {
      projector.addProjectionRule('test.rule', 'target.path');

      expect(projector.hasProjectionRule('test.rule')).toBe(true);
      expect(projector.hasProjectionRule('missing.rule')).toBe(false);
    });

    it('should check if variable exists', () => {
      projector.setVariable('test_var', 'value');

      expect(projector.hasVariable('test_var')).toBe(true);
      expect(projector.hasVariable('missing_var')).toBe(false);
    });
  });
});