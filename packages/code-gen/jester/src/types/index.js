/**
 * Type Definitions and Constants for Jest Agent Wrapper
 * 
 * Contains all TypeScript-style JSDoc type definitions and constants
 */

/**
 * @typedef {Object} TestSession
 * @property {string} id - Unique session identifier
 * @property {Date} startTime - Session start timestamp
 * @property {Date} endTime - Session end timestamp
 * @property {'running'|'completed'|'failed'|'cancelled'} status - Session status
 * @property {Object} jestConfig - Jest configuration used
 * @property {Object} environment - Environment information
 * @property {Object} summary - Test execution summary
 */

/**
 * @typedef {Object} TestSuite
 * @property {string} sessionId - Parent session ID
 * @property {string} id - Unique suite identifier
 * @property {string} path - File path of the test suite
 * @property {string} name - Display name of the suite
 * @property {Date} startTime - Suite start timestamp
 * @property {Date} endTime - Suite end timestamp
 * @property {'pending'|'running'|'passed'|'failed'|'skipped'} status - Suite status
 * @property {number} setupDuration - Setup time in milliseconds
 * @property {number} teardownDuration - Teardown time in milliseconds
 */

/**
 * @typedef {Object} TestCase
 * @property {string} sessionId - Parent session ID
 * @property {string} suiteId - Parent suite ID
 * @property {string} id - Unique test identifier
 * @property {string} name - Test name
 * @property {string} fullName - Full test name including suite
 * @property {Date} startTime - Test start timestamp
 * @property {Date} endTime - Test end timestamp
 * @property {'passed'|'failed'|'skipped'|'todo'} status - Test status
 * @property {number} duration - Test duration in milliseconds
 * @property {Assertion[]} assertions - Test assertions
 * @property {TestError[]} errors - Test errors
 * @property {LogEntry[]} logs - Test logs
 */

/**
 * @typedef {Object} Assertion
 * @property {string} testId - Parent test ID
 * @property {Date} timestamp - Assertion timestamp
 * @property {'expect'|'custom'} type - Assertion type
 * @property {string} matcher - Matcher used
 * @property {boolean} passed - Whether assertion passed
 * @property {*} actual - Actual value
 * @property {*} expected - Expected value
 * @property {string} message - Assertion message
 * @property {Object[]} stackTrace - Stack trace frames
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} sessionId - Parent session ID
 * @property {string} testId - Parent test ID (optional)
 * @property {Date} timestamp - Log timestamp
 * @property {'log'|'warn'|'error'|'debug'|'info'} level - Log level
 * @property {string} message - Log message
 * @property {'test'|'system'|'jest'} source - Log source
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} TestError
 * @property {string} testId - Parent test ID
 * @property {Date} timestamp - Error timestamp
 * @property {'assertion'|'runtime'|'timeout'|'setup'|'teardown'} type - Error type
 * @property {string} message - Error message
 * @property {Object[]} stackTrace - Stack trace frames
 * @property {Object} location - File location
 * @property {string} suggestion - Suggested fix
 */

/**
 * @typedef {Object} JestAgentWrapperConfig
 * @property {'sqlite'|'json'|'memory'} storage - Storage type
 * @property {string} dbPath - Database file path
 * @property {string} jsonPath - JSON file path
 * @property {boolean} collectConsole - Whether to collect console output
 * @property {boolean} collectCoverage - Whether to collect coverage data
 * @property {boolean} collectPerformance - Whether to collect performance data
 * @property {boolean} collectStackTraces - Whether to collect stack traces
 * @property {boolean} realTimeEvents - Whether to emit real-time events
 * @property {number} eventBufferSize - Event buffer size
 * @property {string[]} indexFields - Fields to index for queries
 * @property {number} retentionDays - Data retention period in days
 * @property {boolean} enableSuggestions - Whether to enable error suggestions
 * @property {boolean} enablePatternRecognition - Whether to enable pattern recognition
 * @property {boolean} enableTrendAnalysis - Whether to enable trend analysis
 */

// Constants
export const TEST_STATUSES = {
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  TODO: 'todo'
};

export const SESSION_STATUSES = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const SUITE_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

export const LOG_LEVELS = {
  LOG: 'log',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
  INFO: 'info'
};

export const LOG_SOURCES = {
  TEST: 'test',
  SYSTEM: 'system',
  JEST: 'jest'
};

export const ERROR_TYPES = {
  ASSERTION: 'assertion',
  RUNTIME: 'runtime',
  TIMEOUT: 'timeout',
  SETUP: 'setup',
  TEARDOWN: 'teardown'
};

export const ASSERTION_TYPES = {
  EXPECT: 'expect',
  CUSTOM: 'custom'
};
