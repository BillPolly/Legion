/**
 * Ontology Verification Service
 *
 * Integrates Z3 theorem proving into OntologyBuilder workflow
 * Provides formal verification at key checkpoints:
 * 1. Bootstrap load - verify foundational axioms
 * 2. Pre-extension - check if new additions would violate existing axioms
 * 3. Post-extension - verify ontology remains consistent
 * 4. Periodic - full consistency check
 */

import { OntologyVerifier } from '@legion/neurosymbolic-reasoning';

export class OntologyVerificationService {
  constructor(tripleStore, config = {}) {
    this.tripleStore = tripleStore;
    this.config = {
      enabled: config.enabled !== false,  // Enabled by default
      verifyBootstrap: config.verifyBootstrap !== false,
      verifyBeforeExtension: config.verifyBeforeExtension !== false,
      verifyAfterExtension: config.verifyAfterExtension !== false,
      failOnViolation: config.failOnViolation !== false,  // Fail fast by default
      ...config
    };

    this.verifier = null;
    this.initialized = false;
    this.stats = {
      verificationsRun: 0,
      violationsDetected: 0,
      violationsPrevented: 0
    };
  }

  /**
   * Initialize the Z3 verifier
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('⚠️  Ontology verification disabled');
      return;
    }

    if (this.initialized) {
      return;
    }

    console.log('🔐 Initializing Z3 ontology verifier...');
    this.verifier = new OntologyVerifier();
    await this.verifier.initialize();
    this.initialized = true;
    console.log('✅ Z3 verifier ready');
  }

  /**
   * Verify bootstrap ontology after loading
   *
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async verifyBootstrap() {
    if (!this.config.enabled || !this.config.verifyBootstrap) {
      return { valid: true, violations: [] };
    }

    console.log('\n🔐 Verifying bootstrap ontology with Z3...');

    // Get all axiom triples from triple store
    const axiomTriples = await this._getAxiomTriples();

    const result = await this.verifier.verifyConsistency(axiomTriples);

    this.stats.verificationsRun++;

    if (result.consistent) {
      console.log('✅ Bootstrap ontology is formally consistent');
      return { valid: true, violations: [] };
    } else {
      console.error('❌ Bootstrap ontology has logical contradictions!');
      console.error('Violations:', result.violations);
      this.stats.violationsDetected++;

      if (this.config.failOnViolation) {
        throw new Error(`Bootstrap ontology verification failed: ${result.violations.join(', ')}`);
      }

      return { valid: false, violations: result.violations };
    }
  }

  /**
   * Verify that proposed additions won't violate existing axioms
   *
   * @param {Array} newTriples - Triples to be added
   * @returns {Promise<{valid: boolean, violations: Array, canProceed: boolean}>}
   */
  async verifyBeforeExtension(newTriples) {
    if (!this.config.enabled || !this.config.verifyBeforeExtension) {
      return { valid: true, violations: [], canProceed: true };
    }

    console.log(`🔐 Verifying ${newTriples.length} new triples with Z3...`);

    // Get existing axioms
    const existingTriples = await this._getAxiomTriples();

    // Check if adding new triples would violate axioms
    const result = await this.verifier.checkAddition(existingTriples, newTriples);

    this.stats.verificationsRun++;

    if (result.valid) {
      console.log('✅ New additions are logically consistent');
      return { valid: true, violations: [], canProceed: true };
    } else {
      console.warn('⚠️  New additions would violate existing axioms!');
      console.warn('Violations:', result.violations);
      this.stats.violationsDetected++;
      this.stats.violationsPrevented++;

      if (this.config.failOnViolation) {
        throw new Error(`Pre-extension verification failed: ${result.violations.join(', ')}`);
      }

      return { valid: false, violations: result.violations, canProceed: false };
    }
  }

  /**
   * Verify ontology after extension
   *
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async verifyAfterExtension() {
    if (!this.config.enabled || !this.config.verifyAfterExtension) {
      return { valid: true, violations: [] };
    }

    console.log('🔐 Verifying ontology after extension...');

    const axiomTriples = await this._getAxiomTriples();
    const result = await this.verifier.verifyConsistency(axiomTriples);

    this.stats.verificationsRun++;

    if (result.consistent) {
      console.log('✅ Ontology remains consistent after extension');
      return { valid: true, violations: [] };
    } else {
      console.error('❌ Ontology has become inconsistent!');
      console.error('Violations:', result.violations);
      this.stats.violationsDetected++;

      if (this.config.failOnViolation) {
        throw new Error(`Post-extension verification failed: ${result.violations.join(', ')}`);
      }

      return { valid: false, violations: result.violations };
    }
  }

  /**
   * Verify specific disjointness constraint
   *
   * @param {string} classA - First class
   * @param {string} classB - Second class
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async verifyDisjoint(classA, classB) {
    if (!this.config.enabled) {
      return { valid: true, violations: [] };
    }

    // Get instances of both classes
    const instancesA = await this.tripleStore.query(null, 'rdf:type', classA);
    const instancesB = await this.tripleStore.query(null, 'rdf:type', classB);

    const instances = [
      ...instancesA.map(t => [t.subject, 'rdf:type', classA]),
      ...instancesB.map(t => [t.subject, 'rdf:type', classB])
    ];

    const result = await this.verifier.verifyDisjoint(classA, classB, instances);

    this.stats.verificationsRun++;

    if (!result.valid) {
      this.stats.violationsDetected++;
    }

    return result;
  }

  /**
   * Verify domain/range constraints for a property
   *
   * @param {string} property - Property URI
   * @param {string} domain - Expected domain class
   * @param {string} range - Expected range class
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async verifyDomainRange(property, domain, range) {
    if (!this.config.enabled) {
      return { valid: true, violations: [] };
    }

    // Get all uses of the property
    const propertyTriples = await this.tripleStore.query(null, property, null);

    const instances = propertyTriples.map(t => [t.subject, property, t.object]);

    const result = await this.verifier.verifyDomainRange(property, domain, range, instances);

    this.stats.verificationsRun++;

    if (!result.valid) {
      this.stats.violationsDetected++;
    }

    return result;
  }

  /**
   * Get verification statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      enabled: this.config.enabled
    };
  }

  /**
   * Get all axiom triples from triple store
   * @private
   */
  async _getAxiomTriples() {
    const axiomPredicates = [
      'rdf:type',
      'rdfs:subClassOf',
      'owl:disjointWith',
      'rdfs:domain',
      'rdfs:range',
      'owl:equivalentClass',
      'owl:inverseOf'
    ];

    const triples = [];

    for (const predicate of axiomPredicates) {
      const results = await this.tripleStore.query(null, predicate, null);
      for (const result of results) {
        // Filter out annotation properties (labels, comments, etc.)
        if (result.predicate === 'rdf:type' && result.object !== 'owl:Class') {
          continue;
        }
        triples.push([result.subject, result.predicate, result.object]);
      }
    }

    return triples;
  }

  /**
   * Retry LLM generation with Z3 feedback
   *
   * This is called when the LLM generates an extension that violates axioms.
   * We provide the violation feedback to the LLM and ask it to try again.
   *
   * @param {Function} generationFn - LLM generation function
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Result from successful generation
   */
  async retryWithFeedback(generationFn, maxRetries = 3) {
    if (!this.config.enabled) {
      return await generationFn();
    }

    let lastViolations = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n🔄 LLM generation attempt ${attempt}/${maxRetries}`);

      // Call LLM generation function with feedback from previous attempt
      const result = await generationFn(lastViolations);

      // Verify the generated triples
      const verification = await this.verifyBeforeExtension(result.triples || []);

      if (verification.valid) {
        console.log('✅ LLM generated valid extension');
        return result;
      }

      console.warn(`⚠️  LLM generation violated axioms (attempt ${attempt}/${maxRetries})`);
      console.warn('Violations:', verification.violations);
      lastViolations = verification.violations;

      if (attempt === maxRetries) {
        throw new Error(`LLM failed to generate valid extension after ${maxRetries} attempts. Last violations: ${lastViolations.join(', ')}`);
      }
    }
  }
}
