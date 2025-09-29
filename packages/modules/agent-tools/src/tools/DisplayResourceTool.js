/**
 * DisplayResourceTool - Display resource handles in appropriate floating window viewers
 * 
 * Agent tool that takes resource handles and creates floating windows with appropriate
 * viewers (CodeEditor, ImageViewer, etc.) using the transparent resource handle system.
 */

import { Tool } from '@legion/tools-registry';

export class DisplayResourceTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
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
   * Pure business logic - base Tool class handles validation using metadata
   * @param {Object} params - Tool parameters from metadata schema
   * @returns {Object} Window information for agent planning
   */
  async _execute(params) {
    const { context, resourceHandle, options = {} } = params;
    
    console.log(`DisplayResourceTool: Displaying resource ${resourceHandle.path}`);
    
    try {
      // Use EXACTLY the same code path as /show command
      if (!context.resourceActor) {
        throw new Error('resourceActor not available in context - cannot display resource');
      }
      
      const resourceType = this._detectResourceType(resourceHandle);
      console.log(`DisplayResourceTool: Using context.resourceActor.receive (same as /show command)`);
      
      // IDENTICAL to /show command: trigger resource creation flow
      await context.resourceActor.receive('resource:request', {
        path: resourceHandle.path,
        type: resourceType
      });
      
      // Return immediate response (exactly like /show command)
      const fileName = resourceHandle.path.split('/').pop() || 'resource';
      const message = `📂 Opening ${fileName} in ${resourceType} viewer...`;
      
      return {
        windowId: `agent-${Date.now()}`, // Generated ID for agent planning
        viewerType: resourceType,
        resourcePath: resourceHandle.path,
        message: message
      };
      
    } catch (error) {
      console.error('DisplayResourceTool failed:', error);
      throw error; // NO FALLBACKS - fail fast
    }
  }
  
  /**
   * Detect resource type from handle (same logic as /show)
   * @private
   */
  _detectResourceType(resourceHandle) {
    if (resourceHandle.__resourceType === 'ImageHandle') return 'image';
    if (resourceHandle.__resourceType === 'DirectoryHandle') return 'directory';
    return 'file';
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