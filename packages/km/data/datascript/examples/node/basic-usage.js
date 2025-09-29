#!/usr/bin/env node

/**
 * Basic DataScript JS usage example
 * 
 * This example demonstrates:
 * - Creating a database with schema
 * - Adding data through transactions
 * - Basic Datalog queries
 * - Pull API usage
 * - Entity navigation
 */

import { DB, q, pull, createConn } from '../../index.js';

console.log('🚀 DataScript JS - Basic Usage Example\n');

// 1. Create schema defining attribute properties
console.log('1. Creating database schema...');
const schema = {
  ':person/name': { unique: 'identity' },
  ':person/email': { unique: 'value' },
  ':person/friends': { 
    card: 'many', 
    valueType: 'ref' 
  },
  ':person/age': { valueType: 'number' },
  ':company/employees': { 
    card: 'many', 
    valueType: 'ref' 
  }
};

// 2. Create database and connection
console.log('2. Creating database...');
const conn = createConn(schema);
console.log(`✓ Database created with schema: ${Object.keys(schema).length} attributes`);

// 3. Add data through transactions
console.log('\n3. Adding data...');
const { dbAfter: db1 } = conn.transact([
  // Add people
  { ':db/id': -1, ':person/name': 'Alice', ':person/email': 'alice@example.com', ':person/age': 30 },
  { ':db/id': -2, ':person/name': 'Bob', ':person/email': 'bob@example.com', ':person/age': 25 },
  { ':db/id': -3, ':person/name': 'Charlie', ':person/email': 'charlie@example.com', ':person/age': 35 },
  { ':db/id': -4, ':person/name': 'Diana', ':person/email': 'diana@example.com', ':person/age': 28 },
  
  // Add a company
  { ':db/id': -100, ':company/name': 'Acme Corp' },
  
  // Add relationships
  ['+', -1, ':person/friends', -2],  // Alice ↔ Bob
  ['+', -2, ':person/friends', -1],
  ['+', -2, ':person/friends', -3],  // Bob ↔ Charlie  
  ['+', -3, ':person/friends', -2],
  ['+', -1, ':person/friends', -4],  // Alice ↔ Diana
  ['+', -4, ':person/friends', -1],
  
  // Add employment relationships
  ['+', -100, ':company/employees', -1],  // Alice works at Acme
  ['+', -100, ':company/employees', -2],  // Bob works at Acme
  ['+', -100, ':company/employees', -4],  // Diana works at Acme
]);

console.log(`✓ Added data. Database now has ${db1.datoms(':eavt').length} datoms`);

// 4. Basic queries
console.log('\n4. Running basic queries...');

// Find all people
const allPeople = q({
  find: ['?name'],
  where: [['?e', ':person/name', '?name']]
}, db1);

console.log('All people:', allPeople.map(([name]) => name).join(', '));

// Find people over 30
const adults = q({
  find: ['?name', '?age'],
  where: [
    ['?e', ':person/name', '?name'],
    ['?e', ':person/age', '?age'],
    [(age) => age >= 30, '?age']
  ]
}, db1);

console.log('People 30+:', adults.map(([name, age]) => `${name} (${age})`).join(', '));

// Find friendships (joins)
const friendships = q({
  find: ['?name1', '?name2'],
  where: [
    ['?e1', ':person/name', '?name1'],
    ['?e1', ':person/friends', '?e2'],
    ['?e2', ':person/name', '?name2']
  ]
}, db1);

console.log('Friendships:');
friendships.forEach(([name1, name2]) => {
  console.log(`  ${name1} → ${name2}`);
});

// 5. Aggregation queries
console.log('\n5. Aggregation queries...');

const stats = q({
  find: [['(count ?e)', '(avg ?age)', '(min ?age)', '(max ?age)']],
  where: [
    ['?e', ':person/age', '?age']
  ]
}, db1);

const [count, avgAge, minAge, maxAge] = stats[0];
console.log(`Statistics: ${count} people, avg age ${avgAge.toFixed(1)}, range ${minAge}-${maxAge}`);

// 6. Pull API examples
console.log('\n6. Pull API examples...');

// Get Alice's ID first
const aliceId = q({
  find: ['?e'],
  where: [['?e', ':person/name', 'Alice']]
}, db1)[0][0];

// Pull basic attributes
const aliceBasic = pull(db1, [':person/name', ':person/age'], aliceId);
console.log('Alice (basic):', aliceBasic);

// Pull with relationships
const aliceWithFriends = pull(db1, [
  ':person/name', 
  ':person/age',
  { ':person/friends': [':person/name', ':person/age'] }
], aliceId);
console.log('Alice (with friends):');
console.log(JSON.stringify(aliceWithFriends, null, 2));

// Pull many entities
const companyId = q({
  find: ['?e'],
  where: [['?e', ':company/name', 'Acme Corp']]
}, db1)[0][0];

const companyWithEmployees = pull(db1, [
  ':company/name',
  { ':company/employees': [':person/name', ':person/email'] }
], companyId);
console.log('\nCompany with employees:');
console.log(JSON.stringify(companyWithEmployees, null, 2));

// 7. Entity navigation
console.log('\n7. Entity navigation...');

const alice = db1.entity(aliceId);
console.log(`Alice entity: ${alice[':person/name']}, age ${alice[':person/age']}`);
console.log(`Alice's friends: ${[...alice[':person/friends']].map(f => f[':person/name']).join(', ')}`);

// 8. Database immutability
console.log('\n8. Database immutability...');
console.log(`Original DB: ${conn.db.datoms(':eavt').length} datoms`);
console.log(`After transaction: ${db1.datoms(':eavt').length} datoms`);
console.log(`Databases are different objects: ${conn.db !== db1}`);

// 9. More complex query with rules (using EDN syntax)
console.log('\n9. Complex query with recursive rules...');

import { qEdn } from '../../index.js';

const rules = `
[[(friend ?a ?b)
  [?a :person/friends ?b]]
 [(connected ?a ?b)
  (friend ?a ?b)]
 [(connected ?a ?b)
  (friend ?a ?c)
  (connected ?c ?b)]]
`;

const connections = qEdn(`
  [:find ?name1 ?name2
   :in $ %
   :where
   [?e1 :person/name ?name1]
   [?e2 :person/name ?name2]
   (connected ?e1 ?e2)
   [(not= ?name1 ?name2)]]
`, db1, rules);

console.log('All connections through friendship network:');
connections.forEach(([name1, name2]) => {
  console.log(`  ${name1} ↔ ${name2}`);
});

console.log('\n✅ Basic usage example completed!');
console.log('\nNext steps:');
console.log('- Run `node examples/node/advanced-queries.js` for more query examples');
console.log('- Run `node examples/node/persistence.js` for persistence examples');
console.log('- Check out the browser examples in examples/browser/');