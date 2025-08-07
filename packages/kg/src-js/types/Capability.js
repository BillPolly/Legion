/**
 * Core Capability class for the Unified Capability Ontology
 * ES6 JavaScript version
 */

export class Capability {
  constructor(data) {
    if (!data) {
      throw new Error('Capability data is required');
    }
    
    this._id = data._id;
    this.subtypeOf = data.subtypeOf;
    this.attributes = data.attributes || {};
    
    // Set timestamps as attributes if not provided
    const now = new Date();
    if (!this.attributes.createdAt) {
      this.attributes.createdAt = now;
    }
    if (!this.attributes.updatedAt) {
      this.attributes.updatedAt = now;
    }

    this.validate();
  }

  validate() {
    if (!this._id || this._id.trim() === '') {
      throw new Error('Capability _id is required');
    }

    if (!this.subtypeOf || this.subtypeOf.trim() === '') {
      throw new Error('Capability subtypeOf is required');
    }
  }

  update(updates) {
    if (updates.attributes !== undefined) {
      this.attributes = { ...this.attributes, ...updates.attributes };
    }
    
    // Update timestamp as attribute
    this.attributes.updatedAt = new Date();
    this.validate();
  }

  toJSON() {
    return {
      _id: this._id,
      subtypeOf: this.subtypeOf,
      attributes: this.attributes
    };
  }

  static fromJSON(data) {
    const capability = new Capability({
      _id: data._id,
      subtypeOf: data.subtypeOf,
      attributes: data.attributes
    });
    
    return capability;
  }

  // Convenience getter for backward compatibility (maps _id to id)
  get id() {
    return this._id;
  }

  // Convenience getter for name from attributes
  get name() {
    return this.attributes.name || this._id;
  }

  // Convenience getter for description from attributes
  get description() {
    return this.attributes.description;
  }

  // Convenience getter for createdAt from attributes
  get createdAt() {
    return this.attributes.createdAt;
  }

  // Convenience getter for updatedAt from attributes
  get updatedAt() {
    return this.attributes.updatedAt;
  }

  // Convenience getter for hasPart from attributes
  get hasPart() {
    return this.attributes.parts || [];
  }

  // Convenience getter for partOf from attributes
  get partOf() {
    return this.attributes.partOf || null;
  }

  // Convenience getter for uses from attributes
  get uses() {
    return this.attributes.uses || null;
  }

  // Convenience getter for requires from attributes
  get requires() {
    return this.attributes.requires || [];
  }
}