/**
 * TestSuite - Container for organized test categories and individual tests
 * Manages test execution and result reporting
 */
export class TestSuite {
  constructor(name) {
    this.name = name;
    this.categories = new Map();
    this.tests = [];
    this.currentCategory = null;
  }

  /**
   * Add a test category
   * @param {string} categoryName - Category name
   * @param {Function} categoryFn - Function to define tests in category
   */
  addCategory(categoryName, categoryFn) {
    this.currentCategory = categoryName;
    
    if (!this.categories.has(categoryName)) {
      this.categories.set(categoryName, []);
    }
    
    // Execute category function to collect tests
    categoryFn();
    
    this.currentCategory = null;
  }

  /**
   * Add a test to current category or global suite
   * @param {string} testName - Test name
   * @param {Function} testFn - Test function
   */
  addTest(testName, testFn) {
    const test = {
      name: testName,
      category: this.currentCategory,
      fn: testFn,
      id: this.generateTestId()
    };

    if (this.currentCategory) {
      this.categories.get(this.currentCategory).push(test);
    } else {
      this.tests.push(test);
    }
  }

  /**
   * Generate unique test ID
   * @returns {string} Test ID
   */
  generateTestId() {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all tests from all categories
   * @returns {Array} All tests
   */
  getAllTests() {
    const allTests = [...this.tests];
    
    for (const [categoryName, categoryTests] of this.categories) {
      allTests.push(...categoryTests);
    }
    
    return allTests;
  }

  /**
   * Get tests by category
   * @param {string} categoryName - Category name
   * @returns {Array} Tests in category
   */
  getTestsByCategory(categoryName) {
    return this.categories.get(categoryName) || [];
  }

  /**
   * Get category names
   * @returns {Array} Category names
   */
  getCategoryNames() {
    return Array.from(this.categories.keys());
  }

  /**
   * Execute all tests in the suite
   * @returns {Promise<Object>} Test results
   */
  async execute() {
    const results = {
      suiteName: this.name,
      totalTests: this.getAllTests().length,
      passed: 0,
      failed: 0,
      skipped: 0,
      categories: {},
      tests: [],
      startTime: Date.now(),
      endTime: null,
      duration: 0
    };

    try {
      // Execute tests by category
      for (const [categoryName, categoryTests] of this.categories) {
        const categoryResults = await this.executeCategory(categoryName, categoryTests);
        results.categories[categoryName] = categoryResults;
        results.tests.push(...categoryResults.tests);
        results.passed += categoryResults.passed;
        results.failed += categoryResults.failed;
        results.skipped += categoryResults.skipped;
      }

      // Execute uncategorized tests
      if (this.tests.length > 0) {
        const uncategorizedResults = await this.executeCategory('Uncategorized', this.tests);
        results.categories['Uncategorized'] = uncategorizedResults;
        results.tests.push(...uncategorizedResults.tests);
        results.passed += uncategorizedResults.passed;
        results.failed += uncategorizedResults.failed;
        results.skipped += uncategorizedResults.skipped;
      }
    } catch (error) {
      results.error = error.message;
    } finally {
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
    }

    return results;
  }

  /**
   * Execute tests in a category
   * @param {string} categoryName - Category name
   * @param {Array} tests - Tests to execute
   * @returns {Promise<Object>} Category results
   */
  async executeCategory(categoryName, tests) {
    const categoryResults = {
      categoryName,
      totalTests: tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
      startTime: Date.now(),
      endTime: null,
      duration: 0
    };

    for (const test of tests) {
      const testResult = await this.executeTest(test);
      categoryResults.tests.push(testResult);

      switch (testResult.status) {
        case 'passed':
          categoryResults.passed++;
          break;
        case 'failed':
          categoryResults.failed++;
          break;
        case 'skipped':
          categoryResults.skipped++;
          break;
      }
    }

    categoryResults.endTime = Date.now();
    categoryResults.duration = categoryResults.endTime - categoryResults.startTime;

    return categoryResults;
  }

  /**
   * Execute individual test
   * @param {Object} test - Test to execute
   * @returns {Promise<Object>} Test result
   */
  async executeTest(test) {
    const testResult = {
      id: test.id,
      name: test.name,
      category: test.category,
      status: 'pending',
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      error: null,
      result: null
    };

    try {
      // Execute test function
      const result = await test.fn();
      
      // For now, tests return test specifications rather than executing
      // This will be handled by actual test generators in later phases
      testResult.result = result;
      testResult.status = 'passed';
    } catch (error) {
      testResult.error = error.message;
      testResult.status = 'failed';
    } finally {
      testResult.endTime = Date.now();
      testResult.duration = testResult.endTime - testResult.startTime;
    }

    return testResult;
  }

  /**
   * Get test suite statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const allTests = this.getAllTests();
    const categories = this.getCategoryNames();

    return {
      name: this.name,
      totalTests: allTests.length,
      totalCategories: categories.length,
      categorizedTests: allTests.filter(test => test.category).length,
      uncategorizedTests: allTests.filter(test => !test.category).length,
      categories: categories.map(categoryName => ({
        name: categoryName,
        testCount: this.getTestsByCategory(categoryName).length
      }))
    };
  }

  /**
   * Generate Jest test code from suite
   * @returns {Promise<string>} Jest test code
   */
  async generateJestCode() {
    const lines = [];
    
    lines.push(`describe('${this.name}', () => {`);

    // Generate categories
    for (const [categoryName, categoryTests] of this.categories) {
      lines.push(`  describe('${categoryName}', () => {`);
      
      for (const test of categoryTests) {
        lines.push(`    test('${test.name}', async () => {`);
        lines.push(`      // Test implementation will be generated`);
        const testResult = await test.fn();
        lines.push(`      const testSpec = ${JSON.stringify(testResult, null, 6)};`);
        lines.push(`      expect(testSpec).toBeDefined();`);
        lines.push(`    });`);
      }
      
      lines.push(`  });`);
    }

    // Generate uncategorized tests
    if (this.tests.length > 0) {
      for (const test of this.tests) {
        lines.push(`  test('${test.name}', async () => {`);
        lines.push(`    // Test implementation will be generated`);
        const testResult = await test.fn();
        lines.push(`    const testSpec = ${JSON.stringify(testResult, null, 4)};`);
        lines.push(`    expect(testSpec).toBeDefined();`);
        lines.push(`  });`);
      }
    }

    lines.push(`});`);

    return lines.join('\n');
  }

  /**
   * Export test suite as JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      categories: Object.fromEntries(
        Array.from(this.categories.entries()).map(([name, tests]) => [
          name,
          tests.map(test => ({
            id: test.id,
            name: test.name,
            category: test.category
          }))
        ])
      ),
      uncategorizedTests: this.tests.map(test => ({
        id: test.id,
        name: test.name,
        category: test.category
      })),
      statistics: this.getStatistics()
    };
  }
}