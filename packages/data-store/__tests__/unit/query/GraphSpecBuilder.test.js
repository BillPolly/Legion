/**
 * Unit tests for GraphSpec builder
 * Tests GraphSpec generation from PathQuery per design §3
 */

import { 
  GraphSpec,
  GraphSpecBuilder,
  VariableOrderOptimizer
} from '../../../src/query/GraphSpecBuilder.js';
import {
  Variable,
  PathQuery,
  PathQueryBuilder
} from '../../../src/query/PathQuery.js';
import {
  ForwardStep,
  InverseStep,
  LiteralStep
} from '../../../src/query/PathStep.js';

describe('GraphSpec', () => {
  let spec;

  beforeEach(() => {
    spec = new GraphSpec();
  });

  describe('construction', () => {
    it('should create empty GraphSpec', () => {
      const built = spec.build();
      
      expect(built.queryId).toBe(null);
      expect(built.variables).toEqual([]);
      expect(built.edges).toEqual([]);
      expect(built.constraints).toEqual([]);
      expect(built.predicates).toEqual([]);
      expect(built.operators).toEqual([]);
      expect(built.variableOrder).toEqual([]);
      expect(built.returnVariables).toEqual([]);
    });

    it('should set query ID', () => {
      spec.setQueryId('test-query-123');
      const built = spec.build();
      
      expect(built.queryId).toBe('test-query-123');
    });
  });

  describe('variable management', () => {
    it('should add variable', () => {
      spec.addVariable('?x', { isBound: false, type: 'free' });
      const built = spec.build();
      
      expect(built.variables).toHaveLength(1);
      expect(built.variables[0]).toEqual({
        name: '?x',
        isBound: false,
        value: undefined,
        type: 'free'
      });
    });

    it('should add bound variable', () => {
      spec.addVariable('?x', { isBound: true, value: 'alice', type: 'bound' });
      const built = spec.build();
      
      expect(built.variables[0].isBound).toBe(true);
      expect(built.variables[0].value).toBe('alice');
      expect(built.variables[0].type).toBe('bound');
    });

    it('should validate variable name', () => {
      expect(() => spec.addVariable()).toThrow('Variable name is required');
      expect(() => spec.addVariable('x')).toThrow('Variable name must start with ?');
    });

    it('should support chaining', () => {
      const result = spec.addVariable('?x').addVariable('?y');
      expect(result).toBe(spec);
    });
  });

  describe('edge management', () => {
    it('should add edge', () => {
      spec.addEdge({
        relation: 'worksAt',
        direction: 'forward',
        source: '?x',
        target: '?y'
      });
      const built = spec.build();
      
      expect(built.edges).toHaveLength(1);
      expect(built.edges[0]).toEqual({
        type: 'edge',
        relation: 'worksAt',
        direction: 'forward',
        source: '?x',
        target: '?y'
      });
    });

    it('should validate edge', () => {
      expect(() => spec.addEdge()).toThrow('Edge specification is required');
      expect(() => spec.addEdge({})).toThrow('Edge must have a relation');
      expect(() => spec.addEdge({ relation: 'r' })).toThrow('Edge must have a source variable');
      expect(() => spec.addEdge({ relation: 'r', source: '?x' }))
        .toThrow('Edge must have a target variable');
    });

    it('should default direction to forward', () => {
      spec.addEdge({
        relation: 'worksAt',
        source: '?x',
        target: '?y'
      });
      const built = spec.build();
      
      expect(built.edges[0].direction).toBe('forward');
    });
  });

  describe('constraint management', () => {
    it('should add constraint', () => {
      spec.addConstraint({
        operator: 'equals',
        variable: '?x',
        value: 'alice'
      });
      const built = spec.build();
      
      expect(built.constraints).toHaveLength(1);
      expect(built.constraints[0]).toEqual({
        type: 'constraint',
        operator: 'equals',
        variable: '?x',
        value: 'alice'
      });
    });

    it('should validate constraint', () => {
      expect(() => spec.addConstraint()).toThrow('Constraint specification is required');
      expect(() => spec.addConstraint({})).toThrow('Constraint must have a variable');
      expect(() => spec.addConstraint({ variable: '?x' }))
        .toThrow('Constraint must have an operator');
    });
  });

  describe('predicate management', () => {
    it('should add predicate', () => {
      spec.addPredicate({
        type: 'filter',
        field: 'age',
        operator: '>',
        value: 18
      });
      const built = spec.build();
      
      expect(built.predicates).toHaveLength(1);
      expect(built.predicates[0].type).toBe('filter');
      expect(built.predicates[0].field).toBe('age');
    });

    it('should default predicate type to custom', () => {
      spec.addPredicate({ field: 'name' });
      const built = spec.build();
      
      expect(built.predicates[0].type).toBe('custom');
    });

    it('should validate predicate', () => {
      expect(() => spec.addPredicate()).toThrow('Predicate specification is required');
    });
  });

  describe('operator management', () => {
    it('should add operator', () => {
      spec.addOperator({
        type: 'join',
        edges: ['e1', 'e2']
      });
      const built = spec.build();
      
      expect(built.operators).toHaveLength(1);
      expect(built.operators[0].type).toBe('join');
    });

    it('should validate operator', () => {
      expect(() => spec.addOperator()).toThrow('Operator specification is required');
      expect(() => spec.addOperator({})).toThrow('Operator must have a type');
    });
  });

  describe('variable order', () => {
    it('should set variable order', () => {
      spec.setVariableOrder(['?x', '?y', '?z']);
      const built = spec.build();
      
      expect(built.variableOrder).toEqual(['?x', '?y', '?z']);
    });

    it('should validate variable order', () => {
      expect(() => spec.setVariableOrder('not-array'))
        .toThrow('Variable order must be an array');
    });
  });

  describe('return variables', () => {
    it('should set return variables', () => {
      spec.setReturnVariables(['?x', '?y']);
      const built = spec.build();
      
      expect(built.returnVariables).toEqual(['?x', '?y']);
    });

    it('should validate return variables', () => {
      expect(() => spec.setReturnVariables('not-array'))
        .toThrow('Return variables must be an array');
    });
  });

  describe('kernel format conversion', () => {
    it('should convert to kernel format', () => {
      spec.setQueryId('kernel-test')
        .addVariable('?x')
        .addVariable('?y')
        .addEdge({
          relation: 'worksAt',
          direction: 'forward',
          source: '?x',
          target: '?y'
        })
        .addConstraint({
          operator: 'equals',
          variable: '?x',
          value: 'alice'
        })
        .setVariableOrder(['?x', '?y'])
        .setReturnVariables(['?y']);
      
      const kernel = spec.toKernelFormat();
      
      expect(kernel.queryId).toBe('kernel-test');
      expect(kernel.relations.size).toBe(1);
      expect(kernel.relations.get('worksAt')).toEqual({
        name: 'worksAt',
        edges: [{
          direction: 'forward',
          source: '?x',
          target: '?y'
        }]
      });
      expect(kernel.operators).toHaveLength(1);
      expect(kernel.operators[0].type).toBe('filter');
      expect(kernel.variableOrder).toEqual(['?x', '?y']);
      expect(kernel.outputVariables).toEqual(['?y']);
    });

    it('should create join operator for multi-edge patterns', () => {
      spec.addEdge({
        relation: 'worksAt',
        source: '?x',
        target: '?y'
      })
      .addEdge({
        relation: 'livesIn',
        source: '?y',
        target: '?z'
      });
      
      const kernel = spec.toKernelFormat();
      
      expect(kernel.operators.some(op => op.type === 'join')).toBe(true);
      const joinOp = kernel.operators.find(op => op.type === 'join');
      expect(joinOp.edges).toHaveLength(2);
    });
  });
});

describe('GraphSpecBuilder', () => {
  describe('fromPathQuery', () => {
    it('should build GraphSpec from simple PathQuery', () => {
      const query = new PathQuery();
      query.addStep(new ForwardStep('worksAt'));
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      expect(built.queryId).toBe(query.queryId);
      expect(built.variables.length).toBeGreaterThanOrEqual(2);
      expect(built.edges).toHaveLength(1);
      expect(built.edges[0].relation).toBe('worksAt');
    });

    it('should handle inverse steps', () => {
      const query = new PathQuery();
      query.addSteps([
        new ForwardStep('worksAt'),
        new InverseStep('livesIn')
      ]);
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      expect(built.edges).toHaveLength(2);
      expect(built.edges[0].direction).toBe('forward');
      expect(built.edges[1].direction).toBe('backward');
    });

    it('should handle literal constraints', () => {
      const query = new PathQuery();
      query.addSteps([
        new LiteralStep('alice'),
        new ForwardStep('worksAt')
      ]);
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      expect(built.constraints).toHaveLength(1);
      expect(built.constraints[0].operator).toBe('equals');
      expect(built.constraints[0].value).toBe('alice');
    });

    it('should include predicates', () => {
      const query = new PathQuery();
      query.addPredicate({ type: 'filter', field: 'active', value: true });
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      expect(built.predicates).toHaveLength(1);
      expect(built.predicates[0].type).toBe('filter');
    });

    it('should set variable order', () => {
      const query = new PathQuery();
      query.addStep(new ForwardStep('worksAt'));
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      expect(built.variableOrder).toBeInstanceOf(Array);
      expect(built.variableOrder[0]).toBe('?start');
    });

    it('should set return variables', () => {
      const query = new PathQuery();
      query.setReturnVariables(['?x', '?y']);
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      expect(built.returnVariables).toEqual(['?x', '?y']);
    });

    it('should handle bound variables', () => {
      const query = new PathQuery();
      query.startVariable.bind('alice');
      query.addStep(new ForwardStep('worksAt'));
      
      const spec = GraphSpecBuilder.fromPathQuery(query);
      const built = spec.build();
      
      const startVar = built.variables.find(v => v.name === '?start');
      expect(startVar.isBound).toBe(true);
      expect(startVar.value).toBe('alice');
    });

    it('should validate input', () => {
      expect(() => GraphSpecBuilder.fromPathQuery())
        .toThrow('PathQuery is required');
    });
  });

  describe('optimize', () => {
    it('should validate all variables are declared', () => {
      const spec = new GraphSpec();
      spec.addVariable('?x')
        .addEdge({
          relation: 'worksAt',
          source: '?x',
          target: '?y' // Undeclared
        });
      
      expect(() => GraphSpecBuilder.optimize(spec))
        .toThrow('Undeclared variable in edge: ?y');
    });

    it('should validate constraint variables', () => {
      const spec = new GraphSpec();
      spec.addConstraint({
        operator: 'equals',
        variable: '?x', // Undeclared
        value: 'alice'
      });
      
      expect(() => GraphSpecBuilder.optimize(spec))
        .toThrow('Undeclared variable in constraint: ?x');
    });

    it('should pass valid specs unchanged', () => {
      const spec = new GraphSpec();
      spec.addVariable('?x')
        .addVariable('?y')
        .addEdge({
          relation: 'worksAt',
          source: '?x',
          target: '?y'
        });
      
      const optimized = GraphSpecBuilder.optimize(spec);
      expect(optimized).toBe(spec);
    });
  });

  describe('createSimplePath', () => {
    it('should create simple forward path', () => {
      const spec = GraphSpecBuilder.createSimplePath(
        '?person',
        ['worksAt', 'locatedIn'],
        ['?person', '?location']
      );
      const built = spec.build();
      
      expect(built.variables).toHaveLength(3);
      expect(built.edges).toHaveLength(2);
      expect(built.edges[0].relation).toBe('worksAt');
      expect(built.edges[1].relation).toBe('locatedIn');
      expect(built.returnVariables).toEqual(['?person', '?location']);
    });

    it('should handle inverse relations', () => {
      const spec = GraphSpecBuilder.createSimplePath(
        '?x',
        ['worksAt', '^livesIn'],
        []
      );
      const built = spec.build();
      
      expect(built.edges[1].relation).toBe('livesIn');
      expect(built.edges[1].direction).toBe('backward');
    });

    it('should default return variables to all variables', () => {
      const spec = GraphSpecBuilder.createSimplePath(
        '?x',
        ['r1', 'r2'],
        []
      );
      const built = spec.build();
      
      expect(built.returnVariables).toEqual(['?x', '?v1', '?v2']);
    });
  });
});

describe('VariableOrderOptimizer', () => {
  let spec;

  beforeEach(() => {
    spec = new GraphSpec();
  });

  describe('optimize', () => {
    it('should prioritize bound variables', () => {
      spec.addVariable('?x', { isBound: false })
        .addVariable('?y', { isBound: true, value: 'alice' })
        .addVariable('?z', { isBound: false })
        .addEdge({
          relation: 'r1',
          source: '?y',
          target: '?x'
        })
        .addEdge({
          relation: 'r2',
          source: '?x',
          target: '?z'
        });
      
      const order = VariableOrderOptimizer.optimize(spec);
      
      expect(order[0]).toBe('?y'); // Bound variable first
      expect(order).toContain('?x');
      expect(order).toContain('?z');
    });

    it('should follow edge connectivity', () => {
      spec.addVariable('?a')
        .addVariable('?b')
        .addVariable('?c')
        .addEdge({
          relation: 'r1',
          source: '?a',
          target: '?b'
        })
        .addEdge({
          relation: 'r2',
          source: '?b',
          target: '?c'
        });
      
      const order = VariableOrderOptimizer.optimize(spec);
      
      // Should follow path order
      const aIndex = order.indexOf('?a');
      const bIndex = order.indexOf('?b');
      const cIndex = order.indexOf('?c');
      
      expect(bIndex).toBeGreaterThan(aIndex);
      expect(cIndex).toBeGreaterThan(bIndex);
    });

    it('should handle disconnected variables', () => {
      spec.addVariable('?x')
        .addVariable('?y')
        .addVariable('?z')
        .addEdge({
          relation: 'r',
          source: '?x',
          target: '?y'
        });
      // ?z is disconnected
      
      const order = VariableOrderOptimizer.optimize(spec);
      
      expect(order).toHaveLength(3);
      expect(order).toContain('?z');
    });
  });

  describe('estimateCost', () => {
    it('should prefer bound variables early', () => {
      spec.addVariable('?x', { isBound: true, value: 'alice' })
        .addVariable('?y', { isBound: false })
        .addVariable('?z', { isBound: false });
      
      const goodOrder = ['?x', '?y', '?z'];
      const badOrder = ['?y', '?z', '?x'];
      
      const goodCost = VariableOrderOptimizer.estimateCost(goodOrder, spec);
      const badCost = VariableOrderOptimizer.estimateCost(badOrder, spec);
      
      expect(goodCost).toBeLessThan(badCost);
    });

    it('should handle missing variables', () => {
      spec.addVariable('?x')
        .addVariable('?y');
      
      const order = ['?x', '?unknown', '?y'];
      const cost = VariableOrderOptimizer.estimateCost(order, spec);
      
      expect(cost).toBeGreaterThan(0);
    });
  });
});