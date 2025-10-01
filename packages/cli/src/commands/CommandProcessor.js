/**
 * CommandProcessor - Command registration, parsing, and routing
 * Handles slash commands and routes to registered command handlers
 */

export class CommandProcessor {
  constructor() {
    this.commands = new Map();
  }

  /**
   * Register a command
   * @param {BaseCommand} command - Command to register
   */
  register(command) {
    if (!command.name) {
      throw new Error('Command must have a name');
    }

    if (this.commands.has(command.name)) {
      throw new Error(`Command ${command.name} already registered`);
    }

    this.commands.set(command.name, command);
  }

  /**
   * Parse command string into command and args
   * @param {string} input - Raw command input
   * @returns {Object} Parsed command { command, args, raw }
   */
  parse(input) {
    if (!input || input.trim().length === 0) {
      throw new Error('Command cannot be empty');
    }

    const trimmed = input.trim();

    // Remove leading slash if present
    const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

    // Split into parts
    const parts = withoutSlash.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return {
      command,
      args,
      raw: input
    };
  }

  /**
   * Execute a command
   * @param {string} input - Raw command input
   * @returns {Promise<any>} Command result
   */
  async execute(input) {
    const parsed = this.parse(input);
    const command = this.commands.get(parsed.command);

    if (!command) {
      throw new Error(`Unknown command: ${parsed.command}`);
    }

    return await command.execute(parsed.args);
  }

  /**
   * Get command by name
   * @param {string} name - Command name
   * @returns {BaseCommand|null} Command or null if not found
   */
  getCommand(name) {
    return this.commands.get(name) || null;
  }

  /**
   * Get all command names
   * @returns {Array<string>} Array of command names
   */
  getCommandNames() {
    return Array.from(this.commands.keys());
  }

  /**
   * Get all commands
   * @returns {Array<BaseCommand>} Array of commands
   */
  getCommands() {
    return Array.from(this.commands.values());
  }
}

export default CommandProcessor;