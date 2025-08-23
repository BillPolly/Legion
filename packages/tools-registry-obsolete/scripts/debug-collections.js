import toolRegistry from '../src/index.js';

async function debugCollectionNames() {
  await toolRegistry.initialize();
  
  console.log('🔍 Checking collection names...');
  
  // Get loader and ensure it's fully initialized
  const loader = await toolRegistry.getLoader();
  await loader.initialize();
  
  // Force initialization of ToolIndexer with semantic search
  await loader.initializeSemanticSearch();
  
  // Access ToolIndexer from LoadingManager
  console.log('ToolIndexer collection name:', loader.toolIndexer?.collectionName);
  
  // Access SemanticDiscovery
  console.log('SemanticDiscovery collection name:', toolRegistry.semanticDiscovery?.collectionName);
  
  // Check if they are different
  const indexerCollection = loader.toolIndexer?.collectionName;
  const semanticCollection = toolRegistry.semanticDiscovery?.collectionName;
  
  if (indexerCollection !== semanticCollection) {
    console.log('❌ MISMATCH FOUND!');
    console.log('  ToolIndexer uses:', indexerCollection);
    console.log('  SemanticDiscovery uses:', semanticCollection);
  } else {
    console.log('✅ Collection names match:', indexerCollection);
  }
  
  await toolRegistry.cleanup();
}

debugCollectionNames().catch(console.error);