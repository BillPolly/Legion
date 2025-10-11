/**
 * Integration tests for Nomic Embeddings
 * Verifies the GGUF model loads and generates embeddings correctly
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { NomicEmbeddings } from '../../src/NomicEmbeddings.js';

describe('Nomic Embeddings Integration', () => {
  let nomicEmbeddings;

  beforeAll(async () => {
    nomicEmbeddings = new NomicEmbeddings();
    await nomicEmbeddings.initialize();
  }, 60000); // Model loading can take time

  afterAll(async () => {
    if (nomicEmbeddings) {
      await nomicEmbeddings.close();
    }
  });

  test('should initialize with correct dimensions', () => {
    expect(nomicEmbeddings.initialized).toBe(true);
    expect(nomicEmbeddings.dimensions).toBe(768);
    expect(nomicEmbeddings.modelName).toContain('nomic-embed-text-v1.5');
  });

  test('should generate embedding for simple text', async () => {
    const text = 'Hello world';
    const embedding = await nomicEmbeddings.embed(text);

    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(768);

    // Verify it's not all zeros
    const sum = embedding.reduce((a, b) => a + Math.abs(b), 0);
    expect(sum).toBeGreaterThan(0);
  }, 30000);

  test('should generate different embeddings for different texts', async () => {
    const text1 = 'The cat sat on the mat';
    const text2 = 'Machine learning is fascinating';

    const embedding1 = await nomicEmbeddings.embed(text1);
    const embedding2 = await nomicEmbeddings.embed(text2);

    expect(embedding1).toBeDefined();
    expect(embedding2).toBeDefined();

    // Embeddings should be different
    const areDifferent = embedding1.some((val, idx) => val !== embedding2[idx]);
    expect(areDifferent).toBe(true);
  }, 30000);

  test('should generate similar embeddings for similar texts', async () => {
    const text1 = 'The capital of France is Paris';
    const text2 = 'Paris is the capital city of France';

    const embedding1 = await nomicEmbeddings.embed(text1);
    const embedding2 = await nomicEmbeddings.embed(text2);

    const similarity = await nomicEmbeddings.similarity(embedding1, embedding2);

    // Similar texts should have high similarity (> 0.7)
    expect(similarity).toBeGreaterThan(0.7);
    expect(similarity).toBeLessThanOrEqual(1.0);
  }, 30000);

  test('should generate dissimilar embeddings for unrelated texts', async () => {
    const text1 = 'The capital of France is Paris';
    const text2 = 'I enjoy eating pizza on Fridays';

    const embedding1 = await nomicEmbeddings.embed(text1);
    const embedding2 = await nomicEmbeddings.embed(text2);

    const similarity = await nomicEmbeddings.similarity(embedding1, embedding2);

    // Unrelated texts should have lower similarity (< 0.5)
    expect(similarity).toBeLessThan(0.5);
  }, 30000);

  test('should handle batch embedding', async () => {
    const texts = [
      'First document about cats',
      'Second document about dogs',
      'Third document about birds'
    ];

    const embeddings = await nomicEmbeddings.embedBatch(texts);

    expect(embeddings).toBeDefined();
    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(3);

    embeddings.forEach(embedding => {
      expect(embedding.length).toBe(768);
    });
  }, 60000);

  test('should find most similar documents', async () => {
    const query = 'Tell me about felines';
    const documents = [
      'Cats are popular pets',
      'Dogs are loyal animals',
      'Fish live in water',
      'Felines include cats and tigers'
    ];

    // Generate embeddings
    const queryEmbedding = await nomicEmbeddings.embed(query);
    const docEmbeddings = await nomicEmbeddings.embedBatch(documents);

    // Find similar
    const results = await nomicEmbeddings.findSimilar(queryEmbedding, docEmbeddings, 2);

    expect(results).toBeDefined();
    expect(results.length).toBe(2);

    // First result should have highest similarity
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);

    // Top results should be about cats/felines
    const topDocIndices = results.map(r => r.index);
    expect(topDocIndices).toContain(0); // Cats document
    expect(topDocIndices).toContain(3); // Felines document
  }, 90000);

  test('should handle empty string gracefully', async () => {
    const embedding = await nomicEmbeddings.embed('');

    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  }, 30000);

  test('should handle long text by truncating', async () => {
    const longText = 'word '.repeat(1000); // 5000 characters
    const embedding = await nomicEmbeddings.embed(longText);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  }, 30000);
});
