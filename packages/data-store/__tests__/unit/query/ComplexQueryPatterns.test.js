/**
 * Unit tests for ComplexQueryPatterns
 * Per design §7: Tests for kernel graph patterns
 */

import { ComplexQueryPatterns, createComplexQueryPatterns } from '../../../src/query/ComplexQueryPatterns.js';
import { PathQuery } from '../../../src/query/PathQuery.js';
import { IsTypePredicate } from '../../../src/query/PredicateProvider.js';

describe('ComplexQueryPatterns', () => {
  let patterns;

  beforeEach(() => {
    patterns = createComplexQueryPatterns();
  });

  describe('construction', () => {
    it('should create instance with factory', () => {
      const p = createComplexQueryPatterns();
      expect(p).toBeInstanceOf(ComplexQueryPatterns);
    });

    it('should initialize with empty predicate providers', () => {
      expect(patterns.getPredicateProviders()).toEqual([]);
    });
  });

  describe('predicate provider registration', () => {
    it('should register predicate provider', () => {
      const provider = new IsTypePredicate(':TestType');
      patterns.registerPredicateProvider('test', provider);
      
      const providers = patterns.getPredicateProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0]).toEqual(['test', provider]);
    });

    it('should require predicate name', () => {
      expect(() => {
        patterns.registerPredicateProvider(null, new IsTypePredicate(':TestType'));
      }).toThrow('Predicate name is required');
    });

    it('should require predicate provider', () => {
      expect(() => {
        patterns.registerPredicateProvider('test', null);
      }).toThrow('Predicate provider is required');
    });

    it('should clear all providers', () => {
      patterns.registerPredicateProvider('test1', new IsTypePredicate(':Type1'));
      patterns.registerPredicateProvider('test2', new IsTypePredicate(':Type2'));
      
      patterns.clearPredicateProviders();
      expect(patterns.getPredicateProviders()).toEqual([]);
    });
  });

  describe('buildSimpleForwardPath', () => {
    it('should build simple forward path query', () => {
      const spec = patterns.buildSimpleForwardPath(['hasName', 'locatedIn', 'partOf']);
      
      expect(spec).toBeDefined();
      expect(spec._edges).toHaveLength(3);
      expect(spec._variableOrder).toContain('?v0');
      expect(spec._variableOrder).toContain('?v3');
      expect(spec._returnVariables).toEqual(['?v3']);
    });

    it('should support bound root value', () => {
      const spec = patterns.buildSimpleForwardPath(['hasName', 'locatedIn'], 'entity123');
      
      expect(spec).toBeDefined();
      const rootVar = spec._variables.get('?v0');
      expect(rootVar).toBeDefined();
      expect(rootVar.isBound).toBe(true);
      expect(rootVar.value).toBe('entity123');
    });

    it('should require non-empty attributes array', () => {
      expect(() => {
        patterns.buildSimpleForwardPath([]);
      }).toThrow('Attributes array is required');
    });

    it('should reject non-array attributes', () => {
      expect(() => {
        patterns.buildSimpleForwardPath('hasName');
      }).toThrow('Attributes array is required');
    });
  });

  describe('buildPathWithInverse', () => {
    it('should build path with inverse steps', () => {
      const spec = patterns.buildPathWithInverse(['hasName', '^worksAt', 'locatedIn']);
      
      expect(spec).toBeDefined();
      expect(spec._edges).toHaveLength(3);
      
      // Check that middle edge is backward (inverse)
      const inverseEdge = spec._edges[1];
      expect(inverseEdge.direction).toBe('backward');
    });

    it('should support object notation for steps', () => {
      const spec = patterns.buildPathWithInverse([
        { attribute: 'hasName', direction: 'forward' },
        { attribute: 'worksAt', direction: 'inverse' },
        { attribute: 'locatedIn', direction: 'forward' }
      ]);
      
      expect(spec).toBeDefined();
      expect(spec._edges).toHaveLength(3);
      expect(spec._edges[1].direction).toBe('backward');
    });

    it('should support mixed notation', () => {
      const spec = patterns.buildPathWithInverse([
        'hasName',
        '^worksAt',
        { attribute: 'locatedIn', direction: 'forward' }
      ]);
      
      expect(spec).toBeDefined();
      expect(spec._edges).toHaveLength(3);
    });

    it('should reject invalid path spec items', () => {
      expect(() => {
        patterns.buildPathWithInverse(['hasName', 123, 'locatedIn']);
      }).toThrow('Invalid path spec at index 1');
    });

    it('should require non-empty path spec', () => {
      expect(() => {
        patterns.buildPathWithInverse([]);
      }).toThrow('Path specification array is required');
    });
  });

  describe('buildDisjunctionQuery', () => {
    it('should build OR query with multiple branches', () => {
      const spec = patterns.buildDisjunctionQuery([
        ['hasName', 'locatedIn'],
        ['worksAt'],
        'directAttribute'
      ]);
      
      expect(spec).toBeDefined();
      expect(spec._predicates).toHaveLength(1); // One OR predicate
    });

    it('should support exclusions with NOT', () => {
      const spec = patterns.buildDisjunctionQuery(
        [['hasTag', 'hasColor'], ['hasSize']],
        [['isArchived'], 'isDeleted']
      );
      
      expect(spec).toBeDefined();
      expect(spec._predicates).toHaveLength(3); // 1 OR + 2 NOT
    });

    it('should bind root value to all branches', () => {
      const spec = patterns.buildDisjunctionQuery(
        [['hasName'], ['hasId']],
        [],
        'root123'
      );
      
      expect(spec).toBeDefined();
      // Root variables should be bound in the spec
    });

    it('should require at least one branch', () => {
      expect(() => {
        patterns.buildDisjunctionQuery([]);
      }).toThrow('At least one branch is required');
    });

    it('should handle invalid branch types', () => {
      expect(() => {
        patterns.buildDisjunctionQuery([123]);
      }).toThrow('Invalid branch at index 0');
    });
  });

  describe('buildPredicateSubquery', () => {
    it('should build query with exists subquery', () => {
      const spec = patterns.buildPredicateSubquery(
        ['hasName', 'worksAt'],
        [
          { path: ['hasManager', 'hasApproval'], bindTo: 1, exists: true }
        ]
      );
      
      expect(spec).toBeDefined();
      expect(spec._predicates).toHaveLength(1);
    });

    it('should support multiple subqueries', () => {
      const spec = patterns.buildPredicateSubquery(
        ['hasName', 'worksAt', 'locatedIn'],
        [
          { path: ['hasManager'], bindTo: 1, exists: true },
          { path: ['hasAddress'], bindTo: 2, exists: false }
        ]
      );
      
      expect(spec).toBeDefined();
      expect(spec._predicates).toHaveLength(2);
    });

    it('should validate bindTo index', () => {
      expect(() => {
        patterns.buildPredicateSubquery(
          ['hasName', 'worksAt'],
          [{ path: ['hasManager'], bindTo: 5, exists: true }]
        );
      }).toThrow('Invalid bindTo index in subquery 0');
    });

    it('should require valid subquery path', () => {
      expect(() => {
        patterns.buildPredicateSubquery(
          ['hasName'],
          [{ bindTo: 0, exists: true }]
        );
      }).toThrow('Invalid subquery path at index 0');
    });

    it('should require non-empty main path', () => {
      expect(() => {
        patterns.buildPredicateSubquery([], []);
      }).toThrow('Main path is required');
    });

    it('should require at least one subquery', () => {
      expect(() => {
        patterns.buildPredicateSubquery(['hasName'], []);
      }).toThrow('At least one subquery is required');
    });
  });

  describe('buildPointwiseFilterQuery', () => {
    it('should build query with pointwise filters', () => {
      const spec = patterns.buildPointwiseFilterQuery(
        ['hasScore', 'hasRating'],
        [
          {
            function: 'computeScore',
            variables: [0, 1],
            operator: '>',
            threshold: 0.8
          }
        ]
      );
      
      expect(spec).toBeDefined();
      expect(spec._predicates).toHaveLength(1);
    });

    it('should support multiple filters', () => {
      const spec = patterns.buildPointwiseFilterQuery(
        ['hasX', 'hasY', 'hasZ'],
        [
          {
            function: 'distance',
            variables: [1, 2],
            operator: '<',
            threshold: 100
          },
          {
            function: 'angle',
            variables: [0, 1, 2],
            operator: '>=',
            threshold: 45
          }
        ]
      );
      
      expect(spec).toBeDefined();
      expect(spec._predicates).toHaveLength(2);
    });

    it('should validate filter structure', () => {
      expect(() => {
        patterns.buildPointwiseFilterQuery(
          ['hasValue'],
          [{ variables: [0], operator: '>' }]
        );
      }).toThrow('Filter function name is required');
    });

    it('should validate variable indices', () => {
      expect(() => {
        patterns.buildPointwiseFilterQuery(
          ['hasValue'],
          [{
            function: 'test',
            variables: [5], // Out of range
            operator: '>',
            threshold: 0
          }]
        );
      }).toThrow('Invalid variable index 5 in filter');
    });

    it('should require non-empty path', () => {
      expect(() => {
        patterns.buildPointwiseFilterQuery([], []);
      }).toThrow('Path is required');
    });

    it('should require at least one filter', () => {
      expect(() => {
        patterns.buildPointwiseFilterQuery(['hasValue'], []);
      }).toThrow('At least one filter is required');
    });
  });

  describe('buildUnionQuery', () => {
    it('should build union of multiple queries', () => {
      const query1 = new PathQuery();
      const query2 = new PathQuery();
      
      const spec = patterns.buildUnionQuery([query1, query2]);
      
      expect(spec).toBeDefined();
      expect(spec._operator).toBe('union');
    });

    it('should handle GraphSpec inputs', () => {
      const spec1 = patterns.buildSimpleForwardPath(['hasName']);
      const spec2 = patterns.buildSimpleForwardPath(['hasId']);
      
      const unionSpec = patterns.buildUnionQuery([spec1, spec2]);
      
      expect(unionSpec).toBeDefined();
      expect(unionSpec._operator).toBe('union');
    });

    it('should require at least one query', () => {
      expect(() => {
        patterns.buildUnionQuery([]);
      }).toThrow('At least one query is required for union');
    });
  });

  describe('buildDifferenceQuery', () => {
    it('should build difference query', () => {
      const includeQuery = new PathQuery();
      const excludeQuery = new PathQuery();
      
      const spec = patterns.buildDifferenceQuery(includeQuery, excludeQuery);
      
      expect(spec).toBeDefined();
      expect(spec._operator).toBe('difference');
    });

    it('should handle GraphSpec inputs', () => {
      const includeSpec = patterns.buildSimpleForwardPath(['hasTag']);
      const excludeSpec = patterns.buildSimpleForwardPath(['isArchived']);
      
      const diffSpec = patterns.buildDifferenceQuery(includeSpec, excludeSpec);
      
      expect(diffSpec).toBeDefined();
      expect(diffSpec._operator).toBe('difference');
    });

    it('should require include query', () => {
      expect(() => {
        patterns.buildDifferenceQuery(null, new PathQuery());
      }).toThrow('Include query is required');
    });

    it('should require exclude query', () => {
      expect(() => {
        patterns.buildDifferenceQuery(new PathQuery(), null);
      }).toThrow('Exclude query is required');
    });
  });

  describe('complex scenarios', () => {
    it('should compose multiple pattern types', () => {
      // Build a complex query combining different patterns
      const forwardPath = patterns.buildSimpleForwardPath(['hasName', 'worksAt']);
      const inversePath = patterns.buildPathWithInverse(['^managedBy', 'locatedIn']);
      
      const unionQuery = patterns.buildUnionQuery([forwardPath, inversePath]);
      
      expect(unionQuery).toBeDefined();
      expect(unionQuery._operator).toBe('union');
    });

    it('should handle nested compositions', () => {
      // Create nested query structures
      const branch1 = patterns.buildSimpleForwardPath(['hasTag']);
      const branch2 = patterns.buildPathWithInverse(['^taggedBy']);
      
      const union = patterns.buildUnionQuery([branch1, branch2]);
      const exclude = patterns.buildSimpleForwardPath(['isArchived']);
      
      const final = patterns.buildDifferenceQuery(union, exclude);
      
      expect(final).toBeDefined();
      expect(final._operator).toBe('difference');
    });
  });
});