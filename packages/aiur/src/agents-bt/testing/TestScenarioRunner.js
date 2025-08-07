/**
 * TestScenarioRunner - Executes JSON-defined test scenarios using BT agents
 * 
 * Runner that orchestrates BT-based testing workflows, manages test environments,
 * and provides comprehensive reporting of test execution results.
 */

import { TestingBTBase } from './TestingBTBase.js';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

export class TestScenarioRunner extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      defaultTimeout: 30000,
      stopOnFailure: false,
      parallelExecution: false,
      reportingLevel: 'detailed',
      outputFormat: 'json',
      cleanupAfterTests: true,
      ...config
    };
    
    this.testingAgent = null;
    this.testResults = [];
    this.isRunning = false;
    this.currentSuite = null;
  }

  /**
   * Initialize the test scenario runner
   */
  async initialize(dependencies = {}) {
    // Create testing BT agent
    this.testingAgent = new TestingBTBase({
      debugMode: this.config.debugMode || false,
      defaultTimeout: this.config.defaultTimeout
    });
    
    await this.testingAgent.initialize();
    
    // Set up event forwarding from testEventEmitter
    if (this.testingAgent.testEventEmitter) {
      this.testingAgent.testEventEmitter.on('testComplete', (result) => this.emit('testComplete', result));
      this.testingAgent.testEventEmitter.on('testError', (result) => this.emit('testError', result));
      this.testingAgent.testEventEmitter.on('suiteComplete', (result) => this.emit('suiteComplete', result));
    }
    
    this.emit('info', { message: 'TestScenarioRunner initialized' });
  }

  /**
   * Register agents under test
   */
  registerTestAgents(agents) {
    for (const [agentId, agent] of Object.entries(agents)) {
      this.testingAgent.registerTestAgent(agentId, agent);
    }
    
    this.emit('info', { 
      message: `Registered ${Object.keys(agents).length} test agents`,
      agents: Object.keys(agents)
    });
  }

  /**
   * Run a single test scenario
   */
  async runScenario(scenarioConfig, options = {}) {
    if (!scenarioConfig) {
      throw new Error('Scenario configuration is required');
    }

    const mergedOptions = {
      ...this.config,
      ...options
    };

    this.emit('scenarioStart', { 
      scenario: scenarioConfig.name || 'Unnamed Scenario',
      config: scenarioConfig
    });

    try {
      const result = await this.testingAgent.runTestScenario(scenarioConfig, {
        timeout: mergedOptions.timeout || this.config.defaultTimeout,
        context: mergedOptions.context || {}
      });

      this.testResults.push(result);
      
      this.emit('scenarioComplete', result);
      
      return result;

    } catch (error) {
      const errorResult = {
        scenarioName: scenarioConfig.name || 'Unnamed Scenario',
        status: 'ERROR',
        error: error.message,
        stackTrace: error.stack,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(errorResult);
      
      this.emit('scenarioError', errorResult);
      
      return errorResult;
    }
  }

  /**
   * Run a test suite with multiple scenarios
   */
  async runSuite(suiteConfig, options = {}) {
    if (!suiteConfig || !suiteConfig.tests) {
      throw new Error('Suite configuration with tests array is required');
    }

    this.isRunning = true;
    this.currentSuite = suiteConfig;

    const mergedOptions = {
      ...this.config,
      ...options
    };

    this.emit('suiteStart', {
      suite: suiteConfig.name || 'Unnamed Suite',
      testCount: suiteConfig.tests.length,
      config: suiteConfig
    });

    try {
      const suiteResults = await this.testingAgent.runTestSuite(suiteConfig, {
        stopOnFailure: mergedOptions.stopOnFailure,
        timeout: mergedOptions.timeout,
        context: mergedOptions.context || {}
      });

      // Add to our results
      this.testResults.push(...suiteResults.results);

      if (mergedOptions.cleanupAfterTests) {
        await this.cleanup();
      }

      this.isRunning = false;
      this.currentSuite = null;

      this.emit('suiteComplete', suiteResults);

      return suiteResults;

    } catch (error) {
      this.isRunning = false;
      this.currentSuite = null;

      const errorResult = {
        suiteName: suiteConfig.name || 'Unnamed Suite',
        status: 'ERROR',
        error: error.message,
        stackTrace: error.stack,
        timestamp: new Date().toISOString()
      };

      this.emit('suiteError', errorResult);

      throw error;
    }
  }

  /**
   * Load and run test scenarios from file
   */
  async runFromFile(filePath, options = {}) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const testConfig = JSON.parse(fileContent);

      if (testConfig.type === 'suite' || testConfig.tests) {
        return await this.runSuite(testConfig, options);
      } else {
        return await this.runScenario(testConfig, options);
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Test file not found: ${filePath}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in test file: ${filePath}. ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load and run all test files from directory
   */
  async runFromDirectory(directoryPath, options = {}) {
    try {
      const files = await fs.readdir(directoryPath);
      const testFiles = files.filter(file => 
        file.endsWith('.json') && (file.includes('test') || file.includes('spec'))
      );

      if (testFiles.length === 0) {
        throw new Error(`No test files found in directory: ${directoryPath}`);
      }

      const allResults = [];

      for (const testFile of testFiles) {
        const filePath = path.join(directoryPath, testFile);
        
        this.emit('fileStart', { file: testFile, path: filePath });
        
        try {
          const result = await this.runFromFile(filePath, options);
          allResults.push({ file: testFile, result });
          
          this.emit('fileComplete', { file: testFile, result });
          
        } catch (error) {
          const errorResult = { 
            file: testFile, 
            error: error.message,
            status: 'ERROR'
          };
          
          allResults.push(errorResult);
          
          this.emit('fileError', errorResult);
          
          if (options.stopOnFailure) {
            break;
          }
        }
      }

      return {
        directory: directoryPath,
        filesProcessed: allResults.length,
        results: allResults,
        summary: this.generateSummaryFromResults(allResults.map(r => r.result).filter(Boolean))
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Test directory not found: ${directoryPath}`);
      }
      throw error;
    }
  }

  /**
   * Generate test report
   */
  generateReport(format = 'json') {
    const report = {
      summary: this.generateSummary(),
      results: this.testResults,
      generatedAt: new Date().toISOString(),
      runner: 'TestScenarioRunner',
      version: '1.0.0'
    };

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'console':
        return this.formatConsoleReport(report);
      
      case 'markdown':
        return this.formatMarkdownReport(report);
      
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const summary = {
      total: this.testResults.length,
      passed: 0,
      failed: 0,
      errors: 0,
      duration: 0
    };

    for (const result of this.testResults) {
      switch (result.status) {
        case 'PASSED':
          summary.passed++;
          break;
        case 'FAILED':
          summary.failed++;
          break;
        case 'ERROR':
          summary.errors++;
          break;
      }
      
      if (result.duration) {
        summary.duration += result.duration;
      }
    }

    summary.successRate = summary.total > 0 ? 
      (summary.passed / summary.total * 100).toFixed(1) : 0;

    return summary;
  }

  /**
   * Generate summary from provided results
   */
  generateSummaryFromResults(results) {
    return this.generateSummary.call({ testResults: results });
  }

  /**
   * Format console report
   */
  formatConsoleReport(report) {
    const { summary } = report;
    
    let output = '\n=== Test Results Summary ===\n';
    output += `Total Tests: ${summary.total}\n`;
    output += `Passed: ${summary.passed}\n`;
    output += `Failed: ${summary.failed}\n`;
    output += `Errors: ${summary.errors}\n`;
    output += `Success Rate: ${summary.successRate}%\n`;
    output += `Total Duration: ${summary.duration}ms\n`;
    
    if (summary.failed > 0 || summary.errors > 0) {
      output += '\n=== Failed Tests ===\n';
      
      for (const result of report.results) {
        if (result.status === 'FAILED' || result.status === 'ERROR') {
          output += `\n❌ ${result.scenarioName || result.testId}\n`;
          output += `   Status: ${result.status}\n`;
          
          if (result.error) {
            output += `   Error: ${result.error}\n`;
          }
          
          if (result.details && result.details.assertionResults) {
            for (const assertion of result.details.assertionResults) {
              if (!assertion.passed) {
                output += `   Assertion Failed: ${assertion.assertion}\n`;
              }
            }
          }
        }
      }
    }
    
    return output;
  }

  /**
   * Format markdown report
   */
  formatMarkdownReport(report) {
    const { summary } = report;
    
    let markdown = '# Test Results Report\n\n';
    markdown += '## Summary\n\n';
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${summary.total} |\n`;
    markdown += `| Passed | ${summary.passed} |\n`;
    markdown += `| Failed | ${summary.failed} |\n`;
    markdown += `| Errors | ${summary.errors} |\n`;
    markdown += `| Success Rate | ${summary.successRate}% |\n`;
    markdown += `| Duration | ${summary.duration}ms |\n\n`;
    
    if (report.results.length > 0) {
      markdown += '## Test Details\n\n';
      
      for (const result of report.results) {
        const status = result.status === 'PASSED' ? '✅' : '❌';
        markdown += `### ${status} ${result.scenarioName || result.testId}\n\n`;
        markdown += `- **Status**: ${result.status}\n`;
        markdown += `- **Duration**: ${result.duration}ms\n`;
        
        if (result.error) {
          markdown += `- **Error**: ${result.error}\n`;
        }
        
        markdown += '\n';
      }
    }
    
    return markdown;
  }

  /**
   * Save report to file
   */
  async saveReport(filePath, format = 'json') {
    const report = this.generateReport(format);
    await fs.writeFile(filePath, report, 'utf8');
    
    this.emit('reportSaved', { filePath, format });
  }

  /**
   * Clear test results
   */
  clearResults() {
    this.testResults = [];
    if (this.testingAgent) {
      this.testingAgent.clearTestResults();
    }
    
    this.emit('resultsClear');
  }

  /**
   * Clean up test resources
   */
  async cleanup() {
    if (this.testingAgent) {
      await this.testingAgent.cleanup();
    }
    
    this.emit('cleanup');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentSuite: this.currentSuite?.name || null,
      testResults: this.testResults.length,
      summary: this.generateSummary()
    };
  }
}