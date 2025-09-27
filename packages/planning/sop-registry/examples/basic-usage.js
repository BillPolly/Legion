import SOPRegistry from '../src/index.js';

async function main() {
  console.log('=== SOP Registry Basic Usage Example ===\n');
  
  const sopRegistry = await SOPRegistry.getInstance();
  
  console.log('1. Get Statistics');
  const stats = await sopRegistry.getStatistics();
  console.log(`   Total SOPs: ${stats.sops.total}`);
  console.log(`   Total Perspectives: ${stats.perspectives.total}\n`);
  
  console.log('2. Search SOPs');
  const results = await sopRegistry.searchSOPs('booking train');
  console.log(`   Found ${results.length} SOPs for "booking train"`);
  results.slice(0, 3).forEach(r => {
    console.log(`   - ${r.sop.title} (score: ${r.score.toFixed(3)})`);
  });
  console.log('');
  
  console.log('3. Get SOP Details');
  if (results.length > 0) {
    const sop = results[0].sop;
    console.log(`   Title: ${sop.title}`);
    console.log(`   Intent: ${sop.intent}`);
    console.log(`   Steps (${sop.steps.length}):`);
    sop.steps.forEach((step, i) => {
      console.log(`     ${i+1}. ${step.gloss}`);
      if (step.suggestedTools) {
        console.log(`        Tools: ${step.suggestedTools.join(', ')}`);
      }
    });
    console.log('');
  }
  
  console.log('4. Search Steps');
  const stepResults = await sopRegistry.searchSteps('search');
  console.log(`   Found ${stepResults.length} steps matching "search"`);
  stepResults.slice(0, 3).forEach(r => {
    console.log(`   - ${r.sop.title}: Step ${r.stepIndex + 1} - ${r.step.gloss}`);
  });
  console.log('');
  
  console.log('5. Search by Tools');
  const toolResults = await sopRegistry.searchSOPsByTools(['train-search-api']);
  console.log(`   SOPs using train-search-api: ${toolResults.length}`);
  toolResults.forEach(r => {
    console.log(`   - ${r.title}`);
  });
  console.log('');
  
  console.log('6. Health Check');
  const health = await sopRegistry.healthCheck();
  console.log(`   System Healthy: ${health.healthy}`);
  console.log(`   Database Connected: ${health.database.connected}\n`);
  
  await sopRegistry.cleanup();
  
  console.log('=== Example Complete ===');
}

main().catch(console.error);