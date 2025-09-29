/**
 * CloseWindowTool - Close floating windows programmatically
 * 
 * Agent tool that closes floating windows by window ID, cleaning up
 * associated resources and handles.
 */

import { Tool } from '@legion/tools-registry';

export class CloseWindowTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.description = 'Close floating windows programmatically by window ID';
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
        name: 'windowId',
        type: 'string',
        required: true,
        description: 'Window identifier to close'
      }
    ];
  }
  
  /**
   * Pure business logic - base Tool class handles validation using metadata
   * @param {Object} params - Tool parameters from metadata schema
   * @returns {Object} Close operation result
   */
  async _execute(params) {
    const { context, windowId } = params;
    
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