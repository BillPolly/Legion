/**
 * NLP-to-KG Processing System
 * Main entry point for the NLP processing system
 */

// Text Input Layer
import { TextPreprocessor } from './text-input/TextPreprocessor.js';
export { TextPreprocessor };

// LLM Integration
import { LLMClient } from './llm-integration/LLMClient.js';
import { MockLLMClient } from './llm-integration/MockLLMClient.js';
import { RealLLMClient } from './llm-integration/RealLLMClient.js';
export { LLMClient, MockLLMClient, RealLLMClient };

// Ontology Pipeline
import { OntologyExtractor } from './ontology-pipeline/OntologyExtractor.js';
export { OntologyExtractor };

// KG Constructor
import { TripleGenerator } from './kg-constructor/TripleGenerator.js';
export { TripleGenerator };

// Main system class - Phase 1 implementation
export class NLPSystem {
  constructor(options = {}) {
    this.options = {
      llmClient: null,
      kgEngine: null,
      ...options
    };
    
    // Initialize components
    this.textPreprocessor = new TextPreprocessor();
    this.ontologyExtractor = new OntologyExtractor(this.options.kgEngine);
    this.tripleGenerator = new TripleGenerator();
    
    // Use provided LLM client or create real one (NO FALLBACK TO MOCK)
    this.llmClient = this.options.llmClient || null;
    this.initialized = false;
  }

  /**
   * Initialize the NLP system with real LLM client
   * Must be called before processing text
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // If no LLM client provided, create real one
    if (!this.llmClient) {
      this.llmClient = new RealLLMClient();
      await this.llmClient.initialize();
    }
    
    this.initialized = true;
  }

  /**
   * Process text and extract knowledge - Phase 1 implementation
   * @param {string} text - Input text to process
   * @returns {Promise<Object>} - Processing results
   */
  async processText(text) {
    // Ensure system is initialized
    await this.initialize();
    
    const startTime = Date.now();
    
    try {
      // Step 1: Preprocess text
      const preprocessed = this.textPreprocessor.process(text);
      
      // Step 2: Extract ontological schema
      const schema = await this.ontologyExtractor.extractRelevantSchema(preprocessed.normalizedText);
      const llmSchema = this.ontologyExtractor.generateLLMSchema(schema);
      
      // Step 3: Extract entities using LLM with schema guidance
      const entityResult = await this.llmClient.extractEntities(
        preprocessed.normalizedText, 
        llmSchema, 
        { domain: schema.domain }
      );
      
      // Step 4: Extract relationships using LLM
      const relationshipResult = await this.llmClient.extractRelationships(
        preprocessed.normalizedText,
        entityResult.entities,
        llmSchema.relationshipTypes
      );
      
      // Step 5: Generate triples
      const extractions = {
        entities: entityResult.entities,
        relationships: relationshipResult.relationships
      };
      
      const context = {
        extractionId: `extraction_${Date.now()}`,
        sourceText: text,
        domain: schema.domain,
        processingTime: Date.now() - startTime
      };
      
      const triples = this.tripleGenerator.generateTriples(extractions, context);
      
      // Step 6: Compile results
      const results = {
        success: true,
        processingTime: Date.now() - startTime,
        input: {
          originalText: text,
          normalizedText: preprocessed.normalizedText,
          sentences: preprocessed.sentences.length,
          language: preprocessed.language
        },
        schema: {
          domain: schema.domain,
          entityClasses: schema.entityClasses.length,
          relationshipTypes: schema.relationshipTypes.length
        },
        extractions: {
          entities: entityResult.entities.length,
          relationships: relationshipResult.relationships.length,
          entityDetails: entityResult.entities,
          relationshipDetails: relationshipResult.relationships
        },
        triples: {
          count: triples.length,
          triples: triples,
          statistics: this.tripleGenerator.getStatistics()
        },
        metadata: {
          extractionId: context.extractionId,
          timestamp: new Date().toISOString(),
          version: '1.0.0-phase1'
        }
      };
      
      return results;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        processingTime: processingTime,
        input: { originalText: text },
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0-phase1'
        }
      };
    }
  }

  /**
   * Get system status and capabilities
   * @returns {Object} - System status
   */
  getStatus() {
    return {
      version: '1.0.0-phase1',
      components: {
        textPreprocessor: 'active',
        ontologyExtractor: 'active',
        tripleGenerator: 'active',
        llmClient: this.llmClient.constructor.name
      },
      capabilities: [
        'text_preprocessing',
        'domain_detection',
        'schema_extraction',
        'entity_extraction',
        'relationship_extraction',
        'triple_generation',
        'confidence_scoring'
      ],
      phase: 'Phase 1: Core Infrastructure'
    };
  }
}
