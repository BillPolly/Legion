/**
 * Unit tests for PathStep classes
 * Tests path navigation step functionality per design §3
 */

import { 
  PathStep, 
  ForwardStep, 
  InverseStep, 
  LiteralStep,
  PathStepFactory 
} from '../../../src/query/PathStep.js';

describe('PathStep', () => {
  describe('base class', () => {
    it('should not be instantiable directly', () => {
      expect(() => new PathStep('test')).toThrow('PathStep is an abstract class');
    });

    it('should require step type', () => {
      class TestStep extends PathStep {}
      expect(() => new TestStep()).toThrow('Step type is required');
    });

    it('should require subclasses to implement abstract methods', () => {
      class TestStep extends PathStep {
        constructor() { super('test'); }
      }
      const step = new TestStep();
      
      expect(() => step.toGraphSpec()).toThrow('toGraphSpec must be implemented by subclass');
      expect(() => step.getRelationName()).toThrow('getRelationName must be implemented by subclass');
    });
  });

  describe('ForwardStep', () => {
    it('should create forward step with relation name', () => {
      const step = new ForwardStep('worksAt');
      
      expect(step.type).toBe('forward');
      expect(step.relationName).toBe('worksAt');
      expect(step.isForward()).toBe(true);
      expect(step.isInverse()).toBe(false);
      expect(step.isLiteral()).toBe(false);
    });

    it('should validate relation name', () => {
      expect(() => new ForwardStep()).toThrow('Relation name is required');
      expect(() => new ForwardStep(null)).toThrow('Relation name is required');
      expect(() => new ForwardStep(123)).toThrow('Relation name must be a string');
    });

    it('should convert to GraphSpec', () => {
      const step = new ForwardStep('worksAt');
      const variableMap = { current: '?x', next: '?y' };
      
      const spec = step.toGraphSpec(variableMap);
      
      expect(spec).toEqual({
        type: 'edge',
        relation: 'worksAt',
        direction: 'forward',
        source: '?x',
        target: '?y'
      });
    });

    it('should require variable map for GraphSpec conversion', () => {
      const step = new ForwardStep('worksAt');
      expect(() => step.toGraphSpec()).toThrow('Variable map is required');
    });

    it('should provide string representation', () => {
      const step = new ForwardStep('worksAt');
      expect(step.toString()).toBe('ForwardStep(worksAt)');
    });

    it('should support equality comparison', () => {
      const step1 = new ForwardStep('worksAt');
      const step2 = new ForwardStep('worksAt');
      const step3 = new ForwardStep('livesIn');
      
      expect(step1.equals(step2)).toBe(true);
      expect(step1.equals(step3)).toBe(false);
    });

    it('should return relation name', () => {
      const step = new ForwardStep('worksAt');
      expect(step.getRelationName()).toBe('worksAt');
    });
  });

  describe('InverseStep', () => {
    it('should create inverse step with relation name', () => {
      const step = new InverseStep('worksAt');
      
      expect(step.type).toBe('inverse');
      expect(step.relationName).toBe('worksAt');
      expect(step.isForward()).toBe(false);
      expect(step.isInverse()).toBe(true);
      expect(step.isLiteral()).toBe(false);
    });

    it('should validate relation name', () => {
      expect(() => new InverseStep()).toThrow('Relation name is required');
      expect(() => new InverseStep(null)).toThrow('Relation name is required');
      expect(() => new InverseStep(123)).toThrow('Relation name must be a string');
    });

    it('should convert to GraphSpec', () => {
      const step = new InverseStep('worksAt');
      const variableMap = { current: '?x', next: '?y' };
      
      const spec = step.toGraphSpec(variableMap);
      
      expect(spec).toEqual({
        type: 'edge',
        relation: 'worksAt',
        direction: 'backward',
        source: '?x',
        target: '?y'
      });
    });

    it('should require variable map for GraphSpec conversion', () => {
      const step = new InverseStep('worksAt');
      expect(() => step.toGraphSpec()).toThrow('Variable map is required');
    });

    it('should provide string representation', () => {
      const step = new InverseStep('worksAt');
      expect(step.toString()).toBe('InverseStep(^worksAt)');
    });

    it('should support equality comparison', () => {
      const step1 = new InverseStep('worksAt');
      const step2 = new InverseStep('worksAt');
      const step3 = new InverseStep('livesIn');
      
      expect(step1.equals(step2)).toBe(true);
      expect(step1.equals(step3)).toBe(false);
    });

    it('should return relation name', () => {
      const step = new InverseStep('worksAt');
      expect(step.getRelationName()).toBe('worksAt');
    });
  });

  describe('LiteralStep', () => {
    it('should create literal step with value', () => {
      const step = new LiteralStep('alice');
      
      expect(step.type).toBe('literal');
      expect(step.value).toBe('alice');
      expect(step.isForward()).toBe(false);
      expect(step.isInverse()).toBe(false);
      expect(step.isLiteral()).toBe(true);
    });

    it('should accept various value types', () => {
      expect(new LiteralStep('string').value).toBe('string');
      expect(new LiteralStep(123).value).toBe(123);
      expect(new LiteralStep(true).value).toBe(true);
      expect(new LiteralStep(null).value).toBe(null);
      expect(new LiteralStep(0).value).toBe(0);
      expect(new LiteralStep('').value).toBe('');
    });

    it('should require value', () => {
      expect(() => new LiteralStep()).toThrow('Value is required');
      expect(() => new LiteralStep(undefined)).toThrow('Value is required');
    });

    it('should convert to GraphSpec constraint', () => {
      const step = new LiteralStep('alice');
      const variableMap = { current: '?x', next: '?y' };
      
      const spec = step.toGraphSpec(variableMap);
      
      expect(spec).toEqual({
        type: 'constraint',
        operator: 'equals',
        variable: '?x',
        value: 'alice'
      });
    });

    it('should require variable map for GraphSpec conversion', () => {
      const step = new LiteralStep('alice');
      expect(() => step.toGraphSpec()).toThrow('Variable map is required');
    });

    it('should provide string representation', () => {
      expect(new LiteralStep('alice').toString()).toBe('LiteralStep(="alice")');
      expect(new LiteralStep(123).toString()).toBe('LiteralStep(=123)');
      expect(new LiteralStep(null).toString()).toBe('LiteralStep(=null)');
    });

    it('should support equality comparison', () => {
      const step1 = new LiteralStep('alice');
      const step2 = new LiteralStep('alice');
      const step3 = new LiteralStep('bob');
      
      expect(step1.equals(step2)).toBe(true);
      expect(step1.equals(step3)).toBe(false);
    });

    it('should return null for relation name', () => {
      const step = new LiteralStep('alice');
      expect(step.getRelationName()).toBe(null);
    });
  });

  describe('PathStepFactory', () => {
    describe('fromString', () => {
      it('should create forward step from plain string', () => {
        const step = PathStepFactory.fromString('worksAt');
        
        expect(step).toBeInstanceOf(ForwardStep);
        expect(step.relationName).toBe('worksAt');
      });

      it('should create inverse step from ^-prefixed string', () => {
        const step = PathStepFactory.fromString('^worksAt');
        
        expect(step).toBeInstanceOf(InverseStep);
        expect(step.relationName).toBe('worksAt');
      });

      it('should create literal step from =-prefixed string', () => {
        const step = PathStepFactory.fromString('=alice');
        
        expect(step).toBeInstanceOf(LiteralStep);
        expect(step.value).toBe('alice');
      });

      it('should parse JSON literals when possible', () => {
        expect(PathStepFactory.fromString('=123').value).toBe(123);
        expect(PathStepFactory.fromString('=true').value).toBe(true);
        expect(PathStepFactory.fromString('=null').value).toBe(null);
        expect(PathStepFactory.fromString('=["array"]').value).toEqual(['array']);
        expect(PathStepFactory.fromString('={"key":"value"}').value).toEqual({key: 'value'});
      });

      it('should fallback to string for non-JSON literals', () => {
        expect(PathStepFactory.fromString('=alice').value).toBe('alice');
        expect(PathStepFactory.fromString('=not-json{').value).toBe('not-json{');
      });

      it('should validate input', () => {
        expect(() => PathStepFactory.fromString()).toThrow('Step string is required');
        expect(() => PathStepFactory.fromString(null)).toThrow('Step string is required');
        expect(() => PathStepFactory.fromString(123)).toThrow('Step string is required');
        expect(() => PathStepFactory.fromString('^')).toThrow('Relation name required after ^');
      });
    });

    describe('fromArray', () => {
      it('should create multiple steps from string array', () => {
        const steps = PathStepFactory.fromArray([
          'worksAt',
          '^livesIn',
          '=alice',
          'manages'
        ]);
        
        expect(steps).toHaveLength(4);
        expect(steps[0]).toBeInstanceOf(ForwardStep);
        expect(steps[0].relationName).toBe('worksAt');
        expect(steps[1]).toBeInstanceOf(InverseStep);
        expect(steps[1].relationName).toBe('livesIn');
        expect(steps[2]).toBeInstanceOf(LiteralStep);
        expect(steps[2].value).toBe('alice');
        expect(steps[3]).toBeInstanceOf(ForwardStep);
        expect(steps[3].relationName).toBe('manages');
      });

      it('should handle empty array', () => {
        const steps = PathStepFactory.fromArray([]);
        expect(steps).toEqual([]);
      });

      it('should validate input', () => {
        expect(() => PathStepFactory.fromArray()).toThrow('Step strings must be an array');
        expect(() => PathStepFactory.fromArray('not-array')).toThrow('Step strings must be an array');
      });
    });

    describe('fromObject', () => {
      it('should create forward step from object', () => {
        const step = PathStepFactory.fromObject({
          type: 'forward',
          relation: 'worksAt'
        });
        
        expect(step).toBeInstanceOf(ForwardStep);
        expect(step.relationName).toBe('worksAt');
      });

      it('should create inverse step from object', () => {
        const step = PathStepFactory.fromObject({
          type: 'inverse',
          relation: 'worksAt'
        });
        
        expect(step).toBeInstanceOf(InverseStep);
        expect(step.relationName).toBe('worksAt');
      });

      it('should create literal step from object', () => {
        const step = PathStepFactory.fromObject({
          type: 'literal',
          value: 'alice'
        });
        
        expect(step).toBeInstanceOf(LiteralStep);
        expect(step.value).toBe('alice');
      });

      it('should validate input', () => {
        expect(() => PathStepFactory.fromObject()).toThrow('Step object is required');
        expect(() => PathStepFactory.fromObject(null)).toThrow('Step object is required');
        expect(() => PathStepFactory.fromObject('not-object')).toThrow('Step object is required');
        expect(() => PathStepFactory.fromObject({ type: 'unknown' }))
          .toThrow('Unknown step type: unknown');
      });
    });
  });
});