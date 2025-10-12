/**
 * CSQA Benchmark Runner - End-to-End Test
 *
 * Runs our multi-turn conversation system on CSQA benchmark data:
 * 1. Loads QA_100 conversation (coreference: "that person")
 * 2. Initializes MultiTurnPipeline with WikidataDataSource
 * 3. Processes each question turn-by-turn
 * 4. Compares answers to ground truth
 * 5. Reports metrics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ResourceManager } from '@legion/resource-manager';
import { MultiTurnPipeline } from '../../src/MultiTurnPipeline.js';
import { QueryUnderstandingPipeline } from '../../src/QueryUnderstandingPipeline.js';
import { WikidataDataSource } from './WikidataDataSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadConversation(conversationPath) {
  const fullPath = path.join(__dirname, conversationPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const turns = JSON.parse(content);

  // Extract just USER turns with their ground truth answers
  const questions = [];
  for (let i = 0; i < turns.length; i += 2) {
    const userTurn = turns[i];
    const systemTurn = turns[i + 1];

    if (userTurn.speaker === 'USER' && systemTurn.speaker === 'SYSTEM') {
      questions.push({
        question: userTurn.utterance,
        groundTruth: {
          answer: systemTurn.utterance,
          entities: systemTurn.entities_in_utterance || [],
          allEntities: systemTurn.all_entities || []
        },
        metadata: {
          questionType: userTurn['question-type'],
          entities: userTurn.entities_in_utterance || [],
          relations: userTurn.relations || []
        }
      });
    }
  }

  return questions;
}

function compareAnswers(predicted, groundTruth) {
  // Extract Q-numbers from predicted results
  const predictedIds = new Set();
  if (predicted.results && Array.isArray(predicted.results)) {
    for (const result of predicted.results) {
      if (result.canonical) predictedIds.add(result.canonical);
      if (result['?x']) predictedIds.add(result['?x']);
      if (result.x) predictedIds.add(result.x);
    }
  }

  // Extract Q-numbers from ground truth
  const groundTruthIds = new Set([
    ...groundTruth.entities,
    ...groundTruth.allEntities
  ]);

  // Calculate overlap
  const intersection = new Set([...predictedIds].filter(id => groundTruthIds.has(id)));
  const precision = predictedIds.size > 0 ? intersection.size / predictedIds.size : 0;
  const recall = groundTruthIds.size > 0 ? intersection.size / groundTruthIds.size : 0;
  const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return {
    correct: intersection.size > 0,
    precision,
    recall,
    f1,
    predicted: Array.from(predictedIds),
    groundTruth: Array.from(groundTruthIds),
    overlap: Array.from(intersection)
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('CSQA Benchmark Runner - QA_100 Conversation');
  console.log('='.repeat(80));

  // Load conversation
  console.log('\n📖 Loading conversation: QA_100/QA_0.json');
  const questions = loadConversation('data/QA_100/QA_0.json');
  console.log(`   ✓ Loaded ${questions.length} questions`);

  console.log('\n📋 Sample questions:');
  questions.slice(0, 3).forEach((q, i) => {
    console.log(`   ${i + 1}. ${q.question}`);
    console.log(`      Ground truth: ${q.groundTruth.answer} (${q.groundTruth.allEntities.join(', ')})`);
  });

  // Initialize ResourceManager
  console.log('\n🔧 Initializing system...');
  const resourceManager = await ResourceManager.getInstance();

  // Create WikidataDataSource
  const wikidataDataSource = new WikidataDataSource();
  console.log('   ✓ WikidataDataSource created');

  // Register WikidataDataSource in ResourceManager temporarily for this benchmark
  resourceManager.set('wikidataDataSource', wikidataDataSource);

  // Create dummy ontology for pipeline (not needed for CSQA benchmark)
  const dummyOntology = { classes: [], properties: [], individuals: [] };
  resourceManager.set('ontology', dummyOntology);

  // Create QueryUnderstandingPipeline
  const pipeline = new QueryUnderstandingPipeline(resourceManager);
  await pipeline.initialize({
    dataSource: 'wikidataDataSource',
    domain: 'wikidata',
    ontologyCollectionName: 'csqa-wikidata-ontology'
  });

  console.log('   ✓ QueryUnderstandingPipeline initialized');

  // Create MultiTurnPipeline
  const multiTurn = new MultiTurnPipeline(resourceManager, {
    maxTurns: 20,
    domain: 'wikidata',
    ontologyCollectionName: 'csqa-wikidata-ontology'
  });

  // Inject our pre-initialized pipeline
  multiTurn.pipeline = pipeline;

  // Initialize GraphContextRetriever manually since we're not calling multiTurn.initialize()
  const { GraphContextRetriever } = await import('../../src/context/GraphContextRetriever.js');
  multiTurn.graphContextRetriever = new GraphContextRetriever(wikidataDataSource, {
    defaultRadius: 1,
    maxEntities: 10
  });

  console.log('   ✓ MultiTurnPipeline initialized');

  // Run benchmark
  console.log('\n' + '='.repeat(80));
  console.log('RUNNING BENCHMARK');
  console.log('='.repeat(80));

  const results = {
    total: questions.length,
    correct: 0,
    errors: 0,
    metrics: [],
    details: []
  };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n[Turn ${i + 1}/${questions.length}]`);
    console.log(`Q: ${q.question}`);
    console.log(`Ground Truth: ${q.groundTruth.answer} (${q.groundTruth.allEntities.join(', ')})`);
    console.log(`Type: ${q.metadata.questionType}`);

    try {
      const startTime = Date.now();

      // Process question through multi-turn pipeline
      const result = await multiTurn.ask(q.question);

      const latency = Date.now() - startTime;

      // Compare with ground truth
      const comparison = compareAnswers(result, q.groundTruth);

      console.log(`Predicted: ${comparison.predicted.join(', ') || 'No results'}`);
      console.log(`Overlap: ${comparison.overlap.join(', ') || 'None'}`);
      console.log(`Metrics: P=${comparison.precision.toFixed(2)} R=${comparison.recall.toFixed(2)} F1=${comparison.f1.toFixed(2)}`);
      console.log(`Latency: ${latency}ms`);

      if (comparison.correct) {
        console.log('✅ CORRECT');
        results.correct++;
      } else {
        console.log('❌ INCORRECT');
      }

      results.metrics.push({
        precision: comparison.precision,
        recall: comparison.recall,
        f1: comparison.f1,
        latency
      });

      results.details.push({
        turnNumber: i + 1,
        question: q.question,
        correct: comparison.correct,
        comparison,
        latency
      });

    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.errors++;
      results.details.push({
        turnNumber: i + 1,
        question: q.question,
        error: error.message
      });
    }

    // Limit to first 3 questions for now
    if (i >= 2) {
      console.log('\n⏸️  Stopping after 3 questions for initial validation');
      break;
    }
  }

  // Calculate aggregate metrics
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(80));

  const avgPrecision = results.metrics.reduce((sum, m) => sum + m.precision, 0) / results.metrics.length;
  const avgRecall = results.metrics.reduce((sum, m) => sum + m.recall, 0) / results.metrics.length;
  const avgF1 = results.metrics.reduce((sum, m) => sum + m.f1, 0) / results.metrics.length;
  const avgLatency = results.metrics.reduce((sum, m) => sum + m.latency, 0) / results.metrics.length;

  console.log(`\n📊 Summary:`);
  console.log(`   Questions Processed: ${results.details.length}/${results.total}`);
  console.log(`   Correct: ${results.correct}`);
  console.log(`   Incorrect: ${results.details.length - results.correct - results.errors}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Accuracy: ${(results.correct / results.details.length * 100).toFixed(1)}%`);

  console.log(`\n📈 Metrics:`);
  console.log(`   Avg Precision: ${avgPrecision.toFixed(3)}`);
  console.log(`   Avg Recall: ${avgRecall.toFixed(3)}`);
  console.log(`   Avg F1: ${avgF1.toFixed(3)}`);
  console.log(`   Avg Latency: ${avgLatency.toFixed(0)}ms`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Benchmark Complete!');
  console.log('='.repeat(80));

  // Save results
  const outputPath = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('\n❌ Fatal Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
