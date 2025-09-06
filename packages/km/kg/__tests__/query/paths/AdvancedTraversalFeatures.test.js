import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TraversalQuery } from '../../../src/query/types/TraversalQuery.js';
import { FixedLengthPath } from '../../../src/query/paths/FixedLengthPath.js';
import { VariableLengthPath } from '../../../src/query/paths/VariableLengthPath.js';
import { RangeConstraint } from '../../../src/query/constraints/RangeConstraint.js';
import { FunctionConstraint } from '../../../src/query/constraints/FunctionConstraint.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 4.3: Advanced Traversal Features', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for advanced traversal testing
    // Create a complex graph with multiple relationship types and properties
    
    // People with detailed properties
    kg.addTriple('alice', 'rdf:type', 'Person');
    kg.addTriple('alice', 'name', 'Alice Smith');
    kg.addTriple('alice', 'age', 30);
    kg.addTriple('alice', 'salary', 75000);
    kg.addTriple('alice', 'department', 'Engineering');
    kg.addTriple('alice', 'level', 'Senior');
    
    kg.addTriple('bob', 'rdf:type', 'Person');
    kg.addTriple('bob', 'name', 'Bob Johnson');
    kg.addTriple('bob', 'age', 25);
    kg.addTriple('bob', 'salary', 60000);
    kg.addTriple('bob', 'department', 'Engineering');
    kg.addTriple('bob', 'level', 'Junior');
    
    kg.addTriple('charlie', 'rdf:type', 'Person');
    kg.addTriple('charlie', 'name', 'Charlie Brown');
    kg.addTriple('charlie', 'age', 35);
    kg.addTriple('charlie', 'salary', 90000);
    kg.addTriple('charlie', 'department', 'Sales');
    kg.addTriple('charlie', 'level', 'Manager');
    
    kg.addTriple('diana', 'rdf:type', 'Person');
    kg.addTriple('diana', 'name', 'Diana Prince');
    kg.addTriple('diana', 'age', 28);
    kg.addTriple('diana', 'salary', 85000);
    kg.addTriple('diana', 'department', 'Marketing');
    kg.addTriple('diana', 'level', 'Senior');
    
    kg.addTriple('eve', 'rdf:type', 'Person');
    kg.addTriple('eve', 'name', 'Eve Wilson');
    kg.addTriple('eve', 'age', 32);
    kg.addTriple('eve', 'salary', 95000);
    kg.addTriple('eve', 'department', 'Marketing');
    kg.addTriple('eve', 'level', 'Manager');
    
    kg.addTriple('frank', 'rdf:type', 'Person');
    kg.addTriple('frank', 'name', 'Frank Miller');
    kg.addTriple('frank', 'age', 40);
    kg.addTriple('frank', 'salary', 120000);
    kg.addTriple('frank', 'department', 'Executive');
    kg.addTriple('frank', 'level', 'Director');
    
    // Relationships with properties
    kg.addTriple('alice', 'knows', 'bob');
    kg.addTriple('alice', 'knows', 'charlie');
    kg.addTriple('bob', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'eve');
    kg.addTriple('diana', 'knows', 'eve');
    kg.addTriple('eve', 'knows', 'frank');
    
    // Friendship relationships
    kg.addTriple('alice', 'friendOf', 'bob');
    kg.addTriple('bob', 'friendOf', 'alice');
    kg.addTriple('bob', 'friendOf', 'diana');
    kg.addTriple('diana', 'friendOf', 'bob');
    kg.addTriple('charlie', 'friendOf', 'eve');
    kg.addTriple('eve', 'friendOf', 'charlie');
    
    // Management hierarchy
    kg.addTriple('alice', 'manages', 'bob');
    kg.addTriple('charlie', 'manages', 'diana');
    kg.addTriple('eve', 'manages', 'diana');
    kg.addTriple('frank', 'manages', 'charlie');
    kg.addTriple('frank', 'manages', 'eve');
    
    // Collaboration relationships
    kg.addTriple('alice', 'collaboratesWith', 'charlie');
    kg.addTriple('charlie', 'collaboratesWith', 'alice');
    kg.addTriple('bob', 'collaboratesWith', 'diana');
    kg.addTriple('diana', 'collaboratesWith', 'bob');
    kg.addTriple('diana', 'collaboratesWith', 'eve');
    kg.addTriple('eve', 'collaboratesWith', 'diana');
    
    // Mentorship relationships
    kg.addTriple('alice', 'mentors', 'bob');
    kg.addTriple('charlie', 'mentors', 'diana');
    kg.addTriple('eve', 'mentors', 'diana');
    kg.addTriple('frank', 'mentors', 'eve');
    
    // Companies and projects
    kg.addTriple('company1', 'rdf:type', 'Company');
    kg.addTriple('company1', 'name', 'Tech Corp');
    kg.addTriple('project1', 'rdf:type', 'Project');
    kg.addTriple('project1', 'name', 'AI Platform');
    kg.addTriple('project1', 'budget', 500000);
    kg.addTriple('project1', 'priority', 'High');
    
    // Work relationships
    kg.addTriple('alice', 'worksAt', 'company1');
    kg.addTriple('bob', 'worksAt', 'company1');
    kg.addTriple('charlie', 'worksAt', 'company1');
    kg.addTriple('diana', 'worksAt', 'company1');
    kg.addTriple('eve', 'worksAt', 'company1');
    kg.addTriple('frank', 'worksAt', 'company1');
    
    // Project assignments
    kg.addTriple('alice', 'worksOn', 'project1');
    kg.addTriple('bob', 'worksOn', 'project1');
    kg.addTriple('diana', 'worksOn', 'project1');
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 4.3.1: Test conditional path traversal', async () => {
    // Test traversal with node property conditions
    const conditionalQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    
    // Add condition: only traverse to people with salary > 70000
    conditionalQuery.addNodeCondition((nodeId) => {
      const salaryTriples = kg.query(nodeId, 'salary', null);
      if (salaryTriples.length === 0) return false;
      const salary = salaryTriples[0][2];
      return salary > 70000;
    });
    
    const conditionalResults = await conditionalQuery.execute(kg);
    
    expect(conditionalResults.bindings.length).toBeGreaterThan(0);
    
    // Verify all results meet the condition
    for (const binding of conditionalResults.bindings) {
      const target = binding.get('target');
      const salaryTriples = kg.query(target, 'salary', null);
      if (salaryTriples.length > 0) {
        expect(salaryTriples[0][2]).toBeGreaterThan(70000);
      }
    }
    
    // Test traversal with edge property conditions
    const edgeConditionalQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 2));
    
    // Add condition: only traverse edges where both nodes are in same department
    edgeConditionalQuery.addEdgeCondition((fromId, toId) => {
      const fromDeptTriples = kg.query(fromId, 'department', null);
      const toDeptTriples = kg.query(toId, 'department', null);
      
      if (fromDeptTriples.length === 0 || toDeptTriples.length === 0) return true;
      
      return fromDeptTriples[0][2] === toDeptTriples[0][2];
    });
    
    const edgeResults = await edgeConditionalQuery.execute(kg);
    
    expect(edgeResults.bindings.length).toBeGreaterThan(0);
    
    // Test complex conditional traversal
    const complexQuery = new TraversalQuery('frank', new VariableLengthPath('manages', 1, 3));
    
    // Add multiple conditions
    complexQuery.addNodeCondition((nodeId) => {
      const ageTriples = kg.query(nodeId, 'age', null);
      return ageTriples.length > 0 && ageTriples[0][2] < 35;
    });
    
    complexQuery.addPathCondition((path) => {
      return path.length <= 3; // Limit path length
    });
    
    const complexResults = await complexQuery.execute(kg);
    
    expect(complexResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    // Verify path length condition
    for (const binding of complexResults.bindings) {
      const path = binding.get('path');
      expect(path.length).toBeLessThanOrEqual(3);
    }
    
    // Test conditional traversal with early termination
    const earlyTermQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 5));
    
    earlyTermQuery.addTerminationCondition((nodeId, path) => {
      // Terminate if we reach a manager
      const levelTriples = kg.query(nodeId, 'level', null);
      return levelTriples.length > 0 && levelTriples[0][2] === 'Manager';
    });
    
    const earlyTermResults = await earlyTermQuery.execute(kg);
    
    expect(earlyTermResults.bindings.length).toBeGreaterThan(0);
    
    // Verify termination condition worked
    let foundManager = false;
    for (const binding of earlyTermResults.bindings) {
      const target = binding.get('target');
      const levelTriples = kg.query(target, 'level', null);
      if (levelTriples.length > 0 && levelTriples[0][2] === 'Manager') {
        foundManager = true;
        // Path should not continue beyond manager
        const path = binding.get('path');
        expect(path[path.length - 1]).toBe(target);
      }
    }
    
    expect(foundManager).toBe(true);
  });
  
  test('Step 4.3.2: Test path traversal with constraints', async () => {
    // Test traversal with range constraints on target properties
    const rangeConstrainedQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    
    // Add constraint: target age must be between 25 and 35
    const ageConstraint = new RangeConstraint(25, 35);
    rangeConstrainedQuery.addTargetConstraint('age', ageConstraint);
    
    const rangeResults = await rangeConstrainedQuery.execute(kg);
    
    expect(rangeResults.bindings.length).toBeGreaterThan(0);
    
    // Verify all targets meet age constraint
    for (const binding of rangeResults.bindings) {
      const target = binding.get('target');
      const ageTriples = kg.query(target, 'age', null);
      if (ageTriples.length > 0) {
        const age = ageTriples[0][2];
        expect(age).toBeGreaterThanOrEqual(25);
        expect(age).toBeLessThanOrEqual(35);
      }
    }
    
    // Test traversal with function constraints
    const functionConstrainedQuery = new TraversalQuery('frank', new VariableLengthPath('manages', 1, 2));
    
    // Add constraint: target must be in Engineering or Marketing
    const departmentConstraint = new FunctionConstraint((value) => {
      return value === 'Engineering' || value === 'Marketing';
    });
    functionConstrainedQuery.addTargetConstraint('department', departmentConstraint);
    
    const functionResults = await functionConstrainedQuery.execute(kg);
    
    expect(functionResults.bindings.length).toBeGreaterThan(0);
    
    // Verify department constraint
    for (const binding of functionResults.bindings) {
      const target = binding.get('target');
      const deptTriples = kg.query(target, 'department', null);
      if (deptTriples.length > 0) {
        const dept = deptTriples[0][2];
        expect(['Engineering', 'Marketing']).toContain(dept);
      }
    }
    
    // Test traversal with multiple constraints
    const multiConstraintQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    
    // Add multiple constraints
    const salaryConstraint = new RangeConstraint(60000, 100000);
    const levelConstraint = new FunctionConstraint((value) => {
      return value === 'Senior' || value === 'Manager';
    });
    
    multiConstraintQuery.addTargetConstraint('salary', salaryConstraint);
    multiConstraintQuery.addTargetConstraint('level', levelConstraint);
    
    const multiResults = await multiConstraintQuery.execute(kg);
    
    expect(multiResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    // Verify both constraints
    for (const binding of multiResults.bindings) {
      const target = binding.get('target');
      
      const salaryTriples = kg.query(target, 'salary', null);
      if (salaryTriples.length > 0) {
        const salary = salaryTriples[0][2];
        expect(salary).toBeGreaterThanOrEqual(60000);
        expect(salary).toBeLessThanOrEqual(100000);
      }
      
      const levelTriples = kg.query(target, 'level', null);
      if (levelTriples.length > 0) {
        const level = levelTriples[0][2];
        expect(['Senior', 'Manager']).toContain(level);
      }
    }
    
    // Test path-level constraints
    const pathConstraintQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 4));
    
    // Add constraint: path must contain at least one manager
    pathConstraintQuery.addPathConstraint('containsManager', (path) => {
      return path.some(nodeId => {
        const levelTriples = kg.query(nodeId, 'level', null);
        return levelTriples.length > 0 && levelTriples[0][2] === 'Manager';
      });
    });
    
    const pathConstraintResults = await pathConstraintQuery.execute(kg);
    
    expect(pathConstraintResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    // Verify path constraint
    for (const binding of pathConstraintResults.bindings) {
      const path = binding.get('path');
      let hasManager = false;
      
      for (const nodeId of path) {
        const levelTriples = kg.query(nodeId, 'level', null);
        if (levelTriples.length > 0 && levelTriples[0][2] === 'Manager') {
          hasManager = true;
          break;
        }
      }
      
      expect(hasManager).toBe(true);
    }
  });
  
  test('Step 4.3.3: Test bidirectional path traversal', async () => {
    // Test basic bidirectional traversal
    const bidirectionalQuery = new TraversalQuery('diana', new FixedLengthPath('friendOf', 1, 'both'));
    const bidirectionalResults = await bidirectionalQuery.execute(kg);
    
    expect(bidirectionalResults.bindings.length).toBe(2); // bob and diana (bidirectional)
    
    const targets = bidirectionalResults.bindings.map(binding => binding.get('target'));
    expect(targets).toContain('bob'); // diana friendOf bob
    expect(targets).toContain('bob'); // bob friendOf diana (should be same result)
    
    // Test bidirectional traversal with different predicates
    const collaborationQuery = new TraversalQuery('alice', new FixedLengthPath('collaboratesWith', 1, 'both'));
    const collaborationResults = await collaborationQuery.execute(kg);
    
    expect(collaborationResults.bindings.length).toBeGreaterThan(0);
    
    // Test bidirectional variable-length traversal
    const varBidirectionalQuery = new TraversalQuery('bob', new VariableLengthPath('friendOf', 1, 2, 'both'));
    const varBidirectionalResults = await varBidirectionalQuery.execute(kg);
    
    expect(varBidirectionalResults.bindings.length).toBeGreaterThan(1);
    
    // Should find both direct friends and friends of friends
    const varTargets = varBidirectionalResults.bindings.map(binding => binding.get('target'));
    expect(varTargets).toContain('alice'); // direct friend
    expect(varTargets).toContain('diana'); // direct friend
    
    // Test bidirectional traversal with constraints
    const constrainedBidirectionalQuery = new TraversalQuery('diana', new VariableLengthPath('collaboratesWith', 1, 2, 'both'));
    
    // Add constraint: only people in Engineering or Marketing
    constrainedBidirectionalQuery.addTargetConstraint('department', new FunctionConstraint((value) => {
      return value === 'Engineering' || value === 'Marketing';
    }));
    
    const constrainedBidirectionalResults = await constrainedBidirectionalQuery.execute(kg);
    
    expect(constrainedBidirectionalResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    // Verify constraint satisfaction
    for (const binding of constrainedBidirectionalResults.bindings) {
      const target = binding.get('target');
      const deptTriples = kg.query(target, 'department', null);
      if (deptTriples.length > 0) {
        expect(['Engineering', 'Marketing']).toContain(deptTriples[0][2]);
      }
    }
    
    // Test bidirectional traversal with cycle detection
    const cycleBidirectionalQuery = new TraversalQuery('alice', new VariableLengthPath('collaboratesWith', 1, 3, 'both'));
    cycleBidirectionalQuery.enableCycleDetection(true);
    
    const cycleResults = await cycleBidirectionalQuery.execute(kg);
    
    expect(cycleResults.bindings.length).toBeGreaterThan(0);
    expect(cycleBidirectionalQuery.getExecutionStats().cyclesDetected).toBeGreaterThanOrEqual(0);
    
    // Test asymmetric bidirectional relationships
    kg.addTriple('alice', 'reports_to', 'frank');
    kg.addTriple('frank', 'supervises', 'alice');
    
    const asymmetricQuery = new TraversalQuery('alice', new FixedLengthPath('reports_to', 1, 'both'));
    const asymmetricResults = await asymmetricQuery.execute(kg);
    
    expect(asymmetricResults.bindings.length).toBe(1);
    expect(asymmetricResults.bindings[0].get('target')).toBe('frank');
  });
  
  test('Step 4.3.4: Test shortest path algorithms', async () => {
    // Test shortest path between two specific nodes
    const shortestPathQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 5));
    shortestPathQuery.setTargetNode('eve');
    shortestPathQuery.enableShortestPath(true);
    
    const shortestResults = await shortestPathQuery.execute(kg);
    
    expect(shortestResults.bindings.length).toBeGreaterThan(0);
    
    // Find the shortest path
    let shortestPath = null;
    let shortestLength = Infinity;
    
    for (const binding of shortestResults.bindings) {
      const path = binding.get('path');
      const target = binding.get('target');
      
      if (target === 'eve' && path.length < shortestLength) {
        shortestPath = path;
        shortestLength = path.length;
      }
    }
    
    expect(shortestPath).not.toBeNull();
    expect(shortestPath[0]).toBe('alice');
    expect(shortestPath[shortestPath.length - 1]).toBe('eve');
    expect(shortestLength).toBeLessThanOrEqual(4); // Should find path alice -> charlie -> eve
    
    // Test shortest path with multiple predicates
    const multiPredicateQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    multiPredicateQuery.setTargetNode('frank');
    multiPredicateQuery.enableShortestPath(true);
    multiPredicateQuery.addAlternativePredicate('manages');
    multiPredicateQuery.addAlternativePredicate('collaboratesWith');
    
    const multiResults = await multiPredicateQuery.execute(kg);
    
    expect(multiResults.bindings.length).toBeGreaterThan(0);
    
    // Test shortest path with constraints
    const constrainedShortestQuery = new TraversalQuery('bob', new VariableLengthPath('knows', 1, 4));
    constrainedShortestQuery.setTargetNode('frank');
    constrainedShortestQuery.enableShortestPath(true);
    
    // Add constraint: avoid nodes with salary < 80000
    constrainedShortestQuery.addNodeCondition((nodeId) => {
      if (nodeId === 'bob' || nodeId === 'frank') return true; // Allow start and end
      const salaryTriples = kg.query(nodeId, 'salary', null);
      return salaryTriples.length === 0 || salaryTriples[0][2] >= 80000;
    });
    
    const constrainedShortestResults = await constrainedShortestQuery.execute(kg);
    
    expect(constrainedShortestResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    // Test all shortest paths (not just one)
    const allShortestQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    allShortestQuery.setTargetNode('diana');
    allShortestQuery.enableShortestPath(true);
    allShortestQuery.findAllShortestPaths(true);
    
    const allShortestResults = await allShortestQuery.execute(kg);
    
    expect(allShortestResults.bindings.length).toBeGreaterThan(0);
    
    // All paths to diana should have the same length (shortest)
    const pathLengths = allShortestResults.bindings
      .filter(binding => binding.get('target') === 'diana')
      .map(binding => binding.get('pathLength'));
    
    if (pathLengths.length > 1) {
      const firstLength = pathLengths[0];
      expect(pathLengths.every(length => length === firstLength)).toBe(true);
    }
    
    // Test shortest path with bidirectional search
    const bidirectionalShortestQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 4));
    bidirectionalShortestQuery.setTargetNode('frank');
    bidirectionalShortestQuery.enableShortestPath(true);
    bidirectionalShortestQuery.enableBidirectionalSearch(true);
    
    const bidirectionalResults = await bidirectionalShortestQuery.execute(kg);
    
    expect(bidirectionalResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    // Bidirectional search should be more efficient
    const bidirectionalStats = bidirectionalShortestQuery.getExecutionStats();
    expect(bidirectionalStats.nodesVisited).toBeDefined();
    expect(bidirectionalStats.executionTime).toBeGreaterThan(0);
  });
  
  test('Step 4.3.5: Test path traversal optimization strategies', async () => {
    // Test different traversal strategies
    const breadthFirstQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    breadthFirstQuery.setTraversalStrategy('breadth-first');
    
    const bfStartTime = Date.now();
    const bfResults = await breadthFirstQuery.execute(kg);
    const bfTime = Date.now() - bfStartTime;
    
    expect(bfResults.bindings.length).toBeGreaterThan(0);
    
    const depthFirstQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    depthFirstQuery.setTraversalStrategy('depth-first');
    
    const dfStartTime = Date.now();
    const dfResults = await depthFirstQuery.execute(kg);
    const dfTime = Date.now() - dfStartTime;
    
    expect(dfResults.bindings.length).toBeGreaterThan(0);
    
    // Both strategies should find the same targets (though possibly in different order)
    const bfTargets = new Set(bfResults.bindings.map(b => b.get('target')));
    const dfTargets = new Set(dfResults.bindings.map(b => b.get('target')));
    
    expect(bfTargets.size).toBe(dfTargets.size);
    for (const target of bfTargets) {
      expect(dfTargets.has(target)).toBe(true);
    }
    
    // Test best-first search strategy
    const bestFirstQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    bestFirstQuery.setTraversalStrategy('best-first');
    
    // Add heuristic: prefer nodes with higher salary
    bestFirstQuery.setHeuristic((nodeId) => {
      const salaryTriples = kg.query(nodeId, 'salary', null);
      return salaryTriples.length > 0 ? salaryTriples[0][2] : 0;
    });
    
    const bestFirstResults = await bestFirstQuery.execute(kg);
    
    expect(bestFirstResults.bindings.length).toBeGreaterThan(0);
    
    // Test adaptive strategy selection
    const adaptiveQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 4));
    adaptiveQuery.setTraversalStrategy('adaptive');
    adaptiveQuery.enableOptimization(true);
    
    const adaptiveResults = await adaptiveQuery.execute(kg);
    
    expect(adaptiveResults.bindings.length).toBeGreaterThan(0);
    
    const adaptiveStats = adaptiveQuery.getExecutionStats();
    expect(adaptiveStats.strategyUsed).toBeDefined();
    expect(['breadth-first', 'depth-first', 'best-first']).toContain(adaptiveStats.strategyUsed);
    
    // Test parallel traversal strategy
    const parallelQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    parallelQuery.setTraversalStrategy('parallel');
    parallelQuery.setParallelism(2);
    
    const parallelResults = await parallelQuery.execute(kg);
    
    expect(parallelResults.bindings.length).toBeGreaterThan(0);
    
    // Test memoization optimization
    const memoizedQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    memoizedQuery.enableMemoization(true);
    
    const memoResults1 = await memoizedQuery.execute(kg);
    const memoResults2 = await memoizedQuery.execute(kg);
    
    expect(memoResults1.bindings.length).toBe(memoResults2.bindings.length);
    
    const memoStats = memoizedQuery.getExecutionStats();
    expect(memoStats.cacheHits).toBeGreaterThan(0);
    
    // Test pruning optimization
    const pruningQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 4));
    pruningQuery.enablePruning(true);
    
    // Add pruning condition: stop exploring if salary < 70000
    pruningQuery.setPruningCondition((nodeId, path) => {
      const salaryTriples = kg.query(nodeId, 'salary', null);
      return salaryTriples.length > 0 && salaryTriples[0][2] < 70000;
    });
    
    const pruningResults = await pruningQuery.execute(kg);
    
    expect(pruningResults.bindings.length).toBeGreaterThanOrEqual(0);
    
    const pruningStats = pruningQuery.getExecutionStats();
    expect(pruningStats.nodesPruned).toBeGreaterThanOrEqual(0);
    
    // Test index-based optimization
    const indexedQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    indexedQuery.enableIndexOptimization(true);
    
    const indexedResults = await indexedQuery.execute(kg);
    
    expect(indexedResults.bindings.length).toBeGreaterThan(0);
    
    const indexedStats = indexedQuery.getExecutionStats();
    expect(indexedStats.indexUsage).toBeDefined();
    expect(indexedStats.indexHits).toBeGreaterThanOrEqual(0);
    
    // Test query plan optimization
    const plannedQuery = new TraversalQuery('alice', new VariableLengthPath('knows', 1, 3));
    plannedQuery.enableQueryPlanning(true);
    
    const planResults = await plannedQuery.execute(kg);
    
    expect(planResults.bindings.length).toBeGreaterThan(0);
    
    const queryPlan = plannedQuery.getQueryPlan();
    expect(queryPlan).toBeDefined();
    expect(queryPlan.estimatedCost).toBeDefined();
    expect(queryPlan.selectedStrategy).toBeDefined();
  });
});
