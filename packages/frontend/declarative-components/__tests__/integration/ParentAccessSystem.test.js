/**
 * Integration tests for Parent Access System
 * Tests child accessing parent state, bidirectional sync, permission-based access control,
 * and conflict resolution scenarios using real components and state interactions
 */

import { HierarchicalComponent } from '../../src/core/HierarchicalComponent.js';
import { HierarchicalComponentLifecycle } from '../../src/lifecycle/HierarchicalComponentLifecycle.js';
import { ReadWriteViewManager } from '../../src/adapters/ReadWriteViewManager.js';
import { ScopedDataStoreAdapter } from '../../src/adapters/ScopedDataStoreAdapter.js';

// Mock DataStore for testing
class TestDataStore {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.subscriptions = new Map();
  }

  getState() {
    return this.state;
  }

  async updateState(updates) {
    const oldState = JSON.parse(JSON.stringify(this.state)); // Deep copy
    
    // Handle dotted path updates by setting nested properties
    for (const [path, value] of Object.entries(updates)) {
      this._setValueFromPath(path, value);
    }
    
    // Notify subscribers
    for (const [path, callbacks] of this.subscriptions) {
      if (this._pathMatches(updates, path)) {
        for (const callback of callbacks) {
          await callback(this._getValueFromPath(path), oldState);
        }
      }
    }
  }

  subscribe(path, callback) {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set());
    }
    this.subscriptions.get(path).add(callback);

    return {
      unsubscribe: () => {
        const callbacks = this.subscriptions.get(path);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.subscriptions.delete(path);
          }
        }
      }
    };
  }

  _pathMatches(updates, path) {
    return Object.keys(updates).some(updatePath => 
      updatePath === path || updatePath.startsWith(path + '.') || path.startsWith(updatePath + '.')
    );
  }

  _getValueFromPath(path) {
    const segments = path.split('.');
    let current = this.state;
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }

  _setValueFromPath(path, value) {
    const segments = path.split('.');
    let current = this.state;
    
    // Navigate to the parent of the final property
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!(segment in current) || typeof current[segment] !== 'object') {
        current[segment] = {};
      }
      current = current[segment];
    }
    
    // Set the final property
    const finalSegment = segments[segments.length - 1];
    current[finalSegment] = value;
  }
}

describe('Parent Access System Integration', () => {
  let parentComponent;
  let childComponent;
  let grandchildComponent;
  let dataStore;
  let lifecycle;
  let container;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create data store with initial state
    dataStore = new TestDataStore({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        settings: {
          theme: 'dark',
          notifications: true,
          privacy: {
            showEmail: false,
            allowContacts: true
          }
        }
      },
      app: {
        title: 'Test Application',
        version: '1.0.0',
        features: ['feature1', 'feature2']
      },
      todos: [
        { id: 1, text: 'Learn React', completed: false },
        { id: 2, text: 'Build Todo App', completed: true }
      ]
    });

    // Create lifecycle
    lifecycle = new HierarchicalComponentLifecycle(dataStore);

    // Create parent component
    parentComponent = new HierarchicalComponent({
      id: 'parent',
      definition: {
        name: 'ParentComponent',
        entity: 'app',
        structure: { type: 'div', id: 'parent-root' },
        bindings: [],
        events: []
      },
      container: container,
      domElements: new Map([['root', container]]),
      lifecycle: lifecycle,
      data: dataStore.getState()
    });

    // Create child component
    childComponent = new HierarchicalComponent({
      id: 'child',
      definition: {
        name: 'ChildComponent',
        entity: 'user',
        structure: { type: 'div', id: 'child-root' },
        bindings: [],
        events: []
      },
      container: document.createElement('div'),
      domElements: new Map([['root', document.createElement('div')]]),
      lifecycle: lifecycle,
      data: { user: dataStore.getState().user }
    });

    // Create grandchild component
    grandchildComponent = new HierarchicalComponent({
      id: 'grandchild',
      definition: {
        name: 'GrandchildComponent',
        entity: 'settings',
        structure: { type: 'div', id: 'grandchild-root' },
        bindings: [],
        events: []
      },
      container: document.createElement('div'),
      domElements: new Map([['root', document.createElement('div')]]),
      lifecycle: lifecycle,
      data: { settings: dataStore.getState().user.settings }
    });

    // Set up parent-child relationships
    parentComponent.addChild('child', childComponent);
    childComponent.setParent(parentComponent);
    childComponent.addChild('grandchild', grandchildComponent);
    grandchildComponent.setParent(childComponent);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('child accessing parent state', () => {
    it('should allow child to read parent state with proper permissions using ReadWriteViewManager', async () => {
      // Create permissions for child to read user data
      const permissions = {
        read: ['user.*', 'app.title'],
        write: ['user.name', 'user.email'],
        readOnly: ['app.*']
      };

      // Set up view manager for child to access parent
      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Child should be able to read user data
      const userNameView = viewManager.createReadOnlyView('user.name', 'userName');
      expect(userNameView.value).toBe('John Doe');

      const appTitleView = viewManager.createReadOnlyView('app.title', 'appTitle');
      expect(appTitleView.value).toBe('Test Application');

      // Child should not be able to read unauthorized data
      expect(() => {
        viewManager.createReadOnlyView('app.version', 'appVersion');
      }).toThrow('No read permission for path "app.version"');
    });

    it('should allow child to write to parent state with proper permissions using ReadWriteViewManager', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name', 'user.email'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Child should be able to write user name
      const userNameView = viewManager.createReadWriteView('user.name', 'userName');
      await viewManager.writeValue('userName', 'Jane Smith');
      
      // Verify the change was applied to parent state
      expect(dataStore.getState().user.name).toBe('Jane Smith');

      // Child should not be able to write to read-only data
      expect(() => {
        viewManager.createReadWriteView('user.settings.theme', 'theme');
      }).toThrow('No write permission for path "user.settings.theme"');
    });

    it('should support read-write views for controlled parent access', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name', 'user.settings.theme'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Create read-write view for user name
      const nameView = viewManager.createReadWriteView('user.name', 'userName');
      expect(nameView.value).toBe('John Doe');

      // Create read-only view for user email
      const emailView = viewManager.createReadOnlyView('user.email', 'userEmail');
      expect(emailView.value).toBe('john@example.com');

      // Write through view should update parent state
      await viewManager.writeValue('userName', 'Alice Johnson');
      expect(dataStore.getState().user.name).toBe('Alice Johnson');
      expect(nameView.value).toBe('Alice Johnson');

      // Attempt to write to read-only view should fail
      await expect(
        viewManager.writeValue('userEmail', 'alice@example.com')
      ).rejects.toThrow('Cannot write to read-only view "userEmail"');
    });
  });

  describe('parent-child bidirectional sync', () => {
    it('should sync changes from parent to child automatically', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Create view for user name
      const nameView = viewManager.createReadWriteView('user.name', 'userName');
      expect(nameView.value).toBe('John Doe');

      // Change parent state directly
      await dataStore.updateState({ 'user.name': 'Changed by Parent' });

      // Refresh view to get updated value
      viewManager.refreshView('userName');

      expect(nameView.value).toBe('Changed by Parent');
    });

    it('should sync changes from child to parent automatically', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.settings.theme'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Create view for theme setting
      const themeView = viewManager.createReadWriteView('user.settings.theme', 'theme');
      expect(themeView.value).toBe('dark');

      // Change through child view
      await viewManager.writeValue('theme', 'light');

      // Verify parent state was updated
      expect(dataStore.getState().user.settings.theme).toBe('light');
      expect(themeView.value).toBe('light');
    });

    it('should handle complex nested state synchronization', async () => {
      // Set up permissions for nested access
      const permissions = {
        read: ['user.settings.*'],
        write: ['user.settings.privacy.showEmail'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Create view for nested privacy setting
      const privacyView = viewManager.createReadWriteView('user.settings.privacy.showEmail', 'showEmail');
      expect(privacyView.value).toBe(false);

      // Update through child
      await viewManager.writeValue('showEmail', true);

      // Verify nested state update
      expect(dataStore.getState().user.settings.privacy.showEmail).toBe(true);

      // Verify parent update propagates back to child
      await dataStore.updateState({ 'user.settings.privacy.showEmail': false });
      viewManager.refreshView('showEmail');
      expect(privacyView.value).toBe(false);
    });
  });

  describe('permission-based access control', () => {
    it('should enforce read permissions strictly', async () => {
      const strictPermissions = {
        read: ['user.name', 'user.email'], // Only specific paths
        write: ['user.name'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: strictPermissions
      });

      // Should allow access to permitted paths
      const nameView = viewManager.createReadOnlyView('user.name', 'userName');
      expect(nameView.value).toBe('John Doe');

      // Should deny access to non-permitted paths
      expect(() => {
        viewManager.createReadOnlyView('user.settings.theme', 'theme');
      }).toThrow('No read permission for path "user.settings.theme"');

      expect(() => {
        viewManager.createReadOnlyView('app.title', 'appTitle');
      }).toThrow('No read permission for path "app.title"');
    });

    it('should enforce write permissions strictly', async () => {
      const strictPermissions = {
        read: ['user.*'],
        write: ['user.name'], // Only user.name is writable
        readOnly: ['user.email', 'user.settings.*']
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: strictPermissions
      });

      // Should allow read-write access to permitted path
      const nameView = viewManager.createReadWriteView('user.name', 'userName');
      await viewManager.writeValue('userName', 'New Name');
      expect(dataStore.getState().user.name).toBe('New Name');

      // Should deny write access to non-permitted paths
      expect(() => {
        viewManager.createReadWriteView('user.email', 'userEmail');
      }).toThrow('No write permission for path "user.email"');

      expect(() => {
        viewManager.createReadWriteView('user.settings.theme', 'theme');
      }).toThrow('No write permission for path "user.settings.theme"');
    });

    it('should support wildcard permissions correctly', async () => {
      const wildcardPermissions = {
        read: ['user.*', 'app.*'],
        write: ['user.settings.*'],
        readOnly: ['app.*']
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: wildcardPermissions
      });

      // Wildcard should allow access to all user properties
      const nameView = viewManager.createReadOnlyView('user.name', 'userName');
      expect(nameView.value).toBe('John Doe');

      const emailView = viewManager.createReadOnlyView('user.email', 'userEmail');
      expect(emailView.value).toBe('john@example.com');

      // Should allow write to user.settings.* but not user.name
      const themeView = viewManager.createReadWriteView('user.settings.theme', 'theme');
      await viewManager.writeValue('theme', 'light');
      expect(dataStore.getState().user.settings.theme).toBe('light');

      // Should deny write access outside wildcard scope
      expect(() => {
        viewManager.createReadWriteView('user.name', 'userNameWrite');
      }).toThrow('No write permission for path "user.name"');
    });
  });

  describe('conflict resolution scenarios', () => {
    it('should detect and handle concurrent modifications with last-write-wins strategy', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      viewManager.setConflictResolutionStrategy('last-write-wins');
      viewManager.enableOptimisticUpdates();

      const nameView = viewManager.createReadWriteView('user.name', 'userName');

      // Simulate slow update
      let resolveUpdate;
      const originalUpdateState = dataStore.updateState;
      dataStore.updateState = jest.fn(() => 
        new Promise(resolve => { resolveUpdate = resolve; })
      );

      // Start child update
      const childUpdatePromise = viewManager.writeValue('userName', 'Child Update');

      // Simulate external change while child update is pending
      // Use the original method to avoid deadlock
      await originalUpdateState.call(dataStore, { 'user.name': 'External Update' });
      viewManager.refreshView('userName');

      // Complete the child update
      resolveUpdate();
      await childUpdatePromise;

      // Child update should win (last-write-wins)
      expect(nameView.value).toBe('Child Update');

      // Restore original method
      dataStore.updateState = originalUpdateState;
    });

    it('should reject writes in strict conflict resolution mode', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      viewManager.setConflictResolutionStrategy('strict');

      const nameView = viewManager.createReadWriteView('user.name', 'userName');

      // Simulate external change
      await dataStore.updateState({ 'user.name': 'External Change' });

      // Child write should be rejected due to conflict
      await expect(
        viewManager.writeValue('userName', 'Child Update')
      ).rejects.toThrow('Conflict detected: state has been modified externally');

      // Original external change should remain
      expect(dataStore.getState().user.name).toBe('External Change');
    });

    it('should handle optimistic updates with rollback on failure', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      viewManager.enableOptimisticUpdates();

      const nameView = viewManager.createReadWriteView('user.name', 'userName');
      const originalValue = nameView.value;

      // Mock dataStore update to fail
      dataStore.updateState = jest.fn().mockRejectedValue(new Error('Update failed'));

      try {
        await viewManager.writeValue('userName', 'Failed Update');
      } catch (error) {
        expect(error.message).toBe('Update failed');
      }

      // View should be rolled back to original value
      expect(nameView.value).toBe(originalValue);
    });

    it('should emit conflict events for monitoring', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      viewManager.enableOptimisticUpdates();

      // Set up event monitoring
      const conflictEvents = [];
      childComponent.emit = jest.fn((event, data) => {
        if (event === 'conflictDetected') {
          conflictEvents.push(data);
        }
      });

      const nameView = viewManager.createReadWriteView('user.name', 'userName');

      // Mock slow update to create pending state
      const originalUpdateState = dataStore.updateState;
      dataStore.updateState = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      // Start child update
      const updatePromise = viewManager.writeValue('userName', 'Child Update');

      // Create conflict by changing state externally
      // Use the original method to avoid interference with the mock
      await originalUpdateState.call(dataStore, { 'user.name': 'External Change' });
      viewManager.refreshView('userName');

      await updatePromise;

      // Should have emitted conflict event
      expect(conflictEvents).toHaveLength(1);
      expect(conflictEvents[0]).toMatchObject({
        viewId: 'userName',
        path: 'user.name',
        localValue: 'Child Update',
        externalValue: 'External Change'
      });

      // Restore original method
      dataStore.updateState = originalUpdateState;
    });
  });

  describe('multi-level hierarchy access', () => {
    it('should allow grandchild to access grandparent state through ReadWriteViewManager', async () => {
      // Set up grandchild access to grandparent
      const grandchildPermissions = {
        read: ['app.title', 'user.settings.*'],
        write: ['user.settings.theme'],
        readOnly: ['app.*']
      };

      const grandparentViewManager = new ReadWriteViewManager({
        parentComponent: parentComponent, // grandparent
        childComponent: grandchildComponent, // grandchild
        dataStore: dataStore,
        permissions: grandchildPermissions
      });

      // Grandchild should be able to read grandparent app data
      const appTitleView = grandparentViewManager.createReadOnlyView('app.title', 'appTitle');
      expect(appTitleView.value).toBe('Test Application');

      // Grandchild should be able to read and write user settings
      const themeView = grandparentViewManager.createReadWriteView('user.settings.theme', 'theme');
      expect(themeView.value).toBe('dark');

      await grandparentViewManager.writeValue('theme', 'light');
      expect(dataStore.getState().user.settings.theme).toBe('light');
    });

    it('should maintain state isolation between different levels', async () => {
      // Child has access to user data
      const childPermissions = {
        read: ['user.*'],
        write: ['user.name'],
        readOnly: []
      };

      const childViewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: childPermissions
      });

      // Grandchild has access to settings only
      const grandchildPermissions = {
        read: ['user.settings.*'],
        write: ['user.settings.theme'],
        readOnly: []
      };

      const grandchildViewManager = new ReadWriteViewManager({
        parentComponent: childComponent,
        childComponent: grandchildComponent,
        dataStore: new TestDataStore({ user: { settings: dataStore.getState().user.settings } }),
        permissions: grandchildPermissions
      });

      // Child can access user.name
      const childNameView = childViewManager.createReadWriteView('user.name', 'userName');
      expect(childNameView.value).toBe('John Doe');

      // Grandchild cannot access user.name (not in its scope)
      expect(() => {
        grandchildViewManager.createReadOnlyView('user.name', 'userName');
      }).toThrow('No read permission for path "user.name"');

      // Grandchild can access user.settings.theme
      const grandchildThemeView = grandchildViewManager.createReadWriteView('user.settings.theme', 'theme');
      expect(grandchildThemeView.value).toBe('dark');
    });

    it('should handle cascading state updates through hierarchy', async () => {
      // Set up nested view managers
      const childViewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: { read: ['user.*'], write: ['user.settings.*'], readOnly: [] }
      });

      const grandchildViewManager = new ReadWriteViewManager({
        parentComponent: childComponent,
        childComponent: grandchildComponent,
        dataStore: dataStore,
        permissions: { read: ['user.settings.*'], write: ['user.settings.theme'], readOnly: [] }
      });

      // Create views
      const childThemeView = childViewManager.createReadWriteView('user.settings.theme', 'childTheme');
      const grandchildThemeView = grandchildViewManager.createReadWriteView('user.settings.theme', 'grandchildTheme');

      // Grandchild changes theme
      await grandchildViewManager.writeValue('grandchildTheme', 'blue');

      // Change should propagate to all levels
      expect(dataStore.getState().user.settings.theme).toBe('blue');

      // Parent state should reflect the change
      const parentUserSettings = dataStore.getState().user.settings;
      expect(parentUserSettings.theme).toBe('blue');

      // Child should also see the change
      childViewManager.refreshView('childTheme');
      expect(childThemeView.value).toBe('blue');
    });
  });

  describe('batch operations and transactions', () => {
    it('should support batch writes across parent-child boundary', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name', 'user.email', 'user.settings.theme'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      // Create multiple views
      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.createReadWriteView('user.email', 'userEmail');
      viewManager.createReadWriteView('user.settings.theme', 'theme');

      // Start batch mode
      viewManager.startBatch();

      // Make multiple changes
      await viewManager.writeValue('userName', 'Batch User');
      await viewManager.writeValue('userEmail', 'batch@example.com');
      await viewManager.writeValue('theme', 'batch-theme');

      // Changes should not be applied yet
      expect(dataStore.getState().user.name).toBe('John Doe');
      expect(dataStore.getState().user.email).toBe('john@example.com');
      expect(dataStore.getState().user.settings.theme).toBe('dark');

      // Commit batch
      await viewManager.commitBatch();

      // All changes should be applied atomically
      expect(dataStore.getState().user.name).toBe('Batch User');
      expect(dataStore.getState().user.email).toBe('batch@example.com');
      expect(dataStore.getState().user.settings.theme).toBe('batch-theme');
    });

    it('should rollback batch operations on failure', async () => {
      const permissions = {
        read: ['user.*'],
        write: ['user.name', 'user.email'],
        readOnly: []
      };

      const viewManager = new ReadWriteViewManager({
        parentComponent: parentComponent,
        childComponent: childComponent,
        dataStore: dataStore,
        permissions: permissions
      });

      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.createReadWriteView('user.email', 'userEmail');

      const originalName = dataStore.getState().user.name;
      const originalEmail = dataStore.getState().user.email;

      // Start batch and make changes
      viewManager.startBatch();
      await viewManager.writeValue('userName', 'Failed User');
      await viewManager.writeValue('userEmail', 'failed@example.com');

      // Mock dataStore update to fail
      dataStore.updateState = jest.fn().mockRejectedValue(new Error('Batch failed'));

      // Attempt to commit should fail and rollback
      await expect(viewManager.commitBatch()).rejects.toThrow('Batch failed');

      // Views should be rolled back to original values
      expect(viewManager.getView('userName').value).toBe(originalName);
      expect(viewManager.getView('userEmail').value).toBe(originalEmail);

      // Parent state should remain unchanged
      expect(dataStore.getState().user.name).toBe(originalName);
      expect(dataStore.getState().user.email).toBe(originalEmail);
    });
  });
});