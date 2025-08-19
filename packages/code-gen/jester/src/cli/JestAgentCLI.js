/**
 * Command-line interface for the Jest Agent Wrapper
 */

import { JestAgentWrapper } from '../core/JestAgentWrapper.js';

export class JestAgentCLI {
  constructor() {
    this.jaw = null;
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args) {
    const parsed = {
      command: args[0] || 'run',
      pattern: '',
      options: {}
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        parsed.options[key] = value || true;
      } else if (!parsed.pattern) {
        parsed.pattern = arg;
      }
    }

    return parsed;
  }

  /**
   * Run the CLI
   */
  async run(args = process.argv.slice(2)) {
    const { command, pattern, options } = this.parseArgs(args);

    try {
      switch (command) {
        case 'run':
          await this.runTests(pattern, options);
          break;
        case 'query':
          await this.queryTests(options);
          break;
        case 'summary':
          await this.showSummary(options);
          break;
        case 'history':
          await this.showHistory(options);
          break;
        case 'list':
        case 'list-sessions':
          await this.listSessions(options);
          break;
        case 'compare':
          await this.compareSessions(options);
          break;
        case 'clear':
          await this.clearSessions(options);
          break;
        default:
          this.showHelp();
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run tests with JAW
   */
  async runTests(pattern, options) {
    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db',
      storage: options.storage || 'sqlite',
      testRunId: options['run-id'] || options.runId,
      clearPrevious: options['clear-previous'] || options.clearPrevious || false
    });

    console.log('🧪 Running tests with Jest Agent Wrapper...');
    
    if (options['run-id']) {
      console.log(`🏷️  Run ID: ${options['run-id']}`);
    }
    
    if (options['clear-previous']) {
      console.log('🧹 Clearing previous test data...');
    }
    
    const session = await this.jaw.runTests(pattern);
    console.log(`📊 Session ID: ${session.id}`);
    console.log(`⏰ Started at: ${session.startTime.toISOString()}`);
    
    await this.jaw.close();
  }

  /**
   * Query test results
   */
  async queryTests(options) {
    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db'
    });

    if (options.failed) {
      const failed = await this.jaw.getFailedTests();
      console.log(`❌ Found ${failed.length} failed tests:`);
      failed.forEach(test => {
        console.log(`  • ${test.fullName} (${test.duration}ms)`);
      });
    }

    if (options.errors) {
      const errors = await this.jaw.getMostCommonErrors(10);
      console.log('🐛 Most common errors:');
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.type}: ${error.message} (${error.count} times)`);
      });
    }

    if (options.slow) {
      const slow = await this.jaw.getSlowestTests(options.limit || 10);
      console.log('🐌 Slowest tests:');
      slow.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test.fullName} (${test.duration}ms)`);
      });
    }

    await this.jaw.close();
  }

  /**
   * Show test summary
   */
  async showSummary(options) {
    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db'
    });

    const summary = await this.jaw.getTestSummary(options.session);
    
    console.log('📈 Test Summary:');
    console.log(`  Total: ${summary.total}`);
    console.log(`  ✅ Passed: ${summary.passed}`);
    console.log(`  ❌ Failed: ${summary.failed}`);
    console.log(`  ⏭️  Skipped: ${summary.skipped}`);
    console.log(`  📋 Todo: ${summary.todo}`);

    await this.jaw.close();
  }

  /**
   * List all test sessions
   */
  async listSessions(options) {
    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db'
    });

    const sessions = await this.jaw.getAllSessions();
    
    if (sessions.length === 0) {
      console.log('📭 No test sessions found');
    } else {
      console.log(`📚 Found ${sessions.length} test sessions:\n`);
      
      sessions.forEach(session => {
        const metadata = session.metadata || {};
        const summary = session.summary || {};
        const name = metadata.name || metadata.testRunId || session.id;
        const status = session.status === 'completed' ? '✅' : '🔄';
        
        console.log(`${status} ${name}`);
        console.log(`   ID: ${session.id}`);
        console.log(`   Started: ${session.startTime.toLocaleString()}`);
        
        if (summary.total) {
          const passRate = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;
          console.log(`   Tests: ${summary.passed}/${summary.total} passed (${passRate}%)`);
        }
        
        if (metadata.description) {
          console.log(`   Description: ${metadata.description}`);
        }
        
        console.log('');
      });
    }
    
    await this.jaw.close();
  }

  /**
   * Compare multiple test sessions
   */
  async compareSessions(options) {
    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db'
    });

    const sessionIds = options.sessions ? options.sessions.split(',') : [];
    
    if (sessionIds.length < 2) {
      console.log('❌ Please provide at least 2 session IDs to compare (--sessions=id1,id2,id3)');
      await this.jaw.close();
      return;
    }

    const comparison = await this.jaw.compareSessions(sessionIds);
    
    console.log('📊 Session Comparison:\n');
    console.log('Session ID | Start Time | Total | Passed | Failed | Pass Rate | Avg Duration');
    console.log('-----------|------------|-------|--------|--------|-----------|-------------');
    
    comparison.forEach(session => {
      const stats = session.stats;
      const passRate = stats.passRate.toFixed(1);
      const avgDuration = stats.avgDuration.toFixed(0);
      const name = session.metadata.testRunId || session.sessionId.substring(0, 8);
      
      console.log(
        `${name.padEnd(10)} | ` +
        `${session.startTime.toLocaleDateString().padEnd(10)} | ` +
        `${stats.total.toString().padEnd(5)} | ` +
        `${stats.passed.toString().padEnd(6)} | ` +
        `${stats.failed.toString().padEnd(6)} | ` +
        `${passRate.padStart(8)}% | ` +
        `${avgDuration.padStart(10)}ms`
      );
    });
    
    await this.jaw.close();
  }

  /**
   * Show test history
   */
  async showHistory(options) {
    if (!options.test) {
      console.log('Please specify a test name with --test=<name>');
      return;
    }

    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db'
    });

    const history = await this.jaw.getTestHistory(options.test);
    
    console.log(`📚 History for test: ${options.test}`);
    console.log(`Found ${history.length} runs:`);
    
    history.forEach((test, i) => {
      const status = test.status === 'passed' ? '✅' : '❌';
      console.log(`  ${i + 1}. ${status} ${test.startTime.toISOString()} (${test.duration}ms)`);
    });

    await this.jaw.close();
  }

  /**
   * Clear sessions from database
   */
  async clearSessions(options) {
    this.jaw = new JestAgentWrapper({
      dbPath: options.output || './test-results.db'
    });

    if (options.session) {
      // Clear specific session
      await this.jaw.clearSession(options.session);
      console.log(`🗑️ Cleared session: ${options.session}`);
    } else if (options.all) {
      // Clear all sessions
      await this.jaw.clearAllSessions();
      console.log('🗑️ Cleared all test sessions');
    } else {
      console.log('Please specify --session=<id> to clear a specific session or --all to clear all sessions');
    }
    
    await this.jaw.close();
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(`
Jest Agent Wrapper CLI

Usage:
  jaw run [pattern] [options]        Run tests with JAW
  jaw query [options]                Query test results
  jaw summary [options]              Show test summary
  jaw history --test=<name>          Show test history
  jaw list [options]                 List all test sessions
  jaw compare --sessions=<ids>       Compare multiple sessions
  jaw clear [options]                Clear test data

Options:
  --output=<path>          Database path (default: ./test-results.db)
  --storage=<type>         Storage type (sqlite, json, memory)
  --run-id=<id>           Specify test run ID (for run command)
  --clear-previous        Clear previous data before running
  --failed                Show failed tests
  --errors                Show common errors  
  --slow                  Show slowest tests
  --limit=<n>             Limit number of results
  --session=<id>          Filter/clear specific session
  --sessions=<id1,id2>    Compare multiple sessions (comma-separated)
  --all                   Clear all sessions (for clear command)
  --test=<name>           Test name for history

Examples:
  jaw run src/**/*.test.js --run-id="sprint-15" --output results.db
  jaw run --clear-previous --run-id="fresh-start"
  jaw list --output results.db
  jaw compare --sessions="run1,run2,run3"
  jaw clear --session="old-run-id"
  jaw clear --all
  jaw query --failed --errors
  jaw summary --session abc123
  jaw history --test "should handle user login"
    `);
  }
}
