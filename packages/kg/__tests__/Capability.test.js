/**
 * Unit tests for Capability class
 * ES6 JavaScript version
 */

import { Capability } from '../src-js/types/Capability.js';

describe('Capability', () => {
  describe('constructor', () => {
    it('should create a valid capability with required fields', () => {
      const capability = new Capability({
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: { name: 'Test Capability' }
      });

      expect(capability._id).toBe('test-capability');
      expect(capability.subtypeOf).toBe('base-type');
      expect(capability.attributes.name).toBe('Test Capability');
    });

    it('should add timestamps automatically', () => {
      const capability = new Capability({
        _id: 'test-capability',
        subtypeOf: 'base-type'
      });

      expect(capability.attributes.createdAt).toBeInstanceOf(Date);
      expect(capability.attributes.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when _id is missing', () => {
      expect(() => {
        new Capability({
          subtypeOf: 'base-type'
        });
      }).toThrow('Capability _id is required');
    });

    it('should throw error when _id is empty string', () => {
      expect(() => {
        new Capability({
          _id: '',
          subtypeOf: 'base-type'
        });
      }).toThrow('Capability _id is required');
    });

    it('should throw error when subtypeOf is missing', () => {
      expect(() => {
        new Capability({
          _id: 'test-capability'
        });
      }).toThrow('Capability subtypeOf is required');
    });

    it('should throw error when subtypeOf is empty string', () => {
      expect(() => {
        new Capability({
          _id: 'test-capability',
          subtypeOf: ''
        });
      }).toThrow('Capability subtypeOf is required');
    });

    it('should preserve existing timestamps in attributes', () => {
      const createdAt = new Date('2023-01-01');
      const updatedAt = new Date('2023-01-02');
      
      const capability = new Capability({
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: {
          createdAt,
          updatedAt
        }
      });

      expect(capability.attributes.createdAt).toBe(createdAt);
      expect(capability.attributes.updatedAt).toBe(updatedAt);
    });
  });

  describe('update', () => {
    let capability;

    beforeEach(() => {
      capability = new Capability({
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: { name: 'Original Name' }
      });
    });

    it('should update attributes', () => {
      capability.update({
        attributes: { description: 'New description' }
      });

      expect(capability.attributes.description).toBe('New description');
      expect(capability.attributes.name).toBe('Original Name'); // Merged
    });

    it('should update timestamp on update', () => {
      const originalTime = capability.attributes.updatedAt;
      
      // Wait a bit to ensure different timestamp
      setTimeout(() => {
        capability.update({ attributes: { test: 'value' } });
        expect(capability.attributes.updatedAt.getTime()).toBeGreaterThan(originalTime.getTime());
      }, 10);
    });

    it('should merge attributes on update', () => {
      // Test that update merges attributes rather than replacing them
      capability.update({ attributes: { newField: 'newValue' } });
      expect(capability.attributes.name).toBe('Original Name'); // Original preserved
      expect(capability.attributes.newField).toBe('newValue'); // New field added
    });
  });

  describe('toJSON', () => {
    it('should return plain object representation', () => {
      const capability = new Capability({
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: { name: 'Test' }
      });

      const json = capability.toJSON();
      
      expect(json).toEqual({
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: expect.objectContaining({
          name: 'Test',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      });
    });
  });

  describe('fromJSON', () => {
    it('should create capability from JSON data', () => {
      const data = {
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: {
          name: 'Test',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02')
        }
      };

      const capability = Capability.fromJSON(data);
      
      expect(capability._id).toBe('test-capability');
      expect(capability.subtypeOf).toBe('base-type');
      expect(capability.attributes).toEqual(data.attributes);
    });
  });

  describe('convenience getters', () => {
    let capability;

    beforeEach(() => {
      capability = new Capability({
        _id: 'test-capability',
        subtypeOf: 'base-type',
        attributes: {
          name: 'Test Name',
          description: 'Test Description',
          partOf: 'parent-id',
          uses: 'tool-id',
          parts: ['part1', 'part2'],
          requires: ['req1', 'req2']
        }
      });
    });

    it('should get id from _id', () => {
      expect(capability.id).toBe('test-capability');
    });

    it('should get name from attributes', () => {
      expect(capability.name).toBe('Test Name');
    });

    it('should use _id as name fallback', () => {
      const cap = new Capability({
        _id: 'test-id',
        subtypeOf: 'base'
      });
      expect(cap.name).toBe('test-id');
    });

    it('should get description from attributes', () => {
      expect(capability.description).toBe('Test Description');
    });

    it('should return undefined for missing description', () => {
      const cap = new Capability({
        _id: 'test',
        subtypeOf: 'base'
      });
      expect(cap.description).toBeUndefined();
    });

    it('should get createdAt from attributes', () => {
      expect(capability.createdAt).toBeInstanceOf(Date);
    });

    it('should get updatedAt from attributes', () => {
      expect(capability.updatedAt).toBeInstanceOf(Date);
    });

    it('should get hasPart from attributes.parts', () => {
      expect(capability.hasPart).toEqual(['part1', 'part2']);
    });

    it('should return empty array for missing parts', () => {
      const cap = new Capability({
        _id: 'test',
        subtypeOf: 'base'
      });
      expect(cap.hasPart).toEqual([]);
    });

    it('should get partOf from attributes', () => {
      expect(capability.partOf).toBe('parent-id');
    });

    it('should return null for missing partOf', () => {
      const cap = new Capability({
        _id: 'test',
        subtypeOf: 'base'
      });
      expect(cap.partOf).toBeNull();
    });

    it('should get uses from attributes', () => {
      expect(capability.uses).toBe('tool-id');
    });

    it('should return null for missing uses', () => {
      const cap = new Capability({
        _id: 'test',
        subtypeOf: 'base'
      });
      expect(cap.uses).toBeNull();
    });

    it('should get requires from attributes', () => {
      expect(capability.requires).toEqual(['req1', 'req2']);
    });

    it('should return empty array for missing requires', () => {
      const cap = new Capability({
        _id: 'test',
        subtypeOf: 'base'
      });
      expect(cap.requires).toEqual([]);
    });
  });
});