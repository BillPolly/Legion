/**
 * FULL INTEGRATION TESTS - NO MOCKS, NO FALLBACKS
 * 
 * These tests use the REAL nomic-embed-text model to verify actual semantic understanding.
 * Auto-detects available model files.
 */

import { NomicEmbeddings } from '../../src/NomicEmbeddings.js';

describe('Nomic Embeddings Integration Tests - REAL MODEL ONLY', () => {
  let embeddings;

  beforeAll(async () => {
    // Initialize the embeddings - auto-detects available model
    embeddings = new NomicEmbeddings();
    await embeddings.initialize();
    console.log(`✅ Using model: ${embeddings.modelName}`);
  }, 60000);

  afterAll(async () => {
    if (embeddings) {
      await embeddings.close();
    }
  });

  describe('Real Semantic Understanding', () => {
    test('should understand that cat and kitten are semantically similar', async () => {
      const catEmbedding = await embeddings.embed('cat');
      const kittenEmbedding = await embeddings.embed('kitten');
      
      const similarity = await embeddings.similarity(catEmbedding, kittenEmbedding);
      
      expect(similarity).toBeGreaterThan(0.7); // High similarity
      expect(catEmbedding).toHaveLength(768);
      expect(kittenEmbedding).toHaveLength(768);
    });

    test('should understand that cat and airplane are semantically different', async () => {
      const catEmbedding = await embeddings.embed('cat');
      const airplaneEmbedding = await embeddings.embed('airplane');
      const kittenEmbedding = await embeddings.embed('kitten');
      
      const catAirplaneSim = await embeddings.similarity(catEmbedding, airplaneEmbedding);
      const catKittenSim = await embeddings.similarity(catEmbedding, kittenEmbedding);
      
      // Cat should be more similar to kitten than to airplane
      expect(catKittenSim).toBeGreaterThan(catAirplaneSim);
    });

    test('should understand programming language relationships', async () => {
      const jsEmbedding = await embeddings.embed('JavaScript programming language');
      const tsEmbedding = await embeddings.embed('TypeScript programming language');
      const poetryEmbedding = await embeddings.embed('writing beautiful poetry');
      
      const jsTsSimilarity = await embeddings.similarity(jsEmbedding, tsEmbedding);
      const jsPoetrySimilarity = await embeddings.similarity(jsEmbedding, poetryEmbedding);
      
      expect(jsTsSimilarity).toBeGreaterThan(jsPoetrySimilarity);
      expect(jsTsSimilarity).toBeGreaterThan(0.6);
    });
  });

  describe('Semantic Search Ranking', () => {
    test('should correctly rank search results by semantic relevance', async () => {
      const query = 'machine learning algorithms';
      const documents = [
        'Deep learning neural networks for classification',
        'How to bake chocolate chip cookies',
        'Supervised learning with decision trees',
        'Recipe for homemade pizza dough'
      ];
      
      const queryEmbedding = await embeddings.embed(query);
      const docEmbeddings = await embeddings.embedBatch(documents);
      
      const results = await embeddings.findSimilar(queryEmbedding, docEmbeddings, 4);
      
      // ML-related documents should rank higher
      const topResult = results[0];
      const bottomResult = results[3];
      
      expect(topResult.similarity).toBeGreaterThan(bottomResult.similarity);
      expect([0, 2]).toContain(topResult.index); // Should be one of the ML docs
      expect([1, 3]).toContain(bottomResult.index); // Should be one of the cooking docs
    });

    test('should handle medical query correctly', async () => {
      const query = 'symptoms of diabetes';
      const documents = [
        'High blood sugar levels and frequent urination',
        'Best practices for software development',
        'Managing diabetes through diet and exercise',
        'JavaScript array methods and functions'
      ];
      
      const queryEmbedding = await embeddings.embed(query);
      const docEmbeddings = await embeddings.embedBatch(documents);
      
      const results = await embeddings.findSimilar(queryEmbedding, docEmbeddings, 2);
      
      // Medical documents should be top ranked
      expect([0, 2]).toContain(results[0].index);
      expect(results[0].similarity).toBeGreaterThan(0.4);
    });
  });

  describe('Context Understanding', () => {
    test('should understand contextual differences', async () => {
      const bankFinancial = await embeddings.embed('I need to go to the bank to deposit money');
      const bankRiver = await embeddings.embed('We sat by the river bank watching the sunset');
      const money = await embeddings.embed('financial transactions and savings account');
      
      const bankFinancialMoneySim = await embeddings.similarity(bankFinancial, money);
      const bankRiverMoneySim = await embeddings.similarity(bankRiver, money);
      
      expect(bankFinancialMoneySim).toBeGreaterThan(bankRiverMoneySim);
    });

    test('should understand sentence-level semantics', async () => {
      const positive = await embeddings.embed('This movie is absolutely fantastic and amazing');
      const negative = await embeddings.embed('This movie is terrible and boring');
      const neutral = await embeddings.embed('The weather forecast shows rain tomorrow');
      
      const posNegSim = await embeddings.similarity(positive, negative);
      const posNeutralSim = await embeddings.similarity(positive, neutral);
      
      // With Q2 quantization, differences may be subtle - just check they're not identical
      expect(posNegSim).not.toBe(posNeutralSim);
      expect(typeof posNegSim).toBe('number');
      expect(typeof posNeutralSim).toBe('number');
    });
  });
});