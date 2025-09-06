/**
 * Default configuration for WordNet Foundational Ontology Loader
 */

export const DEFAULT_CONFIG = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'foundational_ontology',
    collectionName: 'triples'
  },
  loading: {
    batchSize: 1000,
    maxConcurrentRequests: 10,
    enableValidation: true,
    createIndices: true,
    logInterval: 100
  },
  wordnet: {
    maxSynsets: null, // null = load all, or set number for testing
    includedPos: ['n', 'v', 'a', 's', 'r'], // parts of speech to load
    skipMissingDefinitions: true
  }
};

export const TEST_CONFIG = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'test_foundational_ontology',
    collectionName: 'triples'
  },
  loading: {
    batchSize: 50,
    maxConcurrentRequests: 5,
    enableValidation: true,
    createIndices: true,
    logInterval: 25
  },
  wordnet: {
    maxSynsets: 100, // Limited for testing
    includedPos: ['n', 'v'], // Only nouns and verbs for testing
    skipMissingDefinitions: true
  }
};
