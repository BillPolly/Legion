/**
 * CloseWindowTool - Close floating windows programmatically
 * 
 * Agent tool that closes floating windows by window ID, cleaning up
 * associated resources and handles.
 */

export class CloseWindowTool {
  constructor() {
    this.name = 'close_window';
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
   * Execute close window tool
   * @param {Object} context - Agent execution context (ALWAYS FIRST)
   * @param {string} windowId - Window ID to close
   * @returns {Object} Close operation result
   */
  async execute(context, windowId) {
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