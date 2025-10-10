/**
 * Unit tests for TripleStore
 *
 * Tests RDF triple storage using @legion/triplestore DataScriptProvider
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { TripleStore } from '../../src/storage/TripleStore.js';

describe('TripleStore', () => {
  let store;

  beforeEach(() => {
    store = new TripleStore();
  });

  test('should add and retrieve single triple', async () => {
    const added = await store.addTriple('poc:AcmeCorp', 'rdf:type', 'poc:Company');

    expect(added).toBe(true);

    const results = await store.query('poc:AcmeCorp', 'rdf:type', 'poc:Company');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(['poc:AcmeCorp', 'rdf:type', 'poc:Company']);
  });

  test('should add multiple triples', async () => {
    const triples = [
      ['poc:AcmeCorp', 'rdf:type', 'poc:Company'],
      ['poc:AcmeCorp', 'rdfs:label', 'Acme Corporation'],
      ['poc:Reserve1', 'rdf:type', 'poc:Reserve']
    ];

    const count = await store.addTriples(triples);

    expect(count).toBe(3);

    const size = await store.size();
    expect(size).toBe(3);
  });

  test('should store entity model', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation'
        },
        {
          uri: 'poc:Reserve_Acme_2023',
          type: 'poc:Reserve',
          label: 'Acme Reserves 2023',
          properties: {
            'poc:amount': '1000000',
            'poc:year': '2023'
          }
        }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve_Acme_2023'
        }
      ]
    };

    const count = await store.storeEntityModel(entityModel);

    // Should store:
    // - 2 rdf:type triples
    // - 2 rdfs:label triples
    // - 2 property triples
    // - 1 relationship triple
    // Total: 7 triples
    expect(count).toBe(7);

    const size = await store.size();
    expect(size).toBe(7);
  });

  test('should query by pattern', async () => {
    await store.addTriples([
      ['poc:AcmeCorp', 'rdf:type', 'poc:Company'],
      ['poc:TechCo', 'rdf:type', 'poc:Company'],
      ['poc:Reserve1', 'rdf:type', 'poc:Reserve']
    ]);

    // Query all companies
    const companies = await store.query(null, 'rdf:type', 'poc:Company');
    expect(companies).toHaveLength(2);

    // Query all types
    const allTypes = await store.query(null, 'rdf:type', null);
    expect(allTypes).toHaveLength(3);

    // Query specific entity
    const acme = await store.query('poc:AcmeCorp', null, null);
    expect(acme).toHaveLength(1);
  });

  test('should get entity by URI', async () => {
    await store.addTriples([
      ['poc:AcmeCorp', 'rdf:type', 'poc:Company'],
      ['poc:AcmeCorp', 'rdfs:label', 'Acme Corporation'],
      ['poc:AcmeCorp', 'poc:hasReserve', 'poc:Reserve1']
    ]);

    const entity = await store.getEntity('poc:AcmeCorp');
    expect(entity).toHaveLength(3);
  });

  test('should get entities by type', async () => {
    await store.addTriples([
      ['poc:AcmeCorp', 'rdf:type', 'poc:Company'],
      ['poc:TechCo', 'rdf:type', 'poc:Company'],
      ['poc:Reserve1', 'rdf:type', 'poc:Reserve']
    ]);

    const companies = await store.getEntitiesByType('poc:Company');
    expect(companies).toHaveLength(2);
    expect(companies).toContain('poc:AcmeCorp');
    expect(companies).toContain('poc:TechCo');

    const reserves = await store.getEntitiesByType('poc:Reserve');
    expect(reserves).toHaveLength(1);
    expect(reserves).toContain('poc:Reserve1');
  });

  test('should get relationships by property', async () => {
    await store.addTriples([
      ['poc:AcmeCorp', 'poc:hasReserve', 'poc:Reserve1'],
      ['poc:AcmeCorp', 'poc:hasReserve', 'poc:Reserve2'],
      ['poc:TechCo', 'poc:hasReserve', 'poc:Reserve3']
    ]);

    const relationships = await store.getRelationshipsByProperty('poc:hasReserve');
    expect(relationships).toHaveLength(3);
    expect(relationships[0]).toHaveProperty('subject');
    expect(relationships[0]).toHaveProperty('object');
  });

  test('should remove triples', async () => {
    await store.addTriple('poc:AcmeCorp', 'rdf:type', 'poc:Company');
    expect(await store.size()).toBe(1);

    const removed = await store.removeTriple('poc:AcmeCorp', 'rdf:type', 'poc:Company');
    expect(removed).toBe(true);
    expect(await store.size()).toBe(0);
  });

  test('should clear all triples', async () => {
    await store.addTriples([
      ['poc:AcmeCorp', 'rdf:type', 'poc:Company'],
      ['poc:TechCo', 'rdf:type', 'poc:Company'],
      ['poc:Reserve1', 'rdf:type', 'poc:Reserve']
    ]);

    expect(await store.size()).toBe(3);

    await store.clear();
    expect(await store.size()).toBe(0);
  });

  test('should provide metadata', () => {
    const metadata = store.getMetadata();

    expect(metadata).toBeDefined();
    expect(metadata.type).toBe('memory');
  });

  test('should handle complex entity model with multiple properties', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:JPMorganChase',
          type: 'poc:Company',
          label: 'JPMorgan Chase'
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
          object: 'poc:LitigationReserve_2012'
        }
      ]
    };

    await store.storeEntityModel(entityModel);

    // Verify all entities were stored
    const companies = await store.getEntitiesByType('poc:Company');
    expect(companies).toHaveLength(1);

    const reserves = await store.getEntitiesByType('poc:Reserve');
    expect(reserves).toHaveLength(1);

    // Verify reserve properties were stored
    const reserveTriples = await store.getEntity('poc:LitigationReserve_2012');
    expect(reserveTriples.length).toBeGreaterThanOrEqual(4); // type, label, amount, year

    // Verify relationship was stored
    const relationships = await store.getRelationshipsByProperty('poc:hasReserve');
    expect(relationships).toHaveLength(1);
    expect(relationships[0].subject).toBe('poc:JPMorganChase');
    expect(relationships[0].object).toBe('poc:LitigationReserve_2012');
  });
});
