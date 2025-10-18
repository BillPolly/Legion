/**
 * Unit tests for WordNetSemanticIndexer
 *
 * Tests the indexer with mocked MongoDB and SemanticSearch.
 * Integration tests with real resources are in __tests__/integration/
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WordNetSemanticIndexer } from '../../src/semantic/WordNetSemanticIndexer.js';

describe('WordNetSemanticIndexer', () => {
  let indexer;
  let mockResourceManager;
  let mockSemanticSearch;
  let mockMongoClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    // Mock MongoDB collection
    mockCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            synsetOffset: 1740,
            pos: 'n',
            synonyms: ['entity', 'thing'],
            definition: 'that which is perceived or known',
            examples: ['entities can be real or abstract'],
            lexicalFile: 'noun.Tops'
          }
        ])
      })
    };

    // Mock MongoDB database
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    // Mock MongoDB client
    mockMongoClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(undefined)
    };

    // Mock semantic search
    mockSemanticSearch = {
      insert: jest.fn().mockResolvedValue(true),
      count: jest.fn().mockResolvedValue(0)
    };

    // Mock ResourceManager
    mockResourceManager = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'env.MONGODB_URI') return 'mongodb://localhost:27017';
        if (key === 'semanticSearch') return Promise.resolve(mockSemanticSearch);
        throw new Error(`Unknown resource: ${key}`);
      })
    };

    indexer = new WordNetSemanticIndexer(mockResourceManager);

    // Mock the MongoDB import
    jest.unstable_mockModule('mongodb', () => ({
      MongoClient: jest.fn(() => mockMongoClient)
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create indexer with ResourceManager', () => {
      expect(indexer).toBeDefined();
      expect(indexer.resourceManager).toBe(mockResourceManager);
      expect(indexer.initialized).toBe(false);
    });

    test('should initialize properties to null', () => {
      expect(indexer.mongoClient).toBeNull();
      expect(indexer.semanticSearch).toBeNull();
    });
  });

  describe('isInitialized', () => {
    test('should return false before initialization', () => {
      expect(indexer.isInitialized()).toBe(false);
    });
  });

  describe('getStats', () => {
    test('should throw if not initialized', async () => {
      await expect(indexer.getStats()).rejects.toThrow('WordNetSemanticIndexer not initialized');
    });

    test('should return collection counts by POS', async () => {
      // Mock initialization
      indexer.initialized = true;
      indexer.semanticSearch = mockSemanticSearch;

      mockSemanticSearch.count
        .mockResolvedValueOnce(82000)  // nouns
        .mockResolvedValueOnce(13000)  // verbs
        .mockResolvedValueOnce(18000)  // adjectives
        .mockResolvedValueOnce(3600);   // adverbs

      const stats = await indexer.getStats();

      expect(stats).toEqual({
        nouns: 82000,
        verbs: 13000,
        adjectives: 18000,
        adverbs: 3600,
        total: 116600
      });

      expect(mockSemanticSearch.count).toHaveBeenCalledWith('wordnet_nouns');
      expect(mockSemanticSearch.count).toHaveBeenCalledWith('wordnet_verbs');
      expect(mockSemanticSearch.count).toHaveBeenCalledWith('wordnet_adjectives');
      expect(mockSemanticSearch.count).toHaveBeenCalledWith('wordnet_adverbs');
    });

    test('should return zero stats for empty collections', async () => {
      indexer.initialized = true;
      indexer.semanticSearch = mockSemanticSearch;

      mockSemanticSearch.count.mockResolvedValue(0);

      const stats = await indexer.getStats();

      expect(stats).toEqual({
        nouns: 0,
        verbs: 0,
        adjectives: 0,
        adverbs: 0,
        total: 0
      });
    });
  });

  describe('_buildSearchText', () => {
    test('should combine synonyms, definition, and examples', () => {
      const synset = {
        synonyms: ['entity', 'thing'],
        definition: 'that which is perceived',
        examples: ['entities can be real or abstract']
      };

      const searchText = indexer._buildSearchText(synset);

      expect(searchText).toBe('entity. thing. that which is perceived. entities can be real or abstract');
    });

    test('should handle missing fields', () => {
      const synset = {
        synonyms: ['entity'],
        definition: '',
        examples: []
      };

      const searchText = indexer._buildSearchText(synset);

      expect(searchText).toBe('entity');
    });

    test('should filter empty strings', () => {
      const synset = {
        synonyms: [],
        definition: 'test definition',
        examples: []
      };

      const searchText = indexer._buildSearchText(synset);

      expect(searchText).toBe('test definition');
    });
  });

  describe('close', () => {
    test('should close MongoDB connection', async () => {
      indexer.mongoClient = mockMongoClient;

      await indexer.close();

      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    test('should handle null mongoClient gracefully', async () => {
      indexer.mongoClient = null;

      await expect(indexer.close()).resolves.not.toThrow();
    });
  });
});
