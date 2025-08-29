/**
 * Gmail Send HTML Email Tool - NEW metadata-driven architecture
 * Metadata comes from module.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for sending HTML emails via Gmail SMTP
 * NEW: Pure logic implementation - metadata comes from module.json
 */
export default class SendHtmlEmailTool extends Tool {
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
      throw new Error('Gmail module not provided to SendHtmlEmailTool');
    }

    const { to, subject, htmlBody, options = {} } = params;
    
    this.progress(`Sending HTML email to ${to}`, 50, {
      recipient: to,
      subject: subject.substring(0, 50) + (subject.length > 50 ? '...' : ''),
      isHtml: true
    });

    const result = await this.gmailModule.sendHtmlMessage(to, subject, htmlBody, options);
    
    this.info('HTML email sent successfully', {
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