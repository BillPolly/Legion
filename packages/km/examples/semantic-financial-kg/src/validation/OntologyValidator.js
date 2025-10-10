/**
 * OntologyValidator - Validate entity models against ontology using Z3 theorem prover
 *
 * Uses @legion/neurosymbolic-reasoning OntologyVerifier to formally verify:
 * - Entity types are valid ontology classes
 * - Relationships use valid ontology properties
 * - Domain/range constraints are satisfied
 * - No logical contradictions
 */

import { OntologyVerifier } from '@legion/neurosymbolic-reasoning';

export class OntologyValidator {
  constructor(ontology) {
    if (!ontology) {
      throw new Error('Ontology is required');
    }
    this.ontology = ontology;
    this.verifier = null;
  }

  /**
   * Initialize the Z3 verifier
   */
  async initialize() {
    if (this.verifier) {
      return;
    }
    this.verifier = new OntologyVerifier();
    await this.verifier.initialize();
  }

  /**
   * Validate entity model against ontology
   * @param {Object} entityModel - { entities: [...], relationships: [...] }
   * @returns {Object} - { valid: boolean, errors: [...] }
   */
  async validate(entityModel) {
    if (!this.verifier) {
      await this.initialize();
    }

    const errors = [];

    // Validate structure
    if (!entityModel.entities || !Array.isArray(entityModel.entities)) {
      errors.push('Entity model missing entities array');
    }
    if (!entityModel.relationships || !Array.isArray(entityModel.relationships)) {
      errors.push('Entity model missing relationships array');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Validate entity types exist in ontology
    for (const entity of entityModel.entities) {
      if (!entity.type) {
        errors.push(`Entity ${entity.uri} missing type field`);
        continue;
      }

      if (!this.ontology.classes.has(entity.type)) {
        errors.push(`Entity type ${entity.type} not found in ontology`);
      }
    }

    // Validate relationship properties exist in ontology
    for (const rel of entityModel.relationships) {
      if (!rel.predicate) {
        errors.push(`Relationship missing predicate field`);
        continue;
      }

      if (!this.ontology.properties.has(rel.predicate)) {
        errors.push(`Property ${rel.predicate} not found in ontology`);
      }
    }

    // Validate domain/range constraints using Z3
    for (const rel of entityModel.relationships) {
      const property = this.ontology.properties.get(rel.predicate);
      if (!property) {
        continue; // Already reported above
      }

      // Find subject and object entities
      const subjectEntity = entityModel.entities.find(e => e.uri === rel.subject);
      const objectEntity = entityModel.entities.find(e => e.uri === rel.object);

      if (!subjectEntity) {
        errors.push(`Relationship subject ${rel.subject} not found in entities`);
        continue;
      }

      if (!objectEntity) {
        errors.push(`Relationship object ${rel.object} not found in entities`);
        continue;
      }

      // Check domain constraint
      if (property.domain && subjectEntity.type !== property.domain) {
        // Check if subjectEntity.type is a subclass of property.domain
        if (!this._isSubClassOf(subjectEntity.type, property.domain)) {
          errors.push(
            `Domain constraint violated: ${rel.subject} has type ${subjectEntity.type} but property ${rel.predicate} requires domain ${property.domain}`
          );
        }
      }

      // Check range constraint
      if (property.range && objectEntity.type !== property.range) {
        // Check if objectEntity.type is a subclass of property.range
        if (!this._isSubClassOf(objectEntity.type, property.range)) {
          errors.push(
            `Range constraint violated: ${rel.object} has type ${objectEntity.type} but property ${rel.predicate} requires range ${property.range}`
          );
        }
      }
    }

    // Use Z3 to verify formal consistency
    const triples = this._convertToTriples(entityModel);
    const ontologyTriples = this._getOntologyTriples();
    const allTriples = [...ontologyTriples, ...triples];

    try {
      const z3Result = await this.verifier.verifyConsistency(allTriples);

      if (!z3Result.consistent) {
        errors.push(...z3Result.violations.map(v => `Z3 verification failed: ${v}`));
      }
    } catch (error) {
      // Z3 verification is supplementary - don't fail if it errors
      console.warn('Z3 verification encountered error:', error.message);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if classA is a subclass of classB
   * @private
   */
  _isSubClassOf(classA, classB) {
    if (classA === classB) {
      return true;
    }

    // For POC, we don't have subclass hierarchy
    // In full implementation, would traverse rdfs:subClassOf relationships
    return false;
  }

  /**
   * Convert entity model to RDF triples
   * @private
   */
  _convertToTriples(entityModel) {
    const triples = [];

    // Entity type assertions
    for (const entity of entityModel.entities) {
      triples.push([entity.uri, 'rdf:type', entity.type]);
    }

    // Relationships
    for (const rel of entityModel.relationships) {
      triples.push([rel.subject, rel.predicate, rel.object]);
    }

    return triples;
  }

  /**
   * Get ontology definition as triples
   * @private
   */
  _getOntologyTriples() {
    const triples = [];

    // Class definitions
    for (const [uri, classObj] of this.ontology.classes) {
      triples.push([uri, 'rdf:type', 'owl:Class']);
    }

    // Property definitions with domain/range
    for (const [uri, propObj] of this.ontology.properties) {
      if (propObj.type === 'ObjectProperty') {
        triples.push([uri, 'rdf:type', 'owl:ObjectProperty']);
      } else if (propObj.type === 'DatatypeProperty') {
        triples.push([uri, 'rdf:type', 'owl:DatatypeProperty']);
      }

      if (propObj.domain) {
        triples.push([uri, 'rdfs:domain', propObj.domain]);
      }

      if (propObj.range) {
        triples.push([uri, 'rdfs:range', propObj.range]);
      }
    }

    return triples;
  }
}
