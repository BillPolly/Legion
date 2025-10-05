/**
 * OWL Axiom Encoder
 * Converts OWL/RDF axioms to Z3 constraints for formal verification
 *
 * Supported axioms:
 * - owl:disjointWith
 * - rdfs:subClassOf
 * - rdfs:domain / rdfs:range
 * - owl:equivalentClass
 * - owl:inverseOf
 */
export class OWLAxiomEncoder {
  constructor(solver) {
    this.solver = solver;
    this.entitySort = null;
  }

  /**
   * Initialize the encoder with entity sort
   * @param {string} sortName - Name of entity sort (default: "Entity")
   */
  initialize(sortName = 'Entity') {
    this.entitySort = this.solver.declareSort(sortName);
  }

  /**
   * Encode owl:disjointWith axiom
   *
   * OWL: ClassA owl:disjointWith ClassB
   * Meaning: No entity can be both ClassA and ClassB
   * Z3: ∀x. ¬(A(x) ∧ B(x))
   *
   * @param {string} classA - First class name
   * @param {string} classB - Second class name
   * @returns {object} Z3 constraint
   */
  encodeDisjoint(classA, classB) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare concepts
    const conceptA = this.solver.declareConcept(classA, this.entitySort);
    const conceptB = this.solver.declareConcept(classB, this.entitySort);

    // Create bound variable: x
    const x = this.solver.createConst('x', this.entitySort);

    // Build: A(x) ∧ B(x)
    const both = this.solver.And(
      conceptA(x),
      conceptB(x)
    );

    // Build: ¬(A(x) ∧ B(x))
    const notBoth = this.solver.Not(both);

    // Build: ∀x. ¬(A(x) ∧ B(x))
    return this.solver.forall([x], notBoth);
  }

  /**
   * Encode rdfs:subClassOf axiom
   *
   * OWL: ClassA rdfs:subClassOf ClassB
   * Meaning: All instances of ClassA are also instances of ClassB
   * Z3: ∀x. A(x) → B(x)
   *
   * @param {string} subClass - Subclass name
   * @param {string} superClass - Superclass name
   * @returns {object} Z3 constraint
   */
  encodeSubClassOf(subClass, superClass) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare concepts
    const conceptA = this.solver.declareConcept(subClass, this.entitySort);
    const conceptB = this.solver.declareConcept(superClass, this.entitySort);

    // Create bound variable: x
    const x = this.solver.createConst('x', this.entitySort);

    // Build: A(x) → B(x)
    const implication = this.solver.Or(
      this.solver.Not(conceptA(x)),
      conceptB(x)
    );

    // Build: ∀x. A(x) → B(x)
    return this.solver.forall([x], implication);
  }

  /**
   * Encode rdfs:domain axiom
   *
   * OWL: property rdfs:domain Class
   * Meaning: If (x, y) is related by property, then x must be of type Class
   * Z3: ∀x,y. property(x, y) → Class(x)
   *
   * @param {string} property - Property name
   * @param {string} domainClass - Domain class name
   * @returns {object} Z3 constraint
   */
  encodeDomain(property, domainClass) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare relationship and concept
    const rel = this.solver.declareRelationship(property, this.entitySort, this.entitySort);
    const concept = this.solver.declareConcept(domainClass, this.entitySort);

    // Create bound variables: x, y
    const x = this.solver.createConst('x', this.entitySort);
    const y = this.solver.createConst('y', this.entitySort);

    // Build: property(x, y) → Class(x)
    const implication = this.solver.Or(
      this.solver.Not(rel(x, y)),
      concept(x)
    );

    // Build: ∀x,y. property(x, y) → Class(x)
    return this.solver.forall([x, y], implication);
  }

  /**
   * Encode rdfs:range axiom
   *
   * OWL: property rdfs:range Class
   * Meaning: If (x, y) is related by property, then y must be of type Class
   * Z3: ∀x,y. property(x, y) → Class(y)
   *
   * @param {string} property - Property name
   * @param {string} rangeClass - Range class name
   * @returns {object} Z3 constraint
   */
  encodeRange(property, rangeClass) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare relationship and concept
    const rel = this.solver.declareRelationship(property, this.entitySort, this.entitySort);
    const concept = this.solver.declareConcept(rangeClass, this.entitySort);

    // Create bound variables: x, y
    const x = this.solver.createConst('x', this.entitySort);
    const y = this.solver.createConst('y', this.entitySort);

    // Build: property(x, y) → Class(y)
    const implication = this.solver.Or(
      this.solver.Not(rel(x, y)),
      concept(y)
    );

    // Build: ∀x,y. property(x, y) → Class(y)
    return this.solver.forall([x, y], implication);
  }

  /**
   * Encode owl:equivalentClass axiom
   *
   * OWL: ClassA owl:equivalentClass ClassB
   * Meaning: A and B have the same instances
   * Z3: ∀x. A(x) ↔ B(x)  (i.e., A(x) → B(x) ∧ B(x) → A(x))
   *
   * @param {string} classA - First class name
   * @param {string} classB - Second class name
   * @returns {object} Z3 constraint
   */
  encodeEquivalentClass(classA, classB) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare concepts
    const conceptA = this.solver.declareConcept(classA, this.entitySort);
    const conceptB = this.solver.declareConcept(classB, this.entitySort);

    // Create bound variable: x
    const x = this.solver.createConst('x', this.entitySort);

    // Build: A(x) → B(x)
    const forward = this.solver.Or(
      this.solver.Not(conceptA(x)),
      conceptB(x)
    );

    // Build: B(x) → A(x)
    const backward = this.solver.Or(
      this.solver.Not(conceptB(x)),
      conceptA(x)
    );

    // Build: (A(x) → B(x)) ∧ (B(x) → A(x))
    const biconditional = this.solver.And(forward, backward);

    // Build: ∀x. A(x) ↔ B(x)
    return this.solver.forall([x], biconditional);
  }

  /**
   * Encode owl:inverseOf axiom
   *
   * OWL: propertyA owl:inverseOf propertyB
   * Meaning: If A(x,y) then B(y,x) and vice versa
   * Z3: ∀x,y. A(x,y) ↔ B(y,x)
   *
   * @param {string} propertyA - First property name
   * @param {string} propertyB - Second property name
   * @returns {object} Z3 constraint
   */
  encodeInverseOf(propertyA, propertyB) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare relationships
    const relA = this.solver.declareRelationship(propertyA, this.entitySort, this.entitySort);
    const relB = this.solver.declareRelationship(propertyB, this.entitySort, this.entitySort);

    // Create bound variables: x, y
    const x = this.solver.createConst('x', this.entitySort);
    const y = this.solver.createConst('y', this.entitySort);

    // Build: A(x,y) → B(y,x)
    const forward = this.solver.Or(
      this.solver.Not(relA(x, y)),
      relB(y, x)
    );

    // Build: B(y,x) → A(x,y)
    const backward = this.solver.Or(
      this.solver.Not(relB(y, x)),
      relA(x, y)
    );

    // Build: (A(x,y) → B(y,x)) ∧ (B(y,x) → A(x,y))
    const biconditional = this.solver.And(forward, backward);

    // Build: ∀x,y. A(x,y) ↔ B(y,x)
    return this.solver.forall([x, y], biconditional);
  }

  /**
   * Encode fact: entity is instance of class
   *
   * Z3: Class(entity)
   *
   * @param {string} entityName - Entity name
   * @param {string} className - Class name
   * @returns {object} Z3 constraint
   */
  encodeInstanceOf(entityName, className) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare concept and entity constant
    const concept = this.solver.declareConcept(className, this.entitySort);
    const entity = this.solver.createConst(entityName, this.entitySort);

    // Build: Class(entity)
    return concept(entity);
  }

  /**
   * Encode fact: relationship between two entities
   *
   * Z3: property(entity1, entity2)
   *
   * @param {string} entity1 - First entity name
   * @param {string} property - Property name
   * @param {string} entity2 - Second entity name
   * @returns {object} Z3 constraint
   */
  encodeRelation(entity1, property, entity2) {
    if (!this.entitySort) {
      throw new Error('Encoder not initialized - call initialize() first');
    }

    // Declare relationship and entities
    const rel = this.solver.declareRelationship(property, this.entitySort, this.entitySort);
    const e1 = this.solver.createConst(entity1, this.entitySort);
    const e2 = this.solver.createConst(entity2, this.entitySort);

    // Build: property(e1, e2)
    return rel(e1, e2);
  }
}
