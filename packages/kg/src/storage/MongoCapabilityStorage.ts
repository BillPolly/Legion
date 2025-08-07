/**
 * MongoDB storage implementation for the Minimal 2-Field Capability Model
 * Optimized for 2-field structure: _id, subtypeOf, attributes
 */

import { Collection, Filter, UpdateFilter } from 'mongodb';
import { Capability, ICapability } from '../types/Capability';
import { 
  ICapabilityStorage, 
  SearchCriteria, 
  StorageStats, 
  StorageConfig 
} from './ICapabilityStorage';
import { MongoConnection } from './MongoConnection';
import { IndexManager } from './IndexManager';

export class MongoCapabilityStorage implements ICapabilityStorage {
  private connection: MongoConnection;
  private collection: Collection | null = null;

  constructor(config: StorageConfig) {
    this.connection = new MongoConnection(config);
  }

  /**
   * Connect to MongoDB and setup indexes
   */
  async connect(): Promise<void> {
    await this.connection.connect();
    this.collection = this.connection.getCollection();
    
    // Setup indexes for minimal model
    const db = this.connection.getDatabase();
    await IndexManager.createIndexes(db, this.collection.collectionName);
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    await this.connection.disconnect();
    this.collection = null;
  }

  /**
   * Get the collection (with connection check)
   */
  private getCollection(): Collection {
    if (!this.collection) {
      throw new Error('Not connected to MongoDB. Call connect() first.');
    }
    return this.collection;
  }

  /**
   * Create a new capability
   */
  async create(capability: Capability): Promise<Capability> {
    const collection = this.getCollection();
    
    // Convert to minimal model format (only 3 fields)
    const doc = this.capabilityToDocument(capability);
    
    try {
      await collection.insertOne(doc);
      return capability;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error(`Capability with id '${capability.id}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Get a capability by ID
   */
  async get(id: string): Promise<Capability | null> {
    const collection = this.getCollection();
    
    const doc = await collection.findOne({ _id: id } as any);
    if (!doc) {
      return null;
    }
    
    return this.documentToCapability(doc);
  }

  /**
   * Update a capability
   */
  async update(id: string, updates: Partial<ICapability>): Promise<Capability | null> {
    const collection = this.getCollection();
    
    // Build update document for minimal 2-field model
    const updateDoc: UpdateFilter<any> = {
      $set: {}
    };

    // Handle subtypeOf updates (core field)
    if (updates.subtypeOf) {
      updateDoc.$set!.subtypeOf = updates.subtypeOf;
    }

    // Handle attribute updates (everything else goes in attributes)
    if (updates.attributes) {
      // Update individual attributes
      for (const [key, value] of Object.entries(updates.attributes)) {
        updateDoc.$set![`attributes.${key}`] = value;
      }
      
      // Always update the updatedAt timestamp
      updateDoc.$set!['attributes.updatedAt'] = new Date();
    }

    const result = await collection.findOneAndUpdate(
      { _id: id } as any,
      updateDoc,
      { returnDocument: 'after' }
    );

    if (!result) {
      return null;
    }

    return this.documentToCapability(result);
  }

  /**
   * Delete a capability
   */
  async delete(id: string): Promise<boolean> {
    const collection = this.getCollection();
    
    const result = await collection.deleteOne({ _id: id } as any);
    return result.deletedCount === 1;
  }


  /**
   * Find capabilities by attribute key-value pair
   * Optimized for the attribute-based minimal model
   */
  async findByAttribute(attributeKey: string, value: any): Promise<Capability[]> {
    const collection = this.getCollection();
    
    const query = { [`attributes.${attributeKey}`]: value };
    const docs = await collection.find(query).toArray();
    return docs.map(doc => this.documentToCapability(doc));
  }

  /**
   * Find capabilities by multiple attribute criteria
   */
  async findByAttributes(criteria: Record<string, any>): Promise<Capability[]> {
    const collection = this.getCollection();
    
    const query: Filter<any> = {};
    for (const [key, value] of Object.entries(criteria)) {
      query[`attributes.${key}`] = value;
    }
    
    const docs = await collection.find(query).toArray();
    return docs.map(doc => this.documentToCapability(doc));
  }

  /**
   * Find capabilities with complex search criteria
   */
  async findCapabilities(criteria: SearchCriteria): Promise<Capability[]> {
    const collection = this.getCollection();
    
    const query = this.buildQuery(criteria);
    let cursor = collection.find(query);
    
    // Apply sorting
    if (criteria.sortBy) {
      const sortField = criteria.sortBy.startsWith('attributes.') 
        ? criteria.sortBy 
        : `attributes.${criteria.sortBy}`;
      const sortOrder = criteria.sortOrder === 'desc' ? -1 : 1;
      cursor = cursor.sort({ [sortField]: sortOrder });
    }
    
    // Apply pagination
    if (criteria.offset) {
      cursor = cursor.skip(criteria.offset);
    }
    if (criteria.limit) {
      cursor = cursor.limit(criteria.limit);
    }
    
    const docs = await cursor.toArray();
    return docs.map(doc => this.documentToCapability(doc));
  }

  /**
   * Get all capabilities
   */
  async findAll(): Promise<Capability[]> {
    const collection = this.getCollection();
    
    const docs = await collection.find({}).toArray();
    return docs.map(doc => this.documentToCapability(doc));
  }

  /**
   * Clear all capabilities (for testing)
   */
  async clear(): Promise<void> {
    const collection = this.getCollection();
    await collection.deleteMany({});
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const collection = this.getCollection();
    
    // Get total count
    const totalCapabilities = await collection.countDocuments();
    
    // Get count by subtype
    const subtypeCounts = await collection.aggregate([
      { $group: { _id: '$subtypeOf', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    const capabilitiesBySubtype: Record<string, number> = {};
    subtypeCounts.forEach(item => {
      capabilitiesBySubtype[item._id] = item.count;
    });
    
    // Get attribute statistics
    const attributeStats = await collection.aggregate([
      { $project: { attributeCount: { $size: { $objectToArray: '$attributes' } } } },
      { $group: { 
          _id: null, 
          avgAttributes: { $avg: '$attributeCount' },
          totalAttributes: { $sum: '$attributeCount' }
        } 
      }
    ]).toArray();
    
    const avgAttributes = attributeStats[0]?.avgAttributes || 0;
    const totalAttributes = attributeStats[0]?.totalAttributes || 0;
    
    // Get index statistics
    const indexStats = await IndexManager.getIndexStats(
      this.connection.getDatabase(), 
      collection.collectionName
    );
    
    return {
      totalCapabilities,
      capabilitiesBySubtype,
      averageAttributeCount: Math.round(avgAttributes * 100) / 100,
      totalAttributes,
      indexStats
    };
  }

  /**
   * Build MongoDB query from search criteria
   */
  private buildQuery(criteria: SearchCriteria): Filter<any> {
    const query: Filter<any> = {};
    
    // Attribute-based filtering
    if (criteria.attributes) {
      for (const [key, value] of Object.entries(criteria.attributes)) {
        query[`attributes.${key}`] = value;
      }
    }
    
    // Relationship filtering (subtypeOf is now a core field)
    if (criteria.subtypeOf) {
      query.subtypeOf = criteria.subtypeOf;
    }
    if (criteria.partOf) {
      query['attributes.partOf'] = criteria.partOf;
    }
    if (criteria.uses) {
      query['attributes.uses'] = criteria.uses;
    }
    if (criteria.hasParts) {
      query['attributes.parts'] = { $exists: true, $ne: [] };
    }
    
    // Value-based filtering
    if (criteria.minCost !== undefined || criteria.maxCost !== undefined) {
      const costQuery: any = {};
      if (criteria.minCost !== undefined) costQuery.$gte = criteria.minCost;
      if (criteria.maxCost !== undefined) costQuery.$lte = criteria.maxCost;
      query['attributes.cost'] = costQuery;
    }
    
    // Date filtering (now in attributes)
    if (criteria.createdAfter || criteria.createdBefore) {
      const dateQuery: any = {};
      if (criteria.createdAfter) dateQuery.$gte = criteria.createdAfter;
      if (criteria.createdBefore) dateQuery.$lte = criteria.createdBefore;
      query['attributes.createdAt'] = dateQuery;
    }
    
    if (criteria.updatedAfter || criteria.updatedBefore) {
      const dateQuery: any = {};
      if (criteria.updatedAfter) dateQuery.$gte = criteria.updatedAfter;
      if (criteria.updatedBefore) dateQuery.$lte = criteria.updatedBefore;
      query['attributes.updatedAt'] = dateQuery;
    }
    
    // Text search - use MongoDB text index for better performance
    if (criteria.nameContains || criteria.descriptionContains) {
      // If both are the same (from searchByText), use text search
      if (criteria.nameContains && criteria.nameContains === criteria.descriptionContains) {
        query.$text = { $search: criteria.nameContains };
      } else {
        // Otherwise use regex for individual fields
        if (criteria.nameContains) {
          query['attributes.name'] = new RegExp(criteria.nameContains, 'i');
        }
        if (criteria.descriptionContains) {
          query['attributes.description'] = new RegExp(criteria.descriptionContains, 'i');
        }
      }
    }
    
    return query;
  }

  /**
   * Convert Capability to MongoDB document (minimal 2-field model)
   */
  private capabilityToDocument(capability: Capability): any {
    return {
      _id: capability._id,
      subtypeOf: capability.subtypeOf,
      attributes: capability.attributes
      // Only 2 fields plus attributes! Everything else is in attributes
    };
  }

  /**
   * Convert MongoDB document to Capability
   */
  private documentToCapability(doc: any): Capability {
    return Capability.fromJSON({
      _id: doc._id,
      subtypeOf: doc.subtypeOf,
      attributes: doc.attributes || {}
    });
  }
}
