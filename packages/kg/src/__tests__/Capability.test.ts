/**
 * Tests for the Capability class - Minimal 2-Field Model
 */

import { Capability } from '../index';

describe('Capability', () => {
  describe('constructor', () => {
    it('should create a valid capability with minimal 2-field model', () => {
      const capability = new Capability({
        _id: 'install_kitchen_sink',
        subtypeOf: 'install_sink',
        attributes: {
          name: 'Install Kitchen Sink',
          description: 'Complete installation of kitchen sink with plumbing connections',
          duration: '45 minutes',
          difficulty: 'intermediate',
          cost: 75.00
        }
      });

      expect(capability.id).toBe('install_kitchen_sink'); // Backward compatibility getter
      expect(capability._id).toBe('install_kitchen_sink');
      expect(capability.subtypeOf).toBe('install_sink');
      expect(capability.name).toBe('Install Kitchen Sink');
      expect(capability.description).toBe('Complete installation of kitchen sink with plumbing connections');
      expect(capability.attributes.duration).toBe('45 minutes');
    });

    it('should require _id', () => {
      expect(() => new Capability({
        _id: '',
        subtypeOf: 'all',
        attributes: {}
      })).toThrow('Capability _id is required');
    });

    it('should require subtypeOf', () => {
      expect(() => new Capability({
        _id: 'test',
        subtypeOf: '',
        attributes: {}
      })).toThrow('Capability subtypeOf is required');
    });

    it('should automatically add timestamps', () => {
      const capability = new Capability({
        _id: 'test_capability',
        subtypeOf: 'all',
        attributes: {
          name: 'Test Capability'
        }
      });

      expect(capability.attributes.createdAt).toBeInstanceOf(Date);
      expect(capability.attributes.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('relationships', () => {
    it('should handle inheritance relationships', () => {
      const parent = new Capability({
        _id: 'install_sink',
        subtypeOf: 'action.task',
        attributes: { 
          name: 'Install Sink',
          difficulty: 'easy' 
        }
      });

      const child = new Capability({
        _id: 'install_kitchen_sink',
        subtypeOf: 'install_sink', // Core inheritance field
        attributes: { 
          name: 'Install Kitchen Sink',
          difficulty: 'intermediate'
        }
      });

      expect(child.subtypeOf).toBe('install_sink');
    });

    it('should handle composition relationships', () => {
      const packageCapability = new Capability({
        _id: 'bathroom_renovation',
        subtypeOf: 'action.package',
        attributes: { 
          name: 'Bathroom Renovation Package',
          totalCost: 2500.00,
          parts: ['remove_fixtures', 'install_new_fixtures']
        }
      });

      expect(packageCapability.hasPart).toEqual(['remove_fixtures', 'install_new_fixtures']);
    });

    it('should handle use relationships', () => {
      const use = new Capability({
        _id: 'pipe_fitting_in_sink_install',
        subtypeOf: 'action.use',
        attributes: {
          name: 'Pipe Fitting for Sink Installation',
          duration: '15 minutes',
          cost: 25.00,
          uses: 'pipe_fitting_skill',
          partOf: 'install_kitchen_sink'
        }
      });

      expect(use.uses).toBe('pipe_fitting_skill');
      expect(use.partOf).toBe('install_kitchen_sink');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const original = new Capability({
        _id: 'test_capability',
        subtypeOf: 'resource.input.consumable',
        attributes: {
          name: 'Test Consumable',
          description: 'A test consumable item',
          cost: 5.99,
          volume: '300ml'
        }
      });

      const json = original.toJSON();
      const restored = Capability.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored._id).toBe(original._id);
      expect(restored.subtypeOf).toBe(original.subtypeOf);
      expect(restored.name).toBe(original.name);
      expect(restored.description).toBe(original.description);
      expect(restored.attributes).toEqual(original.attributes);
    });
  });

  describe('update functionality', () => {
    it('should update capability properties', () => {
      const capability = new Capability({
        _id: 'test_capability',
        subtypeOf: 'action.task',
        attributes: { 
          name: 'Original Name',
          cost: 100 
        }
      });

      capability.update({
        attributes: { 
          name: 'Updated Name',
          cost: 150, 
          duration: '30 minutes' 
        }
      });

      expect(capability.name).toBe('Updated Name');
      expect(capability.attributes.cost).toBe(150);
      expect(capability.attributes.duration).toBe('30 minutes');
    });

    it('should update the updatedAt timestamp', () => {
      const capability = new Capability({
        _id: 'test_capability',
        subtypeOf: 'action.task',
        attributes: { 
          name: 'Original Name'
        }
      });

      const originalUpdatedAt = capability.attributes.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        capability.update({
          attributes: { 
            name: 'Updated Name'
          }
        });

        expect(capability.attributes.updatedAt).not.toEqual(originalUpdatedAt);
      }, 10);
    });
  });

  describe('convenience getters', () => {
    it('should return name from attributes or fallback to id', () => {
      const withName = new Capability({
        _id: 'test_with_name',
        subtypeOf: 'action.task',
        attributes: { name: 'Test Name' }
      });

      const withoutName = new Capability({
        _id: 'test_without_name',
        subtypeOf: 'action.task',
        attributes: {}
      });

      expect(withName.name).toBe('Test Name');
      expect(withoutName.name).toBe('test_without_name');
    });

    it('should return description from attributes', () => {
      const withDescription = new Capability({
        _id: 'test_with_desc',
        subtypeOf: 'action.task',
        attributes: { description: 'Test Description' }
      });

      const withoutDescription = new Capability({
        _id: 'test_without_desc',
        subtypeOf: 'action.task',
        attributes: {}
      });

      expect(withDescription.description).toBe('Test Description');
      expect(withoutDescription.description).toBeUndefined();
    });

    it('should return parts from attributes', () => {
      const withParts = new Capability({
        _id: 'test_with_parts',
        subtypeOf: 'action.package',
        attributes: { parts: ['part1', 'part2'] }
      });

      const withoutParts = new Capability({
        _id: 'test_without_parts',
        subtypeOf: 'action.package',
        attributes: {}
      });

      expect(withParts.hasPart).toEqual(['part1', 'part2']);
      expect(withoutParts.hasPart).toEqual([]);
    });

    it('should return uses and partOf from attributes', () => {
      const withRelations = new Capability({
        _id: 'test_with_relations',
        subtypeOf: 'action.use',
        attributes: { 
          uses: 'some_skill',
          partOf: 'some_task'
        }
      });

      const withoutRelations = new Capability({
        _id: 'test_without_relations',
        subtypeOf: 'action.use',
        attributes: {}
      });

      expect(withRelations.uses).toBe('some_skill');
      expect(withRelations.partOf).toBe('some_task');
      expect(withoutRelations.uses).toBeNull();
      expect(withoutRelations.partOf).toBeNull();
    });

    it('should return requires from attributes', () => {
      const withRequires = new Capability({
        _id: 'test_with_requires',
        subtypeOf: 'action.task',
        attributes: { requires: ['tool1', 'tool2'] }
      });

      const withoutRequires = new Capability({
        _id: 'test_without_requires',
        subtypeOf: 'action.task',
        attributes: {}
      });

      expect(withRequires.requires).toEqual(['tool1', 'tool2']);
      expect(withoutRequires.requires).toEqual([]);
    });
  });

  describe('minimal model validation', () => {
    it('should work with just _id and subtypeOf', () => {
      const minimal = new Capability({
        _id: 'minimal_capability',
        subtypeOf: 'all'
      });

      expect(minimal._id).toBe('minimal_capability');
      expect(minimal.subtypeOf).toBe('all');
      expect(minimal.attributes).toBeDefined();
      expect(minimal.attributes.createdAt).toBeInstanceOf(Date);
      expect(minimal.attributes.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle complex attributes', () => {
      const complex = new Capability({
        _id: 'complex_capability',
        subtypeOf: 'action.task',
        attributes: {
          name: 'Complex Task',
          description: 'A complex task with many attributes',
          cost: 100.50,
          duration: '2 hours',
          difficulty: 'hard',
          tags: ['important', 'urgent'],
          metadata: {
            version: '1.0',
            author: 'test'
          },
          parts: ['subtask1', 'subtask2'],
          requires: ['tool1', 'skill1'],
          uses: 'primary_skill',
          partOf: 'parent_package'
        }
      });

      expect(complex.name).toBe('Complex Task');
      expect(complex.attributes.cost).toBe(100.50);
      expect(complex.attributes.tags).toEqual(['important', 'urgent']);
      expect(complex.attributes.metadata.version).toBe('1.0');
      expect(complex.hasPart).toEqual(['subtask1', 'subtask2']);
      expect(complex.requires).toEqual(['tool1', 'skill1']);
      expect(complex.uses).toBe('primary_skill');
      expect(complex.partOf).toBe('parent_package');
    });
  });
});
