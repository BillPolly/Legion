/**
 * TableMetadataExtractor - Deterministic table metadata extraction
 *
 * Extracts comprehensive table metadata using deterministic label extraction:
 * - Direct extraction of labels from table structure (NO LLM - deterministic!)
 * - Canonical label normalization using CanonicalLabelService
 * - LLM only for table description (non-critical)
 *
 * This ensures ontology and instance KG use identical labels for exact matching.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tableMetadataSchema } from '../schemas/tableMetadata.js';
import { CanonicalLabelService } from './CanonicalLabelService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TableMetadataExtractor {
  constructor({ llmClient, logger }) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.llmClient = llmClient;
    this.logger = logger || console;
    this.promptTemplate = null;
  }

  /**
   * Initialize the extractor by loading the Handlebars template
   */
  async initialize() {
    const templatePath = join(__dirname, '../prompts/table-metadata-extraction.hbs');
    this.promptTemplate = readFileSync(templatePath, 'utf-8');
    this.logger.debug('table_metadata_extractor_initialized', { templatePath });
  }

  /**
   * Extract metadata from a table using deterministic extraction
   *
   * @param {Array<Array<string>>} table - 2D array representing the table
   * @param {Array<string>} contextText - Optional context text (pre_text, post_text)
   * @returns {Promise<Object>} Extracted metadata matching tableMetadataSchema
   */
  async extractMetadata(table, contextText = []) {
    this.logger.info('extracting_table_metadata', {
      tableRows: table.length,
      tableCols: table[0]?.length || 0,
      contextItems: contextText.length
    });

    try {
      // Extract year columns from header row (deterministic)
      const yearColumns = this._extractYearColumns(table[0]);

      // Extract row metadata directly from table structure (deterministic)
      const rowMetadata = this._extractRowMetadata(table);

      // Use LLM only for table description (non-critical, can be generic)
      const tableDescription = await this._inferTableDescription(table, contextText);

      const metadata = {
        tableDescription,
        yearColumns,
        rowMetadata,
        domain: 'finance',  // Hardcode for ConvFinQA (always financial)
        tableType: this._inferTableType(rowMetadata)
      };

      this.logger.info('table_metadata_extracted', {
        description: metadata.tableDescription,
        yearColumns: metadata.yearColumns.length,
        rows: metadata.rowMetadata.length,
        domain: metadata.domain,
        tableType: metadata.tableType
      });

      // Validate extracted metadata
      this._validateMetadata(metadata, table);

      return metadata;

    } catch (error) {
      this.logger.error('table_metadata_extraction_error', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Extract year columns from header row (deterministic)
   * Uses intelligent inference for compound headers and missing years
   * @private
   */
  _extractYearColumns(headerRow) {
    if (!headerRow || headerRow.length === 0) return [];

    const yearColumns = [];
    const dataColumns = headerRow.slice(1); // Skip first column (row labels)

    // Step 1: Extract years from each header cell
    const extractedYears = dataColumns.map(header =>
      CanonicalLabelService.extractYear(header)
    );

    // Step 2: Find the maximum year (most recent)
    const validYears = extractedYears.filter(y => y !== null);
    if (validYears.length === 0) {
      // No years found - can't create year columns
      return [];
    }

    const maxYear = Math.max(...validYears);

    // Step 3: Check if we have duplicate years (indicates compound headers)
    const uniqueYears = new Set(validYears);
    const hasDuplicates = uniqueYears.size < validYears.length;

    // Step 4: Assign years to columns
    // Financial tables typically show years in descending order (most recent first)
    if (hasDuplicates || uniqueYears.size === 1) {
      // Compound headers or all same year → use inference
      // Assign years: maxYear, maxYear-1, maxYear-2, ...
      for (let i = 0; i < dataColumns.length; i++) {
        yearColumns.push({
          colIdx: i,
          year: String(maxYear - i),
          semanticLabel: String(dataColumns[i])
        });
      }
    } else {
      // Clear distinct years → use extracted values
      for (let i = 0; i < dataColumns.length; i++) {
        const year = extractedYears[i] !== null ? extractedYears[i] : (maxYear - i);
        yearColumns.push({
          colIdx: i,
          year: String(year),
          semanticLabel: String(dataColumns[i])
        });
      }
    }

    return yearColumns;
  }

  /**
   * Extract row metadata directly from table structure (deterministic)
   * @private
   */
  _extractRowMetadata(table) {
    const dataRows = table.slice(1);  // Skip header row
    const rowMetadata = [];

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      if (!row || row.length === 0) continue;

      // Extract raw label from first column
      const rawLabel = String(row[0] || '').trim();
      if (!rawLabel) continue;

      // Apply deterministic canonicalization
      const canonicalLabel = CanonicalLabelService.canonicalize(rawLabel);
      const propertyName = CanonicalLabelService.toPropertyName(canonicalLabel);

      // Get cell values (skip first column which is the label)
      const values = row.slice(1);

      rowMetadata.push({
        rowIdx,
        originalLabel: rawLabel,
        canonicalLabel,
        propertyName,
        valueType: CanonicalLabelService.inferValueType(values),
        unit: CanonicalLabelService.inferUnit(rawLabel, values),
        category: null  // Not needed for exact matching
      });
    }

    return rowMetadata;
  }

  /**
   * Infer table description using LLM (non-critical)
   * @private
   */
  async _inferTableDescription(table, contextText) {
    // Simple heuristic: use first few row labels
    const dataRows = table.slice(1);
    const labels = dataRows.slice(0, 3).map(row => row[0]).filter(Boolean);

    if (labels.length > 0) {
      return `Financial table with metrics: ${labels.join(', ')}`;
    }

    return 'Financial table';
  }

  /**
   * Infer table type from row metadata (deterministic)
   * @private
   */
  _inferTableType(rowMetadata) {
    const labels = rowMetadata.map(rm => rm.canonicalLabel.toLowerCase()).join(' ');

    if (labels.includes('cash') && labels.includes('operating')) {
      return 'cash_flow_statement';
    }
    if (labels.includes('revenue') || labels.includes('earnings')) {
      return 'income_statement';
    }
    if (labels.includes('assets') || labels.includes('liabilities')) {
      return 'balance_sheet';
    }
    if (labels.includes('index') || labels.includes('return')) {
      return 'performance_comparison';
    }

    return 'financial_statement';
  }


  /**
   * Validate extracted metadata against table structure
   * @private
   */
  _validateMetadata(metadata, table) {
    const dataRows = table.slice(1); // Exclude header

    // Check year columns are within bounds
    for (const yearCol of metadata.yearColumns) {
      if (yearCol.colIdx < 0 || yearCol.colIdx >= table[0].length - 1) {
        throw new Error(`Invalid column index: ${yearCol.colIdx}`);
      }
    }

    // Check row metadata count matches table
    if (metadata.rowMetadata.length !== dataRows.length) {
      this.logger.warn('row_count_mismatch', {
        expected: dataRows.length,
        extracted: metadata.rowMetadata.length
      });
    }

    // Check row indices are valid
    for (const row of metadata.rowMetadata) {
      if (row.rowIdx < 0 || row.rowIdx >= dataRows.length) {
        throw new Error(`Invalid row index: ${row.rowIdx}`);
      }
    }

    this.logger.debug('metadata_validation_passed');
  }

  /**
   * Get metadata from cache or extract fresh
   *
   * @param {Object} metadataStore - MongoDB provider for metadata storage
   * @param {string} conversationId - Unique conversation ID
   * @param {Array<Array<string>>} table - Table data
   * @param {Array<string>} contextText - Context text
   * @returns {Promise<Object>} Cached or freshly extracted metadata
   */
  async getOrExtractMetadata(metadataStore, conversationId, table, contextText = []) {
    // Try to load from cache
    if (metadataStore) {
      try {
        const cached = await metadataStore.getMetadata(conversationId);
        if (cached) {
          this.logger.info('table_metadata_cache_hit', { conversationId });
          return cached;
        }
      } catch (error) {
        this.logger.warn('metadata_cache_miss', {
          conversationId,
          error: error.message
        });
      }
    }

    // Extract fresh metadata
    const metadata = await this.extractMetadata(table, contextText);

    // Store in cache
    if (metadataStore) {
      try {
        await metadataStore.saveMetadata(conversationId, metadata);
        this.logger.info('table_metadata_cached', { conversationId });
      } catch (error) {
        this.logger.warn('metadata_cache_save_failed', {
          conversationId,
          error: error.message
        });
      }
    }

    return metadata;
  }
}
