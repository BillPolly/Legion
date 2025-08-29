/**
 * Gmail Test Connection Tool - NEW metadata-driven architecture
 * Metadata comes from module.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for testing Gmail SMTP connection
 * NEW: Pure logic implementation - metadata comes from module.json
 */
export default class TestConnectionTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
    this.gmailModule = null;
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    if (!this.gmailModule) {
      throw new Error('Gmail module not provided to TestConnectionTool');
    }

    this.progress('Testing Gmail SMTP connection', 50);

    const result = await this.gmailModule.testConnection();
    
    if (result.success) {
      this.info('Gmail connection test successful');
    } else {
      this.warning('Gmail connection test failed', { 
        message: result.message 
      });
    }

    return {
      success: result.success,
      message: result.message
    };
  }
}