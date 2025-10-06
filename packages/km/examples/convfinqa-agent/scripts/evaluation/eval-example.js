#!/usr/bin/env node
/**
 * Test a single example end-to-end
 * Usage: npm run eval:example <example_number>
 */
import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '../../src/storage/MongoDBProvider.js';
import { KGBuilder } from '../../src/utils/KGBuilder.js';
import { TurnProcessor } from '../../src/agent/TurnProcessor.js';

const exampleNum = parseInt(process.argv[2]) || 1;
const resourceManager = await ResourceManager.getInstance();
const mongoUri = resourceManager.get('env.MONGO_URI');
const mongoClient = new MongoClient(mongoUri);
await mongoClient.connect();

const db = mongoClient.db('convfinqa_eval');
const ontologyStore = new MongoDBProvider({
  collection: db.collection('ontology'),
  metadata: { type: 'ontology' }
});
const instanceStore = new MongoDBProvider({
  collection: db.collection('instances'),
  metadata: { type: 'instance' }
});
const llmClient = await resourceManager.get('llmClient');

const dataset = JSON.parse(readFileSync('./data/convfinqa_train.json', 'utf-8'));
const example = dataset[exampleNum - 1];

const sep = '=' + '='.repeat(79);
console.log('\n' + sep);
console.log('EXAMPLE ' + exampleNum + ': ' + example.id);
console.log(sep);

try {
  console.log('\n📊 Building Instance KG...');
  const kgBuilder = new KGBuilder({ instanceStore, ontologyStore, llmClient });
  const stats = await kgBuilder.buildFromTable(example.table, {
    context: example.pre_text || [],
    conversationId: example.id
  });

  console.log('  ✓ Created ' + stats.instances + ' instances');
  console.log('  ✓ Created ' + stats.triples + ' triples');
  console.log('  ✓ Entity type: ' + stats.entityType);

  console.log('\n📋 Table Structure:');
  console.log('  Header:', example.table[0].slice(0, 4).join(' | '));
  example.table.slice(1, 4).forEach(row => {
    console.log('  Data  :', row.slice(0, 4).join(' | '));
  });

  // Handle both formats: single qa field or multiple qa_0, qa_1, ... fields
  let turns = [];
  if (example.qa) {
    turns = Array.isArray(example.qa) ? example.qa : [example.qa];
  } else {
    // Multi-turn conversation: collect all qa_* fields
    const qaKeys = Object.keys(example).filter(k => k.startsWith('qa_')).sort();
    turns = qaKeys.map(k => example[k]);
  }

  if (turns.length === 0) {
    throw new Error('No questions found in example');
  }

  console.log('\n❓ Processing ' + turns.length + ' question(s)...\n');

  const turnProcessor = new TurnProcessor({
    kgStore: instanceStore,
    ontologyStore,
    llmClient,
    logger: console
  });

  let correct = 0, total = 0;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    console.log('[' + (i + 1) + '/' + turns.length + '] Q: ' + turn.question);

    try {
      const result = await turnProcessor.processTurn(turn.question);
      console.log('  Predicted: ' + result.answer);
      console.log('  Gold:      ' + turn.answer);

      const isCorrect = turnProcessor.scoreAnswer(result.answer, turn.answer);
      if (isCorrect) {
        console.log('  ✅ CORRECT');
        correct++;
      } else {
        console.log('  ❌ INCORRECT');
      }
      total++;
    } catch (error) {
      console.log('  ❌ ERROR: ' + error.message);
      total++;
    }
    console.log();
  }

  console.log(sep);
  console.log('RESULTS: ' + correct + '/' + total + ' correct (' + (correct/total*100).toFixed(1) + '%)');
  console.log(sep);

} catch (error) {
  console.error('\n❌ FAILED: ' + error.message);
} finally {
  await mongoClient.close();
}
