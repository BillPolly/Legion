import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TraversalQuery } from '../../../src/query/types/TraversalQuery.js';
import { FixedLengthPath } from '../../../src/query/paths/FixedLengthPath.js';
import { VariableLengthPath } from '../../../src/query/paths/VariableLengthPath.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 4.2: Traversal Query Execution', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for traversal testing
    // Create a more complex graph for traversal testing
    
    // People network
    kg.addTriple('alice', 'rdf:type', 'Person');
    kg.addTriple('alice', 'name', 'Alice Smith');
    kg.addTriple('alice', 'age', 30);
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 25);
    
    kg.addTriple('charlie', 'rdf:type', 'Person');
    kg.addTriple('charlie', 'name', 'Charlie Brown');
    kg.addTriple('charlie', 'age', 35);
    
    kg.addTriple('diana', 'rdf:type', 'Person');
    kg.addTriple('diana', 'name', 'Diana Prince');
    kg.addTriple('diana', 'age', 28);
    
    kg.addTriple('eve', 'rdf:type', 'Person');
    kg.addTriple('eve', 'name', 'Eve Wilson');
    kg.addTriple('eve', 'age', 32);
    
    kg.addTriple('frank', 'rdf:type', 'Person');
    kg.addTriple('frank', 'name', 'Frank Miller');
    kg.addTriple('frank', 'age', 40);
    
    // Create a connected social network
    // Alice knows Bob and Charlie
    kg.addTriple('alice', 'knows', 'bob');
    kg.addTriple('alice', 'knows', 'charlie');
    
    // Bob knows Diana and Eve
    kg.addTriple('bob', 'knows', 'diana');
    kg.addTriple('bob', 'knows', 'eve');
    
    // Charlie knows Diana and Frank
    kg.addTriple('charlie', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'frank');
    
    // Diana knows Eve and Frank
    kg.addTriple('diana', 'knows', 'eve');
    kg.addTriple('diana', 'knows', 'frank');
    
    // Eve knows Frank (completing some cycles)
    kg.addTriple('eve', 'knows', 'frank');
    
    // Add some friendship relationships (bidirectional)
    kg.addTriple('alice', 'friendOf', 'bob');
    kg.addTriple('bob', 'friendOf', 'alice');
    kg.addTriple('bob', 'friendOf', 'diana');
    kg.addTriple('diana', 'friendOf', 'bob');
    kg.addTriple('charlie', 'friendOf', 'frank');
    kg.addTriple('frank', 'friendOf', 'charlie');
    
    // Work relationships
    kg.addTriple('alice', 'worksAt', 'company1');
    kg.addTriple('bob', 'worksAt', 'company1');
    kg.addTriple('charlie', 'worksAt', 'company2');
    kg.addTriple('diana', 'worksAt', 'company2');
    kg.addTriple('eve', 'worksAt', 'company3');
    kg.addTriple('frank', 'worksAt', 'company3');
    
    // Management hierarchy
    kg.addTriple('alice', 'manages', 'bob');
    kg.addTriple('charlie', 'manages', 'diana');
    kg.addTriple('diana', 'manages', 'eve');
    kg.addTriple('frank', 'manages', 'eve'); // Eve has two managers
    
    // Companies
    kg.addTriple('company1', 'rdf:type', 'Company');
    kg.addTriple('company1', 'name', 'Tech Corp');
    kg.addTriple('company2', 'rdf:type', 'Company');
    kg.addTriple('company2', 'name', 'Data Inc');
    kg.addTriple('company3', 'rdf:type', 'Company');
    kg.addTriple('company3', 'name', 'AI Solutions');
    
    // Company relationships
    kg.addTriple('company1', 'partnerWith', 'company2');
    kg.addTriple('company2', 'partnerWith', 'company1');
    kg.addTriple('company2', 'subsidiaryOf', 'company3');
    kg.addTriple('company3', 'parentOf', 'company2');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 4.2.1: Test fixed-length path traversal', async () => {
    // Test single-step traversal (length 1)
    const singleStepQuery = new TraversalQuery('alice', new FixedLengthPath('knows', 1));
    const singleStepResults = await singleStepQuery.execute(kg);
    
    expect(singleStepResults).toBeDefined();
    expect(singleStepResults.bindings).toBeDefined();
    expect(singleStepResults.bindings.length).toBe(2); // alice knows bob and charlie
    
    const targets = singleStepResults.bindings.map(binding => binding.get('target'));
    expect(targets).toContain('bob');
    expect(targets).toContain('charlie');
    
    // Test two-step traversal (length 2)
    const twoStepQuery = new TraversalQuery('alice', new FixedLengthPath('knows', 2));
    const twoStepResults = await twoStepQuery.execute(kg);
    
    expect(twoStepResults.bindings.length).toBeGreaterThan(0);
    
    // Alice -> Bob -> Diana/Eve, Alice -> Charlie -> Diana/Frank
    const twoStepTargets = twoStepResults.bindings.map(binding => binding.get('target'));
    expect(twoStepTargets).toContain('diana'); // via bob or charlie
    expect(twoStepTargets).toContain('eve'); // via bob
    expect(twoStepTargets).toContain('frank'); // via charlie
    
    // Test three-step traversal (length 3)
    const threeStepQuery = new TraversalQuery('alice', new FixedLengthPath('knows', 3));
    const threeStepResults = await threeStepQuery.execute(kg);
    
    expect(threeStepResults.bindings.length).toBeGreaterThan(0);
    
    // Should reach frank via multiple paths
    const threeStepTargets = threeStepResults.bindings.map(binding => binding.get('target'));
    expect(threeStepTargets).toContain('frank');
    
    // Test zero-length traversal (identity)
    const identityQuery = new TraversalQuery('alice', new FixedLengthPath('knows', 0));
    const identityResults = await identityQuery.execute(kg);
    
    expect(identityResults.bindings.length).toBe(1);
    expect(identityResults.bindings[0].get('target')).toBe('alice');
    
    // Test traversal with different predicates
    const managementQuery = new TraversalQuery('alice', new FixedLengthPath('manages', 1));
    const managementResults = await managementQuery.execute(kg);
    
    expect(managementResults.bindings.length).toBe(1);
    expect(managementResults.bindings[0].get('target')).toBe('bob');
    
    // Test traversal with no results
    const noResultQuery = new TraversalQuery('alice', new FixedLengthPath('nonExistentPredicate', 1));
    const noResults = await noResultQuery.execute(kg);
    
    expect(noResults.bindings.length).toBe(0);
    
    // Test incoming direction traversal
    const incomingQuery = new TraversalQuery('bob', new FixedLengthPath('knows', 1, 'incoming'));
    const incomingResults = await incomingQuery.execute(kg);
    
    expect(incomingResults.bindings.length).toBe(1);
    expect(incomingResults.bindings[0].get('target')).toBe('alice'); // alice knows bob
    
    // Test bidirectional traversal
    const bidirectionalQuery = new TraversalQuery('bob', new FixedLengthPath('friendOf', 1, 'both'));
    const bidirectionalResults = await bidirectionalQuery.execute(kg);
    
    expect(bidirectionalResults.bindings.length).toBe(4); // alice and diana (both directions)
    const bidirectionalTargets = bidirectionalResults.bindings.map(binding => binding.get('target'));
    expect(bidirectionalTargets).toContain('alice');
    expect(bidirectionalTargets).toContain('diana');
  });
  
  test('Step 4.2.2: Test variable-length path traversal', async () => {
    // Test 1-2 step traversal
    const shortRangeQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 2));
    const shortRangeResults = await shortRangeQuery.execute(kg);
    
    expect(shortRangeResults.bindings.length).toBeGreaterThan(2); // 1-step + 2-step results
    
    const shortTargets = shortRangeResults.bindings.map(binding => binding.get('target'));
    // Should include 1-step: bob, charlie
    expect(shortTargets).toContain('bob');
    expect(shortTargets).toContain('charlie');
    // Should include 2-step: diana, eve, frank
    expect(shortTargets).toContain('diana');
    expect(shortTargets).toContain('eve');
    expect(shortTargets).toContain('frank');
    
    // Test 0-1 step traversal (including identity)
    const identityRangeQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 0, 1));
    const identityRangeResults = await identityRangeQuery.execute(kg);
    
    expect(identityRangeResults.bindings.length).toBe(3); // alice (0-step) + bob, charlie (1-step)
    const identityTargets = identityRangeResults.bindings.map(binding => binding.get('target'));
    expect(identityTargets).toContain('alice'); // 0-step
    expect(identityTargets).toContain('bob'); // 1-step
    expect(identityTargets).toContain('charlie'); // 1-step
    
    // Test longer range traversal (1-3 steps)
    const longRangeQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    const longRangeResults = await longRangeQuery.execute(kg);
    
    expect(longRangeResults.bindings.length).toBeGreaterThan(5);
    
    // Should reach all nodes in the connected component
    const longTargets = longRangeResults.bindings.map(binding => binding.get('target'));
    expect(longTargets).toContain('bob');
    expect(longTargets).toContain('charlie');
    expect(longTargets).toContain('diana');
    expect(longTargets).toContain('eve');
    expect(longTargets).toContain('frank');
    
    // Test unbounded traversal (with reasonable limit)
    const unboundedQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, null));
    unboundedQuery.setMaxDepth(4); // Set reasonable limit
    const unboundedResults = await unboundedQuery.execute(kg);
    
    expect(unboundedResults.bindings.length).toBeGreaterThan(5);
    
    // Should eventually reach all connected nodes
    const unboundedTargets = unboundedResults.bindings.map(binding => binding.get('target'));
    expect(unboundedTargets).toContain('frank');
    
    // Test variable-length with different predicates
    const managementRangeQuery = new TraversalQuery('alice', new VariableLengthPath('manages', 1, 2));
    const managementRangeResults = await managementRangeQuery.execute(kg);
    
    expect(managementRangeResults.bindings.length).toBe(1); // alice -> bob (no 2-step management from alice)
    expect(managementRangeResults.bindings[0].get('target')).toBe('bob');
    
    // Test variable-length with incoming direction
    const incomingRangeQuery = new TraversalQuery('frank', new VariableLengthPath('knows', 1, 2, 'incoming'));
    const incomingRangeResults = await incomingRangeQuery.execute(kg);
    
    expect(incomingRangeResults.bindings.length).toBeGreaterThan(0);
    const incomingTargets = incomingRangeResults.bindings.map(binding => binding.get('target'));
    expect(incomingTargets).toContain('charlie'); // charlie knows frank
    expect(incomingTargets).toContain('diana'); // diana knows frank
    expect(incomingTargets).toContain('eve'); // eve knows frank
    
    // Test variable-length with bidirectional
    const bidirectionalRangeQuery = new TraversalQuery('bob', new VariableLengthPath('friendOf', 1, 2, 'both'));
    const bidirectionalRangeResults = await bidirectionalRangeQuery.execute(kg);
    
    expect(bidirectionalRangeResults.bindings.length).toBeGreaterThan(1);
    const bidirectionalTargets = bidirectionalRangeResults.bindings.map(binding => binding.get('target'));
    expect(bidirectionalTargets).toContain('alice');
    expect(bidirectionalTargets).toContain('diana');
  });
  
  test('Step 4.2.3: Test traversal with cycle detection', async () => {
    // Add some cycles to the graph
    kg.addTriple('frank', 'knows', 'alice'); // Creates cycle: alice -> charlie -> frank -> alice
    
    // Test cycle detection with fixed-length path
    const cyclicFixedQuery = new TraversalQuery('alice', new FixedLengthPath('knows', 3));
    cyclicFixedQuery.enableCycleDetection(true);
    const cyclicFixedResults = await cyclicFixedQuery.execute(kg);
    
    expect(cyclicFixedResults.bindings.length).toBeGreaterThan(0);
    
    // Should detect that alice can reach herself in 3 steps
    const cyclicTargets = cyclicFixedResults.bindings.map(binding => binding.get('target'));
    expect(cyclicTargets).toContain('alice'); // alice -> charlie -> frank -> alice
    
    // Test cycle detection with variable-length path
    const cyclicVariableQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 4));
    cyclicVariableQuery.enableCycleDetection(true);
    const cyclicVariableResults = await cyclicVariableQuery.execute(kg);
    
    expect(cyclicVariableResults.bindings.length).toBeGreaterThan(5);
    
    // Should find alice at different path lengths due to cycles
    const cyclicVariableTargets = cyclicVariableResults.bindings.map(binding => binding.get('target'));
    expect(cyclicVariableTargets).toContain('alice');
    
    // Test cycle avoidance
    const noCycleQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 5));
    noCycleQuery.enableCycleDetection(false); // Allow cycles
    noCycleQuery.avoidCycles(true); // But avoid revisiting nodes
    const noCycleResults = await noCycleQuery.execute(kg);
    
    // Should visit each node at most once
    const noCycleTargets = noCycleResults.bindings.map(binding => binding.get('target'));
    const uniqueTargets = new Set(noCycleTargets);
    
    // Each target should appear only once per path length
    expect(uniqueTargets.size).toBeLessThanOrEqual(6); // 6 people in the graph
    
    // Test cycle detection statistics
    expect(cyclicVariableQuery.getExecutionStats().cyclesDetected).toBeGreaterThan(0);
    expect(cyclicVariableQuery.getExecutionStats().nodesRevisited).toBeGreaterThan(0);
    
    // Test cycle detection with path constraints
    const constrainedCyclicQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    constrainedCyclicQuery.enableCycleDetection(true);
    constrainedCyclicQuery.addPathConstraint('maxCycles', 2);
    const constrainedResults = await constrainedCyclicQuery.execute(kg);
    
    expect(constrainedResults.bindings.length).toBeGreaterThan(0);
    expect(constrainedCyclicQuery.getExecutionStats().cyclesDetected).toBeLessThanOrEqual(2);
    
    // Remove the cycle for other tests
    kg.removeTriple('frank', 'knows', 'alice');
  });
  
  test('Step 4.2.4: Test traversal result collection and binding', async () => {
    // Test basic result structure
    const basicQuery = new TraversalQuery('alice', new FixedLengthPath('knows', 2));
    const basicResults = await basicQuery.execute(kg);
    
    expect(basicResults).toBeDefined();
    expect(basicResults.bindings).toBeDefined();
    expect(Array.isArray(basicResults.bindings)).toBe(true);
    expect(basicResults.variableNames).toBeDefined();
    expect(basicResults.variableNames).toContain('target');
    expect(basicResults.variableNames).toContain('path');
    
    // Test path information in results
    basicResults.bindings.forEach(binding => {
      expect(binding.has('target')).toBe(true);
      expect(binding.has('path')).toBe(true);
      expect(binding.get('target')).toBeDefined();
      expect(binding.get('path')).toBeDefined();
      
      const path = binding.get('path');
      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBe(3); // start + 2 intermediate steps
      expect(path[0]).toBe('alice'); // starts with alice
    });
    
    // Test intermediate node collection
    const intermediateQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 2, 3));
    intermediateQuery.collectIntermediateNodes(true);
    const intermediateResults = await intermediateQuery.execute(kg);
    
    intermediateResults.bindings.forEach(binding => {
      expect(binding.has('intermediates')).toBe(true);
      const intermediates = binding.get('intermediates');
      expect(Array.isArray(intermediates)).toBe(true);
      
      const pathLength = binding.get('pathLength');
      expect(intermediates.length).toBe(pathLength - 1); // excluding start and end
    });
    
    // Test path length information
    const pathLengthQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    const pathLengthResults = await pathLengthQuery.execute(kg);
    
    pathLengthResults.bindings.forEach(binding => {
      expect(binding.has('pathLength')).toBe(true);
      const pathLength = binding.get('pathLength');
      expect(pathLength).toBeGreaterThanOrEqual(1);
      expect(pathLength).toBeLessThanOrEqual(3);
    });
    
    // Test result filtering by path length
    const filteredResults = pathLengthResults.bindings.filter(binding => 
      binding.get('pathLength') === 2
    );
    expect(filteredResults.length).toBeGreaterThan(0);
    
    // Test result aggregation
    const targetCounts = new Map();
    pathLengthResults.bindings.forEach(binding => {
      const target = binding.get('target');
      targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    });
    
    // Some targets should be reachable via multiple paths
    expect(targetCounts.get('diana')).toBeGreaterThan(1); // via bob and charlie
    
    // Test result metadata
    expect(basicResults.executionTime).toBeDefined();
    expect(basicResults.pathsExplored).toBeDefined();
    expect(basicResults.nodesVisited).toBeDefined();
    
    // Test result serialization
    const serializedResults = basicResults.toTriples();
    expect(Array.isArray(serializedResults)).toBe(true);
    expect(serializedResults.length).toBeGreaterThan(0);
    
    // Test result export formats
    const arrayResults = basicResults.toArray();
    expect(Array.isArray(arrayResults)).toBe(true);
    expect(arrayResults.length).toBe(basicResults.bindings.length);
    
    const objectResults = basicResults.toObjects();
    expect(Array.isArray(objectResults)).toBe(true);
    objectResults.forEach(obj => {
      expect(obj.target).toBeDefined();
      expect(obj.path).toBeDefined();
    });
  });
  
  test('Step 4.2.5: Test traversal performance with large graphs', async () => {
    // Create a larger graph for performance testing
    const nodeCount = 50;
    const edgeCount = 150;
    
    // Generate nodes
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = `node_${i}`;
      kg.addTriple(nodeId, 'rdf:type', 'TestNode');
      kg.addTriple(nodeId, 'value', i);
    }
    
    // Generate random edges
    for (let i = 0; i < edgeCount; i++) {
      const from = `node_${Math.floor(Math.random() * nodeCount)}`;
      const to = `node_${Math.floor(Math.random() * nodeCount)}`;
      if (from !== to) {
        kg.addTriple(from, 'connects', to);
      }
    }
    
    // Test performance with fixed-length traversal
    const perfFixedQuery = new TraversalQuery('node_0', new FixedLengthPath('connects', 3));
    const startTime = Date.now();
    const perfFixedResults = await perfFixedQuery.execute(kg);
    const fixedExecutionTime = Date.now() - startTime;
    
    expect(perfFixedResults.bindings.length).toBeGreaterThanOrEqual(0);
    expect(fixedExecutionTime).toBeLessThan(1000); // Should complete within 1 second
    
    // Test performance with variable-length traversal
    const perfVariableQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 4));
    const variableStartTime = Date.now();
    const perfVariableResults = await perfVariableQuery.execute(kg);
    const variableExecutionTime = Date.now() - variableStartTime;
    
    expect(perfVariableResults.bindings.length).toBeGreaterThanOrEqual(0);
    expect(variableExecutionTime).toBeLessThan(2000); // Should complete within 2 seconds
    
    // Test performance with optimization
    const optimizedQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 3));
    optimizedQuery.enableOptimization(true);
    const optimizedStartTime = Date.now();
    const optimizedResults = await optimizedQuery.execute(kg);
    const optimizedExecutionTime = Date.now() - optimizedStartTime;
    
    expect(optimizedResults.bindings.length).toBeGreaterThanOrEqual(0);
    // Optimized query should be faster or similar
    expect(optimizedExecutionTime).toBeLessThanOrEqual(variableExecutionTime * 1.2);
    
    // Test memory usage tracking
    const memoryQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 3));
    memoryQuery.trackMemoryUsage(true);
    await memoryQuery.execute(kg);
    
    const memoryStats = memoryQuery.getMemoryStats();
    expect(memoryStats.peakMemoryUsage).toBeDefined();
    expect(memoryStats.averageMemoryUsage).toBeDefined();
    expect(memoryStats.memoryEfficiency).toBeDefined();
    
    // Test performance with different strategies
    const breadthFirstQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 3));
    breadthFirstQuery.setTraversalStrategy('breadth-first');
    const bfStartTime = Date.now();
    await breadthFirstQuery.execute(kg);
    const bfExecutionTime = Date.now() - bfStartTime;
    
    const depthFirstQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 3));
    depthFirstQuery.setTraversalStrategy('depth-first');
    const dfStartTime = Date.now();
    await depthFirstQuery.execute(kg);
    const dfExecutionTime = Date.now() - dfStartTime;
    
    // Both strategies should complete in reasonable time
    expect(bfExecutionTime).toBeLessThan(2000);
    expect(dfExecutionTime).toBeLessThan(2000);
    
    // Test performance statistics
    const statsQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 2));
    await statsQuery.execute(kg);
    
    const stats = statsQuery.getExecutionStats();
    expect(stats.nodesVisited).toBeGreaterThan(0);
    expect(stats.edgesTraversed).toBeGreaterThan(0);
    expect(stats.pathsExplored).toBeGreaterThan(0);
    expect(stats.executionTime).toBeGreaterThan(0);
    expect(stats.averagePathLength).toBeGreaterThan(0);
    
    // Test scalability with larger depth
    const deepQuery = new TraversalQuery('node_0', new VariableLengthPath('connects', 1, 5));
    deepQuery.setMaxResults(100); // Limit results for performance
    const deepStartTime = Date.now();
    const deepResults = await deepQuery.execute(kg);
    const deepExecutionTime = Date.now() - deepStartTime;
    
    expect(deepResults.bindings.length).toBeLessThanOrEqual(100);
    expect(deepExecutionTime).toBeLessThan(3000); // Should still complete reasonably fast
  });
});
