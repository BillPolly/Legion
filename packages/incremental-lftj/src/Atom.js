/**
 * Base class for all Atom types
 * Per design §2.1: Atom ∈ ID | Integer | Float | String | Boolean | Symbol
 */
export class Atom {
  constructor(type, value) {
    this._type = type;
    this._value = value;
    Object.freeze(this);
  }

  get type() {
    return this._type;
  }

  get value() {
    return this._value;
  }

  equals(other) {
    if (!(other instanceof Atom)) return false;
    return this._type === other._type && this._value === other._value;
  }

  /**
   * Total ordering per design §2.2
   * Type precedence: Boolean < Integer < Float < String < Symbol < ID
   */
  compareTo(other) {
    if (!(other instanceof Atom)) {
      throw new Error('Can only compare Atom instances');
    }

    const typeOrder = {
      'Boolean': 0,
      'Integer': 1,
      'Float': 2,
      'String': 3,
      'Symbol': 4,
      'ID': 5
    };

    const thisOrder = typeOrder[this._type];
    const otherOrder = typeOrder[other._type];

    if (thisOrder !== otherOrder) {
      return thisOrder - otherOrder;
    }

    // Same type, compare values
    return this._compareValue(other._value);
  }

  _compareValue(otherValue) {
    throw new Error('Subclass must implement _compareValue');
  }

  /**
   * Canonical byte encoding per design §2.3
   * Format: [type-tag][value bytes]
   */
  toBytes() {
    throw new Error('Subclass must implement toBytes');
  }
}

export class BooleanAtom extends Atom {
  constructor(value) {
    if (typeof value !== 'boolean') {
      throw new Error('Boolean value must be a boolean');
    }
    super('Boolean', value);
  }

  _compareValue(otherValue) {
    // false < true
    if (this._value === otherValue) return 0;
    return this._value ? 1 : -1;
  }

  toBytes() {
    const bytes = new Uint8Array(2);
    bytes[0] = 0x01; // Type tag for Boolean
    bytes[1] = this._value ? 0x01 : 0x00;
    return bytes;
  }
}

export class Integer extends Atom {
  constructor(value) {
    if (!Number.isInteger(value)) {
      throw new Error('Integer value must be an integer');
    }
    super('Integer', value);
  }

  _compareValue(otherValue) {
    return this._value - otherValue;
  }

  toBytes() {
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    view.setUint8(0, 0x02); // Type tag for Integer
    view.setInt32(1, this._value, false); // Big-endian
    return new Uint8Array(buffer);
  }
}

export class Float extends Atom {
  constructor(value) {
    if (typeof value !== 'number') {
      throw new Error('Float value must be a number');
    }
    super('Float', value);
  }

  _compareValue(otherValue) {
    if (this._value < otherValue) return -1;
    if (this._value > otherValue) return 1;
    return 0;
  }

  toBytes() {
    const buffer = new ArrayBuffer(9);
    const view = new DataView(buffer);
    view.setUint8(0, 0x03); // Type tag for Float
    view.setFloat64(1, this._value, false); // Big-endian
    return new Uint8Array(buffer);
  }
}

export class StringAtom extends Atom {
  constructor(value) {
    if (typeof value !== 'string') {
      throw new Error('String value must be a string');
    }
    super('String', value);
  }

  _compareValue(otherValue) {
    if (this._value < otherValue) return -1;
    if (this._value > otherValue) return 1;
    return 0;
  }

  toBytes() {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(this._value);
    const bytes = new Uint8Array(5 + valueBytes.length);
    bytes[0] = 0x04; // Type tag for String
    
    // Length as 4-byte big-endian
    const lengthView = new DataView(bytes.buffer, bytes.byteOffset + 1, 4);
    lengthView.setUint32(0, valueBytes.length, false);
    
    // Copy string bytes
    bytes.set(valueBytes, 5);
    return bytes;
  }
}

export { StringAtom as String };

export class SymbolAtom extends Atom {
  constructor(value) {
    if (typeof value !== 'string' || !value.startsWith(':')) {
      throw new Error('Symbol value must be a string starting with ":"');
    }
    super('Symbol', value);
  }

  _compareValue(otherValue) {
    if (this._value < otherValue) return -1;
    if (this._value > otherValue) return 1;
    return 0;
  }

  toBytes() {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(this._value);
    const bytes = new Uint8Array(5 + valueBytes.length);
    bytes[0] = 0x05; // Type tag for Symbol
    
    // Length as 4-byte big-endian
    const lengthView = new DataView(bytes.buffer, bytes.byteOffset + 1, 4);
    lengthView.setUint32(0, valueBytes.length, false);
    
    // Copy symbol bytes
    bytes.set(valueBytes, 5);
    return bytes;
  }
}

export { SymbolAtom as Symbol };

export class ID extends Atom {
  constructor(value) {
    if (typeof value !== 'string') {
      throw new Error('ID value must be a string');
    }
    super('ID', value);
  }

  _compareValue(otherValue) {
    if (this._value < otherValue) return -1;
    if (this._value > otherValue) return 1;
    return 0;
  }

  toBytes() {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(this._value);
    const bytes = new Uint8Array(5 + valueBytes.length);
    bytes[0] = 0x06; // Type tag for ID
    
    // Length as 4-byte big-endian
    const lengthView = new DataView(bytes.buffer, bytes.byteOffset + 1, 4);
    lengthView.setUint32(0, valueBytes.length, false);
    
    // Copy ID bytes
    bytes.set(valueBytes, 5);
    return bytes;
  }
}

export { BooleanAtom as Boolean };