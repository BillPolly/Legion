/**
 * DisplayResourceTool - Display resource handles in appropriate floating window viewers
 * 
 * Agent tool that takes resource handles and creates floating windows with appropriate
 * viewers (CodeEditor, ImageViewer, etc.) using the transparent resource handle system.
 */

import { Tool } from '@legion/tools-registry';
import path from 'path';

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
            type: ['object', 'string'],
            description: 'Resource handle object with path property OR file path string'
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
    
    if (!context.resourceActor) {
      throw new Error('resourceActor not available in context');
    }
    
    // Validate resource handle or path (fail fast)
    if (!resourceHandle) {
      throw new Error('Resource handle or path is required');
    }
    
    let resourcePath;
    
    // Handle both resource handle objects and plain file paths
    if (typeof resourceHandle === 'string') {
      // It's a file path string
      resourcePath = resourceHandle;
      console.log(`DisplayResourceTool: Displaying file path ${resourcePath}`);
    } else if (resourceHandle && resourceHandle.path) {
      // It's a resource handle object (with or without __isResourceHandle marker)
      resourcePath = resourceHandle.path;
      console.log(`DisplayResourceTool: Displaying resource handle ${resourcePath}`);
    } else {
      throw new Error('Resource handle must be a file path string or object with path property');
    }
    
    try {
      
      // Determine resource type (same logic as /show command)
      const resourceType = this._detectResourceType(resourcePath);
      
      // Use EXACT same pattern as /show command - call resourceActor directly
      await context.resourceActor.receive('resource:request', {
        path: resourcePath,
        type: resourceType
      });
      
      // Return window information for agent planning
      return {
        windowId: resourcePath, // Use path as window identifier
        viewerType: resourceType,
        resourcePath: resourcePath
      };
      
    } catch (error) {
      console.error('DisplayResourceTool failed:', error);
      throw error; // NO FALLBACKS - fail fast
    }
  }
  
  /**
   * Detect resource type from path (same logic as SlashCommandAgent.handleShow)
   * @param {string} resourcePath - Path to the resource
   * @returns {string} Resource type: 'file', 'image', or 'directory'
   * @private
   */
  _detectResourceType(resourcePath) {
    // Check if it's a directory (no extension or ends with /)
    if (resourcePath === '/' || resourcePath.endsWith('/') || !path.extname(resourcePath)) {
      return 'directory';
    }
    
    // Check if it's an image file
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const extension = path.extname(resourcePath).toLowerCase();
    
    if (imageExtensions.includes(extension)) {
      return 'image';
    }
    
    // Default to file
    return 'file';
  }
}