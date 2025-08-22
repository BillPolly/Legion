import { QdrantClient } from '@qdrant/js-client-rest';

async function clearAllCollections() {
  console.log('🔍 Clearing all test-related Qdrant collections...');
  
  const client = new QdrantClient({ host: 'localhost', port: 6333 });
  
  try {
    // List all collections first
    const collections = await client.getCollections();
    console.log('📋 Found collections:', collections.collections.map(c => c.name));
    
    // Collections to clear (test-related and tools-related)
    const collectionsToDelete = [
      'legion_tools',
      'tool_perspectives', 
      'workflow-tasks',
      'test-uuid-collection',
      'test-debug',
      'task_search_glosses_vectors',
      'integration_test_glosses_vectors',
      'test-collection'
    ];
    
    let deletedCount = 0;
    for (const collectionName of collectionsToDelete) {
      try {
        await client.deleteCollection(collectionName);
        console.log(`✅ Deleted: ${collectionName}`);
        deletedCount++;
      } catch (deleteError) {
        if (!deleteError.message.includes('Not found')) {
          console.log(`⚠️ Could not delete ${collectionName}: ${deleteError.message}`);
        } else {
          console.log(`ℹ️ ${collectionName} does not exist (already cleared)`);
        }
      }
    }
    
    console.log(`\n🎯 Summary: Deleted ${deletedCount} collections`);
    
    // List remaining collections
    const remainingCollections = await client.getCollections();
    console.log('📋 Remaining collections:', remainingCollections.collections.map(c => c.name));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearAllCollections().catch(console.error);