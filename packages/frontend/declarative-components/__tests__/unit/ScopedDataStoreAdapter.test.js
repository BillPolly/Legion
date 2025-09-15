/**
 * Unit tests for ScopedDataStoreAdapter
 * Tests state projection and isolation functionality for hierarchical components
 */

import { ScopedDataStoreAdapter } from '../../src/adapters/ScopedDataStoreAdapter.js';
import { DataStoreAdapter } from '../../src/adapters/DataStoreAdapter.js';

describe('ScopedDataStoreAdapter', () => {
  let mockDataStore;
  let parentAdapter;
  let subscriptions;

  beforeEach(async () => {
    // Create mock DataStore with reactive engine
    subscriptions = new Map();
    
    mockDataStore = {
      on: jest.fn(),
      off: jest.fn(),
      _reactiveEngine: {
        addSubscription: jest.fn((subscription) => {
          subscriptions.set(subscription.id, subscription);
        }),
        removeSubscription: jest.fn((subscriptionId) => {
          subscriptions.delete(subscriptionId);
        }),
        getAllSubscriptions: jest.fn(() => Array.from(subscriptions.values()))
      }
    };

    parentAdapter = new DataStoreAdapter(mockDataStore);
    
    // Initialize the parent adapter with test data
    await parentAdapter.initializeEntities({
      parentData: { title: 'Parent Title', value: 100 },
      childData: { name: 'Child Name', count: 5 },
      arrayData: [
        { id: 1, text: 'Item 1' },
        { id: 2, text: 'Item 2' },
        { id: 3, text: 'Item 3' }
      ]
    });
  });

  describe('Constructor', () => {
    it('should create ScopedDataStoreAdapter with parent adapter and projection rules', () => {
      const projectionRules = {
        'child.name': 'parentData.title',
        'child.value': 'parentData.value'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      expect(scopedAdapter).toBeInstanceOf(ScopedDataStoreAdapter);
      expect(scopedAdapter.parentAdapter).toBe(parentAdapter);
      expect(scopedAdapter.stateProjector).toBeDefined();
      expect(scopedAdapter.localScope).toEqual({});
      
      // Test that projection rules were applied correctly by testing behavior
      expect(scopedAdapter.getProjectedPath('child.name')).toBe('parentData.title');
      expect(scopedAdapter.getProjectedPath('child.value')).toBe('parentData.value');
    });

    it('should throw error without parent adapter', () => {
      expect(() => {
        new ScopedDataStoreAdapter(null, {});
      }).toThrow('Parent adapter is required');
    });

    it('should throw error with invalid parent adapter', () => {
      expect(() => {
        new ScopedDataStoreAdapter({}, {});
      }).toThrow('Parent adapter must be a DataStoreAdapter instance');
    });

    it('should throw error without projection rules', () => {
      expect(() => {
        new ScopedDataStoreAdapter(parentAdapter);
      }).toThrow('Projection rules are required');
    });

    it('should throw error with invalid projection rules', () => {
      expect(() => {
        new ScopedDataStoreAdapter(parentAdapter, 'invalid');
      }).toThrow('Projection rules must be an object');
    });
  });

  describe('State Projection Mapping', () => {
    it('should map local property paths to parent paths using projection rules', () => {
      const projectionRules = {
        'child.name': 'parentData.title',
        'child.count': 'parentData.value',
        'item.text': 'childData.name'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      expect(scopedAdapter.getProjectedPath('child.name')).toBe('parentData.title');
      expect(scopedAdapter.getProjectedPath('child.count')).toBe('parentData.value');
      expect(scopedAdapter.getProjectedPath('item.text')).toBe('childData.name');
      expect(scopedAdapter.getProjectedPath('unmapped.path')).toBe('unmapped.path');
    });

    it('should handle complex nested projection rules', () => {
      const projectionRules = {
        'user.profile.name': 'parentData.userInfo.displayName',
        'settings.theme.color': 'parentData.config.ui.primaryColor',
        'data.items[0].title': 'arrayData[0].text'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      expect(scopedAdapter.getProjectedPath('user.profile.name')).toBe('parentData.userInfo.displayName');
      expect(scopedAdapter.getProjectedPath('settings.theme.color')).toBe('parentData.config.ui.primaryColor');
      expect(scopedAdapter.getProjectedPath('data.items[0].title')).toBe('arrayData[0].text');
    });

    it('should validate projection rules format', () => {
      const invalidRules = {
        'valid.path': 'parent.path',
        '': 'parent.empty',  // Invalid: empty local path
        'local.path': ''     // Invalid: empty parent path
      };

      expect(() => {
        new ScopedDataStoreAdapter(parentAdapter, invalidRules);
      }).toThrow('Invalid projection rule');
    });
  });

  describe('Scoped Property Access', () => {
    it('should get property from parent adapter using projection', () => {
      const projectionRules = {
        'child.title': 'parentData.title',
        'child.value': 'parentData.value'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      expect(scopedAdapter.getProperty('child.title')).toBe('Parent Title');
      expect(scopedAdapter.getProperty('child.value')).toBe(100);
    });

    it('should get property from local scope when not projected', () => {
      const projectionRules = {
        'child.title': 'parentData.title'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Set local property
      scopedAdapter.setProperty('local.data', 'local value');

      expect(scopedAdapter.getProperty('local.data')).toBe('local value');
      expect(scopedAdapter.getProperty('child.title')).toBe('Parent Title');
    });

    it('should set property in parent adapter using projection', () => {
      const projectionRules = {
        'child.title': 'parentData.title',
        'child.value': 'parentData.value'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      scopedAdapter.setProperty('child.title', 'New Parent Title');
      scopedAdapter.setProperty('child.value', 200);

      expect(parentAdapter.getProperty('parentData.title')).toBe('New Parent Title');
      expect(parentAdapter.getProperty('parentData.value')).toBe(200);
    });

    it('should set property in local scope when not projected', () => {
      const projectionRules = {
        'child.title': 'parentData.title'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      scopedAdapter.setProperty('local.data', 'local value');
      scopedAdapter.setProperty('local.nested.value', 42);

      expect(scopedAdapter.getProperty('local.data')).toBe('local value');
      expect(scopedAdapter.getProperty('local.nested.value')).toBe(42);
      
      // Should not affect parent
      expect(parentAdapter.getProperty('local.data')).toBeUndefined();
    });
  });

  describe('Parent-Child State Isolation', () => {
    it('should isolate local scope from parent state', () => {
      const projectionRules = {
        'shared.value': 'parentData.value'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      // Set local properties
      scopedAdapter.setProperty('isolated.data', 'child only');
      scopedAdapter.setProperty('isolated.config.setting', true);

      // Set shared property (should update parent)
      scopedAdapter.setProperty('shared.value', 999);

      // Verify isolation
      expect(scopedAdapter.getProperty('isolated.data')).toBe('child only');
      expect(scopedAdapter.getProperty('isolated.config.setting')).toBe(true);
      expect(parentAdapter.getProperty('parentData.value')).toBe(999);
      
      // Parent should not see isolated properties
      expect(parentAdapter.getProperty('isolated.data')).toBeUndefined();
      expect(parentAdapter.getProperty('isolated.config.setting')).toBeUndefined();
    });

    it('should handle multiple child adapters with different projections', () => {
      const child1Rules = {
        'data.name': 'parentData.title',
        'data.count': 'parentData.value'
      };

      const child2Rules = {
        'info.title': 'parentData.title',
        'info.amount': 'childData.count'
      };

      const child1Adapter = new ScopedDataStoreAdapter(parentAdapter, child1Rules);
      const child2Adapter = new ScopedDataStoreAdapter(parentAdapter, child2Rules);

      // Each child has isolated local state
      child1Adapter.setProperty('local.child1', 'first child');
      child2Adapter.setProperty('local.child2', 'second child');

      // Verify isolation
      expect(child1Adapter.getProperty('local.child1')).toBe('first child');
      expect(child1Adapter.getProperty('local.child2')).toBeUndefined();
      expect(child2Adapter.getProperty('local.child2')).toBe('second child');
      expect(child2Adapter.getProperty('local.child1')).toBeUndefined();

      // Both can access projected parent data
      expect(child1Adapter.getProperty('data.name')).toBe('Parent Title');
      expect(child2Adapter.getProperty('info.title')).toBe('Parent Title');
    });

    it('should prevent cross-contamination between scoped adapters', () => {
      const projectionRules1 = { 'child.data': 'parentData.title' };
      const projectionRules2 = { 'child.data': 'parentData.value' };

      const scopedAdapter1 = new ScopedDataStoreAdapter(parentAdapter, projectionRules1);
      const scopedAdapter2 = new ScopedDataStoreAdapter(parentAdapter, projectionRules2);

      // Set local properties with same path in different scopes
      scopedAdapter1.setProperty('unique.prop', 'adapter1 value');
      scopedAdapter2.setProperty('unique.prop', 'adapter2 value');

      // Verify each adapter has its own isolated state
      expect(scopedAdapter1.getProperty('unique.prop')).toBe('adapter1 value');
      expect(scopedAdapter2.getProperty('unique.prop')).toBe('adapter2 value');

      // Verify different projections work correctly
      expect(scopedAdapter1.getProperty('child.data')).toBe('Parent Title');
      expect(scopedAdapter2.getProperty('child.data')).toBe(100);
    });
  });

  describe('Array Indexing Support', () => {
    it('should handle array index projection rules', () => {
      const projectionRules = {
        'item.id': 'arrayData[0].id',
        'item.text': 'arrayData[0].text',
        'second.id': 'arrayData[1].id'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      expect(scopedAdapter.getProperty('item.id')).toBe(1);
      expect(scopedAdapter.getProperty('item.text')).toBe('Item 1');
      expect(scopedAdapter.getProperty('second.id')).toBe(2);
    });

    it('should support dynamic array indexing', () => {
      const projectionRules = {
        'currentItem.id': 'arrayData[{index}].id',
        'currentItem.text': 'arrayData[{index}].text'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      // Set dynamic index
      scopedAdapter.setProjectionVariable('index', 2);

      expect(scopedAdapter.getProperty('currentItem.id')).toBe(3);
      expect(scopedAdapter.getProperty('currentItem.text')).toBe('Item 3');

      // Change index
      scopedAdapter.setProjectionVariable('index', 0);

      expect(scopedAdapter.getProperty('currentItem.id')).toBe(1);
      expect(scopedAdapter.getProperty('currentItem.text')).toBe('Item 1');
    });

    it('should handle setting array properties through projection', () => {
      const projectionRules = {
        'item.text': 'arrayData[1].text'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      scopedAdapter.setProperty('item.text', 'Updated Item 2');

      expect(parentAdapter.getProperty('arrayData[1].text')).toBe('Updated Item 2');
      expect(parentAdapter.simpleData.arrayData[1].text).toBe('Updated Item 2');
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should provide cleanup method to remove subscriptions and references', () => {
      const projectionRules = {
        'child.data': 'parentData.title'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      // Setup some state
      scopedAdapter.setProperty('local.data', 'test');

      expect(typeof scopedAdapter.cleanup).toBe('function');

      // Cleanup should not throw
      expect(() => {
        scopedAdapter.cleanup();
      }).not.toThrow();

      // After cleanup, adapter should be in clean state
      expect(Object.keys(scopedAdapter.localScope)).toHaveLength(0);
    });

    it('should handle cleanup with subscriptions', () => {
      const projectionRules = {
        'child.data': 'parentData.title'
      };

      const scopedAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);

      // Mock subscriptions
      scopedAdapter.subscriptions = new Set([
        { unsubscribe: jest.fn() },
        { unsubscribe: jest.fn() }
      ]);

      scopedAdapter.cleanup();

      // Verify subscriptions were cleaned up
      scopedAdapter.subscriptions.forEach(sub => {
        expect(sub.unsubscribe).toHaveBeenCalled();
      });

      expect(scopedAdapter.subscriptions.size).toBe(0);
    });
  });
});