import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function quickStatus() {
  console.log('📊 Quick Status Check\n');
  
  const rm = new ResourceManager();
  await rm.initialize();
  
  const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });
  
  try {
    // Get counts
    const moduleCount = await provider.databaseService.mongoProvider.count('modules', {});
    const toolCount = await provider.databaseService.mongoProvider.count('tools', {});
    const perspectiveCount = await provider.databaseService.mongoProvider.count('tool_perspectives', {});
    
    // Get Qdrant count
    const { QdrantVectorStore } = await import('../semantic-search/src/services/QdrantVectorStore.js');
    const vectorStore = new QdrantVectorStore({ url: 'http://127.0.0.1:6333' }, rm);
    
    let vectorCount = 0;
    try {
      await vectorStore.connect();
      vectorCount = await vectorStore.count('legion_tools');
    } catch (error) {
      console.log('⚠️ Qdrant connection failed:', error.message.substring(0, 50));
    }
    
    console.log('📋 Counts:');
    console.log(`   modules: ${moduleCount}`);
    console.log(`   tools: ${toolCount}`);
    console.log(`   perspectives: ${perspectiveCount}`);
    console.log(`   vectors: ${vectorCount}`);
    
    console.log('\n📈 Key Ratios:');
    console.log(`   perspectivesPerTool: ${(perspectiveCount / Math.max(toolCount, 1)).toFixed(2)}`);
    console.log(`   vectorsPerTool: ${(vectorCount / Math.max(toolCount, 1)).toFixed(2)}`);
    console.log(`   vectorsPerPerspective: ${(vectorCount / Math.max(perspectiveCount, 1)).toFixed(2)}`);
    
    // Check for issues
    const issues = [];
    if (perspectiveCount === 0 && toolCount > 0) {
      issues.push('No perspectives generated for existing tools');
    }
    if (vectorCount === 0 && perspectiveCount > 0) {
      issues.push(`Perspective/Vector mismatch: ${perspectiveCount} vs ${vectorCount}`);
    }
    if (Math.abs(perspectiveCount - vectorCount) > (perspectiveCount * 0.1) && perspectiveCount > 0) {
      issues.push(`Significant perspective/vector count difference: ${perspectiveCount} vs ${vectorCount}`);
    }
    
    if (issues.length === 0) {
      console.log('\n📊 Overall Status: ✅ ALL GOOD');
    } else {
      console.log('\n📊 Overall Status: ❌ ISSUES FOUND');
      console.log('\n❌ Issues:');
      issues.forEach(issue => console.log(`   • ${issue}`));
    }
    
  } finally {
    await provider.disconnect();
  }
}

quickStatus().catch(console.error);