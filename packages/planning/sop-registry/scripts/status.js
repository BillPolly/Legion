#!/usr/bin/env node

import SOPRegistry from '../src/index.js';

const verbose = process.argv.includes('--verbose');

async function showStatus() {
  try {
    const sopRegistry = await SOPRegistry.getInstance();
    
    const stats = await sopRegistry.getStatistics();
    const health = await sopRegistry.healthCheck();
    
    console.log('\n📊 SOP Registry Status\n');
    
    console.log('Database:');
    console.log(`  MongoDB: ${health.database.connected ? '✅ Connected' : '❌ Disconnected'}`);
    
    console.log('\nSOPs:');
    console.log(`  Total: ${stats.sops.total}`);
    
    console.log('\nPerspectives:');
    console.log(`  Total: ${stats.perspectives.total}`);
    console.log(`  Types: ${stats.perspectives.perspectiveTypes}`);
    
    console.log('\nSystem Health:');
    console.log(`  Overall: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`  Perspectives: ${health.perspectives.initialized ? '✅ Ready' : '❌ Not Ready'}`);
    console.log(`  Search: ${health.search.initialized ? '✅ Ready' : '❌ Not Ready'}`);
    
    if (verbose) {
      console.log('\nSOPs by Tag:');
      const sops = await sopRegistry.listSOPs();
      const tagCounts = {};
      sops.forEach(sop => {
        sop.tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      Object.entries(tagCounts).forEach(([tag, count]) => {
        console.log(`  ${tag}: ${count}`);
      });
      
      console.log('\nSample SOPs:');
      sops.slice(0, 5).forEach(sop => {
        console.log(`  • ${sop.title} (${sop.steps.length} steps)`);
      });
      
      const perspectives = await sopRegistry.sopStorage.findSOPPerspectives();
      const embeddedCount = perspectives.filter(p => p.embedding && p.embedding.length === 768).length;
      
      console.log('\nEmbedding Coverage:');
      console.log(`  With embeddings: ${embeddedCount}/${perspectives.length}`);
      console.log(`  Coverage: ${perspectives.length > 0 ? (embeddedCount / perspectives.length * 100).toFixed(1) : 0}%`);
    }
    
    console.log('');
    
    await sopRegistry.cleanup();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

showStatus();