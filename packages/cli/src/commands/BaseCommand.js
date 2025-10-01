/**
 * BaseCommand - Base class for all CLI commands
 * Provides common interface and functionality
 */

export class BaseCommand {
  constructor(name, description, usage) {
    if (!name) {
      throw new Error('Command name is required');
    }
    if (!description) {
      throw new Error('Command description is required');
    }
    if (!usage) {
      throw new Error('Command usage is required');
    }

    this.name = name;
    this.description = description;
    this.usage = usage;
  }

  /**
   * Execute the command
   * Must be overridden by subclasses
   * @param {Array} args - Command arguments
   * @returns {Promise<any>} Command result
   */
  async execute(args) {
    throw new Error('Command execute() must be implemented');
  }

  /**
   * Get formatted help text for this command
   * @returns {string} Help text
   */
  getHelp() {
    return `/${this.name} - ${this.description}\nUsage: /${this.usage}`;
  }
}

export default BaseCommand;