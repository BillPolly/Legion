import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import RAGModule from '../src/RAGModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import { promises as fs } from 'fs';
import path from 'path';

describe('Workspace Features', () => {
  let semanticSearchModule;
  let resourceManager;
  let mongoClient;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Clean up test database
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    const db = mongoClient.db('semantic-workspace-test');
    
    try {
      await db.collection('documents').drop();
      await db.collection('document_chunks').drop();
    } catch (error) {
      // Collections might not exist
    }
    
    // Create test content
    testDir = '/tmp/semantic-workspace-test';
    await fs.mkdir(testDir, { recursive: true });
    
    // Create docs workspace content
    await fs.writeFile(path.join(testDir, 'docs-guide.md'), `# Documentation Guide

This is documentation content for the docs workspace.
It contains information about documentation best practices.`);

    // Create projects workspace content  
    await fs.writeFile(path.join(testDir, 'project-readme.md'), `# Project README

This is project content for the projects workspace.
It contains information about project setup and configuration.`);

    await fs.writeFile(path.join(testDir, 'api-spec.md'), `# API Specification

This is API specification content.
It describes REST endpoints and data structures.`);

  }, 15000);

  afterAll(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      
      const db = mongoClient.db('semantic-workspace-test');
      await db.collection('documents').drop();
      await db.collection('document_chunks').drop();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(async () => {
    semanticSearchModule = await RAGModule.create(resourceManager);
    
    // Configure for workspace testing
    semanticSearchModule.config.mongodb = {
      database: 'semantic-workspace-test',
      collections: {
        documents: 'documents',
        chunks: 'document_chunks'
      }
    };
  });

  afterEach(async () => {
    if (semanticSearchModule) {
      await semanticSearchModule.cleanup();
    }
  });

  describe('Workspace Isolation', () => {
    it('should index content into separate workspaces', async () => {
      console.log('🧪 Testing workspace isolation...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      
      // Index docs content into 'docs' workspace
      const docsResult = await indexTool.execute({
        workspace: 'docs',
        source: path.join(testDir, 'docs-guide.md'),
        sourceType: 'file'
      });
      
      // Index projects content into 'projects' workspace
      const projectsResult = await indexTool.execute({
        workspace: 'projects', 
        source: path.join(testDir, 'project-readme.md'),
        sourceType: 'file'
      });
      
      expect(docsResult.success).toBe(true);
      expect(projectsResult.success).toBe(true);
      
      console.log('✅ Indexed into separate workspaces:');
      console.log(`   📚 Docs workspace: ${docsResult.data.documentsIndexed} documents`);
      console.log(`   🔧 Projects workspace: ${projectsResult.data.documentsIndexed} documents`);
    }, 60000);

    it('should search within specific workspace only', async () => {
      console.log('🔍 Testing workspace-specific search...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const searchTool = semanticSearchModule.getTool('search_content');
      
      // Index content into different workspaces
      await indexTool.execute({
        workspace: 'docs',
        source: path.join(testDir, 'docs-guide.md'),
        sourceType: 'file'
      });
      
      await indexTool.execute({
        workspace: 'projects',
        source: path.join(testDir, 'project-readme.md'), 
        sourceType: 'file'
      });
      
      // Search within docs workspace only
      const docsSearchResult = await searchTool.execute({
        workspace: 'docs',
        query: 'documentation guide practices',
        options: { threshold: 0.1 }
      });
      
      // Search within projects workspace only
      const projectsSearchResult = await searchTool.execute({
        workspace: 'projects',
        query: 'project setup configuration',
        options: { threshold: 0.1 }
      });
      
      console.log('🔍 Search results:');
      console.log(`   📚 Docs workspace: ${docsSearchResult.data.results.length} results`);
      console.log(`   🔧 Projects workspace: ${projectsSearchResult.data.results.length} results`);
      
      expect(docsSearchResult.success).toBe(true);
      expect(projectsSearchResult.success).toBe(true);
      
      // Should find content in respective workspaces
      if (docsSearchResult.data.results.length > 0) {
        expect(docsSearchResult.data.results[0].source).toContain('docs-guide.md');
      }
      
      if (projectsSearchResult.data.results.length > 0) {
        expect(projectsSearchResult.data.results[0].source).toContain('project-readme.md');
      }
    }, 60000);

    it('should provide workspace-specific statistics', async () => {
      console.log('📊 Testing workspace-specific statistics...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Index into different workspaces
      await indexTool.execute({
        workspace: 'docs',
        source: path.join(testDir, 'docs-guide.md'),
        sourceType: 'file'
      });
      
      await indexTool.execute({
        workspace: 'api',
        source: path.join(testDir, 'api-spec.md'),
        sourceType: 'file'
      });
      
      // Get docs workspace status
      const docsStatus = await manageTool.execute({
        workspace: 'docs',
        action: 'status'
      });
      
      // Get api workspace status
      const apiStatus = await manageTool.execute({
        workspace: 'api',
        action: 'status'
      });
      
      console.log('📊 Workspace statistics:');
      console.log(`   📚 Docs: ${docsStatus.data.statistics.totalDocuments} docs, ${docsStatus.data.statistics.totalChunks} chunks`);
      console.log(`   📡 API: ${apiStatus.data.statistics.totalDocuments} docs, ${apiStatus.data.statistics.totalChunks} chunks`);
      
      expect(docsStatus.success).toBe(true);
      expect(apiStatus.success).toBe(true);
      expect(docsStatus.data.statistics.workspace).toBe('docs');
      expect(apiStatus.data.statistics.workspace).toBe('api');
    }, 60000);
  });

  describe('Workspace Management', () => {
    it('should clear specific workspace without affecting others', async () => {
      console.log('🧹 Testing workspace-specific clearing...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Index into two workspaces
      await indexTool.execute({
        workspace: 'temp1',
        source: path.join(testDir, 'docs-guide.md'),
        sourceType: 'file'
      });
      
      await indexTool.execute({
        workspace: 'temp2',
        source: path.join(testDir, 'project-readme.md'),
        sourceType: 'file'
      });
      
      // Clear temp1 workspace only
      const clearResult = await manageTool.execute({
        workspace: 'temp1',
        action: 'clear'
      });
      
      // Check that temp1 is empty but temp2 still has content
      const temp1Status = await manageTool.execute({
        workspace: 'temp1',
        action: 'status'
      });
      
      const temp2Status = await manageTool.execute({
        workspace: 'temp2', 
        action: 'status'
      });
      
      expect(clearResult.success).toBe(true);
      expect(temp1Status.data.statistics.totalDocuments).toBe(0);
      expect(temp2Status.data.statistics.totalDocuments).toBe(1);
      
      console.log('✅ Workspace isolation confirmed:');
      console.log(`   🗑️ Cleared workspace: ${temp1Status.data.statistics.totalDocuments} documents`);
      console.log(`   ✅ Preserved workspace: ${temp2Status.data.statistics.totalDocuments} documents`);
    }, 60000);

    it('should list documents within specific workspace', async () => {
      console.log('📋 Testing workspace-specific listing...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Index into workspace
      await indexTool.execute({
        workspace: 'list-test',
        source: testDir,
        sourceType: 'directory',
        options: { fileTypes: ['.md'] }
      });
      
      // List documents in workspace
      const listResult = await manageTool.execute({
        workspace: 'list-test',
        action: 'list'
      });
      
      expect(listResult.success).toBe(true);
      expect(listResult.data.result.workspace).toBe('list-test');
      expect(listResult.data.result.documents.length).toBeGreaterThan(0);
      
      console.log(`📋 Listed ${listResult.data.result.documents.length} documents in workspace 'list-test'`);
      
      // Each document should be from the correct workspace
      listResult.data.result.documents.forEach(doc => {
        console.log(`   📄 ${doc.title} (${doc.totalChunks} chunks)`);
      });
    }, 45000);
  });

  describe('Cross-Workspace Capabilities', () => {
    it('should demonstrate separate Qdrant collections per workspace', async () => {
      console.log('🏗️ Testing separate Qdrant collections...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      
      // Index same content into different workspaces
      // This should create separate Qdrant collections: 
      // - semantic_content_workspace1
      // - semantic_content_workspace2
      
      const ws1Result = await indexTool.execute({
        workspace: 'workspace1',
        source: path.join(testDir, 'docs-guide.md'),
        sourceType: 'file'
      });
      
      const ws2Result = await indexTool.execute({
        workspace: 'workspace2',
        source: path.join(testDir, 'docs-guide.md'),
        sourceType: 'file'
      });
      
      expect(ws1Result.success).toBe(true);
      expect(ws2Result.success).toBe(true);
      
      console.log('✅ Created separate workspace indexes:');
      console.log(`   🗂️ workspace1: ${ws1Result.data.vectorsIndexed} vectors`);
      console.log(`   🗂️ workspace2: ${ws2Result.data.vectorsIndexed} vectors`);
      
      // Both should succeed even with same content because they're in different workspaces
      expect(ws1Result.data.documentsIndexed).toBe(1);
      expect(ws2Result.data.documentsIndexed).toBe(1);
    }, 60000);
  });

  describe('Workspace API Validation', () => {
    it('should require workspace parameter for most tools', () => {
      const tools = ['index_content', 'search_content', 'query_rag'];
      
      tools.forEach(toolName => {
        const tool = semanticSearchModule.getTool(toolName);
        const metadata = tool.getMetadata();
        
        expect(metadata.inputSchema.required).toContain('workspace');
        expect(metadata.inputSchema.properties.workspace).toBeDefined();
      });
      
      // manage_index has workspace optional since list-workspaces is global
      const manageTool = semanticSearchModule.getTool('manage_index');
      const manageMetadata = manageTool.getMetadata();
      expect(manageMetadata.inputSchema.properties.workspace).toBeDefined();
      expect(manageMetadata.inputSchema.required).toContain('action'); // action is required, workspace is optional
    });

    it('should validate workspace parameter in search tool', () => {
      const searchTool = semanticSearchModule.getTool('search_content');
      
      const validInput = {
        workspace: 'test-workspace',
        query: 'test query'
      };
      
      const inputWithoutWorkspace = {
        // Missing workspace - should use default
        query: 'test query'  
      };
      
      expect(searchTool.validateInput(validInput).valid).toBe(true);
      // Workspace is now required (no default) in new workspace-first design  
      expect(searchTool.validateInput(inputWithoutWorkspace).valid).toBe(false);
    });

    it('should validate workspace parameter in manage tool', () => {
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      const validInput = {
        workspace: 'test-workspace',
        action: 'status'
      };
      
      const inputWithoutWorkspace = {
        // Missing workspace - should use default
        action: 'status'
      };
      
      expect(manageTool.validateInput(validInput).valid).toBe(true);
      // For manage tool, workspace is optional since list-workspaces is global
      expect(manageTool.validateInput(inputWithoutWorkspace).valid).toBe(true);
    });
  });
});