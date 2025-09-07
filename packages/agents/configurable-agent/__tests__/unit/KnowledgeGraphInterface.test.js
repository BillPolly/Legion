/**
 * Unit tests for KnowledgeGraphInterface
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { KnowledgeGraphInterface } from '../../src/knowledge/KnowledgeGraphInterface.js';

describe('KnowledgeGraphInterface', () => {
  let kgInterface;
  let mockTripleStore;

  beforeEach(() => {
    // Create mock triple store
    mockTripleStore = {
      addTriple: jest.fn().mockResolvedValue(true),
      removeTriple: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      clear: jest.fn().mockResolvedValue(true),
      size: jest.fn().mockResolvedValue(0)
    };
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      kgInterface = new KnowledgeGraphInterface();
      
      expect(kgInterface).toBeDefined();
      expect(kgInterface.tripleStore).toBeNull();
      expect(kgInterface.namespace).toBe('agent');
      expect(kgInterface.initialized).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      const config = {
        namespace: 'custom',
        storageMode: 'persistent',
        tripleStore: mockTripleStore
      };
      
      kgInterface = new KnowledgeGraphInterface(config);
      
      expect(kgInterface.namespace).toBe('custom');
      expect(kgInterface.storageMode).toBe('persistent');
      expect(kgInterface.tripleStore).toBe(mockTripleStore);
    });

    it('should support session storage mode', () => {
      kgInterface = new KnowledgeGraphInterface({ storageMode: 'session' });
      expect(kgInterface.storageMode).toBe('session');
    });

    it('should validate storage mode', () => {
      expect(() => {
        new KnowledgeGraphInterface({ storageMode: 'invalid' });
      }).toThrow('Invalid storage mode');
    });
  });

  describe('Triple Store Integration', () => {
    beforeEach(() => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
    });

    it('should initialize with provided triple store', async () => {
      await kgInterface.initialize();
      
      expect(kgInterface.initialized).toBe(true);
      expect(kgInterface.tripleStore).toBe(mockTripleStore);
    });

    it('should create default in-memory store if none provided', async () => {
      kgInterface = new KnowledgeGraphInterface();
      await kgInterface.initialize();
      
      expect(kgInterface.initialized).toBe(true);
      expect(kgInterface.tripleStore).toBeDefined();
      expect(kgInterface.tripleStore).not.toBe(mockTripleStore);
    });

    it('should fail to initialize twice', async () => {
      await kgInterface.initialize();
      
      await expect(kgInterface.initialize()).rejects.toThrow('already initialized');
    });
  });

  describe('Entity Operations', () => {
    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
      await kgInterface.initialize();
    });

    it('should store an entity', async () => {
      const entity = {
        id: 'user-123',
        type: 'User',
        properties: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      };
      
      await kgInterface.storeEntity(entity);
      
      // Should add type triple
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'rdf:type',
        'agent:User'
      );
      
      // Should add property triples
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:name',
        '"John Doe"'
      );
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:email',
        '"john@example.com"'
      );
    });

    it('should retrieve an entity by ID', async () => {
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'rdf:type', object: 'agent:User' },
        { subject: 'agent:user-123', predicate: 'agent:name', object: '"John Doe"' },
        { subject: 'agent:user-123', predicate: 'agent:email', object: '"john@example.com"' }
      ]);
      
      const entity = await kgInterface.getEntity('user-123');
      
      expect(entity).toEqual({
        id: 'user-123',
        type: 'User',
        properties: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      });
    });

    it('should return null for non-existent entity', async () => {
      mockTripleStore.query.mockResolvedValue([]);
      
      const entity = await kgInterface.getEntity('non-existent');
      
      expect(entity).toBeNull();
    });

    it('should update an entity', async () => {
      const updates = {
        name: 'Jane Doe',
        age: 30
      };
      
      // Mock query to return old values
      mockTripleStore.query.mockResolvedValueOnce([['agent:user-123', 'agent:name', '"John Doe"']]);
      mockTripleStore.query.mockResolvedValueOnce([]);
      
      await kgInterface.updateEntity('user-123', updates);
      
      // Should remove old triples
      expect(mockTripleStore.removeTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:name',
        '"John Doe"'
      );
      
      // Should add new triples
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:name',
        '"Jane Doe"'
      );
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:age',
        '30'
      );
    });

    it('should delete an entity', async () => {
      // Mock query to return entity triples
      mockTripleStore.query.mockResolvedValue([
        ['agent:user-123', 'rdf:type', 'agent:User'],
        ['agent:user-123', 'agent:name', '"John Doe"'],
        ['agent:user-123', 'agent:email', '"john@example.com"']
      ]);
      
      await kgInterface.deleteEntity('user-123');
      
      // Should remove each triple individually
      expect(mockTripleStore.removeTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'rdf:type',
        'agent:User'
      );
      expect(mockTripleStore.removeTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:name',
        '"John Doe"'
      );
      expect(mockTripleStore.removeTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:email',
        '"john@example.com"'
      );
    });

    it('should list entities by type', async () => {
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'rdf:type', object: 'agent:User' },
        { subject: 'agent:user-456', predicate: 'rdf:type', object: 'agent:User' }
      ]);
      
      const users = await kgInterface.listEntitiesByType('User');
      
      expect(users).toEqual(['user-123', 'user-456']);
    });
  });

  describe('Relationship Operations', () => {
    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
      await kgInterface.initialize();
    });

    it('should add a relationship between entities', async () => {
      await kgInterface.addRelationship('user-123', 'owns', 'resource-456');
      
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:owns',
        'agent:resource-456'
      );
    });

    it('should add a relationship with properties', async () => {
      await kgInterface.addRelationship('user-123', 'created', 'post-789', {
        timestamp: '2024-01-01T00:00:00Z',
        version: 1
      });
      
      // Should create relationship
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:created',
        'agent:post-789'
      );
      
      // Should add relationship properties (as reified statement)
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        expect.stringContaining('rel-'),
        'rdf:subject',
        'agent:user-123'
      );
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        expect.stringContaining('rel-'),
        'rdf:predicate',
        'agent:created'
      );
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        expect.stringContaining('rel-'),
        'rdf:object',
        'agent:post-789'
      );
    });

    it('should get relationships for an entity', async () => {
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'agent:owns', object: 'agent:resource-456' },
        { subject: 'agent:user-123', predicate: 'agent:created', object: 'agent:post-789' }
      ]);
      
      const relationships = await kgInterface.getRelationships('user-123');
      
      expect(relationships).toEqual([
        { predicate: 'owns', object: 'resource-456' },
        { predicate: 'created', object: 'post-789' }
      ]);
    });

    it('should get relationships of specific type', async () => {
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'agent:owns', object: 'agent:resource-456' },
        { subject: 'agent:user-123', predicate: 'agent:owns', object: 'agent:resource-789' }
      ]);
      
      const relationships = await kgInterface.getRelationships('user-123', 'owns');
      
      expect(relationships).toEqual([
        { predicate: 'owns', object: 'resource-456' },
        { predicate: 'owns', object: 'resource-789' }
      ]);
    });

    it('should remove a relationship', async () => {
      await kgInterface.removeRelationship('user-123', 'owns', 'resource-456');
      
      expect(mockTripleStore.removeTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:owns',
        'agent:resource-456'
      );
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
      await kgInterface.initialize();
    });

    it('should throw error for SPARQL query (not supported)', async () => {
      const query = 'SELECT ?s WHERE { ?s rdf:type agent:User }';
      
      await expect(kgInterface.query(query)).rejects.toThrow('SPARQL queries not supported');
    });

    it('should find entities with property value', async () => {
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'agent:name', object: '"John Doe"' }
      ]);
      
      const entities = await kgInterface.findEntitiesWithProperty('name', 'John Doe');
      
      expect(entities).toEqual(['user-123']);
    });

    it('should find connected entities', async () => {
      // First call - get direct connections
      mockTripleStore.query.mockResolvedValueOnce([
        { subject: 'agent:user-123', predicate: 'agent:owns', object: 'agent:resource-456' },
        { subject: 'agent:user-123', predicate: 'agent:created', object: 'agent:post-789' }
      ]);
      
      // Second call - get reverse connections
      mockTripleStore.query.mockResolvedValueOnce([
        { subject: 'agent:group-111', predicate: 'agent:hasMember', object: 'agent:user-123' }
      ]);
      
      const connected = await kgInterface.findConnectedEntities('user-123');
      
      expect(connected).toEqual(['resource-456', 'post-789', 'group-111']);
    });
  });

  describe('Context and Inference', () => {
    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
      await kgInterface.initialize();
    });

    it('should extract context from conversation', async () => {
      const messages = [
        { role: 'user', content: 'My name is John and I work at Acme Corp' },
        { role: 'assistant', content: 'Hello John from Acme Corp!' },
        { role: 'user', content: 'I need help with project Alpha' }
      ];
      
      const context = await kgInterface.extractContext(messages);
      
      expect(context).toEqual({
        entities: [
          { type: 'Person', value: 'John' },
          { type: 'Organization', value: 'Acme Corp' },
          { type: 'Project', value: 'Alpha' }
        ],
        relationships: [
          { subject: 'John', predicate: 'worksAt', object: 'Acme Corp' },
          { subject: 'John', predicate: 'needsHelpWith', object: 'Alpha' }
        ]
      });
    });

    it('should infer new facts from existing knowledge', async () => {
      // Setup existing knowledge
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'agent:manages', object: 'agent:team-456' },
        { subject: 'agent:team-456', predicate: 'agent:owns', object: 'agent:project-789' }
      ]);
      
      const inferred = await kgInterface.inferFacts('user-123');
      
      expect(inferred).toContainEqual({
        subject: 'user-123',
        predicate: 'hasAccessTo',
        object: 'project-789',
        confidence: 0.8
      });
    });
  });

  describe('Persistence and Cleanup', () => {
    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
      await kgInterface.initialize();
    });

    it('should export knowledge graph to JSON', async () => {
      mockTripleStore.query.mockResolvedValue([
        { subject: 'agent:user-123', predicate: 'rdf:type', object: 'agent:User' },
        { subject: 'agent:user-123', predicate: 'agent:name', object: '"John Doe"' }
      ]);
      
      const exported = await kgInterface.exportToJSON();
      
      expect(exported).toEqual({
        namespace: 'agent',
        triples: [
          { subject: 'agent:user-123', predicate: 'rdf:type', object: 'agent:User' },
          { subject: 'agent:user-123', predicate: 'agent:name', object: '"John Doe"' }
        ],
        metadata: {
          exportedAt: expect.any(String),
          tripleCount: 2
        }
      });
    });

    it('should import knowledge graph from JSON', async () => {
      const data = {
        namespace: 'agent',
        triples: [
          { subject: 'agent:user-123', predicate: 'rdf:type', object: 'agent:User' },
          { subject: 'agent:user-123', predicate: 'agent:name', object: '"John Doe"' }
        ]
      };
      
      await kgInterface.importFromJSON(data);
      
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'rdf:type',
        'agent:User'
      );
      expect(mockTripleStore.addTriple).toHaveBeenCalledWith(
        'agent:user-123',
        'agent:name',
        '"John Doe"'
      );
    });

    it('should clear all data', async () => {
      await kgInterface.clear();
      
      expect(mockTripleStore.clear).toHaveBeenCalled();
    });

    it('should cleanup resources', async () => {
      await kgInterface.cleanup();
      
      expect(kgInterface.initialized).toBe(false);
      expect(kgInterface.tripleStore).toBeNull();
    });

    it('should get statistics', async () => {
      mockTripleStore.size.mockResolvedValue(42);
      mockTripleStore.query.mockResolvedValueOnce([
        { subject: 'agent:user-123', predicate: 'rdf:type', object: 'agent:User' },
        { subject: 'agent:user-456', predicate: 'rdf:type', object: 'agent:User' },
        { subject: 'agent:post-789', predicate: 'rdf:type', object: 'agent:Post' }
      ]);
      
      const stats = await kgInterface.getStatistics();
      
      expect(stats).toEqual({
        tripleCount: 42,
        entityCount: 3,
        entityTypes: {
          'User': 2,
          'Post': 1
        }
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      kgInterface = new KnowledgeGraphInterface({ tripleStore: mockTripleStore });
      await kgInterface.initialize();
    });

    it('should handle store errors gracefully', async () => {
      mockTripleStore.addTriple.mockRejectedValue(new Error('Store error'));
      
      await expect(kgInterface.storeEntity({
        id: 'test',
        type: 'Test'
      })).rejects.toThrow('Failed to store entity');
    });

    it('should validate entity structure', async () => {
      await expect(kgInterface.storeEntity({
        // Missing id
        type: 'Test'
      })).rejects.toThrow('Entity must have an id');
      
      await expect(kgInterface.storeEntity({
        id: 'test'
        // Missing type
      })).rejects.toThrow('Entity must have a type');
    });

    it('should handle invalid queries', async () => {
      await expect(kgInterface.query('INVALID QUERY')).rejects.toThrow('SPARQL queries not supported');
    });
  });
});