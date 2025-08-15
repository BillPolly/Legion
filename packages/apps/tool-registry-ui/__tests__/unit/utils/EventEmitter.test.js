/**
 * Unit tests for EventEmitter pattern used in Model layers
 * Phase 1.2 - Verify EventEmitter functionality for MVVM Model layers
 */

describe('EventEmitter Pattern for Model Layer', () => {
  describe('EventTarget-based event system', () => {
    let eventEmitter;
    let receivedEvents;

    beforeEach(() => {
      eventEmitter = new EventTarget();
      receivedEvents = [];
    });

    test('should emit and receive custom events', () => {
      const listener = (event) => {
        receivedEvents.push({
          type: event.type,
          detail: event.detail
        });
      };

      eventEmitter.addEventListener('stateChanged', listener);

      // Emit event
      const testData = { path: 'currentPanel', value: 'search', oldValue: 'modules' };
      eventEmitter.dispatchEvent(new CustomEvent('stateChanged', { detail: testData }));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({
        type: 'stateChanged',
        detail: testData
      });
    });

    test('should support multiple listeners for same event', () => {
      const listener1 = (event) => receivedEvents.push('listener1');
      const listener2 = (event) => receivedEvents.push('listener2');

      eventEmitter.addEventListener('test', listener1);
      eventEmitter.addEventListener('test', listener2);

      eventEmitter.dispatchEvent(new CustomEvent('test'));

      expect(receivedEvents).toEqual(['listener1', 'listener2']);
    });

    test('should remove event listeners correctly', () => {
      const listener = (event) => receivedEvents.push('called');

      eventEmitter.addEventListener('test', listener);
      eventEmitter.dispatchEvent(new CustomEvent('test'));
      expect(receivedEvents).toHaveLength(1);

      // Remove listener
      eventEmitter.removeEventListener('test', listener);
      eventEmitter.dispatchEvent(new CustomEvent('test'));
      expect(receivedEvents).toHaveLength(1); // Should not increase
    });

    test('should handle different event types', () => {
      const listener = (event) => {
        receivedEvents.push({
          type: event.type,
          data: event.detail
        });
      };

      eventEmitter.addEventListener('stateChanged', listener);
      eventEmitter.addEventListener('error', listener);
      eventEmitter.addEventListener('loading', listener);

      eventEmitter.dispatchEvent(new CustomEvent('stateChanged', { detail: 'state data' }));
      eventEmitter.dispatchEvent(new CustomEvent('error', { detail: 'error data' }));
      eventEmitter.dispatchEvent(new CustomEvent('loading', { detail: 'loading data' }));

      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents[0].type).toBe('stateChanged');
      expect(receivedEvents[1].type).toBe('error');
      expect(receivedEvents[2].type).toBe('loading');
    });

    test('should work with once option for single-use listeners', () => {
      const listener = (event) => receivedEvents.push('called');

      eventEmitter.addEventListener('test', listener, { once: true });

      // First call should work
      eventEmitter.dispatchEvent(new CustomEvent('test'));
      expect(receivedEvents).toHaveLength(1);

      // Second call should not trigger listener
      eventEmitter.dispatchEvent(new CustomEvent('test'));
      expect(receivedEvents).toHaveLength(1);
    });
  });

  describe('Subscription pattern for Model state', () => {
    let model;

    beforeEach(() => {
      model = {
        eventEmitter: new EventTarget(),
        subscriptions: new Map(),
        state: {
          currentPanel: 'search',
          tools: new Map(),
          isLoading: false
        }
      };
    });

    test('should implement subscription pattern correctly', () => {
      let callbackCalls = [];
      
      const subscribe = (path, callback) => {
        if (!model.subscriptions.has(path)) {
          model.subscriptions.set(path, new Set());
        }
        model.subscriptions.get(path).add(callback);
        
        return () => model.subscriptions.get(path)?.delete(callback);
      };

      const emit = (eventType, data) => {
        model.eventEmitter.dispatchEvent(new CustomEvent(eventType, { detail: data }));
      };

      const updateState = (path, value) => {
        const oldValue = getNestedProperty(model.state, path);
        setNestedProperty(model.state, path, value);
        
        // Notify subscribers
        const subscribers = model.subscriptions.get(path);
        if (subscribers) {
          subscribers.forEach(callback => callback(value, oldValue, path));
        }
        
        emit('stateChanged', { path, value, oldValue });
      };

      const getNestedProperty = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
      };

      const setNestedProperty = (obj, path, value) => {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
          if (!current[key]) current[key] = {};
          return current[key];
        }, obj);
        target[lastKey] = value;
      };

      // Subscribe to state changes
      const unsubscribe = subscribe('currentPanel', (newValue, oldValue, path) => {
        callbackCalls.push({ newValue, oldValue, path });
      });

      // Update state
      updateState('currentPanel', 'modules');

      expect(callbackCalls).toHaveLength(1);
      expect(callbackCalls[0]).toEqual({
        newValue: 'modules',
        oldValue: 'search',
        path: 'currentPanel'
      });

      // Test unsubscribe
      unsubscribe();
      updateState('currentPanel', 'details');
      expect(callbackCalls).toHaveLength(1); // Should not increase
    });

    test('should handle nested property paths correctly', () => {
      let receivedUpdates = [];

      const subscribe = (path, callback) => {
        if (!model.subscriptions.has(path)) {
          model.subscriptions.set(path, new Set());
        }
        model.subscriptions.get(path).add(callback);
        return () => model.subscriptions.get(path)?.delete(callback);
      };

      const updateState = (path, value) => {
        const oldValue = getNestedProperty(model.state, path);
        setNestedProperty(model.state, path, value);
        
        const subscribers = model.subscriptions.get(path);
        if (subscribers) {
          subscribers.forEach(callback => callback(value, oldValue));
        }
      };

      const getNestedProperty = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
      };

      const setNestedProperty = (obj, path, value) => {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
          if (!current[key]) current[key] = {};
          return current[key];
        }, obj);
        target[lastKey] = value;
      };

      // Subscribe to nested property
      subscribe('userPreferences.theme', (newValue, oldValue) => {
        receivedUpdates.push({ newValue, oldValue });
      });

      // Update nested property
      updateState('userPreferences.theme', 'dark');

      expect(receivedUpdates).toHaveLength(1);
      expect(receivedUpdates[0].newValue).toBe('dark');
      expect(model.state.userPreferences.theme).toBe('dark');
    });
  });
});