/**
 * Unit tests for ReadWriteViewManager class
 * Tests view management, read-only vs read-write permissions, state isolation,
 * conflict resolution, optimistic updates, and change batch processing
 */

import { jest } from '@jest/globals';
import { ReadWriteViewManager } from '../../src/adapters/ReadWriteViewManager.js';

describe('ReadWriteViewManager', () => {
  let viewManager;
  let mockParentComponent;
  let mockChildComponent;
  let mockDataStore;
  let mockPermissions;

  beforeEach(() => {
    // Create mock parent component
    mockParentComponent = {
      id: 'parent',
      data: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          settings: {
            theme: 'dark',
            notifications: true
          }
        },
        app: {
          title: 'Test App',
          version: '1.0.0'
        }
      },
      getState: jest.fn(() => mockParentComponent.data),
      updateState: jest.fn(),
      emit: jest.fn(),
      subscribe: jest.fn()
    };

    // Create mock child component
    mockChildComponent = {
      id: 'child',
      emit: jest.fn(),
      updateState: jest.fn(),
      getState: jest.fn(() => ({}))
    };

    // Create mock data store
    mockDataStore = {
      getState: jest.fn(() => mockParentComponent.data),
      updateState: jest.fn(),
      subscribe: jest.fn()
    };

    // Create mock permissions
    mockPermissions = {
      read: ['user.*', 'app.*'],
      write: ['user.name', 'user.email', 'user.settings.*'],
      readOnly: ['app.*']
    };

    viewManager = new ReadWriteViewManager({
      parentComponent: mockParentComponent,
      childComponent: mockChildComponent,
      dataStore: mockDataStore,
      permissions: mockPermissions
    });
  });

  describe('constructor', () => {
    it('should create ReadWriteViewManager with required dependencies', () => {
      expect(viewManager.parentComponent).toBe(mockParentComponent);
      expect(viewManager.childComponent).toBe(mockChildComponent);
      expect(viewManager.dataStore).toBe(mockDataStore);
      expect(viewManager.permissions).toBe(mockPermissions);
    });

    it('should initialize with empty view registry', () => {
      expect(viewManager.views).toBeInstanceOf(Map);
      expect(viewManager.views.size).toBe(0);
    });

    it('should initialize with empty pending changes', () => {
      expect(viewManager.pendingChanges).toBeInstanceOf(Map);
      expect(viewManager.pendingChanges.size).toBe(0);
    });

    it('should initialize optimistic updates as disabled by default', () => {
      expect(viewManager.optimisticUpdatesEnabled).toBe(false);
    });

    it('should throw error if parent component is missing', () => {
      expect(() => {
        new ReadWriteViewManager({
          childComponent: mockChildComponent,
          dataStore: mockDataStore,
          permissions: mockPermissions
        });
      }).toThrow('Parent component is required');
    });

    it('should throw error if child component is missing', () => {
      expect(() => {
        new ReadWriteViewManager({
          parentComponent: mockParentComponent,
          dataStore: mockDataStore,
          permissions: mockPermissions
        });
      }).toThrow('Child component is required');
    });

    it('should throw error if data store is missing', () => {
      expect(() => {
        new ReadWriteViewManager({
          parentComponent: mockParentComponent,
          childComponent: mockChildComponent,
          permissions: mockPermissions
        });
      }).toThrow('Data store is required');
    });

    it('should allow permissions to be optional with default empty permissions', () => {
      const manager = new ReadWriteViewManager({
        parentComponent: mockParentComponent,
        childComponent: mockChildComponent,
        dataStore: mockDataStore
      });

      expect(manager.permissions.read).toEqual([]);
      expect(manager.permissions.write).toEqual([]);
      expect(manager.permissions.readOnly).toEqual([]);
    });
  });

  describe('view creation and management', () => {
    it('should create read-only view for specified path', () => {
      const view = viewManager.createReadOnlyView('user.name', 'userName');

      expect(view.id).toBe('userName');
      expect(view.path).toBe('user.name');
      expect(view.type).toBe('readonly');
      expect(view.value).toBe('John Doe');
      expect(viewManager.views.has('userName')).toBe(true);
    });

    it('should create read-write view for specified path', () => {
      const view = viewManager.createReadWriteView('user.settings.theme', 'themeSelector');

      expect(view.id).toBe('themeSelector');
      expect(view.path).toBe('user.settings.theme');
      expect(view.type).toBe('readwrite');
      expect(view.value).toBe('dark');
      expect(viewManager.views.has('themeSelector')).toBe(true);
    });

    it('should auto-generate view ID if not provided', () => {
      const view = viewManager.createReadOnlyView('user.email');

      expect(view.id).toMatch(/^view_\d+$/);
      expect(view.path).toBe('user.email');
      expect(viewManager.views.has(view.id)).toBe(true);
    });

    it('should throw error if view ID already exists', () => {
      viewManager.createReadOnlyView('user.name', 'duplicate');

      expect(() => {
        viewManager.createReadWriteView('user.email', 'duplicate');
      }).toThrow('View with ID "duplicate" already exists');
    });

    it('should throw error when creating read-write view without write permission', () => {
      expect(() => {
        viewManager.createReadWriteView('app.version', 'version');
      }).toThrow('No write permission for path "app.version"');
    });

    it('should allow read-only view for paths with read permission', () => {
      const view = viewManager.createReadOnlyView('app.title', 'appTitle');

      expect(view.type).toBe('readonly');
      expect(view.value).toBe('Test App');
    });

    it('should throw error when creating view without read permission', () => {
      expect(() => {
        viewManager.createReadOnlyView('unauthorized.path', 'unauthorized');
      }).toThrow('No read permission for path "unauthorized.path"');
    });
  });

  describe('view access and retrieval', () => {
    beforeEach(() => {
      viewManager.createReadOnlyView('user.name', 'userName');
      viewManager.createReadWriteView('user.settings.theme', 'theme');
    });

    it('should get view by ID', () => {
      const view = viewManager.getView('userName');

      expect(view.id).toBe('userName');
      expect(view.path).toBe('user.name');
      expect(view.value).toBe('John Doe');
    });

    it('should return undefined for non-existent view', () => {
      const view = viewManager.getView('nonexistent');
      expect(view).toBeUndefined();
    });

    it('should get all views', () => {
      const allViews = viewManager.getAllViews();

      expect(allViews).toHaveLength(2);
      expect(allViews.some(v => v.id === 'userName')).toBe(true);
      expect(allViews.some(v => v.id === 'theme')).toBe(true);
    });

    it('should get views by type', () => {
      const readOnlyViews = viewManager.getViewsByType('readonly');
      const readWriteViews = viewManager.getViewsByType('readwrite');

      expect(readOnlyViews).toHaveLength(1);
      expect(readOnlyViews[0].id).toBe('userName');

      expect(readWriteViews).toHaveLength(1);
      expect(readWriteViews[0].id).toBe('theme');
    });

    it('should check if view exists', () => {
      expect(viewManager.hasView('userName')).toBe(true);
      expect(viewManager.hasView('nonexistent')).toBe(false);
    });

    it('should get view count', () => {
      expect(viewManager.getViewCount()).toBe(2);
    });
  });

  describe('state reading operations', () => {
    beforeEach(() => {
      viewManager.createReadOnlyView('user.name', 'userName');
      viewManager.createReadWriteView('user.settings.theme', 'theme');
    });

    it('should read current value from view', () => {
      const value = viewManager.readValue('userName');
      expect(value).toBe('John Doe');
    });

    it('should read current value from read-write view', () => {
      const value = viewManager.readValue('theme');
      expect(value).toBe('dark');
    });

    it('should throw error when reading from non-existent view', () => {
      expect(() => {
        viewManager.readValue('nonexistent');
      }).toThrow('View "nonexistent" does not exist');
    });

    it('should refresh view values from current state', () => {
      // Change parent state
      mockParentComponent.data.user.name = 'Jane Doe';
      mockParentComponent.getState.mockReturnValue(mockParentComponent.data);

      viewManager.refreshViews();

      const view = viewManager.getView('userName');
      expect(view.value).toBe('Jane Doe');
    });

    it('should refresh specific view by ID', () => {
      mockParentComponent.data.user.settings.theme = 'light';
      mockParentComponent.getState.mockReturnValue(mockParentComponent.data);

      viewManager.refreshView('theme');

      const view = viewManager.getView('theme');
      expect(view.value).toBe('light');
    });
  });

  describe('state writing operations', () => {
    beforeEach(() => {
      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.createReadWriteView('user.settings.theme', 'theme');
      viewManager.createReadOnlyView('app.title', 'appTitle');
    });

    it('should write value to read-write view', async () => {
      await viewManager.writeValue('userName', 'Jane Smith');

      expect(mockDataStore.updateState).toHaveBeenCalledWith({
        'user.name': 'Jane Smith'
      });
    });

    it('should update view value after successful write', async () => {
      await viewManager.writeValue('theme', 'light');

      const view = viewManager.getView('theme');
      expect(view.value).toBe('light');
    });

    it('should throw error when writing to read-only view', async () => {
      await expect(
        viewManager.writeValue('appTitle', 'New Title')
      ).rejects.toThrow('Cannot write to read-only view "appTitle"');
    });

    it('should throw error when writing to non-existent view', async () => {
      await expect(
        viewManager.writeValue('nonexistent', 'value')
      ).rejects.toThrow('View "nonexistent" does not exist');
    });

    it('should validate write permissions before writing', async () => {
      // Try to write to a path without write permission
      expect(() => {
        viewManager.createReadWriteView('app.title', 'readOnlyTitle');
      }).toThrow('No write permission for path "app.title"');
    });

    it('should emit change event after successful write', async () => {
      await viewManager.writeValue('userName', 'New Name');

      expect(mockChildComponent.emit).toHaveBeenCalledWith('viewChanged', {
        viewId: 'userName',
        path: 'user.name',
        oldValue: 'John Doe',
        newValue: 'New Name',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('optimistic updates', () => {
    beforeEach(() => {
      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.enableOptimisticUpdates();
    });

    it('should enable optimistic updates', () => {
      expect(viewManager.optimisticUpdatesEnabled).toBe(true);
    });

    it('should disable optimistic updates', () => {
      viewManager.disableOptimisticUpdates();
      expect(viewManager.optimisticUpdatesEnabled).toBe(false);
    });

    it('should apply optimistic update immediately', async () => {
      // Mock slow update
      mockDataStore.updateState.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const writePromise = viewManager.writeValue('userName', 'Optimistic Name');

      // Value should be updated immediately
      const view = viewManager.getView('userName');
      expect(view.value).toBe('Optimistic Name');

      await writePromise;
    });

    it('should rollback optimistic update on write failure', async () => {
      mockDataStore.updateState.mockRejectedValue(new Error('Write failed'));

      try {
        await viewManager.writeValue('userName', 'Failed Name');
      } catch (error) {
        // Value should be rolled back
        const view = viewManager.getView('userName');
        expect(view.value).toBe('John Doe');
      }
    });

    it('should track optimistic changes separately', async () => {
      mockDataStore.updateState.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      viewManager.writeValue('userName', 'Optimistic Name');

      expect(viewManager.pendingChanges.has('userName')).toBe(true);
      expect(viewManager.pendingChanges.get('userName').originalValue).toBe('John Doe');
    });
  });

  describe('batch processing', () => {
    beforeEach(() => {
      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.createReadWriteView('user.email', 'userEmail');
      viewManager.createReadWriteView('user.settings.theme', 'theme');
    });

    it('should start batch processing mode', () => {
      viewManager.startBatch();
      expect(viewManager.batchMode).toBe(true);
    });

    it('should collect changes during batch mode without immediate writing', async () => {
      viewManager.startBatch();

      await viewManager.writeValue('userName', 'Batch Name');
      await viewManager.writeValue('userEmail', 'batch@example.com');

      // Parent should not be updated yet
      expect(mockDataStore.updateState).not.toHaveBeenCalled();

      // But batch should contain changes
      expect(viewManager.batchChanges.size).toBe(2);
    });

    it('should commit all batch changes at once', async () => {
      viewManager.startBatch();

      await viewManager.writeValue('userName', 'Batch Name');
      await viewManager.writeValue('userEmail', 'batch@example.com');
      await viewManager.writeValue('theme', 'light');

      await viewManager.commitBatch();

      expect(mockDataStore.updateState).toHaveBeenCalledWith({
        'user.name': 'Batch Name',
        'user.email': 'batch@example.com',
        'user.settings.theme': 'light'
      });
    });

    it('should rollback all batch changes', async () => {
      viewManager.startBatch();

      await viewManager.writeValue('userName', 'Batch Name');
      await viewManager.writeValue('theme', 'light');

      await viewManager.rollbackBatch();

      // Views should be back to original values
      expect(viewManager.getView('userName').value).toBe('John Doe');
      expect(viewManager.getView('theme').value).toBe('dark');

      // No state updates should have occurred
      expect(mockDataStore.updateState).not.toHaveBeenCalled();
    });

    it('should emit batch events', async () => {
      viewManager.startBatch();

      await viewManager.writeValue('userName', 'Batch Name');
      await viewManager.writeValue('theme', 'light');

      await viewManager.commitBatch();

      expect(mockChildComponent.emit).toHaveBeenCalledWith('batchCommitted', {
        changeCount: 2,
        changes: expect.any(Array),
        timestamp: expect.any(Number)
      });
    });

    it('should handle batch commit failures gracefully', async () => {
      viewManager.startBatch();
      mockDataStore.updateState.mockRejectedValue(new Error('Batch failed'));

      await viewManager.writeValue('userName', 'Batch Name');

      await expect(viewManager.commitBatch()).rejects.toThrow('Batch failed');

      // Views should be rolled back
      expect(viewManager.getView('userName').value).toBe('John Doe');
    });
  });

  describe('conflict resolution', () => {
    beforeEach(() => {
      viewManager.createReadWriteView('user.name', 'userName');
    });

    it('should detect conflicts when state changes externally', async () => {
      // Enable optimistic updates to create pending changes
      viewManager.enableOptimisticUpdates();
      
      // Start a write operation with slow parent update
      mockDataStore.updateState.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const writePromise = viewManager.writeValue('userName', 'New Name');

      // Simulate external state change while write is pending
      mockParentComponent.data.user.name = 'External Change';
      mockParentComponent.getState.mockReturnValue(mockParentComponent.data);

      // Trigger conflict detection by refreshing view while write is pending
      viewManager.refreshView('userName');

      // Complete the write
      await writePromise;

      // Should have detected conflict during refresh
      expect(mockChildComponent.emit).toHaveBeenCalledWith('conflictDetected', {
        viewId: 'userName',
        path: 'user.name',
        localValue: 'New Name',
        externalValue: 'External Change',
        timestamp: expect.any(Number)
      });
    });

    it('should resolve conflicts using last-write-wins strategy', async () => {
      viewManager.setConflictResolutionStrategy('last-write-wins');

      // Simulate concurrent changes
      mockParentComponent.data.user.name = 'External Change';
      mockParentComponent.getState.mockReturnValue(mockParentComponent.data);

      await viewManager.writeValue('userName', 'Local Change');

      // Local change should win
      const view = viewManager.getView('userName');
      expect(view.value).toBe('Local Change');
    });

    it('should resolve conflicts using merge strategy for compatible changes', async () => {
      viewManager.setConflictResolutionStrategy('merge');
      viewManager.createReadWriteView('user.settings.notifications', 'notifications');

      // Different properties can be merged
      mockParentComponent.data.user.settings.theme = 'light'; // External change
      await viewManager.writeValue('notifications', false); // Local change

      // Both changes should be preserved
      expect(mockDataStore.updateState).toHaveBeenCalledWith({
        'user.settings.notifications': false
      });
    });

    it('should reject writes when using strict conflict resolution', async () => {
      viewManager.setConflictResolutionStrategy('strict');

      // Simulate external change first (but don't refresh view, so view still has old value)
      mockParentComponent.data.user.name = 'External Change';
      mockParentComponent.getState.mockReturnValue(mockParentComponent.data);

      // Now try to write - should be rejected due to version mismatch
      // The view still has 'John Doe' but the actual state has 'External Change'
      await expect(
        viewManager.writeValue('userName', 'Local Change')
      ).rejects.toThrow('Conflict detected: state has been modified externally');
    });
  });

  describe('state isolation', () => {
    beforeEach(() => {
      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.createReadOnlyView('app.title', 'appTitle');
    });

    it('should isolate view changes from external state modifications', () => {
      const view = viewManager.getView('userName');
      const originalValue = view.value;

      // External state change
      mockParentComponent.data.user.name = 'External Change';

      // View should still have original value until refreshed
      expect(view.value).toBe(originalValue);
    });

    it('should provide isolated copy of state for views', () => {
      const view = viewManager.getView('userName');
      
      // Modifying view value directly should not affect parent state
      view.value = 'Modified Directly';

      expect(mockParentComponent.data.user.name).toBe('John Doe');
    });

    it('should maintain view versioning for change tracking', async () => {
      const view = viewManager.getView('userName');
      const initialVersion = view.version;

      await viewManager.writeValue('userName', 'Updated Name');

      expect(view.version).toBeGreaterThan(initialVersion);
    });

    it('should track change history for rollback capabilities', async () => {
      await viewManager.writeValue('userName', 'First Change');
      await viewManager.writeValue('userName', 'Second Change');

      const history = viewManager.getChangeHistory('userName');

      expect(history).toHaveLength(2);
      expect(history[0].oldValue).toBe('John Doe');
      expect(history[0].newValue).toBe('First Change');
      expect(history[1].oldValue).toBe('First Change');
      expect(history[1].newValue).toBe('Second Change');
    });
  });

  describe('cleanup and resource management', () => {
    beforeEach(() => {
      viewManager.createReadWriteView('user.name', 'userName');
      viewManager.createReadOnlyView('app.title', 'appTitle');
    });

    it('should remove specific view', () => {
      expect(viewManager.hasView('userName')).toBe(true);

      viewManager.removeView('userName');

      expect(viewManager.hasView('userName')).toBe(false);
      expect(viewManager.getViewCount()).toBe(1);
    });

    it('should clear all views', () => {
      expect(viewManager.getViewCount()).toBe(2);

      viewManager.clearAllViews();

      expect(viewManager.getViewCount()).toBe(0);
    });

    it('should cleanup all resources', () => {
      viewManager.startBatch();
      viewManager.writeValue('userName', 'Batch Change');

      viewManager.cleanup();

      expect(viewManager.views.size).toBe(0);
      expect(viewManager.pendingChanges.size).toBe(0);
      expect(viewManager.batchChanges.size).toBe(0);
      expect(viewManager.batchMode).toBe(false);
    });

    it('should unsubscribe from all subscriptions on cleanup', () => {
      const mockSubscription = { unsubscribe: jest.fn() };
      viewManager.subscriptions.add(mockSubscription);

      viewManager.cleanup();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });

    it('should emit cleanup event', () => {
      viewManager.cleanup();

      expect(mockChildComponent.emit).toHaveBeenCalledWith('viewManagerCleanup', {
        timestamp: expect.any(Number)
      });
    });
  });

  describe('error handling', () => {
    it('should handle invalid path formats gracefully', () => {
      expect(() => {
        viewManager.createReadOnlyView('', 'emptyPath');
      }).toThrow('Path cannot be empty');

      expect(() => {
        viewManager.createReadOnlyView(null, 'nullPath');
      }).toThrow('Path must be a string');
    });

    it('should handle state access errors gracefully', () => {
      mockDataStore.getState.mockImplementation(() => {
        throw new Error('State access failed');
      });

      expect(() => {
        viewManager.createReadOnlyView('user.name', 'userName');
      }).toThrow('Failed to read state for path "user.name": State access failed');
    });

    it('should handle write operation errors gracefully', async () => {
      viewManager.createReadWriteView('user.name', 'userName');
      mockDataStore.updateState.mockRejectedValue(new Error('Write failed'));

      await expect(
        viewManager.writeValue('userName', 'New Name')
      ).rejects.toThrow('Write failed');

      // View should maintain original value
      const view = viewManager.getView('userName');
      expect(view.value).toBe('John Doe');
    });

    it('should handle permission validation errors', () => {
      // Invalid permission format
      const invalidManager = new ReadWriteViewManager({
        parentComponent: mockParentComponent,
        childComponent: mockChildComponent,
        dataStore: mockDataStore,
        permissions: { read: 'invalid' } // Should be array
      });

      expect(() => {
        invalidManager.createReadOnlyView('user.name', 'userName');
      }).toThrow('Invalid permission format');
    });
  });
});