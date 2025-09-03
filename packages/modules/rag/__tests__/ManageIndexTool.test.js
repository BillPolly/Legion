import { describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';
import ManageIndexTool from '../src/tools/ManageIndexTool.js';
import RAGModule from '../src/RAGModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('ManageIndexTool', () => {
  let manageIndexTool;
  let semanticSearchModule;
  let resourceManager;
  let mongoClient;
  let db;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Connect to MongoDB for testing
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('semantic-manage-tool-test');
  }, 10000);

  afterAll(async () => {
    // Clean up test collections
    try {
      await db.collection('test_documents').drop();
      await db.collection('test_document_chunks').drop();
    } catch (error) {
      // Collections might not exist
    }
    
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(async () => {
    semanticSearchModule = await RAGModule.create(resourceManager);
    manageIndexTool = semanticSearchModule.getTool('manage_index');
    
    // Override database configuration for testing
    semanticSearchModule.config.mongodb = {
      database: 'semantic-manage-tool-test',
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    };
  });

  afterEach(async () => {
    if (semanticSearchModule) {
      await semanticSearchModule.cleanup();
    }
  });

  describe('constructor and setup', () => {
    it('should create tool instance with correct metadata', () => {
      expect(manageIndexTool).toBeDefined();
      expect(manageIndexTool.name).toBe('manage_index');
      expect(manageIndexTool.description).toContain('Manage document indexes');
      expect(manageIndexTool.semanticSearchModule).toBe(semanticSearchModule);
    });

    it('should have proper input schema validation', () => {
      const metadata = manageIndexTool.getMetadata();
      expect(metadata.inputSchema.properties.action).toBeDefined();
      expect(metadata.inputSchema.required).toContain('action');
      expect(metadata.inputSchema.properties.action.enum).toContain('status');
      expect(metadata.inputSchema.properties.action.enum).toContain('list');
      expect(metadata.inputSchema.properties.action.enum).toContain('clear');
    });
  });

  describe('input validation', () => {
    it('should validate valid management input', () => {
      const validInput = {
        workspace: 'test-manage',
        action: 'status',
        options: {
          includeStats: true
        }
      };

      const validation = manageIndexTool.validateInput(validInput);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject input without action', () => {
      const invalidInput = {
        workspace: 'test',
        options: { includeStats: true }
      };

      const validation = manageIndexTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
    });

    it('should reject invalid action values', () => {
      const invalidInput = {
        workspace: 'test',
        action: 'invalid-action'
      };

      const validation = manageIndexTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
    });
  });

  describe('status action', () => {
    it('should execute status action successfully', async () => {
      const result = await manageIndexTool.execute({
        workspace: 'test-status',
        action: 'status',
        options: {
          includeStats: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('status');
      expect(result.data.result).toBeDefined();
      expect(result.data.result.indexHealth).toBeDefined();
      expect(result.data.result.collections).toBeDefined();
      expect(result.data.statistics).toBeDefined();
      expect(result.data.statistics.totalDocuments).toBeDefined();
      expect(result.data.statistics.totalChunks).toBeDefined();
    });
  });

  describe('list action', () => {
    it('should list documents when action is list', async () => {
      const result = await manageIndexTool.execute({
        workspace: 'test-list',
        action: 'list',
        options: {
          includeStats: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('list');
      expect(result.data.result).toBeDefined();
      expect(result.data.result.documents).toBeDefined();
      expect(Array.isArray(result.data.result.documents)).toBe(true);
      expect(result.data.result.totalCount).toBeDefined();
    });
  });

  describe('clear action', () => {
    it('should execute clear action successfully', async () => {
      const result = await manageIndexTool.execute({
        workspace: 'test-clear',
        action: 'clear',
        options: {
          includeStats: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('clear');
      expect(result.data.result).toBeDefined();
      expect(result.data.result.cleared).toBeDefined();
      expect(result.data.result.documentsRemoved).toBeDefined();
      expect(result.data.result.chunksRemoved).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid action gracefully', async () => {
      const result = await manageIndexTool.execute({
        workspace: 'test',
        action: 'invalid'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });
  });

  describe('progress tracking', () => {
    it('should emit progress events during management operations', async () => {
      const progressEvents = [];
      
      manageIndexTool.on('progress', (data) => {
        progressEvents.push(data);
      });

      await manageIndexTool.execute({
        workspace: 'test-progress',
        action: 'status'
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      
      const messages = progressEvents.map(e => e.message);
      expect(messages.some(m => m.includes('Executing'))).toBe(true);
    });
  });
});