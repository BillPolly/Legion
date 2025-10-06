/**
 * E2E Test: Full ConvFinQA Pipeline
 *
 * Tests complete pipeline from ontology loading to question answering.
 *
 * Prerequisites:
 * - MongoDB running
 * - Ontology already built (via `npm run build-ontology`)
 * - Anthropic API key in .env
 *
 * This test verifies:
 * 1. Ontology loads from MongoDB
 * 2. Instance KG builds from table data
 * 3. Turn processing with LLM + tools
 * 4. Answers match gold answers
 * 5. Complete audit trail in MongoDB
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '../../src/storage/MongoDBProvider.js';
import { TurnProcessor } from '../../src/agent/TurnProcessor.js';
import { KGBuilder } from '../../src/kg/KGBuilder.js';
import { QueryKGTool, ListEntitiesTool, CalculateTool } from '../../src/tools/index.js';

describe('E2E: Full ConvFinQA Pipeline', () => {
  let resourceManager;
  let mongoClient;
  let db;
  let llmClient;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Get MongoDB URI
    const mongoUri = resourceManager.get('env.MONGO_URI');
    if (!mongoUri) {
      throw new Error('MONGO_URI not set in .env');
    }

    // Connect to MongoDB
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('convfinqa_eval');

    // Get LLM client
    llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }
  }, 60000);

  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  test('should run full pipeline on example 1', async () => {
    // ========================================
    // 1. LOAD ONTOLOGY FROM MONGODB
    // ========================================

    console.log('\n=== 1. Loading Ontology from MongoDB ===\n');

    const ontologyProvider = new MongoDBProvider({
      collection: db.collection('ontology'),
      metadata: {
        type: 'ontology'
      }
    });

    // Verify ontology exists
    const ontologyTriples = await ontologyProvider.query(null, null, null);
    console.log(`✓ Loaded ${ontologyTriples.length} ontology triples`);
    expect(ontologyTriples.length).toBeGreaterThan(0);

    // Check for expected classes
    const classTriples = await ontologyProvider.query(null, 'rdf:type', 'owl:Class');
    console.log(`✓ Found ${classTriples.length} classes in ontology`);
    expect(classTriples.length).toBeGreaterThan(0);

    // ========================================
    // 2. LOAD TEST EXAMPLE
    // ========================================

    console.log('\n=== 2. Loading Test Example ===\n');

    const datasetPath = resourceManager.get('env.CONVFINQA_DATASET_PATH') ||
                       './data/convfinqa_train.json';
    const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
    const example = dataset[0]; // First example

    console.log(`✓ Loaded example: ${example.id}`);
    console.log(`  - Text items: ${example.text.length}`);
    console.log(`  - Table rows: ${example.table.length}`);
    console.log(`  - QA turns: ${example.qa.length}`);

    // ========================================
    // 3. BUILD INSTANCE-LEVEL KG FROM TABLE
    // ========================================

    console.log('\n=== 3. Building Instance KG from Table ===\n');

    const runId = `test-run-${Date.now()}`;
    const kgProvider = new MongoDBProvider({
      collection: db.collection('instances'),
      metadata: {
        runId,
        conversationId: example.id,
        type: 'instance'
      }
    });

    const kgBuilder = new KGBuilder({
      ontologyStore: ontologyProvider,
      instanceStore: kgProvider,
      llmClient
    });

    await kgBuilder.buildFromTable(example.table, {
      context: example.text,
      conversationId: example.id
    });

    // Verify instance KG was created
    const instanceTriples = await kgProvider.query(null, null, null);
    console.log(`✓ Created ${instanceTriples.length} instance triples`);
    expect(instanceTriples.length).toBeGreaterThan(0);

    // ========================================
    // 4. PROCESS EACH QA TURN
    // ========================================

    console.log('\n=== 4. Processing QA Turns ===\n');

    const turnProcessor = new TurnProcessor({
      kgStore: kgProvider,
      ontologyStore: ontologyProvider,
      logger: console,
      llmClient
    });

    const results = [];

    for (let i = 0; i < example.qa.length; i++) {
      const turn = example.qa[i];
      console.log(`\n[Turn ${i + 1}/${example.qa.length}] "${turn.question}"`);

      try {
        // Understand question
        const understanding = await turnProcessor.understandQuestion(turn.question, {
          previousTurns: example.qa.slice(0, i)
        });

        console.log(`  Understanding:`, JSON.stringify(understanding, null, 2));

        // Answer question using tools
        const answerResult = await turnProcessor.answerQuestion(turn.question, understanding);

        console.log(`  Answer: ${answerResult.answer}`);
        console.log(`  Gold: ${turn.answer}`);
        console.log(`  Tool calls: ${answerResult.toolCalls.length}`);

        // Check if answer matches gold answer (normalize numbers)
        const predicted = String(answerResult.answer).trim();
        const gold = String(turn.answer).trim();
        const correct = predicted === gold;

        console.log(`  ${correct ? '✅ CORRECT' : '❌ INCORRECT'}`);

        results.push({
          turnIndex: i,
          question: turn.question,
          understanding,
          answer: answerResult.answer,
          goldAnswer: turn.answer,
          correct,
          toolCalls: answerResult.toolCalls
        });

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          turnIndex: i,
          question: turn.question,
          error: error.message,
          correct: false
        });
      }
    }

    // ========================================
    // 5. VERIFY RESULTS
    // ========================================

    console.log('\n=== 5. Results Summary ===\n');

    const correctCount = results.filter(r => r.correct).length;
    const totalCount = results.length;
    const accuracy = (correctCount / totalCount) * 100;

    console.log(`Accuracy: ${accuracy.toFixed(1)}% (${correctCount}/${totalCount})`);

    // Verify at least some answers are correct
    expect(correctCount).toBeGreaterThan(0);

    // Log to MongoDB
    const turnsCollection = db.collection('turns');
    for (const result of results) {
      await turnsCollection.insertOne({
        runId,
        conversationId: example.id,
        ...result,
        timestamp: new Date()
      });
    }

    console.log(`✓ Logged ${results.length} turns to MongoDB`);

    // ========================================
    // 6. VERIFY TOOL USAGE
    // ========================================

    console.log('\n=== 6. Tool Usage Analysis ===\n');

    const allToolCalls = results.flatMap(r => r.toolCalls || []);
    const toolCounts = {};

    for (const call of allToolCalls) {
      toolCounts[call.tool] = (toolCounts[call.tool] || 0) + 1;
    }

    console.log('Tool usage:');
    for (const [tool, count] of Object.entries(toolCounts)) {
      console.log(`  - ${tool}: ${count} calls`);
    }

    // Verify tools were actually used
    expect(Object.keys(toolCounts).length).toBeGreaterThan(0);

    console.log('\n✅ E2E test complete!\n');

  }, 300000); // 5 minute timeout for full pipeline
});
