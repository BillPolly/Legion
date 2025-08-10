/**
 * EventSemanticSearchProvider - Specialized semantic search for events and logs
 * 
 * Extends SemanticSearchProvider with event-specific search capabilities,
 * local embeddings, and intelligent agent query interfaces.
 */

import { SemanticSearchProvider } from '../SemanticSearchProvider.js';
import { LocalEmbeddingService } from '../services/LocalEmbeddingService.js';
import { DocumentProcessor } from '../utils/DocumentProcessor.js';

export class EventSemanticSearchProvider extends SemanticSearchProvider {
  /**
   * Create event-aware semantic search provider
   */
  static async create(resourceManager, config = {}) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    if (!resourceManager.initialized) {
      throw new Error('EventSemanticSearchProvider requires an initialized ResourceManager');
    }

    // Enhanced config for event processing
    const eventConfig = {
      useLocalEmbeddings: config.useLocalEmbeddings !== false, // Default to true
      embeddingDimensions: config.embeddingDimensions || 384,
      eventBufferSize: config.eventBufferSize || 1000,
      embeddingBatchSize: config.embeddingBatchSize || 100,
      enableAsyncEmbedding: config.enableAsyncEmbedding !== false,
      correlationTracking: config.correlationTracking !== false,
      ...config
    };

    // Get base configuration from ResourceManager
    const baseConfig = {
      qdrantUrl: resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333',
      qdrantApiKey: resourceManager.get('env.QDRANT_API_KEY'),
      cacheTtl: parseInt(resourceManager.get('env.SEMANTIC_SEARCH_CACHE_TTL') || '3600'),
      enableCache: resourceManager.get('env.SEMANTIC_SEARCH_ENABLE_CACHE') !== 'false'
    };

    // Create dependencies
    const dependencies = {
      _factoryCall: true,
      resourceManager,
      embeddingService: eventConfig.useLocalEmbeddings 
        ? new LocalEmbeddingService({
            modelPath: eventConfig.localModelPath,
            dimensions: eventConfig.embeddingDimensions,
            batchSize: eventConfig.embeddingBatchSize
          })
        : null, // Will fall back to OpenAI if needed
      documentProcessor: new DocumentProcessor({
        ...eventConfig,
        weightedFields: {
          message: 3.0,
          error: 2.5,
          testName: 2.0,
          eventType: 1.8,
          service: 1.5,
          level: 1.2,
          context: 1.0
        }
      })
    };

    // Initialize local embeddings if configured
    if (dependencies.embeddingService) {
      await dependencies.embeddingService.initialize();
    }

    // Create provider with event-specific configuration
    const provider = new EventSemanticSearchProvider({
      ...baseConfig,
      ...eventConfig
    }, dependencies);

    // Register with ResourceManager
    if (resourceManager.register) {
      resourceManager.register('eventSemanticSearchProvider', provider);
    }

    return provider;
  }

  constructor(config, dependencies) {
    // Call parent constructor
    super(config, dependencies);
    
    // Event-specific configuration
    this.eventConfig = config;
    this.embeddingQueue = [];
    this.correlationIndex = new Map();
    this.eventTypeStats = new Map();
    
    // Setup async embedding processing
    if (config.enableAsyncEmbedding) {
      this.setupAsyncEmbedding();
    }
  }

  /**
   * Index an event with semantic search capabilities
   */
  async indexEvent(event) {
    try {
      // Process event for search
      const processedEvent = this.processEventForSearch(event);
      
      // Generate embedding
      let embedding;
      if (this.embeddingService && this.embeddingService.embedLogEvent) {
        embedding = await this.embeddingService.embedLogEvent(processedEvent);
      } else {
        // Fall back to text-based embedding
        const searchText = this.documentProcessor.processDocument(processedEvent).searchText;
        const embeddings = await this.embeddingService.generateEmbeddings([searchText]);
        embedding = embeddings[0];
      }

      // Store in vector database with event metadata
      await this.vectorStore.upsert('events', [{
        id: processedEvent.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        vector: embedding,
        payload: {
          ...processedEvent,
          _indexed_at: new Date().toISOString(),
          _embedding_method: this.embeddingService?.constructor.name || 'unknown'
        }
      }]);

      // Update correlation tracking
      if (this.eventConfig.correlationTracking && processedEvent.correlationId) {
        this.updateCorrelationIndex(processedEvent);
      }

      // Update event type statistics
      this.updateEventStats(processedEvent);

      return {
        success: true,
        eventId: processedEvent.eventId,
        embedded: true
      };

    } catch (error) {
      console.error('Event indexing failed:', error);
      return {
        success: false,
        error: error.message,
        eventId: event.eventId
      };
    }
  }

  /**
   * Process event specifically for search indexing
   */
  processEventForSearch(event) {
    const processed = { ...event };
    
    // Ensure we have required fields
    if (!processed.eventId) {
      processed.eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    if (!processed.timestamp) {
      processed.timestamp = Date.now();
    }

    // Create searchable text from event
    processed.searchText = this.extractSearchableText(event);
    
    // Add search tags
    processed.searchTags = this.generateSearchTags(event);
    
    return processed;
  }

  /**
   * Extract searchable text from event
   */
  extractSearchableText(event) {
    const textParts = [];
    
    // Event type and level
    if (event.type) textParts.push(`Type: ${event.type}`);
    if (event.level) textParts.push(`Level: ${event.level}`);
    
    // Main content
    if (event.message) textParts.push(event.message);
    if (event.testName) textParts.push(`Test: ${event.testName}`);
    if (event.eventType) textParts.push(`Event: ${event.eventType}`);
    
    // Error information
    if (event.error?.message) textParts.push(`Error: ${event.error.message}`);
    if (event.error?.name) textParts.push(`ErrorType: ${event.error.name}`);
    
    // Context
    if (event.service) textParts.push(`Service: ${event.service}`);
    if (event.method && event.url) textParts.push(`${event.method} ${event.url}`);
    
    // Additional context
    if (event.context) {
      Object.entries(event.context).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 100) {
          textParts.push(`${key}: ${value}`);
        }
      });
    }
    
    return textParts.join('. ');
  }

  /**
   * Generate search tags for better filtering
   */
  generateSearchTags(event) {
    const tags = [];
    
    // Basic tags
    if (event.type) tags.push(event.type);
    if (event.level) tags.push(event.level);
    if (event.eventType) tags.push(event.eventType);
    if (event.service) tags.push(`service:${event.service}`);
    
    // Status tags
    if (event.status) tags.push(`status:${event.status}`);
    if (event.success !== undefined) tags.push(event.success ? 'success' : 'failure');
    
    // Error tags
    if (event.error) {
      tags.push('has-error');
      if (event.error.name) tags.push(`error:${event.error.name}`);
    }
    
    // Test tags
    if (event.testName) {
      tags.push('test-event');
      if (event.status === 'failed') tags.push('test-failure');
    }
    
    // API tags
    if (event.method) {
      tags.push('api-call');
      tags.push(`method:${event.method}`);
      if (event.status >= 400) tags.push('api-error');
    }
    
    return tags;
  }

  /**
   * Search for test failures with context
   */
  async searchTestFailures(query, options = {}) {
    const searchOptions = {
      filter: {
        type: 'jest_test',
        status: 'failed',
        ...options.filter
      },
      limit: options.limit || 20,
      threshold: options.threshold || 0.7,
      ...options
    };

    return await this.semanticSearch('events', query, searchOptions);
  }

  /**
   * Search for production errors similar to test failures
   */
  async searchProductionErrors(query, services = [], options = {}) {
    const searchOptions = {
      filter: {
        $or: [
          { type: 'production_log', level: 'error' },
          { type: 'error_event' },
          { type: 'runtime_event', eventType: 'error' }
        ],
        ...options.filter
      },
      limit: options.limit || 20,
      threshold: options.threshold || 0.6,
      ...options
    };

    if (services.length > 0) {
      searchOptions.filter.service = { $in: services };
    }

    return await this.semanticSearch('events', query, searchOptions);
  }

  /**
   * Trace all events by correlation ID
   */
  async traceCorrelationId(correlationId, options = {}) {
    const events = await this.find('events', {
      correlationId: correlationId
    }, {
      sort: { timestamp: 1 },
      limit: options.limit || 1000,
      ...options
    });

    // Group by event type for better analysis
    const timeline = events.map(event => ({
      ...event,
      _timeFromStart: events.length > 0 ? event.timestamp - events[0].timestamp : 0
    }));

    return {
      correlationId,
      totalEvents: events.length,
      timespan: events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0,
      timeline,
      eventTypes: this.groupEventsByType(events)
    };
  }

  /**
   * Find similar errors across all event types
   */
  async findSimilarErrors(errorEvent, options = {}) {
    // Use the error message or event description for similarity search
    const query = errorEvent.error?.message || errorEvent.message || '';
    
    if (!query) {
      throw new Error('No searchable content in error event');
    }

    return await this.semanticSearch('events', query, {
      filter: {
        $or: [
          { level: 'error' },
          { type: 'error_event' },
          { status: 'failed' },
          { 'error.message': { $exists: true } }
        ],
        // Exclude the original event
        eventId: { $ne: errorEvent.eventId }
      },
      limit: options.limit || 10,
      threshold: options.threshold || 0.8,
      ...options
    });
  }

  /**
   * Analyze patterns in failed events
   */
  async analyzeFailurePatterns(timeRange = {}, options = {}) {
    const startTime = timeRange.start || Date.now() - 86400000; // 24 hours ago
    const endTime = timeRange.end || Date.now();

    // Get all failures in time range
    const failures = await this.find('events', {
      $or: [
        { level: 'error' },
        { status: 'failed' },
        { type: 'error_event' }
      ],
      timestamp: { $gte: startTime, $lte: endTime }
    }, { limit: 1000 });

    // Group by similarity
    const patterns = await this.groupBySimilarity(failures, 0.8);
    
    return {
      timeRange: { start: startTime, end: endTime },
      totalFailures: failures.length,
      patterns: patterns.map(pattern => ({
        count: pattern.events.length,
        representative: pattern.representative,
        services: [...new Set(pattern.events.map(e => e.service).filter(Boolean))],
        errorTypes: [...new Set(pattern.events.map(e => e.error?.name || e.type).filter(Boolean))]
      }))
    };
  }

  /**
   * Setup async embedding processing
   */
  setupAsyncEmbedding() {
    // Process embedding queue periodically
    this.embeddingTimer = setInterval(async () => {
      if (this.embeddingQueue.length > 0) {
        await this.processEmbeddingQueue();
      }
    }, 1000); // Process every second

    // Allow process to exit
    if (this.embeddingTimer.unref) {
      this.embeddingTimer.unref();
    }
  }

  /**
   * Process queued events for embedding
   */
  async processEmbeddingQueue() {
    const batch = this.embeddingQueue.splice(0, this.eventConfig.embeddingBatchSize);
    if (batch.length === 0) return;

    try {
      // Process batch of events
      await Promise.all(batch.map(event => this.indexEvent(event)));
    } catch (error) {
      console.error('Batch embedding processing failed:', error);
      // Could implement retry logic here
    }
  }

  /**
   * Update correlation index for faster lookups
   */
  updateCorrelationIndex(event) {
    if (!event.correlationId) return;
    
    if (!this.correlationIndex.has(event.correlationId)) {
      this.correlationIndex.set(event.correlationId, []);
    }
    
    this.correlationIndex.get(event.correlationId).push({
      eventId: event.eventId,
      type: event.type,
      timestamp: event.timestamp
    });
  }

  /**
   * Update event type statistics
   */
  updateEventStats(event) {
    const key = event.type || 'unknown';
    const stats = this.eventTypeStats.get(key) || { count: 0, lastSeen: 0 };
    
    stats.count++;
    stats.lastSeen = event.timestamp;
    
    this.eventTypeStats.set(key, stats);
  }

  /**
   * Group events by type
   */
  groupEventsByType(events) {
    const groups = {};
    
    for (const event of events) {
      const type = event.type || 'unknown';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(event);
    }
    
    return groups;
  }

  /**
   * Group events by semantic similarity
   */
  async groupBySimilarity(events, threshold = 0.8) {
    if (events.length === 0) return [];
    
    const patterns = [];
    const used = new Set();
    
    for (let i = 0; i < events.length; i++) {
      if (used.has(i)) continue;
      
      const representative = events[i];
      const similar = [representative];
      used.add(i);
      
      // Find similar events
      for (let j = i + 1; j < events.length; j++) {
        if (used.has(j)) continue;
        
        const candidate = events[j];
        const similarity = await this.calculateSimilarity(representative, candidate);
        
        if (similarity >= threshold) {
          similar.push(candidate);
          used.add(j);
        }
      }
      
      if (similar.length > 1) { // Only include patterns with multiple events
        patterns.push({
          representative,
          events: similar,
          count: similar.length
        });
      }
    }
    
    return patterns.sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate similarity between two events
   */
  async calculateSimilarity(event1, event2) {
    // Simple similarity based on message content
    // In production, this could use actual embedding similarity
    const text1 = this.extractSearchableText(event1).toLowerCase();
    const text2 = this.extractSearchableText(event2).toLowerCase();
    
    // Jaccard similarity on words
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Get enhanced statistics
   */
  getStatistics() {
    const baseStats = super.getStatistics();
    
    return {
      ...baseStats,
      events: {
        queueSize: this.embeddingQueue.length,
        correlationIndex: this.correlationIndex.size,
        eventTypeStats: Object.fromEntries(this.eventTypeStats),
        localEmbeddings: this.embeddingService?.getStats?.() || null
      }
    };
  }

  /**
   * Enhanced cleanup
   */
  async cleanup() {
    // Clear async processing
    if (this.embeddingTimer) {
      clearInterval(this.embeddingTimer);
      this.embeddingTimer = null;
    }
    
    // Process remaining queue
    if (this.embeddingQueue.length > 0) {
      await this.processEmbeddingQueue();
    }
    
    // Clear indexes
    this.correlationIndex.clear();
    this.eventTypeStats.clear();
    this.embeddingQueue = [];
    
    // Cleanup embedding service
    if (this.embeddingService && this.embeddingService.cleanup) {
      await this.embeddingService.cleanup();
    }
    
    // Call parent cleanup
    await super.disconnect();
  }
}