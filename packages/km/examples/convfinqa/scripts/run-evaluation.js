/**
 * Run ConvFinQA Evaluation
 *
 * Standalone script to evaluate the full ConvFinQA pipeline
 * using Legion ontology + KG approach.
 */

import { ConvFinQAEvaluator } from '../src/ConvFinQAEvaluator.js';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('ConvFinQA Evaluation - Legion Ontology + KG Approach');
  console.log('='.repeat(80));
  console.log();

  // Load dataset
  console.log('📂 Loading ConvFinQA dataset...');
  const dataPath = path.join(import.meta.dirname, '../data/first-10-conversations.json');
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`   Loaded ${dataset.length} conversation(s)\n`);

  // Initialize ResourceManager
  console.log('🔧 Initializing ResourceManager...');
  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');
  console.log('   ✓ ResourceManager initialized\n');

  // Process each conversation in the dataset
  const allResults = [];

  for (let i = 0; i < dataset.length; i++) {
    const dataEntry = dataset[i];
    const conversationId = dataEntry.id || `conversation-${i + 1}`;

    console.log('─'.repeat(80));
    console.log(`📊 Evaluating Conversation ${i + 1}/${dataset.length}: ${conversationId}`);
    console.log('─'.repeat(80));

    try {
      // Create fresh triple store and semantic search for each conversation
      const tripleStore = new SimpleTripleStore();
      const semanticSearch = await SemanticSearchProvider.create(resourceManager);

      // Create evaluator
      const evaluator = new ConvFinQAEvaluator({
        tripleStore,
        semanticSearch,
        llmClient
      });

      // Initialize ontology and KG
      console.log('   Building ontology + KG...');
      const initResult = await evaluator.initialize(dataEntry);
      console.log(`   ✓ Ontology: ${initResult.ontology.ontologyStats?.classes || 'N/A'} classes`);
      console.log(`   ✓ KG: ${initResult.instances.instancesCreated} instances created`);

      // Evaluate conversation
      console.log('   Evaluating conversation...');
      const results = await evaluator.evaluateConversation(dataEntry);

      // Store results
      allResults.push({
        conversationId,
        ...results
      });

      // Print summary
      console.log();
      console.log(evaluator.generateSummary(results));

    } catch (error) {
      console.error(`   ❌ Error evaluating conversation ${conversationId}:`, error.message);
      allResults.push({
        conversationId,
        error: error.message
      });
    }
  }

  // Print overall statistics
  console.log();
  console.log('='.repeat(80));
  console.log('OVERALL EVALUATION RESULTS');
  console.log('='.repeat(80));

  const successful = allResults.filter(r => !r.error);
  const failed = allResults.filter(r => r.error);

  console.log(`\nConversations Evaluated: ${dataset.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (successful.length > 0) {
    const totalQuestions = successful.reduce((sum, r) => sum + r.total, 0);
    const totalCorrect = successful.reduce((sum, r) => sum + r.correct, 0);
    const overallAccuracy = totalCorrect / totalQuestions;

    console.log(`\nTotal Questions: ${totalQuestions}`);
    console.log(`Correct Answers: ${totalCorrect}`);
    console.log(`Overall Accuracy: ${(overallAccuracy * 100).toFixed(2)}%`);

    // Per-conversation breakdown
    console.log('\nPer-Conversation Results:');
    for (const result of successful) {
      console.log(`  ${result.conversationId}: ${result.correct}/${result.total} (${(result.accuracy * 100).toFixed(1)}%)`);
    }
  }

  if (failed.length > 0) {
    console.log('\nFailed Conversations:');
    for (const result of failed) {
      console.log(`  ${result.conversationId}: ${result.error}`);
    }
  }

  // Save detailed results
  const outputPath = path.join(import.meta.dirname, '../evaluation-results-10.json');
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Detailed results saved to: ${path.basename(outputPath)}`);

  console.log();
  console.log('='.repeat(80));
  console.log('✅ Evaluation complete!');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
