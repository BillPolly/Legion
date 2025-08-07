/**
 * Core Capability interface and class for the Unified Capability Ontology
 */

export interface ICapability {
  _id: string;                     // Business identity (MongoDB native)
  subtypeOf: string;               // Universal inheritance (every capability has a supertype)
  attributes?: Record<string, any>; // Everything else (all properties, relationships, metadata)
}

export interface CreateCapabilityRequest {
  _id: string;
  subtypeOf: string;               // Required - every capability must have a supertype
  attributes?: Record<string, any>;
}

export interface UpdateCapabilityRequest {
  attributes?: Record<string, any>;
}

export interface SearchCriteria {
  // Attribute-based filtering (optimized for minimal model)
  attributes?: Record<string, any>;
  
  // Relationship filtering (now attribute-based)
  subtypeOf?: string;
  partOf?: string;
  uses?: string;
  hasParts?: boolean; // Has any parts
  
  // Value-based filtering
  minCost?: number;
  maxCost?: number;
  
  // Date filtering (now in attributes)
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  
  // Text search
  nameContains?: string;
  descriptionContains?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: string; // attribute key to sort by
  sortOrder?: 'asc' | 'desc';
}

export class Capability implements ICapability {
  public readonly _id: string;
  public readonly subtypeOf: string;
  public attributes: Record<string, any>;

  constructor(data: CreateCapabilityRequest) {
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

  private validate(): void {
    if (!this._id || this._id.trim() === '') {
      throw new Error('Capability _id is required');
    }

    if (!this.subtypeOf || this.subtypeOf.trim() === '') {
      throw new Error('Capability subtypeOf is required');
    }
  }

  public update(updates: UpdateCapabilityRequest): void {
    if (updates.attributes !== undefined) {
      this.attributes = { ...this.attributes, ...updates.attributes };
    }
    
    // Update timestamp as attribute
    this.attributes.updatedAt = new Date();
    this.validate();
  }

  public toJSON(): ICapability {
    return {
      _id: this._id,
      subtypeOf: this.subtypeOf,
      attributes: this.attributes
    };
  }

  public static fromJSON(data: ICapability): Capability {
    const capability = new Capability({
      _id: data._id,
      subtypeOf: data.subtypeOf,
      attributes: data.attributes
    });
    
    return capability;
  }

  // Convenience getter for backward compatibility (maps _id to id)
  public get id(): string {
    return this._id;
  }

  // Convenience getter for name from attributes
  public get name(): string {
    return this.attributes.name || this._id;
  }

  // Convenience getter for description from attributes
  public get description(): string | undefined {
    return this.attributes.description;
  }

  // Convenience getter for createdAt from attributes
  public get createdAt(): Date {
    return this.attributes.createdAt;
  }

  // Convenience getter for updatedAt from attributes
  public get updatedAt(): Date {
    return this.attributes.updatedAt;
  }

  // Convenience getter for hasPart from attributes
  public get hasPart(): string[] {
    return this.attributes.parts || [];
  }

  // Convenience getter for partOf from attributes
  public get partOf(): string | null {
    return this.attributes.partOf || null;
  }

  // Convenience getter for uses from attributes
  public get uses(): string | null {
    return this.attributes.uses || null;
  }

  // Convenience getter for requires from attributes
  public get requires(): string[] {
    return this.attributes.requires || [];
  }
}
