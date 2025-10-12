/**
 * GraphContextRetriever - Retrieves graph context (entities + neighbors) for reference resolution
 *
 * Retrieves entities and their neighborhood (properties + relationships) from the
 * knowledge graph to provide LLM with structured context for resolving references.
 *
 * @module @legion/query-understanding/context
 */

export class GraphContextRetriever {
  /**
   * Create a new GraphContextRetriever
   *
   * @param {Object} dataSource - DataSource instance for graph queries
   * @param {Object} options - Configuration options
   * @param {number} [options.defaultRadius=1] - Default neighborhood radius
   * @param {number} [options.maxEntities=10] - Max entities to retrieve context for
   * @throws {Error} If dataSource not provided
   */
  constructor(dataSource, options = {}) {
    if (!dataSource) {
      throw new Error('DataSource is required for GraphContextRetriever');
    }

    this.dataSource = dataSource;
    this.defaultRadius = options.defaultRadius || 1;
    this.maxEntities = options.maxEntities || 10;
  }

  /**
   * Retrieve graph context for a list of entities
   *
   * @param {Array<Object>} entities - Entities to retrieve context for
   * @param {number} [radius=1] - Neighborhood radius (1 = direct neighbors, 2 = 2-hop)
   * @returns {Promise<Object>} Graph context keyed by entity IRI
   * @throws {Error} If retrieval fails
   */
  async retrieveContext(entities, radius = null) {
    if (!Array.isArray(entities)) {
      throw new Error('Entities must be an array');
    }

    const actualRadius = radius !== null ? radius : this.defaultRadius;
    const graphContext = {};

    // Limit number of entities to avoid excessive queries
    const entitiesToProcess = entities.slice(0, this.maxEntities);

    for (const entity of entitiesToProcess) {
      if (!entity || !entity.canonical) {
        continue; // Skip invalid entities
      }

      try {
        const context = await this._retrieveEntityContext(entity.canonical, actualRadius);
        graphContext[entity.canonical] = context;
      } catch (error) {
        // Log error but continue with other entities (fail gracefully)
        console.warn(`Failed to retrieve context for ${entity.canonical}:`, error.message);
      }
    }

    return graphContext;
  }

  /**
   * Retrieve context for a single entity
   *
   * @private
   * @param {string} entityIRI - Entity IRI (e.g., ":France")
   * @param {number} radius - Neighborhood radius
   * @returns {Promise<Object>} Entity context
   */
  async _retrieveEntityContext(entityIRI, radius) {
    // Query 1: Get entity type
    const typeQuery = {
      find: ['?type'],
      where: [
        [entityIRI, ':type', '?type']
      ]
    };

    let entityType = null;
    try {
      const typeResults = await this.dataSource.query(typeQuery);
      if (typeResults && typeResults.length > 0) {
        entityType = typeResults[0].type || typeResults[0]['?type'] || null;
      }
    } catch (error) {
      console.warn(`Could not retrieve type for ${entityIRI}:`, error.message);
    }

    // Query 2: Get entity properties (outgoing edges with literal values)
    const propertiesQuery = {
      find: ['?prop', '?value'],
      where: [
        [entityIRI, '?prop', '?value']
      ]
    };

    const properties = {};
    try {
      const propResults = await this.dataSource.query(propertiesQuery);
      if (propResults && Array.isArray(propResults)) {
        for (const result of propResults) {
          const prop = result.prop || result['?prop'];
          const value = result.value || result['?value'];

          // Filter out type (already have it) and store only literal properties
          if (prop && prop !== ':type' && value) {
            // Store simple values (numbers, strings, booleans)
            if (typeof value !== 'object' || value === null) {
              properties[prop] = value;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not retrieve properties for ${entityIRI}:`, error.message);
    }

    // Query 3: Get neighbors (outgoing relationships to other entities)
    const neighborsQuery = {
      find: ['?rel', '?target'],
      where: [
        [entityIRI, '?rel', '?target'],
        ['?target', ':type', '?targetType'] // Ensure target is an entity, not a literal
      ]
    };

    const neighbors = [];
    try {
      const neighborResults = await this.dataSource.query(neighborsQuery);
      if (neighborResults && Array.isArray(neighborResults)) {
        for (const result of neighborResults) {
          const rel = result.rel || result['?rel'];
          const target = result.target || result['?target'];

          if (rel && rel !== ':type' && target) {
            neighbors.push({ rel, target });
          }
        }
      }
    } catch (error) {
      console.warn(`Could not retrieve neighbors for ${entityIRI}:`, error.message);
    }

    // If radius > 1, recursively get 2-hop neighbors
    // For MVP, we only implement radius=1, but structure supports expansion
    if (radius > 1) {
      // TODO: Implement multi-hop retrieval
      // For each neighbor, retrieve their neighbors
      // Limit depth to avoid exponential explosion
    }

    return {
      type: entityType,
      properties,
      neighbors
    };
  }

  /**
   * Format graph context for LLM prompt (human-readable)
   *
   * @param {Object} graphContext - Graph context from retrieveContext()
   * @returns {string} Formatted context for LLM
   */
  formatForPrompt(graphContext) {
    if (!graphContext || Object.keys(graphContext).length === 0) {
      return '';
    }

    const lines = [];
    lines.push('Graph context (entities and their relationships):');
    lines.push('');

    for (const [entityIRI, context] of Object.entries(graphContext)) {
      lines.push(`${entityIRI}:`);

      if (context.type) {
        lines.push(`  Type: ${context.type}`);
      }

      if (context.properties && Object.keys(context.properties).length > 0) {
        lines.push(`  Properties:`);
        for (const [prop, value] of Object.entries(context.properties)) {
          lines.push(`    ${prop}: ${value}`);
        }
      }

      if (context.neighbors && context.neighbors.length > 0) {
        lines.push(`  Related entities:`);
        for (const neighbor of context.neighbors) {
          lines.push(`    ${neighbor.rel} → ${neighbor.target}`);
        }
      }

      lines.push(''); // Blank line between entities
    }

    return lines.join('\n');
  }
}

export default GraphContextRetriever;
