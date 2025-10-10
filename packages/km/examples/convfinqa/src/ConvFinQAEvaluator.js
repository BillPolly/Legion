/**
 * ConvFinQAEvaluator - Full pipeline evaluator for ConvFinQA benchmark
 *
 * Coordinates:
 * - Ontology building from text
 * - KG instance creation from tables
 * - Conversation management
 * - Program execution
 * - Answer evaluation
 */

import { OntologyBuilder } from '@legion/ontology';
import { ConversationManager } from './ConversationManager.js';
import { ProgramExecutor } from './ProgramExecutor.js';
import { InstanceBuilder } from '../../semantic-financial-kg/src/kg/InstanceBuilder.js';

export class ConvFinQAEvaluator {
  constructor(config = {}) {
    this.tripleStore = config.tripleStore;
    this.semanticSearch = config.semanticSearch;
    this.llmClient = config.llmClient;
    this.ontologyBuilder = null;
    this.instanceBuilder = null;
    this.conversationManager = new ConversationManager();
    this.programExecutor = new ProgramExecutor(this.tripleStore);
  }

  /**
   * Initialize the ontology and KG from ConvFinQA data entry
   *
   * @param {Object} dataEntry - Single entry from ConvFinQA dataset
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(dataEntry) {
    // Create OntologyBuilder
    this.ontologyBuilder = new OntologyBuilder({
      tripleStore: this.tripleStore,
      semanticSearch: this.semanticSearch,
      llmClient: this.llmClient,
      verification: {
        enabled: false  // Disable for speed
      }
    });

    // Create InstanceBuilder (Phase 7)
    this.instanceBuilder = new InstanceBuilder({
      tripleStore: this.tripleStore,
      ontologyBuilder: this.ontologyBuilder,
      llmClient: this.llmClient,
      semanticSearch: this.semanticSearch
    });

    // Bootstrap ontology
    await this.ontologyBuilder.ensureBootstrapLoaded();

    // Build ontology from pre_text (handle both string and array)
    const preText = Array.isArray(dataEntry.doc.pre_text)
      ? dataEntry.doc.pre_text.join(' ')
      : dataEntry.doc.pre_text;
    const ontologyResult = await this.ontologyBuilder.processText(preText, { domain: 'finance' });

    // Create KG instances from table using Phase 7
    const tableResult = await this._processTablePhase7(dataEntry);

    return {
      ontology: ontologyResult,
      instances: tableResult
    };
  }

  /**
   * Evaluate a conversational Q&A sequence
   *
   * @param {Object} dataEntry - ConvFinQA data entry
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateConversation(dataEntry) {
    this.conversationManager.reset();
    this.programExecutor.reset();

    const dialogue = dataEntry.dialogue;
    const questions = dialogue.conv_questions;
    const programs = dialogue.turn_program;
    const groundTruth = dialogue.executed_answers;

    const results = {
      correct: 0,
      total: questions.length,
      answers: [],
      errors: []
    };

    // Process each turn in the conversation
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const program = programs[i];
      const expectedAnswer = groundTruth[i];

      try {
        // Resolve references in the question
        const resolvedQuestion = this.conversationManager.resolveReferences(question);

        // Execute the program to get the answer
        const answer = this.programExecutor.execute(program);

        // Add turn to conversation history
        this.conversationManager.addTurn(question, answer, {
          program,
          entities: this.conversationManager.extractEntities(question)
        });

        // Check if answer matches ground truth
        const isCorrect = this._compareAnswers(answer, expectedAnswer);

        results.answers.push({
          turn: i + 1,
          question,
          resolvedQuestion,
          program,
          answer,
          expectedAnswer,
          correct: isCorrect
        });

        if (isCorrect) {
          results.correct++;
        }

      } catch (error) {
        results.errors.push({
          turn: i + 1,
          question,
          program,
          error: error.message
        });

        // Add failed turn to history with null answer
        this.conversationManager.addTurn(question, null, {
          program,
          error: error.message
        });
      }
    }

    results.accuracy = results.correct / results.total;

    return results;
  }

  /**
   * Process table using Phase 7 (structured values with provenance)
   *
   * @param {Object} dataEntry - ConvFinQA data entry
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processTablePhase7(dataEntry) {
    // Extract company name from document ID (e.g., "Single_JKHY/2009/page_28.pdf-3" → "JKHY")
    const companyMatch = dataEntry.id.match(/Single_([^/]+)\//);
    const company = companyMatch ? companyMatch[1] : 'Unknown';

    // Create data object for InstanceBuilder
    const data = {
      table: dataEntry.doc.table,
      metadata: {
        sourceDocument: dataEntry.id,
        documentId: dataEntry.id,
        scale: 'thousands',  // ConvFinQA financial data is typically in thousands
        currency: 'USD',
        company: company,
        organizationUri: `data:${company}`
      }
    };

    // Use InstanceBuilder with Phase 7
    const results = await this.instanceBuilder.createInstances(data);

    return results.table;
  }

  /**
   * Compare computed answer with ground truth
   *
   * @param {number} computed - Computed answer
   * @param {number} expected - Expected answer
   * @param {number} tolerance - Tolerance for floating point comparison
   * @returns {boolean} True if answers match within tolerance
   * @private
   */
  _compareAnswers(computed, expected, tolerance = 0.01) {
    if (typeof computed !== 'number' || typeof expected !== 'number') {
      return false;
    }

    return Math.abs(computed - expected) <= tolerance;
  }

  /**
   * Generate evaluation summary
   *
   * @param {Object} results - Evaluation results
   * @returns {string} Formatted summary
   */
  generateSummary(results) {
    const lines = [
      '='.repeat(80),
      'ConvFinQA Evaluation Results',
      '='.repeat(80),
      '',
      `Total Questions: ${results.total}`,
      `Correct Answers: ${results.correct}`,
      `Accuracy: ${(results.accuracy * 100).toFixed(2)}%`,
      ''
    ];

    if (results.errors.length > 0) {
      lines.push(`Errors: ${results.errors.length}`, '');
      for (const error of results.errors) {
        lines.push(`  Turn ${error.turn}: ${error.error}`);
      }
      lines.push('');
    }

    lines.push('Per-Turn Results:');
    for (const answer of results.answers) {
      const status = answer.correct ? '✓' : '✗';
      lines.push(`  ${status} Turn ${answer.turn}: ${answer.answer.toFixed(4)} (expected: ${answer.expectedAnswer})`);
    }

    lines.push('', '='.repeat(80));

    return lines.join('\n');
  }
}
