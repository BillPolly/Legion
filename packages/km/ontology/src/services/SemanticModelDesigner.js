/**
 * SemanticModelDesigner - Research-driven, incremental semantic model design
 *
 * Holistically analyzes documents to design complete semantic models BEFORE
 * building ontology incrementally. Integrates with existing ontology content.
 *
 * Process:
 * 1. Analyze existing ontology (what classes/properties already exist)
 * 2. Research required pattern (LLM determines best pattern for document)
 * 3. Gap analysis (compare existing vs required)
 * 4. Design delta (design only missing parts)
 * 5. Validate compatibility (ensure integration works)
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register Handlebars helpers for templates
Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('or', function(...args) {
  // Last argument is Handlebars options object
  const values = args.slice(0, -1);
  return values.some(v => v);
});

export class SemanticModelDesigner {
  constructor(config = {}) {
    if (!config.tripleStore) {
      throw new Error('Triple store is required');
    }
    if (!config.semanticSearch) {
      throw new Error('Semantic search is required');
    }
    if (!config.llmClient) {
      throw new Error('LLM client is required');
    }
    if (!config.hierarchyTraversal) {
      throw new Error('Hierarchy traversal is required');
    }

    this.tripleStore = config.tripleStore;
    this.semanticSearch = config.semanticSearch;
    this.llmClient = config.llmClient;
    this.hierarchyTraversal = config.hierarchyTraversal;

    // Templates
    this.researchPatternTemplate = null;
    this.defineConceptTemplate = null;
    this.analyzeStructureTemplate = null;
  }

  /**
   * Design semantic model for document
   *
   * Main entry point - analyzes document holistically and designs
   * complete semantic model (reusing existing ontology where possible)
   *
   * @param {Object} document - Document to model
   * @param {Object} document.table - Table data (if present)
   * @param {string} document.narrative - Narrative text (if present)
   * @param {Object} document.metadata - Metadata (company, year, topic, etc.)
   * @param {Object} options - Design options
   * @param {string} options.domain - Domain context (default: 'general')
   * @returns {Promise<Object>} - Semantic model
   */
  async design(document, options = {}) {
    const domain = options.domain || 'general';

    console.log('\n🎨 SEMANTIC MODEL DESIGN (Research-Driven)');
    console.log('='.repeat(60));

    // Step 1: Analyze existing ontology
    console.log('\n📊 Step 1: Analyzing existing ontology...');
    const existingOntology = await this.analyzeExistingOntology(domain);
    console.log(`   Found ${existingOntology.classes.length} classes, ${existingOntology.properties.length} properties`);

    // Step 2: Analyze document structure
    console.log('\n📋 Step 2: Analyzing document structure...');
    const structure = await this.analyzeDocumentStructure(document);
    console.log(`   Document type: ${structure.type}`);
    console.log(`   Has table: ${structure.hasTable}`);
    console.log(`   Has narrative: ${structure.hasNarrative}`);

    // Step 3: Research required pattern
    console.log('\n🔬 Step 3: Researching required pattern...');
    const pattern = await this.researchRequiredPattern(structure, existingOntology, domain);
    console.log(`   Pattern: ${pattern.name}`);
    console.log(`   Reason: ${pattern.reason}`);

    // Step 4: Gap analysis
    console.log('\n🔍 Step 4: Gap analysis...');
    const gap = await this.analyzeGap(document, existingOntology, pattern);
    console.log(`   Can reuse: ${gap.canReuse.length} concepts`);
    console.log(`   Need to create: ${gap.needsCreation.length} concepts`);
    console.log(`   Need to extend: ${gap.needsExtension.length} concepts`);

    // Step 5: Design delta
    console.log('\n✏️  Step 5: Designing semantic model delta...');
    const delta = await this.designDelta(gap, pattern, document, domain);
    console.log(`   New classes: ${delta.newClasses.length}`);
    console.log(`   New properties: ${delta.newProperties.length}`);
    console.log(`   New relationships: ${delta.newRelationships.length}`);

    // Step 6: Validate compatibility
    console.log('\n✅ Step 6: Validating compatibility...');
    const validation = await this.validateCompatibility(delta, existingOntology);
    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.issues);
      throw new Error(`Semantic model validation failed: ${validation.issues.join(', ')}`);
    }
    console.log('   ✓ Compatible with existing ontology');

    // Step 7: Generate complete model
    const semanticModel = {
      existing: existingOntology,
      delta,
      pattern,
      gap,
      structure,
      validation
    };

    console.log('\n✅ SEMANTIC MODEL DESIGN COMPLETE');
    console.log('='.repeat(60));

    return semanticModel;
  }

  /**
   * Analyze existing ontology
   *
   * Queries triple store to understand what's already defined
   *
   * @param {string} domain - Domain to analyze
   * @returns {Promise<Object>} - Existing ontology structure
   */
  async analyzeExistingOntology(domain) {
    // Get all classes
    const classTriples = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');
    const classes = [];

    for (const [classUri] of classTriples) {
      // Skip bootstrap classes (we know about those)
      if (classUri.match(/Continuant|Occurrent|PhysicalEntity|State|Process|Task$/)) {
        continue;
      }

      const labels = await this.tripleStore.query(classUri, 'rdfs:label', null);
      const definitions = await this.tripleStore.query(classUri, 'skos:definition', null);
      const parents = await this.tripleStore.query(classUri, 'rdfs:subClassOf', null);

      // Get full hierarchy context
      const hierarchy = await this.hierarchyTraversal.getHierarchyContext(classUri);

      classes.push({
        uri: classUri,
        label: labels[0]?.[2]?.replace(/"/g, '') || classUri.split(':')[1],
        definition: definitions[0]?.[2]?.replace(/"/g, '') || '',
        parent: parents[0]?.[2] || 'owl:Thing',
        hierarchy
      });
    }

    // Get all properties
    const propTriples = await this.tripleStore.query(null, 'rdf:type', 'owl:DatatypeProperty');
    const properties = [];

    for (const [propUri] of propTriples) {
      const labels = await this.tripleStore.query(propUri, 'rdfs:label', null);
      const domains = await this.tripleStore.query(propUri, 'rdfs:domain', null);
      const ranges = await this.tripleStore.query(propUri, 'rdfs:range', null);

      properties.push({
        uri: propUri,
        label: labels[0]?.[2]?.replace(/"/g, '') || propUri.split(':')[1],
        domain: domains[0]?.[2] || 'unknown',
        range: ranges[0]?.[2] || 'unknown'
      });
    }

    // Get all relationships
    const relTriples = await this.tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
    const relationships = [];

    for (const [relUri] of relTriples) {
      const labels = await this.tripleStore.query(relUri, 'rdfs:label', null);
      const domains = await this.tripleStore.query(relUri, 'rdfs:domain', null);
      const ranges = await this.tripleStore.query(relUri, 'rdfs:range', null);

      relationships.push({
        uri: relUri,
        label: labels[0]?.[2]?.replace(/"/g, '') || relUri.split(':')[1],
        domain: domains[0]?.[2] || 'unknown',
        range: ranges[0]?.[2] || 'unknown'
      });
    }

    // Identify existing patterns
    const patterns = this.identifyExistingPatterns(classes, properties, relationships);

    return {
      classes,
      properties,
      relationships,
      patterns
    };
  }

  /**
   * Identify patterns in existing ontology
   *
   * @param {Array} classes - Existing classes
   * @param {Array} properties - Existing properties
   * @param {Array} relationships - Existing relationships
   * @returns {Array} - Identified patterns
   */
  identifyExistingPatterns(classes, properties, relationships) {
    const patterns = [];

    // Check for common patterns
    if (classes.some(c => c.uri.includes('Organization') || c.uri.includes('Company'))) {
      patterns.push('Has organization/company entities');
    }

    if (classes.some(c => c.uri.includes('Financial') || c.uri.includes('Report'))) {
      patterns.push('Has financial reporting classes');
    }

    if (properties.some(p => p.uri.includes('hasValue') || p.uri.includes('value'))) {
      patterns.push('Has value properties');
    }

    if (relationships.some(r => r.uri.includes('for') || r.uri.includes('of'))) {
      patterns.push('Has linking relationships');
    }

    return patterns;
  }

  /**
   * Analyze document structure
   *
   * Uses LLM to understand what the document contains
   *
   * @param {Object} document - Document to analyze
   * @returns {Promise<Object>} - Structure analysis
   */
  async analyzeDocumentStructure(document) {
    // Load template if needed
    if (!this.analyzeStructureTemplate) {
      const templatePath = join(__dirname, '../prompts/analyze-document-structure.hbs');
      this.analyzeStructureTemplate = await readFile(templatePath, 'utf-8');
    }

    // Prepare document summary
    const summary = {
      hasTable: !!document.table,
      hasNarrative: !!document.narrative,
      metadata: document.metadata || {},
      tableStructure: document.table ? {
        rows: document.table.data ? document.table.data.length : 0,
        columns: document.table.periods ? document.table.periods.length : 0,
        metrics: document.table.metrics || []
      } : null,
      narrativeSample: document.narrative ? document.narrative.substring(0, 500) : null
    };

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        type: { type: 'string' },
        description: { type: 'string' },
        entities: { type: 'array', items: { type: 'string' } },
        temporalStructure: { type: 'boolean' },
        quantitativeData: { type: 'boolean' },
        relationships: { type: 'array', items: { type: 'string' } }
      },
      required: ['type', 'description', 'entities']
    };

    // Execute LLM analysis
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.analyzeStructureTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    const result = await templatedPrompt.execute({ document: summary });

    if (!result.success) {
      throw new Error(`Document structure analysis failed: ${result.errors?.join(', ')}`);
    }

    return {
      type: result.data.type,
      description: result.data.description,
      entities: result.data.entities,
      temporalStructure: result.data.temporalStructure,
      quantitativeData: result.data.quantitativeData,
      relationships: result.data.relationships,
      hasTable: summary.hasTable,
      hasNarrative: summary.hasNarrative,
      tableStructure: summary.tableStructure
    };
  }

  /**
   * Research required pattern for document
   *
   * Uses LLM to determine best modeling pattern given:
   * - Document structure
   * - Existing ontology
   * - Domain knowledge
   *
   * @param {Object} structure - Document structure
   * @param {Object} existingOntology - Existing ontology
   * @param {string} domain - Domain context
   * @returns {Promise<Object>} - Required pattern
   */
  async researchRequiredPattern(structure, existingOntology, domain) {
    // Load template if needed
    if (!this.researchPatternTemplate) {
      const templatePath = join(__dirname, '../prompts/research-required-pattern.hbs');
      this.researchPatternTemplate = await readFile(templatePath, 'utf-8');
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        reason: { type: 'string' },
        requiredConcepts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['class', 'property', 'relationship'] },
              purpose: { type: 'string' }
            },
            required: ['name', 'type', 'purpose']
          }
        },
        reuseExisting: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['name', 'reason', 'requiredConcepts', 'reuseExisting']
    };

    // Execute LLM research
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.researchPatternTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    const result = await templatedPrompt.execute({
      structure,
      existingOntology: {
        classes: existingOntology.classes.map(c => `${c.uri} (${c.definition})`),
        properties: existingOntology.properties.map(p => `${p.uri} (domain: ${p.domain})`),
        patterns: existingOntology.patterns
      },
      domain
    });

    if (!result.success) {
      console.error('\n❌ PATTERN RESEARCH FAILED');
      console.error('Errors:', result.errors);
      console.error('Raw response (if available):', result.raw?.substring(0, 500));
      throw new Error(`Pattern research failed: ${result.errors?.join(', ')}`);
    }

    console.log('✅ Pattern research succeeded');
    console.log('Pattern:', result.data.name);
    console.log('Required concepts:', result.data.requiredConcepts?.length || 0);
    console.log('Reuse existing:', result.data.reuseExisting?.length || 0);

    return result.data;
  }

  /**
   * Analyze gap between existing ontology and required pattern
   *
   * @param {Object} document - Original document
   * @param {Object} existingOntology - Existing ontology
   * @param {Object} pattern - Required pattern
   * @returns {Promise<Object>} - Gap analysis
   */
  async analyzeGap(document, existingOntology, pattern) {
    const gap = {
      canReuse: [],
      needsCreation: [],
      needsExtension: [],
      needsRefactoring: []
    };

    // Check each required concept
    for (const concept of pattern.requiredConcepts) {
      // Check if mentioned in reuseExisting
      if (pattern.reuseExisting.some(uri => uri.toLowerCase().includes(concept.name.toLowerCase()))) {
        // Find the actual class
        const existingClass = existingOntology.classes.find(c =>
          c.uri.toLowerCase().includes(concept.name.toLowerCase()) ||
          c.label.toLowerCase().includes(concept.name.toLowerCase())
        );

        if (existingClass) {
          gap.canReuse.push({
            concept,
            existing: existingClass
          });
          continue;
        }
      }

      // Check if similar concept exists
      const similar = await this.findSimilarConcept(concept, existingOntology);

      if (similar && similar.similarity > 0.8) {
        // Can potentially reuse with extension
        gap.needsExtension.push({
          concept,
          existing: similar.concept,
          similarity: similar.similarity
        });
      } else {
        // Need to create from scratch
        gap.needsCreation.push(concept);
      }
    }

    return gap;
  }

  /**
   * Find similar concept in existing ontology
   *
   * @param {Object} concept - Concept to find
   * @param {Object} existingOntology - Existing ontology
   * @returns {Promise<Object|null>} - Similar concept or null
   */
  async findSimilarConcept(concept, existingOntology) {
    // Use semantic search if concept is a class
    if (concept.type === 'class') {
      try {
        const results = await this.semanticSearch.semanticSearch(
          'ontology-classes',
          concept.name,
          { limit: 1 }
        );

        if (results.length > 0 && results[0]._similarity > 0.7) {
          const classUri = results[0].payload.metadata.classURI;
          const existingClass = existingOntology.classes.find(c => c.uri === classUri);

          if (existingClass) {
            return {
              concept: existingClass,
              similarity: results[0]._similarity
            };
          }
        }
      } catch (error) {
        // Semantic search might not have this collection yet
      }
    }

    return null;
  }

  /**
   * Design delta (missing parts of semantic model)
   *
   * @param {Object} gap - Gap analysis
   * @param {Object} pattern - Required pattern
   * @param {Object} document - Original document
   * @param {string} domain - Domain context
   * @returns {Promise<Object>} - Delta design
   */
  async designDelta(gap, pattern, document, domain) {
    const delta = {
      newClasses: [],
      newProperties: [],
      newRelationships: [],
      modifications: []
    };

    // Load template for concept definition
    if (!this.defineConceptTemplate) {
      const templatePath = join(__dirname, '../prompts/define-concept.hbs');
      this.defineConceptTemplate = await readFile(templatePath, 'utf-8');
    }

    // Design each concept that needs creation
    for (const concept of gap.needsCreation) {
      const definition = await this.defineConcept(concept, pattern, document, domain, delta);

      if (concept.type === 'class') {
        delta.newClasses.push(definition);
      } else if (concept.type === 'property') {
        delta.newProperties.push(definition);
      } else if (concept.type === 'relationship') {
        delta.newRelationships.push(definition);
      }
    }

    return delta;
  }

  /**
   * Define a concept with full context
   *
   * @param {Object} concept - Concept to define
   * @param {Object} pattern - Pattern context
   * @param {Object} document - Document context
   * @param {string} domain - Domain context
   * @param {Object} delta - Delta being built (for reference)
   * @returns {Promise<Object>} - Concept definition
   */
  async defineConcept(concept, pattern, document, domain, delta) {
    // Define response schema based on concept type
    const responseSchema = {
      type: 'object',
      properties: {
        uri: { type: 'string' },
        label: { type: 'string' },
        definition: { type: 'string' },
        supertypeDescription: { type: 'string' },
        usageDescription: { type: 'string' },
        synonyms: { type: 'string' },
        parent: { type: 'string' }
      },
      required: ['uri', 'label', 'definition', 'parent']
    };

    if (concept.type === 'property' || concept.type === 'relationship') {
      responseSchema.properties.domain = { type: 'string' };
      responseSchema.properties.range = { type: 'string' };
      responseSchema.required.push('domain', 'range');
    }

    // Execute LLM definition
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.defineConceptTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Build list of available classes for domain/range references
    const availableClasses = [
      // Bootstrap classes
      'kg:PhysicalEntity',
      'kg:State',
      'kg:Process',
      'kg:Task',
      'owl:Thing',
      // Classes being defined in this pattern
      ...pattern.requiredConcepts
        .filter(c => c.type === 'class')
        .map(c => `kg:${c.name}`),
      // Classes already defined in delta
      ...delta.newClasses.map(c => c.uri)
    ];

    const result = await templatedPrompt.execute({
      concept,
      pattern,
      availableClasses,
      document: {
        type: document.metadata?.type || 'document',
        company: document.metadata?.company,
        topic: document.metadata?.topic
      },
      domain
    });

    if (!result.success) {
      throw new Error(`Concept definition failed for ${concept.name}: ${result.errors?.join(', ')}`);
    }

    return result.data;
  }

  /**
   * Validate compatibility with existing ontology
   *
   * @param {Object} delta - Delta to validate
   * @param {Object} existingOntology - Existing ontology
   * @returns {Promise<Object>} - Validation result
   */
  async validateCompatibility(delta, existingOntology) {
    const issues = [];

    // Known/bootstrap URIs that are always available
    const knownURIs = new Set([
      // Bootstrap upper-level classes
      'kg:Continuant',
      'kg:Occurrent',
      'kg:PhysicalEntity',
      'kg:State',
      'kg:Process',
      'kg:Task',
      // OWL/RDF/RDFS
      'owl:Thing',
      'rdfs:Resource',
      // XSD datatypes
      'xsd:string',
      'xsd:decimal',
      'xsd:integer',
      'xsd:boolean',
      'xsd:date',
      'xsd:dateTime',
      'xsd:float',
      'xsd:double'
    ]);

    // Helper to check if URI exists (with fuzzy matching for LLM inconsistencies)
    const uriExists = (uri) => {
      // Exact match
      if (knownURIs.has(uri) ||
          existingOntology.classes.some(c => c.uri === uri) ||
          delta.newClasses.some(c => c.uri === uri)) {
        return true;
      }

      // Fuzzy match - check if any existing class contains the key part of the URI
      // e.g., kg:Metric should match kg:FinancialMetric
      if (uri.startsWith('kg:')) {
        const uriPart = uri.substring(3).toLowerCase(); // Remove 'kg:' prefix

        // Check if any class URI contains this part
        const fuzzyMatch = delta.newClasses.some(c => {
          const classPart = c.uri.substring(3).toLowerCase();
          return classPart.includes(uriPart) || uriPart.includes(classPart);
        });

        if (fuzzyMatch) {
          return true;
        }
      }

      return false;
    };

    // Check new classes have valid parents
    for (const newClass of delta.newClasses) {
      if (newClass.parent && !uriExists(newClass.parent)) {
        issues.push(`Parent ${newClass.parent} for ${newClass.uri} doesn't exist`);
      }
    }

    // Check new properties have valid domains
    for (const newProp of delta.newProperties) {
      if (newProp.domain && !uriExists(newProp.domain)) {
        issues.push(`Domain ${newProp.domain} for ${newProp.uri} doesn't exist`);
      }
      if (newProp.range && !newProp.range.startsWith('xsd:') && !uriExists(newProp.range)) {
        issues.push(`Range ${newProp.range} for ${newProp.uri} doesn't exist`);
      }
    }

    // Check new relationships have valid domains and ranges
    for (const newRel of delta.newRelationships) {
      if (newRel.domain && !uriExists(newRel.domain)) {
        issues.push(`Domain ${newRel.domain} for ${newRel.uri} doesn't exist`);
      }
      if (newRel.range && !uriExists(newRel.range)) {
        issues.push(`Range ${newRel.range} for ${newRel.uri} doesn't exist`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
