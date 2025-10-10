import { TemplatedPrompt } from '@legion/prompt-manager';

/**
 * ConceptExtractor - Extract key concepts from arbitrary data using LLM
 *
 * Domain-agnostic: Works with any data format (document, JSON, table, text)
 * Extracts entities, relationships, and attributes for ontology retrieval
 */
export class ConceptExtractor {
  constructor({ llmClient }) {
    if (!llmClient) {
      throw new Error('ConceptExtractor requires llmClient');
    }

    this.llmClient = llmClient;

    // Template for concept extraction
    this.extractTemplate = `You are analyzing data to extract key concepts for knowledge graph creation.

DATA:

{{data}}

TASK:

Extract the following from this data:

1. ENTITIES: Types of things/objects (e.g., person, organization, product, location)
2. RELATIONSHIPS: How entities relate (e.g., employed_by, located_in, owns)
3. ATTRIBUTES: Properties of entities (e.g., name, date, amount, status)

RESPONSE FORMAT:

Return ONLY a JSON object in this EXACT format (no other text):

{
  "entities": ["organization", "person"],
  "relationships": ["employed_by", "manages"],
  "attributes": ["name", "salary", "hire_date"]
}

IMPORTANT:
- Use generic concept names, not specific values (e.g., "organization" not "JKHY")
- Include all concept types present in the data
- Keep names lowercase and descriptive
- Return ONLY the JSON, no explanations`;
  }

  /**
   * Extract concepts from any data format
   * @param {any} data - Data in any format (object, array, string, etc.)
   * @returns {Promise<Object>} Extracted concepts
   */
  async extractConcepts(data) {
    // Convert data to string representation
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    const prompt = new TemplatedPrompt(this.extractTemplate, {
      maxRetries: 3
    });

    const response = await prompt.call(this.llmClient, {
      data: dataStr
    });

    // Parse JSON from response
    let concepts;
    try {
      // Extract JSON from response (may have markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      concepts = JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}\nResponse: ${response.substring(0, 200)}`);
    }

    // Validate structure
    if (!concepts.entities || !Array.isArray(concepts.entities)) {
      throw new Error(`LLM response missing 'entities' array. Got: ${JSON.stringify(concepts).substring(0, 200)}`);
    }
    if (!concepts.relationships || !Array.isArray(concepts.relationships)) {
      throw new Error(`LLM response missing 'relationships' array. Got: ${JSON.stringify(concepts).substring(0, 200)}`);
    }
    if (!concepts.attributes || !Array.isArray(concepts.attributes)) {
      throw new Error(`LLM response missing 'attributes' array. Got: ${JSON.stringify(concepts).substring(0, 200)}`);
    }

    return concepts;
  }
}
