/**
 * PerspectiveTypeManager Unit Tests
 * 
 * Tests the PerspectiveTypeManager class functionality for CRUD operations on perspective types
 * Ensures proper validation, error handling, and database operations
 * 
 * No mocks, real database operations with test isolation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { PerspectiveTypeManager } from '../../src/core/PerspectiveTypeManager.js';
import { DatabaseError, ValidationError } from '../../src/errors/index.js';

describe('PerspectiveTypeManager', () => {
  let mongod;
  let client;
  let db;
  let perspectiveTypeManager;
  let mockResourceManager;

  beforeEach(async () => {
    // Create in-memory MongoDB instance for testing
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test_database');

    // Mock ResourceManager
    mockResourceManager = {
      get: jest.fn().mockReturnValue(null)
    };

    perspectiveTypeManager = new PerspectiveTypeManager({
      db,
      resourceManager: mockResourceManager,
      options: { verbose: false }
    });

    await perspectiveTypeManager.initialize();

    // Seed test data
    await db.collection('perspective_types').insertMany([
      {
        name: 'test_perspective',
        description: 'Test perspective type',
        prompt_template: 'Test prompt for {toolName}',
        category: 'test',
        order: 1,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'disabled_perspective',
        description: 'Disabled perspective type',
        prompt_template: 'Disabled prompt',
        category: 'test',
        order: 2,
        enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('constructor', () => {
    it('should create PerspectiveTypeManager with required parameters', () => {
      expect(perspectiveTypeManager).toBeInstanceOf(PerspectiveTypeManager);
      expect(perspectiveTypeManager.db).toBe(db);
      expect(perspectiveTypeManager.options.verbose).toBe(false);
    });

    it('should throw error without database instance', () => {
      expect(() => {
        new PerspectiveTypeManager({
          resourceManager: mockResourceManager
        });
      }).toThrow('Database instance is required');
    });

    it('should use default options when not provided', () => {
      const manager = new PerspectiveTypeManager({
        db,
        resourceManager: mockResourceManager
      });

      expect(manager.options.verbose).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const newManager = new PerspectiveTypeManager({
        db,
        resourceManager: mockResourceManager
      });

      await newManager.initialize();
      expect(newManager.initialized).toBe(true);
      expect(newManager.collection).toBeDefined();
    });

    it('should skip initialization if already initialized', async () => {
      const firstInitialization = await perspectiveTypeManager.initialize();
      const secondInitialization = await perspectiveTypeManager.initialize();
      
      expect(perspectiveTypeManager.initialized).toBe(true);
    });
  });

  describe('getAllPerspectiveTypes', () => {
    it('should return all enabled perspective types ordered by order field', async () => {
      const perspectiveTypes = await perspectiveTypeManager.getAllPerspectiveTypes();
      
      expect(perspectiveTypes).toHaveLength(1); // Only enabled ones
      expect(perspectiveTypes[0].name).toBe('test_perspective');
      expect(perspectiveTypes[0].enabled).toBe(true);
    });

    it('should return empty array if no enabled types exist', async () => {
      // Disable all types
      await db.collection('perspective_types').updateMany({}, { $set: { enabled: false } });
      
      const perspectiveTypes = await perspectiveTypeManager.getAllPerspectiveTypes();
      expect(perspectiveTypes).toHaveLength(0);
    });

    it('should return types in correct order', async () => {
      // Clear existing data and add new test data with different orders
      await db.collection('perspective_types').deleteMany({});
      await db.collection('perspective_types').insertMany([
        {
          name: 'first_perspective',
          description: 'First perspective',
          prompt_template: 'First prompt',
          category: 'test',
          order: 1,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'third_perspective',
          description: 'Third perspective',
          prompt_template: 'Third prompt',
          category: 'test',
          order: 3,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const perspectiveTypes = await perspectiveTypeManager.getAllPerspectiveTypes();
      expect(perspectiveTypes).toHaveLength(2);
      expect(perspectiveTypes[0].name).toBe('first_perspective');
      expect(perspectiveTypes[1].name).toBe('third_perspective');
    });
  });

  describe('getPerspectiveType', () => {
    it('should return specific perspective type by name', async () => {
      const perspectiveType = await perspectiveTypeManager.getPerspectiveType('test_perspective');
      
      expect(perspectiveType).toBeDefined();
      expect(perspectiveType.name).toBe('test_perspective');
      expect(perspectiveType.description).toBe('Test perspective type');
    });

    it('should return null for non-existent perspective type', async () => {
      const perspectiveType = await perspectiveTypeManager.getPerspectiveType('nonexistent');
      expect(perspectiveType).toBeNull();
    });

    it('should validate name parameter', async () => {
      await expect(perspectiveTypeManager.getPerspectiveType('')).rejects.toThrow(ValidationError);
      await expect(perspectiveTypeManager.getPerspectiveType(null)).rejects.toThrow(ValidationError);
      await expect(perspectiveTypeManager.getPerspectiveType(123)).rejects.toThrow(ValidationError);
    });
  });

  describe('createPerspectiveType', () => {
    const validPerspectiveTypeData = {
      name: 'new_perspective',
      description: 'New perspective type',
      prompt_template: 'New prompt for {toolName}',
      category: 'new',
      order: 10
    };

    it('should create a new perspective type successfully', async () => {
      const result = await perspectiveTypeManager.createPerspectiveType(validPerspectiveTypeData);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('new_perspective');
      expect(result.description).toBe('New perspective type');
      expect(result.enabled).toBe(true); // Default
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result._id).toBeDefined();

      // Verify in database
      const saved = await db.collection('perspective_types').findOne({ name: 'new_perspective' });
      expect(saved).toBeDefined();
    });

    it('should set enabled to false when specified', async () => {
      const data = { ...validPerspectiveTypeData, name: 'disabled_new', enabled: false };
      const result = await perspectiveTypeManager.createPerspectiveType(data);
      
      expect(result.enabled).toBe(false);
    });

    it('should prevent duplicate perspective type names', async () => {
      await perspectiveTypeManager.createPerspectiveType(validPerspectiveTypeData);
      
      await expect(perspectiveTypeManager.createPerspectiveType(validPerspectiveTypeData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate required fields', async () => {
      const requiredFields = ['name', 'description', 'prompt_template', 'category', 'order'];
      
      for (const field of requiredFields) {
        const invalidData = { ...validPerspectiveTypeData };
        delete invalidData[field];
        
        await expect(perspectiveTypeManager.createPerspectiveType(invalidData))
          .rejects.toThrow(ValidationError);
      }
    });

    it('should validate field types', async () => {
      // Invalid name
      await expect(perspectiveTypeManager.createPerspectiveType({
        ...validPerspectiveTypeData,
        name: ''
      })).rejects.toThrow(ValidationError);

      // Invalid order
      await expect(perspectiveTypeManager.createPerspectiveType({
        ...validPerspectiveTypeData,
        name: 'test_order',
        order: 0
      })).rejects.toThrow(ValidationError);

      await expect(perspectiveTypeManager.createPerspectiveType({
        ...validPerspectiveTypeData,
        name: 'test_order2',
        order: 'invalid'
      })).rejects.toThrow(ValidationError);
    });

    it('should trim string fields', async () => {
      const dataWithWhitespace = {
        name: '  trimmed_name  ',
        description: '  Trimmed description  ',
        prompt_template: '  Trimmed prompt  ',
        category: '  trimmed  ',
        order: 5
      };

      const result = await perspectiveTypeManager.createPerspectiveType(dataWithWhitespace);
      
      expect(result.name).toBe('trimmed_name');
      expect(result.description).toBe('Trimmed description');
      expect(result.prompt_template).toBe('Trimmed prompt');
      expect(result.category).toBe('trimmed');
    });
  });

  describe('updatePerspectiveType', () => {
    it('should update existing perspective type successfully', async () => {
      const updates = {
        description: 'Updated description',
        category: 'updated'
      };

      const result = await perspectiveTypeManager.updatePerspectiveType('test_perspective', updates);
      
      expect(result.description).toBe('Updated description');
      expect(result.category).toBe('updated');
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const updated = await db.collection('perspective_types').findOne({ name: 'test_perspective' });
      expect(updated.description).toBe('Updated description');
    });

    it('should prevent name changes through update', async () => {
      await expect(perspectiveTypeManager.updatePerspectiveType('test_perspective', {
        name: 'changed_name'
      })).rejects.toThrow(ValidationError);
    });

    it('should handle non-existent perspective type', async () => {
      await expect(perspectiveTypeManager.updatePerspectiveType('nonexistent', {
        description: 'New description'
      })).rejects.toThrow(ValidationError);
    });

    it('should validate update parameters', async () => {
      await expect(perspectiveTypeManager.updatePerspectiveType('', {})).rejects.toThrow(ValidationError);
      await expect(perspectiveTypeManager.updatePerspectiveType('test_perspective', null)).rejects.toThrow(ValidationError);
    });

    it('should validate field types in updates', async () => {
      await expect(perspectiveTypeManager.updatePerspectiveType('test_perspective', {
        description: ''
      })).rejects.toThrow(ValidationError);

      await expect(perspectiveTypeManager.updatePerspectiveType('test_perspective', {
        order: 0
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('deletePerspectiveType', () => {
    it('should delete perspective type successfully', async () => {
      const result = await perspectiveTypeManager.deletePerspectiveType('test_perspective');
      expect(result).toBe(true);

      // Verify deletion
      const deleted = await db.collection('perspective_types').findOne({ name: 'test_perspective' });
      expect(deleted).toBeNull();
    });

    it('should prevent deletion when perspective type is in use', async () => {
      // Add tool perspective using the type
      await db.collection('tool_perspectives').insertOne({
        tool_name: 'test_tool',
        perspective_type_name: 'test_perspective',
        content: 'Test content',
        generated_at: new Date()
      });

      await expect(perspectiveTypeManager.deletePerspectiveType('test_perspective'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle non-existent perspective type', async () => {
      await expect(perspectiveTypeManager.deletePerspectiveType('nonexistent'))
        .rejects.toThrow(ValidationError);
    });

    it('should validate name parameter', async () => {
      await expect(perspectiveTypeManager.deletePerspectiveType('')).rejects.toThrow(ValidationError);
      await expect(perspectiveTypeManager.deletePerspectiveType(null)).rejects.toThrow(ValidationError);
    });
  });

  describe('setPerspectiveTypeEnabled', () => {
    it('should enable perspective type successfully', async () => {
      const result = await perspectiveTypeManager.setPerspectiveTypeEnabled('disabled_perspective', true);
      
      expect(result.enabled).toBe(true);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should disable perspective type successfully', async () => {
      const result = await perspectiveTypeManager.setPerspectiveTypeEnabled('test_perspective', false);
      
      expect(result.enabled).toBe(false);
    });

    it('should validate parameters', async () => {
      await expect(perspectiveTypeManager.setPerspectiveTypeEnabled('', true)).rejects.toThrow(ValidationError);
      await expect(perspectiveTypeManager.setPerspectiveTypeEnabled('test_perspective', 'true')).rejects.toThrow(ValidationError);
    });

    it('should handle non-existent perspective type', async () => {
      await expect(perspectiveTypeManager.setPerspectiveTypeEnabled('nonexistent', true))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getPerspectiveTypesByCategory', () => {
    beforeEach(async () => {
      // Add more test data with different categories
      await db.collection('perspective_types').insertMany([
        {
          name: 'tech_perspective1',
          description: 'Technical perspective 1',
          prompt_template: 'Tech prompt 1',
          category: 'technical',
          order: 1,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'tech_perspective2',
          description: 'Technical perspective 2',
          prompt_template: 'Tech prompt 2',
          category: 'technical',
          order: 2,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    });

    it('should return perspective types for specific category', async () => {
      const techTypes = await perspectiveTypeManager.getPerspectiveTypesByCategory('technical');
      
      expect(techTypes).toHaveLength(2);
      expect(techTypes[0].category).toBe('technical');
      expect(techTypes[1].category).toBe('technical');
      expect(techTypes[0].order).toBeLessThan(techTypes[1].order);
    });

    it('should return empty array for non-existent category', async () => {
      const result = await perspectiveTypeManager.getPerspectiveTypesByCategory('nonexistent');
      expect(result).toHaveLength(0);
    });

    it('should only return enabled types', async () => {
      // Disable one technical type
      await db.collection('perspective_types').updateOne(
        { name: 'tech_perspective1' },
        { $set: { enabled: false } }
      );

      const techTypes = await perspectiveTypeManager.getPerspectiveTypesByCategory('technical');
      expect(techTypes).toHaveLength(1);
      expect(techTypes[0].name).toBe('tech_perspective2');
    });

    it('should validate category parameter', async () => {
      await expect(perspectiveTypeManager.getPerspectiveTypesByCategory('')).rejects.toThrow(ValidationError);
      await expect(perspectiveTypeManager.getPerspectiveTypesByCategory(null)).rejects.toThrow(ValidationError);
    });
  });

  describe('getCategories', () => {
    beforeEach(async () => {
      await db.collection('perspective_types').insertMany([
        {
          name: 'functional_perspective',
          description: 'Functional perspective',
          prompt_template: 'Functional prompt',
          category: 'functional',
          order: 1,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'behavioral_perspective',
          description: 'Behavioral perspective',
          prompt_template: 'Behavioral prompt',
          category: 'behavioral',
          order: 1,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    });

    it('should return all unique categories sorted', async () => {
      const categories = await perspectiveTypeManager.getCategories();
      
      expect(categories).toContain('test');
      expect(categories).toContain('functional');
      expect(categories).toContain('behavioral');
      
      // Should be sorted
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });
  });

  describe('reorderPerspectiveTypes', () => {
    beforeEach(async () => {
      await db.collection('perspective_types').deleteMany({}); // Clear existing
      await db.collection('perspective_types').insertMany([
        {
          name: 'first',
          description: 'First',
          prompt_template: 'First prompt',
          category: 'test',
          order: 1,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'second',
          description: 'Second',
          prompt_template: 'Second prompt',
          category: 'test',
          order: 2,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'third',
          description: 'Third',
          prompt_template: 'Third prompt',
          category: 'test',
          order: 3,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    });

    it('should reorder perspective types successfully', async () => {
      const newOrder = ['third', 'first', 'second'];
      const result = await perspectiveTypeManager.reorderPerspectiveTypes(newOrder);
      
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('third');
      expect(result[0].order).toBe(1);
      expect(result[1].name).toBe('first');
      expect(result[1].order).toBe(2);
      expect(result[2].name).toBe('second');
      expect(result[2].order).toBe(3);
    });

    it('should validate that all names exist', async () => {
      const invalidOrder = ['first', 'nonexistent', 'second'];
      
      await expect(perspectiveTypeManager.reorderPerspectiveTypes(invalidOrder))
        .rejects.toThrow(ValidationError);
    });

    it('should validate parameter type', async () => {
      await expect(perspectiveTypeManager.reorderPerspectiveTypes('not_array'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await db.collection('perspective_types').deleteMany({});
      await db.collection('perspective_types').insertMany([
        {
          name: 'enabled1',
          description: 'Enabled 1',
          prompt_template: 'Enabled prompt 1',
          category: 'cat1',
          order: 1,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'enabled2',
          description: 'Enabled 2',
          prompt_template: 'Enabled prompt 2',
          category: 'cat2',
          order: 2,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          name: 'disabled1',
          description: 'Disabled 1',
          prompt_template: 'Disabled prompt',
          category: 'cat1',
          order: 3,
          enabled: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    });

    it('should return correct statistics', async () => {
      const stats = await perspectiveTypeManager.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.categories).toEqual({
        cat1: 2,
        cat2: 1
      });
    });
  });

  describe('error handling', () => {
    it('should throw proper error when not initialized', () => {
      const uninitializedManager = new PerspectiveTypeManager({
        db,
        resourceManager: mockResourceManager
      });

      expect(() => uninitializedManager._ensureInitialized()).toThrow(DatabaseError);
    });

    it('should handle database errors gracefully', async () => {
      await client.close();
      
      await expect(perspectiveTypeManager.getAllPerspectiveTypes()).rejects.toThrow(DatabaseError);
    });
  });
});