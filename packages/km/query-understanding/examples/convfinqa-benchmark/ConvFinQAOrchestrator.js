/**
 * ConvFinQAOrchestrator - Orchestrates table lookup + arithmetic reasoning
 *
 * Architecture:
 * Pipeline (generic) → QueryInterpreter (ConvFinQA-specific) → Executor (pure data)
 */

import { QueryUnderstandingPipeline } from '../../src/QueryUnderstandingPipeline.js';
import { FinancialKGBuilder } from './FinancialKGBuilder.js';
import { QueryInterpreter } from './QueryInterpreter.js';
import { FactQueryExecutor } from './FactQueryExecutor.js';

export class ConvFinQAOrchestrator {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.pipeline = null;
    this.kgBuilder = null;
    this.interpreter = null;
    this.executor = null;
    this.conversationHistory = [];
    this.exampleId = null;
    this.facts = null;
  }

  /**
   * Initialize with a financial document (table + text)
   */
  async initialize(document, exampleId = 'example') {
    this.exampleId = exampleId;

    // 1. Build KG from document (creates ontology + facts)
    this.kgBuilder = new FinancialKGBuilder(this.resourceManager);
    await this.kgBuilder.initialize(exampleId);

    const { facts, ontologyCollection } = await this.kgBuilder.ingest(document);
    this.facts = facts;

    // 2. Initialize full QueryUnderstandingPipeline with ontology
    this.pipeline = new QueryUnderstandingPipeline(this.resourceManager);
    await this.pipeline.initialize({
      ontologyCollectionName: ontologyCollection,
      skipDataSource: true  // We use FactQueryExecutor instead
    });

    // 3. Create QueryInterpreter (bridges pipeline → executor)
    this.interpreter = new QueryInterpreter(facts);

    // 4. Create FactQueryExecutor (pure data operations)
    this.executor = new FactQueryExecutor(facts);

    this.conversationHistory = [];
  }

  /**
   * Process a single question (main entry point)
   *
   * Architecture:
   * 1. Pipeline produces LogicalSkeleton (generic semantic understanding)
   * 2. QueryInterpreter translates to execution parameters (ConvFinQA-specific)
   * 3. FactQueryExecutor performs data lookup + arithmetic (pure data operations)
   */
  async processQuestion(question) {
    try {
      // 1. Pipeline: Generic semantic understanding
      const pipelineResult = await this.pipeline.process(question, {
        conversationHistory: this.conversationHistory.map(h => ({
          question: h.resolvedQuestion || h.question,  // Use resolved question with normalized years
          answer: h.answer
        })),
        domain: 'financial'
      });

      // 2. QueryInterpreter: Translate skeleton to execution params
      const execParams = this.interpreter.interpret(pipelineResult.skeleton, {
        conversationHistory: this.conversationHistory,
        question  // Pass original question for year extraction
      });

      // 3. FactQueryExecutor: Execute with concrete parameters
      const executionResult = this.executor.execute(execParams);

      // Add to conversation history
      const historyEntry = {
        question,
        resolvedQuestion: pipelineResult.resolvedQuestion?.text || question,
        answer: executionResult.answer,
        skeleton: pipelineResult.skeleton,
        execParams,  // Include interpreter output for debugging
        type: executionResult.type,
        program: executionResult.program || null,
        success: executionResult.answer !== null,
        error: executionResult.error || null
      };

      this.conversationHistory.push(historyEntry);

      return {
        answer: executionResult.answer,
        type: executionResult.type,
        program: executionResult.program,
        success: executionResult.answer !== null,
        error: executionResult.error || null,
        skeleton: pipelineResult.skeleton,
        execParams
      };

    } catch (error) {
      console.error('Error processing question:', error);

      // Add error to history
      this.conversationHistory.push({
        question,
        answer: null,
        error: error.message,
        success: false
      });

      return {
        answer: null,
        type: 'error',
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Process a multi-turn conversation
   */
  async processConversation(questions) {
    const results = [];

    for (const question of questions) {
      const result = await this.processQuestion(question);
      results.push(result);
    }

    return results;
  }

  /**
   * Reset conversation state
   */
  reset() {
    this.conversationHistory = [];
    if (this.executor && this.executor.arithmeticExecutor) {
      this.executor.arithmeticExecutor.clear();
    }
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }
}
