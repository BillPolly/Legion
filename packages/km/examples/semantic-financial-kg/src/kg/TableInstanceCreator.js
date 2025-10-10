import { TemplatedPrompt } from '@legion/prompt-manager';
import { ValueExtractor } from './ValueExtractor.js';
import { TableProvenanceBuilder } from './TableProvenanceBuilder.js';

/**
 * TableInstanceCreator - Create RDF instances from structured table data
 *
 * Now uses TableProvenanceBuilder for proper value extraction and provenance tracking.
 * Creates FinancialValue entities with units/scale/currency instead of bare strings.
 */
export class TableInstanceCreator {
  constructor({ llmClient, tripleStore, ontologyRetriever }) {
    if (!llmClient) {
      throw new Error('TableInstanceCreator requires llmClient');
    }
    if (!tripleStore) {
      throw new Error('TableInstanceCreator requires tripleStore');
    }

    this.llmClient = llmClient;
    this.tripleStore = tripleStore;
    this.ontologyRetriever = ontologyRetriever;

    // Initialize Phase 7 components
    this.valueExtractor = new ValueExtractor();
    this.provenanceBuilder = new TableProvenanceBuilder({
      valueExtractor: this.valueExtractor
    });
  }

  /**
   * Analyze table structure
   * @param {Object} table - Table with headers and rows
   * @returns {Object} Structure metadata
   */
  analyzeTableStructure(table) {
    if (!table.headers || !table.rows) {
      throw new Error('Table must have headers and rows properties');
    }

    return {
      rowCount: table.rows.length,
      columnCount: table.headers.length,
      headers: table.headers
    };
  }

  /**
   * Create RDF instances from table data with full provenance
   * @param {Object} table - Table with headers and rows (or ConvFinQA format)
   * @param {string} ontologyText - Formatted ontology text
   * @param {Object} metadata - Table metadata (sourceDocument, scale, currency)
   * @returns {Promise<Object>} Instance data with entities and relationships
   */
  async createInstancesFromTable(table, ontologyText, metadata = {}) {
    // Detect table metadata from context if not provided
    const tableMetadata = {
      scale: metadata.scale || this.detectScale(table, ontologyText),
      currency: metadata.currency || 'USD',
      sourceDocument: metadata.sourceDocument,
      documentId: metadata.documentId,
      caption: metadata.caption,
      organizationUri: metadata.organizationUri
    };

    // Use TableProvenanceBuilder for structured value extraction and provenance
    const kg = this.provenanceBuilder.buildTableKnowledgeGraph(table, tableMetadata);

    // Return in expected format
    return {
      entities: kg.entities,
      relationships: kg.relationships,
      tableEntity: kg.tableEntity,
      cellCount: kg.cellCount,
      metadata: tableMetadata
    };
  }

  /**
   * Detect scale from table context
   * @param {Object} table - Table data
   * @param {string} ontologyText - Ontology text
   * @returns {string|null} Detected scale
   */
  detectScale(table, ontologyText) {
    // Check headers for scale indicators
    const allText = JSON.stringify(table).toLowerCase();

    if (allText.includes('thousand')) return 'thousands';
    if (allText.includes('million')) return 'millions';
    if (allText.includes('billion')) return 'billions';

    // Check ontology text for hints
    if (ontologyText && ontologyText.toLowerCase().includes('thousand')) {
      return 'thousands';
    }

    // Default to null - values will be taken as-is
    return null;
  }

  /**
   * Format table data for LLM prompt (legacy method for compatibility)
   * @param {Object} table - Table with headers and rows
   * @param {string} ontologyText - Formatted ontology text
   * @returns {string} Formatted prompt content
   */
  formatTableForPrompt(table, ontologyText) {
    let tableStr = 'Headers: ' + (table.headers || Object.keys(table)).join(' | ') + '\n\n';

    if (table.rows) {
      tableStr += 'Rows:\n';
      table.rows.forEach((row, idx) => {
        tableStr += `Row ${idx + 1}: ` + row.join(' | ') + '\n';
      });
    } else {
      // ConvFinQA format
      tableStr += 'Data:\n' + JSON.stringify(table, null, 2);
    }

    return tableStr;
  }

  /**
   * Parse LLM response JSON (legacy method for compatibility)
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
}
