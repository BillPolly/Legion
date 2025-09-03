import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import RAGModule from '../src/RAGModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import { promises as fs } from 'fs';
import path from 'path';

describe('Complete Workspace Management', () => {
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
    const db = mongoClient.db('semantic-workspace-mgmt-test');
    
    try {
      await db.collection('documents').drop();
      await db.collection('document_chunks').drop();
    } catch (error) {
      // Collections might not exist
    }
    
    // Create test content
    testDir = '/tmp/workspace-management-test';
    await fs.mkdir(testDir, { recursive: true });
    
    await fs.writeFile(path.join(testDir, 'docs-content.md'), `# Documentation Content
This is documentation for workspace management testing.`);

    await fs.writeFile(path.join(testDir, 'api-content.md'), `# API Content  
This is API documentation for workspace testing.`);

    await fs.writeFile(path.join(testDir, 'project-content.md'), `# Project Content
This is project documentation for workspace testing.`);

  }, 15000);

  afterAll(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      
      const db = mongoClient.db('semantic-workspace-mgmt-test');
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
    
    // Configure for workspace management testing
    semanticSearchModule.config.mongodb = {
      database: 'semantic-workspace-mgmt-test',
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

  describe('list-workspaces command', () => {
    it('should list all workspaces with statistics', async () => {
      console.log('🧪 Testing list-workspaces command...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Create multiple workspaces
      await indexTool.execute({
        workspace: 'docs',
        source: path.join(testDir, 'docs-content.md'),
        sourceType: 'file'
      });
      
      await indexTool.execute({
        workspace: 'api',
        source: path.join(testDir, 'api-content.md'),
        sourceType: 'file'
      });
      
      await indexTool.execute({
        workspace: 'projects',
        source: path.join(testDir, 'project-content.md'),
        sourceType: 'file'
      });
      
      // List all workspaces
      const listResult = await manageTool.execute({
        workspace: 'any', // Ignored for list-workspaces
        action: 'list-workspaces'
      });
      
      expect(listResult.success).toBe(true);
      expect(listResult.data.result.workspaces).toBeDefined();
      expect(Array.isArray(listResult.data.result.workspaces)).toBe(true);
      expect(listResult.data.result.workspaces.length).toBe(3);
      
      // Check workspace details
      const workspaceNames = listResult.data.result.workspaces.map(ws => ws.name);
      expect(workspaceNames).toContain('docs');
      expect(workspaceNames).toContain('api');
      expect(workspaceNames).toContain('projects');
      
      // Each workspace should have statistics
      listResult.data.result.workspaces.forEach(workspace => {
        expect(workspace.name).toBeDefined();
        expect(workspace.documentCount).toBeGreaterThan(0);
        expect(workspace.chunkCount).toBeGreaterThan(0);
        expect(workspace.qdrantCollection).toBeDefined();
        expect(workspace.status).toBe('active');
        expect(workspace.lastIndexed).toBeDefined();
      });
      
      console.log(`✅ Found ${listResult.data.result.workspaces.length} workspaces`);
    }, 60000);

    it('should return empty list when no workspaces exist', async () => {
      // Use a separate clean database for this test
      const cleanModule = await RAGModule.create(resourceManager);
      cleanModule.config.mongodb.database = 'semantic-empty-workspace-test';
      
      const manageTool = cleanModule.getTool('manage_index');
      
      const listResult = await manageTool.execute({
        workspace: 'any',
        action: 'list-workspaces'
      });
      
      expect(listResult.success).toBe(true);
      expect(listResult.data.result.workspaces).toHaveLength(0);
      expect(listResult.data.result.totalWorkspaces).toBe(0);
      expect(listResult.data.result.totalDocuments).toBe(0);
      
      await cleanModule.cleanup();
    });
  });

  describe('workspace-info command', () => {
    it('should provide detailed workspace information', async () => {
      console.log('🧪 Testing workspace-info command...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Create workspace with content
      await indexTool.execute({
        workspace: 'info-test',
        source: path.join(testDir, 'docs-content.md'),
        sourceType: 'file'
      });
      
      // Get detailed workspace info
      const infoResult = await manageTool.execute({
        workspace: 'info-test',
        action: 'workspace-info'
      });
      
      expect(infoResult.success).toBe(true);
      expect(infoResult.data.result.workspace).toBe('info-test');
      expect(infoResult.data.result.statistics).toBeDefined();
      expect(infoResult.data.result.contentTypes).toBeDefined();
      expect(infoResult.data.result.recentDocuments).toBeDefined();
      expect(infoResult.data.result.qdrant).toBeDefined();
      expect(infoResult.data.result.qdrant.collection).toBe('semantic_content_info_test');
      
      // Should have at least one content type
      expect(infoResult.data.result.contentTypes.length).toBeGreaterThan(0);
      expect(infoResult.data.result.contentTypes[0].type).toBe('text/markdown');
      expect(infoResult.data.result.contentTypes[0].count).toBe(1);
      
      console.log(`✅ Workspace info for 'info-test': ${infoResult.data.result.statistics.totalDocuments} docs`);
    }, 30000);

    it('should handle non-existent workspace gracefully', async () => {
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      const infoResult = await manageTool.execute({
        workspace: 'non-existent-workspace',
        action: 'workspace-info'
      });
      
      expect(infoResult.success).toBe(false);
      expect(infoResult.error).toContain('does not exist');
    });
  });

  describe('delete-workspace command', () => {
    it('should completely delete workspace and Qdrant collection', async () => {
      console.log('🧪 Testing delete-workspace command...');
      
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Create workspace to delete
      await indexTool.execute({
        workspace: 'delete-test',
        source: path.join(testDir, 'docs-content.md'),
        sourceType: 'file'
      });
      
      // Verify workspace exists
      const beforeDelete = await manageTool.execute({
        workspace: 'delete-test',
        action: 'status'
      });
      expect(beforeDelete.success).toBe(true);
      expect(beforeDelete.data.statistics.totalDocuments).toBe(1);
      
      // Delete the workspace
      const deleteResult = await manageTool.execute({
        workspace: 'delete-test',
        action: 'delete-workspace'
      });
      
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.data.result.workspace).toBe('delete-test');
      expect(deleteResult.data.result.deleted).toBe(true);
      expect(deleteResult.data.result.mongodb.documentsDeleted).toBe(1);
      expect(deleteResult.data.result.mongodb.chunksDeleted).toBeGreaterThan(0);
      expect(deleteResult.data.result.qdrant.collection).toBe('semantic_content_delete_test');
      
      // Verify workspace is gone
      const afterDelete = await manageTool.execute({
        workspace: 'delete-test',
        action: 'status'
      });
      expect(afterDelete.data.statistics.totalDocuments).toBe(0);
      
      console.log(`✅ Deleted workspace 'delete-test': ${deleteResult.data.result.mongodb.documentsDeleted} docs removed`);
    }, 45000);

    it('should handle deleting non-existent workspace', async () => {
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      const deleteResult = await manageTool.execute({
        workspace: 'non-existent',
        action: 'delete-workspace'
      });
      
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toContain('does not exist');
    });
  });

  describe('Complete workspace lifecycle', () => {
    it('should demonstrate full workspace management workflow', async () => {
      console.log('🧪 Testing complete workspace lifecycle...');
      
      // Use clean database for isolated lifecycle test
      const lifecycleModule = await RAGModule.create(resourceManager);
      lifecycleModule.config.mongodb.database = 'semantic-lifecycle-test';
      
      const indexTool = lifecycleModule.getTool('index_content');
      const searchTool = lifecycleModule.getTool('search_content');
      const manageTool = lifecycleModule.getTool('manage_index');

      // Step 1: Create multiple workspaces
      console.log('   📚 Creating workspaces...');
      await indexTool.execute({
        workspace: 'lifecycle-docs',
        source: path.join(testDir, 'docs-content.md'),
        sourceType: 'file'
      });
      
      await indexTool.execute({
        workspace: 'lifecycle-api',
        source: path.join(testDir, 'api-content.md'),
        sourceType: 'file'
      });

      // Step 2: List all workspaces
      console.log('   📋 Listing workspaces...');
      const listResult = await manageTool.execute({
        workspace: 'any',
        action: 'list-workspaces'
      });
      
      expect(listResult.success).toBe(true);
      expect(listResult.data.result.workspaces.length).toBe(2);
      
      // Step 3: Get detailed info for each workspace
      console.log('   📊 Getting workspace info...');
      for (const workspace of ['lifecycle-docs', 'lifecycle-api']) {
        const infoResult = await manageTool.execute({
          workspace: workspace,
          action: 'workspace-info'
        });
        
        expect(infoResult.success).toBe(true);
        expect(infoResult.data.result.workspace).toBe(workspace);
        expect(infoResult.data.result.statistics.totalDocuments).toBe(1);
      }

      // Step 4: Search within specific workspace
      console.log('   🔍 Testing workspace search...');
      const searchResult = await searchTool.execute({
        workspace: 'lifecycle-docs',
        query: 'documentation workspace'
      });
      
      expect(searchResult.success).toBe(true);

      // Step 5: Delete one workspace
      console.log('   🗑️ Deleting workspace...');
      const deleteResult = await manageTool.execute({
        workspace: 'lifecycle-docs',
        action: 'delete-workspace'
      });
      
      expect(deleteResult.success).toBe(true);
      
      // Step 6: Verify workspace list updated
      console.log('   📋 Verifying deletion...');
      const finalListResult = await manageTool.execute({
        workspace: 'any',
        action: 'list-workspaces'
      });
      
      expect(finalListResult.success).toBe(true);
      expect(finalListResult.data.result.workspaces.length).toBe(1);
      expect(finalListResult.data.result.workspaces[0].name).toBe('lifecycle-api');
      
      console.log('✅ Complete workspace lifecycle test passed');
      
      await lifecycleModule.cleanup();
    }, 90000);
  });

  describe('Workspace validation and error handling', () => {
    it('should validate workspace names for new commands', () => {
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Test valid inputs
      expect(manageTool.validateInput({ workspace: 'docs', action: 'list-workspaces' }).valid).toBe(true);
      expect(manageTool.validateInput({ action: 'list-workspaces' }).valid).toBe(true); // Global action
      expect(manageTool.validateInput({ workspace: 'test-workspace', action: 'delete-workspace' }).valid).toBe(true);
      expect(manageTool.validateInput({ workspace: 'my-project', action: 'workspace-info' }).valid).toBe(true);
      
      // Test invalid inputs  
      expect(manageTool.validateInput({ workspace: 'test', action: 'invalid-action' }).valid).toBe(false); // Invalid action should fail
      
      // Empty workspace with actions that require workspace should be handled by implementation, not schema
      // Since workspace is now optional in schema, this test focuses on action validation
    });

    it('should handle missing workspace parameter for workspace-specific commands', async () => {
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // workspace-info requires workspace
      const result = await manageTool.execute({
        workspace: '',
        action: 'workspace-info'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Integration with existing commands', () => {
    it('should work alongside existing workspace commands', async () => {
      const indexTool = semanticSearchModule.getTool('index_content');
      const manageTool = semanticSearchModule.getTool('manage_index');
      
      // Create workspace
      await indexTool.execute({
        workspace: 'integration-test',
        source: path.join(testDir, 'docs-content.md'),
        sourceType: 'file'
      });
      
      // Test all commands work together
      const statusResult = await manageTool.execute({
        workspace: 'integration-test',
        action: 'status'
      });
      
      const listResult = await manageTool.execute({
        workspace: 'integration-test',
        action: 'list'
      });
      
      const infoResult = await manageTool.execute({
        workspace: 'integration-test',
        action: 'workspace-info'
      });
      
      const workspacesResult = await manageTool.execute({
        workspace: 'integration-test',
        action: 'list-workspaces'
      });
      
      expect(statusResult.success).toBe(true);
      expect(listResult.success).toBe(true);
      expect(infoResult.success).toBe(true);
      expect(workspacesResult.success).toBe(true);
      
      // All should reference the same workspace data
      expect(statusResult.data.statistics.totalDocuments).toBe(1);
      expect(listResult.data.result.documents.length).toBe(1);
      expect(infoResult.data.result.statistics.totalDocuments).toBe(1);
      expect(workspacesResult.data.result.workspaces.some(ws => ws.name === 'integration-test')).toBe(true);
    }, 60000);
  });
});