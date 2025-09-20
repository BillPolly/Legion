#!/usr/bin/env node

/**
 * ROMA CLI - Discrete Commands Entry Point
 * Provides one-off command execution for scripting and automation
 */

import { Command } from 'commander';
import { ExecuteCommand } from '../src/commands/ExecuteCommand.js';
import { StatusCommand } from '../src/commands/StatusCommand.js';
import { HistoryCommand } from '../src/commands/HistoryCommand.js';
import { WatchCommand } from '../src/commands/WatchCommand.js';
import { ResourceManager } from '../../../../resource-manager/src/ResourceManager.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('roma')
  .description('ROMA Agent - Recursive Objective Management Agent CLI')
  .version('1.0.0');

// Execute command
program
  .command('execute <task>')
  .description('Execute a task using ROMA agent')
  .option('-t, --tool <tool>', 'Specify a specific tool to use')
  .option('-p, --params <params>', 'JSON parameters for the task')
  .option('-w, --watch', 'Watch execution progress in real-time')
  .option('-j, --json', 'Output results in JSON format')
  .option('--timeout <seconds>', 'Execution timeout in seconds', '300')
  .action(async (task, options) => {
    try {
      const resourceManager = await ResourceManager.getInstance();
      const executeCmd = new ExecuteCommand({ resourceManager });
      await executeCmd.run(task, options);
    } catch (error) {
      console.error(chalk.red('❌ Execute failed:'), error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show ROMA agent status')
  .option('-j, --json', 'Output status in JSON format')
  .option('-r, --refresh <seconds>', 'Auto-refresh interval in seconds')
  .action(async (options) => {
    try {
      const resourceManager = await ResourceManager.getInstance();
      const statusCmd = new StatusCommand({ resourceManager });
      await statusCmd.run(options);
    } catch (error) {
      console.error(chalk.red('❌ Status failed:'), error.message);
      process.exit(1);
    }
  });

// History command
program
  .command('history')
  .description('Show execution history')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .option('-j, --json', 'Output history in JSON format')
  .option('-f, --filter <status>', 'Filter by status (completed, failed, running)')
  .action(async (options) => {
    try {
      const resourceManager = await ResourceManager.getInstance();
      const historyCmd = new HistoryCommand({ resourceManager });
      await historyCmd.run(options);
    } catch (error) {
      console.error(chalk.red('❌ History failed:'), error.message);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch <executionId>')
  .description('Watch a specific execution in real-time')
  .option('-j, --json', 'Output progress in JSON format')
  .action(async (executionId, options) => {
    try {
      const resourceManager = await ResourceManager.getInstance();
      const watchCmd = new WatchCommand({ resourceManager });
      await watchCmd.run(executionId, options);
    } catch (error) {
      console.error(chalk.red('❌ Watch failed:'), error.message);
      process.exit(1);
    }
  });

// Server commands
const server = program
  .command('server')
  .description('ROMA server management commands');

server
  .command('start')
  .description('Start ROMA server')
  .option('-p, --port <port>', 'Server port', '4020')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting ROMA server...'));
    console.log(chalk.gray('Note: Use the main server script in the parent package'));
    console.log(chalk.yellow('Run: cd .. && node src/server/server.js'));
  });

server
  .command('stop')
  .description('Stop ROMA server')
  .action(async () => {
    console.log(chalk.yellow('🛑 Server stop command not implemented'));
    console.log(chalk.gray('Use Ctrl+C to stop the server process'));
  });

// Global error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error.code === 'commander.help' || error.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  console.error(chalk.red('❌ Command failed:'), error.message);
  process.exit(1);
}