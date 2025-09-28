import { describe, it, expect, beforeEach } from '@jest/globals';
import { TripleIndex } from '../../../src/utils/TripleIndex.js';

describe('TripleIndex', () => {
  let index;

  beforeEach(() => {
    index = new TripleIndex();
  });

  describe('initialization', () => {
    it('should create an empty index', () => {
      expect(index.spo).toBeInstanceOf(Map);
      expect(index.pos).toBeInstanceOf(Map);
      expect(index.osp).toBeInstanceOf(Map);
      expect(index.spo.size).toBe(0);
      expect(index.pos.size).toBe(0);
      expect(index.osp.size).toBe(0);
    });
  });

  describe('addTriple', () => {
    it('should add a triple and update all three indices', () => {
      index.addTriple('user:1', 'hasName', 'Alice');
      
      // Check SPO index
      expect(index.spo.has('user:1')).toBe(true);
      expect(index.spo.get('user:1').has('hasName')).toBe(true);
      expect(index.spo.get('user:1').get('hasName').has('Alice')).toBe(true);
      
      // Check POS index
      expect(index.pos.has('hasName')).toBe(true);
      expect(index.pos.get('hasName').has('Alice')).toBe(true);
      expect(index.pos.get('hasName').get('Alice').has('user:1')).toBe(true);
      
      // Check OSP index
      expect(index.osp.has('Alice')).toBe(true);
      expect(index.osp.get('Alice').has('user:1')).toBe(true);
      expect(index.osp.get('Alice').get('user:1').has('hasName')).toBe(true);
    });

    it('should handle multiple triples with same subject', () => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:1', 'hasAge', 30);
      
      const predicates = index.spo.get('user:1');
      expect(predicates.size).toBe(2);
      expect(predicates.has('hasName')).toBe(true);
      expect(predicates.has('hasAge')).toBe(true);
    });

    it('should handle multiple triples with same predicate', () => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:2', 'hasName', 'Bob');
      
      const objects = index.pos.get('hasName');
      expect(objects.size).toBe(2);
      expect(objects.has('Alice')).toBe(true);
      expect(objects.has('Bob')).toBe(true);
    });

    it('should handle multiple triples with same object', () => {
      index.addTriple('user:1', 'livesIn', 'NYC');
      index.addTriple('user:2', 'livesIn', 'NYC');
      
      const subjects = index.osp.get('NYC');
      expect(subjects.size).toBe(2);
      expect(subjects.has('user:1')).toBe(true);
      expect(subjects.has('user:2')).toBe(true);
    });

    it('should handle duplicate triples gracefully', () => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:1', 'hasName', 'Alice'); // Duplicate
      
      const objects = index.spo.get('user:1').get('hasName');
      expect(objects.size).toBe(1); // Should still be 1
    });

    it('should handle various value types', () => {
      index.addTriple('user:1', 'hasAge', 30);
      index.addTriple('user:2', 'isActive', true);
      index.addTriple('user:3', 'hasScore', 3.14);
      
      expect(index.spo.get('user:1').get('hasAge').has(30)).toBe(true);
      expect(index.spo.get('user:2').get('isActive').has(true)).toBe(true);
      expect(index.spo.get('user:3').get('hasScore').has(3.14)).toBe(true);
    });
  });

  describe('removeTriple', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:1', 'hasAge', 30);
      index.addTriple('user:2', 'hasName', 'Bob');
    });

    it('should remove a triple from all indices', () => {
      index.removeTriple('user:1', 'hasName', 'Alice');
      
      // Should be removed from SPO
      expect(index.spo.get('user:1')?.get('hasName')?.has('Alice')).toBeFalsy();
      
      // Should be removed from POS
      expect(index.pos.get('hasName')?.get('Alice')?.has('user:1')).toBeFalsy();
      
      // Should be removed from OSP
      expect(index.osp.get('Alice')?.get('user:1')?.has('hasName')).toBeFalsy();
    });

    it('should not affect other triples for same subject', () => {
      index.removeTriple('user:1', 'hasName', 'Alice');
      
      // user:1 hasAge 30 should still exist
      expect(index.spo.get('user:1').get('hasAge').has(30)).toBe(true);
    });

    it('should handle removing non-existent triple', () => {
      // Should not throw error
      expect(() => {
        index.removeTriple('user:999', 'hasName', 'Nobody');
      }).not.toThrow();
    });
  });

  describe('getObjects', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:1', 'hasAge', 30);
      index.addTriple('user:1', 'hasEmail', 'alice@example.com');
      index.addTriple('user:2', 'hasName', 'Bob');
    });

    it('should return all objects for a subject-predicate pair', () => {
      const objects = index.getObjects('user:1', 'hasName');
      expect(objects).toHaveLength(1);
      expect(objects).toContain('Alice');
    });

    it('should return empty array for non-existent subject', () => {
      const objects = index.getObjects('user:999', 'hasName');
      expect(objects).toEqual([]);
    });

    it('should return empty array for non-existent predicate', () => {
      const objects = index.getObjects('user:1', 'nonExistent');
      expect(objects).toEqual([]);
    });
  });

  describe('getSubjects', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:2', 'hasName', 'Alice'); // Same name
      index.addTriple('user:3', 'hasName', 'Bob');
    });

    it('should return all subjects for a predicate-object pair', () => {
      const subjects = index.getSubjects('hasName', 'Alice');
      expect(subjects).toHaveLength(2);
      expect(subjects).toContain('user:1');
      expect(subjects).toContain('user:2');
    });

    it('should return empty array for non-existent predicate', () => {
      const subjects = index.getSubjects('nonExistent', 'Alice');
      expect(subjects).toEqual([]);
    });

    it('should return empty array for non-existent object', () => {
      const subjects = index.getSubjects('hasName', 'Nobody');
      expect(subjects).toEqual([]);
    });
  });

  describe('getPredicates', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:1', 'knows', 'user:2');
      index.addTriple('user:2', 'hasName', 'Alice'); // Same object, different subject
    });

    it('should return all predicates connecting a subject and object', () => {
      const predicates = index.getPredicates('user:1', 'Alice');
      expect(predicates).toHaveLength(1);
      expect(predicates).toContain('hasName');
    });

    it('should return empty array for non-existent object', () => {
      const predicates = index.getPredicates('user:1', 'Nobody');
      expect(predicates).toEqual([]);
    });

    it('should return empty array for non-existent subject', () => {
      const predicates = index.getPredicates('user:999', 'Alice');
      expect(predicates).toEqual([]);
    });
  });

  describe('getAllFromSubject', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:1', 'hasAge', 30);
      index.addTriple('user:1', 'hasEmail', 'alice@example.com');
      index.addTriple('user:2', 'hasName', 'Bob');
    });

    it('should return all triples for a subject', () => {
      const triples = index.getAllFromSubject('user:1');
      expect(triples).toHaveLength(3);
      
      // Check that all expected triples are present
      expect(triples).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(triples).toContainEqual(['user:1', 'hasAge', 30]);
      expect(triples).toContainEqual(['user:1', 'hasEmail', 'alice@example.com']);
    });

    it('should return empty array for non-existent subject', () => {
      const triples = index.getAllFromSubject('user:999');
      expect(triples).toEqual([]);
    });
  });

  describe('getAllFromPredicate', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:2', 'hasName', 'Bob');
      index.addTriple('user:3', 'hasName', 'Charlie');
      index.addTriple('user:1', 'hasAge', 30);
    });

    it('should return all triples for a predicate', () => {
      const triples = index.getAllFromPredicate('hasName');
      expect(triples).toHaveLength(3);
      
      expect(triples).toContainEqual(['user:1', 'hasName', 'Alice']);
      expect(triples).toContainEqual(['user:2', 'hasName', 'Bob']);
      expect(triples).toContainEqual(['user:3', 'hasName', 'Charlie']);
    });

    it('should return empty array for non-existent predicate', () => {
      const triples = index.getAllFromPredicate('nonExistent');
      expect(triples).toEqual([]);
    });
  });

  describe('getAllFromObject', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'livesIn', 'NYC');
      index.addTriple('user:2', 'livesIn', 'NYC');
      index.addTriple('user:3', 'worksIn', 'NYC');
      index.addTriple('user:1', 'hasAge', 30);
    });

    it('should return all triples for an object', () => {
      const triples = index.getAllFromObject('NYC');
      expect(triples).toHaveLength(3);
      
      expect(triples).toContainEqual(['user:1', 'livesIn', 'NYC']);
      expect(triples).toContainEqual(['user:2', 'livesIn', 'NYC']);
      expect(triples).toContainEqual(['user:3', 'worksIn', 'NYC']);
    });

    it('should return empty array for non-existent object', () => {
      const triples = index.getAllFromObject('Nobody');
      expect(triples).toEqual([]);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      index.addTriple('user:1', 'hasName', 'Alice');
      index.addTriple('user:2', 'hasAge', 30);
    });

    it('should clear all indices', () => {
      index.clear();
      
      expect(index.spo.size).toBe(0);
      expect(index.pos.size).toBe(0);
      expect(index.osp.size).toBe(0);
    });

    it('should allow adding new triples after clear', () => {
      index.clear();
      index.addTriple('user:3', 'hasName', 'Charlie');
      
      expect(index.spo.size).toBe(1);
      const objects = index.getObjects('user:3', 'hasName');
      expect(objects).toContain('Charlie');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string values', () => {
      index.addTriple('user:1', 'hasNickname', '');
      const objects = index.getObjects('user:1', 'hasNickname');
      expect(objects).toContain('');
    });

    it('should handle zero as a value', () => {
      index.addTriple('user:1', 'hasScore', 0);
      const objects = index.getObjects('user:1', 'hasScore');
      expect(objects).toContain(0);
    });

    it('should handle false as a value', () => {
      index.addTriple('user:1', 'isActive', false);
      const objects = index.getObjects('user:1', 'isActive');
      expect(objects).toContain(false);
    });

    it('should differentiate between number and string', () => {
      index.addTriple('user:1', 'hasValue', 123);
      index.addTriple('user:2', 'hasValue', '123');
      
      const triples = index.getAllFromPredicate('hasValue');
      expect(triples).toHaveLength(2);
      expect(triples).toContainEqual(['user:1', 'hasValue', 123]);
      expect(triples).toContainEqual(['user:2', 'hasValue', '123']);
    });
  });
});