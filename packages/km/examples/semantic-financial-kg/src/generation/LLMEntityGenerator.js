/**
 * LLMEntityGenerator - Generate entity models from sentences using LLM
 *
 * Takes a simple sentence and ontology candidates, uses LLM to decide:
 * - Which ontology classes to instantiate
 * - What properties to use
 * - How to structure relationships
 * - Entity URIs and property values
 */

import { TemplatedPrompt } from '@legion/prompt-manager';

export class LLMEntityGenerator {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  /**
   * Generate entity model from sentence and ontology candidates
   * @param {string} sentence - Simple sentence describing facts
   * @param {Array} candidates - Ontology candidates with definitions
   * @returns {Object} - { entities: [...], relationships: [...] }
   */
  async generate(sentence, candidates) {
    // Format candidates for template
    const candidatesStr = candidates
      .map(c => {
        let desc = `- ${c.uri} (${c.type})`;
        if (c.label) desc += `\n  Label: ${c.label}`;
        if (c.comment) desc += `\n  Comment: ${c.comment}`;
        if (c.propertyType) desc += `\n  Property Type: ${c.propertyType}`;
        if (c.domain) desc += `\n  Domain: ${c.domain}`;
        if (c.range) desc += `\n  Range: ${c.range}`;
        return desc;
      })
      .join('\n\n');

    // Create template string
    const templateStr = `You are an expert at creating RDF entity models from natural language using ontologies.

Task: Generate a complete entity model for the given sentence using the provided ontology candidates.

Sentence: {{sentence}}

Available Ontology Candidates:
{{candidatesStr}}

Instructions:
1. Identify the entities mentioned in the sentence
2. Choose the appropriate ontology class for each entity (from candidates)
3. Generate a unique URI for each entity instance (e.g., "poc:AcmeCorp", "poc:Reserve_Acme_2023")
4. Identify relationships between entities
5. Choose the appropriate ontology property for each relationship (from candidates)
6. Create property assertions (entity has datatype property value)

Return your answer as a JSON object with this structure:
{
  "entities": [
    {
      "uri": "poc:EntityName",
      "type": "poc:ClassName",
      "label": "Human readable label",
      "properties": {
        "propertyName": "value"
      }
    },
    ...
  ],
  "relationships": [
    {
      "subject": "poc:Entity1URI",
      "predicate": "poc:propertyURI",
      "object": "poc:Entity2URI"
    },
    ...
  ]
}

Important:
- Use the ontology classes and properties from the candidates list
- Generate meaningful URIs that identify the specific entity instances
- Include all facts from the sentence
- Properties in entities are for datatype properties (strings, numbers, dates)
- Relationships are for object properties (entity to entity)

Only return the JSON, no other text.`;

    // Create prompt using TemplatedPrompt
    const prompt = new TemplatedPrompt(templateStr);

    // Generate prompt
    const promptText = prompt.substitute({ sentence, candidatesStr });

    // Call LLM with JSON validation
    const response = await this.llmClient.completeWithJsonValidation(promptText, 3000);

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

    // Validate entity structure
    result.entities.forEach((entity, idx) => {
      if (!entity.uri || typeof entity.uri !== 'string') {
        throw new Error(`Entity ${idx} missing valid uri field`);
      }
      if (!entity.type || typeof entity.type !== 'string') {
        throw new Error(`Entity ${idx} missing valid type field`);
      }
    });

    // Validate relationship structure
    result.relationships.forEach((rel, idx) => {
      if (!rel.subject || typeof rel.subject !== 'string') {
        throw new Error(`Relationship ${idx} missing valid subject field`);
      }
      if (!rel.predicate || typeof rel.predicate !== 'string') {
        throw new Error(`Relationship ${idx} missing valid predicate field`);
      }
      if (!rel.object || typeof rel.object !== 'string') {
        throw new Error(`Relationship ${idx} missing valid object field`);
      }
    });

    return result;
  }
}
