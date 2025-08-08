/**
 * ToolsListNode - Retrieves and manages tool listings
 * 
 * Provides access to available tools with filtering, categorization,
 * and metadata retrieval capabilities.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ToolsListNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'tools_list';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.includeMetadata = config.includeMetadata !== false;
    this.filterPattern = config.filterPattern || config.filter;
    this.category = config.category;
    this.sortBy = config.sortBy || 'name'; // name, category, module
    this.limit = config.limit || null;
  }

  async executeNode(context) {
    try {
      // Get module loader from context
      const moduleLoader = context.moduleLoader;
      if (!moduleLoader) {
        return this.createFailureResult('ModuleLoader not available in context');
      }

      // Get all available tools
      const tools = await this.getAllTools(moduleLoader, context);
      
      // Apply filtering
      const filteredTools = this.applyFilters(tools);
      
      // Apply sorting
      const sortedTools = this.applySorting(filteredTools);
      
      // Apply limit
      const limitedTools = this.applyLimit(sortedTools);

      // Store tools in context for next nodes to access
      context.tools = limitedTools;
      context.toolsList = limitedTools;
      
      return this.createSuccessResult({
        tools: limitedTools,
        totalCount: tools.length,
        filteredCount: filteredTools.length,
        returnedCount: limitedTools.length,
        filters: {
          pattern: this.filterPattern,
          category: this.category,
          sortBy: this.sortBy,
          limit: this.limit
        }
      });

    } catch (error) {
      return this.createFailureResult(`Tools listing failed: ${error.message}`, error);
    }
  }

  /**
   * Get all available tools from module loader
   */
  async getAllTools(moduleLoader, context) {
    const tools = [];
    
    try {
      // Get tools from module loader
      if (moduleLoader.getAllTools) {
        const moduleTools = await moduleLoader.getAllTools();
        tools.push(...moduleTools.map(tool => this.formatTool(tool)));
      }
      
      // Get tools from tool registry if available
      if (this.toolRegistry && this.toolRegistry.getAllTools) {
        const registryTools = await this.toolRegistry.getAllTools();
        registryTools.forEach(tool => {
          // Avoid duplicates
          if (!tools.some(t => t.name === tool.name)) {
            tools.push(this.formatTool(tool));
          }
        });
      }

      // Add built-in tools
      this.addBuiltinTools(tools);

    } catch (error) {
      console.warn('Error getting tools:', error.message);
    }

    return tools;
  }

  /**
   * Format tool information
   */
  formatTool(tool) {
    const formatted = {
      name: tool.name,
      description: tool.description || 'No description available'
    };

    if (this.includeMetadata) {
      formatted.metadata = {
        module: tool.module || tool.moduleName || 'unknown',
        category: tool.category || this.inferCategory(tool.name),
        inputSchema: tool.inputSchema || tool.parameters || null,
        outputSchema: tool.outputSchema || null,
        isMultiFunction: tool.isMultiFunction || false,
        functions: tool.functions || null
      };
    }

    return formatted;
  }

  /**
   * Add built-in tools that are always available
   */
  addBuiltinTools(tools) {
    const builtinTools = [
      {
        name: 'module_list',
        description: 'List available and loaded modules',
        module: 'builtin',
        category: 'system'
      },
      {
        name: 'module_load',
        description: 'Load a module to make its tools available',
        module: 'builtin', 
        category: 'system'
      },
      {
        name: 'module_unload',
        description: 'Unload a module and remove its tools',
        module: 'builtin',
        category: 'system'
      }
    ];

    builtinTools.forEach(tool => {
      if (!tools.some(t => t.name === tool.name)) {
        tools.push(this.formatTool(tool));
      }
    });
  }

  /**
   * Infer tool category from name
   */
  inferCategory(toolName) {
    if (toolName.includes('file') || toolName.includes('directory')) return 'filesystem';
    if (toolName.includes('module') || toolName.includes('load')) return 'system';
    if (toolName.includes('git') || toolName.includes('repo')) return 'version_control';
    if (toolName.includes('test') || toolName.includes('run')) return 'testing';
    if (toolName.includes('build') || toolName.includes('compile')) return 'build';
    if (toolName.includes('deploy') || toolName.includes('server')) return 'deployment';
    if (toolName.includes('artifact') || toolName.includes('generate')) return 'generation';
    return 'general';
  }

  /**
   * Apply filtering to tools list
   */
  applyFilters(tools) {
    let filtered = tools;

    // Apply pattern filter
    if (this.filterPattern) {
      const pattern = new RegExp(this.filterPattern, 'i');
      filtered = filtered.filter(tool => 
        pattern.test(tool.name) || 
        pattern.test(tool.description)
      );
    }

    // Apply category filter
    if (this.category) {
      filtered = filtered.filter(tool => 
        tool.metadata?.category === this.category
      );
    }

    return filtered;
  }

  /**
   * Apply sorting to tools list
   */
  applySorting(tools) {
    const sorted = [...tools];

    switch (this.sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
        
      case 'category':
        sorted.sort((a, b) => {
          const catA = a.metadata?.category || 'zzz';
          const catB = b.metadata?.category || 'zzz';
          return catA.localeCompare(catB) || a.name.localeCompare(b.name);
        });
        break;
        
      case 'module':
        sorted.sort((a, b) => {
          const modA = a.metadata?.module || 'zzz';
          const modB = b.metadata?.module || 'zzz';
          return modA.localeCompare(modB) || a.name.localeCompare(b.name);
        });
        break;
        
      default:
        // Keep original order
        break;
    }

    return sorted;
  }

  /**
   * Apply limit to tools list
   */
  applyLimit(tools) {
    if (this.limit && this.limit > 0) {
      return tools.slice(0, this.limit);
    }
    return tools;
  }

  /**
   * Create success result
   */
  createSuccessResult(data) {
    return {
      status: NodeStatus.SUCCESS,
      data: {
        toolsListing: true,
        ...data
      }
    };
  }

  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        toolsListing: false,
        error: message,
        details: error ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    };
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'tools_list',
      purpose: 'Tool discovery and listing',
      capabilities: [
        'tool_listing',
        'tool_filtering',
        'tool_categorization',
        'metadata_extraction'
      ]
    };
  }
}