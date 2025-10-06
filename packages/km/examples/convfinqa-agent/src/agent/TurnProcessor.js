/**
 * TurnProcessor - Refactored phase-based turn processor
 *
 * Clean separation of concerns using phase architecture:
 * 1. UnderstandingPhase - Semantic question analysis (TemplatedPrompt)
 * 2. RetrievalPhase - Iterative data gathering (native tool calling)
 * 3. CalculationPhase - Extract numerical answer
 * 4. AnswerFormatter - Deterministic formatting
 */

import { UnderstandingPhase, RetrievalPhase, CalculationPhase, AnswerFormatter } from './phases/index.js';
import { KGIndex } from '../utils/KGIndex.js';
import { FinQAEvaluator } from '../evaluation/FinQAEvaluator.js';

export class TurnProcessor {
  /**
   * @param {Object} config
   * @param {ITripleStore} config.kgStore - Knowledge graph store
   * @param {ITripleStore} config.ontologyStore - Ontology store
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.llmClient - LLM client from ResourceManager
   * @param {Object} config.ontologyIndexer - OntologyIndexer for semantic search
   * @param {Object} config.promptLogCollection - MongoDB collection for prompt logs
   * @param {Object} config.phaseResultsCollection - MongoDB collection for phase results
   */
  constructor({ kgStore, ontologyStore, logger, llmClient, ontologyIndexer = null, promptLogCollection = null, phaseResultsCollection = null }) {
    this.kgStore = kgStore;
    this.ontologyStore = ontologyStore;
    this.logger = logger;
    this.llmClient = llmClient;
    this.ontologyIndexer = ontologyIndexer;
    this.promptLogCollection = promptLogCollection;
    this.phaseResultsCollection = phaseResultsCollection;

    // KG Index for O(1) lookups (will be built lazily)
    this.kgIndex = null;

    // Phase instances
    this.understandingPhase = new UnderstandingPhase({ llmClient, ontologyIndexer, logger });
    this.retrievalPhase = null; // Created after KG index is built
    this.calculationPhase = new CalculationPhase({ logger });
    this.answerFormatter = new AnswerFormatter(logger);

    // Conversation history tracking
    this.conversationHistory = [];

    // Turn tracking
    this.currentTurnId = null;
    this.currentExampleId = null;

    // Initialization state
    this.initialized = false;
  }

  /**
   * Initialize the turn processor (build KG index, initialize phases)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.logger.info('turn_processor_initializing');

    // Build KG index for O(1) lookups
    this.kgIndex = new KGIndex(this.kgStore, this.logger);
    await this.kgIndex.build();

    // Create retrieval phase with KG index
    this.retrievalPhase = new RetrievalPhase({
      llmClient: this.llmClient,
      kgIndex: this.kgIndex,
      logger: this.logger
    });

    // Initialize understanding phase (loads prompt templates)
    await this.understandingPhase.initialize();

    this.initialized = true;
    this.logger.info('turn_processor_initialized', {
      kgIndexStats: this.kgIndex.getStats()
    });
  }

  /**
   * Process a single turn (question-answer pair)
   *
   * @param {string} question - The question to answer
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Turn results
   */
  async processTurn(question, options = {}) {
    // Ensure initialization
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info('process_turn_start', { question });

    // Generate turn ID for logging
    this.currentTurnId = `turn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const startTime = Date.now();

    try {
      // === PHASE 1: SEMANTIC UNDERSTANDING ===
      this.logger.debug('phase_1_understanding');

      const context = await this._buildContext();

      const understandingResult = await this.understandingPhase.execute(question, context);

      if (!understandingResult.success) {
        throw new Error('Understanding phase failed');
      }

      const understanding = understandingResult.understanding;

      // === PHASE 2: ITERATIVE DATA RETRIEVAL ===
      this.logger.debug('phase_2_retrieval');

      const retrievalResult = await this.retrievalPhase.execute(question, understanding, context);

      if (!retrievalResult.success) {
        throw new Error('Retrieval phase failed');
      }

      const { retrievedData, toolCalls } = retrievalResult;

      // === PHASE 3: CALCULATION ===
      this.logger.debug('phase_3_calculation');

      const calculationResult = await this.calculationPhase.execute(
        toolCalls,
        retrievedData,
        '' // Final text response would go here if needed
      );

      if (!calculationResult.success) {
        throw new Error('Calculation phase failed');
      }

      const { rawValue } = calculationResult;

      // === PHASE 4: FORMATTING ===
      this.logger.debug('phase_4_formatting');

      const outputFormat = this.answerFormatter.normalizeOutputFormat(understanding);
      const formattedAnswer = this.answerFormatter.format(rawValue, outputFormat);

      // Update conversation history
      this.conversationHistory.push({ question, answer: formattedAnswer });

      const durationMs = Date.now() - startTime;

      this.logger.info('process_turn_complete', {
        question,
        answer: formattedAnswer,
        rawValue,
        durationMs
      });

      return {
        understanding,
        retrievedData,
        toolCalls,
        rawValue,
        answer: formattedAnswer,
        durationMs,
        success: true
      };

    } catch (error) {
      this.logger.error('process_turn_error', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Build context for understanding phase
   * @private
   */
  async _buildContext() {
    // Get sample labels from KG index
    const sampleLabels = this.kgIndex.getAllLabels().slice(0, 30);

    // Get available years and categories
    const years = this.kgIndex.getAllYears();
    const categories = this.kgIndex.getAllCategories();

    // Get relevant ontology concepts if ontology indexer available
    let relevantConcepts = [];
    if (this.ontologyIndexer) {
      try {
        // This would be filled in if we have a question to search with
        relevantConcepts = [];
      } catch (error) {
        this.logger.warn('ontology_concept_search_failed', { error: error.message });
      }
    }

    return {
      sampleLabels,
      years,
      categories,
      relevantConcepts,
      tableMetadata: {} // Would be populated from table analysis
    };
  }

  /**
   * Score answer against gold answer using FinQA evaluation logic
   *
   * @param {string} answer - Agent's answer
   * @param {string} goldAnswer - Gold answer from dataset
   * @returns {boolean} True if correct
   */
  scoreAnswer(answer, goldAnswer) {
    const result = FinQAEvaluator.evaluateAnswer(answer, goldAnswer);
    return result.correct;
  }

  /**
   * Set example ID for logging
   */
  setExampleId(exampleId) {
    this.currentExampleId = exampleId;
  }

  /**
   * Get KG index statistics
   */
  getKGIndexStats() {
    return this.kgIndex ? this.kgIndex.getStats() : null;
  }
}
