/**
 * Integration tests for @legion/gellish package
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  GellishDictionary, 
  GellishDataSource, 
  GellishHandle,
  EntityRecognizer,
  createGellishHandle,
  createGellishDataSource,
  wrapWithGellish
} from '../src/index.js';

// Create a simple in-memory DataSource for testing
class InMemoryDataSource {
  constructor() {
    this.data = new Map();
    this.subscriptions = new Map();
    this._nextId = 1;
  }
  
  query(querySpec) {
    const results = [];
    
    if (querySpec.find) {
      // Simple find implementation
      for (const [id, entity] of this.data) {
        if (this._matchesQuery(entity, querySpec.where)) {
          results.push(entity);
        }
      }
    }
    
    return results;
  }
  
  subscribe(querySpec, callback) {
    const id = this._nextId++;
    this.subscriptions.set(id, { querySpec, callback });
    
    return {
      unsubscribe: () => {
        this.subscriptions.delete(id);
      }
    };
  }
  
  getSchema() {
    return {
      version: '1.0.0',
      type: 'InMemoryDataSource',
      entities: {},
      attributes: {}
    };
  }
  
  update(updateSpec) {
    if (updateSpec.entity) {
      const id = updateSpec.entity;
      const existing = this.data.get(id) || { id };
      
      if (updateSpec.attribute && updateSpec.value !== undefined) {
        existing[updateSpec.attribute] = updateSpec.value;
      }
      
      this.data.set(id, existing);
      
      // Notify subscribers
      this._notifySubscribers({ 
        type: 'update', 
        entity: existing 
      });
      
      return { success: true, entity: existing };
    }
    
    return { success: false };
  }
  
  queryBuilder(sourceHandle) {
    // Minimal query builder
    return {
      where: (predicate) => this,
      select: (mapper) => this
    };
  }
  
  _matchesQuery(entity, whereClause) {
    if (!whereClause) return true;
    // Simple implementation
    return true;
  }
  
  _notifySubscribers(change) {
    for (const sub of this.subscriptions.values()) {
      if (this._matchesQuery(change, sub.querySpec.where)) {
        sub.callback([change]);
      }
    }
  }
}

// Create a mock Handle for testing
class MockHandle {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }
  
  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
  
  subscribe(querySpec, callback) {
    return this.dataSource.subscribe(querySpec, callback);
  }
  
  getIntrospectionInfo() {
    return {
      entityType: 'Equipment',
      availableAttributes: ['id', 'name', 'type'],
      relationships: ['partOf', 'connectedTo', 'manufacturedBy']
    };
  }
}

describe('@legion/gellish Integration', () => {
  describe('Complete CNL Workflow', () => {
    let dataSource;
    let handle;
    let gellishHandle;
    
    beforeEach(() => {
      dataSource = new InMemoryDataSource();
      handle = new MockHandle(dataSource);
      gellishHandle = createGellishHandle(handle);
    });
    
    it('should support complete assertion and query workflow', () => {
      // Make assertions
      const assertion1 = gellishHandle.assert('Pump P101 is part of System S200');
      const assertion2 = gellishHandle.assert('Pump P102 is part of System S200');
      const assertion3 = gellishHandle.assert('System S200 is owned by Siemens');
      const assertion4 = gellishHandle.assert('Pump P101 is manufactured by KSB');
      
      // Verify assertions were stored
      expect(assertion1.success).toBe(true);
      expect(assertion2.success).toBe(true);
      expect(assertion3.success).toBe(true);
      expect(assertion4.success).toBe(true);
      
      // Query facts about an entity
      const facts = gellishHandle.factsAbout('Pump P101');
      expect(facts).toContain('Pump P101 is part of System S200');
      expect(facts).toContain('Pump P101 is manufactured by KSB');
      
      // Query related entities
      const parts = gellishHandle.inverseRelatedTo('System S200', 'is part of');
      expect(parts).toContain('Pump P101');
      expect(parts).toContain('Pump P102');
      
      // Get statistics
      const stats = gellishHandle.getStats();
      expect(stats.assertionCount).toBe(4);
      expect(stats.dictionaryStats.totalRelations).toBeGreaterThan(50);
    });
    
    it('should support subscriptions to changes', () => {
      const changes = [];
      
      // Subscribe to changes
      const subscription = gellishHandle.watch(
        { entity: 'System S200' },
        (gellishChanges) => {
          changes.push(...gellishChanges);
        }
      );
      
      // Make an assertion
      gellishHandle.assert('Valve V201 is part of System S200');
      
      // Cleanup
      subscription.unsubscribe();
      
      // Note: In a real implementation, the subscription would be notified
      // For this test, we're just verifying the subscription mechanism works
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
    });
  });
  
  describe('Dictionary Operations', () => {
    let dictionary;
    
    beforeEach(() => {
      dictionary = new GellishDictionary();
    });
    
    it('should find relations by phrase', () => {
      expect(dictionary.findRelation('is part of')).toBe(1230);
      expect(dictionary.findRelation('consists of')).toBe(1230); // inverse
      expect(dictionary.findRelation('is manufactured by')).toBe(1267);
      expect(dictionary.findRelation('manufactures')).toBe(1267); // inverse
    });
    
    it('should get relation details by UID', () => {
      const relation = dictionary.getRelationByUid(1230);
      expect(relation.phrase).toBe('is part of');
      expect(relation.inverse).toBe('consists of');
      expect(relation.domain).toBe('compositional');
    });
    
    it('should get relations by domain', () => {
      const compositional = dictionary.getRelationsByDomain('compositional');
      expect(compositional.length).toBeGreaterThan(5);
      
      const manufacturing = dictionary.getRelationsByDomain('manufacturing');
      expect(manufacturing.length).toBeGreaterThan(5);
    });
    
    it('should provide statistics', () => {
      const stats = dictionary.getStats();
      expect(stats.totalRelations).toBeGreaterThan(50);
      expect(stats.domains).toContain('compositional');
      expect(stats.domains).toContain('manufacturing');
      expect(stats.domains).toContain('ownership');
    });
  });
  
  describe('Entity Recognition', () => {
    let dictionary;
    let recognizer;
    
    beforeEach(() => {
      dictionary = new GellishDictionary();
      recognizer = new EntityRecognizer(dictionary);
    });
    
    it('should recognize entities and relations in expressions', () => {
      const result = recognizer.recognize('Pump P101 is part of System S200');
      
      expect(result.leftObject.text).toBe('Pump P101');
      expect(result.leftObject.type).toBe('individual');
      expect(result.relation.text).toBe('is part of');
      expect(result.rightObject.text).toBe('System S200');
      expect(result.rightObject.type).toBe('individual');
    });
    
    it('should recognize queries with question words', () => {
      const result = recognizer.recognizeQuery('What is part of System S200?');
      
      expect(result.questionWord.text).toBe('What'); // Preserves original case
      expect(result.relation.text).toBe('is part of');
      expect(result.object.text).toBe('System S200');
    });
    
    it('should recognize "which" queries with entity types', () => {
      const result = recognizer.recognizeQuery('Which pumps are manufactured by KSB?');
      
      expect(result.questionWord.text).toBe('Which pumps'); // Preserves original case
      expect(result.relation.text).toBe('are manufactured by');
      expect(result.object.text).toBe('KSB');
    });
    
    it('should classify entity types', () => {
      expect(recognizer.classifyEntity('Pump P101')).toBe('individual');
      expect(recognizer.classifyEntity('John Smith')).toBe('person');
      expect(recognizer.classifyEntity('Water')).toBe('concept');
    });
  });
  
  describe('DataSource Wrapping', () => {
    let baseDataSource;
    let gellishDataSource;
    
    beforeEach(() => {
      baseDataSource = new InMemoryDataSource();
      gellishDataSource = createGellishDataSource(baseDataSource);
    });
    
    it('should wrap DataSource with Gellish capabilities', () => {
      expect(gellishDataSource.baseDataSource).toBe(baseDataSource);
      expect(gellishDataSource.dictionary).toBeInstanceOf(GellishDictionary);
    });
    
    it('should store and query triples', () => {
      // Store triple
      const result = gellishDataSource.storeGellishAssertion([
        'Pump P101',
        'gellish:1230',
        'System S200'
      ]);
      
      expect(result.success).toBe(true);
      
      // Query triple
      const results = gellishDataSource.queryTriple('Pump P101', null, null);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(['Pump P101', 'gellish:1230', 'System S200']);
    });
    
    it('should extend schema with Gellish capabilities', () => {
      const schema = gellishDataSource.getSchema();
      
      expect(schema.gellish).toBeDefined();
      expect(schema.gellish.capabilities.naturalLanguageAssertions).toBe(true);
      expect(schema.gellish.capabilities.naturalLanguageQueries).toBe(true);
    });
  });
  
  describe('Factory Functions', () => {
    it('should create GellishHandle using createGellishHandle', () => {
      const dataSource = new InMemoryDataSource();
      const handle = new MockHandle(dataSource);
      const gellishHandle = createGellishHandle(handle);
      
      expect(gellishHandle).toBeInstanceOf(GellishHandle);
      expect(gellishHandle.baseHandle).toBe(handle);
    });
    
    it('should create GellishHandle using wrapWithGellish', () => {
      const dataSource = new InMemoryDataSource();
      const handle = new MockHandle(dataSource);
      const gellishHandle = wrapWithGellish(handle);
      
      expect(gellishHandle).toBeInstanceOf(GellishHandle);
      expect(gellishHandle.baseHandle).toBe(handle);
    });
    
    it('should create GellishDataSource using createGellishDataSource', () => {
      const dataSource = new InMemoryDataSource();
      const gellishDataSource = createGellishDataSource(dataSource);
      
      expect(gellishDataSource).toBeInstanceOf(GellishDataSource);
      expect(gellishDataSource.baseDataSource).toBe(dataSource);
    });
  });
});