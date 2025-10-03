/**
 * ListCommand - List handles in the current context
 * Usage: /list
 */

import { BaseCommand } from './BaseCommand.js';

export class ListCommand extends BaseCommand {
  constructor(sessionActor, showme) {
    super(
      'list',
      'List handles in the current context',
      'list'
    );

    this.sessionActor = sessionActor;
    this.showme = showme;
  }

  /**
   * Execute the list command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} List result
   */
  async execute(args) {
    // Get handles from session context
    const sessionHandles = this.sessionActor.handles || [];

    // Format the output
    let output = '\nHandles in Context:\n';
    output += '='.repeat(60) + '\n';

    if (sessionHandles.length === 0) {
      output += '\nNo handles currently in context.\n';
      output += 'Use /show <handle> to load an asset.\n';
    } else {
      sessionHandles.forEach((handleInfo, index) => {
        output += `\n[${index + 1}] ${handleInfo.type.toUpperCase()}: ${handleInfo.title}\n`;
        output += `    Type: ${handleInfo.type}\n`;
        const date = new Date(handleInfo.timestamp);
        output += `    Loaded: ${date.toLocaleTimeString()}\n`;
      });

      output += `\nTotal: ${sessionHandles.length} handle(s)\n`;
    }

    output += '='.repeat(60) + '\n';

    return {
      success: true,
      message: output,
      handles: sessionHandles
    };
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/list - List handles in the current context

Usage:
  /list

Description:
  Shows all handles (assets, windows, resources) currently loaded
  in the session context. This includes all open ShowMe windows
  and their associated assets.

Examples:
  /list              List all handles in context
`;
  }
}

export default ListCommand;
