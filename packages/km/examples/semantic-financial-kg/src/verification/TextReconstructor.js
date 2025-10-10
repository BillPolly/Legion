/**
 * TextReconstructor - Generate natural language from RDF triples using LLM
 *
 * Takes stored RDF triples and entity models, uses LLM to generate
 * natural language text that reconstructs the original facts.
 * This verifies that the knowledge graph captures the intended meaning.
 */

import { TemplatedPrompt } from '@legion/prompt-manager';

export class TextReconstructor {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  /**
   * Reconstruct natural language text from entity model
   * @param {Object} entityModel - { entities: [...], relationships: [...] }
   * @returns {Promise<string>} - Natural language text
   */
  async reconstruct(entityModel) {
    // Format entity model for prompt
    const entitiesStr = this._formatEntities(entityModel.entities);
    const relationshipsStr = this._formatRelationships(entityModel.relationships, entityModel.entities);

    // Create template
    const templateStr = `You are an expert at generating natural language from structured knowledge graph data.

Task: Generate natural, fluent text that captures ALL the facts represented in the entity model below.

Entity Model:

ENTITIES:
{{entitiesStr}}

RELATIONSHIPS:
{{relationshipsStr}}

Instructions:
1. Generate natural, readable text that conveys ALL the facts
2. Use the entity labels when available
3. Include all entity properties (attributes)
4. Express all relationships naturally
5. Be concise but complete
6. Write as a single coherent paragraph or set of sentences
7. Do NOT add facts not present in the data
8. Do NOT omit any facts present in the data

Return ONLY the generated text, no explanation or preamble.`;

    // Create prompt
    const prompt = new TemplatedPrompt(templateStr);
    const promptText = prompt.substitute({ entitiesStr, relationshipsStr });

    // Call LLM
    const response = await this.llmClient.complete(promptText, 1000);

    return response.trim();
  }

  /**
   * Format entities for prompt
   * @private
   */
  _formatEntities(entities) {
    return entities.map(entity => {
      let str = `- ${entity.label || entity.uri} (${entity.type})`;

      if (entity.properties && Object.keys(entity.properties).length > 0) {
        str += '\n  Properties:';
        for (const [key, value] of Object.entries(entity.properties)) {
          const propName = key.split(':').pop();
          str += `\n    - ${propName}: ${value}`;
        }
      }

      return str;
    }).join('\n\n');
  }

  /**
   * Format relationships for prompt
   * @private
   */
  _formatRelationships(relationships, entities) {
    return relationships.map(rel => {
      // Find entity labels
      const subjectEntity = entities.find(e => e.uri === rel.subject);
      const objectEntity = entities.find(e => e.uri === rel.object);

      const subjectLabel = subjectEntity?.label || rel.subject;
      const objectLabel = objectEntity?.label || rel.object;
      const predicateName = rel.predicate.split(':').pop();

      let str = `- ${subjectLabel} ${predicateName} ${objectLabel}`;

      if (rel.properties && Object.keys(rel.properties).length > 0) {
        str += '\n  Properties:';
        for (const [key, value] of Object.entries(rel.properties)) {
          const propName = key.split(':').pop();
          str += `\n    - ${propName}: ${value}`;
        }
      }

      return str;
    }).join('\n\n');
  }

  /**
   * Reconstruct text from stored triples
   * @param {Object} factory - EntityFactory instance
   * @param {Array<string>} entityUris - URIs of entities to include
   * @returns {Promise<string>} - Natural language text
   */
  async reconstructFromStore(factory, entityUris) {
    // Retrieve entities from store
    const entities = [];
    const relationships = [];

    for (const uri of entityUris) {
      const entity = await factory.getEntity(uri);
      if (entity) {
        entities.push({
          uri: entity.uri,
          type: entity.ontologyType,
          label: entity.label,
          properties: entity.attributes
        });
      }
    }

    // Find relationships between these entities
    const allRels = await factory.tripleStore.query(null, null, null);
    for (const [subj, pred, obj] of allRels) {
      // Check if this is a relationship triple
      if (entityUris.includes(subj) && entityUris.includes(obj)) {
        // Check if predicate is an ontology property (not metadata)
        if (!pred.startsWith('rdf:') && !pred.startsWith('rdfs:') &&
            !pred.startsWith('graph:') && !pred.startsWith('prov:') &&
            !pred.startsWith('temporal:')) {
          relationships.push({
            subject: subj,
            predicate: pred,
            object: obj,
            properties: {}
          });
        }
      }
    }

    // Reconstruct from entity model
    return await this.reconstruct({ entities, relationships });
  }
}
