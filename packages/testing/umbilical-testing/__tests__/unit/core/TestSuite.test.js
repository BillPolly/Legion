/**
 * Unit tests for TestSuite
 */
import { describe, test, expect } from '@jest/globals';
import { TestSuite } from '../../../src/core/TestSuite.js';

describe('TestSuite', () => {
  let testSuite;

  beforeEach(() => {
    testSuite = new TestSuite('Test Component');
  });

  describe('constructor', () => {
    test('should create test suite with name', () => {
      expect(testSuite.name).toBe('Test Component');
      expect(testSuite.categories.size).toBe(0);
      expect(testSuite.tests).toHaveLength(0);
    });
  });

  describe('category management', () => {
    test('should add category with tests', () => {
      testSuite.addCategory('Dependencies', () => {
        testSuite.addTest('should require dom parameter', () => {
          return { type: 'dependency-test' };
        });
        testSuite.addTest('should validate parameter types', () => {
          return { type: 'validation-test' };
        });
      });

      expect(testSuite.categories.has('Dependencies')).toBe(true);
      expect(testSuite.getTestsByCategory('Dependencies')).toHaveLength(2);
      
      const tests = testSuite.getTestsByCategory('Dependencies');
      expect(tests[0].name).toBe('should require dom parameter');
      expect(tests[0].category).toBe('Dependencies');
      expect(tests[1].name).toBe('should validate parameter types');
    });

    test('should handle multiple categories', () => {
      testSuite.addCategory('Dependencies', () => {
        testSuite.addTest('dependency test', () => {});
      });

      testSuite.addCategory('DOM Structure', () => {
        testSuite.addTest('dom test 1', () => {});
        testSuite.addTest('dom test 2', () => {});
      });

      expect(testSuite.getCategoryNames()).toEqual(['Dependencies', 'DOM Structure']);
      expect(testSuite.getTestsByCategory('Dependencies')).toHaveLength(1);
      expect(testSuite.getTestsByCategory('DOM Structure')).toHaveLength(2);
    });

    test('should return empty array for non-existent category', () => {
      expect(testSuite.getTestsByCategory('Non-existent')).toEqual([]);
    });
  });

  describe('test management', () => {
    test('should add uncategorized tests', () => {
      testSuite.addTest('global test', () => {
        return { type: 'global' };
      });

      expect(testSuite.tests).toHaveLength(1);
      expect(testSuite.tests[0].name).toBe('global test');
      expect(testSuite.tests[0].category).toBeNull();
    });

    test('should generate unique test IDs', () => {
      testSuite.addTest('test 1', () => {});
      testSuite.addTest('test 2', () => {});

      const allTests = testSuite.getAllTests();
      expect(allTests[0].id).toBeDefined();
      expect(allTests[1].id).toBeDefined();
      expect(allTests[0].id).not.toBe(allTests[1].id);
    });

    test('should get all tests from all categories', () => {
      testSuite.addTest('global test', () => {});

      testSuite.addCategory('Category 1', () => {
        testSuite.addTest('cat1 test1', () => {});
        testSuite.addTest('cat1 test2', () => {});
      });

      testSuite.addCategory('Category 2', () => {
        testSuite.addTest('cat2 test1', () => {});
      });

      const allTests = testSuite.getAllTests();
      expect(allTests).toHaveLength(4);
      
      const testNames = allTests.map(t => t.name);
      expect(testNames).toContain('global test');
      expect(testNames).toContain('cat1 test1');
      expect(testNames).toContain('cat1 test2');
      expect(testNames).toContain('cat2 test1');
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      testSuite.addTest('global test', () => {});

      testSuite.addCategory('Dependencies', () => {
        testSuite.addTest('dep test 1', () => {});
        testSuite.addTest('dep test 2', () => {});
      });

      testSuite.addCategory('DOM', () => {
        testSuite.addTest('dom test', () => {});
      });
    });

    test('should generate correct statistics', () => {
      const stats = testSuite.getStatistics();

      expect(stats.name).toBe('Test Component');
      expect(stats.totalTests).toBe(4);
      expect(stats.totalCategories).toBe(2);
      expect(stats.categorizedTests).toBe(3);
      expect(stats.uncategorizedTests).toBe(1);
      
      expect(stats.categories).toHaveLength(2);
      expect(stats.categories[0].name).toBe('Dependencies');
      expect(stats.categories[0].testCount).toBe(2);
      expect(stats.categories[1].name).toBe('DOM');
      expect(stats.categories[1].testCount).toBe(1);
    });
  });

  describe('test execution', () => {
    beforeEach(() => {
      testSuite.addCategory('Test Category', () => {
        testSuite.addTest('passing test', async () => {
          return { type: 'success', result: 'passed' };
        });

        testSuite.addTest('failing test', async () => {
          throw new Error('Test failed intentionally');
        });
      });

      testSuite.addTest('global test', async () => {
        return { type: 'global', result: 'passed' };
      });
    });

    test('should execute all tests and return results', async () => {
      const results = await testSuite.execute();

      expect(results.suiteName).toBe('Test Component');
      expect(results.totalTests).toBe(3);
      expect(results.passed).toBe(2);
      expect(results.failed).toBe(1);
      expect(results.skipped).toBe(0);
      expect(results.startTime).toBeDefined();
      expect(results.endTime).toBeDefined();
      expect(results.duration).toBeGreaterThanOrEqual(0);
    });

    test('should execute category tests', async () => {
      const results = await testSuite.execute();

      expect(results.categories['Test Category']).toBeDefined();
      expect(results.categories['Test Category'].totalTests).toBe(2);
      expect(results.categories['Test Category'].passed).toBe(1);
      expect(results.categories['Test Category'].failed).toBe(1);
    });

    test('should execute uncategorized tests', async () => {
      const results = await testSuite.execute();

      expect(results.categories['Uncategorized']).toBeDefined();
      expect(results.categories['Uncategorized'].totalTests).toBe(1);
      expect(results.categories['Uncategorized'].passed).toBe(1);
      expect(results.categories['Uncategorized'].failed).toBe(0);
    });

    test('should capture test results and errors', async () => {
      const results = await testSuite.execute();

      const passingTest = results.tests.find(t => t.name === 'passing test');
      expect(passingTest.status).toBe('passed');
      expect(passingTest.result).toEqual({ type: 'success', result: 'passed' });
      expect(passingTest.error).toBeNull();

      const failingTest = results.tests.find(t => t.name === 'failing test');
      expect(failingTest.status).toBe('failed');
      expect(failingTest.error).toBe('Test failed intentionally');
      expect(failingTest.result).toBeNull();
    });

    test('should measure test execution time', async () => {
      const results = await testSuite.execute();

      expect(results.duration).toBeGreaterThanOrEqual(0);
      
      results.tests.forEach(test => {
        expect(test.startTime).toBeDefined();
        expect(test.endTime).toBeDefined();
        expect(test.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Jest code generation', () => {
    beforeEach(() => {
      testSuite.addCategory('Dependencies', () => {
        testSuite.addTest('should require dom parameter', () => {
          return { type: 'dependency-required', name: 'dom' };
        });
      });

      testSuite.addTest('global integration test', () => {
        return { type: 'integration', scope: 'global' };
      });
    });

    test('should generate Jest test code', async () => {
      const jestCode = await testSuite.generateJestCode();

      expect(jestCode).toContain("describe('Test Component', () => {");
      expect(jestCode).toContain("describe('Dependencies', () => {");
      expect(jestCode).toContain("test('should require dom parameter', async () => {");
      expect(jestCode).toContain("test('global integration test', async () => {");
      expect(jestCode).toContain('expect(testSpec).toBeDefined();');
    });
  });

  describe('JSON serialization', () => {
    beforeEach(() => {
      testSuite.addCategory('Dependencies', () => {
        testSuite.addTest('dep test', () => {});
      });

      testSuite.addTest('global test', () => {});
    });

    test('should serialize to JSON', () => {
      const json = testSuite.toJSON();

      expect(json.name).toBe('Test Component');
      expect(json.categories.Dependencies).toHaveLength(1);
      expect(json.uncategorizedTests).toHaveLength(1);
      expect(json.statistics).toBeDefined();
      expect(json.statistics.totalTests).toBe(2);
    });

    test('should include test metadata in JSON', () => {
      const json = testSuite.toJSON();

      const depTest = json.categories.Dependencies[0];
      expect(depTest.id).toBeDefined();
      expect(depTest.name).toBe('dep test');
      expect(depTest.category).toBe('Dependencies');

      const globalTest = json.uncategorizedTests[0];
      expect(globalTest.id).toBeDefined();
      expect(globalTest.name).toBe('global test');
      expect(globalTest.category).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('should handle empty test suite', async () => {
      const results = await testSuite.execute();

      expect(results.totalTests).toBe(0);
      expect(results.passed).toBe(0);
      expect(results.failed).toBe(0);
      expect(results.categories).toEqual({});
    });

    test('should handle category with no tests', () => {
      testSuite.addCategory('Empty Category', () => {
        // No tests added
      });

      expect(testSuite.getTestsByCategory('Empty Category')).toHaveLength(0);
      expect(testSuite.getCategoryNames()).toContain('Empty Category');
    });

    test('should handle async test functions', async () => {
      testSuite.addTest('async test', async () => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ type: 'async-test' }), 1);
        });
      });

      const results = await testSuite.execute();
      
      expect(results.passed).toBe(1);
      expect(results.tests[0].result).toEqual({ type: 'async-test' });
    });
  });
});