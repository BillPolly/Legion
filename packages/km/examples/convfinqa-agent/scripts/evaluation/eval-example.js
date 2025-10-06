#!/usr/bin/env node
/**
 * Evaluate Any Example
 *
 * Usage: node scripts/eval-example.js <example_index>
 * Example: node scripts/eval-example.js 0
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '../src/storage/MongoDBProvider.js';
import { TurnProcessor } from '../src/agent/TurnProcessor.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyIndexer } from '@legion/ontology/src/services/OntologyIndexer.js';

// Simple logger
const logger = {
  debug: () => {},
  info: (msg, data) => console.log(`INFO: ${msg}`, data ? JSON.stringify(data).slice(0, 100) : ''),
  error: (msg, data) => console.error(`ERROR: ${msg}`, data)
};

async function main() {
  const exampleIndex = parseInt(process.argv[2]) || 0;

  console.log(`\n=== Full Evaluation: Example ${exampleIndex} ===\n`);

  // Get configuration
  const resourceManager = await ResourceManager.getInstance();
  const mongoUri = resourceManager.get('env.MONGO_URI');
  const llmClient = await resourceManager.get('llmClient');

  if (!llmClient) {
    console.error('❌ No LLM client available');
    process.exit(1);
  }

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('✓ Connected\n');

  try {
    const db = mongoClient.db('convfinqa_eval');

    // Check if this example has a known dataset issue (example-level, not turn-specific)
    const datasetIssue = await db.collection('dataset_issues').findOne({
      exampleIndex,
      turnIndex: { $exists: false } // Only example-level issues
    });
    if (datasetIssue) {
      console.log('⚠️  SKIPPING: Known dataset issue\n');
      console.log(`Issue: ${datasetIssue.description}\n`);
      console.log('This example is excluded from evaluation metrics.');
      console.log('To remove this marking: node scripts/mark-dataset-issue.js remove', exampleIndex);
      process.exit(0);
    }

    // Step 1: Load Ontology
    console.log('=== Step 1: Load Ontology ===');
    const ontologyProvider = new MongoDBProvider({
      collection: db.collection('ontology'),
      metadata: { type: 'ontology' }
    });

    const ontologyTriples = await ontologyProvider.query(null, null, null);
    console.log(`✓ Loaded ${ontologyTriples.length} ontology triples\n`);

    // Step 2: Load Example
    console.log('=== Step 2: Load Example ===');
    const datasetPath = './data/convfinqa_train.json';
    const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

    if (exampleIndex >= dataset.length) {
      console.error(`❌ Example index ${exampleIndex} is out of range (dataset has ${dataset.length} examples)`);
      process.exit(1);
    }

    const example = dataset[exampleIndex];

    // Determine if this is turn-level or conversation-level
    const isTurnLevel = !!example.qa;
    const isConversationLevel = !!example.qa_0;

    if (!isTurnLevel && !isConversationLevel) {
      console.error(`❌ Example ${exampleIndex} has no qa or qa_0 field`);
      process.exit(1);
    }

    console.log(`Example ${exampleIndex}: ${example.filename}`);
    console.log(`Table: ${example.table.length} rows x ${example.table[0]?.length || 0} cols`);
    console.log(`Type: ${isTurnLevel ? 'Turn-level (single question)' : 'Conversation-level (multi-turn)'}\n`);

    // Step 3: Load Pre-built Example Background KG
    console.log('=== Step 3: Load Example Background KG ===');
    const exampleKGProvider = new MongoDBProvider({
      collection: db.collection('example_kgs'),
      metadata: {
        type: 'example_kg',
        exampleId: example.filename
      }
    });

    const kgTriples = await exampleKGProvider.query(null, null, null);

    if (kgTriples.length === 0) {
      console.error(`❌ No background KG found for example: ${example.filename}`);
      console.error(`Run: node scripts/test-semantic-kg-builder.js ${exampleIndex}`);
      process.exit(1);
    }

    console.log(`✓ Loaded ${kgTriples.length} triples from example KG\n`);

    // Step 4: Answer Question with 3-Phase Pipeline
    console.log('=== Step 4: Answer Question with 3-Phase Pipeline ===\n');

    // Create semantic search provider
    const searchProvider = await SemanticSearchProvider.create(resourceManager);

    // Create ontology indexer
    const ontologyIndexer = new OntologyIndexer(ontologyProvider, searchProvider);

    // Create collections for logging
    const promptLogCollection = db.collection('prompt_logs');
    const phaseResultsCollection = db.collection('phase_results');
    const evaluationResultsCollection = db.collection('evaluation_results');

    const turnProcessor = new TurnProcessor({
      kgStore: exampleKGProvider,
      ontologyStore: ontologyProvider,
      logger,
      llmClient,
      ontologyIndexer,
      promptLogCollection,
      phaseResultsCollection
    });

    // Set example ID for caching
    turnProcessor.setExampleId(example.filename);

    // Get all turns
    const turns = [];
    if (isTurnLevel) {
      turns.push(example.qa);
    } else {
      let turnIdx = 0;
      while (example[`qa_${turnIdx}`]) {
        turns.push(example[`qa_${turnIdx}`]);
        turnIdx++;
      }
    }

    console.log(`Total turns: ${turns.length}\n`);

    let totalCorrect = 0;
    let totalEvaluated = 0;
    let totalSkipped = 0;
    let totalQueries = 0;
    const totalStart = Date.now();

    // Process each turn
    for (let turnIdx = 0; turnIdx < turns.length; turnIdx++) {
      const turn = turns[turnIdx];

      console.log(`${'='.repeat(80)}`);
      console.log(`Turn ${turnIdx + 1}/${turns.length}`);
      console.log(`${'='.repeat(80)}\n`);
      console.log(`Question: "${turn.question}"`);
      console.log(`Gold Answer: ${turn.answer}\n`);

      // Check if this specific turn has a known dataset issue
      const turnIssue = await db.collection('dataset_issues').findOne({
        exampleIndex,
        turnIndex: turnIdx
      });
      if (turnIssue) {
        console.log('⚠️  SKIPPING TURN: Known dataset issue');
        console.log(`Issue: ${turnIssue.description}\n`);
        console.log('This turn is excluded from evaluation metrics.\n');
        totalSkipped++;
        continue; // Skip this turn, continue with others
      }

      const startTime = Date.now();

      // Phase 1: Semantic Understanding
      console.log('--- Phase 1: Semantic Understanding ---');
      const semanticUnderstanding = await turnProcessor.semanticUnderstanding(
        turn.question,
        example.filename
      );
      console.log(semanticUnderstanding);
      console.log('');

      // Phase 2: Iterative Data Retrieval
      console.log('--- Phase 2: Iterative Data Retrieval ---');
      const dataContext = await turnProcessor.iterativeDataRetrieval(
        turn.question,
        semanticUnderstanding,
        example.filename
      );
      console.log('Retrieved Data:');
      for (const data of dataContext.retrievedData) {
        let text = `  - ${data.label}: `;
        if (data.rawValue !== undefined && data.rawValue !== data.value) {
          text += `raw=${data.rawValueString || data.rawValue}, canonical=${data.value}`;
        } else {
          text += data.value;
        }
        text += (data.year ? ` (year: ${data.year})` : '') + (data.category ? ` (category: ${data.category})` : '');
        if (data.unit) text += ` [unit: ${data.unit}]`;
        console.log(text);
      }
      console.log('');

      // Phase 3: Calculation
      console.log('--- Phase 3: Calculation ---');
      const answer = await turnProcessor.calculateAnswer(
        turn.question,
        semanticUnderstanding,
        dataContext,
        example.filename
      );

      const durationMs = Date.now() - startTime;

      // Evaluate turn
      console.log(`\n--- Turn ${turnIdx + 1} Results ---\n`);
      console.log('Agent Answer:', answer);
      console.log('Gold Answer:', turn.answer);

      // Score externally (agent never saw this!)
      const correct = turnProcessor.scoreAnswer(answer, turn.answer);
      console.log('Correct:', correct ? '✅' : '❌');

      // Store evaluation result in database
      await evaluationResultsCollection.insertOne({
        exampleId: example.filename,
        turnIndex: turnIdx,
        question: turn.question,
        goldAnswer: turn.answer,
        goldProgram: turn.program,
        agentAnswer: answer,
        correct,
        semanticUnderstanding: semanticUnderstanding.slice(0, 500), // Truncate for storage
        retrievedData: dataContext.retrievedData,
        numQueries: dataContext.queries.length,
        queries: dataContext.queries,
        durationMs,
        timestamp: new Date()
      });

      if (correct) totalCorrect++;
      totalEvaluated++;
      totalQueries += dataContext.queries.length;

      console.log('\nQueries:', dataContext.queries.length);
      for (const query of dataContext.queries) {
        console.log(`  ${query.iteration}. ${query.tool}(${JSON.stringify(query.input).slice(0, 80)})`);
        console.log(`     → ${query.output.success ? '✅' : '❌'} ${JSON.stringify(query.output).slice(0, 80)}`);
      }

      console.log(`\nDuration: ${durationMs} ms\n`);
    }

    const totalDuration = Date.now() - totalStart;

    // Summary
    console.log('='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));
    console.log(`Total Turns: ${turns.length}`);
    if (totalSkipped > 0) {
      console.log(`  Evaluated: ${totalEvaluated}`);
      console.log(`  Skipped (dataset issues): ${totalSkipped}`);
    }
    console.log(`Correct: ${totalCorrect}/${totalEvaluated} (${totalEvaluated > 0 ? (totalCorrect / totalEvaluated * 100).toFixed(1) : 0}%)`);
    console.log(`Total Queries: ${totalQueries}`);
    console.log(`Total Duration: ${totalDuration} ms`);
    console.log();

    console.log('=== Evaluation Complete ===\n');
    if (totalEvaluated === 0) {
      console.log('⚠️  No turns evaluated (all skipped due to dataset issues)');
    } else {
      console.log(totalCorrect === totalEvaluated ? '✅ ALL PASS' : `❌ ${totalEvaluated - totalCorrect} FAILED`);
    }
    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
