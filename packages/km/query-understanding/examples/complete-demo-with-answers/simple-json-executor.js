/**
 * Simple JSON-based query executor
 * Executes DataScript queries against JSON data
 */

export class SimpleJSONExecutor {
  constructor(data) {
    this.data = data;
  }

  /**
   * Simple pluralization helper
   * @param {string} word - Singular word
   * @returns {string} Plural word
   */
  pluralize(word) {
    const lower = word.toLowerCase();
    // Handle special cases
    if (lower.endsWith('y')) {
      return lower.slice(0, -1) + 'ies';
    }
    // Default: add 's'
    return lower + 's';
  }

  /**
   * Execute a DataScript query against JSON data
   * @param {Object} query - DataScript query with find and where clauses
   * @returns {Array} Results
   */
  execute(query) {
    const { find, where } = query;

    // Handle aggregation queries
    if (find.length === 1 && typeof find[0] === 'string' && find[0].startsWith('(')) {
      return this.executeAggregation(query);
    }

    // Handle standard select queries
    return this.executeSelect(query);
  }

  /**
   * Execute aggregation query (COUNT, SUM, etc.)
   */
  executeAggregation(query) {
    const { find, where } = query;

    // Parse aggregation function
    const aggMatch = find[0].match(/\((\w+)\s+\?(\w+)\)/);
    if (!aggMatch) {
      throw new Error('Invalid aggregation format');
    }

    const [_, aggFunc, variable] = aggMatch;

    // Get base results
    const baseResults = this.executeSelect({ find: [`?${variable}`], where });

    // Apply aggregation
    switch (aggFunc.toLowerCase()) {
      case 'count':
        return [{ count: baseResults.length }];
      case 'sum':
        return [{ sum: baseResults.reduce((acc, item) => acc + (item[variable] || 0), 0) }];
      case 'max':
        return [{ max: Math.max(...baseResults.map(item => item[variable] || 0)) }];
      case 'min':
        return [{ min: Math.min(...baseResults.map(item => item[variable] || 0)) }];
      default:
        throw new Error(`Unsupported aggregation function: ${aggFunc}`);
    }
  }

  /**
   * Execute standard SELECT query
   */
  executeSelect(query) {
    const { find, where } = query;

    // Extract type constraint
    const typeClause = where.find(clause => clause[1] === ':type');
    if (!typeClause) {
      throw new Error('Query must specify a type');
    }

    const entityType = typeClause[2].replace(':', '');
    const variable = typeClause[0];

    // Get all entities of type (handle pluralization)
    const pluralKey = this.pluralize(entityType);
    let results = this.data[pluralKey] || [];

    // Apply additional filters
    for (const clause of where) {
      if (clause[1] === ':type') continue; // Already filtered

      const [subj, pred, obj] = clause;

      // Handle property filters
      if (pred.startsWith(':')) {
        const propName = pred.replace(':', '');

        // Check if object is a constant (starts with :)
        if (typeof obj === 'string' && obj.startsWith(':')) {
          const targetName = obj.replace(':', '');

          // For relations like :borders
          results = results.filter(entity => {
            if (!entity[propName]) return false;

            // If property is an array of IDs, find the referenced entity
            if (Array.isArray(entity[propName])) {
              // Get all entities to search
              const allEntities = this.data[pluralKey] || [];

              // Find the target entity by name
              const targetEntity = allEntities.find(e => e.name === targetName);
              if (!targetEntity) return false;

              return entity[propName].includes(targetEntity.id);
            }

            // Direct property match
            return entity[propName] === targetName;
          });
        }
      }
    }

    // Return results in requested format
    if (find.length === 1 && find[0] === variable) {
      // Return full entities
      return results;
    }

    // Return specific projections
    return results.map(entity => {
      const projection = {};
      for (const f of find) {
        if (f === variable) {
          Object.assign(projection, entity);
        }
      }
      return projection;
    });
  }
}
