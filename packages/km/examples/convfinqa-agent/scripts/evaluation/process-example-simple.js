#!/usr/bin/env node
/**
 * Process example with simple table processor
 *
 * 1. Analyze table structure
 * 2. Update ontology with concepts
 * 3. Create KG instances
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '../src/storage/MongoDBProvider.js';
import { SimpleTableProcessor } from '../src/utils/SimpleTableProcessor.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyIndexer } from '@legion/ontology/src/services/OntologyIndexer.js';

async function main() {
  const exampleIndex = parseInt(process.argv[2]);
  if (isNaN(exampleIndex)) {
    console.error('Usage: node scripts/process-example-simple.js <example_index>');
    process.exit(1);
  }

  console.log(`\n=== Processing Example ${exampleIndex} ===\n`);

  const resourceManager = await ResourceManager.getInstance();
  const mongoUri = resourceManager.get('env.MONGO_URI');
  const llmClient = await resourceManager.get('llmClient');

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('✓ Connected to MongoDB\n');

  try {
    const dataset = JSON.parse(readFileSync('./data/convfinqa_train.json', 'utf-8'));
    const example = dataset[exampleIndex];

    console.log(`Example: ${example.filename}`);
    console.log(`Table: ${example.table.length} rows x ${example.table[0]?.length || 0} cols`);
    console.log(`Question: "${example.qa.question}"`);
    console.log(`Answer: ${example.qa.answer}\n`);

    const db = mongoClient.db('convfinqa_eval');

    // Setup stores
    const ontologyStore = new MongoDBProvider({
      collection: db.collection('ontology'),
      metadata: { type: 'ontology' }
    });

    const kgStore = new MongoDBProvider({
      collection: db.collection('example_kgs'),
      metadata: {
        type: 'example_kg',
        exampleId: example.filename
      }
    });

    // Clear existing KG for this example
    await db.collection('example_kgs').deleteMany({ exampleId: example.filename });

    // Create semantic search provider
    const searchProvider = await SemanticSearchProvider.create(resourceManager);

    // Create ontology indexer
    const ontologyIndexer = new OntologyIndexer(ontologyStore, searchProvider);

    // Process table
    console.log('Processing table...\n');
    const processor = new SimpleTableProcessor(ontologyStore, kgStore, llmClient, ontologyIndexer);

    const context = [...(example.pre_text || []), ...(example.post_text || [])];
    const result = await processor.processTable(example.table, context);

    console.log('\n✅ Table processed successfully!');
    console.log(`  Entity type: ${result.structure.entityType}`);
    console.log(`  Instances created: ${result.instancesCreated}\n`);

    // Show ontology stats
    const classes = await ontologyStore.query(null, 'rdf:type', 'owl:Class');
    const properties = await ontologyStore.query(null, 'rdf:type', 'owl:DatatypeProperty');

    console.log('Ontology:');
    console.log(`  Classes: ${classes.length}`);
    console.log(`  Properties: ${properties.length}\n`);

    // Show KG stats
    const instances = await kgStore.query(null, 'rdf:type', null);
    console.log('Knowledge Graph:');
    console.log(`  Instances: ${instances.length}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
