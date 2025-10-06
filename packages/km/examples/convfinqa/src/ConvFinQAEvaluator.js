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

export class ConvFinQAEvaluator {
  constructor(config = {}) {
    this.tripleStore = config.tripleStore;
    this.semanticSearch = config.semanticSearch;
    this.llmClient = config.llmClient;
    this.ontologyBuilder = null;
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

    // Bootstrap ontology
    await this.ontologyBuilder.ensureBootstrapLoaded();

    // Build ontology from pre_text
    const text = dataEntry.pre_text.join(' ');
    const ontologyResult = await this.ontologyBuilder.processText(text, { domain: 'finance' });

    // Add Black-Scholes properties if needed
    await this._ensureBlackScholesProperties();

    // Create KG instances from table
    const tableResult = await this._processTable(dataEntry.table_ori);

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

    const annotation = dataEntry.annotation;
    const questions = annotation.dialogue_break;
    const programs = annotation.turn_program;
    const groundTruth = annotation.exe_ans_list;

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
   * Ensure Black-Scholes properties exist in ontology
   *
   * @private
   */
  async _ensureBlackScholesProperties() {
    const properties = [
      { uri: 'kg:exercisePrice', label: 'Exercise Price', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedDividends', label: 'Expected Dividends', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedLife', label: 'Expected Life', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedVolatility', label: 'Expected Volatility', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:riskFreeRate', label: 'Risk Free Rate', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:grantDateFairValue', label: 'Grant Date Fair Value', domain: 'kg:StockOption', range: 'xsd:decimal' }
    ];

    for (const prop of properties) {
      // Check if property already exists
      const existing = await this.tripleStore.query(prop.uri, 'rdf:type', 'owl:DatatypeProperty');
      if (existing.length === 0) {
        await this.tripleStore.add(prop.uri, 'rdf:type', 'owl:DatatypeProperty');
        await this.tripleStore.add(prop.uri, 'rdfs:label', `"${prop.label}"`);
        await this.tripleStore.add(prop.uri, 'rdfs:domain', prop.domain);
        await this.tripleStore.add(prop.uri, 'rdfs:range', prop.range);
      }
    }
  }

  /**
   * Process table to create KG instances
   *
   * @param {Array<Array<string>>} table - Table data
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processTable(table) {
    // Auto-detect entity class from ontology
    const entityClass = await this._detectEntityClass();

    if (!entityClass) {
      throw new Error('Could not auto-detect entity class from ontology. No suitable classes found.');
    }

    // Extract entity name from URI (e.g., kg:StockOption → StockOption)
    const entityName = entityClass.split(':')[1] || entityClass;

    // Auto-generate property map from table headers and ontology properties
    const propertyMap = await this._generatePropertyMap(table, entityClass);

    const metadata = {
      entityClass,
      entityPrefix: `${entityName}`,
      headerRow: 0,
      instanceColumns: this._detectInstanceColumns(table),
      propertyMap
    };

    return await this.ontologyBuilder.processTableData(table, metadata);
  }

  /**
   * Auto-detect the primary entity class from the ontology
   *
   * Looks for classes that are not in the bootstrap ontology and are likely
   * to represent the main entity type for the table.
   *
   * @returns {Promise<string|null>} Entity class URI or null
   * @private
   */
  async _detectEntityClass() {
    // Get all classes from ontology
    const allClasses = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');

    // Filter out bootstrap classes (these are in owl/rdfs namespace)
    const domainClasses = allClasses
      .map(triple => triple[0])
      .filter(uri => uri.startsWith('kg:'))
      .filter(uri => !uri.includes('owl:') && !uri.includes('rdfs:'));

    // Look for financial/domain-specific classes
    // Prefer classes that might represent the main table entity
    const candidates = domainClasses.filter(uri => {
      const name = uri.split(':')[1]?.toLowerCase() || '';
      // Prioritize classes that sound like main entities
      return name.includes('stock') ||
             name.includes('option') ||
             name.includes('debt') ||
             name.includes('asset') ||
             name.includes('pension') ||
             name.includes('tax');
    });

    // Return first candidate, or first domain class as fallback
    return candidates[0] || domainClasses[0] || null;
  }

  /**
   * Detect which columns in the table represent instances
   * Looks for columns with year-like headers (numbers) or date patterns
   *
   * @param {Array<Array<string>>} table - Table data
   * @returns {Array<number>} Column indices for instances
   * @private
   */
  _detectInstanceColumns(table) {
    if (!table || table.length === 0) return [];

    const headerRow = table[0];
    const instanceColumns = [];

    for (let i = 1; i < headerRow.length; i++) {
      const header = String(headerRow[i]).trim();
      // Check if header looks like a year (4 digits) or date
      if (/^\d{4}$/.test(header) || /\d{4}/.test(header)) {
        instanceColumns.push(i);
      }
    }

    // If no year columns found, assume all non-first columns are instances
    if (instanceColumns.length === 0) {
      for (let i = 1; i < headerRow.length; i++) {
        instanceColumns.push(i);
      }
    }

    return instanceColumns;
  }

  /**
   * Generate property map from table headers and ontology properties
   *
   * @param {Array<Array<string>>} table - Table data
   * @param {string} entityClass - Entity class URI
   * @returns {Promise<Object>} Property map
   * @private
   */
  async _generatePropertyMap(table, entityClass) {
    const propertyMap = {};

    if (!table || table.length < 2) return propertyMap;

    // Get all properties that have this entity as domain
    const properties = await this.tripleStore.query(null, 'rdfs:domain', entityClass);

    // Get property labels for matching
    const propertyLabels = {};
    for (const [propUri] of properties) {
      const labels = await this.tripleStore.query(propUri, 'rdfs:label', null);
      if (labels.length > 0) {
        const label = labels[0][2].replace(/"/g, '').toLowerCase();
        propertyLabels[label] = propUri;
      }
      // Also use property name as fallback
      const propName = propUri.split(':')[1]?.toLowerCase();
      if (propName) {
        propertyLabels[propName] = propUri;
      }
    }

    // Map table row labels to properties
    for (let i = 1; i < table.length; i++) {
      const rowLabel = String(table[i][0]).trim().toLowerCase();

      // Try exact match first
      if (propertyLabels[rowLabel]) {
        propertyMap[rowLabel] = propertyLabels[rowLabel];
        continue;
      }

      // Try partial match
      for (const [label, uri] of Object.entries(propertyLabels)) {
        if (rowLabel.includes(label) || label.includes(rowLabel)) {
          propertyMap[rowLabel] = uri;
          break;
        }
      }

      // If no match found, create a generic property URI
      if (!propertyMap[rowLabel]) {
        const propName = rowLabel
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_');
        propertyMap[rowLabel] = `kg:${propName}`;
      }
    }

    return propertyMap;
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
