import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { RelationRegistry } from '../../src/RelationRegistry.js';
import { Integer, StringAtom, BooleanAtom, ID, Float } from '../../src/Atom.js';

describe('Delta Normalization Integration', () => {
  it('should handle complex normalization scenarios', () => {
    // Create test tuples
    const user1 = new Tuple([new ID('user1'), new StringAtom('Alice'), new Integer(25)]);
    const user2 = new Tuple([new ID('user2'), new StringAtom('Bob'), new Integer(30)]);
    const user3 = new Tuple([new ID('user3'), new StringAtom('Charlie'), new Integer(35)]);
    const user4 = new Tuple([new ID('user4'), new StringAtom('David'), new Integer(40)]);

    // Create delta with duplicates and conflicts
    const adds = new Set([user1, user2, user3, user4]);
    const removes = new Set([user2, user3]); // user2 and user3 will be cancelled

    const delta = new Delta(adds, removes);
    const normalized = delta.normalize();

    // user2 and user3 should be cancelled out
    // user1 and user4 should remain
    expect(normalized.adds.size).toBe(2);
    expect(normalized.removes.size).toBe(0);
    expect(normalized.adds.has(user1)).toBe(true);
    expect(normalized.adds.has(user4)).toBe(true);
    expect(normalized.adds.has(user2)).toBe(false);
    expect(normalized.adds.has(user3)).toBe(false);
  });

  it('should handle batch normalization workflow', () => {
    // Simulate batch processing with multiple relations
    const registry = new RelationRegistry();
    
    // Register schemas
    const userSchema = new Schema([
      { name: 'id', type: 'ID' },
      { name: 'name', type: 'String' },
      { name: 'active', type: 'Boolean' }
    ]);
    
    const orderSchema = new Schema([
      { name: 'orderId', type: 'ID' },
      { name: 'userId', type: 'ID' },
      { name: 'amount', type: 'Float' }
    ]);

    registry.register('Users', userSchema);
    registry.register('Orders', orderSchema);

    // Create batch with multiple relation deltas
    const batch = new Map();

    // Users delta
    const user1 = new Tuple([new ID('u1'), new StringAtom('Alice'), new BooleanAtom(true)]);
    const user2 = new Tuple([new ID('u2'), new StringAtom('Bob'), new BooleanAtom(false)]);
    const userDelta = new Delta(
      new Set([user1, user2]),
      new Set([user1]) // Conflict: add and remove same user
    );

    batch.set('Users', userDelta);

    // Normalize all deltas in batch
    const normalizedBatch = new Map();
    for (const [relationName, delta] of batch) {
      normalizedBatch.set(relationName, delta.normalize());
    }

    // Verify normalization
    const normalizedUserDelta = normalizedBatch.get('Users');
    expect(normalizedUserDelta.adds.size).toBe(1); // Only user2 remains
    expect(normalizedUserDelta.removes.size).toBe(0);
    expect(normalizedUserDelta.adds.has(user2)).toBe(true);
  });

  it('should preserve tuple ordering in normalized deltas', () => {
    // Create tuples with different orderings for same logical content
    const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
    const tuple2 = new Tuple([new Integer(2), new StringAtom('test')]);
    const tuple3 = new Tuple([new Integer(1), new StringAtom('other')]);

    const delta = new Delta(
      new Set([tuple1, tuple2, tuple3]),
      new Set([tuple2]) // Remove tuple2
    );

    const normalized = delta.normalize();

    // Should maintain exact tuple identity after normalization
    expect(normalized.adds.size).toBe(2);
    expect(normalized.adds.has(tuple1)).toBe(true);
    expect(normalized.adds.has(tuple3)).toBe(true);
    expect(normalized.adds.has(tuple2)).toBe(false);
  });

  it('should handle large-scale delta normalization efficiently', () => {
    // Helper function to create large delta for performance testing
    function createLargeDelta(size) {
      const adds = new Set();
      const removes = new Set();

      for (let i = 0; i < size; i++) {
        const tuple = new Tuple([new Integer(i), new StringAtom(`item${i}`)]);
        
        if (i % 3 === 0) {
          adds.add(tuple);
        } else if (i % 3 === 1) {
          removes.add(tuple);
        } else {
          // Add to both to create conflicts
          adds.add(tuple);
          removes.add(tuple);
        }
      }

      return new Delta(adds, removes);
    }

    // Create many tuples to test performance characteristics
    const largeDelta = createLargeDelta(1000);
    
    const startTime = performance.now();
    const normalized = largeDelta.normalize();
    const endTime = performance.now();

    // Should complete normalization in reasonable time
    expect(endTime - startTime).toBeLessThan(100); // 100ms threshold

    // Verify correctness of large normalization
    expect(normalized.adds.size + normalized.removes.size).toBeLessThanOrEqual(
      largeDelta.adds.size + largeDelta.removes.size
    );
  });

  it('should handle empty and trivial deltas', () => {
    const emptyDelta = new Delta();
    const normalizedEmpty = emptyDelta.normalize();
    expect(normalizedEmpty.isEmpty()).toBe(true);

    const tuple1 = new Tuple([new Integer(1)]);
    const addOnlyDelta = Delta.fromAdds(new Set([tuple1]));
    const normalizedAddOnly = addOnlyDelta.normalize();
    expect(normalizedAddOnly.adds.size).toBe(1);
    expect(normalizedAddOnly.removes.size).toBe(0);

    const removeOnlyDelta = Delta.fromRemoves(new Set([tuple1]));
    const normalizedRemoveOnly = removeOnlyDelta.normalize();
    expect(normalizedRemoveOnly.adds.size).toBe(0);
    expect(normalizedRemoveOnly.removes.size).toBe(1);
  });

  it('should maintain delta immutability during normalization', () => {
    const tuple1 = new Tuple([new Integer(1)]);
    const tuple2 = new Tuple([new Integer(2)]);
    
    const originalAdds = new Set([tuple1, tuple2]);
    const originalRemoves = new Set([tuple1]);
    
    const delta = new Delta(originalAdds, originalRemoves);
    
    // Store original sizes
    const originalAddsSize = delta.adds.size;
    const originalRemovesSize = delta.removes.size;
    
    // Normalize
    const normalized = delta.normalize();
    
    // Original delta should be unchanged
    expect(delta.adds.size).toBe(originalAddsSize);
    expect(delta.removes.size).toBe(originalRemovesSize);
    expect(delta.adds.has(tuple1)).toBe(true);
    expect(delta.adds.has(tuple2)).toBe(true);
    expect(delta.removes.has(tuple1)).toBe(true);
    
    // Normalized should be different
    expect(normalized.adds.size).toBe(1);
    expect(normalized.removes.size).toBe(0);
    expect(normalized.adds.has(tuple2)).toBe(true);
    expect(normalized.adds.has(tuple1)).toBe(false);
  });
});