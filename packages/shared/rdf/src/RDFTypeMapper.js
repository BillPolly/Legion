/**
 * Type mapping between JavaScript types and RDF literals
 * 
 * Provides bidirectional conversion while preserving types:
 * - JavaScript → RDF: Converts JS values to typed RDF literals
 * - RDF → JavaScript: Converts RDF literals back to appropriate JS types
 * 
 * Supported types:
 * - string ↔ xsd:string
 * - number (integer) ↔ xsd:integer
 * - number (float) ↔ xsd:decimal
 * - boolean ↔ xsd:boolean
 * - Date ↔ xsd:dateTime
 */
export class RDFTypeMapper {
  // XSD namespace URI
  static XSD = 'http://www.w3.org/2001/XMLSchema#';

  /**
   * Convert JavaScript value to RDF typed literal
   * @param {*} value - The JavaScript value to convert
   * @returns {{value: string, datatype: string}|null} RDF literal or null for null/undefined
   * @throws {Error} If value type is not supported
   */
  static jsTypeToRDF(value) {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle string
    if (typeof value === 'string') {
      return {
        value: value,
        datatype: this.XSD + 'string'
      };
    }

    // Handle number
    if (typeof value === 'number') {
      // Check if integer or float
      if (Number.isInteger(value)) {
        return {
          value: String(value),
          datatype: this.XSD + 'integer'
        };
      } else {
        return {
          value: String(value),
          datatype: this.XSD + 'decimal'
        };
      }
    }

    // Handle boolean
    if (typeof value === 'boolean') {
      return {
        value: String(value),
        datatype: this.XSD + 'boolean'
      };
    }

    // Handle Date
    if (value instanceof Date) {
      return {
        value: value.toISOString(),
        datatype: this.XSD + 'dateTime'
      };
    }

    // Unsupported type
    throw new Error(`Unsupported JavaScript type: ${typeof value}`);
  }

  /**
   * Convert RDF typed literal to JavaScript value
   * @param {{value: string, datatype: string}|null} rdfLiteral - The RDF literal to convert
   * @returns {*} JavaScript value or null for null/undefined
   */
  static rdfToJSType(rdfLiteral) {
    // Handle null/undefined
    if (rdfLiteral === null || rdfLiteral === undefined) {
      return null;
    }

    // Handle missing datatype (treat as string)
    if (!rdfLiteral.datatype) {
      return rdfLiteral.value;
    }

    const datatype = rdfLiteral.datatype;
    const value = rdfLiteral.value;

    // Handle string types
    if (datatype === this.XSD + 'string') {
      return value;
    }

    // Handle integer types
    if (datatype === this.XSD + 'integer' || 
        datatype === this.XSD + 'int' ||
        datatype === this.XSD + 'long' ||
        datatype === this.XSD + 'short') {
      return parseInt(value, 10);
    }

    // Handle decimal/float/double types
    if (datatype === this.XSD + 'decimal' ||
        datatype === this.XSD + 'float' ||
        datatype === this.XSD + 'double') {
      return parseFloat(value);
    }

    // Handle boolean types
    if (datatype === this.XSD + 'boolean') {
      // Handle various boolean representations
      if (value === 'true' || value === '1') {
        return true;
      }
      if (value === 'false' || value === '0') {
        return false;
      }
      // Fallback
      return Boolean(value);
    }

    // Handle date/time types
    if (datatype === this.XSD + 'dateTime' ||
        datatype === this.XSD + 'date' ||
        datatype === this.XSD + 'time') {
      return new Date(value);
    }

    // Unknown datatype - return as string
    return value;
  }
}