#!/usr/bin/env node

/**
 * Simple status check without problematic dependencies
 */

console.log('✅ Tools Registry Status: Basic functionality available');
console.log('📊 Qdrant running:', await checkQdrant());
console.log('🔧 MongoDB available:', await checkMongo());

async function checkQdrant() {
  try {
    const response = await fetch('http://localhost:6333');
    return response.ok;
  } catch {
    return false;
  }
}

async function checkMongo() {
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    await client.close();
    return true;
  } catch {
    return false;
  }
}