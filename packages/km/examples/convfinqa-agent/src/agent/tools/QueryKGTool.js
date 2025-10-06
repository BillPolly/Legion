/**
 * QueryKGTool - Query knowledge graph for financial metrics
 *
 * Works with the semantic KG structure where metrics are instances with properties:
 * - label: human-readable label describing what is being measured
 * - value: numerical value
 * - year: time period (for time-series tables)
 * - category: category (for categorical tables)
 */

export const QueryKGTool = {
  name: 'query_kg',

  description: `Query the knowledge graph for financial metric values.

The knowledge graph contains financial metrics as instances with properties:
- label: human-readable label (e.g., "United Parcel Service Inc.", "S&P 500", "total obligations")
- value: the numerical value
- year: the time period (for time-series data)
- category: the category (for categorical data like "less than 1 year", "1-3 years", "total")
- entity: the entity name (for property lookups on specific entities)

Examples:
- query_kg({ label: "United Parcel Service Inc.", year: "2008" }) - for time-series data
- query_kg({ label: "revenue", year: "2007" }) - for time-series data
- query_kg({ label: "total", category: "less than 1 year" }) - for categorical data
- query_kg({ label: "property and casualty obligations", category: "1-3 years" }) - for categorical data
- query_kg({ label: "shares subject to outstanding awards", entity: "2009 global incentive plan" }) - for entity-specific property lookup

The tool will find metrics matching your search and return the value. If multiple instances match and no filters (year/category/entity) are provided, only the first match is returned.`,

  input_schema: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        description: 'The label of the metric to query - use the human-readable name from the table'
      },
      year: {
        type: 'string',
        description: 'The year to query for (e.g., "2008", "2009") - use for time-series tables'
      },
      category: {
        type: 'string',
        description: 'The category to query for (e.g., "less than 1 year", "1-3 years", "total") - use for categorical tables'
      },
      entity: {
        type: 'string',
        description: 'The entity name to filter by (e.g., "2009 global incentive plan") - use when querying for a property on a specific entity'
      }
    },
    required: ['label']
  },

  async execute(params, context) {
    const { label, year, category, entity } = params;
    const { kgIndex, logger } = context;

    logger.debug('query_kg', { label, year, category, entity });

    try {
      // O(1) indexed lookup instead of O(n) scan
      let matches = kgIndex.query(label, year, category);

      // Filter by entity if provided
      if (entity && matches.length > 0) {
        const normalizedEntity = entity.toLowerCase().replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_').trim();
        matches = matches.filter(m => {
          // Check if entity matches instance label or entityUri
          if (m.label && m.label.toLowerCase().replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_').trim() === normalizedEntity) {
            return true;
          }
          if (m.entityUri && m.entityUri.includes(normalizedEntity)) {
            return true;
          }
          return false;
        });
      }

      if (matches.length === 0) {
        logger.warn('query_kg_not_found', { label, year, category, entity });

        // Get available labels for suggestions
        const allLabels = kgIndex.getAllLabels();

        return {
          error: `No metric found matching "${label}"${year ? ` for year "${year}"` : ''}${category ? ` for category "${category}"` : ''}${entity ? ` for entity "${entity}"` : ''}`,
          suggestion: 'Try using one of the exact labels from the knowledge graph',
          available_labels: allLabels.slice(0, 10)
        };
      }

      // Return first match
      const instance = matches[0];

      const result = {
        success: true,
        instance: instance.uri,
        label: instance.label,
        value: instance.value,
        rawValue: instance.rawValue || instance.value,
        rawValueString: instance.rawValueString || String(instance.rawValue),
        unit: instance.unit
      };

      if (instance.year) {
        result.year = instance.year;
      }

      if (instance.category) {
        result.category = instance.category;
      }

      if (instance.precision !== undefined && instance.precision !== null) {
        result.precision = instance.precision;
      }

      logger.info('query_kg_success', {
        instance: instance.uri,
        label: instance.label,
        year: instance.year,
        category: instance.category,
        value: instance.value
      });

      return result;

    } catch (error) {
      logger.error('query_kg_error', { error: error.message });

      return {
        error: `Failed to query KG: ${error.message}`
      };
    }
  }
};
