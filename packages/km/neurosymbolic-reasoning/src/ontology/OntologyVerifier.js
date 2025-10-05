import { Z3DescriptionLogicSolver } from '../solvers/Z3DescriptionLogicSolver.js';
import { OWLAxiomEncoder } from './OWLAxiomEncoder.js';

/**
 * Ontology Verifier
 * Integrates Z3 theorem proving with @legion/ontology for formal verification
 *
 * Capabilities:
 * - Verify ontology consistency
 * - Check axiom coherence (disjointness, subsumption, domain/range)
 * - Detect contradictions
 * - Validate instance data against schema
 * - Provide formal proof of violations
 */
export class OntologyVerifier {
  constructor() {
    this.solver = null;
    this.encoder = null;
    this.initialized = false;
  }

  /**
   * Initialize the verifier
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    this.solver = new Z3DescriptionLogicSolver();
    await this.solver.initialize();

    this.encoder = new OWLAxiomEncoder(this.solver);
    this.encoder.initialize('Entity');

    this.initialized = true;
  }

  /**
   * Verify ontology consistency
   * Checks if all axioms are mutually satisfiable
   *
   * @param {Array} triples - RDF triples from ontology
   * @returns {Promise<{consistent: boolean, violations: Array, model: object}>}
   */
  async verifyConsistency(triples) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Reset solver for fresh verification
    this.solver.reset();
    this.encoder.initialize('Entity');

    // Create fresh Z3 solver
    const z3Solver = this.solver.createSolver();

    // Encode axioms
    const axioms = this._encodeTriples(triples);

    // Add all axioms to solver
    for (const axiom of axioms) {
      try {
        z3Solver.add(axiom);
      } catch (error) {
        return {
          consistent: false,
          violations: [`Failed to encode axiom: ${error.message}`],
          model: null
        };
      }
    }

    // Check satisfiability
    const result = await z3Solver.check();

    if (result === 'sat') {
      // Consistent - get model
      const model = z3Solver.model();
      return {
        consistent: true,
        violations: [],
        model: this._extractModel(model)
      };
    } else if (result === 'unsat') {
      // Inconsistent - find violating axioms
      const violations = await this._findViolations(triples);
      return {
        consistent: false,
        violations,
        model: null
      };
    } else {
      // Unknown
      return {
        consistent: false,
        violations: ['Z3 returned unknown - may need more time or is undecidable'],
        model: null
      };
    }
  }

  /**
   * Check if adding new triples would violate existing axioms
   *
   * @param {Array} existingTriples - Current ontology triples
   * @param {Array} newTriples - Triples to add
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async checkAddition(existingTriples, newTriples) {
    const allTriples = [...existingTriples, ...newTriples];
    const result = await this.verifyConsistency(allTriples);

    return {
      valid: result.consistent,
      violations: result.violations
    };
  }

  /**
   * Verify domain/range constraints for a relationship
   *
   * @param {string} property - Property name
   * @param {string} domainClass - Expected domain class
   * @param {string} rangeClass - Expected range class
   * @param {Array} instances - Instance triples to verify
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async verifyDomainRange(property, domainClass, rangeClass, instances) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.solver.reset();
    this.encoder.initialize('Entity');

    const z3Solver = this.solver.createSolver();

    // Add domain/range constraints
    const domainAxiom = this.encoder.encodeDomain(property, domainClass);
    const rangeAxiom = this.encoder.encodeRange(property, rangeClass);

    z3Solver.add(domainAxiom);
    z3Solver.add(rangeAxiom);

    // Add instance facts
    for (const [subject, predicate, object] of instances) {
      if (predicate === property) {
        const fact = this.encoder.encodeRelation(subject, property, object);
        z3Solver.add(fact);
      }
    }

    // Check satisfiability
    const result = await z3Solver.check();

    if (result === 'sat') {
      return {
        valid: true,
        violations: []
      };
    } else {
      return {
        valid: false,
        violations: [`Domain/range constraint violated for property ${property}`]
      };
    }
  }

  /**
   * Verify disjointness constraint
   *
   * @param {string} classA - First class
   * @param {string} classB - Second class
   * @param {Array} instances - Instance triples to check
   * @returns {Promise<{valid: boolean, violations: Array}>}
   */
  async verifyDisjoint(classA, classB, instances) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.solver.reset();
    this.encoder.initialize('Entity');

    const z3Solver = this.solver.createSolver();

    // Add disjointness axiom
    const disjointAxiom = this.encoder.encodeDisjoint(classA, classB);
    z3Solver.add(disjointAxiom);

    // Add instance facts
    const violations = [];

    for (const [subject, predicate, object] of instances) {
      if (predicate === 'rdf:type') {
        if (object === classA || object === classB) {
          const fact = this.encoder.encodeInstanceOf(subject, object);
          z3Solver.add(fact);
        }
      }
    }

    // Check satisfiability
    const result = await z3Solver.check();

    if (result === 'unsat') {
      // Found entity that's both classA and classB
      violations.push(`Found entity that is both ${classA} and ${classB}, violating disjointness`);
      return {
        valid: false,
        violations
      };
    }

    return {
      valid: true,
      violations: []
    };
  }

  /**
   * Encode RDF triples to Z3 constraints
   * @private
   */
  _encodeTriples(triples) {
    const axioms = [];

    for (const [subject, predicate, object] of triples) {
      try {
        // owl:disjointWith
        if (predicate === 'owl:disjointWith') {
          axioms.push(this.encoder.encodeDisjoint(subject, object));
        }

        // rdfs:subClassOf
        else if (predicate === 'rdfs:subClassOf') {
          axioms.push(this.encoder.encodeSubClassOf(subject, object));
        }

        // rdfs:domain
        else if (predicate === 'rdfs:domain') {
          // Need to find the property - this triple is: [property, rdfs:domain, class]
          // But in the triple format, subject is the property
          // This is a bit awkward - may need to collect properties first
          // For now, skip and handle in a second pass
        }

        // rdfs:range
        else if (predicate === 'rdfs:range') {
          // Same as domain - handle in second pass
        }

        // owl:equivalentClass
        else if (predicate === 'owl:equivalentClass') {
          axioms.push(this.encoder.encodeEquivalentClass(subject, object));
        }

        // owl:inverseOf
        else if (predicate === 'owl:inverseOf') {
          axioms.push(this.encoder.encodeInverseOf(subject, object));
        }

        // rdf:type (instance assertion)
        else if (predicate === 'rdf:type' && object !== 'owl:Class') {
          axioms.push(this.encoder.encodeInstanceOf(subject, object));
        }

        // Other predicates (relationships)
        else if (!predicate.startsWith('rdfs:') && !predicate.startsWith('owl:') && !predicate.startsWith('rdf:')) {
          axioms.push(this.encoder.encodeRelation(subject, predicate, object));
        }
      } catch (error) {
        // Skip axioms that fail to encode
        console.warn(`Warning: Failed to encode triple [${subject}, ${predicate}, ${object}]: ${error.message}`);
      }
    }

    // Second pass: handle domain/range
    const propertyDomains = new Map();
    const propertyRanges = new Map();

    for (const [subject, predicate, object] of triples) {
      if (predicate === 'rdfs:domain') {
        propertyDomains.set(subject, object);
      }
      if (predicate === 'rdfs:range') {
        propertyRanges.set(subject, object);
      }
    }

    for (const [property, domain] of propertyDomains) {
      try {
        axioms.push(this.encoder.encodeDomain(property, domain));
      } catch (error) {
        console.warn(`Warning: Failed to encode domain for ${property}: ${error.message}`);
      }
    }

    for (const [property, range] of propertyRanges) {
      try {
        axioms.push(this.encoder.encodeRange(property, range));
      } catch (error) {
        console.warn(`Warning: Failed to encode range for ${property}: ${error.message}`);
      }
    }

    return axioms;
  }

  /**
   * Find which axioms are causing the inconsistency
   * @private
   */
  async _findViolations(triples) {
    // Simple approach: try removing axioms one by one
    // More sophisticated: use unsat core

    const violations = [];

    // Try to identify problematic triples
    for (let i = 0; i < triples.length; i++) {
      const withoutTriple = triples.filter((_, index) => index !== i);
      const result = await this.verifyConsistency(withoutTriple);

      if (result.consistent) {
        const [s, p, o] = triples[i];
        violations.push(`Removing triple [${s}, ${p}, ${o}] makes ontology consistent`);
      }
    }

    if (violations.length === 0) {
      violations.push('Ontology is inconsistent but could not identify specific violation');
    }

    return violations;
  }

  /**
   * Extract variable assignments from Z3 model
   * @private
   */
  _extractModel(model) {
    // This would require introspection of the model
    // For now, return a placeholder
    return {
      message: 'Model extraction not yet implemented'
    };
  }

  /**
   * Get detailed proof of why axioms hold or don't hold
   *
   * @param {Array} triples - RDF triples
   * @returns {Promise<object>} Proof object
   */
  async getProof(triples) {
    const result = await this.verifyConsistency(triples);

    return {
      consistent: result.consistent,
      proof: result.consistent
        ? 'All axioms are satisfiable together (SAT)'
        : 'Axioms are mutually contradictory (UNSAT)',
      violations: result.violations
    };
  }
}
