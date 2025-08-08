/**
 * ToolExecutionNode - Executes tools with parameter validation and error handling
 * 
 * Handles individual tool execution within BT workflows, providing
 * parameter resolution, error handling, and result processing.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ToolExecutionNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'tool_execution';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.toolName = config.tool || config.toolName;
    this.parameters = config.parameters || config.params || {};
    this.allowParameterResolution = config.allowParameterResolution !== false;
    this.validateInput = config.validateInput !== false;
    this.processOutput = config.processOutput !== false;
  }

  async executeNode(context) {
    try {
      // Determine which tool to execute - resolve templates first
      let toolName = this.toolName || context.toolName || context.message?.tool;
      if (!toolName) {
        return this.createFailureResult('No tool name specified');
      }
      
      // Resolve template placeholders in tool name
      if (typeof toolName === 'string' && toolName.includes('{{') && toolName.includes('}}')) {
        toolName = this.substitutePlaceholders(toolName, context);
      }
      
      // Get tool arguments
      const toolArgs = this.getToolArguments(context);
      
      // Execute the tool
      const result = await this.executeTool(toolName, toolArgs, context);
      
      // Process the result
      return await this.processToolResult(result, toolName, toolArgs, context);
      
    } catch (error) {
      return this.createFailureResult(`Tool execution failed: ${error.message}`, error);
    }
  }
  
  /**
   * Get tool arguments from config and context
   */
  getToolArguments(context) {
    let args = { ...this.parameters };
    
    // Add arguments from context
    if (context.message?.arguments) {
      args = { ...args, ...context.message.arguments };
    }
    
    // Add arguments from tool request
    if (context.toolArguments) {
      args = { ...args, ...context.toolArguments };
    }
    
    // Resolve parameters if enabled
    if (this.allowParameterResolution) {
      args = this.resolveParameters(args, context);
    }
    
    return args;
  }
  
  /**
   * Resolve parameters with context substitution and artifact labels
   */
  resolveParameters(params, context) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    
    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Handle artifact labels (@label)
        if (value.startsWith('@') && context.artifactManager) {
          const artifact = context.artifactManager.getArtifactByLabel(value);
          if (artifact) {
            if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
              resolved[key] = artifact.path || artifact.content;
            } else if (key.toLowerCase().includes('content')) {
              resolved[key] = artifact.content || '';
            } else {
              resolved[key] = artifact.path || artifact.content || value;
            }
          } else {
            console.warn(`ToolExecutionNode: Artifact label ${value} not found`);
            resolved[key] = value;
          }
        }
        // Handle context variable substitution ({{variable}})
        else if (value.includes('{{') && value.includes('}}')) {
          resolved[key] = this.substitutePlaceholders(value, context);
        } else {
          resolved[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParameters(value, context);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }
  
  /**
   * Execute the tool
   */
  async executeTool(toolName, args, context) {
    // Special handling for built-in tools
    if (toolName === 'handle_complex_task') {
      return this.handleComplexTask(args, context);
    }
    
    // Execute through module loader
    if (context.moduleLoader) {
      // Check if tool exists using ModuleLoader's tools Map
      if (context.moduleLoader.tools && !context.moduleLoader.tools.has(toolName)) {
        return {
          success: false,
          error: `Tool '${toolName}' not found`,
          availableTools: await this.getAvailableToolNames(context)
        };
      }
      
      if (context.moduleLoader.executeTool) {
        return await context.moduleLoader.executeTool(toolName, args);
      }
    }
    
    // Try to execute through tool registry
    if (this.toolRegistry) {
      try {
        const tool = await this.toolRegistry.getTool(toolName);
        if (tool && tool.execute) {
          return await tool.execute(args);
        }
      } catch (error) {
        console.warn(`ToolExecutionNode: Tool registry execution failed:`, error);
      }
    }
    
    return {
      success: false,
      error: `Tool '${toolName}' not found or not executable`
    };
  }
  
  /**
   * Handle complex task delegation
   */
  async handleComplexTask(args, context) {
    // Delegate to task orchestrator if available
    if (context.taskOrchestrator) {
      try {
        await context.taskOrchestrator.receive({
          type: 'start_task',
          description: args.task_description,
          agentContext: context
        });
        
        return {
          success: true,
          message: 'Task delegated to complex task handler',
          taskDescription: args.task_description
        };
      } catch (error) {
        return {
          success: false,
          error: `Task orchestrator failed: ${error.message}`
        };
      }
    }
    
    return {
      success: false,
      error: 'Complex task handler not available'
    };
  }
  
  /**
   * Process tool execution result
   */
  async processToolResult(result, toolName, args, context) {
    if (!this.processOutput) {
      // Return raw result
      return {
        status: result.success !== false ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
        data: { 
          toolResult: result,
          toolName: toolName,
          toolArgs: args
        }
      };
    }
    
    // Send tool execution events
    this.emitToolEvents(result, toolName, args, context);
    
    // Process artifacts if present
    await this.processArtifacts(result, toolName, context);
    
    // Filter large data for downstream processing
    const processedResult = this.filterLargeData(result, toolName);
    
    return {
      status: result.success !== false ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
      data: {
        toolResult: processedResult,
        originalSuccess: result.success,
        toolName: toolName,
        toolArgs: args,
        executionComplete: true
      }
    };
  }
  
  /**
   * Emit tool execution events
   */
  emitToolEvents(result, toolName, args, context) {
    if (!context.remoteActor) return;
    
    // Send execution complete event
    context.remoteActor.receive({
      type: 'tool_executed',
      toolName: toolName,
      success: result.success !== false,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString()
    });
    
    // Send tool result event
    context.remoteActor.receive({
      type: 'tool_result',
      toolName: toolName,
      result: result,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Process artifacts from tool result
   */
  async processArtifacts(result, toolName, context) {
    if (!result || !context.artifactActor) return;
    
    try {
      const artifactResult = await context.artifactActor.processToolResult({
        toolName: toolName,
        toolResult: result,
        context: {
          userMessage: context.message?.content
        }
      });
      
      if (artifactResult.success && artifactResult.artifacts.length > 0) {
        console.log(`ToolExecutionNode: Processed ${artifactResult.artifacts.length} artifacts from ${toolName}`);
        
        // Emit artifact detection event
        if (context.remoteActor) {
          context.remoteActor.receive({
            type: 'artifacts_detected',
            toolName: toolName,
            artifacts: artifactResult.artifacts,
            sessionId: context.sessionId,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.warn(`ToolExecutionNode: Artifact processing failed for ${toolName}:`, error);
    }
  }
  
  /**
   * Filter large data from results
   */
  filterLargeData(result, toolName) {
    if (!result) return result;
    
    // Handle image generation results
    if (toolName === 'generate_image' && result.imageData) {
      return {
        success: result.success,
        filename: result.filename,
        filePath: result.filePath,
        metadata: result.metadata,
        message: `Image generated successfully and saved as ${result.filename}`,
        imageSizeKB: Math.round(result.imageData.length / 1024)
      };
    }
    
    // Generic large data filtering
    if (result.imageData || result.data) {
      const { imageData, data, ...sanitized } = result;
      return {
        ...sanitized,
        dataOmitted: true,
        dataType: imageData ? 'image' : 'binary',
        dataSizeKB: (imageData || data) ? Math.round((imageData || data).length / 1024) : 0
      };
    }
    
    return result;
  }
  
  /**
   * Get available tool names
   */
  async getAvailableToolNames(context) {
    const toolNames = [];
    
    if (context.moduleLoader && context.moduleLoader.tools) {
      toolNames.push(...Array.from(context.moduleLoader.tools.keys()));
    }
    
    return toolNames;
  }
  
  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        error: message,
        stackTrace: error?.stack,
        toolExecutionFailed: true
      }
    };
  }
  
  /**
   * Validate tool input parameters
   */
  validateToolInput(toolName, args, context) {
    // Basic validation - in production would use schema validation
    if (!toolName) {
      throw new Error('Tool name is required');
    }
    
    if (args && typeof args !== 'object') {
      throw new Error('Tool arguments must be an object');
    }
    
    return true;
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'tool_execution',
      toolName: this.toolName,
      allowParameterResolution: this.allowParameterResolution,
      validateInput: this.validateInput,
      processOutput: this.processOutput,
      executesAtomicTool: true
    };
  }
}