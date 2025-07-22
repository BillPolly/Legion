/**
 * MetaTools - Tools for managing tools
 * 
 * Provides meta-tools for tool search, activation, suggestions, and working set management
 */

export class MetaTools {
  constructor(toolRegistry, workingSet, options = {}) {
    this.registry = toolRegistry;
    this.workingSet = workingSet;
    this.options = {
      maxSearchResults: options.maxSearchResults || 50,
      defaultSuggestionLimit: options.defaultSuggestionLimit || 5,
      ...options
    };

    this.tools = this._createMetaTools();
  }

  /**
   * Get all meta-tools
   */
  getMetaTools() {
    return this.tools;
  }

  /**
   * Create meta-tool definitions
   * @private
   */
  _createMetaTools() {
    return {
      tool_search: this._createToolSearchTool(),
      tool_activate: this._createToolActivateTool(),
      tool_deactivate: this._createToolDeactivateTool(),
      tool_suggest: this._createToolSuggestTool(),
      tool_list_active: this._createToolListActiveTool(),
      tool_info: this._createToolInfoTool()
    };
  }

  /**
   * Create tool search meta-tool
   * @private
   */
  _createToolSearchTool() {
    return {
      name: 'tool_search',
      description: 'Search available tools by various criteria',
      inputSchema: {
        type: 'object',
        properties: {
          namePattern: {
            type: 'string',
            description: 'Tool name pattern (supports wildcards like file-*)'
          },
          category: {
            type: 'string',
            description: 'Tool category to filter by'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to filter by'
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords to search in tool descriptions'
          },
          fuzzyQuery: {
            type: 'string',
            description: 'Fuzzy search query for tool names and descriptions'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results to return',
            default: 10
          }
        }
      },
      execute: async (params) => {
        try {
          const {
            namePattern,
            category,
            tags,
            keywords,
            fuzzyQuery,
            limit = 10
          } = params;

          let results = [];

          if (fuzzyQuery) {
            // Perform fuzzy search
            const fuzzyResults = this.registry.fuzzySearchTools(fuzzyQuery);
            results = fuzzyResults.map(r => ({
              ...r.tool,
              score: r.score,
              matchType: 'fuzzy'
            }));
          } else {
            // Build search criteria
            const criteria = {};
            if (namePattern) {
              criteria.namePattern = this._convertWildcardToRegex(namePattern);
            }
            if (category) criteria.category = category;
            if (tags) criteria.tags = tags;
            if (keywords) criteria.descriptionKeywords = keywords;

            // Perform criteria-based search
            const searchResults = this.registry.searchTools(criteria);
            results = searchResults.map(tool => ({
              ...tool,
              matchType: 'criteria'
            }));
          }

          // Apply limit
          results = results.slice(0, Math.min(limit, this.options.maxSearchResults));

          return {
            success: true,
            results,
            count: results.length,
            totalAvailable: this.registry.getToolCount()
          };

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create tool activation meta-tool
   * @private
   */
  _createToolActivateTool() {
    return {
      name: 'tool_activate',
      description: 'Activate tools in the working set',
      inputSchema: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'Name of single tool to activate'
          },
          toolNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of tool names to activate'
          },
          category: {
            type: 'string',
            description: 'Activate all tools in this category'
          },
          priority: {
            type: 'integer',
            description: 'Priority level for activated tools',
            default: 1
          }
        }
      },
      execute: async (params) => {
        try {
          const { toolName, toolNames, category, priority = 1 } = params;
          
          let toolsToActivate = [];
          
          if (toolName) {
            toolsToActivate = [toolName];
          } else if (toolNames) {
            toolsToActivate = toolNames;
          } else if (category) {
            const categoryTools = this.registry.getToolsByCategory(category);
            toolsToActivate = categoryTools.map(t => t.name);
          }

          const activated = [];
          const skipped = [];
          const errors = [];

          for (const name of toolsToActivate) {
            try {
              if (!this.registry.hasTool(name)) {
                errors.push(`Tool not found: ${name}`);
                continue;
              }

              if (this.workingSet.isActive(name)) {
                skipped.push(name);
                continue;
              }

              this.workingSet.activateTool(name, { priority });
              activated.push(name);

            } catch (error) {
              errors.push(`Failed to activate ${name}: ${error.message}`);
            }
          }

          const success = errors.length === 0;
          
          return {
            success,
            activated,
            skipped: skipped.length > 0 ? skipped : undefined,
            error: errors.length > 0 ? errors.join(', ') : undefined,
            errors: errors.length > 0 ? errors : undefined,
            activeCount: this.workingSet.getActiveToolCount()
          };

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create tool deactivation meta-tool
   * @private
   */
  _createToolDeactivateTool() {
    return {
      name: 'tool_deactivate',
      description: 'Deactivate tools from the working set',
      inputSchema: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'Name of single tool to deactivate'
          },
          toolNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of tool names to deactivate'
          },
          all: {
            type: 'boolean',
            description: 'Deactivate all active tools',
            default: false
          }
        }
      },
      execute: async (params) => {
        try {
          const { toolName, toolNames, all = false } = params;
          
          let toolsToDeactivate = [];
          
          if (all) {
            toolsToDeactivate = this.workingSet.getActiveTools();
          } else if (toolName) {
            toolsToDeactivate = [toolName];
          } else if (toolNames) {
            toolsToDeactivate = toolNames;
          }

          const deactivated = [];
          const skipped = [];

          for (const name of toolsToDeactivate) {
            if (this.workingSet.isActive(name)) {
              this.workingSet.deactivateTool(name);
              deactivated.push(name);
            } else {
              skipped.push(name);
            }
          }

          return {
            success: true,
            deactivated,
            skipped: skipped.length > 0 ? skipped : undefined,
            activeCount: this.workingSet.getActiveToolCount()
          };

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create tool suggestion meta-tool
   * @private
   */
  _createToolSuggestTool() {
    return {
      name: 'tool_suggest',
      description: 'Get tool suggestions based on context and usage patterns',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Suggest tools from specific category'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of suggestions',
            default: 5
          },
          includeActive: {
            type: 'boolean',
            description: 'Include currently active tools in suggestions',
            default: false
          }
        }
      },
      execute: async (params) => {
        try {
          const { category, limit = this.options.defaultSuggestionLimit, includeActive = false } = params;

          let suggestions = this.workingSet.getSuggestedTools();

          // Filter by category if specified
          if (category) {
            suggestions = suggestions.filter(s => {
              const metadata = this.registry.getToolMetadata(s.name);
              return metadata && metadata.category === category;
            });
          }

          // Filter out active tools unless requested
          if (!includeActive) {
            suggestions = suggestions.filter(s => !this.workingSet.isActive(s.name));
          }

          // Apply limit
          suggestions = suggestions.slice(0, limit);

          // Enhance suggestions with additional metadata
          const enhancedSuggestions = suggestions.map(suggestion => {
            const metadata = this.registry.getToolMetadata(suggestion.name);
            const usage = this.registry.getToolUsage(suggestion.name);
            
            return {
              ...suggestion,
              category: metadata?.category,
              tags: metadata?.tags,
              description: metadata?.description,
              usageCount: usage?.count || 0,
              lastUsed: usage?.lastUsed
            };
          });

          return {
            success: true,
            suggestions: enhancedSuggestions,
            count: enhancedSuggestions.length,
            basedOn: {
              activeTools: this.workingSet.getActiveTools(),
              workingSetSize: this.workingSet.getActiveToolCount()
            }
          };

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create active tools listing meta-tool
   * @private
   */
  _createToolListActiveTool() {
    return {
      name: 'tool_list_active',
      description: 'List currently active tools in the working set',
      inputSchema: {
        type: 'object',
        properties: {
          includeDetails: {
            type: 'boolean',
            description: 'Include detailed tool information',
            default: false
          },
          includeStatistics: {
            type: 'boolean',
            description: 'Include working set statistics',
            default: false
          },
          sortBy: {
            type: 'string',
            enum: ['name', 'priority', 'usage', 'category'],
            description: 'Sort order for tools',
            default: 'name'
          }
        }
      },
      execute: async (params) => {
        try {
          const { includeDetails = false, includeStatistics = false, sortBy = 'name' } = params;

          let activeTools = this.workingSet.getActiveTools().map(name => {
            const tool = { name };
            
            if (includeDetails) {
              const metadata = this.registry.getToolMetadata(name);
              const usage = this.workingSet.getToolUsage(name);
              const priority = this.workingSet.getToolPriorities()[name];
              
              Object.assign(tool, {
                description: metadata?.description,
                category: metadata?.category,
                tags: metadata?.tags,
                priority,
                usage: usage?.count || 0,
                lastUsed: usage?.lastUsed
              });
            }
            
            return tool;
          });

          // Sort tools
          activeTools = this._sortTools(activeTools, sortBy);

          const result = {
            success: true,
            activeTools,
            count: activeTools.length,
            maxSize: this.workingSet.options.maxSize
          };

          if (includeStatistics) {
            const workingSetStats = this.workingSet.getStatistics();
            const registryStats = this.registry.getUsageStatistics();
            
            result.statistics = {
              ...workingSetStats,
              totalActive: workingSetStats.activeToolCount,
              totalUsage: registryStats.totalUsage
            };
          }

          return result;

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create tool information meta-tool
   * @private
   */
  _createToolInfoTool() {
    return {
      name: 'tool_info',
      description: 'Get detailed information about a specific tool',
      inputSchema: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'Name of the tool to get information about'
          },
          includeUsage: {
            type: 'boolean',
            description: 'Include usage statistics',
            default: false
          },
          includeRelationships: {
            type: 'boolean',
            description: 'Include tool relationships',
            default: false
          }
        },
        required: ['toolName']
      },
      execute: async (params) => {
        try {
          const { toolName, includeUsage = false, includeRelationships = false } = params;

          if (!this.registry.hasTool(toolName)) {
            return {
              success: false,
              error: `Tool not found: ${toolName}`
            };
          }

          const tool = this.registry.getTool(toolName);
          const metadata = this.registry.getToolMetadata(toolName);
          
          const result = {
            success: true,
            tool: {
              name: toolName,
              description: metadata?.description,
              category: metadata?.category,
              tags: metadata?.tags,
              author: metadata?.author,
              version: metadata?.version,
              registeredAt: metadata?.registeredAt,
              isActive: this.workingSet.isActive(toolName)
            }
          };

          if (includeUsage) {
            const usage = this.registry.getToolUsage(toolName);
            const workingSetUsage = this.workingSet.getToolUsage(toolName);
            
            result.tool.usage = {
              count: usage?.count || 0,
              totalCount: usage?.count || 0,
              lastUsed: usage?.lastUsed,
              workingSetCount: workingSetUsage?.count || 0
            };
          }

          if (includeRelationships) {
            const dependencies = this.registry.getDependencies(toolName);
            const dependents = this.registry.getDependents(toolName);
            const suggestions = this.registry.getSuggestedTools(toolName);
            
            result.tool.dependencies = dependencies;
            result.tool.dependents = dependents;
            result.tool.relationships = {
              dependencies,
              dependents,
              suggestedRelated: suggestions.slice(0, 3)
            };
          }

          return result;

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Convert wildcard pattern to regex
   * @private
   */
  _convertWildcardToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const withWildcards = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${withWildcards}$`, 'i');
  }

  /**
   * Sort tools by specified criteria
   * @private
   */
  _sortTools(tools, sortBy) {
    switch (sortBy) {
      case 'priority':
        return tools.sort((a, b) => (b.priority || 1) - (a.priority || 1));
      case 'usage':
        return tools.sort((a, b) => (b.usage || 0) - (a.usage || 0));
      case 'category':
        return tools.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      case 'name':
      default:
        return tools.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  /**
   * Register meta-tools with an MCP server
   */
  registerWithMCPServer(mcpServer) {
    for (const [name, tool] of Object.entries(this.tools)) {
      mcpServer.addTool(tool);
    }
  }

  /**
   * Get statistics about meta-tool usage
   */
  getMetaToolStatistics() {
    return {
      availableMetaTools: Object.keys(this.tools).length,
      totalToolsInRegistry: this.registry.getToolCount(),
      activeToolsInWorkingSet: this.workingSet.getActiveToolCount(),
      workingSetCapacity: this.workingSet.options.maxSize,
      registryStatistics: this.registry.getStatistics(),
      workingSetStatistics: this.workingSet.getStatistics()
    };
  }
}