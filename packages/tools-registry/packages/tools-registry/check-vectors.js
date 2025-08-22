import { QdrantClient } from '@qdrant/js-client-rest';

async function checkVectors() {
  const client = new QdrantClient({ host: 'localhost', port: 6333 });
  
  try {
    // List all collections
    const collections = await client.getCollections();
    console.log('📋 Current collections:', collections.collections.map(c => ({ 
      name: c.name, 
      vectors_count: c.vectors_count 
    })));
    
    // Check each collection for vectors
    for (const collection of collections.collections) {
      try {
        const countResult = await client.count(collection.name);
        console.log(`🔢 ${collection.name}: ${countResult.count} vectors`);
        
        if (countResult.count > 0) {
          // Get sample vectors to see what's in there
          const sampleVectors = await client.scroll(collection.name, {
            limit: 5,
            with_payload: true
          });
          
          console.log(`📄 Sample vectors in ${collection.name}:`);
          for (const point of sampleVectors.points) {
            console.log(`  - ID: ${point.id}, Payload: ${JSON.stringify(point.payload)}`);
          }
        }
      } catch (error) {
        console.log(`❌ Error checking ${collection.name}: ${error.message}`);
      }
    }
    
    // Try to clear the legion_tools collection again
    try {
      await client.deleteCollection('legion_tools');
      console.log('✅ Deleted legion_tools collection');
    } catch (error) {
      console.log(`⚠️ Could not delete legion_tools: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkVectors().catch(console.error);