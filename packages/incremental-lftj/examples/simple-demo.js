/**
 * Simple Demo of Incremental LFTJ Engine
 * Shows basic usage and incremental updates
 */

import { IncrementalLFTJ } from '../src/index.js';

console.log('🚀 Incremental LFTJ Engine Demo\n');

// Create engine
const engine = new IncrementalLFTJ({
  batchSize: 10,
  autoFlush: true
});

// Define a simple schema
engine.defineRelation('employees', {
  empId: 'ID',
  name: 'String',
  dept: 'String',
  salary: 'Integer'
});

engine.defineRelation('departments', {
  deptId: 'String',
  deptName: 'String',
  budget: 'Integer'
});

// Create a simple query
console.log('📋 Creating Query: High-Paid Employees\n');

const highPaidQuery = engine.query('high-paid')
  .from('employees', engine._relations.get('employees'))
  .build();

const handle = engine.register(highPaidQuery);

// Subscribe to updates
let updateCount = 0;
handle.subscribe((notification) => {
  updateCount++;
  console.log(`Update #${updateCount}: Query results changed`);
  console.log('Results:', notification.results);
  console.log('');
});

// Add initial data
console.log('➕ Adding Initial Employees...\n');

engine.insert('employees', [
  ['e1', 'Alice', 'Engineering', 120000],
  ['e2', 'Bob', 'Sales', 80000],
  ['e3', 'Carol', 'Engineering', 110000]
]);

engine.flush();

// Add more employees incrementally
console.log('➕ Adding More Employees...\n');

engine.insert('employees', ['e4', 'David', 'Marketing', 95000]);
engine.flush();

// Update an employee's salary
console.log('✏️ Updating Employee Salary...\n');

engine.update('employees',
  ['e2', 'Bob', 'Sales', 80000],
  ['e2', 'Bob', 'Sales', 105000]
);

engine.flush();

// Delete an employee
console.log('➖ Removing Employee...\n');

engine.delete('employees', ['e3', 'Carol', 'Engineering', 110000]);
engine.flush();

// Transaction example
console.log('💼 Bulk Update in Transaction...\n');

engine.transaction(async () => {
  // Add department data
  engine.insert('departments', [
    ['Engineering', 'Engineering Dept', 1000000],
    ['Sales', 'Sales Dept', 500000],
    ['Marketing', 'Marketing Dept', 300000]
  ]);
  
  // Add new employees
  engine.insert('employees', [
    ['e5', 'Eve', 'Engineering', 130000],
    ['e6', 'Frank', 'Sales', 90000]
  ]);
  
  console.log('Transaction completed successfully');
});

// Show statistics
console.log('\n📊 Query Statistics:\n');
const stats = handle.getStatistics();
console.log(`Query ID: ${stats.graphId}`);
console.log(`Delta Count: ${stats.deltaCount}`);
console.log(`Update Count: ${updateCount}`);

console.log('\n📈 Engine Statistics:\n');
const engineStats = engine.getStatistics();
console.log(`Active Queries: ${engineStats.queries}`);
console.log(`Relations: ${engineStats.relations}`);
console.log(`Total Batches: ${engineStats.batch.totalBatches}`);

// List queries
console.log('\n📝 Active Queries:', engine.listQueries());

// Clean up
console.log('\n🏁 Demo Complete!\n');
engine.reset();