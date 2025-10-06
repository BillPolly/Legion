#!/usr/bin/env node
/**
 * Run Evaluation Script
 *
 * Evaluates ConvFinQA agent on test examples using pre-built ontology.
 * Creates independent evaluation run with complete logging to MongoDB.
 *
 * Usage:
 *   npm run eval
 *   npm run eval -- --max-examples 10
 *   node scripts/run-evaluation.js --max-examples 10
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { ResourceManager } from '@legion/resource-manager';
import { LogStorage } from '../src/storage/LogStorage.js';
import { ExampleRunner } from '../src/runner/ExampleRunner.js';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    maxExamples: null,
    startIndex: 0
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-examples' && i + 1 < args.length) {
      options.maxExamples = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--start-index' && i + 1 < args.length) {
      options.startIndex = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return options;
}

/**
 * Create simple console logger
 */
function createLogger() {
  return {
    debug: (msg, data) => {
      // Suppress debug logs
    },
    info: (msg, data) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] INFO: ${msg}`, data ? JSON.stringify(data) : '');
    },
    error: (msg, data) => {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ERROR: ${msg}`, data ? JSON.stringify(data) : '');
    }
  };
}

async function main() {
  const options = parseArgs();

  console.log('\n=== ConvFinQA Agent Evaluation ===\n');

  // Get configuration
  const resourceManager = await ResourceManager.getInstance();
  const mongoUri = resourceManager.get('env.MONGO_URI');
  const datasetPath = resourceManager.get('env.CONVFINQA_TEST_PATH') ||
                     './data/convfinqa_test.json';

  // Get LLM client from ResourceManager
  const llmClient = await resourceManager.get('llmClient');
  const logger = createLogger();

  if (!llmClient) {
    console.error('Failed to get LLM client from ResourceManager');
    console.error('Make sure ANTHROPIC_API_KEY is set in .env');
    process.exit(1);
  }

  console.log(`MongoDB URI: ${mongoUri}`);
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Max examples: ${options.maxExamples || 'all'}`);
  console.log(`Start index: ${options.startIndex}\n`);

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('✓ Connected\n');

  try {
    // Load dataset
    console.log(`Loading dataset from ${datasetPath}...`);
    let dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

    // Apply filters
    if (options.startIndex > 0) {
      dataset = dataset.slice(options.startIndex);
    }
    if (options.maxExamples !== null) {
      dataset = dataset.slice(0, options.maxExamples);
    }

    console.log(`✓ Loaded ${dataset.length} examples\n`);

    // Create evaluation run
    const db = mongoClient.db('convfinqa_eval');
    const logStorage = new LogStorage(db);

    const runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const runConfig = {
      maxExamples: options.maxExamples,
      startIndex: options.startIndex,
      agentModel: llmClient.modelName || 'claude-3-5-sonnet-20241022',
      temperature: 0,
      datasetPath
    };

    console.log(`Creating evaluation run: ${runId}`);
    await logStorage.createRun({
      runId,
      startedAt: new Date(),
      status: 'in_progress',
      config: runConfig
    });
    console.log('✓ Run created\n');

    // Create example runner
    const exampleRunner = new ExampleRunner({
      runId,
      mongoClient,
      llmClient,
      logger
    });

    console.log('Initializing runner (loading ontology)...');
    await exampleRunner.initialize();
    console.log('✓ Initialized\n');

    // Run evaluation
    console.log('=== Starting Evaluation ===\n');

    const startTime = Date.now();
    const results = [];
    let totalTurns = 0;
    let totalCorrect = 0;

    for (let i = 0; i < dataset.length; i++) {
      const example = dataset[i];

      console.log(`\n[${i + 1}/${dataset.length}] Example: ${example.id}`);
      console.log(`  Table: ${example.table.length} rows x ${example.table[0]?.length || 0} cols`);
      console.log(`  Turns: ${example.qa.length}`);

      try {
        const exampleResult = await exampleRunner.runExample(example);

        results.push(exampleResult);
        totalTurns += exampleResult.results.totalTurns;
        totalCorrect += exampleResult.results.correctAnswers;

        console.log(`  ✓ Accuracy: ${(exampleResult.results.accuracy * 100).toFixed(1)}% (${exampleResult.results.correctAnswers}/${exampleResult.results.totalTurns})`);
        console.log(`  ✓ KG: ${exampleResult.kgStats.instances} instances, ${exampleResult.kgStats.triples} triples`);
        console.log(`  ✓ Duration: ${(exampleResult.durationMs / 1000).toFixed(1)}s`);

        if (exampleResult.results.failedTurns.length > 0) {
          console.log(`  ⚠ Failed turns: ${exampleResult.results.failedTurns.join(', ')}`);
        }

      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        results.push({
          exampleId: example.id,
          error: error.message
        });
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;

    // Calculate overall results
    const overallAccuracy = totalTurns > 0 ? totalCorrect / totalTurns : 0;
    const successfulExamples = results.filter(r => !r.error);
    const failedExamples = results.filter(r => r.error);

    console.log('\n=== Evaluation Complete ===\n');
    console.log(`Total time: ${totalTime.toFixed(1)}s`);
    console.log(`Examples: ${dataset.length}`);
    console.log(`  Successful: ${successfulExamples.length}`);
    console.log(`  Failed: ${failedExamples.length}`);
    console.log(`Total turns: ${totalTurns}`);
    console.log(`Correct answers: ${totalCorrect}`);
    console.log(`Overall accuracy: ${(overallAccuracy * 100).toFixed(2)}%\n`);

    // Update run with results
    await logStorage.updateRun({
      runId,
      status: 'complete',
      completedAt: new Date(),
      results: {
        totalExamples: dataset.length,
        successfulExamples: successfulExamples.length,
        failedExamples: failedExamples.length,
        totalTurns,
        correctAnswers: totalCorrect,
        accuracy: overallAccuracy,
        avgAccuracy: successfulExamples.length > 0
          ? successfulExamples.reduce((sum, r) => sum + r.results.accuracy, 0) / successfulExamples.length
          : 0,
        avgTurnsPerExample: dataset.length > 0 ? totalTurns / dataset.length : 0,
        totalDurationMs: Date.now() - startTime
      }
    });

    console.log('=== Results Summary ===\n');

    // Show example-level results
    console.log('Example Results:');
    for (const result of results) {
      if (result.error) {
        console.log(`  ✗ ${result.exampleId}: ERROR - ${result.error}`);
      } else {
        const acc = (result.results.accuracy * 100).toFixed(0);
        const status = result.results.accuracy === 1.0 ? '✓' : '⚠';
        console.log(`  ${status} ${result.exampleId}: ${acc}% (${result.results.correctAnswers}/${result.results.totalTurns})`);
      }
    }
    console.log();

    // Show failed turns
    const allFailedTurns = await logStorage.getFailedTurns(runId);
    if (allFailedTurns.length > 0) {
      console.log(`Failed Turns (${allFailedTurns.length}):`);
      for (const turn of allFailedTurns.slice(0, 5)) {
        console.log(`  ${turn.conversationId}[${turn.turnIndex}]: "${turn.question}"`);
        console.log(`    Answer: ${turn.answer} | Gold: ${turn.goldAnswer}`);
      }
      if (allFailedTurns.length > 5) {
        console.log(`  ... and ${allFailedTurns.length - 5} more`);
      }
      console.log();
    }

    console.log('✓ Evaluation complete!\n');
    console.log(`Run ID: ${runId}`);
    console.log(`Results stored in MongoDB: convfinqa_eval.evaluation_runs`);
    console.log(`\nInspect results: npm run inspect\n`);

  } catch (error) {
    console.error('\n✗ Evaluation error:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
