#!/usr/bin/env node

/**
 * Advanced DataScript JS query examples
 * 
 * This example demonstrates:
 * - Complex Datalog queries with rules
 * - Advanced aggregations
 * - Multi-source queries
 * - Query optimization patterns
 * - Built-in functions
 */

import { DB, q, qEdn, createConn } from '../../index.js';

console.log('🔍 DataScript JS - Advanced Query Examples\n');

// Set up a more complex dataset
console.log('Setting up complex dataset...');

const schema = {
  ':person/name': { unique: 'identity' },
  ':person/friends': { card: 'many', valueType: 'ref' },
  ':person/skills': { card: 'many' },
  ':person/projects': { card: 'many', valueType: 'ref' },
  ':project/name': { unique: 'identity' },
  ':project/team': { card: 'many', valueType: 'ref' },
  ':project/budget': { valueType: 'number' },
  ':project/status': {},
  ':skill/name': {},
  ':skill/level': { valueType: 'number' }
};

const conn = createConn(schema);

// Add comprehensive test data
const { dbAfter: db } = conn.transact([
  // People
  { ':db/id': -1, ':person/name': 'Alice', ':person/age': 30, ':person/department': 'Engineering' },
  { ':db/id': -2, ':person/name': 'Bob', ':person/age': 25, ':person/department': 'Engineering' },
  { ':db/id': -3, ':person/name': 'Charlie', ':person/age': 35, ':person/department': 'Design' },
  { ':db/id': -4, ':person/name': 'Diana', ':person/age': 28, ':person/department': 'Engineering' },
  { ':db/id': -5, ':person/name': 'Eve', ':person/age': 32, ':person/department': 'Marketing' },
  { ':db/id': -6, ':person/name': 'Frank', ':person/age': 40, ':person/department': 'Management' },
  
  // Skills with levels
  ['+', -1, ':person/skills', { ':skill/name': 'JavaScript', ':skill/level': 9 }],
  ['+', -1, ':person/skills', { ':skill/name': 'React', ':skill/level': 8 }],
  ['+', -1, ':person/skills', { ':skill/name': 'Node.js', ':skill/level': 7 }],
  
  ['+', -2, ':person/skills', { ':skill/name': 'Python', ':skill/level': 8 }],
  ['+', -2, ':person/skills', { ':skill/name': 'Machine Learning', ':skill/level': 6 }],
  
  ['+', -3, ':person/skills', { ':skill/name': 'UI/UX', ':skill/level': 9 }],
  ['+', -3, ':person/skills', { ':skill/name': 'Figma', ':skill/level': 8 }],
  
  ['+', -4, ':person/skills', { ':skill/name': 'JavaScript', ':skill/level': 7 }],
  ['+', -4, ':person/skills', { ':skill/name': 'Python', ':skill/level': 9 }],
  ['+', -4, ':person/skills', { ':skill/name': 'DevOps', ':skill/level': 6 }],
  
  // Projects
  { ':db/id': -100, ':project/name': 'Website Redesign', ':project/budget': 50000, ':project/status': 'active' },
  { ':db/id': -101, ':project/name': 'Mobile App', ':project/budget': 120000, ':project/status': 'planning' },
  { ':db/id': -102, ':project/name': 'Data Pipeline', ':project/budget': 80000, ':project/status': 'active' },
  { ':db/id': -103, ':project/name': 'Analytics Dashboard', ':project/budget': 30000, ':project/status': 'completed' },
  
  // Project assignments
  ['+', -100, ':project/team', -1],  // Alice on Website
  ['+', -100, ':project/team', -3],  // Charlie on Website
  ['+', -101, ':project/team', -1],  // Alice on Mobile App
  ['+', -101, ':project/team', -2],  // Bob on Mobile App
  ['+', -101, ':project/team', -4],  // Diana on Mobile App
  ['+', -102, ':project/team', -2],  // Bob on Data Pipeline
  ['+', -102, ':project/team', -4],  // Diana on Data Pipeline
  ['+', -103, ':project/team', -4],  // Diana on Analytics (completed)
  
  // Friendships
  ['+', -1, ':person/friends', -2],
  ['+', -2, ':person/friends', -1],
  ['+', -1, ':person/friends', -4],
  ['+', -4, ':person/friends', -1],
  ['+', -2, ':person/friends', -4],
  ['+', -4, ':person/friends', -2],
  ['+', -3, ':person/friends', -5],
  ['+', -5, ':person/friends', -3],
]);

console.log(`✓ Dataset ready: ${db.datoms(':eavt').length} datoms\n`);

// 1. Advanced aggregations
console.log('1. Advanced aggregations...');

const departmentStats = q({
  find: ['?dept', '(count ?person)', '(avg ?age)', '(sum ?budget)'],
  where: [
    ['?person', ':person/department', '?dept'],
    ['?person', ':person/age', '?age'],
    ['?project', ':project/team', '?person'],
    ['?project', ':project/budget', '?budget']
  ]
}, db);

console.log('Department statistics (dept, people, avg age, total budget):');
departmentStats.forEach(([dept, count, avgAge, totalBudget]) => {
  console.log(`  ${dept}: ${count} people, avg age ${avgAge.toFixed(1)}, $${totalBudget.toLocaleString()} budget`);
});

// 2. Complex joins and filters
console.log('\n2. Complex joins - Find JavaScript developers on active projects...');

const jsDevelopers = q({
  find: ['?name', '?project-name', '?skill-level'],
  where: [
    ['?person', ':person/name', '?name'],
    ['?person', ':person/skills', '?skill'],
    ['?skill', ':skill/name', 'JavaScript'],
    ['?skill', ':skill/level', '?skill-level'],
    ['?project', ':project/team', '?person'],
    ['?project', ':project/name', '?project-name'],
    ['?project', ':project/status', '?status'],
    [status => status === 'active', '?status'],
    [level => level >= 7, '?skill-level']
  ]
}, db);

console.log('Senior JavaScript developers on active projects:');
jsDevelopers.forEach(([name, project, level]) => {
  console.log(`  ${name} (JS level ${level}) on "${project}"`);
});

// 3. Rules for recursive queries
console.log('\n3. Recursive queries with rules...');

const collaborationRules = `
[[(collaborator ?p1 ?p2)
  [?project :project/team ?p1]
  [?project :project/team ?p2]
  [(not= ?p1 ?p2)]]
  
 [(connected ?p1 ?p2)
  (collaborator ?p1 ?p2)]
  
 [(connected ?p1 ?p2)
  [?p1 :person/friends ?p2]]
  
 [(network ?p1 ?p2)
  (connected ?p1 ?p2)]
  
 [(network ?p1 ?p2)
  (connected ?p1 ?intermediate)
  (network ?intermediate ?p2)]]
`;

// Find all people in Alice's professional network
const aliceNetwork = qEdn(`
  [:find ?name
   :in $ % ?alice-name
   :where
   [?alice :person/name ?alice-name]
   [?person :person/name ?name]
   (network ?alice ?person)
   [(not= ?alice ?person)]]
`, db, collaborationRules, 'Alice');

console.log(`Alice's professional network: ${aliceNetwork.map(([name]) => name).join(', ')}`);

// 4. Advanced pattern matching
console.log('\n4. Advanced pattern matching - Multi-skilled developers...');

const multiSkilled = q({
  find: ['?name', '(count ?skill)'],
  where: [
    ['?person', ':person/name', '?name'],
    ['?person', ':person/skills', '?skill']
  ]
}, db);

console.log('Developers by skill count:');
multiSkilled
  .sort((a, b) => b[1] - a[1])
  .forEach(([name, skillCount]) => {
    console.log(`  ${name}: ${skillCount} skills`);
  });

// 5. Conditional logic and built-in functions
console.log('\n5. Built-in functions and conditional logic...');

const skillAnalysis = q({
  find: ['?name', '?skill-name', '?level', '?category'],
  where: [
    ['?person', ':person/name', '?name'],
    ['?person', ':person/skills', '?skill'],
    ['?skill', ':skill/name', '?skill-name'],
    ['?skill', ':skill/level', '?level'],
    [function(level) {
      if (level >= 8) return 'Expert';
      if (level >= 6) return 'Proficient';
      return 'Learning';
    }, '?level', '?category']
  ]
}, db);

console.log('Skill proficiency analysis:');
const skillsByCategory = {};
skillAnalysis.forEach(([name, skill, level, category]) => {
  if (!skillsByCategory[category]) skillsByCategory[category] = [];
  skillsByCategory[category].push({ name, skill, level });
});

Object.entries(skillsByCategory).forEach(([category, skills]) => {
  console.log(`  ${category}:`);
  skills.forEach(({ name, skill, level }) => {
    console.log(`    ${name}: ${skill} (${level})`);
  });
});

// 6. Query optimization with indexes
console.log('\n6. Query optimization examples...');

// More efficient: start with the most selective clause
const optimizedQuery = q({
  find: ['?name'],
  where: [
    // Start with unique/selective attributes first
    ['?project', ':project/name', 'Mobile App'],  // Most selective
    ['?project', ':project/team', '?person'],
    ['?person', ':person/name', '?name']
  ]
}, db);

console.log('Mobile App team (optimized query):', optimizedQuery.map(([name]) => name).join(', '));

// 7. Working with dates and temporal data
console.log('\n7. Complex data transformations...');

// Simulate adding timestamps
const now = new Date();
const withTimestamps = q({
  find: ['?name', '?project', '?days-active'],
  where: [
    ['?person', ':person/name', '?name'],
    ['?project-entity', ':project/name', '?project'],
    ['?project-entity', ':project/team', '?person'],
    ['?project-entity', ':project/status', 'active'],
    [() => Math.floor(Math.random() * 100) + 1, '?days-active']  // Simulated
  ]
}, db);

console.log('Active project assignments with simulated duration:');
withTimestamps.forEach(([name, project, days]) => {
  console.log(`  ${name} on "${project}" for ${days} days`);
});

// 8. Performance comparison
console.log('\n8. Performance analysis...');

const start = performance.now();
for (let i = 0; i < 1000; i++) {
  q({
    find: ['?name'],
    where: [['?e', ':person/name', '?name']]
  }, db);
}
const end = performance.now();

console.log(`Executed 1000 simple queries in ${(end - start).toFixed(2)}ms`);
console.log(`Average: ${((end - start) / 1000).toFixed(3)}ms per query`);

// 9. Meta-queries (queries about the schema)
console.log('\n9. Meta-queries about the database...');

const schemaInfo = q({
  find: ['?attr', '(count ?e)'],
  where: [
    ['?e', '?attr', '?v'],
    [(attr) => typeof attr === 'string' && attr.startsWith(':'), '?attr']
  ]
}, db);

console.log('Attribute usage statistics:');
schemaInfo
  .sort((a, b) => b[1] - a[1])
  .forEach(([attr, count]) => {
    console.log(`  ${attr}: ${count} usages`);
  });

console.log('\n✅ Advanced query examples completed!');
console.log('\nKey takeaways:');
console.log('- Use rules for complex recursive relationships');
console.log('- Order query clauses by selectivity for performance');
console.log('- Leverage built-in functions for data transformation');
console.log('- Aggregations work seamlessly with complex joins');
console.log('- The query engine is optimized for typical usage patterns');