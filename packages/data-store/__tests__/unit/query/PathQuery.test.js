/**
 * Unit tests for PathQuery AST and variable binding
 * Tests query construction and compilation per design §3
 */

import { 
  Variable,
  PathQuery,
  PathQueryBuilder,
  PathQueryFactory
} from '../../../src/query/PathQuery.js';
import { ForwardStep, InverseStep, LiteralStep } from '../../../src/query/PathStep.js';

describe('Variable', () => {
  it('should create variable with name', () => {
    const variable = new Variable('?x');
    
    expect(variable.name).toBe('?x');
    expect(variable.isBound).toBe(false);
    expect(variable.value).toBeUndefined();
  });

  it('should validate variable name', () => {
    expect(() => new Variable()).toThrow('Variable name is required');
    expect(() => new Variable(null)).toThrow('Variable name is required');
    expect(() => new Variable(123)).toThrow('Variable name must be a string');
    expect(() => new Variable('x')).toThrow('Variable name must start with ?');
  });

  it('should bind and unbind values', () => {
    const variable = new Variable('?x');
    
    variable.bind('alice');
    expect(variable.isBound).toBe(true);
    expect(variable.value).toBe('alice');
    
    variable.unbind();
    expect(variable.isBound).toBe(false);
    expect(variable.value).toBeUndefined();
  });

  it('should provide string representation', () => {
    const variable = new Variable('?x');
    expect(variable.toString()).toBe('?x');
    
    variable.bind('alice');
    expect(variable.toString()).toBe('?x=alice');
  });

  it('should support equality comparison', () => {
    const v1 = new Variable('?x');
    const v2 = new Variable('?x');
    const v3 = new Variable('?y');
    
    expect(v1.equals(v2)).toBe(true);
    expect(v1.equals(v3)).toBe(false);
  });
});

describe('PathQuery', () => {
  describe('construction', () => {
    it('should create empty query with defaults', () => {
      const query = new PathQuery();
      
      expect(query.startVariable).toBeInstanceOf(Variable);
      expect(query.startVariable.name).toBe('?start');
      expect(query.steps).toEqual([]);
      expect(query.predicates).toEqual([]);
      expect(query.returnVariables).toEqual([]);
      expect(query.queryId).toMatch(/^query_/);
    });

    it('should accept options', () => {
      const startVar = new Variable('?x');
      const query = new PathQuery({
        startVariable: startVar,
        steps: [new ForwardStep('worksAt')],
        predicates: [{ type: 'filter', field: 'name', value: 'alice' }],
        returnVariables: [new Variable('?y')],
        queryId: 'test-query'
      });
      
      expect(query.startVariable).toBe(startVar);
      expect(query.steps).toHaveLength(1);
      expect(query.predicates).toHaveLength(1);
      expect(query.returnVariables).toHaveLength(1);
      expect(query.queryId).toBe('test-query');
    });
  });

  describe('step management', () => {
    let query;
    
    beforeEach(() => {
      query = new PathQuery();
    });

    it('should add single step', () => {
      const step = new ForwardStep('worksAt');
      query.addStep(step);
      
      expect(query.steps).toHaveLength(1);
      expect(query.steps[0]).toBe(step);
    });

    it('should add multiple steps', () => {
      const steps = [
        new ForwardStep('worksAt'),
        new InverseStep('livesIn'),
        new LiteralStep('alice')
      ];
      
      query.addSteps(steps);
      
      expect(query.steps).toHaveLength(3);
      expect(query.steps).toEqual(steps);
    });

    it('should validate step addition', () => {
      expect(() => query.addStep()).toThrow('Step is required');
      expect(() => query.addSteps('not-array')).toThrow('Steps must be an array');
    });

    it('should return query for chaining', () => {
      const result = query.addStep(new ForwardStep('worksAt'));
      expect(result).toBe(query);
    });
  });

  describe('predicate management', () => {
    let query;
    
    beforeEach(() => {
      query = new PathQuery();
    });

    it('should add predicate', () => {
      const predicate = { type: 'filter', field: 'name', value: 'alice' };
      query.addPredicate(predicate);
      
      expect(query.predicates).toHaveLength(1);
      expect(query.predicates[0]).toBe(predicate);
    });

    it('should validate predicate', () => {
      expect(() => query.addPredicate()).toThrow('Predicate is required');
    });
  });

  describe('return variables', () => {
    let query;
    
    beforeEach(() => {
      query = new PathQuery();
    });

    it('should set return variables from Variable objects', () => {
      const vars = [new Variable('?x'), new Variable('?y')];
      query.setReturnVariables(vars);
      
      expect(query.returnVariables).toHaveLength(2);
      expect(query.returnVariables[0].name).toBe('?x');
      expect(query.returnVariables[1].name).toBe('?y');
    });

    it('should set return variables from strings', () => {
      query.setReturnVariables(['?x', '?y']);
      
      expect(query.returnVariables).toHaveLength(2);
      expect(query.returnVariables[0]).toBeInstanceOf(Variable);
      expect(query.returnVariables[0].name).toBe('?x');
    });

    it('should validate return variables', () => {
      expect(() => query.setReturnVariables('not-array'))
        .toThrow('Return variables must be an array');
    });
  });

  describe('variable management', () => {
    it('should get all variables in query', () => {
      const query = new PathQuery();
      query.addSteps([
        new ForwardStep('worksAt'),
        new ForwardStep('livesIn')
      ]);
      query.setReturnVariables(['?x', '?y']);
      
      const allVars = query.getAllVariables();
      
      expect(allVars.length).toBeGreaterThanOrEqual(3);
      expect(allVars.some(v => v.name === '?start')).toBe(true);
      expect(allVars.some(v => v.name === '?v1')).toBe(true);
      expect(allVars.some(v => v.name === '?v2')).toBe(true);
    });

    it('should generate variable order', () => {
      const query = new PathQuery();
      query.addSteps([
        new ForwardStep('worksAt'),
        new ForwardStep('livesIn')
      ]);
      
      const order = query.generateVariableOrder();
      
      expect(order).toBeInstanceOf(Array);
      expect(order.length).toBeGreaterThanOrEqual(3);
      expect(order[0].name).toBe('?start');
    });

    it('should prioritize bound variables in order', () => {
      const query = new PathQuery();
      query.startVariable.bind('alice');
      query.addStep(new ForwardStep('worksAt'));
      
      const order = query.generateVariableOrder();
      
      expect(order[0]).toBe(query.startVariable);
      expect(order[0].isBound).toBe(true);
    });
  });

  describe('GraphSpec compilation', () => {
    it('should compile simple forward path', () => {
      const query = new PathQuery();
      query.addStep(new ForwardStep('worksAt'));
      
      const spec = query.toGraphSpec();
      
      expect(spec.queryId).toBe(query.queryId);
      expect(spec.variables).toBeInstanceOf(Array);
      expect(spec.edges).toHaveLength(1);
      expect(spec.edges[0]).toEqual({
        type: 'edge',
        relation: 'worksAt',
        direction: 'forward',
        source: '?start',
        target: '?v1'
      });
      expect(spec.constraints).toEqual([]);
      expect(spec.variableOrder).toBeInstanceOf(Array);
    });

    it('should compile path with inverse step', () => {
      const query = new PathQuery();
      query.addSteps([
        new ForwardStep('worksAt'),
        new InverseStep('livesIn')
      ]);
      
      const spec = query.toGraphSpec();
      
      expect(spec.edges).toHaveLength(2);
      expect(spec.edges[1]).toEqual({
        type: 'edge',
        relation: 'livesIn',
        direction: 'backward',
        source: '?v1',
        target: '?v2'
      });
    });

    it('should compile literal constraints', () => {
      const query = new PathQuery();
      query.addSteps([
        new LiteralStep('alice'),
        new ForwardStep('worksAt')
      ]);
      
      const spec = query.toGraphSpec();
      
      expect(spec.constraints).toHaveLength(1);
      expect(spec.constraints[0]).toEqual({
        type: 'constraint',
        operator: 'equals',
        variable: '?start',
        value: 'alice'
      });
    });

    it('should include predicates', () => {
      const query = new PathQuery();
      query.addPredicate({ type: 'filter', field: 'age', operator: '>', value: 18 });
      
      const spec = query.toGraphSpec();
      
      expect(spec.predicates).toHaveLength(1);
      expect(spec.predicates[0].type).toBe('filter');
    });

    it('should include return variables', () => {
      const query = new PathQuery();
      query.setReturnVariables(['?x', '?y']);
      
      const spec = query.toGraphSpec();
      
      expect(spec.returnVariables).toEqual(['?x', '?y']);
    });
  });

  describe('query operations', () => {
    it('should clone query', () => {
      const original = new PathQuery({
        startVariable: new Variable('?x'),
        steps: [new ForwardStep('worksAt')],
        predicates: [{ type: 'filter' }],
        returnVariables: [new Variable('?y')],
        queryId: 'original'
      });
      
      const clone = original.clone();
      
      expect(clone).not.toBe(original);
      expect(clone.queryId).toBe('original');
      expect(clone.steps).toEqual(original.steps);
      expect(clone.startVariable).not.toBe(original.startVariable);
      expect(clone.startVariable.name).toBe(original.startVariable.name);
    });

    it('should provide string representation', () => {
      const query = new PathQuery();
      query.addSteps([
        new ForwardStep('worksAt'),
        new InverseStep('livesIn')
      ]);
      query.setReturnVariables(['?x', '?y']);
      
      const str = query.toString();
      
      expect(str).toContain('PathQuery');
      expect(str).toContain('?start');
      expect(str).toContain('worksAt');
      expect(str).toContain('?x, ?y');
    });
  });
});

describe('PathQueryBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new PathQueryBuilder();
  });

  it('should build query fluently', () => {
    const query = builder
      .from('?person')
      .forward('worksAt')
      .inverse('livesIn')
      .literal('NYC')
      .where({ type: 'filter', field: 'active', value: true })
      .returning('?person', '?company')
      .build();
    
    expect(query).toBeInstanceOf(PathQuery);
    expect(query.startVariable.name).toBe('?person');
    expect(query.steps).toHaveLength(3);
    expect(query.predicates).toHaveLength(1);
    expect(query.returnVariables).toHaveLength(2);
  });

  it('should parse path strings', () => {
    const query = builder
      .from('?x')
      .path('worksAt.^livesIn.manages')
      .build();
    
    expect(query.steps).toHaveLength(3);
    expect(query.steps[0]).toBeInstanceOf(ForwardStep);
    expect(query.steps[1]).toBeInstanceOf(InverseStep);
    expect(query.steps[2]).toBeInstanceOf(ForwardStep);
  });

  it('should bind starting variable', () => {
    const query = builder
      .from('?person')
      .bind('?person', 'alice')
      .forward('worksAt')
      .build();
    
    expect(query.startVariable.isBound).toBe(true);
    expect(query.startVariable.value).toBe('alice');
  });

  it('should validate path string', () => {
    expect(() => builder.path()).toThrow('Path string is required');
  });
});

describe('PathQueryFactory', () => {
  describe('fromPathString', () => {
    it('should parse simple path string', () => {
      const query = PathQueryFactory.fromPathString('?x.worksAt.livesIn');
      
      expect(query.startVariable.name).toBe('?x');
      expect(query.steps).toHaveLength(2);
      expect(query.steps[0]).toBeInstanceOf(ForwardStep);
      expect(query.steps[0].relationName).toBe('worksAt');
    });

    it('should parse path with inverse steps', () => {
      const query = PathQueryFactory.fromPathString('?x.worksAt.^livesIn.manages');
      
      expect(query.steps).toHaveLength(3);
      expect(query.steps[1]).toBeInstanceOf(InverseStep);
      expect(query.steps[1].relationName).toBe('livesIn');
    });

    it('should handle path without starting variable', () => {
      const query = PathQueryFactory.fromPathString('worksAt.livesIn');
      
      expect(query.startVariable.name).toBe('?start');
      expect(query.steps).toHaveLength(2);
    });

    it('should validate input', () => {
      expect(() => PathQueryFactory.fromPathString())
        .toThrow('Path string is required');
      expect(() => PathQueryFactory.fromPathString(''))
        .toThrow('Path string is required');
    });
  });

  describe('fromObject', () => {
    it('should create query from object specification', () => {
      const spec = {
        queryId: 'test-query',
        startVariable: '?person',
        steps: ['worksAt', '^livesIn', '=NYC'],
        predicates: [{ type: 'filter', field: 'active', value: true }],
        returnVariables: ['?person', '?company']
      };
      
      const query = PathQueryFactory.fromObject(spec);
      
      expect(query.queryId).toBe('test-query');
      expect(query.startVariable.name).toBe('?person');
      expect(query.steps).toHaveLength(3);
      expect(query.predicates).toHaveLength(1);
      expect(query.returnVariables).toHaveLength(2);
    });

    it('should handle step objects', () => {
      const spec = {
        steps: [
          { type: 'forward', relation: 'worksAt' },
          { type: 'inverse', relation: 'livesIn' },
          { type: 'literal', value: 'NYC' }
        ]
      };
      
      const query = PathQueryFactory.fromObject(spec);
      
      expect(query.steps).toHaveLength(3);
      expect(query.steps[0]).toBeInstanceOf(ForwardStep);
      expect(query.steps[1]).toBeInstanceOf(InverseStep);
      expect(query.steps[2]).toBeInstanceOf(LiteralStep);
    });

    it('should validate input', () => {
      expect(() => PathQueryFactory.fromObject())
        .toThrow('Query specification is required');
      expect(() => PathQueryFactory.fromObject('not-object'))
        .toThrow('Query specification is required');
    });
  });
});