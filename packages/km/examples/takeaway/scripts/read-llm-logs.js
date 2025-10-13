#!/usr/bin/env node
/**
 * Read LLM interaction logs from MongoDB for debugging
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'legion_tools';

async function readLogs(exampleId, turn = null, stage = null) {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('llm_interactions');

    // Build query
    const query = {};
    if (exampleId) {
      query['metadata.example_id'] = exampleId.toString();
    }
    if (turn !== null) {
      query['metadata.turn'] = parseInt(turn);
    }
    if (stage) {
      query['metadata.stage'] = stage;
    }

    console.log('Query:', JSON.stringify(query, null, 2));
    console.log('='.repeat(80));

    const logs = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();

    console.log(`\nFound ${logs.length} log entries\n`);

    for (const log of logs) {
      console.log('='.repeat(80));
      console.log(`Stage: ${log.metadata?.stage || 'unknown'}`);
      console.log(`Example: ${log.metadata?.example_id}, Turn: ${log.metadata?.turn}`);
      console.log(`Constraint: ${log.metadata?.constraint_index}`);
      console.log(`Timestamp: ${log.timestamp}`);
      console.log('='.repeat(80));

      console.log('\n--- PROMPT ---');
      console.log(log.prompt);

      console.log('\n--- RESPONSE ---');
      console.log(log.response);
      console.log('\n');
    }

  } finally {
    await client.close();
  }
}

// Parse command line args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/read-llm-logs.js <example_id> [turn] [stage]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/read-llm-logs.js 112');
  console.log('  node scripts/read-llm-logs.js 112 4');
  console.log('  node scripts/read-llm-logs.js 112 4 query_generation');
  console.log('  node scripts/read-llm-logs.js 112 4 semantic_understanding');
  process.exit(1);
}

const [exampleId, turn, stage] = args;

readLogs(exampleId, turn, stage).catch(console.error);
