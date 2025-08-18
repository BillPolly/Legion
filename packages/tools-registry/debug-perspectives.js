import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

const rm = ResourceManager.getInstance();
await rm.initialize();

const provider = await MongoDBToolRegistryProvider.create(rm);
const perspectives = await provider.databaseService.mongoProvider.find('tool_perspectives', {}, { limit: 3 });

console.log('Sample perspectives:');
for (const p of perspectives) {
  console.log('Perspective:', {
    _id: p._id?.toString(),
    embeddingId: p.embeddingId,
    toolName: p.toolName,
    perspectiveType: p.perspectiveType,
    hasEmbedding: Boolean(p.embedding)
  });
}

await provider.disconnect();