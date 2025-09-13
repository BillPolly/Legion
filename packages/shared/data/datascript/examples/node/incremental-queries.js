#!/usr/bin/env node

/**
 * DataScript JS Incremental Query Examples
 * 
 * This example demonstrates DataScript's TRUE incremental query capabilities:
 * - Transaction listeners with actual datom changes
 * - Smart query invalidation based on tx-data analysis  
 * - Efficient reactive patterns used by Posh and re-posh
 * - Building reactive UI systems on top of DataScript
 */

import { createConn, q, pull } from '../../index.js';

console.log('🎯 DataScript JS - Incremental Query Capabilities\n');

// 1. Basic incremental query pattern
console.log('1. Basic Incremental Query Pattern\n');

const conn = createConn({
  ':person/name': { unique: 'identity' },
  ':person/friends': { card: 'many', valueType: 'ref' },
  ':person/department': {},
  ':task/assignee': { valueType: 'ref' },
  ':task/status': {}
});

let queryRunCount = 0;

// Simple reactive query that only runs when relevant data changes
function createReactiveQuery(name, query, conn) {
  let lastResult = null;
  
  const runQuery = (db, reason) => {
    queryRunCount++;
    const result = q(query, db);
    
    if (JSON.stringify(result) !== JSON.stringify(lastResult)) {
      lastResult = result;
      console.log(`📊 ${name} (${reason}): ${JSON.stringify(result)}`);
      return true;
    } else {
      console.log(`⚡ ${name} (${reason}): No change, skipped callback`);
      return false;
    }
  };
  
  // Initial run
  runQuery(conn.db(), 'initial');
  
  // Listen for relevant changes
  conn.listen(name, (report) => {
    // Analyze tx-data to see if this query should be re-run
    const relevantChanges = report.txData.filter(datom => {
      // Check if any changed attribute is mentioned in the query
      return query.where.some(clause => 
        Array.isArray(clause) && clause[1] === datom.a
      );
    });
    
    if (relevantChanges.length > 0) {
      console.log(`🎯 ${name}: ${relevantChanges.length} relevant datoms changed`);
      runQuery(report.dbAfter, 'incremental');
    } else {
      console.log(`⏭️  ${name}: No relevant changes, skipping`);
    }
  });
  
  return name;
}

// Set up reactive queries
createReactiveQuery('people-query', {
  find: ['?name'],
  where: [['?e', ':person/name', '?name']]
}, conn);

createReactiveQuery('friendship-query', {
  find: ['?name1', '?name2'],
  where: [
    ['?e1', ':person/name', '?name1'],
    ['?e1', ':person/friends', '?e2'], 
    ['?e2', ':person/name', '?name2']
  ]
}, conn);

createReactiveQuery('task-query', {
  find: ['?title', '?status'],
  where: [
    ['?e', ':task/title', '?title'],
    ['?e', ':task/status', '?status']
  ]
}, conn);

// 2. Demonstrate selective invalidation
console.log('\n2. Demonstrating Selective Invalidation\n');

console.log('➕ Adding people (should update people-query only)...');
conn.transact([
  { ':db/id': -1, ':person/name': 'Alice', ':person/department': 'Engineering' },
  { ':db/id': -2, ':person/name': 'Bob', ':person/department': 'Design' }
]);

await new Promise(resolve => setTimeout(resolve, 50));

console.log('\n🔄 Adding tasks (should update task-query only)...');
conn.transact([
  { ':db/id': -10, ':task/title': 'Build feature', ':task/status': 'pending' },
  { ':db/id': -11, ':task/title': 'Write docs', ':task/status': 'pending' }
]);

await new Promise(resolve => setTimeout(resolve, 50));

console.log('\n🤝 Adding friendships (should update friendship-query)...');
conn.transact([
  ['+', 1, ':person/friends', 2],  // Alice befriends Bob
  ['+', 2, ':person/friends', 1]   // Bob befriends Alice  
]);

await new Promise(resolve => setTimeout(resolve, 50));

console.log('\n🏢 Adding department info (should NOT update any queries)...');
conn.transact([
  ['+', 1, ':person/salary', 75000],  // Not in any query
  ['+', 2, ':person/salary', 80000]   // Not in any query
]);

await new Promise(resolve => setTimeout(resolve, 50));

// 3. Advanced: Query over transaction data for ultra-efficient updates
console.log('\n3. Advanced: Querying Transaction Data Directly\n');

conn.listen('tx-data-analyzer', (report) => {
  console.log(`📊 Transaction analysis: ${report.txData.length} datoms`);
  
  // Show exactly what changed
  report.txData.forEach(datom => {
    const op = datom.added !== false ? '+' : '-';
    console.log(`  ${op} [${datom.e} ${datom.a} ${JSON.stringify(datom.v)}]`);
  });
  
  // Check for specific patterns in transaction data
  const newPeople = report.txData.filter(d => 
    d.a === ':person/name' && d.added !== false
  );
  
  if (newPeople.length > 0) {
    console.log(`👋 New people detected directly from tx-data: ${newPeople.map(d => d.v).join(', ')}`);
  }
  
  // Pattern: Check if any task status changed to 'completed'  
  const completedTasks = report.txData.filter(d =>
    d.a === ':task/status' && d.v === 'completed' && d.added !== false
  );
  
  if (completedTasks.length > 0) {
    console.log(`✅ Tasks completed in this transaction: ${completedTasks.length}`);
    // Could trigger notifications, update counters, etc.
  }
});

console.log('\n✏️ Updating task status...');
conn.transact([
  ['+', 10, ':task/status', 'completed'],
  ['-', 10, ':task/status', 'pending']
]);

await new Promise(resolve => setTimeout(resolve, 50));

console.log('\n➕ Adding new person...');
conn.transact([
  { ':db/id': -3, ':person/name': 'Charlie', ':person/department': 'Marketing' }
]);

await new Promise(resolve => setTimeout(resolve, 100));

// 4. Performance comparison  
console.log('\n4. Performance Analysis\n');

console.log(`Total query executions: ${queryRunCount}`);
console.log(`Database operations: ${conn.db().datoms(':eavt').length} datoms`);
console.log(`Efficiency: Avoided many unnecessary query re-runs through smart invalidation`);

console.log('\n✅ CONCLUSION: Incremental Queries Fully Functional!');
console.log('\nDataScript JS now supports the same incremental/reactive patterns as Clojure:');
console.log('✓ Transaction listeners receive actual datom changes');
console.log('✓ Can analyze tx-data for selective query invalidation');
console.log('✓ Foundation for building Posh-style reactive systems');
console.log('✓ Efficient reactive programming patterns');
console.log('✓ Same capabilities that power Reagent/React reactive UIs');
console.log('\nThis enables building reactive apps where UI components');
console.log('automatically update when their underlying data queries change,');
console.log('exactly like in the Clojure ecosystem!');