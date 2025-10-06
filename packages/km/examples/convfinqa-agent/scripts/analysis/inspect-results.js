#!/usr/bin/env node
/**
 * Inspect Results Script
 *
 * Inspects evaluation results stored in MongoDB.
 * Shows run summaries, failed turns, and detailed turn reasoning.
 *
 * Usage:
 *   npm run inspect
 *   npm run inspect -- --run-id run_2025-01-05T14-30-22-123Z
 *   node scripts/inspect-results.js --run-id <runId> --show-failed
 */

import { MongoClient } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    runId: null,
    showFailed: false,
    showKG: false,
    exampleId: null,
    turnIndex: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && i + 1 < args.length) {
      options.runId = args[i + 1];
      i++;
    } else if (args[i] === '--show-failed') {
      options.showFailed = true;
    } else if (args[i] === '--show-kg') {
      options.showKG = true;
    } else if (args[i] === '--example-id' && i + 1 < args.length) {
      options.exampleId = args[i + 1];
      i++;
    } else if (args[i] === '--turn-index' && i + 1 < args.length) {
      options.turnIndex = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('\n=== ConvFinQA Evaluation Inspector ===\n');

  // Get configuration
  const resourceManager = await ResourceManager.getInstance();
  const mongoUri = resourceManager.get('env.MONGO_URI');

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('✓ Connected\n');

  try {
    const db = mongoClient.db('convfinqa_eval');

    // Get run ID (latest if not specified)
    let runId = options.runId;

    if (!runId) {
      console.log('Finding latest run...');
      const latestRun = await db.collection('evaluation_runs')
        .findOne({}, { sort: { startedAt: -1 } });

      if (!latestRun) {
        console.log('No evaluation runs found.');
        console.log('Run an evaluation first: npm run eval');
        process.exit(0);
      }

      runId = latestRun.runId;
      console.log(`Using latest run: ${runId}\n`);
    }

    // Get run details
    const run = await db.collection('evaluation_runs').findOne({ runId });

    if (!run) {
      console.error(`Run not found: ${runId}`);
      process.exit(1);
    }

    // Display run summary
    console.log('=== Run Summary ===\n');
    console.log(`Run ID: ${run.runId}`);
    console.log(`Status: ${run.status}`);
    console.log(`Started: ${run.startedAt.toISOString()}`);
    if (run.completedAt) {
      console.log(`Completed: ${run.completedAt.toISOString()}`);
      const duration = (run.completedAt - run.startedAt) / 1000;
      console.log(`Duration: ${duration.toFixed(1)}s`);
    }
    console.log('\nConfiguration:');
    console.log(JSON.stringify(run.config, null, 2));

    if (run.results) {
      console.log('\nResults:');
      console.log(`  Total examples: ${run.results.totalExamples}`);
      console.log(`  Successful: ${run.results.successfulExamples}`);
      console.log(`  Failed: ${run.results.failedExamples}`);
      console.log(`  Total turns: ${run.results.totalTurns}`);
      console.log(`  Correct answers: ${run.results.correctAnswers}`);
      console.log(`  Overall accuracy: ${(run.results.accuracy * 100).toFixed(2)}%`);
      console.log(`  Avg accuracy: ${(run.results.avgAccuracy * 100).toFixed(2)}%`);
      console.log(`  Avg turns/example: ${run.results.avgTurnsPerExample.toFixed(1)}`);
    }
    console.log();

    // Get examples
    const examples = await db.collection('examples')
      .find({ runId })
      .sort({ startedAt: 1 })
      .toArray();

    console.log(`=== Examples (${examples.length}) ===\n`);

    for (const example of examples) {
      const status = example.status === 'complete' ? '✓' : '✗';
      const acc = example.results?.accuracy !== undefined
        ? `${(example.results.accuracy * 100).toFixed(0)}%`
        : 'N/A';

      console.log(`${status} ${example.conversationId}: ${acc}`);

      if (example.results) {
        console.log(`   Correct: ${example.results.correctAnswers}/${example.results.totalTurns}`);
        if (example.results.failedTurns?.length > 0) {
          console.log(`   Failed turns: ${example.results.failedTurns.join(', ')}`);
        }
      }

      if (example.kgStats) {
        console.log(`   KG: ${example.kgStats.instances} instances (${example.kgStats.entityType}), ${example.kgStats.triples} triples`);
      }

      if (example.error) {
        console.log(`   Error: ${example.error}`);
      }

      console.log();
    }

    // Show failed turns if requested
    if (options.showFailed) {
      console.log('=== Failed Turns ===\n');

      const failedTurns = await db.collection('turns')
        .find({ runId, correct: false })
        .toArray();

      if (failedTurns.length === 0) {
        console.log('No failed turns! 🎉\n');
      } else {
        for (const turn of failedTurns) {
          console.log(`${turn.conversationId} - Turn ${turn.turnIndex}`);
          console.log(`Question: "${turn.question}"`);
          console.log(`Answer: ${turn.answer}`);
          console.log(`Gold: ${turn.goldAnswer}`);
          console.log('\nUnderstanding:');
          console.log(JSON.stringify(turn.understanding, null, 2));
          console.log('\nTool Calls:');
          for (const toolCall of turn.toolCalls) {
            console.log(`  ${toolCall.tool}:`);
            console.log(`    Input: ${JSON.stringify(toolCall.input)}`);
            console.log(`    Output: ${JSON.stringify(toolCall.output)}`);
          }
          console.log('\n---\n');
        }
      }
    }

    // Show specific turn if requested
    if (options.exampleId && options.turnIndex !== null) {
      console.log('=== Turn Details ===\n');

      const turn = await db.collection('turns').findOne({
        runId,
        conversationId: options.exampleId,
        turnIndex: options.turnIndex
      });

      if (!turn) {
        console.log(`Turn not found: ${options.exampleId}[${options.turnIndex}]`);
      } else {
        console.log(`Example: ${turn.conversationId}`);
        console.log(`Turn: ${turn.turnIndex}`);
        console.log(`Status: ${turn.status}`);
        console.log(`Correct: ${turn.correct ? '✓' : '✗'}\n`);

        console.log(`Question: "${turn.question}"`);
        console.log(`Answer: ${turn.answer}`);
        console.log(`Gold: ${turn.goldAnswer}\n`);

        console.log('Conversation History:');
        if (turn.conversationHistory.length === 0) {
          console.log('  (none)');
        } else {
          for (const [i, hist] of turn.conversationHistory.entries()) {
            console.log(`  ${i + 1}. Q: "${hist.question}" A: "${hist.answer}"`);
          }
        }
        console.log();

        console.log('Understanding:');
        console.log(JSON.stringify(turn.understanding, null, 2));
        console.log();

        console.log('Tool Calls:');
        for (const toolCall of turn.toolCalls) {
          console.log(`  ${toolCall.tool}:`);
          console.log(`    Input: ${JSON.stringify(toolCall.input, null, 2)}`);
          console.log(`    Output: ${JSON.stringify(toolCall.output, null, 2)}`);
          console.log();
        }

        console.log(`Duration: ${turn.durationMs}ms`);
      }
      console.log();
    }

    // Show KG if requested
    if (options.showKG && options.exampleId) {
      console.log('=== Knowledge Graph ===\n');

      const triples = await db.collection('instances')
        .find({ runId, conversationId: options.exampleId })
        .toArray();

      if (triples.length === 0) {
        console.log('No KG data found.');
      } else {
        console.log(`Found ${triples.length} triples:\n`);

        // Group by subject
        const bySubject = {};
        for (const triple of triples) {
          if (!bySubject[triple.s]) {
            bySubject[triple.s] = [];
          }
          bySubject[triple.s].push([triple.p, triple.o]);
        }

        for (const [subject, predicates] of Object.entries(bySubject)) {
          console.log(`${subject}`);
          for (const [p, o] of predicates) {
            console.log(`  ${p} → ${o}`);
          }
          console.log();
        }
      }
    }

    console.log('✓ Inspection complete!\n');

  } catch (error) {
    console.error('\n✗ Inspection error:');
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
