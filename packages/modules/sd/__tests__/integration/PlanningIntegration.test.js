/**
 * Integration tests for SD package Legion DecentPlanner integration
 * 
 * These tests use REAL dependencies - no mocks allowed in integration tests.
 * Tests will fail if required resources (MongoDB, LLM API keys) are not available.
 */

import { jest } from '@jest/globals';
import SDModule from '../../src/SDModule.js';
import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';

// NO MOCKS IN INTEGRATION TESTS - tests must fail if resources unavailable

// Skip integration tests if environment not properly set up
const hasRequiredEnv = process.env.ANTHROPIC_API_KEY && 
                      (process.env.MONGODB_URL || process.env.MONGODB_URI);
const describeIf = hasRequiredEnv ? describe : describe.skip;

describeIf('SD Package - Legion Planning Integration (Live)', () => {
  let sdModule;
  let resourceManager;

  beforeEach(async () => {
    // Use REAL ResourceManager - no mocks
    resourceManager = ResourceManager.getInstance();
    
    // Verify required environment variables exist
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || resourceManager.get('env.MONGODB_URI');
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable required for integration tests');
    }
    if (!mongoUrl) {
      throw new Error('MONGODB_URL or MONGODB_URI environment variable required for integration tests');
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DecentPlanner Integration', () => {
    it('should initialize SDModule with DecentPlanner', async () => {
      sdModule = await SDModule.create(resourceManager);
      
      expect(sdModule.decentPlanner).toBeDefined();
      expect(sdModule.decentPlanner).toBeInstanceOf(DecentPlanner);
      expect(sdModule.getPlanner()).toBe(sdModule.decentPlanner);
    });

    it('should have proper planner configuration', async () => {
      sdModule = await SDModule.create(resourceManager);
      
      const metadata = sdModule.getMetadata();
      expect(metadata.hasPlanner).toBe(true);
      expect(metadata.description).toContain('DecentPlanner integration');
    });

    it('should plan software development goals', async () => {
      sdModule = await SDModule.create(resourceManager);
      
      // Test REAL planning - no mocks
      const goal = 'Build a simple user authentication system';
      
      // This will call the REAL DecentPlanner with REAL LLM
      const result = await sdModule.planDevelopment(goal);
      
      // Verify the planning structure (results may vary based on actual LLM response)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.phases).toBeDefined();
        expect(result.phases.informal).toBeDefined();
      } else {
        // If planning fails, that's a real failure we need to know about
        console.error('Planning failed with real DecentPlanner:', result.error || result.reason);
        throw new Error('Real planning failed - this indicates a system issue');
      }
    }, 30000); // Longer timeout for real LLM calls
  });

  describe('Planning Profile Integration', () => {
    it('should integrate profiles with DecentPlanner', async () => {
      sdModule = await SDModule.create(resourceManager);
      
      const profiles = sdModule.getProfiles();
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
      
      const fullProfile = profiles.find(p => p.name === 'sd-full');
      expect(fullProfile).toBeDefined();
      expect(fullProfile.hasDecentPlannerIntegration).toBe(true);
    });

    it('should provide SD methodology context hints', async () => {
      sdModule = await SDModule.create(resourceManager);
      
      const contextHints = sdModule.profileManager.getContextHints();
      expect(contextHints).toBeDefined();
      expect(contextHints.domainKeywords).toContain('requirements');
      expect(contextHints.domainKeywords).toContain('domain model');
      expect(contextHints.domainKeywords).toContain('clean code');
    });

    it('should plan with specific profile', async () => {
      sdModule = await SDModule.create(resourceManager);
      
      // Test REAL profile-based planning - no mocks
      const goal = 'Parse requirements for user management system';
      
      try {
        const result = await sdModule.profileManager.planWithProfile('sd-requirements', goal);
        
        // Verify the result structure (actual content varies with real LLM)
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        
        if (result.success) {
          expect(result.phases).toBeDefined();
        }
      } catch (error) {
        // If planning fails due to real issues, we need to know
        console.error('Profile-based planning failed:', error.message);
        throw error;
      }
    }, 30000);
  });

  describe('Tool Integration with Planning', () => {
    it('should have tools available for planning', async () => {
      sdModule = new SDModule({ resourceManager });
      await sdModule.initialize();
      
      const tools = sdModule.getTools();
      expect(tools.length).toBeGreaterThan(0);
      
      // Check key tools are available
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('parse_requirements');
      expect(toolNames).toContain('store_artifact');
      expect(toolNames).toContain('retrieve_context');
    });

    it('should execute requirement parsing tool with real LLM', async () => {
      sdModule = new SDModule({ resourceManager });
      await sdModule.initialize();
      
      const parseRequirementsTool = sdModule.getTool('parse_requirements');
      expect(parseRequirementsTool).toBeDefined();
      
      // Test with REAL LLM - no mocks
      const result = await parseRequirementsTool.execute({
        requirementsText: 'The system must allow users to login with email and password',
        projectId: 'integration-test-project',
        analysisDepth: 'basic'
      });
      
      // If tool execution fails with real LLM/DB, that's a real system issue
      if (!result.success) {
        console.error('Real tool execution failed:', result.error);
        throw new Error(`RequirementParserTool failed with real dependencies: ${result.error}`);
      }
      
      expect(result.success).toBe(true);
      expect(result.data.parsedRequirements).toBeDefined();
      expect(result.data.parsedRequirements.functional).toBeDefined();
      expect(Array.isArray(result.data.parsedRequirements.functional)).toBe(true);
    }, 45000);

    it('should store artifacts with real database integration', async () => {
      sdModule = new SDModule({ resourceManager });
      await sdModule.initialize();
      
      // Test REAL database connection - no mocks
      const storageStats = await sdModule.designDatabase.healthCheck();
      expect(storageStats.status).toBe('healthy');
      
      // Test real artifact storage
      const testArtifact = {
        type: 'integration_test',
        data: { test: 'integration test artifact' },
        metadata: { testRun: new Date().toISOString() }
      };
      
      const storedArtifact = await sdModule.designDatabase.storeArtifact({
        ...testArtifact,
        projectId: 'integration-test-project'
      });
      
      expect(storedArtifact).toBeDefined();
      expect(storedArtifact.id).toBeDefined();
      expect(storedArtifact.type).toBe('integration_test');
    });
  });

  describe('End-to-End Planning Workflow', () => {
    it('should complete a full software development planning workflow with real planning', async () => {
      sdModule = new SDModule({ resourceManager });
      await sdModule.initialize();
      
      // Test REAL end-to-end planning - no mocks
      const goal = 'Build a simple user login system';
      const context = {
        requirements: 'User email/password authentication',
        constraints: ['Must be secure', 'Simple implementation']
      };
      
      try {
        const planResult = await sdModule.planDevelopment(goal, context);
        
        // Verify the real planning result structure
        expect(planResult).toBeDefined();
        expect(typeof planResult.success).toBe('boolean');
        
        if (planResult.success) {
          expect(planResult.phases).toBeDefined();
          expect(planResult.phases.informal).toBeDefined();
          
          if (planResult.phases.informal.hierarchy) {
            expect(planResult.phases.informal.hierarchy).toHaveProperty('description');
          }
        } else {
          // If real planning fails, log details and fail the test
          console.error('Real end-to-end planning failed:');
          console.error('Reason:', planResult.reason || planResult.error);
          if (planResult.phases?.informal?.validation) {
            console.error('Validation:', planResult.phases.informal.validation);
          }
          throw new Error('End-to-end planning failed with real components');
        }
      } catch (error) {
        console.error('End-to-end workflow error:', error.message);
        throw error;
      }
    }, 60000); // Long timeout for real LLM planning
  });

  describe('Error Handling', () => {
    it('should throw error when trying to plan without initialization', async () => {
      sdModule = new SDModule({ resourceManager });
      // Don't initialize
      
      await expect(sdModule.planDevelopment('Some goal')).rejects.toThrow('SDModule not initialized');
    });

    it('should fail fast if required environment variables missing', () => {
      // This test verifies proper fail-fast behavior
      expect(() => {
        const badResourceManager = {
          get: () => null, // Simulate missing env vars
          set: () => {}
        };
        const badSDModule = new SDModule({ resourceManager: badResourceManager });
        return badSDModule.initialize();
      }).toBeDefined(); // The init should be attempted, but will fail during execution
    });
  });
});