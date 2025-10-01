/**
 * WindowsCommand - Manage ShowMe windows
 * Usage: /windows [list|close <id>|closeall]
 */

import { BaseCommand } from './BaseCommand.js';

export class WindowsCommand extends BaseCommand {
  constructor(showme, outputHandler) {
    super(
      'windows',
      'Manage ShowMe browser windows',
      'windows [list|close <id>|closeall]'
    );

    this.showme = showme;
    this.outputHandler = outputHandler;
  }

  /**
   * Execute the windows command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async execute(args) {
    const action = args && args.length > 0 ? args[0] : 'list';

    switch (action) {
      case 'list':
        return this.listWindows();

      case 'close':
        if (!args[1]) {
          throw new Error('Window ID required. Usage: /windows close <id>');
        }
        return await this.closeWindow(args[1]);

      case 'closeall':
        return await this.closeAllWindows();

      default:
        throw new Error(`Unknown action: ${action}. Use list, close, or closeall`);
    }
  }

  /**
   * List all open windows
   * @returns {Object} List result
   */
  listWindows() {
    const windows = this.showme.getWindows();

    if (windows.length === 0) {
      return {
        success: true,
        message: 'No open windows'
      };
    }

    this.outputHandler.heading('Open Windows');

    const data = windows.map(window => ({
      ID: window.id,
      Title: window.title || 'Untitled',
      Status: window.isOpen ? 'Open' : 'Closed',
      Width: window.width,
      Height: window.height
    }));

    const table = this.outputHandler.formatTable(data);
    this.outputHandler.print(table);

    return {
      success: true,
      message: `${windows.length} window(s) open`,
      windows: windows
    };
  }

  /**
   * Close a specific window
   * @param {string} windowId - Window ID to close
   * @returns {Promise<Object>} Close result
   */
  async closeWindow(windowId) {
    const windows = this.showme.getWindows();
    const window = windows.find(w => w.id === windowId);

    if (!window) {
      throw new Error(`Window not found: ${windowId}`);
    }

    await window.close();

    return {
      success: true,
      message: `Closed window ${windowId}`
    };
  }

  /**
   * Close all windows
   * @returns {Promise<Object>} Close result
   */
  async closeAllWindows() {
    const windows = this.showme.getWindows();

    if (windows.length === 0) {
      return {
        success: true,
        message: 'No windows to close'
      };
    }

    const count = windows.length;

    // Close all windows
    await Promise.all(
      windows.map(window => window.close())
    );

    return {
      success: true,
      message: `Closed ${count} window(s)`
    };
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/windows - Manage ShowMe browser windows

Usage:
  /windows [action] [args]

Actions:
  list           List all open windows (default)
  close <id>     Close a specific window
  closeall       Close all open windows

Examples:
  /windows                        List all open windows
  /windows list                   List all open windows
  /windows close window-1-123     Close window with ID
  /windows closeall               Close all open windows
`;
  }
}

export default WindowsCommand;
