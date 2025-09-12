import { KGEntityHandle } from '../../src/KGEntityHandle.js';
import { KGDataStoreActor } from '../../src/server/KGDataStoreActor.js';
import { ActorSpace, Actor, Channel } from '@legion/actors';

describe('KGEntityHandle', () => {
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

  describe('Object Operations', () => {
    test('should add objects through actor', async () => {
      const obj = { name: 'Test', value: 42 };
      const id = await handle.add(obj, 'test-1');
      
      expect(id).toBe('test-1');
      
      const retrieved = await handle.get('test-1');
      expect(retrieved).toEqual(obj);
    });

    test('should update objects through actor', async () => {
      const obj = { name: 'Test', value: 1 };
      await handle.add(obj, 'update-test');
      
      const updated = await handle.update(obj, { value: 2 });
      expect(updated).toEqual(expect.objectContaining({ value: 2 }));
      
      const retrieved = await handle.get('update-test');
      expect(retrieved).toEqual(expect.objectContaining({ value: 2 }));
    });

    test('should remove objects through actor', async () => {
      const obj = { name: 'Test' };
      await handle.add(obj, 'remove-test');
      
      const retrieved = await handle.get('remove-test');
      expect(retrieved).toEqual(obj);
      
      await handle.remove('remove-test');
      
      const afterRemove = await handle.get('remove-test');
      expect(afterRemove).toBeNull();
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      await handle.add({ name: 'Alice', role: 'Developer' }, 'alice');
      await handle.add({ name: 'Bob', role: 'Designer' }, 'bob');
      await handle.add({ name: 'Charlie', role: 'Developer' }, 'charlie');
    });

    test('should find objects by pattern', async () => {
      const developers = await handle.find({ role: 'Developer' });
      
      expect(developers).toHaveLength(2);
      expect(developers.map(d => d.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should get all objects', async () => {
      const all = await handle.getAll();
      
      expect(all).toHaveLength(3);
      expect(all.map(o => o.name).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('Change Notifications', () => {
    test('should handle change notifications', async () => {
      let changeCount = 0;
      
      const unsubscribe = await handle.onChange(() => {
        changeCount++;
      });
      
      await handle.add({ name: 'Test' }, 'notify-test');
      
      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(changeCount).toBeGreaterThan(0);
      
      unsubscribe();
    });
  });

  describe('Actor Communication', () => {
    test('should communicate with data store actor', async () => {
      const result = await handle.query('[SELECT * FROM objects]');
      expect(result).toBeDefined();
    });

    test('should handle actor errors gracefully', async () => {
      // Create handle with non-existent actor
      const badHandle = new KGEntityHandle({
        actorSpace,
        dataStoreId: 'non-existent'
      });
      
      const result = await badHandle.get('test');
      expect(result).toBeNull();
    });
  });
});