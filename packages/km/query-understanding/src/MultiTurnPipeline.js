/**
 * MultiTurnPipeline - Multi-turn conversation wrapper for QueryUnderstandingPipeline
 *
 * Manages conversation state, injects context into Phase 1 for pronoun resolution,
 * and tracks entities across turns for coreference resolution.
 *
 * @module @legion/query-understanding
 */

import { QueryUnderstandingPipeline } from './QueryUnderstandingPipeline.js';
import { ConversationContext } from './context/ConversationContext.js';
import { GraphContextRetriever } from './context/GraphContextRetriever.js';

export class MultiTurnPipeline {
  /**
   * Create a new MultiTurnPipeline
   *
   * @param {Object} resourceManager - ResourceManager instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxTurns=10] - Maximum conversation turns to keep
   * @param {string} [options.domain] - Domain hint for queries
   * @throws {Error} If resourceManager not provided
   */
  constructor(resourceManager, options = {}) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    this.options = options;
    this.domain = options.domain || null;

    // Create underlying pipeline
    this.pipeline = new QueryUnderstandingPipeline(resourceManager);

    // Create conversation context
    this.conversationContext = new ConversationContext({
      maxTurns: options.maxTurns || 10
    });

    // GraphContextRetriever will be initialized after pipeline.initialize()
    this.graphContextRetriever = null;
  }

  /**
   * Initialize the pipeline
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.pipeline.initialize();

    // Initialize GraphContextRetriever with the DataSource from the pipeline
    const dataSource = this.pipeline.dataSource;
    if (!dataSource) {
      throw new Error('Pipeline dataSource not available after initialization');
    }

    this.graphContextRetriever = new GraphContextRetriever(dataSource, {
      defaultRadius: 1,
      maxEntities: 10
    });
  }

  /**
   * Ask a question in the context of the conversation
   *
   * @param {string} question - Natural language question
   * @param {Object} additionalContext - Additional context to merge
   * @returns {Promise<Object>} Query results with canonicalQuestion, query, and results
   */
  async ask(question, additionalContext = {}) {
    // Collect entities to retrieve graph context for
    const entitiesToRetrieve = [];

    // 1. Add recent entities from conversation history (from questions)
    const recentEntities = this.conversationContext.getRecentEntities(3);
    entitiesToRetrieve.push(...recentEntities);

    // 2. Add entities from previous results (the answers from last turn)
    const lastResults = this.conversationContext.getLastResults();
    if (lastResults && Array.isArray(lastResults)) {
      for (const result of lastResults) {
        if (result.name) {
          // Extract entities from result objects
          entitiesToRetrieve.push({
            value: result.name,
            canonical: result.canonical || `:${result.name.replace(/\s+/g, '_')}`,
            type: result.type || 'Entity'
          });
        }
      }
    }

    // Retrieve graph context (entities + properties + 1-hop neighbors)
    let graphContext = {};
    if (this.graphContextRetriever && entitiesToRetrieve.length > 0) {
      try {
        graphContext = await this.graphContextRetriever.retrieveContext(entitiesToRetrieve, 1);
      } catch (error) {
        // Log but continue without graph context (fail gracefully)
        console.warn('Failed to retrieve graph context:', error.message);
      }
    }

    // Build context for Phase 1 (pronoun resolution)
    const context = {
      ...additionalContext,
      previousQuestion: this.conversationContext.getPreviousQuestion(),
      conversationHistory: this.conversationContext.getConversationHistory(),
      previousResults: lastResults,
      graphContext: graphContext,
      domain: this.domain
    };

    // Process question through pipeline with conversation context
    const result = await this.pipeline.process(question, context);

    // Add this turn to conversation context
    this.conversationContext.addTurn({
      question: question,
      canonicalQuestion: result.canonicalQuestion,
      query: result.query,
      results: result.results || []
    });

    return result;
  }

  /**
   * Get conversation context
   *
   * @returns {ConversationContext} The conversation context
   */
  getContext() {
    return this.conversationContext;
  }

  /**
   * Get recent entities from conversation
   *
   * @param {number} [limit=10] - Maximum number of entities to return
   * @returns {Array<Object>} Recent entities
   */
  getRecentEntities(limit = 10) {
    return this.conversationContext.getRecentEntities(limit);
  }

  /**
   * Get the most salient entity
   *
   * @returns {Object|null} Most recent entity or null
   */
  getMostSalientEntity() {
    return this.conversationContext.getMostSalientEntity();
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.conversationContext.clear();
  }

  /**
   * Serialize conversation state to JSON string
   *
   * @returns {string} JSON string representation
   */
  serialize() {
    return this.conversationContext.serialize();
  }

  /**
   * Deserialize conversation state from JSON string
   *
   * @param {string} json - JSON string representation
   */
  deserialize(json) {
    this.conversationContext = ConversationContext.deserialize(json);
  }
}

export default MultiTurnPipeline;
