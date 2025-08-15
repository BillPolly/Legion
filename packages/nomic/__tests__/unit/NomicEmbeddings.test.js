import { NomicEmbeddings } from '../../src/NomicEmbeddings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('NomicEmbeddings - Model Loading and Embedding Generation', () => {
  let embeddings;

  beforeAll(async () => {
    embeddings = new NomicEmbeddings();
    
    // Check if model exists
    const modelsDir = path.join(__dirname, '../../models');
    const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.gguf'));
    
    if (modelFiles.length === 0) {
      throw new Error(`No GGUF model files found in ${modelsDir}`);
    }
    
    await embeddings.initialize();
  }, 30000); // 30 second timeout for model loading

  afterAll(async () => {
    if (embeddings) {
      await embeddings.close();
    }
  });

  describe('Model Initialization', () => {
    test('should load GGUF model successfully', () => {
      expect(embeddings.initialized).toBe(true);
      expect(embeddings.modelName).toBeTruthy();
      expect(embeddings.modelPath).toContain('.gguf');
    });

    test('should report correct dimensions', () => {
      expect(embeddings.dimensions).toBe(768);
    });
  });

  describe('Embedding Generation', () => {
    test('should generate 768-dimensional array', async () => {
      const text = 'This is a test sentence.';
      const embedding = await embeddings.embed(text);
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });

    test('should generate numeric values only', async () => {
      const embedding = await embeddings.embed('Test text');
      
      embedding.forEach(value => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
        expect(isFinite(value)).toBe(true);
      });
    });

    test('should generate non-degenerate embeddings', async () => {
      const embedding = await embeddings.embed('Machine learning algorithms');
      
      // Check it's not all zeros
      const nonZeroCount = embedding.filter(v => v !== 0).length;
      expect(nonZeroCount).toBeGreaterThan(700); // Most values should be non-zero
      
      // Check it has variety (not all same value)
      const uniqueValues = new Set(embedding.map(v => Math.round(v * 10000)));
      expect(uniqueValues.size).toBeGreaterThan(100); // Should have many different values
      
      // Check values are in reasonable range (typically normalized)
      const min = Math.min(...embedding);
      const max = Math.max(...embedding);
      expect(min).toBeGreaterThan(-10);
      expect(max).toBeLessThan(10);
    });

    test('should generate different embeddings for different texts', async () => {
      const embed1 = await embeddings.embed('First sentence');
      const embed2 = await embeddings.embed('Completely different text');
      
      // Embeddings should be different
      let differentCount = 0;
      for (let i = 0; i < embed1.length; i++) {
        if (Math.abs(embed1[i] - embed2[i]) > 0.0001) {
          differentCount++;
        }
      }
      
      // Most dimensions should be different
      expect(differentCount).toBeGreaterThan(600);
    });

    test('should generate identical embeddings for identical text', async () => {
      const text = 'Exactly the same text';
      const embed1 = await embeddings.embed(text);
      const embed2 = await embeddings.embed(text);
      
      // Should be deterministic - same input gives same output
      for (let i = 0; i < embed1.length; i++) {
        expect(embed1[i]).toBeCloseTo(embed2[i], 6);
      }
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple texts', async () => {
      const texts = [
        'First text',
        'Second text',
        'Third text'
      ];
      
      const embeddings_batch = await embeddings.embedBatch(texts);
      
      expect(embeddings_batch.length).toBe(3);
      embeddings_batch.forEach(emb => {
        expect(Array.isArray(emb)).toBe(true);
        expect(emb.length).toBe(768);
      });
    });

    test('should generate different embeddings for each text in batch', async () => {
      const texts = ['Apple', 'Orange', 'Banana'];
      const embeddings_batch = await embeddings.embedBatch(texts);
      
      // Each should be different from the others
      for (let i = 0; i < embeddings_batch.length - 1; i++) {
        for (let j = i + 1; j < embeddings_batch.length; j++) {
          let differentCount = 0;
          for (let k = 0; k < 768; k++) {
            if (Math.abs(embeddings_batch[i][k] - embeddings_batch[j][k]) > 0.0001) {
              differentCount++;
            }
          }
          expect(differentCount).toBeGreaterThan(500); // Significantly different
        }
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string', async () => {
      const embedding = await embeddings.embed('');
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(embedding.some(v => v !== 0)).toBe(true);
    });

    test('should handle reasonably long text', async () => {
      const longText = 'This is a reasonably long piece of text for testing embeddings. '.repeat(20);
      const embedding = await embeddings.embed(longText);
      
      expect(embedding.length).toBe(768);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    test('should handle text that exceeds context gracefully', async () => {
      const veryLongText = 'Very long text that exceeds model context. '.repeat(1000);
      
      await expect(embeddings.embed(veryLongText)).rejects.toThrow(/context size/);
    });

    test('should handle special characters', async () => {
      const specialText = '🚀 Special @#$%^&*() characters 中文';
      const embedding = await embeddings.embed(specialText);
      
      expect(embedding.length).toBe(768);
      expect(embedding.every(v => !isNaN(v))).toBe(true);
    });
  });

  describe('Task Types', () => {
    test('should accept different task types', async () => {
      const text = 'Sample text';
      
      // Should not throw errors with different task types
      const docEmbed = await embeddings.embed(text, { taskType: 'search_document' });
      const queryEmbed = await embeddings.embed(text, { taskType: 'search_query' });
      const classEmbed = await embeddings.embed(text, { taskType: 'classification' });
      
      expect(docEmbed.length).toBe(768);
      expect(queryEmbed.length).toBe(768);
      expect(classEmbed.length).toBe(768);
      
      // We can't verify they're "correctly" different, just that they work
    });
  });

  describe('Similarity Function', () => {
    test('should calculate cosine similarity between -1 and 1', async () => {
      const embed1 = await embeddings.embed('Text one');
      const embed2 = await embeddings.embed('Text two');
      
      const similarity = await embeddings.similarity(embed1, embed2);
      
      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('should return 1 for identical embeddings', async () => {
      const embedding = await embeddings.embed('Same text');
      
      const similarity = await embeddings.similarity(embedding, embedding);
      
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('should handle orthogonal vectors correctly', async () => {
      // Create two orthogonal vectors
      const vec1 = new Array(768).fill(0);
      vec1[0] = 1;
      
      const vec2 = new Array(768).fill(0);
      vec2[1] = 1;
      
      const similarity = await embeddings.similarity(vec1, vec2);
      
      expect(similarity).toBeCloseTo(0, 5);
    });
  });
});