/**
 * Integration tests for TreeWalker
 *
 * Tests Phase 3 tree walking with real semantic mapping.
 * NO MOCKS - tests real end-to-end AST → LogicalSkeleton conversion.
 */

import { TreeWalker } from '../../src/phase3/TreeWalker.js';
import { SemanticMapper } from '../../src/phase3/SemanticMapper.js';
import { OntologyIndexer } from '../../src/phase3/OntologyIndexer.js';
import { ResourceManager } from '@legion/resource-manager';

describe('TreeWalker Integration Tests', () => {
  let resourceManager;
  let semanticSearch;
  let indexer;
  let mapper;
  let walker;

  beforeAll(async () => {
    // Get real ResourceManager and SemanticSearchProvider
    resourceManager = await ResourceManager.getInstance();
    semanticSearch = await resourceManager.get('semanticSearch');

    if (!semanticSearch) {
      throw new Error('SemanticSearchProvider not available - required for integration tests');
    }

    // Create indexer and mapper
    indexer = new OntologyIndexer(semanticSearch, { collectionName: 'test-ontology-walker' });
    await indexer.initialize();

    mapper = new SemanticMapper(semanticSearch, {
      collectionName: 'test-ontology-walker',
      confidenceThreshold: 0.7
    });

    walker = new TreeWalker(mapper);

    // Index some ontology for testing
    await indexer.indexOntology({
      classes: [
        {
          iri: ':Country',
          label: 'Country',
          synonyms: ['nation', 'countries'],
          domain: 'geography'
        }
      ],
      properties: [
        {
          iri: ':borders',
          label: 'borders',
          synonyms: ['border', 'adjacent'],
          domain: 'geography',
          propertyType: 'spatial'
        }
      ],
      individuals: [
        {
          iri: ':Germany',
          label: 'Germany',
          aliases: ['Deutschland'],
          domain: 'geography',
          instanceOf: ':Country'
        }
      ]
    });
  }, 120000);

  describe('Rule 1: Subject NP → Variable + Type', () => {
    test('should map simple subject NP to variable and type', async () => {
      const ast = {
        S: {
          NP: {
            Det: 'which',
            Head: 'countries',
            Mods: []
          },
          VP: {
            Verb: 'exist',
            Comps: [],
            Mods: []
          },
          Force: 'ask'
        }
      };

      const result = await walker.walk(ast);

      expect(result.vars).toContain('?x');
      expect(result.atoms).toContainEqual(['isa', '?x', ':Country']);
      expect(result.project).toEqual(['?x']);
    }, 60000);
  });

  describe('Rule 2: Proper Names → Constants', () => {
    test('should map proper name to constant IRI', async () => {
      const ast = {
        S: {
          NP: {
            Det: 'which',
            Head: 'countries',
            Mods: []
          },
          VP: {
            Verb: 'border',
            Comps: [
              ['obj', {
                Det: null,
                Head: { Name: 'Germany' },
                Mods: []
              }]
            ],
            Mods: []
          },
          Force: 'ask'
        }
      };

      const result = await walker.walk(ast);

      expect(result.vars).toContain('?x');
      expect(result.atoms).toContainEqual(['isa', '?x', ':Country']);
      expect(result.atoms).toContainEqual(['rel', ':borders', '?x', ':Germany']);
    }, 60000);
  });

  describe('Rule 3: Verb Frame → Predicate', () => {
    test('should map verb with object to relation', async () => {
      const ast = {
        S: {
          NP: {
            Det: 'which',
            Head: 'countries',
            Mods: []
          },
          VP: {
            Verb: 'border',
            Comps: [
              ['obj', {
                Det: null,
                Head: { Name: 'Germany' },
                Mods: []
              }]
            ],
            Mods: []
          },
          Force: 'ask'
        }
      };

      const result = await walker.walk(ast);

      // Should create relation: ?x :borders :Germany
      expect(result.atoms).toContainEqual(['rel', ':borders', '?x', ':Germany']);
    }, 60000);
  });

  describe('Rule 14: Projection Logic', () => {
    test('should project WH-phrase variable', async () => {
      const ast = {
        S: {
          NP: {
            Det: 'which',
            Head: 'countries',
            Mods: []
          },
          VP: {
            Verb: 'exist',
            Comps: [],
            Mods: []
          },
          Force: 'ask'
        }
      };

      const result = await walker.walk(ast);

      // "which countries" → project ?x
      expect(result.project).toEqual(['?x']);
      expect(result.force).toBe('select');
    }, 60000);
  });

  describe('Complete Example: "Which countries border Germany?"', () => {
    test('should walk complete AST correctly', async () => {
      const ast = {
        S: {
          NP: {
            Det: 'which',
            Head: 'countries',
            Mods: []
          },
          VP: {
            Verb: 'border',
            Comps: [
              ['obj', {
                Det: null,
                Head: { Name: 'Germany' },
                Mods: []
              }]
            ],
            Mods: []
          },
          Force: 'ask'
        }
      };

      const result = await walker.walk(ast);

      // Expected LogicalSkeleton:
      // vars: ['?x']
      // atoms: [['isa', '?x', ':Country'], ['rel', ':borders', '?x', ':Germany']]
      // project: ['?x']
      // force: 'select'

      expect(result.vars).toEqual(['?x']);
      expect(result.atoms).toHaveLength(2);
      expect(result.atoms).toContainEqual(['isa', '?x', ':Country']);
      expect(result.atoms).toContainEqual(['rel', ':borders', '?x', ':Germany']);
      expect(result.project).toEqual(['?x']);
      expect(result.force).toBe('select');
      expect(result.order).toEqual([]);
      expect(result.limit).toBeNull();
    }, 60000);
  });
});
