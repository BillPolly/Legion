/**
 * Unit tests for ArtifactMapping class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ArtifactMapping } from '../../ArtifactMapping.js';

describe('ArtifactMapping', () => {
  let mapping;

  beforeEach(() => {
    mapping = new ArtifactMapping();
  });

  describe('creation', () => {
    it('should initialize with empty mappings', () => {
      expect(mapping.childToParent).toEqual(new Map());
      expect(mapping.parentToChild).toEqual(new Map());
      expect(mapping.artifactMetadata).toEqual(new Map());
    });

    it('should accept initial mappings', () => {
      const customMapping = new ArtifactMapping({
        childToParent: new Map([['child1', 'parent1']]),
        parentToChild: new Map([['parent1', 'child1']])
      });

      expect(customMapping.childToParent.get('child1')).toBe('parent1');
      expect(customMapping.parentToChild.get('parent1')).toBe('child1');
    });
  });

  describe('mapping operations', () => {
    it('should add bidirectional mapping', () => {
      mapping.addMapping('childArtifact', 'parentArtifact');

      expect(mapping.childToParent.get('childArtifact')).toBe('parentArtifact');
      expect(mapping.parentToChild.get('parentArtifact')).toBe('childArtifact');
    });

    it('should add mapping with metadata', () => {
      mapping.addMapping('dbConnection', 'connection', {
        source: 'task_create_db',
        level: 2,
        type: 'object'
      });

      const metadata = mapping.getMetadata('dbConnection');
      expect(metadata.source).toBe('task_create_db');
      expect(metadata.level).toBe(2);
      expect(metadata.type).toBe('object');
    });

    it('should translate child artifact to parent', () => {
      mapping.addMapping('childSchema', 'schema');
      
      const parentName = mapping.translateToParent('childSchema');
      expect(parentName).toBe('schema');
    });

    it('should translate parent artifact to child', () => {
      mapping.addMapping('childConfig', 'config');
      
      const childName = mapping.translateToChild('config');
      expect(childName).toBe('childConfig');
    });

    it('should return null for unmapped artifacts', () => {
      expect(mapping.translateToParent('unknown')).toBeNull();
      expect(mapping.translateToChild('unknown')).toBeNull();
    });
  });

  describe('bulk operations', () => {
    it('should map child outputs to parent context', () => {
      const childOutputs = {
        dbConn: { type: 'connection', url: 'postgres://...' },
        dbSchema: { tables: ['users', 'posts'] }
      };

      const mappings = {
        dbConn: 'connection',
        dbSchema: 'schema'
      };

      const parentContext = mapping.mapChildOutputs(childOutputs, mappings);

      expect(parentContext.connection).toEqual(childOutputs.dbConn);
      expect(parentContext.schema).toEqual(childOutputs.dbSchema);
    });

    it('should map parent inputs to child context', () => {
      const parentInputs = {
        config: { host: 'localhost', port: 5432 },
        credentials: { user: 'admin', pass: 'secret' }
      };

      const mappings = {
        config: 'dbConfig',
        credentials: 'dbCreds'
      };

      const childContext = mapping.mapParentInputs(parentInputs, mappings);

      expect(childContext.dbConfig).toEqual(parentInputs.config);
      expect(childContext.dbCreds).toEqual(parentInputs.credentials);
    });

    it('should handle partial mappings', () => {
      const childOutputs = {
        output1: 'value1',
        output2: 'value2',
        output3: 'value3'
      };

      const mappings = {
        output1: 'result1',
        output3: 'result3'
        // output2 is not mapped
      };

      const parentContext = mapping.mapChildOutputs(childOutputs, mappings);

      expect(parentContext.result1).toBe('value1');
      expect(parentContext.result3).toBe('value3');
      expect(parentContext.output2).toBeUndefined();
    });
  });

  describe('conflict resolution', () => {
    it('should detect naming conflicts', () => {
      mapping.addMapping('child1', 'output');
      mapping.addMapping('child2', 'output'); // Conflict!

      const conflicts = mapping.findConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].parentName).toBe('output');
      expect(conflicts[0].childNames).toContain('child1');
      expect(conflicts[0].childNames).toContain('child2');
    });

    it('should resolve conflicts with prefixes', () => {
      mapping.addMapping('task1_output', 'output');
      mapping.addMapping('task2_output', 'output');

      mapping.resolveConflictsWithPrefix();

      expect(mapping.translateToParent('task1_output')).toBe('task1_output');
      expect(mapping.translateToParent('task2_output')).toBe('task2_output');
    });

    it('should resolve conflicts with suffixes', () => {
      mapping.addMapping('output', 'result');
      mapping.addMapping('output2', 'result');

      mapping.resolveConflictsWithSuffix();

      expect(mapping.translateToParent('output')).toBe('result_1');
      expect(mapping.translateToParent('output2')).toBe('result_2');
    });
  });

  describe('lineage tracking', () => {
    it('should track artifact lineage', () => {
      mapping.addMapping('childArtifact', 'parentArtifact', {
        source: 'task_123',
        level: 2,
        path: ['root', 'subtask1', 'task_123']
      });

      const lineage = mapping.getLineage('childArtifact');
      expect(lineage.source).toBe('task_123');
      expect(lineage.level).toBe(2);
      expect(lineage.path).toEqual(['root', 'subtask1', 'task_123']);
    });

    it('should build complete lineage chain', () => {
      const level2Mapping = new ArtifactMapping();
      level2Mapping.addMapping('dbConn', 'connection', {
        source: 'create_db',
        level: 2
      });

      const level1Mapping = new ArtifactMapping();
      level1Mapping.addMapping('connection', 'mainConnection', {
        source: 'setup_backend',
        level: 1,
        previous: level2Mapping
      });

      const chain = level1Mapping.getLineageChain('mainConnection');
      expect(chain).toHaveLength(2);
      expect(chain[0].source).toBe('setup_backend');
      expect(chain[1].source).toBe('create_db');
    });
  });

  describe('validation', () => {
    it('should validate mapping completeness', () => {
      mapping.addMapping('child1', 'parent1');
      mapping.addMapping('child2', 'parent2');

      const requiredOutputs = ['child1', 'child2', 'child3'];
      const validation = mapping.validateCompleteness(requiredOutputs);

      expect(validation.complete).toBe(false);
      expect(validation.unmapped).toContain('child3');
    });

    it('should validate no orphaned mappings', () => {
      mapping.addMapping('child1', 'parent1');
      mapping.addMapping('child2', 'parent2');

      const actualOutputs = ['child1'];
      const validation = mapping.validateNoOrphans(actualOutputs);

      expect(validation.valid).toBe(false);
      expect(validation.orphaned).toContain('child2');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      mapping.addMapping('child1', 'parent1', { level: 1 });
      mapping.addMapping('child2', 'parent2', { level: 2 });

      const json = mapping.toJSON();
      expect(json.mappings).toHaveLength(2);
      expect(json.mappings[0]).toEqual({
        child: 'child1',
        parent: 'parent1',
        metadata: { level: 1 }
      });
    });

    it('should deserialize from JSON', () => {
      const json = {
        mappings: [
          { child: 'c1', parent: 'p1', metadata: { level: 1 } },
          { child: 'c2', parent: 'p2', metadata: { level: 2 } }
        ]
      };

      const restored = ArtifactMapping.fromJSON(json);
      expect(restored.translateToParent('c1')).toBe('p1');
      expect(restored.translateToParent('c2')).toBe('p2');
      expect(restored.getMetadata('c1').level).toBe(1);
    });
  });
});