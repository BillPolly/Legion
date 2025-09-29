/**
 * NotifyUserTool - Show notifications, progress updates, or user queries
 * 
 * Agent tool that displays various types of user notifications through the UI system.
 * Supports info messages, progress indicators, error notifications, and user queries.
 */

import { Tool } from '@legion/tools-registry';

export class NotifyUserTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.description = 'Show notifications, progress updates, or user queries to the user';
    this.category = 'ui';
    
    // Context-first parameter schema
    this.parameterSchema = [
      {
        name: 'context',
        type: 'object',
        required: true,
        description: 'Agent execution context'
      },
      {
        name: 'message',
        type: 'string',
        required: true,
        description: 'Text message to display to user'
      },
      {
        name: 'type',
        type: 'string',
        required: false,
        description: 'Notification type: info, success, error, progress, query',
        default: 'info'
      },
      {
        name: 'duration',
        type: 'number',
        required: false,
        description: 'Display duration in milliseconds (0 = persistent)',
        default: 3000
      }
    ];
  }
  
  /**
   * Pure business logic - base Tool class handles validation using metadata
   * @param {Object} params - Tool parameters from metadata schema
   * @returns {Object} Notification information
   */
  async _execute(params) {
    const { context, message, type = 'info', duration = 3000 } = params;
    
    console.log(`NotifyUserTool: Showing ${type} notification: ${message.substring(0, 50)}`);
    
    try {
      // Use context.resourceService to show notification
      const result = await context.resourceService.showNotification(message, type, duration);
      
      // Return notification information for agent planning
      return {
        notificationId: result.notificationId,
        type: type,
        message: message
      };
      
    } catch (error) {
      console.error('NotifyUserTool failed:', error);
      throw error; // NO FALLBACKS - fail fast
    }
  }
  
  /**
   * Get tool metadata for tool registry
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      parameters: this.parameterSchema
    };
  }
}