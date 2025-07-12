/**
 * InteractiveCommand - Entry point for interactive mode
 */

import chalk from 'chalk';
import readline from 'readline';

export class InteractiveCommand {
  constructor(interactiveMode) {
    this.interactiveMode = interactiveMode;
  }

  /**
   * Execute interactive command
   * @param {object} parsedArgs - Parsed command arguments
   * @param {object} config - Configuration
   */
  async execute(parsedArgs, config) {
    const useColor = config?.color !== false;
    
    // Show welcome message
    console.log();
    console.log(useColor ? chalk.bold.cyan('jsEnvoy Interactive Mode') : 'jsEnvoy Interactive Mode');
    console.log('Type "help" for commands, "exit" to quit');
    console.log();
    
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'jsenvoy> ',
      completer: this.interactiveMode.getCompleter(),
      terminal: false  // Prevents double character echo issue
    });
    
    // Start interactive mode
    await this.interactiveMode.start(rl, config);
  }
}

export default InteractiveCommand;