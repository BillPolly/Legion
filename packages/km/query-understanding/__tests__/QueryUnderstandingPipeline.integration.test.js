/**
 * QueryUnderstandingPipeline Integration Tests
 *
 * Tests the complete 4-phase pipeline end-to-end
 */

import { QueryUnderstandingPipeline } from '../src/QueryUnderstandingPipeline.js';
import { ResourceManager } from '@legion/resource-manager';

describe('QueryUnderstandingPipeline Integration', () => {
  let resourceManager;
  let pipeline;
  let mockDataSource;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 120000);

  beforeEach(async () => {
    // Create mock DataSource that returns predictable results
    mockDataSource = {
      query: async (querySpec) => {
        // Mock results for test questions
        if (querySpec.find.includes('?x') && querySpec.where.length > 0) {
          return [
            { canonical: ':TestResult', name: 'Test Result', type: ':TestType' }
          ];
        }
        return [];
      }
    };

    // Register mock DataSource
    resourceManager.set('mockDataSource', mockDataSource);

    // Create dummy ontology
    resourceManager.set('ontology', { classes: [], properties: [], individuals: [] });

    // Create pipeline
    pipeline = new QueryUnderstandingPipeline(resourceManager);
    await pipeline.initialize({
      dataSource: 'mockDataSource',
      domain: 'test',
      ontologyCollectionName: 'test-ontology'
    });
  }, 120000);

  test('should process question through all 4 phases', async () => {
    const question = "Which countries border Germany?";

    const result = await pipeline.process(question, {});

    // Verify all phases produced outputs
    expect(result).toHaveProperty('canonicalQuestion');
    expect(result).toHaveProperty('ast');
    expect(result).toHaveProperty('logicalSkeleton');
    expect(result).toHaveProperty('query');
    expect(result).toHaveProperty('results');

    // Verify Phase 1: Canonical Question
    expect(result.canonicalQuestion).toHaveProperty('text');
    expect(result.canonicalQuestion).toHaveProperty('wh_role');
    expect(result.canonicalQuestion.wh_role).toBe('which');

    // Verify Phase 2: NP/VP AST
    expect(result.ast).toHaveProperty('S');
    expect(result.ast.S).toHaveProperty('NP');
    expect(result.ast.S).toHaveProperty('VP');

    // Verify Phase 3: Logical Skeleton
    expect(result.logicalSkeleton).toHaveProperty('vars');
    expect(result.logicalSkeleton).toHaveProperty('atoms');
    expect(result.logicalSkeleton).toHaveProperty('project');
    expect(Array.isArray(result.logicalSkeleton.vars)).toBe(true);

    // Verify Phase 4: DataScript Query
    expect(result.query).toHaveProperty('find');
    expect(result.query).toHaveProperty('where');
    expect(Array.isArray(result.query.find)).toBe(true);
    expect(Array.isArray(result.query.where)).toBe(true);

    // Verify results returned
    expect(Array.isArray(result.results)).toBe(true);
  }, 120000);

  test('should handle multi-turn context', async () => {
    const question1 = "Which countries border Germany?";
    const result1 = await pipeline.process(question1, {});

    expect(result1.canonicalQuestion.text).toContain('Germany');
    expect(result1.results).toBeDefined();

    // Second question with context
    const question2 = "What about France?";
    const result2 = await pipeline.process(question2, {
      previousQuestion: question1,
      conversationHistory: [question1]
    });

    // Phase 1 should resolve the ellipsis
    expect(result2.canonicalQuestion.text).toBeTruthy();
    expect(result2.results).toBeDefined();
  }, 120000);

  test('should track pipeline status', () => {
    const status = pipeline.getStatus();

    expect(status.initialized).toBe(true);
    expect(status.ready).toBe(true);
    expect(status.config).toHaveProperty('dataSourceName');
    expect(status.config.dataSourceName).toBe('mockDataSource');
    expect(status.dependencies.llmClient).toBe(true);
    expect(status.dependencies.semanticSearch).toBe(true);
  });

  test('should validate pipeline is ready', () => {
    expect(pipeline.isReady()).toBe(true);
  });
});
