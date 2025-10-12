/**
 * ConversationContext - Manages multi-turn conversation state
 *
 * Tracks conversation history, entity salience, and provides context
 * for pronoun resolution and referring expression handling.
 *
 * @module @legion/query-understanding/context
 */

export class ConversationContext {
  /**
   * Create a new ConversationContext
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.maxTurns=10] - Maximum conversation turns to keep
   */
  constructor(options = {}) {
    this.maxTurns = options.maxTurns || 10;
    this.turns = [];
  }

  /**
   * Add a conversation turn
   *
   * @param {Object} turn - Turn data
   * @param {string} turn.question - Original user question
   * @param {Object} turn.canonicalQuestion - Normalized question from Phase 1
   * @param {Object} turn.query - Generated DataScript query
   * @param {Array} turn.results - Query execution results
   */
  addTurn(turn) {
    this.turns.push({
      question: turn.question,
      canonicalQuestion: turn.canonicalQuestion,
      query: turn.query,
      results: turn.results,
      timestamp: Date.now()
    });

    // Enforce maxTurns limit (remove oldest)
    if (this.turns.length > this.maxTurns) {
      this.turns.shift();
    }
  }

  /**
   * Get all conversation turns
   *
   * @returns {Array} Array of turn objects
   */
  getTurns() {
    return this.turns;
  }

  /**
   * Get the previous question
   *
   * @returns {string|null} Previous question or null if no turns
   */
  getPreviousQuestion() {
    if (this.turns.length === 0) {
      return null;
    }
    return this.turns[this.turns.length - 1].question;
  }

  /**
   * Get conversation history as array of questions
   *
   * @returns {Array<string>} Array of questions in chronological order
   */
  getConversationHistory() {
    return this.turns.map(turn => turn.question);
  }

  /**
   * Get recent entities from conversation, ranked by recency
   *
   * @param {number} [limit=10] - Maximum number of entities to return
   * @returns {Array<Object>} Array of entity objects with turnIndex
   */
  getRecentEntities(limit = 10) {
    const entities = [];

    // Iterate turns in reverse order (most recent first)
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const turn = this.turns[i];

      // Extract entities from results FIRST (more recent in turn timeline)
      if (turn.results && Array.isArray(turn.results)) {
        for (const result of turn.results) {
          if (result.name) {
            entities.push({
              value: result.name,
              canonical: result.canonical || `:${result.name.replace(/\s+/g, '_')}`,
              type: result.type || 'Entity',
              turnIndex: i
            });
          }
        }
      }

      // Extract entities from canonical question
      if (turn.canonicalQuestion && turn.canonicalQuestion.entities) {
        for (const entity of turn.canonicalQuestion.entities) {
          entities.push({
            value: entity.value,
            canonical: entity.canonical,
            type: entity.type,
            turnIndex: i
          });
        }
      }

      // Stop if we have enough entities
      if (entities.length >= limit) {
        break;
      }
    }

    return entities.slice(0, limit);
  }

  /**
   * Get the most salient (most recently mentioned) entity
   *
   * @returns {Object|null} Most recent entity or null if none
   */
  getMostSalientEntity() {
    const entities = this.getRecentEntities(1);
    return entities.length > 0 ? entities[0] : null;
  }

  /**
   * Get results from the last turn
   *
   * @returns {Array|null} Results array from last turn or null if no turns
   */
  getLastResults() {
    if (this.turns.length === 0) {
      return null;
    }
    return this.turns[this.turns.length - 1].results || null;
  }

  /**
   * Serialize conversation context to JSON string
   *
   * @returns {string} JSON string representation
   */
  serialize() {
    return JSON.stringify({
      maxTurns: this.maxTurns,
      turns: this.turns
    });
  }

  /**
   * Deserialize conversation context from JSON string
   *
   * @param {string} json - JSON string representation
   * @returns {ConversationContext} Restored context
   */
  static deserialize(json) {
    const data = JSON.parse(json);
    const context = new ConversationContext({ maxTurns: data.maxTurns });
    context.turns = data.turns || [];
    return context;
  }

  /**
   * Clear all conversation turns
   */
  clear() {
    this.turns = [];
  }
}

export default ConversationContext;
