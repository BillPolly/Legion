#!/usr/bin/env node
/**
 * Example 5: Batch Evaluation
 *
 * This demonstrates processing multiple questions in batch and
 * aggregating results with performance metrics.
 *
 * Features:
 * - Batch question processing
 * - Accuracy and precision metrics
 * - Performance tracking
 * - Error handling for failed queries
 * - Result aggregation
 *
 * Run: node examples/05-batch-evaluation.js
 */

import { ProofOfThought } from '../src/index.js';
import { ResourceManager } from '@legion/resource-manager';
import { accuracyScore, precisionScore, recallScore, f1Score } from '../src/utils/evaluation-metrics.js';

// Sample dataset for batch evaluation
const EVALUATION_DATASET = [
  {
    id: 'q1',
    question: 'Is there a number greater than 5 and less than 10?',
    expectedAnswer: 'Yes'
  },
  {
    id: 'q2',
    question: 'Can a number be both even and odd?',
    expectedAnswer: 'No'
  },
  {
    id: 'q3',
    question: 'Is 100 greater than 50?',
    expectedAnswer: 'Yes'
  },
  {
    id: 'q4',
    question: 'Would a Democrat politician publicly denounce abortion?',
    expectedAnswer: 'No'
  },
  {
    id: 'q5',
    question: 'Is 7 a prime number?',
    expectedAnswer: 'Yes'
  },
  {
    id: 'q6',
    question: 'Can you divide by zero?',
    expectedAnswer: 'No'
  },
  {
    id: 'q7',
    question: 'Is the square root of 16 equal to 4?',
    expectedAnswer: 'Yes'
  },
  {
    id: 'q8',
    question: 'Is -5 greater than 0?',
    expectedAnswer: 'No'
  }
];

async function processQuestion(pot, questionData, index, total) {
  const startTime = Date.now();

  try {
    console.log(`\n[${index + 1}/${total}] Processing: ${questionData.question}`);

    const result = await pot.query(questionData.question);
    const duration = Date.now() - startTime;

    const success = true;
    const correct = result.answer === questionData.expectedAnswer;

    console.log(`  Answer: ${result.answer} | Expected: ${questionData.expectedAnswer} | ${correct ? '✅' : '❌'} | ${duration}ms`);

    return {
      id: questionData.id,
      question: questionData.question,
      answer: result.answer,
      expectedAnswer: questionData.expectedAnswer,
      correct,
      confidence: result.confidence,
      duration,
      success,
      error: null,
      proof: result.proof
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`  ERROR: ${error.message} | ${duration}ms`);

    return {
      id: questionData.id,
      question: questionData.question,
      answer: null,
      expectedAnswer: questionData.expectedAnswer,
      correct: false,
      confidence: 0,
      duration,
      success: false,
      error: error.message,
      proof: null
    };
  }
}

function calculateMetrics(results) {
  const predictions = results
    .filter(r => r.success)
    .map(r => r.answer === 'Yes' ? 1 : 0);

  const actuals = results
    .filter(r => r.success)
    .map(r => r.expectedAnswer === 'Yes' ? 1 : 0);

  const accuracy = results.filter(r => r.success).length > 0
    ? accuracyScore(actuals, predictions)
    : 0;

  const precision = precisionScore(actuals, predictions);
  const recall = recallScore(actuals, predictions);
  const f1 = f1Score(actuals, predictions);

  return { accuracy, precision, recall, f1 };
}

function printSummary(results) {
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(80));

  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const correct = results.filter(r => r.correct).length;
  const failed = results.filter(r => !r.success).length;

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
  const avgConfidence = results.filter(r => r.success)
    .reduce((sum, r) => sum + r.confidence, 0) / successful;

  const metrics = calculateMetrics(results);

  console.log('\nOverall Statistics:');
  console.log(`  Total Questions: ${total}`);
  console.log(`  Successful: ${successful} (${(successful / total * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${failed} (${(failed / total * 100).toFixed(1)}%)`);
  console.log(`  Correct: ${correct} (${(correct / total * 100).toFixed(1)}%)`);

  console.log('\nPerformance Metrics:');
  console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`  Precision: ${(metrics.precision * 100).toFixed(1)}%`);
  console.log(`  Recall: ${(metrics.recall * 100).toFixed(1)}%`);
  console.log(`  F1 Score: ${(metrics.f1 * 100).toFixed(1)}%`);

  console.log('\nTiming:');
  console.log(`  Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`  Total Time: ${(results.reduce((sum, r) => sum + r.duration, 0) / 1000).toFixed(1)}s`);

  if (successful > 0) {
    console.log('\nConfidence:');
    console.log(`  Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  }

  console.log('\nDetailed Results:');
  results.forEach((r, i) => {
    const status = r.success ? (r.correct ? '✅' : '❌') : '⚠️';
    const answerStr = r.success ? `${r.answer} (exp: ${r.expectedAnswer})` : 'ERROR';
    console.log(`  ${i + 1}. ${status} ${r.id}: ${answerStr} - ${r.duration}ms`);
    if (r.error) {
      console.log(`     Error: ${r.error}`);
    }
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('ProofOfThought - Batch Evaluation');
  console.log('='.repeat(80));
  console.log(`\nDataset: ${EVALUATION_DATASET.length} questions`);

  try {
    // Initialize
    console.log('\nInitializing ProofOfThought...');
    const resourceManager = await ResourceManager.getInstance();
    const llmClient = await resourceManager.get('llmClient');
    const pot = new ProofOfThought(llmClient);

    console.log('Starting batch evaluation...');

    // Process all questions
    const results = [];
    for (let i = 0; i < EVALUATION_DATASET.length; i++) {
      const result = await processQuestion(pot, EVALUATION_DATASET[i], i, EVALUATION_DATASET.length);
      results.push(result);
    }

    // Print summary
    printSummary(results);

    console.log('\n' + '='.repeat(80));
    console.log('EVALUATION COMPLETE');
    console.log('='.repeat(80));
    console.log('\nKey Takeaways:');
    console.log('  • Batch processing enables performance evaluation');
    console.log('  • Metrics track accuracy, precision, recall, F1');
    console.log('  • Error handling ensures robust evaluation');
    console.log('  • Performance tracking identifies bottlenecks');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR');
    console.error('='.repeat(80));
    console.error(`\n${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
