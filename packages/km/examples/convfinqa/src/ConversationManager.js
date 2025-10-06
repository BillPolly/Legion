/**
 * ConversationManager - Manages multi-turn conversational context for ConvFinQA
 *
 * Handles:
 * - Tracking conversation history (questions + answers)
 * - Resolving references ("it", "that", "the change")
 * - Maintaining context across turns
 */

export class ConversationManager {
  constructor() {
    this.history = []; // Array of {question, answer, entities}
    this.context = {
      lastMentionedValues: {}, // e.g., {"exercise price": 60.94}
      lastComparison: null,     // e.g., {year1: "2007", year2: "2005"}
      lastCalculation: null     // e.g., {operation: "subtract", result: 35.8}
    };
  }

  /**
   * Add a turn to the conversation history
   *
   * @param {string} question - User question
   * @param {number|string} answer - Answer to the question
   * @param {Object} metadata - Additional metadata about this turn
   */
  addTurn(question, answer, metadata = {}) {
    const turn = {
      question,
      answer,
      entities: metadata.entities || [],
      program: metadata.program || null,
      timestamp: Date.now()
    };

    this.history.push(turn);

    // Update context based on this turn
    this._updateContext(turn);
  }

  /**
   * Get the full conversation history
   *
   * @returns {Array<Object>} Array of conversation turns
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Get the last N turns
   *
   * @param {number} n - Number of recent turns to get
   * @returns {Array<Object>} Recent conversation turns
   */
  getRecentTurns(n = 3) {
    return this.history.slice(-n);
  }

  /**
   * Resolve references in a question
   *
   * Examples:
   * - "and what was it in 2005?" → "what was the exercise price in 2005?"
   * - "what was, then, the change?" → "what was the change in exercise price?"
   *
   * @param {string} question - Question potentially containing references
   * @returns {string} Resolved question with references replaced
   */
  resolveReferences(question) {
    let resolved = question;

    // Get recent context
    const lastTurn = this.history[this.history.length - 1];
    const lastQuestion = lastTurn?.question || '';

    // Extract entity mentioned in last question
    const entityMatches = lastQuestion.match(/(exercise price|dividends|volatility|interest rate|life|fair value)/i);
    const lastEntity = entityMatches ? entityMatches[1] : null;

    // Resolve "it" - refers to the last mentioned entity
    if (resolved.match(/\b(it|that)\b/i) && lastEntity) {
      resolved = resolved.replace(/\b(it|that)\b/i, `the ${lastEntity}`);
    }

    // Resolve "the change" - refers to the difference just calculated
    if (resolved.match(/the change/i) && this.context.lastCalculation) {
      // Already contains "the change", keep as is but note the context
      // The executor will need to know what was compared
    }

    // Resolve year references
    if (resolved.match(/\b(then|that year|this year)\b/i) && this.context.lastComparison) {
      // Context provides the years being compared
    }

    return resolved;
  }

  /**
   * Extract entities mentioned in a question
   *
   * @param {string} question - Question to analyze
   * @returns {Array<string>} List of entities mentioned
   */
  extractEntities(question) {
    const entities = [];

    // Financial metrics
    const metrics = [
      'exercise price',
      'dividends',
      'volatility',
      'interest rate',
      'life',
      'fair value',
      'expected life',
      'expected volatility',
      'risk-free interest rate'
    ];

    for (const metric of metrics) {
      if (question.toLowerCase().includes(metric)) {
        entities.push(metric);
      }
    }

    // Years
    const yearMatches = question.match(/\b(20\d{2})\b/g);
    if (yearMatches) {
      entities.push(...yearMatches);
    }

    return entities;
  }

  /**
   * Get conversation context for LLM prompts
   *
   * @returns {string} Formatted conversation history
   */
  getConversationContext() {
    if (this.history.length === 0) {
      return '';
    }

    return this.history
      .map((turn, i) => {
        return `Q${i + 1}: ${turn.question}\nA${i + 1}: ${turn.answer}`;
      })
      .join('\n\n');
  }

  /**
   * Update context based on the latest turn
   *
   * @param {Object} turn - Conversation turn
   * @private
   */
  _updateContext(turn) {
    // Track entities mentioned
    const entities = this.extractEntities(turn.question);

    // Track last mentioned values
    for (const entity of entities) {
      if (typeof turn.answer === 'number') {
        this.context.lastMentionedValues[entity] = turn.answer;
      }
    }

    // Track comparisons (when two years are mentioned)
    const years = turn.question.match(/\b(20\d{2})\b/g);
    if (years && years.length >= 2) {
      this.context.lastComparison = {
        year1: years[0],
        year2: years[1],
        entity: entities[0] || null
      };
    }

    // Track calculations
    if (turn.program) {
      const operations = turn.program.match(/(subtract|divide|add|multiply)/g);
      if (operations && operations.length > 0) {
        this.context.lastCalculation = {
          operation: operations[operations.length - 1],
          result: turn.answer,
          program: turn.program
        };
      }
    }
  }

  /**
   * Reset conversation state
   */
  reset() {
    this.history = [];
    this.context = {
      lastMentionedValues: {},
      lastComparison: null,
      lastCalculation: null
    };
  }

  /**
   * Get current context summary
   *
   * @returns {Object} Current conversation context
   */
  getContext() {
    return {
      ...this.context,
      turnCount: this.history.length,
      lastQuestion: this.history[this.history.length - 1]?.question || null,
      lastAnswer: this.history[this.history.length - 1]?.answer || null
    };
  }
}
