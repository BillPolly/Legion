/**
 * LogCaptureAgent - BT Agent for processing frontend logs and errors
 * 
 * This BT agent processes incoming log batches from frontend LogCaptureActor,
 * analyzes them using behavior trees, and forwards structured events to the
 * semantic search system for intelligent debugging and analysis.
 */

import { BTAgentBase } from '../agents-bt/core/BTAgentBase.js';

export class LogCaptureAgent extends BTAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      agentType: 'log_capture',
      agentId: config.agentId || `log-capture-${Date.now()}`
    });
    
    this.processingConfig = {
      batchProcessingTimeout: config.batchProcessingTimeout || 30000,
      errorAnalysisEnabled: config.errorAnalysisEnabled !== false,
      performanceAnalysisEnabled: config.performanceAnalysisEnabled !== false,
      semanticSearchEnabled: config.semanticSearchEnabled !== false,
      alertThresholds: {
        errorRate: config.errorRateThreshold || 0.1, // 10% error rate
        criticalErrors: config.criticalErrorThreshold || 1,
        performanceIssues: config.performanceThreshold || 5000 // 5s
      },
      ...config.processing
    };
    
    // Runtime state
    this.remoteActor = null;
    this.sessionMetadata = new Map(); // sessionId -> metadata
    this.errorPatterns = new Map(); // pattern -> count
    this.performanceMetrics = new Map(); // sessionId -> metrics
    
    console.log(`LogCaptureAgent ${this.agentId} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Get default BT configuration for log processing
   */
  getDefaultConfiguration() {
    return {
      type: 'sequence',
      name: 'log_capture_workflow',
      description: 'Process frontend log batches and forward to semantic search',
      children: [
        {
          type: 'condition',
          name: 'validate_log_batch',
          description: 'Validate incoming log batch structure',
          check: 'context.message.type === "log_batch" && Array.isArray(context.message.entries)'
        },
        {
          type: 'action',
          name: 'process_log_entries',
          description: 'Process individual log entries',
          tool: 'process_log_entries'
        },
        {
          type: 'parallel',
          name: 'analysis_tasks',
          description: 'Run multiple analysis tasks in parallel',
          children: [
            {
              type: 'action',
              name: 'error_analysis',
              description: 'Analyze errors and exceptions',
              tool: 'analyze_errors',
              check: 'context.processingConfig.errorAnalysisEnabled'
            },
            {
              type: 'action',
              name: 'performance_analysis',
              description: 'Analyze performance metrics',
              tool: 'analyze_performance',
              check: 'context.processingConfig.performanceAnalysisEnabled'
            },
            {
              type: 'action',
              name: 'pattern_detection',
              description: 'Detect recurring patterns',
              tool: 'detect_patterns'
            }
          ]
        },
        {
          type: 'action',
          name: 'forward_to_semantic_search',
          description: 'Forward processed events to semantic search',
          tool: 'forward_to_semantic_search',
          condition: 'context.processingConfig.semanticSearchEnabled'
        },
        {
          type: 'action',
          name: 'generate_alerts',
          description: 'Generate alerts for critical issues',
          tool: 'generate_alerts'
        }
      ]
    };
  }
  
  /**
   * Get tool registry with log processing tools
   */
  getToolRegistry() {
    const baseRegistry = super.getToolRegistry();
    
    return {
      ...baseRegistry,
      getTool: async (name) => {
        // Check base registry first
        const baseTool = await baseRegistry.getTool(name);
        if (baseTool) return baseTool;
        
        // Return our custom log processing tools
        switch (name) {
          case 'process_log_entries':
            return { execute: this.processLogEntries.bind(this) };
            
          case 'analyze_errors':
            return { execute: this.analyzeErrors.bind(this) };
            
          case 'analyze_performance':
            return { execute: this.analyzePerformance.bind(this) };
            
          case 'detect_patterns':
            return { execute: this.detectPatterns.bind(this) };
            
          case 'forward_to_semantic_search':
            return { execute: this.forwardToSemanticSearch.bind(this) };
            
          case 'generate_alerts':
            return { execute: this.generateAlerts.bind(this) };
            
          default:
            return null;
        }
      },
      
      hasTool: (name) => {
        return baseRegistry.hasTool(name) || [
          'process_log_entries',
          'analyze_errors', 
          'analyze_performance',
          'detect_patterns',
          'forward_to_semantic_search',
          'generate_alerts'
        ].includes(name);
      }
    };
  }
  
  /**
   * Main Actor receive method - handles different message types
   */
  async receive(payload, envelope) {
    try {
      switch (payload.type) {
        case 'log_batch':
          return await this.processLogBatch(payload, envelope);
          
        case 'session_metadata':
          return await this.updateSessionMetadata(payload);
          
        case 'log_capture_config':
          return await this.updateProcessingConfig(payload.config);
          
        case 'log_capture_status':
          return await this.getAgentStatus();
          
        default:
          // Use parent BT agent behavior for unknown messages
          return await super.receive(payload, envelope);
      }
    } catch (error) {
      console.error(`LogCaptureAgent ${this.agentId} error:`, error);
      return {
        type: 'error',
        error: error.message,
        agentId: this.agentId
      };
    }
  }
  
  /**
   * Process incoming log batch using BT workflow
   */
  async processLogBatch(payload, envelope) {
    if (this.debugMode) {
      console.log(`LogCaptureAgent ${this.agentId}: Processing batch with ${payload.entries?.length || 0} entries`);
    }
    
    // Create execution context
    const context = this.createExecutionContext(payload, envelope);
    context.processingConfig = this.processingConfig;
    context.logBatch = payload;
    context.processedEntries = [];
    context.analysisResults = {};
    
    // Execute the BT workflow
    const result = await this.btExecutor.executeTree(this.agentConfig, context);
    
    // Send response back to frontend actor
    const response = {
      type: 'log_batch_processed',
      success: result.success,
      batchId: payload.batchId,
      processedCount: context.processedEntries?.length || 0,
      analysisResults: context.analysisResults,
      agentId: this.agentId
    };
    
    if (this.remoteActor) {
      await this.sendToRemote(response);
    }
    
    return response;
  }
  
  /**
   * Update session metadata
   */
  async updateSessionMetadata(payload) {
    const sessionId = payload.sessionId;
    this.sessionMetadata.set(sessionId, {
      ...payload,
      lastUpdated: Date.now()
    });
    
    console.log(`LogCaptureAgent: Updated metadata for session ${sessionId}`);
    return { success: true };
  }
  
  /**
   * BT Tool: Process individual log entries
   */
  async processLogEntries(context) {
    const entries = context.logBatch.entries || [];
    const processed = [];
    
    for (const entry of entries) {
      try {
        const processedEntry = {
          ...entry,
          processedAt: Date.now(),
          agentId: this.agentId,
          // Standardize the entry structure
          event: {
            type: entry.type || 'unknown',
            level: entry.level || 'info',
            timestamp: entry.timestamp || Date.now(),
            sessionId: entry.sessionId || context.sessionId,
            correlationId: entry.correlationId,
            message: this.extractMessage(entry),
            metadata: this.extractMetadata(entry)
          }
        };
        
        processed.push(processedEntry);
      } catch (error) {
        console.error('LogCaptureAgent: Error processing entry:', error);
      }
    }
    
    context.processedEntries = processed;
    return { success: true, processedCount: processed.length };
  }
  
  /**
   * BT Tool: Analyze errors in the log batch
   */
  async analyzeErrors(context) {
    const errors = context.processedEntries.filter(entry => 
      entry.event.type === 'frontend_error' || 
      entry.event.level === 'error'
    );
    
    const analysis = {
      errorCount: errors.length,
      errorTypes: {},
      criticalErrors: [],
      errorRate: errors.length / (context.processedEntries.length || 1)
    };
    
    errors.forEach(error => {
      const errorType = error.errorName || error.event.type || 'unknown';
      analysis.errorTypes[errorType] = (analysis.errorTypes[errorType] || 0) + 1;
      
      // Track error patterns
      const pattern = `${errorType}:${error.event.message?.substring(0, 100) || ''}`;
      this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
      
      // Identify critical errors
      if (this.isCriticalError(error)) {
        analysis.criticalErrors.push(error);
      }
    });
    
    context.analysisResults.errorAnalysis = analysis;
    return { success: true, analysis };
  }
  
  /**
   * BT Tool: Analyze performance metrics
   */
  async analyzePerformance(context) {
    const performanceEntries = context.processedEntries.filter(entry =>
      entry.event.type.startsWith('performance_')
    );
    
    const analysis = {
      metricsCount: performanceEntries.length,
      loadTimes: [],
      resourceTimes: [],
      issues: []
    };
    
    performanceEntries.forEach(entry => {
      if (entry.navigation?.loadTime) {
        analysis.loadTimes.push(entry.navigation.loadTime);
        
        // Check for slow page loads
        if (entry.navigation.loadTime > this.processingConfig.alertThresholds.performanceIssues) {
          analysis.issues.push({
            type: 'slow_page_load',
            time: entry.navigation.loadTime,
            url: entry.event.metadata.url
          });
        }
      }
      
      if (entry.resources) {
        entry.resources.forEach(resource => {
          analysis.resourceTimes.push(resource.duration);
        });
      }
    });
    
    // Calculate averages
    if (analysis.loadTimes.length > 0) {
      analysis.averageLoadTime = analysis.loadTimes.reduce((a, b) => a + b, 0) / analysis.loadTimes.length;
    }
    
    context.analysisResults.performanceAnalysis = analysis;
    return { success: true, analysis };
  }
  
  /**
   * BT Tool: Detect patterns in logs
   */
  async detectPatterns(context) {
    const patterns = {
      repeatingErrors: [],
      frequentMessages: new Map(),
      timePatterns: {},
      userBehaviorPatterns: []
    };
    
    // Analyze message frequencies
    context.processedEntries.forEach(entry => {
      const message = entry.event.message?.substring(0, 200) || '';
      patterns.frequentMessages.set(message, (patterns.frequentMessages.get(message) || 0) + 1);
    });
    
    // Find repeating errors (more than 3 occurrences)
    for (const [pattern, count] of this.errorPatterns.entries()) {
      if (count >= 3) {
        patterns.repeatingErrors.push({ pattern, count });
      }
    }
    
    // Time-based pattern analysis (hour of day)
    const hourCounts = {};
    context.processedEntries.forEach(entry => {
      const hour = new Date(entry.event.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    patterns.timePatterns = hourCounts;
    
    context.analysisResults.patternAnalysis = patterns;
    return { success: true, patterns };
  }
  
  /**
   * BT Tool: Forward processed events to semantic search
   */
  async forwardToSemanticSearch(context) {
    try {
      // Get UniversalEventCollector from moduleLoader
      const eventCollector = await this.getUniversalEventCollector();
      
      if (!eventCollector) {
        console.warn('LogCaptureAgent: UniversalEventCollector not available');
        return { success: false, reason: 'EventCollector unavailable' };
      }
      
      let forwardedCount = 0;
      
      for (const entry of context.processedEntries) {
        try {
          // Create structured event for semantic search
          // Use the onLogEvent method that we know exists in UniversalEventCollector
          const structuredEvent = await eventCollector.onLogEvent(
            entry.event.level,
            entry.event.message,
            {
              sessionId: entry.event.sessionId,
              correlationId: entry.event.correlationId,
              type: entry.event.type,
              url: entry.event.metadata.url,
              timestamp: entry.event.timestamp,
              source: 'frontend',
              metadata: {
                ...entry.event.metadata,
                frontendType: entry.event.type,
                analysis: context.analysisResults
              }
            }
          );
          
          forwardedCount++;
        } catch (error) {
          console.error('LogCaptureAgent: Error forwarding event:', error);
        }
      }
      
      context.analysisResults.semanticForwarding = {
        forwardedCount,
        totalCount: context.processedEntries.length
      };
      
      return { success: true, forwardedCount };
      
    } catch (error) {
      console.error('LogCaptureAgent: Semantic forwarding failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * BT Tool: Generate alerts for critical issues
   */
  async generateAlerts(context) {
    const alerts = [];
    const analysis = context.analysisResults;
    
    // Error rate alerts
    if (analysis.errorAnalysis?.errorRate > this.processingConfig.alertThresholds.errorRate) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'warning',
        message: `High error rate detected: ${(analysis.errorAnalysis.errorRate * 100).toFixed(1)}%`,
        data: analysis.errorAnalysis
      });
    }
    
    // Critical error alerts
    if (analysis.errorAnalysis?.criticalErrors?.length > 0) {
      alerts.push({
        type: 'critical_errors',
        severity: 'critical',
        message: `${analysis.errorAnalysis.criticalErrors.length} critical errors detected`,
        data: analysis.errorAnalysis.criticalErrors
      });
    }
    
    // Performance alerts
    if (analysis.performanceAnalysis?.issues?.length > 0) {
      alerts.push({
        type: 'performance_issues',
        severity: 'warning',
        message: `${analysis.performanceAnalysis.issues.length} performance issues detected`,
        data: analysis.performanceAnalysis.issues
      });
    }
    
    // Repeating error alerts
    if (analysis.patternAnalysis?.repeatingErrors?.length > 0) {
      alerts.push({
        type: 'repeating_errors',
        severity: 'warning',
        message: `${analysis.patternAnalysis.repeatingErrors.length} repeating error patterns detected`,
        data: analysis.patternAnalysis.repeatingErrors
      });
    }
    
    // Send alerts to remote actor and log them
    for (const alert of alerts) {
      console.warn(`LogCaptureAgent Alert [${alert.severity.toUpperCase()}]:`, alert.message);
      
      if (this.remoteActor) {
        await this.sendToRemote({
          type: 'frontend_alert',
          alert,
          agentId: this.agentId,
          timestamp: Date.now()
        });
      }
    }
    
    context.analysisResults.alerts = alerts;
    return { success: true, alertCount: alerts.length };
  }
  
  /**
   * Check if an error is critical
   */
  isCriticalError(error) {
    const criticalPatterns = [
      /uncaught\s+exception/i,
      /security\s+error/i,
      /permission\s+denied/i,
      /network\s+error/i,
      /timeout/i,
      /out\s+of\s+memory/i
    ];
    
    const message = error.event.message || '';
    return criticalPatterns.some(pattern => pattern.test(message));
  }
  
  /**
   * Extract message from log entry
   */
  extractMessage(entry) {
    if (entry.messages && Array.isArray(entry.messages)) {
      return entry.messages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    }
    return entry.message || entry.reason || 'No message';
  }
  
  /**
   * Extract metadata from log entry
   */
  extractMetadata(entry) {
    return {
      url: entry.url || entry.page?.url,
      userAgent: entry.userAgent,
      stackTrace: entry.stackTrace || entry.stack,
      filename: entry.filename,
      lineNumber: entry.lineNumber,
      columnNumber: entry.columnNumber,
      resourceUrl: entry.resourceUrl,
      resourceType: entry.resourceType,
      ...entry.metadata
    };
  }
  
  /**
   * Get UniversalEventCollector from the module system
   */
  async getUniversalEventCollector() {
    try {
      if (this.moduleLoader) {
        // Try to get from jester package
        const jesterModule = await this.moduleLoader.getLoadedModule('jester');
        if (jesterModule && jesterModule.eventCollector) {
          return jesterModule.eventCollector;
        }
        
        // Try to get from semantic-search package
        const searchModule = await this.moduleLoader.getLoadedModule('semantic-search');
        if (searchModule && searchModule.eventCollector) {
          return searchModule.eventCollector;
        }
      }
      
      return null;
    } catch (error) {
      console.error('LogCaptureAgent: Failed to get UniversalEventCollector:', error);
      return null;
    }
  }
  
  /**
   * Update processing configuration
   */
  async updateProcessingConfig(newConfig) {
    this.processingConfig = { ...this.processingConfig, ...newConfig };
    console.log(`LogCaptureAgent ${this.agentId}: Configuration updated`);
    return { success: true };
  }
  
  /**
   * Get agent status and statistics
   */
  async getAgentStatus() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      sessionId: this.sessionId,
      initialized: this.initialized,
      remoteActorConnected: !!this.remoteActor,
      sessionCount: this.sessionMetadata.size,
      errorPatternCount: this.errorPatterns.size,
      processingConfig: this.processingConfig,
      uptime: Date.now() - this.initTime
    };
  }
  
  /**
   * Set remote actor (frontend LogCaptureActor)
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log(`LogCaptureAgent ${this.agentId}: Remote actor ${remoteActor ? 'connected' : 'disconnected'}`);
  }
}