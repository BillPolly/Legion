/**
 * Example: Using recallHandles() for semantic search and instantiation
 *
 * This example demonstrates the complete recall workflow:
 * 1. Store handles with semantic metadata
 * 2. Search semantically and get instantiated handles
 * 3. Use the recalled handles directly
 */

import { ResourceManager } from '@legion/resource-manager';

async function main() {
  // Get ResourceManager and semantic search
  const resourceManager = await ResourceManager.getInstance();
  const semanticSearch = await resourceManager.createHandleSemanticSearch();

  console.log('=== Handle Semantic Search: Recall Example ===\n');

  // Step 1: Store some handles for later recall
  console.log('Step 1: Indexing handles for semantic search...');
  const handles = [
    'legion://local/mongodb/ecommerce_db/users',
    'legion://local/mongodb/ecommerce_db/products',
    'legion://local/mongodb/ecommerce_db/orders',
    'legion://local/mongodb/analytics_db/pageviews',
    'legion://local/mongodb/analytics_db/events'
  ];

  for (const uri of handles) {
    const result = await semanticSearch.storeHandle(uri);
    console.log(`  ✓ Indexed: ${uri} (${result.glossCount} glosses)`);
  }

  console.log('\nStep 2: Semantic Recall - Search and instantiate handles\n');

  // Example 1: Find user-related databases
  console.log('Example 1: Find user-related handles');
  console.log('Query: "user management and authentication"\n');

  const userHandles = await semanticSearch.recallHandles('user management and authentication', {
    limit: 3,
    threshold: 0.6
  });

  console.log(`Found ${userHandles.length} relevant handles:\n`);
  for (const item of userHandles) {
    console.log(`  Handle: ${item.handleURI}`);
    console.log(`  Similarity: ${item.similarity.toFixed(3)}`);
    console.log(`  Type: ${item.handleType}`);
    console.log(`  Ready to use: ${item.handle.resourceType}://${item.handle.database}/${item.handle.collection}`);
    console.log();
  }

  // Example 2: Find e-commerce related data
  console.log('\nExample 2: Find e-commerce handles');
  console.log('Query: "online shopping and product catalog"\n');

  const ecommerceHandles = await semanticSearch.recallHandles('online shopping and product catalog', {
    limit: 3,
    threshold: 0.5
  });

  console.log(`Found ${ecommerceHandles.length} relevant handles:\n`);
  for (const item of ecommerceHandles) {
    console.log(`  ${item.handleURI} (similarity: ${item.similarity.toFixed(3)})`);
    console.log(`  Matched gloss: ${item.searchResult.matchedGloss.type}`);
    console.log(`  Description: ${item.searchResult.matchedGloss.content.substring(0, 80)}...`);
    console.log();
  }

  // Example 3: Use the recalled handle immediately
  console.log('\nExample 3: Recall and use handle directly');
  console.log('Query: "order tracking and fulfillment"\n');

  const orderHandles = await semanticSearch.recallHandles('order tracking and fulfillment', {
    limit: 1
  });

  if (orderHandles.length > 0) {
    const { handle, handleURI, similarity } = orderHandles[0];

    console.log(`Best match: ${handleURI} (similarity: ${similarity.toFixed(3)})`);
    console.log(`Handle is ready to use:`);
    console.log(`  - Resource type: ${handle.resourceType}`);
    console.log(`  - Database: ${handle.database}`);
    console.log(`  - Collection: ${handle.collection}`);
    console.log(`\nYou can now use this handle for queries:`);
    console.log(`  await handle.findOne({ orderId: '12345' });`);
    console.log(`  await handle.find({ status: 'pending' });`);
  }

  // Example 4: Filter by handle type
  console.log('\n\nExample 4: Filter recall by handle type');
  console.log('Query: "database", Filter: only mongodb handles\n');

  const mongoHandles = await semanticSearch.recallHandles('database', {
    limit: 10,
    handleTypes: ['mongodb']
  });

  console.log(`Found ${mongoHandles.length} MongoDB handles:`);
  for (const item of mongoHandles) {
    console.log(`  - ${item.handleURI} (${item.similarity.toFixed(3)})`);
  }

  // Cleanup
  console.log('\n\nCleaning up indexed handles...');
  for (const uri of handles) {
    await semanticSearch.removeHandle(uri);
  }
  console.log('✓ Cleanup complete');

  console.log('\n=== Recall Example Complete ===');
}

// Run the example
main().catch(console.error);