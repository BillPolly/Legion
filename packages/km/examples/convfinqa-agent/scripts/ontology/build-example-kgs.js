#!/usr/bin/env node
/**
 * Build Example Background KGs
 *
 * For each example in the dataset, builds a background knowledge graph from:
 * - Table data
 * - Context text (pre_text + post_text)
 *
 * Does NOT include questions or answers.
 *
 * The background KGs are persisted to MongoDB and used during evaluation.
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '../src/storage/MongoDBProvider.js';
import { SimpleTableProcessor } from '../src/utils/SimpleTableProcessor.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyIndexer } from '@legion/ontology/src/services/OntologyIndexer.js';

async function main() {
  console.log('\n=== ConvFinQA Example Background KG Builder ===\n');

  // Get configuration
  const resourceManager = await ResourceManager.getInstance();
  const mongoUri = resourceManager.get('env.MONGO_URI');
  const llmClient = await resourceManager.get('llmClient');

  if (!mongoUri) {
    console.error('❌ MONGO_URI not found in environment');
    process.exit(1);
  }

  console.log(`MongoDB URI: ${mongoUri}`);
  console.log('Dataset: ./data/convfinqa_train.json\n');

  // Load dataset
  console.log('Loading dataset...');
  const dataset = JSON.parse(readFileSync('./data/convfinqa_train.json', 'utf-8'));
  console.log(`✓ Loaded ${dataset.length} conversations\n`);

  // Determine which examples to process
  const exampleCount = process.argv[2] ? parseInt(process.argv[2]) : 10;
  console.log(`Processing first ${exampleCount} examples\n`);

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('✓ Connected\n');

  try {
    const db = mongoClient.db('convfinqa_eval');

    // Setup ontology store (will be built dynamically)
    const ontologyStore = new MongoDBProvider({
      collection: db.collection('ontology'),
      metadata: { type: 'ontology' }
    });

    // Create semantic search provider for ontology indexing
    console.log('Setting up semantic search...');
    const searchProvider = await SemanticSearchProvider.create(resourceManager);
    console.log('✓ Semantic search ready\n');

    // Create ontology indexer
    const ontologyIndexer = new OntologyIndexer(ontologyStore, searchProvider);

    console.log('='.repeat(80));
    console.log('Building Example Background KGs (with dynamic ontology)');
    console.log('='.repeat(80));
    console.log();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < Math.min(exampleCount, dataset.length); i++) {
      const example = dataset[i];
      const exampleId = example.filename || example.id || `example_${i}`;

      console.log(`[${i + 1}/${exampleCount}] Processing: ${exampleId}`);
      console.log('-'.repeat(80));

      try {
        // Setup example KG provider
        const exampleKGProvider = new MongoDBProvider({
          collection: db.collection('example_kgs'),
          metadata: {
            type: 'example_kg',
            exampleId
          }
        });

        // Clear any existing KG for this example
        await exampleKGProvider.clear();

        // Get table and context
        const table = example.table_ori || example.table;
        const context = [...(example.pre_text || []), ...(example.post_text || [])];

        if (!table || table.length < 2) {
          console.log('  ⚠️  No table data - skipping');
          continue;
        }

        console.log(`  Table: ${table.length} rows x ${table[0]?.length || 0} cols`);
        console.log(`  Context: ${context.length} text items`);

        // Process table (builds ontology dynamically and creates KG)
        const processor = new SimpleTableProcessor(
          ontologyStore,
          exampleKGProvider,
          llmClient,
          ontologyIndexer
        );
        const result = await processor.processTable(table, context);

        console.log(`  ✓ Built KG: ${result.instancesCreated} table instances${result.textFacts ? `, ${result.textFacts} text facts` : ''}`);
        console.log(`  Entity Type: ${result.structure.entityType}`);
        console.log();

        successCount++;

      } catch (error) {
        console.error(`  ❌ Error building KG: ${error.message}`);
        console.error(`     ${error.stack?.split('\n')[1]?.trim() || ''}`);
        console.log();
        failCount++;
      }
    }

    console.log('='.repeat(80));
    console.log('✅ Example Background KG Building Complete');
    console.log('='.repeat(80));
    console.log();
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${successCount + failCount}`);
    console.log();
    console.log('Background KGs stored in MongoDB: convfinqa_eval.example_kgs');
    console.log('Ready for evaluation runs!');
    console.log();

  } catch (error) {
    console.error('\n❌ Error building example KGs:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
