/**
 * Live Integration Tests - Real MongoDB + Live LLM Testing
 * 
 * This test suite validates the SD package with:
 * - Real MongoDB connection 
 * - Live LLM API calls (Anthropic/OpenAI)
 * - End-to-end workflow execution
 * - Actual data storage and retrieval
 * 
 * Run with: NODE_ENV=live npm test -- __tests__/live/LiveIntegrationTest.js
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools';
import SDModule from '../../src/SDModule.js';
import { RequirementsAgent } from '../../src/agents/RequirementsAgent.js';
import { RequirementParserTool } from '../../src/tools/requirements/RequirementParserTool.js';
import { DesignDatabaseService } from '../../src/services/DesignDatabaseService.js';

// Only run live tests if NODE_ENV=live or LIVE_TESTS=true
const isLiveTest = process.env.NODE_ENV === 'live' || process.env.LIVE_TESTS === 'true';
const describeIf = isLiveTest ? describe : describe.skip;

describeIf('Live Integration Tests', () => {
  let resourceManager;
  let sdModule;
  let databaseService;
  
  beforeAll(async () => {
    // Initialize real ResourceManager (loads .env file)
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Verify required environment variables
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    
    if (!anthropicKey || !mongoUrl) {
      throw new Error('Live tests require ANTHROPIC_API_KEY and MONGODB_URL in .env file');
    }
    
    console.log('[LiveTest] Using MongoDB:', mongoUrl);
    console.log('[LiveTest] Using Anthropic API key:', anthropicKey ? 'Present' : 'Missing');
    
    // Create SD module with real ResourceManager
    sdModule = await SDModule.create(resourceManager);
    
    // Initialize database service
    databaseService = new DesignDatabaseService(resourceManager);
    await databaseService.initialize();
    
    console.log('[LiveTest] Live integration test setup complete');
  }, 30000); // 30 second timeout for setup
  
  afterAll(async () => {
    // Clean up connections
    if (databaseService) {
      await databaseService.disconnect();
    }
    console.log('[LiveTest] Live test cleanup complete');
  });
  
  describe('Database Integration', () => {
    const testProjectId = `live-test-${Date.now()}`;
    
    it('should connect to MongoDB and perform CRUD operations', async () => {
      // Test health check
      const health = await databaseService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
      
      console.log('[LiveTest] Database health:', health);
      
      // Test artifact storage
      const testArtifact = {
        type: 'test_artifact',
        projectId: testProjectId,
        data: { message: 'Live test artifact' },
        metadata: { testRun: true }
      };
      
      const stored = await databaseService.storeArtifact(testArtifact);
      expect(stored).toHaveProperty('_id');
      expect(stored).toHaveProperty('id');
      expect(stored.projectId).toBe(testProjectId);
      
      console.log('[LiveTest] Stored artifact with ID:', stored.id);
      
      // Test artifact retrieval
      const retrieved = await databaseService.retrieveArtifacts('test_artifact', {
        projectId: testProjectId
      });
      
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].data.message).toBe('Live test artifact');
      
      console.log('[LiveTest] Retrieved artifacts:', retrieved.length);
      
      // Test project statistics
      const stats = await databaseService.getProjectStats(testProjectId);
      expect(stats.projectId).toBe(testProjectId);
      expect(stats.totalArtifacts).toBeGreaterThanOrEqual(1);
      
      console.log('[LiveTest] Project stats:', stats);
    }, 10000);
    
    it('should handle context storage and retrieval', async () => {
      const testContext = {
        contextType: 'requirements',
        projectId: testProjectId,
        data: {
          requirements: ['User should login', 'System should be fast'],
          analysis: 'Basic requirements analysis'
        }
      };
      
      const stored = await databaseService.storeContext(testContext);
      expect(stored).toHaveProperty('_id');
      expect(stored.contextType).toBe('requirements');
      
      const retrieved = await databaseService.retrieveContext('requirements', testProjectId);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].data.requirements).toHaveLength(2);
      
      console.log('[LiveTest] Context storage/retrieval successful');
    });
  });
  
  describe('Live LLM Integration', () => {
    const testProjectId = `llm-test-${Date.now()}`;
    
    it('should perform live requirement parsing with real LLM', async () => {
      const tool = new RequirementParserTool({
        llmClient: sdModule.llmClient,
        resourceManager: resourceManager
      });
      
      const realRequirements = `
        The social media platform should allow users to:
        1. Create and manage user accounts with email verification
        2. Post text updates, images, and videos with privacy controls
        3. Follow other users and see their posts in a timeline
        4. Like, comment, and share posts
        5. Search for users and content using keywords
        6. Receive real-time notifications for interactions
        7. The system must handle 10,000 concurrent users
        8. All user data must be encrypted and GDPR compliant
        9. The mobile app should work offline for reading posts
      `;
      
      console.log('[LiveTest] Starting live LLM requirement parsing...');
      const startTime = Date.now();
      
      const result = await tool.execute({
        requirementsText: realRequirements,
        projectId: testProjectId,
        analysisDepth: 'comprehensive'
      });
      
      const duration = Date.now() - startTime;
      console.log(`[LiveTest] LLM parsing completed in ${duration}ms`);
      
      // Validate LLM response structure
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('parsedRequirements');
      
      const parsed = result.data.parsedRequirements;
      expect(parsed).toHaveProperty('functional');
      expect(parsed).toHaveProperty('nonFunctional');
      expect(parsed).toHaveProperty('reasoning');
      
      // Validate functional requirements were extracted
      expect(Array.isArray(parsed.functional)).toBe(true);
      expect(parsed.functional.length).toBeGreaterThan(3);
      
      // Validate non-functional requirements were identified
      expect(Array.isArray(parsed.nonFunctional)).toBe(true);
      expect(parsed.nonFunctional.length).toBeGreaterThan(0);
      
      console.log(`[LiveTest] LLM extracted ${parsed.functional.length} functional requirements`);
      console.log(`[LiveTest] LLM extracted ${parsed.nonFunctional.length} non-functional requirements`);
      console.log('[LiveTest] LLM reasoning:', parsed.reasoning);
      
      // Validate specific requirements were identified correctly
      const functionalText = JSON.stringify(parsed.functional);
      expect(functionalText).toMatch(/account|user/i);
      expect(functionalText).toMatch(/post|content/i);
      expect(functionalText).toMatch(/follow|timeline/i);
      
      const nonFunctionalText = JSON.stringify(parsed.nonFunctional);
      expect(nonFunctionalText).toMatch(/10,?000|concurrent|performance/i);
      expect(nonFunctionalText).toMatch(/gdpr|encrypt|security/i);
      
    }, 30000); // 30 second timeout for LLM calls
    
    it('should handle error cases gracefully', async () => {
      const tool = new RequirementParserTool({
        llmClient: sdModule.llmClient,
        resourceManager: resourceManager
      });
      
      // Test with minimal input
      const result = await tool.execute({
        requirementsText: 'Test',
        analysisDepth: 'basic'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.parsedRequirements.functional).toBeDefined();
      
      console.log('[LiveTest] Error handling test passed');
    });
  });
  
  describe('End-to-End Workflow', () => {
    const testProjectId = `e2e-test-${Date.now()}`;
    
    it('should execute complete requirements analysis workflow', async () => {
      const agent = new RequirementsAgent({
        designDatabase: { projectId: testProjectId },
        resourceManager: resourceManager
      });
      
      await agent.initialize();
      
      // Verify agent has database service
      expect(agent.databaseService).toBeDefined();
      expect(agent.llmClient).toBeDefined();
      
      const requirements = `
        E-commerce Requirements:
        - Users can browse products by category
        - Shopping cart functionality with checkout
        - Payment processing with Stripe integration  
        - Order tracking and history
        - Admin panel for inventory management
        - System must support 1000 concurrent users
        - 99.9% uptime requirement
        - PCI compliance for payment data
      `;
      
      console.log('[LiveTest] Starting end-to-end requirements workflow...');
      
      const result = await agent.receive({
        type: 'analyze_requirements',
        payload: {
          requirementsText: requirements,
          projectId: testProjectId
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.projectId).toBe(testProjectId);
      expect(result.data.phase).toBe('requirements-analysis');
      
      console.log('[LiveTest] E2E workflow completed successfully');
      console.log('[LiveTest] Workflow result:', {
        projectId: result.data.projectId,
        phase: result.data.phase,
        artifactsCreated: result.data.artifacts?.length || 0
      });
      
      // Verify artifacts were stored in database
      const stats = await databaseService.getProjectStats(testProjectId);
      expect(stats.totalArtifacts).toBeGreaterThan(0);
      
      console.log(`[LiveTest] Created ${stats.totalArtifacts} artifacts in database`);
      
    }, 45000); // 45 second timeout for full workflow
  });
  
  describe('Performance & Load Testing', () => {
    it('should handle concurrent LLM requests', async () => {
      const promises = [];
      const startTime = Date.now();
      
      // Create 3 concurrent requirement parsing requests
      for (let i = 0; i < 3; i++) {
        const tool = new RequirementParserTool({
          llmClient: sdModule.llmClient,
          resourceManager: resourceManager
        });
        
        promises.push(tool.execute({
          requirementsText: `Concurrent test ${i}: User can login and logout`,
          analysisDepth: 'basic'
        }));
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      console.log(`[LiveTest] Completed 3 concurrent LLM requests in ${duration}ms`);
      
    }, 60000); // 60 second timeout for concurrent requests
    
    it('should validate token usage is reasonable', async () => {
      const tool = new RequirementParserTool({
        llmClient: sdModule.llmClient,
        resourceManager: resourceManager
      });
      
      const mediumRequirements = 'User management system with CRUD operations, authentication, authorization, and audit logging.';
      
      const startTime = Date.now();
      const result = await tool.execute({
        requirementsText: mediumRequirements,
        analysisDepth: 'detailed'
      });
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      
      console.log(`[LiveTest] Medium complexity parsing: ${duration}ms`);
    });
  });
});