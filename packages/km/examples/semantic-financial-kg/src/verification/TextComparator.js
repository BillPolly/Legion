/**
 * TextComparator - Compare original text with reconstructed text using LLM
 *
 * Uses LLM to semantically compare original text with reconstructed text
 * to verify that the knowledge graph captured the intended meaning.
 * Returns similarity score and identifies any missing or incorrect information.
 */

import { TemplatedPrompt } from '@legion/prompt-manager';

export class TextComparator {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  /**
   * Compare original and reconstructed text
   * @param {string} originalText - Original source text
   * @param {string} reconstructedText - Text reconstructed from entity model
   * @returns {Promise<Object>} - { similarityScore, factsMatch, missingFacts, incorrectFacts, assessment }
   */
  async compare(originalText, reconstructedText) {
    // Create template
    const templateStr = `You are an expert at comparing texts for semantic equivalence and factual accuracy.

Task: Compare the original text with text reconstructed from a knowledge graph to verify all facts were captured correctly.

Original Text:
{{originalText}}

Reconstructed Text:
{{reconstructedText}}

Instructions:
1. Determine if the reconstructed text captures ALL the facts from the original text
2. Identify any missing facts (in original but not reconstructed)
3. Identify any incorrect facts (wrong in reconstructed)
4. Rate the overall similarity on a scale of 0.0 to 1.0 where:
   - 1.0 = Perfect match, all facts captured correctly
   - 0.8-0.9 = Very good, minor wording differences but facts correct
   - 0.6-0.7 = Good, most facts correct but some details missing
   - 0.4-0.5 = Fair, significant facts missing or incorrect
   - 0.0-0.3 = Poor, major facts missing or incorrect

Return your answer as a JSON object with this structure:
{
  "similarityScore": 0.95,
  "factsMatch": true,
  "missingFacts": ["fact that was in original but not reconstructed", ...],
  "incorrectFacts": ["fact that is wrong in reconstructed", ...],
  "assessment": "Brief explanation of the comparison"
}

Only return the JSON, no other text.`;

    // Create prompt
    const prompt = new TemplatedPrompt(templateStr);
    const promptText = prompt.substitute({ originalText, reconstructedText });

    // Call LLM with JSON validation
    const response = await this.llmClient.completeWithJsonValidation(promptText, 2000);

    // Strip markdown code fences if present
    let jsonText = response.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
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
    if (typeof result.similarityScore !== 'number') {
      throw new Error('LLM response missing or invalid similarityScore');
    }
    if (typeof result.factsMatch !== 'boolean') {
      throw new Error('LLM response missing or invalid factsMatch');
    }
    if (!Array.isArray(result.missingFacts)) {
      throw new Error('LLM response missing missingFacts array');
    }
    if (!Array.isArray(result.incorrectFacts)) {
      throw new Error('LLM response missing incorrectFacts array');
    }
    if (typeof result.assessment !== 'string') {
      throw new Error('LLM response missing assessment string');
    }

    // Normalize similarity score to 0-1 range
    if (result.similarityScore < 0) result.similarityScore = 0;
    if (result.similarityScore > 1) result.similarityScore = 1;

    return result;
  }

  /**
   * Quick verification check - just returns true/false if texts match
   * @param {string} originalText - Original source text
   * @param {string} reconstructedText - Reconstructed text
   * @param {number} threshold - Minimum similarity score to consider match (default 0.8)
   * @returns {Promise<boolean>} - True if texts match above threshold
   */
  async verify(originalText, reconstructedText, threshold = 0.8) {
    const result = await this.compare(originalText, reconstructedText);
    return result.similarityScore >= threshold && result.factsMatch;
  }
}
