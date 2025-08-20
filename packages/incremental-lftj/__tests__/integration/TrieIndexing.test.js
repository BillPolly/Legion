import { Trie } from '../../src/Trie.js';
import { LevelIterator, IteratorFactory } from '../../src/LevelIterator.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';

describe('Trie Indexing Integration', () => {
  describe('Relation Indexing Workflow', () => {
    it('should index a relation and provide efficient iteration', () => {
      // Create a relation schema
      const schema = new Schema([
        { name: 'userId', type: 'Integer' },
        { name: 'department', type: 'String' },
        { name: 'active', type: 'Boolean' }
      ]);

      // Create test data representing: User(userId, department, active)
      const relationData = [
        new Tuple([new Integer(1), new StringAtom('Engineering'), new BooleanAtom(true)]),
        new Tuple([new Integer(2), new StringAtom('Engineering'), new BooleanAtom(false)]),
        new Tuple([new Integer(3), new StringAtom('Sales'), new BooleanAtom(true)]),
        new Tuple([new Integer(4), new StringAtom('Marketing'), new BooleanAtom(true)]),
        new Tuple([new Integer(5), new StringAtom('Engineering'), new BooleanAtom(true)]),
        new Tuple([new Integer(6), new StringAtom('Sales'), new BooleanAtom(false)])
      ];

      // Build trie index
      const trie = new Trie(schema.arity);
      relationData.forEach(tuple => trie.insert(tuple));

      // Verify we can iterate over all user IDs
      const userIdIterator = new LevelIterator(trie, 0, new Tuple([]));
      const userIds = [];
      while (!userIdIterator.atEnd()) {
        userIds.push(userIdIterator.key().value);
        userIdIterator.next();
      }
      expect(userIds).toEqual([1, 2, 3, 4, 5, 6]);

      // Verify we can find departments for specific user
      const user1DeptIterator = new LevelIterator(trie, 1, new Tuple([new Integer(1)]));
      expect(user1DeptIterator.key().value).toBe('Engineering');

      // Verify we can find active status for specific user/department
      const user1EngActiveIterator = new LevelIterator(trie, 2, 
        new Tuple([new Integer(1), new StringAtom('Engineering')]));
      expect(user1EngActiveIterator.key().value).toBe(true);
    });

    it('should handle prefix-based queries efficiently', () => {
      const trie = new Trie(3);
      
      // Insert data with common prefixes
      const tuples = [
        new Tuple([new Integer(1), new StringAtom('A'), new Integer(100)]),
        new Tuple([new Integer(1), new StringAtom('A'), new Integer(200)]),
        new Tuple([new Integer(1), new StringAtom('B'), new Integer(300)]),
        new Tuple([new Integer(2), new StringAtom('A'), new Integer(400)]),
        new Tuple([new Integer(2), new StringAtom('B'), new Integer(500)])
      ];
      tuples.forEach(t => trie.insert(t));

      // Query all second-level values for prefix (1)
      const level1Iterator = new LevelIterator(trie, 1, new Tuple([new Integer(1)]));
      const level1Values = [];
      while (!level1Iterator.atEnd()) {
        level1Values.push(level1Iterator.key().value);
        level1Iterator.next();
      }
      expect(level1Values).toEqual(['A', 'B']);

      // Query all third-level values for prefix (1, A)
      const level2Iterator = new LevelIterator(trie, 2, 
        new Tuple([new Integer(1), new StringAtom('A')]));
      const level2Values = [];
      while (!level2Iterator.atEnd()) {
        level2Values.push(level2Iterator.key().value);
        level2Iterator.next();
      }
      expect(level2Values).toEqual([100, 200]);
    });

    it('should handle seekGE operations for range queries', () => {
      const trie = new Trie(2);
      
      // Insert tuples with integer ranges
      for (let i = 10; i <= 50; i += 10) {
        trie.insert(new Tuple([new Integer(i), new StringAtom(`value${i}`)]));
      }

      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      
      // Seek to value >= 25
      iterator.seekGE(new Integer(25));
      expect(iterator.key().value).toBe(30); // Should find 30 (next value >= 25)
      
      // Continue iteration from there
      const remainingValues = [];
      while (!iterator.atEnd()) {
        remainingValues.push(iterator.key().value);
        iterator.next();
      }
      expect(remainingValues).toEqual([30, 40, 50]);
    });
  });

  describe('Iterator Factory Integration', () => {
    it('should manage multiple relation indexes', () => {
      const factory = new IteratorFactory();
      
      // Create Employee relation: Employee(id, name, deptId)
      const employeeTrie = new Trie(3);
      const employees = [
        new Tuple([new Integer(1), new StringAtom('Alice'), new Integer(10)]),
        new Tuple([new Integer(2), new StringAtom('Bob'), new Integer(20)]),
        new Tuple([new Integer(3), new StringAtom('Carol'), new Integer(10)])
      ];
      employees.forEach(t => employeeTrie.insert(t));
      
      // Create Department relation: Department(id, name)
      const deptTrie = new Trie(2);
      const departments = [
        new Tuple([new Integer(10), new StringAtom('Engineering')]),
        new Tuple([new Integer(20), new StringAtom('Sales')])
      ];
      departments.forEach(t => deptTrie.insert(t));
      
      factory.registerTrie('Employee', employeeTrie);
      factory.registerTrie('Department', deptTrie);
      
      // Query all employee IDs
      const empIterator = factory.makeIter('Employee', 0, new Tuple([]));
      const empIds = [];
      while (!empIterator.atEnd()) {
        empIds.push(empIterator.key().value);
        empIterator.next();
      }
      expect(empIds).toEqual([1, 2, 3]);
      
      // Query all department IDs  
      const deptIterator = factory.makeIter('Department', 0, new Tuple([]));
      const deptIds = [];
      while (!deptIterator.atEnd()) {
        deptIds.push(deptIterator.key().value);
        deptIterator.next();
      }
      expect(deptIds).toEqual([10, 20]);
      
      // Query employee names for engineering department (id=10)
      const engEmpIterator = factory.makeIter('Employee', 1, new Tuple([new Integer(1)]));
      expect(engEmpIterator.key().value).toBe('Alice');
    });

    it('should handle dynamic updates to indexed relations', () => {
      const factory = new IteratorFactory();
      const trie = new Trie(2);
      
      // Start with initial data
      const initial = [
        new Tuple([new Integer(1), new StringAtom('A')]),
        new Tuple([new Integer(3), new StringAtom('C')])
      ];
      initial.forEach(t => trie.insert(t));
      factory.registerTrie('TestRel', trie);
      
      // Verify initial state
      let iterator = factory.makeIter('TestRel', 0, new Tuple([]));
      let values = [];
      while (!iterator.atEnd()) {
        values.push(iterator.key().value);
        iterator.next();
      }
      expect(values).toEqual([1, 3]);
      
      // Add new tuple
      trie.insert(new Tuple([new Integer(2), new StringAtom('B')]));
      
      // Verify updated state
      iterator = factory.makeIter('TestRel', 0, new Tuple([]));
      values = [];
      while (!iterator.atEnd()) {
        values.push(iterator.key().value);
        iterator.next();
      }
      expect(values).toEqual([1, 2, 3]);
      
      // Remove a tuple
      trie.remove(new Tuple([new Integer(1), new StringAtom('A')]));
      
      // Verify final state
      iterator = factory.makeIter('TestRel', 0, new Tuple([]));
      values = [];
      while (!iterator.atEnd()) {
        values.push(iterator.key().value);
        iterator.next();
      }
      expect(values).toEqual([2, 3]);
    });
  });

  describe('Performance and Ordering', () => {
    it('should maintain correct ordering across all levels', () => {
      const trie = new Trie(4);
      
      // Insert tuples in random order
      const tuples = [
        new Tuple([new Integer(2), new StringAtom('B'), new BooleanAtom(false), new Integer(20)]),
        new Tuple([new Integer(1), new StringAtom('A'), new BooleanAtom(true), new Integer(10)]),
        new Tuple([new Integer(3), new StringAtom('C'), new BooleanAtom(true), new Integer(30)]),
        new Tuple([new Integer(1), new StringAtom('A'), new BooleanAtom(false), new Integer(15)]),
        new Tuple([new Integer(2), new StringAtom('A'), new BooleanAtom(true), new Integer(25)])
      ];
      
      // Shuffle and insert
      const shuffled = [...tuples].sort(() => Math.random() - 0.5);
      shuffled.forEach(t => trie.insert(t));
      
      // Verify level 0 ordering
      const level0Iterator = new LevelIterator(trie, 0, new Tuple([]));
      const level0Values = [];
      while (!level0Iterator.atEnd()) {
        level0Values.push(level0Iterator.key().value);
        level0Iterator.next();
      }
      expect(level0Values).toEqual([1, 2, 3]); // Should be sorted
      
      // Verify level 1 ordering for prefix (1)
      const level1Iterator = new LevelIterator(trie, 1, new Tuple([new Integer(1)]));
      const level1Values = [];
      while (!level1Iterator.atEnd()) {
        level1Values.push(level1Iterator.key().value);
        level1Iterator.next();
      }
      expect(level1Values).toEqual(['A']); // Only one value for prefix (1)
      
      // Verify level 2 ordering for prefix (1, A)
      const level2Iterator = new LevelIterator(trie, 2, new Tuple([new Integer(1), new StringAtom('A')]));
      const level2Values = [];
      while (!level2Iterator.atEnd()) {
        level2Values.push(level2Iterator.key().value);
        level2Iterator.next();
      }
      expect(level2Values).toEqual([false, true]); // Boolean ordering
    });

    it('should handle large datasets efficiently', () => {
      const trie = new Trie(3);
      const tupleCount = 1000;
      
      // Insert many tuples
      for (let i = 0; i < tupleCount; i++) {
        const tuple = new Tuple([
          new Integer(i % 10), // Group into 10 buckets
          new StringAtom(`name${i % 100}`), // 100 different names
          new Integer(i)
        ]);
        trie.insert(tuple);
      }
      
      // Verify we can iterate efficiently
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      let count = 0;
      while (!iterator.atEnd()) {
        count++;
        iterator.next();
      }
      expect(count).toBe(10); // Should have 10 unique values at level 0
      
      // Verify prefix queries work
      const prefixIterator = new LevelIterator(trie, 1, new Tuple([new Integer(0)]));
      let prefixCount = 0;
      while (!prefixIterator.atEnd()) {
        prefixCount++;
        prefixIterator.next();
      }
      expect(prefixCount).toBe(10); // Should have 10 unique names for prefix (0)
      // For i % 10 === 0: i = 0,10,20,...,990 
      // Names are name(i%100) = name0,name10,name20,...,name90 (10 unique)
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty relations gracefully', () => {
      const factory = new IteratorFactory();
      const emptyTrie = new Trie(2);
      factory.registerTrie('EmptyRel', emptyTrie);
      
      const iterator = factory.makeIter('EmptyRel', 0, new Tuple([]));
      expect(iterator.atEnd()).toBe(true);
      expect(iterator.key()).toBeUndefined();
    });

    it('should handle non-existent prefixes', () => {
      const factory = new IteratorFactory();
      const trie = new Trie(2);
      trie.insert(new Tuple([new Integer(1), new StringAtom('A')]));
      factory.registerTrie('TestRel', trie);
      
      const iterator = factory.makeIter('TestRel', 1, new Tuple([new Integer(999)]));
      expect(iterator.atEnd()).toBe(true);
    });

    it('should handle single-tuple relations', () => {
      const trie = new Trie(3);
      const singleTuple = new Tuple([
        new Integer(42),
        new StringAtom('singleton'),
        new BooleanAtom(true)
      ]);
      trie.insert(singleTuple);
      
      // Should be able to iterate to that single tuple
      const iterator = new LevelIterator(trie, 0, new Tuple([]));
      expect(iterator.atEnd()).toBe(false);
      expect(iterator.key().value).toBe(42);
      
      iterator.next();
      expect(iterator.atEnd()).toBe(true);
    });
  });
});