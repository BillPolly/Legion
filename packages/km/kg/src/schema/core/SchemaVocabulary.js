/**
 * Schema Vocabulary - Defines the KG ontology for schema representation
 * 
 * This class provides the vocabulary (ontology) for representing schemas
 * as knowledge graph triples. It defines all the predicates, types, and
 * constraints used in the schema validation system.
 */

export class SchemaVocabulary {
  constructor(kgEngine) {
    this.kg = kgEngine;
    this.initialized = false;
  }

  /**
   * Initialize the schema vocabulary in the knowledge graph
   * This adds all the core ontological triples for schema representation
   */
  async initialize() {
    if (this.initialized) return;

    const vocabularyTriples = this.getVocabularyTriples();
    
    // Add all vocabulary triples to the KG
    if (this.kg.addTriples) {
      await this.kg.addTriples(vocabularyTriples);
    } else {
      // Fallback for synchronous API
      vocabularyTriples.forEach(([s, p, o]) => {
        this.kg.addTriple(s, p, o);
      });
    }

    this.initialized = true;
  }

  /**
   * Get all vocabulary triples that define the schema ontology
   * @returns {Array<Array>} Array of [subject, predicate, object] triples
   */
  getVocabularyTriples() {
    return [
      // Core schema types
      ...this.getCoreTypes(),
      
      // Data types
      ...this.getDataTypes(),
      
      // Schema properties
      ...this.getSchemaProperties(),
      
      // Constraint properties
      ...this.getConstraintProperties(),
      
      // Schema composition properties
      ...this.getCompositionProperties(),
      
      // Validation properties
      ...this.getValidationProperties()
    ];
  }

  /**
   * Core schema types and classes
   */
  getCoreTypes() {
    return [
      // Meta-level classes
      ['kg:Schema', 'rdf:type', 'rdfs:Class'],
      ['kg:Property', 'rdf:type', 'rdfs:Class'],
      ['kg:Constraint', 'rdf:type', 'rdfs:Class'],
      ['kg:DataType', 'rdf:type', 'rdfs:Class'],
      ['kg:ValidationResult', 'rdf:type', 'rdfs:Class'],
      ['kg:ValidationError', 'rdf:type', 'rdfs:Class'],

      // Schema type hierarchy
      ['kg:Schema', 'rdfs:subClassOf', 'rdfs:Resource'],
      ['kg:Property', 'rdfs:subClassOf', 'rdfs:Resource'],
      ['kg:Constraint', 'rdfs:subClassOf', 'rdfs:Resource'],

      // Schema format types
      ['kg:JSONSchema', 'rdf:type', 'rdfs:Class'],
      ['kg:JSONSchema', 'rdfs:subClassOf', 'kg:Schema'],
      ['kg:TypeScriptInterface', 'rdf:type', 'rdfs:Class'],
      ['kg:TypeScriptInterface', 'rdfs:subClassOf', 'kg:Schema'],
      ['kg:OpenAPISchema', 'rdf:type', 'rdfs:Class'],
      ['kg:OpenAPISchema', 'rdfs:subClassOf', 'kg:Schema']
    ];
  }

  /**
   * Data type definitions
   */
  getDataTypes() {
    return [
      // Primitive data types
      ['kg:StringType', 'rdf:type', 'kg:DataType'],
      ['kg:NumberType', 'rdf:type', 'kg:DataType'],
      ['kg:IntegerType', 'rdf:type', 'kg:DataType'],
      ['kg:BooleanType', 'rdf:type', 'kg:DataType'],
      ['kg:NullType', 'rdf:type', 'kg:DataType'],

      // Complex data types
      ['kg:ObjectType', 'rdf:type', 'kg:DataType'],
      ['kg:ArrayType', 'rdf:type', 'kg:DataType'],

      // Type hierarchy
      ['kg:IntegerType', 'rdfs:subClassOf', 'kg:NumberType'],

      // Type labels
      ['kg:StringType', 'rdfs:label', 'String'],
      ['kg:NumberType', 'rdfs:label', 'Number'],
      ['kg:IntegerType', 'rdfs:label', 'Integer'],
      ['kg:BooleanType', 'rdfs:label', 'Boolean'],
      ['kg:NullType', 'rdfs:label', 'Null'],
      ['kg:ObjectType', 'rdfs:label', 'Object'],
      ['kg:ArrayType', 'rdfs:label', 'Array']
    ];
  }

  /**
   * Schema structure properties
   */
  getSchemaProperties() {
    return [
      // Schema structure
      ['kg:hasProperty', 'rdf:type', 'rdf:Property'],
      ['kg:hasProperty', 'rdfs:domain', 'kg:Schema'],
      ['kg:hasProperty', 'rdfs:range', 'kg:Property'],
      ['kg:hasProperty', 'rdfs:label', 'has property'],

      ['kg:propertyName', 'rdf:type', 'rdf:Property'],
      ['kg:propertyName', 'rdfs:domain', 'kg:Property'],
      ['kg:propertyName', 'rdfs:range', 'xsd:string'],
      ['kg:propertyName', 'rdfs:label', 'property name'],

      ['kg:dataType', 'rdf:type', 'rdf:Property'],
      ['kg:dataType', 'rdfs:domain', 'kg:Property'],
      ['kg:dataType', 'rdfs:range', 'kg:DataType'],
      ['kg:dataType', 'rdfs:label', 'data type'],

      ['kg:schemaType', 'rdf:type', 'rdf:Property'],
      ['kg:schemaType', 'rdfs:domain', 'kg:Schema'],
      ['kg:schemaType', 'rdfs:range', 'kg:DataType'],
      ['kg:schemaType', 'rdfs:label', 'schema type'],

      ['kg:required', 'rdf:type', 'rdf:Property'],
      ['kg:required', 'rdfs:domain', 'kg:Property'],
      ['kg:required', 'rdfs:range', 'xsd:boolean'],
      ['kg:required', 'rdfs:label', 'required'],

      ['kg:additionalProperties', 'rdf:type', 'rdf:Property'],
      ['kg:additionalProperties', 'rdfs:domain', 'kg:Schema'],
      ['kg:additionalProperties', 'rdfs:range', 'xsd:boolean'],
      ['kg:additionalProperties', 'rdfs:label', 'additional properties']
    ];
  }

  /**
   * Constraint properties for validation
   */
  getConstraintProperties() {
    return [
      // String constraints
      ['kg:minLength', 'rdf:type', 'rdf:Property'],
      ['kg:minLength', 'rdfs:domain', 'kg:Property'],
      ['kg:minLength', 'rdfs:range', 'xsd:nonNegativeInteger'],
      ['kg:minLength', 'rdfs:label', 'minimum length'],

      ['kg:maxLength', 'rdf:type', 'rdf:Property'],
      ['kg:maxLength', 'rdfs:domain', 'kg:Property'],
      ['kg:maxLength', 'rdfs:range', 'xsd:nonNegativeInteger'],
      ['kg:maxLength', 'rdfs:label', 'maximum length'],

      ['kg:pattern', 'rdf:type', 'rdf:Property'],
      ['kg:pattern', 'rdfs:domain', 'kg:Property'],
      ['kg:pattern', 'rdfs:range', 'xsd:string'],
      ['kg:pattern', 'rdfs:label', 'pattern'],

      ['kg:format', 'rdf:type', 'rdf:Property'],
      ['kg:format', 'rdfs:domain', 'kg:Property'],
      ['kg:format', 'rdfs:range', 'xsd:string'],
      ['kg:format', 'rdfs:label', 'format'],

      // Numeric constraints
      ['kg:minimum', 'rdf:type', 'rdf:Property'],
      ['kg:minimum', 'rdfs:domain', 'kg:Property'],
      ['kg:minimum', 'rdfs:range', 'xsd:decimal'],
      ['kg:minimum', 'rdfs:label', 'minimum'],

      ['kg:maximum', 'rdf:type', 'rdf:Property'],
      ['kg:maximum', 'rdfs:domain', 'kg:Property'],
      ['kg:maximum', 'rdfs:range', 'xsd:decimal'],
      ['kg:maximum', 'rdfs:label', 'maximum'],

      ['kg:exclusiveMinimum', 'rdf:type', 'rdf:Property'],
      ['kg:exclusiveMinimum', 'rdfs:domain', 'kg:Property'],
      ['kg:exclusiveMinimum', 'rdfs:range', 'xsd:decimal'],
      ['kg:exclusiveMinimum', 'rdfs:label', 'exclusive minimum'],

      ['kg:exclusiveMaximum', 'rdf:type', 'rdf:Property'],
      ['kg:exclusiveMaximum', 'rdfs:domain', 'kg:Property'],
      ['kg:exclusiveMaximum', 'rdfs:range', 'xsd:decimal'],
      ['kg:exclusiveMaximum', 'rdfs:label', 'exclusive maximum'],

      ['kg:multipleOf', 'rdf:type', 'rdf:Property'],
      ['kg:multipleOf', 'rdfs:domain', 'kg:Property'],
      ['kg:multipleOf', 'rdfs:range', 'xsd:decimal'],
      ['kg:multipleOf', 'rdfs:label', 'multiple of'],

      // Array constraints
      ['kg:minItems', 'rdf:type', 'rdf:Property'],
      ['kg:minItems', 'rdfs:domain', 'kg:Property'],
      ['kg:minItems', 'rdfs:range', 'xsd:nonNegativeInteger'],
      ['kg:minItems', 'rdfs:label', 'minimum items'],

      ['kg:maxItems', 'rdf:type', 'rdf:Property'],
      ['kg:maxItems', 'rdfs:domain', 'kg:Property'],
      ['kg:maxItems', 'rdfs:range', 'xsd:nonNegativeInteger'],
      ['kg:maxItems', 'rdfs:label', 'maximum items'],

      ['kg:uniqueItems', 'rdf:type', 'rdf:Property'],
      ['kg:uniqueItems', 'rdfs:domain', 'kg:Property'],
      ['kg:uniqueItems', 'rdfs:range', 'xsd:boolean'],
      ['kg:uniqueItems', 'rdfs:label', 'unique items'],

      ['kg:items', 'rdf:type', 'rdf:Property'],
      ['kg:items', 'rdfs:domain', 'kg:Property'],
      ['kg:items', 'rdfs:range', 'kg:Schema'],
      ['kg:items', 'rdfs:label', 'items schema'],

      // Object constraints
      ['kg:minProperties', 'rdf:type', 'rdf:Property'],
      ['kg:minProperties', 'rdfs:domain', 'kg:Schema'],
      ['kg:minProperties', 'rdfs:range', 'xsd:nonNegativeInteger'],
      ['kg:minProperties', 'rdfs:label', 'minimum properties'],

      ['kg:maxProperties', 'rdf:type', 'rdf:Property'],
      ['kg:maxProperties', 'rdfs:domain', 'kg:Schema'],
      ['kg:maxProperties', 'rdfs:range', 'xsd:nonNegativeInteger'],
      ['kg:maxProperties', 'rdfs:label', 'maximum properties'],

      // Enumeration constraint
      ['kg:enum', 'rdf:type', 'rdf:Property'],
      ['kg:enum', 'rdfs:domain', 'kg:Property'],
      ['kg:enum', 'rdfs:range', 'rdf:List'],
      ['kg:enum', 'rdfs:label', 'enumeration']
    ];
  }

  /**
   * Schema composition properties (allOf, oneOf, anyOf, not)
   */
  getCompositionProperties() {
    return [
      ['kg:allOf', 'rdf:type', 'rdf:Property'],
      ['kg:allOf', 'rdfs:domain', 'kg:Schema'],
      ['kg:allOf', 'rdfs:range', 'rdf:List'],
      ['kg:allOf', 'rdfs:label', 'all of'],

      ['kg:oneOf', 'rdf:type', 'rdf:Property'],
      ['kg:oneOf', 'rdfs:domain', 'kg:Schema'],
      ['kg:oneOf', 'rdfs:range', 'rdf:List'],
      ['kg:oneOf', 'rdfs:label', 'one of'],

      ['kg:anyOf', 'rdf:type', 'rdf:Property'],
      ['kg:anyOf', 'rdfs:domain', 'kg:Schema'],
      ['kg:anyOf', 'rdfs:range', 'rdf:List'],
      ['kg:anyOf', 'rdfs:label', 'any of'],

      ['kg:not', 'rdf:type', 'rdf:Property'],
      ['kg:not', 'rdfs:domain', 'kg:Schema'],
      ['kg:not', 'rdfs:range', 'kg:Schema'],
      ['kg:not', 'rdfs:label', 'not'],

      // Conditional schemas
      ['kg:if', 'rdf:type', 'rdf:Property'],
      ['kg:if', 'rdfs:domain', 'kg:Schema'],
      ['kg:if', 'rdfs:range', 'kg:Schema'],
      ['kg:if', 'rdfs:label', 'if'],

      ['kg:then', 'rdf:type', 'rdf:Property'],
      ['kg:then', 'rdfs:domain', 'kg:Schema'],
      ['kg:then', 'rdfs:range', 'kg:Schema'],
      ['kg:then', 'rdfs:label', 'then'],

      ['kg:else', 'rdf:type', 'rdf:Property'],
      ['kg:else', 'rdfs:domain', 'kg:Schema'],
      ['kg:else', 'rdfs:range', 'kg:Schema'],
      ['kg:else', 'rdfs:label', 'else']
    ];
  }

  /**
   * Validation result properties
   */
  getValidationProperties() {
    return [
      ['kg:validationResult', 'rdf:type', 'rdf:Property'],
      ['kg:validationResult', 'rdfs:domain', 'rdfs:Resource'],
      ['kg:validationResult', 'rdfs:range', 'kg:ValidationResult'],
      ['kg:validationResult', 'rdfs:label', 'validation result'],

      ['kg:isValid', 'rdf:type', 'rdf:Property'],
      ['kg:isValid', 'rdfs:domain', 'kg:ValidationResult'],
      ['kg:isValid', 'rdfs:range', 'xsd:boolean'],
      ['kg:isValid', 'rdfs:label', 'is valid'],

      ['kg:conformanceScore', 'rdf:type', 'rdf:Property'],
      ['kg:conformanceScore', 'rdfs:domain', 'kg:ValidationResult'],
      ['kg:conformanceScore', 'rdfs:range', 'xsd:decimal'],
      ['kg:conformanceScore', 'rdfs:label', 'conformance score'],

      ['kg:hasError', 'rdf:type', 'rdf:Property'],
      ['kg:hasError', 'rdfs:domain', 'kg:ValidationResult'],
      ['kg:hasError', 'rdfs:range', 'kg:ValidationError'],
      ['kg:hasError', 'rdfs:label', 'has error'],

      ['kg:errorType', 'rdf:type', 'rdf:Property'],
      ['kg:errorType', 'rdfs:domain', 'kg:ValidationError'],
      ['kg:errorType', 'rdfs:range', 'xsd:string'],
      ['kg:errorType', 'rdfs:label', 'error type'],

      ['kg:errorPath', 'rdf:type', 'rdf:Property'],
      ['kg:errorPath', 'rdfs:domain', 'kg:ValidationError'],
      ['kg:errorPath', 'rdfs:range', 'xsd:string'],
      ['kg:errorPath', 'rdfs:label', 'error path'],

      ['kg:errorMessage', 'rdf:type', 'rdf:Property'],
      ['kg:errorMessage', 'rdfs:domain', 'kg:ValidationError'],
      ['kg:errorMessage', 'rdfs:range', 'xsd:string'],
      ['kg:errorMessage', 'rdfs:label', 'error message'],

      ['kg:expectedValue', 'rdf:type', 'rdf:Property'],
      ['kg:expectedValue', 'rdfs:domain', 'kg:ValidationError'],
      ['kg:expectedValue', 'rdfs:range', 'rdfs:Literal'],
      ['kg:expectedValue', 'rdfs:label', 'expected value'],

      ['kg:actualValue', 'rdf:type', 'rdf:Property'],
      ['kg:actualValue', 'rdfs:domain', 'kg:ValidationError'],
      ['kg:actualValue', 'rdfs:range', 'rdfs:Literal'],
      ['kg:actualValue', 'rdfs:label', 'actual value']
    ];
  }

  /**
   * Get the namespace prefixes used in the vocabulary
   */
  getNamespacePrefixes() {
    return {
      'kg': 'http://example.org/kg#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'xsd': 'http://www.w3.org/2001/XMLSchema#'
    };
  }

  /**
   * Check if the vocabulary has been initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get a specific vocabulary term by name
   */
  getTerm(termName) {
    const prefixes = this.getNamespacePrefixes();
    
    if (termName.includes(':')) {
      const [prefix, localName] = termName.split(':');
      if (prefixes[prefix]) {
        return `${prefixes[prefix]}${localName}`;
      }
    }
    
    return `${prefixes.kg}${termName}`;
  }

  /**
   * Validate that all required vocabulary terms exist in the KG
   */
  async validateVocabulary() {
    const requiredTerms = [
      'kg:Schema',
      'kg:Property',
      'kg:StringType',
      'kg:NumberType',
      'kg:hasProperty',
      'kg:propertyName',
      'kg:dataType',
      'kg:required'
    ];

    const missingTerms = [];

    for (const term of requiredTerms) {
      const exists = await this.kg.exists(term, 'rdf:type', null);
      if (!exists) {
        missingTerms.push(term);
      }
    }

    if (missingTerms.length > 0) {
      throw new Error(`Missing vocabulary terms: ${missingTerms.join(', ')}`);
    }

    return true;
  }
}

export default SchemaVocabulary;
