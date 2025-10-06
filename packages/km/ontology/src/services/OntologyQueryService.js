/**
 * OntologyQueryService - Query ontology with full hierarchical context
 *
 * Provides methods to:
 * - Extract type mentions from sentences (LLM)
 * - Find relevant types with semantic search
 * - Get inherited properties and relationships
 * - Return full hierarchy context for matched types
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class OntologyQueryService {
  constructor(tripleStore, hierarchyTraversal, semanticSearch) {
    if (!tripleStore) {
      throw new Error('TripleStore is required');
    }
    if (!hierarchyTraversal) {
      throw new Error('HierarchyTraversal is required');
    }
    if (!semanticSearch) {
      throw new Error('SemanticSearch is required');
    }

    this.tripleStore = tripleStore;
    this.hierarchyTraversal = hierarchyTraversal;
    this.semanticSearch = semanticSearch;
    this.extractTypeMentionsTemplate = null;
  }

  /**
   * Find relevant types for a sentence
   * Returns types WITH full inheritance context
   *
   * @param {string} sentence - The sentence to analyze
   * @param {Object} llmClient - LLM client for extraction
   * @returns {Promise<Array>} - Array of type results with hierarchy, properties, relationships
   */
  async findRelevantTypesForSentence(sentence, llmClient) {
    // Extract type mentions using LLM
    const mentions = await this.extractTypeMentions(sentence, llmClient);

    const results = [];

    for (const mention of mentions) {
      // Search semantic index
      const similar = await this.semanticSearch.semanticSearch(
        'ontology-classes',
        mention,
        { limit: 3 }
      );

      if (similar.length > 0 && similar[0]._similarity > 0.75) {
        const classURI = similar[0].payload.metadata.classURI;

        // Get full hierarchical context
        const hierarchy = await this.hierarchyTraversal.getHierarchyContext(classURI);
        const properties = await this.getInheritedProperties(classURI);
        const relationships = await this.getInheritedRelationships(classURI);

        results.push({
          mention,
          matchedClass: classURI,
          similarity: similar[0]._similarity,
          hierarchy,
          properties,
          relationships
        });
      } else {
        // Gap identified
        results.push({
          mention,
          matchedClass: null,
          isGap: true
        });
      }
    }

    return results;
  }

  /**
   * Extract entity type mentions from sentence using LLM
   *
   * @param {string} sentence - The sentence to analyze
   * @param {Object} llmClient - LLM client
   * @returns {Promise<Array<string>>} - Array of type mentions
   */
  async extractTypeMentions(sentence, llmClient) {
    // Load template if not already loaded
    if (!this.extractTypeMentionsTemplate) {
      const templatePath = join(__dirname, '../prompts/extract-type-mentions.hbs');
      this.extractTypeMentionsTemplate = await readFile(templatePath, 'utf-8');
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        mentions: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['mentions']
    };

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.extractTypeMentionsTemplate,
      responseSchema,
      llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute({
      sentence
    });

    if (!result.success) {
      throw new Error(`Type mention extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data.mentions || [];
  }

  /**
   * Get all properties for a class including inherited from ancestors
   *
   * @param {string} classURI - The class URI
   * @returns {Promise<Array>} - Array of property objects with inheritance info
   */
  async getInheritedProperties(classURI) {
    const properties = [];
    const hierarchy = [classURI, ...(await this.hierarchyTraversal.getAncestors(classURI))];

    for (let i = 0; i < hierarchy.length; i++) {
      const cls = hierarchy[i];
      const props = await this.tripleStore.query(null, 'rdfs:domain', cls);

      for (const [propURI] of props) {
        const types = await this.tripleStore.query(propURI, 'rdf:type', null);
        if (!types.some(t => t[2] === 'owl:DatatypeProperty')) continue;

        const labels = await this.tripleStore.query(propURI, 'rdfs:label', null);
        const ranges = await this.tripleStore.query(propURI, 'rdfs:range', null);

        properties.push({
          uri: propURI,
          label: labels[0]?.[2]?.replace(/"/g, ''),
          range: ranges[0]?.[2],
          definedIn: cls,
          inherited: i > 0,
          inheritanceDistance: i
        });
      }
    }

    return properties;
  }

  /**
   * Get all relationships for a class including inherited from ancestors
   *
   * @param {string} classURI - The class URI
   * @returns {Promise<Array>} - Array of relationship objects with inheritance info
   */
  async getInheritedRelationships(classURI) {
    const relationships = [];
    const hierarchy = [classURI, ...(await this.hierarchyTraversal.getAncestors(classURI))];

    for (let i = 0; i < hierarchy.length; i++) {
      const cls = hierarchy[i];
      const rels = await this.tripleStore.query(null, 'rdfs:domain', cls);

      for (const [relURI] of rels) {
        const types = await this.tripleStore.query(relURI, 'rdf:type', null);
        if (!types.some(t => t[2] === 'owl:ObjectProperty')) continue;

        const labels = await this.tripleStore.query(relURI, 'rdfs:label', null);
        const ranges = await this.tripleStore.query(relURI, 'rdfs:range', null);

        relationships.push({
          uri: relURI,
          label: labels[0]?.[2]?.replace(/"/g, ''),
          range: ranges[0]?.[2],
          definedIn: cls,
          inherited: i > 0,
          inheritanceDistance: i
        });
      }
    }

    return relationships;
  }
}
