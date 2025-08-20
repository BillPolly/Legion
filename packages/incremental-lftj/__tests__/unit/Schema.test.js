import { Schema, TypePredicate } from '../../src/Schema.js';

describe('Schema', () => {
  describe('Creation', () => {
    it('should create schema with variable names and types', () => {
      const schema = new Schema([
        { name: 'x', type: 'any' },
        { name: 'y', type: 'Integer' },
        { name: 'z', type: 'String' }
      ]);
      
      expect(schema.arity).toBe(3);
      expect(schema.variables).toEqual(['x', 'y', 'z']);
    });

    it('should validate unique variable names', () => {
      expect(() => new Schema([
        { name: 'x', type: 'any' },
        { name: 'x', type: 'Integer' }
      ])).toThrow('Variable names must be unique');
    });

    it('should handle empty schema', () => {
      const schema = new Schema([]);
      expect(schema.arity).toBe(0);
      expect(schema.variables).toEqual([]);
    });
  });

  describe('Type Validation', () => {
    it('should validate tuple arity', () => {
      const schema = new Schema([
        { name: 'x', type: 'Integer' },
        { name: 'y', type: 'String' }
      ]);

      expect(() => schema.validateTuple([])).toThrow('Tuple arity 0 does not match schema arity 2');
      expect(() => schema.validateTuple([1, 2, 3])).toThrow('Tuple arity 3 does not match schema arity 2');
    });

    it('should validate with any type', () => {
      const schema = new Schema([
        { name: 'x', type: 'any' },
        { name: 'y', type: 'any' }
      ]);

      // Should accept any atoms
      expect(() => schema.validateTuple(['Integer(1)', 'String(hello)'])).not.toThrow();
      expect(() => schema.validateTuple(['Boolean(true)', 'Float(3.14)'])).not.toThrow();
    });

    it('should validate specific types when enabled', () => {
      const schema = new Schema([
        { name: 'x', type: 'Integer' },
        { name: 'y', type: 'String' }
      ], true); // Enable type checking

      expect(() => schema.validateTuple(['Integer(1)', 'String(hello)'])).not.toThrow();
      expect(() => schema.validateTuple(['String(hello)', 'Integer(1)'])).toThrow('Position 0: expected Integer, got String');
      expect(() => schema.validateTuple(['Integer(1)', 'Boolean(true)'])).toThrow('Position 1: expected String, got Boolean');
    });
  });

  describe('Schema Operations', () => {
    it('should get variable position', () => {
      const schema = new Schema([
        { name: 'user', type: 'ID' },
        { name: 'age', type: 'Integer' },
        { name: 'name', type: 'String' }
      ]);

      expect(schema.getVariablePosition('user')).toBe(0);
      expect(schema.getVariablePosition('age')).toBe(1);
      expect(schema.getVariablePosition('name')).toBe(2);
      expect(() => schema.getVariablePosition('missing')).toThrow('Variable missing not found in schema');
    });

    it('should project schema to subset', () => {
      const schema = new Schema([
        { name: 'a', type: 'Integer' },
        { name: 'b', type: 'String' },
        { name: 'c', type: 'Boolean' }
      ]);

      const projected = schema.project(['a', 'c']);
      expect(projected.arity).toBe(2);
      expect(projected.variables).toEqual(['a', 'c']);
    });

    it('should validate projection variables exist', () => {
      const schema = new Schema([
        { name: 'a', type: 'Integer' },
        { name: 'b', type: 'String' }
      ]);

      expect(() => schema.project(['a', 'missing'])).toThrow('Variable missing not found in schema');
    });
  });
});

describe('TypePredicate', () => {
  describe('Basic Types', () => {
    it('should validate Boolean type', () => {
      const predicate = TypePredicate.Boolean;
      expect(predicate('Boolean(true)')).toBe(true);
      expect(predicate('Boolean(false)')).toBe(true);
      expect(predicate('Integer(1)')).toBe(false);
      expect(predicate('String(hello)')).toBe(false);
    });

    it('should validate Integer type', () => {
      const predicate = TypePredicate.Integer;
      expect(predicate('Integer(42)')).toBe(true);
      expect(predicate('Integer(-100)')).toBe(true);
      expect(predicate('Float(3.14)')).toBe(false);
      expect(predicate('String(123)')).toBe(false);
    });

    it('should validate Float type', () => {
      const predicate = TypePredicate.Float;
      expect(predicate('Float(3.14)')).toBe(true);
      expect(predicate('Float(-2.71)')).toBe(true);
      expect(predicate('Integer(42)')).toBe(false);
      expect(predicate('String(3.14)')).toBe(false);
    });

    it('should validate String type', () => {
      const predicate = TypePredicate.String;
      expect(predicate('String(hello)')).toBe(true);
      expect(predicate('String()')).toBe(true);
      expect(predicate('Integer(123)')).toBe(false);
      expect(predicate('Symbol(:test)')).toBe(false);
    });

    it('should validate Symbol type', () => {
      const predicate = TypePredicate.Symbol;
      expect(predicate('Symbol(:keyword)')).toBe(true);
      expect(predicate('Symbol(:test)')).toBe(true);
      expect(predicate('String(:keyword)')).toBe(false);
      expect(predicate('Integer(1)')).toBe(false);
    });

    it('should validate ID type', () => {
      const predicate = TypePredicate.ID;
      expect(predicate('ID(user123)')).toBe(true);
      expect(predicate('ID(abc-def)')).toBe(true);
      expect(predicate('String(user123)')).toBe(false);
      expect(predicate('Integer(123)')).toBe(false);
    });

    it('should validate any type', () => {
      const predicate = TypePredicate.any;
      expect(predicate('Boolean(true)')).toBe(true);
      expect(predicate('Integer(42)')).toBe(true);
      expect(predicate('Float(3.14)')).toBe(true);
      expect(predicate('String(hello)')).toBe(true);
      expect(predicate('Symbol(:test)')).toBe(true);
      expect(predicate('ID(user123)')).toBe(true);
    });
  });
});