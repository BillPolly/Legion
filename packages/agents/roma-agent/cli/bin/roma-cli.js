#!/usr/bin/env node

/**
 * ROMA CLI - Interactive Mode Entry Point
 * Provides a persistent REPL-style interface for ROMA agent interaction
 */

import { InteractivePrompt } from '../src/ui/InteractivePrompt.js';
import { ResourceManager } from '../../../../resource-manager/src/ResourceManager.js';
import chalk from 'chalk';

async function startInteractiveCLI() {
  console.log(chalk.blue.bold('\n🧠 ROMA CLI - Interactive Mode'));
  console.log(chalk.gray('Recursive Objective Management Agent\n'));
  
  try {
    // Initialize ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    
    // Create and start interactive prompt
    const prompt = new InteractivePrompt({ resourceManager });
    await prompt.start();
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start ROMA CLI:'), error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Goodbye!'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n👋 Goodbye!'));
  process.exit(0);
});

startInteractiveCLI().catch(console.error);