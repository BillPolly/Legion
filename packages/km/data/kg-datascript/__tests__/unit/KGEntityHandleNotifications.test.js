import { KGEntityHandle } from '../../src/KGEntityHandle.js';
import { KGDataStoreActor } from '../../src/server/KGDataStoreActor.js';
import { ActorSpace } from '@legion/actors';

describe('KGEntityHandle Notification System', () => {
  let actorSpace;
  let dataStoreActor;
  let handle;

  beforeEach(async () => {
    // Create actor infrastructure
    actorSpace = new ActorSpace();
    
    // Create data store actor
    dataStoreActor = new KGDataStoreActor({ id: 'test-store' });
    actorSpace.register(dataStoreActor, 'test-store');
    
    // Create handle
    handle = new KGEntityHandle({
      actorSpace,
      dataStoreId: 'test-store'
    });
  });

  afterEach(async () => {
    if (actorSpace) {
      await actorSpace.destroy();
    }
  });

  describe('Change Detection', () => {
    test('should detect object additions', async () => {
      const changeEvents = [];
      const unsubscribe = await handle.onChange((change) => {
        changeEvents.push(change);
      });

      const obj = { name: 'Test', value: 42 };
      await handle.add(obj, 'test-1');
      
      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(changeEvents.length).toBeGreaterThan(0);
      expect(changeEvents[0].objects).toBeDefined();
      
      unsubscribe();
    });

    test('should detect object updates', async () => {
      const obj = { name: 'Test', value: 1 };
      await handle.add(obj, 'update-test');
      
      const changeEvents = [];
      const unsubscribe = await handle.onChange((change) => {
        changeEvents.push(change);
      });

      await handle.update(obj, { value: 2 });
      
      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(changeEvents.length).toBeGreaterThan(0);
      
      unsubscribe();
    });

    test('should detect object removals', async () => {
      const obj = { name: 'Test' };
      await handle.add(obj, 'remove-test');
      
      const changeEvents = [];
      const unsubscribe = await handle.onChange((change) => {
        changeEvents.push(change);
      });

      await handle.remove('remove-test');
      
      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(changeEvents.length).toBeGreaterThan(0);
      
      unsubscribe();
    });
  });

  describe('Multiple Listeners', () => {
    test('should support multiple change listeners', async () => {
      let count1 = 0;
      let count2 = 0;
      
      const unsub1 = await handle.onChange(() => count1++);
      const unsub2 = await handle.onChange(() => count2++);
      
      await handle.add({ name: 'Test' }, 'multi-1');
      
      // Wait for async notifications
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);
      
      unsub1();
      unsub2();
    });

    test('should unsubscribe listeners correctly', async () => {
      let count = 0;
      const unsubscribe = await handle.onChange(() => count++);
      
      await handle.add({ name: 'Test1' }, 'unsub-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      const firstCount = count;
      
      unsubscribe();
      
      await handle.add({ name: 'Test2' }, 'unsub-2');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(count).toBe(firstCount); // Should not increase after unsubscribe
    });
  });

  describe('Batch Operations', () => {
    test('should handle rapid changes', async () => {
      const changeEvents = [];
      const unsubscribe = await handle.onChange((change) => {
        changeEvents.push(change);
      });

      // Add multiple objects rapidly
      await Promise.all([
        handle.add({ name: 'Test1' }, 'batch-1'),
        handle.add({ name: 'Test2' }, 'batch-2'),
        handle.add({ name: 'Test3' }, 'batch-3')
      ]);
      
      // Wait for async notifications
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(changeEvents.length).toBeGreaterThan(0);
      
      unsubscribe();
    });
  });

  describe('Error Handling', () => {
    test('should handle listener errors gracefully', async () => {
      const errorListener = () => {
        throw new Error('Listener error');
      };
      
      let goodListenerCalled = false;
      const goodListener = () => { goodListenerCalled = true; };
      
      const unsub1 = await handle.onChange(errorListener);
      const unsub2 = await handle.onChange(goodListener);
      
      // Should not throw even with error in listener
      await expect(handle.add({ name: 'Test' }, 'error-test')).resolves.toBeDefined();
      
      // Wait for async notifications
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Good listener should still be called
      expect(goodListenerCalled).toBe(true);
      
      unsub1();
      unsub2();
    });
  });
});