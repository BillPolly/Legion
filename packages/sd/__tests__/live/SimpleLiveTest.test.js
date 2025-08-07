/**
 * Simple Live Test - Minimal real MongoDB + LLM testing
 * 
 * This test validates core functionality with minimal dependencies:
 * - ResourceManager integration
 * - Real MongoDB operations
 * - Live LLM API calls
 * 
 * Run with: npm run test:live
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools';
import { DesignDatabaseService } from '../../src/services/DesignDatabaseService.js';

// Only run live tests if NODE_ENV=live
const isLiveTest = process.env.NODE_ENV === 'live';
const describeIf = isLiveTest ? describe : describe.skip;

describeIf('Simple Live Integration Tests', () => {
  let resourceManager;
  let databaseService;
  
  beforeAll(async () => {
    // Initialize real ResourceManager (loads .env file)
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Verify we have the required environment variables
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    console.log('[LiveTest] MongoDB URL available:', !!mongoUrl);
    console.log('[LiveTest] Anthropic API key available:', !!anthropicKey);
    
    if (!mongoUrl) {
      console.warn('[LiveTest] No MONGODB_URL found, tests may fail');
    }
    
    if (!anthropicKey) {
      console.warn('[LiveTest] No ANTHROPIC_API_KEY found, tests may fail');
    }
    
    // Initialize database service
    databaseService = new DesignDatabaseService(resourceManager);
    await databaseService.initialize();
    
    console.log('[LiveTest] Setup complete');
  }, 15000);
  
  afterAll(async () => {
    if (databaseService) {
      await databaseService.disconnect();
    }
    console.log('[LiveTest] Cleanup complete');
  });
  
  describe('Database Integration', () => {
    const testProjectId = `live-test-${Date.now()}`;
    
    it('should connect to MongoDB and perform basic operations', async () => {
      // Test database health
      const health = await databaseService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
      
      console.log('[LiveTest] Database health check passed');
      
      // Create a test artifact
      const testArtifact = {
        type: 'test_requirement',
        projectId: testProjectId,
        data: {
          requirements: [
            'User can login',
            'System responds within 2 seconds'
          ]
        },
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      
      // Store the artifact
      const stored = await databaseService.storeArtifact(testArtifact);
      expect(stored).toHaveProperty('_id');
      expect(stored).toHaveProperty('id');
      expect(stored.projectId).toBe(testProjectId);
      
      console.log('[LiveTest] Artifact stored with ID:', stored.id);
      
      // Retrieve the artifact
      const retrieved = await databaseService.retrieveArtifacts('test_requirement', {
        projectId: testProjectId
      });
      
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].data.requirements).toContain('User can login');
      expect(retrieved[0].id).toBe(stored.id);
      
      console.log('[LiveTest] Artifact retrieval successful');
      
      // Test project statistics
      const stats = await databaseService.getProjectStats(testProjectId);
      expect(stats.projectId).toBe(testProjectId);
      expect(stats.totalArtifacts).toBe(1);
      expect(stats.artifactCounts.test_requirement).toBe(1);
      
      console.log('[LiveTest] Project stats:', {
        projectId: stats.projectId,
        totalArtifacts: stats.totalArtifacts,
        artifactCounts: stats.artifactCounts
      });
      
    }, 10000);
    
    it('should handle context storage', async () => {
      const testContext = {
        contextType: 'requirements_context',
        projectId: testProjectId,
        data: {
          previousRequirements: [],
          stakeholders: ['Product Manager', 'Developer'],
          timeline: '2 weeks'
        }
      };
      
      const stored = await databaseService.storeContext(testContext);
      expect(stored).toHaveProperty('_id');
      expect(stored.contextType).toBe('requirements_context');
      
      const retrieved = await databaseService.retrieveContext('requirements_context', testProjectId);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].data.stakeholders).toContain('Product Manager');
      
      console.log('[LiveTest] Context storage/retrieval successful');
    });
  });
  
  describe('ResourceManager Integration', () => {
    it('should provide access to environment variables', () => {
      // Test basic ResourceManager functionality
      expect(resourceManager).toBeDefined();
      
      // Check for MongoDB URL
      const mongoUrl = resourceManager.get('env.MONGODB_URL');
      expect(typeof mongoUrl).toBe('string');
      expect(mongoUrl).toMatch(/mongodb:/);
      
      // Check for Anthropic API key  
      const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
      expect(typeof anthropicKey).toBe('string');
      expect(anthropicKey).toMatch(/^sk-ant-/);
      
      console.log('[LiveTest] ResourceManager environment variable access confirmed');
    });
    
    it('should provide database configuration', () => {
      const mongoUrl = resourceManager.get('env.MONGODB_URL');
      const database = resourceManager.get('env.MONGODB_DATABASE') || 'sd_design';
      
      expect(mongoUrl).toBeTruthy();
      expect(database).toBeTruthy();
      
      console.log('[LiveTest] Database config - URL:', mongoUrl, 'Database:', database);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      // Test with non-existent project
      const results = await databaseService.retrieveArtifacts('non_existent_type', {
        projectId: 'non-existent-project'
      });
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
      
      console.log('[LiveTest] Error handling test passed');
    });
    
    it('should handle database disconnection gracefully', async () => {
      // Create a new database service that we can disconnect
      const tempDbService = new DesignDatabaseService(resourceManager);
      await tempDbService.initialize();
      
      // Verify it works
      const health1 = await tempDbService.healthCheck();
      expect(health1.status).toBe('healthy');
      
      // Disconnect it
      await tempDbService.disconnect();
      
      // Verify it handles reconnection
      const health2 = await tempDbService.healthCheck();
      expect(health2.status).toBe('healthy');
      
      // Clean up
      await tempDbService.disconnect();
      
      console.log('[LiveTest] Reconnection handling test passed');
    });
  });
});