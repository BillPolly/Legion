/**
 * Unit tests for Agent Tools
 * Tests query_kg, list_entities, and calculate tools
 */

import { QueryKGTool, ListEntitiesTool, CalculateTool } from '../../src/agent/tools/index.js';

// Mock KG store for testing
class MockKGStore {
  constructor(triples = []) {
    this.triples = triples;
  }

  async query(s, p, o) {
    return this.triples.filter(([ts, tp, to]) => {
      if (s !== null && ts !== s) return false;
      if (p !== null && tp !== p) return false;
      if (o !== null && to !== o) return false;
      return true;
    });
  }

  async addTriple(s, p, o) {
    this.triples.push([s, p, o]);
  }
}

describe('Agent Tools', () => {
  describe('QueryKGTool', () => {
    let kgStore;
    let context;

    beforeEach(() => {
      kgStore = new MockKGStore([
        ['kg:StockOption_2006', 'rdf:type', 'kg:StockOption'],
        ['kg:StockOption_2006', 'kg:exercisePrice', 25.14],
        ['kg:StockOption_2006', 'kg:expectedDividends', 0],
        ['kg:StockOption_2007', 'rdf:type', 'kg:StockOption'],
        ['kg:StockOption_2007', 'kg:exercisePrice', 60.94],
        ['kg:StockOption_2007', 'kg:expectedDividends', 0]
      ]);

      context = {
        kgStore,
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          error: jest.fn()
        }
      };
    });

    test('should query property value with filters', async () => {
      const result = await QueryKGTool.execute({
        entityType: 'StockOption',
        filters: { year: '2007' },
        property: 'exercisePrice'
      }, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(60.94);
      expect(result.instance).toBe('kg:StockOption_2007');
    });

    test('should query without filters (first instance)', async () => {
      const result = await QueryKGTool.execute({
        entityType: 'StockOption',
        property: 'exercisePrice'
      }, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(25.14);
      expect(result.instance).toBe('kg:StockOption_2006');
    });

    test('should return error if entity type not found', async () => {
      const result = await QueryKGTool.execute({
        entityType: 'NonExistent',
        property: 'someProperty'
      }, context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('No instances of type');
    });

    test('should return error if property not found', async () => {
      const result = await QueryKGTool.execute({
        entityType: 'StockOption',
        filters: { year: '2007' },
        property: 'nonExistentProperty'
      }, context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Property');
    });

    test('should return error if no instance matches filters', async () => {
      const result = await QueryKGTool.execute({
        entityType: 'StockOption',
        filters: { year: '2099' },
        property: 'exercisePrice'
      }, context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('No instance found matching filters');
      expect(result.availableInstances).toBeDefined();
    });

    test('should handle string values', async () => {
      await kgStore.addTriple('kg:Test_1', 'rdf:type', 'kg:Test');
      await kgStore.addTriple('kg:Test_1', 'kg:name', '"Test Name"');

      const result = await QueryKGTool.execute({
        entityType: 'Test',
        property: 'name'
      }, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Test Name');
    });
  });

  describe('ListEntitiesTool', () => {
    let kgStore;
    let context;

    beforeEach(() => {
      kgStore = new MockKGStore([
        ['kg:StockOption_2006', 'rdf:type', 'kg:StockOption'],
        ['kg:StockOption_2007', 'rdf:type', 'kg:StockOption'],
        ['kg:StockOption_2008', 'rdf:type', 'kg:StockOption'],
        ['kg:PensionPlan_2006', 'rdf:type', 'kg:PensionPlan']
      ]);

      context = {
        kgStore,
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          error: jest.fn()
        }
      };
    });

    test('should list all instances of entity type', async () => {
      const result = await ListEntitiesTool.execute({
        entityType: 'StockOption'
      }, context);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.instances).toEqual([
        'kg:StockOption_2006',
        'kg:StockOption_2007',
        'kg:StockOption_2008'
      ]);
    });

    test('should return empty list for non-existent type', async () => {
      const result = await ListEntitiesTool.execute({
        entityType: 'NonExistent'
      }, context);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.instances).toEqual([]);
    });
  });

  describe('CalculateTool', () => {
    let context;

    beforeEach(() => {
      context = {
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          error: jest.fn()
        }
      };
    });

    test('should add numbers', async () => {
      const result = await CalculateTool.execute({
        operation: 'add',
        values: [10, 20, 30]
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe(60);
    });

    test('should subtract numbers', async () => {
      const result = await CalculateTool.execute({
        operation: 'subtract',
        values: [60.94, 25.14]
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(35.8, 2);
    });

    test('should multiply numbers', async () => {
      const result = await CalculateTool.execute({
        operation: 'multiply',
        values: [5, 10, 2]
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe(100);
    });

    test('should divide numbers', async () => {
      const result = await CalculateTool.execute({
        operation: 'divide',
        values: [100, 5]
      }, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe(20);
    });

    test('should return error for division by zero', async () => {
      const result = await CalculateTool.execute({
        operation: 'divide',
        values: [100, 0]
      }, context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Division by zero');
    });

    test('should return error for subtract with wrong number of values', async () => {
      const result = await CalculateTool.execute({
        operation: 'subtract',
        values: [1, 2, 3]
      }, context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('exactly 2 values');
    });

    test('should return error for unknown operation', async () => {
      const result = await CalculateTool.execute({
        operation: 'modulo',
        values: [10, 3]
      }, context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown operation');
    });
  });
});
