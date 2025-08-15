/**
 * Unit tests for ToolRegistryModel
 * Phase 2.1 - Test state management, event subscription, nested property access
 */

describe('ToolRegistryModel', () => {
  let model;

  const createToolRegistryModel = () => {
    return {
      state: {
        // Application State
        currentPanel: 'search',
        isLoading: false,
        errorState: null,
        connectionStatus: 'disconnected',
        
        // Data State
        tools: new Map(),
        modules: new Map(), 
        searchResults: [],
        selectedTool: null,
        selectedModule: null,
        
        // UI State
        windowDimensions: { width: 0, height: 0 },
        activeFilters: {},
        userPreferences: {
          theme: 'light',
          defaultView: 'search',
          itemsPerPage: 20
        }
      },
      
      // Event system for component communication
      eventEmitter: new EventTarget(),
      subscriptions: new Map(),
      
      // State management methods
      updateState(path, value) {
        const oldValue = this.getState(path);
        this.setNestedProperty(this.state, path, value);
        this.emit('stateChanged', { path, value, oldValue });
        
        // Notify path-specific subscribers
        const subscribers = this.subscriptions.get(path);
        if (subscribers) {
          subscribers.forEach(callback => callback(value, oldValue, path));
        }
      },
      
      getState(path) {
        if (!path) return this.state;
        return this.getNestedProperty(this.state, path);
      },
      
      subscribe(path, callback) {
        if (!this.subscriptions.has(path)) {
          this.subscriptions.set(path, new Set());
        }
        this.subscriptions.get(path).add(callback);
        
        return () => this.subscriptions.get(path)?.delete(callback);
      },
      
      emit(eventType, data) {
        this.eventEmitter.dispatchEvent(new CustomEvent(eventType, { detail: data }));
      },
      
      // Helper methods for nested property access
      getNestedProperty(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((obj, key) => obj?.[key], obj);
      },
      
      setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
            current[key] = {};
          }
          current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
      }
    };
  };

  beforeEach(() => {
    model = createToolRegistryModel();
  });

  describe('Initial state', () => {
    test('should have correct initial application state', () => {
      expect(model.getState('currentPanel')).toBe('search');
      expect(model.getState('isLoading')).toBe(false);
      expect(model.getState('errorState')).toBeNull();
      expect(model.getState('connectionStatus')).toBe('disconnected');
    });

    test('should have correct initial data state', () => {
      expect(model.getState('tools')).toBeInstanceOf(Map);
      expect(model.getState('modules')).toBeInstanceOf(Map);
      expect(model.getState('searchResults')).toEqual([]);
      expect(model.getState('selectedTool')).toBeNull();
      expect(model.getState('selectedModule')).toBeNull();
    });

    test('should have correct initial UI state', () => {
      expect(model.getState('windowDimensions')).toEqual({ width: 0, height: 0 });
      expect(model.getState('activeFilters')).toEqual({});
      expect(model.getState('userPreferences')).toEqual({
        theme: 'light',
        defaultView: 'search',
        itemsPerPage: 20
      });
    });

    test('should have event system initialized', () => {
      expect(model.eventEmitter).toBeInstanceOf(EventTarget);
      expect(model.subscriptions).toBeInstanceOf(Map);
      expect(model.subscriptions.size).toBe(0);
    });
  });

  describe('State management', () => {
    test('should update top-level properties correctly', () => {
      model.updateState('currentPanel', 'modules');
      expect(model.getState('currentPanel')).toBe('modules');
      
      model.updateState('isLoading', true);
      expect(model.getState('isLoading')).toBe(true);
      
      model.updateState('connectionStatus', 'connected');
      expect(model.getState('connectionStatus')).toBe('connected');
    });

    test('should update nested properties correctly', () => {
      model.updateState('userPreferences.theme', 'dark');
      expect(model.getState('userPreferences.theme')).toBe('dark');
      
      model.updateState('userPreferences.itemsPerPage', 50);
      expect(model.getState('userPreferences.itemsPerPage')).toBe(50);
      
      model.updateState('windowDimensions.width', 1920);
      model.updateState('windowDimensions.height', 1080);
      expect(model.getState('windowDimensions')).toEqual({ width: 1920, height: 1080 });
    });

    test('should create nested properties if they do not exist', () => {
      model.updateState('newSection.newProperty', 'value');
      expect(model.getState('newSection.newProperty')).toBe('value');
      expect(model.getState('newSection')).toEqual({ newProperty: 'value' });
    });

    test('should handle deeply nested property creation', () => {
      model.updateState('level1.level2.level3.property', 'deep value');
      expect(model.getState('level1.level2.level3.property')).toBe('deep value');
      
      // Should not affect sibling properties
      model.updateState('level1.level2.sibling', 'sibling value');
      expect(model.getState('level1.level2.level3.property')).toBe('deep value');
      expect(model.getState('level1.level2.sibling')).toBe('sibling value');
    });
  });

  describe('Event subscription system', () => {
    test('should subscribe to state changes and receive updates', () => {
      const updates = [];
      
      const unsubscribe = model.subscribe('currentPanel', (newValue, oldValue, path) => {
        updates.push({ newValue, oldValue, path });
      });

      model.updateState('currentPanel', 'modules');
      model.updateState('currentPanel', 'details');

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        newValue: 'modules',
        oldValue: 'search',
        path: 'currentPanel'
      });
      expect(updates[1]).toEqual({
        newValue: 'details',
        oldValue: 'modules',
        path: 'currentPanel'
      });

      unsubscribe();
    });

    test('should support multiple subscribers for the same path', () => {
      const updates1 = [];
      const updates2 = [];
      
      const unsub1 = model.subscribe('isLoading', (value) => updates1.push(value));
      const unsub2 = model.subscribe('isLoading', (value) => updates2.push(value));

      model.updateState('isLoading', true);
      model.updateState('isLoading', false);

      expect(updates1).toEqual([true, false]);
      expect(updates2).toEqual([true, false]);

      unsub1();
      unsub2();
    });

    test('should unsubscribe correctly', () => {
      const updates = [];
      
      const unsubscribe = model.subscribe('currentPanel', (value) => {
        updates.push(value);
      });

      model.updateState('currentPanel', 'modules');
      expect(updates).toHaveLength(1);

      unsubscribe();
      model.updateState('currentPanel', 'details');
      expect(updates).toHaveLength(1); // Should not increase
    });

    test('should handle nested path subscriptions', () => {
      const updates = [];
      
      model.subscribe('userPreferences.theme', (newValue, oldValue) => {
        updates.push({ newValue, oldValue });
      });

      model.updateState('userPreferences.theme', 'dark');
      model.updateState('userPreferences.theme', 'auto');

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ newValue: 'dark', oldValue: 'light' });
      expect(updates[1]).toEqual({ newValue: 'auto', oldValue: 'dark' });
    });
  });

  describe('Global event emission', () => {
    test('should emit stateChanged events for all updates', () => {
      const events = [];
      
      model.eventEmitter.addEventListener('stateChanged', (event) => {
        events.push(event.detail);
      });

      model.updateState('currentPanel', 'modules');
      model.updateState('isLoading', true);

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        path: 'currentPanel',
        value: 'modules',
        oldValue: 'search'
      });
      expect(events[1]).toEqual({
        path: 'isLoading',
        value: true,
        oldValue: false
      });
    });

    test('should support custom event emission', () => {
      const events = [];
      
      model.eventEmitter.addEventListener('customEvent', (event) => {
        events.push(event.detail);
      });

      model.emit('customEvent', { message: 'test', data: 123 });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ message: 'test', data: 123 });
    });
  });

  describe('Nested property helpers', () => {
    test('should get nested properties correctly', () => {
      const testObj = {
        level1: {
          level2: {
            property: 'value'
          },
          array: [1, 2, 3]
        },
        topLevel: 'top'
      };

      expect(model.getNestedProperty(testObj, 'topLevel')).toBe('top');
      expect(model.getNestedProperty(testObj, 'level1.level2.property')).toBe('value');
      expect(model.getNestedProperty(testObj, 'level1.array')).toEqual([1, 2, 3]);
      expect(model.getNestedProperty(testObj, 'nonexistent.path')).toBeUndefined();
    });

    test('should set nested properties correctly', () => {
      const testObj = {};
      
      model.setNestedProperty(testObj, 'simple', 'value');
      expect(testObj.simple).toBe('value');
      
      model.setNestedProperty(testObj, 'nested.property', 'nested value');
      expect(testObj.nested.property).toBe('nested value');
      
      model.setNestedProperty(testObj, 'deep.very.deep.property', 'deep value');
      expect(testObj.deep.very.deep.property).toBe('deep value');
      
      // Should not overwrite existing objects
      model.setNestedProperty(testObj, 'nested.another', 'another value');
      expect(testObj.nested.property).toBe('nested value');
      expect(testObj.nested.another).toBe('another value');
    });

    test('should handle edge cases in nested property access', () => {
      const testObj = { existing: null };
      
      // Should handle null values in path
      expect(model.getNestedProperty(testObj, 'existing.property')).toBeUndefined();
      
      // Should create path through null values when setting
      model.setNestedProperty(testObj, 'existing.property', 'value');
      expect(testObj.existing.property).toBe('value');
      
      // Should handle empty path
      expect(model.getNestedProperty(testObj, '')).toBe(testObj);
    });
  });
});