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

Examples:
- query_kg({ label: "United Parcel Service Inc.", year: "2008" }) - for time-series data
- query_kg({ label: "revenue", year: "2007" }) - for time-series data
- query_kg({ label: "total", category: "less than 1 year" }) - for categorical data
- query_kg({ label: "property and casualty obligations", category: "1-3 years" }) - for categorical data

The tool will find metrics matching your search and return the value.`,

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
      }
    },
    required: ['label']
  },

  async execute(params, context) {
    const { label, year, category } = params;
    const { kgStore, logger } = context;

    logger.debug('query_kg', { label, year, category });

    try {
      // Find all instances (any type)
      const instances = await kgStore.query(null, 'rdf:type', null);

      if (instances.length === 0) {
        return {
          error: 'No instances found in knowledge graph'
        };
      }

      // Normalize search label
      const normalizedSearch = label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');

      // For each instance, check if it matches our criteria
      for (const [instanceUri] of instances) {
        // Get the label for this instance
        const labelTriples = await kgStore.query(instanceUri, 'kg:label', null);
        if (labelTriples.length === 0) continue;

        const instanceLabel = labelTriples[0][2].replace(/"/g, '');

        // Normalize instance label
        const normalizedInstance = instanceLabel
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_');

        // Check if labels match (fuzzy match)
        const labelsMatch = normalizedInstance.includes(normalizedSearch) ||
                            normalizedSearch.includes(normalizedInstance);

        if (!labelsMatch) continue;

        // Check year or category match
        let dimensionMatch = false;
        let dimensionValue = null;
        let dimensionType = null;

        // Try to match year if provided
        if (year) {
          const yearTriples = await kgStore.query(instanceUri, 'kg:year', null);
          if (yearTriples.length > 0) {
            const instanceYear = yearTriples[0][2].replace(/"/g, '');
            if (instanceYear === year) {
              dimensionMatch = true;
              dimensionValue = instanceYear;
              dimensionType = 'year';
            }
          }
        }

        // Try to match category if provided
        if (category && !dimensionMatch) {
          const categoryTriples = await kgStore.query(instanceUri, 'kg:category', null);
          if (categoryTriples.length > 0) {
            const instanceCategory = categoryTriples[0][2].replace(/"/g, '');
            const normalizedInstanceCategory = instanceCategory.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
            const normalizedSearchCategory = category.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');

            if (normalizedInstanceCategory === normalizedSearchCategory ||
                normalizedInstanceCategory.includes(normalizedSearchCategory) ||
                normalizedSearchCategory.includes(normalizedInstanceCategory)) {
              dimensionMatch = true;
              dimensionValue = instanceCategory;
              dimensionType = 'category';
            }
          }
        }

        // If neither year nor category provided, accept the first label match
        if (!year && !category) {
          dimensionMatch = true;
          dimensionType = 'none';
        }

        if (dimensionMatch) {
          // Get the canonical value (for calculations)
          const valueTriples = await kgStore.query(instanceUri, 'kg:value', null);
          if (valueTriples.length === 0) continue;
          const value = parseFloat(valueTriples[0][2]);

          // Get the raw value (original from table)
          const rawValueTriples = await kgStore.query(instanceUri, 'kg:rawValue', null);
          const rawValue = rawValueTriples.length > 0 ? parseFloat(rawValueTriples[0][2]) : value;

          // Get the formatted string (with units)
          const rawValueStringTriples = await kgStore.query(instanceUri, 'kg:rawValueString', null);
          const rawValueString = rawValueStringTriples.length > 0 ? rawValueStringTriples[0][2].replace(/"/g, '') : String(rawValue);

          // Get the unit
          const unitTriples = await kgStore.query(instanceUri, 'kg:unit', null);
          const unit = unitTriples.length > 0 ? unitTriples[0][2].replace(/"/g, '') : null;

          const result = {
            success: true,
            instance: instanceUri,
            label: instanceLabel,
            value,           // Canonical value for calculations
            rawValue,        // Original value from table
            rawValueString,  // Formatted string with units
            unit            // Unit (dollars, percent, etc.)
          };

          if (dimensionType === 'year') {
            result.year = dimensionValue;
            logger.info('query_kg_success', { instance: instanceUri, label: instanceLabel, year: dimensionValue, value, rawValue });
          } else if (dimensionType === 'category') {
            result.category = dimensionValue;
            logger.info('query_kg_success', { instance: instanceUri, label: instanceLabel, category: dimensionValue, value, rawValue });
          } else {
            logger.info('query_kg_success', { instance: instanceUri, label: instanceLabel, value, rawValue });
          }

          return result;
        }
      }

      // No exact match found - try fuzzy matching
      logger.error('query_kg_not_found_exact', { label, year, category });

      // Get all unique labels for fuzzy matching
      const allLabels = new Set();
      for (const [instanceUri] of instances) {
        const labelTriples = await kgStore.query(instanceUri, 'kg:label', null);
        if (labelTriples.length > 0) {
          allLabels.add(labelTriples[0][2].replace(/"/g, ''));
        }
      }

      // Find closest match using token-based similarity
      let bestMatch = null;
      let bestScore = 0;

      for (const availableLabel of allLabels) {
        const score = this._computeSimilarity(label, availableLabel);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = availableLabel;
        }
      }

      // If we found a very close match (>0.8) AND it's different from original, auto-correct and retry
      if (bestScore > 0.8 && bestMatch && bestMatch !== label) {
        logger.info('query_kg_auto_correcting', {
          searchedLabel: label,
          correctedLabel: bestMatch,
          similarity: bestScore
        });

        // Retry query with corrected label
        const correctedParams = { ...params, label: bestMatch };
        const result = await this.execute(correctedParams, context);

        if (result.success) {
          result.auto_corrected = true;
          result.original_label = label;
          result.corrected_label = bestMatch;
          result.similarity_score = bestScore;
        }

        return result;
      }

      // If we found a reasonably close match (>0.6), suggest it
      if (bestScore > 0.6 && bestMatch) {
        return {
          error: `No metric found matching "${label}"${year ? ` for year "${year}"` : ''}${category ? ` for category "${category}"` : ''}`,
          suggestion: `Did you mean "${bestMatch}"? (${(bestScore * 100).toFixed(0)}% similar)`,
          closest_match: bestMatch,
          similarity: bestScore,
          available_labels: Array.from(allLabels).slice(0, 10)
        };
      }

      // No close matches found
      return {
        error: `No metric found matching "${label}"${year ? ` for year "${year}"` : ''}${category ? ` for category "${category}"` : ''}`,
        suggestion: 'Try using one of the exact labels from the knowledge graph',
        available_labels: Array.from(allLabels).slice(0, 10)
      };

    } catch (error) {
      logger.error('query_kg_error', { error: error.message });

      return {
        error: `Failed to query KG: ${error.message}`
      };
    }
  },

  /**
   * Compute similarity between two labels using token-based matching
   * Returns score between 0 (no match) and 1 (perfect match)
   */
  _computeSimilarity(label1, label2) {
    // Normalize: lowercase, remove punctuation except spaces
    const normalize = (str) => str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const norm1 = normalize(label1);
    const norm2 = normalize(label2);

    // Exact match after normalization
    if (norm1 === norm2) return 1.0;

    // Tokenize
    const tokens1 = new Set(norm1.split(' '));
    const tokens2 = new Set(norm2.split(' '));

    // Compute Jaccard similarity: |intersection| / |union|
    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    const jaccard = intersection.size / union.size;

    // Also check substring containment for partial matches
    const substring = norm1.includes(norm2) || norm2.includes(norm1) ? 0.3 : 0;

    // Combined score: weighted average
    return Math.max(jaccard, substring);
  }
};
