/**
 * TypeHandle - Smalltalk-style introspection handle for handle types
 * 
 * Provides complete introspection capabilities for handle types including
 * methods, attributes, documentation, and compatibility checking.
 * Extends Actor for remote introspection support.
 */

import { Actor } from '@legion/actors';

export class TypeHandle extends Actor {
  constructor(typeName, metadata) {
    super();
    
    this.name = typeName;
    this.methods = metadata.methods || {};
    this.attributes = metadata.attributes || {};
    this.documentation = metadata.documentation || {};
    this.version = metadata.version || '1.0.0';
  }

  /**
   * List all method names (Smalltalk-style)
   * @returns {Array<string>} Array of method names
   */
  listMethods() {
    return Object.keys(this.methods);
  }

  /**
   * List all attribute names (Smalltalk-style)
   * @returns {Array<string>} Array of attribute names
   */
  listAttributes() {
    return Object.keys(this.attributes);
  }

  /**
   * Get method signature and metadata
   * @param {string} methodName - Name of the method
   * @returns {Object|undefined} Method signature or undefined if not found
   */
  getMethodSignature(methodName) {
    return this.methods[methodName];
  }

  /**
   * Get attribute type information
   * @param {string} attrName - Name of the attribute
   * @returns {Object|undefined} Attribute type info or undefined if not found
   */
  getAttributeType(attrName) {
    return this.attributes[attrName];
  }

  /**
   * Get documentation for method or type
   * @param {string} item - Method name, or undefined for type documentation
   * @returns {string|Object} Documentation string or documentation object
   */
  getDocumentation(item) {
    if (!item) {
      return this.documentation;
    }
    
    const methodSig = this.methods[item];
    return methodSig?.documentation;
  }

  /**
   * Check if this type responds to a method (Smalltalk-style)
   * @param {string} methodName - Method name to check
   * @returns {boolean} True if method exists
   */
  respondsTo(methodName) {
    return this.methods.hasOwnProperty(methodName);
  }

  /**
   * Check compatibility with another type
   * @param {TypeHandle} otherType - Other type to check compatibility with
   * @returns {boolean} True if types have overlapping interface
   */
  isCompatibleWith(otherType) {
    if (!otherType || !otherType.methods) {
      return false;
    }

    // Check if there are any overlapping methods
    const thisMethods = Object.keys(this.methods);
    const otherMethods = Object.keys(otherType.methods);
    
    return thisMethods.some(method => otherMethods.includes(method));
  }

  /**
   * Get complete metadata object
   * @returns {Object} Complete type metadata
   */
  getMetadata() {
    return {
      methods: this.methods,
      attributes: this.attributes,
      documentation: this.documentation,
      version: this.version
    };
  }

  /**
   * Get version information
   * @returns {string} Version string
   */
  getVersion() {
    return this.version;
  }

  /**
   * Get type description
   * @returns {string} Type description
   */
  getDescription() {
    return this.documentation.description || `${this.name} handle type`;
  }

  /**
   * Get usage examples
   * @returns {Array<string>} Usage examples
   */
  getExamples() {
    return this.documentation.examples || [];
  }

  /**
   * Actor message handler for remote introspection
   * @param {string} messageType - Type of message
   * @param {Object} data - Message data
   */
  async receive(messageType, data) {
    switch (messageType) {
      case 'list-methods':
        return this.listMethods();
        
      case 'list-attributes':
        return this.listAttributes();
        
      case 'get-method-signature':
        return this.getMethodSignature(data.method);
        
      case 'get-attribute-type':
        return this.getAttributeType(data.attribute);
        
      case 'get-documentation':
        return this.getDocumentation(data.item);
        
      case 'responds-to':
        return this.respondsTo(data.method);
        
      case 'get-metadata':
        return this.getMetadata();
        
      default:
        // Delegate to parent Actor class
        return await super.receive(messageType, data);
    }
  }
}