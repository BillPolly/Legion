import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { QueryResult } from '../../../src/query/execution/QueryResult.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 8.1: Result Construction and Manipulation', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for result manipulation testing
    // Create a rich dataset for various result operations
    
    // People with various attributes
    kg.addTriple('person1', 'rdf:type', 'Person');
    kg.addTriple('person1', 'name', 'Alice Johnson');
    kg.addTriple('person1', 'age', 30);
    kg.addTriple('person1', 'salary', 75000);
    kg.addTriple('person1', 'department', 'Engineering');
    kg.addTriple('person1', 'city', 'New York');
    kg.addTriple('person1', 'rating', 4.5);
    kg.addTriple('person1', 'active', true);
    
    kg.addTriple('person2', 'rdf:type', 'Person');
    kg.addTriple('person2', 'name', 'Bob Smith');
    kg.addTriple('person2', 'age', 25);
    kg.addTriple('person2', 'salary', 60000);
    kg.addTriple('person2', 'department', 'Engineering');
    kg.addTriple('person2', 'city', 'San Francisco');
    kg.addTriple('person2', 'rating', 4.0);
    kg.addTriple('person2', 'active', true);
    
    kg.addTriple('person3', 'rdf:type', 'Person');
    kg.addTriple('person3', 'name', 'Charlie Brown');
    kg.addTriple('person3', 'age', 35);
    kg.addTriple('person3', 'salary', 90000);
    kg.addTriple('person3', 'department', 'Sales');
    kg.addTriple('person3', 'city', 'Chicago');
    kg.addTriple('person3', 'rating', 4.8);
    kg.addTriple('person3', 'active', false);
    
    kg.addTriple('person4', 'rdf:type', 'Person');
    kg.addTriple('person4', 'name', 'Diana Prince');
    kg.addTriple('person4', 'age', 28);
    kg.addTriple('person4', 'salary', 85000);
    kg.addTriple('person4', 'department', 'Marketing');
    kg.addTriple('person4', 'city', 'Los Angeles');
    kg.addTriple('person4', 'rating', 4.7);
    kg.addTriple('person4', 'active', true);
    
    kg.addTriple('person5', 'rdf:type', 'Person');
    kg.addTriple('person5', 'name', 'Eve Wilson');
    kg.addTriple('person5', 'age', 32);
    kg.addTriple('person5', 'salary', 95000);
    kg.addTriple('person5', 'department', 'Marketing');
    kg.addTriple('person5', 'city', 'Seattle');
    kg.addTriple('person5', 'rating', 4.6);
    kg.addTriple('person5', 'active', true);
    
    // Projects for additional test data
    kg.addTriple('project1', 'rdf:type', 'Project');
    kg.addTriple('project1', 'name', 'AI Platform');
    kg.addTriple('project1', 'budget', 500000);
    kg.addTriple('project1', 'status', 'Active');
    kg.addTriple('project1', 'priority', 'High');
    
    kg.addTriple('project2', 'rdf:type', 'Project');
    kg.addTriple('project2', 'name', 'Mobile App');
    kg.addTriple('project2', 'budget', 200000);
    kg.addTriple('project2', 'status', 'Completed');
    kg.addTriple('project2', 'priority', 'Medium');
    
    kg.addTriple('project3', 'rdf:type', 'Project');
    kg.addTriple('project3', 'name', 'Data Analytics');
    kg.addTriple('project3', 'budget', 300000);
    kg.addTriple('project3', 'status', 'Planning');
    kg.addTriple('project3', 'priority', 'Low');
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 8.1.1: Test QueryResult creation and basic operations', async () => {
    // Test basic QueryResult creation and manipulation
    
    // Create a simple query to get results
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const result = await query.execute(kg);
    
    // Test basic QueryResult properties
    expect(result).toBeInstanceOf(QueryResult);
    expect(result.bindings).toBeDefined();
    expect(Array.isArray(result.bindings)).toBe(true);
    expect(result.bindings.length).toBe(5); // 5 people
    
    expect(result.variableNames).toBeDefined();
    expect(Array.isArray(result.variableNames)).toBe(true);
    expect(result.variableNames).toContain('person');
    expect(result.variableNames).toContain('name');
    expect(result.variableNames).toContain('age');
    
    // Test binding access
    for (const binding of result.bindings) {
      expect(binding instanceof Map).toBe(true);
      expect(binding.has('person')).toBe(true);
      expect(binding.has('name')).toBe(true);
      expect(binding.has('age')).toBe(true);
      
      expect(typeof binding.get('person')).toBe('string');
      expect(typeof binding.get('name')).toBe('string');
      expect(typeof binding.get('age')).toBe('number');
    }
    
    // Test result metadata
    expect(result.query).toBe(query);
    expect(result.size()).toBe(5);
    expect(result.isEmpty()).toBe(false);
    
    // Test empty result
    const emptyQuery = new PatternQuery();
    emptyQuery.addPattern(new TriplePattern(personVar, 'rdf:type', 'NonExistent'));
    
    const emptyResult = await emptyQuery.execute(kg);
    expect(emptyResult.size()).toBe(0);
    expect(emptyResult.isEmpty()).toBe(true);
    
    // Test result iteration
    let count = 0;
    for (const binding of result) {
      expect(binding instanceof Map).toBe(true);
      count++;
    }
    expect(count).toBe(5);
    
    // Test result indexing
    const firstBinding = result.getBinding(0);
    expect(firstBinding instanceof Map).toBe(true);
    expect(firstBinding.has('person')).toBe(true);
    
    const lastBinding = result.getBinding(4);
    expect(lastBinding instanceof Map).toBe(true);
    
    // Test out of bounds
    expect(result.getBinding(10)).toBeUndefined();
    expect(result.getBinding(-1)).toBeUndefined();
  });
  
  test('Step 8.1.2: Test result filtering and transformation', async () => {
    // Test result filtering capabilities
    
    // Get all people with their attributes
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    const salaryVar = new QueryVariable('salary');
    const deptVar = new QueryVariable('department');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    query.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    query.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const result = await query.execute(kg);
    
    // Test filtering by age
    const youngPeople = result.filter(binding => binding.get('age') < 30);
    expect(youngPeople.size()).toBe(2); // Bob (25) and Diana (28)
    expect(youngPeople.variableNames).toEqual(result.variableNames);
    
    for (const binding of youngPeople) {
      expect(binding.get('age')).toBeLessThan(30);
    }
    
    // Test filtering by department
    const engineeringPeople = result.filter(binding => binding.get('department') === 'Engineering');
    expect(engineeringPeople.size()).toBe(2); // Alice and Bob
    
    for (const binding of engineeringPeople) {
      expect(binding.get('department')).toBe('Engineering');
    }
    
    // Test filtering by salary range
    const highEarners = result.filter(binding => binding.get('salary') >= 80000);
    expect(highEarners.size()).toBe(3); // Charlie, Diana, Eve
    
    // Test chained filtering
    const youngHighEarners = result
      .filter(binding => binding.get('age') < 30)
      .filter(binding => binding.get('salary') >= 80000);
    expect(youngHighEarners.size()).toBe(1); // Diana
    expect(youngHighEarners.getBinding(0).get('name')).toBe('Diana Prince');
    
    // Test transformation (map operation)
    const names = result.map(binding => binding.get('name'));
    expect(names.length).toBe(5);
    expect(names).toContain('Alice Johnson');
    expect(names).toContain('Bob Smith');
    expect(names).toContain('Charlie Brown');
    expect(names).toContain('Diana Prince');
    expect(names).toContain('Eve Wilson');
    
    // Test transformation to objects
    const personObjects = result.map(binding => ({
      id: binding.get('person'),
      name: binding.get('name'),
      age: binding.get('age'),
      salary: binding.get('salary'),
      department: binding.get('department')
    }));
    
    expect(personObjects.length).toBe(5);
    expect(personObjects[0]).toHaveProperty('id');
    expect(personObjects[0]).toHaveProperty('name');
    expect(personObjects[0]).toHaveProperty('age');
    expect(personObjects[0]).toHaveProperty('salary');
    expect(personObjects[0]).toHaveProperty('department');
    
    // Test projection (select specific variables)
    const nameAgeResult = result.project(['name', 'age']);
    expect(nameAgeResult.variableNames).toEqual(['name', 'age']);
    expect(nameAgeResult.size()).toBe(5);
    
    for (const binding of nameAgeResult) {
      expect(binding.has('name')).toBe(true);
      expect(binding.has('age')).toBe(true);
      expect(binding.has('salary')).toBe(false);
      expect(binding.has('department')).toBe(false);
    }
    
    // Test distinct operation
    const deptResult = result.project(['department']);
    const distinctDepts = deptResult.distinct();
    expect(distinctDepts.size()).toBe(3); // Engineering, Sales, Marketing
    
    const deptNames = distinctDepts.map(binding => binding.get('department'));
    expect(deptNames).toContain('Engineering');
    expect(deptNames).toContain('Sales');
    expect(deptNames).toContain('Marketing');
  });
  
  test('Step 8.1.3: Test result sorting and ordering', async () => {
    // Test result sorting capabilities
    
    // Get all people with their attributes
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    const salaryVar = new QueryVariable('salary');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    query.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    
    const result = await query.execute(kg);
    
    // Test sorting by age (ascending)
    const sortedByAge = result.orderBy('age');
    expect(sortedByAge.size()).toBe(5);
    
    const ages = sortedByAge.map(binding => binding.get('age'));
    expect(ages).toEqual([25, 28, 30, 32, 35]); // Bob, Diana, Alice, Eve, Charlie
    
    // Test sorting by age (descending)
    const sortedByAgeDesc = result.orderBy('age', 'DESC');
    const agesDesc = sortedByAgeDesc.map(binding => binding.get('age'));
    expect(agesDesc).toEqual([35, 32, 30, 28, 25]); // Charlie, Eve, Alice, Diana, Bob
    
    // Test sorting by salary
    const sortedBySalary = result.orderBy('salary');
    const salaries = sortedBySalary.map(binding => binding.get('salary'));
    expect(salaries).toEqual([60000, 75000, 85000, 90000, 95000]); // Bob, Alice, Diana, Charlie, Eve
    
    // Test sorting by name (alphabetical)
    const sortedByName = result.orderBy('name');
    const names = sortedByName.map(binding => binding.get('name'));
    expect(names).toEqual(['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Eve Wilson']);
    
    // Test multi-field sorting
    const deptVar = new QueryVariable('department');
    const queryWithDept = new PatternQuery();
    queryWithDept.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    queryWithDept.addPattern(new TriplePattern(personVar, 'name', nameVar));
    queryWithDept.addPattern(new TriplePattern(personVar, 'age', ageVar));
    queryWithDept.addPattern(new TriplePattern(personVar, 'salary', salaryVar));
    queryWithDept.addPattern(new TriplePattern(personVar, 'department', deptVar));
    
    const resultWithDept = await queryWithDept.execute(kg);
    
    // Sort by department, then by salary within department
    const sortedMulti = resultWithDept.orderBy(['department', 'salary']);
    
    // Verify department grouping and salary ordering within groups
    let prevDept = '';
    let prevSalary = 0;
    
    for (const binding of sortedMulti) {
      const dept = binding.get('department');
      const salary = binding.get('salary');
      
      if (dept === prevDept) {
        expect(salary).toBeGreaterThanOrEqual(prevSalary);
      }
      
      prevDept = dept;
      if (dept !== prevDept) {
        prevSalary = 0;
      } else {
        prevSalary = salary;
      }
    }
    
    // Test custom sorting function
    const customSorted = result.orderBy((a, b) => {
      // Sort by salary descending, then by age ascending
      const salaryDiff = b.get('salary') - a.get('salary');
      if (salaryDiff !== 0) return salaryDiff;
      return a.get('age') - b.get('age');
    });
    
    expect(customSorted.size()).toBe(5);
    
    // Verify custom sort order
    const customOrder = customSorted.map(binding => ({
      name: binding.get('name'),
      salary: binding.get('salary'),
      age: binding.get('age')
    }));
    
    // Should be: Eve (95000, 32), Charlie (90000, 35), Diana (85000, 28), Alice (75000, 30), Bob (60000, 25)
    expect(customOrder[0].name).toBe('Eve Wilson');
    expect(customOrder[1].name).toBe('Charlie Brown');
    expect(customOrder[2].name).toBe('Diana Prince');
    expect(customOrder[3].name).toBe('Alice Johnson');
    expect(customOrder[4].name).toBe('Bob Smith');
  });
  
  test('Step 8.1.4: Test result pagination (limit/offset)', async () => {
    // Test result pagination capabilities
    
    // Get all people sorted by age for consistent pagination
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const result = await query.execute(kg);
    const sortedResult = result.orderBy('age');
    
    // Test limit operation
    const limitedResult = sortedResult.limit(3);
    expect(limitedResult.size()).toBe(3);
    
    const limitedAges = limitedResult.map(binding => binding.get('age'));
    expect(limitedAges).toEqual([25, 28, 30]); // First 3 youngest
    
    // Test offset operation
    const offsetResult = sortedResult.offset(2);
    expect(offsetResult.size()).toBe(3); // 5 - 2 = 3
    
    const offsetAges = offsetResult.map(binding => binding.get('age'));
    expect(offsetAges).toEqual([30, 32, 35]); // Skip first 2
    
    // Test limit with offset (pagination)
    const page1 = sortedResult.offset(0).limit(2);
    expect(page1.size()).toBe(2);
    const page1Ages = page1.map(binding => binding.get('age'));
    expect(page1Ages).toEqual([25, 28]);
    
    const page2 = sortedResult.offset(2).limit(2);
    expect(page2.size()).toBe(2);
    const page2Ages = page2.map(binding => binding.get('age'));
    expect(page2Ages).toEqual([30, 32]);
    
    const page3 = sortedResult.offset(4).limit(2);
    expect(page3.size()).toBe(1); // Only 1 remaining
    const page3Ages = page3.map(binding => binding.get('age'));
    expect(page3Ages).toEqual([35]);
    
    // Test pagination beyond available data
    const beyondPage = sortedResult.limit(2).offset(10);
    expect(beyondPage.size()).toBe(0);
    expect(beyondPage.isEmpty()).toBe(true);
    
    // Test limit larger than available data
    const largeLimit = sortedResult.limit(100);
    expect(largeLimit.size()).toBe(5); // Should return all available
    
    // Test zero limit
    const zeroLimit = sortedResult.limit(0);
    expect(zeroLimit.size()).toBe(0);
    expect(zeroLimit.isEmpty()).toBe(true);
    
    // Test negative values (should be treated as 0)
    const negativeLimit = sortedResult.limit(-5);
    expect(negativeLimit.size()).toBe(0);
    
    const negativeOffset = sortedResult.offset(-2);
    expect(negativeOffset.size()).toBe(5); // Should return all
    
    // Test chaining with other operations
    const chainedResult = sortedResult
      .filter(binding => binding.get('age') >= 28)
      .offset(1)
      .limit(2);
    
    expect(chainedResult.size()).toBe(2);
    const chainedAges = chainedResult.map(binding => binding.get('age'));
    expect(chainedAges).toEqual([30, 32]); // Skip Diana (28), get Alice (30) and Eve (32)
    
    // Test pagination metadata
    const paginatedResult = sortedResult.paginate(2, 1); // page size 2, page 1 (0-indexed)
    expect(paginatedResult.size()).toBe(2);
    expect(paginatedResult.pageInfo).toBeDefined();
    expect(paginatedResult.pageInfo.pageSize).toBe(2);
    expect(paginatedResult.pageInfo.currentPage).toBe(1);
    expect(paginatedResult.pageInfo.totalItems).toBe(5);
    expect(paginatedResult.pageInfo.totalPages).toBe(3);
    expect(paginatedResult.pageInfo.hasNextPage).toBe(true);
    expect(paginatedResult.pageInfo.hasPreviousPage).toBe(true);
  });
  
  test('Step 8.1.5: Test result serialization to triples', async () => {
    // Test result serialization capabilities
    
    // Get a simple result set
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const result = await query.execute(kg);
    
    // Test basic serialization to triples
    const triples = result.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    // Verify triple structure
    for (const triple of triples) {
      expect(Array.isArray(triple)).toBe(true);
      expect(triple.length).toBe(3);
      expect(typeof triple[0]).toBe('string'); // subject
      expect(typeof triple[1]).toBe('string'); // predicate
      // object can be string, number, boolean, etc.
    }
    
    // Test serialization with metadata
    const triplesWithMeta = result.toTriples({ includeMetadata: true });
    expect(Array.isArray(triplesWithMeta)).toBe(true);
    
    // Should include result metadata triples
    const metaTriples = triplesWithMeta.filter(triple => 
      triple[1].startsWith('kg:result') || triple[1].startsWith('kg:query')
    );
    expect(metaTriples.length).toBeGreaterThan(0);
    
    // Test serialization to different formats
    const jsonResult = result.toJSON();
    expect(typeof jsonResult).toBe('object');
    expect(jsonResult.bindings).toBeDefined();
    expect(jsonResult.variableNames).toBeDefined();
    expect(Array.isArray(jsonResult.bindings)).toBe(true);
    expect(Array.isArray(jsonResult.variableNames)).toBe(true);
    
    // Test round-trip serialization
    const serialized = result.serialize();
    expect(typeof serialized).toBe('string');
    
    const deserialized = QueryResult.deserialize(serialized);
    expect(deserialized).toBeInstanceOf(QueryResult);
    expect(deserialized.size()).toBe(result.size());
    expect(deserialized.variableNames).toEqual(result.variableNames);
    
    // Verify binding content is preserved
    for (let i = 0; i < result.size(); i++) {
      const originalBinding = result.getBinding(i);
      const deserializedBinding = deserialized.getBinding(i);
      
      for (const varName of result.variableNames) {
        expect(deserializedBinding.get(varName)).toEqual(originalBinding.get(varName));
      }
    }
    
    // Test serialization with custom options
    const customSerialized = result.toTriples({
      namespace: 'custom',
      includeTypes: true,
      compactFormat: true
    });
    
    expect(Array.isArray(customSerialized)).toBe(true);
    
    // Test CSV export
    const csvData = result.toCSV();
    expect(typeof csvData).toBe('string');
    
    const lines = csvData.split('\n');
    expect(lines.length).toBe(6); // header + 5 data rows
    
    const header = lines[0].split(',');
    expect(header).toContain('person');
    expect(header).toContain('name');
    expect(header).toContain('age');
    
    // Test TSV export
    const tsvData = result.toTSV();
    expect(typeof tsvData).toBe('string');
    expect(tsvData).toContain('\t'); // Should contain tab separators
    
    // Test XML export
    const xmlData = result.toXML();
    expect(typeof xmlData).toBe('string');
    expect(xmlData).toContain('<result>');
    expect(xmlData).toContain('<binding>');
    expect(xmlData).toContain('</result>');
  });
});
