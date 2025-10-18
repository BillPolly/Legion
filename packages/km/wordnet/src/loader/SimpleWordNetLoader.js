/**
 * Simple WordNet Loader
 * Loads WordNet synsets as proper MongoDB documents (fast and simple)
 */

import { ResourceManager } from '@legion/resource-manager';
import { WordNetAccess } from '../wordnet/WordNetAccess.js';

export class SimpleWordNetLoader {
  constructor(config = {}) {
    this.config = {
      mongodb: {
        connectionString: config.mongodb?.connectionString || 'mongodb://localhost:27017',
        dbName: config.mongodb?.dbName || 'wordnet',
        collectionName: config.mongodb?.collectionName || 'synsets'
      },
      wordnet: {
        maxSynsets: config.wordnet?.maxSynsets || null,
        includedPos: config.wordnet?.includedPos || ['n', 'v', 'a', 's', 'r']
      },
      loading: {
        batchSize: config.loading?.batchSize || 1000
      }
    };

    this.wordnet = new WordNetAccess();
    this.mongoClient = null;
    this.db = null;
    this.collection = null;

    this.stats = {
      synsetsLoaded: 0,
      startTime: null,
      endTime: null
    };
  }

  async initialize() {
    console.log('Initializing Simple WordNet Loader...');

    const resourceManager = await ResourceManager.getInstance();

    // Get MongoDB client from storage provider
    const { MongoClient } = await import('mongodb');
    this.mongoClient = new MongoClient(this.config.mongodb.connectionString);
    await this.mongoClient.connect();

    this.db = this.mongoClient.db(this.config.mongodb.dbName);
    this.collection = this.db.collection(this.config.mongodb.collectionName);

    // Create indices
    await this.collection.createIndex({ synsetOffset: 1, pos: 1 }, { unique: true });
    await this.collection.createIndex({ pos: 1 });
    await this.collection.createIndex({ 'synonyms': 1 });

    console.log('Simple WordNet Loader initialized');
  }

  async loadWordNet() {
    console.log('Starting WordNet loading...');
    this.stats.startTime = Date.now();

    try {
      await this.initialize();

      for (const pos of this.config.wordnet.includedPos) {
        console.log(`\nLoading ${pos} synsets...`);
        await this.loadPOS(pos);
      }

      this.stats.endTime = Date.now();
      const duration = (this.stats.endTime - this.stats.startTime) / 1000;

      console.log('\n=== LOADING COMPLETE ===');
      console.log(`Synsets loaded: ${this.stats.synsetsLoaded}`);
      console.log(`Time: ${duration.toFixed(2)} seconds`);
      console.log(`Speed: ${(this.stats.synsetsLoaded / duration).toFixed(0)} synsets/second`);
      console.log('========================\n');

      return {
        synsetsLoaded: this.stats.synsetsLoaded,
        durationSeconds: duration
      };

    } finally {
      if (this.mongoClient) {
        await this.mongoClient.close();
      }
    }
  }

  async loadPOS(pos) {
    // Get all synsets for this POS
    const synsetList = await this.wordnet.getAllSynsets(pos, this.config.wordnet.maxSynsets);
    console.log(`Found ${synsetList.length} synsets for POS: ${pos}`);

    // Process in batches
    const batchSize = this.config.loading.batchSize;
    for (let i = 0; i < synsetList.length; i += batchSize) {
      const batch = synsetList.slice(i, i + batchSize);

      // Fetch full synset data
      const documents = [];
      for (const synsetInfo of batch) {
        try {
          const synsetData = await this.wordnet.getSynset(synsetInfo.offset, synsetInfo.pos);

          // Create clean MongoDB document
          const doc = {
            synsetOffset: synsetData.synsetOffset,
            pos: synsetData.pos,
            synonyms: synsetData.synonyms || [],
            definition: synsetData.def || synsetData.gloss || '',
            examples: synsetData.exp || [],
            lexicalFile: synsetData.lexName || '',
            pointers: synsetData.ptrs || [],
            created: new Date()
          };

          documents.push(doc);
        } catch (error) {
          console.warn(`  Failed to load synset ${synsetInfo.offset}.${synsetInfo.pos}: ${error.message}`);
        }
      }

      // Insert batch
      if (documents.length > 0) {
        await this.collection.insertMany(documents, { ordered: false });
        this.stats.synsetsLoaded += documents.length;

        console.log(`  Loaded ${this.stats.synsetsLoaded}/${synsetList.length} synsets`);
      }
    }

    console.log(`Completed loading ${this.stats.synsetsLoaded} ${pos} synsets`);
  }

  async getStats() {
    if (!this.collection) {
      throw new Error('Not initialized');
    }

    const total = await this.collection.countDocuments();
    const byPos = await this.collection.aggregate([
      { $group: { _id: '$pos', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    return {
      total,
      byPos: byPos.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }
}
