/**
 * PerspectiveTypeManager - Manages perspective type definitions
 * 
 * Provides CRUD operations for perspective types stored in the perspective_types collection.
 * Handles perspective type validation, ordering, and provides the foundation for the
 * single LLM call perspective generation system.
 * 
 * No mocks, no fallbacks - real database operations only
 */

import { DatabaseError, ValidationError } from '../errors/index.js';
import { Logger } from '../utils/Logger.js';

export class PerspectiveTypeManager {
  constructor({ db, resourceManager, options = {} }) {
    if (!db) {
      throw new DatabaseError(
        'Database instance is required',
        'initialization',
        'PerspectiveTypeManager'
      );
    }
    
    this.db = db;
    this.resourceManager = resourceManager;
    this.options = {
      verbose: false,
      ...options
    };
    
    this.collection = null;
    this.initialized = false;
    this.logger = Logger.create('PerspectiveTypeManager', { verbose: this.options.verbose });
  }
  
  /**
   * Initialize the manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.collection = this.db.collection('perspective_types');
      this.initialized = true;
      
      if (this.options.verbose) {
        this.logger.verbose('PerspectiveTypeManager initialized');
      }
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to initialize PerspectiveTypeManager: ${error.message}`,
        'initialize',
        'PerspectiveTypeManager',
        error
      );
    }
  }
  
  /**
   * Get all perspective types ordered by order field
   */
  async getAllPerspectiveTypes() {
    this._ensureInitialized();
    
    try {
      const perspectiveTypes = await this.collection
        .find({ enabled: true })
        .sort({ order: 1 })
        .toArray();
        
      return perspectiveTypes;
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspective types: ${error.message}`,
        'getAllPerspectiveTypes',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Get perspective type by name
   */
  async getPerspectiveType(name) {
    this._ensureInitialized();
    
    try {
      if (!name || typeof name !== 'string') {
        throw new ValidationError(
          'Perspective type name must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      
      const perspectiveType = await this.collection.findOne({ name });
      return perspectiveType;
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to get perspective type: ${error.message}`,
        'getPerspectiveType',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Create a new perspective type
   */
  async createPerspectiveType(perspectiveTypeData) {
    this._ensureInitialized();
    
    try {
      // Validate required fields
      const validatedData = this._validatePerspectiveTypeData(perspectiveTypeData);
      
      // Check if perspective type already exists
      const existing = await this.collection.findOne({ name: validatedData.name });
      if (existing) {
        throw new ValidationError(
          `Perspective type '${validatedData.name}' already exists`,
          'DUPLICATE_PERSPECTIVE_TYPE'
        );
      }
      
      // Add timestamps
      const perspectiveTypeDoc = {
        ...validatedData,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await this.collection.insertOne(perspectiveTypeDoc);
      
      if (this.options.verbose) {
        this.logger.verbose(`Created perspective type: ${validatedData.name}`);
      }
      
      return {
        ...perspectiveTypeDoc,
        _id: result.insertedId
      };
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to create perspective type: ${error.message}`,
        'createPerspectiveType',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Update an existing perspective type
   */
  async updatePerspectiveType(name, updates) {
    this._ensureInitialized();
    
    try {
      if (!name || typeof name !== 'string') {
        throw new ValidationError(
          'Perspective type name must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      
      // Validate updates
      const validatedUpdates = this._validatePerspectiveTypeUpdates(updates);
      
      // Don't allow name changes through this method
      if (validatedUpdates.name && validatedUpdates.name !== name) {
        throw new ValidationError(
          'Cannot change perspective type name through update',
          'VALIDATION_ERROR'
        );
      }
      
      // Add update timestamp
      validatedUpdates.updated_at = new Date();
      
      const result = await this.collection.updateOne(
        { name },
        { $set: validatedUpdates }
      );
      
      if (result.matchedCount === 0) {
        throw new ValidationError(
          `Perspective type '${name}' not found`,
          'PERSPECTIVE_TYPE_NOT_FOUND'
        );
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Updated perspective type: ${name}`);
      }
      
      return await this.getPerspectiveType(name);
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to update perspective type: ${error.message}`,
        'updatePerspectiveType',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Delete a perspective type
   */
  async deletePerspectiveType(name) {
    this._ensureInitialized();
    
    try {
      if (!name || typeof name !== 'string') {
        throw new ValidationError(
          'Perspective type name must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      
      // Check if there are any tool perspectives using this type
      const perspectivesCollection = this.db.collection('tool_perspectives');
      const usageCount = await perspectivesCollection.countDocuments({
        perspective_type_name: name
      });
      
      if (usageCount > 0) {
        throw new ValidationError(
          `Cannot delete perspective type '${name}': ${usageCount} tool perspectives are using it`,
          'PERSPECTIVE_TYPE_IN_USE'
        );
      }
      
      const result = await this.collection.deleteOne({ name });
      
      if (result.deletedCount === 0) {
        throw new ValidationError(
          `Perspective type '${name}' not found`,
          'PERSPECTIVE_TYPE_NOT_FOUND'
        );
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Deleted perspective type: ${name}`);
      }
      
      return true;
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to delete perspective type: ${error.message}`,
        'deletePerspectiveType',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Enable or disable a perspective type
   */
  async setPerspectiveTypeEnabled(name, enabled) {
    this._ensureInitialized();
    
    try {
      if (!name || typeof name !== 'string') {
        throw new ValidationError(
          'Perspective type name must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      
      if (typeof enabled !== 'boolean') {
        throw new ValidationError(
          'Enabled must be a boolean value',
          'VALIDATION_ERROR'
        );
      }
      
      const result = await this.collection.updateOne(
        { name },
        { 
          $set: { 
            enabled,
            updated_at: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new ValidationError(
          `Perspective type '${name}' not found`,
          'PERSPECTIVE_TYPE_NOT_FOUND'
        );
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Set perspective type '${name}' enabled: ${enabled}`);
      }
      
      return await this.getPerspectiveType(name);
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to set perspective type enabled status: ${error.message}`,
        'setPerspectiveTypeEnabled',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Get perspective types by category
   */
  async getPerspectiveTypesByCategory(category) {
    this._ensureInitialized();
    
    try {
      if (!category || typeof category !== 'string') {
        throw new ValidationError(
          'Category must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      
      const perspectiveTypes = await this.collection
        .find({ category, enabled: true })
        .sort({ order: 1 })
        .toArray();
        
      return perspectiveTypes;
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to get perspective types by category: ${error.message}`,
        'getPerspectiveTypesByCategory',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Get all categories
   */
  async getCategories() {
    this._ensureInitialized();
    
    try {
      const categories = await this.collection.distinct('category');
      return categories.sort();
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get categories: ${error.message}`,
        'getCategories',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Reorder perspective types
   */
  async reorderPerspectiveTypes(orderedNames) {
    this._ensureInitialized();
    
    try {
      if (!Array.isArray(orderedNames)) {
        throw new ValidationError(
          'Ordered names must be an array',
          'VALIDATION_ERROR'
        );
      }
      
      // Validate that all names exist
      const existingTypes = await this.getAllPerspectiveTypes();
      const existingNames = existingTypes.map(t => t.name);
      
      for (const name of orderedNames) {
        if (!existingNames.includes(name)) {
          throw new ValidationError(
            `Perspective type '${name}' does not exist`,
            'PERSPECTIVE_TYPE_NOT_FOUND'
          );
        }
      }
      
      // Update order for each perspective type
      const bulkOps = orderedNames.map((name, index) => ({
        updateOne: {
          filter: { name },
          update: { 
            $set: { 
              order: index + 1,
              updated_at: new Date()
            }
          }
        }
      }));
      
      await this.collection.bulkWrite(bulkOps);
      
      if (this.options.verbose) {
        this.logger.verbose(`Reordered ${orderedNames.length} perspective types`);
      }
      
      return await this.getAllPerspectiveTypes();
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Failed to reorder perspective types: ${error.message}`,
        'reorderPerspectiveTypes',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Get statistics about perspective types
   */
  async getStats() {
    this._ensureInitialized();
    
    try {
      const total = await this.collection.countDocuments();
      const enabled = await this.collection.countDocuments({ enabled: true });
      const disabled = await this.collection.countDocuments({ enabled: false });
      
      const categories = await this.collection.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();
      
      return {
        total,
        enabled,
        disabled,
        categories: categories.reduce((acc, cat) => {
          acc[cat._id] = cat.count;
          return acc;
        }, {})
      };
      
    } catch (error) {
      throw new DatabaseError(
        `Failed to get perspective type stats: ${error.message}`,
        'getStats',
        'perspective_types',
        error
      );
    }
  }
  
  /**
   * Validate perspective type data for creation
   */
  _validatePerspectiveTypeData(data) {
    if (!data || typeof data !== 'object') {
      throw new ValidationError(
        'Perspective type data must be an object',
        'VALIDATION_ERROR'
      );
    }
    
    const required = ['name', 'description', 'prompt_template', 'category', 'order'];
    for (const field of required) {
      if (!data[field] && data[field] !== 0) {
        throw new ValidationError(
          `Missing required field: ${field}`,
          'VALIDATION_ERROR'
        );
      }
    }
    
    // Validate types
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new ValidationError(
        'Name must be a non-empty string',
        'VALIDATION_ERROR'
      );
    }
    
    if (typeof data.description !== 'string' || data.description.trim().length === 0) {
      throw new ValidationError(
        'Description must be a non-empty string',
        'VALIDATION_ERROR'
      );
    }
    
    if (typeof data.prompt_template !== 'string' || data.prompt_template.trim().length === 0) {
      throw new ValidationError(
        'Prompt template must be a non-empty string',
        'VALIDATION_ERROR'
      );
    }
    
    if (typeof data.category !== 'string' || data.category.trim().length === 0) {
      throw new ValidationError(
        'Category must be a non-empty string',
        'VALIDATION_ERROR'
      );
    }
    
    if (!Number.isInteger(data.order) || data.order < 1) {
      throw new ValidationError(
        'Order must be a positive integer',
        'VALIDATION_ERROR'
      );
    }
    
    // Set defaults
    return {
      name: data.name.trim(),
      description: data.description.trim(),
      prompt_template: data.prompt_template.trim(),
      category: data.category.trim(),
      order: data.order,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true
    };
  }
  
  /**
   * Validate perspective type updates
   */
  _validatePerspectiveTypeUpdates(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new ValidationError(
        'Updates must be an object',
        'VALIDATION_ERROR'
      );
    }
    
    const validatedUpdates = {};
    
    // Validate each field if present
    if (updates.description !== undefined) {
      if (typeof updates.description !== 'string' || updates.description.trim().length === 0) {
        throw new ValidationError(
          'Description must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      validatedUpdates.description = updates.description.trim();
    }
    
    if (updates.prompt_template !== undefined) {
      if (typeof updates.prompt_template !== 'string' || updates.prompt_template.trim().length === 0) {
        throw new ValidationError(
          'Prompt template must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      validatedUpdates.prompt_template = updates.prompt_template.trim();
    }
    
    if (updates.category !== undefined) {
      if (typeof updates.category !== 'string' || updates.category.trim().length === 0) {
        throw new ValidationError(
          'Category must be a non-empty string',
          'VALIDATION_ERROR'
        );
      }
      validatedUpdates.category = updates.category.trim();
    }
    
    if (updates.order !== undefined) {
      if (!Number.isInteger(updates.order) || updates.order < 1) {
        throw new ValidationError(
          'Order must be a positive integer',
          'VALIDATION_ERROR'
        );
      }
      validatedUpdates.order = updates.order;
    }
    
    if (updates.enabled !== undefined) {
      validatedUpdates.enabled = Boolean(updates.enabled);
    }
    
    if (updates.name !== undefined) {
      validatedUpdates.name = updates.name;
    }
    
    return validatedUpdates;
  }
  
  /**
   * Ensure the manager is initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new DatabaseError(
        'PerspectiveTypeManager not initialized',
        'operation',
        'PerspectiveTypeManager'
      );
    }
  }
}