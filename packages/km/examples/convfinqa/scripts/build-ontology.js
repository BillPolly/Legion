/**
 * Build Unified Ontology from First 10 ConvFinQA Examples
 *
 * This script:
 * 1. Loads first 10 training examples
 * 2. Builds a unified ontology from all their pre_text sections
 * 3. Saves ontology to file for reuse in evaluation
 */

import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../semantic-financial-kg/src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('Building Unified Ontology from First 10 ConvFinQA Examples');
  console.log('='.repeat(80));
  console.log();

  // Load dataset
  console.log('📂 Loading ConvFinQA dataset...');
  const dataPath = path.join(import.meta.dirname, '../data/convfinqa_dataset.json');
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Get first 10 examples
  const numExamples = 10;
  const examples = dataset.train.slice(0, numExamples);
  console.log(`   Loaded ${dataset.train.length} training examples`);
  console.log(`   Building ontology from first ${examples.length} examples\n`);

  // Initialize ResourceManager
  console.log('🔧 Initializing ResourceManager...');
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');
  console.log('   ✓ ResourceManager initialized\n');

  // Create triple store and semantic search
  console.log('🔧 Initializing triple store and semantic search...');
  const tripleStore = new TripleStore();
  const semanticSearch = await SemanticSearchProvider.create(resourceManager);
  console.log('   ✓ Components initialized\n');

  // Create ontology builder
  console.log('🏗️  Creating OntologyBuilder...');
  const ontologyBuilder = new OntologyBuilder({
    tripleStore,
    semanticSearch,
    llmClient,
    verification: {
      enabled: false  // Disable for speed
    }
  });
  console.log('   ✓ OntologyBuilder created\n');

  // Bootstrap ontology
  console.log('📦 Loading bootstrap ontology...');
  await ontologyBuilder.ensureBootstrapLoaded();
  console.log('   ✓ Bootstrap loaded\n');

  // Build ontology incrementally from each example
  console.log('🔨 Building unified ontology incrementally from all 10 examples...');
  console.log('   This may take several minutes...\n');

  const startTime = Date.now();
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    const preText = Array.isArray(example.doc.pre_text)
      ? example.doc.pre_text.join(' ')
      : example.doc.pre_text;

    console.log(`[${i + 1}/${examples.length}] Processing: ${example.id} (${preText.length} chars)`);

    try {
      await ontologyBuilder.processText(preText, { domain: 'finance' });
      totalSuccess++;
      console.log(`   ✓ Success\n`);
    } catch (error) {
      totalFailed++;
      console.log(`   ✗ Failed: ${error.message}\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Ontology building complete (${elapsed}s)`);
  console.log(`   Success: ${totalSuccess}/${examples.length}`);
  console.log(`   Failed: ${totalFailed}/${examples.length}\n`);

  // Get ontology statistics from triple store
  console.log('📊 Ontology Statistics:');
  const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
  const allProps = await tripleStore.query(null, 'rdf:type', null);
  const objectProps = allProps.filter(([s, p, o]) => o === 'owl:ObjectProperty');
  const datatypeProps = allProps.filter(([s, p, o]) => o === 'owl:DatatypeProperty');

  console.log(`   Classes: ${allClasses.length}`);
  console.log(`   Object Properties: ${objectProps.length}`);
  console.log(`   Datatype Properties: ${datatypeProps.length}`);
  console.log(`   Total Properties: ${objectProps.length + datatypeProps.length}`);
  console.log();

  // Export ontology to RDF/Turtle format
  console.log('💾 Exporting ontology...');

  // Get all triples from triple store
  const allTriples = await tripleStore.query(null, null, null);
  console.log(`   Retrieved ${allTriples.length} triples\n`);

  // Group triples by type
  const classes = allTriples.filter(([s, p, o]) => p === 'rdf:type' && o === 'owl:Class');
  const properties = allTriples.filter(([s, p, o]) =>
    p === 'rdf:type' && (o === 'owl:ObjectProperty' || o === 'owl:DatatypeProperty')
  );

  console.log('📊 Triple Breakdown:');
  console.log(`   Class declarations: ${classes.length}`);
  console.log(`   Property declarations: ${properties.length}`);
  console.log();

  // Save ontology as JSON (easier to reload)
  const ontologyData = {
    metadata: {
      created: new Date().toISOString(),
      numExamples: examples.length,
      exampleIds: examples.map(e => e.id),
      successfulExamples: totalSuccess,
      failedExamples: totalFailed,
      statistics: {
        classes: allClasses.length,
        objectProperties: objectProps.length,
        datatypeProperties: datatypeProps.length,
        totalProperties: objectProps.length + datatypeProps.length,
        totalTriples: allTriples.length
      }
    },
    triples: allTriples,
    classes: classes.map(([s]) => s),
    properties: properties.map(([s]) => s)
  };

  const outputPath = path.join(import.meta.dirname, '../__tests__/tmp/ontology-10-examples.json');
  fs.writeFileSync(outputPath, JSON.stringify(ontologyData, null, 2));
  console.log(`💾 Ontology saved to: ${outputPath}\n`);

  // Also save in a more readable format
  const readablePath = path.join(import.meta.dirname, '../__tests__/tmp/ontology-10-examples-readable.txt');
  const readableContent = [
    '='.repeat(80),
    'ConvFinQA Unified Ontology (First 10 Examples)',
    '='.repeat(80),
    '',
    `Created: ${new Date().toISOString()}`,
    `Examples: ${examples.length}`,
    '',
    '='.repeat(80),
    'CLASSES',
    '='.repeat(80),
    '',
    ...classes.map(([cls]) => `- ${cls}`),
    '',
    '='.repeat(80),
    'PROPERTIES',
    '='.repeat(80),
    '',
    ...properties.map(([prop]) => `- ${prop}`),
    '',
    '='.repeat(80),
    `Total Triples: ${allTriples.length}`,
    '='.repeat(80)
  ].join('\n');

  fs.writeFileSync(readablePath, readableContent);
  console.log(`📄 Readable ontology saved to: ${readablePath}\n`);

  console.log('='.repeat(80));
  console.log('✅ Ontology building complete!');
  console.log('='.repeat(80));
  console.log();
  console.log('Next steps:');
  console.log('1. Review the ontology in the readable format');
  console.log('2. Use the saved ontology in evaluation to skip ontology building');
  console.log('3. Run evaluation on all 10 examples with the pre-built ontology');
  console.log();
}

main().catch(error => {
  console.error('Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
