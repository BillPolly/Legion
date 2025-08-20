import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function debugEmbeddings() {
  console.log('🔍 Checking embeddings in MongoDB perspectives...\n');
  
  const rm = new ResourceManager();
  await rm.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
  
  // Get first few perspectives to check embedding format
  const perspectives = await provider.databaseService.mongoProvider.find('tool_perspectives', {}, { limit: 3 });
  console.log('Total perspectives:', perspectives.length);
  
  for (const [i, perspective] of perspectives.entries()) {
    console.log('\nPerspective ' + (i + 1) + ':');
    console.log('  ID:', perspective._id.toString());
    console.log('  Tool:', perspective.toolName);
    console.log('  Type:', perspective.perspectiveType);
    console.log('  Text length:', perspective.perspectiveText.length);
    console.log('  Has embedding:', Boolean(perspective.embedding));
    console.log('  Embedding type:', typeof perspective.embedding);
    console.log('  Embedding is array:', Array.isArray(perspective.embedding));
    if (perspective.embedding) {
      console.log('  Embedding length:', perspective.embedding.length);
      console.log('  First 3 values:', perspective.embedding.slice(0, 3));
      console.log('  Embedding model:', perspective.embeddingModel);
    }
  }
  
  await provider.disconnect();
}

debugEmbeddings().catch(console.error);