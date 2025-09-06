#!/usr/bin/env node

/**
 * Knowledge Graph Query System Demo
 * 
 * This demo showcases the advanced query capabilities of the KG system,
 * including pattern matching, traversal queries, logical composition,
 * and aggregation operations.
 */

import { KGEngine } from '../src/core/KGEngine.js';
import { 
  PatternQuery, 
  TraversalQuery, 
  LogicalQuery, 
  AggregationQuery,
  QuerySystem 
} from '../src/query/index.js';
import { FixedLengthPath, VariableLengthPath } from '../src/query/paths/index.js';
import { RangeConstraint, RegexConstraint } from '../src/query/constraints/index.js';

console.log('🔍 Knowledge Graph Query System Demo\n');

// Initialize the knowledge graph
const kg = new KGEngine();
const querySystem = new QuerySystem(kg);

// Sample data setup
async function setupSampleData() {
  console.log('📊 Setting up sample data...');
  
  // People
  await kg.addTriple('john', 'rdf:type', 'Person');
  await kg.addTriple('john', 'name', 'John Smith');
  await kg.addTriple('john', 'age', 30);
  await kg.addTriple('john', 'city', 'New York');
  
  await kg.addTriple('jane', 'rdf:type', 'Person');
  await kg.addTriple('jane', 'name', 'Jane Doe');
  await kg.addTriple('jane', 'age', 25);
  await kg.addTriple('jane', 'city', 'San Francisco');
  
  await kg.addTriple('bob', 'rdf:type', 'Person');
  await kg.addTriple('bob', 'name', 'Bob Johnson');
  await kg.addTriple('bob', 'age', 35);
  await kg.addTriple('bob', 'city', 'Chicago');
  
  // Companies
  await kg.addTriple('acme', 'rdf:type', 'Company');
  await kg.addTriple('acme', 'name', 'Acme Corp');
  await kg.addTriple('acme', 'industry', 'Technology');
  
  await kg.addTriple('globex', 'rdf:type', 'Company');
  await kg.addTriple('globex', 'name', 'Globex Inc');
  await kg.addTriple('globex', 'industry', 'Manufacturing');
  
  // Relationships
  await kg.addTriple('john', 'worksAt', 'acme');
  await kg.addTriple('jane', 'worksAt', 'acme');
  await kg.addTriple('bob', 'worksAt', 'globex');
  
  await kg.addTriple('john', 'knows', 'jane');
  await kg.addTriple('jane', 'knows', 'bob');
  await kg.addTriple('bob', 'knows', 'john');
  
  // Projects
  await kg.addTriple('project1', 'rdf:type', 'Project');
  await kg.addTriple('project1', 'name', 'AI Platform');
  await kg.addTriple('project1', 'budget', 100000);
  await kg.addTriple('project1', 'status', 'active');
  
  await kg.addTriple('project2', 'rdf:type', 'Project');
  await kg.addTriple('project2', 'name', 'Mobile App');
  await kg.addTriple('project2', 'budget', 50000);
  await kg.addTriple('project2', 'status', 'completed');
  
  await kg.addTriple('john', 'worksOn', 'project1');
  await kg.addTriple('jane', 'worksOn', 'project1');
  await kg.addTriple('jane', 'worksOn', 'project2');
  
  console.log('✅ Sample data loaded\n');
}

// Demo 1: Basic Pattern Queries
async function demoBasicPatterns() {
  console.log('🔍 Demo 1: Basic Pattern Queries');
  console.log('================================');
  
  // Find all people
  const peopleQuery = new PatternQuery()
    .pattern('?person', 'rdf:type', 'Person')
    .pattern('?person', 'name', '?name');
  
  const peopleResult = await querySystem.execute(peopleQuery);
  console.log('All people:');
  peopleResult.toArray().forEach(row => {
    console.log(`  - ${row.name} (${row.person})`);
  });
  
  // Find people over 30
  const olderPeopleQuery = new PatternQuery()
    .pattern('?person', 'rdf:type', 'Person')
    .pattern('?person', 'name', '?name')
    .pattern('?person', 'age', '?age')
    .constraint('age', '>', 30);
  
  const olderResult = await querySystem.execute(olderPeopleQuery);
  console.log('\nPeople over 30:');
  olderResult.toArray().forEach(row => {
    console.log(`  - ${row.name}, age ${row.age}`);
  });
  
  console.log();
}

// Demo 2: Traversal Queries
async function demoTraversalQueries() {
  console.log('🚶 Demo 2: Traversal Queries');
  console.log('============================');
  
  // Find people John knows (direct connections)
  const directPath = new FixedLengthPath(['knows']);
  const directQuery = new TraversalQuery('john', directPath);
  
  const directResult = await querySystem.execute(directQuery);
  console.log('People John knows directly:');
  directResult.toArray().forEach(row => {
    console.log(`  - ${row.end}`);
  });
  
  // Find people in John's extended network (up to 2 degrees)
  const extendedPath = new VariableLengthPath('knows', 1, 2);
  const extendedQuery = new TraversalQuery('john', extendedPath);
  
  const extendedResult = await querySystem.execute(extendedQuery);
  console.log('\nPeople in John\'s extended network:');
  extendedResult.toArray().forEach(row => {
    console.log(`  - ${row.end}`);
  });
  
  console.log();
}

// Demo 3: Logical Query Composition
async function demoLogicalQueries() {
  console.log('🧠 Demo 3: Logical Query Composition');
  console.log('====================================');
  
  // Find people who work at Acme
  const acmeQuery = new PatternQuery()
    .pattern('?person', 'worksAt', 'acme')
    .pattern('?person', 'name', '?name');
  
  // Find people who work on Project 1
  const project1Query = new PatternQuery()
    .pattern('?person', 'worksOn', 'project1')
    .pattern('?person', 'name', '?name');
  
  // Find people who work at Acme AND on Project 1
  const andQuery = new LogicalQuery('AND')
    .addOperand(acmeQuery)
    .addOperand(project1Query);
  
  const andResult = await querySystem.execute(andQuery);
  console.log('People who work at Acme AND on Project 1:');
  andResult.toArray().forEach(row => {
    console.log(`  - ${row.name}`);
  });
  
  // Find people who work at Acme OR on Project 2
  const project2Query = new PatternQuery()
    .pattern('?person', 'worksOn', 'project2')
    .pattern('?person', 'name', '?name');
  
  const orQuery = new LogicalQuery('OR')
    .addOperand(acmeQuery)
    .addOperand(project2Query);
  
  const orResult = await querySystem.execute(orQuery);
  console.log('\nPeople who work at Acme OR on Project 2:');
  orResult.toArray().forEach(row => {
    console.log(`  - ${row.name}`);
  });
  
  console.log();
}

// Demo 4: Aggregation Queries
async function demoAggregationQueries() {
  console.log('📊 Demo 4: Aggregation Queries');
  console.log('==============================');
  
  // Count total number of people
  const peopleCountQuery = new PatternQuery()
    .pattern('?person', 'rdf:type', 'Person');
  
  const countQuery = new AggregationQuery(peopleCountQuery, 'COUNT');
  const countResult = await querySystem.execute(countQuery);
  
  console.log(`Total number of people: ${countResult.first().get('aggregate_result')}`);
  
  // Average age of people
  const ageQuery = new PatternQuery()
    .pattern('?person', 'rdf:type', 'Person')
    .pattern('?person', 'age', '?age');
  
  const avgAgeQuery = new AggregationQuery(ageQuery, 'AVG')
    .aggregateField('age');
  
  const avgResult = await querySystem.execute(avgAgeQuery);
  console.log(`Average age: ${avgResult.first().get('aggregate_result').toFixed(1)}`);
  
  // Total project budgets
  const budgetQuery = new PatternQuery()
    .pattern('?project', 'rdf:type', 'Project')
    .pattern('?project', 'budget', '?budget');
  
  const totalBudgetQuery = new AggregationQuery(budgetQuery, 'SUM')
    .aggregateField('budget');
  
  const budgetResult = await querySystem.execute(totalBudgetQuery);
  console.log(`Total project budgets: $${budgetResult.first().get('aggregate_result').toLocaleString()}`);
  
  console.log();
}

// Demo 5: Complex Multi-Step Query
async function demoComplexQuery() {
  console.log('🎯 Demo 5: Complex Multi-Step Query');
  console.log('===================================');
  
  // Find colleagues of people who work on active projects
  console.log('Finding colleagues of people working on active projects...\n');
  
  // Step 1: Find people working on active projects
  const activeProjectWorkers = new PatternQuery()
    .pattern('?person', 'worksOn', '?project')
    .pattern('?project', 'status', 'active')
    .pattern('?person', 'name', '?name');
  
  const step1Result = await querySystem.execute(activeProjectWorkers);
  console.log('People working on active projects:');
  step1Result.toArray().forEach(row => {
    console.log(`  - ${row.name}`);
  });
  
  // Step 2: Find their colleagues (people at same company)
  const colleagues = new PatternQuery()
    .pattern('?person1', 'worksAt', '?company')
    .pattern('?person2', 'worksAt', '?company')
    .pattern('?person1', 'name', '?name1')
    .pattern('?person2', 'name', '?name2')
    .constraint('person1', '!=', '?person2'); // Different people
  
  const colleaguesResult = await querySystem.execute(colleagues);
  console.log('\nColleague relationships:');
  colleaguesResult.toArray().forEach(row => {
    console.log(`  - ${row.name1} works with ${row.name2}`);
  });
  
  console.log();
}

// Demo 6: Query Performance and Statistics
async function demoQueryStats() {
  console.log('📈 Demo 6: Query Performance and Statistics');
  console.log('===========================================');
  
  const history = querySystem.getExecutionHistory();
  console.log(`Total queries executed: ${history.length}`);
  
  if (history.length > 0) {
    const avgExecutionTime = history.reduce((sum, entry) => sum + (entry.executionTime || 0), 0) / history.length;
    const totalResults = history.reduce((sum, entry) => sum + entry.resultCount, 0);
    
    console.log(`Average execution time: ${avgExecutionTime.toFixed(2)}ms`);
    console.log(`Total results returned: ${totalResults}`);
    console.log(`Average results per query: ${(totalResults / history.length).toFixed(1)}`);
  }
  
  console.log();
}

// Main demo execution
async function runDemo() {
  try {
    await setupSampleData();
    await demoBasicPatterns();
    await demoTraversalQueries();
    await demoLogicalQueries();
    await demoAggregationQueries();
    await demoComplexQuery();
    await demoQueryStats();
    
    console.log('🎉 Demo completed successfully!');
    console.log('\nThe query system demonstrates:');
    console.log('• Pattern-based querying with variables and constraints');
    console.log('• Graph traversal with fixed and variable-length paths');
    console.log('• Logical composition (AND, OR, NOT operations)');
    console.log('• Aggregation operations (COUNT, SUM, AVG, etc.)');
    console.log('• Complex multi-step query workflows');
    console.log('• Query performance tracking and statistics');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
runDemo();
