/**
 * HandleRegistry Unit Tests
 * Test handle instance management and lifecycle tracking
 */

import { jest } from '@jest/globals';
import { HandleRegistry } from '../../src/HandleRegistry.js';
import { BaseHandle } from '../../src/BaseHandle.js';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';

describe('HandleRegistry', () => {
  let registry;
  let typeRegistry;
  let mockHandle1;
  let mockHandle2;

  beforeEach(() => {
    registry = new HandleRegistry();
    typeRegistry = new TypeHandleRegistry();
    global.TypeHandleRegistry = typeRegistry;
    
    // Create mock handles for testing
    mockHandle1 = new BaseHandle('TestHandle', { id: 'handle1' });
    mockHandle2 = new BaseHandle('TestHandle', { id: 'handle2' });
  });

  describe('Handle Registration', () => {
    test('should register handle instances', () => {
      registry.register(mockHandle1);
      
      expect(registry.has(mockHandle1.getGuid())).toBe(true);
      expect(registry.get(mockHandle1.getGuid())).toBe(mockHandle1);
    });

    test('should track handles by type', () => {
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      const testHandles = registry.getByType('TestHandle');
      
      expect(testHandles).toContain(mockHandle1);
      expect(testHandles).toContain(mockHandle2);
      expect(testHandles.length).toBe(2);
    });

    test('should track creation time', () => {
      const beforeTime = Date.now();
      registry.register(mockHandle1);
      const afterTime = Date.now();
      
      const creationTime = registry.creationTime.get(mockHandle1.getGuid());
      
      expect(creationTime).toBeGreaterThanOrEqual(beforeTime);
      expect(creationTime).toBeLessThanOrEqual(afterTime);
    });

    test('should fail fast on invalid handle registration', () => {
      expect(() => {
        registry.register(null);
      }).toThrow('Invalid handle: must have getGuid() and handleType');
      
      expect(() => {
        registry.register({});
      }).toThrow('Invalid handle: must have getGuid() and handleType');
      
      expect(() => {
        registry.register({ getGuid: () => 'test' }); // Missing handleType
      }).toThrow('Invalid handle: must have getGuid() and handleType');
    });
  });

  describe('Handle Lookup and Management', () => {
    test('should retrieve handles by ID', () => {
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      expect(registry.get(mockHandle1.getGuid())).toBe(mockHandle1);
      expect(registry.get(mockHandle2.getGuid())).toBe(mockHandle2);
      expect(registry.get('non-existent-id')).toBeNull();
    });

    test('should check handle existence', () => {
      registry.register(mockHandle1);
      
      expect(registry.has(mockHandle1.getGuid())).toBe(true);
      expect(registry.has('non-existent-id')).toBe(false);
    });

    test('should unregister handles properly', () => {
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      const removed = registry.unregister(mockHandle1.getGuid());
      
      expect(removed).toBe(true);
      expect(registry.has(mockHandle1.getGuid())).toBe(false);
      expect(registry.has(mockHandle2.getGuid())).toBe(true);
      
      // Type registry should be updated
      const testHandles = registry.getByType('TestHandle');
      expect(testHandles).not.toContain(mockHandle1);
      expect(testHandles).toContain(mockHandle2);
    });

    test('should return false when unregistering non-existent handle', () => {
      const removed = registry.unregister('non-existent-id');
      
      expect(removed).toBe(false);
    });
  });

  describe('Handle Discovery', () => {
    test('should list all handle IDs', () => {
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      const handleIds = registry.listHandleIds();
      
      expect(handleIds).toContain(mockHandle1.getGuid());
      expect(handleIds).toContain(mockHandle2.getGuid());
      expect(handleIds.length).toBe(2);
    });

    test('should list all handle types', () => {
      const dbHandle = new BaseHandle('DatabaseHandle', {});
      
      registry.register(mockHandle1); // TestHandle
      registry.register(dbHandle);    // DatabaseHandle
      
      const types = registry.listHandleTypes();
      
      expect(types).toContain('TestHandle');
      expect(types).toContain('DatabaseHandle');
      expect(types.length).toBe(2);
    });

    test('should find handles by criteria', () => {
      mockHandle1.setAttribute('category', 'file');
      mockHandle2.setAttribute('category', 'database');
      
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      const fileHandles = registry.findHandles(h => h.getAttribute('category') === 'file');
      
      expect(fileHandles).toContain(mockHandle1);
      expect(fileHandles).not.toContain(mockHandle2);
    });

    test('should get registry statistics', () => {
      const dbHandle = new BaseHandle('DatabaseHandle', {});
      const fileHandle = new BaseHandle('FileHandle', {});
      
      registry.register(mockHandle1);  // TestHandle
      registry.register(mockHandle2);  // TestHandle  
      registry.register(dbHandle);     // DatabaseHandle
      registry.register(fileHandle);   // FileHandle
      
      const stats = registry.getStats();
      
      expect(stats.totalHandles).toBe(4);
      expect(stats.totalTypes).toBe(3);
      expect(stats.handlesByType).toEqual({
        TestHandle: 2,
        DatabaseHandle: 1,
        FileHandle: 1
      });
    });
  });

  describe('Handle Lifecycle Management', () => {
    test('should clear all handles', () => {
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      expect(registry.getStats().totalHandles).toBe(2);
      
      registry.clear();
      
      expect(registry.getStats().totalHandles).toBe(0);
      expect(registry.listHandleIds().length).toBe(0);
      expect(registry.listHandleTypes().length).toBe(0);
    });

    test('should dispose handles when clearing if requested', () => {
      const disposeSpy1 = jest.spyOn(mockHandle1, 'dispose');
      const disposeSpy2 = jest.spyOn(mockHandle2, 'dispose');
      
      registry.register(mockHandle1);
      registry.register(mockHandle2);
      
      registry.clear(true); // disposeHandles = true
      
      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
      
      disposeSpy1.mockRestore();
      disposeSpy2.mockRestore();
    });

    test('should cleanup old handles by age', () => {
      jest.useFakeTimers();
      
      registry.register(mockHandle1);
      
      // Advance time
      jest.advanceTimersByTime(10000);
      
      registry.register(mockHandle2);
      
      // Cleanup handles older than 5 seconds
      const cleanedUp = registry.cleanupOld(5000, false);
      
      expect(cleanedUp).toBe(1);
      expect(registry.has(mockHandle1.getGuid())).toBe(false);
      expect(registry.has(mockHandle2.getGuid())).toBe(true);
      
      jest.useRealTimers();
    });

    test('should dispose old handles when cleaning up if requested', () => {
      const disposeSpy = jest.spyOn(mockHandle1, 'dispose');
      
      registry.register(mockHandle1);
      
      // Mock old creation time
      registry.creationTime.set(mockHandle1.getGuid(), Date.now() - 60000);
      
      registry.cleanupOld(30000, true); // disposeHandles = true
      
      expect(disposeSpy).toHaveBeenCalled();
      expect(registry.has(mockHandle1.getGuid())).toBe(false);
      
      disposeSpy.mockRestore();
    });
  });

  describe('Type-Based Operations', () => {
    test('should handle multiple types correctly', () => {
      const fileHandle = new BaseHandle('FileHandle', {});
      const dbHandle = new BaseHandle('DatabaseHandle', {});
      const imageHandle = new BaseHandle('ImageHandle', {});
      
      registry.register(mockHandle1);  // TestHandle
      registry.register(mockHandle2);  // TestHandle
      registry.register(fileHandle);   // FileHandle
      registry.register(dbHandle);     // DatabaseHandle
      registry.register(imageHandle);  // ImageHandle
      
      expect(registry.getByType('TestHandle').length).toBe(2);
      expect(registry.getByType('FileHandle').length).toBe(1);
      expect(registry.getByType('DatabaseHandle').length).toBe(1);
      expect(registry.getByType('ImageHandle').length).toBe(1);
      expect(registry.getByType('NonExistentType').length).toBe(0);
    });

    test('should clean up type sets when last handle removed', () => {
      registry.register(mockHandle1); // Only TestHandle
      
      expect(registry.listHandleTypes()).toContain('TestHandle');
      
      registry.unregister(mockHandle1.getGuid());
      
      expect(registry.listHandleTypes()).not.toContain('TestHandle');
      expect(registry.getByType('TestHandle').length).toBe(0);
    });
  });

  describe('Global Registry Singleton', () => {
    test('should maintain global registry singleton', () => {
      const registry1 = HandleRegistry.getGlobalRegistry();
      const registry2 = HandleRegistry.getGlobalRegistry();
      
      expect(registry1).toBe(registry2);
      expect(registry1).toBe(global.HandleRegistry);
    });

    test('should work across multiple access points', () => {
      const globalRegistry = HandleRegistry.getGlobalRegistry();
      
      globalRegistry.register(mockHandle1);
      
      const anotherAccess = HandleRegistry.getGlobalRegistry();
      
      expect(anotherAccess.has(mockHandle1.getGuid())).toBe(true);
      expect(anotherAccess).toBe(globalRegistry);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle duplicate registration gracefully', () => {
      registry.register(mockHandle1);
      
      // Re-registering same handle should update, not duplicate
      registry.register(mockHandle1);
      
      expect(registry.getByType('TestHandle').length).toBe(1);
      expect(registry.getStats().totalHandles).toBe(1);
    });

    test('should handle handles without dispose method', () => {
      const handleWithoutDispose = { 
        getGuid: () => 'test-guid',
        handleType: 'TestType'
      };
      
      registry.register(handleWithoutDispose);
      
      // Should not throw error when clearing with dispose
      expect(() => registry.clear(true)).not.toThrow();
    });

    test('should handle empty registry operations', () => {
      expect(registry.listHandleIds().length).toBe(0);
      expect(registry.listHandleTypes().length).toBe(0);
      expect(registry.getStats().totalHandles).toBe(0);
      expect(registry.findHandles(() => true).length).toBe(0);
      expect(registry.cleanupOld(1000)).toBe(0);
    });
  });
});