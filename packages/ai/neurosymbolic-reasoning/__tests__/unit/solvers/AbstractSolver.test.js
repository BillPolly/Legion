import { AbstractSolver } from '../../../src/solvers/AbstractSolver.js';

describe('AbstractSolver', () => {
  class TestSolver extends AbstractSolver {
    async initialize() {
      this.initialized = true;
    }

    async solve(program) {
      if (!this.initialized) {
        throw new Error('Solver not initialized');
      }
      return {
        result: 'sat',
        model: {},
        proof: []
      };
    }

    async checkSat(constraints) {
      return 'sat';
    }

    async getModel() {
      return {};
    }

    async getProof() {
      return [];
    }
  }

  describe('Constructor', () => {
    test('should create instance', () => {
      const solver = new TestSolver();
      expect(solver).toBeInstanceOf(AbstractSolver);
    });

    test('should initialize as not initialized', () => {
      const solver = new TestSolver();
      expect(solver.isInitialized()).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should call initialize method', async () => {
      const solver = new TestSolver();
      await solver.initialize();
      expect(solver.isInitialized()).toBe(true);
    });
  });

  describe('Abstract Methods', () => {
    test('AbstractSolver.solve should throw', async () => {
      const solver = new AbstractSolver();
      await expect(solver.solve({})).rejects.toThrow('must be implemented');
    });

    test('AbstractSolver.checkSat should throw', async () => {
      const solver = new AbstractSolver();
      await expect(solver.checkSat([])).rejects.toThrow('must be implemented');
    });

    test('AbstractSolver.getModel should throw', async () => {
      const solver = new AbstractSolver();
      await expect(solver.getModel()).rejects.toThrow('must be implemented');
    });

    test('AbstractSolver.getProof should throw', async () => {
      const solver = new AbstractSolver();
      await expect(solver.getProof()).rejects.toThrow('must be implemented');
    });
  });

  describe('Concrete Implementation', () => {
    test('should allow concrete solve implementation', async () => {
      const solver = new TestSolver();
      await solver.initialize();

      const result = await solver.solve({ constraints: [] });

      expect(result).toEqual({
        result: 'sat',
        model: {},
        proof: []
      });
    });

    test('should allow concrete checkSat implementation', async () => {
      const solver = new TestSolver();
      const result = await solver.checkSat([]);
      expect(result).toBe('sat');
    });

    test('should allow concrete getModel implementation', async () => {
      const solver = new TestSolver();
      const model = await solver.getModel();
      expect(model).toEqual({});
    });

    test('should allow concrete getProof implementation', async () => {
      const solver = new TestSolver();
      const proof = await solver.getProof();
      expect(proof).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors', async () => {
      class FailingSolver extends AbstractSolver {
        async initialize() {
          throw new Error('Init failed');
        }
      }

      const solver = new FailingSolver();
      await expect(solver.initialize()).rejects.toThrow('Init failed');
    });

    test('should handle solve errors', async () => {
      class FailingSolver extends AbstractSolver {
        async initialize() {
          this.initialized = true;
        }

        async solve() {
          throw new Error('Solve failed');
        }
      }

      const solver = new FailingSolver();
      await solver.initialize();
      await expect(solver.solve({})).rejects.toThrow('Solve failed');
    });
  });
});
