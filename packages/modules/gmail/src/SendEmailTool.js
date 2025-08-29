/**
 * Gmail Send Email Tool - NEW metadata-driven architecture
 * Metadata comes from module.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for sending emails via Gmail SMTP
 * NEW: Pure logic implementation - metadata comes from module.json
 */
export default class SendEmailTool extends Tool {
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
      throw new Error('Gmail module not provided to SendEmailTool');
    }

    const { to, subject, body, options = {} } = params;
    
    this.progress(`Sending email to ${to}`, 50, {
      recipient: to,
      subject: subject.substring(0, 50) + (subject.length > 50 ? '...' : '')
    });

    const result = await this.gmailModule.sendMessage(to, subject, body, options);
    
    this.info('Email sent successfully', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    });

    return {
      messageId: result.messageId,
      accepted: result.accepted || [],
      rejected: result.rejected || []
    };
  }
}