/**
 * End-to-end integration test for complete pipeline
 *
 * Tests all 4 phases working together:
 * Question → Phase 1 (Rewrite) → Phase 2 (Parse) → Phase 3 (Map) → Phase 4 (Convert) → DataScript Query
 *
 * NO MOCKS - uses real LLM, real semantic search, real Qdrant
 */

import { RewriteResolver } from '../../src/phase1/RewriteResolver.js';
import { NPVPParser } from '../../src/phase2/NPVPParser.js';
import { OntologyIndexer } from '../../src/phase3/OntologyIndexer.js';
import { SemanticMapper } from '../../src/phase3/SemanticMapper.js';
import { TreeWalker } from '../../src/phase3/TreeWalker.js';
import { ConstraintPropagator } from '../../src/phase3/ConstraintPropagator.js';
import { DataScriptConverter } from '../../src/phase4/DataScriptConverter.js';
import { ResourceManager } from '@legion/resource-manager';

describe('End-to-End Pipeline Integration', () => {
  let resourceManager;
  let llmClient;
  let semanticSearch;
  let rewriteResolver;
  let parser;
  let indexer;
  let mapper;
  let walker;
  let propagator;
  let converter;

  beforeAll(async () => {
    // Get real ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    semanticSearch = await resourceManager.get('semanticSearch');

    if (!llmClient) {
      throw new Error('LLM client not available - required for E2E tests');
    }

    if (!semanticSearch) {
      throw new Error('SemanticSearchProvider not available - required for E2E tests');
    }

    // Initialize all phase components
    rewriteResolver = new RewriteResolver(llmClient);
    parser = new NPVPParser(llmClient);
    await parser.initialize();  // Initialize parser

    indexer = new OntologyIndexer(semanticSearch, { collectionName: 'test-e2e-ontology' });
    await indexer.initialize();

    mapper = new SemanticMapper(semanticSearch, {
      collectionName: 'test-e2e-ontology',
      confidenceThreshold: 0.7
    });

    walker = new TreeWalker(mapper);
    propagator = new ConstraintPropagator();
    converter = new DataScriptConverter();

    // Index sample ontology for testing
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
  }, 180000);

  describe('Complete Pipeline: "Which countries border Germany?"', () => {
    test('should process question through all 4 phases', async () => {
      const question = 'Which countries border Germany?';

      // Phase 1: Rewrite & Resolve
      const canonicalQuestion = await rewriteResolver.resolve(question);
      expect(canonicalQuestion).toBeDefined();
      expect(canonicalQuestion.text).toBeDefined();
      expect(canonicalQuestion.wh_role).toBe('which');

      console.log('Phase 1 output:', JSON.stringify(canonicalQuestion, null, 2));

      // Phase 2: Parse to NP/VP AST
      const ast = await parser.parse(canonicalQuestion);  // Pass full object, not just text
      expect(ast).toBeDefined();
      expect(ast.S).toBeDefined();
      expect(ast.S.NP).toBeDefined();
      expect(ast.S.VP).toBeDefined();

      console.log('Phase 2 output:', JSON.stringify(ast, null, 2));

      // Phase 3: Semantic Mapping
      const skeleton = await walker.walk(ast);
      expect(skeleton).toBeDefined();
      expect(skeleton.vars).toBeDefined();
      expect(skeleton.atoms).toBeDefined();
      expect(skeleton.project).toBeDefined();

      console.log('Phase 3 output (before propagation):', JSON.stringify(skeleton, null, 2));

      // Phase 3b: Constraint Propagation
      const optimizedSkeleton = propagator.propagate(skeleton);
      expect(optimizedSkeleton).toBeDefined();
      expect(optimizedSkeleton.vars).toEqual(skeleton.vars);
      expect(optimizedSkeleton.atoms.length).toBeLessThanOrEqual(skeleton.atoms.length);

      console.log('Phase 3 output (after propagation):', JSON.stringify(optimizedSkeleton, null, 2));

      // Phase 4: Convert to DataScript
      const dataScriptQuery = converter.convert(optimizedSkeleton);
      expect(dataScriptQuery).toBeDefined();
      expect(dataScriptQuery.find).toBeDefined();
      expect(dataScriptQuery.where).toBeDefined();

      console.log('Phase 4 output:', JSON.stringify(dataScriptQuery, null, 2));

      // Verify DataScript query structure
      expect(dataScriptQuery.find).toContain('?x');
      expect(dataScriptQuery.where).toContainEqual(['?x', ':type', ':Country']);
      // Note: The actual property mapping depends on semantic search results
      // We just verify the structure is correct

      console.log('\n✅ Complete pipeline test passed!');
      console.log('Question:', question);
      console.log('DataScript Query:', JSON.stringify(dataScriptQuery, null, 2));
    }, 180000);
  });

  describe('Error Handling', () => {
    test('should handle invalid question gracefully', async () => {
      // Test with empty question
      await expect(async () => {
        await rewriteResolver.resolve('');
      }).rejects.toThrow();
    }, 60000);

    test('should handle unmapped tokens in Phase 3', async () => {
      // Create a simple AST with an unmapped noun
      const ast = {
        S: {
          NP: {
            Det: 'which',
            Head: 'xyzunknownword',  // Unmapped
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

      const skeleton = await walker.walk(ast);
      expect(skeleton).toBeDefined();
      expect(skeleton.notes).toBeDefined();
      expect(skeleton.notes.length).toBeGreaterThan(0);
      expect(skeleton.notes.some(note => note.includes('Unmapped'))).toBe(true);
    }, 60000);
  });
});
