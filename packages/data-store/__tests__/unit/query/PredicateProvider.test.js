/**
 * Unit tests for PredicateProvider classes
 * Tests computed predicate functionality per design §5
 */

import {
  PredicateProvider,
  EnumerablePredicate,
  PointwisePredicate,
  IsTypePredicate,
  HasTagPredicate,
  InRangePredicate,
  MatchesPatternPredicate,
  AndPredicate,
  OrPredicate,
  NotPredicate,
  PredicateRegistry
} from '../../../src/query/PredicateProvider.js';

describe('PredicateProvider', () => {
  describe('base class', () => {
    it('should not be instantiable directly', () => {
      expect(() => new PredicateProvider('test')).toThrow('PredicateProvider is an abstract class');
    });

    it('should require predicate name', () => {
      class TestPredicate extends PredicateProvider {}
      expect(() => new TestPredicate()).toThrow('Predicate name is required');
    });

    it('should require subclasses to implement type getter', () => {
      class TestPredicate extends PredicateProvider {
        constructor() { super('test'); }
      }
      const pred = new TestPredicate();
      
      expect(() => pred.type).toThrow('type getter must be implemented by subclass');
    });

    it('should manage parameters', () => {
      class TestPredicate extends PredicateProvider {
        constructor() { super('test'); }
        get type() { return 'test'; }
      }
      const pred = new TestPredicate();
      
      pred.setParameter('key', 'value');
      expect(pred.getParameter('key')).toBe('value');
      expect(pred.getParameter('unknown')).toBeUndefined();
    });
  });
});

describe('EnumerablePredicate', () => {
  class TestEnumerable extends EnumerablePredicate {
    constructor() {
      super('TestEnum');
      this._values = [];
    }
    
    setValues(values) {
      this._values = values;
    }
    
    enumerate() {
      return this._values;
    }
  }

  let predicate;

  beforeEach(() => {
    predicate = new TestEnumerable();
  });

  it('should have enumerable type', () => {
    expect(predicate.type).toBe('enumerable');
  });

  it('should require enumerate implementation', () => {
    const basePred = new EnumerablePredicate('base');
    expect(() => basePred.enumerate()).toThrow('enumerate must be implemented by subclass');
  });

  it('should check values against enumeration', () => {
    predicate.setValues(['a', 'b', 'c']);
    
    expect(predicate.check('a')).toBe(true);
    expect(predicate.check('b')).toBe(true);
    expect(predicate.check('d')).toBe(false);
  });

  it('should provide iterator interface', () => {
    predicate.setValues(['a', 'b', 'c']);
    const iter = predicate.getIterator();
    
    expect(iter.hasNext()).toBe(true);
    expect(iter.next()).toBe('a');
    expect(iter.next()).toBe('b');
    expect(iter.next()).toBe('c');
    expect(iter.hasNext()).toBe(false);
  });

  it('should support seek in iterator', () => {
    predicate.setValues(['a', 'b', 'd', 'e']);
    const iter = predicate.getIterator();
    
    expect(iter.seek('c')).toBe('d');
    expect(iter.next()).toBe('e');
    expect(iter.hasNext()).toBe(false);
  });

  it('should support reset in iterator', () => {
    predicate.setValues(['a', 'b']);
    const iter = predicate.getIterator();
    
    iter.next();
    iter.next();
    expect(iter.hasNext()).toBe(false);
    
    iter.reset();
    expect(iter.hasNext()).toBe(true);
    expect(iter.next()).toBe('a');
  });

  it('should convert to GraphSpec', () => {
    predicate.setParameter('param1', 'value1');
    const spec = predicate.toGraphSpec();
    
    expect(spec.type).toBe('predicate');
    expect(spec.predicateType).toBe('enumerable');
    expect(spec.name).toBe('TestEnum');
    expect(spec.parameters.param1).toBe('value1');
  });
});

describe('PointwisePredicate', () => {
  class TestPointwise extends PointwisePredicate {
    constructor() {
      super('TestPoint');
    }
    
    check(value) {
      return value > 5;
    }
  }

  let predicate;

  beforeEach(() => {
    predicate = new TestPointwise();
  });

  it('should have pointwise type', () => {
    expect(predicate.type).toBe('pointwise');
  });

  it('should require check implementation', () => {
    const basePred = new PointwisePredicate('base');
    expect(() => basePred.check('value')).toThrow('check must be implemented by subclass');
  });

  it('should not support enumeration', () => {
    expect(() => predicate.enumerate()).toThrow('Pointwise predicates cannot enumerate values');
  });

  it('should check individual values', () => {
    expect(predicate.check(10)).toBe(true);
    expect(predicate.check(3)).toBe(false);
  });
});

describe('IsTypePredicate', () => {
  let predicate;

  beforeEach(() => {
    predicate = new IsTypePredicate('Person');
  });

  it('should track entities with type', () => {
    predicate.addEntity('alice');
    predicate.addEntity('bob');
    
    expect(predicate.check('alice')).toBe(true);
    expect(predicate.check('bob')).toBe(true);
    expect(predicate.check('charlie')).toBe(false);
  });

  it('should enumerate entities', () => {
    predicate.addEntity('bob');
    predicate.addEntity('alice');
    
    const entities = predicate.enumerate();
    expect(entities).toEqual(['alice', 'bob']); // Sorted
  });

  it('should remove entities', () => {
    predicate.addEntity('alice');
    predicate.addEntity('bob');
    predicate.removeEntity('alice');
    
    expect(predicate.check('alice')).toBe(false);
    expect(predicate.check('bob')).toBe(true);
  });

  it('should store type parameter', () => {
    expect(predicate.getParameter('type')).toBe('Person');
  });

  it('should support chaining', () => {
    const result = predicate.addEntity('alice').addEntity('bob').removeEntity('alice');
    expect(result).toBe(predicate);
  });
});

describe('HasTagPredicate', () => {
  let predicate;

  beforeEach(() => {
    predicate = new HasTagPredicate('active');
  });

  it('should track tagged entities', () => {
    predicate.addTag('project1');
    predicate.addTag('project2');
    
    expect(predicate.check('project1')).toBe(true);
    expect(predicate.check('project2')).toBe(true);
    expect(predicate.check('project3')).toBe(false);
  });

  it('should enumerate tagged entities', () => {
    predicate.addTag('p2');
    predicate.addTag('p1');
    
    const entities = predicate.enumerate();
    expect(entities).toEqual(['p1', 'p2']); // Sorted
  });

  it('should remove tags', () => {
    predicate.addTag('project1');
    predicate.removeTag('project1');
    
    expect(predicate.check('project1')).toBe(false);
  });

  it('should store tag parameter', () => {
    expect(predicate.getParameter('tag')).toBe('active');
  });
});

describe('InRangePredicate', () => {
  let predicate;

  beforeEach(() => {
    predicate = new InRangePredicate(10, 20);
  });

  it('should check numeric range', () => {
    expect(predicate.check(15)).toBe(true);
    expect(predicate.check(10)).toBe(true);
    expect(predicate.check(20)).toBe(true);
    expect(predicate.check(5)).toBe(false);
    expect(predicate.check(25)).toBe(false);
  });

  it('should reject non-numeric values', () => {
    expect(predicate.check('15')).toBe(false);
    expect(predicate.check(null)).toBe(false);
    expect(predicate.check(undefined)).toBe(false);
  });

  it('should store range parameters', () => {
    expect(predicate.getParameter('min')).toBe(10);
    expect(predicate.getParameter('max')).toBe(20);
  });
});

describe('MatchesPatternPredicate', () => {
  it('should accept string pattern', () => {
    const predicate = new MatchesPatternPredicate('^test');
    
    expect(predicate.check('testing')).toBe(true);
    expect(predicate.check('test123')).toBe(true);
    expect(predicate.check('nottest')).toBe(false);
  });

  it('should accept RegExp pattern', () => {
    const predicate = new MatchesPatternPredicate(/\d{3}/);
    
    expect(predicate.check('abc123def')).toBe(true);
    expect(predicate.check('12')).toBe(false);
  });

  it('should reject non-string values', () => {
    const predicate = new MatchesPatternPredicate('test');
    
    expect(predicate.check(123)).toBe(false);
    expect(predicate.check(null)).toBe(false);
  });

  it('should validate pattern type', () => {
    expect(() => new MatchesPatternPredicate(123))
      .toThrow('Pattern must be string or RegExp');
  });
});

describe('Composite Predicates', () => {
  describe('AndPredicate', () => {
    it('should require all predicates to pass', () => {
      const pred1 = new InRangePredicate(10, 20);
      const pred2 = new InRangePredicate(15, 25);
      const andPred = new AndPredicate([pred1, pred2]);
      
      expect(andPred.check(17)).toBe(true);  // In both ranges
      expect(andPred.check(12)).toBe(false); // Only in first range
      expect(andPred.check(22)).toBe(false); // Only in second range
      expect(andPred.check(5)).toBe(false);  // In neither range
    });

    it('should support adding predicates', () => {
      const andPred = new AndPredicate();
      andPred.addPredicate(new InRangePredicate(10, 20));
      andPred.addPredicate(new InRangePredicate(15, 25));
      
      expect(andPred.check(17)).toBe(true);
    });

    it('should check if can evaluate', () => {
      const pred1 = new InRangePredicate(10, 20);
      const pred2 = new InRangePredicate(15, 25);
      const andPred = new AndPredicate([pred1, pred2]);
      
      expect(andPred.canEvaluate()).toBe(true);
    });
  });

  describe('OrPredicate', () => {
    it('should require any predicate to pass', () => {
      const pred1 = new InRangePredicate(10, 15);
      const pred2 = new InRangePredicate(20, 25);
      const orPred = new OrPredicate([pred1, pred2]);
      
      expect(orPred.check(12)).toBe(true);  // In first range
      expect(orPred.check(22)).toBe(true);  // In second range
      expect(orPred.check(17)).toBe(false); // In neither range
    });

    it('should support adding predicates', () => {
      const orPred = new OrPredicate();
      orPred.addPredicate(new InRangePredicate(10, 15));
      orPred.addPredicate(new InRangePredicate(20, 25));
      
      expect(orPred.check(12)).toBe(true);
    });
  });

  describe('NotPredicate', () => {
    it('should negate predicate result', () => {
      const rangePred = new InRangePredicate(10, 20);
      const notPred = new NotPredicate(rangePred);
      
      expect(notPred.check(15)).toBe(false); // In range -> negated to false
      expect(notPred.check(5)).toBe(true);   // Not in range -> negated to true
      expect(notPred.check(25)).toBe(true);  // Not in range -> negated to true
    });

    it('should require predicate', () => {
      expect(() => new NotPredicate()).toThrow('Predicate is required for negation');
    });

    it('should check if can evaluate', () => {
      const rangePred = new InRangePredicate(10, 20);
      const notPred = new NotPredicate(rangePred);
      
      expect(notPred.canEvaluate()).toBe(true);
    });
  });
});

describe('PredicateRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new PredicateRegistry();
  });

  describe('registration', () => {
    it('should register predicates', () => {
      const pred = new InRangePredicate(10, 20);
      registry.register('ageRange', pred);
      
      expect(registry.has('ageRange')).toBe(true);
      expect(registry.get('ageRange')).toBe(pred);
    });

    it('should validate registration', () => {
      expect(() => registry.register()).toThrow('Predicate name is required');
      expect(() => registry.register('test')).toThrow('Predicate provider is required');
    });

    it('should support chaining', () => {
      const pred1 = new InRangePredicate(10, 20);
      const pred2 = new InRangePredicate(30, 40);
      
      const result = registry.register('p1', pred1).register('p2', pred2);
      expect(result).toBe(registry);
    });
  });

  describe('type predicates', () => {
    it('should get or create type predicates', () => {
      const pred1 = registry.getTypePredicate('Person');
      const pred2 = registry.getTypePredicate('Person');
      
      expect(pred1).toBe(pred2); // Same instance
      expect(pred1).toBeInstanceOf(IsTypePredicate);
      expect(registry.has('IsType:Person')).toBe(true);
    });

    it('should maintain separate type predicates', () => {
      const personPred = registry.getTypePredicate('Person');
      const projectPred = registry.getTypePredicate('Project');
      
      personPred.addEntity('alice');
      projectPred.addEntity('project1');
      
      expect(personPred.check('alice')).toBe(true);
      expect(personPred.check('project1')).toBe(false);
      expect(projectPred.check('project1')).toBe(true);
    });
  });

  describe('tag predicates', () => {
    it('should get or create tag predicates', () => {
      const pred1 = registry.getTagPredicate('active');
      const pred2 = registry.getTagPredicate('active');
      
      expect(pred1).toBe(pred2); // Same instance
      expect(pred1).toBeInstanceOf(HasTagPredicate);
      expect(registry.has('HasTag:active')).toBe(true);
    });

    it('should maintain separate tag predicates', () => {
      const activePred = registry.getTagPredicate('active');
      const archivedPred = registry.getTagPredicate('archived');
      
      activePred.addTag('project1');
      archivedPred.addTag('project2');
      
      expect(activePred.check('project1')).toBe(true);
      expect(activePred.check('project2')).toBe(false);
    });
  });

  describe('createFromSpec', () => {
    it('should create IsType predicate', () => {
      const pred = registry.createFromSpec({
        type: 'isType',
        typeName: 'Person'
      });
      
      expect(pred).toBeInstanceOf(IsTypePredicate);
      expect(pred.getParameter('type')).toBe('Person');
    });

    it('should create HasTag predicate', () => {
      const pred = registry.createFromSpec({
        type: 'hasTag',
        tag: 'active'
      });
      
      expect(pred).toBeInstanceOf(HasTagPredicate);
      expect(pred.getParameter('tag')).toBe('active');
    });

    it('should create InRange predicate', () => {
      const pred = registry.createFromSpec({
        type: 'inRange',
        min: 10,
        max: 20
      });
      
      expect(pred).toBeInstanceOf(InRangePredicate);
      expect(pred.check(15)).toBe(true);
    });

    it('should create MatchesPattern predicate', () => {
      const pred = registry.createFromSpec({
        type: 'matchesPattern',
        pattern: '^test'
      });
      
      expect(pred).toBeInstanceOf(MatchesPatternPredicate);
      expect(pred.check('testing')).toBe(true);
    });

    it('should create composite predicates', () => {
      const andPred = registry.createFromSpec({
        type: 'and',
        predicates: [
          { type: 'inRange', min: 10, max: 20 },
          { type: 'inRange', min: 15, max: 25 }
        ]
      });
      
      expect(andPred).toBeInstanceOf(AndPredicate);
      expect(andPred.check(17)).toBe(true);
    });

    it('should create nested composite predicates', () => {
      const pred = registry.createFromSpec({
        type: 'not',
        predicate: {
          type: 'or',
          predicates: [
            { type: 'inRange', min: 0, max: 10 },
            { type: 'inRange', min: 20, max: 30 }
          ]
        }
      });
      
      expect(pred).toBeInstanceOf(NotPredicate);
      expect(pred.check(15)).toBe(true);  // Not in either range
      expect(pred.check(5)).toBe(false);  // In first range
    });

    it('should use registered predicates', () => {
      const customPred = new InRangePredicate(10, 20);
      registry.register('customRange', customPred);
      
      const pred = registry.createFromSpec({
        name: 'customRange'
      });
      
      expect(pred).toBe(customPred);
    });

    it('should validate spec', () => {
      expect(() => registry.createFromSpec()).toThrow('Predicate specification is required');
      expect(() => registry.createFromSpec('not-object')).toThrow('Predicate specification is required');
      expect(() => registry.createFromSpec({ type: 'unknown' }))
        .toThrow('Unknown predicate type: unknown');
    });
  });

  describe('clear', () => {
    it('should clear all predicates', () => {
      registry.register('pred1', new InRangePredicate(10, 20));
      registry.getTypePredicate('Person');
      registry.getTagPredicate('active');
      
      registry.clear();
      
      expect(registry.has('pred1')).toBe(false);
      expect(registry.has('IsType:Person')).toBe(false);
      expect(registry.has('HasTag:active')).toBe(false);
    });
  });
});