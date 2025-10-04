import { ProgramGenerator } from '../../src/reasoning/ProgramGenerator.js';
import { Z3Solver } from '../../src/solvers/Z3Solver.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ProgramGenerator Integration (Real LLM)', () => {
  let resourceManager;
  let llmClient;
  let generator;
  let solver;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    // Initialize solver for testing generated programs
    solver = new Z3Solver();
    await solver.initialize();
  }, 30000);

  beforeEach(() => {
    // Create new generator for each test
    generator = new ProgramGenerator(llmClient);
  });

  test('should generate valid Z3 program from simple question', async () => {
    const question = 'Is there a number greater than 5 and less than 10?';

    const result = await generator.generate(question);

    expect(result.success).toBe(true);
    expect(result.program).toBeDefined();
    expect(result.program.variables).toBeDefined();
    expect(result.program.constraints).toBeDefined();
    expect(result.program.query).toBeDefined();
  }, 30000);

  test('should generate program that executes in Z3Solver', async () => {
    const question = 'Is there a number greater than 5 and less than 10?';

    // Generate program with LLM
    const genResult = await generator.generate(question);
    expect(genResult.success).toBe(true);

    // Execute program in Z3Solver
    const solveResult = await solver.solve(genResult.program);

    expect(solveResult.result).toBe('sat');
    expect(solveResult.model).toBeDefined();
    expect(solveResult.proof).toBeDefined();

    // Verify model contains a variable
    const varNames = Object.keys(solveResult.model);
    expect(varNames.length).toBeGreaterThan(0);

    // Verify the value is between 5 and 10
    const varValue = parseInt(solveResult.model[varNames[0]]);
    expect(varValue).toBeGreaterThan(5);
    expect(varValue).toBeLessThan(10);
  }, 30000);

  test('should generate program for boolean logic question', async () => {
    const question = 'Can both p and q be true if p implies not q?';

    const result = await generator.generate(question);

    expect(result.success).toBe(true);

    // Execute in solver
    const solveResult = await solver.solve(result.program);

    // Should be unsatisfiable
    expect(solveResult.result).toBe('unsat');
  }, 30000);

  test('should generate program for real number constraints', async () => {
    const question = 'Find a real number between 0.5 and 1.5';

    const result = await generator.generate(question);

    expect(result.success).toBe(true);

    // Verify variables include Real type
    const hasRealVar = result.program.variables.some(v => v.sort === 'Real');
    expect(hasRealVar).toBe(true);

    // Execute in solver
    const solveResult = await solver.solve(result.program);

    expect(solveResult.result).toBe('sat');
    expect(solveResult.model).toBeDefined();
  }, 30000);

  test('should retry on failure and eventually succeed', async () => {
    // Use a slightly ambiguous question that might require retry
    const question = 'Is x positive and less than 100?';

    const result = await generator.generateWithRetry(question, {}, 3);

    // Should eventually succeed
    expect(result.success).toBe(true);
    expect(result.attempts).toBeDefined();
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.attempts).toBeLessThanOrEqual(3);

    // Generated program should be valid
    expect(result.program).toBeDefined();
    expect(result.program.variables).toBeDefined();
    expect(result.program.constraints).toBeDefined();
  }, 60000);

  test('should handle complex multi-constraint questions', async () => {
    const question = 'Find an integer x where x is greater than 10 and less than 20';

    const result = await generator.generateWithRetry(question, {}, 3);

    expect(result.success).toBe(true);
    expect(result.program.constraints.length).toBeGreaterThanOrEqual(2);

    // Execute in solver
    const solveResult = await solver.solve(result.program);

    expect(solveResult.result).toBe('sat');
    expect(solveResult.model).toBeDefined();

    // Verify the solution meets the constraints
    const varNames = Object.keys(solveResult.model);
    const varValue = parseInt(solveResult.model[varNames[0]]);

    expect(varValue).toBeGreaterThan(10);
    expect(varValue).toBeLessThan(20);
  }, 60000);
});
