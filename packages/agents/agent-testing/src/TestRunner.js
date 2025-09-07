/**
 * TestRunner - Runs comprehensive tests on configurable agents
 * Provides automated testing, performance measurement, and validation
 */

export class TestRunner {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.llmClient = null;
    this.testResults = [];
    this.performanceMetrics = new Map();
  }

  async initialize() {
    this.llmClient = await this.resourceManager.get('llmClient');
    if (!this.llmClient) {
      throw new Error('LLM client not available from ResourceManager');
    }
    this.initialized = true;
  }

  async cleanup() {
    this.initialized = false;
    this.llmClient = null;
    this.testResults = [];
    this.performanceMetrics.clear();
  }

  // Test Execution Methods
  async runTestSuite(agent, testSuite) {
    if (!this.initialized) {
      throw new Error('TestRunner not initialized');
    }

    const suiteResults = {
      suiteName: testSuite.name,
      agentId: agent.id,
      startTime: Date.now(),
      tests: [],
      summary: null
    };

    for (const test of testSuite.tests) {
      const testResult = await this.runSingleTest(agent, test);
      suiteResults.tests.push(testResult);
    }

    suiteResults.endTime = Date.now();
    suiteResults.duration = suiteResults.endTime - suiteResults.startTime;
    suiteResults.summary = this.generateSummary(suiteResults.tests);

    this.testResults.push(suiteResults);
    return suiteResults;
  }

  async runSingleTest(agent, test) {
    const startTime = Date.now();
    const result = {
      testName: test.name,
      testType: test.type,
      startTime,
      passed: false,
      error: null,
      metrics: {}
    };

    try {
      // Execute test based on type
      switch (test.type) {
        case 'message':
          const response = await this.testMessageHandling(agent, test);
          result.response = response;
          result.passed = this.evaluateTestResult(test, response);
          break;
        
        case 'performance':
          const perfMetrics = await this.testPerformance(agent, test);
          result.metrics = perfMetrics;
          result.passed = this.evaluatePerformanceMetrics(test, perfMetrics);
          break;
        
        case 'behavior':
          const behavior = await this.testBehavior(agent, test);
          result.behavior = behavior;
          result.passed = this.evaluateBehavior(test, behavior);
          break;
        
        case 'integration':
          const integration = await this.testIntegration(agent, test);
          result.integration = integration;
          result.passed = integration.success;
          break;
        
        default:
          throw new Error(`Unknown test type: ${test.type}`);
      }
    } catch (error) {
      result.error = error.message;
      result.passed = false;
    }

    result.endTime = Date.now();
    result.duration = result.endTime - startTime;
    
    return result;
  }

  // Message Handling Tests
  async testMessageHandling(agent, test) {
    const message = {
      type: test.messageType || 'message',
      content: test.input,
      sessionId: test.sessionId || `test-${Date.now()}`
    };

    const response = await agent.receive(message);
    return response;
  }

  evaluateTestResult(test, response) {
    if (test.expectedOutput) {
      // Check exact match
      if (response.content === test.expectedOutput) {
        return true;
      }
    }

    if (test.expectedPatterns) {
      // Check for patterns in response
      for (const pattern of test.expectedPatterns) {
        if (!response.content.includes(pattern)) {
          return false;
        }
      }
      return true;
    }

    if (test.validator) {
      // Use custom validator function
      return test.validator(response);
    }

    // Default: check if response exists and has content
    return response && response.content && response.content.length > 0;
  }

  // Performance Testing
  async testPerformance(agent, test) {
    const metrics = {
      responseTime: [],
      throughput: 0,
      errorRate: 0,
      memoryUsage: []
    };

    const iterations = test.iterations || 10;
    const startMemory = process.memoryUsage();
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await this.testMessageHandling(agent, {
          input: test.input || `Test message ${i}`,
          messageType: test.messageType
        });
      } catch (error) {
        errors++;
      }
      
      const endTime = Date.now();
      metrics.responseTime.push(endTime - startTime);
      
      if (i % 5 === 0) {
        metrics.memoryUsage.push(process.memoryUsage());
      }
    }

    const endMemory = process.memoryUsage();
    const totalTime = metrics.responseTime.reduce((a, b) => a + b, 0);

    metrics.avgResponseTime = totalTime / iterations;
    metrics.minResponseTime = Math.min(...metrics.responseTime);
    metrics.maxResponseTime = Math.max(...metrics.responseTime);
    metrics.throughput = iterations / (totalTime / 1000); // requests per second
    metrics.errorRate = errors / iterations;
    metrics.memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    this.performanceMetrics.set(agent.id, metrics);
    return metrics;
  }

  evaluatePerformanceMetrics(test, metrics) {
    if (test.maxResponseTime && metrics.avgResponseTime > test.maxResponseTime) {
      return false;
    }
    
    if (test.minThroughput && metrics.throughput < test.minThroughput) {
      return false;
    }
    
    if (test.maxErrorRate && metrics.errorRate > test.maxErrorRate) {
      return false;
    }
    
    return true;
  }

  // Behavior Testing
  async testBehavior(agent, test) {
    const behavior = {
      responses: [],
      consistency: true,
      patterns: []
    };

    // Test multiple interactions
    for (const scenario of test.scenarios) {
      const response = await this.testMessageHandling(agent, {
        input: scenario.input,
        messageType: scenario.messageType
      });
      
      behavior.responses.push({
        input: scenario.input,
        output: response.content,
        expectedBehavior: scenario.expectedBehavior
      });

      // Check for expected behavior patterns
      if (scenario.expectedBehavior) {
        const matchesBehavior = this.checkBehaviorPattern(
          response.content,
          scenario.expectedBehavior
        );
        
        if (!matchesBehavior) {
          behavior.consistency = false;
        }
        
        behavior.patterns.push({
          expected: scenario.expectedBehavior,
          matched: matchesBehavior
        });
      }
    }

    return behavior;
  }

  checkBehaviorPattern(response, expectedBehavior) {
    switch (expectedBehavior) {
      case 'polite':
        return ['please', 'thank you', 'would', 'could'].some(word => 
          response.toLowerCase().includes(word)
        );
      
      case 'professional':
        return !['hey', 'cool', 'awesome', 'yeah'].some(word =>
          response.toLowerCase().includes(word)
        );
      
      case 'informative':
        return response.length > 50 && response.includes('.');
      
      case 'concise':
        return response.length < 100;
      
      default:
        return true;
    }
  }

  evaluateBehavior(test, behavior) {
    if (test.requireConsistency && !behavior.consistency) {
      return false;
    }

    const matchedPatterns = behavior.patterns.filter(p => p.matched).length;
    const minPatternMatch = test.minPatternMatch || 0.8;
    
    return matchedPatterns / behavior.patterns.length >= minPatternMatch;
  }

  // Integration Testing
  async testIntegration(agent, test) {
    const integration = {
      success: false,
      interactions: [],
      finalState: null
    };

    try {
      // Test multi-step interaction
      let state = test.initialState || {};
      
      for (const step of test.steps) {
        const message = {
          type: step.type || 'message',
          content: step.content,
          sessionId: test.sessionId || `integration-${Date.now()}`,
          state
        };

        const response = await agent.receive(message);
        
        integration.interactions.push({
          step: step.name,
          input: message,
          output: response
        });

        // Update state based on response
        if (response.state) {
          state = { ...state, ...response.state };
        }

        // Verify step expectations
        if (step.verify) {
          const verified = await step.verify(response, state);
          if (!verified) {
            throw new Error(`Step ${step.name} verification failed`);
          }
        }
      }

      integration.finalState = state;
      integration.success = true;

      // Verify final state if specified
      if (test.verifyFinalState) {
        integration.success = await test.verifyFinalState(state);
      }
    } catch (error) {
      integration.error = error.message;
      integration.success = false;
    }

    return integration;
  }

  // Test Suite Management
  async loadTestSuite(suitePath) {
    try {
      const module = await import(suitePath);
      return module.default || module.testSuite;
    } catch (error) {
      throw new Error(`Failed to load test suite: ${error.message}`);
    }
  }

  async runAllTests(agent, testSuites) {
    const allResults = {
      agentId: agent.id,
      agentName: agent.name,
      startTime: Date.now(),
      suites: [],
      overallSummary: null
    };

    for (const suite of testSuites) {
      const suiteResult = await this.runTestSuite(agent, suite);
      allResults.suites.push(suiteResult);
    }

    allResults.endTime = Date.now();
    allResults.duration = allResults.endTime - allResults.startTime;
    allResults.overallSummary = this.generateOverallSummary(allResults.suites);

    return allResults;
  }

  // Reporting Methods
  generateSummary(tests) {
    const total = tests.length;
    const passed = tests.filter(t => t.passed).length;
    const failed = total - passed;
    const avgDuration = tests.reduce((sum, t) => sum + t.duration, 0) / total;

    return {
      total,
      passed,
      failed,
      passRate: passed / total,
      avgDuration,
      byType: this.groupTestsByType(tests)
    };
  }

  groupTestsByType(tests) {
    const grouped = {};
    
    for (const test of tests) {
      if (!grouped[test.testType]) {
        grouped[test.testType] = {
          total: 0,
          passed: 0,
          failed: 0
        };
      }
      
      grouped[test.testType].total++;
      if (test.passed) {
        grouped[test.testType].passed++;
      } else {
        grouped[test.testType].failed++;
      }
    }
    
    return grouped;
  }

  generateOverallSummary(suites) {
    let totalTests = 0;
    let totalPassed = 0;
    let totalDuration = 0;

    for (const suite of suites) {
      totalTests += suite.summary.total;
      totalPassed += suite.summary.passed;
      totalDuration += suite.duration;
    }

    return {
      totalSuites: suites.length,
      totalTests,
      totalPassed,
      totalFailed: totalTests - totalPassed,
      overallPassRate: totalPassed / totalTests,
      totalDuration,
      avgSuiteDuration: totalDuration / suites.length
    };
  }

  async generateReport(results, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2);
      
      case 'markdown':
        return this.generateMarkdownReport(results);
      
      case 'html':
        return this.generateHtmlReport(results);
      
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  generateMarkdownReport(results) {
    let report = `# Agent Test Report\n\n`;
    report += `## Agent: ${results.agentName} (${results.agentId})\n\n`;
    report += `**Test Duration:** ${results.duration}ms\n\n`;
    
    report += `## Summary\n`;
    report += `- **Total Suites:** ${results.overallSummary.totalSuites}\n`;
    report += `- **Total Tests:** ${results.overallSummary.totalTests}\n`;
    report += `- **Passed:** ${results.overallSummary.totalPassed}\n`;
    report += `- **Failed:** ${results.overallSummary.totalFailed}\n`;
    report += `- **Pass Rate:** ${(results.overallSummary.overallPassRate * 100).toFixed(1)}%\n\n`;
    
    report += `## Test Suites\n\n`;
    
    for (const suite of results.suites) {
      report += `### ${suite.suiteName}\n`;
      report += `- Tests: ${suite.summary.total}\n`;
      report += `- Passed: ${suite.summary.passed}\n`;
      report += `- Failed: ${suite.summary.failed}\n`;
      report += `- Pass Rate: ${(suite.summary.passRate * 100).toFixed(1)}%\n`;
      report += `- Avg Duration: ${suite.summary.avgDuration.toFixed(0)}ms\n\n`;
      
      // Add failed test details
      const failedTests = suite.tests.filter(t => !t.passed);
      if (failedTests.length > 0) {
        report += `#### Failed Tests:\n`;
        for (const test of failedTests) {
          report += `- **${test.testName}**: ${test.error || 'Test assertion failed'}\n`;
        }
        report += '\n';
      }
    }
    
    return report;
  }

  generateHtmlReport(results) {
    // Simplified HTML report
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Agent Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f0f0f0; padding: 10px; border-radius: 5px; }
    .passed { color: green; }
    .failed { color: red; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Agent Test Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Agent: ${results.agentName} (${results.agentId})</p>
    <p>Total Tests: ${results.overallSummary.totalTests}</p>
    <p class="passed">Passed: ${results.overallSummary.totalPassed}</p>
    <p class="failed">Failed: ${results.overallSummary.totalFailed}</p>
    <p>Pass Rate: ${(results.overallSummary.overallPassRate * 100).toFixed(1)}%</p>
  </div>
  <h2>Test Results</h2>
  <table>
    <tr>
      <th>Suite</th>
      <th>Total</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Pass Rate</th>
    </tr>`;
    
    for (const suite of results.suites) {
      html += `
    <tr>
      <td>${suite.suiteName}</td>
      <td>${suite.summary.total}</td>
      <td class="passed">${suite.summary.passed}</td>
      <td class="failed">${suite.summary.failed}</td>
      <td>${(suite.summary.passRate * 100).toFixed(1)}%</td>
    </tr>`;
    }
    
    html += `
  </table>
</body>
</html>`;
    
    return html;
  }

  // Performance Analysis
  getPerformanceMetrics(agentId) {
    return this.performanceMetrics.get(agentId);
  }

  compareAgentPerformance(agentId1, agentId2) {
    const metrics1 = this.performanceMetrics.get(agentId1);
    const metrics2 = this.performanceMetrics.get(agentId2);
    
    if (!metrics1 || !metrics2) {
      throw new Error('Performance metrics not available for comparison');
    }
    
    return {
      responseTimeComparison: {
        agent1: metrics1.avgResponseTime,
        agent2: metrics2.avgResponseTime,
        winner: metrics1.avgResponseTime < metrics2.avgResponseTime ? agentId1 : agentId2
      },
      throughputComparison: {
        agent1: metrics1.throughput,
        agent2: metrics2.throughput,
        winner: metrics1.throughput > metrics2.throughput ? agentId1 : agentId2
      },
      errorRateComparison: {
        agent1: metrics1.errorRate,
        agent2: metrics2.errorRate,
        winner: metrics1.errorRate < metrics2.errorRate ? agentId1 : agentId2
      }
    };
  }
}