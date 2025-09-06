import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { FixedLengthPath } from '../../../src/query/paths/FixedLengthPath.js';
import { VariableLengthPath } from '../../../src/query/paths/VariableLengthPath.js';
import { PathExpression } from '../../../src/query/paths/PathExpression.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 4.1: Path Expression Foundation', () => {
  let kg;
  
  beforeEach(() => {
    kg = new KGEngine();
    
    // Setup comprehensive test data for path traversal
    // People
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
    
    // Relationships - creating a connected graph
    kg.addTriple('alice', 'knows', 'bob');
    kg.addTriple('alice', 'knows', 'charlie');
    kg.addTriple('bob', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'diana');
    kg.addTriple('charlie', 'knows', 'eve');
    kg.addTriple('diana', 'knows', 'eve');
    
    // Friendship (bidirectional)
    kg.addTriple('alice', 'friendOf', 'bob');
    kg.addTriple('bob', 'friendOf', 'alice');
    kg.addTriple('bob', 'friendOf', 'diana');
    kg.addTriple('diana', 'friendOf', 'bob');
    
    // Work relationships
    kg.addTriple('alice', 'worksAt', 'company1');
    kg.addTriple('bob', 'worksAt', 'company1');
    kg.addTriple('charlie', 'worksAt', 'company2');
    kg.addTriple('diana', 'worksAt', 'company2');
    kg.addTriple('eve', 'worksAt', 'company3');
    
    // Management hierarchy
    kg.addTriple('alice', 'manages', 'bob');
    kg.addTriple('charlie', 'manages', 'diana');
    kg.addTriple('diana', 'manages', 'eve');
    
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
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  test('Step 4.1.1: Test FixedLengthPath creation and serialization', () => {
    // Test basic fixed-length path creation
    const path1 = new FixedLengthPath('knows', 1);
    expect(path1).toBeDefined();
    expect(path1.predicate).toBe('knows');
    expect(path1.length).toBe(1);
    expect(path1.direction).toBe('outgoing'); // default
    expect(path1.getId()).toMatch(/^path_[a-z0-9]+$/);
    
    // Test fixed-length path with direction
    const path2 = new FixedLengthPath('manages', 2, 'incoming');
    expect(path2.predicate).toBe('manages');
    expect(path2.length).toBe(2);
    expect(path2.direction).toBe('incoming');
    
    // Test fixed-length path with bidirectional
    const path3 = new FixedLengthPath('friendOf', 1, 'both');
    expect(path3.predicate).toBe('friendOf');
    expect(path3.length).toBe(1);
    expect(path3.direction).toBe('both');
    
    // Test path with zero length (identity)
    const path4 = new FixedLengthPath('knows', 0);
    expect(path4.length).toBe(0);
    expect(path4.isIdentityPath()).toBe(true);
    
    // Test path serialization
    const triples = path1.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    const pathId = path1.getId();
    
    // Check core path triples
    const typeTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'rdf:type' && o === 'kg:FixedLengthPath'
    );
    expect(typeTriple).toBeDefined();
    
    const predicateTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'kg:predicate' && o === 'knows'
    );
    expect(predicateTriple).toBeDefined();
    
    const lengthTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'kg:length' && o === 1
    );
    expect(lengthTriple).toBeDefined();
    
    const directionTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'kg:direction' && o === 'outgoing'
    );
    expect(directionTriple).toBeDefined();
    
    // Test path metadata
    expect(path1.getMetadata('predicate')).toBe('knows');
    expect(path1.getMetadata('length')).toBe(1);
    expect(path1.getMetadata('direction')).toBe('outgoing');
  });
  
  test('Step 4.1.2: Test VariableLengthPath creation and serialization', () => {
    // Test basic variable-length path creation
    const path1 = new VariableLengthPath('knows', 1, 3);
    expect(path1).toBeDefined();
    expect(path1.predicate).toBe('knows');
    expect(path1.minLength).toBe(1);
    expect(path1.maxLength).toBe(3);
    expect(path1.direction).toBe('outgoing'); // default
    expect(path1.getId()).toMatch(/^path_[a-z0-9]+$/);
    
    // Test variable-length path with direction
    const path2 = new VariableLengthPath('manages', 0, 2, 'incoming');
    expect(path2.predicate).toBe('manages');
    expect(path2.minLength).toBe(0);
    expect(path2.maxLength).toBe(2);
    expect(path2.direction).toBe('incoming');
    
    // Test variable-length path with unlimited max (null)
    const path3 = new VariableLengthPath('knows', 1, null, 'both');
    expect(path3.predicate).toBe('knows');
    expect(path3.minLength).toBe(1);
    expect(path3.maxLength).toBeNull();
    expect(path3.direction).toBe('both');
    expect(path3.isUnbounded()).toBe(true);
    
    // Test path with zero min length
    const path4 = new VariableLengthPath('friendOf', 0, 1);
    expect(path4.minLength).toBe(0);
    expect(path4.includesIdentity()).toBe(true);
    
    // Test path serialization
    const triples = path1.toTriples();
    expect(Array.isArray(triples)).toBe(true);
    expect(triples.length).toBeGreaterThan(0);
    
    const pathId = path1.getId();
    
    // Check core path triples
    const typeTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'rdf:type' && o === 'kg:VariableLengthPath'
    );
    expect(typeTriple).toBeDefined();
    
    const predicateTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'kg:predicate' && o === 'knows'
    );
    expect(predicateTriple).toBeDefined();
    
    const minLengthTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'kg:minLength' && o === 1
    );
    expect(minLengthTriple).toBeDefined();
    
    const maxLengthTriple = triples.find(([s, p, o]) => 
      s === pathId && p === 'kg:maxLength' && o === 3
    );
    expect(maxLengthTriple).toBeDefined();
    
    // Test unbounded path serialization
    const unboundedTriples = path3.toTriples();
    const unboundedPathId = path3.getId();
    
    const unboundedMaxTriple = unboundedTriples.find(([s, p, o]) => 
      s === unboundedPathId && p === 'kg:maxLength' && o === null
    );
    expect(unboundedMaxTriple).toBeDefined();
    
    // Test path metadata
    expect(path1.getMetadata('predicate')).toBe('knows');
    expect(path1.getMetadata('minLength')).toBe(1);
    expect(path1.getMetadata('maxLength')).toBe(3);
    expect(path1.getMetadata('direction')).toBe('outgoing');
  });
  
  test('Step 4.1.3: Test path expression validation and constraints', () => {
    // Test valid fixed-length path
    const validFixed = new FixedLengthPath('knows', 2);
    expect(validFixed.isValid()).toBe(true);
    expect(validFixed.getValidationErrors()).toHaveLength(0);
    
    // Test invalid fixed-length path (negative length)
    const invalidFixed = new FixedLengthPath('knows', -1);
    expect(invalidFixed.isValid()).toBe(false);
    const fixedErrors = invalidFixed.getValidationErrors();
    expect(fixedErrors.length).toBeGreaterThan(0);
    expect(fixedErrors.some(error => error.includes('negative'))).toBe(true);
    
    // Test valid variable-length path
    const validVariable = new VariableLengthPath('knows', 1, 3);
    expect(validVariable.isValid()).toBe(true);
    expect(validVariable.getValidationErrors()).toHaveLength(0);
    
    // Test invalid variable-length path (min > max)
    const invalidVariable = new VariableLengthPath('knows', 3, 1);
    expect(invalidVariable.isValid()).toBe(false);
    const variableErrors = invalidVariable.getValidationErrors();
    expect(variableErrors.length).toBeGreaterThan(0);
    expect(variableErrors.some(error => error.includes('greater than'))).toBe(true);
    
    // Test path with invalid direction
    const invalidDirection = new FixedLengthPath('knows', 1, 'invalid');
    expect(invalidDirection.isValid()).toBe(false);
    const directionErrors = invalidDirection.getValidationErrors();
    expect(directionErrors.length).toBeGreaterThan(0);
    expect(directionErrors.some(error => error.includes('direction'))).toBe(true);
    
    // Test path with empty predicate
    const emptyPredicate = new FixedLengthPath('', 1);
    expect(emptyPredicate.isValid()).toBe(false);
    const predicateErrors = emptyPredicate.getValidationErrors();
    expect(predicateErrors.length).toBeGreaterThan(0);
    expect(predicateErrors.some(error => error.includes('predicate'))).toBe(true);
    
    // Test path constraints
    const constrainedPath = new VariableLengthPath('knows', 1, 5);
    constrainedPath.addConstraint('maxDepth', 3);
    constrainedPath.addConstraint('avoidCycles', true);
    
    expect(constrainedPath.hasConstraint('maxDepth')).toBe(true);
    expect(constrainedPath.getConstraint('maxDepth')).toBe(3);
    expect(constrainedPath.hasConstraint('avoidCycles')).toBe(true);
    expect(constrainedPath.getConstraint('avoidCycles')).toBe(true);
    
    const constraintTriples = constrainedPath.toTriples();
    const constraintPathId = constrainedPath.getId();
    
    const maxDepthTriple = constraintTriples.find(([s, p, o]) => 
      s === constraintPathId && p === 'kg:maxDepth' && o === 3
    );
    expect(maxDepthTriple).toBeDefined();
    
    const avoidCyclesTriple = constraintTriples.find(([s, p, o]) => 
      s === constraintPathId && p === 'kg:avoidCycles' && o === true
    );
    expect(avoidCyclesTriple).toBeDefined();
  });
  
  test('Step 4.1.4: Test path direction handling (outgoing, incoming, both)', () => {
    // Test outgoing direction
    const outgoingPath = new FixedLengthPath('knows', 1, 'outgoing');
    expect(outgoingPath.direction).toBe('outgoing');
    expect(outgoingPath.isOutgoing()).toBe(true);
    expect(outgoingPath.isIncoming()).toBe(false);
    expect(outgoingPath.isBidirectional()).toBe(false);
    
    // Test incoming direction
    const incomingPath = new FixedLengthPath('knows', 1, 'incoming');
    expect(incomingPath.direction).toBe('incoming');
    expect(incomingPath.isOutgoing()).toBe(false);
    expect(incomingPath.isIncoming()).toBe(true);
    expect(incomingPath.isBidirectional()).toBe(false);
    
    // Test bidirectional
    const bidirectionalPath = new FixedLengthPath('knows', 1, 'both');
    expect(bidirectionalPath.direction).toBe('both');
    expect(bidirectionalPath.isOutgoing()).toBe(false);
    expect(bidirectionalPath.isIncoming()).toBe(false);
    expect(bidirectionalPath.isBidirectional()).toBe(true);
    
    // Test direction reversal
    const reversedPath = outgoingPath.reverse();
    expect(reversedPath.direction).toBe('incoming');
    expect(reversedPath.predicate).toBe('knows');
    expect(reversedPath.length).toBe(1);
    
    const reversedIncoming = incomingPath.reverse();
    expect(reversedIncoming.direction).toBe('outgoing');
    
    const reversedBoth = bidirectionalPath.reverse();
    expect(reversedBoth.direction).toBe('both'); // bidirectional stays the same
    
    // Test direction compatibility
    expect(outgoingPath.isCompatibleWith(incomingPath)).toBe(false);
    expect(outgoingPath.isCompatibleWith(bidirectionalPath)).toBe(true);
    expect(incomingPath.isCompatibleWith(bidirectionalPath)).toBe(true);
    expect(bidirectionalPath.isCompatibleWith(outgoingPath)).toBe(true);
    
    // Test path composition with directions
    const path1 = new FixedLengthPath('knows', 1, 'outgoing');
    const path2 = new FixedLengthPath('worksAt', 1, 'outgoing');
    
    const composedPath = path1.compose(path2);
    expect(composedPath).toBeDefined();
    expect(composedPath.steps).toHaveLength(2);
    expect(composedPath.steps[0]).toBe(path1);
    expect(composedPath.steps[1]).toBe(path2);
    
    // Test incompatible composition
    const incompatiblePath1 = new FixedLengthPath('knows', 1, 'outgoing');
    const incompatiblePath2 = new FixedLengthPath('manages', 1, 'incoming');
    
    expect(() => incompatiblePath1.compose(incompatiblePath2)).toThrow();
  });
  
  test('Step 4.1.5: Test path expression optimization', () => {
    // Test path optimization hints
    const simplePath = new FixedLengthPath('knows', 1);
    const optimizationHints = simplePath.getOptimizationHints(kg);
    
    expect(optimizationHints).toBeDefined();
    expect(optimizationHints.estimatedComplexity).toBeDefined();
    expect(optimizationHints.recommendedStrategy).toBeDefined();
    expect(optimizationHints.indexUsage).toBeDefined();
    
    // Simple path should have low complexity
    expect(optimizationHints.estimatedComplexity).toBeLessThan(10);
    expect(optimizationHints.recommendedStrategy).toBe('direct');
    
    // Test complex path optimization
    const complexPath = new VariableLengthPath('knows', 1, 5);
    const complexHints = complexPath.getOptimizationHints(kg);
    
    expect(complexHints.estimatedComplexity).toBeGreaterThan(optimizationHints.estimatedComplexity);
    expect(['breadth-first', 'depth-first', 'bidirectional']).toContain(complexHints.recommendedStrategy);
    
    // Test unbounded path optimization
    const unboundedPath = new VariableLengthPath('knows', 1, null);
    const unboundedHints = unboundedPath.getOptimizationHints(kg);
    
    expect(unboundedHints.estimatedComplexity).toBeGreaterThan(complexHints.estimatedComplexity);
    expect(unboundedHints.requiresCycleDetection).toBe(true);
    expect(unboundedHints.recommendedMaxDepth).toBeDefined();
    
    // Test path selectivity estimation
    const selectivePath = new FixedLengthPath('manages', 1); // less common predicate (3 triples)
    const commonPath = new FixedLengthPath('knows', 1); // more common predicate (6 triples)
    
    const selectiveHints = selectivePath.getOptimizationHints(kg);
    const commonHints = commonPath.getOptimizationHints(kg);
    
    // 'manages' should be more selective (higher selectivity) than 'knows'
    // because it appears less frequently in the graph
    expect(selectiveHints.selectivity).toBeGreaterThanOrEqual(commonHints.selectivity);
    
    // Test path caching recommendations
    const cachingPath = new VariableLengthPath('knows', 2, 4);
    const cachingHints = cachingPath.getOptimizationHints(kg);
    
    expect(cachingHints.cachingRecommended).toBeDefined();
    expect(typeof cachingHints.cachingRecommended).toBe('boolean');
    
    // Test path optimization with constraints
    const constrainedPath = new VariableLengthPath('knows', 1, 3);
    constrainedPath.addConstraint('avoidCycles', true);
    constrainedPath.addConstraint('maxDepth', 2);
    
    const constrainedHints = constrainedPath.getOptimizationHints(kg);
    expect(constrainedHints.constraintCount).toBe(2);
    expect(constrainedHints.cycleDetectionRequired).toBe(true);
    
    // Test path optimization statistics
    expect(simplePath.getExecutionStats().optimizationTime).toBe(0); // not executed yet
    
    // Simulate optimization
    simplePath.optimize(kg);
    expect(simplePath.getExecutionStats().optimizationTime).toBeGreaterThan(0);
    expect(simplePath.isOptimized()).toBe(true);
  });
});
