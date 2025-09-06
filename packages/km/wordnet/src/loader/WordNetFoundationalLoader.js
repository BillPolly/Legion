/**
 * WordNet Foundational Loader
 * Main orchestrator for loading WordNet data into Knowledge Graph
 */

import { KGEngine } from '@legion/kg';
import { MongoTripleStore } from '@legion/kg';
import { SynsetProcessor } from '../processors/SynsetProcessor.js';
import { RelationshipProcessor } from '../processors/RelationshipProcessor.js';
import { HierarchyBuilder } from '../hierarchy/HierarchyBuilder.js';
import { WordNetAccess } from '../wordnet/WordNetAccess.js';
import { DEFAULT_CONFIG } from '../config/default.js';

export class WordNetFoundationalLoader {
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = null;
    this.kg = null;
    this.synsetProcessor = null;
    this.relationshipProcessor = null;
    this.hierarchyBuilder = null;
    
    this.stats = {
      conceptsLoaded: 0,
      wordsCreated: 0,
      relationshipsCreated: 0,
      startTime: null,
      endTime: null,
      totalTriples: 0
    };
  }

  async initialize() {
    console.log('Initializing WordNet Foundational Loader...');

    // Create MongoDB storage
    this.store = new MongoTripleStore(
      this.config.mongodb.connectionString,
      this.config.mongodb.dbName,
      this.config.mongodb.collectionName
    );

    // Create KG engine
    this.kg = new KGEngine(this.store);

    // Initialize processors
    this.synsetProcessor = new SynsetProcessor(this.kg, this.config);
    this.relationshipProcessor = new RelationshipProcessor(this.kg, this.config);
    this.hierarchyBuilder = new HierarchyBuilder(this.kg);

    console.log('WordNet Foundational Loader initialized');
  }

  async loadFoundationalOntology() {
    console.log('Starting WordNet foundational ontology loading...');
    this.stats.startTime = Date.now();

    try {
      await this.initialize();

      // Phase 1: Load all synsets as foundational concepts
      console.log('Phase 1: Loading synsets as foundational concepts...');
      await this.loadAllSynsets();

      // Phase 2: Process semantic relationships
      console.log('Phase 2: Processing semantic relationships...');
      const relationshipCount = await this.relationshipProcessor.processAllRelationships();
      this.stats.relationshipsCreated = relationshipCount;

      // Phase 3: Build foundational hierarchy
      console.log('Phase 3: Building foundational hierarchy...');
      const hierarchyValidation = await this.hierarchyBuilder.buildFoundationalHierarchy();

      // Phase 4: Create database indices
      if (this.config.loading.createIndices) {
        console.log('Phase 4: Creating database indices...');
        await this.store.createIndices();
      }

      // Phase 5: Final validation
      console.log('Phase 5: Final validation...');
      const validation = await this.validateOntology();

      this.stats.endTime = Date.now();
      this.stats.totalTriples = await this.kg.size();
      const duration = (this.stats.endTime - this.stats.startTime) / 1000;

      const summary = {
        ...this.stats,
        loadingTimeSeconds: duration,
        synsetStats: this.synsetProcessor.getStats(),
        relationshipStats: this.relationshipProcessor.getStats(),
        hierarchyValidation: hierarchyValidation,
        finalValidation: validation
      };

      console.log('Foundational ontology loading completed successfully!');
      console.log(`Total time: ${duration} seconds`);
      console.log(`Concepts loaded: ${this.stats.conceptsLoaded}`);
      console.log(`Words created: ${this.stats.wordsCreated}`);
      console.log(`Relationships: ${this.stats.relationshipsCreated}`);
      console.log(`Total triples: ${this.stats.totalTriples}`);

      return summary;

    } catch (error) {
      console.error('Foundational ontology loading failed:', error);
      throw error;
    } finally {
      if (this.store) {
        await this.store.disconnect();
      }
    }
  }

  async loadAllSynsets() {
    const wordnet = new WordNetAccess();
    
    for (const pos of this.config.wordnet.includedPos) {
      console.log(`Loading ${pos} synsets...`);
      
      const maxSynsets = this.config.wordnet.maxSynsets;
      const synsets = await wordnet.getAllSynsets(pos, maxSynsets);
      
      console.log(`Found ${synsets.length} synsets for POS: ${pos}`);
      
      let processedCount = 0;
      const batchSize = this.config.loading.batchSize;
      
      // Process synsets in batches
      for (let i = 0; i < synsets.length; i += batchSize) {
        const batch = synsets.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (synsetInfo) => {
          try {
            const result = await this.synsetProcessor.processSynset(synsetInfo);
            if (result) {
              this.stats.conceptsLoaded++;
            }
          } catch (error) {
            console.warn(`Failed to process synset ${synsetInfo.offset}.${synsetInfo.pos}: ${error.message}`);
          }
        }));
        
        processedCount += batch.length;
        if (processedCount % this.config.loading.logInterval === 0) {
          console.log(`  Processed ${processedCount}/${synsets.length} ${pos} synsets`);
        }
      }
      
      console.log(`Completed loading ${processedCount} ${pos} synsets`);
    }
    
    // Update stats from processor
    const synsetStats = this.synsetProcessor.getStats();
    this.stats.wordsCreated = synsetStats.wordsCreated;
  }

  async validateOntology() {
    console.log('Validating foundational ontology...');

    const validation = {
      conceptCount: await this.countByType('kg:Concept'),
      wordCount: await this.countByType('kg:Word'),
      isARelationCount: await this.countByType('kg:IsA'),
      hasLabelRelationCount: await this.countByType('kg:HasLabel'),
      expressesRelationCount: await this.countByType('kg:Expresses')
    };

    // Validate foundational categories
    const categories = ['kg:Entity', 'kg:Process', 'kg:Property', 'kg:Relation'];
    validation.foundationalCategories = {};
    
    for (const category of categories) {
      const descendants = await this.kg.queryAsync(null, null, category);
      validation.foundationalCategories[category] = descendants.length;
    }

    return validation;
  }

  async countByType(type) {
    const results = await this.kg.queryAsync(null, 'rdf:type', type);
    return results.length;
  }

  // Getter methods for accessing components
  getKGEngine() {
    return this.kg;
  }

  getStore() {
    return this.store;
  }

  getStats() {
    return { ...this.stats };
  }
}
