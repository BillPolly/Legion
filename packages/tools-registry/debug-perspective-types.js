import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { PerspectiveTypesCollectionSchema } from './src/database/schemas/ToolRegistrySchemas.js';

async function debugPerspectiveTypes() {
  console.log('🔍 Debugging perspective_types collection initialization...\n');
  
  const rm = new ResourceManager();
  await rm.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
  
  // Check if collection exists
  const collections = await provider.databaseService.mongoProvider.db.collections();
  const perspectiveTypesExists = collections.some(col => col.collectionName === 'perspective_types');
  console.log('Collection exists:', perspectiveTypesExists);
  
  if (perspectiveTypesExists) {
    // Check count
    const count = await provider.databaseService.mongoProvider.count('perspective_types', {});
    console.log('Document count:', count);
    
    // Check validation
    const collectionInfo = await provider.databaseService.mongoProvider.db.collection('perspective_types').options();
    console.log('Collection options:', JSON.stringify(collectionInfo, null, 2));
  }
  
  // Try to replicate the exact initialization process
  console.log('\n🔧 Simulating schema manager initialization...');
  try {
    // First drop the collection to force recreation
    await provider.databaseService.mongoProvider.db.collection('perspective_types').drop();
    console.log('Collection dropped');
  } catch (error) {
    console.log('Drop failed (collection may not exist):', error.message);
  }
  
  try {
    await provider.databaseService.mongoProvider.db.createCollection('perspective_types', {
      validator: PerspectiveTypesCollectionSchema.validator
    });
    console.log('✅ Collection created successfully after drop');
  } catch (error) {
    console.log('❌ Collection creation failed after drop:');
    console.log('  Error code:', error.code);
    console.log('  Error name:', error.name);  
    console.log('  Error message:', error.message);
    console.log('  Error codeName:', error.codeName);
    console.log('  Full error:', JSON.stringify(error, null, 2));
  }
  
  await provider.disconnect();
}

debugPerspectiveTypes().catch(console.error);