/**
 * TraceCorrelator - Correlates frontend and backend traces using correlation IDs
 * 
 * Provides utilities for tracing requests through multiple system layers
 */

export class TraceCorrelator {
  constructor() {
    this.traces = new Map(); // correlationId -> trace events
    this.requestPairs = new Map(); // request -> response pairs
    this.userJourneys = new Map(); // session/user -> sequence of traces
  }

  /**
   * Add a trace event
   */
  addEvent(correlationId, event) {
    if (!this.traces.has(correlationId)) {
      this.traces.set(correlationId, {
        id: correlationId,
        events: [],
        startTime: null,
        endTime: null,
        layers: {
          user: [],
          frontend: [],
          backend: [],
          database: [],
          external: []
        },
        metadata: {}
      });
    }

    const trace = this.traces.get(correlationId);
    
    // Add event with normalized timestamp
    const normalizedEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      layer: this.detectLayer(event)
    };
    
    trace.events.push(normalizedEvent);
    
    // Categorize by layer
    trace.layers[normalizedEvent.layer].push(normalizedEvent);
    
    // Update time bounds
    if (!trace.startTime || normalizedEvent.timestamp < trace.startTime) {
      trace.startTime = normalizedEvent.timestamp;
    }
    if (!trace.endTime || normalizedEvent.timestamp > trace.endTime) {
      trace.endTime = normalizedEvent.timestamp;
    }

    // Detect request/response pairs
    this.detectRequestResponsePair(correlationId, normalizedEvent);
  }

  /**
   * Detect which layer an event belongs to
   */
  detectLayer(event) {
    const message = event.message || '';
    const type = event.type || '';
    
    // User layer (browser events)
    if (message.includes('click') || message.includes('submit') || 
        message.includes('User action') || message.includes('UI')) {
      return 'user';
    }
    
    // Frontend layer
    if (message.includes('fetch') || message.includes('XMLHttpRequest') ||
        message.includes('frontend') || message.includes('client')) {
      return 'frontend';
    }
    
    // Backend layer
    if (message.includes('GET /') || message.includes('POST /') ||
        message.includes('PUT /') || message.includes('DELETE /') ||
        message.includes('endpoint') || message.includes('route') ||
        message.includes('middleware')) {
      return 'backend';
    }
    
    // Database layer
    if (message.includes('query') || message.includes('SELECT') ||
        message.includes('INSERT') || message.includes('UPDATE') ||
        message.includes('DELETE FROM') || message.includes('database') ||
        message.includes('DB')) {
      return 'database';
    }
    
    // External services
    if (message.includes('external') || message.includes('third-party') ||
        message.includes('API call')) {
      return 'external';
    }
    
    // Default to backend if unclear
    return 'backend';
  }

  /**
   * Detect request/response pairs
   */
  detectRequestResponsePair(correlationId, event) {
    const message = event.message || '';
    
    // Detect request
    if (message.includes('request') || message.includes('Request') ||
        message.match(/^(GET|POST|PUT|DELETE|PATCH) /)) {
      const requestKey = `${correlationId}-request`;
      this.requestPairs.set(requestKey, {
        correlationId,
        request: event,
        response: null,
        duration: null
      });
    }
    
    // Detect response
    if (message.includes('response') || message.includes('Response') ||
        message.includes('status:') || message.match(/\d{3} \w+/)) {
      const requestKey = `${correlationId}-request`;
      if (this.requestPairs.has(requestKey)) {
        const pair = this.requestPairs.get(requestKey);
        pair.response = event;
        pair.duration = event.timestamp - pair.request.timestamp;
      }
    }
  }

  /**
   * Get complete trace for a correlation ID
   */
  getTrace(correlationId) {
    const trace = this.traces.get(correlationId);
    if (!trace) return null;
    
    // Calculate metrics
    const duration = trace.endTime - trace.startTime;
    const eventCount = trace.events.length;
    const layerCounts = {};
    
    Object.entries(trace.layers).forEach(([layer, events]) => {
      layerCounts[layer] = events.length;
    });
    
    return {
      ...trace,
      duration,
      eventCount,
      layerCounts,
      timeline: this.buildTimeline(trace)
    };
  }

  /**
   * Build a timeline of events
   */
  buildTimeline(trace) {
    const timeline = [];
    const startTime = trace.startTime;
    
    trace.events
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((event, index) => {
        timeline.push({
          index,
          relativeTime: event.timestamp - startTime,
          absoluteTime: event.timestamp,
          layer: event.layer,
          type: event.type,
          message: event.message,
          metadata: event.metadata || {}
        });
      });
    
    return timeline;
  }

  /**
   * Correlate frontend and backend events
   */
  correlateFrontendBackend(correlationId) {
    const trace = this.getTrace(correlationId);
    if (!trace) return null;
    
    const correlation = {
      correlationId,
      pairs: [],
      gaps: [],
      flow: []
    };
    
    // Find frontend -> backend pairs
    const frontendEvents = trace.layers.frontend || [];
    const backendEvents = trace.layers.backend || [];
    
    frontendEvents.forEach(feEvent => {
      // Find corresponding backend event
      const beEvent = backendEvents.find(be => 
        be.timestamp > feEvent.timestamp &&
        be.timestamp - feEvent.timestamp < 1000 // Within 1 second
      );
      
      if (beEvent) {
        correlation.pairs.push({
          frontend: feEvent,
          backend: beEvent,
          latency: beEvent.timestamp - feEvent.timestamp
        });
      }
    });
    
    // Identify gaps in the flow
    for (let i = 1; i < trace.events.length; i++) {
      const gap = trace.events[i].timestamp - trace.events[i - 1].timestamp;
      if (gap > 100) { // More than 100ms gap
        correlation.gaps.push({
          before: trace.events[i - 1],
          after: trace.events[i],
          duration: gap
        });
      }
    }
    
    // Build flow diagram
    correlation.flow = this.buildFlowDiagram(trace);
    
    return correlation;
  }

  /**
   * Build a flow diagram of the trace
   */
  buildFlowDiagram(trace) {
    const flow = [];
    const layers = ['user', 'frontend', 'backend', 'database', 'external'];
    
    trace.events
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(event => {
        const fromLayer = flow.length > 0 ? flow[flow.length - 1].layer : null;
        const toLayer = event.layer;
        
        if (fromLayer && fromLayer !== toLayer) {
          // Cross-layer transition
          flow.push({
            type: 'transition',
            from: fromLayer,
            to: toLayer,
            timestamp: event.timestamp,
            relativeTime: event.timestamp - trace.startTime
          });
        }
        
        flow.push({
          type: 'event',
          layer: toLayer,
          message: event.message,
          timestamp: event.timestamp,
          relativeTime: event.timestamp - trace.startTime
        });
      });
    
    return flow;
  }

  /**
   * Analyze user journey across multiple traces
   */
  analyzeUserJourney(sessionId, correlationIds) {
    const journey = {
      sessionId,
      traces: [],
      totalDuration: 0,
      actions: [],
      errors: []
    };
    
    correlationIds.forEach(correlationId => {
      const trace = this.getTrace(correlationId);
      if (!trace) return;
      
      journey.traces.push({
        correlationId,
        duration: trace.duration,
        eventCount: trace.eventCount,
        hasErrors: trace.events.some(e => e.type === 'error')
      });
      
      journey.totalDuration += trace.duration;
      
      // Extract user actions
      trace.layers.user.forEach(event => {
        journey.actions.push({
          action: event.message,
          timestamp: event.timestamp,
          correlationId
        });
      });
      
      // Collect errors
      trace.events
        .filter(e => e.type === 'error')
        .forEach(error => {
          journey.errors.push({
            error: error.message,
            timestamp: error.timestamp,
            correlationId
          });
        });
    });
    
    // Sort actions by timestamp
    journey.actions.sort((a, b) => a.timestamp - b.timestamp);
    
    this.userJourneys.set(sessionId, journey);
    return journey;
  }

  /**
   * Get performance metrics for a trace
   */
  getTraceMetrics(correlationId) {
    const trace = this.getTrace(correlationId);
    if (!trace) return null;
    
    const metrics = {
      correlationId,
      duration: trace.duration,
      eventCount: trace.eventCount,
      layerMetrics: {},
      transitions: [],
      bottlenecks: []
    };
    
    // Calculate time spent in each layer
    Object.entries(trace.layers).forEach(([layer, events]) => {
      if (events.length === 0) return;
      
      const layerTimes = [];
      for (let i = 0; i < events.length - 1; i++) {
        layerTimes.push(events[i + 1].timestamp - events[i].timestamp);
      }
      
      metrics.layerMetrics[layer] = {
        events: events.length,
        totalTime: layerTimes.reduce((a, b) => a + b, 0),
        avgTime: layerTimes.length > 0 ? 
          layerTimes.reduce((a, b) => a + b, 0) / layerTimes.length : 0
      };
    });
    
    // Identify layer transitions
    let previousLayer = null;
    trace.events.forEach(event => {
      if (previousLayer && previousLayer !== event.layer) {
        metrics.transitions.push({
          from: previousLayer,
          to: event.layer,
          timestamp: event.timestamp
        });
      }
      previousLayer = event.layer;
    });
    
    // Identify bottlenecks (slow segments)
    for (let i = 1; i < trace.events.length; i++) {
      const duration = trace.events[i].timestamp - trace.events[i - 1].timestamp;
      if (duration > 100) { // Over 100ms
        metrics.bottlenecks.push({
          between: [trace.events[i - 1].message, trace.events[i].message],
          duration,
          severity: duration > 500 ? 'critical' : duration > 200 ? 'high' : 'medium'
        });
      }
    }
    
    // Sort bottlenecks by duration
    metrics.bottlenecks.sort((a, b) => b.duration - a.duration);
    
    return metrics;
  }

  /**
   * Generate visualization data for a trace
   */
  generateVisualization(correlationId) {
    const trace = this.getTrace(correlationId);
    if (!trace) return null;
    
    const viz = {
      correlationId,
      duration: trace.duration,
      layers: ['user', 'frontend', 'backend', 'database', 'external'],
      events: [],
      connections: []
    };
    
    // Add events with positions
    trace.timeline.forEach((event, index) => {
      viz.events.push({
        id: `event-${index}`,
        layer: event.layer,
        x: this.getLayerPosition(event.layer),
        y: event.relativeTime,
        label: event.message.substring(0, 30),
        type: event.type
      });
    });
    
    // Add connections between events
    for (let i = 1; i < trace.timeline.length; i++) {
      viz.connections.push({
        from: `event-${i - 1}`,
        to: `event-${i}`,
        duration: trace.timeline[i].relativeTime - trace.timeline[i - 1].relativeTime
      });
    }
    
    return viz;
  }

  /**
   * Get layer position for visualization
   */
  getLayerPosition(layer) {
    const positions = {
      user: 0,
      frontend: 1,
      backend: 2,
      database: 3,
      external: 4
    };
    return positions[layer] || 2;
  }

  /**
   * Generate text-based trace diagram
   */
  generateTextDiagram(correlationId) {
    const correlation = this.correlateFrontendBackend(correlationId);
    if (!correlation) return 'No trace found';
    
    const trace = this.getTrace(correlationId);
    
    let diagram = `\n╔══════════════════════════════════════════════╗\n`;
    diagram += `║  Trace: ${correlationId.substring(0, 20)}...  ║\n`;
    diagram += `║  Duration: ${trace.duration}ms                 ║\n`;
    diagram += `╚══════════════════════════════════════════════╝\n\n`;
    
    diagram += 'User      Frontend    Backend     Database    External\n';
    diagram += '═══════   ═════════   ═════════   ═════════   ═══════\n';
    
    // Create timeline with events
    trace.timeline.forEach(event => {
      let line = '';
      
      // Add markers for each layer
      ['user', 'frontend', 'backend', 'database', 'external'].forEach(layer => {
        if (event.layer === layer) {
          line += '  ●     ';
        } else {
          line += '  │     ';
        }
      });
      
      // Add time and message
      line += ` [${event.relativeTime}ms] ${event.message.substring(0, 40)}`;
      
      diagram += line + '\n';
      
      // Add connection lines
      if (event.index < trace.timeline.length - 1) {
        let connLine = '';
        const nextEvent = trace.timeline[event.index + 1];
        const fromPos = this.getLayerPosition(event.layer);
        const toPos = this.getLayerPosition(nextEvent.layer);
        
        if (fromPos !== toPos) {
          // Cross-layer connection
          ['user', 'frontend', 'backend', 'database', 'external'].forEach((layer, idx) => {
            if (idx === fromPos) {
              connLine += '  ╰';
            } else if (idx === toPos) {
              connLine += '──╮     ';
            } else if (idx > Math.min(fromPos, toPos) && idx < Math.max(fromPos, toPos)) {
              connLine += '───     ';
            } else {
              connLine += '  │     ';
            }
          });
          diagram += connLine + '\n';
        }
      }
    });
    
    // Add summary
    diagram += '\n' + '═'.repeat(50) + '\n';
    diagram += 'Summary:\n';
    diagram += `  Total Events: ${trace.eventCount}\n`;
    diagram += `  Layer Distribution:\n`;
    Object.entries(trace.layerCounts).forEach(([layer, count]) => {
      if (count > 0) {
        diagram += `    ${layer}: ${count} events\n`;
      }
    });
    
    if (correlation.gaps.length > 0) {
      diagram += `  Performance Gaps: ${correlation.gaps.length}\n`;
      correlation.gaps.slice(0, 3).forEach(gap => {
        diagram += `    ${gap.duration}ms gap detected\n`;
      });
    }
    
    return diagram;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const summary = {
      totalTraces: this.traces.size,
      totalEvents: 0,
      avgDuration: 0,
      avgEventsPerTrace: 0,
      layerDistribution: {},
      topBottlenecks: []
    };
    
    let totalDuration = 0;
    const allBottlenecks = [];
    
    this.traces.forEach(trace => {
      summary.totalEvents += trace.events.length;
      const duration = trace.endTime - trace.startTime;
      totalDuration += duration;
      
      // Count layer distribution
      Object.entries(trace.layers).forEach(([layer, events]) => {
        summary.layerDistribution[layer] = (summary.layerDistribution[layer] || 0) + events.length;
      });
      
      // Collect bottlenecks
      const metrics = this.getTraceMetrics(trace.id);
      if (metrics && metrics.bottlenecks) {
        allBottlenecks.push(...metrics.bottlenecks);
      }
    });
    
    summary.avgDuration = this.traces.size > 0 ? totalDuration / this.traces.size : 0;
    summary.avgEventsPerTrace = this.traces.size > 0 ? summary.totalEvents / this.traces.size : 0;
    
    // Top bottlenecks across all traces
    summary.topBottlenecks = allBottlenecks
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    return summary;
  }

  /**
   * Clear all data
   */
  clear() {
    this.traces.clear();
    this.requestPairs.clear();
    this.userJourneys.clear();
  }
}