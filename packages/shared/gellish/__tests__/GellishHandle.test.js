/**
 * Tests for GellishHandle CNL interface
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GellishHandle, wrapWithGellish } from '../src/GellishHandle.js';
import { GellishDictionary } from '../src/GellishDictionary.js';

// Create a mock Handle for testing
function createMockHandle() {
  const mockDataSource = {
    query: jest.fn(() => []),
    subscribe: jest.fn((querySpec, callback) => ({
      unsubscribe: jest.fn()
    })),
    getSchema: jest.fn(() => ({
      version: '1.0.0',
      entities: {},
      attributes: {}
    })),
    queryBuilder: jest.fn(() => ({})),
    update: jest.fn(() => ({ success: true }))
  };
  
  const mockHandle = {
    dataSource: mockDataSource,
    query: jest.fn((querySpec) => mockDataSource.query(querySpec)),
    subscribe: jest.fn((querySpec, callback) => mockDataSource.subscribe(querySpec, callback)),
    getIntrospectionInfo: jest.fn(() => ({
      entityType: 'MockEntity',
      availableAttributes: ['id', 'name'],
      relationships: ['parent', 'children']
    }))
  };
  
  return mockHandle;
}

describe('GellishHandle', () => {
  let mockHandle;
  let gellishHandle;
  
  beforeEach(() => {
    mockHandle = createMockHandle();
    gellishHandle = new GellishHandle(mockHandle);
  });
  
  describe('Construction', () => {
    it('should create GellishHandle with base Handle', () => {
      expect(gellishHandle).toBeDefined();
      expect(gellishHandle.baseHandle).toBe(mockHandle);
      expect(gellishHandle.dictionary).toBeInstanceOf(GellishDictionary);
    });
    
    it('should throw error if base Handle is missing', () => {
      expect(() => new GellishHandle(null)).toThrow('Base Handle is required');
    });
    
    it('should throw error if object is not a valid Handle', () => {
      expect(() => new GellishHandle({})).toThrow('Invalid Handle');
    });
    
    it('should accept custom dictionary in options', () => {
      const customDict = new GellishDictionary();
      const handle = new GellishHandle(mockHandle, { dictionary: customDict });
      expect(handle.dictionary).toBe(customDict);
    });
  });
  
  describe('assert() - CNL Assertions', () => {
    it('should parse and store valid Gellish assertion', () => {
      const result = gellishHandle.assert('Pump P101 is part of System S200');
      
      expect(result.success).toBe(true);
      expect(result.triple).toEqual([
        'Pump P101',
        'gellish:1230', // UID for "is part of"
        'System S200'
      ]);
      expect(result.parsed.leftObject.text).toBe('Pump P101');
      expect(result.parsed.relation.text).toBe('is part of');
      expect(result.parsed.rightObject.text).toBe('System S200');
    });
    
    it('should handle manufacturing relations', () => {
      const result = gellishHandle.assert('Pump P101 is manufactured by KSB');
      
      expect(result.success).toBe(true);
      expect(result.triple).toEqual([
        'Pump P101',
        'gellish:1267', // UID for "is manufactured by"
        'KSB'
      ]);
    });
    
    it('should handle ownership relations', () => {
      const result = gellishHandle.assert('System S200 is owned by Siemens');
      
      expect(result.success).toBe(true);
      expect(result.triple).toEqual([
        'System S200',
        'gellish:1200', // UID for "is owned by"
        'Siemens'
      ]);
    });
    
    it('should throw error for invalid expression', () => {
      expect(() => gellishHandle.assert('invalid expression'))
        .toThrow('Invalid Gellish expression');
    });
    
    it('should throw error for unknown relation', () => {
      // Use a phrase that looks like a valid relation but isn't in dictionary
      // The recognizer will find "is definitely unknown" as a potential relation phrase
      // but the dictionary won't have it, so it should throw "Invalid Gellish expression"
      // because findRelationPhrase returns null when the relation is not found
      expect(() => gellishHandle.assert('A is definitely unknown relation B'))
        .toThrow('Invalid Gellish expression');
    });
    
    it('should track assertions in history', () => {
      gellishHandle.assert('Pump P101 is part of System S200');
      gellishHandle.assert('System S200 is owned by Siemens');
      
      const stats = gellishHandle.getStats();
      expect(stats.assertionCount).toBe(2);
      expect(stats.lastAssertion.expression).toBe('System S200 is owned by Siemens');
    });
  });
  
  describe('ask() - CNL Queries', () => {
    beforeEach(() => {
      // Set up some assertions first
      gellishHandle.assert('Pump P101 is part of System S200');
      gellishHandle.assert('Pump P102 is part of System S200');
      gellishHandle.assert('Valve V201 is part of System S200');
    });
    
    it('should handle "What is part of X?" queries', () => {
      // Mock the query response
      gellishHandle.gellishDataSource.executeGellishQuery = jest.fn(() => [
        ['Pump P101', 'gellish:1230', 'System S200'],
        ['Pump P102', 'gellish:1230', 'System S200'],
        ['Valve V201', 'gellish:1230', 'System S200']
      ]);
      
      const results = gellishHandle.ask('What is part of System S200?');
      
      expect(results).toEqual(['Pump P101', 'Pump P102', 'Valve V201']);
    });
    
    it('should handle "Which pumps are part of X?" queries', () => {
      // Mock the query response
      gellishHandle.gellishDataSource.executeGellishQuery = jest.fn(() => [
        ['Pump P101', 'gellish:1230', 'System S200'],
        ['Pump P102', 'gellish:1230', 'System S200']
      ]);
      
      const results = gellishHandle.ask('Which pumps are part of System S200?');
      
      expect(results).toHaveLength(2);
      expect(results[0].entity).toBe('Pump P101');
      expect(results[1].entity).toBe('Pump P102');
    });
    
    it('should throw error for invalid query', () => {
      expect(() => gellishHandle.ask('not a valid query'))
        .toThrow('Invalid Gellish query');
    });
    
    it('should track queries in history', () => {
      gellishHandle.gellishDataSource.executeGellishQuery = jest.fn(() => []);
      
      gellishHandle.ask('What is part of System S200?');
      gellishHandle.ask('Which pumps are manufactured by KSB?');
      
      const stats = gellishHandle.getStats();
      expect(stats.queryCount).toBe(2);
      expect(stats.lastQuery.query).toBe('Which pumps are manufactured by KSB?');
    });
  });
  
  describe('factsAbout() - Entity Facts', () => {
    it('should return all facts about an entity', () => {
      // Mock triple queries
      gellishHandle.gellishDataSource.queryTriple = jest.fn((s, p, o) => {
        if (s === 'Pump P101') {
          return [
            ['Pump P101', 'gellish:1230', 'System S200'],
            ['Pump P101', 'gellish:1267', 'KSB']
          ];
        }
        if (o === 'Pump P101') {
          return [
            ['Motor M101', 'gellish:1456', 'Pump P101']
          ];
        }
        return [];
      });
      
      const facts = gellishHandle.factsAbout('Pump P101');
      
      expect(facts).toHaveLength(3);
      expect(facts).toContain('Pump P101 is part of System S200');
      expect(facts).toContain('Pump P101 is manufactured by KSB');
      expect(facts).toContain('Motor M101 is connected to Pump P101');
    });
  });
  
  describe('relatedTo() - Direct Relations', () => {
    it('should find entities with specific relation', () => {
      gellishHandle.gellishDataSource.queryTriple = jest.fn(() => [
        ['System S200', 'gellish:1230', 'Plant P1'],
        ['System S200', 'gellish:1230', 'Unit U5']
      ]);
      
      const related = gellishHandle.relatedTo('System S200', 'is part of');
      
      expect(related).toEqual(['Plant P1', 'Unit U5']);
    });
    
    it('should throw error for unknown relation', () => {
      expect(() => gellishHandle.relatedTo('Entity', 'unknown relation'))
        .toThrow('Unknown relation');
    });
  });
  
  describe('inverseRelatedTo() - Inverse Relations', () => {
    it('should find entities with inverse relation', () => {
      gellishHandle.gellishDataSource.queryTriple = jest.fn(() => [
        ['Pump P101', 'gellish:1230', 'System S200'],
        ['Pump P102', 'gellish:1230', 'System S200'],
        ['Valve V201', 'gellish:1230', 'System S200']
      ]);
      
      const parts = gellishHandle.inverseRelatedTo('System S200', 'is part of');
      
      expect(parts).toEqual(['Pump P101', 'Pump P102', 'Valve V201']);
    });
  });
  
  describe('watch() - Subscriptions', () => {
    it('should subscribe to entity changes', () => {
      const callback = jest.fn();
      const subscription = gellishHandle.watch({ entity: 'System S200' }, callback);
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
    });
    
    it('should subscribe to relation changes', () => {
      const callback = jest.fn();
      const subscription = gellishHandle.watch({ relation: 'is part of' }, callback);
      
      expect(subscription).toBeDefined();
    });
    
    it('should convert changes to Gellish format in callback', () => {
      const callback = jest.fn();
      
      // Mock the subscribe method on the gellishDataSource
      gellishHandle.gellishDataSource.subscribe = jest.fn((querySpec, cb) => {
        // Store the wrapped callback for testing
        gellishHandle._testCallback = cb;
        return { unsubscribe: jest.fn() };
      });
      
      gellishHandle.watch({ entity: 'System S200' }, callback);
      
      // Simulate change notification using the wrapped callback
      gellishHandle._testCallback([
        ['Pump P103', 'gellish:1230', 'System S200']
      ]);
      
      expect(callback).toHaveBeenCalledWith([
        'Pump P103 is part of System S200'
      ]);
    });
  });
  
  describe('Utility Methods', () => {
    it('should get schema from DataSource', () => {
      const schema = gellishHandle.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.gellish).toBeDefined();
      expect(schema.gellish.capabilities.naturalLanguageAssertions).toBe(true);
    });
    
    it('should get statistics', () => {
      gellishHandle.assert('Pump P101 is part of System S200');
      gellishHandle.gellishDataSource.executeGellishQuery = jest.fn(() => []);
      gellishHandle.ask('What is part of System S200?');
      
      const stats = gellishHandle.getStats();
      
      expect(stats.assertionCount).toBe(1);
      expect(stats.queryCount).toBe(1);
      expect(stats.dictionaryStats.totalRelations).toBeGreaterThan(50);
    });
    
    it('should clear assertions and query history', () => {
      gellishHandle.assert('Pump P101 is part of System S200');
      gellishHandle.clearAssertions();
      
      const stats = gellishHandle.getStats();
      expect(stats.assertionCount).toBe(0);
      expect(stats.queryCount).toBe(0);
    });
    
    it('should provide access to underlying components', () => {
      expect(gellishHandle.getHandle()).toBe(mockHandle);
      expect(gellishHandle.getDictionary()).toBeInstanceOf(GellishDictionary);
      expect(gellishHandle.getRecognizer()).toBeDefined();
    });
  });
  
  describe('Factory Functions', () => {
    it('should create GellishHandle using wrapWithGellish', () => {
      const wrapped = wrapWithGellish(mockHandle);
      
      expect(wrapped).toBeInstanceOf(GellishHandle);
      expect(wrapped.baseHandle).toBe(mockHandle);
    });
    
    it('should accept options in wrapWithGellish', () => {
      const customDict = new GellishDictionary();
      const wrapped = wrapWithGellish(mockHandle, { dictionary: customDict });
      
      expect(wrapped.dictionary).toBe(customDict);
    });
  });
});