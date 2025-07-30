/**
 * JesterModule - Legion module wrapper for Jest Agent Wrapper (JAW)
 * 
 * Provides advanced Jest testing capabilities as Legion tools with
 * intelligent analytics, TDD support, and test history tracking.
 */

import { Module, Tool, ToolResult } from '@legion/module-loader';
import { JestAgentWrapper } from './core/JestAgentWrapper.js';
import { AgentTDDHelper } from './agents/AgentTDDHelper.js';
import { z } from 'zod';

/**
 * Tool for running Jest tests with advanced analytics
 */
class RunTestsTool extends Tool {
  constructor(jestWrapper, tddHelper) {
    super({
      name: 'run_tests',
      description: 'Execute Jest tests with advanced analytics and reporting',
      inputSchema: z.object({
        pattern: z.string().optional().describe('Test file pattern to match (optional, runs all tests if not specified)'),
        config: z.object({
          collectCoverage: z.boolean().optional().describe('Collect code coverage during test run'),
          verbose: z.boolean().optional().describe('Enable verbose output'),
          bail: z.boolean().optional().describe('Stop after first test failure')
        }).optional().describe('Jest configuration options')
      }),
      outputSchema: z.object({
        sessionId: z.string().describe('Unique session identifier for this test run'),
        summary: z.object({
          totalTests: z.number(),
          passedTests: z.number(),
          failedTests: z.number(),
          skippedTests: z.number(),
          duration: z.number(),
          success: z.boolean()
        }),
        coverage: z.object({}).optional().describe('Code coverage information if enabled')
      })
    });
    this.jestWrapper = jestWrapper;
    this.tddHelper = tddHelper;
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 10, status: 'Starting test session...' });
      
      const { pattern, config = {} } = args;
      
      // Start a new test session
      const session = await this.jestWrapper.runTests(pattern, config);
      
      this.emit('progress', { percentage: 50, status: 'Running tests...' });
      
      // Get test summary
      const summary = await this.jestWrapper.getTestSummary(session.id);
      
      this.emit('progress', { percentage: 90, status: 'Collecting results...' });
      
      const result = {
        sessionId: session.id,
        summary: {
          totalTests: summary.totalTests || 0,
          passedTests: summary.passedTests || 0,
          failedTests: summary.failedTests || 0,
          skippedTests: summary.skippedTests || 0,
          duration: summary.duration || 0,
          success: (summary.failedTests || 0) === 0
        }
      };

      if (config.collectCoverage) {
        // TODO: Implement coverage collection
        result.coverage = {};
      }

      this.emit('progress', { percentage: 100, status: 'Test run complete' });
      return result;
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}

/**
 * Tool for analyzing test failures with TDD insights
 */
class AnalyzeFailuresTool extends Tool {
  constructor(jestWrapper, tddHelper) {
    super({
      name: 'analyze_failures',
      description: 'Analyze failed tests and provide actionable insights for TDD',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Session ID from a previous test run (optional, uses latest if not provided)')
      }),
      outputSchema: z.object({
        status: z.enum(['green', 'red']).describe('TDD status - green if all passing, red if failures'),
        failures: z.number().describe('Number of failed tests'),
        errorSummary: z.object({}).describe('Analysis of error patterns and types'),
        suggestions: z.array(z.object({})).describe('Implementation suggestions based on failures'),
        nextActions: z.array(z.object({})).describe('Prioritized list of actions to take'),
        detailedFailures: z.array(z.object({})).describe('Detailed information about each failed test')
      })
    });
    this.jestWrapper = jestWrapper;
    this.tddHelper = tddHelper;
  }

  async execute(args) {
    try {
      this.emit('progress', { percentage: 20, status: 'Analyzing test failures...' });
      
      const { sessionId } = args;
      
      // Run TDD cycle analysis
      const analysis = await this.tddHelper.runTDDCycle(sessionId);
      
      this.emit('progress', { percentage: 100, status: 'Analysis complete' });
      return analysis;
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}

/**
 * Tool for getting test history and trends
 */
class GetTestHistoryTool extends Tool {
  constructor(jestWrapper) {
    super({
      name: 'get_test_history',
      description: 'Get historical performance data for a specific test',
      inputSchema: z.object({
        testName: z.string().describe('Full name of the test to analyze')
      }),
      outputSchema: z.object({
        totalRuns: z.number(),
        successRate: z.number(),
        averageDuration: z.number(),
        trend: z.string(),
        recommendation: z.string()
      })
    });
    this.jestWrapper = jestWrapper;
  }

  async execute(args) {
    try {
      const { testName } = args;
      const tddHelper = new AgentTDDHelper(this.jestWrapper);
      const history = await tddHelper.analyzeTestHistory(testName);
      return history;
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}

/**
 * Tool for searching test logs
 */
class SearchLogsTool extends Tool {
  constructor(jestWrapper) {
    super({
      name: 'search_logs',
      description: 'Search through test logs and console output',
      inputSchema: z.object({
        query: z.string().describe('Search query for log messages'),
        sessionId: z.string().optional().describe('Limit search to specific session (optional)')
      }),
      outputSchema: z.object({
        matches: z.array(z.object({})).describe('Array of matching log entries with context'),
        totalMatches: z.number()
      })
    });
    this.jestWrapper = jestWrapper;
  }

  async execute(args) {
    try {
      const { query, sessionId } = args;
      const results = await this.jestWrapper.searchLogs(query);
      
      // Filter by session if provided
      const filteredResults = sessionId 
        ? results.filter(r => r.sessionId === sessionId)
        : results;
      
      return {
        matches: filteredResults,
        totalMatches: filteredResults.length
      };
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}

/**
 * Tool for identifying slowest tests
 */
class GetSlowestTestsTool extends Tool {
  constructor(jestWrapper) {
    super({
      name: 'get_slowest_tests',
      description: 'Identify the slowest running tests for performance optimization',
      inputSchema: z.object({
        limit: z.number().default(10).describe('Number of slowest tests to return')
      }),
      outputSchema: z.object({
        tests: z.array(z.object({})).describe('Array of slowest tests with duration information')
      })
    });
    this.jestWrapper = jestWrapper;
  }

  async execute(args) {
    try {
      const { limit } = args;
      const tests = await this.jestWrapper.getSlowestTests(limit);
      return { tests };
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}

/**
 * Tool for getting common error patterns
 */
class GetCommonErrorsTool extends Tool {
  constructor(jestWrapper) {
    super({
      name: 'get_common_errors',
      description: 'Get the most frequently occurring test errors',
      inputSchema: z.object({
        limit: z.number().default(10).describe('Number of error types to return')
      }),
      outputSchema: z.object({
        errors: z.array(z.object({})).describe('Array of common errors with occurrence counts')
      })
    });
    this.jestWrapper = jestWrapper;
  }

  async execute(args) {
    try {
      const { limit } = args;
      const errors = await this.jestWrapper.getMostCommonErrors(limit);
      return { errors };
    } catch (error) {
      this.emit('error', { message: error.message });
      throw error;
    }
  }
}

/**
 * Main Jester Module for Legion integration
 */
export class JesterModule extends Module {
  constructor(dependencies = {}) {
    super('JesterModule', dependencies);
    this.description = 'Advanced Jest testing with intelligent analytics and TDD support';
    this.jestWrapper = null;
    this.tddHelper = null;
  }

  /**
   * Static async factory method following the Async Resource Manager Pattern
   */
  static async create(resourceManager) {
    const dependencies = {
      resourceManager: resourceManager
    };

    const module = new JesterModule(dependencies);
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize Jest Agent Wrapper
    this.jestWrapper = new JestAgentWrapper({
      storage: 'sqlite',
      collectCoverage: true,
      collectPerformance: true,
      realTimeEvents: true
    });

    // Initialize TDD Helper
    this.tddHelper = new AgentTDDHelper(this.jestWrapper);

    await super.initialize();
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('JesterModule must be initialized before getting tools');
    }

    return [
      new RunTestsTool(this.jestWrapper, this.tddHelper),
      new AnalyzeFailuresTool(this.jestWrapper, this.tddHelper),
      new GetTestHistoryTool(this.jestWrapper),
      new SearchLogsTool(this.jestWrapper),
      new GetSlowestTestsTool(this.jestWrapper),
      new GetCommonErrorsTool(this.jestWrapper)
    ];
  }

  /**
   * Cleanup the module
   */
  async cleanup() {
    if (this.jestWrapper) {
      await this.jestWrapper.close();
    }
    await super.cleanup();
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: '1.0.0',
      author: 'Legion Team',
      tools: this.getTools().length,
      capabilities: [
        'Advanced Jest test execution',
        'TDD cycle analysis',
        'Test failure insights',
        'Performance monitoring',
        'Historical test tracking',
        'Error pattern analysis',
        'Log searching and analytics'
      ]
    };
  }
}

export default JesterModule;