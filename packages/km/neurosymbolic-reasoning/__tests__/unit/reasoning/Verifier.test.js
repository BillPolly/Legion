import { Verifier } from '../../../src/reasoning/Verifier.js';

describe('Verifier', () => {
  describe('Constructor', () => {
    test('should create instance with solver', () => {
      const mockSolver = {};
      const verifier = new Verifier(mockSolver);
      expect(verifier).toBeInstanceOf(Verifier);
    });

    test('should throw without solver', () => {
      expect(() => new Verifier(null)).toThrow('Solver is required');
    });
  });

  describe('verify()', () => {
    test('should verify valid solution against constraints', async () => {
      const mockSolver = {
        solve: async () => ({
          result: 'sat',
          model: { x: '7' },
          proof: []
        })
      };

      const verifier = new Verifier(mockSolver);

      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const solution = { x: 7 };

      const result = await verifier.verify(solution, program);

      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    test('should detect constraint violations', async () => {
      const mockSolver = {
        solve: async () => ({
          result: 'unsat',
          model: {},
          proof: []
        })
      };

      const verifier = new Verifier(mockSolver);

      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const solution = { x: 15 };  // Violates x < 10

      const result = await verifier.verify(solution, program);

      expect(result.valid).toBe(false);
      expect(result.violations).toBeDefined();
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should include proof when solution is valid', async () => {
      const mockProof = [
        { step: 1, description: 'x > 5' },
        { step: 2, description: 'x < 10' }
      ];

      const mockSolver = {
        solve: async () => ({
          result: 'sat',
          model: { x: '7' },
          proof: mockProof
        })
      };

      const verifier = new Verifier(mockSolver);

      const program = {
        variables: [{ name: 'x', sort: 'Int' }],
        constraints: [
          { type: 'gt', args: ['x', 5] },
          { type: 'lt', args: ['x', 10] }
        ],
        query: { type: 'check-sat' }
      };

      const solution = { x: 7 };

      const result = await verifier.verify(solution, program);

      expect(result.proof).toEqual(mockProof);
    });

    test('should handle empty constraints', async () => {
      const mockSolver = {
        solve: async () => ({
          result: 'sat',
          model: {},
          proof: []
        })
      };

      const verifier = new Verifier(mockSolver);

      const program = {
        variables: [],
        constraints: [],
        query: { type: 'check-sat' }
      };

      const solution = {};

      const result = await verifier.verify(solution, program);

      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  describe('extractProof()', () => {
    test('should extract proof from solver result', async () => {
      const mockProof = [
        { step: 1, type: 'constraint', description: 'x > 5' },
        { step: 2, type: 'constraint', description: 'x < 10' },
        { step: 3, type: 'conclusion', description: 'Result: sat' }
      ];

      const mockSolver = {
        getProof: async () => mockProof
      };

      const verifier = new Verifier(mockSolver);

      const proof = await verifier.extractProof();

      expect(proof).toEqual(mockProof);
    });

    test('should throw if solver has no proof', async () => {
      const mockSolver = {
        getProof: async () => {
          throw new Error('No proof available');
        }
      };

      const verifier = new Verifier(mockSolver);

      await expect(verifier.extractProof()).rejects.toThrow('No proof available');
    });
  });

  describe('explainProof()', () => {
    test('should convert proof to natural language', () => {
      const verifier = new Verifier({});

      const proof = [
        { step: 1, type: 'constraint', description: 'x > 5', satisfied: true },
        { step: 2, type: 'constraint', description: 'x < 10', satisfied: true },
        { step: 3, type: 'conclusion', description: 'Result: sat', result: 'sat', model: { x: '7' } }
      ];

      const explanation = verifier.explainProof(proof);

      expect(explanation).toContain('Step 1');
      expect(explanation).toContain('x > 5');
      expect(explanation).toContain('Step 2');
      expect(explanation).toContain('x < 10');
      expect(explanation).toContain('Step 3');
      expect(explanation).toContain('sat');
    });

    test('should format proof steps with numbers', () => {
      const verifier = new Verifier({});

      const proof = [
        { step: 1, type: 'constraint', description: 'p OR q' },
        { step: 2, type: 'conclusion', description: 'Result: sat' }
      ];

      const explanation = verifier.explainProof(proof);

      const lines = explanation.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toMatch(/^Step 1:/);
      expect(lines[1]).toMatch(/^Step 2:/);
    });

    test('should handle proof with model', () => {
      const verifier = new Verifier({});

      const proof = [
        { step: 1, type: 'constraint', description: 'x > 5' },
        { step: 2, type: 'conclusion', description: 'Result: sat', result: 'sat', model: { x: '7', y: '3' } }
      ];

      const explanation = verifier.explainProof(proof);

      expect(explanation).toContain('x = 7');
      expect(explanation).toContain('y = 3');
    });

    test('should handle unsat result', () => {
      const verifier = new Verifier({});

      const proof = [
        { step: 1, type: 'constraint', description: 'x > 10' },
        { step: 2, type: 'constraint', description: 'x < 5' },
        { step: 3, type: 'conclusion', description: 'Result: unsat', result: 'unsat' }
      ];

      const explanation = verifier.explainProof(proof);

      expect(explanation).toContain('unsat');
      expect(explanation).toContain('unsatisfiable');
    });

    test('should handle empty proof', () => {
      const verifier = new Verifier({});

      const explanation = verifier.explainProof([]);

      expect(explanation).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('should handle solver errors in verify', async () => {
      const mockSolver = {
        solve: async () => {
          throw new Error('Solver error');
        }
      };

      const verifier = new Verifier(mockSolver);

      const program = {
        variables: [],
        constraints: [],
        query: { type: 'check-sat' }
      };

      await expect(verifier.verify({}, program)).rejects.toThrow('Solver error');
    });
  });
});
