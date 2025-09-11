/**
 * PropertyTypeDetector Class
 * Part of the unified proxy architecture - Phase 1, Step 1.4
 * 
 * Analyzes schema to determine appropriate proxy type for property access:
 * - StreamProxy: Scalar attributes (string, number, boolean, etc.) and single-value unknown attributes
 * - EntityProxy: Single reference attributes (valueType: 'ref', card: 'one' or missing)
 * - CollectionProxy: Many cardinality attributes (card: 'many') regardless of value type
 * 
 * Used by EntityProxy for dynamic property generation to determine what type
 * of proxy object should be returned when accessing entity properties.
 */

export class PropertyTypeDetector {
  constructor(schema) {
    if (schema === null || schema === undefined) {
      throw new Error('Schema is required');
    }
    
    if (typeof schema !== 'object' || Array.isArray(schema)) {
      throw new Error('Schema must be an object');
    }
    
    this.schema = schema;
  }

  /**
   * Main entry point: Determine proxy type for a given attribute
   * 
   * @param {string} attribute - The attribute name (e.g., ':user/name')
   * @returns {string} - 'StreamProxy', 'EntityProxy', or 'CollectionProxy'
   */
  detectProxyType(attribute) {
    if (attribute === null || attribute === undefined) {
      throw new Error('Attribute name is required');
    }
    
    if (typeof attribute !== 'string') {
      throw new Error('Attribute name must be a string');
    }
    
    if (attribute.trim() === '') {
      throw new Error('Attribute name cannot be empty');
    }
    
    const schemaInfo = this._getSchemaInfo(attribute);
    
    // Many cardinality always returns CollectionProxy regardless of value type
    if (schemaInfo.cardinality === 'many') {
      return 'CollectionProxy';
    }
    
    // Single reference attributes return EntityProxy
    if (schemaInfo.isReference) {
      return 'EntityProxy';
    }
    
    // All scalar attributes (including unknown) return StreamProxy
    return 'StreamProxy';
  }

  /**
   * Check if attribute is a scalar (non-reference) type
   * 
   * @param {string} attribute - The attribute name
   * @returns {boolean} - true if scalar, false if reference
   */
  isScalarAttribute(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return !schemaInfo.isReference;
  }

  /**
   * Check if attribute is a reference type
   * 
   * @param {string} attribute - The attribute name
   * @returns {boolean} - true if reference, false if scalar
   */
  isReferenceAttribute(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return schemaInfo.isReference;
  }

  /**
   * Check if attribute has many cardinality
   * 
   * @param {string} attribute - The attribute name
   * @returns {boolean} - true if many, false if one
   */
  isManyAttribute(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return schemaInfo.cardinality === 'many';
  }

  /**
   * Check if attribute is marked as component
   * 
   * @param {string} attribute - The attribute name
   * @returns {boolean} - true if component, false otherwise
   */
  isComponentAttribute(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return schemaInfo.isComponent;
  }

  /**
   * Check if attribute is marked as unique
   * 
   * @param {string} attribute - The attribute name
   * @returns {boolean} - true if unique, false otherwise
   */
  isUniqueAttribute(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return schemaInfo.isUnique;
  }

  /**
   * Get the value type of an attribute
   * 
   * @param {string} attribute - The attribute name
   * @returns {string} - Value type ('string', 'number', 'boolean', 'ref', etc.)
   */
  getValueType(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return schemaInfo.valueType;
  }

  /**
   * Get the cardinality of an attribute
   * 
   * @param {string} attribute - The attribute name
   * @returns {string} - Cardinality ('one' or 'many')
   */
  getCardinality(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    return schemaInfo.cardinality;
  }

  /**
   * Comprehensive analysis of an attribute
   * 
   * @param {string} attribute - The attribute name
   * @returns {Object} - Complete analysis with all properties
   */
  analyzeAttribute(attribute) {
    const schemaInfo = this._getSchemaInfo(attribute);
    
    return {
      attribute,
      valueType: schemaInfo.valueType,
      cardinality: schemaInfo.cardinality,
      isReference: schemaInfo.isReference,
      isScalar: !schemaInfo.isReference,
      isMany: schemaInfo.cardinality === 'many',
      isUnique: schemaInfo.isUnique,
      isComponent: schemaInfo.isComponent,
      proxyType: this.detectProxyType(attribute)
    };
  }

  /**
   * Extract and normalize schema information for an attribute
   * 
   * @private
   * @param {string} attribute - The attribute name
   * @returns {Object} - Normalized schema information
   */
  _getSchemaInfo(attribute) {
    const rawSchema = this.schema[attribute];
    
    // Handle missing or invalid schema entries
    if (!rawSchema || typeof rawSchema !== 'object' || Array.isArray(rawSchema)) {
      return {
        valueType: 'unknown',
        cardinality: 'one',
        isReference: false,
        isUnique: false,
        isComponent: false
      };
    }
    
    // Extract and normalize values with defaults
    const valueType = rawSchema.valueType || 'unknown';
    const cardinality = rawSchema.card === 'many' ? 'many' : 'one';
    const isReference = valueType === 'ref';
    const isUnique = Boolean(rawSchema.unique);
    const isComponent = Boolean(rawSchema.component);
    
    return {
      valueType,
      cardinality,
      isReference,
      isUnique,
      isComponent
    };
  }
}