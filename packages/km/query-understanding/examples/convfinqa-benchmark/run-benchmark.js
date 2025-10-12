/**
 * ConvFinQA Benchmark Runner
 *
 * Evaluates QueryUnderstandingPipeline + ArithmeticExecutor on ConvFinQA dataset
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ResourceManager } from '@legion/resource-manager';
import { ConvFinQAOrchestrator } from './ConvFinQAOrchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load test subset from full dataset
 */
function loadTestSubset(datasetPath, startIndex = 0, count = 1) {
  console.log(`📖 Loading ConvFinQA dataset from: ${path.basename(datasetPath)}`);

  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  // Extract examples from startIndex
  const examples = data.train.slice(startIndex, startIndex + count);

  console.log(`   ✓ Loaded ${examples.length} example(s) (indices ${startIndex}-${startIndex + examples.length - 1} of ${data.train.length} total)\n`);

  return examples;
}

/**
 * Compare predicted answer with ground truth
 */
function compareAnswers(predicted, groundTruth) {
  if (predicted === null || predicted === undefined) {
    return false;
  }

  // Normalize both values
  const normPredicted = typeof predicted === 'number' ? predicted : parseFloat(predicted);
  const normGroundTruth = typeof groundTruth === 'number' ? groundTruth : parseFloat(groundTruth);

  // Handle percentage strings like "14.1%"
  if (typeof groundTruth === 'string' && groundTruth.includes('%')) {
    const gtPercent = parseFloat(groundTruth.replace('%', ''));
    // Our executor returns percentages as numbers (14.1)
    const predPercent = normPredicted;
    // Allow 1% absolute tolerance (14.1 vs 14.136 is acceptable)
    return Math.abs(predPercent - gtPercent) < 1.0;
  }

  // Numeric comparison with tolerance
  if (!isNaN(normPredicted) && !isNaN(normGroundTruth)) {
    const tolerance = Math.abs(normGroundTruth * 0.001); // 0.1% tolerance
    return Math.abs(normPredicted - normGroundTruth) <= tolerance;
  }

  // String comparison
  return String(predicted) === String(groundTruth);
}

/**
 * Evaluate a single example
 */
async function evaluateExample(orchestrator, example) {
  const { id, doc, dialogue } = example;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Example: ${id}`);
  console.log(`${'='.repeat(80)}`);

  // Initialize with document (pass example ID for unique ontology)
  await orchestrator.initialize(doc, id);

  const results = [];
  let correctCount = 0;

  // Process each turn
  for (let i = 0; i < dialogue.conv_questions.length; i++) {
    const question = dialogue.conv_questions[i];
    const groundTruth = dialogue.conv_answers[i];

    console.log(`\n🔵 Turn ${i + 1}: ${question}`);

    const result = await orchestrator.processQuestion(question);

    const isCorrect = compareAnswers(result.answer, groundTruth);

    if (isCorrect) {
      correctCount++;
    }

    results.push({
      turnNumber: i + 1,
      question,
      groundTruth,
      predicted: result.answer,
      correct: isCorrect,
      type: result.type,
      program: result.program || null
    });

    console.log(`   Ground Truth: ${groundTruth}`);
    console.log(`   Predicted:    ${result.answer}`);
    console.log(`   Result:       ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);

    if (result.program) {
      console.log(`   Program:      ${result.program}`);
    }
  }

  orchestrator.reset();

  return {
    id,
    correctCount,
    totalTurns: dialogue.conv_questions.length,
    accuracy: correctCount / dialogue.conv_questions.length,
    results
  };
}

/**
 * Run benchmark
 */
async function runBenchmark() {
  console.log('🚀 ConvFinQA Benchmark - Query Understanding + Arithmetic Reasoning\n');

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const startIndex = args[0] ? parseInt(args[0], 10) : 3; // Default to index 3 (next untested example)
  const count = args[1] ? parseInt(args[1], 10) : 1; // Default to 1 example at a time

  // Get ResourceManager
  const resourceManager = await ResourceManager.getInstance();

  // Create orchestrator
  const orchestrator = new ConvFinQAOrchestrator(resourceManager);

  // Load dataset
  const datasetPath = path.join(__dirname, '../../data/convfinqa_dataset.json');
  const examples = loadTestSubset(datasetPath, startIndex, count);

  // Evaluate each example
  const allResults = [];
  let totalCorrect = 0;
  let totalTurns = 0;

  for (const example of examples) {
    try {
      const result = await evaluateExample(orchestrator, example);
      allResults.push(result);

      totalCorrect += result.correctCount;
      totalTurns += result.totalTurns;
    } catch (error) {
      console.error(`\n❌ Error processing example ${example.id}:`, error.message);
      allResults.push({
        id: example.id,
        error: error.message,
        correctCount: 0,
        totalTurns: example.dialogue.conv_questions.length,
        accuracy: 0
      });
      totalTurns += example.dialogue.conv_questions.length;
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 BENCHMARK RESULTS');
  console.log(`${'='.repeat(80)}\n`);

  for (const result of allResults) {
    if (result.error) {
      console.log(`❌ ${result.id}: ERROR - ${result.error}`);
    } else {
      console.log(`${result.accuracy === 1 ? '✅' : '⚠️ '} ${result.id}: ${result.correctCount}/${result.totalTurns} correct (${(result.accuracy * 100).toFixed(1)}%)`);
    }
  }

  const overallAccuracy = totalTurns > 0 ? totalCorrect / totalTurns : 0;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Overall: ${totalCorrect}/${totalTurns} correct (${(overallAccuracy * 100).toFixed(1)}%)`);
  console.log(`${'='.repeat(80)}\n`);

  // Save results
  const resultsPath = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalExamples: examples.length,
    totalTurns,
    correctTurns: totalCorrect,
    accuracy: overallAccuracy,
    results: allResults
  }, null, 2));

  console.log(`✅ Results saved to: ${path.basename(resultsPath)}\n`);

  return {
    totalCorrect,
    totalTurns,
    accuracy: overallAccuracy
  };
}

// Run benchmark
runBenchmark().catch(err => {
  console.error('\n❌ Benchmark failed:', err);
  process.exit(1);
});
