/**
 * Full Production Indexing Script
 *
 * Indexes ALL WordNet data (~200K vectors) into Qdrant collections.
 * This should be run ONCE after all testing is complete.
 *
 * IMPORTANT: This indexes FULL production data, not test data.
 *
 * Usage: node scripts/full-index.js
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryIndexer } from '../src/SemanticInventoryIndexer.js';

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('    SEMANTIC INVENTORY - FULL PRODUCTION INDEXING');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('⚠️  WARNING: This will index ~200K WordNet vectors');
  console.log('⚠️  This operation may take 10-30 minutes');
  console.log('⚠️  Ensure MongoDB and Qdrant are running\n');

  const resourceManager = await ResourceManager.getInstance();
  const indexer = new SemanticInventoryIndexer(resourceManager);

  try {
    // Initialize indexer
    console.log('Initializing indexer...');
    await indexer.initialize();
    console.log('✅ Indexer initialized\n');

    // Check current state
    console.log('Checking existing collections...');
    const beforeStats = await indexer.getStats();
    console.log(`Current state:`, beforeStats);
    console.log('');

    // Confirm before proceeding
    if (beforeStats.total > 0) {
      console.log('⚠️  Collections already contain data!');
      console.log('⚠️  This will RE-INDEX all collections (existing data will be overwritten)');
      console.log('');
    }

    // Execute full indexing
    console.log('Starting full indexing...\n');
    const startTime = Date.now();

    // Index all collections with production data (testMode: false)
    const stats = await indexer.indexAll({
      testMode: false,           // Use FULL production data
      collectionPrefix: ''       // Use production collection names (no prefix)
    });

    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    // Final report
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('    INDEXING COMPLETE!');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`Total time: ${minutes}m ${seconds}s`);
    console.log(`Total vectors indexed: ${stats.total.toLocaleString()}\n`);
    console.log('Collection breakdown:');
    console.log(`  - wordnet_entity_types: ${stats.entity_types.toLocaleString()} (nouns with entity categories)`);
    console.log(`  - wordnet_roles: ${stats.roles.toLocaleString()} (semantic roles)`);
    console.log(`  - wordnet_predicates: ${stats.predicates.toLocaleString()} (adj + nouns + verbs)`);
    console.log(`  - wordnet_relations: ${stats.relations.toLocaleString()} (adverbs as relations)\n`);

    // Verify expected counts
    console.log('Verifying counts against expectations...');
    const issues = [];

    if (stats.entity_types < 80000) {
      issues.push(`⚠️  Entity types: ${stats.entity_types} (expected ~82K)`);
    }
    if (stats.roles < 10) {
      issues.push(`⚠️  Roles: ${stats.roles} (expected ~14)`);
    }
    if (stats.predicates < 110000) {
      issues.push(`⚠️  Predicates: ${stats.predicates} (expected ~114K)`);
    }
    if (stats.relations < 3000) {
      issues.push(`⚠️  Relations: ${stats.relations} (expected ~3.6K)`);
    }

    if (issues.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('✅ All counts look good!\n');
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log('Next steps:');
    console.log('  1. Run verification tests to confirm data quality');
    console.log('  2. Test semantic search queries with production data');
    console.log('  3. Integrate with DRS pipeline');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR during indexing:');
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up
    await indexer.close();
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
