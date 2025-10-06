/**
 * TextProcessor - Extracts structured facts from text paragraphs
 *
 * Processes pre_text and post_text from ConvFinQA examples to extract:
 * - Entities (e.g., "litigation reserves", "net income")
 * - Numeric values (e.g., "$3.7 billion", "15%")
 * - Temporal references (e.g., "current year", "2012", "prior year")
 * - Relationships between entities
 *
 * These facts are added to the KG to support questions that reference text-based data.
 */

export class TextProcessor {
  constructor(llmClient) {
    this.llmClient = llmClient;
  }

  /**
   * Extract structured facts from text paragraphs
   *
   * @param {Array<string>} textParagraphs - Array of text paragraphs (pre_text + post_text)
   * @param {Object} tableContext - Context from table (years, entity types)
   * @returns {Promise<Array<Object>>} Array of extracted facts
   */
  async extractFacts(textParagraphs, tableContext = {}) {
    if (!textParagraphs || textParagraphs.length === 0) {
      return [];
    }

    const textContent = textParagraphs.join('\n\n');

    const prompt = `Extract structured facts from this financial text.

CONTEXT:
${tableContext.years ? `Years in table: ${tableContext.years.join(', ')}` : ''}
${tableContext.entityType ? `Primary entity type: ${tableContext.entityType}` : ''}

TEXT:
${textContent}

TASK:
Extract all facts that contain numeric values (dollar amounts, percentages, counts, etc.).
For each fact, identify:
1. The entity/concept (e.g., "litigation reserves", "net income", "share price")
2. The numeric value (e.g., "3.7 billion", "15%", "1.27")
3. The year/time period (e.g., "2012", "current year", "prior year")
4. Any additional context (e.g., "additional", "total", "before tax")

CRITICAL RULES:
- Extract ONLY facts with numeric values
- Preserve the exact numeric values (don't convert units)
- Map temporal references to specific years when possible:
  * "current year" → most recent year in table
  * "prior year" → year before current
  * "2012", "2011" → exact year
- Each fact should be self-contained
- Include units (billion, million, %, etc.)

RESPONSE FORMAT:
Return a JSON array of facts. Each fact has:
{
  "entity": "litigation reserves",
  "value": "3.7 billion",
  "numericValue": 3.7,
  "unit": "billion",
  "year": "2012",
  "context": "additional litigation reserves",
  "sourceText": "The current year included expense of $3.7 billion for additional litigation reserves"
}

If the text references relative years:
- Map "current year" to ${tableContext.currentYear || 'most recent year'}
- Map "prior year" to ${tableContext.priorYear || 'previous year'}
- Map "two years ago" to ${tableContext.twoYearsAgo || 'two years before current'}

Return ONLY the JSON array, no explanation.`;

    try {
      const response = await this.llmClient.request({
        prompt,
        maxTokens: 8000, // Maximum token limit for extracting many facts from large texts
        temperature: 0
      });

      const facts = this._parseJSON(response.content);

      console.log(`  ✓ Extracted ${facts.length} facts from text`);

      return Array.isArray(facts) ? facts : [];

    } catch (error) {
      console.error(`  ⚠️  Failed to extract facts from text: ${error.message}`);
      return [];
    }
  }

  /**
   * Convert extracted facts to KG triples
   *
   * @param {Array<Object>} facts - Extracted facts from extractFacts()
   * @param {string} entityTypePrefix - Prefix for entity URIs (e.g., "kg:FinancialMetric")
   * @returns {Array<Object>} Array of triples {subject, predicate, object}
   */
  factsToTriples(facts, entityTypePrefix = 'kg:TextFact') {
    const triples = [];

    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];

      // Normalize entity name for URI
      const normalizedEntity = fact.entity
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

      const year = fact.year || 'unknown';
      const instanceUri = `kg:text_${normalizedEntity}_${year}_${i}`;

      // Create instance
      triples.push({
        subject: instanceUri,
        predicate: 'rdf:type',
        object: entityTypePrefix
      });

      // Add entity label
      triples.push({
        subject: instanceUri,
        predicate: 'kg:label',
        object: `"${fact.entity}"`
      });

      // Add numeric value
      if (fact.numericValue !== undefined && fact.numericValue !== null) {
        triples.push({
          subject: instanceUri,
          predicate: 'kg:value',
          object: fact.numericValue
        });
      }

      // Add value string (with units)
      if (fact.value) {
        triples.push({
          subject: instanceUri,
          predicate: 'kg:valueString',
          object: `"${fact.value}"`
        });
      }

      // Add unit
      if (fact.unit) {
        triples.push({
          subject: instanceUri,
          predicate: 'kg:unit',
          object: `"${fact.unit}"`
        });
      }

      // Add year
      if (fact.year) {
        triples.push({
          subject: instanceUri,
          predicate: 'kg:year',
          object: `"${fact.year}"`
        });
      }

      // Add context
      if (fact.context) {
        triples.push({
          subject: instanceUri,
          predicate: 'kg:context',
          object: `"${fact.context}"`
        });
      }

      // Add source text
      if (fact.sourceText) {
        triples.push({
          subject: instanceUri,
          predicate: 'kg:sourceText',
          object: `"${fact.sourceText}"`
        });
      }
    }

    return triples;
  }

  /**
   * Parse JSON from LLM response
   */
  _parseJSON(responseText) {
    try {
      // Try code block first
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      // Extract first complete JSON array by balancing brackets
      const startIdx = responseText.indexOf('[');
      if (startIdx === -1) {
        throw new Error('No JSON array found');
      }

      let bracketCount = 0;
      let endIdx = startIdx;

      for (let i = startIdx; i < responseText.length; i++) {
        if (responseText[i] === '[') bracketCount++;
        if (responseText[i] === ']') bracketCount--;

        if (bracketCount === 0) {
          endIdx = i;
          break;
        }
      }

      const jsonText = responseText.substring(startIdx, endIdx + 1);
      return JSON.parse(jsonText);

    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}\nResponse: ${responseText}`);
    }
  }
}
