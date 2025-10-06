/**
 * Schema for table metadata extraction
 *
 * Defines the structure for LLM-extracted table metadata including:
 * - Overall table description
 * - Year column mappings
 * - Row metadata (labels, types, units)
 */

export const tableMetadataSchema = {
  type: 'object',
  properties: {
    tableDescription: {
      type: 'string',
      description: 'Brief description of what this table contains (e.g., "Cash flow statement for fiscal years 2007-2009")'
    },
    yearColumns: {
      type: 'array',
      description: 'Mapping of column indices to years with semantic labels',
      items: {
        type: 'object',
        properties: {
          colIdx: {
            type: 'number',
            description: 'Zero-based column index (0 = first data column after row labels)'
          },
          year: {
            type: 'string',
            description: 'The year this column represents (e.g., "2009")'
          },
          semanticLabel: {
            type: 'string',
            description: 'Full semantic label from header (e.g., "fiscal year ended June 30, 2009")'
          }
        },
        required: ['colIdx', 'year', 'semanticLabel']
      }
    },
    rowMetadata: {
      type: 'array',
      description: 'Metadata for each data row in the table',
      items: {
        type: 'object',
        properties: {
          rowIdx: {
            type: 'number',
            description: 'Zero-based row index in the data rows (excluding header)'
          },
          originalLabel: {
            type: 'string',
            description: 'Original label text from the table row'
          },
          canonicalLabel: {
            type: 'string',
            description: 'Canonical/normalized label for semantic matching (lowercase, standardized)'
          },
          propertyName: {
            type: 'string',
            description: 'Property name for KG triples (snake_case, e.g., "net_cash_from_operating_activities")'
          },
          valueType: {
            type: 'string',
            enum: ['currency', 'percentage', 'number', 'count', 'ratio'],
            description: 'Type of values in this row'
          },
          unit: {
            type: 'string',
            description: 'Unit of measurement (e.g., "thousands", "millions", "USD", "%")'
          },
          category: {
            type: 'string',
            description: 'Semantic category (e.g., "operating_cash_flow", "revenue", "expense")'
          }
        },
        required: ['rowIdx', 'originalLabel', 'canonicalLabel', 'propertyName', 'valueType']
      }
    },
    domain: {
      type: 'string',
      description: 'Domain of the table (e.g., "finance", "healthcare", "sales")'
    },
    tableType: {
      type: 'string',
      description: 'Type of financial table (e.g., "cash_flow_statement", "income_statement", "balance_sheet")'
    }
  },
  required: ['tableDescription', 'yearColumns', 'rowMetadata', 'domain']
};
