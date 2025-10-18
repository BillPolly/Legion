#!/usr/bin/env node

import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();

  const db = client.db('wordnet');
  const collection = db.collection('synsets');

  const total = await collection.countDocuments();
  const byPos = await collection.aggregate([
    { $group: { _id: '$pos', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  console.log('WordNet Database Stats:');
  console.log(`Total synsets: ${total}`);
  console.log('\nBy Part of Speech:');
  for (const item of byPos) {
    console.log(`  ${item._id}: ${item.count}`);
  }

  await client.close();
}

main();
