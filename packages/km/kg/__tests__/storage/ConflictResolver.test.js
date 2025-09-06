import { describe, test, expect, beforeEach } from '@jest/globals';
import { ConflictResolver, ConflictUtils } from '../../src/storage/ConflictResolver.js';
import { ValidationError, StorageError } from '@legion/kg-storage-core';

describe('ConflictResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new ConflictResolver('merge');
  });

  describe('Constructor and Configuration', () => {
    test('should create resolver with default merge strategy', () => {
      const defaultResolver = new ConflictResolver();
      expect(defaultResolver.strategy).toBe('merge');
    });

    test('should create resolver with specified strategy', () => {
      const overwriteResolver = new ConflictResolver('overwrite');
      expect(overwriteResolver.strategy).toBe('overwrite');
    });

    test('should throw error for unsupported strategy', () => {
      expect(() => {
        new ConflictResolver('invalid');
      }).toThrow(ValidationError);
    });

    test('should list supported strategies', () => {
      expect(resolver.supportedStrategies).toEqual(['merge', 'overwrite', 'fail', 'manual']);
    });
  });

  describe('Conflict Analysis', () => {
    test('should detect no conflict when triples are identical', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 'object2']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 'object2']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.conflict.hasConflict).toBe(false);
      expect(resolution.conflict.localOnly).toHaveLength(0);
      expect(resolution.conflict.remoteOnly).toHaveLength(0);
      expect(resolution.conflict.common).toHaveLength(2);
    });

    test('should detect local-only triples', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 'object2']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.conflict.hasConflict).toBe(true);
      expect(resolution.conflict.localOnly).toEqual([['subject2', 'predicate2', 'object2']]);
      expect(resolution.conflict.remoteOnly).toHaveLength(0);
      expect(resolution.conflict.common).toEqual([['subject1', 'predicate1', 'object1']]);
    });

    test('should detect remote-only triples', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 'object2']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.conflict.hasConflict).toBe(true);
      expect(resolution.conflict.localOnly).toHaveLength(0);
      expect(resolution.conflict.remoteOnly).toEqual([['subject2', 'predicate2', 'object2']]);
      expect(resolution.conflict.common).toEqual([['subject1', 'predicate1', 'object1']]);
    });

    test('should detect subject-level conflicts', async () => {
      const localTriples = [
        ['person1', 'name', 'John'],
        ['person1', 'age', 25]
      ];
      const remoteTriples = [
        ['person1', 'name', 'John'],
        ['person1', 'age', 30]
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.conflict.hasConflict).toBe(true);
      expect(resolution.conflict.subjectConflicts).toHaveLength(1);
      
      const subjectConflict = resolution.conflict.subjectConflicts[0];
      expect(subjectConflict.subject).toBe('person1');
      expect(subjectConflict.hasConflict).toBe(true);
      expect(subjectConflict.conflictingPredicates).toHaveLength(1);
      
      const predConflict = subjectConflict.conflictingPredicates[0];
      expect(predConflict.predicate).toBe('age');
      expect(predConflict.localValues).toEqual([25]);
      expect(predConflict.remoteValues).toEqual([30]);
    });
  });

  describe('Merge Strategy', () => {
    test('should merge non-conflicting triples', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject2', 'predicate2', 'object2']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject3', 'predicate3', 'object3']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.strategy).toBe('merge');
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toHaveLength(3);
      expect(resolution.triples).toContainEqual(['subject1', 'predicate1', 'object1']);
      expect(resolution.triples).toContainEqual(['subject2', 'predicate2', 'object2']);
      expect(resolution.triples).toContainEqual(['subject3', 'predicate3', 'object3']);
    });

    test('should merge conflicting values for same predicate', async () => {
      const localTriples = [
        ['person1', 'skill', 'JavaScript'],
        ['person1', 'skill', 'Python']
      ];
      const remoteTriples = [
        ['person1', 'skill', 'Python'],
        ['person1', 'skill', 'Java']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.strategy).toBe('merge');
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toHaveLength(3);
      expect(resolution.triples).toContainEqual(['person1', 'skill', 'JavaScript']);
      expect(resolution.triples).toContainEqual(['person1', 'skill', 'Python']);
      expect(resolution.triples).toContainEqual(['person1', 'skill', 'Java']);
    });

    test('should deduplicate merged triples', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1'],
        ['subject1', 'predicate1', 'object1'] // Duplicate
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.triples).toHaveLength(1);
      expect(resolution.triples).toContainEqual(['subject1', 'predicate1', 'object1']);
    });
  });

  describe('Overwrite Strategy', () => {
    beforeEach(() => {
      resolver = new ConflictResolver('overwrite');
    });

    test('should keep local triples and discard remote', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'local_value']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'remote_value']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.strategy).toBe('overwrite');
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toEqual(localTriples);
      expect(resolution.resolution.action).toBe('overwritten');
    });
  });

  describe('Fail Strategy', () => {
    beforeEach(() => {
      resolver = new ConflictResolver('fail');
    });

    test('should succeed when no conflicts exist', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.strategy).toBe('fail');
      expect(resolution.resolved).toBe(true);
      expect(resolution.resolution.action).toBe('no-conflict');
    });

    test('should throw error when conflicts exist', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'local_value']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'remote_value']
      ];

      await expect(resolver.resolveConflict(localTriples, remoteTriples))
        .rejects.toThrow(StorageError);
    });
  });

  describe('Manual Strategy', () => {
    beforeEach(() => {
      resolver = new ConflictResolver('manual');
    });

    test('should return unresolved conflict for manual handling', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'local_value']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'remote_value']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.strategy).toBe('manual');
      expect(resolution.resolved).toBe(false);
      expect(resolution.triples).toBeNull();
      expect(resolution.resolution.action).toBe('manual-required');
      expect(resolution.resolution.suggestions).toBeDefined();
      expect(resolution.resolution.suggestions.length).toBeGreaterThan(0);
    });

    test('should provide helpful suggestions', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'local_value'],
        ['subject2', 'predicate2', 'local_only']
      ];
      const remoteTriples = [
        ['subject1', 'predicate1', 'remote_value'],
        ['subject3', 'predicate3', 'remote_only']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      const suggestions = resolution.resolution.suggestions;
      expect(suggestions.some(s => s.includes('local-only'))).toBe(true);
      expect(suggestions.some(s => s.includes('remote-only'))).toBe(true);
    });
  });

  describe('Strategy Management', () => {
    test('should change strategy', () => {
      resolver.setStrategy('overwrite');
      expect(resolver.strategy).toBe('overwrite');
    });

    test('should throw error for invalid strategy change', () => {
      expect(() => {
        resolver.setStrategy('invalid');
      }).toThrow(ValidationError);
    });

    test('should return metadata', () => {
      const metadata = resolver.getMetadata();
      expect(metadata.strategy).toBe('merge');
      expect(metadata.supportedStrategies).toEqual(['merge', 'overwrite', 'fail', 'manual']);
    });
  });

  describe('Complex Conflict Scenarios', () => {
    test('should handle mixed conflicts correctly', async () => {
      const localTriples = [
        ['person1', 'name', 'John'],
        ['person1', 'age', 25],
        ['person1', 'skill', 'JavaScript'],
        ['person2', 'name', 'Alice'],
        ['person3', 'local_only', 'value']
      ];
      const remoteTriples = [
        ['person1', 'name', 'John'],
        ['person1', 'age', 30],
        ['person1', 'skill', 'Python'],
        ['person2', 'name', 'Alice'],
        ['person4', 'remote_only', 'value']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.strategy).toBe('merge');
      expect(resolution.resolved).toBe(true);
      
      // Should include all unique triples
      expect(resolution.triples).toContainEqual(['person1', 'name', 'John']);
      expect(resolution.triples).toContainEqual(['person1', 'age', 25]);
      expect(resolution.triples).toContainEqual(['person1', 'age', 30]);
      expect(resolution.triples).toContainEqual(['person1', 'skill', 'JavaScript']);
      expect(resolution.triples).toContainEqual(['person1', 'skill', 'Python']);
      expect(resolution.triples).toContainEqual(['person2', 'name', 'Alice']);
      expect(resolution.triples).toContainEqual(['person3', 'local_only', 'value']);
      expect(resolution.triples).toContainEqual(['person4', 'remote_only', 'value']);
    });

    test('should handle type conflicts correctly', async () => {
      const localTriples = [
        ['subject1', 'value', 'string_value'],
        ['subject1', 'number', 42]
      ];
      const remoteTriples = [
        ['subject1', 'value', 123],
        ['subject1', 'number', 42]
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toContainEqual(['subject1', 'value', 'string_value']);
      expect(resolution.triples).toContainEqual(['subject1', 'value', 123]);
      expect(resolution.triples).toContainEqual(['subject1', 'number', 42]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty local triples', async () => {
      const localTriples = [];
      const remoteTriples = [
        ['subject1', 'predicate1', 'object1']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toEqual(remoteTriples);
    });

    test('should handle empty remote triples', async () => {
      const localTriples = [
        ['subject1', 'predicate1', 'object1']
      ];
      const remoteTriples = [];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toEqual(localTriples);
    });

    test('should handle both empty triple sets', async () => {
      const localTriples = [];
      const remoteTriples = [];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toEqual([]);
      expect(resolution.conflict.hasConflict).toBe(false);
    });

    test('should handle null and undefined values', async () => {
      const localTriples = [
        ['subject1', 'value', null],
        ['subject2', 'value', undefined]
      ];
      const remoteTriples = [
        ['subject1', 'value', null],
        ['subject2', 'value', 'defined']
      ];

      const resolution = await resolver.resolveConflict(localTriples, remoteTriples);
      
      expect(resolution.resolved).toBe(true);
      expect(resolution.triples).toContainEqual(['subject1', 'value', null]);
      expect(resolution.triples).toContainEqual(['subject2', 'value', undefined]);
      expect(resolution.triples).toContainEqual(['subject2', 'value', 'defined']);
    });
  });
});

describe('ConflictUtils', () => {
  test('should create merge resolver', () => {
    const resolver = ConflictUtils.createMergeResolver();
    expect(resolver.strategy).toBe('merge');
  });

  test('should create overwrite resolver', () => {
    const resolver = ConflictUtils.createOverwriteResolver();
    expect(resolver.strategy).toBe('overwrite');
  });

  test('should create fail resolver', () => {
    const resolver = ConflictUtils.createFailResolver();
    expect(resolver.strategy).toBe('fail');
  });

  test('should create manual resolver', () => {
    const resolver = ConflictUtils.createManualResolver();
    expect(resolver.strategy).toBe('manual');
  });

  test('should analyze conflict without resolving', () => {
    const localTriples = [
      ['subject1', 'predicate1', 'local_value']
    ];
    const remoteTriples = [
      ['subject1', 'predicate1', 'remote_value']
    ];

    const conflict = ConflictUtils.analyzeConflict(localTriples, remoteTriples);
    
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.totalLocal).toBe(1);
    expect(conflict.totalRemote).toBe(1);
    expect(conflict.common).toHaveLength(0);
    expect(conflict.localOnly).toHaveLength(1);
    expect(conflict.remoteOnly).toHaveLength(1);
  });
});
