/**
 * OntologyBuilder - Main orchestrator for incremental ontology building
 *
 * Processes text sentence-by-sentence through 5-phase pipeline:
 * 1. QUERY - Find existing types in ontology
 * 2. GAP ANALYSIS - Identify missing types
 * 3. DECISION - LLM decides reuse vs specialize
 * 4. EXTENSION - Add new types to ontology
 * 5. ANNOTATION - Attach type metadata to sentences
 */

import { HierarchyTraversalService } from './services/HierarchyTraversalService.js';
import { SubsumptionChecker } from './services/SubsumptionChecker.js';
import { OntologyQueryService } from './services/OntologyQueryService.js';
import { GapAnalysisService } from './services/GapAnalysisService.js';
import { SpecializationDecisionService } from './services/SpecializationDecisionService.js';
import { OntologyExtensionService } from './services/OntologyExtensionService.js';
import { SentenceAnnotator } from './services/SentenceAnnotator.js';
import { OntologyVerificationService } from './services/OntologyVerificationService.js';
import { getBootstrapTriples } from './bootstrap/upper-level-ontology.js';

export class OntologyBuilder {
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

    this.tripleStore = config.tripleStore;
    this.semanticSearch = config.semanticSearch;
    this.llmClient = config.llmClient;

    // Initialize verification service FIRST (Z3 theorem proving)
    this.verification = new OntologyVerificationService(this.tripleStore, config.verification || {});

    // Initialize services
    this.hierarchyTraversal = new HierarchyTraversalService(this.tripleStore);
    this.subsumptionChecker = new SubsumptionChecker(this.tripleStore, this.hierarchyTraversal);
    this.ontologyQuery = new OntologyQueryService(this.tripleStore, this.hierarchyTraversal, this.semanticSearch);
    this.gapAnalysis = new GapAnalysisService(this.subsumptionChecker, this.llmClient);
    this.specializationDecision = new SpecializationDecisionService(this.llmClient);
    this.ontologyExtension = new OntologyExtensionService(this.tripleStore, this.semanticSearch, this.llmClient, this.hierarchyTraversal, this.verification);
    this.sentenceAnnotator = new SentenceAnnotator();

    this.bootstrapLoaded = false;
  }

  /**
   * Load upper-level ontology bootstrap (if not already loaded)
   *
   * Initializes the ontology with fundamental categories:
   * - kg:Continuant (PhysicalEntity, State)
   * - kg:Occurrent (Process, Task)
   *
   * This should be called before processing text to ensure the ontology
   * has the foundational categories for entity classification.
   *
   * @returns {Promise<void>}
   */
  async ensureBootstrapLoaded() {
    if (this.bootstrapLoaded) {
      return;
    }

    // Check if bootstrap is already in the triple store
    const continuantCheck = await this.tripleStore.query('kg:Continuant', 'rdf:type', 'owl:Class');
    if (continuantCheck.length > 0) {
      console.log('✓ Bootstrap ontology already loaded');
      this.bootstrapLoaded = true;
      return;
    }

    console.log('📦 Loading bootstrap upper-level ontology...');

    const bootstrapTriples = getBootstrapTriples();

    // Insert all bootstrap triples
    for (const [subject, predicate, object] of bootstrapTriples) {
      await this.tripleStore.add(subject, predicate, object);
    }

    // Index bootstrap classes in semantic search
    await this._indexBootstrapClasses();

    // Initialize and verify bootstrap ontology
    await this.verification.initialize();
    await this.verification.verifyBootstrap();

    this.bootstrapLoaded = true;
    console.log(`✅ Bootstrap ontology loaded: ${bootstrapTriples.length} triples`);
  }

  /**
   * Index bootstrap classes in semantic search
   * @private
   */
  async _indexBootstrapClasses() {
    const bootstrapClasses = [
      { uri: 'kg:Continuant', label: 'Continuant' },
      { uri: 'kg:Occurrent', label: 'Occurrent' },
      { uri: 'kg:PhysicalEntity', label: 'Physical Entity' },
      { uri: 'kg:State', label: 'State' },
      { uri: 'kg:Process', label: 'Process' },
      { uri: 'kg:Task', label: 'Task' }
    ];

    for (const cls of bootstrapClasses) {
      // Get descriptions
      const definitionTriples = await this.tripleStore.query(cls.uri, 'skos:definition', null);
      const commentTriples = await this.tripleStore.query(cls.uri, 'rdfs:comment', null);
      const scopeNoteTriples = await this.tripleStore.query(cls.uri, 'skos:scopeNote', null);
      const altLabelTriples = await this.tripleStore.query(cls.uri, 'skos:altLabel', null);

      const definition = definitionTriples[0]?.object?.replace(/^"|"$/g, '') || '';
      const comment = commentTriples[0]?.object?.replace(/^"|"$/g, '') || '';
      const scopeNote = scopeNoteTriples[0]?.object?.replace(/^"|"$/g, '') || '';
      const synonyms = altLabelTriples[0]?.object?.replace(/^"|"$/g, '') || '';

      // Index with 4 perspectives
      const perspectives = [
        { type: 'definition', text: definition ? `${cls.label}: ${definition}` : cls.label },
        { type: 'supertype', text: comment ? `${cls.label}: ${comment}` : cls.label },
        { type: 'usage', text: scopeNote ? `${cls.label}: ${scopeNote}` : cls.label },
        { type: 'synonyms', text: synonyms || cls.label }
      ];

      for (const perspective of perspectives) {
        await this.semanticSearch.insert('ontology-classes', {
          text: perspective.text,
          metadata: {
            classURI: cls.uri,
            label: cls.label,
            perspectiveType: perspective.type,
            isBootstrap: true
          }
        });
      }
    }
  }

  /**
   * Process text incrementally, building ontology sentence-by-sentence
   * Works whether ontology is empty or populated
   *
   * @param {string} text - Text to process
   * @param {Object} options - Processing options
   * @param {string} options.domain - Domain context (default: 'general')
   * @returns {Promise<Object>} - Processing results
   * @returns {boolean} return.success - Whether processing succeeded
   * @returns {Array} return.sentences - Annotated sentences
   * @returns {Object} return.ontologyStats - Statistics about the ontology
   */
  async processText(text, options = {}) {
    const domain = options.domain || 'general';

    // Ensure bootstrap ontology is loaded
    await this.ensureBootstrapLoaded();

    // Break into sentences
    const sentences = this.segmentSentences(text);
    const annotatedSentences = [];

    console.log(`\n🔨 Building ontology from ${sentences.length} sentences\n`);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      console.log(`[${i + 1}/${sentences.length}] Processing: "${sentence}"`);

      // Phase 1: QUERY
      const existingTypes = await this.ontologyQuery.findRelevantTypesForSentence(
        sentence,
        this.llmClient
      );

      const foundCount = existingTypes.filter(t => !t.isGap).length;
      const gapCount = existingTypes.filter(t => t.isGap).length;
      console.log(`  → Found ${foundCount} existing types, ${gapCount} gaps`);

      // Phase 2: GAP ANALYSIS
      const gaps = await this.gapAnalysis.analyzeGaps(sentence, existingTypes);

      console.log(`  → Gaps: ${gaps.missingClasses.length} classes, ${gaps.missingProperties.length} properties`);
      console.log(`  → Can reuse: ${gaps.canReuseFromHierarchy.length} from hierarchy`);

      // Phase 3: DECISION
      for (const candidate of gaps.canReuseFromHierarchy) {
        const decision = await this.specializationDecision.decide(candidate);
        candidate.decision = decision;
      }

      // Phase 4: EXTENSION
      if (gaps.missingClasses.length > 0 ||
          gaps.missingProperties.length > 0 ||
          gaps.missingRelationships.length > 0 ||
          gaps.canReuseFromHierarchy.some(c => c.decision?.action === 'SPECIALIZE')) {

        const extensions = await this.ontologyExtension.extendFromGaps(gaps, domain);

        // Check if extension was rejected by Z3 verification
        if (extensions.success === false) {
          console.warn(`  ⚠️  Extension rejected by Z3 verification`);
          console.warn(`  Violations:`, extensions.violations);
          // Skip this sentence - don't add anything
          continue;
        }

        console.log(`  ✅ Extended: +${extensions.addedClasses} classes, +${extensions.addedProperties} properties`);
        console.log(`  ♻️  Reused: ${extensions.reusedFromHierarchy} inherited concepts`);

        // Verify ontology remains consistent after extension
        await this.verification.verifyAfterExtension();
      }

      // Phase 5: ANNOTATION
      const updatedTypes = await this.ontologyQuery.findRelevantTypesForSentence(
        sentence,
        this.llmClient
      );

      const annotated = this.sentenceAnnotator.annotate(sentence, updatedTypes, domain);
      annotatedSentences.push(annotated);
    }

    console.log(`\n✅ Ontology building complete`);
    console.log(`   Total classes: ${await this.countClasses()}`);
    console.log(`   Total properties: ${await this.countProperties()}`);
    console.log(`   Total relationships: ${await this.countRelationships()}`);

    // Log verification stats
    const verificationStats = this.verification.getStats();
    if (verificationStats.enabled) {
      console.log(`   Verifications run: ${verificationStats.verificationsRun}`);
      console.log(`   Violations detected: ${verificationStats.violationsDetected}`);
      console.log(`   Violations prevented: ${verificationStats.violationsPrevented}`);
    }

    return {
      success: true,
      sentences: annotatedSentences,
      ontologyStats: {
        classes: await this.countClasses(),
        properties: await this.countProperties(),
        relationships: await this.countRelationships()
      },
      verificationStats
    };
  }

  /**
   * Count total classes in ontology
   *
   * @returns {Promise<number>} - Number of owl:Class instances
   */
  async countClasses() {
    const classes = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');
    return classes.length;
  }

  /**
   * Count total datatype properties in ontology
   *
   * @returns {Promise<number>} - Number of owl:DatatypeProperty instances
   */
  async countProperties() {
    const datatypeProps = await this.tripleStore.query(null, 'rdf:type', 'owl:DatatypeProperty');
    return datatypeProps.length;
  }

  /**
   * Count total object properties (relationships) in ontology
   *
   * @returns {Promise<number>} - Number of owl:ObjectProperty instances
   */
  async countRelationships() {
    const objectProps = await this.tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');
    return objectProps.length;
  }

  /**
   * Segment text into sentences
   *
   * @param {string} text - Text to segment
   * @returns {Array<string>} - Array of sentences
   */
  segmentSentences(text) {
    // Simple sentence splitting - splits on punctuation followed by capital letter
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
