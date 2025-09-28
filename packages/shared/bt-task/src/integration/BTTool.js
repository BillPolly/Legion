/**
 * BTTool - Exposes behavior tree execution as a tool
 */

import { BTExecutor } from '../core/BTExecutor.js';

/**
 * Tool wrapper for behavior tree execution
 */
export class BTTool {
  constructor(toolRegistry, config = {}) {
    this.toolRegistry = toolRegistry;
    this.executor = new BTExecutor(toolRegistry);
    this.config = {
      name: config.name || 'behavior_tree',
      description: config.description || 'Execute a behavior tree configuration'
    };
  }
  
  /**
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.config.name,
      description: this.config.description,
      inputSchema: {
        type: 'object',
        properties: {
          treeConfig: {
            oneOf: [
              {
                type: 'object',
                description: 'Behavior tree configuration object'
              },
              {
                type: 'string',
                description: 'JSON string of behavior tree configuration'
              }
            ]
          },
          context: {
            type: 'object',
            description: 'Execution context with artifacts',
            properties: {
              artifacts: {
                type: 'object',
                description: 'Artifacts available to the tree'
              },
              workspaceDir: {
                type: 'string',
                description: 'Working directory path'
              }
            }
          }
        },
        required: ['treeConfig']
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether execution succeeded'
          },
          status: {
            type: 'string',
            enum: ['SUCCESS', 'FAILURE', 'RUNNING'],
            description: 'BT execution status'
          },
          data: {
            type: 'object',
            description: 'Execution result data'
          },
          error: {
            type: 'string',
            description: 'Error message if failed'
          },
          context: {
            type: 'object',
            description: 'Final execution context'
          }
        }
      }
    };
  }
  
  /**
   * Execute behavior tree as a tool
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(params) {
    try {
      // Validate required parameters
      if (!params.treeConfig) {
        return {
          success: false,
          status: 'FAILURE',
          error: 'Missing required parameter: treeConfig'
        };
      }
      
      // Parse tree config if it's a JSON string
      let treeConfig = params.treeConfig;
      if (typeof treeConfig === 'string') {
        try {
          treeConfig = JSON.parse(treeConfig);
        } catch (error) {
          return {
            success: false,
            status: 'FAILURE',
            error: `Invalid JSON configuration: ${error.message}`
          };
        }
      }
      
      // Prepare context
      const context = params.context || {};
      if (!context.artifacts) {
        context.artifacts = {};
      }
      
      // Execute the behavior tree
      const result = await this.executor.executeTree(treeConfig, context);
      
      // Map BT result to tool format
      return {
        success: result.status === 'SUCCESS',
        status: result.status,
        data: {
          nodeResults: result.nodeResults || {},
          executionTime: result.executionTime,
          ...(result.data || {})
        },
        context: result.context,
        error: result.error
      };
      
    } catch (error) {
      // Handle any execution errors
      return {
        success: false,
        status: 'FAILURE',
        error: error.message,
        data: {}
      };
    }
  }
}

export default BTTool;