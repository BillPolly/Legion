/**
 * DisplayResourceTool - Display resource handles in appropriate floating window viewers
 * 
 * Agent tool that takes resource handles and creates floating windows with appropriate
 * viewers (CodeEditor, ImageViewer, etc.) using the transparent resource handle system.
 */

import { Tool } from '@legion/tools-registry';

export class DisplayResourceTool extends Tool {
  constructor() {
    super({
      name: 'display_resource',
      description: 'Display any resource handle in appropriate viewer. Agent guidance: remember the windowId if you plan to update content multiple times.',
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'object',
            description: 'Agent execution context'
          },
          resourceHandle: {
            type: 'object',
            description: 'Resource handle from previous tool operation'
          },
          options: {
            type: 'object',
            description: 'Display options: {viewerType, windowId}',
            default: {}
          }
        },
        required: ['context', 'resourceHandle']
      },
      outputSchema: {
        type: 'object',
        properties: {
          windowId: {
            type: 'string',
            description: 'ID of the display window'
          },
          viewerType: {
            type: 'string',
            description: 'Type of viewer used'
          },
          resourcePath: {
            type: 'string',
            description: 'Path of the displayed resource'
          }
        },
        required: ['windowId', 'viewerType', 'resourcePath']
      }
    });
    
    this.category = 'ui';
  }
  
  /**
   * Execute display resource tool
   * @param {Object} params - Parameters containing context, resourceHandle, options
   * @returns {Object} Window information for agent planning
   */
  async _execute(params) {
    const { context, resourceHandle, options = {} } = params;
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
}