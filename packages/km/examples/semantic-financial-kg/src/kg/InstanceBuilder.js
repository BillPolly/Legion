import { ConceptExtractor } from './ConceptExtractor.js';
import { OntologyRetriever } from './OntologyRetriever.js';
import { TextInstanceCreator } from './TextInstanceCreator.js';
import { TableInstanceCreator } from './TableInstanceCreator.js';
import { KGToTextGenerator } from './KGToTextGenerator.js';
import { SemanticValidator } from './SemanticValidator.js';

/**
 * InstanceBuilder - Complete pipeline for creating validated knowledge graphs
 *
 * Orchestrates the 3-phase pipeline:
 * 1. Concept Extraction & Ontology Retrieval
 * 2. Instance Creation (text + tables)
 * 3. Validation & Coverage checking
 */
export class InstanceBuilder {
  constructor({ tripleStore, ontologyBuilder, llmClient, semanticSearch }) {
    if (!tripleStore) {
      throw new Error('InstanceBuilder requires tripleStore');
    }
    if (!ontologyBuilder) {
      throw new Error('InstanceBuilder requires ontologyBuilder');
    }
    if (!llmClient) {
      throw new Error('InstanceBuilder requires llmClient');
    }
    if (!semanticSearch) {
      throw new Error('InstanceBuilder requires semanticSearch');
    }

    this.tripleStore = tripleStore;
    this.ontologyBuilder = ontologyBuilder;
    this.llmClient = llmClient;
    this.semanticSearch = semanticSearch;

    // Initialize pipeline components
    this.conceptExtractor = new ConceptExtractor({ llmClient });
    this.ontologyRetriever = new OntologyRetriever({ semanticSearch, tripleStore });
    this.textCreator = new TextInstanceCreator({ llmClient, tripleStore, ontologyRetriever: this.ontologyRetriever });
    this.tableCreator = new TableInstanceCreator({ llmClient, tripleStore, ontologyRetriever: this.ontologyRetriever });
    this.kgGenerator = new KGToTextGenerator({ llmClient, tripleStore });
    this.validator = new SemanticValidator({ semanticSearch });
  }

  /**
   * Create knowledge graph instances from arbitrary data
   * @param {Object} data - Input data with text, preText, table, postText
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>} Results with instances and validation
   */
  async createInstances(data, options = {}) {
    const { threshold = 0.9, iterative = false } = options;

    // PHASE 1: Concept Extraction & Ontology Retrieval
    console.log('\n📝 Phase 1: Extracting concepts and retrieving ontology...');

    // Extract concepts from all data
    const allData = this.combineDataForConceptExtraction(data);
    const concepts = await this.conceptExtractor.extractConcepts(allData);

    console.log(`  Extracted concepts:`, concepts);

    // Retrieve relevant ontology subset
    const ontologySubset = await this.ontologyRetriever.retrieveRelevantOntology(concepts);
    const ontologyText = this.ontologyRetriever.formatOntologyAsText(ontologySubset);

    console.log(`  Retrieved ontology: ${ontologySubset.classes.length} classes, ${ontologySubset.relationships.length} relationships`);

    // PHASE 2: Instance Creation
    console.log('\n📝 Phase 2: Creating instances...');

    const results = {};
    const allInstances = {
      entities: [],
      relationships: []
    };

    // Process text field (simple text)
    if (data.text) {
      console.log('  Creating instances from text...');
      const textInstances = await this.textCreator.createInstancesFromText(
        data.text,
        ontologyText,
        data.metadata || {}  // Pass metadata for Phase 7
      );
      results.text = textInstances;
      allInstances.entities.push(...textInstances.entities);
      allInstances.relationships.push(...textInstances.relationships);

      // Add to triple store
      await this.tripleStore.storeEntityModel(textInstances);
    }

    // Process preText (narrative before table)
    if (data.preText) {
      console.log('  Creating instances from preText...');
      const preTextInstances = await this.textCreator.createInstancesFromText(
        data.preText,
        ontologyText,
        data.metadata || {}  // Pass metadata for Phase 7
      );
      results.preText = preTextInstances;
      allInstances.entities.push(...preTextInstances.entities);
      allInstances.relationships.push(...preTextInstances.relationships);

      // Add to triple store
      await this.tripleStore.storeEntityModel(preTextInstances);
    }

    // Process table
    if (data.table) {
      console.log('  Creating instances from table...');
      const tableInstances = await this.tableCreator.createInstancesFromTable(
        data.table,
        ontologyText,
        data.metadata || {}  // Pass metadata for Phase 7 (scale, currency, sourceDocument, etc.)
      );
      results.table = tableInstances;
      allInstances.entities.push(...tableInstances.entities);
      allInstances.relationships.push(...tableInstances.relationships);

      // Add to triple store
      await this.tripleStore.storeEntityModel(tableInstances);
    }

    // Process postText (narrative after table)
    if (data.postText) {
      console.log('  Creating instances from postText...');
      const postTextInstances = await this.textCreator.createInstancesFromText(
        data.postText,
        ontologyText,
        data.metadata || {}  // Pass metadata for Phase 7
      );
      results.postText = postTextInstances;
      allInstances.entities.push(...postTextInstances.entities);
      allInstances.relationships.push(...postTextInstances.relationships);

      // Add to triple store
      await this.tripleStore.storeEntityModel(postTextInstances);
    }

    console.log(`  Created ${allInstances.entities.length} entities, ${allInstances.relationships.length} relationships`);

    // PHASE 3: Validation
    console.log('\n📝 Phase 3: Validating coverage...');

    // Combine source text
    const sourceText = this.combineSourceText(data);

    // Generate text from KG
    const generatedText = await this.kgGenerator.generateText(allInstances);

    // Validate coverage
    const validation = await this.validator.validateCoverage(sourceText, generatedText, { threshold });

    validation.sourceText = sourceText;
    validation.generatedText = generatedText;

    console.log(`  Validation: similarity=${validation.similarity.toFixed(3)}, complete=${validation.complete}`);

    results.validation = validation;

    return results;
  }

  /**
   * Combine all data for concept extraction
   * @param {Object} data - Input data
   * @returns {string} Combined text
   */
  combineDataForConceptExtraction(data) {
    let combined = '';

    if (data.text) {
      combined += data.text + '\n\n';
    }
    if (data.preText) {
      combined += data.preText + '\n\n';
    }
    if (data.table) {
      // Handle both table formats: standard {headers, rows} and ConvFinQA nested objects
      if (data.table.headers && Array.isArray(data.table.headers)) {
        // Standard format
        combined += 'Table with headers: ' + data.table.headers.join(', ') + '\n';
        combined += 'Rows: ' + data.table.rows.length + '\n\n';
      } else if (typeof data.table === 'object') {
        // ConvFinQA format: {period1: {metric1: value1, ...}, ...}
        const periods = Object.keys(data.table);
        const firstPeriod = data.table[periods[0]];
        const metrics = firstPeriod ? Object.keys(firstPeriod) : [];
        combined += 'Table with periods: ' + periods.join(', ') + '\n';
        combined += 'Metrics: ' + metrics.join(', ') + '\n\n';
      }
    }
    if (data.postText) {
      combined += data.postText + '\n\n';
    }

    return combined.trim();
  }

  /**
   * Combine source text for validation
   * @param {Object} data - Input data
   * @returns {string} Combined source text
   */
  combineSourceText(data) {
    let combined = '';

    if (data.text) {
      combined += data.text + ' ';
    }
    if (data.preText) {
      combined += data.preText + ' ';
    }
    if (data.table) {
      // Include table content in source text - handle both formats
      combined += 'Table: ';
      if (data.table.headers && Array.isArray(data.table.headers) && data.table.rows) {
        // Standard format
        data.table.rows.forEach(row => {
          combined += row.join(', ') + '. ';
        });
      } else if (typeof data.table === 'object') {
        // ConvFinQA format: {period1: {metric1: value1, ...}, ...}
        for (const period of Object.keys(data.table)) {
          for (const [metric, value] of Object.entries(data.table[period])) {
            combined += `${period} ${metric}: ${value}. `;
          }
        }
      }
    }
    if (data.postText) {
      combined += data.postText + ' ';
    }

    return combined.trim();
  }
}
