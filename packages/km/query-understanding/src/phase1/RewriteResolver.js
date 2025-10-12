/**
 * RewriteResolver - Phase 1: Rewrite & Resolve
 *
 * Transforms conversational/elliptical questions into explicit canonical form using LLM.
 *
 * Responsibilities:
 * 1. Resolve references (pronouns, demonstratives, ellipsis)
 * 2. Normalize entities to canonical IRIs
 * 3. Normalize dates (relative → ISO 8601)
 * 4. Parse units with values
 * 5. Canonicalize verb lemmas
 *
 * @module @legion/query-understanding/phase1
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { createValidator } from '@legion/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GraphContextRetriever } from '../context/GraphContextRetriever.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the CanonicalQuestion schema
const schemaPath = join(__dirname, '../../schemas/CanonicalQuestion.schema.json');
const canonicalQuestionSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

export class RewriteResolver {
  /**
   * Create a new RewriteResolver
   *
   * @param {Object} llmClient - LLM client from ResourceManager
   * @throws {Error} If llmClient not provided
   */
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required for RewriteResolver');
    }

    this.llmClient = llmClient;
    this.validator = createValidator(canonicalQuestionSchema);

    // Initialize TemplatedPrompt for question rewriting
    this.templatedPrompt = new TemplatedPrompt({
      prompt: this.createPromptTemplate(),
      responseSchema: canonicalQuestionSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });
  }

  /**
   * Create the prompt template for question rewriting
   *
   * @returns {string} Prompt template
   * @private
   */
  createPromptTemplate() {
    return `You are a question normalization system. Your task is to transform conversational or elliptical questions into explicit canonical form.

# CONTEXT
{{#if context.previousQuestion}}Previous question: {{context.previousQuestion}}{{/if}}
{{#if context.domain}}Domain: {{context.domain}}{{/if}}
{{#if context.conversationHistory}}
Conversation history:
{{#each context.conversationHistory}}
- {{this}}
{{/each}}
{{/if}}
{{#if context.graphContext}}

## Graph Context
The following entities and their properties/relationships are available from the knowledge graph:

{{context.graphContext}}

Use this graph information to resolve pronouns, possessives, and implicit references.
For example:
- "its capital" can be resolved by looking at the hasCapital relationship
- "larger than France" can be resolved by comparing population properties
- "its neighbors" can be resolved by looking at the borders relationship
{{/if}}

# CURRENT QUESTION
{{question}}

# YOUR TASK
Transform the above question into explicit canonical form by:

1. **Resolve References**:
   - Replace pronouns with their referents (it → Ada Lovelace)
   - Replace demonstratives with specific entities (this company → Microsoft)
   - Expand ellipsis (and in 2008? → what is net cash from operating activities in 2008?)

2. **Normalize Entities**:
   - Convert entity names to canonical form
   - Expand aliases (USA → United States)
   - Mark with type (PERSON, PLACE, MEASURE, ORGANIZATION, etc.)
   - Provide canonical IRI (e.g., :Ada_Lovelace, :United_States)

3. **Normalize Dates**:
   - Convert relative dates (yesterday → specific ISO date)
   - Parse natural language dates (Q3 2023 → 2023-07-01/2023-09-30)
   - Handle contextual references by checking conversation history FIRST:
     * "this year", "that year" → look for the most recently mentioned year in conversation history
     * "next year", "previous year" → relative to most recent year in history
     * If no year in history, use current date: {{currentDate}}

4. **Parse Units**:
   - Extract numeric values with units (206k USD → value: 206000, unit: "USD")
   - Handle implied millions/thousands (5 million → value: 5000000)
   - Keep null for unitless numbers

5. **Canonicalize Lemmas**:
   - Use base verb forms (was born → born)
   - Standardize be/have forms (is/are/was → be)

6. **Identify WH-role**:
   - Determine the interrogative type: what, which, who, where, when, how-many, how-much, why, how, yn

# IMPORTANT RULES
- If context is insufficient to resolve a reference, set needs_clarification: true and specify what's missing
- If multiple interpretations exist, provide alternatives with confidence scores
- Keep the question's original intent - don't add or remove information
- Use ISO 8601 format for dates (YYYY-MM-DD or YYYY-MM-DD/YYYY-MM-DD for ranges)
- Always include span positions [start, end] for entities, dates, and units
- Language is always "en" for MVP

# EXAMPLES
Input: "what about in 2008?"
Context: Previous question was "what is net cash from operating activities in 2007?"
Output:
{
  "text": "what is net cash from operating activities in 2008?",
  "entities": [
    {
      "span": [8, 45],
      "value": "net cash from operating activities",
      "type": "MEASURE",
      "canonical": ":NetCashFromOperatingActivities"
    }
  ],
  "dates": [
    {
      "span": [49, 53],
      "iso": "2008-01-01/2008-12-31"
    }
  ],
  "units": [],
  "wh_role": "what",
  "lang": "en"
}

Input: "and from this year to 2009, what was the fluctuation for that stock?"
Context: Previous question was "what was the fluctuation of the performance price of UPS between 2004 and 2006?"
Note: "this year" refers to the END year (2006) of the previous range "2004 to 2006"
Output:
{
  "text": "what was the performance price fluctuation of UPS from 2006 to 2009?",
  "entities": [
    {
      "span": [14, 45],
      "value": "performance price fluctuation",
      "type": "MEASURE",
      "canonical": ":performance"
    },
    {
      "span": [49, 52],
      "value": "UPS",
      "type": "ORGANIZATION",
      "canonical": ":UPS"
    }
  ],
  "dates": [
    {
      "span": [58, 62],
      "iso": "2006-01-01/2006-12-31"
    },
    {
      "span": [66, 70],
      "iso": "2009-01-01/2009-12-31"
    }
  ],
  "units": [],
  "wh_role": "what",
  "lang": "en"
}

Input: "Which countries border Germany?"
Output:
{
  "text": "which countries border Germany?",
  "entities": [
    {
      "span": [24, 31],
      "value": "Germany",
      "type": "PLACE",
      "canonical": ":Germany"
    }
  ],
  "dates": [],
  "units": [],
  "wh_role": "which",
  "lang": "en"
}

Input: "What revenue exceeds 206k USD?"
Output:
{
  "text": "what revenue exceeds 206k USD?",
  "entities": [
    {
      "span": [5, 12],
      "value": "revenue",
      "type": "MEASURE",
      "canonical": ":revenue"
    }
  ],
  "dates": [],
  "units": [
    {
      "span": [21, 29],
      "value": 206000,
      "unit": "USD"
    }
  ],
  "wh_role": "what",
  "lang": "en"
}`;
  }

  /**
   * Resolve and rewrite a question into canonical form
   *
   * @param {string} question - Natural language question
   * @param {Object} context - Optional context
   * @param {string} [context.previousQuestion] - Previous question in conversation
   * @param {string} [context.domain] - Domain hint (finance, geography, etc.)
   * @param {Array<string>} [context.conversationHistory] - Full conversation history
   * @param {Object} [context.graphContext] - Graph context (entities + relationships)
   * @param {Array} [context.previousResults] - Results from previous turn
   * @returns {Promise<Object>} CanonicalQuestion object
   * @throws {Error} If question is invalid or processing fails
   */
  async resolve(question, context = {}) {
    // Validate input
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new Error('Question must be a non-empty string');
    }

    // Format graph context if available
    let formattedGraphContext = null;
    if (context.graphContext && typeof context.graphContext === 'object') {
      // Use static method from GraphContextRetriever to format
      // (We create a temporary instance just to call the formatter)
      const tempRetriever = new GraphContextRetriever({ query: () => {} });
      formattedGraphContext = tempRetriever.formatForPrompt(context.graphContext);
    }

    // Prepare data for template
    const templateData = {
      question: question.trim(),
      context: {
        previousQuestion: context.previousQuestion || null,
        domain: context.domain || null,
        conversationHistory: context.conversationHistory || null,
        graphContext: formattedGraphContext || null,
        previousResults: context.previousResults || null
      },
      currentDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };

    // Execute the templated prompt
    const result = await this.templatedPrompt.execute(templateData);

    // Check if LLM call succeeded
    if (!result.success) {
      throw new Error(`Failed to resolve question after ${this.templatedPrompt.maxRetries} attempts: ${result.errors.join('; ')}`);
    }

    // Validate the output against schema (should already be valid from TemplatedPrompt, but double-check)
    const validation = this.validator.validate(result.data);
    if (!validation.valid) {
      throw new Error(`LLM output validation failed: ${JSON.stringify(validation.errors)}`);
    }

    return result.data;
  }

  /**
   * Check if question needs clarification
   *
   * @param {Object} canonicalQuestion - CanonicalQuestion object
   * @returns {boolean} True if clarification needed
   */
  needsClarification(canonicalQuestion) {
    return canonicalQuestion.needs_clarification === true;
  }

  /**
   * Check if question has ambiguities
   *
   * @param {Object} canonicalQuestion - CanonicalQuestion object
   * @returns {boolean} True if alternatives exist
   */
  hasAmbiguities(canonicalQuestion) {
    return !!(canonicalQuestion.alternatives && canonicalQuestion.alternatives.length > 0);
  }

  /**
   * Get clarification requirements
   *
   * @param {Object} canonicalQuestion - CanonicalQuestion object
   * @returns {Array<string>|null} List of missing information or null
   */
  getClarificationNeeds(canonicalQuestion) {
    if (!this.needsClarification(canonicalQuestion)) {
      return null;
    }
    return canonicalQuestion.missing || [];
  }

  /**
   * Get alternative interpretations
   *
   * @param {Object} canonicalQuestion - CanonicalQuestion object
   * @returns {Array<Object>|null} List of alternatives or null
   */
  getAlternatives(canonicalQuestion) {
    if (!this.hasAmbiguities(canonicalQuestion)) {
      return null;
    }
    return canonicalQuestion.alternatives;
  }
}

export default RewriteResolver;
