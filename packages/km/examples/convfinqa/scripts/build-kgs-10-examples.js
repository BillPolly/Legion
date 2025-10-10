/**
 * Build Knowledge Graphs for First 10 ConvFinQA Examples
 *
 * This script builds KGs using Phase 7 for the first 10 examples,
 * skipping the complex ontology building step.
 */

import { InstanceBuilder } from '../../semantic-financial-kg/src/kg/InstanceBuilder.js';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../semantic-financial-kg/src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('Building Knowledge Graphs for First 10 ConvFinQA Examples (Phase 7)');
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
  console.log(`   Building KGs for first ${examples.length} examples\n`);

  // Initialize ResourceManager
  console.log('🔧 Initializing ResourceManager...');
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');
  console.log('   ✓ ResourceManager initialized\n');

  // Create triple store and semantic search (shared across all examples)
  console.log('🔧 Initializing triple store and semantic search...');
  const tripleStore = new TripleStore();
  const semanticSearch = await SemanticSearchProvider.create(resourceManager);
  console.log('   ✓ Components initialized\n');

  // Create minimal ontology builder (just bootstrap)
  console.log('📦 Loading bootstrap ontology...');
  const ontologyBuilder = new OntologyBuilder({
    tripleStore,
    semanticSearch,
    llmClient,
    verification: { enabled: false }
  });
  await ontologyBuilder.ensureBootstrapLoaded();
  console.log('   ✓ Bootstrap loaded\n');

  // Create instance builder
  console.log('🏗️  Creating InstanceBuilder...');
  const instanceBuilder = new InstanceBuilder({
    tripleStore,
    ontologyBuilder,
    llmClient,
    semanticSearch
  });
  console.log('   ✓ InstanceBuilder created\n');

  // Process each example
  console.log('🔨 Building KGs for all 10 examples...\n');

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];

    console.log(`[${i + 1}/${examples.length}] ${example.id}`);

    try {
      // Extract company name
      const companyMatch = example.id.match(/Single_([^/]+)\//) || example.id.match(/Double_([^/]+)\//);
      const company = companyMatch ? companyMatch[1] : 'Unknown';

      // Prepare data for InstanceBuilder
      const data = {
        table: example.doc.table,
        metadata: {
          sourceDocument: example.id,
          documentId: example.id,
          scale: 'thousands',
          currency: 'USD',
          company: company,
          organizationUri: `data:${company}`
        }
      };

      // Build KG using Phase 7
      const kg = await instanceBuilder.createInstances(data);

      // Count entities by type
      const entityCounts = {};
      for (const entity of kg.table.entities) {
        entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
      }

      results.push({
        id: example.id,
        success: true,
        entities: kg.table.entities.length,
        relationships: kg.table.relationships.length,
        entityCounts,
        questions: example.dialogue.conv_questions.length
      });

      console.log(`   ✓ Success: ${kg.table.entities.length} entities, ${kg.table.relationships.length} relationships`);
      console.log(`     Entity types:`, Object.entries(entityCounts).map(([type, count]) =>
        `${type.split(':')[1]}=${count}`).join(', '));
      console.log();

    } catch (error) {
      results.push({
        id: example.id,
        success: false,
        error: error.message
      });

      console.log(`   ✗ Failed: ${error.message}\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log();

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total Examples: ${examples.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Time Elapsed: ${elapsed}s`);
  console.log();

  if (successful.length > 0) {
    console.log('Successful Examples:');
    for (const result of successful) {
      console.log(`  ✓ ${result.id}: ${result.entities} entities, ${result.relationships} rels, ${result.questions} questions`);
    }
    console.log();

    const totalEntities = successful.reduce((sum, r) => sum + r.entities, 0);
    const totalRelationships = successful.reduce((sum, r) => sum + r.relationships, 0);
    const totalQuestions = successful.reduce((sum, r) => sum + r.questions, 0);

    console.log(`Total Entities: ${totalEntities}`);
    console.log(`Total Relationships: ${totalRelationships}`);
    console.log(`Total Questions: ${totalQuestions}`);
    console.log();
  }

  if (failed.length > 0) {
    console.log('Failed Examples:');
    for (const result of failed) {
      console.log(`  ✗ ${result.id}: ${result.error}`);
    }
    console.log();
  }

  // Save results
  const outputPath = path.join(import.meta.dirname, '../__tests__/tmp/kg-build-results-10.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${outputPath}`);

  // Get final triple store stats
  const allTriples = await tripleStore.query(null, null, null);
  console.log(`📊 Triple Store: ${allTriples.length} total triples`);

  console.log();
  console.log('='.repeat(80));
  console.log('✅ KG building complete!');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
