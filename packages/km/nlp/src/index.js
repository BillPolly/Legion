/**
 * NLP-to-KG Processing System
 * Main entry point for the NLP processing system
 *
 * Refactored to use Legion standard patterns:
 * - ResourceManager for LLM client
 * - Service layer for domain logic
 * - TemplatedPrompt for LLM interactions
 */

import { ResourceManager } from '@legion/resource-manager';

// Text Input Layer
import { TextPreprocessor } from './text-input/TextPreprocessor.js';
export { TextPreprocessor };

// Services (domain logic)
import { EntityExtractionService } from './services/EntityExtractionService.js';
import { RelationshipExtractionService } from './services/RelationshipExtractionService.js';
import { QualityAssessmentService } from './services/QualityAssessmentService.js';
import { SemanticComparisonService } from './services/SemanticComparisonService.js';
import { DisambiguationService } from './services/DisambiguationService.js';
export { EntityExtractionService, RelationshipExtractionService, QualityAssessmentService, SemanticComparisonService, DisambiguationService };

// Ontology Pipeline
import { OntologyExtractor } from './ontology-pipeline/OntologyExtractor.js';
export { OntologyExtractor };

// KG Constructor
import { TripleGenerator } from './kg-constructor/TripleGenerator.js';
export { TripleGenerator };

// Main system class - Refactored implementation
export class NLPSystem {
  constructor(options = {}) {
    this.options = {
      resourceManager: options.resourceManager || null,
      dataSource: options.dataSource || null,
      ...options
    };

    // Initialize components
    this.textPreprocessor = new TextPreprocessor();
    this.ontologyExtractor = new OntologyExtractor(this.options.dataSource);
    this.tripleGenerator = new TripleGenerator();

    // Service instances (initialized in initialize())
    this.entityExtractionService = null;
    this.relationshipExtractionService = null;

    this.resourceManager = null;
    this.llmClient = null;
    this.initialized = false;
  }

  /**
   * Initialize the NLP system with LLM client from ResourceManager
   * Must be called before processing text
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Get ResourceManager
    this.resourceManager = this.options.resourceManager || await ResourceManager.getInstance();

    // Get LLM client from ResourceManager
    this.llmClient = await this.resourceManager.get('llmClient');

    if (!this.llmClient) {
      throw new Error('Failed to get LLM client from ResourceManager - no LLM available');
    }

    // Initialize services with LLM client
    this.entityExtractionService = new EntityExtractionService(this.llmClient);
    await this.entityExtractionService.initialize();

    this.relationshipExtractionService = new RelationshipExtractionService(this.llmClient);
    await this.relationshipExtractionService.initialize();

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
      
      // Step 3: Extract entities using EntityExtractionService
      const entityResult = await this.entityExtractionService.extractEntities(
        preprocessed.normalizedText,
        llmSchema,
        { domain: schema.domain }
      );

      // Step 4: Extract relationships using RelationshipExtractionService
      const relationshipResult = await this.relationshipExtractionService.extractRelationships(
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
        llmClient: this.llmClient ? 'active' : 'not initialized'
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
