/**
 * IntrospectOntologyTool - Tool for discovering available entity types and properties in the ontology
 *
 * Allows the agent to explore the ontology to find out what entity types exist
 * and what properties are available for each type.
 */

export const IntrospectOntologyTool = {
  name: 'introspect_ontology',

  description: `Discover what entity types and properties are available in the ontology.

Use this tool to find out:
- What entity types exist in the knowledge graph
- What properties are available for a specific entity type

Examples:
- To see all entity types: introspect_ontology({ action: "list_types" })
- To see properties for an entity type: introspect_ontology({ action: "get_properties", entityType: "CashFlow" })

This helps you discover the correct property names before querying the knowledge graph.`,

  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_types', 'get_properties'],
        description: 'What to introspect: "list_types" to see all entity types, "get_properties" to see properties for a type'
      },
      entityType: {
        type: 'string',
        description: 'The entity type to get properties for (required when action is "get_properties")'
      }
    },
    required: ['action']
  },

  async execute(params, context) {
    const { action, entityType } = params;
    const { kgStore, ontologyStore, logger } = context;

    logger.debug('introspect_ontology', { action, entityType });

    try {
      if (action === 'list_types') {
        // Get all entity types from KG
        const instances = await kgStore.query(null, 'rdf:type', null);

        const entityTypes = new Set();
        for (const [subject, predicate, object] of instances) {
          if (object && object.startsWith('kg:')) {
            entityTypes.add(object);
          }
        }

        const types = Array.from(entityTypes);

        logger.info('introspect_ontology_list_types', { count: types.length, types });

        return {
          success: true,
          action: 'list_types',
          entityTypes: types
        };

      } else if (action === 'get_properties') {
        if (!entityType) {
          return {
            error: 'entityType is required when action is "get_properties"'
          };
        }

        // Normalize entity type
        const normalizedType = entityType.startsWith('kg:') ? entityType : `kg:${entityType}`;

        // Get all properties that have this entity as domain from ONTOLOGY
        const properties = await ontologyStore.query(null, 'rdfs:domain', normalizedType);

        const propList = [];
        for (const [propUri] of properties) {
          // Get property label
          const labels = await ontologyStore.query(propUri, 'rdfs:label', null);
          const label = labels.length > 0
            ? labels[0][2].replace(/"/g, '')
            : propUri.split(':')[1];

          // Remove kg: prefix for display
          const propName = propUri.startsWith('kg:') ? propUri.substring(3) : propUri;

          propList.push({
            uri: propUri,
            name: propName,
            label
          });
        }

        logger.info('introspect_ontology_get_properties', {
          entityType: normalizedType,
          count: propList.length
        });

        return {
          success: true,
          action: 'get_properties',
          entityType: normalizedType,
          properties: propList
        };

      } else {
        return {
          error: `Unknown action: ${action}. Use "list_types" or "get_properties"`
        };
      }

    } catch (error) {
      logger.error('introspect_ontology_error', { error: error.message });

      return {
        error: `Failed to introspect ontology: ${error.message}`
      };
    }
  }
};
