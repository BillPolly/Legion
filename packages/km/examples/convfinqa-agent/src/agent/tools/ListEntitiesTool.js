/**
 * ListEntitiesTool - Tool for listing available entities in the knowledge graph
 *
 * Helps the agent discover what entities are available for querying.
 */

export const ListEntitiesTool = {
  name: 'list_entities',

  description: `List all entities of a given type in the knowledge graph.

Use this tool to discover what entity instances are available.

Examples:
- list_entities({ entityType: "StockOption" }) → Lists all StockOption instances
- list_entities({ entityType: "PensionPlan" }) → Lists all PensionPlan instances

This is useful when you need to know what years/periods of data are available.`,

  input_schema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'The entity type to list instances of (e.g., StockOption, PensionPlan)'
      }
    },
    required: ['entityType']
  },

  async execute(params, context) {
    const { entityType } = params;
    const { kgStore, logger } = context;

    logger.debug('list_entities', { entityType });

    try {
      // Query for all instances of this type
      const instances = await kgStore.query(null, 'rdf:type', `kg:${entityType}`);

      const instanceUris = instances.map(([uri]) => uri);

      logger.info('list_entities_success', {
        entityType,
        count: instanceUris.length
      });

      return {
        success: true,
        entityType: `kg:${entityType}`,
        instances: instanceUris,
        count: instanceUris.length
      };

    } catch (error) {
      logger.error('list_entities_error', { error: error.message });

      return {
        error: `Failed to list entities: ${error.message}`
      };
    }
  }
};
