/**
 * SimpleSentenceGenerator - Generate simple unambiguous sentences from entities and relationships
 *
 * Rewrites as subject-verb-object sentences using identified entities.
 * No pronouns, no references, no ambiguity.
 */

import { TemplatedPrompt } from '@legion/prompt-manager';

export class SimpleSentenceGenerator {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  /**
   * Generate simple sentences from entities and relationships
   * @param {Array} entities - Array of entity objects
   * @param {Array} relationships - Array of relationship objects
   * @returns {Object} - { sentences: [...] }
   */
  async generate(entities, relationships) {
    // Format entities for template
    const entitiesStr = entities
      .map(e => `- ${e.name} (${e.type})`)
      .join('\n');

    // Format relationships for template
    const relationshipsStr = relationships
      .map(r => `- ${r.subject} ${r.relation} ${r.object}`)
      .join('\n');

    // Create template string
    const templateStr = `You are an expert at rewriting text as simple, unambiguous sentences.

Task: Rewrite the following entities and relationships as simple subject-verb-object sentences.

Entities:
{{entitiesStr}}

Relationships:
{{relationshipsStr}}

Instructions:
1. Create one sentence per relationship
2. Use explicit entity names (NO pronouns like "it", "they", "this", "that")
3. Use explicit references (NO words like "the company", "the amount" - use actual names)
4. Subject-Verb-Object structure
5. Each sentence must be self-contained and unambiguous
6. Use natural language verbs (e.g., "has", "is", "are", "equals", "refers to")

Return your answer as a JSON object with this structure:
{
  "sentences": [
    "...",
    "...",
    ...
  ]
}

Only return the JSON, no other text.`;

    // Create prompt using TemplatedPrompt
    const prompt = new TemplatedPrompt(templateStr);

    // Generate prompt
    const promptText = prompt.substitute({ entitiesStr, relationshipsStr });

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
    if (!result.sentences || !Array.isArray(result.sentences)) {
      throw new Error('LLM response missing sentences array');
    }

    return result;
  }
}
