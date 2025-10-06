/**
 * ExampleRunner - Orchestrates evaluation of a single ConvFinQA example
 *
 * Workflow:
 * 1. Create log record
 * 2. Load ontology from MongoDB
 * 3. Build instance KG from table
 * 4. Process each turn (question-answer pair)
 * 5. Log results
 * 6. Score and update example
 */

import { MongoDBProvider } from '../storage/MongoDBProvider.js';
import { LogStorage } from '../storage/LogStorage.js';
import { KGBuilder } from '../utils/KGBuilder.js';
import { TurnProcessor } from '../agent/TurnProcessor.js';

export class ExampleRunner {
  /**
   * @param {Object} config
   * @param {string} config.runId - Evaluation run ID
   * @param {MongoClient} config.mongoClient - MongoDB client
   * @param {Object} config.llmClient - LLM client for agent
   * @param {Object} config.logger - Logger instance
   */
  constructor({ runId, mongoClient, llmClient, logger }) {
    this.runId = runId;
    this.mongoClient = mongoClient;
    this.llmClient = llmClient;
    this.logger = logger;

    // Storage utilities
    this.logStorage = new LogStorage(mongoClient.db('convfinqa_eval'));

    // Triple stores
    this.ontologyStore = null;  // Loaded in initialize()
    this.kgStore = null;        // Created per example
  }

  /**
   * Initialize runner (load ontology)
   */
  async initialize() {
    this.logger.info('example_runner_initialize');

    // Create ontology store
    this.ontologyStore = new MongoDBProvider({
      collection: this.mongoClient.db('convfinqa_eval').collection('ontology'),
      metadata: { type: 'ontology' }
    });

    this.logger.info('ontology_loaded', {
      tripleCount: await this.ontologyStore.size()
    });
  }

  /**
   * Run evaluation for a single example
   *
   * @param {Object} example - ConvFinQA example
   * @param {string} example.id - Example ID
   * @param {Array<Array<string>>} example.table - Table data
   * @param {Array<string>} example.text - Text context
   * @param {Array<Object>} example.qa - Question-answer pairs
   * @returns {Promise<Object>} Example results
   */
  async runExample(example) {
    const { id, table, text, qa } = example;

    this.logger.info('run_example_start', {
      exampleId: id,
      numTurns: qa.length
    });

    const startTime = Date.now();

    try {
      // Step 1: Create example log
      await this.logStorage.createExample({
        runId: this.runId,
        exampleId: id,
        conversationId: id,
        numTurns: qa.length,
        status: 'in_progress',
        startedAt: new Date()
      });

      // Step 2: Build instance KG from table
      this.logger.info('build_kg_start', { exampleId: id });
      const kgStats = await this._buildKnowledgeGraph(id, table, text);
      this.logger.info('build_kg_complete', { ...kgStats });

      // Step 3: Create turn processor
      const turnProcessor = new TurnProcessor({
        kgStore: this.kgStore,
        ontologyStore: this.ontologyStore,
        logger: this.logger,
        llmClient: this.llmClient
      });

      // Step 4: Process each turn
      const turnResults = [];
      let correctAnswers = 0;

      for (let i = 0; i < qa.length; i++) {
        const { question, answer: goldAnswer } = qa[i];

        this.logger.info('process_turn', {
          exampleId: id,
          turnIndex: i,
          question
        });

        // Process turn
        const turnResult = await turnProcessor.processTurn(question, goldAnswer);

        // Log turn
        await this.logStorage.logTurn({
          runId: this.runId,
          conversationId: id,
          turnIndex: i,
          question,
          conversationHistory: [...turnProcessor.conversationHistory].slice(0, -1), // Exclude current turn
          understanding: turnResult.understanding,
          toolCalls: turnResult.toolCalls,
          answer: turnResult.answer,
          goldAnswer,
          correct: turnResult.correct,
          status: 'complete',
          startedAt: new Date(Date.now() - turnResult.durationMs),
          completedAt: new Date(),
          durationMs: turnResult.durationMs
        });

        turnResults.push(turnResult);

        if (turnResult.correct) {
          correctAnswers++;
        }

        this.logger.info('turn_complete', {
          exampleId: id,
          turnIndex: i,
          answer: turnResult.answer,
          goldAnswer,
          correct: turnResult.correct
        });
      }

      // Step 5: Calculate results
      const accuracy = correctAnswers / qa.length;
      const failedTurns = turnResults
        .map((r, i) => ({ index: i, correct: r.correct }))
        .filter(t => !t.correct)
        .map(t => t.index);

      const avgToolCallsPerTurn = turnResults.reduce(
        (sum, r) => sum + r.toolCalls.length,
        0
      ) / qa.length;

      const results = {
        totalTurns: qa.length,
        correctAnswers,
        accuracy,
        failedTurns,
        avgToolCallsPerTurn
      };

      // Step 6: Update example log
      await this.logStorage.updateExample({
        runId: this.runId,
        conversationId: id,
        status: 'complete',
        completedAt: new Date(),
        results,
        kgStats
      });

      const durationMs = Date.now() - startTime;

      this.logger.info('run_example_complete', {
        exampleId: id,
        accuracy,
        correctAnswers,
        totalTurns: qa.length,
        durationMs
      });

      return {
        exampleId: id,
        results,
        kgStats,
        durationMs
      };

    } catch (error) {
      this.logger.error('run_example_error', {
        exampleId: id,
        error: error.message,
        stack: error.stack
      });

      // Update example log with error
      await this.logStorage.updateExample({
        runId: this.runId,
        conversationId: id,
        status: 'failed',
        completedAt: new Date(),
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Build instance KG from table data
   */
  async _buildKnowledgeGraph(conversationId, table, text) {
    // Create KG store for this example
    this.kgStore = new MongoDBProvider({
      collection: this.mongoClient.db('convfinqa_eval').collection('instances'),
      metadata: {
        type: 'instance',
        runId: this.runId,
        conversationId
      }
    });

    // Build KG
    const kgBuilder = new KGBuilder(this.kgStore, this.ontologyStore);
    const stats = await kgBuilder.buildFromTable(table, text);

    return stats;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.debug('example_runner_cleanup');
    // No cleanup needed - MongoDB client managed externally
  }
}
