import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { SequentialQuery } from '../../../src/query/types/SequentialQuery.js';
import { TraversalQuery } from '../../../src/query/types/TraversalQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { FixedLengthPath, VariableLengthPath } from '../../../src/query/paths/index.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { RegexConstraint } from '../../../src/query/constraints/RegexConstraint.js';
import { QueryBuilder } from '../../../src/core/QueryBuilder.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 13.1: Complete Workflow Testing', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for workflow testing
    setupComprehensiveTestData(kg);
  });
  
  afterEach(async () => {
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  function setupComprehensiveTestData(kg) {
    // People and relationships
    kg.addTriple('person:alice', 'rdf:type', 'Person');
    kg.addTriple('person:alice', 'name', 'Alice Johnson');
    kg.addTriple('person:alice', 'age', 30);
    kg.addTriple('person:alice', 'email', 'alice@example.com');
    kg.addTriple('person:alice', 'department', 'Engineering');
    kg.addTriple('person:alice', 'salary', 75000);
    kg.addTriple('person:alice', 'knows', 'person:bob');
    kg.addTriple('person:alice', 'manages', 'person:charlie');
    
    kg.addTriple('person:bob', 'rdf:type', 'Person');
    kg.addTriple('person:bob', 'name', 'Bob Smith');
    kg.addTriple('person:bob', 'age', 25);
    kg.addTriple('person:bob', 'email', 'bob@example.com');
    kg.addTriple('person:bob', 'department', 'Marketing');
    kg.addTriple('person:bob', 'salary', 60000);
    kg.addTriple('person:bob', 'knows', 'person:charlie');
    kg.addTriple('person:bob', 'reportsTo', 'person:alice');
    
    kg.addTriple('person:charlie', 'rdf:type', 'Person');
    kg.addTriple('person:charlie', 'name', 'Charlie Brown');
    kg.addTriple('person:charlie', 'age', 35);
    kg.addTriple('person:charlie', 'email', 'charlie@example.com');
    kg.addTriple('person:charlie', 'department', 'Engineering');
    kg.addTriple('person:charlie', 'salary', 80000);
    kg.addTriple('person:charlie', 'knows', 'person:alice');
    kg.addTriple('person:charlie', 'reportsTo', 'person:alice');
    
    // Projects and assignments
    kg.addTriple('project:alpha', 'rdf:type', 'Project');
    kg.addTriple('project:alpha', 'name', 'Project Alpha');
    kg.addTriple('project:alpha', 'status', 'active');
    kg.addTriple('project:alpha', 'budget', 100000);
    kg.addTriple('project:alpha', 'assignedTo', 'person:alice');
    kg.addTriple('project:alpha', 'assignedTo', 'person:charlie');
    
    kg.addTriple('project:beta', 'rdf:type', 'Project');
    kg.addTriple('project:beta', 'name', 'Project Beta');
    kg.addTriple('project:beta', 'status', 'completed');
    kg.addTriple('project:beta', 'budget', 75000);
    kg.addTriple('project:beta', 'assignedTo', 'person:bob');
    
    // Skills and certifications
    kg.addTriple('skill:javascript', 'rdf:type', 'Skill');
    kg.addTriple('skill:javascript', 'name', 'JavaScript');
    kg.addTriple('skill:javascript', 'category', 'Programming');
    
    kg.addTriple('skill:python', 'rdf:type', 'Skill');
    kg.addTriple('skill:python', 'name', 'Python');
    kg.addTriple('skill:python', 'category', 'Programming');
    
    kg.addTriple('skill:marketing', 'rdf:type', 'Skill');
    kg.addTriple('skill:marketing', 'name', 'Digital Marketing');
    kg.addTriple('skill:marketing', 'category', 'Marketing');
    
    // Person-skill relationships
    kg.addTriple('person:alice', 'hasSkill', 'skill:javascript');
    kg.addTriple('person:alice', 'hasSkill', 'skill:python');
    kg.addTriple('person:charlie', 'hasSkill', 'skill:javascript');
    kg.addTriple('person:bob', 'hasSkill', 'skill:marketing');
  }
  
  test('Step 13.1.1: Test complete query lifecycle (create, execute, analyze)', async () => {
    // Phase 1: Query Creation
    console.log('=== Phase 1: Query Creation ===');
    
    // Create a complex query using QueryBuilder
    const builder = new QueryBuilder(kg);
    
    // Build a query to find all people in Engineering with their skills
    const engineeringQuery = builder
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'department', 'Engineering')
      .pattern('?person', 'name', '?name')
      .pattern('?person', 'hasSkill', '?skill')
      .pattern('?skill', 'name', '?skillName')
      .build();
    
    expect(engineeringQuery).toBeInstanceOf(PatternQuery);
    expect(engineeringQuery.patterns.length).toBe(5);
    
    // Phase 2: Query Execution
    console.log('=== Phase 2: Query Execution ===');
    
    const executionStart = Date.now();
    const results = await engineeringQuery.execute(kg);
    const executionTime = Date.now() - executionStart;
    
    expect(results).toBeDefined();
    expect(results.bindings.length).toBeGreaterThan(0);
    
    // Verify results contain expected data
    const engineeringPeople = new Set();
    results.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      expect(binding.has('skill')).toBe(true);
      expect(binding.has('skillName')).toBe(true);
      engineeringPeople.add(binding.get('name'));
    });
    
    expect(engineeringPeople.has('Alice Johnson')).toBe(true);
    expect(engineeringPeople.has('Charlie Brown')).toBe(true);
    expect(engineeringPeople.has('Bob Smith')).toBe(false); // Bob is in Marketing
    
    // Phase 3: Query Analysis
    console.log('=== Phase 3: Query Analysis ===');
    
    // Analyze query performance
    expect(executionTime).toBeLessThan(1000); // Should execute quickly
    
    // Analyze result structure
    const resultAnalysis = {
      totalResults: results.bindings.length,
      uniquePeople: engineeringPeople.size,
      averageSkillsPerPerson: results.bindings.length / engineeringPeople.size,
      executionTime: executionTime
    };
    
    expect(resultAnalysis.totalResults).toBeGreaterThan(0);
    expect(resultAnalysis.uniquePeople).toBe(2); // Alice and Charlie
    expect(resultAnalysis.averageSkillsPerPerson).toBeGreaterThan(1);
    
    // Serialize query for storage/sharing
    const queryTriples = engineeringQuery.toTriples();
    expect(queryTriples.length).toBeGreaterThan(0);
    
    console.log('Query Analysis:', resultAnalysis);
  });
  
  test('Step 13.1.2: Test query composition and decomposition workflows', async () => {
    // Phase 1: Build complex composed query
    console.log('=== Phase 1: Query Composition ===');
    
    // Base queries
    const peopleQuery = new PatternQuery();
    peopleQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    peopleQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    const salaryQuery = new PatternQuery();
    const salaryVar = new QueryVariable('salary');
    salaryVar.addConstraint(new RangeConstraint('salary', 70000, 100000));
    salaryQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'salary', salaryVar));
    
    const skillQuery = new PatternQuery();
    skillQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    skillQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', 'Programming'));
    
    // Compose into logical query
    const highEarningProgrammers = new LogicalQuery('AND');
    highEarningProgrammers.addOperand(peopleQuery);
    highEarningProgrammers.addOperand(salaryQuery);
    highEarningProgrammers.addOperand(skillQuery);
    
    // Execute composed query
    const composedResults = await highEarningProgrammers.execute(kg);
    expect(composedResults).toBeDefined();
    expect(composedResults.bindings.length).toBeGreaterThan(0);
    
    // Verify composition worked correctly
    composedResults.bindings.forEach(binding => {
      const salary = binding.get('salary');
      expect(salary).toBeGreaterThanOrEqual(70000);
      expect(salary).toBeLessThanOrEqual(100000);
    });
    
    // Phase 2: Query Decomposition
    console.log('=== Phase 2: Query Decomposition ===');
    
    // Extract individual operands for analysis
    const operands = highEarningProgrammers.operands;
    expect(operands.length).toBe(3);
    
    // Test each operand individually
    for (let i = 0; i < operands.length; i++) {
      const operandResult = await operands[i].execute(kg);
      expect(operandResult).toBeDefined();
      expect(operandResult.bindings.length).toBeGreaterThan(0);
      console.log(`Operand ${i + 1} results: ${operandResult.bindings.length}`);
    }
    
    // Create alternative composition (OR instead of AND)
    const alternativeQuery = new LogicalQuery('OR');
    alternativeQuery.addOperand(salaryQuery);
    alternativeQuery.addOperand(skillQuery);
    
    const alternativeResults = await alternativeQuery.execute(kg);
    expect(alternativeResults.bindings.length).toBeGreaterThanOrEqual(composedResults.bindings.length);
    
    // Phase 3: Query Transformation
    console.log('=== Phase 3: Query Transformation ===');
    
    // Transform to aggregation query
    const countQuery = new AggregationQuery(highEarningProgrammers, 'COUNT');
    const countResult = await countQuery.execute(kg);
    
    expect(countResult.bindings.length).toBe(1);
    expect(countResult.bindings[0].get('aggregate_result')).toBe(composedResults.bindings.length);
    
    // Transform to sequential pipeline
    const pipeline = new SequentialQuery();
    pipeline.addStage(peopleQuery);
    pipeline.addStage(salaryQuery);
    pipeline.addStage(skillQuery);
    
    const pipelineResult = await pipeline.execute(kg);
    expect(pipelineResult).toBeDefined();
  });
  
  test('Step 13.1.3: Test query optimization and caching workflows', async () => {
    // Phase 1: Baseline Performance
    console.log('=== Phase 1: Baseline Performance ===');
    
    const complexQuery = new PatternQuery();
    complexQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    complexQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'department', new QueryVariable('dept')));
    complexQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    complexQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', new QueryVariable('category')));
    
    // Execute multiple times to measure performance
    const executionTimes = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const result = await complexQuery.execute(kg);
      const time = Date.now() - start;
      executionTimes.push(time);
      expect(result).toBeDefined();
    }
    
    const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    console.log(`Average execution time: ${avgExecutionTime}ms`);
    
    // Phase 2: Query Optimization
    console.log('=== Phase 2: Query Optimization ===');
    
    // Create optimized version with constraints to reduce search space
    const optimizedQuery = new PatternQuery();
    const deptVar = new QueryVariable('dept');
    deptVar.addConstraint(new RegexConstraint('^Engineering$'));
    
    optimizedQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    optimizedQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'department', deptVar));
    optimizedQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    optimizedQuery.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', new QueryVariable('category')));
    
    const optimizedStart = Date.now();
    const optimizedResult = await optimizedQuery.execute(kg);
    const optimizedTime = Date.now() - optimizedStart;
    
    expect(optimizedResult).toBeDefined();
    expect(optimizedResult.bindings.length).toBeLessThanOrEqual(complexQuery.patterns.length);
    console.log(`Optimized execution time: ${optimizedTime}ms`);
    
    // Phase 3: Caching Simulation
    console.log('=== Phase 3: Caching Simulation ===');
    
    // Simulate query result caching
    const queryCache = new Map();
    const cacheKey = JSON.stringify(complexQuery.toTriples());
    
    // First execution (cache miss)
    let cachedResult;
    if (queryCache.has(cacheKey)) {
      cachedResult = queryCache.get(cacheKey);
      console.log('Cache hit!');
    } else {
      const cacheStart = Date.now();
      cachedResult = await complexQuery.execute(kg);
      const cacheTime = Date.now() - cacheStart;
      queryCache.set(cacheKey, cachedResult);
      console.log(`Cache miss - execution time: ${cacheTime}ms`);
    }
    
    // Second execution (cache hit simulation)
    const cacheHitStart = Date.now();
    const secondResult = queryCache.get(cacheKey);
    const cacheHitTime = Date.now() - cacheHitStart;
    
    expect(secondResult).toBeDefined();
    expect(cacheHitTime).toBeLessThan(avgExecutionTime);
    console.log(`Cache hit time: ${cacheHitTime}ms`);
    
    // Verify cache integrity
    expect(secondResult.bindings.length).toBe(cachedResult.bindings.length);
  });
  
  test('Step 13.1.4: Test query sharing and reuse workflows', async () => {
    // Phase 1: Query Template Creation
    console.log('=== Phase 1: Query Template Creation ===');
    
    // Create reusable query templates
    const personByDepartmentTemplate = (department) => {
      const query = new PatternQuery();
      query.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
      query.addPattern(new TriplePattern(new QueryVariable('person'), 'department', department));
      query.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
      query.addPattern(new TriplePattern(new QueryVariable('person'), 'salary', new QueryVariable('salary')));
      return query;
    };
    
    const skillByCategory = (category) => {
      const query = new PatternQuery();
      query.addPattern(new TriplePattern(new QueryVariable('skill'), 'rdf:type', 'Skill'));
      query.addPattern(new TriplePattern(new QueryVariable('skill'), 'category', category));
      query.addPattern(new TriplePattern(new QueryVariable('skill'), 'name', new QueryVariable('skillName')));
      return query;
    };
    
    // Phase 2: Template Instantiation and Reuse
    console.log('=== Phase 2: Template Instantiation ===');
    
    // Use templates for different departments
    const engineeringPeople = await personByDepartmentTemplate('Engineering').execute(kg);
    const marketingPeople = await personByDepartmentTemplate('Marketing').execute(kg);
    
    expect(engineeringPeople.bindings.length).toBeGreaterThan(0);
    expect(marketingPeople.bindings.length).toBeGreaterThan(0);
    
    // Verify department filtering
    engineeringPeople.bindings.forEach(binding => {
      const name = binding.get('name');
      expect(['Alice Johnson', 'Charlie Brown']).toContain(name);
    });
    
    marketingPeople.bindings.forEach(binding => {
      const name = binding.get('name');
      expect(name).toBe('Bob Smith');
    });
    
    // Use skill template
    const programmingSkills = await skillByCategory('Programming').execute(kg);
    const marketingSkills = await skillByCategory('Marketing').execute(kg);
    
    expect(programmingSkills.bindings.length).toBe(2); // JavaScript and Python
    expect(marketingSkills.bindings.length).toBe(1); // Digital Marketing
    
    // Phase 3: Query Composition with Templates
    console.log('=== Phase 3: Template Composition ===');
    
    // Combine templates into complex queries
    const engineeringWithSkills = new LogicalQuery('AND');
    engineeringWithSkills.addOperand(personByDepartmentTemplate('Engineering'));
    
    // Add skill pattern
    const skillPattern = new PatternQuery();
    skillPattern.addPattern(new TriplePattern(new QueryVariable('person'), 'hasSkill', new QueryVariable('skill')));
    skillPattern.addPattern(new TriplePattern(new QueryVariable('skill'), 'name', new QueryVariable('skillName')));
    
    engineeringWithSkills.addOperand(skillPattern);
    
    const composedResult = await engineeringWithSkills.execute(kg);
    expect(composedResult.bindings.length).toBeGreaterThan(0);
    
    // Phase 4: Query Serialization for Sharing
    console.log('=== Phase 4: Query Serialization ===');
    
    // Serialize queries for sharing/storage
    const serializedQueries = {
      engineeringTemplate: personByDepartmentTemplate('Engineering').toTriples(),
      skillTemplate: skillByCategory('Programming').toTriples(),
      composedQuery: engineeringWithSkills.toTriples()
    };
    
    // Verify serialization
    Object.values(serializedQueries).forEach(triples => {
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);
    });
    
    console.log('Serialized query sizes:', {
      engineering: serializedQueries.engineeringTemplate.length,
      skills: serializedQueries.skillTemplate.length,
      composed: serializedQueries.composedQuery.length
    });
  });
  
  test('Step 13.1.5: Test query evolution and migration workflows', async () => {
    // Phase 1: Initial Query Version
    console.log('=== Phase 1: Initial Query Version (v1.0) ===');
    
    // Version 1.0: Simple person query
    const queryV1 = new PatternQuery();
    queryV1.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    queryV1.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    
    const v1Results = await queryV1.execute(kg);
    expect(v1Results.bindings.length).toBe(3); // Alice, Bob, Charlie
    
    // Phase 2: Query Evolution (v2.0)
    console.log('=== Phase 2: Query Evolution (v2.0) ===');
    
    // Version 2.0: Add department information
    const queryV2 = new PatternQuery();
    queryV2.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    queryV2.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    queryV2.addPattern(new TriplePattern(new QueryVariable('person'), 'department', new QueryVariable('department')));
    
    const v2Results = await queryV2.execute(kg);
    expect(v2Results.bindings.length).toBe(3);
    
    // Verify backward compatibility
    v2Results.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      expect(binding.has('department')).toBe(true); // New field
    });
    
    // Phase 3: Major Version Change (v3.0)
    console.log('=== Phase 3: Major Version Change (v3.0) ===');
    
    // Version 3.0: Add constraints and aggregation
    const queryV3Base = new PatternQuery();
    queryV3Base.addPattern(new TriplePattern(new QueryVariable('person'), 'rdf:type', 'Person'));
    queryV3Base.addPattern(new TriplePattern(new QueryVariable('person'), 'name', new QueryVariable('name')));
    queryV3Base.addPattern(new TriplePattern(new QueryVariable('person'), 'department', new QueryVariable('department')));
    queryV3Base.addPattern(new TriplePattern(new QueryVariable('person'), 'salary', new QueryVariable('salary')));
    
    // Add aggregation layer
    const queryV3 = new AggregationQuery(queryV3Base, 'COUNT');
    queryV3.groupBy('department');
    
    const v3Results = await queryV3.execute(kg);
    expect(v3Results.bindings.length).toBe(2); // Engineering and Marketing departments
    
    // Verify aggregation results
    const departmentCounts = new Map();
    v3Results.bindings.forEach(binding => {
      const dept = binding.get('department');
      const count = binding.get('aggregate_result');
      departmentCounts.set(dept, count);
    });
    
    expect(departmentCounts.get('Engineering')).toBe(2); // Alice and Charlie
    expect(departmentCounts.get('Marketing')).toBe(1); // Bob
    
    // Phase 4: Migration Strategy
    console.log('=== Phase 4: Migration Strategy ===');
    
    // Create migration adapter for v1 -> v3
    const migrateV1ToV3 = async (oldQuery) => {
      // Extract patterns from old query
      const oldPatterns = oldQuery.patterns;
      
      // Create new query with additional patterns
      const newQuery = new PatternQuery();
      oldPatterns.forEach(pattern => newQuery.addPattern(pattern));
      
      // Add new patterns for v3 compatibility
      newQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'department', new QueryVariable('department')));
      newQuery.addPattern(new TriplePattern(new QueryVariable('person'), 'salary', new QueryVariable('salary')));
      
      return newQuery;
    };
    
    // Test migration
    const migratedQuery = await migrateV1ToV3(queryV1);
    const migratedResults = await migratedQuery.execute(kg);
    
    expect(migratedResults.bindings.length).toBe(v2Results.bindings.length);
    
    // Verify migration preserved original data
    migratedResults.bindings.forEach(binding => {
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      expect(binding.has('department')).toBe(true);
      expect(binding.has('salary')).toBe(true);
    });
    
    // Phase 5: Version Compatibility Testing
    console.log('=== Phase 5: Version Compatibility ===');
    
    // Test that all versions can coexist
    const allVersionResults = await Promise.all([
      queryV1.execute(kg),
      queryV2.execute(kg),
      queryV3Base.execute(kg)
    ]);
    
    // Verify all versions execute successfully
    allVersionResults.forEach((result, index) => {
      expect(result).toBeDefined();
      expect(result.bindings.length).toBeGreaterThan(0);
      console.log(`Version ${index + 1} results: ${result.bindings.length}`);
    });
    
    // Create version metadata
    const versionMetadata = {
      v1: { patterns: queryV1.patterns.length, features: ['basic'] },
      v2: { patterns: queryV2.patterns.length, features: ['basic', 'department'] },
      v3: { patterns: queryV3Base.patterns.length, features: ['basic', 'department', 'salary', 'aggregation'] }
    };
    
    console.log('Version metadata:', versionMetadata);
    
    // Verify evolution path
    expect(versionMetadata.v1.patterns).toBeLessThan(versionMetadata.v2.patterns);
    expect(versionMetadata.v2.patterns).toBeLessThan(versionMetadata.v3.patterns);
  });
});
