/**
 * Unit tests for EntityFactory
 *
 * Tests unified entity model where both entities and relationships are first-class
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { EntityFactory } from '../../src/storage/EntityFactory.js';
import { TripleStore } from '../../src/storage/TripleStore.js';

describe('EntityFactory', () => {
  let tripleStore;
  let factory;

  beforeEach(() => {
    tripleStore = new TripleStore();
    factory = new EntityFactory(tripleStore);
  });

  test('should convert entity model to unified format with entities as first-class', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation',
          properties: {
            'poc:foundedYear': '1990'
          }
        }
      ],
      relationships: []
    };

    const result = await factory.create(entityModel);

    expect(result.entities).toHaveLength(1);
    const entity = result.entities[0];

    // First-class entity with full metadata
    expect(entity.uri).toBe('poc:AcmeCorp');
    expect(entity.graphType).toBe('entity');
    expect(entity.ontologyType).toBe('poc:Company');
    expect(entity.label).toBe('Acme Corporation');
    expect(entity.from).toBeNull();
    expect(entity.to).toBeNull();
    expect(entity.attributes).toEqual({ 'poc:foundedYear': '1990' });
    expect(entity.provenance).toBeDefined();
    expect(entity.provenance.extractedBy).toBe('LLMEntityGenerator');
    expect(entity.temporal).toBeDefined();
    expect(entity.temporal.validFrom).toBeDefined();
  });

  test('should convert relationships to first-class entities', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation'
        },
        {
          uri: 'poc:Reserve1',
          type: 'poc:Reserve',
          label: 'Litigation Reserve'
        }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve1'
        }
      ]
    };

    const result = await factory.create(entityModel);

    expect(result.relationships).toHaveLength(1);
    const rel = result.relationships[0];

    // Relationship IS an entity!
    expect(rel.uri).toBeDefined();
    expect(rel.uri).toMatch(/^poc:hasReserve_/);
    expect(rel.graphType).toBe('relationship');
    expect(rel.ontologyType).toBe('poc:hasReserve');
    expect(rel.label).toBe('Acme Corporation hasReserve Litigation Reserve');
    expect(rel.from).toBe('poc:AcmeCorp');
    expect(rel.to).toBe('poc:Reserve1');
    expect(rel.attributes).toBeDefined();
    expect(rel.provenance).toBeDefined();
    expect(rel.provenance.extractedBy).toBe('LLMEntityGenerator');
    expect(rel.temporal).toBeDefined();
    expect(rel.temporal.validFrom).toBeDefined();
  });

  test('should generate unique URIs for relationship instances', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:Company1', type: 'poc:Company', label: 'Company 1' },
        { uri: 'poc:Company2', type: 'poc:Company', label: 'Company 2' },
        { uri: 'poc:Reserve1', type: 'poc:Reserve', label: 'Reserve 1' },
        { uri: 'poc:Reserve2', type: 'poc:Reserve', label: 'Reserve 2' }
      ],
      relationships: [
        { subject: 'poc:Company1', predicate: 'poc:hasReserve', object: 'poc:Reserve1' },
        { subject: 'poc:Company2', predicate: 'poc:hasReserve', object: 'poc:Reserve2' }
      ]
    };

    const result = await factory.create(entityModel);

    expect(result.relationships).toHaveLength(2);
    expect(result.relationships[0].uri).not.toBe(result.relationships[1].uri);
    expect(result.relationships[0].uri).toContain('hasReserve');
    expect(result.relationships[1].uri).toContain('hasReserve');
  });

  test('should store entities and relationships in triple store', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:AcmeCorp', type: 'poc:Company', label: 'Acme Corporation' }
      ],
      relationships: [
        { subject: 'poc:AcmeCorp', predicate: 'poc:hasReserve', object: 'poc:Reserve1' }
      ]
    };

    await factory.create(entityModel);

    // Verify entity stored
    const entityTriples = await tripleStore.getEntity('poc:AcmeCorp');
    expect(entityTriples.length).toBeGreaterThan(0);

    // Verify entity type
    const entityTypes = await tripleStore.query('poc:AcmeCorp', 'rdf:type', null);
    expect(entityTypes.some(([_s, _p, o]) => o === 'poc:Company')).toBe(true);

    // Verify traditional triple exists (for SPARQL)
    const relTriples = await tripleStore.query('poc:AcmeCorp', 'poc:hasReserve', 'poc:Reserve1');
    expect(relTriples).toHaveLength(1);
  });

  test('should support relationship attributes', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:AcmeCorp', type: 'poc:Company', label: 'Acme' },
        { uri: 'poc:Reserve1', type: 'poc:Reserve', label: 'Reserve' }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve1',
          properties: {
            'poc:confidence': '0.95',
            'poc:source': '10-K filing'
          }
        }
      ]
    };

    const result = await factory.create(entityModel);

    const rel = result.relationships[0];
    expect(rel.attributes).toEqual({
      'poc:confidence': '0.95',
      'poc:source': '10-K filing'
    });

    // Verify stored in triple store
    const relUri = rel.uri;
    const confidenceTriples = await tripleStore.query(relUri, 'poc:confidence', null);
    expect(confidenceTriples).toHaveLength(1);
    expect(confidenceTriples[0][2]).toBe('0.95');
  });

  test('should retrieve entity by URI', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation',
          properties: { 'poc:foundedYear': '1990' }
        }
      ],
      relationships: []
    };

    await factory.create(entityModel);

    const entity = await factory.getEntity('poc:AcmeCorp');

    expect(entity).toBeDefined();
    expect(entity.uri).toBe('poc:AcmeCorp');
    expect(entity.graphType).toBe('entity');
    expect(entity.ontologyType).toBe('poc:Company');
    expect(entity.label).toBe('Acme Corporation');
    expect(entity.attributes['poc:foundedYear']).toBe('1990');
  });

  test('should retrieve relationship by URI', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:AcmeCorp', type: 'poc:Company', label: 'Acme' },
        { uri: 'poc:Reserve1', type: 'poc:Reserve', label: 'Reserve' }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve1'
        }
      ]
    };

    const result = await factory.create(entityModel);
    const relUri = result.relationships[0].uri;

    const rel = await factory.getRelationship(relUri);

    expect(rel).toBeDefined();
    expect(rel.uri).toBe(relUri);
    expect(rel.graphType).toBe('relationship');
    expect(rel.ontologyType).toBe('poc:hasReserve');
    expect(rel.from).toBe('poc:AcmeCorp');
    expect(rel.to).toBe('poc:Reserve1');
  });

  test('should get entities by type', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:Company1', type: 'poc:Company', label: 'Company 1' },
        { uri: 'poc:Company2', type: 'poc:Company', label: 'Company 2' },
        { uri: 'poc:Reserve1', type: 'poc:Reserve', label: 'Reserve 1' }
      ],
      relationships: []
    };

    await factory.create(entityModel);

    const companies = await factory.getEntitiesByType('poc:Company');

    expect(companies).toHaveLength(2);
    expect(companies.every(e => e.ontologyType === 'poc:Company')).toBe(true);
  });

  test('should get relationships by type', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:Company1', type: 'poc:Company', label: 'Company 1' },
        { uri: 'poc:Company2', type: 'poc:Company', label: 'Company 2' },
        { uri: 'poc:Reserve1', type: 'poc:Reserve', label: 'Reserve 1' },
        { uri: 'poc:Reserve2', type: 'poc:Reserve', label: 'Reserve 2' }
      ],
      relationships: [
        { subject: 'poc:Company1', predicate: 'poc:hasReserve', object: 'poc:Reserve1' },
        { subject: 'poc:Company2', predicate: 'poc:hasReserve', object: 'poc:Reserve2' }
      ]
    };

    await factory.create(entityModel);

    const hasReserveRels = await factory.getRelationshipsByType('poc:hasReserve');

    expect(hasReserveRels).toHaveLength(2);
    expect(hasReserveRels.every(r => r.ontologyType === 'poc:hasReserve')).toBe(true);
  });

  test('should support custom provenance metadata', async () => {
    const entityModel = {
      entities: [
        { uri: 'poc:AcmeCorp', type: 'poc:Company', label: 'Acme' }
      ],
      relationships: []
    };

    const metadata = {
      extractedBy: 'CustomExtractor',
      extractionMethod: 'rule-based',
      source: '10-K Section 3',
      confidence: 0.98
    };

    const result = await factory.create(entityModel, metadata);

    const entity = result.entities[0];
    expect(entity.provenance.extractedBy).toBe('CustomExtractor');
    expect(entity.provenance.extractionMethod).toBe('rule-based');
    expect(entity.provenance.source).toBe('10-K Section 3');
    expect(entity.provenance.confidence).toBe(0.98);
  });

  test('should handle complex financial entity model', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:JPMorganChase',
          type: 'poc:Company',
          label: 'JPMorgan Chase',
          properties: {
            'poc:foundedYear': '1871',
            'poc:ticker': 'JPM'
          }
        },
        {
          uri: 'poc:LitigationReserve_2012',
          type: 'poc:Reserve',
          label: 'Litigation Reserve 2012',
          properties: {
            'poc:amount': '3.7',
            'poc:year': '2012'
          }
        },
        {
          uri: 'poc:Unit_Billion_USD',
          type: 'poc:Unit',
          label: 'Billion USD'
        }
      ],
      relationships: [
        {
          subject: 'poc:JPMorganChase',
          predicate: 'poc:hasReserve',
          object: 'poc:LitigationReserve_2012',
          properties: {
            'poc:confidence': '0.95',
            'poc:source': '10-K Page 47'
          }
        }
      ]
    };

    const result = await factory.create(entityModel);

    // Verify all entities created
    expect(result.entities).toHaveLength(3);

    // Verify relationship created as entity
    expect(result.relationships).toHaveLength(1);
    const rel = result.relationships[0];
    expect(rel.graphType).toBe('relationship');
    expect(rel.from).toBe('poc:JPMorganChase');
    expect(rel.to).toBe('poc:LitigationReserve_2012');
    expect(rel.attributes['poc:confidence']).toBe('0.95');

    // Verify stored in triple store
    const jpmorgan = await factory.getEntity('poc:JPMorganChase');
    expect(jpmorgan.attributes['poc:foundedYear']).toBe('1871');

    const reserve = await factory.getEntity('poc:LitigationReserve_2012');
    expect(reserve.attributes['poc:amount']).toBe('3.7');

    // Verify traditional triple exists
    const triples = await tripleStore.query('poc:JPMorganChase', 'poc:hasReserve', 'poc:LitigationReserve_2012');
    expect(triples).toHaveLength(1);
  });
});
