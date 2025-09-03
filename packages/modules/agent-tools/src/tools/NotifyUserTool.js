/**
 * NotifyUserTool - Show notifications, progress updates, or user queries
 * 
 * Agent tool that displays various types of user notifications through the UI system.
 * Supports info messages, progress indicators, error notifications, and user queries.
 */

export class NotifyUserTool {
  constructor() {
    this.name = 'notify_user';
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
   * Execute notify user tool
   * @param {Object} context - Agent execution context (ALWAYS FIRST)
   * @param {string} message - Message to display
   * @param {string} type - Notification type
   * @param {number} duration - Display duration
   * @returns {Object} Notification information
   */
  async execute(context, message, type = 'info', duration = 3000) {
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