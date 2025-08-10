/**
 * AnalysisTools - Log analysis and correlation tools for MCP
 */

export class AnalysisTools {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }
  
  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions() {
    return [
      {
        name: 'search_logs',
        description: 'Search through backend and frontend logs',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (text to search for)'
            },
            mode: {
              type: 'string',
              enum: ['keyword', 'regex', 'semantic', 'hybrid'],
              description: 'Search mode',
              default: 'keyword'
            },
            source: {
              type: 'string',
              enum: ['all', 'backend', 'frontend'],
              description: 'Which logs to search',
              default: 'all'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 100
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          },
          required: ['query']
        }
      },
      
      {
        name: 'get_correlations',
        description: 'Get all logs related to a correlation ID',
        inputSchema: {
          type: 'object',
          properties: {
            correlation_id: {
              type: 'string',
              description: 'Correlation ID to look up'
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          },
          required: ['correlation_id']
        }
      },
      
      {
        name: 'analyze_error',
        description: 'Analyze a specific error with full context',
        inputSchema: {
          type: 'object',
          properties: {
            error_message: {
              type: 'string',
              description: 'Error message or pattern to analyze'
            },
            time_range: {
              type: 'string',
              description: 'Time range to search (e.g., "5m", "1h")',
              default: '5m'
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          },
          required: ['error_message']
        }
      },
      
      {
        name: 'get_recent_errors',
        description: 'Get all recent errors from both frontend and backend',
        inputSchema: {
          type: 'object',
          properties: {
            minutes: {
              type: 'number',
              description: 'How many minutes back to search',
              default: 5
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          }
        }
      },
      
      {
        name: 'trace_request',
        description: 'Trace a request through the entire system',
        inputSchema: {
          type: 'object',
          properties: {
            request_id: {
              type: 'string',
              description: 'Request ID or correlation ID to trace'
            },
            session_id: {
              type: 'string',
              description: 'Session ID',
              default: 'default'
            }
          },
          required: ['request_id']
        }
      }
    ];
  }
  
  /**
   * Execute an analysis tool
   */
  async execute(toolName, args) {
    switch (toolName) {
      case 'search_logs':
        return await this.searchLogs(args);
        
      case 'get_correlations':
        return await this.getCorrelations(args);
        
      case 'analyze_error':
        return await this.analyzeError(args);
        
      case 'get_recent_errors':
        return await this.getRecentErrors(args);
        
      case 'trace_request':
        return await this.traceRequest(args);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  /**
   * Search logs
   */
  async searchLogs(args) {
    const { 
      query,
      mode = 'keyword',
      source = 'all',
      limit = 100,
      session_id = 'default'
    } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      const results = {
        backend: [],
        frontend: [],
        total: 0
      };
      
      // Search backend logs
      if (source === 'all' || source === 'backend') {
        const backendResult = await monitor.logManager.searchLogs({
          query,
          mode,
          sessionId: monitor.session.id,
          limit
        });
        
        if (backendResult.success && backendResult.matches) {
          results.backend = backendResult.matches.map(log => ({
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            process: log.processId
          }));
        }
      }
      
      // Search frontend logs
      if (source === 'all' || source === 'frontend') {
        const frontendLogs = monitor.browserMonitor.getSessionLogs(monitor.session.id);
        
        // Simple keyword search for frontend logs
        const filtered = frontendLogs.filter(log => {
          const text = (log.text || log.message || '').toLowerCase();
          return text.includes(query.toLowerCase());
        }).slice(0, limit);
        
        results.frontend = filtered.map(log => ({
          timestamp: log.timestamp,
          type: log.type,
          message: log.text || log.message,
          page: log.pageId
        }));
      }
      
      results.total = results.backend.length + results.frontend.length;
      
      return {
        success: true,
        session_id,
        query,
        mode,
        results,
        summary: `Found ${results.total} matches (${results.backend.length} backend, ${results.frontend.length} frontend)`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get correlations
   */
  async getCorrelations(args) {
    const { correlation_id, session_id = 'default' } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      const logs = await monitor.getCorrelatedLogs(correlation_id);
      
      // Format for MCP response
      const result = {
        success: true,
        session_id,
        correlation_id,
        backend_logs: logs.backend ? logs.backend.length : 0,
        frontend_logs: logs.frontend ? logs.frontend.length : 0,
        network_requests: logs.network ? logs.network.length : 0,
        timeline: []
      };
      
      // Build timeline
      const allEvents = [];
      
      if (logs.backend) {
        logs.backend.forEach(log => {
          allEvents.push({
            timestamp: log.timestamp,
            source: 'backend',
            level: log.level,
            message: log.message
          });
        });
      }
      
      if (logs.frontend) {
        logs.frontend.forEach(log => {
          allEvents.push({
            timestamp: log.timestamp,
            source: 'frontend',
            type: log.type,
            message: log.text || log.message
          });
        });
      }
      
      if (logs.network) {
        logs.network.forEach(req => {
          allEvents.push({
            timestamp: req.timestamp,
            source: 'network',
            method: req.method,
            url: req.url
          });
        });
      }
      
      // Sort by timestamp
      result.timeline = allEvents.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      // Add analysis
      result.analysis = this.analyzeCorrelation(logs);
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Analyze an error
   */
  async analyzeError(args) {
    const { 
      error_message,
      time_range = '5m',
      session_id = 'default'
    } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      
      // Search for the error
      const searchResult = await this.searchLogs({
        query: error_message,
        mode: 'keyword',
        source: 'all',
        limit: 50,
        session_id
      });
      
      if (!searchResult.success) {
        return searchResult;
      }
      
      // Analyze the context
      const analysis = {
        error_message,
        occurrences: searchResult.results.total,
        first_seen: null,
        last_seen: null,
        affected_components: new Set(),
        potential_causes: [],
        related_errors: [],
        recommendations: []
      };
      
      // Find first and last occurrence
      const allLogs = [...searchResult.results.backend, ...searchResult.results.frontend];
      if (allLogs.length > 0) {
        allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        analysis.first_seen = allLogs[0].timestamp;
        analysis.last_seen = allLogs[allLogs.length - 1].timestamp;
      }
      
      // Identify affected components
      searchResult.results.backend.forEach(log => {
        if (log.process) analysis.affected_components.add(`backend:${log.process}`);
      });
      
      searchResult.results.frontend.forEach(log => {
        if (log.page) analysis.affected_components.add(`frontend:${log.page}`);
      });
      
      analysis.affected_components = Array.from(analysis.affected_components);
      
      // Generate insights
      analysis.potential_causes = this.identifyPotentialCauses(error_message, allLogs);
      analysis.recommendations = this.generateRecommendations(error_message, analysis);
      
      return {
        success: true,
        session_id,
        analysis
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get recent errors
   */
  async getRecentErrors(args) {
    const { minutes = 5, session_id = 'default' } = args;
    
    try {
      const monitor = this.sessionManager.getCurrentMonitor(session_id);
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const errors = {
        backend: [],
        frontend: [],
        total: 0
      };
      
      // Get backend errors
      const backendLogs = await monitor.logManager.searchLogs({
        query: 'error',
        mode: 'keyword',
        sessionId: monitor.session.id,
        limit: 100
      });
      
      if (backendLogs.success && backendLogs.matches) {
        errors.backend = backendLogs.matches
          .filter(log => 
            log.level === 'error' && 
            new Date(log.timestamp) > cutoffTime
          )
          .map(log => ({
            timestamp: log.timestamp,
            message: log.message,
            process: log.processId
          }));
      }
      
      // Get frontend errors
      const frontendLogs = monitor.browserMonitor.getSessionLogs(monitor.session.id);
      errors.frontend = frontendLogs
        .filter(log => 
          log.type === 'error' && 
          new Date(log.timestamp) > cutoffTime
        )
        .map(log => ({
          timestamp: log.timestamp,
          message: log.text || log.message,
          page: log.pageId
        }));
      
      errors.total = errors.backend.length + errors.frontend.length;
      
      // Group errors by type
      const errorGroups = this.groupErrors([...errors.backend, ...errors.frontend]);
      
      return {
        success: true,
        session_id,
        time_range: `${minutes} minutes`,
        errors,
        groups: errorGroups,
        summary: `Found ${errors.total} errors in the last ${minutes} minutes`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Trace a request through the system
   */
  async traceRequest(args) {
    const { request_id, session_id = 'default' } = args;
    
    // Use getCorrelations for tracing
    const result = await this.getCorrelations({
      correlation_id: request_id,
      session_id
    });
    
    if (result.success) {
      // Add request flow analysis
      result.flow = this.analyzeRequestFlow(result.timeline);
      result.duration = this.calculateRequestDuration(result.timeline);
      result.bottlenecks = this.identifyBottlenecks(result.timeline);
    }
    
    return result;
  }
  
  /**
   * Analyze correlation data
   */
  analyzeCorrelation(logs) {
    const analysis = {
      has_errors: false,
      error_count: 0,
      warning_count: 0,
      request_successful: null,
      performance: {}
    };
    
    // Check for errors
    if (logs.backend) {
      const errors = logs.backend.filter(log => log.level === 'error');
      analysis.error_count += errors.length;
      analysis.has_errors = errors.length > 0;
    }
    
    if (logs.frontend) {
      const errors = logs.frontend.filter(log => log.type === 'error');
      analysis.error_count += errors.length;
      analysis.has_errors = analysis.has_errors || errors.length > 0;
    }
    
    // Check request status
    if (logs.network && logs.network.length > 0) {
      // Simplified - would need response data for real status
      analysis.request_successful = !analysis.has_errors;
    }
    
    return analysis;
  }
  
  /**
   * Identify potential causes of an error
   */
  identifyPotentialCauses(errorMessage, logs) {
    const causes = [];
    const lower = errorMessage.toLowerCase();
    
    if (lower.includes('connection') || lower.includes('network')) {
      causes.push('Network connectivity issues');
    }
    
    if (lower.includes('timeout')) {
      causes.push('Request timeout - server may be slow or unresponsive');
    }
    
    if (lower.includes('cors')) {
      causes.push('CORS policy blocking cross-origin requests');
    }
    
    if (lower.includes('404') || lower.includes('not found')) {
      causes.push('Resource not found - check URLs and routes');
    }
    
    if (lower.includes('500') || lower.includes('internal server')) {
      causes.push('Server error - check backend logs for details');
    }
    
    if (lower.includes('undefined') || lower.includes('null')) {
      causes.push('Null reference error - missing data or uninitialized variable');
    }
    
    if (lower.includes('permission') || lower.includes('unauthorized')) {
      causes.push('Authentication or authorization failure');
    }
    
    return causes.length > 0 ? causes : ['Unknown cause - manual investigation required'];
  }
  
  /**
   * Generate recommendations based on error analysis
   */
  generateRecommendations(errorMessage, analysis) {
    const recommendations = [];
    
    if (analysis.occurrences > 10) {
      recommendations.push('This error is occurring frequently - prioritize fixing');
    }
    
    if (analysis.affected_components.length > 1) {
      recommendations.push('Error affects multiple components - may be a systemic issue');
    }
    
    if (errorMessage.toLowerCase().includes('cors')) {
      recommendations.push('Configure CORS headers on the backend server');
    }
    
    if (errorMessage.toLowerCase().includes('timeout')) {
      recommendations.push('Increase timeout values or optimize slow operations');
    }
    
    if (errorMessage.toLowerCase().includes('undefined')) {
      recommendations.push('Add null checks and data validation');
    }
    
    return recommendations.length > 0 ? recommendations : 
      ['Review the error context and stack trace for more details'];
  }
  
  /**
   * Group errors by similarity
   */
  groupErrors(errors) {
    const groups = {};
    
    errors.forEach(error => {
      // Simple grouping by first part of error message
      const key = error.message.substring(0, 50);
      if (!groups[key]) {
        groups[key] = {
          message: error.message,
          count: 0,
          first_seen: error.timestamp,
          last_seen: error.timestamp
        };
      }
      
      groups[key].count++;
      if (new Date(error.timestamp) < new Date(groups[key].first_seen)) {
        groups[key].first_seen = error.timestamp;
      }
      if (new Date(error.timestamp) > new Date(groups[key].last_seen)) {
        groups[key].last_seen = error.timestamp;
      }
    });
    
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }
  
  /**
   * Analyze request flow
   */
  analyzeRequestFlow(timeline) {
    const flow = [];
    
    timeline.forEach((event, index) => {
      flow.push({
        step: index + 1,
        timestamp: event.timestamp,
        source: event.source,
        description: this.describeEvent(event)
      });
    });
    
    return flow;
  }
  
  /**
   * Calculate request duration
   */
  calculateRequestDuration(timeline) {
    if (timeline.length < 2) return 0;
    
    const start = new Date(timeline[0].timestamp);
    const end = new Date(timeline[timeline.length - 1].timestamp);
    
    return end - start; // milliseconds
  }
  
  /**
   * Identify bottlenecks
   */
  identifyBottlenecks(timeline) {
    const bottlenecks = [];
    
    for (let i = 1; i < timeline.length; i++) {
      const prev = new Date(timeline[i - 1].timestamp);
      const curr = new Date(timeline[i].timestamp);
      const gap = curr - prev;
      
      if (gap > 1000) { // More than 1 second
        bottlenecks.push({
          between: `Step ${i} and ${i + 1}`,
          duration: gap,
          description: `${gap}ms delay between ${timeline[i-1].source} and ${timeline[i].source}`
        });
      }
    }
    
    return bottlenecks;
  }
  
  /**
   * Describe an event for the flow
   */
  describeEvent(event) {
    if (event.source === 'frontend') {
      return `Browser: ${event.type} - ${event.message}`;
    } else if (event.source === 'backend') {
      return `Server: ${event.level} - ${event.message}`;
    } else if (event.source === 'network') {
      return `Network: ${event.method} ${event.url}`;
    }
    return `${event.source}: ${event.message || 'Unknown event'}`;
  }
}