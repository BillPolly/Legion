import { TemplatedPrompt } from '@legion/prompt-manager';
import { ValueExtractor } from './ValueExtractor.js';

/**
 * TextInstanceCreator - Create RDF instances from narrative text
 *
 * Phase 7 Update: Now uses ValueExtractor to create structured FinancialValue entities
 * for all numeric values in text, ensuring full metadata (currency, scale, units).
 */
export class TextInstanceCreator {
  constructor({ llmClient, tripleStore, ontologyRetriever }) {
    if (!llmClient) {
      throw new Error('TextInstanceCreator requires llmClient');
    }
    if (!tripleStore) {
      throw new Error('TextInstanceCreator requires tripleStore');
    }

    this.llmClient = llmClient;
    this.tripleStore = tripleStore;
    this.ontologyRetriever = ontologyRetriever;

    // Initialize Phase 7 components
    this.valueExtractor = new ValueExtractor();

    // Template for instance creation
    this.instanceTemplate = `You are creating RDF knowledge graph instances from text using a provided ontology.

ONTOLOGY:

{{ontology}}

TEXT:

{{text}}

TASK:

Extract all entities, their properties, and relationships from the text. Create RDF instances that conform to the ontology above.

RESPONSE FORMAT:

Return ONLY a JSON object in this EXACT format (no other text):

{
  "entities": [
    {
      "uri": "data:EntityID",
      "type": "kg:ClassName",
      "label": "Human readable label",
      "properties": {
        "kg:propertyName": "value"
      }
    }
  ],
  "relationships": [
    {
      "subject": "data:EntityID1",
      "predicate": "kg:relationshipName",
      "object": "data:EntityID2"
    }
  ]
}

IMPORTANT:
- Use URIs from the ontology for types, properties, and relationships
- Generate unique URIs for entities (e.g., "data:AcmeCorp", "data:Revenue2023")
- Include all entities mentioned in the text
- Extract all properties with their values
- Capture relationships between entities
- Return ONLY the JSON, no explanations`;
  }

  /**
   * Format prompt with ontology and text
   * @param {string} ontologyText - Formatted ontology text
   * @param {string} text - Narrative text to process
   * @returns {string} Formatted prompt
   */
  formatPrompt(ontologyText, text) {
    // Simple template substitution for testing/inspection
    return this.instanceTemplate
      .replace('{{ontology}}', ontologyText)
      .replace('{{text}}', text);
  }

  /**
   * Parse LLM response JSON
   * @param {string} response - LLM response string
   * @returns {Object} Parsed instance data
   */
  parseResponse(response) {
    try {
      // Extract JSON from response (may have markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!parsed.entities || !Array.isArray(parsed.entities)) {
        throw new Error(`Response missing 'entities' array. Got: ${JSON.stringify(parsed).substring(0, 200)}`);
      }
      if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
        throw new Error(`Response missing 'relationships' array. Got: ${JSON.stringify(parsed).substring(0, 200)}`);
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}\nResponse: ${response.substring(0, 300)}`);
    }
  }

  /**
   * Process entity properties to extract structured values (Phase 7)
   * @param {Object} instances - Parsed instances from LLM
   * @param {Object} metadata - Context metadata (currency, scale, etc.)
   * @returns {Object} Enhanced instances with FinancialValue entities
   */
  enhanceWithStructuredValues(instances, metadata = {}) {
    const valueEntities = [];
    const valueRelationships = [];

    // Process each entity
    instances.entities.forEach(entity => {
      // Case 1: LLM created FinancialValue entities but with empty properties
      // Populate them using ValueExtractor from their labels
      if (entity.type === 'kg:FinancialValue' &&
          (!entity.properties || Object.keys(entity.properties).length === 0) &&
          entity.label) {

        const extractedValue = this.valueExtractor.extractValue(entity.label, metadata);
        if (extractedValue) {
          // Populate properties
          entity.properties = {
            'kg:numericValue': extractedValue.numericValue.toString(),
            'kg:actualAmount': extractedValue.actualAmount.toString(),
            'kg:originalText': extractedValue.originalText,
            'kg:dataType': extractedValue.dataType,
            'kg:unit': extractedValue.unit,
            ...(extractedValue.currency && { 'kg:currency': extractedValue.currency }),
            ...(extractedValue.scale && { 'kg:scale': extractedValue.scale })
          };
        }
        return; // Don't process properties further
      }

      // Case 2: Regular entities with properties containing values
      const updatedProperties = {};

      for (const [propKey, propValue] of Object.entries(entity.properties || {})) {
        // Try to extract structured value
        const extractedValue = this.valueExtractor.extractValue(propValue, metadata);

        if (extractedValue && extractedValue.unit !== 'count') {
          // Create FinancialValue entity
          const valueEntity = this.valueExtractor.createFinancialValueEntity(extractedValue);
          valueEntities.push(valueEntity);

          // Create relationship instead of property
          valueRelationships.push({
            subject: entity.uri,
            predicate: propKey,
            object: valueEntity.uri
          });
        } else {
          // Keep as regular property
          updatedProperties[propKey] = propValue;
        }
      }

      entity.properties = updatedProperties;
    });

    return {
      entities: [...instances.entities, ...valueEntities],
      relationships: [...instances.relationships, ...valueRelationships]
    };
  }

  /**
   * Create RDF instances from narrative text
   * @param {string} text - Narrative text
   * @param {string} ontologyText - Formatted ontology text
   * @param {Object} metadata - Optional metadata (currency, scale, sourceDocument)
   * @returns {Promise<Object>} Instance data with entities and relationships
   */
  async createInstancesFromText(text, ontologyText, metadata = {}) {
    const prompt = new TemplatedPrompt(this.instanceTemplate, {
      maxRetries: 3
    });

    const response = await prompt.call(this.llmClient, {
      ontology: ontologyText,
      text: text
    });

    const instances = this.parseResponse(response);

    // Phase 7: Enhance with structured FinancialValue entities
    const enhanced = this.enhanceWithStructuredValues(instances, metadata);

    return enhanced;
  }
}
