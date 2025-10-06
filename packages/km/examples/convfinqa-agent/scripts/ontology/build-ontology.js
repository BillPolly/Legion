#!/usr/bin/env node
/**
 * Build Ontology Script
 *
 * ONE-TIME operation to build financial domain ontology from ConvFinQA training data.
 * This creates TYPE-LEVEL schema (TBox) stored in MongoDB for use across all evaluation runs.
 *
 * Usage:
 *   npm run build-ontology
 *   node scripts/build-ontology.js
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { ResourceManager } from '@legion/resource-manager';
import { OntologyBuilder } from '@legion/ontology';
import { MongoDBProvider } from '../src/storage/MongoDBProvider.js';

async function main() {
  console.log('\n=== ConvFinQA Ontology Builder ===\n');

  // Get configuration
  const resourceManager = await ResourceManager.getInstance();
  const mongoUri = resourceManager.get('env.MONGO_URI');
  const datasetPath = resourceManager.get('env.CONVFINQA_DATASET_PATH') ||
                     './data/convfinqa_train.json';

  console.log(`MongoDB URI: ${mongoUri}`);
  console.log(`Dataset path: ${datasetPath}\n`);

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('✓ Connected\n');

  try {
    // Load dataset
    console.log(`Loading dataset from ${datasetPath}...`);
    const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
    console.log(`✓ Loaded ${dataset.length} conversations\n`);

    // Create ontology store
    const db = mongoClient.db('convfinqa_eval');
    const ontologyCollection = db.collection('ontology');

    // Clear existing ontology
    console.log('Clearing existing ontology...');
    await ontologyCollection.deleteMany({ type: 'ontology' });
    console.log('✓ Cleared\n');

    // Create MongoDB provider for ontology
    const ontologyStore = new MongoDBProvider({
      collection: ontologyCollection,
      metadata: { type: 'ontology' }
    });

    // Create indexes
    console.log('Creating indexes...');
    await ontologyCollection.createIndex({ s: 1, p: 1, o: 1, type: 1 });
    await ontologyCollection.createIndex({ type: 1 });
    console.log('✓ Indexes created\n');

    // Build ontology
    console.log('Building ontology from training data...');
    console.log('This may take a few minutes...\n');

    const ontologyBuilder = new OntologyBuilder(ontologyStore);

    let processedCount = 0;
    const startTime = Date.now();

    for (const example of dataset) {
      const { table, text, qa } = example;

      // Process table
      if (table && table.length > 0) {
        await ontologyBuilder.processTable(table);
      }

      // Process text
      if (text && Array.isArray(text)) {
        for (const textItem of text) {
          await ontologyBuilder.processText(textItem);
        }
      }

      processedCount++;

      if (processedCount % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (processedCount / (Date.now() - startTime) * 1000).toFixed(1);
        console.log(`  Processed ${processedCount}/${dataset.length} (${rate} examples/sec, ${elapsed}s elapsed)`);
      }
    }

    // Finalize ontology
    console.log('\nFinalizing ontology...');
    await ontologyBuilder.finalize();

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✓ Complete in ${totalTime}s\n`);

    // Get statistics
    const ontologySize = await ontologyStore.size();
    const classes = await ontologyStore.query(null, 'rdf:type', 'owl:Class');
    const properties = await ontologyStore.query(null, 'rdf:type', 'owl:DatatypeProperty');

    console.log('=== Ontology Statistics ===');
    console.log(`Total triples: ${ontologySize}`);
    console.log(`Classes (entities): ${classes.length}`);
    console.log(`Properties: ${properties.length}\n`);

    // Show sample classes
    console.log('=== Sample Classes ===');
    for (const [classUri] of classes.slice(0, 10)) {
      // Get label if exists
      const labels = await ontologyStore.query(classUri, 'rdfs:label', null);
      const label = labels.length > 0
        ? labels[0][2].replace(/"/g, '')
        : classUri.split(':')[1];

      console.log(`  ${classUri} - "${label}"`);
    }
    if (classes.length > 10) {
      console.log(`  ... and ${classes.length - 10} more`);
    }
    console.log();

    // Show sample properties
    console.log('=== Sample Properties ===');
    for (const [propUri] of properties.slice(0, 10)) {
      // Get domain and range
      const domains = await ontologyStore.query(propUri, 'rdfs:domain', null);
      const ranges = await ontologyStore.query(propUri, 'rdfs:range', null);
      const labels = await ontologyStore.query(propUri, 'rdfs:label', null);

      const domain = domains.length > 0 ? domains[0][2] : '?';
      const range = ranges.length > 0 ? ranges[0][2] : '?';
      const label = labels.length > 0
        ? labels[0][2].replace(/"/g, '')
        : propUri.split(':')[1];

      console.log(`  ${propUri} - "${label}"`);
      console.log(`    Domain: ${domain}, Range: ${range}`);
    }
    if (properties.length > 10) {
      console.log(`  ... and ${properties.length - 10} more`);
    }
    console.log();

    console.log('✓ Ontology building complete!\n');
    console.log('Ontology stored in MongoDB: convfinqa_eval.ontology');
    console.log('Ready for evaluation runs.\n');

  } catch (error) {
    console.error('\n✗ Error building ontology:');
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
