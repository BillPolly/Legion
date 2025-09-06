import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { QueryResult } from '../../../src/query/execution/QueryResult.js';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 8.2: Result Processing and Export', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for result processing testing
    // Create a rich dataset for various processing operations
    
    // People with comprehensive attributes
    kg.addTriple('person1', 'rdf:type', 'Person');
    kg.addTriple('person1', 'name', 'Alice Johnson');
    kg.addTriple('person1', 'age', 30);
    kg.addTriple('person1', 'salary', 75000);
    kg.addTriple('person1', 'department', 'Engineering');
    kg.addTriple('person1', 'city', 'New York');
    kg.addTriple('person1', 'email', 'alice@company.com');
    kg.addTriple('person1', 'phone', '+1-555-0101');
    kg.addTriple('person1', 'active', true);
    kg.addTriple('person1', 'startDate', '2020-01-15');
    
    kg.addTriple('person2', 'rdf:type', 'Person');
    kg.addTriple('person2', 'name', 'Bob Smith');
    kg.addTriple('person2', 'age', 25);
    kg.addTriple('person2', 'salary', 60000);
    kg.addTriple('person2', 'department', 'Engineering');
    kg.addTriple('person2', 'city', 'San Francisco');
    kg.addTriple('person2', 'email', 'bob@company.com');
    kg.addTriple('person2', 'phone', '+1-555-0102');
    kg.addTriple('person2', 'active', true);
    kg.addTriple('person2', 'startDate', '2021-03-10');
    
    kg.addTriple('person3', 'rdf:type', 'Person');
    kg.addTriple('person3', 'name', 'Charlie Brown');
    kg.addTriple('person3', 'age', 35);
    kg.addTriple('person3', 'salary', 90000);
    kg.addTriple('person3', 'department', 'Sales');
    kg.addTriple('person3', 'city', 'Chicago');
    kg.addTriple('person3', 'email', 'charlie@company.com');
    kg.addTriple('person3', 'phone', '+1-555-0103');
    kg.addTriple('person3', 'active', false);
    kg.addTriple('person3', 'startDate', '2019-06-20');
    
    // Generate larger dataset for performance testing
    for (let i = 4; i <= 100; i++) {
      kg.addTriple(`person${i}`, 'rdf:type', 'Person');
      kg.addTriple(`person${i}`, 'name', `Person ${i}`);
      kg.addTriple(`person${i}`, 'age', 20 + (i % 50));
      kg.addTriple(`person${i}`, 'salary', 40000 + (i % 30) * 2000);
      kg.addTriple(`person${i}`, 'department', ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4]);
      kg.addTriple(`person${i}`, 'city', ['New York', 'San Francisco', 'Chicago', 'Austin'][i % 4]);
      kg.addTriple(`person${i}`, 'email', `person${i}@company.com`);
      kg.addTriple(`person${i}`, 'active', i % 3 !== 0);
    }
  });
  
  afterEach(async () => {
    // Clear the knowledge graph to prevent memory leaks and ensure clean state
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
  });
  
  test('Step 8.2.1: Test result conversion to arrays and objects', async () => {
    // Test comprehensive result conversion capabilities
    
    // Get a subset of people for testing
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
    const limitedResult = result.limit(5); // Work with first 5 for testing
    
    // Test toArray() conversion
    const arrayResult = limitedResult.toArray();
    expect(Array.isArray(arrayResult)).toBe(true);
    expect(arrayResult.length).toBe(5);
    
    for (const item of arrayResult) {
      expect(typeof item).toBe('object');
      expect(item).toHaveProperty('person');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('age');
      expect(item).toHaveProperty('salary');
      expect(item).toHaveProperty('department');
      
      expect(typeof item.person).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.age).toBe('number');
      expect(typeof item.salary).toBe('number');
      expect(typeof item.department).toBe('string');
    }
    
    // Test toObjects() conversion (alias for toArray)
    const objectsResult = limitedResult.toObjects();
    expect(objectsResult).toEqual(arrayResult);
    
    // Test custom object transformation
    const customObjects = limitedResult.map(binding => ({
      id: binding.get('person'),
      fullName: binding.get('name'),
      demographics: {
        age: binding.get('age'),
        department: binding.get('department')
      },
      compensation: {
        salary: binding.get('salary'),
        formatted: `$${binding.get('salary').toLocaleString()}`
      }
    }));
    
    expect(customObjects.length).toBe(5);
    for (const obj of customObjects) {
      expect(obj).toHaveProperty('id');
      expect(obj).toHaveProperty('fullName');
      expect(obj).toHaveProperty('demographics');
      expect(obj).toHaveProperty('compensation');
      
      expect(obj.demographics).toHaveProperty('age');
      expect(obj.demographics).toHaveProperty('department');
      expect(obj.compensation).toHaveProperty('salary');
      expect(obj.compensation).toHaveProperty('formatted');
      expect(obj.compensation.formatted).toMatch(/^\$[\d,]+$/);
    }
    
    // Test nested array conversion
    const nestedArrays = limitedResult.map(binding => [
      binding.get('person'),
      binding.get('name'),
      binding.get('age'),
      binding.get('salary'),
      binding.get('department')
    ]);
    
    expect(nestedArrays.length).toBe(5);
    for (const arr of nestedArrays) {
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(5);
    }
    
    // Test key-value pair conversion
    const keyValuePairs = limitedResult.map(binding => {
      const pairs = [];
      for (const [key, value] of binding) {
        pairs.push({ key, value, type: typeof value });
      }
      return pairs;
    });
    
    expect(keyValuePairs.length).toBe(5);
    for (const pairs of keyValuePairs) {
      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs.length).toBe(5); // 5 variables
      
      for (const pair of pairs) {
        expect(pair).toHaveProperty('key');
        expect(pair).toHaveProperty('value');
        expect(pair).toHaveProperty('type');
        expect(typeof pair.key).toBe('string');
        expect(['string', 'number', 'boolean'].includes(pair.type)).toBe(true);
      }
    }
    
    // Test grouped object conversion
    const groupedByDept = {};
    for (const binding of limitedResult) {
      const dept = binding.get('department');
      if (!groupedByDept[dept]) {
        groupedByDept[dept] = [];
      }
      groupedByDept[dept].push({
        id: binding.get('person'),
        name: binding.get('name'),
        age: binding.get('age'),
        salary: binding.get('salary')
      });
    }
    
    expect(typeof groupedByDept).toBe('object');
    for (const dept in groupedByDept) {
      expect(Array.isArray(groupedByDept[dept])).toBe(true);
      expect(groupedByDept[dept].length).toBeGreaterThan(0);
    }
  });
  
  test('Step 8.2.2: Test result streaming for large datasets', async () => {
    // Test streaming capabilities for large result sets
    
    // Get all people for large dataset testing
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const result = await query.execute(kg);
    expect(result.size()).toBe(100); // Should have 100 people
    
    // Test streaming with async iteration
    let streamCount = 0;
    const streamedData = [];
    
    for (const binding of result) {
      streamCount++;
      streamedData.push({
        id: binding.get('person'),
        name: binding.get('name'),
        age: binding.get('age')
      });
      
      // Simulate processing delay
      if (streamCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    expect(streamCount).toBe(100);
    expect(streamedData.length).toBe(100);
    
    // Test chunked processing
    const chunkSize = 10;
    const chunks = [];
    
    for (let i = 0; i < result.size(); i += chunkSize) {
      const chunk = result.offset(i).limit(chunkSize);
      chunks.push(chunk.toArray());
    }
    
    expect(chunks.length).toBe(10); // 100 / 10 = 10 chunks
    
    let totalProcessed = 0;
    for (const chunk of chunks) {
      expect(Array.isArray(chunk)).toBe(true);
      expect(chunk.length).toBeLessThanOrEqual(chunkSize);
      totalProcessed += chunk.length;
    }
    
    expect(totalProcessed).toBe(100);
    
    // Test memory-efficient streaming with generator
    function* resultGenerator(queryResult) {
      for (const binding of queryResult) {
        yield {
          person: binding.get('person'),
          name: binding.get('name'),
          age: binding.get('age')
        };
      }
    }
    
    const generator = resultGenerator(result);
    let generatorCount = 0;
    
    for (const item of generator) {
      generatorCount++;
      expect(item).toHaveProperty('person');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('age');
      
      // Only process first 20 to test early termination
      if (generatorCount >= 20) break;
    }
    
    expect(generatorCount).toBe(20);
    
    // Test streaming with filtering
    const filteredStream = result.filter(binding => binding.get('age') >= 30);
    let filteredCount = 0;
    
    for (const binding of filteredStream) {
      filteredCount++;
      expect(binding.get('age')).toBeGreaterThanOrEqual(30);
    }
    
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(100);
    
    // Test performance measurement
    const performanceStart = performance.now();
    
    const processedResults = result.map(binding => ({
      id: binding.get('person'),
      name: binding.get('name'),
      age: binding.get('age'),
      processed: true
    }));
    
    const performanceEnd = performance.now();
    const processingTime = performanceEnd - performanceStart;
    
    expect(processedResults.length).toBe(100);
    expect(processingTime).toBeLessThan(100); // Should be fast
    
    // Test memory usage estimation
    const memoryBefore = process.memoryUsage().heapUsed;
    const largeTransformation = result.map(binding => ({
      ...Object.fromEntries(binding),
      timestamp: new Date().toISOString(),
      processed: true,
      metadata: {
        source: 'test',
        version: '1.0'
      }
    }));
    const memoryAfter = process.memoryUsage().heapUsed;
    
    expect(largeTransformation.length).toBe(100);
    expect(memoryAfter).toBeGreaterThan(memoryBefore);
  });
  
  test('Step 8.2.3: Test result caching and reuse', async () => {
    // Test result caching mechanisms
    
    const personVar = new QueryVariable('person');
    const nameVar = new QueryVariable('name');
    const ageVar = new QueryVariable('age');
    
    const query = new PatternQuery();
    query.addPattern(new TriplePattern(personVar, 'rdf:type', 'Person'));
    query.addPattern(new TriplePattern(personVar, 'name', nameVar));
    query.addPattern(new TriplePattern(personVar, 'age', ageVar));
    
    const result = await query.execute(kg);
    
    // Test result caching
    const cache = new Map();
    const cacheKey = 'test-query-result';
    
    // Cache the result
    cache.set(cacheKey, {
      result: result.serialize(),
      timestamp: Date.now(),
      metadata: {
        size: result.size(),
        variables: result.variableNames
      }
    });
    
    expect(cache.has(cacheKey)).toBe(true);
    
    // Retrieve from cache
    const cachedData = cache.get(cacheKey);
    expect(cachedData).toBeDefined();
    expect(cachedData.metadata.size).toBe(result.size());
    expect(cachedData.metadata.variables).toEqual(result.variableNames);
    
    // Deserialize cached result
    const deserializedResult = QueryResult.deserialize(cachedData.result);
    expect(deserializedResult.size()).toBe(result.size());
    expect(deserializedResult.variableNames).toEqual(result.variableNames);
    
    // Test cache invalidation
    const cacheTimeout = 1000; // 1 second
    const isExpired = (Date.now() - cachedData.timestamp) > cacheTimeout;
    expect(isExpired).toBe(false); // Should not be expired yet
    
    // Test result reuse with transformations
    const baseResult = result.limit(10);
    
    // Create multiple derived results
    const sortedResult = baseResult.orderBy('age');
    const filteredResult = baseResult.filter(binding => binding.get('age') >= 25);
    const projectedResult = baseResult.project(['name', 'age']);
    
    // Verify they're independent
    expect(sortedResult.size()).toBe(baseResult.size());
    expect(filteredResult.size()).toBeLessThanOrEqual(baseResult.size());
    expect(projectedResult.variableNames).toEqual(['name', 'age']);
    
    // Test result sharing between operations
    const sharedBase = result.filter(binding => binding.get('age') >= 30);
    
    const operation1 = sharedBase.orderBy('name');
    const operation2 = sharedBase.orderBy('age');
    const operation3 = sharedBase.project(['name']);
    
    // All should work with the same base
    expect(operation1.size()).toBe(sharedBase.size());
    expect(operation2.size()).toBe(sharedBase.size());
    expect(operation3.size()).toBe(sharedBase.size());
    
    // Test memoization pattern
    const memoCache = new Map();
    
    function memoizedTransform(result, transformKey) {
      if (memoCache.has(transformKey)) {
        return memoCache.get(transformKey);
      }
      
      const transformed = result.map(binding => ({
        id: binding.get('person'),
        name: binding.get('name').toUpperCase(),
        age: binding.get('age'),
        ageGroup: binding.get('age') < 30 ? 'Young' : 'Senior'
      }));
      
      memoCache.set(transformKey, transformed);
      return transformed;
    }
    
    const transform1 = memoizedTransform(baseResult, 'uppercase-transform');
    const transform2 = memoizedTransform(baseResult, 'uppercase-transform');
    
    expect(transform1).toBe(transform2); // Should be the same reference
    expect(memoCache.size).toBe(1);
    
    // Test cache size management
    const maxCacheSize = 5;
    const lruCache = new Map();
    
    function addToLRUCache(key, value) {
      if (lruCache.has(key)) {
        lruCache.delete(key);
      } else if (lruCache.size >= maxCacheSize) {
        const firstKey = lruCache.keys().next().value;
        lruCache.delete(firstKey);
      }
      lruCache.set(key, value);
    }
    
    // Fill cache beyond capacity
    for (let i = 0; i < 7; i++) {
      addToLRUCache(`key${i}`, `value${i}`);
    }
    
    expect(lruCache.size).toBe(maxCacheSize);
    expect(lruCache.has('key0')).toBe(false); // Should be evicted
    expect(lruCache.has('key1')).toBe(false); // Should be evicted
    expect(lruCache.has('key6')).toBe(true); // Should be present
  });
  
  test('Step 8.2.4: Test result metadata and statistics', async () => {
    // Test comprehensive metadata and statistics collection
    
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
    
    const startTime = performance.now();
    const result = await query.execute(kg);
    const endTime = performance.now();
    
    // Set execution time
    result.executionTime = endTime - startTime;
    
    // Test basic metadata
    expect(result.size()).toBe(100);
    expect(result.variableNames).toEqual(['person', 'name', 'age', 'salary', 'department']);
    expect(result.executionTime).toBeGreaterThan(0);
    
    // Test enhanced metadata collection
    const metadata = {
      resultCount: result.size(),
      variableCount: result.variableNames.length,
      executionTime: result.executionTime,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date().toISOString()
    };
    
    result.metadata = metadata;
    
    expect(result.metadata.resultCount).toBe(100);
    expect(result.metadata.variableCount).toBe(5);
    expect(result.metadata.executionTime).toBeGreaterThan(0);
    
    // Test statistical analysis
    const ages = result.map(binding => binding.get('age'));
    const salaries = result.map(binding => binding.get('salary'));
    
    const ageStats = {
      min: Math.min(...ages),
      max: Math.max(...ages),
      mean: ages.reduce((sum, age) => sum + age, 0) / ages.length,
      median: ages.sort((a, b) => a - b)[Math.floor(ages.length / 2)]
    };
    
    const salaryStats = {
      min: Math.min(...salaries),
      max: Math.max(...salaries),
      mean: salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length,
      total: salaries.reduce((sum, salary) => sum + salary, 0)
    };
    
    expect(ageStats.min).toBeGreaterThan(0);
    expect(ageStats.max).toBeGreaterThan(ageStats.min);
    expect(ageStats.mean).toBeGreaterThan(ageStats.min);
    expect(ageStats.mean).toBeLessThan(ageStats.max);
    
    expect(salaryStats.min).toBeGreaterThan(0);
    expect(salaryStats.max).toBeGreaterThan(salaryStats.min);
    expect(salaryStats.total).toBeGreaterThan(salaryStats.max);
    
    // Test distribution analysis
    const departmentDistribution = {};
    for (const binding of result) {
      const dept = binding.get('department');
      departmentDistribution[dept] = (departmentDistribution[dept] || 0) + 1;
    }
    
    expect(Object.keys(departmentDistribution).length).toBeGreaterThan(1);
    
    let totalDistribution = 0;
    for (const count of Object.values(departmentDistribution)) {
      expect(count).toBeGreaterThan(0);
      totalDistribution += count;
    }
    expect(totalDistribution).toBe(100);
    
    // Test data quality metrics
    const qualityMetrics = {
      completeness: {},
      uniqueness: {},
      validity: {}
    };
    
    // Completeness check
    for (const varName of result.variableNames) {
      const nonNullCount = result.filter(binding => 
        binding.get(varName) !== null && binding.get(varName) !== undefined
      ).size();
      qualityMetrics.completeness[varName] = nonNullCount / result.size();
    }
    
    // Uniqueness check
    for (const varName of result.variableNames) {
      const values = result.map(binding => binding.get(varName));
      const uniqueValues = new Set(values);
      qualityMetrics.uniqueness[varName] = uniqueValues.size / values.length;
    }
    
    // Validity check (basic type checking)
    for (const varName of result.variableNames) {
      const values = result.map(binding => binding.get(varName));
      const validCount = values.filter(value => {
        switch (varName) {
          case 'age':
          case 'salary':
            return typeof value === 'number' && value > 0;
          case 'name':
          case 'department':
          case 'person':
            return typeof value === 'string' && value.length > 0;
          default:
            return true;
        }
      }).length;
      qualityMetrics.validity[varName] = validCount / values.length;
    }
    
    // Verify quality metrics
    for (const varName of result.variableNames) {
      expect(qualityMetrics.completeness[varName]).toBeGreaterThan(0.9); // 90%+ complete
      expect(qualityMetrics.validity[varName]).toBe(1.0); // 100% valid
    }
    
    // Test performance profiling
    const profileData = {
      queryComplexity: query.patterns.length,
      resultSize: result.size(),
      processingTime: result.executionTime,
      throughput: result.size() / (result.executionTime / 1000), // results per second
      memoryEfficiency: result.size() / (process.memoryUsage().heapUsed / 1024 / 1024) // results per MB
    };
    
    expect(profileData.queryComplexity).toBe(5); // 5 patterns
    expect(profileData.resultSize).toBe(100);
    expect(profileData.throughput).toBeGreaterThan(0);
    expect(profileData.memoryEfficiency).toBeGreaterThan(0);
    
    // Test result fingerprinting
    const fingerprint = {
      size: result.size(),
      variables: result.variableNames.sort().join(','),
      checksum: result.map(binding => 
        result.variableNames.map(v => binding.get(v)).join('|')
      ).join('\n').length // Simple checksum
    };
    
    expect(fingerprint.size).toBe(100);
    expect(fingerprint.variables).toBe('age,department,name,person,salary');
    expect(fingerprint.checksum).toBeGreaterThan(0);
  });
  
  test('Step 8.2.5: Test result format conversion (JSON, CSV, etc.)', async () => {
    // Test comprehensive format conversion capabilities
    
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
    const testResult = result.limit(5); // Use smaller set for detailed testing
    
    // Test JSON conversion
    const jsonResult = testResult.toJSON();
    expect(typeof jsonResult).toBe('object');
    expect(jsonResult).toHaveProperty('bindings');
    expect(jsonResult).toHaveProperty('variableNames');
    expect(jsonResult).toHaveProperty('size');
    expect(Array.isArray(jsonResult.bindings)).toBe(true);
    expect(Array.isArray(jsonResult.variableNames)).toBe(true);
    expect(jsonResult.size).toBe(5);
    
    // Test JSON string serialization
    const jsonString = testResult.serialize();
    expect(typeof jsonString).toBe('string');
    
    const parsedJson = JSON.parse(jsonString);
    expect(parsedJson).toHaveProperty('bindings');
    expect(parsedJson.bindings.length).toBe(5);
    
    // Test CSV conversion
    const csvData = testResult.toCSV();
    expect(typeof csvData).toBe('string');
    
    const csvLines = csvData.split('\n');
    expect(csvLines.length).toBe(6); // header + 5 data rows
    
    const csvHeader = csvLines[0].split(',');
    expect(csvHeader).toContain('person');
    expect(csvHeader).toContain('name');
    expect(csvHeader).toContain('age');
    expect(csvHeader).toContain('salary');
    
    // Verify CSV data integrity
    for (let i = 1; i < csvLines.length; i++) {
      const row = csvLines[i].split(',');
      expect(row.length).toBe(csvHeader.length);
    }
    
    // Test CSV with special characters
    const specialData = new QueryResult(null, [
      new Map([
        ['name', 'John "Johnny" Doe'],
        ['description', 'Works in Sales, Marketing'],
        ['note', 'Has a "quote" and comma, in text']
      ])
    ], ['name', 'description', 'note']);
    
    const specialCsv = specialData.toCSV();
    expect(specialCsv).toContain('"John ""Johnny"" Doe"');
    expect(specialCsv).toContain('"Works in Sales, Marketing"');
    expect(specialCsv).toContain('"Has a ""quote"" and comma, in text"');
    
    // Test TSV conversion
    const tsvData = testResult.toTSV();
    expect(typeof tsvData).toBe('string');
    expect(tsvData).toContain('\t');
    
    const tsvLines = tsvData.split('\n');
    expect(tsvLines.length).toBe(6); // header + 5 data rows
    
    const tsvHeader = tsvLines[0].split('\t');
    expect(tsvHeader.length).toBe(4); // 4 variables
    
    // Test XML conversion
    const xmlData = testResult.toXML();
    expect(typeof xmlData).toBe('string');
    expect(xmlData).toContain('<result>');
    expect(xmlData).toContain('<binding>');
    expect(xmlData).toContain('</binding>');
    expect(xmlData).toContain('</result>');
    
    // Count XML bindings
    const bindingMatches = xmlData.match(/<binding>/g);
    expect(bindingMatches.length).toBe(5);
    
    // Test XML escaping
    const xmlSpecialData = new QueryResult(null, [
      new Map([
        ['name', 'John & Jane'],
        ['description', '<script>alert("test")</script>'],
        ['quote', 'He said "Hello" & left']
      ])
    ], ['name', 'description', 'quote']);
    
    const xmlSpecial = xmlSpecialData.toXML();
    expect(xmlSpecial).toContain('John &amp; Jane');
    expect(xmlSpecial).toContain('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
    expect(xmlSpecial).toContain('He said &quot;Hello&quot; &amp; left');
    
    // Test RDF triple conversion
    const tripleData = testResult.toTriples();
    expect(Array.isArray(tripleData)).toBe(true);
    expect(tripleData.length).toBeGreaterThan(0);
    
    // Verify triple structure
    for (const triple of tripleData) {
      expect(Array.isArray(triple)).toBe(true);
      expect(triple.length).toBe(3);
      expect(typeof triple[0]).toBe('string'); // subject
      expect(typeof triple[1]).toBe('string'); // predicate
      // object can be various types
    }
    
    // Test custom format conversion
    const customFormat = testResult.map(binding => {
      return `${binding.get('name')} (${binding.get('age')}) - $${binding.get('salary')}`;
    }).join('\n');
    
    expect(typeof customFormat).toBe('string');
    expect(customFormat.split('\n').length).toBe(5);
    
    // Test format conversion with options
    const detailedJson = testResult.toJSON();
    detailedJson.metadata = {
      exportTime: new Date().toISOString(),
      format: 'detailed',
      version: '1.0'
    };
    
    expect(detailedJson.metadata).toBeDefined();
    expect(detailedJson.metadata.exportTime).toBeDefined();
    expect(detailedJson.metadata.format).toBe('detailed');
    
    // Test round-trip format conversion
    const originalJson = testResult.toJSON();
    const jsonStringRoundTrip = JSON.stringify(originalJson);
    const parsedBack = JSON.parse(jsonStringRoundTrip);
    
    expect(parsedBack.bindings.length).toBe(originalJson.bindings.length);
    expect(parsedBack.variableNames).toEqual(originalJson.variableNames);
    
    // Test format validation
    const csvValidation = testResult.toCSV();
    const csvRows = csvValidation.split('\n');
    const headerCount = csvRows[0].split(',').length;
    
    for (let i = 1; i < csvRows.length; i++) {
      const rowCount = csvRows[i].split(',').length;
      expect(rowCount).toBe(headerCount);
    }
    
    // Test empty result format conversion
    const emptyResult = new QueryResult(null, [], ['name', 'age']);
    
    expect(emptyResult.toCSV()).toBe('');
    expect(emptyResult.toTSV()).toBe('');
    expect(emptyResult.toXML()).toBe('<result>\n</result>');
    
    const emptyJson = emptyResult.toJSON();
    expect(emptyJson.bindings.length).toBe(0);
    expect(emptyJson.size).toBe(0);
  });
});
