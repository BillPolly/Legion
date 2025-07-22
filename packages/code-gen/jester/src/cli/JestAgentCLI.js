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
      storage: options.storage || 'sqlite'
    });

    console.log('🧪 Running tests with Jest Agent Wrapper...');
    
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
   * Show help
   */
  showHelp() {
    console.log(`
Jest Agent Wrapper CLI

Usage:
  jaw run [pattern] [options]     Run tests with JAW
  jaw query [options]             Query test results
  jaw summary [options]           Show test summary
  jaw history --test=<name>       Show test history

Options:
  --output=<path>     Database output path (default: ./test-results.db)
  --storage=<type>    Storage type (sqlite, json, memory)
  --failed            Show failed tests
  --errors            Show common errors  
  --slow              Show slowest tests
  --limit=<n>         Limit number of results
  --session=<id>      Filter by session ID

Examples:
  jaw run src/**/*.test.js --output results.db
  jaw query --failed --errors
  jaw summary --session abc123
  jaw history --test "should handle user login"
    `);
  }
}
