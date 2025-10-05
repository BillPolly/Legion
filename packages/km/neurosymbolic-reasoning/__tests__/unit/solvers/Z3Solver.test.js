import { Z3Solver } from '../../../src/solvers/Z3Solver.js';
import { AbstractSolver } from '../../../src/solvers/AbstractSolver.js';

describe('Z3Solver', () => {
  describe('Constructor', () => {
    test('should create instance', () => {
      const solver = new Z3Solver();
      expect(solver).toBeInstanceOf(Z3Solver);
      expect(solver).toBeInstanceOf(AbstractSolver);
    });

    test('should not be initialized', () => {
      const solver = new Z3Solver();
      expect(solver.isInitialized()).toBe(false);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      expect(solver.isInitialized()).toBe(true);
    }, 10000);

    test('should have Context after initialization', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      expect(solver.context).toBeDefined();
    }, 10000);

    test('should have Z3 types after initialization', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      expect(solver.Int).toBeDefined();
      expect(solver.Bool).toBeDefined();
      expect(solver.Real).toBeDefined();
    }, 10000);

    test('should have Z3 operators after initialization', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      expect(solver.And).toBeDefined();
      expect(solver.Or).toBeDefined();
      expect(solver.Not).toBeDefined();
    }, 10000);

    test('should only initialize once', async () => {
      const solver = new Z3Solver();

      await solver.initialize();
      const context1 = solver.context;

      await solver.initialize();
      const context2 = solver.context;

      expect(context1).toBe(context2);
    }, 10000);

    test('should throw error if initialization fails', async () => {
      // This is a unit test with mocked init that fails
      const FailingZ3Solver = class extends Z3Solver {
        async _initZ3() {
          throw new Error('Init failed');
        }
      };

      const solver = new FailingZ3Solver();
      await expect(solver.initialize()).rejects.toThrow();
    });
  });

  describe('Context Methods', () => {
    test('should create fresh solver instance', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      const solverInstance1 = solver.createSolver();
      const solverInstance2 = solver.createSolver();

      expect(solverInstance1).toBeDefined();
      expect(solverInstance2).toBeDefined();
      expect(solverInstance1).not.toBe(solverInstance2);
    }, 10000);

    test('should create Int constant', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      const x = solver.Int.const('x');

      expect(x).toBeDefined();
    }, 10000);

    test('should create Bool constant', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      const p = solver.Bool.const('p');

      expect(p).toBeDefined();
    }, 10000);

    test('should create Real constant', async () => {
      const solver = new Z3Solver();
      await solver.initialize();

      const r = solver.Real.const('r');

      expect(r).toBeDefined();
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should throw if solve called before initialization', async () => {
      const solver = new Z3Solver();

      const program = {
        variables: [],
        constraints: [],
        query: { type: 'check-sat' }
      };

      await expect(solver.solve(program)).rejects.toThrow('not initialized');
    });

    test('should throw if checkSat called before initialization', async () => {
      const solver = new Z3Solver();

      await expect(solver.checkSat([])).rejects.toThrow('not initialized');
    });

    test('should throw if getModel called before initialization', async () => {
      const solver = new Z3Solver();

      await expect(solver.getModel()).rejects.toThrow('not initialized');
    });

    test('should throw if getProof called before initialization', async () => {
      const solver = new Z3Solver();

      await expect(solver.getProof()).rejects.toThrow('not initialized');
    });
  });
});
