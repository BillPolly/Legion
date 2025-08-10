/**
 * ToolHandler - Handles MCP tool execution and routing
 */

import { MonitoringTools } from '../tools/MonitoringTools.js';
import { DebugTools } from '../tools/DebugTools.js';
import { AnalysisTools } from '../tools/AnalysisTools.js';

export class ToolHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    
    // Initialize tool modules
    this.monitoringTools = new MonitoringTools(sessionManager);
    this.debugTools = new DebugTools(sessionManager);
    this.analysisTools = new AnalysisTools(sessionManager);
    
    // Build tool registry
    this.tools = new Map();
    this.buildToolRegistry();
  }
  
  /**
   * Build the tool registry from all tool modules
   */
  buildToolRegistry() {
    // Register monitoring tools
    const monitoringDefs = this.monitoringTools.getToolDefinitions();
    monitoringDefs.forEach(tool => {
      this.tools.set(tool.name, {
        definition: tool,
        executor: this.monitoringTools
      });
    });
    
    // Register debug tools
    const debugDefs = this.debugTools.getToolDefinitions();
    debugDefs.forEach(tool => {
      this.tools.set(tool.name, {
        definition: tool,
        executor: this.debugTools
      });
    });
    
    // Register analysis tools
    const analysisDefs = this.analysisTools.getToolDefinitions();
    analysisDefs.forEach(tool => {
      this.tools.set(tool.name, {
        definition: tool,
        executor: this.analysisTools
      });
    });
  }
  
  /**
   * Get all available tools for MCP tools/list
   */
  getAllTools() {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }
  
  /**
   * Execute a tool
   */
  async executeTool(name, arguments_) {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`
          }
        ],
        isError: true
      };
    }
    
    try {
      // Validate arguments against schema (simplified)
      this.validateArguments(arguments_, tool.definition.inputSchema);
      
      // Execute the tool
      const result = await tool.executor.execute(name, arguments_);
      
      return {
        content: [
          {
            type: 'text',
            text: this.formatToolResult(name, result)
          }
        ]
      };
      
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
  
  /**
   * Validate arguments against schema (simplified validation)
   */
  validateArguments(args, schema) {
    if (!schema || !schema.properties) {
      return; // No validation needed
    }
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in args)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    // Basic type checking
    for (const [field, value] of Object.entries(args)) {
      const fieldSchema = schema.properties[field];
      if (fieldSchema && fieldSchema.type) {
        const actualType = typeof value;
        const expectedType = fieldSchema.type;
        
        if (expectedType === 'array' && !Array.isArray(value)) {
          throw new Error(`Field ${field} should be an array`);
        } else if (expectedType !== 'array' && actualType !== expectedType) {
          // Allow some type coercion
          if (!(expectedType === 'number' && !isNaN(Number(value)))) {
            throw new Error(`Field ${field} should be ${expectedType}, got ${actualType}`);
          }
        }
      }
    }
  }
  
  /**
   * Format tool result for display
   */
  formatToolResult(toolName, result) {
    if (typeof result === 'string') {
      return result;
    }
    
    if (result.success === false) {
      return `❌ ${toolName} failed: ${result.error}`;
    }
    
    // Format based on tool type
    switch (toolName) {
      case 'start_fullstack_monitoring':
        return this.formatMonitoringStart(result);
        
      case 'execute_debug_scenario':
        return this.formatDebugScenario(result);
        
      case 'search_logs':
        return this.formatLogSearch(result);
        
      case 'get_correlations':
        return this.formatCorrelations(result);
        
      case 'analyze_error':
        return this.formatErrorAnalysis(result);
        
      case 'get_recent_errors':
        return this.formatRecentErrors(result);
        
      case 'get_monitoring_stats':
        return this.formatStats(result);
        
      default:
        // Generic formatting
        return `✅ ${toolName} completed successfully\n\n${JSON.stringify(result, null, 2)}`;
    }
  }
  
  /**
   * Format monitoring start result
   */
  formatMonitoringStart(result) {
    if (!result.success) {
      return `❌ Failed to start monitoring: ${result.error}`;
    }
    
    return `✅ Full-stack monitoring started successfully!

**Session:** ${result.session_id}
**Backend:** ${result.backend.name} (PID: ${result.backend.pid})
**Frontend:** ${result.frontend.url}

The system is now monitoring both backend and frontend activity. You can now:
- Execute debug scenarios with \`execute_debug_scenario\`
- Search logs with \`search_logs\`
- Analyze errors with \`analyze_error\`
- Get statistics with \`get_monitoring_stats\``;
  }
  
  /**
   * Format debug scenario result
   */
  formatDebugScenario(result) {
    if (!result.success) {
      return `❌ Debug scenario failed: ${result.error}`;
    }
    
    let output = `✅ Debug scenario completed: ${result.successful_steps}/${result.total_steps} steps successful\n\n`;
    
    // Show step results
    output += '**Steps:**\n';
    result.results.forEach(step => {
      const status = step.success ? '✅' : '❌';
      output += `${status} Step ${step.step}: ${step.action}`;
      if (step.correlation_id) {
        output += ` [${step.correlation_id}]`;
      }
      if (step.error) {
        output += ` - Error: ${step.error}`;
      }
      output += '\n';
      
      if (step.insights && step.insights.length > 0) {
        step.insights.forEach(insight => {
          output += `   ⚠️ ${insight.type}: ${insight.message || insight.count + ' items'}\n`;
        });
      }
    });
    
    // Show summary
    if (result.summary) {
      output += '\n**Analysis:**\n';
      
      if (result.summary.errors && result.summary.errors.length > 0) {
        output += '❌ **Errors detected:**\n';
        result.summary.errors.forEach(error => {
          output += `  • ${error}\n`;
        });
      }
      
      if (result.summary.warnings && result.summary.warnings.length > 0) {
        output += '⚠️ **Warnings:**\n';
        result.summary.warnings.forEach(warning => {
          output += `  • ${warning}\n`;
        });
      }
      
      if (result.summary.correlations && result.summary.correlations.length > 0) {
        output += '🔗 **Correlations tracked:** ' + result.summary.correlations.join(', ') + '\n';
      }
      
      output += `\n💡 **Recommendation:** ${result.summary.recommendation}`;
    }
    
    return output;
  }
  
  /**
   * Format log search results
   */
  formatLogSearch(result) {
    if (!result.success) {
      return `❌ Log search failed: ${result.error}`;
    }
    
    let output = `🔍 **Log Search Results**\n`;
    output += `Query: "${result.query}" (${result.mode} mode)\n`;
    output += `${result.summary}\n\n`;
    
    if (result.results.backend.length > 0) {
      output += `**Backend Logs (${result.results.backend.length}):**\n`;
      result.results.backend.slice(0, 5).forEach(log => {
        output += `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}\n`;
      });
      if (result.results.backend.length > 5) {
        output += `... and ${result.results.backend.length - 5} more backend logs\n`;
      }
      output += '\n';
    }
    
    if (result.results.frontend.length > 0) {
      output += `**Frontend Logs (${result.results.frontend.length}):**\n`;
      result.results.frontend.slice(0, 5).forEach(log => {
        output += `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}\n`;
      });
      if (result.results.frontend.length > 5) {
        output += `... and ${result.results.frontend.length - 5} more frontend logs\n`;
      }
    }
    
    return output;
  }
  
  /**
   * Format correlations result
   */
  formatCorrelations(result) {
    if (!result.success) {
      return `❌ Failed to get correlations: ${result.error}`;
    }
    
    let output = `🔗 **Correlation Analysis: ${result.correlation_id}**\n\n`;
    output += `**Summary:**\n`;
    output += `• Backend logs: ${result.backend_logs}\n`;
    output += `• Frontend logs: ${result.frontend_logs}\n`;
    output += `• Network requests: ${result.network_requests}\n\n`;
    
    if (result.timeline.length > 0) {
      output += `**Timeline:**\n`;
      result.timeline.forEach((event, index) => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const source = event.source.toUpperCase();
        output += `${index + 1}. [${time}] ${source}: `;
        
        if (event.source === 'backend') {
          output += `${event.level} - ${event.message}`;
        } else if (event.source === 'frontend') {
          output += `${event.type} - ${event.message}`;
        } else if (event.source === 'network') {
          output += `${event.method} ${event.url}`;
        }
        
        output += '\n';
      });
    }
    
    if (result.analysis) {
      output += '\n**Analysis:**\n';
      output += `• Has errors: ${result.analysis.has_errors ? 'Yes' : 'No'}\n`;
      if (result.analysis.error_count > 0) {
        output += `• Error count: ${result.analysis.error_count}\n`;
      }
      if (result.analysis.request_successful !== null) {
        output += `• Request successful: ${result.analysis.request_successful ? 'Yes' : 'No'}\n`;
      }
    }
    
    return output;
  }
  
  /**
   * Format error analysis result
   */
  formatErrorAnalysis(result) {
    if (!result.success) {
      return `❌ Error analysis failed: ${result.error}`;
    }
    
    const analysis = result.analysis;
    let output = `🔍 **Error Analysis: "${analysis.error_message}"**\n\n`;
    
    output += `**Overview:**\n`;
    output += `• Occurrences: ${analysis.occurrences}\n`;
    if (analysis.first_seen) {
      output += `• First seen: ${new Date(analysis.first_seen).toLocaleString()}\n`;
      output += `• Last seen: ${new Date(analysis.last_seen).toLocaleString()}\n`;
    }
    output += `• Affected components: ${analysis.affected_components.join(', ') || 'None'}\n\n`;
    
    if (analysis.potential_causes.length > 0) {
      output += `**Potential Causes:**\n`;
      analysis.potential_causes.forEach(cause => {
        output += `• ${cause}\n`;
      });
      output += '\n';
    }
    
    if (analysis.recommendations.length > 0) {
      output += `**Recommendations:**\n`;
      analysis.recommendations.forEach(rec => {
        output += `• ${rec}\n`;
      });
    }
    
    return output;
  }
  
  /**
   * Format recent errors result
   */
  formatRecentErrors(result) {
    if (!result.success) {
      return `❌ Failed to get recent errors: ${result.error}`;
    }
    
    let output = `⚠️ **Recent Errors (${result.time_range})**\n`;
    output += `${result.summary}\n\n`;
    
    if (result.groups && result.groups.length > 0) {
      output += `**Error Groups (by frequency):**\n`;
      result.groups.slice(0, 5).forEach((group, index) => {
        output += `${index + 1}. **${group.message.substring(0, 60)}...** (${group.count} times)\n`;
        output += `   First: ${new Date(group.first_seen).toLocaleString()}\n`;
        output += `   Last: ${new Date(group.last_seen).toLocaleString()}\n\n`;
      });
    }
    
    return output;
  }
  
  /**
   * Format statistics result
   */
  formatStats(result) {
    if (!result.success) {
      return `❌ Failed to get statistics: ${result.error}`;
    }
    
    const stats = result.stats;
    let output = `📊 **Monitoring Statistics (Session: ${result.session_id})**\n\n`;
    
    output += `**Backend:**\n`;
    output += `• Total logs: ${stats.backend.total_logs}\n`;
    output += `• Processes: ${stats.backend.processes}\n`;
    output += `• Errors: ${stats.backend.errors}\n\n`;
    
    output += `**Frontend:**\n`;
    output += `• Console messages: ${stats.frontend.console_messages}\n`;
    output += `• Network requests: ${stats.frontend.network_requests}\n`;
    output += `• Errors: ${stats.frontend.errors}\n\n`;
    
    output += `**System:**\n`;
    output += `• Correlations detected: ${stats.correlations}\n`;
    output += `• Debug scenarios run: ${stats.debug_scenarios}\n`;
    output += `• Uptime: ${Math.round(stats.uptime / 1000)}s\n`;
    
    return output;
  }
}