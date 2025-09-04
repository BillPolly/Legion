/**
 * NotifyUserTool - Show notifications, progress updates, or user queries
 * 
 * Agent tool that displays various types of user notifications through the UI system.
 * Supports info messages, progress indicators, error notifications, and user queries.
 */

import { Tool } from '@legion/tools-registry';

export class NotifyUserTool extends Tool {
  constructor() {
    super({
      name: 'notify_user',
      description: 'Show notifications, progress updates, or user queries to the user',
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'object',
            description: 'Agent execution context'
          },
          message: {
            type: 'string',
            description: 'Text message to display to user'
          },
          type: {
            type: 'string',
            description: 'Notification type: info, success, error, progress, query',
            default: 'info'
          },
          duration: {
            type: 'number',
            description: 'Display duration in milliseconds (0 = persistent)',
            default: 3000
          }
        },
        required: ['context', 'message']
      },
      outputSchema: {
        type: 'object',
        properties: {
          notificationId: {
            type: 'string',
            description: 'ID of the notification'
          },
          type: {
            type: 'string',
            description: 'Type of notification shown'
          },
          message: {
            type: 'string',
            description: 'Message that was displayed'
          }
        },
        required: ['notificationId', 'type', 'message']
      }
    });
    
    this.category = 'ui';
  }
  
  /**
   * Execute notify user tool
   * @param {Object} params - Parameters containing context, message, type, duration
   * @returns {Object} Notification information
   */
  async _execute(params) {
    const { context, message, type = 'info', duration = 3000 } = params;
    // Validate context (fail fast)
    if (!context) {
      throw new Error('Context is required as first parameter');
    }
    
    if (!context.resourceService) {
      throw new Error('resourceService not available in context');
    }
    
    // Validate message (fail fast)
    if (!message) {
      throw new Error('Message is required');
    }
    
    if (typeof message !== 'string' || message.trim() === '') {
      throw new Error('Message cannot be empty');
    }
    
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
}