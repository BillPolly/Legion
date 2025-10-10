/**
 * EntityRelationshipExtractor - Extract entities and relationships from raw text using LLM
 *
 * Identifies ALL entities (explicit and implicit) and relationships in raw text.
 * Resolves references using context.
 */

import { TemplatedPrompt } from '@legion/prompt-manager';

export class EntityRelationshipExtractor {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  /**
   * Extract entities and relationships from raw text
   * @param {string} rawText - Raw text with potential references
   * @param {Object} context - Context information (company, year, etc.)
   * @returns {Object} - { entities: [...], relationships: [...] }
   */
  async extract(rawText, context = {}) {
    // Format context for template
    const contextStr = Object.entries(context)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    // Create template string
    const templateStr = `You are an expert at extracting entities and relationships from financial text.

Task: Identify ALL entities and relationships in the given text.

Input Text: {{rawText}}

Context:
{{contextStr}}

Instructions:
1. Identify ALL entities (both explicit in text and implicit from context)
2. For each entity, specify:
   - name: The entity name
   - type: The entity type (e.g., "company", "financial_reserve", "amount", "year")
   - source: Where it came from ("text" for explicit, "context" for implicit)
3. Identify ALL relationships between entities
4. For each relationship, specify:
   - subject: The subject entity name
   - relation: The relationship type (e.g., "HAS", "HAS_AMOUNT", "IN_YEAR")
   - object: The object entity name

Return your answer as a JSON object with this structure:
{
  "entities": [
    {"name": "...", "type": "...", "source": "..."},
    ...
  ],
  "relationships": [
    {"subject": "...", "relation": "...", "object": "..."},
    ...
  ]
}

Only return the JSON, no other text.`;

    // Create prompt using TemplatedPrompt
    const prompt = new TemplatedPrompt(templateStr);

    // Generate prompt
    const promptText = prompt.substitute({ rawText, contextStr });

    // Call LLM with JSON validation
    const response = await this.llmClient.completeWithJsonValidation(promptText, 2000);

    // Strip markdown code fences if present
    let jsonText = response.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7); // Remove ```json
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3); // Remove ```
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3); // Remove trailing ```
    }
    jsonText = jsonText.trim();

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}\nResponse: ${jsonText}`);
    }

    // Validate structure
    if (!result.entities || !Array.isArray(result.entities)) {
      throw new Error('LLM response missing entities array');
    }
    if (!result.relationships || !Array.isArray(result.relationships)) {
      throw new Error('LLM response missing relationships array');
    }

    return result;
  }
}
