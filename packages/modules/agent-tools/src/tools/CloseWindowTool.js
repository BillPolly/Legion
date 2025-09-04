/**
 * CloseWindowTool - Close floating windows programmatically
 * 
 * Agent tool that closes floating windows by window ID, cleaning up
 * associated resources and handles.
 */

import { Tool } from '@legion/tools-registry';

export class CloseWindowTool extends Tool {
  constructor() {
    super({
      name: 'close_window',
      description: 'Close floating windows programmatically by window ID',
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'object',
            description: 'Agent execution context'
          },
          windowId: {
            type: 'string',
            description: 'Window identifier to close'
          }
        },
        required: ['context', 'windowId']
      },
      outputSchema: {
        type: 'object',
        properties: {
          windowId: {
            type: 'string',
            description: 'Window ID that was closed'
          },
          closed: {
            type: 'boolean',
            description: 'Whether window was successfully closed'
          }
        },
        required: ['windowId', 'closed']
      }
    });
    
    this.category = 'ui';
  }
  
  /**
   * Execute close window tool
   * @param {Object} params - Parameters containing context and windowId
   * @returns {Object} Close operation result
   */
  async _execute(params) {
    const { context, windowId } = params;
    // Validate context (fail fast)
    if (!context) {
      throw new Error('Context is required as first parameter');
    }
    
    if (!context.resourceService) {
      throw new Error('resourceService not available in context');
    }
    
    // Validate window ID (fail fast)
    if (!windowId) {
      throw new Error('Window ID is required');
    }
    
    if (typeof windowId !== 'string' || windowId.trim() === '') {
      throw new Error('Window ID cannot be empty');
    }
    
    console.log(`CloseWindowTool: Closing window ${windowId}`);
    
    try {
      // Use context.resourceService to close the window
      const result = await context.resourceService.closeWindow(windowId);
      
      // Return close information for agent planning
      return {
        windowId: windowId,
        closed: result.closed || true
      };
      
    } catch (error) {
      console.error('CloseWindowTool failed:', error);
      throw error; // NO FALLBACKS - fail fast
    }
  }
}