#!/usr/bin/env node

/**
 * DataScript JS persistence examples
 * 
 * This example demonstrates:
 * - Serializing databases to files
 * - Loading databases from files  
 * - Database snapshots and backups
 * - Schema evolution
 * - Transaction logging
 */

import { promises as fs } from 'fs';
import { DB, createConn, saveDBToFile, loadDBFromFile } from '../../index.js';
import { existsSync } from 'fs';

console.log('💾 DataScript JS - Persistence Examples\n');

// Clean up any existing files
const testFiles = ['./simple-db.json', './backup-db.json', './evolved-db.json'];
for (const file of testFiles) {
  if (existsSync(file)) {
    await fs.unlink(file);
    console.log(`Cleaned up ${file}`);
  }
}

// 1. Basic persistence
console.log('1. Basic database persistence...');

const schema1 = {
  ':person/name': { unique: 'identity' },
  ':person/email': { unique: 'value' },
  ':person/age': { valueType: 'number' }
};

let conn1 = createConn(schema1);
const { dbAfter: db1 } = conn1.transact([
  { ':db/id': -1, ':person/name': 'Alice', ':person/email': 'alice@example.com', ':person/age': 30 },
  { ':db/id': -2, ':person/name': 'Bob', ':person/email': 'bob@example.com', ':person/age': 25 },
  { ':db/id': -3, ':person/name': 'Charlie', ':person/email': 'charlie@example.com', ':person/age': 35 }
]);

console.log(`Created database with ${db1.datoms(':eavt').length} datoms`);

// Save to file
await saveDBToFile(db1, './simple-db.json');
console.log('✓ Database saved to ./simple-db.json');

// Load from file
const loadedDB = await loadDBFromFile('./simple-db.json');
console.log(`✓ Database loaded: ${loadedDB.datoms(':eavt').length} datoms`);

// Verify data integrity
import { q } from '../../index.js';
const people = q({
  find: ['?name'],
  where: [['?e', ':person/name', '?name']]
}, loadedDB);

console.log(`Loaded people: ${people.map(([name]) => name).join(', ')}`);

// 2. Database snapshots and backups
console.log('\n2. Database snapshots and backups...');

// Add more data
const { dbAfter: db2 } = loadedDB.withTx([
  { ':db/id': -4, ':person/name': 'Diana', ':person/email': 'diana@example.com', ':person/age': 28 },
  { ':db/id': -5, ':person/name': 'Eve', ':person/email': 'eve@example.com', ':person/age': 32 }
]);

// Create timestamped backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = `./backup-${timestamp}.json`;

await saveDBToFile(db2, backupFile);
console.log(`✓ Backup created: ${backupFile}`);

// Also create a standard backup
await saveDBToFile(db2, './backup-db.json');
console.log(`✓ Standard backup: ./backup-db.json`);

// 3. Schema evolution
console.log('\n3. Schema evolution example...');

// Load the original database
const originalDB = await loadDBFromFile('./simple-db.json');

// Evolve schema - add new attributes
const schema2 = {
  ...schema1,
  ':person/department': {},
  ':person/skills': { card: 'many' },
  ':person/manager': { valueType: 'ref' }
};

// Create new connection with evolved schema
const conn2 = createConn(schema2);

// Migrate data: start with original data, then add new fields
const migrationTx = [
  // First, add all original data (database acts as source)
  ...originalDB.datoms(':eavt').map(d => ['+', d.e, d.a, d.v]),
  
  // Then add new schema-compliant data
  ['+', 1, ':person/department', 'Engineering'],
  ['+', 1, ':person/skills', 'JavaScript'],
  ['+', 1, ':person/skills', 'React'],
  
  ['+', 2, ':person/department', 'Marketing'],
  ['+', 2, ':person/skills', 'Design'],
  
  ['+', 3, ':person/department', 'Engineering'],
  ['+', 3, ':person/manager', 1],  // Charlie reports to Alice
  ['+', 3, ':person/skills', 'Python']
];

const { dbAfter: evolvedDB } = conn2.transact(migrationTx);
await saveDBToFile(evolvedDB, './evolved-db.json');

console.log(`✓ Schema evolved and saved. New DB has ${evolvedDB.datoms(':eavt').length} datoms`);

// Verify migration worked
const peopleWithDepts = q({
  find: ['?name', '?dept'],
  where: [
    ['?e', ':person/name', '?name'],
    ['?e', ':person/department', '?dept']
  ]
}, evolvedDB);

console.log('People with departments after migration:');
peopleWithDepts.forEach(([name, dept]) => {
  console.log(`  ${name}: ${dept}`);
});

// 4. Transaction logging and replay
console.log('\n4. Transaction logging and replay...');

class TransactionLogger {
  constructor(filePath) {
    this.filePath = filePath;
    this.transactions = [];
  }
  
  async log(tx) {
    const logEntry = {
      timestamp: Date.now(),
      transaction: tx
    };
    this.transactions.push(logEntry);
    
    // Append to file
    const line = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.filePath, line);
  }
  
  async replay(conn) {
    if (!existsSync(this.filePath)) {
      console.log('No transaction log found');
      return conn.db;
    }
    
    const content = await fs.readFile(this.filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    
    let currentDB = conn.db;
    
    for (const line of lines) {
      const entry = JSON.parse(line);
      const { db: newDB } = currentDB.withTx(entry.transaction);
      currentDB = newDB;
      console.log(`Replayed transaction from ${new Date(entry.timestamp).toLocaleString()}`);
    }
    
    return currentDB;
  }
}

// Create logger and simulate transactions
const logger = new TransactionLogger('./transactions.log');

// Clean up log file
if (existsSync('./transactions.log')) {
  await fs.unlink('./transactions.log');
}

let workingDB = DB.empty(schema1);

// Log a series of transactions
const transactions = [
  [{ ':db/id': -1, ':person/name': 'User1', ':person/age': 25 }],
  [{ ':db/id': -2, ':person/name': 'User2', ':person/age': 30 }],
  [['+', 1, ':person/email', 'user1@example.com']],
  [['+', 2, ':person/email', 'user2@example.com']],
  [['db/retractEntity', 2]]  // Remove User2
];

for (const tx of transactions) {
  await logger.log(tx);
  const { db: newDB } = workingDB.withTx(tx);
  workingDB = newDB;
  // Small delay to show different timestamps
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log(`Logged ${transactions.length} transactions`);

// Simulate crash and recovery
console.log('\nSimulating database recovery from transaction log...');
const freshConn = createConn(schema1);
const recoveredDB = await logger.replay(freshConn);

console.log(`✓ Recovered database has ${recoveredDB.datoms(':eavt').length} datoms`);

const recoveredUsers = q({
  find: ['?name', '?age'],
  where: [
    ['?e', ':person/name', '?name'],
    ['?e', ':person/age', '?age']
  ]
}, recoveredDB);

console.log('Recovered users:', recoveredUsers);

// 5. Performance benchmarks
console.log('\n5. Persistence performance benchmarks...');

// Create a larger dataset for benchmarking
console.log('Creating large dataset for benchmarking...');
const largeSchema = {
  ':user/id': { unique: 'identity' },
  ':user/name': {},
  ':user/email': {},
  ':user/created': {},
  ':user/tags': { card: 'many' }
};

const largeConn = createConn(largeSchema);

// Generate test data
const largeTx = [];
for (let i = 1; i <= 1000; i++) {
  largeTx.push({
    ':db/id': -i,
    ':user/id': `user-${i}`,
    ':user/name': `User ${i}`,
    ':user/email': `user${i}@example.com`,
    ':user/created': new Date(2024, 0, i % 365).toISOString(),
    ':user/tags': [`tag${i % 10}`, `category${i % 5}`]
  });
}

console.log('Transacting 1000 entities...');
const start = performance.now();
const { dbAfter: largeDB } = largeConn.transact(largeTx);
const txTime = performance.now() - start;

console.log(`✓ Transaction completed in ${txTime.toFixed(2)}ms`);
console.log(`Database size: ${largeDB.datoms(':eavt').length} datoms`);

// Benchmark save
console.log('Benchmarking save performance...');
const saveStart = performance.now();
await saveDBToFile(largeDB, './large-db.json');
const saveTime = performance.now() - saveStart;

// Check file size
const stats = await fs.stat('./large-db.json');
console.log(`✓ Saved in ${saveTime.toFixed(2)}ms, file size: ${(stats.size / 1024).toFixed(2)} KB`);

// Benchmark load
console.log('Benchmarking load performance...');
const loadStart = performance.now();
const reloadedDB = await loadDBFromFile('./large-db.json');
const loadTime = performance.now() - loadStart;

console.log(`✓ Loaded in ${loadTime.toFixed(2)}ms`);

// Verify integrity
const userCount = q({
  find: [['(count ?e)']],
  where: [['?e', ':user/id', '?id']]
}, reloadedDB)[0][0];

console.log(`✓ Verification: ${userCount} users in reloaded database`);

// Cleanup benchmark files
await fs.unlink('./large-db.json');
await fs.unlink('./transactions.log');
await fs.unlink(backupFile);

console.log('\n✅ Persistence examples completed!');
console.log('\nKey takeaways:');
console.log('- DataScript databases serialize/deserialize efficiently');
console.log('- Schema evolution is supported through migration transactions');
console.log('- Transaction logging enables crash recovery');
console.log('- Performance scales well with database size');
console.log('- File-based persistence is suitable for most applications');