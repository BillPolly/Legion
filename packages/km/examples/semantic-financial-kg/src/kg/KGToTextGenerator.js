import { TemplatedPrompt } from '@legion/prompt-manager';

/**
 * KGToTextGenerator - Generate natural language text from knowledge graph instances
 *
 * Used for validation: by regenerating text from the KG, we can compare it
 * to the source text to verify completeness.
 */
export class KGToTextGenerator {
  constructor({ llmClient, tripleStore }) {
    if (!llmClient) {
      throw new Error('KGToTextGenerator requires llmClient');
    }
    if (!tripleStore) {
      throw new Error('KGToTextGenerator requires tripleStore');
    }

    this.llmClient = llmClient;
    this.tripleStore = tripleStore;

    // Template for text generation
    this.generationTemplate = `You are generating natural language text from a knowledge graph.

KNOWLEDGE GRAPH:

{{graph}}

TASK:

Generate clear, natural language text that describes all entities, their properties, and relationships in the knowledge graph above.

REQUIREMENTS:
- Include ALL entities and their information
- Describe ALL relationships between entities
- Use natural, fluent language
- Be comprehensive - don't leave out any information
- Don't add information not present in the graph
- Write as continuous prose, not bullet points

Return the generated text (no JSON, just plain text).`;
  }

  /**
   * Build a human-readable view of the graph from instances
   * @param {Object} instances - Instance data with entities and relationships
   * @returns {string} Formatted graph view
   */
  buildGraphView(instances) {
    let view = 'ENTITIES:\n\n';

    instances.entities.forEach(entity => {
      view += `- ${entity.label} (${entity.uri})\n`;
      view += `  Type: ${entity.type}\n`;

      if (entity.properties && Object.keys(entity.properties).length > 0) {
        view += '  Properties:\n';
        for (const [prop, value] of Object.entries(entity.properties)) {
          view += `    ${prop}: ${value}\n`;
        }
      }

      view += '\n';
    });

    if (instances.relationships && instances.relationships.length > 0) {
      view += '\nRELATIONSHIPS:\n\n';

      instances.relationships.forEach(rel => {
        // Find labels for subject and object
        const subjectEntity = instances.entities.find(e => e.uri === rel.subject);
        const objectEntity = instances.entities.find(e => e.uri === rel.object);

        const subjectLabel = subjectEntity ? subjectEntity.label : rel.subject;
        const objectLabel = objectEntity ? objectEntity.label : rel.object;

        view += `- ${subjectLabel} --[${rel.predicate}]--> ${objectLabel}\n`;
      });
    }

    return view;
  }

  /**
   * Format instances for prompt
   * @param {Object} instances - Instance data
   * @returns {string} Formatted text
   */
  formatInstancesForPrompt(instances) {
    return this.buildGraphView(instances);
  }

  /**
   * Generate natural language text from knowledge graph instances
   * @param {Object} instances - Instance data with entities and relationships
   * @returns {Promise<string>} Generated natural language text
   */
  async generateText(instances) {
    const graphView = this.buildGraphView(instances);

    const prompt = new TemplatedPrompt(this.generationTemplate, {
      maxRetries: 3
    });

    const text = await prompt.call(this.llmClient, {
      graph: graphView
    });

    return text.trim();
  }
}
