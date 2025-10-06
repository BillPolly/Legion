/**
 * TurnProcessor - Processes a single question-answer turn
 *
 * Handles two phases:
 * 1. UNDERSTAND: Analyze the question to determine what is being asked
 * 2. ANSWER: Use LLM with KG tools to retrieve data and answer
 */

import { QueryKGTool, ListEntitiesTool, CalculateTool, IntrospectOntologyTool } from './tools/index.js';
import { FinQAEvaluator } from '../evaluation/FinQAEvaluator.js';

export class TurnProcessor {
  /**
   * @param {Object} config
   * @param {ITripleStore} config.kgStore - Knowledge graph store
   * @param {ITripleStore} config.ontologyStore - Ontology store
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.llmClient - LLM client from ResourceManager
   * @param {Object} config.ontologyIndexer - OntologyIndexer for semantic search
   */
  constructor({ kgStore, ontologyStore, logger, llmClient, ontologyIndexer = null, promptLogCollection = null, phaseResultsCollection = null }) {
    this.kgStore = kgStore;
    this.ontologyStore = ontologyStore;
    this.logger = logger;
    this.llmClient = llmClient;
    this.ontologyIndexer = ontologyIndexer;
    this.promptLogCollection = promptLogCollection;
    this.phaseResultsCollection = phaseResultsCollection;

    // Available tools (simplified - only query_kg and calculate for semantic KG)
    this.tools = { QueryKGTool, CalculateTool };

    // Conversation history tracking
    this.conversationHistory = [];

    // Turn tracking
    this.currentTurnId = null;
    this.currentExampleId = null;
  }

  /**
   * Process a single turn (question-answer pair)
   *
   * @param {string} question - The question to answer
   * @returns {Promise<Object>} Turn results
   */
  async processTurn(question) {
    this.logger.info('process_turn_start', { question });

    // Generate turn ID for logging
    this.currentTurnId = `turn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const startTime = Date.now();

    try {
      // Phase 1: UNDERSTAND
      this.logger.debug('understand_phase_start');
      const understanding = await this.understandQuestion(question);
      this.logger.info('understand_phase_complete', { understanding });

      // Phase 2: ANSWER
      this.logger.debug('answer_phase_start');
      const { answer, toolCalls } = await this.answerQuestion(question, understanding);
      this.logger.info('answer_phase_complete', { answer, toolCallCount: toolCalls.length });

      // Update conversation history
      this.conversationHistory.push({ question, answer });

      const durationMs = Date.now() - startTime;

      return {
        understanding,
        answer,
        toolCalls,
        durationMs
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
   * PHASE 1: SEMANTIC UNDERSTANDING
   * Understand what is being asked in terms of ontology concepts, named entities, and relations
   *
   * @param {string} question - The question text
   * @param {string} exampleId - Example ID for caching (optional)
   * @returns {Promise<string>} Semantic understanding
   */
  async semanticUnderstanding(question, exampleId = null) {
    // Check cache first (include question hash for multi-turn conversations)
    if (exampleId) {
      const cached = await this._getCachedPhaseResult(exampleId, 'SEMANTIC_UNDERSTANDING', question);
      if (cached) {
        this.logger.info('using_cached_semantic_understanding', { exampleId });
        return cached;
      }
    }

    // Get relevant ontology concepts via semantic search
    const relevantConcepts = await this._getRelevantOntologyConcepts(question);

    // Get sample instance labels (named entities)
    const sampleLabels = await this._getSampleInstanceLabels(15);

    // Get available years and categories
    const { years, categories } = await this._getAvailableYearsAndCategories();

    // Get table metadata
    const tableMetadata = await this._getTableMetadata();

    // Build semantic understanding prompt
    const prompt = this._buildSemanticUnderstandingPrompt(
      question,
      relevantConcepts,
      sampleLabels,
      years,
      categories,
      tableMetadata
    );

    // Use LLM for semantic understanding
    const response = await this.llmClient.request({
      prompt,
      maxTokens: 800,
      temperature: 0
    });

    const result = response.content;

    // Log prompt and response
    await this._logPromptResponse('SEMANTIC_UNDERSTANDING', prompt, result);

    // Log phase result
    if (exampleId) {
      await this._logPhaseResult('SEMANTIC_UNDERSTANDING', result, question);
    }

    return result;
  }

  /**
   * PHASE 2: ITERATIVE DATA RETRIEVAL
   * Retrieve all data needed to answer the question through iterative queries
   *
   * @param {string} question - The question text
   * @param {string} exampleId - Example ID for caching (optional)
   * @returns {Promise<Object>} Data context with all retrieved values
   */
  async iterativeDataRetrieval(question, exampleId = null) {
    // Check cache first (include question hash for multi-turn conversations)
    if (exampleId) {
      const cached = await this._getCachedPhaseResult(exampleId, 'DATA_RETRIEVAL', question);
      if (cached) {
        this.logger.info('using_cached_data_retrieval', { exampleId });
        return cached;
      }
    }

    // Get ontology concepts and enrich them
    const relevantConcepts = await this._getRelevantOntologyConcepts(question);
    const enrichedConcepts = await this._getEnrichedOntologyConcepts(relevantConcepts);

    // Get entities grouped by type
    const entitiesByType = await this._getEntitiesByType();

    // Get available temporal/categorical data
    const { years, categories } = await this._getAvailableYearsAndCategories();

    // Tool context for executing queries
    const toolContext = {
      kgStore: this.kgStore,
      ontologyStore: this.ontologyStore,
      logger: this.logger
    };

    // Data context accumulates all retrieved values
    const dataContext = {
      question,
      retrievedData: [],
      queries: []
    };

    const maxIterations = 5; // Prevent infinite loops

    for (let i = 0; i < maxIterations; i++) {
      // Build prompt for next query
      const prompt = this._buildDataRetrievalPrompt(
        question,
        enrichedConcepts,
        entitiesByType,
        years,
        categories,
        dataContext
      );

      // Ask LLM to plan next query or indicate completion
      const response = await this.llmClient.request({
        prompt,
        maxTokens: 500,
        temperature: 0
      });

      const responseText = response.content;

      // Log prompt and response
      await this._logPromptResponse(`DATA_RETRIEVAL_iteration_${i + 1}`, prompt, responseText);

      // Check if retrieval is complete
      if (responseText.includes('RETRIEVAL_COMPLETE')) {
        this.logger.info('data_retrieval_complete', { iterations: i + 1 });
        break;
      }

      // Extract tool call
      const toolCall = this._extractToolCall(responseText);

      if (!toolCall) {
        this.logger.info('no_more_queries_needed', { iteration: i + 1 });
        break;
      }

      // Execute query tool
      const toolResult = await this._executeTool(toolCall, toolContext);

      // Add to data context
      dataContext.queries.push({
        iteration: i + 1,
        tool: toolCall.name,
        input: toolCall.input,
        output: toolResult
      });

      if (toolResult.success && toolResult.value !== undefined) {
        dataContext.retrievedData.push({
          label: toolResult.label,
          value: toolResult.value,             // Canonical value for calculations
          rawValue: toolResult.rawValue,       // Original value from table
          rawValueString: toolResult.rawValueString,  // Formatted string
          unit: toolResult.unit,               // Unit
          year: toolResult.year,
          category: toolResult.category
        });
      }
    }

    // Log phase result
    if (exampleId) {
      await this._logPhaseResult('DATA_RETRIEVAL', dataContext, question);
    }

    return dataContext;
  }

  /**
   * PHASE 3: CALCULATION
   * Perform final calculation using retrieved data
   *
   * @param {string} question - The question text
   * @param {string} semanticUnderstanding - Output from Phase 1
   * @param {Object} dataContext - Output from Phase 2
   * @param {string} exampleId - Example ID for caching (optional)
   * @returns {Promise<string>} Final answer
   */
  async calculateAnswer(question, semanticUnderstanding, dataContext, exampleId = null) {
    // Check cache first (include question hash for multi-turn conversations)
    if (exampleId) {
      const cached = await this._getCachedPhaseResult(exampleId, 'CALCULATION', question);
      if (cached) {
        this.logger.info('using_cached_calculation', { exampleId });
        return cached;
      }
    }

    // Build calculation prompt
    const prompt = this._buildCalculationPrompt(
      question,
      semanticUnderstanding,
      dataContext
    );

    // Use LLM for calculation
    const response = await this.llmClient.request({
      prompt,
      maxTokens: 500,
      temperature: 0
    });

    const result = this._extractAnswer(response.content);

    // Log prompt and response
    await this._logPromptResponse('CALCULATION', prompt, response.content);

    // Log phase result
    if (exampleId) {
      await this._logPhaseResult('CALCULATION', result, question);
    }

    return result;
  }

  /**
   * LEGACY: Combined understanding (for backwards compatibility)
   * @deprecated Use semanticUnderstanding() and iterativeDataRetrieval() and calculateAnswer() instead
   */
  async understandQuestion(question) {
    const semantic = await this.semanticUnderstanding(question);
    return semantic; // For now, just return semantic understanding
  }

  /**
   * ANSWER PHASE: Use LLM with tools to answer the question
   *
   * @param {string} question - The question text
   * @param {Object} understanding - Understanding from Phase 1
   * @returns {Promise<Object>} Answer and tool calls
   */
  async answerQuestion(question, understanding) {
    // Build initial prompt
    const initialPrompt = await this._buildAnswerPrompt(question, understanding);

    // Tool context
    const toolContext = {
      kgStore: this.kgStore,
      ontologyStore: this.ontologyStore,
      logger: this.logger
    };

    // Execute simple agentic loop
    const toolCalls = [];
    let currentPrompt = initialPrompt;
    let answer = null;
    const maxIterations = 10;  // Prevent infinite loops

    for (let i = 0; i < maxIterations; i++) {
      // Call LLM
      const response = await this.llmClient.request({
        prompt: currentPrompt,
        maxTokens: 2000,
        temperature: 0
      });

      const responseText = response.content;

      // Log prompt and response
      await this._logPromptResponse(`ANSWER_iteration_${i + 1}`, currentPrompt, responseText);

      // Check if this is a final answer (no tool calls)
      const toolCall = this._extractToolCall(responseText);

      if (!toolCall) {
        // No tool call - this is the final answer
        answer = this._extractAnswer(responseText);
        break;
      }

      // Execute tool
      const toolResult = await this._executeTool(toolCall, toolContext);

      toolCalls.push({
        tool: toolCall.name,
        input: toolCall.input,
        output: toolResult,
        timestamp: new Date()
      });

      // Build next prompt with tool result
      currentPrompt = await this._buildContinuationPrompt(
        question,
        understanding,
        toolCalls,
        responseText,
        toolResult
      );

      // If the last tool was calculate and it succeeded, use the result as the answer
      if (toolCall.name === 'calculate' && toolResult.success) {
        answer = String(toolResult.result);
        break;
      }
    }

    if (answer === null) {
      // Failed to get answer - use last response
      answer = 'Unable to determine answer';
      this.logger.error('answer_extraction_failed', {
        question,
        toolCalls: toolCalls.length
      });
    }

    return { answer, toolCalls };
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
   * Log prompt and response to database
   */
  async _logPromptResponse(phase, prompt, response) {
    if (!this.promptLogCollection) {
      return; // No logging configured
    }

    try {
      await this.promptLogCollection.insertOne({
        turnId: this.currentTurnId,
        exampleId: this.currentExampleId,
        phase,
        prompt,
        response,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('prompt_log_error', { error: error.message });
    }
  }

  /**
   * Log phase result to database
   */
  async _logPhaseResult(phase, result, question) {
    if (!this.phaseResultsCollection) {
      return; // No logging configured
    }

    try {
      // Create a simple hash of the question for cache key
      const questionHash = this._hashString(question);

      await this.phaseResultsCollection.insertOne({
        exampleId: this.currentExampleId,
        questionHash, // Add question hash for multi-turn conversations
        turnId: this.currentTurnId,
        phase,
        result,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('phase_result_log_error', { error: error.message });
    }
  }

  /**
   * Get cached phase result from database
   */
  async _getCachedPhaseResult(exampleId, phase, question) {
    if (!this.phaseResultsCollection) {
      return null;
    }

    try {
      // Create a simple hash of the question for cache key
      const questionHash = this._hashString(question);

      const record = await this.phaseResultsCollection.findOne(
        { exampleId, phase, questionHash }, // Include question hash
        { sort: { timestamp: -1 } } // Get most recent
      );
      return record ? record.result : null;
    } catch (error) {
      this.logger.error('phase_result_retrieval_error', { error: error.message });
      return null;
    }
  }

  /**
   * Simple string hash for cache keys
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36); // Base 36 for compact representation
  }

  /**
   * Set current example ID for logging
   */
  setExampleId(exampleId) {
    this.currentExampleId = exampleId;
  }

  /**
   * Get available entity types from KG
   */
  async _getAvailableEntityTypes() {
    // Query for all instances in KG
    const instances = await this.kgStore.query(null, 'rdf:type', null);

    // Extract unique entity types
    const entityTypes = new Set();
    for (const [subject, predicate, object] of instances) {
      if (object && object.startsWith('kg:')) {
        entityTypes.add(object);
      }
    }

    return Array.from(entityTypes);
  }

  /**
   * Get sample instance labels from KG to show what's available
   */
  async _getSampleInstanceLabels(limit = 10) {
    const labelTriples = await this.kgStore.query(null, 'kg:label', null);
    const uniqueLabels = new Set();

    // Get ALL unique labels (don't limit) so text-derived facts are included
    for (const [subject, predicate, object] of labelTriples) {
      const label = object.replace(/"/g, '');
      uniqueLabels.add(label);
    }

    return Array.from(uniqueLabels);
  }

  /**
   * Get available years and categories from KG data
   */
  async _getAvailableYearsAndCategories() {
    // Get all unique years
    const yearTriples = await this.kgStore.query(null, 'kg:year', null);
    const years = new Set();
    for (const [_, __, year] of yearTriples) {
      years.add(year.replace(/"/g, ''));
    }

    // Get all unique categories
    const categoryTriples = await this.kgStore.query(null, 'kg:category', null);
    const categories = new Set();
    for (const [_, __, category] of categoryTriples) {
      categories.add(category.replace(/"/g, ''));
    }

    return {
      years: Array.from(years).sort(),
      categories: Array.from(categories)
    };
  }

  /**
   * Get table metadata from KG
   * Returns format conventions stored during table ingestion
   */
  async _getTableMetadata() {
    const metadata = {
      containsPercentages: false,
      percentagePrecision: null,
      percentageExamples: [],
      scalingFactor: null
    };

    // Query for table metadata entity
    const metadataTriples = await this.kgStore.query('kg:tableMetadata', null, null);

    for (const [subject, predicate, object] of metadataTriples) {
      // Handle different object types (string, boolean, number)
      const value = typeof object === 'string' ? object.replace(/"/g, '') : String(object);

      if (predicate === 'kg:containsPercentages') {
        metadata.containsPercentages = (value === 'true');
      } else if (predicate === 'kg:percentagePrecision') {
        metadata.percentagePrecision = parseInt(value);
      } else if (predicate === 'kg:percentageExamples') {
        metadata.percentageExamples = value.split(', ');
      } else if (predicate === 'kg:scalingFactor') {
        metadata.scalingFactor = value;
      }
    }

    return metadata;
  }

  /**
   * Get relevant ontology concepts via semantic search
   */
  async _getRelevantOntologyConcepts(question) {
    if (!this.ontologyIndexer) {
      return [];
    }

    // Find ontology concepts related to the question
    const concepts = await this.ontologyIndexer.findRelevantConcepts(question, 10);
    return concepts;
  }

  /**
   * Get enriched ontology concepts with definitions and properties
   * Used for Phase 2 to explain what concepts mean
   */
  async _getEnrichedOntologyConcepts(relevantConcepts) {
    const enriched = [];

    for (const concept of relevantConcepts) {
      const classURI = concept.classURI;

      // Get class label and definition
      const labelTriples = await this.ontologyStore.query(classURI, 'rdfs:label', null);
      const commentTriples = await this.ontologyStore.query(classURI, 'rdfs:comment', null);

      const label = labelTriples.length > 0
        ? labelTriples[0][2].replace(/"/g, '')
        : classURI.replace('kg:', '');

      const definition = commentTriples.length > 0
        ? commentTriples[0][2].replace(/"/g, '')
        : null;

      // Get properties for this class
      const propertyTriples = await this.ontologyStore.query(null, 'rdfs:domain', classURI);
      const properties = [];

      for (const [propURI] of propertyTriples) {
        const propLabelTriples = await this.ontologyStore.query(propURI, 'rdfs:label', null);
        const propLabel = propLabelTriples.length > 0
          ? propLabelTriples[0][2].replace(/"/g, '')
          : propURI.replace('kg:', '');

        properties.push({
          uri: propURI,
          label: propLabel
        });
      }

      enriched.push({
        uri: classURI,
        label,
        definition,
        properties,
        similarity: concept.similarity
      });
    }

    return enriched;
  }

  /**
   * Get entities grouped by type from KG
   * Used for Phase 2 to show what's queryable
   */
  async _getEntitiesByType() {
    // Get all instances and their types
    const typeTriples = await this.kgStore.query(null, 'rdf:type', null);

    const grouped = {};

    for (const [subject, pred, type] of typeTriples) {
      // Skip metadata and non-entity types
      if (subject === 'kg:tableMetadata') continue;
      if (type === 'kg:TableMetadata') continue;

      if (!grouped[type]) {
        grouped[type] = [];
      }

      // Get entity details
      const labelTriples = await this.kgStore.query(subject, 'kg:label', null);
      const yearTriples = await this.kgStore.query(subject, 'kg:year', null);
      const categoryTriples = await this.kgStore.query(subject, 'kg:category', null);
      const valueDescTriples = await this.kgStore.query(subject, 'kg:valueDescription', null);

      const label = labelTriples.length > 0 ? labelTriples[0][2].replace(/"/g, '') : null;

      if (!label) continue; // Skip entities without labels

      // Find or create entity entry
      let entityEntry = grouped[type].find(e => e.label === label);
      if (!entityEntry) {
        entityEntry = {
          label,
          type,
          years: new Set(),
          categories: new Set(),
          description: valueDescTriples.length > 0 ? valueDescTriples[0][2].replace(/"/g, '') : null,
          exampleInstance: subject
        };
        grouped[type].push(entityEntry);
      }

      // Collect years and categories
      if (yearTriples.length > 0) {
        entityEntry.years.add(yearTriples[0][2].replace(/"/g, ''));
      }
      if (categoryTriples.length > 0) {
        entityEntry.categories.add(categoryTriples[0][2].replace(/"/g, ''));
      }
    }

    // Convert Sets to sorted Arrays
    for (const type in grouped) {
      for (const entity of grouped[type]) {
        entity.years = Array.from(entity.years).sort();
        entity.categories = Array.from(entity.categories).sort();
      }
    }

    return grouped;
  }

  /**
   * Get available properties for each entity type from ontology
   */
  async _getEntityProperties(entityTypes) {
    const entityProperties = {};

    for (const entityType of entityTypes) {
      // Get all properties that have this entity as domain
      const properties = await this.ontologyStore.query(null, 'rdfs:domain', entityType);

      const propNames = [];
      for (const [propUri] of properties) {
        // Get property label
        const labels = await this.ontologyStore.query(propUri, 'rdfs:label', null);
        const label = labels.length > 0
          ? labels[0][2].replace(/"/g, '')
          : propUri.split(':')[1];

        // Remove kg: prefix for display
        const propName = propUri.startsWith('kg:') ? propUri.substring(3) : propUri;

        propNames.push({ uri: propUri, name: propName, label });
      }

      // Store simplified entity type name (without kg: prefix)
      const simpleName = entityType.startsWith('kg:') ? entityType.substring(3) : entityType;
      entityProperties[simpleName] = propNames;
    }

    return entityProperties;
  }

  /**
   * Build prompt for semantic understanding (Phase 1)
   */
  _buildSemanticUnderstandingPrompt(question, relevantConcepts, sampleLabels, years, categories, tableMetadata) {
    const conceptsText = relevantConcepts.length > 0
      ? relevantConcepts.map(c => `- ${c.label} (${c.classURI}) - similarity: ${(c.similarity * 100).toFixed(0)}%`).join('\n')
      : '(none)';

    const labelsText = sampleLabels.length > 0
      ? sampleLabels.map(label => `  - "${label}"`).join('\n')
      : '(none)';

    const yearsText = years.length > 0 ? years.join(', ') : '(none)';
    const categoriesText = categories.length > 0 ? categories.join(', ') : '(none)';

    // Build table metadata text
    let tableMetadataText = '';
    if (tableMetadata.containsPercentages) {
      tableMetadataText = `\nTable Format Context (from ingestion):
  - Table contains percentages: YES
  - Percentage precision: ${tableMetadata.percentagePrecision} decimal place(s)
  - Examples from table: ${tableMetadata.percentageExamples.join(', ')}
  - ⚠️ IMPORTANT: If your answer is a percentage, match this precision (${tableMetadata.percentagePrecision} decimals)`;

      if (tableMetadata.scalingFactor) {
        tableMetadataText += `\n  - Scaling factor: ${tableMetadata.scalingFactor}`;
      }
    } else if (tableMetadata.scalingFactor) {
      tableMetadataText = `\nTable Format Context (from ingestion):
  - Scaling factor: ${tableMetadata.scalingFactor}`;
    }

    return `You are analyzing a financial question to understand what is being asked semantically.

Question: "${question}"

Relevant Ontology Concepts (from semantic search):
${conceptsText}

Named Entities Available (sample instance labels):
${labelsText}

Available Temporal Data:
Years: ${yearsText}
Categories: ${categoriesText}
${tableMetadataText}

Your task is to provide a SEMANTIC UNDERSTANDING of this question in terms of:

1. **Ontology Concepts**: What type of entities/concepts is this question about?
   - Reference the ontology concepts above (e.g., "This is about StockPerformanceIndex entities")
   - Focus on the highest similarity concepts

2. **Named Entities**: Which specific entities are mentioned?
   - Use exact entity names from the available labels
   - Example: "entities: 'kbw bank index', 's&p 500 index'"

3. **Relations**: What relationship or operation is being asked about?
   - Examples: "compare", "calculate percentage change", "find difference", "aggregate sum"
   - Be specific about the semantic relation (e.g., "cumulative_return over time")

4. **Temporal/Categorical Scope**: What time period or category constraints exist?
   - Examples: "5-year period", "year 2008 vs 2009", "category 'less than 1 year'"
   - Reference the available years/categories above

   ⚠️ IMPORTANT for cumulative/indexed metrics (stock indexes, cumulative returns):
   - If question asks about a PERIOD (e.g., "5-year period ending 2009"), identify the END year
   - Cumulative metrics are indexed from a baseline, so the value at the END year contains the full period's return
   - Example: "5-year period ended 12/31/09" → Query year: 2009 (not "2004-2009")
   - Example: "ROI from 2004 to 2006" → Query years: 2004 (baseline) AND 2006 (end)
   - For comparison questions, both entities need the SAME end year

5. **Output Format Requirements** (CRITICAL for exact answer matching):
   Analyze the question to determine:

   a) **Unit**: What unit should the answer be in?
      - "percentage" or "%" → Answer must include % symbol
      - "millions" → Answer in millions (convert from raw if needed)
      - "billions" → Answer in billions
      - "dollars" → Answer with $ symbol
      - "raw number" → No unit conversion

   b) **Precision/Rounding**: How many decimal places?
      - **Percentage questions: DEFAULT to 1 decimal** (e.g., "15.6%")
      - **Use 2 decimals ONLY for:**
        * "what portion" questions (e.g., "what portion of total")
        * "difference in percentage cumulative return" (comparative return metrics)
        * Questions explicitly asking for precise proportions/fractions
      - "in millions": 1 decimal or whole number
      - "total": whole number
      - Use 0 decimals if question implies rounded/approximate (e.g., "roughly", "approximately")

   c) **Format conventions**:
      - Percentage questions: MUST include % symbol (e.g., "15.6%" not "15.6")
      - Monetary amounts: May need $ symbol
      - Large numbers: May need to express in millions/billions

   Example analyses:
   - "what was the percentage increase" → Unit: %, Precision: match gold (1-2 decimals), Format: Must include %
   - "what portion of total" → Unit: %, Precision: 2 decimals, Format: Must include %
   - "total in millions" → Unit: millions, Precision: 1 decimal, Format: number only
   - "what was the difference" → Unit: same as compared values, Precision: 2 decimals

IMPORTANT:
- Focus on WHAT is being asked, not HOW to query it
- Use ontology terminology and named entities
- Describe the semantic meaning, not the query mechanics
- **EXPLICITLY state the output format requirements**
- This is conceptual understanding, not a query plan

Provide your semantic understanding:`;
  }

  /**
   * Build prompt for data retrieval (Phase 2)
   * Now with rich ontology concepts and well-labeled entities
   */
  _buildDataRetrievalPrompt(question, enrichedConcepts, entitiesByType, years, categories, dataContext) {
    // Build ontology concepts section
    const conceptsText = enrichedConcepts.length > 0
      ? enrichedConcepts.map(c => {
          let text = `${c.uri} (${(c.similarity * 100).toFixed(0)}% match)\n`;
          if (c.definition) {
            text += `  Definition: ${c.definition}\n`;
          }
          if (c.properties && c.properties.length > 0) {
            text += `  Properties:\n`;
            c.properties.forEach(p => {
              text += `    - ${p.label} (${p.uri})\n`;
            });
          }
          text += `  Query pattern: Use entity label + year/category`;
          return text;
        }).join('\n\n')
      : '(none)';

    // Build entities section - grouped by type
    let entitiesText = '';
    for (const type in entitiesByType) {
      const entities = entitiesByType[type];
      if (entities.length === 0) continue;

      entitiesText += `\n=== ENTITIES: ${type} ===\n\n`;

      entities.forEach(entity => {
        entitiesText += `"${entity.label}"\n`;
        entitiesText += `  Type: ${type}\n`;
        if (entity.description) {
          entitiesText += `  Description: ${entity.description}\n`;
        }
        if (entity.years.length > 0) {
          entitiesText += `  Available years: ${entity.years.join(', ')}\n`;
        }
        if (entity.categories.length > 0) {
          entitiesText += `  Available categories: ${entity.categories.join(', ')}\n`;
        }
        // Show query format
        if (entity.years.length > 0) {
          entitiesText += `  Query: query_kg({"label": "${entity.label}", "year": "<year>"})\n`;
        } else if (entity.categories.length > 0) {
          entitiesText += `  Query: query_kg({"label": "${entity.label}", "category": "<category>"})\n`;
        }
        entitiesText += '\n';
      });
    }

    if (entitiesText === '') {
      entitiesText = '(none)';
    }

    const yearsText = years.length > 0 ? years.join(', ') : '(none)';
    const categoriesText = categories.length > 0 ? categories.join(', ') : '(none)';

    // Build retrieved data summary
    const retrievedText = dataContext.retrievedData.length > 0
      ? dataContext.retrievedData.map(d => {
          let text = `  - ${d.label}: `;
          if (d.rawValue !== undefined && d.rawValue !== d.value) {
            text += `raw=${d.rawValueString || d.rawValue}, canonical=${d.value}`;
          } else {
            text += d.value;
          }
          text += (d.year ? ` (year: ${d.year})` : '') + (d.category ? ` (category: ${d.category})` : '');
          if (d.unit) text += ` [unit: ${d.unit}]`;
          return text;
        }).join('\n')
      : '(none yet)';

    const queriesText = dataContext.queries.length > 0
      ? dataContext.queries.map(q =>
          `  ${q.iteration}. ${q.tool}(${JSON.stringify(q.input)}) → ${q.output.success ? q.output.value : 'FAILED'}`
        ).join('\n')
      : '(none yet)';

    return `You are retrieving data to answer a financial question.

=== QUESTION ===
"${question}"

=== RELEVANT ONTOLOGY CONCEPTS ===

${conceptsText}

=== AVAILABLE ENTITIES (Queryable Data) ===
${entitiesText}

=== TEMPORAL SCOPE ===
Available years: ${yearsText}
Available categories: ${categoriesText}

=== DATA RETRIEVED SO FAR ===
${retrievedText}

=== QUERIES EXECUTED ===
${queriesText}

=== YOUR TASK ===

Determine what data you need to answer the question, then issue the NEXT query.

If you have ALL the data needed:
- Respond with: RETRIEVAL_COMPLETE

If you need more data:
- Issue ONE query using the query_kg tool
- Format: TOOL: query_kg({"label": "<entity_name>", "year": "<year>"})
- Or: TOOL: query_kg({"label": "<entity_name>", "category": "<category>"})

⚠️ QUERY GUIDELINES:
- Match entity names from the question to labels in AVAILABLE ENTITIES above
- Example: Question says "for AES Corporation" → Use label "AES Corporation"
- Example: Question says "in Chile" → Use label "Chile"
- Use EXACT labels as shown (character-for-character)
- Each query retrieves ONE data point
- Query for specific years/categories needed by the question

What is the next step?`;
  }

  /**
   * Build prompt for calculation (Phase 3)
   */
  _buildCalculationPrompt(question, semanticUnderstanding, dataContext) {
    const dataText = dataContext.retrievedData.length > 0
      ? dataContext.retrievedData.map((d, i) => {
          let text = `  ${i + 1}. ${d.label}: `;
          // Show both raw and canonical values if different
          if (d.rawValue !== undefined && d.rawValue !== d.value) {
            text += `raw=${d.rawValueString || d.rawValue}, canonical=${d.value}`;
          } else {
            text += d.value;
          }
          text += (d.year ? ` (year: ${d.year})` : '') + (d.category ? ` (category: ${d.category})` : '');
          if (d.unit) text += ` [unit: ${d.unit}]`;
          return text;
        }).join('\n')
      : '(none)';

    return `You are calculating the final answer to a financial question.

Question: "${question}"

Semantic Understanding:
${semanticUnderstanding}

Retrieved Data:
${dataText}

⚠️ RAW vs CANONICAL VALUES ⚠️
For some metrics, you have BOTH values:
- **raw**: The original value from the table (e.g., index value $91.06)
- **canonical**: Converted value for calculations (e.g., -8.94% return from baseline)

WHEN TO USE WHICH:
1. **ROI/Return calculations** (e.g., "what is the ROI if bought at X and sold at Y?"):
   → Use RAW values
   → Formula: (sell_raw - buy_raw) / buy_raw * 100
   → Example: (91.06 - 100) / 100 = -8.94%

2. **Percentage change** (e.g., "what was the percentage change from 2007 to 2008?"):
   → If data already has canonical returns, EITHER works
   → If not, use raw values: (later_raw - earlier_raw) / earlier_raw * 100

3. **Difference in returns** (e.g., "difference in return between A and B?"):
   → Use canonical values (they're already returns)
   → Formula: return_A - return_B
   → Example: -24.05% - 2.11% = -26.16%

4. **Sum/Total** (e.g., "what was the total?"):
   → Use raw values (preserve original units)

Your task: Calculate the final numerical answer using ONLY the data above.

⚠️ CRITICAL: Extract format requirements from the Semantic Understanding above ⚠️
The semantic understanding specifies:
- Required unit (%, millions, billions, dollars, raw number)
- Required precision (number of decimal places)
- Required format conventions (symbols, etc.)

YOU MUST FOLLOW THESE REQUIREMENTS EXACTLY!

Instructions:
1. **Extract format requirements** from Semantic Understanding section above:
   - What UNIT is required? (%, millions, raw, etc.)
   - What PRECISION is required? (0, 1, or 2 decimal places)
   - What FORMAT conventions? (% symbol, $ symbol, etc.)

2. **Handle input data units**:
   - If data has units like "billion", convert to canonical form for calculation
   - Example: "3.7 billion" → 3700000000 for calculation
   - Check kg:unit and kg:valueString properties if available

3. **Perform calculation** step-by-step with canonical values

4. **Apply output format requirements**:
   - Convert result to required unit (e.g., if answer should be in millions, divide by 1000000)
   - Apply precision:
     * If 0 decimals: Use TRUNCATION toward zero (e.g., -32.8 → -32, not -33)
     * If 1+ decimals: Use standard rounding
   - Add required symbols (% for percentage, $ for currency)

Common operations:
- "percentage change": ((new - old) / old) * 100 → Apply % unit
- "portion" or "ratio": (part / total) * 100 → Apply % unit
- "difference": value1 - value2 → Same unit as inputs
- "sum": value1 + value2 + ... → Same unit as inputs

⚠️ FORMATTING EXAMPLES ⚠️

Example 1: Percentage with 1 decimal
- Question: "what was the percent of the growth..."
- Format requirement: Unit=%, Precision=1 decimal
- Calculation: ((9362.2 - 9244.9) / 9244.9) * 100 = 1.268...
- Apply format: Round to 1 decimal → 1.3
- Add unit: 1.3%
- Final answer: 1.3%

Example 2: Percentage with 2 decimals
- Question: "what portion of total obligations are due within the next 3 years?"
- Format requirement: Unit=%, Precision=2 decimals
- Calculation: (72890 / 317105) * 100 = 22.9896...
- Apply format: Round to 2 decimals → 22.99
- Add unit: 22.99%
- Final answer: 22.99%

Example 3: Percentage with 0 decimals (TRUNCATION!)
- Question: "what was the percentage change..."
- Format requirement: Unit=%, Precision=0 decimals (from table metadata)
- Calculation: (5363 - 7983) / 7983 * 100 = -32.819...
- Apply format: TRUNCATE to 0 decimals → -32 (NOT -33!)
- Add unit: -32%
- Final answer: -32%

Example 4: Raw number (whole)
- Question: "what was the total in millions..."
- Format requirement: Unit=millions, Precision=0 decimals (whole number)
- Calculation: 4.5 + 4.1 + 3.4 = 12.0
- Apply format: Truncate to whole → 12
- Final answer: 12

Now:
1. EXTRACT format requirements from Semantic Understanding
2. IDENTIFY which data to use
3. CONVERT inputs to canonical form if needed
4. CALCULATE step-by-step
5. APPLY format requirements (unit, precision, symbols)
6. OUTPUT final formatted answer on last line:`;
  }

  /**
   * Build prompt for understanding phase (LEGACY)
   * @deprecated
   */
  async _buildUnderstandPrompt(question, availableEntities, entityProperties = {}, sampleLabels = []) {
    const historyText = this.conversationHistory.length > 0
      ? this.conversationHistory.map((h, i) =>
          `${i + 1}. Q: "${h.question}" A: "${h.answer}"`
        ).join('\n')
      : '(none)';

    // Get relevant ontology concepts via semantic search
    const relevantConcepts = await this._getRelevantOntologyConcepts(question);
    const conceptsText = relevantConcepts.length > 0
      ? relevantConcepts.map(c => `- ${c.label} (${c.classURI}) - similarity: ${(c.similarity * 100).toFixed(0)}%`).join('\n')
      : '(none)';

    // Get available years and categories from KG data
    const { years, categories } = await this._getAvailableYearsAndCategories();
    const yearsText = years.length > 0 ? years.join(', ') : '(none)';
    const categoriesText = categories.length > 0 ? categories.join(', ') : '(none)';

    // Build entity types with their properties
    let entitiesWithPropsText = '';
    if (availableEntities.length > 0) {
      entitiesWithPropsText = availableEntities.map(entityType => {
        const simpleName = entityType.startsWith('kg:') ? entityType.substring(3) : entityType;
        const props = entityProperties[simpleName] || [];

        if (props.length === 0) {
          return `- ${entityType} (no properties found)`;
        }

        const propList = props.map(p => p.name).join(', ');
        return `- ${entityType}\n  Properties: ${propList}`;
      }).join('\n');
    } else {
      entitiesWithPropsText = '(none yet - will be determined from table)';
    }

    // Build sample labels list
    const sampleLabelsText = sampleLabels.length > 0
      ? sampleLabels.map(label => `  - "${label}"`).join('\n')
      : '(none)';

    return `You are a financial analyst assistant helping to understand questions about financial data.

Question: "${question}"

Conversation History:
${historyText}

Relevant Ontology Concepts (from semantic search):
${conceptsText}

⚠️ AVAILABLE DATA IN KNOWLEDGE GRAPH:
Years: ${yearsText}
Categories: ${categoriesText}

Knowledge Graph Structure:
The knowledge graph contains financial metrics as instances with properties:
- label: human-readable label describing what is measured
- value: numerical value (already converted to percentages where appropriate)
- year: time period for time-series data
- category: category for categorical data

Available Instance Labels in KG (sample):
${sampleLabelsText}

⚠️ CRITICAL CONSTRAINTS:
- You can ONLY query years from this list: ${yearsText}
- You can ONLY query categories from this list: ${categoriesText}
- DO NOT guess or hallucinate years outside this list
- Use the EXACT labels from the instance list when planning queries
- The semantically relevant ontology concepts indicate what domain this question relates to

Analyze this question and provide a clear understanding and plan for answering it.

Your response should include:

1. **Understanding**: What information is being requested? Explain in natural language.

2. **Relevant Metric Information**:
   - Label: What financial metric do we need? (use the exact label from the table)
   - Years Needed: Which years do we need data for?
   - Calculation: What calculation is needed (if any)?

3. **Plan**: Step-by-step plan for how to get the answer using the knowledge graph.
   For example:
   - Query for label "United Parcel Service Inc." in year "2008"
   - Query for label "S&P 500" in year "2008"
   - Calculate the difference between the two values

4. **Reasoning**: Why this approach will answer the question.

Write in clear, natural language - this is guidance for the agent, not executable code.`;
  }

  /**
   * Build prompt for answering phase
   */
  async _buildAnswerPrompt(question, understanding) {
    const historyText = this.conversationHistory.length > 0
      ? this.conversationHistory.map((h, i) =>
          `${i + 1}. Q: "${h.question}" A: "${h.answer}"`
        ).join('\n')
      : '(none)';

    // Get available labels to show in answer phase
    const sampleLabels = await this._getSampleInstanceLabels(15);
    const labelsText = sampleLabels.length > 0
      ? sampleLabels.map(label => `  - "${label}"`).join('\n')
      : '(none)';

    return `You are a financial analyst assistant. Answer this question using the available tools.

Question: "${question}"

Conversation History:
${historyText}

Understanding and Plan:
${understanding}

⚠️ AVAILABLE LABELS IN KNOWLEDGE GRAPH (USE THESE EXACT LABELS):
${labelsText}

⚠️ CRITICAL LABEL USAGE RULES:
1. ALWAYS use the EXACT label from the list above - DO NOT paraphrase, abbreviate, or modify
2. Copy the label character-for-character, including brackets, numbers, punctuation
3. Examples of CORRECT usage:
   ✅ query_kg({"label": "life annuity and disability obligations [2]", ...})
   ✅ query_kg({"label": "property and casualty obligations [1]", ...})
4. Examples of INCORRECT usage (DO NOT DO THIS):
   ❌ query_kg({"label": "life and annuity obligations", ...})  // Missing words + wrong bracket number
   ❌ query_kg({"label": "property/casualty obligations", ...})  // Changed formatting
   ❌ query_kg({"label": "total obligations", ...})  // Use just "total" if that's the exact label

Knowledge Graph Structure:
The KG contains financial metrics as instances with properties:
- label: human-readable label from the table
- value: numerical value
- year: time period (for time-series tables)
- category: category (for categorical tables like "less than 1 year", "1-3 years", "total")

Available Tools:

1. query_kg - Query for a specific financial metric by label and year/category
   For TIME-SERIES tables (with years):
   Usage: TOOL: query_kg({"label": "United Parcel Service Inc.", "year": "2008"})
   Usage: TOOL: query_kg({"label": "revenue", "year": "2007"})

   For CATEGORICAL tables (with categories):
   Usage: TOOL: query_kg({"label": "total", "category": "less than 1 year"})
   Usage: TOOL: query_kg({"label": "property and casualty obligations [1]", "category": "1-3 years"})

   Returns: {success: true, value: 181001, label: "...", year/category: "..."}

2. calculate - Perform arithmetic calculations
   Usage: TOOL: calculate({"operation": "percentage_change", "values": [181001, 206588]})
   Operations: add, subtract, multiply, divide, percentage_change

Instructions:
1. Follow the plan from the Understanding section as a guide
2. Use query_kg with EXACT labels from the list above
3. Use calculate for any arithmetic operations
4. After getting all needed data, provide just the numerical answer

Start by querying the knowledge graph.`;
  }

  /**
   * Parse understanding from LLM response
   */
  _parseUnderstanding(responseText) {
    // Return the understanding as-is (natural language text)
    // No JSON parsing needed - this is guidance for the agent
    return responseText.trim();
  }

  /**
   * Extract tool call from LLM response
   */
  _extractToolCall(responseText) {
    // Look for tool usage patterns
    // Expected format: TOOL: tool_name({"param": "value"})

    const toolMatch = responseText.match(/TOOL:\s*(\w+)\s*\((.*?)\)/s);
    if (!toolMatch) {
      return null;
    }

    try {
      const toolName = toolMatch[1];
      const inputJson = toolMatch[2].trim();
      const input = JSON.parse(inputJson);

      return { name: toolName, input };
    } catch (error) {
      this.logger.error('tool_extraction_error', {
        error: error.message,
        responseText
      });
      return null;
    }
  }

  /**
   * Execute a tool
   */
  async _executeTool(toolCall, toolContext) {
    const { name, input } = toolCall;

    // Find tool
    const tool = Object.values(this.tools).find(t => t.name === name);

    if (!tool) {
      return { error: `Unknown tool: ${name}` };
    }

    // Execute tool
    try {
      const result = await tool.execute(input, toolContext);
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Build continuation prompt with tool results
   */
  async _buildContinuationPrompt(question, understanding, toolCalls, lastResponse, lastResult) {
    const toolHistory = toolCalls.map((tc, i) =>
      `${i + 1}. Called ${tc.tool} with ${JSON.stringify(tc.input)}\n   Result: ${JSON.stringify(tc.output)}`
    ).join('\n');

    // Show labels in continuation too
    const sampleLabels = await this._getSampleInstanceLabels(15);
    const labelsText = sampleLabels.length > 0
      ? sampleLabels.map(label => `  - "${label}"`).join('\n')
      : '(none)';

    return `You are answering: "${question}"

⚠️ AVAILABLE LABELS (USE EXACT LABELS - DO NOT PARAPHRASE):
${labelsText}

Tool calls so far:
${toolHistory}

Your last response was:
${lastResponse}

The result was:
${JSON.stringify(lastResult)}

Continue reasoning or provide the final numerical answer. If you need to call another tool, use the format:
TOOL: tool_name({"param": "value"})

REMEMBER: Use EXACT labels from the list above. DO NOT modify, paraphrase, or abbreviate them.

If you have the final answer, respond with just the number.`;
  }

  /**
   * Extract answer from LLM response
   */
  _extractAnswer(responseText) {
    // Extract the numerical answer (preserving % symbols and other units)
    const text = String(responseText).trim();

    // Try to extract from the LAST line (where final answers usually are)
    const lines = text.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    // Check if last line is a number with optional % symbol
    const lastLineNumber = lastLine.match(/^[-+]?[0-9]*\.?[0-9]+%?$/);
    if (lastLineNumber) {
      return lastLineNumber[0];
    }

    // Otherwise, try to extract ANY number (with optional %) from the last line
    const lastLineMatch = lastLine.match(/[-+]?[0-9]*\.?[0-9]+%?/);
    if (lastLineMatch) {
      return lastLineMatch[0];
    }

    // Fall back to first number (with optional %) in entire text
    const numberMatch = text.match(/[-+]?[0-9]*\.?[0-9]+%?/);
    if (numberMatch) {
      return numberMatch[0];
    }

    // If no number found, return the text as-is
    return text;
  }

  /**
   * Reset conversation history (for new conversation)
   */
  resetConversation() {
    this.conversationHistory = [];
    this.logger.debug('conversation_reset');
  }
}
