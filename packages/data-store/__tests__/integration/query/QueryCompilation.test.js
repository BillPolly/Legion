/**
 * Integration tests for query compilation pipeline
 * Tests complete path+predicate → GraphSpec compilation flow
 */

import { Store } from '../../../src/Store.js';
import { TrieManager } from '../../../src/trie/TrieManager.js';
import { Dispatcher } from '../../../src/kernel/Dispatcher.js';
import {
  PathQueryBuilder,
  PathQueryFactory
} from '../../../src/query/PathQuery.js';
import {
  GraphSpecBuilder,
  VariableOrderOptimizer
} from '../../../src/query/GraphSpecBuilder.js';
import {
  PredicateRegistry,
  IsTypePredicate,
  HasTagPredicate,
  InRangePredicate,
  AndPredicate,
  OrPredicate,
  NotPredicate
} from '../../../src/query/PredicateProvider.js';

describe('Query Compilation Integration', () => {
  let store;
  let trieManager;
  let dispatcher;
  let predicateRegistry;

  beforeEach(() => {
    store = new Store();
    trieManager = new TrieManager();
    dispatcher = new Dispatcher(store, trieManager);
    predicateRegistry = new PredicateRegistry();
  });

  describe('Simple Path Queries', () => {
    it('should compile forward path query to GraphSpec', () => {
      // Build path query: ?person.worksAt.locatedIn
      const query = new PathQueryBuilder()
        .from('?person')
        .forward('worksAt')
        .forward('locatedIn')
        .returning('?person', '?v2')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.edges).toHaveLength(2);
      expect(built.edges[0]).toEqual({
        type: 'edge',
        relation: 'worksAt',
        direction: 'forward',
        source: '?person',
        target: '?v1'
      });
      expect(built.edges[1]).toEqual({
        type: 'edge',
        relation: 'locatedIn',
        direction: 'forward',
        source: '?v1',
        target: '?v2'
      });
      expect(built.returnVariables).toEqual(['?person', '?v2']);
    });

    it('should compile inverse path query', () => {
      // Build path query: ?x.worksAt.^livesIn
      const query = PathQueryFactory.fromPathString('?x.worksAt.^livesIn');
      
      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.edges[1]).toEqual({
        type: 'edge',
        relation: 'livesIn',
        direction: 'backward',
        source: '?v1',
        target: '?v2'
      });
    });

    it('should compile literal constraint', () => {
      // Build path query with literal: ="alice".worksAt
      const query = new PathQueryBuilder()
        .from('?person')
        .literal('alice')
        .forward('worksAt')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.constraints).toHaveLength(1);
      expect(built.constraints[0]).toEqual({
        type: 'constraint',
        operator: 'equals',
        variable: '?person',
        value: 'alice'
      });
      expect(built.edges).toHaveLength(1);
    });
  });

  describe('Query with Predicates', () => {
    beforeEach(() => {
      // Register some predicates
      const personType = new IsTypePredicate('Person');
      personType.addEntity('alice').addEntity('bob').addEntity('charlie');
      predicateRegistry.register('IsType:Person', personType);

      const activeTag = new HasTagPredicate('active');
      activeTag.addTag('project1').addTag('project2');
      predicateRegistry.register('HasTag:active', activeTag);
    });

    it('should integrate type predicates into query', () => {
      // Build query with type predicate
      const query = new PathQueryBuilder()
        .from('?person')
        .forward('worksAt')
        .where({ type: 'isType', typeName: 'Person', variable: '?person' })
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.predicates).toHaveLength(1);
      expect(built.predicates[0].type).toBe('isType');
      expect(built.predicates[0].typeName).toBe('Person');
    });

    it('should handle composite predicates', () => {
      // Create composite predicate
      const rangePred1 = new InRangePredicate(10, 20);
      const rangePred2 = new InRangePredicate(15, 25);
      const andPred = new AndPredicate([rangePred1, rangePred2]);

      // Build query with composite predicate
      const query = new PathQueryBuilder()
        .from('?x')
        .forward('hasValue')
        .where({ 
          type: 'and',
          predicates: [
            { type: 'inRange', min: 10, max: 20 },
            { type: 'inRange', min: 15, max: 25 }
          ]
        })
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.predicates).toHaveLength(1);
      expect(built.predicates[0].type).toBe('and');
      expect(built.predicates[0].predicates).toHaveLength(2);
    });
  });

  describe('Variable Order Optimization', () => {
    it('should optimize variable order with bound variables first', () => {
      // Build query with bound start variable
      const query = new PathQueryBuilder()
        .from('?person')
        .bind('?person', 'alice')
        .forward('worksAt')
        .forward('locatedIn')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      // Check variable order
      expect(built.variableOrder[0]).toBe('?person');
      
      // Verify bound variable is marked correctly
      const personVar = built.variables.find(v => v.name === '?person');
      expect(personVar.isBound).toBe(true);
      expect(personVar.value).toBe('alice');
    });

    it('should generate optimal variable order for complex query', () => {
      // Build complex query
      const query = new PathQueryBuilder()
        .from('?x')
        .path('worksAt.livesIn.manages.^reportsTo')
        .returning('?x', '?v4')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      
      // Optimize variable order
      const optimizedOrder = VariableOrderOptimizer.optimize(spec);
      
      // Should follow path connectivity
      expect(optimizedOrder).toContain('?x');
      expect(optimizedOrder).toContain('?v1');
      expect(optimizedOrder).toContain('?v2');
      expect(optimizedOrder).toContain('?v3');
      expect(optimizedOrder).toContain('?v4');
      
      // Check order follows path
      const xIndex = optimizedOrder.indexOf('?x');
      const v1Index = optimizedOrder.indexOf('?v1');
      expect(v1Index).toBeGreaterThan(xIndex);
    });
  });

  describe('Complex Query Scenarios', () => {
    it('should compile "Suppliers in UK named Acme" query', () => {
      // Register predicates
      const supplierType = new IsTypePredicate('Supplier');
      supplierType.addEntity('supplier1').addEntity('supplier2');
      predicateRegistry.register('IsType:Supplier', supplierType);

      // Build query: Find suppliers located in UK with name "Acme"
      const query = new PathQueryBuilder()
        .from('?supplier')
        .forward('locatedIn')
        .literal('UK')
        .where({ type: 'isType', typeName: 'Supplier', variable: '?supplier' })
        .where({ type: 'hasName', name: 'Acme', variable: '?supplier' })
        .returning('?supplier')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      // Verify compilation
      expect(built.edges).toHaveLength(1);
      expect(built.constraints).toHaveLength(1);
      expect(built.constraints[0].value).toBe('UK');
      expect(built.predicates).toHaveLength(2);
      expect(built.returnVariables).toEqual(['?supplier']);
    });

    it('should compile query with disjunction (OR)', () => {
      // Build query: Find entities that are either Person or Project
      const query = new PathQueryBuilder()
        .from('?entity')
        .where({
          type: 'or',
          predicates: [
            { type: 'isType', typeName: 'Person' },
            { type: 'isType', typeName: 'Project' }
          ]
        })
        .returning('?entity')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.predicates).toHaveLength(1);
      expect(built.predicates[0].type).toBe('or');
      expect(built.predicates[0].predicates).toHaveLength(2);
    });

    it('should compile query with negation (NOT)', () => {
      // Build query: Find entities that are NOT archived
      const query = new PathQueryBuilder()
        .from('?entity')
        .where({
          type: 'not',
          predicate: { type: 'hasTag', tag: 'archived' }
        })
        .returning('?entity')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.predicates).toHaveLength(1);
      expect(built.predicates[0].type).toBe('not');
      expect(built.predicates[0].predicate.type).toBe('hasTag');
    });

    it('should compile multi-hop query with predicates', () => {
      // Build complex query: Find active projects with approved team members
      const query = new PathQueryBuilder()
        .from('?project')
        .where({ type: 'hasTag', tag: 'active', variable: '?project' })
        .forward('hasTeamMember')
        .where({ type: 'hasTag', tag: 'approved', variable: '?v1' })
        .forward('worksIn')
        .returning('?project', '?v1', '?v2')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();

      expect(built.edges).toHaveLength(2);
      expect(built.predicates).toHaveLength(2);
      expect(built.returnVariables).toEqual(['?project', '?v1', '?v2']);
    });
  });

  describe('Kernel Format Conversion', () => {
    it('should convert GraphSpec to kernel format', () => {
      // Build query
      const query = new PathQueryBuilder()
        .from('?x')
        .forward('r1')
        .forward('r2')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      
      // Convert to kernel format
      const kernelFormat = spec.toKernelFormat();

      expect(kernelFormat.queryId).toBeDefined();
      expect(kernelFormat.relations.size).toBe(2);
      expect(kernelFormat.relations.has('r1')).toBe(true);
      expect(kernelFormat.relations.has('r2')).toBe(true);
      expect(kernelFormat.operators).toHaveLength(1); // Join operator
      expect(kernelFormat.operators[0].type).toBe('join');
      expect(kernelFormat.variableOrder).toEqual(['?x', '?v1', '?v2']);
    });

    it('should include constraints in kernel format', () => {
      // Build query with literal
      const query = new PathQueryBuilder()
        .from('?x')
        .literal('value')
        .forward('relation')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      
      // Convert to kernel format
      const kernelFormat = spec.toKernelFormat();

      // Should have filter operator for constraint
      const filterOps = kernelFormat.operators.filter(op => op.type === 'filter');
      expect(filterOps).toHaveLength(1);
      expect(filterOps[0].constraint.value).toBe('value');
    });

    it('should include predicates in kernel format', () => {
      // Build query with predicate
      const query = new PathQueryBuilder()
        .from('?x')
        .where({ type: 'isType', typeName: 'Person' })
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      
      // Convert to kernel format
      const kernelFormat = spec.toKernelFormat();

      // Should have predicate operator
      const predOps = kernelFormat.operators.filter(op => op.type === 'predicate');
      expect(predOps).toHaveLength(1);
      expect(predOps[0].predicate.type).toBe('isType');
    });
  });

  describe('End-to-End Query Compilation', () => {
    it('should compile and prepare query for kernel execution', () => {
      // Setup predicates
      const personType = new IsTypePredicate('Person');
      personType.addEntity('alice').addEntity('bob');
      
      const activeTag = new HasTagPredicate('active');
      activeTag.addTag('project1');

      // Build comprehensive query
      const query = new PathQueryBuilder()
        .from('?person')
        .bind('?person', 'alice')
        .forward('worksOn')
        .where({ type: 'hasTag', tag: 'active', variable: '?v1' })
        .forward('hasDeliverable')
        .forward('reviewedBy')
        .inverse('worksAt')
        .returning('?person', '?v1', '?v4')
        .build();

      // Compile to GraphSpec
      const spec = GraphSpecBuilder.fromPathQuery(query);
      
      // Optimize
      const optimized = GraphSpecBuilder.optimize(spec);
      
      // Get kernel format
      const kernelFormat = optimized.toKernelFormat();

      // Verify complete compilation
      expect(kernelFormat.queryId).toBeDefined();
      expect(kernelFormat.relations.size).toBeGreaterThan(0);
      expect(kernelFormat.operators.length).toBeGreaterThan(0);
      expect(kernelFormat.variableOrder).toContain('?person');
      expect(kernelFormat.variableOrder[0]).toBe('?person'); // Bound variable first
      expect(kernelFormat.outputVariables).toEqual(['?person', '?v1', '?v4']);
    });

    it('should handle query with all features combined', () => {
      // Build query with everything
      const query = PathQueryFactory.fromObject({
        startVariable: '?entity',
        steps: [
          '=alice',           // Literal constraint
          'worksAt',          // Forward step
          '^manages',         // Inverse step
          'locatedIn'         // Forward step
        ],
        predicates: [
          { type: 'isType', typeName: 'Person', variable: '?entity' },
          { 
            type: 'and',
            predicates: [
              { type: 'hasTag', tag: 'senior' },
              { type: 'not', predicate: { type: 'hasTag', tag: 'inactive' } }
            ]
          }
        ],
        returnVariables: ['?entity', '?v3']
      });

      // Full compilation pipeline
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const optimized = GraphSpecBuilder.optimize(spec);
      const kernelFormat = optimized.toKernelFormat();

      // Verify all components present
      expect(kernelFormat.relations.size).toBeGreaterThan(0);
      expect(kernelFormat.operators.some(op => op.type === 'filter')).toBe(true);
      expect(kernelFormat.operators.some(op => op.type === 'predicate')).toBe(true);
      expect(kernelFormat.operators.some(op => op.type === 'join')).toBe(true);
      expect(kernelFormat.outputVariables).toContain('?entity');
      expect(kernelFormat.outputVariables).toContain('?v3');
    });
  });
});