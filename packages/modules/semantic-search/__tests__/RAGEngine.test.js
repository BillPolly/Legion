import { describe, it, expect, beforeEach, beforeAll, afterEach, jest } from '@jest/globals';
import RAGEngine from '../src/search/RAGEngine.js';
import SemanticSearchEngine from '../src/search/SemanticSearchEngine.js';
import DatabaseSchema from '../src/database/DatabaseSchema.js';
import DocumentIndexer from '../src/indexers/DocumentIndexer.js';
import ContentProcessor from '../src/processors/ContentProcessor.js';
import { ResourceManager } from '@legion/resource-manager';
import { LLMClient } from '@legion/llm';
import { MongoClient } from 'mongodb';

describe('RAGEngine', () => {
  let ragEngine;
  let resourceManager;
  let mongoClient;
  let db;
  let mockLLMClient;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Connect to MongoDB and set up test data
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('semantic-rag-engine-test');
    
    // Set up test data
    const databaseSchema = new DatabaseSchema(db, {
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    });

    const contentProcessor = new ContentProcessor({
      defaultChunkSize: 500,
      defaultOverlap: 0.2,
      maxFileSize: 1024 * 1024
    });

    const documentIndexer = new DocumentIndexer({
      databaseSchema,
      contentProcessor,
      resourceManager,
      options: {
        qdrantCollection: 'rag_engine_test'
      }
    });

    // Index comprehensive test content for RAG
    const testContent = [
      {
        content: `# Database Connection Setup

To establish a database connection in Node.js applications:

1. Install the MongoDB driver: npm install mongodb
2. Create connection string: mongodb://localhost:27017/myapp
3. Set up connection pooling with maxPoolSize: 10
4. Handle connection errors with try-catch blocks
5. Store credentials in environment variables

Example connection code:
const { MongoClient } = require('mongodb');
const client = new MongoClient(connectionString, { maxPoolSize: 10 });

Connection best practices include using connection pooling, handling errors gracefully, and securing credentials.`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/database-setup.md' }
      },
      {
        content: `# Authentication Implementation

JWT-based authentication provides secure user access control:

1. Install dependencies: npm install jsonwebtoken bcrypt
2. Hash passwords with bcrypt before storage
3. Generate JWT tokens on successful login
4. Verify tokens on protected routes
5. Implement refresh token rotation

Security considerations:
- Use strong JWT secrets
- Set appropriate token expiration
- Validate all incoming tokens
- Log authentication attempts

Example middleware:
function authenticateToken(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Access denied' });
  // Verify token logic here
}`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/authentication-guide.md' }
      },
      {
        content: `# Server Configuration

Production server setup requires careful configuration:

Environment variables:
- NODE_ENV=production
- PORT=3000
- DATABASE_URL=mongodb://...
- JWT_SECRET=your-secret-key

Security headers:
- helmet() for security headers
- cors() for cross-origin requests
- rate limiting for API protection

Performance optimization:
- Enable gzip compression
- Use PM2 for process management
- Configure proper logging levels`,
        contentType: 'text/markdown',
        metadata: { source: 'file:///docs/server-config.md' }
      }
    ];

    for (const doc of testContent) {
      await documentIndexer.indexDocument(doc.content, doc.contentType, doc.metadata);
    }
  });

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
    // Create mock LLM client for unit testing
    mockLLMClient = {
      complete: jest.fn()
    };

    const databaseSchema = new DatabaseSchema(db, {
      collections: {
        documents: 'test_documents',
        chunks: 'test_document_chunks'
      }
    });

    const searchEngine = new SemanticSearchEngine({
      databaseSchema,
      resourceManager,
      options: {
        qdrantCollection: 'rag_engine_test'
      }
    });

    ragEngine = new RAGEngine({
      searchEngine,
      llmClient: mockLLMClient,
      resourceManager,
      options: {
        maxContextTokens: 4000,
        includeCitations: true,
        responseMaxLength: 2000
      }
    });
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(ragEngine.searchEngine).toBeInstanceOf(SemanticSearchEngine);
      expect(ragEngine.llmClient).toBe(mockLLMClient);
      expect(ragEngine.options.maxContextTokens).toBe(4000);
    });

    it('should throw error without required dependencies', () => {
      expect(() => {
        new RAGEngine({});
      }).toThrow('SearchEngine is required');
    });
  });

  describe('context assembly', () => {
    it('should assemble search context for LLM prompts', async () => {
      // Mock search results
      const mockSearchResults = [
        {
          content: 'Database connections require proper configuration.',
          similarity: 0.85,
          source: 'file:///docs/db.md',
          title: 'Database Guide'
        },
        {
          content: 'MongoDB driver installation and setup instructions.',
          similarity: 0.78,
          source: 'file:///docs/setup.md', 
          title: 'Setup Guide'
        }
      ];

      const context = ragEngine.assembleContext(mockSearchResults, {
        maxTokens: 1000,
        includeCitations: true
      });

      expect(context.contextText).toBeDefined();
      expect(context.contextText).toContain('Database connections');
      expect(context.contextText).toContain('MongoDB driver');
      expect(context.sources).toHaveLength(2);
      expect(context.tokenCount).toBeGreaterThan(0);
      expect(context.tokenCount).toBeLessThanOrEqual(1000);
    });

    it('should respect token limits when assembling context', async () => {
      const longSearchResults = [
        {
          content: 'This is very long content that would exceed token limits. '.repeat(50),
          similarity: 0.9,
          source: 'file:///long.md'
        },
        {
          content: 'Additional long content for testing purposes. '.repeat(30),
          similarity: 0.8,
          source: 'file:///long2.md'
        }
      ];

      const context = ragEngine.assembleContext(longSearchResults, {
        maxTokens: 1000 // Reasonable limit
      });

      expect(context.tokenCount).toBeLessThanOrEqual(1000);
    });

    it('should include source citations in context', async () => {
      const mockResults = [
        {
          content: 'Database configuration instructions.',
          source: 'file:///guide.md',
          title: 'Configuration Guide'
        }
      ];

      const context = ragEngine.assembleContext(mockResults, {
        includeCitations: true
      });

      expect(context.contextText).toContain('[Source:');
      expect(context.contextText).toContain('guide.md');
    });
  });

  describe('prompt generation', () => {
    it('should generate well-formed RAG prompts', () => {
      const query = 'How do I set up database connections?';
      const context = {
        contextText: 'Database connections require MongoDB driver installation. Use connection strings with proper authentication.',
        sources: [
          { source: 'file:///db.md', title: 'Database Guide' }
        ]
      };

      const prompt = ragEngine.generatePrompt(query, context, {
        responseStyle: 'detailed'
      });

      expect(prompt).toContain(query);
      expect(prompt).toContain(context.contextText);
      expect(prompt).toContain('detailed');
      expect(prompt.length).toBeGreaterThan(100); // Should be substantial
    });

    it('should generate concise prompts when requested', () => {
      const query = 'Quick setup steps?';
      const context = {
        contextText: 'Setup requires installation and configuration.',
        sources: []
      };

      const prompt = ragEngine.generatePrompt(query, context, {
        responseStyle: 'concise'
      });

      expect(prompt).toContain('brief and direct response');
      expect(prompt).toContain(query);
    });
  });

  describe('RAG query execution', () => {
    it('should execute complete RAG workflow', async () => {
      // Mock LLM response
      mockLLMClient.complete.mockResolvedValue(`To set up database connections:

1. Install MongoDB driver: npm install mongodb
2. Create connection string with authentication
3. Configure connection pooling for performance
4. Handle errors with proper try-catch blocks

[Source: database-setup.md] provides detailed configuration steps.`);

      const result = await ragEngine.query('How do I set up database connections?', {
        searchLimit: 3,
        searchThreshold: 0.3,
        responseStyle: 'detailed',
        includeCitations: true
      });

      expect(result.query).toBe('How do I set up database connections?');
      expect(result.response).toBeDefined();
      expect(result.response).toContain('MongoDB driver');
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
      expect(result.llmMetadata).toBeDefined();
      expect(result.searchResults).toBeDefined();

      // Verify LLM was called with proper prompt
      expect(mockLLMClient.complete).toHaveBeenCalled();
      const promptArg = mockLLMClient.complete.mock.calls[0][0];
      expect(promptArg).toContain('How do I set up database connections?');
    });

    it('should handle queries with no search results', async () => {
      mockLLMClient.complete.mockResolvedValue('I don\'t have specific information about that topic in the available documentation.');

      const result = await ragEngine.query('completely unrelated random topic', {
        searchLimit: 5,
        searchThreshold: 0.9 // Very high threshold
      });

      expect(result.query).toBe('completely unrelated random topic');
      expect(result.response).toBeDefined();
      expect(result.sources).toHaveLength(0);
      expect(result.searchResults).toBe(0);
    });

    it('should provide proper source attribution', async () => {
      mockLLMClient.complete.mockResolvedValue(`Authentication setup requires:
1. JWT token generation
2. Password hashing with bcrypt
3. Secure session management

Based on the authentication guide documentation.`);

      const result = await ragEngine.query('How do I implement user authentication?', {
        searchLimit: 2,
        includeCitations: true
      });

      // Sources array should be defined (may be empty if no search results)
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
      
      // If sources exist, they should have proper structure
      result.sources.forEach(source => {
        expect(source.content).toBeDefined();
        expect(source.source).toBeDefined();
        expect(source.similarity).toBeDefined();
        expect(typeof source.usedInResponse).toBe('boolean');
      });
    });
  });

  describe('response processing', () => {
    it('should analyze LLM responses for source usage', () => {
      const llmResponse = `Database setup requires these steps:
1. Install dependencies
2. Configure connection string
3. Set up authentication

[Source: database-setup.md] contains detailed instructions.
[Source: auth-guide.md] explains security considerations.`;

      const sources = [
        { source: 'file:///database-setup.md', content: 'Setup instructions' },
        { source: 'file:///auth-guide.md', content: 'Security guide' },
        { source: 'file:///unused.md', content: 'Not referenced' }
      ];

      const analysis = ragEngine.analyzeResponseSources(llmResponse, sources);

      expect(analysis.usedSources).toHaveLength(2);
      expect(analysis.unusedSources).toHaveLength(1);
      expect(analysis.sourceUtilization).toBeCloseTo(0.67, 1); // 2/3 sources used
    });

    it('should clean and format response text', () => {
      const rawResponse = `   Response with extra whitespace.   

Multiple blank lines here.


End of response.   `;

      const cleaned = ragEngine.cleanResponse(rawResponse);

      expect(cleaned).not.toMatch(/^\s+/); // No leading whitespace
      expect(cleaned).not.toMatch(/\s+$/); // No trailing whitespace
      expect(cleaned).not.toMatch(/\n{3,}/); // No excessive line breaks
    });
  });

  describe('error handling', () => {
    it('should handle LLM service failures gracefully', async () => {
      mockLLMClient.complete.mockRejectedValue(new Error('LLM service unavailable'));

      await expect(
        ragEngine.query('test query')
      ).rejects.toThrow('RAG query failed: LLM service unavailable');
    });

    it('should handle search engine failures', async () => {
      // Test with search engine that throws errors
      const failingSearchEngine = {
        search: jest.fn().mockRejectedValue(new Error('Search service down'))
      };

      const invalidRAG = new RAGEngine({
        searchEngine: failingSearchEngine,
        llmClient: mockLLMClient,
        resourceManager
      });

      await expect(
        invalidRAG.query('test query')
      ).rejects.toThrow('RAG query failed: Search service down');
    });

    it('should handle empty queries', async () => {
      await expect(
        ragEngine.query('')
      ).rejects.toThrow('Query cannot be empty');
    });
  });

  describe('configuration options', () => {
    it('should respect response style settings', async () => {
      mockLLMClient.complete
        .mockResolvedValueOnce('Detailed response with comprehensive explanations.')
        .mockResolvedValueOnce('Brief answer.');

      const detailedResult = await ragEngine.query('test query', {
        responseStyle: 'detailed'
      });

      const conciseResult = await ragEngine.query('test query', {
        responseStyle: 'concise'
      });

      // Verify different prompts were generated
      expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
      
      const detailedPrompt = mockLLMClient.complete.mock.calls[0][0];
      const concisePrompt = mockLLMClient.complete.mock.calls[1][0];
      
      expect(detailedPrompt).toContain('comprehensive and detailed');
      expect(concisePrompt).toContain('brief and direct');
    });

    it('should handle search limit configurations', async () => {
      mockLLMClient.complete.mockResolvedValue('Test response');

      await ragEngine.query('configuration help', {
        searchLimit: 2
      });

      // Should have attempted search with limit of 2
      expect(mockLLMClient.complete).toHaveBeenCalled();
    });
  });

  describe('token management', () => {
    it('should estimate token counts accurately', () => {
      const text = 'This is a test sentence with multiple words for counting.';
      const tokenCount = ragEngine.estimateTokenCount(text);
      
      expect(tokenCount).toBeGreaterThan(5); // Should detect multiple tokens
      expect(tokenCount).toBeLessThan(20); // Reasonable upper bound
    });

    it('should handle very long text appropriately', () => {
      const longText = 'Word '.repeat(1000); // Very long text
      const tokenCount = ragEngine.estimateTokenCount(longText);
      
      expect(tokenCount).toBeGreaterThan(500);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex multi-topic queries', async () => {
      mockLLMClient.complete.mockResolvedValue(`For database and authentication setup:

Database Configuration:
1. Install MongoDB driver
2. Set up connection strings
3. Configure connection pooling

Authentication Setup:
1. Implement JWT tokens
2. Hash passwords securely
3. Set up protected routes

Both topics are covered in the documentation sources.`);

      const result = await ragEngine.query('How do I set up both database and authentication?', {
        searchLimit: 4,
        searchThreshold: 0.25
      });

      expect(result.response).toContain('database');
      expect(result.response).toContain('authentication');
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
      
      // If sources are found, they should be relevant to the topics
      if (result.sources.length > 0) {
        const dbSources = result.sources.filter(s => 
          s.content.includes('database') || s.source.includes('database')
        );
        const authSources = result.sources.filter(s => 
          s.content.includes('authentication') || s.source.includes('auth')
        );
        
        expect(dbSources.length + authSources.length).toBeGreaterThan(0);
      }
    });
  });
});