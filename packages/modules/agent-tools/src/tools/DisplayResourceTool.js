/**
 * DisplayResourceTool - Display resource handles in appropriate floating window viewers
 * 
 * Agent tool that takes resource handles and creates floating windows with appropriate
 * viewers (CodeEditor, ImageViewer, etc.) using the transparent resource handle system.
 */

export class DisplayResourceTool {
  constructor() {
    this.name = 'display_resource';
    this.description = 'Display any resource handle in appropriate viewer. Agent guidance: remember the windowId if you plan to update content multiple times.';
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
        name: 'resourceHandle',
        type: 'object', 
        required: true,
        description: 'Resource handle from previous tool operation'
      },
      {
        name: 'options',
        type: 'object',
        required: false,
        description: 'Display options: {viewerType, windowId}',
        default: {}
      }
    ];
  }
  
  /**
   * Execute display resource tool
   * @param {Object} context - Agent execution context (ALWAYS FIRST)
   * @param {Object} resourceHandle - Resource handle to display
   * @param {Object} options - Display options
   * @returns {Object} Window information for agent planning
   */
  async execute(context, resourceHandle, options = {}) {
    // Validate context (fail fast)
    if (!context) {
      throw new Error('Context is required as first parameter');
    }
    
    if (!context.resourceService) {
      throw new Error('resourceService not available in context');
    }
    
    // Validate resource handle (fail fast)
    if (!resourceHandle) {
      throw new Error('Resource handle is required');
    }
    
    if (!resourceHandle.path || !resourceHandle.__isResourceHandle) {
      throw new Error('Invalid resource handle - must have path and __isResourceHandle properties');
    }
    
    console.log(`DisplayResourceTool: Displaying resource ${resourceHandle.path}`);
    
    try {
      // Use context.resourceService to display the resource
      const result = await context.resourceService.displayResource(resourceHandle, options);
      
      // Return window information for agent planning
      return {
        windowId: result.windowId,
        viewerType: result.viewerType || 'auto',
        resourcePath: resourceHandle.path
      };
      
    } catch (error) {
      console.error('DisplayResourceTool failed:', error);
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