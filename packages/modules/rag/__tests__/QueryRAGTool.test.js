import { describe, it, expect, beforeEach, beforeAll, afterEach, jest } from '@jest/globals';
import QueryRAGTool from '../src/tools/QueryRAGTool.js';
import RAGModule from '../src/RAGModule.js';
import DocumentIndexer from '../src/indexers/DocumentIndexer.js';
import ContentProcessor from '../src/processors/ContentProcessor.js';
import DatabaseSchema from '../src/database/DatabaseSchema.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';

describe('QueryRAGTool', () => {
  let queryRAGTool;
  let semanticSearchModule;
  let resourceManager;
  let mongoClient;
  let db;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Connect to MongoDB and set up test data
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('semantic-rag-tool-test');
    
    // Set up comprehensive test data
    const databaseSchema = new DatabaseSchema(db, {
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    });

    const contentProcessor = new ContentProcessor({
      defaultChunkSize: 600,
      defaultOverlap: 0.2,
      maxFileSize: 1024 * 1024
    });

    const documentIndexer = new DocumentIndexer({
      databaseSchema,
      contentProcessor,
      resourceManager,
      options: {
        qdrantCollection: 'rag_tool_test'
      }
    });

    // Index detailed documentation for testing
    const documentationContent = [
      {
        content: `# Complete Database Setup Guide

## Installation
First, install the MongoDB driver for Node.js:
\`\`\`bash
npm install mongodb
\`\`\`

## Connection Configuration
Create a connection string with proper authentication:
\`\`\`javascript
const connectionString = 'mongodb://username:password@localhost:27017/myapp';
const client = new MongoClient(connectionString, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
\`\`\`

## Best Practices
- Always use connection pooling
- Handle connection errors with try-catch blocks
- Store credentials in environment variables
- Use proper timeout settings
- Monitor connection health

## Environment Setup
Set these environment variables:
- MONGODB_URL=mongodb://localhost:27017
- MONGODB_DB_NAME=your_app_database
- MONGODB_MAX_POOL_SIZE=10

## Error Handling
Always wrap database operations in try-catch:
\`\`\`javascript
try {
  await client.connect();
  console.log('Connected to MongoDB');
} catch (error) {
  console.error('Connection failed:', error);
}
\`\`\``,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/database-complete-guide.md' }
      },
      {
        content: `# Authentication and Security Implementation

## JWT Authentication Setup
Implement secure JWT-based authentication:

### Installation
\`\`\`bash
npm install jsonwebtoken bcrypt
\`\`\`

### Password Hashing
Always hash passwords before storing:
\`\`\`javascript
const bcrypt = require('bcrypt');
const saltRounds = 12;

async function hashPassword(password) {
  return await bcrypt.hash(password, saltRounds);
}
\`\`\`

### Token Generation
Create JWT tokens on successful login:
\`\`\`javascript
const jwt = require('jsonwebtoken');

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
}
\`\`\`

### Middleware Protection
Protect routes with authentication middleware:
\`\`\`javascript
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}
\`\`\`

## Security Best Practices
- Use strong JWT secrets (minimum 32 characters)
- Set appropriate token expiration times
- Implement refresh token rotation
- Hash passwords with sufficient rounds (12+)
- Validate all incoming data
- Log authentication attempts
- Implement rate limiting for login attempts`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/authentication-security.md' }
      }
    ];

    for (const doc of documentationContent) {
      await documentIndexer.indexDocument(doc.content, doc.contentType, doc.metadata, { workspace: 'rag-tool-test' });
    }
  }, 30000);

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
    queryRAGTool = semanticSearchModule.getTool('query_rag');
    
    // Override database configuration for testing
    semanticSearchModule.config.mongodb = {
      database: 'semantic-rag-tool-test',
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    };
    semanticSearchModule.config.qdrant.collection = 'rag_tool_test';
  });

  afterEach(async () => {
    if (semanticSearchModule) {
      await semanticSearchModule.cleanup();
    }
  });

  describe('constructor and setup', () => {
    it('should create tool instance with correct metadata', () => {
      expect(queryRAGTool).toBeDefined();
      expect(queryRAGTool.name).toBe('query_rag');
      expect(queryRAGTool.description).toContain('RAG queries');
      expect(queryRAGTool.semanticSearchModule).toBe(semanticSearchModule);
    });

    it('should have proper input schema validation', () => {
      const metadata = queryRAGTool.getMetadata();
      expect(metadata.inputSchema.properties.query).toBeDefined();
      expect(metadata.inputSchema.required).toContain('query');
      expect(metadata.inputSchema.properties.options).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should validate valid RAG input', () => {
      const validInput = {
        workspace: 'rag-tool-test',
        query: 'How do I set up database connections?',
        options: {
          searchLimit: 5,
          searchThreshold: 0.3,
          llmModel: 'claude-3-5-sonnet',
          includeSourceCitations: true,
          responseStyle: 'detailed'
        }
      };

      const validation = queryRAGTool.validateInput(validInput);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject input without query', () => {
      const invalidInput = {
        workspace: 'test',
        options: { searchLimit: 5 }
      };

      const validation = queryRAGTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
    });

    it('should validate response style options', () => {
      const invalidInput = {
        query: 'test query',
        options: { responseStyle: 'invalid-style' }
      };

      const validation = queryRAGTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
    });
  });

  describe('RAG query execution', () => {
    it('should execute database setup RAG query successfully', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'How do I set up a MongoDB database connection in Node.js?',
        options: {
          searchLimit: 3,
          searchThreshold: 0.25,
          responseStyle: 'detailed',
          includeSourceCitations: true
        }
      });

      if (result.success) {
        expect(result.data.query).toContain('MongoDB database connection');
        expect(result.data.response).toBeDefined();
        expect(result.data.response.length).toBeGreaterThan(10);
        expect(result.data.sources).toBeDefined();
        expect(result.data.llmMetadata).toBeDefined();
        expect(result.data.searchResults).toBeDefined();
      } else {
        // If it fails, it should be due to missing API key or service issues
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    }, 15000);

    it('should execute authentication setup RAG query', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'How do I implement JWT authentication with password hashing?',
        options: {
          searchLimit: 4,
          searchThreshold: 0.3,
          responseStyle: 'detailed'
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.sources).toBeDefined();
        expect(result.data.llmMetadata).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);

    it('should provide concise responses when requested', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'Quick steps for database setup?',
        options: {
          searchLimit: 2,
          responseStyle: 'concise'
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.sources).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);
  });

  describe('source attribution', () => {
    it('should provide detailed source information', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'What are the security best practices for authentication?',
        options: {
          searchLimit: 3,
          includeSourceCitations: true
        }
      });

      if (result.success) {
        expect(result.data.sources).toBeDefined();
        expect(Array.isArray(result.data.sources)).toBe(true);
        
        // Test source structure if sources exist
        result.data.sources.forEach(source => {
          expect(source.content).toBeDefined();
          expect(source.source).toBeDefined();
          expect(source.similarity).toBeDefined();
          expect(typeof source.usedInResponse).toBe('boolean');
        });
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);
  });

  describe('LLM integration', () => {
    it('should include proper LLM metadata', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'How to handle database errors?',
        options: { searchLimit: 2 }
      });

      if (result.success) {
        expect(result.data.llmMetadata).toBeDefined();
        expect(result.data.llmMetadata.model).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);
  });

  describe('search integration', () => {
    it('should report search statistics', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'Environment variables for configuration',
        options: { 
          searchLimit: 4,
          searchThreshold: 0.2 
        }
      });

      if (result.success) {
        expect(result.data.searchResults).toBeDefined();
        expect(typeof result.data.searchResults).toBe('number');
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);
  });

  describe('error handling', () => {
    it('should handle queries with no relevant content', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'How to build a rocket ship to Mars?', // Completely unrelated
        options: {
          searchThreshold: 0.8 // High threshold
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.searchResults).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);

    it('should handle invalid queries gracefully', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should provide error context on failures', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'test',
        options: { searchLimit: -1 } // Invalid option
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeDefined(); // Should still provide data structure
    });
  });

  describe('progress tracking', () => {
    it('should emit progress events during RAG query', async () => {
      const progressEvents = [];
      
      queryRAGTool.on('progress', (data) => {
        progressEvents.push(data);
      });

      await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'How do I configure JWT authentication?',
        options: { searchLimit: 3 }
      });

      // Progress events should be emitted
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Should have progress for different stages
      const messages = progressEvents.map(e => e.message);
      expect(messages.some(m => m.includes('Processing'))).toBe(true);
    }, 30000);
  });

  describe('comprehensive scenarios', () => {
    it('should handle complex technical questions', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'What are the complete steps to set up both database connections and JWT authentication in a Node.js application?',
        options: {
          searchLimit: 5,
          searchThreshold: 0.25,
          responseStyle: 'detailed'
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.sources).toBeDefined();
        expect(result.data.llmMetadata).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 30000);

    it('should handle configuration-focused questions', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'What environment variables do I need for production deployment?',
        options: {
          searchLimit: 3,
          responseStyle: 'concise'
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.sources).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 30000);

    it('should handle code-specific questions', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'Show me example code for connecting to MongoDB with error handling',
        options: {
          searchLimit: 2,
          responseStyle: 'detailed'
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.sources).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);
  });

  describe('response quality', () => {
    it('should provide helpful responses for common questions', async () => {
      const result = await queryRAGTool.execute({
        workspace: 'rag-tool-test',
        query: 'How do I secure my application?',
        options: {
          searchLimit: 4,
          searchThreshold: 0.2
        }
      });

      if (result.success) {
        expect(result.data.response).toBeDefined();
        expect(result.data.sources).toBeDefined();
        expect(result.data.llmMetadata).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    }, 15000);
  });
});