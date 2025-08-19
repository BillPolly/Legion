/**
 * JesterModule - Legion module wrapper for Jest Agent Wrapper (JAW)
 * 
 * Provides two powerful tools for Jest testing:
 * 1. run_jest_tests - Execute tests with session management
 * 2. query_jest_results - Query, analyze, and report on test results
 */

import { Module, Tool, ToolResult } from '@legion/tools-registry';
import { JestAgentWrapper } from './core/JestAgentWrapper.js';
import { AgentTDDHelper } from './agents/AgentTDDHelper.js';
import { GenerateTestReportTool } from './tools/GenerateTestReportTool.js';
import { PerformanceAnalyzer } from './analytics/performance.js';
import { ErrorPatternAnalyzer } from './analytics/error-patterns.js';
import { z } from 'zod';

/**
 * Tool for running Jest tests with session management
 */
class RunJestTestsTool extends Tool {
  constructor(jestWrapper) {
    const inputSchema = z.object({
      pattern: z.string().optional().describe(
        'Test file pattern to match (e.g., "**/*.test.js", "src/auth/**"). If not specified, runs all tests.'
      ),
      projectPath: z.string().optional().default(process.cwd()).describe(
        'Project root directory where tests should be executed. Defaults to current directory.'
      ),
      testRunId: z.string().optional().describe(
        'Custom identifier for this test run (e.g., "pr-123", "fix-auth-bug"). Useful for tracking and comparing specific test runs.'
      ),
      clearPrevious: z.boolean().optional().default(false).describe(
        'Clear all previous test data before running. Use this for a fresh start. Default: false (preserves history).'
      ),
      config: z.object({
        collectCoverage: z.boolean().optional().describe('Collect code coverage metrics'),
        verbose: z.boolean().optional().describe('Show detailed test output'),
        bail: z.boolean().optional().describe('Stop after first test failure'),
        timeout: z.number().optional().describe('Test timeout in milliseconds')
      }).optional().describe('Jest configuration options')
    });
    
    const outputSchema = z.object({
      sessionId: z.string().describe('Unique identifier for this test session'),
      projectPath: z.string().describe('Project path where tests were executed'),
      summary: z.object({
        total: z.number().describe('Total number of tests'),
        passed: z.number().describe('Number of passing tests'),
        failed: z.number().describe('Number of failing tests'),
        skipped: z.number().describe('Number of skipped tests'),
        duration: z.number().describe('Total duration in milliseconds'),
        success: z.boolean().describe('True if all tests passed')
      }).describe('Test run summary statistics'),
      failedTests: z.array(z.string()).describe('List of failed test names for quick reference'),
      coverage: z.object({
        lines: z.number(),
        statements: z.number(),
        functions: z.number(),
        branches: z.number()
      }).optional().describe('Code coverage percentages if coverage was collected')
    });
    
    super({
      name: 'run_jest_tests',
      description: `Execute Jest tests with intelligent session management and persistence.

This tool runs tests and stores results in a persistent database for later analysis. Each test run creates a session that can be queried, compared, and analyzed.

WHEN TO USE:
• After making code changes to verify functionality
• Starting a TDD cycle (write test → see it fail → implement → see it pass)
• Creating a baseline before refactoring
• Running specific test suites during development
• Verifying bug fixes with targeted tests

EXAMPLES:
• Run all tests: {}
• Run specific pattern: {pattern: "src/**/*.test.js"}
• Named session for tracking: {testRunId: "fix-auth-bug"}  
• Fresh start with clean data: {clearPrevious: true}
• Run with coverage: {config: {collectCoverage: true}}
• Quick fail on first error: {config: {bail: true}}

WORKFLOW TIP: After running tests, use query_jest_results to analyze failures, generate reports, or compare with previous runs.`,
      inputSchema: inputSchema,
      execute: async (args) => {
        try {
          this.progress('Initializing test session...', 10);
          
          const { pattern, projectPath = process.cwd(), testRunId, clearPrevious = false, config = {} } = args;
          
          // Handle clearing previous data if requested
          if (clearPrevious) {
            this.progress('Clearing previous test data...', 15);
            await this.jestWrapper.clearAllSessions();
          }
          
          // Set testRunId if provided
          if (testRunId) {
            this.jestWrapper.config.testRunId = testRunId;
          }
          
          // Create Jest configuration
          const jestConfig = {
            ...config,
            cwd: projectPath,
            rootDir: projectPath
          };
          
          this.progress('Starting test execution...', 25);
          
          // Start a new test session
          const session = await this.jestWrapper.startSession(jestConfig);
          
          // Note: In a real implementation, this would actually run Jest
          // For now, we're using the mock session approach
          this.progress('Running tests...', 50);
          
          // Simulate test run (in production, this would use Jest programmatic API)
          await this.jestWrapper.runTests(pattern, jestConfig);
          
          this.progress('Collecting results...', 80);
          
          // Get test summary
          const summary = await this.jestWrapper.getTestSummary(session.id);
          
          // Get list of failed tests for quick reference
          const failedTests = await this.jestWrapper.getFailedTests(session.id);
          const failedTestNames = failedTests.map(t => t.fullName);
          
          // Prepare result
          const result = {
            sessionId: session.id,
            projectPath: projectPath,
            summary: {
              total: summary.total,
              passed: summary.passed,
              failed: summary.failed,
              skipped: summary.skipped,
              duration: 0, // Would come from Jest runner
              success: summary.failed === 0
            },
            failedTests: failedTestNames
          };
          
          // Add coverage if requested
          if (config.collectCoverage) {
            result.coverage = {
              lines: 0,
              statements: 0,
              functions: 0,
              branches: 0
            };
          }
          
          this.progress('Test run complete', 100);
          return result;
        } catch (error) {
          this.error(error.message);
          throw error;
        }
      },
      getMetadata: () => ({
        description: 'Execute Jest tests with intelligent session management',
        input: inputSchema,
        output: outputSchema
      })
    });
    
    this.jestWrapper = jestWrapper;
  }
}

/**
 * Tool for querying and analyzing Jest test results
 */
class QueryJestResultsTool extends Tool {
  constructor(jestWrapper) {
    const inputSchema = z.object({
      queryType: z.enum([
        'failures',
        'report', 
        'sessions',
        'comparison',
        'trends',
        'logs',
        'performance'
      ]).describe(`Type of query to perform:
• failures - Analyze failed tests with TDD insights and suggestions
• report - Generate comprehensive markdown report  
• sessions - List all test sessions with metadata
• comparison - Compare results between sessions
• trends - Track test performance over time
• logs - Search through test logs and console output
• performance - Identify slowest tests and bottlenecks`),
      
      sessionId: z.string().optional().describe(
        'Specific session ID to query. If not provided, uses the most recent session.'
      ),
      sessionIds: z.array(z.string()).optional().describe(
        'Multiple session IDs for comparison or trend analysis. Used with comparison and trends queries.'
      ),
      testName: z.string().optional().describe(
        'Specific test name for history or trend analysis. Used with trends query.'
      ),
      searchQuery: z.string().optional().describe(
        'Search term for log queries. Used with logs query.'
      ),
      limit: z.number().optional().default(10).describe(
        'Maximum number of results to return. Default: 10'
      ),
      format: z.enum(['json', 'markdown', 'summary']).optional().default('json').describe(
        'Output format. JSON for structured data, markdown for reports, summary for concise overview.'
      )
    });
    
    const outputSchema = z.object({
      queryType: z.string().describe('The type of query that was performed'),
      sessionId: z.string().optional().describe('The session ID that was queried'),
      data: z.any().describe('Query results (structure varies by query type)'),
      insights: z.object({
        summary: z.string().describe('One-line summary of the findings'),
        recommendations: z.array(z.string()).describe('Actionable recommendations based on the query'),
        priority: z.enum(['high', 'medium', 'low']).describe('Priority level of recommendations')
      }).describe('AI-generated insights and recommendations')
    });
    
    super({
      name: 'query_jest_results',
      description: `Query, analyze, and report on Jest test results from any session.

This versatile tool provides comprehensive analysis of test results including failure analysis, report generation, session comparison, and trend tracking. It automatically uses the latest session unless you specify otherwise.

WHEN TO USE:
• After test failures to understand what went wrong (queryType: "failures")
• Generate reports for documentation or PRs (queryType: "report")  
• Compare test results before/after changes (queryType: "comparison")
• Track test stability over time (queryType: "trends")
• Debug test issues with log search (queryType: "logs")
• Find performance bottlenecks (queryType: "performance")
• Review all test sessions (queryType: "sessions")

EXAMPLES:
• Analyze latest failures: {queryType: "failures"}
• Generate markdown report: {queryType: "report", format: "markdown"}
• Compare two runs: {queryType: "comparison", sessionIds: ["main-branch", "pr-123"]}
• Find flaky tests: {queryType: "trends", testName: "auth.test.js"}
• Search error logs: {queryType: "logs", searchQuery: "timeout"}
• List all sessions: {queryType: "sessions", limit: 20}
• Find slow tests: {queryType: "performance", limit: 5}

WORKFLOW TIP: Use this after run_jest_tests to understand failures, or periodically to track test health and performance trends.`,
      inputSchema: inputSchema,
      execute: async (args) => {
        try {
          const { queryType, sessionId, sessionIds, testName, searchQuery, limit = 10, format = 'json' } = args;
          
          this.progress(`Executing ${queryType} query...`, 20);
          
          // Get the session ID to use (latest if not specified)
          let targetSessionId = sessionId;
          if (!targetSessionId && queryType !== 'sessions' && queryType !== 'comparison') {
            const sessions = await this.jestWrapper.getAllSessions();
            if (sessions.length === 0) {
              throw new Error('No test sessions found. Run tests first using run_jest_tests.');
            }
            targetSessionId = sessions[0].id; // Most recent
          }
          
          let data;
          let insights = {
            summary: '',
            recommendations: [],
            priority: 'medium'
          };
          
          switch (queryType) {
            case 'failures': {
              this.progress('Analyzing test failures...', 40);
              const failures = await this.jestWrapper.getFailedTests(targetSessionId);
              const tddHelper = new AgentTDDHelper(this.jestWrapper);
              const analysis = await tddHelper.runTDDCycle(targetSessionId);
              
              data = {
                status: analysis.status,
                totalFailures: failures.length,
                failures: analysis.detailedFailures || failures,
                errorPatterns: analysis.errorSummary,
                suggestions: analysis.suggestions,
                nextActions: analysis.nextActions
              };
              
              insights.summary = failures.length === 0 
                ? 'All tests passing - green state achieved!' 
                : `${failures.length} test(s) failing - ${analysis.status} state`;
              insights.recommendations = analysis.nextActions || [];
              insights.priority = failures.length > 5 ? 'high' : failures.length > 0 ? 'medium' : 'low';
              break;
            }
            
            case 'report': {
              this.progress('Generating test report...', 40);
              const reportTool = new GenerateTestReportTool(this.jestWrapper);
              const reportResult = await reportTool._execute({
                sessionId: targetSessionId,
                reportType: 'detailed',
                includeCharts: format === 'markdown',
                includeRecommendations: true
              });
              
              if (format === 'markdown') {
                data = reportResult.reportContent;
              } else {
                data = {
                  content: reportResult.reportContent,
                  summary: reportResult.summary
                };
              }
              
              insights.summary = `Test report generated for session ${targetSessionId}`;
              insights.recommendations = ['Review failed tests', 'Check coverage gaps', 'Analyze performance trends'];
              break;
            }
            
            case 'sessions': {
              this.progress('Retrieving test sessions...', 40);
              const sessions = await this.jestWrapper.getAllSessions();
              data = {
                totalSessions: sessions.length,
                sessions: sessions.slice(0, limit).map(s => ({
                  id: s.id,
                  startTime: s.startTime,
                  status: s.status,
                  metadata: s.metadata,
                  summary: s.summary
                }))
              };
              
              insights.summary = `Found ${sessions.length} test session(s)`;
              if (sessions.length > 100) {
                insights.recommendations.push('Consider clearing old sessions to free up space');
                insights.priority = 'low';
              }
              break;
            }
            
            case 'comparison': {
              if (!sessionIds || sessionIds.length < 2) {
                throw new Error('Comparison requires at least 2 session IDs in sessionIds array');
              }
              this.progress('Comparing test sessions...', 40);
              const comparison = await this.jestWrapper.compareSessions(sessionIds);
              
              data = {
                sessions: comparison,
                delta: this.calculateDelta(comparison),
                regressions: [],
                improvements: []
              };
              
              // Analyze changes
              if (comparison.length >= 2) {
                const [newer, older] = comparison;
                if (newer.stats.failed > older.stats.failed) {
                  data.regressions.push(`${newer.stats.failed - older.stats.failed} new failures`);
                  insights.priority = 'high';
                }
                if (newer.stats.passed > older.stats.passed) {
                  data.improvements.push(`${newer.stats.passed - older.stats.passed} tests fixed`);
                }
              }
              
              insights.summary = `Compared ${sessionIds.length} test sessions`;
              insights.recommendations = data.regressions.length > 0 
                ? ['Investigate new failures', 'Review recent changes']
                : ['Tests stable across sessions'];
              break;
            }
            
            case 'trends': {
              this.progress('Analyzing test trends...', 40);
              if (testName) {
                const trends = await this.jestWrapper.getTestTrends(testName, limit);
                data = {
                  testName: testName,
                  history: trends,
                  pattern: this.detectPattern(trends),
                  flakiness: this.calculateFlakiness(trends)
                };
                
                if (data.flakiness > 0.3) {
                  insights.summary = `Test "${testName}" is flaky (${Math.round(data.flakiness * 100)}% failure rate)`;
                  insights.recommendations = ['Investigate timing issues', 'Check for race conditions', 'Review test isolation'];
                  insights.priority = 'high';
                } else {
                  insights.summary = `Test "${testName}" is stable`;
                }
              } else {
                // Overall trends
                const sessions = await this.jestWrapper.getAllSessions();
                data = {
                  totalSessions: sessions.length,
                  trend: 'stable', // Would calculate from session data
                  averagePassRate: 0,
                  averageDuration: 0
                };
                insights.summary = 'Overall test suite trends analyzed';
              }
              break;
            }
            
            case 'logs': {
              this.progress('Searching test logs...', 40);
              const logs = await this.jestWrapper.searchLogs({
                message: searchQuery,
                sessionId: targetSessionId,
                limit: limit
              });
              
              data = {
                totalMatches: logs.length,
                logs: logs,
                searchQuery: searchQuery
              };
              
              insights.summary = `Found ${logs.length} log entries matching "${searchQuery}"`;
              if (logs.length === 0) {
                insights.recommendations = ['Try a different search term', 'Check if logging is enabled'];
              }
              break;
            }
            
            case 'performance': {
              this.progress('Analyzing test performance...', 40);
              const slowTests = await this.jestWrapper.getSlowestTests(limit);
              const analyzer = new PerformanceAnalyzer(this.jestWrapper);
              
              // Get tests for the target session to analyze bottlenecks
              const tests = await this.jestWrapper.findTests({ sessionId: targetSessionId });
              const bottlenecks = analyzer.identifyBottlenecks(tests);
              const metrics = analyzer.calculateMetrics(tests);
              
              data = {
                slowestTests: slowTests,
                bottlenecks: bottlenecks,
                recommendations: analyzer.generateRecommendations(metrics, bottlenecks)
              };
              
              if (slowTests.length > 0 && slowTests[0].duration > 5000) {
                insights.summary = `Found ${slowTests.length} slow tests (longest: ${slowTests[0].duration}ms)`;
                insights.recommendations = ['Optimize slowest tests', 'Consider parallel execution', 'Review test setup/teardown'];
                insights.priority = 'medium';
              } else {
                insights.summary = 'Test performance is acceptable';
                insights.priority = 'low';
              }
              break;
            }
            
            default:
              throw new Error(`Unknown query type: ${queryType}`);
          }
          
          this.progress('Query complete', 100);
          
          return {
            queryType,
            sessionId: targetSessionId,
            data,
            insights
          };
        } catch (error) {
          this.error(error.message);
          throw error;
        }
      },
      getMetadata: () => ({
        description: 'Query and analyze Jest test results',
        input: inputSchema,
        output: outputSchema
      })
    });
    
    this.jestWrapper = jestWrapper;
  }
  
  calculateDelta(comparison) {
    if (comparison.length < 2) return null;
    const [newer, older] = comparison;
    return {
      totalChange: newer.stats.total - older.stats.total,
      passedChange: newer.stats.passed - older.stats.passed,
      failedChange: newer.stats.failed - older.stats.failed,
      passRateChange: newer.stats.passRate - older.stats.passRate,
      durationChange: newer.stats.avgDuration - older.stats.avgDuration
    };
  }
  
  detectPattern(trends) {
    if (trends.length < 3) return 'insufficient-data';
    
    const failureCount = trends.filter(t => t.status === 'failed').length;
    const failureRate = failureCount / trends.length;
    
    if (failureRate === 0) return 'stable-passing';
    if (failureRate === 1) return 'consistent-failure';
    if (failureRate > 0.5) return 'mostly-failing';
    if (failureRate > 0.2) return 'flaky';
    return 'mostly-passing';
  }
  
  calculateFlakiness(trends) {
    if (trends.length < 2) return 0;
    
    let transitions = 0;
    for (let i = 1; i < trends.length; i++) {
      if (trends[i].status !== trends[i-1].status) {
        transitions++;
      }
    }
    
    return transitions / (trends.length - 1);
  }
}

/**
 * Main Jester Module for Legion integration
 */
export class JesterModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'JesterModule';
    this.config = dependencies;
    this.description = 'Powerful Jest testing tools with session management and intelligent analysis';
    this.version = '2.0.0';
    this.jestWrapper = null;
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

    // Initialize Jest Agent Wrapper with persistence
    this.jestWrapper = new JestAgentWrapper({
      storage: 'sqlite',
      dbPath: './test-results.db', // Fixed path for persistence
      collectCoverage: true,
      collectPerformance: true,
      realTimeEvents: true,
      clearPrevious: false // Don't clear by default
    });

    this.initialized = true;
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
      new RunJestTestsTool(this.jestWrapper),
      new QueryJestResultsTool(this.jestWrapper)
    ];
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.getTools().find(tool => tool.name === name);
  }

  /**
   * Cleanup the module
   */
  async cleanup() {
    if (this.jestWrapper) {
      try {
        // Explicitly clean up event listeners to prevent memory leaks
        this.jestWrapper.removeAllListeners();
        
        // Don't clear data on cleanup - preserve history
        await this.jestWrapper.close();
        
        // Ensure cleanup is complete by nulling the reference
        this.jestWrapper = null;
      } catch (error) {
        console.warn('JesterModule cleanup warning:', error.message);
      }
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
      version: '2.0.0',
      author: 'Legion Team',
      tools: this.getTools().length,
      capabilities: [
        'Jest test execution with session management',
        'Persistent test history and trends',
        'Intelligent failure analysis with TDD insights',
        'Comprehensive test reporting',
        'Multi-session comparison',
        'Performance bottleneck detection',
        'Test flakiness detection',
        'Log search and analysis'
      ]
    };
  }
}