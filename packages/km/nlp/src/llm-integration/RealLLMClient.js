/**
 * RealLLMClient - Production LLM client implementation for NLP system
 * 
 * Uses the real LLM client from @legion/llm via ResourceManager.
 * NO MOCKS, NO FALLBACKS - requires real LLM to function.
 */

import { LLMClient } from './LLMClient.js';
import { ResourceManager } from '../../../../resource-manager/src/index.js';

export class RealLLMClient extends LLMClient {
  constructor(options = {}) {
    super(options);
    this.llmClient = null;
    this.resourceManager = null;
  }

  /**
   * Initialize the real LLM client from ResourceManager
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.llmClient) {
      return; // Already initialized
    }

    // Get ResourceManager singleton
    this.resourceManager = await ResourceManager.getInstance();
    
    // Get real LLM client - fail fast if not available
    this.llmClient = await this.resourceManager.get('llmClient');
    
    if (!this.llmClient) {
      throw new Error('Failed to get LLM client from ResourceManager - no LLM available');
    }
  }

  /**
   * Extract entities from text with schema guidance using real LLM
   * @param {string} text - Input text to process
   * @param {Object} schema - Entity schema for guidance
   * @param {Object} context - Processing context
   * @returns {Promise<Object>} - Entity extraction result
   */
  async extractEntities(text, schema, context = {}) {
    this.validateInput(text, 'extractEntities');
    await this.initialize();

    const systemPrompt = `You are an expert entity extraction system for knowledge graphs. 
Extract entities from the given text according to the provided schema.
Return your response as valid JSON only, with no additional text or markdown.`;

    const prompt = `Extract entities from the following text according to the schema provided.

Text: "${text}"

Domain: ${context.domain || 'general'}

Entity Schema:
${JSON.stringify(schema, null, 2)}

Instructions:
1. Identify all entities that match the types defined in the schema
2. Extract the entity text, type, and any relevant properties
3. Assign confidence scores between 0 and 1
4. Provide unique identifiers for each entity

Required JSON format:
{
  "entities": [
    {
      "id": "unique_id",
      "text": "entity text as it appears",
      "type": "EntityType from schema",
      "properties": {},
      "confidence": 0.95,
      "span": {"start": 0, "end": 10}
    }
  ],
  "metadata": {
    "domain": "${context.domain || 'general'}",
    "totalFound": 0
  }
}

Return ONLY the JSON response, no other text:`;

    try {
      // Set system prompt on the LLM client
      if (systemPrompt) {
        this.llmClient.systemPrompt = systemPrompt;
      }
      
      // LLMClient.complete expects (prompt, maxTokens)
      const response = await this.llmClient.complete(prompt, 2000);

      // Parse the JSON response
      const result = this._parseJsonResponse(response);
      
      return {
        entities: result.entities || [],
        metadata: result.metadata || {},
        success: true
      };
    } catch (error) {
      throw new Error(`Entity extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract relationships between entities with ontological constraints
   * @param {string} text - Input text to process
   * @param {Array} entities - Previously identified entities
   * @param {Array} relationshipTypes - Available relationship types
   * @returns {Promise<Object>} - Relationship extraction result
   */
  async extractRelationships(text, entities, relationshipTypes) {
    await this.initialize();
    
    if (!entities || entities.length === 0) {
      return { relationships: [], success: true };
    }

    const systemPrompt = `You are an expert relationship extraction system for knowledge graphs.
Extract relationships between the provided entities based on the text.
Return your response as valid JSON only, with no additional text or markdown.`;

    const prompt = `Extract relationships between entities from the following text.

Text: "${text}"

Entities found:
${JSON.stringify(entities.map(e => ({ id: e.id, text: e.text, type: e.type })), null, 2)}

Available relationship types:
${JSON.stringify(relationshipTypes, null, 2)}

Instructions:
1. Identify relationships between the given entities
2. Use only the provided relationship types
3. Include confidence scores between 0 and 1
4. Provide evidence text from the source

Required JSON format:
{
  "relationships": [
    {
      "id": "rel_unique_id",
      "subject": "entity_id",
      "predicate": "relationship_type",
      "object": "entity_id",
      "confidence": 0.9,
      "evidence": "text supporting this relationship"
    }
  ],
  "metadata": {
    "totalFound": 0
  }
}

Return ONLY the JSON response, no other text:`;

    try {
      // Set system prompt on the LLM client
      if (systemPrompt) {
        this.llmClient.systemPrompt = systemPrompt;
      }
      
      // LLMClient.complete expects (prompt, maxTokens)
      const response = await this.llmClient.complete(prompt, 2000);

      const result = this._parseJsonResponse(response);
      
      return {
        relationships: result.relationships || [],
        metadata: result.metadata || {},
        success: true
      };
    } catch (error) {
      throw new Error(`Relationship extraction failed: ${error.message}`);
    }
  }

  /**
   * Assess quality of extraction results
   * @param {string} original - Original text
   * @param {Array} extracted - Extracted KG triples
   * @param {string} paraphrase - Generated paraphrase
   * @returns {Promise<Object>} - Quality assessment result
   */
  async assessQuality(original, extracted, paraphrase) {
    await this.initialize();

    const systemPrompt = `You are an expert quality assessor for knowledge extraction systems.
Evaluate the quality and completeness of the extracted knowledge.
Return your response as valid JSON only.`;

    const prompt = `Assess the quality of knowledge extraction from the following:

Original Text: "${original}"

Extracted Triples:
${JSON.stringify(extracted, null, 2)}

Generated Paraphrase: "${paraphrase || 'N/A'}"

Evaluate:
1. Completeness: Are all key facts captured?
2. Accuracy: Are the extracted facts correct?
3. Consistency: Do the triples accurately represent the original?
4. Coverage: What percentage of information was captured?

Required JSON format:
{
  "scores": {
    "completeness": 0.0,
    "accuracy": 0.0,
    "consistency": 0.0,
    "coverage": 0.0
  },
  "overall": 0.0,
  "issues": [],
  "suggestions": []
}

Return ONLY the JSON response:`;

    try {
      // Set system prompt on the LLM client
      if (systemPrompt) {
        this.llmClient.systemPrompt = systemPrompt;
      }
      
      // LLMClient.complete expects (prompt, maxTokens)
      const response = await this.llmClient.complete(prompt, 1000);

      return this._parseJsonResponse(response);
    } catch (error) {
      throw new Error(`Quality assessment failed: ${error.message}`);
    }
  }

  /**
   * Compare semantic similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {Promise<Object>} - Similarity comparison result
   */
  async compareSemantics(text1, text2) {
    await this.initialize();

    const systemPrompt = `You are an expert semantic similarity analyzer.
Compare the semantic meaning of two texts.
Return your response as valid JSON only.`;

    const prompt = `Compare the semantic similarity between these two texts:

Text 1: "${text1}"
Text 2: "${text2}"

Analyze:
1. Overall semantic similarity (0-1 scale)
2. Shared concepts and entities
3. Differences in meaning
4. Whether they convey the same information

Required JSON format:
{
  "similarity": 0.0,
  "sharedConcepts": [],
  "differences": [],
  "equivalent": false,
  "explanation": ""
}

Return ONLY the JSON response:`;

    try {
      // Set system prompt on the LLM client
      if (systemPrompt) {
        this.llmClient.systemPrompt = systemPrompt;
      }
      
      // LLMClient.complete expects (prompt, maxTokens)
      const response = await this.llmClient.complete(prompt, 1000);

      return this._parseJsonResponse(response);
    } catch (error) {
      throw new Error(`Semantic comparison failed: ${error.message}`);
    }
  }

  /**
   * Disambiguate entity references using context
   * @param {string} entity - Entity mention to disambiguate
   * @param {Object} context - Disambiguation context
   * @param {Array} candidates - Candidate entities
   * @returns {Promise<Object>} - Disambiguation result
   */
  async disambiguate(entity, context, candidates) {
    await this.initialize();

    const systemPrompt = `You are an expert entity disambiguation system.
Determine which candidate entity best matches the mention in context.
Return your response as valid JSON only.`;

    const prompt = `Disambiguate the entity mention "${entity}" given the context.

Context: ${JSON.stringify(context, null, 2)}

Candidate entities:
${JSON.stringify(candidates, null, 2)}

Select the best matching candidate and explain why.

Required JSON format:
{
  "selectedCandidate": "candidate_id or null",
  "confidence": 0.0,
  "reasoning": "",
  "alternativeCandidates": []
}

Return ONLY the JSON response:`;

    try {
      // Set system prompt on the LLM client
      if (systemPrompt) {
        this.llmClient.systemPrompt = systemPrompt;
      }
      
      // LLMClient.complete expects (prompt, maxTokens)
      const response = await this.llmClient.complete(prompt, 1000);

      return this._parseJsonResponse(response);
    } catch (error) {
      throw new Error(`Disambiguation failed: ${error.message}`);
    }
  }

  /**
   * Parse JSON response from LLM, handling potential formatting issues
   * @param {string} response - LLM response text
   * @returns {Object} - Parsed JSON object
   * @private
   */
  _parseJsonResponse(response) {
    try {
      // Try direct JSON parse first
      return JSON.parse(response);
    } catch (error) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerError) {
          // Continue to next attempt
        }
      }

      // Try to find JSON object in the response
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch (innerError) {
          // Continue to throw original error
        }
      }

      throw new Error(`Failed to parse JSON response: ${error.message}`);
    }
  }
}