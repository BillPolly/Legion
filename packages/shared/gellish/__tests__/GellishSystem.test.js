/**
 * Tests for GellishSystem - Main integration component
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GellishSystem, createGellishSystem } from '../src/index.js';

// Mock DataSource for testing
class MockDataSource {
  constructor() {
    this.triples = [];
    this.queryCallCount = 0;
    this.updateCallCount = 0;
    this.subscribeCallCount = 0;
  }

  query(querySpec) {
    this.queryCallCount++;
    
    // Simple pattern matching for test data
    const { subject, predicate, object } = querySpec;
    
    return this.triples.filter(triple => {
      const [s, p, o] = triple;
      return (subject === null || s === subject) &&
             (predicate === null || p === predicate) &&
             (object === null || o === object);
    });
  }

  update(updateSpec) {
    this.updateCallCount++;
    
    if (updateSpec.operation === 'insert') {
      const { subject, predicate, object } = updateSpec.triple;
      this.triples.push([subject, predicate, object]);
    } else if (updateSpec.entity && updateSpec.attribute && updateSpec.value) {
      // Support the format used by GellishDataSource
      this.triples.push([updateSpec.entity, updateSpec.attribute, updateSpec.value]);
    }
  }

  subscribe(querySpec, callback) {
    this.subscribeCallCount++;
    return () => {}; // Unsubscribe function
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        triples: { type: 'array' }
      }
    };
  }

  queryBuilder() {
    // Return a simple query builder that stores query specs
    return {
      where: () => this.queryBuilder(),
      select: () => this.queryBuilder(),
      limit: () => this.queryBuilder(),
      offset: () => this.queryBuilder(),
      build: () => ({ subject: null, predicate: null, object: null })
    };
  }
}

describe('GellishSystem', () => {
  let mockDataSource;
  let system;
  
  beforeEach(() => {
    mockDataSource = new MockDataSource();
    system = new GellishSystem(mockDataSource);
  });

  describe('Construction', () => {
    it('should create system with DataSource', () => {
      expect(system).toBeDefined();
      expect(system.dataSource).toBeDefined();
      expect(system.dictionary).toBeDefined();
      expect(system.parser).toBeDefined();
      expect(system.queryParser).toBeDefined();
      expect(system.generator).toBeDefined();
      expect(system.validator).toBeDefined();
    });

    it('should create system with factory function', () => {
      const sys = createGellishSystem(mockDataSource);
      expect(sys).toBeInstanceOf(GellishSystem);
    });
  });

  describe('assert()', () => {
    it('should assert simple facts', () => {
      const result = system.assert('Pump P101 is part of System S200');
      
      expect(result).toBe(true);
      expect(mockDataSource.triples.length).toBe(1);
    });

    it('should reject invalid expressions', () => {
      expect(() => system.assert('invalid expression')).toThrow('Invalid expression');
    });

    it('should reject empty expressions', () => {
      expect(() => system.assert('')).toThrow('Invalid expression');
    });
  });

  describe('assertMultiple()', () => {
    it('should assert multiple facts', () => {
      const expressions = [
        'Pump P101 is part of System S200',
        'System S200 is owned by Siemens'
      ];
      
      const count = system.assertMultiple(expressions);
      
      expect(count).toBe(2);
      expect(mockDataSource.triples.length).toBe(2);
    });

    it('should handle empty array', () => {
      expect(system.assertMultiple([])).toBe(0);
      expect(system.assertMultiple(null)).toBe(0);
    });

    it('should continue after invalid expression', () => {
      const expressions = [
        'Pump P101 is part of System S200',
        'invalid expression',
        'System S200 is owned by Siemens'
      ];
      
      // Should assert 2 valid expressions, skip 1 invalid
      const count = system.assertMultiple(expressions);
      expect(count).toBe(2);
    });
  });

  describe('query()', () => {
    beforeEach(() => {
      // Add some test data
      system.assert('Pump P101 is part of System S200');
      system.assert('Pump P102 is part of System S200');
    });

    it('should query with natural language', () => {
      const result = system.query('What is part of System S200?');
      
      expect(result).toContain('Pump P101');
      expect(result).toContain('Pump P102');
    });

    it('should handle queries with no results', () => {
      const result = system.query('What is part of System S999?');
      
      expect(result).toBe('No results found.');
    });

    it('should throw error for invalid query', () => {
      expect(() => system.query('invalid query')).toThrow('Could not parse query');
    });
  });

  describe('generateTriples()', () => {
    it('should generate triples from expressions', () => {
      const expressions = [
        'Pump P101 is part of System S200',
        'System S200 is owned by Siemens'
      ];
      
      const triples = system.generateTriples(expressions);
      
      expect(triples).toHaveLength(2);
      expect(triples[0]).toHaveLength(3);
      expect(triples[0][0]).toBe('pump_p101');
    });

    it('should handle empty input', () => {
      expect(system.generateTriples([])).toEqual([]);
      expect(system.generateTriples(null)).toEqual([]);
    });
  });

  describe('factsAbout()', () => {
    beforeEach(() => {
      system.assert('Pump P101 is part of System S200');
      system.assert('Pump P101 is manufactured by KSB');
    });

    it('should get all facts about entity', () => {
      const facts = system.factsAbout('pump_p101');
      
      expect(facts).toBeInstanceOf(Array);
      expect(facts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('relatedTo()', () => {
    beforeEach(() => {
      system.assert('Pump P101 is part of System S200');
      system.assert('Pump P101 is manufactured by KSB');
    });

    it('should get all related entities', () => {
      const related = system.relatedTo('pump_p101');
      
      expect(related).toBeInstanceOf(Array);
      expect(related.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by relation phrase', () => {
      const related = system.relatedTo('pump_p101', 'is part of');
      
      expect(related).toBeInstanceOf(Array);
    });
  });

  describe('getVocabularyStats()', () => {
    it('should return vocabulary statistics', () => {
      const stats = system.getVocabularyStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalRelations).toBeGreaterThan(0);
    });
  });

  describe('validateExpression()', () => {
    it('should validate correct expression', () => {
      const result = system.validateExpression('Pump P101 is part of System S200');
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid expression', () => {
      const result = system.validateExpression('invalid expression');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateQuery()', () => {
    it('should validate correct query', () => {
      const result = system.validateQuery('What is part of System S200?');
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid query', () => {
      const result = system.validateQuery('not a valid query');
      
      expect(result.valid).toBe(false);
    });
  });

  describe('getDataSource()', () => {
    it('should return underlying DataSource', () => {
      const ds = system.getDataSource();
      
      expect(ds).toBeDefined();
      expect(ds).toBe(system.dataSource);
    });
  });

  describe('clear()', () => {
    it('should clear all triples', () => {
      system.assert('Pump P101 is part of System S200');
      expect(mockDataSource.triples.length).toBe(1);
      
      system.clear();
      
      // Verify GellishDataSource internal storage is cleared
      const facts = system.factsAbout('pump_p101');
      expect(facts.length).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow', () => {
      // Validate before asserting
      const validation = system.validateExpression('Pump P101 is part of System S200');
      expect(validation.valid).toBe(true);
      
      // Assert the fact
      system.assert('Pump P101 is part of System S200');
      
      // Query it back
      const result = system.query('What is part of System S200?');
      expect(result).toContain('Pump P101');
      
      // Get all facts about the entity
      const facts = system.factsAbout('pump_p101');
      expect(facts.length).toBeGreaterThan(0);
    });

    it('should handle multiple assertions and queries', () => {
      // Assert multiple facts
      const expressions = [
        'Pump P101 is part of System S200',
        'Pump P102 is part of System S200',
        'System S200 is owned by Siemens'
      ];
      
      const count = system.assertMultiple(expressions);
      expect(count).toBe(3);
      
      // Query what is part of S200
      const parts = system.query('What is part of System S200?');
      expect(parts).toContain('P101');
      expect(parts).toContain('P102');
    });
  });
});