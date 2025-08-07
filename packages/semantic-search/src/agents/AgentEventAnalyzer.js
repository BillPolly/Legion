/**
 * AgentEventAnalyzer - High-level interface for AI agents to debug logs and events
 * 
 * Provides natural language query interface for intelligent agents to:
 * - Investigate production issues
 * - Analyze test failures 
 * - Trace requests across services
 * - Find similar errors and patterns
 */

export class AgentEventAnalyzer {
  constructor(eventSearchProvider, eventStorage = null, config = {}) {
    this.searchProvider = eventSearchProvider;
    this.storage = eventStorage;
    this.config = {
      defaultTimeRange: config.defaultTimeRange || 86400000, // 24 hours
      maxResults: config.maxResults || 100,
      similarityThreshold: config.similarityThreshold || 0.7,
      enableContextEnrichment: config.enableContextEnrichment !== false,
      ...config
    };
    
    // Query pattern recognition
    this.queryPatterns = this.initializeQueryPatterns();
    this.debugContext = new Map(); // Track ongoing investigations
  }

  /**
   * Main investigation interface - natural language queries
   */
  async investigate(naturalQuery, context = {}) {
    try {
      // Parse the intent from natural language
      const intent = await this.parseIntent(naturalQuery, context);
      
      // Route to appropriate handler
      switch (intent.type) {
        case 'error_search':
          return await this.searchErrors(intent);
          
        case 'test_failure_analysis':
          return await this.analyzeTestFailures(intent);
          
        case 'correlation_trace':
          return await this.traceCorrelation(intent);
          
        case 'similar_issues':
          return await this.findSimilarIssues(intent);
          
        case 'pattern_analysis':
          return await this.analyzePatterns(intent);
          
        case 'service_health':
          return await this.checkServiceHealth(intent);
          
        case 'timeline_analysis':
          return await this.buildTimeline(intent);
          
        default:
          return await this.handleGenericQuery(intent);
      }
      
    } catch (error) {
      console.error('Investigation failed:', error);
      return {
        success: false,
        error: error.message,
        query: naturalQuery,
        suggestions: this.getSuggestions(naturalQuery)
      };
    }
  }

  /**
   * Parse natural language intent
   */
  async parseIntent(query, context) {
    const lowerQuery = query.toLowerCase();
    const intent = {
      originalQuery: query,
      type: 'generic',
      timeRange: this.extractTimeRange(query),
      services: this.extractServices(query),
      entities: this.extractEntities(query),
      context
    };

    // Match against patterns
    for (const [pattern, type] of this.queryPatterns) {
      if (pattern.test(lowerQuery)) {
        intent.type = type;
        break;
      }
    }

    // Extract specific parameters based on type
    switch (intent.type) {
      case 'error_search':
        intent.errorKeywords = this.extractErrorKeywords(query);
        intent.severity = this.extractSeverity(query);
        break;
        
      case 'test_failure_analysis':
        intent.testPattern = this.extractTestPattern(query);
        intent.testTypes = this.extractTestTypes(query);
        break;
        
      case 'correlation_trace':
        intent.correlationId = this.extractCorrelationId(query);
        intent.userId = this.extractUserId(query);
        break;
        
      case 'similar_issues':
        intent.referenceError = context.referenceError || this.extractErrorFromQuery(query);
        break;
    }

    return intent;
  }

  /**
   * Search for errors with intelligent filtering
   */
  async searchErrors(intent) {
    const { errorKeywords = [], timeRange, services = [], severity } = intent;
    
    // Build search query
    const searchQuery = [
      'error',
      ...errorKeywords,
      ...(severity ? [severity] : [])
    ].join(' ');

    // Search with filters
    const results = await this.searchProvider.searchProductionErrors(searchQuery, services, {
      filter: this.buildTimeFilter(timeRange),
      limit: this.config.maxResults,
      threshold: this.config.similarityThreshold
    });

    // Enrich with context
    const enrichedResults = await this.enrichResults(results);
    
    // Group by patterns
    const patterns = await this.groupResultsByPattern(enrichedResults);

    return {
      success: true,
      type: 'error_search',
      query: intent.originalQuery,
      results: enrichedResults,
      patterns,
      summary: {
        totalErrors: results.length,
        services: [...new Set(results.map(r => r.document?.service).filter(Boolean))],
        timeRange: timeRange || this.getDefaultTimeRange(),
        commonPatterns: patterns.slice(0, 3).map(p => p.description)
      }
    };
  }

  /**
   * Analyze test failures with production correlation
   */
  async analyzeTestFailures(intent) {
    const { testPattern, testTypes = [], timeRange } = intent;
    
    // Search for test failures
    const testFailures = await this.searchProvider.searchTestFailures(
      testPattern || intent.originalQuery,
      {
        filter: this.buildTimeFilter(timeRange),
        limit: 50
      }
    );

    // Find related production errors
    const relatedErrors = [];
    for (const failure of testFailures) {
      if (failure.document?.error) {
        const similar = await this.searchProvider.searchProductionErrors(
          failure.document.error,
          intent.services,
          { limit: 5, threshold: 0.6 }
        );
        relatedErrors.push(...similar);
      }
    }

    // Build timeline
    const timeline = await this.buildEventTimeline([
      ...testFailures.map(f => ({ ...f.document, _source: 'test' })),
      ...relatedErrors.map(e => ({ ...e.document, _source: 'production' }))
    ]);

    return {
      success: true,
      type: 'test_failure_analysis',
      query: intent.originalQuery,
      testFailures,
      relatedProductionErrors: relatedErrors,
      timeline,
      insights: {
        testFailureCount: testFailures.length,
        relatedErrorCount: relatedErrors.length,
        correlation: relatedErrors.length > 0,
        affectedServices: [...new Set([
          ...testFailures.map(t => t.document?.service),
          ...relatedErrors.map(e => e.document?.service)
        ].filter(Boolean))]
      }
    };
  }

  /**
   * Trace request/correlation across all events
   */
  async traceCorrelation(intent) {
    const { correlationId, userId } = intent;
    
    if (!correlationId && !userId) {
      throw new Error('Correlation ID or User ID required for tracing');
    }

    // Get full correlation trace
    const traceResults = correlationId 
      ? await this.searchProvider.traceCorrelationId(correlationId)
      : await this.traceUserActivity(userId, intent.timeRange);

    // Analyze the trace
    const analysis = this.analyzeTrace(traceResults);
    
    return {
      success: true,
      type: 'correlation_trace',
      correlationId,
      userId,
      trace: traceResults,
      analysis,
      summary: {
        totalEvents: traceResults.totalEvents || traceResults.timeline?.length || 0,
        timespan: traceResults.timespan,
        services: Object.keys(traceResults.eventTypes || {}),
        hasErrors: analysis.errorCount > 0,
        completionStatus: analysis.completionStatus
      }
    };
  }

  /**
   * Find similar issues to reference error
   */
  async findSimilarIssues(intent) {
    const { referenceError } = intent;
    
    if (!referenceError) {
      throw new Error('Reference error required for similarity search');
    }

    // Find similar errors
    const similarErrors = await this.searchProvider.findSimilarErrors(referenceError, {
      limit: 20,
      threshold: 0.7
    });

    // Analyze patterns in similar errors
    const patterns = await this.analyzeErrorPatterns(similarErrors);
    
    return {
      success: true,
      type: 'similar_issues',
      referenceError,
      similarErrors,
      patterns,
      recommendations: this.generateRecommendations(patterns)
    };
  }

  /**
   * Analyze patterns over time
   */
  async analyzePatterns(intent) {
    const timeRange = intent.timeRange || this.getDefaultTimeRange();
    
    // Get failure patterns
    const patterns = await this.searchProvider.analyzeFailurePatterns(timeRange);
    
    // Get trending issues
    const trendingErrors = await this.identifyTrendingErrors(timeRange);
    
    return {
      success: true,
      type: 'pattern_analysis',
      timeRange,
      patterns: patterns.patterns,
      trending: trendingErrors,
      insights: {
        totalPatterns: patterns.patterns.length,
        mostCommonError: patterns.patterns[0]?.representative?.message,
        affectedServices: patterns.patterns.reduce((acc, p) => {
          acc.push(...p.services);
          return [...new Set(acc)];
        }, [])
      }
    };
  }

  /**
   * Check service health based on recent events
   */
  async checkServiceHealth(intent) {
    const { services = [], timeRange } = intent;
    const checkTimeRange = timeRange || { start: Date.now() - 3600000 }; // 1 hour
    
    const healthStatus = {};
    
    for (const service of services) {
      // Get recent events for service
      const events = await this.searchProvider.find('events', {
        service,
        timestamp: { $gte: checkTimeRange.start }
      }, { limit: 1000, sort: { timestamp: -1 } });
      
      // Analyze health
      healthStatus[service] = this.analyzeServiceHealth(events);
    }
    
    return {
      success: true,
      type: 'service_health',
      services: healthStatus,
      overall: this.calculateOverallHealth(healthStatus),
      recommendations: this.generateHealthRecommendations(healthStatus)
    };
  }

  /**
   * Build detailed timeline of events
   */
  async buildTimeline(intent) {
    const { correlationId, timeRange, services } = intent;
    
    let events = [];
    
    if (correlationId) {
      const trace = await this.searchProvider.traceCorrelationId(correlationId);
      events = trace.timeline || [];
    } else {
      // Get events by time and services
      const filter = this.buildTimeFilter(timeRange);
      if (services?.length > 0) {
        filter.service = { $in: services };
      }
      
      const results = await this.searchProvider.find('events', filter, {
        limit: 500,
        sort: { timestamp: 1 }
      });
      
      events = results;
    }
    
    // Build enriched timeline
    const timeline = await this.buildEventTimeline(events);
    
    return {
      success: true,
      type: 'timeline_analysis',
      timeline,
      summary: {
        totalEvents: events.length,
        timeRange: {
          start: events[0]?.timestamp,
          end: events[events.length - 1]?.timestamp,
          duration: events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0
        },
        eventTypes: this.countEventTypes(events)
      }
    };
  }

  /**
   * Initialize query pattern matching
   */
  initializeQueryPatterns() {
    return new Map([
      // Test failure patterns - MUST come before error patterns
      [/test.*fail|failing.*test|unit.*test|integration.*test/i, 'test_failure_analysis'],
      [/analyze.*test|test.*analysis|jest.*fail/i, 'test_failure_analysis'],
      [/spec.*fail|describe.*fail|it\(.*fail/i, 'test_failure_analysis'],
      
      // Correlation tracing
      [/trace|follow|correlation|request.*id|user.*journey/i, 'correlation_trace'],
      [/what.*happen.*user|track.*request/i, 'correlation_trace'],
      
      // Error search patterns - After test patterns
      [/error|exception|failure|crash|bug/i, 'error_search'],
      [/what.*wrong|problem|issue|broken/i, 'error_search'],
      
      // Similar issues
      [/similar|like.*this|same.*error|related.*problem/i, 'similar_issues'],
      
      // Pattern analysis
      [/pattern|trend|frequent|recurring|common/i, 'pattern_analysis'],
      
      // Service health
      [/health|status|up.*down|available|performance/i, 'service_health'],
      
      // Timeline
      [/timeline|chronolog|sequence|order.*event|what.*when/i, 'timeline_analysis']
    ]);
  }

  /**
   * Extract time range from natural language
   */
  extractTimeRange(query) {
    const now = Date.now();
    const timePatterns = [
      { pattern: /last.*hour|past.*hour/i, ms: 3600000 },
      { pattern: /last.*day|past.*day|yesterday/i, ms: 86400000 },
      { pattern: /last.*week|past.*week/i, ms: 604800000 },
      { pattern: /last.*month|past.*month/i, ms: 2592000000 }
    ];
    
    for (const { pattern, ms } of timePatterns) {
      if (pattern.test(query)) {
        return { start: now - ms, end: now };
      }
    }
    
    return null;
  }

  /**
   * Extract service names from query
   */
  extractServices(query) {
    const services = [];
    const servicePatterns = [
      /api|gateway|service/i,
      /auth|login|authentication/i,
      /payment|billing|checkout/i,
      /database|db|mongo|postgres/i,
      /frontend|ui|client/i,
      /backend|server/i
    ];
    
    for (const pattern of servicePatterns) {
      if (pattern.test(query)) {
        const match = query.match(pattern);
        if (match) {
          services.push(match[0].toLowerCase());
        }
      }
    }
    
    return services;
  }

  /**
   * Extract entities from query
   */
  extractEntities(query) {
    const entities = [];
    const entityPatterns = [
      { pattern: /user|account|customer/i, entity: 'user' },
      { pattern: /order|purchase|transaction/i, entity: 'order' },
      { pattern: /payment|card|billing/i, entity: 'payment' },
      { pattern: /product|item|inventory/i, entity: 'product' }
    ];
    
    for (const { pattern, entity } of entityPatterns) {
      if (pattern.test(query)) {
        entities.push(entity);
      }
    }
    
    return entities;
  }

  /**
   * Build time-based filter
   */
  buildTimeFilter(timeRange) {
    if (!timeRange) {
      return { timestamp: { $gte: Date.now() - this.config.defaultTimeRange } };
    }
    
    const filter = { timestamp: {} };
    if (timeRange.start) filter.timestamp.$gte = timeRange.start;
    if (timeRange.end) filter.timestamp.$lte = timeRange.end;
    
    return filter;
  }

  /**
   * Get default time range
   */
  getDefaultTimeRange() {
    const now = Date.now();
    return {
      start: now - this.config.defaultTimeRange,
      end: now
    };
  }

  /**
   * Enrich results with additional context
   */
  async enrichResults(results) {
    if (!this.config.enableContextEnrichment) {
      return results;
    }
    
    // Add correlation context, similar errors, etc.
    return results.map(result => ({
      ...result,
      _enriched: true,
      _investigationId: this.generateInvestigationId()
    }));
  }

  /**
   * Group results by pattern
   */
  async groupResultsByPattern(results) {
    // Simple grouping by error message similarity
    const patterns = new Map();
    
    for (const result of results) {
      const key = this.extractPatternKey(result);
      if (!patterns.has(key)) {
        patterns.set(key, { count: 0, examples: [], description: key });
      }
      
      const pattern = patterns.get(key);
      pattern.count++;
      pattern.examples.push(result);
    }
    
    return Array.from(patterns.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Extract pattern key from result
   */
  extractPatternKey(result) {
    const doc = result.document || result;
    
    if (doc.error?.name) {
      return doc.error.name;
    }
    
    if (doc.message) {
      // Extract first few words as pattern
      return doc.message.split(' ').slice(0, 5).join(' ');
    }
    
    return doc.type || 'unknown';
  }

  /**
   * Build event timeline with proper ordering and context
   */
  async buildEventTimeline(events) {
    if (!events || events.length === 0) return [];
    
    // Sort by timestamp
    const sortedEvents = [...events].sort((a, b) => 
      (a.timestamp || a._source?.timestamp || 0) - (b.timestamp || b._source?.timestamp || 0)
    );
    
    // Add relative timing and context
    const startTime = sortedEvents[0].timestamp || sortedEvents[0]._source?.timestamp || 0;
    
    return sortedEvents.map((event, index) => {
      const timestamp = event.timestamp || event._source?.timestamp || 0;
      
      return {
        ...event,
        _timeline: {
          index,
          absoluteTime: new Date(timestamp).toISOString(),
          relativeTime: timestamp - startTime,
          nextEventDelay: index < sortedEvents.length - 1 
            ? (sortedEvents[index + 1].timestamp || 0) - timestamp 
            : null
        }
      };
    });
  }

  /**
   * Generate investigation ID for tracking
   */
  generateInvestigationId() {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate debugging suggestions
   */
  getSuggestions(query) {
    return [
      "Try being more specific about the time range (e.g., 'last hour')",
      "Include service names (e.g., 'api', 'database', 'frontend')",
      "Mention specific error types or status codes",
      "Use correlation IDs if available for better tracing"
    ];
  }

  /**
   * Extract correlation ID from query
   */
  extractCorrelationId(query) {
    const patterns = [
      /correlation[_\s]*id[:\s]+([a-zA-Z0-9\-_]+)/i,
      /corr[_\s]*id[:\s]+([a-zA-Z0-9\-_]+)/i,
      /trace[_\s]*id[:\s]+([a-zA-Z0-9\-_]+)/i,
      /id[:\s]+([a-zA-Z0-9\-_]{8,})/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Extract user ID from query
   */
  extractUserId(query) {
    const patterns = [
      /user[_\s]*id[:\s]+([a-zA-Z0-9\-]+)/i,
      /user[:\s]+([a-zA-Z0-9\-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Extract error keywords from query
   */
  extractErrorKeywords(query) {
    const errorWords = [];
    const words = query.toLowerCase().split(/\s+/);
    
    const errorTerms = [
      'timeout', 'connection', 'database', 'auth', 'authentication',
      'failed', 'error', 'exception', 'crash', 'bug', 'broken'
    ];
    
    words.forEach(word => {
      if (errorTerms.includes(word)) {
        errorWords.push(word);
      }
    });
    
    return errorWords;
  }

  /**
   * Extract severity from query
   */
  extractSeverity(query) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('critical') || lowerQuery.includes('severe')) return 'critical';
    if (lowerQuery.includes('high') || lowerQuery.includes('important')) return 'high';
    if (lowerQuery.includes('medium') || lowerQuery.includes('moderate')) return 'medium';
    if (lowerQuery.includes('low') || lowerQuery.includes('minor')) return 'low';
    return null;
  }

  /**
   * Extract test pattern from query
   */
  extractTestPattern(query) {
    const patterns = [
      /test[:\s]+([^,\s]+)/i,
      /spec[:\s]+([^,\s]+)/i,
      /describe[:\s]+([^,\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Extract test types from query
   */
  extractTestTypes(query) {
    const types = [];
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('unit')) types.push('unit');
    if (lowerQuery.includes('integration')) types.push('integration');
    if (lowerQuery.includes('e2e') || lowerQuery.includes('end-to-end')) types.push('e2e');
    if (lowerQuery.includes('component')) types.push('component');
    
    return types;
  }

  /**
   * Extract error from query for similarity search
   */
  extractErrorFromQuery(query) {
    // Simple extraction - in production this could be more sophisticated
    return { message: query };
  }

  /**
   * Trace user activity across events
   */
  async traceUserActivity(userId, timeRange) {
    const filter = this.buildTimeFilter(timeRange);
    filter.userId = userId;
    
    const events = await this.searchProvider.find('events', filter, {
      limit: 1000,
      sort: { timestamp: 1 }
    });
    
    return {
      userId,
      totalEvents: events.length,
      timespan: events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0,
      timeline: events
    };
  }

  /**
   * Analyze trace for patterns and issues
   */
  analyzeTrace(traceResults) {
    const events = traceResults.timeline || [];
    let errorCount = 0;
    let lastStatus = 'unknown';
    
    events.forEach(event => {
      if (event.level === 'error' || event.status === 'failed' || event.type === 'error_event') {
        errorCount++;
        lastStatus = 'error';
      } else if (event.status === 'success' || event.level === 'info') {
        lastStatus = 'success';
      }
    });
    
    return {
      errorCount,
      completionStatus: lastStatus,
      totalDuration: traceResults.timespan || 0,
      eventCount: events.length
    };
  }

  /**
   * Identify trending errors in time range
   */
  async identifyTrendingErrors(timeRange) {
    // Mock implementation - would analyze error frequency over time
    return [
      { error: 'Connection timeout', trend: 'increasing', count: 45 },
      { error: 'Authentication failed', trend: 'stable', count: 23 }
    ];
  }

  /**
   * Analyze service health from events
   */
  analyzeServiceHealth(events) {
    let errorCount = 0;
    let totalEvents = events.length;
    let lastActivity = 0;
    
    events.forEach(event => {
      if (event.level === 'error' || event.status === 'failed') errorCount++;
      if (event.timestamp > lastActivity) lastActivity = event.timestamp;
    });
    
    const errorRate = totalEvents > 0 ? errorCount / totalEvents : 0;
    const health = errorRate < 0.1 ? 'healthy' : errorRate < 0.3 ? 'warning' : 'critical';
    
    return {
      health,
      errorRate,
      errorCount,
      totalEvents,
      lastActivity: new Date(lastActivity).toISOString()
    };
  }

  /**
   * Calculate overall health from service health data
   */
  calculateOverallHealth(healthStatus) {
    const services = Object.values(healthStatus);
    const criticalCount = services.filter(s => s.health === 'critical').length;
    const warningCount = services.filter(s => s.health === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 0) return 'warning';
    return 'healthy';
  }

  /**
   * Generate health recommendations
   */
  generateHealthRecommendations(healthStatus) {
    const recommendations = [];
    
    Object.entries(healthStatus).forEach(([service, status]) => {
      if (status.health === 'critical') {
        recommendations.push({
          service,
          priority: 'high',
          action: `Immediate attention required for ${service} - error rate: ${(status.errorRate * 100).toFixed(1)}%`
        });
      } else if (status.health === 'warning') {
        recommendations.push({
          service,
          priority: 'medium',
          action: `Monitor ${service} closely - error rate increasing`
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Analyze error patterns
   */
  async analyzeErrorPatterns(errors) {
    // Group similar errors
    const patterns = new Map();
    
    errors.forEach(error => {
      const key = error.document?.error?.name || error.document?.type || 'unknown';
      if (!patterns.has(key)) {
        patterns.set(key, { count: 0, examples: [] });
      }
      patterns.get(key).count++;
      patterns.get(key).examples.push(error);
    });
    
    return Array.from(patterns.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      examples: data.examples.slice(0, 3) // First 3 examples
    })).sort((a, b) => b.count - a.count);
  }
  
  /**
   * Count event types for summary
   */
  countEventTypes(events) {
    const counts = {};
    for (const event of events) {
      const type = event.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Generate recommendations based on patterns
   */
  generateRecommendations(patterns) {
    const recommendations = [];
    
    // Add recommendations based on common patterns
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      recommendations.push({
        type: 'pattern_fix',
        description: `Consider investigating the root cause of: ${topPattern.description}`,
        priority: 'high',
        occurrences: topPattern.count
      });
    }
    
    return recommendations;
  }
}